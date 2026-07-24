/*
 * 文件职责 / File responsibility
 * 对完整可配置外观执行深层局部补丁，覆盖扩展前爪、嘴巴与肚皮，同时保证未指定部位保持不变。
 * Applies deep local patches to the complete customizable appearance, including extended paws, mouth, and belly, while preserving every unspecified section.
 */
import type { EarDesignRecipe, TailDesignRecipe, TailSegmentRecipe } from './pet-studio-phase2'
import type { BellyPatchDesignRecipe, ChestDisplayDesignRecipe } from './pet-species-registry'
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
  current: CustomizableAppearanceRecipe,
  patch: PetAppearanceLocalPatch,
): CustomizableAppearanceRecipe {
  const bellyPatch = patch.bellyPatchDesign
  const changesCustomGeometry = Boolean(bellyPatch) && [bellyPatch?.style, bellyPatch?.width, bellyPatch?.height, bellyPatch?.offsetY].some(value => value !== undefined)
  const bellyPatchDesign = bellyPatch
    ? {
        ...current.bellyPatchDesign,
        ...bellyPatch,
        ...(!bellyPatch.mode && bellyPatch.visible === false ? { mode: 'none' as const } : {}),
        ...(!bellyPatch.mode && changesCustomGeometry ? { mode: 'custom' as const, visible: true } : {}),
      }
    : current.bellyPatchDesign

  return normalizeCustomizableAppearance({
    ...current,
    parts: { ...current.parts, ...patch.parts },
    proportions: { ...current.proportions, ...patch.proportions },
    palette: { ...current.palette, ...patch.palette },
    glow: { ...current.glow, ...patch.glow },
    antennaDesign: { ...current.antennaDesign, ...patch.antennaDesign },
    bellyPatchDesign,
    chestDisplay: { ...current.chestDisplay, ...patch.chestDisplay },
    frontPawDesign: { ...current.frontPawDesign, ...patch.frontPawDesign },
    earDesign: { ...current.earDesign, ...patch.earDesign },
    tailDesign: {
      ...current.tailDesign,
      ...patch.tailDesign,
      tipGlow: { ...current.tailDesign.tipGlow, ...patch.tailDesign?.tipGlow },
      segments: patch.tailDesign?.segments ?? current.tailDesign.segments,
    },
    customization: {
      colors: { ...current.customization.colors, ...patch.customization?.colors },
      belly: { ...current.customization.belly, ...patch.customization?.belly },
      mouth: { ...current.customization.mouth, ...patch.customization?.mouth },
    },
    symbols: {
      chest: { ...current.symbols.chest, ...patch.symbols?.chest },
      back: { ...current.symbols.back, ...patch.symbols?.back },
    },
  })
}
