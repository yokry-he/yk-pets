import { defineStore } from 'pinia'
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  createPetStudioAppearance,
  normalizePetStudioAppearance,
  randomizePetStudioAppearance,
  type PetStudioAppearanceRecipe,
} from '~/domain/pet-studio-phase2'

interface State { recipe: PetStudioAppearanceRecipe; hydrated: boolean; dirty: boolean; savedAt: string }
export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): State => ({ recipe: createPetStudioAppearance(), hydrated: false, dirty: false, savedAt: '' }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      try { this.recipe = stored ? normalizePetStudioAppearance(JSON.parse(stored)) : createPetStudioAppearance() }
      catch { localStorage.removeItem(CLOUD_FOX_STUDIO_STORAGE_KEY); this.recipe = createPetStudioAppearance() }
      this.hydrated = true; this.dirty = false
    },
    markDirty() { this.dirty = true },
    save() { if (!import.meta.client) return; this.recipe = normalizePetStudioAppearance(this.recipe); localStorage.setItem(CLOUD_FOX_STUDIO_STORAGE_KEY, JSON.stringify(this.recipe)); this.savedAt = new Date().toISOString(); this.dirty = false },
    reset() { this.recipe = createPetStudioAppearance(); this.dirty = true },
    randomize() { this.recipe = randomizePetStudioAppearance(this.recipe); this.dirty = true },
    replace(input: unknown) { this.recipe = normalizePetStudioAppearance(input); this.dirty = true },
    exportJson() { return `${JSON.stringify(normalizePetStudioAppearance(this.recipe), null, 2)}\n` },
  },
})
