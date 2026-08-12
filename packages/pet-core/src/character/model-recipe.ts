/**
 * 文件职责 / File responsibility
 * 定义站内生成双足萌宠所需的参数化模型配方，并在进入几何生成器前将不可信输入收敛为稳定数据。
 */

import type { CharacterRigProfileId } from './rig-profile'

export type BipedPetBodyStyle = 'soft' | 'athletic' | 'round' | 'slender'

export interface BipedPetProportions {
  height: number
  headRatio: number
  shoulderWidth: number
  hipWidth: number
  torsoLength: number
  armLength: number
  legLength: number
  handSize: number
  footSize: number
}

export interface BipedPetAppendageRecipe {
  enabled: boolean
  segments: number
  length: number
}

export interface BipedPetAppendages {
  ears: BipedPetAppendageRecipe
  tail: BipedPetAppendageRecipe
  antennae: BipedPetAppendageRecipe
}

export interface BipedPetMaterialRecipe {
  baseColor: string
  secondaryColor: string
  roughness: number
  metalness: number
}

/**
 * 这是站内生成器的输入，不是可交换的三维文件格式；版本字段保证后续生成器能够安全演进。
 */
export interface CharacterModelRecipeV1 {
  schemaVersion: 1
  generatorVersion: 'biped-pet-generator/v1'
  rigProfileId: Extract<CharacterRigProfileId, 'biped-pet/v1'>
  bodyStyle: BipedPetBodyStyle
  proportions: BipedPetProportions
  appendages: BipedPetAppendages
  material: BipedPetMaterialRecipe
  updatedAt: number
}

type NumericLimit = readonly [minimum: number, maximum: number]

/**
 * 所有数值配方字段的唯一边界真相来源。生成器和编辑器以后应复用此表，避免不同入口产生不同模型。
 */
export const BIPED_PET_MODEL_RECIPE_LIMITS = {
  proportions: {
    height: [0.9, 1.8],
    headRatio: [0.2, 0.5],
    shoulderWidth: [0.42, 1.2],
    hipWidth: [0.38, 1.2],
    torsoLength: [0.38, 1.2],
    armLength: [0.42, 1.2],
    legLength: [0.5, 1.4],
    handSize: [0.1, 0.42],
    footSize: [0.14, 0.5],
  },
  appendages: {
    ears: { segments: [1, 4], length: [0.08, 0.5] },
    tail: { segments: [1, 8], length: [0.12, 1.4] },
    antennae: { segments: [1, 6], length: [0.08, 0.7] },
  },
  material: {
    roughness: [0, 1],
    metalness: [0, 1],
  },
} as const satisfies {
  proportions: Record<keyof BipedPetProportions, NumericLimit>
  appendages: Record<keyof BipedPetAppendages, { segments: NumericLimit, length: NumericLimit }>
  material: Record<'roughness' | 'metalness', NumericLimit>
}

const DEFAULT_PROPORTIONS: BipedPetProportions = {
  height: 1.35,
  headRatio: 0.34,
  shoulderWidth: 0.78,
  hipWidth: 0.66,
  torsoLength: 0.72,
  armLength: 0.82,
  legLength: 0.94,
  handSize: 0.22,
  footSize: 0.28,
}

const DEFAULT_APPENDAGES: BipedPetAppendages = {
  ears: { enabled: true, segments: 2, length: 0.28 },
  tail: { enabled: true, segments: 4, length: 0.62 },
  antennae: { enabled: false, segments: 2, length: 0.22 },
}

const DEFAULT_MATERIAL: BipedPetMaterialRecipe = {
  baseColor: '#F3F7FF',
  secondaryColor: '#7AE7DF',
  roughness: 0.48,
  metalness: 0,
}

const BODY_STYLE_PRESETS: Readonly<Record<BipedPetBodyStyle, BipedPetProportions>> = {
  soft: DEFAULT_PROPORTIONS,
  athletic: {
    height: 1.42,
    headRatio: 0.29,
    shoulderWidth: 0.92,
    hipWidth: 0.68,
    torsoLength: 0.8,
    armLength: 0.94,
    legLength: 1.08,
    handSize: 0.2,
    footSize: 0.3,
  },
  round: {
    height: 1.2,
    headRatio: 0.42,
    shoulderWidth: 0.88,
    hipWidth: 0.82,
    torsoLength: 0.88,
    armLength: 0.7,
    legLength: 0.72,
    handSize: 0.25,
    footSize: 0.32,
  },
  slender: {
    height: 1.55,
    headRatio: 0.25,
    shoulderWidth: 0.58,
    hipWidth: 0.5,
    torsoLength: 0.96,
    armLength: 1.04,
    legLength: 1.22,
    handSize: 0.18,
    footSize: 0.25,
  },
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isBodyStyle = (value: unknown): value is BipedPetBodyStyle => value === 'soft' || value === 'athletic' || value === 'round' || value === 'slender'
const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)

function clamp(value: unknown, fallback: number, [minimum, maximum]: NumericLimit, integer = false, fallbackOutOfBounds = false) {
  // 任何非有限数都不能进入几何参数：Infinity 看似可钳制，仍可能在中间计算放大为无效变换，统一回退。
  const candidate = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const bounded = Math.min(maximum, Math.max(minimum, candidate))
  const normalized = fallbackOutOfBounds && Number.isFinite(candidate) && candidate !== bounded ? fallback : bounded
  return integer ? Math.round(normalized) : normalized
}

