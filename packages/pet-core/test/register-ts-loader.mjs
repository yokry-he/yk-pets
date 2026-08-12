/**
 * 文件职责 / File responsibility
 * 仅在 Node 原生测试中注册 TypeScript 相对导入解析钩子，不参与产品构建。
 * Registers the TypeScript relative-import resolver for native Node tests only and is excluded from product builds.
 */
import { register } from 'node:module'
register('./ts-resolver-loader.mjs', import.meta.url)
