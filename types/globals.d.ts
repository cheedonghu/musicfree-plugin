// MusicFree 注入给插件的全局对象与未提供类型的依赖声明。

/** 插件运行时注入的全局 env（见 MusicFree plugin.ts 的 mountPlugin）。 */
declare const env: {
    getUserVariables(): Record<string, string>;
    readonly userVariables?: Record<string, string>;
    appVersion?: string;
    os?: string;
    lang?: string;
};

// 这些依赖没有随仓库 vendor 类型，按 any 处理（我们只对自己的领域类型做强检查）。
declare module "crypto-js";
declare module "axios";
declare module "webdav";
