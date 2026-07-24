/**
 * 文件职责 / File responsibility
 * 定义宠物全材质颜色、显式肚皮几何、扩展参数范围和兼容旧配方的统一归一化入口。
 * Defines pet-wide material colors, explicit belly geometry, expanded parameter ranges, and the compatibility normalizer for legacy recipes.
 */
import {
  normalizeMultiSpeciesAppearance,
  type MultiSpeciesAppearanceRecipe,
} from './pet-species-registry'

export const PET_BELLY_SHAPES = [
  { id: 'ellipse', label: '椭圆形', labelEn: 'Ellipse', description: '上下对称的圆润椭圆，作为默认形状。' },
  { id: 'egg', label: '蛋形', labelEn: 'Egg', description: '上窄下宽，重心更低。' },
  { id: 'shield', label: '盾牌形', labelEn: 'Shield', description: '上宽下尖，轮廓更利落。' },
  { id: 'teardrop', label: '水滴形', labelEn: 'Teardrop', description: '顶部尖、底部圆。' },
  { id: 'inverted-teardrop', label: '倒水滴形', labelEn: 'Inverted Teardrop', description: '顶部圆、底部尖。' },
  { id: 'bean', label: '不对称豆形', labelEn: 'Asymmetric Bean', description: '轻微侧弯的有机轮廓。' },
  { id: 'rounded-rectangle', label: '圆角矩形', labelEn: 'Rounded Rectangle', description: '稳定、现代的圆角块面。' },
  { id: 'heart', label: '爱心形', labelEn: 'Heart', description: '双圆瓣与下方尖角。' },
  { id: 'cloud', label: '云朵形', labelEn: 'Cloud', description: '由多段圆弧组成的云朵轮廓。' },
  { id: 'chest-fur', label: '胸毛形', labelEn: 'Chest Fur', description: '上宽、下方分叉的毛绒轮廓。' },
] as const

export type PetBellyShape = typeof PET_BELLY_SHAPES[number]['id']

export interface PetPartColorRecipe {
  body: string
  limbs: string
  paws: string
  muzzle: string
  nose: string
  mouth: string
  tongue: string
  cheeks: string
  eyes: string
  eyeHighlight: string
  earOuter: string
  earInner: string
  earTip: string
  antennaRod: string
  antennaTip: string
  belly: string
  tailGlow: string
  energyCore: string
}

export interface PetBellyCustomizationRecipe {
  visible: boolean
  shape: PetBellyShape
  width: number
  height: number
  offsetX: number
  offsetY: number
  rotation: number
  softness: number
}

export interface PetCustomizationRecipe {
  colors: PetPartColorRecipe
  belly: PetBellyCustomizationRecipe
}

declare module './pet-species-registry' {
  interface MultiSpeciesAppearanceRecipe {
    customization?: PetCustomizationRecipe
  }
}

export type CustomizableAppearanceRecipe = MultiSpeciesAppearanceRecipe & {
  customization: PetCustomizationRecipe
}

export const PET_CUSTOMIZATION_RANGES = Object.freeze({
  proportions: Object.freeze({
    bodyScale: [.55, 1.65] as const,
    bodyWidth: [.55, 1.7] as const,
    bodyHeight: [.55, 1.72] as const,
    bodyDepth: [.55, 1.65] as const,
    headScale: [.68, 1.48] as const,
    limbLength: [.42, 1.38] as const,
    limbThickness: [.52, 1.65] as const,
    limbSpacing: [.62, 1.48] as const,
    pawScale: [.58, 1.72] as const,
    earScale: [.52, 1.72] as const,
    eyeScale: [.52, 1.72] as const,
    eyeSpacing: [.62, 1.45] as const,
    tailLength: [.5, 1.9] as const,
    tailWidth: [.48, 1.7] as const,
    antennaScale: [.42, 1.82] as const,
  }),
  frontPaw: Object.freeze({
    rootHeight: [-.38, .38] as const,
    embedDepth: [.035, .34] as const,
    forwardOffset: [-.18, .28] as const,
    outwardAngle: [-.35, .72] as const,
    forwardAngle: [-.78, .78] as const,
    shoulderScale: [.62, 1.72] as const,
    wristScale: [.5, 1.62] as const,
    palmScale: [.52, 1.9] as const,
  }),
  antenna: Object.freeze({
    spacing: [.1, 1.05] as const,
    length: [.16, 1.6] as const,
    thickness: [.012, .16] as const,
    tilt: [-1.05, 1.05] as const,
  }),
  orbit: Object.freeze({
    radius: [.82, 2.35] as const,
    verticalScale: [.36, 1.55] as const,
    tilt: [-1.55, 1.55] as const,
    speed: [0, 2.4] as const,
    intensity: [0, 5] as const,
    particleCount: [0, 40] as const,
  }),
  belly: Object.freeze({
    width: [.42, 1.72] as const,
    height: [.42, 1.72] as const,
    offsetX: [-.36, .36] as const,
    offsetY: [-.36, .36] as const,
    rotation: [-Math.PI, Math.PI] as const,
    softness: [0, 1] as const,
  }),
  glowIntensity: [0, 5] as const,
  pulseSpeed: [0, 4] as const,
})