function normalizeProportions(input: unknown, fallback: BipedPetProportions): BipedPetProportions {
  const source = isRecord(input) ? input : {}
  const limits = BIPED_PET_MODEL_RECIPE_LIMITS.proportions
  return {
    height: clamp(source.height, fallback.height, limits.height, false, true),
    headRatio: clamp(source.headRatio, fallback.headRatio, limits.headRatio, false, true),
    shoulderWidth: clamp(source.shoulderWidth, fallback.shoulderWidth, limits.shoulderWidth, false, true),
    hipWidth: clamp(source.hipWidth, fallback.hipWidth, limits.hipWidth, false, true),
    torsoLength: clamp(source.torsoLength, fallback.torsoLength, limits.torsoLength, false, true),
    armLength: clamp(source.armLength, fallback.armLength, limits.armLength, false, true),
    legLength: clamp(source.legLength, fallback.legLength, limits.legLength, false, true),
    handSize: clamp(source.handSize, fallback.handSize, limits.handSize, false, true),
    footSize: clamp(source.footSize, fallback.footSize, limits.footSize, false, true),
  }
}

function normalizeAppendage(input: unknown, fallback: BipedPetAppendageRecipe, limits: { segments: NumericLimit, length: NumericLimit }): BipedPetAppendageRecipe {
  const source = isRecord(input) ? input : {}
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled,
    segments: clamp(source.segments, fallback.segments, limits.segments, true),
    length: clamp(source.length, fallback.length, limits.length),
  }
}

function normalizeAppendages(input: unknown): BipedPetAppendages {
  const source = isRecord(input) ? input : {}
  const limits = BIPED_PET_MODEL_RECIPE_LIMITS.appendages
  return {
    ears: normalizeAppendage(source.ears, DEFAULT_APPENDAGES.ears, limits.ears),
    tail: normalizeAppendage(source.tail, DEFAULT_APPENDAGES.tail, limits.tail),
    antennae: normalizeAppendage(source.antennae, DEFAULT_APPENDAGES.antennae, limits.antennae),
  }
}

function normalizeMaterial(input: unknown): BipedPetMaterialRecipe {
  const source = isRecord(input) ? input : {}
  const limits = BIPED_PET_MODEL_RECIPE_LIMITS.material
  return {
    baseColor: isHexColor(source.baseColor) ? source.baseColor.toUpperCase() : DEFAULT_MATERIAL.baseColor,
    secondaryColor: isHexColor(source.secondaryColor) ? source.secondaryColor.toUpperCase() : DEFAULT_MATERIAL.secondaryColor,
    roughness: clamp(source.roughness, DEFAULT_MATERIAL.roughness, limits.roughness),
    metalness: clamp(source.metalness, DEFAULT_MATERIAL.metalness, limits.metalness),
  }
}

/** 生成不可共享引用的默认配方，避免编辑器直接修改默认常量。 */
export function createBipedPetModelRecipe(now = Date.now()): CharacterModelRecipeV1 {
  return {
    schemaVersion: 1,
    generatorVersion: 'biped-pet-generator/v1',
    rigProfileId: 'biped-pet/v1',
    bodyStyle: 'soft',
    proportions: { ...DEFAULT_PROPORTIONS },
    appendages: {
      ears: { ...DEFAULT_APPENDAGES.ears },
      tail: { ...DEFAULT_APPENDAGES.tail },
      antennae: { ...DEFAULT_APPENDAGES.antennae },
    },
    material: { ...DEFAULT_MATERIAL },
    updatedAt: Number.isFinite(now) && now >= 0 ? now : Date.now(),
  }
}

/**
 * 归一化所有外部或持久化配方。损坏时间统一使用调用方注入的当前时间，使迁移与测试可重复。
 */
export function normalizeBipedPetModelRecipe(input: unknown, now = Date.now()): CharacterModelRecipeV1 {
  const source = isRecord(input) ? input : {}
  const bodyStyle = isBodyStyle(source.bodyStyle) ? source.bodyStyle : 'soft'
  const fallback = BODY_STYLE_PRESETS[bodyStyle]
  const safeNow = Number.isFinite(now) && now >= 0 ? now : Date.now()

  return {
    schemaVersion: 1,
    generatorVersion: 'biped-pet-generator/v1',
    rigProfileId: 'biped-pet/v1',
    bodyStyle,
    proportions: normalizeProportions(source.proportions, fallback),
    appendages: normalizeAppendages(source.appendages),
    material: normalizeMaterial(source.material),
    updatedAt: typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt) && source.updatedAt >= 0
      ? source.updatedAt
      : safeNow,
  }
}

/**
 * 应用体型预设时刻意不触碰附属物、材质、身份或时间，以便用户可以先调细节再尝试不同体型。
 */
export function applyBipedPetBodyStyle(recipe: CharacterModelRecipeV1, bodyStyle: BipedPetBodyStyle): CharacterModelRecipeV1 {
  return {
    ...recipe,
    bodyStyle,
    proportions: { ...BODY_STYLE_PRESETS[bodyStyle] },
    // 工坊会直接编辑嵌套字段，必须隔离所有可编辑子对象，不能只隔离本次改变的 proportions。
    appendages: {
      ears: { ...recipe.appendages.ears },
      tail: { ...recipe.appendages.tail },
      antennae: { ...recipe.appendages.antennae },
    },
    material: { ...recipe.material },
  }
}
