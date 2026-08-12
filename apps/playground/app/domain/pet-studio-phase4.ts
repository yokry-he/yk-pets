/** Phase 4: presets, style rules, scoped application, locked randomization and user schemes. */
import {
  createPetStudioAppearanceV2,
  normalizePetStudioAppearanceV2,
  randomizePetStudioAppearanceV2,
  type PetStudioAppearanceRecipe,
} from './pet-studio-phase3'

export * from './pet-studio-phase3'

export type AppearanceApplyScope = 'all' | 'shape' | 'proportions' | 'colors' | 'glow'
export type PetStyleId = 'cute' | 'mechanical' | 'nebula' | 'crystal'
export interface AppearanceLocks {
  shape: boolean
  proportions: boolean
  colors: boolean
  glow: boolean
  tail: boolean
  antenna: boolean
  symbols: boolean
}
export interface AppearancePreset {
  id: string
  label: string
  labelEn: string
  style: PetStyleId
  recipe: PetStudioAppearanceRecipe
}
export interface UserAppearanceScheme {
  id: string
  name: string
  createdAt: string
  recipe: PetStudioAppearanceRecipe
}

export const DEFAULT_APPEARANCE_LOCKS: AppearanceLocks = {
  shape: false,
  proportions: false,
  colors: false,
  glow: false,
  tail: false,
  antenna: false,
  symbols: false,
}

const makePreset = (
  id: string,
  label: string,
  labelEn: string,
  style: PetStyleId,
  mutate: (recipe: PetStudioAppearanceRecipe) => void,
): AppearancePreset => {
  const recipe = createPetStudioAppearanceV2()
  mutate(recipe)
  return { id, label, labelEn, style, recipe: normalizePetStudioAppearanceV2(recipe) }
}

export const PET_STUDIO_PRESETS: readonly AppearancePreset[] = [
  makePreset('cloud-spirit-classic', '云灵经典', 'Cloud Spirit Classic', 'cute', recipe => {
    recipe.parts.bodyShape = 'ellipsoid'; recipe.parts.ears = 'pointed'; recipe.parts.eyes = 'round'
    recipe.palette.coat = '#eef1ff'; recipe.palette.primaryGlow = '#7066ff'; recipe.palette.secondaryGlow = '#52e0d0'
  }),
  makePreset('mochi-cute', '糯米可爱', 'Mochi Cute', 'cute', recipe => {
    recipe.parts.bodyShape = 'pear'; recipe.parts.ears = 'floppy'; recipe.parts.eyes = 'sleepy'; recipe.parts.nose = 'button'; recipe.parts.mouth = 'pout'
    recipe.proportions.bodyWidth = 1.16; recipe.proportions.bodyHeight = .92; recipe.proportions.headScale = 1.15; recipe.proportions.limbLength = .82
    recipe.palette.coat = '#fff3f7'; recipe.palette.primaryGlow = '#ff78c8'; recipe.palette.secondaryGlow = '#ffd0e5'
  }),
  makePreset('neon-mecha', '霓虹机械', 'Neon Mecha', 'mechanical', recipe => {
    recipe.parts.bodyShape = 'rounded-cube'; recipe.parts.ears = 'mechanical'; recipe.parts.eyes = 'visor'; recipe.parts.nose = 'sensor'; recipe.parts.antennaRod = 'segmented'; recipe.parts.antennaTip = 'ring'; recipe.parts.tail = 'energy'
    recipe.palette.coat = '#33384f'; recipe.palette.coatShadow = '#141827'; recipe.palette.primaryGlow = '#00f6ff'; recipe.palette.secondaryGlow = '#ff3df2'; recipe.glow.intensity = 2.25
  }),
  makePreset('aurora-crystal', '极光水晶', 'Aurora Crystal', 'crystal', recipe => {
    recipe.parts.bodyShape = 'ellipsoid'; recipe.parts.ears = 'petal'; recipe.parts.eyes = 'diamond'; recipe.parts.antennaTip = 'crystal'
    recipe.palette.coat = '#dffcff'; recipe.palette.primaryGlow = '#67ffe1'; recipe.palette.secondaryGlow = '#9d7cff'; recipe.palette.halo = '#c7fff4'; recipe.glow.intensity = 2
  }),
  makePreset('forest-spirit', '森林精灵', 'Forest Spirit', 'cute', recipe => {
    recipe.parts.bodyShape = 'bean'; recipe.parts.ears = 'petal'; recipe.parts.eyes = 'oval'; recipe.parts.antennaTip = 'star'
    recipe.palette.coat = '#d8f0d0'; recipe.palette.coatShadow = '#6f9470'; recipe.palette.primaryGlow = '#7dff95'; recipe.palette.secondaryGlow = '#ffe48a'
  }),
  makePreset('midnight-nebula', '暗夜星云', 'Midnight Nebula', 'nebula', recipe => {
    recipe.parts.bodyShape = 'capsule'; recipe.parts.ears = 'wing'; recipe.parts.eyes = 'spark'; recipe.parts.antennaRod = 'arc'; recipe.parts.antennaTip = 'star'; recipe.parts.tail = 'energy'
    recipe.palette.coat = '#262340'; recipe.palette.coatShadow = '#0d0d1d'; recipe.palette.primaryGlow = '#8d6bff'; recipe.palette.secondaryGlow = '#ff67cf'; recipe.glow.mode = 'rainbow'; recipe.glow.intensity = 2.4
  }),
] as const

