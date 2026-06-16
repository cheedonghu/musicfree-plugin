"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var webdav_1 = require("webdav");
var CryptoJs = __importStar(require("crypto-js"));
var axios_1 = __importDefault(require("axios"));
// PikPak 原生 WebDAV 地址（固定）。在 PikPak App -> 设置 -> 实验功能 中开启 WebDAV，
// 会生成专用的 WebDAV 用户名/密码（与账号登录密码不同），填入下方用户变量即可。
var DAV_BASE = "https://dav.mypikpak.com";
// 递归扫描时的保护上限，避免目录过深/过多导致卡死。
var MAX_DEPTH = 5;
var MAX_FOLDERS = 500;
// 兜底逐层扫描时的并发请求数（PikPak 无明确频率限制，适度并发以提速）。
var CONCURRENCY = 6;
// 未填写根目录时的默认目录。不直接用 "/" 以免扫描真正的根目录造成卡顿；
// 若该默认目录不存在，扫描会自然返回空（不处理）。
var DEFAULT_PATH = "/music";
// “全部歌曲”实时歌单的哨兵 id（覆盖所有配置的根目录）。
var ALL_SHEET_ID = "pikpak://all";
var SHEET_PAGE_SIZE = 100;
// GBK 歌词解码表地址（与插件同仓库托管，需用 raw 原始地址，不能用 GitHub blob 页面）。
var GBK_INDEX_URL = "https://raw.githubusercontent.com/cheedonghu/musicfree-plugin/main/gbk-index.json";
var AUDIO_EXTS = [
    ".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".ape", ".wma", ".opus",
];
var cachedData = {};
function getUserVariables() {
    return (env && env.getUserVariables && env.getUserVariables()) || {};
}
function authHeader(username, password) {
    var token = CryptoJs.enc.Base64.stringify(CryptoJs.enc.Utf8.parse("".concat(username, ":").concat(password)));
    return "Basic ".concat(token);
}
// 并发池：用 limit 个 worker 共享索引消费 items，保持结果顺序。
function mapPool(items, limit, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var results, cursor, workers;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = new Array(items.length);
                    cursor = 0;
                    workers = new Array(Math.min(limit, items.length)).fill(0).map(function () { return __awaiter(_this, void 0, void 0, function () {
                        var idx, _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (!(cursor < items.length)) return [3 /*break*/, 2];
                                    idx = cursor++;
                                    _a = results;
                                    _b = idx;
                                    return [4 /*yield*/, fn(items[idx], idx)];
                                case 1:
                                    _a[_b] = _c.sent();
                                    return [3 /*break*/, 0];
                                case 2: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(workers)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, results];
            }
        });
    });
}
// 创建/复用 WebDAV 客户端；用户变量变化时使缓存失效。
// 注意：nameOrder 不参与缓存键——歌手/标题在读取时才解析，改顺序无需重扫。
function getClient() {
    var _a = getUserVariables(), username = _a.username, password = _a.password, searchPath = _a.searchPath;
    if (!(username && password)) {
        return null;
    }
    if (cachedData.username !== username ||
        cachedData.password !== password ||
        cachedData.searchPath !== searchPath) {
        cachedData = {
            username: username,
            password: password,
            searchPath: searchPath,
            searchPathList: (searchPath || "")
                .split(",")
                .map(function (it) { return it.trim(); })
                .filter(Boolean),
            fileList: null,
            lyricCache: {},
            sheetCache: {},
        };
    }
    return (0, webdav_1.createClient)(DAV_BASE, {
        authType: webdav_1.AuthType.Password,
        username: username,
        password: password,
    });
}
function getSearchPathList() {
    return cachedData.searchPathList && cachedData.searchPathList.length
        ? cachedData.searchPathList
        : [DEFAULT_PATH];
}
function basenameOf(path) {
    var trimmed = (path || "").replace(/\/+$/, "");
    var idx = trimmed.lastIndexOf("/");
    return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}
