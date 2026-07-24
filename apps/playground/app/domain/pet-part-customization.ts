/*
 * 文件职责 / File responsibility
 * 定义全部位颜色、显式肚皮、完整嘴巴参数、扩展前爪定位和唯一范围归一化入口，并兼容所有旧配方。
 * Defines all-part colors, explicit belly geometry, complete mouth controls, extended front-paw placement, and the sole range normalizer while preserving legacy recipes.
 */
import {
  normalizeMultiSpeciesAppearance,
  type FrontPawDesignRecipe,
  type MultiSpeciesAppearanceRecipe,
} from './pet-species-registry'
import { STUDIO_CONTROL_REGISTRY, type StudioControlPath } from './studio-control-registry'

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
  body: string; limbs: string; paws: string; muzzle: string; nose: string; mouth: string; tongue: string; cheeks: string
  eyes: string; eyeHighlight: string; earOuter: string; earInner: string; earTip: string; antennaRod: string; antennaTip: string
  belly: string; tailGlow: string; energyCore: string
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

export interface PetMouthCustomizationRecipe {
  offsetX: number
  offsetY: number
  surfaceOffset: number
  width: number
  height: number
  rotation: number
  curve: number
  thickness: number
  defaultOpen: number
  maxOpen: number
  tongueVisible: boolean
  tongueScale: number
  tongueOffsetY: number
}

export interface ExtendedFrontPawDesignRecipe extends FrontPawDesignRecipe {
  mirror: boolean
  lateralOffset: number
  leftOffsetX: number
  leftOffsetY: number
  leftOffsetZ: number
  rightOffsetX: number
  rightOffsetY: number
  rightOffsetZ: number
}

export interface PetCustomizationRecipe {
  colors: PetPartColorRecipe
  belly: PetBellyCustomizationRecipe
  mouth: PetMouthCustomizationRecipe
}

declare module './pet-species-registry' {
  interface MultiSpeciesAppearanceRecipe {
    customization?: PetCustomizationRecipe
  }
}

export type CustomizableAppearanceRecipe = Omit<MultiSpeciesAppearanceRecipe, 'customization' | 'frontPawDesign'> & {
  customization: PetCustomizationRecipe
  frontPawDesign: ExtendedFrontPawDesignRecipe
}

