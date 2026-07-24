/*
 * 文件职责 / File responsibility
 * 对完整可配置外观执行深层局部补丁；先归一化输入，并同步旧配方通道与新定制通道，保证颜色、肚皮、嘴巴和扩展前爪不会在归一化时丢失。
 * Applies deep local patches after normalization and synchronizes legacy recipe channels with new customization channels so colors, belly, mouth, and extended paws survive normalization.
 */
import type { EarDesignRecipe, TailDesignRecipe, TailSegmentRecipe } from './pet-studio-phase2'
import type { BellyPatchDesignRecipe, ChestDisplayDesignRecipe, MultiSpeciesAppearanceRecipe } from './pet-species-registry'
import {
  normalizeCustomizableAppearance,
  type CustomizableAppearanceRecipe,
  type ExtendedFrontPawDesignRecipe,
  type PetBellyCustomizationRecipe,
  type PetBellyShape,
  type PetMouthCustomizationRecipe,
  type PetPartColorRecipe,
} from './pet-part-customization'

export interface PetAppearanceLocalPatch {
  parts?: Partial<CustomizableAppearanceRecipe['parts']>
  proportions?: Partial<CustomizableAppearanceRecipe['proportions']>
  palette?: Partial<CustomizableAppearanceRecipe['palette']>
  glow?: Partial<CustomizableAppearanceRecipe['glow']>
  antennaDesign?: Partial<CustomizableAppearanceRecipe['antennaDesign']>
  bellyPatchDesign?: Partial<BellyPatchDesignRecipe>
  chestDisplay?: Partial<ChestDisplayDesignRecipe>
  frontPawDesign?: Partial<ExtendedFrontPawDesignRecipe>
  earDesign?: Partial<EarDesignRecipe>
  tailDesign?: Partial<Omit<TailDesignRecipe, 'segments' | 'tipGlow'>> & {
    segments?: TailSegmentRecipe[]
    tipGlow?: Partial<TailDesignRecipe['tipGlow']>
  }
  customization?: {
    colors?: Partial<PetPartColorRecipe>
    belly?: Partial<PetBellyCustomizationRecipe>
    mouth?: Partial<PetMouthCustomizationRecipe>
  }
  symbols?: {
    chest?: Partial<CustomizableAppearanceRecipe['symbols']['chest']>
    back?: Partial<CustomizableAppearanceRecipe['symbols']['back']>
  }
}

const legacyBellyShape = (style: BellyPatchDesignRecipe['style'] | undefined): PetBellyShape | undefined => {
  if (!style) return undefined
  if (style === 'oval') return 'ellipse'
  return style
}

export function applyPetAppearanceLocalPatch(
  current: MultiSpeciesAppearanceRecipe | CustomizableAppearanceRecipe,
  patch: PetAppearanceLocalPatch,
): CustomizableAppearanceRecipe {
  const normalizedCurrent = normalizeCustomizableAppearance(current)
  const bellyPatch = patch.bellyPatchDesign
  const changesCustomGeometry = Boolean(bellyPatch) && [bellyPatch?.style, bellyPatch?.width, bellyPatch?.height, bellyPatch?.offsetY].some(value => value !== undefined)
  const bellyPatchDesign = bellyPatch
    ? {
        ...normalizedCurrent.bellyPatchDesign,
        ...bellyPatch,
        ...(!bellyPatch.mode && bellyPatch.visible === false ? { mode: 'none' as const } : {}),
        ...(!bellyPatch.mode && changesCustomGeometry ? { mode: 'custom' as const, visible: true } : {}),
      }
    : normalizedCurrent.bellyPatchDesign

  const colors: PetPartColorRecipe = { ...normalizedCurrent.customization.colors }
  if (patch.palette?.coatShadow) colors.body = patch.palette.coatShadow
  if (patch.palette?.coat) colors.limbs = patch.palette.coat
  if (patch.palette?.coatWarm) { colors.paws = patch.palette.coatWarm; colors.antennaRod = patch.palette.coatWarm }
  if (patch.palette?.eye) colors.eyes = patch.palette.eye
  if (patch.palette?.secondaryGlow) { colors.eyeHighlight = patch.palette.secondaryGlow; colors.energyCore = patch.palette.secondaryGlow }
  if (patch.palette?.antennaGlow) colors.antennaTip = patch.palette.antennaGlow
  if (patch.earDesign?.outerColor) colors.earOuter = patch.earDesign.outerColor
  if (patch.earDesign?.innerColor) colors.earInner = patch.earDesign.innerColor
  if (patch.earDesign?.tipColor) colors.earTip = patch.earDesign.tipColor
  if (patch.tailDesign?.tipGlow?.color) colors.tailGlow = patch.tailDesign.tipGlow.color
  Object.assign(colors, patch.customization?.colors)

  const belly: PetBellyCustomizationRecipe = { ...normalizedCurrent.customization.belly }
  if (bellyPatch) {
    if (bellyPatch.visible !== undefined) belly.visible = bellyPatch.visible
    if (bellyPatch.mode === 'none') belly.visible = false
    if (bellyPatch.mode === 'custom') belly.visible = true
    const shape = legacyBellyShape(bellyPatch.style)
    if (shape) belly.shape = shape
    if (bellyPatch.width !== undefined) belly.width = bellyPatch.width
    if (bellyPatch.height !== undefined) belly.height = bellyPatch.height
    if (bellyPatch.offsetY !== undefined) belly.offsetY = bellyPatch.offsetY
  }
  Object.assign(belly, patch.customization?.belly)

  return normalizeCustomizableAppearance({
    ...normalizedCurrent,
    parts: { ...normalizedCurrent.parts, ...patch.parts },
    proportions: { ...normalizedCurrent.proportions, ...patch.proportions },
    palette: { ...normalizedCurrent.palette, ...patch.palette },
    glow: { ...normalizedCurrent.glow, ...patch.glow },
    antennaDesign: { ...normalizedCurrent.antennaDesign, ...patch.antennaDesign },
    bellyPatchDesign,
    chestDisplay: { ...normalizedCurrent.chestDisplay, ...patch.chestDisplay },
    frontPawDesign: { ...normalizedCurrent.frontPawDesign, ...patch.frontPawDesign },
    earDesign: { ...normalizedCurrent.earDesign, ...patch.earDesign },
    tailDesign: {
      ...normalizedCurrent.tailDesign,
      ...patch.tailDesign,
      tipGlow: { ...normalizedCurrent.tailDesign.tipGlow, ...patch.tailDesign?.tipGlow },
      segments: patch.tailDesign?.segments ?? normalizedCurrent.tailDesign.segments,
    },
    customization: {
      colors,
      belly,
      mouth: { ...normalizedCurrent.customization.mouth, ...patch.customization?.mouth },
    },
    symbols: {
      chest: { ...normalizedCurrent.symbols.chest, ...patch.symbols?.chest },
      back: { ...normalizedCurrent.symbols.back, ...patch.symbols?.back },
    },
  })
}