function hasAudioExt(name) {
    var lower = (name || "").toLowerCase();
    return AUDIO_EXTS.some(function (ext) { return lower.endsWith(ext); });
}
function isAudio(file) {
    return (file.type === "file" &&
        (((file.mime || "").startsWith("audio")) || hasAudioExt(file.basename)));
}
// 读取用户配置的命名顺序："标题-歌手" 或默认 "歌手-标题"。
function getNameOrder() {
    var nameOrder = getUserVariables().nameOrder;
    var s = (nameOrder || "").trim().toLowerCase().replace(/\s/g, "");
    if (s === "标题-歌手" || s === "title-artist" || s.startsWith("标题")) {
        return "title-artist";
    }
    return "artist-title";
}
// 把文件名（已去扩展名）按分隔符拆成两段。
// 优先匹配两侧带空格的连字符（如 "Jay-Z - 晴天" 能正确在 " - " 处断开），
// 否则退而匹配第一个裸连字符；支持 - – — 三种横线。
function splitName(nameNoExt) {
    var m = nameNoExt.match(/^(.*?)\s+[-–—]\s+(.*)$/);
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
    var dot = basename.lastIndexOf(".");
    var nameNoExt = dot > 0 ? basename.slice(0, dot) : basename;
    var parts = splitName(nameNoExt);
    if (!parts) {
        return { artist: "未知作者", title: nameNoExt };
    }
    var first = parts[0], second = parts[1];
    if (order === "title-artist") {
        return { title: first, artist: second };
    }
    return { artist: first, title: second };
}
// file 为精简后的 { id, basename }；order 为当前命名顺序。
function toMusicItem(file, order) {
    var _a = parseName(file.basename, order), artist = _a.artist, title = _a.title;
    return {
        id: file.id, // 绝对 WebDAV 路径，getMediaSource 据此拼播放地址
        title: title,
        artist: artist,
        album: "未知专辑",
    };
}
// 把若干原始文件列表去重、精简为 { id, basename }[]。
function flattenFiles(fileGroups) {
    var seen = new Set();
    var list = [];
    for (var _i = 0, fileGroups_1 = fileGroups; _i < fileGroups_1.length; _i++) {
        var files = fileGroups_1[_i];
        for (var _a = 0, files_1 = files; _a < files_1.length; _a++) {
            var file = files_1[_a];
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
function scanFolder(client, root) {
    return __awaiter(this, void 0, void 0, function () {
        var all, files, rootLen_1, hasNested, e_1, result, level, depth, visited, batch, listings, nextLevel, _i, listings_1, entries, _a, entries_1, entry;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, client.getDirectoryContents(root, { deep: true })];
                case 1:
                    all = _b.sent();
                    files = all.filter(isAudio);
                    rootLen_1 = root.replace(/\/+$/, "").length;
                    hasNested = files.some(function (f) { return f.filename.replace(/\/+$/, "").lastIndexOf("/") > rootLen_1; });
                    if (files.length && (hasNested || !all.some(function (f) { return f.type === "directory"; }))) {
                        return [2 /*return*/, files];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _b.sent();
                    return [3 /*break*/, 3];
                case 3:
                    result = [];
                    level = [root];
                    depth = 0;
                    visited = 0;
                    _b.label = 4;
                case 4:
                    if (!(level.length && visited < MAX_FOLDERS)) return [3 /*break*/, 6];
                    batch = level.slice(0, MAX_FOLDERS - visited);
                    visited += batch.length;
                    return [4 /*yield*/, mapPool(batch, CONCURRENCY, function (path) { return __awaiter(_this, void 0, void 0, function () {
                            var e_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, client.getDirectoryContents(path)];
                                    case 1: return [2 /*return*/, _a.sent()];
                                    case 2:
                                        e_2 = _a.sent();
                                        return [2 /*return*/, []];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })];
                case 5:
                    listings = _b.sent();
                    nextLevel = [];
                    for (_i = 0, listings_1 = listings; _i < listings_1.length; _i++) {
                        entries = listings_1[_i];
                        for (_a = 0, entries_1 = entries; _a < entries_1.length; _a++) {
                            entry = entries_1[_a];
                            if (entry.type === "directory") {
                                if (depth < MAX_DEPTH) {
                                    nextLevel.push(entry.filename);
                                }
                            }
                            else if (isAudio(entry)) {
                                result.push(entry);
                            }
                        }
                    }
                    level = nextLevel;
                    depth++;
                    return [3 /*break*/, 4];
                case 6: return [2 /*return*/, result];
            }
        });
    });
}
// 扫描某个目录并精简为 { id, basename }[]。
function scanFolderSlim(client, root) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = flattenFiles;
                    return [4 /*yield*/, scanFolder(client, root)];
                case 1: return [2 /*return*/, _a.apply(void 0, [[_b.sent()]])];
            }
        });
    });
}
// 扫描所有配置路径，得到原始文件列表（带缓存，整个会话复用）。
function loadFileList() {
    return __awaiter(this, void 0, void 0, function () {
        var client, groups, _i, _a, path, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    client = getClient();
                    if (!client) {
                        return [2 /*return*/, []];
                    }
                    if (cachedData.fileList) {
                        return [2 /*return*/, cachedData.fileList];
                    }
                    groups = [];
                    _i = 0, _a = getSearchPathList();
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    path = _a[_i];
                    _c = (_b = groups).push;
                    return [4 /*yield*/, scanFolder(client, path)];
                case 2:
                    _c.apply(_b, [_d.sent()]);
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    cachedData.fileList = flattenFiles(groups);
                    return [2 /*return*/, cachedData.fileList];
            }
        });
    });
}
// —— 歌词编码处理（UTF-8 / GBK 自动识别）——
// 沙箱无 iconv、Hermes 无 ICU（TextDecoder('gbk') 不可用），故自带一张运行时下载的
// GBK 码点表（gbk-index.json，与插件同仓库托管）；逐文件自动判别 UTF-8 / GBK。
var gbkIndex = null; // 缓存的 GBK 码点表（用户无关、常量，跨会话复用）
var gbkIndexPromise = null; // 进行中的下载，避免并发重复请求
// 下载并缓存 GBK 表（最多下一次）。失败时返回 null（回退 UTF-8）。
function loadGbkIndex() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (gbkIndex)
                return [2 /*return*/, gbkIndex];
            if (!gbkIndexPromise) {
                gbkIndexPromise = axios_1.default
                    .get(GBK_INDEX_URL, { timeout: 20000 })
                    .then(function (res) {
                    var data = res.data;
                    var arr = typeof data === "string" ? JSON.parse(data) : data;
                    if (Array.isArray(arr) && arr.length) {
                        gbkIndex = arr;
                        return arr;
                    }
                    return null;
                })
                    .catch(function () { return null; });
            }
            return [2 /*return*/, gbkIndexPromise];
        });
    });
}
// crypto-js WordArray -> 字节数组
function wordArrayToBytes(wa) {
    var words = wa.words;
    var sigBytes = wa.sigBytes;
    var out = new Uint8Array(sigBytes);
    for (var i = 0; i < sigBytes; i++) {
        out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return out;
}
// 把 axios 返回的多种形态（Buffer / ArrayBuffer / base64 字符串）统一成 Uint8Array
function toBytes(data) {
    if (data == null)
        return new Uint8Array(0);
    if (data instanceof Uint8Array)
        return data; // Node Buffer 也是 Uint8Array
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
        }
        catch (e) {
            var out = new Uint8Array(data.length);
            for (var i = 0; i < data.length; i++)
                out[i] = data.charCodeAt(i) & 0xff;
            return out;
        }
    }
    try {
        return Uint8Array.from(data);
    }
    catch (e) {
        return new Uint8Array(0);
    }
}
function codePointToStr(cp) {
    if (cp <= 0xffff)
        return String.fromCharCode(cp);
    cp -= 0x10000;
    return String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
}
// 字节序列是否为合法 UTF-8（纯 ASCII 也返回 true）
function isLikelyUtf8(bytes) {
    var n = bytes.length;
    var i = 0;
    while (i < n) {
        var b = bytes[i];
        if (b < 0x80) {
            i++;
            continue;
        }
        var need = void 0;
        if (b >= 0xc2 && b <= 0xdf)
            need = 1;
        else if (b >= 0xe0 && b <= 0xef)
            need = 2;
        else if (b >= 0xf0 && b <= 0xf4)
            need = 3;
        else
            return false;
        if (i + need >= n)
            return false;
        for (var k = 1; k <= need; k++) {
            var c = bytes[i + k];
            if (c < 0x80 || c > 0xbf)
                return false;
        }
        i += need + 1;
    }
    return true;
}
function decodeUtf8(bytes) {
    var out = "";
    var i = 0;
    var n = bytes.length;
    while (i < n) {
        var b = bytes[i];
        var cp = void 0;
        var len = void 0;
        if (b < 0x80) {
            cp = b;
            len = 1;
        }
        else if (b >= 0xc2 && b <= 0xdf) {
            cp = b & 0x1f;
            len = 2;
        }
        else if (b >= 0xe0 && b <= 0xef) {
            cp = b & 0x0f;
            len = 3;
        }
        else if (b >= 0xf0 && b <= 0xf4) {
            cp = b & 0x07;
            len = 4;
        }
        else {
            out += "�";
            i++;
            continue;
        }
        if (i + len > n) {
            out += "�";
            break;
        }
        for (var k = 1; k < len; k++)
            cp = (cp << 6) | (bytes[i + k] & 0x3f);
        out += codePointToStr(cp);
        i += len;
    }
    return out;
}
// 按 WHATWG gb18030 双字节指针公式解码（覆盖 GBK）
function decodeGbk(bytes, index) {
    var out = "";
    var i = 0;
    var n = bytes.length;
    while (i < n) {
        var b = bytes[i];
        if (b < 0x80) {
            out += String.fromCharCode(b);
            i++;
            continue;
        }
        if (b === 0x80) {
            out += "€";
            i++;
            continue;
        } // cp936: 0x80 = 欧元符号
        var b2 = bytes[i + 1];
        var valid2 = b2 !== undefined &&
            ((b2 >= 0x40 && b2 <= 0x7e) || (b2 >= 0x80 && b2 <= 0xfe));
        if (b >= 0x81 && b <= 0xfe && valid2) {
            var ptr = (b - 0x81) * 190 + (b2 - (b2 < 0x7f ? 0x40 : 0x41));
            var cp = ptr >= 0 && ptr < index.length ? index[ptr] : 0;
            out += cp ? codePointToStr(cp) : "�";
            i += 2;
        }
        else {
            out += "�";
            i++;
        }
    }
    return out;
}
// 字节 -> 文本：处理 BOM，自动识别 UTF-8 / GBK
function decodeLyricBytes(bytes) {
    return __awaiter(this, void 0, void 0, function () {
        var index;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
                        return [2 /*return*/, decodeUtf8(bytes.subarray(3))]; // UTF-8 BOM
                    }
                    // 先验 UTF-8，否则尝试 GBK（表不可用则回退 UTF-8）
                    if (isLikelyUtf8(bytes))
                        return [2 /*return*/, decodeUtf8(bytes)];
                    return [4 /*yield*/, loadGbkIndex()];
                case 1:
                    index = _a.sent();
                    return [2 /*return*/, index ? decodeGbk(bytes, index) : decodeUtf8(bytes)];
            }
        });
    });
}
// 读取并解码与音频同名的 .lrc 歌词。返回 { rawLrc } 或 null（无歌词）。
// 用 axios 按字节获取（带 Authorization 头）——与播放同样的成熟链路，axios 会自动
// 跟随 PikPak 的 302 跳转到 CDN；显式 timeout 覆盖全局 2s 默认。
function fetchBytes(lrcPath, auth) {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, axios_1.default.get(DAV_BASE + encodeURI(lrcPath), {
                        headers: { Authorization: auth },
                        timeout: 15000,
                        responseType: "arraybuffer",
                        transformResponse: function (data) { return data; },
                    })];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, toBytes(res.data)];
            }
        });
    });
}
function loadLyric(musicItem) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, username, password, cache, id, cached, dot, candidates, auth, _i, candidates_1, lrcPath, bytes, text, e_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!musicItem || !musicItem.id) {
                        return [2 /*return*/, null];
                    }
                    _a = getUserVariables(), username = _a.username, password = _a.password;
                    if (!(username && password)) {
                        return [2 /*return*/, null];
                    }
                    cache = cachedData.lyricCache || (cachedData.lyricCache = {});
                    id = musicItem.id;
                    if (Object.prototype.hasOwnProperty.call(cache, id)) {
                        cached = cache[id];
                        return [2 /*return*/, cached ? { rawLrc: cached } : null];
                    }
                    dot = id.lastIndexOf(".");
                    candidates = [];
                    if (dot > 0) {
                        candidates.push(id.slice(0, dot) + ".lrc");
                    }
                    candidates.push(id + ".lrc");
                    auth = authHeader(username, password);
                    _i = 0, candidates_1 = candidates;
                    _b.label = 1;
                case 1:
                    if (!(_i < candidates_1.length)) return [3 /*break*/, 8];
                    lrcPath = candidates_1[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, fetchBytes(lrcPath, auth)];
                case 3:
                    bytes = _b.sent();
                    if (!(bytes && bytes.length)) return [3 /*break*/, 5];
                    return [4 /*yield*/, decodeLyricBytes(bytes)];
                case 4:
                    text = _b.sent();
                    if (text) {
                        cache[id] = text;
                        return [2 /*return*/, { rawLrc: text }];
                    }
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_3 = _b.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8:
                    cache[id] = null; // 负缓存，避免重复请求
                    return [2 /*return*/, null];
            }
        });
    });
}
// 歌曲排序：先按歌手，再按标题（locale 比较，中文友好）。
function byArtistTitle(a, b) {
    var ar = (a.artist || "").localeCompare(b.artist || "");
    return ar !== 0 ? ar : (a.title || "").localeCompare(b.title || "");
}
// 实时构建某歌单的歌曲列表（不走 loadFileList 会话缓存，确保反映 PikPak 当前增删）。
function buildSheetMusicList(client, sheetId) {
    return __awaiter(this, void 0, void 0, function () {
        var roots, order, groups, _i, roots_1, root, _a, _b, list;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    roots = sheetId === ALL_SHEET_ID ? getSearchPathList() : [sheetId];
                    order = getNameOrder();
                    groups = [];
                    _i = 0, roots_1 = roots;
                    _c.label = 1;
                case 1:
                    if (!(_i < roots_1.length)) return [3 /*break*/, 4];
                    root = roots_1[_i];
                    _b = (_a = groups).push;
                    return [4 /*yield*/, scanFolder(client, root)];
                case 2:
                    _b.apply(_a, [_c.sent()]);
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    list = flattenFiles(groups).map(function (f) { return toMusicItem(f, order); });
                    list.sort(byArtistTitle);
                    return [2 /*return*/, list];
            }
        });
    });
}
function searchMusic(query) {
    return __awaiter(this, void 0, void 0, function () {
        var fileList, order, library, q, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadFileList()];
                case 1:
                    fileList = _a.sent();
                    order = getNameOrder();
                    library = fileList.map(function (f) { return toMusicItem(f, order); });
                    q = (query || "").toLowerCase();
                    data = q
                        ? library.filter(function (it) {
                            return it.title.toLowerCase().includes(q) ||
                                it.artist.toLowerCase().includes(q);
                        })
                        : library;
                    return [2 /*return*/, { isEnd: true, data: data }];
            }
        });
    });
}
var pluginInstance = {
    platform: "PikPak",
    author: "east",
    version: "0.0.5",
    // 自更新源：指向仓库里构建产物 pikpak-dav.js 的 raw 地址。
    // 配置后，插件列表里该插件会出现“更新”按钮，点一下即从此地址拉取最新代码。
    srcUrl: "https://raw.githubusercontent.com/cheedonghu/musicfree-plugin/main/pikpak-dav.js",
    description: "PikPak 网盘音乐源。请先在 PikPak App -> 设置 -> 实验功能 中开启 WebDAV，使用其生成的 WebDAV 专用账号/密码（需会员）。可在榜单里按顶层文件夹浏览，或用搜索检索整库；在“导入歌单”中输入某个目录路径可将其导入为本地歌单。歌词：把与歌曲同名的 .lrc 文件放在同一目录即可自动显示（自动识别 UTF-8/GBK 编码）。",
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
    ],
    search: function (query, page, type) {
        if (type === "music") {
            return searchMusic(query);
        }
        return undefined;
    },
    // 懒加载浏览：每个配置根目录用一次 Depth:1 列出顶层子文件夹作为入口，
    // 不触发全库扫描；点进去（getTopListDetail）才扫描该文件夹。
    getTopLists: function () {
        return __awaiter(this, void 0, void 0, function () {
            var client, groups, _i, _a, root, entries, e_4, folders, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        client = getClient();
                        if (!client) {
                            return [2 /*return*/, []];
                        }
                        groups = [];
                        _i = 0, _a = getSearchPathList();
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        root = _a[_i];
                        entries = void 0;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, client.getDirectoryContents(root)];
                    case 3:
                        entries = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        e_4 = _b.sent();
                        // 目录不存在/无法访问则跳过，不展示该入口（不处理）。
                        return [3 /*break*/, 6];
                    case 5:
                        folders = entries.filter(function (e) { return e.type === "directory"; });
                        data = __spreadArray([
                            {
                                id: root,
                                title: (root === "/" ? "根目录" : basenameOf(root)) + "（全部）",
                            }
                        ], folders.map(function (f) { return ({ id: f.filename, title: f.basename }); }), true);
                        groups.push({ title: root === "/" ? "PikPak" : root, data: data });
                        _b.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, groups];
                }
            });
        });
    },
    getTopListDetail: function (topListItem) {
        return __awaiter(this, void 0, void 0, function () {
            var client, files, order;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        client = getClient();
                        if (!client) {
                            return [2 /*return*/, __assign(__assign({}, topListItem), { musicList: [] })];
                        }
                        return [4 /*yield*/, scanFolderSlim(client, topListItem.id)];
                    case 1:
                        files = _a.sent();
                        order = getNameOrder();
                        return [2 /*return*/, __assign(__assign({}, topListItem), { musicList: files.map(function (f) { return toMusicItem(f, order); }) })];
                }
            });
        });
    },
    // 返回 WebDAV 地址 + Authorization 头，由播放器自动跟随 PikPak 的 302 跳转到 CDN。
    getMediaSource: function (musicItem) {
        var _a = getUserVariables(), username = _a.username, password = _a.password;
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
    getLyric: function (musicItem) {
        return loadLyric(musicItem);
    },
    // —— 可收藏的“实时歌单”（推荐歌单入口）——
    // 在“推荐歌单”里出现一个固定 tag，点开后是一个“全部歌曲”歌单；
    // 收藏(❤)它后，每次打开都会实时重查，自动反映 PikPak 的新增/删除。
    getRecommendSheetTags: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, { pinned: [{ id: "pikpak", title: "PikPak" }] }];
            });
        });
    },
    getRecommendSheetsByTag: function () {
        return __awaiter(this, void 0, void 0, function () {
            var client;
            return __generator(this, function (_a) {
                client = getClient();
                if (!client) {
                    return [2 /*return*/, { isEnd: true, data: [] }];
                }
                return [2 /*return*/, {
                        isEnd: true,
                        data: [
                            {
                                id: ALL_SHEET_ID,
                                platform: "PikPak",
                                title: "全部歌曲",
                            },
                        ],
                    }];
            });
        });
    },
    getMusicSheetInfo: function (sheetItem, page) {
        return __awaiter(this, void 0, void 0, function () {
            var sheetId, client, cache, list, start, pageData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sheetId = (sheetItem && sheetItem.id) || ALL_SHEET_ID;
                        client = getClient();
                        // 诊断日志（MusicFree 会收集插件 console），便于排查“收藏打开为空”。
                        console.log("[PikPak] getMusicSheetInfo", {
                            id: sheetId,
                            page: page,
                            hasClient: !!client,
                        });
                        if (!client) {
                            // 凭据未就绪：返回 null 让详情页进入可重试状态（用户下拉/重试即可恢复）。
                            return [2 /*return*/, null];
                        }
                        cache = cachedData.sheetCache || (cachedData.sheetCache = {});
                        if (!(!page || page <= 1)) return [3 /*break*/, 2];
                        return [4 /*yield*/, buildSheetMusicList(client, sheetId)];
                    case 1:
                        // 第 1 页：实时重新扫描，反映当前增删
                        list = _a.sent();
                        cache[sheetId] = list;
                        console.log("[PikPak] sheet built", { id: sheetId, count: list.length });
                        return [3 /*break*/, 3];
                    case 2:
                        list = cache[sheetId] || [];
                        _a.label = 3;
                    case 3:
                        start = ((page || 1) - 1) * SHEET_PAGE_SIZE;
                        pageData = list.slice(start, start + SHEET_PAGE_SIZE);
                        return [2 /*return*/, {
                                isEnd: start + SHEET_PAGE_SIZE >= list.length,
                                sheetItem: __assign(__assign({}, sheetItem), { id: sheetId, platform: "PikPak", worksNum: list.length }),
                                musicList: pageData,
                            }];
                }
            });
        });
    },
    // 把某个目录递归导入为本地歌单（静态快照；源文件增删不会自动同步，需重新导入）。
    // urlLike 为要导入的目录路径，留空则使用配置的根目录。
    importMusicSheet: function (urlLike) {
        return __awaiter(this, void 0, void 0, function () {
            var client, roots, groups, _i, roots_2, root, _a, _b, order;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        client = getClient();
                        if (!client) {
                            return [2 /*return*/, null];
                        }
                        roots = urlLike && urlLike.trim()
                            ? [urlLike.trim()]
                            : getSearchPathList();
                        groups = [];
                        _i = 0, roots_2 = roots;
                        _c.label = 1;
                    case 1:
                        if (!(_i < roots_2.length)) return [3 /*break*/, 4];
                        root = roots_2[_i];
                        _b = (_a = groups).push;
                        return [4 /*yield*/, scanFolder(client, root)];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        order = getNameOrder();
                        return [2 /*return*/, flattenFiles(groups).map(function (f) { return toMusicItem(f, order); })];
                }
            });
        });
    },
};
module.exports = pluginInstance;
//# sourceMappingURL=pikpak-dav.js.map