/**
 * 文件职责 / File responsibility
 * 管理可配置宠物配方、自动草稿、事务式撤销重做、全部位颜色、场景、预设和扩展同步保存。
 * Manages customizable pet recipes, automatic drafts, transactional undo/redo, all-part colors, scenes, presets, and extension-sync saves.
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
import type { EarDesignRecipe, TailDesignRecipe, TailSegmentRecipe } from '~/domain/pet-studio-phase2'
import {
  applyStyleAcrossSpecies,
  auditFrontPawDesign,
  randomizeMultiSpeciesAppearance,
  switchPetSpecies,
  type FrontPawDesignRecipe,
  type PetSpeciesId,
} from '~/domain/pet-species-registry'
import {
  createDefaultPetCustomization,
  normalizeCustomizableAppearance,
  type CustomizableAppearanceRecipe,
  type PetPartColorRecipe,
} from '~/domain/pet-part-customization'
import { getPetScenePreset, normalizePetScene, type PetScenePresetId, type PetSceneRecipe } from '~/domain/pet-scene'
import { createExtensionClassicAppearance, createExtensionClassicScene } from '~/domain/extension-cloud-fox-default'
import { applyPetAppearanceLocalPatch } from '~/domain/pet-appearance-patch'
import type { PetStyleId } from '~/domain/pet-studio-phase4'

const SCHEMES_KEY = 'yk-pets:studio:user-schemes:v3'
const SCENE_KEY = 'yk-pets:studio:scene:v1'
const DRAFT_KEY = 'yk-pets:studio:appearance-draft:v3'
let draftTimer: ReturnType<typeof setTimeout> | undefined

interface UserScheme {
  id: string
  name: string
  createdAt: string
  recipe: CustomizableAppearanceRecipe
}
interface State {
  recipe: CustomizableAppearanceRecipe
  scene: PetSceneRecipe
  hydrated: boolean
  dirty: boolean
  savedAt: string
  draftSavedAt: string
  undoStack: string[]
  redoStack: string[]
  transactionOpen: boolean
  locks: AppearanceLocks
  applyScope: AppearanceApplyScope
  customSchemes: UserScheme[]
}

const classicAppearance = () => normalizeCustomizableAppearance(createExtensionClassicAppearance())
const serialize = (recipe: CustomizableAppearanceRecipe) => JSON.stringify(normalizeCustomizableAppearance(recipe))
const asCloudFox = (recipe: CustomizableAppearanceRecipe) => normalizePetStudioAppearanceV2({ ...recipe, speciesId: 'cloud-fox' })
const mergeCloudResult = (current: CustomizableAppearanceRecipe, result: PetStudioAppearanceRecipe) => normalizeCustomizableAppearance({
  ...current,
  ...result,
  speciesId: current.speciesId,
  speciesParts: current.speciesParts,
  frontPawDesign: current.frontPawDesign,
  orbitDesign: current.orbitDesign,
  bellyPatchDesign: current.bellyPatchDesign,
  chestDisplay: current.chestDisplay,
  customization: current.customization,
})

export const usePetAppearanceStore = defineStore('pet-appearance', {
  state: (): State => ({
    recipe: classicAppearance(),
    scene: createExtensionClassicScene(),
    hydrated: false,
    dirty: false,
    savedAt: '',
    draftSavedAt: '',
    undoStack: [],
    redoStack: [],
    transactionOpen: false,
    locks: { ...DEFAULT_APPEARANCE_LOCKS },
    applyScope: 'all',
    customSchemes: [],
  }),
  getters: {
    findings: (state) => {
      const appearanceFindings = auditPetStudioAppearance(asCloudFox(state.recipe))
      const frontPawFindings = auditFrontPawDesign(state.recipe.frontPawDesign)
      if (!frontPawFindings.length) return appearanceFindings
      return appearanceFindings.filter(item => item.id !== 'geometry-ok').concat(frontPawFindings)
    },
    canUndo: state => state.undoStack.length > 0,
    canRedo: state => state.redoStack.length > 0,
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      const stored = localStorage.getItem(DRAFT_KEY)
        || localStorage.getItem(PET_STUDIO_STORAGE_KEY_V2)
        || localStorage.getItem(CLOUD_FOX_STUDIO_STORAGE_KEY)
      try { this.recipe = stored ? normalizeCustomizableAppearance(JSON.parse(stored)) : classicAppearance() }
      catch { this.recipe = classicAppearance() }
      try { this.scene = normalizePetScene(JSON.parse(localStorage.getItem(SCENE_KEY) || 'null')) }
      catch { this.scene = createExtensionClassicScene() }
      try {
        const schemes = JSON.parse(localStorage.getItem(SCHEMES_KEY) || '[]') as UserScheme[]
        this.customSchemes = schemes.map(item => ({ ...item, recipe: normalizeCustomizableAppearance(item.recipe) }))
      }
      catch { this.customSchemes = [] }
      this.hydrated = true
      this.dirty = Boolean(localStorage.getItem(DRAFT_KEY) && localStorage.getItem(DRAFT_KEY) !== localStorage.getItem(PET_STUDIO_STORAGE_KEY_V2))
      this.undoStack = []
      this.redoStack = []
    },
    checkpoint() {
      if (this.transactionOpen) return
      const snapshot = serialize(this.recipe)
      if (this.undoStack.at(-1) !== snapshot) this.undoStack.push(snapshot)
      if (this.undoStack.length > 80) this.undoStack.shift()
      this.redoStack = []
    },
    beginTransaction() {
      if (this.transactionOpen) return
      this.checkpoint()
      this.transactionOpen = true
    },
    endTransaction() {
      this.transactionOpen = false
    },
    markDirty() {
      this.dirty = true
      if (!import.meta.client) return
      if (draftTimer) clearTimeout(draftTimer)
      draftTimer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, serialize(this.recipe))
        this.draftSavedAt = new Date().toISOString()
        draftTimer = undefined
      }, 180)
    },
    patchParts(patch: Partial<CustomizableAppearanceRecipe['parts']>) {
      this.recipe = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { parts: patch }))
      this.markDirty()
    },
    patchFrontPawDesign(patch: Partial<FrontPawDesignRecipe>) {
      this.recipe = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { frontPawDesign: patch }))
      this.markDirty()
    },
    patchEarDesign(patch: Partial<EarDesignRecipe>) {
      const next = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { earDesign: patch }))
      if (patch.outerColor) next.customization.colors.earOuter = patch.outerColor
      if (patch.innerColor) next.customization.colors.earInner = patch.innerColor
      if (patch.tipColor) next.customization.colors.earTip = patch.tipColor
      this.recipe = next
      this.markDirty()
    },
    patchTailDesign(patch: Partial<Omit<TailDesignRecipe, 'segments' | 'tipGlow'>> & {
      tipGlow?: Partial<TailDesignRecipe['tipGlow']>
    }) {
      this.recipe = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { tailDesign: patch }))
      this.markDirty()
    },
    patchTailSegment(index: number, patch: Partial<TailSegmentRecipe>) {
      const segments = this.recipe.tailDesign.segments.map((segment, segmentIndex) => (
        segmentIndex === index ? { ...segment, ...patch } : segment
      ))
      this.recipe = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { tailDesign: { segments } }))
      this.markDirty()
    },
    replaceTailSegments(segments: TailSegmentRecipe[]) {
      this.recipe = normalizeCustomizableAppearance(applyPetAppearanceLocalPatch(this.recipe, { tailDesign: { segments } }))
      this.markDirty()
    },
    patchPartColor(key: keyof PetPartColorRecipe, value: string, makeCheckpoint = true) {
      if (makeCheckpoint) this.checkpoint()
      this.recipe.customization.colors[key] = value
      if (key === 'paws' || key === 'antennaRod') {
        this.recipe.customization.colors.paws = value
        this.recipe.customization.colors.antennaRod = value
      }
      if (key === 'eyeHighlight' || key === 'energyCore') {
        this.recipe.customization.colors.eyeHighlight = value
        this.recipe.customization.colors.energyCore = value
      }
      if (key === 'body') this.recipe.palette.coatShadow = value
      if (key === 'limbs') this.recipe.palette.coat = value
      if (key === 'paws' || key === 'antennaRod') this.recipe.palette.coatWarm = value
      if (key === 'eyes') this.recipe.palette.eye = value
      if (key === 'eyeHighlight' || key === 'energyCore') this.recipe.palette.secondaryGlow = value
      if (key === 'earOuter') this.recipe.earDesign.outerColor = value
      if (key === 'earInner') this.recipe.earDesign.innerColor = value
      if (key === 'earTip') this.recipe.earDesign.tipColor = value
      if (key === 'antennaTip') this.recipe.palette.antennaGlow = value
      if (key === 'tailGlow') this.recipe.tailDesign.tipGlow.color = value
      this.markDirty()
    },
    refreshDerivedColors() {
      Object.assign(this.recipe.palette, deriveAppearanceColors(this.recipe.palette.coat, this.recipe.palette.primaryGlow))
      this.markDirty()
    },
    undo() {
      const previous = this.undoStack.pop()
      if (!previous) return
      this.redoStack.push(serialize(this.recipe))
      this.recipe = normalizeCustomizableAppearance(JSON.parse(previous))
      this.transactionOpen = false
      this.markDirty()
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next) return
      this.undoStack.push(serialize(this.recipe))
      this.recipe = normalizeCustomizableAppearance(JSON.parse(next))
      this.transactionOpen = false
      this.markDirty()
    },
    save() {
      if (!import.meta.client) return
      this.recipe = normalizeCustomizableAppearance(this.recipe)
      this.scene = normalizePetScene(this.scene)
      const serialized = serialize(this.recipe)
      localStorage.setItem(PET_STUDIO_STORAGE_KEY_V2, serialized)
      localStorage.setItem(DRAFT_KEY, serialized)
      localStorage.setItem(SCENE_KEY, JSON.stringify(this.scene))
      this.savedAt = new Date().toISOString()
      this.draftSavedAt = this.savedAt
      this.dirty = false
    },
    reset() {
      this.checkpoint()
      const base = this.recipe.speciesId === 'cloud-fox'
        ? classicAppearance()
        : normalizeCustomizableAppearance(switchPetSpecies(classicAppearance(), this.recipe.speciesId))
      this.recipe = base
      this.scene = createExtensionClassicScene()
      this.markDirty()
    },
    randomize() {
      this.checkpoint()
      const previousColors = structuredClone(this.recipe.customization)
      const randomized = randomizeMultiSpeciesAppearance(this.recipe, this.locks)
      this.recipe = normalizeCustomizableAppearance({
        ...randomized,
        customization: this.locks.colors ? previousColors : createDefaultPetCustomization(randomized),
      })
      this.markDirty()
    },
    replace(input: unknown) {
      this.checkpoint()
      this.recipe = normalizeCustomizableAppearance(input)
      this.markDirty()
    },
    switchSpecies(id: PetSpeciesId) {
      this.checkpoint()
      this.recipe = normalizeCustomizableAppearance(switchPetSpecies(this.recipe, id))
      this.markDirty()
    },
    applyBuiltInPreset(id: string) {
      this.checkpoint()
      const result = applyPreset(asCloudFox(this.recipe), id, this.applyScope)
      const merged = mergeCloudResult(this.recipe, result)
      this.recipe = (this.applyScope === 'all' || this.applyScope === 'colors')
        ? normalizeCustomizableAppearance({ ...merged, customization: createDefaultPetCustomization(merged) })
        : merged
      this.markDirty()
    },
    applyExtensionClassic() {
      this.checkpoint()
      this.recipe = classicAppearance()
      this.scene = createExtensionClassicScene()
      this.markDirty()
    },
    applyStyle(style: PetStyleId) {
      this.checkpoint()
      const previous = structuredClone(this.recipe.customization)
      const next = applyStyleAcrossSpecies(this.recipe, style, this.applyScope)
      this.recipe = normalizeCustomizableAppearance({
        ...next,
        customization: (this.applyScope === 'all' || this.applyScope === 'colors')
          ? createDefaultPetCustomization(next)
          : previous,
      })
      this.markDirty()
    },
    applyScenePreset(id: PetScenePresetId) {
      this.scene = getPetScenePreset(id)
      this.markDirty()
    },
    updateScene(input: unknown) {
      this.scene = normalizePetScene(input)
      this.markDirty()
    },
    saveCustomScheme(name: string) {
      if (!import.meta.client || !name.trim()) return
      const scheme: UserScheme = {
        id: `scheme-${Date.now()}`,
        name: name.trim().slice(0, 32),
        createdAt: new Date().toISOString(),
        recipe: normalizeCustomizableAppearance(this.recipe),
      }
      this.customSchemes.unshift(scheme)
      localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes))
    },
    applyCustomScheme(id: string) {
      const scheme = this.customSchemes.find(item => item.id === id)
      if (!scheme) return
      this.checkpoint()
      if (this.applyScope === 'all') this.recipe = normalizeCustomizableAppearance(scheme.recipe)
      else {
        const result = applyAppearanceScope(asCloudFox(this.recipe), asCloudFox(scheme.recipe), this.applyScope)
        this.recipe = mergeCloudResult(this.recipe, result)
      }
      this.markDirty()
    },
    deleteCustomScheme(id: string) {
      if (!import.meta.client) return
      this.customSchemes = this.customSchemes.filter(item => item.id !== id)
      localStorage.setItem(SCHEMES_KEY, JSON.stringify(this.customSchemes))
    },
    exportJson() { return `${JSON.stringify(normalizeCustomizableAppearance(this.recipe), null, 2)}\n` },
  },
})
