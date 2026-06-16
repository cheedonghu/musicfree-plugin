"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { createClient, AuthType } = require("webdav");
const CryptoJs = require("crypto-js");
const axios = require("axios");

// PikPak 原生 WebDAV 地址（固定）。在 PikPak App -> 设置 -> 实验功能 中开启 WebDAV，
// 会生成专用的 WebDAV 用户名/密码（与账号登录密码不同），填入下方用户变量即可。
const DAV_BASE = "https://dav.mypikpak.com";

// 递归扫描时的保护上限，避免目录过深/过多导致卡死。
const MAX_DEPTH = 5;
const MAX_FOLDERS = 500;
// 兜底逐层扫描时的并发请求数（PikPak 无明确频率限制，适度并发以提速）。
const CONCURRENCY = 6;
// 未填写根目录时的默认目录。不直接用 "/" 以免扫描真正的根目录造成卡顿；
// 若该默认目录不存在，扫描会自然返回空（不处理）。
const DEFAULT_PATH = "/music";
// “全部歌曲”实时歌单的哨兵 id（覆盖所有配置的根目录）。
const ALL_SHEET_ID = "pikpak://all";
const SHEET_PAGE_SIZE = 100;

const AUDIO_EXTS = [
    ".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".ape", ".wma", ".opus",
];

let cachedData = {};

function getUserVariables() {
    return (env && env.getUserVariables && env.getUserVariables()) || {};
}

function authHeader(username, password) {
    const token = CryptoJs.enc.Base64.stringify(
        CryptoJs.enc.Utf8.parse(`${username}:${password}`)
    );
    return `Basic ${token}`;
}

// 并发池：用 limit 个 worker 共享索引消费 items，保持结果顺序。
async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(
        async () => {
            while (cursor < items.length) {
                const idx = cursor++;
                results[idx] = await fn(items[idx], idx);
            }
        }
    );
    await Promise.all(workers);
    return results;
}

// 创建/复用 WebDAV 客户端；用户变量变化时使缓存失效。
// 注意：nameOrder 不参与缓存键——歌手/标题在读取时才解析，改顺序无需重扫。
function getClient() {
    const { username, password, searchPath } = getUserVariables();
    if (!(username && password)) {
        return null;
    }
    if (
        cachedData.username !== username ||
        cachedData.password !== password ||
        cachedData.searchPath !== searchPath
    ) {
        cachedData = {
            username,
            password,
            searchPath,
            searchPathList: (searchPath || "")
                .split(",")
                .map((it) => it.trim())
                .filter(Boolean),
            fileList: null,
            lyricCache: {},
            sheetCache: {},
        };
    }
    return createClient(DAV_BASE, {
        authType: AuthType.Password,
        username,
        password,
    });
}

function getSearchPathList() {
    return cachedData.searchPathList && cachedData.searchPathList.length
        ? cachedData.searchPathList
        : [DEFAULT_PATH];
}

