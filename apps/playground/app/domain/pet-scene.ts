/** Phase 5: scene recipes and presets, independent from pet appearance bounds. */
import type { CloudFoxStudioBehavior } from './pet-studio-phase4'

export type PetScenePresetId = 'aurora-cloud' | 'deep-nebula' | 'neon-hangar' | 'transparent'
export type PetSceneContrastMode = 'auto' | 'light' | 'dark'
export interface PetSceneRecipe {
  schemaVersion: 1
  presetId: PetScenePresetId
  transparent: boolean
  background: string
  backgroundSecondary: string
  halo: { enabled: boolean; color: string; intensity: number; scale: number }
  particles: { enabled: boolean; color: string; count: number; size: number; speed: number }
  groundShadow: { enabled: boolean; opacity: number; softness: number; scale: number }
  contrastMode: PetSceneContrastMode
  actionLinked: boolean
}
export interface PetScenePreset { id: PetScenePresetId; label: string; labelEn: string; recipe: PetSceneRecipe }

const recipe = (presetId: PetScenePresetId, values: Omit<PetSceneRecipe, 'schemaVersion' | 'presetId'>): PetSceneRecipe => ({ schemaVersion: 1, presetId, ...values })
export const PET_SCENE_PRESETS: readonly PetScenePreset[] = [
  { id: 'aurora-cloud', label: '极光云境', labelEn: 'Aurora Cloud Realm', recipe: recipe('aurora-cloud', { transparent: false, background: '#10213c', backgroundSecondary: '#4b3f86', halo: { enabled: true, color: '#78ffe8', intensity: 1.7, scale: 1.35 }, particles: { enabled: true, color: '#d7fff8', count: 42, size: .045, speed: .28 }, groundShadow: { enabled: true, opacity: .28, softness: .72, scale: 1.35 }, contrastMode: 'dark', actionLinked: true }) },
  { id: 'deep-nebula', label: '深空星云', labelEn: 'Deep Space Nebula', recipe: recipe('deep-nebula', { transparent: false, background: '#060716', backgroundSecondary: '#32145f', halo: { enabled: true, color: '#a26bff', intensity: 2.1, scale: 1.55 }, particles: { enabled: true, color: '#ff8edc', count: 66, size: .035, speed: .18 }, groundShadow: { enabled: true, opacity: .34, softness: .8, scale: 1.45 }, contrastMode: 'dark', actionLinked: true }) },
  { id: 'neon-hangar', label: '霓虹机库', labelEn: 'Neon Hangar', recipe: recipe('neon-hangar', { transparent: false, background: '#121622', backgroundSecondary: '#0b4051', halo: { enabled: true, color: '#00f0ff', intensity: 1.9, scale: 1.2 }, particles: { enabled: true, color: '#5affff', count: 24, size: .025, speed: .42 }, groundShadow: { enabled: true, opacity: .48, softness: .42, scale: 1.2 }, contrastMode: 'dark', actionLinked: true }) },
  { id: 'transparent', label: '完全透明', labelEn: 'Fully Transparent', recipe: recipe('transparent', { transparent: true, background: '#000000', backgroundSecondary: '#000000', halo: { enabled: false, color: '#ffffff', intensity: 0, scale: 1 }, particles: { enabled: false, color: '#ffffff', count: 0, size: .02, speed: 0 }, groundShadow: { enabled: false, opacity: 0, softness: 1, scale: 1 }, contrastMode: 'auto', actionLinked: false }) },
] as const

export function createDefaultPetScene(): PetSceneRecipe { return structuredClone(PET_SCENE_PRESETS[0].recipe) }
export function getPetScenePreset(id: PetScenePresetId): PetSceneRecipe { return structuredClone(PET_SCENE_PRESETS.find(item => item.id === id)?.recipe || PET_SCENE_PRESETS[0].recipe) }
export function normalizePetScene(input: unknown): PetSceneRecipe {
  const fallback = createDefaultPetScene()
  if (!input || typeof input !== 'object') return fallback
  const candidate = input as Partial<PetSceneRecipe>
  const presetIds: PetScenePresetId[] = ['aurora-cloud','deep-nebula','neon-hangar','transparent']
  const contrast: PetSceneContrastMode[] = ['auto','light','dark']
  const number = (value: unknown, min: number, max: number, fallbackValue: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallbackValue
  const hex = (value: unknown, fallbackValue: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallbackValue
  return {
    schemaVersion: 1,
    presetId: presetIds.includes(candidate.presetId as PetScenePresetId) ? candidate.presetId as PetScenePresetId : fallback.presetId,
    transparent: candidate.transparent === true,
    background: hex(candidate.background, fallback.background),
    backgroundSecondary: hex(candidate.backgroundSecondary, fallback.backgroundSecondary),
    halo: { enabled: candidate.halo?.enabled !== false, color: hex(candidate.halo?.color, fallback.halo.color), intensity: number(candidate.halo?.intensity, 0, 4, fallback.halo.intensity), scale: number(candidate.halo?.scale, .5, 2.4, fallback.halo.scale) },
    particles: { enabled: candidate.particles?.enabled !== false, color: hex(candidate.particles?.color, fallback.particles.color), count: Math.round(number(candidate.particles?.count, 0, 120, fallback.particles.count)), size: number(candidate.particles?.size, .01, .12, fallback.particles.size), speed: number(candidate.particles?.speed, 0, 1.6, fallback.particles.speed) },
    groundShadow: { enabled: candidate.groundShadow?.enabled !== false, opacity: number(candidate.groundShadow?.opacity, 0, .8, fallback.groundShadow.opacity), softness: number(candidate.groundShadow?.softness, .1, 1, fallback.groundShadow.softness), scale: number(candidate.groundShadow?.scale, .6, 2.2, fallback.groundShadow.scale) },
    contrastMode: contrast.includes(candidate.contrastMode as PetSceneContrastMode) ? candidate.contrastMode as PetSceneContrastMode : fallback.contrastMode,
    actionLinked: candidate.actionLinked !== false,
  }
}

export function resolveSceneContrast(scene: PetSceneRecipe, prefersDark: boolean) {
  if (scene.contrastMode === 'light') return 'light' as const
  if (scene.contrastMode === 'dark') return 'dark' as const
  return prefersDark ? 'dark' as const : 'light' as const
}

export function sceneActionMultiplier(scene: PetSceneRecipe, behavior: CloudFoxStudioBehavior) {
  if (!scene.actionLinked) return 1
  return { idle: 1, greeting: 1.25, jumping: 1.55, stretching: 1.18, spinning: 1.8, resting: .55 }[behavior]
}
