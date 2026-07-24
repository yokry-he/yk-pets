/**
 * 文件职责 / File responsibility
 * 为扩展 TypeScript 检查声明共享 Studio 云狐组件的公共边界；实际 WXT 构建别名仍指向唯一 Studio SFC 源码。
 * Declares the public boundary of the shared Studio Cloud Fox component for extension typechecking; the real WXT build alias still points to the sole Studio SFC source.
 */
import type { DefineComponent } from 'vue'

declare const UnifiedCloudFoxComponent: DefineComponent<any, any, any>

export default UnifiedCloudFoxComponent