function basenameOf(path) {
    const trimmed = (path || "").replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function hasAudioExt(name) {
    const lower = (name || "").toLowerCase();
    return AUDIO_EXTS.some((ext) => lower.endsWith(ext));
}

function isAudio(file) {
    return (
        file.type === "file" &&
        (((file.mime || "").startsWith("audio")) || hasAudioExt(file.basename))
    );
}

// 读取用户配置的命名顺序："标题-歌手" 或默认 "歌手-标题"。
function getNameOrder() {
    const { nameOrder } = getUserVariables();
    const s = (nameOrder || "").trim().toLowerCase().replace(/\s/g, "");
    if (s === "标题-歌手" || s === "title-artist" || s.startsWith("标题")) {
        return "title-artist";
    }
    return "artist-title";
}

// 把文件名（已去扩展名）按分隔符拆成两段。
// 优先匹配两侧带空格的连字符（如 "Jay-Z - 晴天" 能正确在 " - " 处断开），
// 否则退而匹配第一个裸连字符；支持 - – — 三种横线。
function splitName(nameNoExt) {
    let m = nameNoExt.match(/^(.*?)\s+[-–—]\s+(.*)$/);
    if (m && m[1].trim() && m[2].trim()) {
        return [m[1].trim(), m[2].trim()];
    }
    m = nameNoExt.match(/^(.*?)[-–—](.*)$/);
    if (m && m[1].trim() && m[2].trim()) {
        return [m[1].trim(), m[2].trim()];
    }
    return null;
}

// 从文件名解析歌手/标题。order 决定两段的归属。
function parseName(basename, order) {
    const dot = basename.lastIndexOf(".");
    const nameNoExt = dot > 0 ? basename.slice(0, dot) : basename;
    const parts = splitName(nameNoExt);
    if (!parts) {
        return { artist: "未知作者", title: nameNoExt };
    }
    const [first, second] = parts;
    if (order === "title-artist") {
        return { title: first, artist: second };
    }
    return { artist: first, title: second };
}

// file 为精简后的 { id, basename }；order 为当前命名顺序。
function toMusicItem(file, order) {
    const { artist, title } = parseName(file.basename, order);
    return {
        id: file.id, // 绝对 WebDAV 路径，getMediaSource 据此拼播放地址
        title,
        artist,
        album: "未知专辑",
    };
}

// 把若干原始文件列表去重、精简为 { id, basename }[]。
function flattenFiles(fileGroups) {
    const seen = new Set();
    const list = [];
    for (const files of fileGroups) {
        for (const file of files) {
            if (!seen.has(file.filename)) {
                seen.add(file.filename);
                list.push({ id: file.filename, basename: file.basename });
            }
        }
    }
    return list;
}

// 递归收集某个目录下的全部音频文件，返回原始文件对象数组。
// 优先用一次深度 PROPFIND（Depth: infinity）；PikPak 不支持/失败时回退为“逐层并发 BFS”。
async function scanFolder(client, root) {
    // 1) 尝试一次性深度遍历
    try {
        const all = await client.getDirectoryContents(root, { deep: true });
        const files = all.filter(isAudio);
        // 深度遍历应返回嵌套文件；若只拿到根目录这一层，则判定为不支持并回退。
        const rootLen = root.replace(/\/+$/, "").length;
        const hasNested = files.some(
            (f) => f.filename.replace(/\/+$/, "").lastIndexOf("/") > rootLen
        );
        if (files.length && (hasNested || !all.some((f) => f.type === "directory"))) {
            return files;
        }
    } catch (e) {
        // 回退到逐层并发 BFS
    }

    // 2) 逐层并发 BFS：每层用 mapPool 并发拉取，吞掉单个目录的错误。
    const result = [];
    let level = [root];
    let depth = 0;
    let visited = 0;
    while (level.length && visited < MAX_FOLDERS) {
        const batch = level.slice(0, MAX_FOLDERS - visited);
        visited += batch.length;
        const listings = await mapPool(batch, CONCURRENCY, async (path) => {
            try {
                return await client.getDirectoryContents(path);
            } catch (e) {
                return [];
            }
        });
        const nextLevel = [];
        for (const entries of listings) {
            for (const entry of entries) {
                if (entry.type === "directory") {
                    if (depth < MAX_DEPTH) {
                        nextLevel.push(entry.filename);
                    }
                } else if (isAudio(entry)) {
                    result.push(entry);
                }
            }
        }
        level = nextLevel;
        depth++;
    }
    return result;
}

// 扫描某个目录并精简为 { id, basename }[]。
async function scanFolderSlim(client, root) {
    return flattenFiles([await scanFolder(client, root)]);
}

// 扫描所有配置路径，得到原始文件列表（带缓存，整个会话复用）。
async function loadFileList() {
    const client = getClient();
    if (!client) {
        return [];
    }
    if (cachedData.fileList) {
        return cachedData.fileList;
    }
    const groups = [];
    for (const path of getSearchPathList()) {
        groups.push(await scanFolder(client, path));
    }
    cachedData.fileList = flattenFiles(groups);
    return cachedData.fileList;
}

// —— 歌词编码处理（UTF-8 / GBK 自动识别）——
// 沙箱无 iconv、Hermes 无 ICU（TextDecoder('gbk') 不可用），故自带一张运行时下载的
// GBK 码点表（gbk-index.json，与插件同仓库托管）；逐文件自动判别 UTF-8 / GBK。
let gbkIndex = null; // 缓存的 GBK 码点表（用户无关、常量，跨会话复用）
let gbkIndexPromise = null; // 进行中的下载，避免并发重复请求

function getGbkIndexUrl() {
    const { gbkIndexUrl } = getUserVariables();
    return (gbkIndexUrl || "").trim();
}

function getLyricEncoding() {
    const { lyricEncoding } = getUserVariables();
    const s = (lyricEncoding || "").trim().toLowerCase();
    if (s === "utf-8" || s === "utf8") return "utf-8";
    if (s === "gbk" || s === "gb2312" || s === "gb18030") return "gbk";
    return "auto";
}

// 下载并缓存 GBK 表（最多下一次）。未配置 URL 或失败时返回 null。
async function loadGbkIndex() {
    if (gbkIndex) return gbkIndex;
    const url = getGbkIndexUrl();
    if (!url) return null;
    if (!gbkIndexPromise) {
        gbkIndexPromise = axios
            .get(url, { timeout: 20000 })
            .then((res) => {
                const data = res.data;
                const arr = typeof data === "string" ? JSON.parse(data) : data;
                if (Array.isArray(arr) && arr.length) {
                    gbkIndex = arr;
                    return arr;
                }
                return null;
            })
            .catch(() => null);
    }
    return gbkIndexPromise;
}

// crypto-js WordArray -> 字节数组
function wordArrayToBytes(wa) {
    const words = wa.words;
    const sigBytes = wa.sigBytes;
    const out = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return out;
}

// 把 axios 返回的多种形态（Buffer / ArrayBuffer / base64 字符串）统一成 Uint8Array
function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    if (data instanceof Uint8Array) return data; // Node Buffer 也是 Uint8Array
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    if (data && data.buffer instanceof ArrayBuffer) {
        return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    }
    if (typeof data === "string") {
        // 退路：base64 字符串（RN 若用 responseType:'base64'）
        try {
            return wordArrayToBytes(CryptoJs.enc.Base64.parse(data));
        } catch (e) {
            const out = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 0xff;
            return out;
        }
    }
    try {
        return Uint8Array.from(data);
    } catch (e) {
        return new Uint8Array(0);
    }
}