const hard = (path: StudioControlPath) => STUDIO_CONTROL_REGISTRY[path].hardRange
export const PET_CUSTOMIZATION_RANGES = Object.freeze({
  proportions: Object.freeze({
    bodyScale: [.35, 2.2] as const,
    bodyWidth: hard('proportions.bodyWidth'), bodyHeight: hard('proportions.bodyHeight'), bodyDepth: hard('proportions.bodyDepth'),
    headScale: hard('proportions.headScale'), limbLength: hard('proportions.limbLength'), limbThickness: hard('proportions.limbThickness'),
    limbSpacing: hard('proportions.limbSpacing'), pawScale: hard('proportions.pawScale'), earScale: hard('proportions.earScale'),
    eyeScale: hard('proportions.eyeScale'), eyeSpacing: hard('proportions.eyeSpacing'), tailLength: hard('proportions.tailLength'),
    tailWidth: hard('proportions.tailWidth'), antennaScale: hard('proportions.antennaScale'),
  }),
  frontPaw: Object.freeze({
    rootHeight: hard('frontPawDesign.rootHeight'), embedDepth: hard('frontPawDesign.embedDepth'), forwardOffset: hard('frontPawDesign.forwardOffset'),
    lateralOffset: hard('frontPawDesign.lateralOffset'), outwardAngle: hard('frontPawDesign.outwardAngle'), forwardAngle: hard('frontPawDesign.forwardAngle'),
    shoulderScale: hard('frontPawDesign.shoulderScale'), wristScale: hard('frontPawDesign.wristScale'), palmScale: hard('frontPawDesign.palmScale'),
    leftOffsetX: hard('frontPawDesign.leftOffsetX'), leftOffsetY: hard('frontPawDesign.leftOffsetY'), leftOffsetZ: hard('frontPawDesign.leftOffsetZ'),
    rightOffsetX: hard('frontPawDesign.rightOffsetX'), rightOffsetY: hard('frontPawDesign.rightOffsetY'), rightOffsetZ: hard('frontPawDesign.rightOffsetZ'),
  }),
  antenna: Object.freeze({
    spacing: hard('antennaDesign.spacing'), length: hard('antennaDesign.length'), thickness: hard('antennaDesign.thickness'), tilt: hard('antennaDesign.tilt'),
  }),
  orbit: Object.freeze({
    radius: hard('orbitDesign.radius'), verticalScale: hard('orbitDesign.verticalScale'), tilt: hard('orbitDesign.tilt'), speed: hard('orbitDesign.speed'),
    intensity: hard('orbitDesign.intensity'), particleCount: hard('orbitDesign.particleCount'),
  }),
  belly: Object.freeze({
    width: hard('customization.belly.width'), height: hard('customization.belly.height'), offsetX: hard('customization.belly.offsetX'),
    offsetY: hard('customization.belly.offsetY'), rotation: hard('customization.belly.rotation'), softness: hard('customization.belly.softness'),
  }),
  mouth: Object.freeze({
    offsetX: hard('customization.mouth.offsetX'), offsetY: hard('customization.mouth.offsetY'), surfaceOffset: hard('customization.mouth.surfaceOffset'),
    width: hard('customization.mouth.width'), height: hard('customization.mouth.height'), rotation: hard('customization.mouth.rotation'),
    curve: hard('customization.mouth.curve'), thickness: hard('customization.mouth.thickness'), defaultOpen: hard('customization.mouth.defaultOpen'),
    maxOpen: hard('customization.mouth.maxOpen'), tongueScale: hard('customization.mouth.tongueScale'), tongueOffsetY: hard('customization.mouth.tongueOffsetY'),
  }),
  glowIntensity: hard('glow.intensity'), pulseSpeed: hard('glow.pulseSpeed'),
})

