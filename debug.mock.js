/**
 * debug.mock.js —— 离线逻辑调试脚手架（不联网、不需要真账号）
 *
 * 用法：
 *   node debug.mock.js
 *   # 打断点：在 WebDAV.js 里写 debugger;  然后
 *   node inspect debug.mock.js           （命令行调试器：c/n/s/repl/.exit）
 *   node --inspect-brk debug.mock.js      （配合 Chrome chrome://inspect 或 VS Code）
 *
 * 原理：用假的 webdav / crypto-js 模块替换真实依赖，自己编一棵目录树（MOCK_TREE），
 * 这样无需安装依赖、不碰网络、不需要 PikPak 凭据，就能调试扫描/解析/缓存等纯逻辑。
 * 想测试什么就改 MOCK_TREE、ENV、底部的“运行场景”。
 *
 * 注意：本文件仅用于本地调试，不要作为插件分发。
 */

"use strict";
const Module = require("module");

// ────────────────────────────────────────────────────────────────────────
// 1) 可编辑：模拟的网盘目录树。键是目录路径，值是该目录下的条目。
//    file 需要 type/basename/filename，音频可给 mime（不给则靠扩展名识别）。
// ────────────────────────────────────────────────────────────────────────
const MOCK_TREE = {
    "/music": [
        { type: "file", basename: "周杰伦 - 晴天.mp3", filename: "/music/周杰伦 - 晴天.mp3", mime: "audio/mpeg" },
        { type: "directory", basename: "陈奕迅", filename: "/music/陈奕迅" },
        { type: "directory", basename: "Adele", filename: "/music/Adele" },
        { type: "file", basename: "readme.txt", filename: "/music/readme.txt", mime: "text/plain" },
    ],
    "/music/陈奕迅": [
        { type: "file", basename: "陈奕迅-十年.flac", filename: "/music/陈奕迅/陈奕迅-十年.flac" },
        { type: "directory", basename: "专辑U87", filename: "/music/陈奕迅/专辑U87" },
    ],
    "/music/陈奕迅/专辑U87": [
        { type: "file", basename: "浮夸.mp3", filename: "/music/陈奕迅/专辑U87/浮夸.mp3", mime: "audio/mpeg" },
    ],
    "/music/Adele": [
        { type: "file", basename: "Adele – Hello.m4a", filename: "/music/Adele/Adele – Hello.m4a", mime: "audio/mp4" },
    ],
};

// 模拟服务器是否支持一次性深度遍历（Depth: infinity）。
// PikPak 实测多半不支持 -> 设 false 来调试“逐层并发 BFS”兜底路径。
const MOCK_SUPPORT_DEEP = false;

// 可编辑：模拟的 .lrc 歌词文件（键=歌词文件路径，值=歌词文本）。
// getLyric 会先找 同名.lrc，再找 整名.mp3.lrc。
const MOCK_LRC = {
    "/music/周杰伦 - 晴天.lrc": "[00:01.00]故事的小黄花\n[00:05.00]从出生那年就飘着",
};

// ────────────────────────────────────────────────────────────────────────
// 2) 可编辑：注入给插件的用户变量（相当于 App 里填的配置）。
//    留空 searchPath 可测试“默认 /music”逻辑。
// ────────────────────────────────────────────────────────────────────────
const ENV_VARS = {
    username: "mockUser",
    password: "mockPass",
    searchPath: "/music",
    // nameOrder: "标题-歌手",
};

// ════════════════════════════════════════════════════════════════════════
// 下面一般不用改：假模块 + 请求计数
// ════════════════════════════════════════════════════════════════════════

const stats = { deep: 0, shallow: 0, requests: [] };

function listChildren(path) {
    const key = path.replace(/\/+$/, "") || "/";
    if (!MOCK_TREE[key]) {
        const err = new Error("404 Not Found: " + key);
        err.status = 404;
        throw err;
    }
    return MOCK_TREE[key];
}

function listDeep(path) {
    // 返回 path 子树下的全部条目（文件 + 目录），模拟 Depth: infinity。
    const out = [];
    const walk = (p) => {
        let entries;
        try { entries = listChildren(p); } catch (e) { return; }
        for (const e of entries) {
            out.push(e);
            if (e.type === "directory") walk(e.filename);
        }
    };
    walk(path);
    return out;
}

const fakeWebdav = {
    AuthType: { Password: "password" },
    createClient() {
        return {
            async getDirectoryContents(path, opts) {
                if (opts && opts.deep) {
                    stats.deep++;
                    stats.requests.push(`PROPFIND(deep) ${path}`);
                    if (!MOCK_SUPPORT_DEEP) throw new Error("deep not supported");
                    return listDeep(path);
                }
                stats.shallow++;
                stats.requests.push(`PROPFIND ${path}`);
                return listChildren(path);
            },
            async getFileContents(path, opts) {
                stats.requests.push(`GET ${path}`);
                if (MOCK_LRC[path] === undefined) {
                    const err = new Error("404 Not Found: " + path);
                    err.status = 404;
                    throw err;
                }
                return MOCK_LRC[path];
            },
        };
    },
};