export const PET_STYLE_RULES: Readonly<Record<PetStyleId, (recipe: PetStudioAppearanceRecipe) => PetStudioAppearanceRecipe>> = {
  cute: recipe => normalizePetStudioAppearanceV2({ ...recipe, parts: { ...recipe.parts, bodyShape: 'pear', ears: 'floppy', eyes: 'sleepy', nose: 'button', mouth: 'pout' }, proportions: { ...recipe.proportions, bodyWidth: 1.14, bodyHeight: .94, headScale: 1.14, limbLength: .84, pawScale: 1.18 } }),
  mechanical: recipe => normalizePetStudioAppearanceV2({ ...recipe, parts: { ...recipe.parts, bodyShape: 'rounded-cube', ears: 'mechanical', eyes: 'visor', nose: 'sensor', antennaRod: 'segmented', antennaTip: 'ring', tail: 'energy' }, palette: { ...recipe.palette, coat: '#34394f', coatShadow: '#151827', primaryGlow: '#00eaff', secondaryGlow: '#ff42ed' }, glow: { ...recipe.glow, intensity: 2.2 } }),
  nebula: recipe => normalizePetStudioAppearanceV2({ ...recipe, parts: { ...recipe.parts, eyes: 'spark', antennaRod: 'arc', antennaTip: 'star', tail: 'energy' }, palette: { ...recipe.palette, coat: '#292442', coatShadow: '#0c0c1d', primaryGlow: '#8d6bff', secondaryGlow: '#ff67cf' }, glow: { ...recipe.glow, mode: 'rainbow', intensity: 2.35 } }),
  crystal: recipe => normalizePetStudioAppearanceV2({ ...recipe, parts: { ...recipe.parts, ears: 'petal', eyes: 'diamond', antennaTip: 'crystal' }, palette: { ...recipe.palette, coat: '#dffcff', coatShadow: '#8abbd1', primaryGlow: '#67ffe1', secondaryGlow: '#9d7cff', halo: '#c7fff4' }, glow: { ...recipe.glow, intensity: 2 } }),
}

export function applyAppearanceScope(current: PetStudioAppearanceRecipe, source: PetStudioAppearanceRecipe, scope: AppearanceApplyScope) {
  if (scope === 'all') return normalizePetStudioAppearanceV2(source)
  const next = normalizePetStudioAppearanceV2(current)
  if (scope === 'shape') next.parts = { ...next.parts, ...source.parts }
  if (scope === 'proportions') next.proportions = { ...source.proportions }
  if (scope === 'colors') next.palette = { ...source.palette }
  if (scope === 'glow') next.glow = { ...source.glow }
  return normalizePetStudioAppearanceV2(next)
}

export function applyPreset(current: PetStudioAppearanceRecipe, presetId: string, scope: AppearanceApplyScope) {
  const preset = PET_STUDIO_PRESETS.find(item => item.id === presetId)
  return preset ? applyAppearanceScope(current, preset.recipe, scope) : normalizePetStudioAppearanceV2(current)
}

export function applyStyleRule(current: PetStudioAppearanceRecipe, style: PetStyleId, scope: AppearanceApplyScope) {
  return applyAppearanceScope(current, PET_STYLE_RULES[style](current), scope)
}

export function randomizeWithLocks(current: PetStudioAppearanceRecipe, locks: AppearanceLocks, random: () => number = Math.random) {
  const next = randomizePetStudioAppearanceV2(current, random)
  if (locks.shape) next.parts = { ...current.parts }
  if (locks.proportions) next.proportions = { ...current.proportions }
  if (locks.colors) next.palette = { ...current.palette }
  if (locks.glow) next.glow = { ...current.glow }
  if (locks.tail) next.tailDesign = structuredClone(current.tailDesign)
  if (locks.antenna) { next.antennaDesign = { ...current.antennaDesign }; next.parts.antenna = current.parts.antenna; next.parts.antennaRod = current.parts.antennaRod; next.parts.antennaTip = current.parts.antennaTip }
  if (locks.symbols) next.symbols = structuredClone(current.symbols)
  return normalizePetStudioAppearanceV2(next)
}
