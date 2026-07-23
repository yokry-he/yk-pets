/**
 * 文件职责 / File responsibility
 * 对多物种外观配方执行深层局部补丁，保证未被指定的部位保持不变。
 * Applies deep local patches to multi-species appearance recipes while preserving every unspecified visual section.
 */
import type { EarDesignRecipe, TailDesignRecipe, TailSegmentRecipe } from './pet-studio-phase2'
import {
  normalizeMultiSpeciesAppearance,
  type BellyPatchDesignRecipe,
  type ChestDisplayDesignRecipe,
  type FrontPawDesignRecipe,
  type MultiSpeciesAppearanceRecipe,
} from './pet-species-registry'

export interface PetAppearanceLocalPatch {
  parts?: Partial<MultiSpeciesAppearanceRecipe['parts']>
  proportions?: Partial<MultiSpeciesAppearanceRecipe['proportions']>
  palette?: Partial<MultiSpeciesAppearanceRecipe['palette']>
  glow?: Partial<MultiSpeciesAppearanceRecipe['glow']>
  antennaDesign?: Partial<MultiSpeciesAppearanceRecipe['antennaDesign']>
  bellyPatchDesign?: Partial<BellyPatchDesignRecipe>
  chestDisplay?: Partial<ChestDisplayDesignRecipe>
  frontPawDesign?: Partial<FrontPawDesignRecipe>
  earDesign?: Partial<EarDesignRecipe>
  tailDesign?: Partial<Omit<TailDesignRecipe, 'segments' | 'tipGlow'>> & {
    segments?: TailSegmentRecipe[]
    tipGlow?: Partial<TailDesignRecipe['tipGlow']>
  }
  symbols?: {
    chest?: Partial<MultiSpeciesAppearanceRecipe['symbols']['chest']>
    back?: Partial<MultiSpeciesAppearanceRecipe['symbols']['back']>
  }
}

export function applyPetAppearanceLocalPatch(
  current: MultiSpeciesAppearanceRecipe,
  patch: PetAppearanceLocalPatch,
): MultiSpeciesAppearanceRecipe {
  const bellyPatch = patch.bellyPatchDesign
  const changesCustomGeometry = Boolean(bellyPatch) && [
    bellyPatch?.style,
    bellyPatch?.width,
    bellyPatch?.height,
    bellyPatch?.offsetY,
  ].some(value => value !== undefined)
  const bellyPatchDesign = bellyPatch
    ? {
        ...current.bellyPatchDesign,
        ...bellyPatch,
        ...(!bellyPatch.mode && bellyPatch.visible === false ? { mode: 'none' as const } : {}),
        ...(!bellyPatch.mode && changesCustomGeometry ? { mode: 'custom' as const, visible: true } : {}),
      }
    : current.bellyPatchDesign

  return normalizeMultiSpeciesAppearance({
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
    symbols: {
      chest: { ...current.symbols.chest, ...patch.symbols?.chest },
      back: { ...current.symbols.back, ...patch.symbols?.back },
    },
  })
}
