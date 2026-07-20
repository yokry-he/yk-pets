/**
 * 文件职责 / File responsibility
 * 管理多物种外观、场景、撤销重做、预设方案，并以 Chrome 扩展经典方案作为默认 Studio 状态。
 * Manages multi-species appearance, scenes, undo/redo, presets, and uses the Chrome extension classic scheme as the default Studio state.
 */
import { defineStore } from 'pinia'
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  PET_STUDIO_STORAGE_KEY_V2,
  DEFAULT_APPEARANCE_LOCKS,
  applyAppearanceScope,
  applyPreset,
  auditPetStudioAppearance,
  deriveAppearanceColors,
  normalizePetStudioAppearanceV2,
  type AppearanceApplyScope,
  type AppearanceLocks,
  type PetStudioAppearanceRecipe,
} from '~/domain/pet-studio-phase4'
import {
  applyStyleAcrossSpecies,
  normalizeMultiSpeciesAppearance,
  randomizeMultiSpeciesAppearance,
  switchPetSpecies,
  type MultiSpeciesAppearanceRecipe,
  type PetSpeciesId,
} from '~/domain/pet-species-registry'
import { getPetScenePreset, normalizePetScene, type PetScenePresetId, type PetSceneRecipe } from '~/domain/pet-scene'
import { createExtensionClassicAppearance, createExtensionClassicScene } from '~/domain/extension-cloud-fox-default'
import type { PetStyleId } from '~/domain/pet-studio-phase4'

const SCHEMES_KEY = 'yk-pets:studio:user-schemes:v2'
const SCENE_KEY = 'yk-pets:studio:scene:v1'

interface UserScheme {
  id: string
  name: string
  createdAt: string
  recipe: MultiSpeciesAppearanceRecipe
}
interface State {
  recipe: MultiSpeciesAppearanceRecipe
  scene: PetSceneRecipe
  hydrated: boolean
  dirty: boolean
  savedAt: string
  undoStack: string[]
  redoStack: string[]
  locks: AppearanceLocks
  applyScope: AppearanceApplyScope
  customSchemes: UserScheme[]
}

const serialize = (recipe: MultiSpeciesAppearanceRecipe) => JSON.stringify(normalizeMultiSpeciesAppearance(recipe))
const asCloudFox = (recipe: MultiSpeciesAppearanceRecipe) => normalizePetStudioAppearanceV2({ ...recipe, speciesId: 'cloud-fox' })
const mergeCloudResult = (current: MultiSpeciesAppearanceRecipe, result: PetStudioAppearanceRecipe) => normalizeMultiSpeciesAppearance({
  ...current,
  ...result,
  speciesId: current.speciesId,
  speciesParts: current.speciesParts,
})

export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): State => ({
    recipe: createExtensionClassicAppearance(),
    scene: createExtensionClassicScene(),
    hydrated: false,
    dirty: false,
    savedAt: '',
    undoStack: [],
    redoStack: [],
    locks: { ...DEFAULT_APPEARANCE_LOCKS },
    applyScope: 'all',
    customSchemes: [],
  }),
  getters: {
    findings: state => auditPetStudioAppearance(asCloudFox(state.recipe)),
    canUndo: state => state.undoStack.length > 0,
    canRedo: state => state.redoStack.length > 0,
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = localStorage.getItem(PET_STUDIO_STORAGE_KEY_V2) || localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      try { this.recipe = stored ? normalizeMultiSpeciesAppearance(JSON.parse(stored)) : createExtensionClassicAppearance() }
      catch { this.recipe = createExtensionClassicAppearance() }
      try { this.scene = normalizePetScene(JSON.parse(localStorage.getItem(SCENE_KEY) || 'null')) }
      catch { this.scene = createExtensionClassicScene() }
      try {
        this.customSchemes = JSON.parse(localStorage.getItem(SCHEMES_KEY) || '[]')
          .map((item: UserScheme) => ({ ...item, recipe: normalizeMultiSpeciesAppearance(item.recipe) }))
      }
      catch { this.customSchemes = [] }
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
      this.recipe = normalizeMultiSpeciesAppearance(JSON.parse(previous))
      this.dirty = true
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next) return
      this.undoStack.push(serialize(this.recipe))
      this.recipe = normalizeMultiSpeciesAppearance(JSON.parse(next))
      this.dirty = true
    },
    save() {
      if (!import.meta.client) return
      this.recipe = normalizeMultiSpeciesAppearance(this.recipe)
      this.scene = normalizePetScene(this.scene)
      localStorage.setItem(PET_STUDIO_STORAGE_KEY_V2, JSON.stringify(this.recipe))
      localStorage.setItem(SCENE_KEY, JSON.stringify(this.scene))
      this.savedAt = new Date().toISOString()
      this.dirty = false
    },
    reset() {
      this.checkpoint()
      this.recipe = this.recipe.speciesId === 'cloud-fox'
        ? createExtensionClassicAppearance()
        : switchPetSpecies(createExtensionClassicAppearance(), this.recipe.speciesId)
      this.scene = createExtensionClassicScene()
      this.dirty = true
    },
    randomize() {
      this.checkpoint()
      this.recipe = randomizeMultiSpeciesAppearance(this.recipe, this.locks)
      this.dirty = true
    },
    replace(input: unknown) {
      this.checkpoint()
      this.recipe = normalizeMultiSpeciesAppearance(input)
      this.dirty = true
    },
    switchSpecies(id: PetSpeciesId) {
      this.checkpoint()
      this.recipe = switchPetSpecies(this.recipe, id)
      this.dirty = true
    },
    applyBuiltInPreset(id: string) {
      this.checkpoint()
      const result = applyPreset(asCloudFox(this.recipe), id, this.applyScope)
      this.recipe = mergeCloudResult(this.recipe, result)
      this.dirty = true
    },
    applyExtensionClassic() {
      this.checkpoint()
      this.recipe = createExtensionClassicAppearance()
      this.scene = createExtensionClassicScene()
      this.dirty = true
    },
    applyStyle(style: PetStyleId) {
      this.checkpoint()
      this.recipe = applyStyleAcrossSpecies(this.recipe, style, this.applyScope)
      this.dirty = true
    },
    applyScenePreset(id: PetScenePresetId) {
      this.scene = getPetScenePreset(id)
      this.dirty = true
    },
    updateScene(input: unknown) {
      this.scene = normalizePetScene(input)
      this.dirty = true
    },
    saveCustomScheme(name: string) {
      if (!import.meta.client || !name.trim()) return
      const scheme: UserScheme = {
        id: `scheme-${Date.now()}`,
        name: name.trim().slice(0, 32),
        createdAt: new Date().toISOString(),
        recipe: normalizeMultiSpeciesAppearance(this.recipe),
      }
      this.customSchemes.unshift(scheme)
      localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes))
    },
    applyCustomScheme(id: string) {
      const scheme = this.customSchemes.find(item => item.id === id)
      if (!scheme) return
      this.checkpoint()
      if (this.applyScope === 'all') this.recipe = normalizeMultiSpeciesAppearance(scheme.recipe)
      else {
        const result = applyAppearanceScope(asCloudFox(this.recipe), asCloudFox(scheme.recipe), this.applyScope)
        this.recipe = mergeCloudResult(this.recipe, result)
      }
      this.dirty = true
    },
    deleteCustomScheme(id: string) {
      if (!import.meta.client) return
      this.customSchemes = this.customSchemes.filter(item => item.id !== id)
      localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes))
    },
    exportJson() { return `${JSON.stringify(normalizeMultiSpeciesAppearance(this.recipe), null, 2)}\n` },
  },
})