function codePointToStr(cp) {
    if (cp <= 0xffff) return String.fromCharCode(cp);
    cp -= 0x10000;
    return String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
}

// 字节序列是否为合法 UTF-8（纯 ASCII 也返回 true）
function isLikelyUtf8(bytes) {
    const n = bytes.length;
    let i = 0;
    while (i < n) {
        const b = bytes[i];
        if (b < 0x80) { i++; continue; }
        let need;
        if (b >= 0xc2 && b <= 0xdf) need = 1;
        else if (b >= 0xe0 && b <= 0xef) need = 2;
        else if (b >= 0xf0 && b <= 0xf4) need = 3;
        else return false;
        if (i + need >= n) return false;
        for (let k = 1; k <= need; k++) {
            const c = bytes[i + k];
            if (c < 0x80 || c > 0xbf) return false;
        }
        i += need + 1;
    }
    return true;
}

function decodeUtf8(bytes) {
    let out = "";
    let i = 0;
    const n = bytes.length;
    while (i < n) {
        const b = bytes[i];
        let cp, len;
        if (b < 0x80) { cp = b; len = 1; }
        else if (b >= 0xc2 && b <= 0xdf) { cp = b & 0x1f; len = 2; }
        else if (b >= 0xe0 && b <= 0xef) { cp = b & 0x0f; len = 3; }
        else if (b >= 0xf0 && b <= 0xf4) { cp = b & 0x07; len = 4; }
        else { out += "�"; i++; continue; }
        if (i + len > n) { out += "�"; break; }
        for (let k = 1; k < len; k++) cp = (cp << 6) | (bytes[i + k] & 0x3f);
        out += codePointToStr(cp);
        i += len;
    }
    return out;
}

