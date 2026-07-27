/*
 * 文件职责 / File responsibility
 * 按宠物 ID 持久化简单/复杂模型容器，并自动建立不会覆盖人工结果的复杂模型草稿。
 * Persists simple/complex model containers by pet ID and creates non-destructive complex-model drafts automatically.
 */
import { defineStore } from 'pinia'
import {
  createComplexModelDraft,
  createStudioPetModelVariants,
  normalizeStudioPetModelVariantCollection,
  normalizeStudioPetModelVariants,
  type StudioPetModelVariantsV1,
} from '../domain/studio-model-variants'
import { STUDIO_MODEL_VARIANTS_STORAGE_KEY } from '../domain/studio-workspace'

interface StudioModelVariantState {
  hydrated: boolean
  byPetId: Record<string, StudioPetModelVariantsV1>
}

export const useStudioModelVariantsStore = defineStore('studio-model-variants', {
  state: (): StudioModelVariantState => ({ hydrated: false, byPetId: {} }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      try {
        const stored = JSON.parse(localStorage.getItem(STUDIO_MODEL_VARIANTS_STORAGE_KEY) || '{}')
        this.byPetId = normalizeStudioPetModelVariantCollection(stored)
      }
      catch {
        this.byPetId = {}
      }
      this.hydrated = true
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STUDIO_MODEL_VARIANTS_STORAGE_KEY, JSON.stringify(this.byPetId))
    },
    ensurePet(petId: string, now = Date.now()) {
      const requestedPetId = petId.trim() || 'active-appearance'
      const existing = this.byPetId[requestedPetId]
      const normalized = existing
        ? normalizeStudioPetModelVariants(existing, requestedPetId, now)
        : createStudioPetModelVariants(requestedPetId, now)
      this.byPetId[requestedPetId] = normalized
      if (!existing) this.persist()
      return normalized
    },
    ensureComplexDraft(petId: string, now = Date.now()) {
      const current = this.ensurePet(petId, now)
      const next = createComplexModelDraft(current, now)
      if (next !== current) {
        this.byPetId[next.petId] = next
        this.persist()
      }
      return next
    },
  },
})
