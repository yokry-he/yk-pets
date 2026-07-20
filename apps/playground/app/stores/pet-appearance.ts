
/**
 * 文件职责 / File responsibility
 * 管理云狐工坊外观配方的编辑、持久化、导入导出、随机生成和重置。
 * Manages Cloud Fox Studio appearance editing, persistence, import/export, randomization, and reset.
 */
import { defineStore } from 'pinia'
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  createDefaultCloudFoxAppearance,
  normalizeCloudFoxAppearance,
  randomizeCloudFoxAppearance,
  type CloudFoxAppearanceRecipe,
} from '~/domain/cloud-fox-appearance'

interface PetAppearanceState {
  recipe: CloudFoxAppearanceRecipe
  hydrated: boolean
  dirty: boolean
  savedAt: string
}

export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): PetAppearanceState => ({
    recipe: createDefaultCloudFoxAppearance(),
    hydrated: false,
    dirty: false,
    savedAt: '',
  }),

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = window.localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      if (stored) {
        try {
          this.recipe = normalizeCloudFoxAppearance(JSON.parse(stored))
        }
        catch {
          window.localStorage.removeItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
          this.recipe = createDefaultCloudFoxAppearance()
        }
      }
      this.hydrated = true
      this.dirty = false
    },

    markDirty() {
      this.dirty = true
    },

    save() {
      if (!import.meta.client) return
      this.recipe = normalizeCloudFoxAppearance(this.recipe)
      window.localStorage.setItem(CLOUD_FOX_STUDIO_STORAGE_KEY, JSON.stringify(this.recipe))
      this.savedAt = new Date().toISOString()
      this.dirty = false
    },

    reset() {
      this.recipe = createDefaultCloudFoxAppearance()
      this.dirty = true
    },

    randomize() {
      this.recipe = randomizeCloudFoxAppearance(this.recipe)
      this.dirty = true
    },

    replace(input: unknown) {
      this.recipe = normalizeCloudFoxAppearance(input)
      this.dirty = true
    },

    exportJson() {
      return `${JSON.stringify(normalizeCloudFoxAppearance(this.recipe), null, 2)}\n`
    },
  },
})
