/**
 * 文件职责 / File responsibility
 * 定义网页 3D 宠物加载和闲时动作自动播放的本地运行偏好及安全归一化规则。
 * Defines local runtime preferences and safe normalization for in-page 3D loading and automatic idle motions.
 */

export const YK_PET_RUNTIME_PREFERENCES_STORAGE_KEY = 'yk-pets:runtime-preferences:v1'

export const YK_PET_IDLE_MOTION_IDS = [
  'wave',
  'jump',
  'flap',
  'stretch',
  'eat',
  'backflip',
  'tail-tornado',
  'diving-catch',
  'energy-burst',
  'shy-peek',
  'star-juggle',
  'cloud-nap',
  'sparkle-sneeze',
  'fireworks-show',
  'curious-scan',
  'antenna-charge',
  'tail-glow',
] as const

export type YkPetIdleMotionId = typeof YK_PET_IDLE_MOTION_IDS[number]

/** 高能和大型粒子动作默认不自动播放，用户仍可手动勾选。 / High-energy and large-particle motions stay out of auto-play by default but remain user-selectable. */
export const YK_PET_RECOMMENDED_IDLE_MOTION_IDS: readonly YkPetIdleMotionId[] = [
  'wave',
  'jump',
  'flap',
  'stretch',
  'eat',
  'shy-peek',
  'star-juggle',
  'cloud-nap',
  'curious-scan',
  'antenna-charge',
  'tail-glow',
]

export interface YkPetRuntimePreferences {
  load3dPet: boolean
  idleEnabled: boolean
  idleMotionIds: YkPetIdleMotionId[]
}

const validIdleMotionIds = new Set<string>(YK_PET_IDLE_MOTION_IDS)

export function createDefaultPetRuntimePreferences(): YkPetRuntimePreferences {
  return {
    load3dPet: true,
    idleEnabled: true,
    idleMotionIds: [...YK_PET_RECOMMENDED_IDLE_MOTION_IDS],
  }
}

export function normalizePetRuntimePreferences(input: unknown): YkPetRuntimePreferences {
  const fallback = createDefaultPetRuntimePreferences()
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback
  const candidate = input as Partial<Record<keyof YkPetRuntimePreferences, unknown>>
  const idleMotionIds = Array.isArray(candidate.idleMotionIds)
    ? [...new Set(candidate.idleMotionIds.filter((value): value is YkPetIdleMotionId => (
        typeof value === 'string' && validIdleMotionIds.has(value)
      )))]
    : fallback.idleMotionIds

  return {
    load3dPet: candidate.load3dPet !== false,
    idleEnabled: candidate.idleEnabled !== false,
    idleMotionIds,
  }
}
