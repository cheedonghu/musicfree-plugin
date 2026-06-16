/**
 * build.js —— 把可读源码 pikpak-dav.src.js 编译成设备可用的 pikpak-dav.js。
 *
 * 为什么需要构建：手机端 MusicFree 用 Hermes 的 Function() 动态编译插件代码，
 * 而 Hermes 的 eval 不支持 async/await 语法（会报 "async functions are unsupported"）。
 * 这里用 babel-plugin-transform-async-to-promises 把 async/await 降级为纯 Promise 链
 * （不引入 generator / regenerator），其余 ES6 语法（箭头函数/const/模板串等）保持不变，
 * Hermes eval 可正常解析。
 *
 * 用法：npm install 后执行  npm run build  （或 node build.js）
 */
"use strict";
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const SRC = path.join(__dirname, "pikpak-dav.src.js");
const OUT = path.join(__dirname, "pikpak-dav.js");

const code = fs.readFileSync(SRC, "utf8");
const result = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    compact: false,
    comments: true,
    plugins: ["babel-plugin-transform-async-to-promises"],
});

const header =
    "// 此文件由 build.js 从 pikpak-dav.src.js 自动生成，请勿直接编辑。\n" +
    "// 修改请改 pikpak-dav.src.js 后重新执行 `npm run build`。\n";
fs.writeFileSync(OUT, header + result.code);
console.log("已生成", path.basename(OUT));
