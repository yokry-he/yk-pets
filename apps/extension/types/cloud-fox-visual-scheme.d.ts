/**
 * 文件职责 / File responsibility
 * 将 Studio 视觉配置推断类型带入扩展 TypeScript 上下文，避免共享领域源码依赖 Nuxt 自动包含的全局声明。
 * Brings the Studio visual-scheme inferred type into the extension TypeScript context so shared domain source does not depend on Nuxt's automatically included global declaration.
 */
export {}

declare global {
  type CloudFoxVisualScheme = typeof import('../../playground/app/domain/chrome-extension-cloud-fox-profile').EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
}
