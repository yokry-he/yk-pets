/**
 * 文件职责 / File responsibility
 * 接收 Studio 页面发送的配方信封，写入扩展本地存储并返回同步确认。
 * Receives recipe envelopes from Studio pages, persists them in extension storage, and acknowledges synchronization.
 */
import {
  createPetRecipeSyncResult,
  isPetRecipeSyncRequest,
  normalizePetRecipeEnvelope,
  YK_PET_RECIPE_STORAGE_KEY,
} from '@yk-pets/pet-core'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (!isPetRecipeSyncRequest(event.data)) return
      const recipe = normalizePetRecipeEnvelope(event.data.recipe)
      if (!recipe) {
        window.postMessage(createPetRecipeSyncResult(event.data.requestId, false, '配方格式无效。'), window.location.origin)
        return
      }
      chrome.storage.local.set({ [YK_PET_RECIPE_STORAGE_KEY]: recipe })
        .then(() => {
          window.postMessage(createPetRecipeSyncResult(event.data.requestId, true), window.location.origin)
          chrome.runtime.sendMessage({ type: 'YK_PET_RECIPE_UPDATED', recipe }).catch(() => undefined)
        })
        .catch((error) => {
          window.postMessage(
            createPetRecipeSyncResult(event.data.requestId, false, error instanceof Error ? error.message : String(error)),
            window.location.origin,
          )
        })
    }
    window.addEventListener('message', onMessage)
  },
})