const HEX = /^#[0-9a-f]{6}$/i
const PROPORTION_KEYS = Object.keys(PET_CUSTOMIZATION_RANGES.proportions) as Array<keyof typeof PET_CUSTOMIZATION_RANGES.proportions>
const BELLY_SHAPE_IDS = new Set<string>(PET_BELLY_SHAPES.map(item => item.id))

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function finite(value: unknown, range: readonly [number, number], fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range[1], Math.max(range[0], value))
    : fallback
}

function hex(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback
}

function defaultColors(base: MultiSpeciesAppearanceRecipe): PetPartColorRecipe {
  return {
    body: base.palette.coatShadow,
    limbs: base.palette.coat,
    paws: base.palette.coatWarm,
    muzzle: '#f7f9ff',
    nose: '#18213b',
    mouth: '#332038',
    tongue: '#ff91b8',
    cheeks: '#ff9ac7',
    eyes: base.palette.eye,
    eyeHighlight: base.palette.secondaryGlow,
    earOuter: base.earDesign.outerColor,
    earInner: base.earDesign.innerColor,
    earTip: base.earDesign.tipColor,
    antennaRod: base.palette.coatWarm,
    antennaTip: base.palette.antennaGlow,
    belly: base.palette.coatWarm,
    tailGlow: base.tailDesign.tipGlow.color,
    energyCore: base.palette.secondaryGlow,
  }
}

function normalizeColors(value: unknown, base: MultiSpeciesAppearanceRecipe): PetPartColorRecipe {
  const source = asRecord(value)
  const fallback = defaultColors(base)
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => [key, hex(source[key], fallbackValue)]),
  ) as unknown as PetPartColorRecipe
}

function legacyBellyShape(value: unknown): PetBellyShape {
  const source = asRecord(value)
  if (source.mode !== 'custom') return 'ellipse'
  const mapping: Record<string, PetBellyShape> = {
    oval: 'ellipse',
    shield: 'shield',
    bean: 'bean',
    teardrop: 'teardrop',
    heart: 'heart',
  }
  return mapping[String(source.style)] || 'ellipse'
}

function normalizeBelly(customization: unknown, legacy: unknown): PetBellyCustomizationRecipe {
  const source = asRecord(customization)
  const legacySource = asRecord(legacy)
  const fallback: PetBellyCustomizationRecipe = {
    visible: legacySource.mode !== 'none',
    shape: legacyBellyShape(legacy),
    width: finite(legacySource.width, PET_CUSTOMIZATION_RANGES.belly.width, 1),
    height: finite(legacySource.height, PET_CUSTOMIZATION_RANGES.belly.height, 1),
    offsetX: 0,
    offsetY: finite(legacySource.offsetY, PET_CUSTOMIZATION_RANGES.belly.offsetY, 0),
    rotation: 0,
    softness: .72,
  }
  return {
    visible: source.visible === undefined ? fallback.visible : source.visible !== false,
    shape: BELLY_SHAPE_IDS.has(String(source.shape)) ? source.shape as PetBellyShape : fallback.shape,
    width: finite(source.width, PET_CUSTOMIZATION_RANGES.belly.width, fallback.width),
    height: finite(source.height, PET_CUSTOMIZATION_RANGES.belly.height, fallback.height),
    offsetX: finite(source.offsetX, PET_CUSTOMIZATION_RANGES.belly.offsetX, fallback.offsetX),
    offsetY: finite(source.offsetY, PET_CUSTOMIZATION_RANGES.belly.offsetY, fallback.offsetY),
    rotation: finite(source.rotation, PET_CUSTOMIZATION_RANGES.belly.rotation, fallback.rotation),
    softness: finite(source.softness, PET_CUSTOMIZATION_RANGES.belly.softness, fallback.softness),
  }
}