const HEX = /^#[0-9a-f]{6}$/i
const PROPORTION_KEYS = Object.keys(PET_CUSTOMIZATION_RANGES.proportions) as Array<keyof typeof PET_CUSTOMIZATION_RANGES.proportions>
const BELLY_SHAPE_IDS = new Set<string>(PET_BELLY_SHAPES.map(item => item.id))
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const finite = (value: unknown, range: readonly [number, number], fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(range[1], Math.max(range[0], value)) : fallback
const hex = (value: unknown, fallback: string) => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback

function defaultColors(base: MultiSpeciesAppearanceRecipe): PetPartColorRecipe {
  return {
    body: base.palette.coatShadow, limbs: base.palette.coat, paws: base.palette.coatWarm, muzzle: '#f7f9ff', nose: '#18213b', mouth: '#332038',
    tongue: '#ff91b8', cheeks: '#ff9ac7', eyes: base.palette.eye, eyeHighlight: base.palette.secondaryGlow, earOuter: base.earDesign.outerColor,
    earInner: base.earDesign.innerColor, earTip: base.earDesign.tipColor, antennaRod: base.palette.coatWarm, antennaTip: base.palette.antennaGlow,
    belly: base.palette.coatWarm, tailGlow: base.tailDesign.tipGlow.color, energyCore: base.palette.secondaryGlow,
  }
}
function normalizeColors(value: unknown, base: MultiSpeciesAppearanceRecipe): PetPartColorRecipe {
  const source = asRecord(value); const fallback = defaultColors(base)
  return Object.fromEntries(Object.entries(fallback).map(([key, fallbackValue]) => [key, hex(source[key], fallbackValue)])) as unknown as PetPartColorRecipe
}
function legacyBellyShape(value: unknown): PetBellyShape {
  const source = asRecord(value); if (source.mode !== 'custom') return 'ellipse'
  const mapping: Record<string, PetBellyShape> = { oval: 'ellipse', shield: 'shield', bean: 'bean', teardrop: 'teardrop', heart: 'heart' }
  return mapping[String(source.style)] || 'ellipse'
}
function normalizeBelly(customization: unknown, legacy: unknown): PetBellyCustomizationRecipe {
  const source = asRecord(customization); const legacySource = asRecord(legacy)
  const fallback: PetBellyCustomizationRecipe = {
    visible: legacySource.mode !== 'none', shape: legacyBellyShape(legacy), width: finite(legacySource.width, PET_CUSTOMIZATION_RANGES.belly.width, 1),
    height: finite(legacySource.height, PET_CUSTOMIZATION_RANGES.belly.height, 1), offsetX: 0,
    offsetY: finite(legacySource.offsetY, PET_CUSTOMIZATION_RANGES.belly.offsetY, 0), rotation: 0, softness: .72,
  }
  return {
    visible: source.visible === undefined ? fallback.visible : source.visible !== false,
    shape: BELLY_SHAPE_IDS.has(String(source.shape)) ? source.shape as PetBellyShape : fallback.shape,
    width: finite(source.width, PET_CUSTOMIZATION_RANGES.belly.width, fallback.width), height: finite(source.height, PET_CUSTOMIZATION_RANGES.belly.height, fallback.height),
    offsetX: finite(source.offsetX, PET_CUSTOMIZATION_RANGES.belly.offsetX, fallback.offsetX), offsetY: finite(source.offsetY, PET_CUSTOMIZATION_RANGES.belly.offsetY, fallback.offsetY),
    rotation: finite(source.rotation, PET_CUSTOMIZATION_RANGES.belly.rotation, fallback.rotation), softness: finite(source.softness, PET_CUSTOMIZATION_RANGES.belly.softness, fallback.softness),
  }
}
function normalizeMouth(value: unknown): PetMouthCustomizationRecipe {
  const source = asRecord(value)
  const fallback: PetMouthCustomizationRecipe = {
    offsetX: 0, offsetY: 0, surfaceOffset: .008, width: 1, height: 1, rotation: 0, curve: 1, thickness: 1,
    defaultOpen: .58, maxOpen: 1.12, tongueVisible: true, tongueScale: 1, tongueOffsetY: 0,
  }
  return {
    offsetX: finite(source.offsetX, PET_CUSTOMIZATION_RANGES.mouth.offsetX, fallback.offsetX),
    offsetY: finite(source.offsetY, PET_CUSTOMIZATION_RANGES.mouth.offsetY, fallback.offsetY),
    surfaceOffset: finite(source.surfaceOffset, PET_CUSTOMIZATION_RANGES.mouth.surfaceOffset, fallback.surfaceOffset),
    width: finite(source.width, PET_CUSTOMIZATION_RANGES.mouth.width, fallback.width),
    height: finite(source.height, PET_CUSTOMIZATION_RANGES.mouth.height, fallback.height),
    rotation: finite(source.rotation, PET_CUSTOMIZATION_RANGES.mouth.rotation, fallback.rotation),
    curve: finite(source.curve, PET_CUSTOMIZATION_RANGES.mouth.curve, fallback.curve),
    thickness: finite(source.thickness, PET_CUSTOMIZATION_RANGES.mouth.thickness, fallback.thickness),
    defaultOpen: finite(source.defaultOpen, PET_CUSTOMIZATION_RANGES.mouth.defaultOpen, fallback.defaultOpen),
    maxOpen: finite(source.maxOpen, PET_CUSTOMIZATION_RANGES.mouth.maxOpen, fallback.maxOpen),
    tongueVisible: source.tongueVisible !== false,
    tongueScale: finite(source.tongueScale, PET_CUSTOMIZATION_RANGES.mouth.tongueScale, fallback.tongueScale),
    tongueOffsetY: finite(source.tongueOffsetY, PET_CUSTOMIZATION_RANGES.mouth.tongueOffsetY, fallback.tongueOffsetY),
  }
}
function normalizeFrontPaw(value: unknown, base: FrontPawDesignRecipe): ExtendedFrontPawDesignRecipe {
  const source = asRecord(value); const range = PET_CUSTOMIZATION_RANGES.frontPaw
  return {
    style: base.style,
    rootHeight: finite(source.rootHeight, range.rootHeight, 0), embedDepth: finite(source.embedDepth, range.embedDepth, .06),
    forwardOffset: finite(source.forwardOffset, range.forwardOffset, .06), outwardAngle: finite(source.outwardAngle, range.outwardAngle, .06),
    forwardAngle: finite(source.forwardAngle, range.forwardAngle, 0), shoulderScale: finite(source.shoulderScale, range.shoulderScale, 1),
    wristScale: finite(source.wristScale, range.wristScale, 1), palmScale: finite(source.palmScale, range.palmScale, 1),
    mirror: source.mirror !== false, lateralOffset: finite(source.lateralOffset, range.lateralOffset, 0),
    leftOffsetX: finite(source.leftOffsetX, range.leftOffsetX, 0), leftOffsetY: finite(source.leftOffsetY, range.leftOffsetY, 0), leftOffsetZ: finite(source.leftOffsetZ, range.leftOffsetZ, 0),
    rightOffsetX: finite(source.rightOffsetX, range.rightOffsetX, 0), rightOffsetY: finite(source.rightOffsetY, range.rightOffsetY, 0), rightOffsetZ: finite(source.rightOffsetZ, range.rightOffsetZ, 0),
  }
}

export function normalizeCustomizableAppearance(input: unknown): CustomizableAppearanceRecipe {
  const base = normalizeMultiSpeciesAppearance(input)
  const candidate = asRecord(input); const proportions = asRecord(candidate.proportions); const frontPaw = asRecord(candidate.frontPawDesign)
  const antenna = asRecord(candidate.antennaDesign); const orbit = asRecord(candidate.orbitDesign); const glow = asRecord(candidate.glow); const customization = asRecord(candidate.customization)
  const colors = normalizeColors(customization.colors, base); colors.antennaRod = colors.paws; colors.energyCore = colors.eyeHighlight
  const belly = normalizeBelly(customization.belly, candidate.bellyPatchDesign); const mouth = normalizeMouth(customization.mouth)
  for (const key of PROPORTION_KEYS) base.proportions[key] = finite(proportions[key], PET_CUSTOMIZATION_RANGES.proportions[key], base.proportions[key])
  const normalizedFrontPaw = normalizeFrontPaw(frontPaw, base.frontPawDesign)
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
  Object.assign(base.palette, { coatShadow: colors.body, coat: colors.limbs, coatWarm: colors.paws, eye: colors.eyes, antennaGlow: colors.antennaTip })
  Object.assign(base.earDesign, { outerColor: colors.earOuter, innerColor: colors.earInner, tipColor: colors.earTip })
  base.tailDesign.tipGlow.color = colors.tailGlow
  base.bellyPatchDesign = { mode: belly.visible ? 'custom' : 'none', visible: belly.visible, style: ['shield','bean','teardrop','heart'].includes(belly.shape) ? belly.shape as 'shield'|'bean'|'teardrop'|'heart' : 'oval', width: belly.width, height: belly.height, offsetY: belly.offsetY }
  return { ...base, frontPawDesign: normalizedFrontPaw, customization: { colors, belly, mouth } }
}

export function resolvePetCustomization(appearance: MultiSpeciesAppearanceRecipe): PetCustomizationRecipe {
  return normalizeCustomizableAppearance(appearance).customization
}
export function createDefaultPetCustomization(appearance: MultiSpeciesAppearanceRecipe): PetCustomizationRecipe {
  const base = normalizeMultiSpeciesAppearance(appearance)
  return { colors: defaultColors(base), belly: normalizeBelly(undefined, undefined), mouth: normalizeMouth(undefined) }
}
