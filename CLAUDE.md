# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A flat reference collection of **MusicFree plugins** — music-source adapters that the MusicFree app loads and executes at runtime. Each `.js` file is a self-contained CommonJS module for one platform (Bilibili, YouTube, 5sing, Navidrome, WebDAV, etc.).

There is **no build, lint, or test tooling** here: no `package.json`, no `tsconfig.json`, no bundler/eslint config, no test suite, no README. The committed `.js` files are *already-bundled output* (compiled from TypeScript authored elsewhere — note the `"use strict"; Object.defineProperty(exports, "__esModule", ...)` headers, TS down-leveling helpers like `__importDefault`, and Parcel-mangled names such as `$hash$var$foo` in some files). Treat each `.js` as the deliverable and edit it as plain CommonJS — do not expect a compile step.

## Layout

- `WebDAV.js` — a plugin at the repo root.
- `example/` — the plugin collection, named per platform with both Latin (`5sing.js`, `bilibili.js`, `Youtube.js`, `Navidrome.js`, `GD音乐台.js`) and Chinese (`哔哩哔哩.js`, `汽水qishui音乐.js`, `千千.js`, `书音FM.js`) filenames. Some pairs duplicate each other (e.g. `WebDAV.js` / `bilibili.js` ↔ `哔哩哔哩.js`). Several files (`元力*.js`, `开心汽水.js`) are empty stubs.

## The plugin contract

A plugin is `module.exports = { ...metadata, ...methods }`.

**Metadata**
- `platform` (required) — unique platform id.
- `version`, `author`, `description`.
- `srcUrl` — raw URL (usually Gitee) the app fetches for self-update.
- `cacheControl` — e.g. `"no-cache"`.
- `appVersion` — minimum MusicFree version, e.g. `">0.1.0-alpha.0"`.
- `primaryKey` — field(s) identifying a media item, e.g. `["id"]`.
- `userVariables` — array of `{ key, name, type? }`; use `type: "password"` for secrets. Surfaced as a config form to the user.
- `supportedSearchType` — subset of `["music", "album", "artist", "sheet"]`.
- `hints` — optional UI hint strings.

**Methods** (all may be `async`; return shapes below)
- `search(query, page, type)` → `{ isEnd: boolean, data: Item[] }`. Dispatch on `type`; return `undefined`/empty for unsupported types.
- `getMediaSource(musicItem, quality?)` → `{ url, headers? }` — the playable stream.
- `getLyric(musicItem)` → `{ rawLrc }` (and/or `translation`).
- `getMusicInfo(musicItem)`, `getAlbumInfo(albumItem)` / `getMusicSheetInfo` → `{ musicList }` or `{ isEnd, data }`.
- `getArtistWorks(artistItem, page, type)` → `{ isEnd, data }`.
- `getTopLists()` → `[{ title, data: TopListItem[] }]`; `getTopListDetail(topListItem)` → `{ ...topListItem, musicList }`.
- `importMusicSheet(urlLike)`, `getMusicComments(musicItem)`, `getRecommendSheetTags()`, `getRecommendSheetsByTag(tag, page)`.

**Media item shape** — `id` (required, unique within the platform), `title`, `artist`, `album`, `artwork`, optional `duration` (seconds), `date` (`YYYY-MM-DD`), and any platform-specific fields. Whatever you return from `search` is handed back verbatim to `getMediaSource`/`getLyric`/etc., so stash any ids you'll need later directly on the item.

## Conventions across these plugins

- **Pagination**: `page` is 1-based; signal the last page with `isEnd`, typically `isEnd: results.length < pageSize`.
- **User config / secrets**: read via the runtime global `env` — `const { url, username, password } = env?.getUserVariables?.() ?? {}` — and bail with `return null` when required variables are missing.
- **Request signing**: `crypto-js`, e.g. `CryptoJs.MD5(str).toString(CryptoJs.enc.Hex)` (see `example/Navidrome.js` for salted MD5; `example/bilibili.js` for WBI signing).
- **HTTP**: `axios`. Sites that gate requests often need spoofed `User-Agent`/`Referer` headers and a bootstrapped cookie (see `example/bilibili.js`).
- **HTML parsing**: `cheerio` (`require("cheerio")`) and `he` for entity decoding.
- **Dates**: `dayjs`.
- **Caching**: module-level caches (WebDAV directory listings, search continuation tokens) keyed on the current user variables, invalidated when those variables change — see `WebDAV.js`.
- Available runtime modules seen in use: `axios`, `crypto-js`, `cheerio`, `he`, `dayjs`, `webdav`.

## Running / testing a plugin

No test framework. Two ways to validate:
1. Load the `.js` into the MusicFree app (the real runtime; provides `env` and the module sandbox).
2. Use the **commented-out test block** at the bottom of most files — chained calls like `search(...).then(res => { getMediaSource(res.data[0], "standard").then(console.log) })`. Uncomment and run with Node, supplying any needed `env` shim, to exercise one method chain.

Templates to read by complexity: `WebDAV.js` (minimal) → `example/Navidrome.js` (auth + `userVariables`) → `example/5sing.js` (full method set) → `example/bilibili.js` (WBI signing, sheet import, comments).

## External references

- Plugin guide: https://musicfree.catcat.work/plugin/introduction.html
- Upstream example plugins: https://github.com/maotoumao/MusicFreePlugins