// 按 WHATWG gb18030 双字节指针公式解码（覆盖 GBK）
function decodeGbk(bytes, index) {
    let out = "";
    let i = 0;
    const n = bytes.length;
    while (i < n) {
        const b = bytes[i];
        if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
        if (b === 0x80) { out += "€"; i++; continue; } // cp936: 0x80 = 欧元符号
        const b2 = bytes[i + 1];
        const valid2 = b2 !== undefined &&
            ((b2 >= 0x40 && b2 <= 0x7e) || (b2 >= 0x80 && b2 <= 0xfe));
        if (b >= 0x81 && b <= 0xfe && valid2) {
            const ptr = (b - 0x81) * 190 + (b2 - (b2 < 0x7f ? 0x40 : 0x41));
            const cp = ptr >= 0 && ptr < index.length ? index[ptr] : 0;
            out += cp ? codePointToStr(cp) : "�";
            i += 2;
        } else {
            out += "�";
            i++;
        }
    }
    return out;
}

// 字节 -> 文本：处理 BOM、强制编码、自动识别
async function decodeLyricBytes(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return decodeUtf8(bytes.subarray(3)); // UTF-8 BOM
    }
    const force = getLyricEncoding();
    if (force === "utf-8") return decodeUtf8(bytes);
    if (force === "gbk") {
        const index = await loadGbkIndex();
        return index ? decodeGbk(bytes, index) : decodeUtf8(bytes);
    }
    // auto：先验 UTF-8，否则尝试 GBK（表不可用则回退 UTF-8）
    if (isLikelyUtf8(bytes)) return decodeUtf8(bytes);
    const index = await loadGbkIndex();
    return index ? decodeGbk(bytes, index) : decodeUtf8(bytes);
}

// 读取并解码与音频同名的 .lrc 歌词。返回 { rawLrc } 或 null（无歌词）。
// 用 axios 按字节获取（带 Authorization 头）——与播放同样的成熟链路，axios 会自动
// 跟随 PikPak 的 302 跳转到 CDN；显式 timeout 覆盖全局 2s 默认。
async function fetchBytes(lrcPath, auth) {
    const res = await axios.get(DAV_BASE + encodeURI(lrcPath), {
        headers: { Authorization: auth },
        timeout: 15000,
        responseType: "arraybuffer",
        transformResponse: (data) => data,
    });
    return toBytes(res.data);
}

async function loadLyric(musicItem) {
    if (!musicItem || !musicItem.id) {
        return null;
    }
    const { username, password } = getUserVariables();
    if (!(username && password)) {
        return null;
    }
    const cache = cachedData.lyricCache || (cachedData.lyricCache = {});
    const id = musicItem.id;
    if (Object.prototype.hasOwnProperty.call(cache, id)) {
        // 命中缓存（含“无歌词”的负缓存）
        return cache[id] ? { rawLrc: cache[id] } : null;
    }

    // 候选路径：① 把扩展名换成 .lrc；② 整名后再追加 .lrc（适配 x.mp3.lrc）
    const dot = id.lastIndexOf(".");
    const candidates = [];
    if (dot > 0) {
        candidates.push(id.slice(0, dot) + ".lrc");
    }
    candidates.push(id + ".lrc");

    const auth = authHeader(username, password);
    for (const lrcPath of candidates) {
        try {
            const bytes = await fetchBytes(lrcPath, auth);
            if (bytes && bytes.length) {
                const text = await decodeLyricBytes(bytes);
                if (text) {
                    cache[id] = text;
                    return { rawLrc: text };
                }
            }
        } catch (e) {
            // 该候选不存在/读取失败（含 404/302 异常），尝试下一个
        }
    }

    cache[id] = null; // 负缓存，避免重复请求
    return null;
}

