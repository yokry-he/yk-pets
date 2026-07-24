/**
 * 文件职责 / File responsibility
 * 监听 Studio 保存动作并把规范化配方同步到已安装扩展，不改变原有本地保存语义。
 * Observes Studio save actions and syncs normalized recipes to the installed extension without changing local-save semantics.
 */
import { syncAppearanceToBrowserExtension } from '~/domain/pet-extension-sync'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

export default defineNuxtPlugin(() => {
  const store = usePetAppearanceStore()
  store.$onAction(({ name, after }) => {
    if (name !== 'save') return
    after(() => {
      syncAppearanceToBrowserExtension(store.recipe)
        .then((outcome) => {
          window.dispatchEvent(new CustomEvent('yk-pets:extension-sync', { detail: outcome }))
        })
        .catch((error) => {
          window.dispatchEvent(new CustomEvent('yk-pets:extension-sync', {
            detail: { ok: false, detected: true, error: error instanceof Error ? error.message : String(error) },
          }))
        })
    })
  })
})