export function normalizeCustomizableAppearance(input: unknown): CustomizableAppearanceRecipe {
  const base = normalizeMultiSpeciesAppearance(input)
  const candidate = asRecord(input)
  const proportions = asRecord(candidate.proportions)
  const frontPaw = asRecord(candidate.frontPawDesign)
  const antenna = asRecord(candidate.antennaDesign)
  const orbit = asRecord(candidate.orbitDesign)
  const glow = asRecord(candidate.glow)
  const customization = asRecord(candidate.customization)
  const colors = normalizeColors(customization.colors, base)
  colors.antennaRod = colors.paws
  colors.energyCore = colors.eyeHighlight
  const belly = normalizeBelly(customization.belly, candidate.bellyPatchDesign)

  for (const key of PROPORTION_KEYS) {
    base.proportions[key] = finite(
      proportions[key],
      PET_CUSTOMIZATION_RANGES.proportions[key],
      base.proportions[key],
    )
  }

  base.frontPawDesign.rootHeight = finite(frontPaw.rootHeight, PET_CUSTOMIZATION_RANGES.frontPaw.rootHeight, base.frontPawDesign.rootHeight)
  base.frontPawDesign.embedDepth = finite(frontPaw.embedDepth, PET_CUSTOMIZATION_RANGES.frontPaw.embedDepth, base.frontPawDesign.embedDepth)
  base.frontPawDesign.forwardOffset = finite(frontPaw.forwardOffset, PET_CUSTOMIZATION_RANGES.frontPaw.forwardOffset, base.frontPawDesign.forwardOffset)
  base.frontPawDesign.outwardAngle = finite(frontPaw.outwardAngle, PET_CUSTOMIZATION_RANGES.frontPaw.outwardAngle, base.frontPawDesign.outwardAngle)
  base.frontPawDesign.forwardAngle = finite(frontPaw.forwardAngle, PET_CUSTOMIZATION_RANGES.frontPaw.forwardAngle, base.frontPawDesign.forwardAngle)
  base.frontPawDesign.shoulderScale = finite(frontPaw.shoulderScale, PET_CUSTOMIZATION_RANGES.frontPaw.shoulderScale, base.frontPawDesign.shoulderScale)
  base.frontPawDesign.wristScale = finite(frontPaw.wristScale, PET_CUSTOMIZATION_RANGES.frontPaw.wristScale, base.frontPawDesign.wristScale)
  base.frontPawDesign.palmScale = finite(frontPaw.palmScale, PET_CUSTOMIZATION_RANGES.frontPaw.palmScale, base.frontPawDesign.palmScale)

  base.antennaDesign.spacing = finite(antenna.spacing, PET_CUSTOMIZATION_RANGES.antenna.spacing, base.antennaDesign.spacing)
  base.antennaDesign.length = finite(antenna.length, PET_CUSTOMIZATION_RANGES.antenna.length, base.antennaDesign.length)
  base.antennaDesign.thickness = finite(antenna.thickness, PET_CUSTOMIZATION_RANGES.antenna.thickness, base.antennaDesign.thickness)
  base.antennaDesign.tilt = finite(antenna.tilt, PET_CUSTOMIZATION_RANGES.antenna.tilt, base.antennaDesign.tilt)
  base.orbitDesign.radius = finite(orbit.radius, PET_CUSTOMIZATION_RANGES.orbit.radius, base.orbitDesign.radius)
  base.orbitDesign.verticalScale = finite(orbit.verticalScale, PET_CUSTOMIZATION_RANGES.orbit.verticalScale, base.orbitDesign.verticalScale)
  base.orbitDesign.tilt = finite(orbit.tilt, PET_CUSTOMIZATION_RANGES.orbit.tilt, base.orbitDesign.tilt)
  base.orbitDesign.speed = finite(orbit.speed, PET_CUSTOMIZATION_RANGES.orbit.speed, base.orbitDesign.speed)
  base.orbitDesign.intensity = finite(orbit.intensity, PET_CUSTOMIZATION_RANGES.orbit.intensity, base.orbitDesign.intensity)
  base.orbitDesign.particleCount = Math.round(finite(orbit.particleCount, PET_CUSTOMIZATION_RANGES.orbit.particleCount, base.orbitDesign.particleCount))
  base.glow.intensity = finite(glow.intensity, PET_CUSTOMIZATION_RANGES.glowIntensity, base.glow.intensity)
  base.glow.pulseSpeed = finite(glow.pulseSpeed, PET_CUSTOMIZATION_RANGES.pulseSpeed, base.glow.pulseSpeed)

  base.palette.coatShadow = colors.body
  base.palette.coat = colors.limbs
  base.palette.coatWarm = colors.paws
  base.palette.eye = colors.eyes
  base.palette.antennaGlow = colors.antennaTip
  base.earDesign.outerColor = colors.earOuter
  base.earDesign.innerColor = colors.earInner
  base.earDesign.tipColor = colors.earTip
  base.tailDesign.tipGlow.color = colors.tailGlow
  base.bellyPatchDesign = {
    mode: belly.visible ? 'custom' : 'none',
    visible: belly.visible,
    style: belly.shape === 'shield' || belly.shape === 'bean' || belly.shape === 'teardrop' || belly.shape === 'heart'
      ? belly.shape
      : 'oval',
    width: belly.width,
    height: belly.height,
    offsetY: belly.offsetY,
  }

  return {
    ...base,
    customization: { colors, belly },
  }
}

export function resolvePetCustomization(appearance: MultiSpeciesAppearanceRecipe): PetCustomizationRecipe {
  return normalizeCustomizableAppearance(appearance).customization
}

export function createDefaultPetCustomization(appearance: MultiSpeciesAppearanceRecipe): PetCustomizationRecipe {
  const base = normalizeMultiSpeciesAppearance(appearance)
  return {
    colors: defaultColors(base),
    belly: normalizeBelly(undefined, undefined),
  }
}