// 歌曲排序：先按歌手，再按标题（locale 比较，中文友好）。
function byArtistTitle(a, b) {
    const ar = (a.artist || "").localeCompare(b.artist || "");
    return ar !== 0 ? ar : (a.title || "").localeCompare(b.title || "");
}

// 实时构建某歌单的歌曲列表（不走 loadFileList 会话缓存，确保反映 PikPak 当前增删）。
async function buildSheetMusicList(client, sheetId) {
    const roots = sheetId === ALL_SHEET_ID ? getSearchPathList() : [sheetId];
    const order = getNameOrder();
    const groups = [];
    for (const root of roots) {
        groups.push(await scanFolder(client, root));
    }
    const list = flattenFiles(groups).map((f) => toMusicItem(f, order));
    list.sort(byArtistTitle);
    return list;
}

async function searchMusic(query) {
    const fileList = await loadFileList();
    const order = getNameOrder();
    const library = fileList.map((f) => toMusicItem(f, order));
    const q = (query || "").toLowerCase();
    const data = q
        ? library.filter(
              (it) =>
                  it.title.toLowerCase().includes(q) ||
                  it.artist.toLowerCase().includes(q)
          )
        : library;
    return { isEnd: true, data };
}

module.exports = {
    platform: "PikPak",
    author: "east",
    version: "0.0.4",
    description:
        "PikPak 网盘音乐源。请先在 PikPak App -> 设置 -> 实验功能 中开启 WebDAV，使用其生成的 WebDAV 专用账号/密码（需会员）。可在榜单里按顶层文件夹浏览，或用搜索检索整库；在“导入歌单”中输入某个目录路径可将其导入为本地歌单。歌词：把与歌曲同名的 .lrc 文件放在同一目录即可自动显示（自动识别 UTF-8/GBK，GBK 需配置“GBK 表地址”）。",
    cacheControl: "no-cache",
    supportedSearchType: ["music"],
    hints: {
        importMusicSheet: ["输入要导入的目录路径，留空则导入配置的根目录"],
    },
    userVariables: [
        {
            key: "username",
            name: "用户名",
            hint: "PikPak 实验功能里生成的 WebDAV 用户名",
        },
        {
            key: "password",
            name: "密码",
            type: "password",
            hint: "PikPak 实验功能里生成的 WebDAV 密码",
        },
        {
            key: "searchPath",
            name: "歌曲根目录",
            hint: "可留空，默认 /music；多个用英文逗号分隔",
        },
        {
            key: "nameOrder",
            name: "文件名顺序",
            hint: "填“歌手-标题”(默认) 或“标题-歌手”，按你的命名习惯决定哪段是歌手",
        },
        {
            key: "gbkIndexUrl",
            name: "GBK 表地址",
            hint: "指向与插件同仓库的 gbk-index.json 原始地址；留空则歌词仅按 UTF-8 解析",
        },
        {
            key: "lyricEncoding",
            name: "歌词编码",
            hint: "留空=自动识别；可填 utf-8 或 gbk 强制",
        },
    ],
    search(query, page, type) {
        if (type === "music") {
            return searchMusic(query);
        }
    },
    // 懒加载浏览：每个配置根目录用一次 Depth:1 列出顶层子文件夹作为入口，
    // 不触发全库扫描；点进去（getTopListDetail）才扫描该文件夹。
    async getTopLists() {
        const client = getClient();
        if (!client) {
            return [];
        }
        const groups = [];
        for (const root of getSearchPathList()) {
            let entries;
            try {
                entries = await client.getDirectoryContents(root);
            } catch (e) {
                // 目录不存在/无法访问则跳过，不展示该入口（不处理）。
                continue;
            }
            const folders = entries.filter((e) => e.type === "directory");
            const data = [
                {
                    id: root,
                    title: (root === "/" ? "根目录" : basenameOf(root)) + "（全部）",
                },
                ...folders.map((f) => ({ id: f.filename, title: f.basename })),
            ];
            groups.push({ title: root === "/" ? "PikPak" : root, data });
        }
        return groups;
    },
    async getTopListDetail(topListItem) {
        const client = getClient();
        if (!client) {
            return { ...topListItem, musicList: [] };
        }
        const files = await scanFolderSlim(client, topListItem.id);
        const order = getNameOrder();
        return {
            ...topListItem,
            musicList: files.map((f) => toMusicItem(f, order)),
        };
    },
    // 返回 WebDAV 地址 + Authorization 头，由播放器自动跟随 PikPak 的 302 跳转到 CDN。
    getMediaSource(musicItem) {
        const { username, password } = getUserVariables();
        if (!(username && password)) {
            return null;
        }
        return {
            url: DAV_BASE + musicItem.id,
            headers: {
                Authorization: authHeader(username, password),
            },
        };
    },
    // 读取与音频文件同名的 .lrc 歌词（需将歌词文件与歌曲放在同一目录、同名）。
    getLyric(musicItem) {
        return loadLyric(musicItem);
    },
    // —— 可收藏的“实时歌单”（推荐歌单入口）——
    // 在“推荐歌单”里出现一个固定 tag，点开后是一个“全部歌曲”歌单；
    // 收藏(❤)它后，每次打开都会实时重查，自动反映 PikPak 的新增/删除。
    async getRecommendSheetTags() {
        return { pinned: [{ id: "pikpak", title: "PikPak" }] };
    },
    async getRecommendSheetsByTag() {
        const client = getClient();
        if (!client) {
            return { isEnd: true, data: [] };
        }
        return {
            isEnd: true,
            data: [
                {
                    id: ALL_SHEET_ID,
                    platform: "PikPak",
                    title: "全部歌曲",
                },
            ],
        };
    },
    async getMusicSheetInfo(sheetItem, page) {
        // sheetItem.id 缺失时退回“全部歌曲”，避免从收藏冷启动时拿不到 id 而空列表。
        const sheetId = (sheetItem && sheetItem.id) || ALL_SHEET_ID;
        const client = getClient();
        // 诊断日志（MusicFree 会收集插件 console），便于排查“收藏打开为空”。
        console.log("[PikPak] getMusicSheetInfo", {
            id: sheetId,
            page: page,
            hasClient: !!client,
        });
        if (!client) {
            // 凭据未就绪：返回 null 让详情页进入可重试状态（用户下拉/重试即可恢复）。
            return null;
        }
        const cache = cachedData.sheetCache || (cachedData.sheetCache = {});
        let list;
        if (!page || page <= 1) {
            // 第 1 页：实时重新扫描，反映当前增删
            list = await buildSheetMusicList(client, sheetId);
            cache[sheetId] = list;
            console.log("[PikPak] sheet built", { id: sheetId, count: list.length });
        } else {
            list = cache[sheetId] || [];
        }
        const start = ((page || 1) - 1) * SHEET_PAGE_SIZE;
        const pageData = list.slice(start, start + SHEET_PAGE_SIZE);
        return {
            isEnd: start + SHEET_PAGE_SIZE >= list.length,
            sheetItem: { ...sheetItem, id: sheetId, platform: "PikPak", worksNum: list.length },
            musicList: pageData,
        };
    },
    // 把某个目录递归导入为本地歌单（静态快照；源文件增删不会自动同步，需重新导入）。
    // urlLike 为要导入的目录路径，留空则使用配置的根目录。
    async importMusicSheet(urlLike) {
        const client = getClient();
        if (!client) {
            return null;
        }
        const roots = urlLike && urlLike.trim()
            ? [urlLike.trim()]
            : getSearchPathList();
        const groups = [];
        for (const root of roots) {
            groups.push(await scanFolder(client, root));
        }
        const order = getNameOrder();
        return flattenFiles(groups).map((f) => toMusicItem(f, order));
    },
};
