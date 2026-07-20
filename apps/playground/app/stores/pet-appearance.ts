import { defineStore } from 'pinia'
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  PET_STUDIO_STORAGE_KEY_V2,
  DEFAULT_APPEARANCE_LOCKS,
  applyAppearanceScope,
  applyPreset,
  applyStyleRule,
  auditPetStudioAppearance,
  createPetStudioAppearanceV2,
  deriveAppearanceColors,
  normalizePetStudioAppearanceV2,
  randomizeWithLocks,
  type AppearanceApplyScope,
  type AppearanceLocks,
  type PetStyleId,
  type PetStudioAppearanceRecipe,
  type UserAppearanceScheme,
} from '~/domain/pet-studio-phase4'

const SCHEMES_KEY = 'yk-pets:studio:user-schemes:v1'
interface State { recipe: PetStudioAppearanceRecipe; hydrated: boolean; dirty: boolean; savedAt: string; undoStack: string[]; redoStack: string[]; locks: AppearanceLocks; applyScope: AppearanceApplyScope; customSchemes: UserAppearanceScheme[] }
const serialize = (recipe: PetStudioAppearanceRecipe) => JSON.stringify(normalizePetStudioAppearanceV2(recipe))

export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): State => ({ recipe: createPetStudioAppearanceV2(), hydrated: false, dirty: false, savedAt: '', undoStack: [], redoStack: [], locks: { ...DEFAULT_APPEARANCE_LOCKS }, applyScope: 'all', customSchemes: [] }),
  getters: { findings: state => auditPetStudioAppearance(state.recipe), canUndo: state => state.undoStack.length > 0, canRedo: state => state.redoStack.length > 0 },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = localStorage.getItem(PET_STUDIO_STORAGE_KEY_V2) || localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      try { this.recipe = stored ? normalizePetStudioAppearanceV2(JSON.parse(stored)) : createPetStudioAppearanceV2() } catch { this.recipe = createPetStudioAppearanceV2() }
      try { this.customSchemes = JSON.parse(localStorage.getItem(SCHEMES_KEY) || '[]').map((item: UserAppearanceScheme) => ({ ...item, recipe: normalizePetStudioAppearanceV2(item.recipe) })) } catch { this.customSchemes = [] }
      this.hydrated = true; this.dirty = false; this.undoStack = []; this.redoStack = []
    },
    checkpoint() { const snapshot = serialize(this.recipe); if (this.undoStack.at(-1) !== snapshot) this.undoStack.push(snapshot); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = [] },
    markDirty() { this.dirty = true },
    refreshDerivedColors() { Object.assign(this.recipe.palette, deriveAppearanceColors(this.recipe.palette.coat, this.recipe.palette.primaryGlow)); this.dirty = true },
    undo() { const previous = this.undoStack.pop(); if (!previous) return; this.redoStack.push(serialize(this.recipe)); this.recipe = normalizePetStudioAppearanceV2(JSON.parse(previous)); this.dirty = true },
    redo() { const next = this.redoStack.pop(); if (!next) return; this.undoStack.push(serialize(this.recipe)); this.recipe = normalizePetStudioAppearanceV2(JSON.parse(next)); this.dirty = true },
    save() { if (!import.meta.client) return; this.recipe = normalizePetStudioAppearanceV2(this.recipe); localStorage.setItem(PET_STUDIO_STORAGE_KEY_V2, JSON.stringify(this.recipe)); this.savedAt = new Date().toISOString(); this.dirty = false },
    reset() { this.checkpoint(); this.recipe = createPetStudioAppearanceV2(); this.dirty = true },
    randomize() { this.checkpoint(); this.recipe = randomizeWithLocks(this.recipe, this.locks); this.dirty = true },
    replace(input: unknown) { this.checkpoint(); this.recipe = normalizePetStudioAppearanceV2(input); this.dirty = true },
    applyBuiltInPreset(id: string) { this.checkpoint(); this.recipe = applyPreset(this.recipe, id, this.applyScope); this.dirty = true },
    applyStyle(style: PetStyleId) { this.checkpoint(); this.recipe = applyStyleRule(this.recipe, style, this.applyScope); this.dirty = true },
    saveCustomScheme(name: string) { if (!import.meta.client || !name.trim()) return; const scheme: UserAppearanceScheme = { id: `scheme-${Date.now()}`, name: name.trim().slice(0, 32), createdAt: new Date().toISOString(), recipe: normalizePetStudioAppearanceV2(this.recipe) }; this.customSchemes.unshift(scheme); localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes)) },
    applyCustomScheme(id: string) { const scheme = this.customSchemes.find(item => item.id === id); if (!scheme) return; this.checkpoint(); this.recipe = applyAppearanceScope(this.recipe, scheme.recipe, this.applyScope); this.dirty = true },
    deleteCustomScheme(id: string) { if (!import.meta.client) return; this.customSchemes = this.customSchemes.filter(item => item.id !== id); localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes)) },
    exportJson() { return `${JSON.stringify(normalizePetStudioAppearanceV2(this.recipe), null, 2)}\n` },
  },
})
