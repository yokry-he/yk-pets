/*
 * 文件职责 / File responsibility
 * 对完整可配置外观执行深层局部补丁；先归一化历史或新配方，再覆盖扩展前爪、嘴巴与肚皮，保证未指定部位保持不变。
 * Applies deep local patches to complete appearance recipes by normalizing legacy or current input first, then patching extended paws, mouth, and belly while preserving unspecified sections.
 */
import type { EarDesignRecipe, TailDesignRecipe, TailSegmentRecipe } from './pet-studio-phase2'
import type { BellyPatchDesignRecipe, ChestDisplayDesignRecipe, MultiSpeciesAppearanceRecipe } from './pet-species-registry'
import {
  normalizeCustomizableAppearance,
  type CustomizableAppearanceRecipe,
  type ExtendedFrontPawDesignRecipe,
  type PetBellyCustomizationRecipe,
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
      colors: { ...normalizedCurrent.customization.colors, ...patch.customization?.colors },
      belly: { ...normalizedCurrent.customization.belly, ...patch.customization?.belly },
      mouth: { ...normalizedCurrent.customization.mouth, ...patch.customization?.mouth },
    },
    symbols: {
      chest: { ...normalizedCurrent.symbols.chest, ...patch.symbols?.chest },
      back: { ...normalizedCurrent.symbols.back, ...patch.symbols?.back },
    },
  })
}