// 只实现插件用到的 crypto-js 子集：enc.Utf8.parse + enc.Base64.stringify/parse。
const fakeCrypto = {
    enc: {
        Utf8: {
            parse: (str) => ({ __raw: str }),
            stringify: (wa) => Buffer.from(wa.__b64 || "", "base64").toString("utf8"),
        },
        Base64: {
            stringify: (wa) => Buffer.from(wa.__raw || "", "utf8").toString("base64"),
            parse: (b64) => ({ __b64: b64 }),
        },
    },
};

// 假 axios：歌词按字节获取（responseType:'arraybuffer'），返回 Buffer 模拟字节。
const fakeAxios = {
    async get(url, opts) {
        stats.requests.push(`GET ${url}`);
        let path;
        try {
            path = decodeURI(url.replace("https://dav.mypikpak.com", ""));
        } catch (e) {
            path = url;
        }
        if (MOCK_LRC[path] === undefined) {
            const err = new Error("404 Not Found: " + path);
            err.response = { status: 404 };
            throw err;
        }
        // 这里用 UTF-8 字节即可（GBK 解码已由 __tmp 测试用真实表覆盖）
        return { data: Buffer.from(MOCK_LRC[path], "utf8") };
    },
};

const origLoad = Module._load;
Module._load = function (request) {
    if (request === "webdav") return fakeWebdav;
    if (request === "crypto-js") return fakeCrypto;
    if (request === "axios") return fakeAxios;
    return origLoad.apply(this, arguments);
};

global.env = {
    getUserVariables: () => ENV_VARS,
    appVersion: "0.0.0",
    os: "android",
    lang: "zh-CN",
};

// ════════════════════════════════════════════════════════════════════════
// 3) 运行场景：想调试哪个方法就改这里
// ════════════════════════════════════════════════════════════════════════
const plugin = require("./pikpak-dav.js"); // 构建产物（先 npm run build；可借 sourcemap 在 .ts 上断点）
const dump = (label, v) => console.log(`\n== ${label} ==\n` + JSON.stringify(v, null, 2));

(async () => {
    // 搜索整库
    const all = await plugin.search("", 1, "music");
    dump(`search("") -> ${all.data.length} 首`, all.data);

    // 关键词过滤
    const hit = await plugin.search("十年", 1, "music");
    dump('search("十年")', hit.data);

    // 顶层文件夹浏览
    const tops = await plugin.getTopLists();
    dump("getTopLists()", tops);

    // 点开第一个子文件夹
    const firstFolder = tops[0] && tops[0].data.find((d) => !d.title.endsWith("（全部）"));
    if (firstFolder) {
        const detail = await plugin.getTopListDetail(firstFolder);
        dump(`getTopListDetail("${firstFolder.title}")`, detail.musicList);
    }

    // 播放源（注意会带 Authorization 头）
    if (all.data[0]) dump("getMediaSource(第一首)", plugin.getMediaSource(all.data[0]));

    // 歌词（找同名 .lrc）
    if (all.data[0]) dump("getLyric(第一首)", await plugin.getLyric(all.data[0]));

    // 可收藏的实时歌单（推荐歌单 -> 全部歌曲）
    const recSheets = await plugin.getRecommendSheetsByTag({ id: "pikpak" }, 1);
    dump("getRecommendSheetsByTag()", recSheets);
    if (recSheets.data[0]) {
        const sheetInfo = await plugin.getMusicSheetInfo(recSheets.data[0], 1);
        dump(`getMusicSheetInfo(${recSheets.data[0].title}) -> ${sheetInfo.musicList.length} 首`, {
            isEnd: sheetInfo.isEnd,
            worksNum: sheetInfo.sheetItem.worksNum,
            head: sheetInfo.musicList.slice(0, 3),
        });
    }

    // 导入歌单
    const sheet = await plugin.importMusicSheet("");
    dump(`importMusicSheet("") -> ${sheet ? sheet.length : 0} 首`, sheet);

    // 请求统计（看扫描了多少次、有没有命中缓存）
    console.log(`\n== 请求统计 ==`);
    console.log(`deep=${stats.deep}  shallow=${stats.shallow}  共 ${stats.requests.length} 次`);
    console.log(stats.requests.join("\n"));
})().catch((e) => {
    console.error("运行出错:", e);
    process.exit(1);
});
