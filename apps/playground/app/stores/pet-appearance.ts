import { defineStore } from 'pinia'
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  PET_STUDIO_STORAGE_KEY_V2,
  auditPetStudioAppearance,
  createPetStudioAppearanceV2,
  deriveAppearanceColors,
  normalizePetStudioAppearanceV2,
  randomizePetStudioAppearanceV2,
  type PetStudioAppearanceRecipe,
} from '~/domain/pet-studio-phase3'

interface State {
  recipe: PetStudioAppearanceRecipe
  hydrated: boolean
  dirty: boolean
  savedAt: string
  undoStack: string[]
  redoStack: string[]
}

const serialize = (recipe: PetStudioAppearanceRecipe) => JSON.stringify(normalizePetStudioAppearanceV2(recipe))

export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): State => ({
    recipe: createPetStudioAppearanceV2(),
    hydrated: false,
    dirty: false,
    savedAt: '',
    undoStack: [],
    redoStack: [],
  }),
  getters: {
    findings: state => auditPetStudioAppearance(state.recipe),
    canUndo: state => state.undoStack.length > 0,
    canRedo: state => state.redoStack.length > 0,
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = localStorage.getItem(PET_STUDIO_STORAGE_KEY_V2) || localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      try { this.recipe = stored ? normalizePetStudioAppearanceV2(JSON.parse(stored)) : createPetStudioAppearanceV2() }
      catch {
        localStorage.removeItem(PET_STUDIO_STORAGE_KEY_V2)
        localStorage.removeItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
        this.recipe = createPetStudioAppearanceV2()
      }
      this.hydrated = true
      this.dirty = false
      this.undoStack = []
      this.redoStack = []
    },
    checkpoint() {
      const snapshot = serialize(this.recipe)
      if (this.undoStack.at(-1) !== snapshot) this.undoStack.push(snapshot)
      if (this.undoStack.length > 60) this.undoStack.shift()
      this.redoStack = []
    },
    markDirty() { this.dirty = true },
    refreshDerivedColors() {
      Object.assign(this.recipe.palette, deriveAppearanceColors(this.recipe.palette.coat, this.recipe.palette.primaryGlow))
      this.dirty = true
    },
    undo() {
      const previous = this.undoStack.pop()
      if (!previous) return
      this.redoStack.push(serialize(this.recipe))
      this.recipe = normalizePetStudioAppearanceV2(JSON.parse(previous))
      this.dirty = true
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next) return
      this.undoStack.push(serialize(this.recipe))
      this.recipe = normalizePetStudioAppearanceV2(JSON.parse(next))
      this.dirty = true
    },
    save() {
      if (!import.meta.client) return
      this.recipe = normalizePetStudioAppearanceV2(this.recipe)
      localStorage.setItem(PET_STUDIO_STORAGE_KEY_V2, JSON.stringify(this.recipe))
      this.savedAt = new Date().toISOString()
      this.dirty = false
    },
    reset() { this.checkpoint(); this.recipe = createPetStudioAppearanceV2(); this.dirty = true },
    randomize() { this.checkpoint(); this.recipe = randomizePetStudioAppearanceV2(this.recipe); this.dirty = true },
    replace(input: unknown) { this.checkpoint(); this.recipe = normalizePetStudioAppearanceV2(input); this.dirty = true },
    exportJson() { return `${JSON.stringify(normalizePetStudioAppearanceV2(this.recipe), null, 2)}\n` },
  },
})
