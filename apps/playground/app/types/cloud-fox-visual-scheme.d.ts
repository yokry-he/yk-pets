/**
 * 文件职责 / File responsibility
 * 为扩展经典云狐视觉配置提供由真实配置对象推断出的全局只读类型。
 * Provides a global readonly type inferred directly from the extension classic Cloud Fox visual scheme object.
 */
type CloudFoxVisualScheme = typeof import('../domain/chrome-extension-cloud-fox-profile').EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
