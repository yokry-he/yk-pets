/**
 * 文件职责 / File responsibility
 * 将 Studio 当前配方通过页面消息桥同步给已安装的浏览器扩展，并等待明确确认。
 * Synchronizes the active Studio recipe to the installed browser extension through a page-message bridge with acknowledgement.
 */
import {
  createPetRecipeEnvelope,
  isPetRecipeSyncResult,
  YK_PET_STUDIO_SYNC_SOURCE,
  YK_PET_SYNC_REQUEST_TYPE,
  type PetRecipeSyncRequest,
} from '@yk-pets/pet-core'
import type { MultiSpeciesAppearanceRecipe } from './pet-species-registry'

export interface PetExtensionSyncOutcome {
  ok: boolean
  detected: boolean
  error?: string
}

export function createStudioRecipeEnvelope(appearance: MultiSpeciesAppearanceRecipe) {
  return createPetRecipeEnvelope({
    recipeId: `${appearance.speciesId}:${appearance.identity.petId || 'active'}`,
    speciesId: appearance.speciesId,
    rendererId: appearance.speciesId === 'cloud-fox' ? 'extension-cloud-fox' : 'studio-procedural',
    source: 'studio',
    appearance,
  })
}

export function syncAppearanceToBrowserExtension(
  appearance: MultiSpeciesAppearanceRecipe,
  timeoutMs = 1200,
): Promise<PetExtensionSyncOutcome> {
  if (!import.meta.client) return Promise.resolve({ ok: false, detected: false, error: '仅浏览器环境支持同步。' })
  const requestId = `yk-pet-sync:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const request: PetRecipeSyncRequest<MultiSpeciesAppearanceRecipe> = {
    source: YK_PET_STUDIO_SYNC_SOURCE,
    type: YK_PET_SYNC_REQUEST_TYPE,
    requestId,
    recipe: createStudioRecipeEnvelope(appearance),
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: PetExtensionSyncOutcome) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timer)
      resolve(outcome)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (!isPetRecipeSyncResult(event.data) || event.data.requestId !== requestId) return
      finish({ ok: event.data.ok, detected: true, error: event.data.error })
    }
    const timer = window.setTimeout(() => finish({ ok: false, detected: false }), timeoutMs)
    window.addEventListener('message', onMessage)
    window.postMessage(request, window.location.origin)
  })
}
