/** Phase 2 additive model: richer face parts, composable antennae and an eight-segment tail. */
import {
  CLOUD_FOX_BODY_SHAPES,
  CLOUD_FOX_PART_OPTIONS,
  CLOUD_FOX_SPECIES_DEFINITION,
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  calculatePetVisualBounds,
  createDefaultCloudFoxAppearance,
  normalizeCloudFoxAppearance,
  randomizeCloudFoxAppearance,
  type CloudFoxAppearanceRecipe as BaseAppearanceRecipe,
  type CloudFoxStudioBackground,
  type CloudFoxStudioBehavior,
  type CloudFoxStudioView,
  type PetVisualBounds,
} from './cloud-fox-appearance'

export { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_SPECIES_DEFINITION, CLOUD_FOX_STUDIO_STORAGE_KEY }
export type { CloudFoxStudioBackground, CloudFoxStudioBehavior, CloudFoxStudioView }

const extra = <T extends string>(id: T, label: string, labelEn: string) => ({ id, label, labelEn })
export const PET_STUDIO_PART_OPTIONS = {
  ears: [...CLOUD_FOX_PART_OPTIONS.ears, extra('floppy', '糯米垂耳', 'Mochi Flop'), extra('petal', '花瓣耳', 'Petal Ear')],
  eyes: [...CLOUD_FOX_PART_OPTIONS.eyes, extra('sleepy', '月牙眯眼', 'Sleepy Crescent'), extra('diamond', '水晶菱眼', 'Crystal Diamond')],
  noses: [...CLOUD_FOX_PART_OPTIONS.noses, extra('button', '纽扣鼻', 'Button Nose'), extra('heart', '爱心鼻', 'Heart Nose')],
  mouths: [...CLOUD_FOX_PART_OPTIONS.mouths, extra('open', '开心张嘴', 'Happy Open'), extra('pout', '软萌嘟嘴', 'Soft Pout')],
  tails: CLOUD_FOX_PART_OPTIONS.tails,
  antennas: CLOUD_FOX_PART_OPTIONS.antennas,
  antennaRods: [extra('straight', '直杆', 'Straight'), extra('arc', '弧杆', 'Arc'), extra('tapered', '锥形杆', 'Tapered'), extra('segmented', '机械节杆', 'Segmented')],
  antennaTips: [extra('orb', '光球', 'Orb'), extra('star', '星芒', 'Star'), extra('crystal', '晶体', 'Crystal'), extra('ring', '光环', 'Ring')],
} as const

export type TailDirection = 'left' | 'right' | 'up' | 'down' | 'back' | 'forward'
export const MIN_TAIL_SEGMENTS = 3 as const
export const MAX_TAIL_SEGMENTS = 8 as const

export interface EarDesignRecipe {
  outerColor: string
  innerColor: string
  tipColor: string
  innerGlowEnabled: boolean
  innerGlowColor: string
  innerGlowIntensity: number
}

export interface TailSegmentRecipe {
  length: number
  width: number
  offsetX: number
  offsetY: number
  offsetZ: number
  rotationX: number
  rotationY: number
  rotationZ: number
}

export interface TailTipGlowRecipe {
  enabled: boolean
  color: string
  intensity: number
  auraScale: number
}

export interface TailDesignRecipe {
  rootOffsetX: number
  rootOffsetY: number
  rootOffsetZ: number
  rootExtensionLength: number
  rootExtensionWidth: number
  lateralOffset: number
  direction: TailDirection
  tipGlow: TailTipGlowRecipe
  segments: TailSegmentRecipe[]
}

export interface AntennaDesignRecipe { spacing: number; length: number; thickness: number; tilt: number }
export type AntennaRodStyle = typeof PET_STUDIO_PART_OPTIONS.antennaRods[number]['id']
export type AntennaTipStyle = typeof PET_STUDIO_PART_OPTIONS.antennaTips[number]['id']
export type RichEarStyle = typeof PET_STUDIO_PART_OPTIONS.ears[number]['id']
export type RichEyeStyle = typeof PET_STUDIO_PART_OPTIONS.eyes[number]['id']
export type RichNoseStyle = typeof PET_STUDIO_PART_OPTIONS.noses[number]['id']
export type RichMouthStyle = typeof PET_STUDIO_PART_OPTIONS.mouths[number]['id']

export interface PetStudioAppearanceRecipe extends Omit<BaseAppearanceRecipe, 'parts'> {
  parts: Omit<BaseAppearanceRecipe['parts'], 'ears' | 'eyes' | 'nose' | 'mouth'> & {
    ears: RichEarStyle
    eyes: RichEyeStyle
    nose: RichNoseStyle
    mouth: RichMouthStyle
    antennaRod: AntennaRodStyle
    antennaTip: AntennaTipStyle
  }
  earDesign: EarDesignRecipe
  tailDesign: TailDesignRecipe
  antennaDesign: AntennaDesignRecipe
}

const ids = <T extends { id: string }>(items: readonly T[]) => new Set(items.map(item => item.id))
const valid = {
  ears: ids(PET_STUDIO_PART_OPTIONS.ears), eyes: ids(PET_STUDIO_PART_OPTIONS.eyes), noses: ids(PET_STUDIO_PART_OPTIONS.noses), mouths: ids(PET_STUDIO_PART_OPTIONS.mouths),
  rods: ids(PET_STUDIO_PART_OPTIONS.antennaRods), tips: ids(PET_STUDIO_PART_OPTIONS.antennaTips),
}
const clamp = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const choice = <T extends string>(value: unknown, set: Set<string>, fallback: T) => typeof value === 'string' && set.has(value) ? value as T : fallback
const hex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
const randomItem = <T>(items: readonly T[], random: () => number) => items[Math.min(items.length - 1, Math.floor(random() * items.length))]!
const randomNumber = (min: number, max: number, random: () => number) => Number((min + (max - min) * random()).toFixed(2))

const defaultSegments = (): TailSegmentRecipe[] => [
  { length: .58, width: .27, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: .03, rotationY: .08, rotationZ: -.08 },
  { length: .58, width: .22, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .1 },
  { length: .52, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .16 },
]

export function createPetStudioAppearance(): PetStudioAppearanceRecipe {
  const base = createDefaultCloudFoxAppearance()
  return {
    ...base,
    parts: { ...base.parts, antennaRod: 'straight', antennaTip: 'orb' },
    earDesign: {
      outerColor: base.palette.coat,
      innerColor: base.palette.primaryGlow,
      tipColor: base.palette.coatWarm,
      innerGlowEnabled: true,
      innerGlowColor: base.palette.primaryGlow,
      innerGlowIntensity: .25,
    },
    tailDesign: {
      rootOffsetX: 0,
      rootOffsetY: 0,
      rootOffsetZ: 0,
      rootExtensionLength: .38,
      rootExtensionWidth: .24,
      lateralOffset: -.58,
      direction: 'left',
      tipGlow: { enabled: true, color: base.palette.tailGlow, intensity: 1.65, auraScale: 1.55 },
      segments: defaultSegments(),
    },
    antennaDesign: { spacing: .44, length: .62, thickness: .04, tilt: .2 },
  }
}

export function normalizePetStudioAppearance(input: unknown): PetStudioAppearanceRecipe {
  const fallback = createPetStudioAppearance()
  const base = normalizeCloudFoxAppearance(input)
  const candidate = input && typeof input === 'object' ? input as Partial<PetStudioAppearanceRecipe> : {}
  const parts = candidate.parts || fallback.parts
  const ear = candidate.earDesign || fallback.earDesign
  const tail = candidate.tailDesign || fallback.tailDesign
  const tipGlow = tail.tipGlow || fallback.tailDesign.tipGlow
  const antenna = candidate.antennaDesign || fallback.antennaDesign
  const directions: TailDirection[] = ['left', 'right', 'up', 'down', 'back', 'forward']
  const sourceSegments = Array.isArray(tail.segments) && tail.segments.length ? [...tail.segments] : [...fallback.tailDesign.segments]
  while (sourceSegments.length < MIN_TAIL_SEGMENTS) {
    sourceSegments.push(fallback.tailDesign.segments[sourceSegments.length]!)
  }
  return {
    ...base,
    parts: {
      ...base.parts,
      ears: choice(parts.ears, valid.ears, fallback.parts.ears),
      eyes: choice(parts.eyes, valid.eyes, fallback.parts.eyes),
      nose: choice(parts.nose, valid.noses, fallback.parts.nose),
      mouth: choice(parts.mouth, valid.mouths, fallback.parts.mouth),
      antennaRod: choice(parts.antennaRod, valid.rods, fallback.parts.antennaRod),
      antennaTip: choice(parts.antennaTip, valid.tips, fallback.parts.antennaTip),
    },
    earDesign: {
      outerColor: hex(ear.outerColor, base.palette.coat),
      innerColor: hex(ear.innerColor, base.palette.innerEar),
      tipColor: hex(ear.tipColor, base.palette.coatWarm),
      innerGlowEnabled: ear.innerGlowEnabled !== false,
      innerGlowColor: hex(ear.innerGlowColor, base.palette.primaryGlow),
      innerGlowIntensity: clamp(ear.innerGlowIntensity, 0, 4, fallback.earDesign.innerGlowIntensity),
    },
    tailDesign: {
      rootOffsetX: clamp(tail.rootOffsetX, -.8, .8, fallback.tailDesign.rootOffsetX),
      rootOffsetY: clamp(tail.rootOffsetY, -.8, .8, fallback.tailDesign.rootOffsetY),
      rootOffsetZ: clamp(tail.rootOffsetZ, -.8, .8, fallback.tailDesign.rootOffsetZ),
      rootExtensionLength: clamp(tail.rootExtensionLength, .12, .9, fallback.tailDesign.rootExtensionLength),
      rootExtensionWidth: clamp(tail.rootExtensionWidth, .08, .42, fallback.tailDesign.rootExtensionWidth),
      lateralOffset: clamp(tail.lateralOffset, -1.2, 1.2, fallback.tailDesign.lateralOffset),
      direction: directions.includes(tail.direction as TailDirection) ? tail.direction as TailDirection : fallback.tailDesign.direction,
      tipGlow: {
        enabled: tipGlow.enabled !== false,
        color: hex(tipGlow.color, base.palette.tailGlow),
        intensity: clamp(tipGlow.intensity, 0, 5, fallback.tailDesign.tipGlow.intensity),
        auraScale: clamp(tipGlow.auraScale, .5, 3, fallback.tailDesign.tipGlow.auraScale),
      },
      segments: sourceSegments.slice(0, MAX_TAIL_SEGMENTS).map((segment, index) => ({
        length: clamp(segment?.length, .18, .9, fallback.tailDesign.segments[index]?.length || .42),
        width: clamp(segment?.width, .08, .42, fallback.tailDesign.segments[index]?.width || .16),
        offsetX: clamp(segment?.offsetX, -.6, .6, fallback.tailDesign.segments[index]?.offsetX || 0),
        offsetY: clamp(segment?.offsetY, -.6, .6, fallback.tailDesign.segments[index]?.offsetY || 0),
        offsetZ: clamp(segment?.offsetZ, -.6, .6, fallback.tailDesign.segments[index]?.offsetZ || 0),
        rotationX: clamp(segment?.rotationX, -Math.PI, Math.PI, fallback.tailDesign.segments[index]?.rotationX || 0),
        rotationY: clamp(segment?.rotationY, -Math.PI, Math.PI, fallback.tailDesign.segments[index]?.rotationY || 0),
        rotationZ: clamp(segment?.rotationZ, -Math.PI, Math.PI, fallback.tailDesign.segments[index]?.rotationZ || 0),
      })),
    },
    antennaDesign: {
      spacing: clamp(antenna.spacing, .18, .82, fallback.antennaDesign.spacing),
      length: clamp(antenna.length, .24, 1.2, fallback.antennaDesign.length),
      thickness: clamp(antenna.thickness, .018, .1, fallback.antennaDesign.thickness),
      tilt: clamp(antenna.tilt, -.72, .72, fallback.antennaDesign.tilt),
    },
  }
}

export function randomizePetStudioAppearance(current = createPetStudioAppearance(), random: () => number = Math.random) {
  const base = randomizeCloudFoxAppearance(current as unknown as BaseAppearanceRecipe, random)
  return normalizePetStudioAppearance({
    ...base,
    earDesign: {
      ...current.earDesign,
      outerColor: base.palette.coat,
      innerColor: base.palette.primaryGlow,
      innerGlowColor: base.palette.primaryGlow,
    },
    parts: {
      ...base.parts,
      ears: randomItem(PET_STUDIO_PART_OPTIONS.ears, random).id,
      eyes: randomItem(PET_STUDIO_PART_OPTIONS.eyes, random).id,
      nose: randomItem(PET_STUDIO_PART_OPTIONS.noses, random).id,
      mouth: randomItem(PET_STUDIO_PART_OPTIONS.mouths, random).id,
      antennaRod: randomItem(PET_STUDIO_PART_OPTIONS.antennaRods, random).id,
      antennaTip: randomItem(PET_STUDIO_PART_OPTIONS.antennaTips, random).id,
    },
    tailDesign: {
      ...current.tailDesign,
      direction: randomItem(['left', 'right', 'up', 'down', 'back', 'forward'] as const, random),
      lateralOffset: randomNumber(-.9, .9, random),
      tipGlow: { ...current.tailDesign.tipGlow, color: base.palette.tailGlow },
      segments: Array.from({ length: 2 + Math.floor(random() * 7) }, (_, index) => ({
        length: randomNumber(.28, .7, random),
        width: Number(Math.max(.09, .3 - index * .025).toFixed(2)),
        offsetX: randomNumber(-.12, .12, random),
        offsetY: randomNumber(-.12, .12, random),
        offsetZ: randomNumber(-.12, .12, random),
        rotationX: randomNumber(-.25, .25, random),
        rotationY: randomNumber(-.25, .25, random),
        rotationZ: randomNumber(-.3, .4, random),
      })),
    },
    antennaDesign: { spacing: randomNumber(.24, .66, random), length: randomNumber(.36, .94, random), thickness: randomNumber(.025, .075, random), tilt: randomNumber(-.4, .4, random) },
  })
}

export function calculatePetStudioVisualBounds(recipe: PetStudioAppearanceRecipe): PetVisualBounds {
  const baseBounds = calculatePetVisualBounds(recipe as never)
  const tail = recipe.tailDesign
  const tailReach = tail.rootExtensionLength
    + Math.abs(tail.lateralOffset)
    + tail.segments.reduce((sum, segment) => sum + segment.length + Math.abs(segment.offsetX), 0)
  const verticalReach = tail.segments.reduce((sum, segment) => sum + Math.abs(segment.offsetY) + segment.length * .45, 0)
  const depthReach = tail.rootExtensionLength
    + Math.abs(tail.rootOffsetZ)
    + tail.segments.reduce((sum, segment) => sum + Math.abs(segment.offsetZ), 0)
  const width = Math.max(baseBounds.width, baseBounds.width * .45 + Math.abs(tail.rootOffsetX) + tailReach)
  const height = Math.max(baseBounds.height, baseBounds.height * .54 + Math.abs(tail.rootOffsetY) + verticalReach)
  const depth = Math.max(baseBounds.depth, baseBounds.depth * .5 + depthReach)
  return {
    centerY: baseBounds.centerY,
    width,
    height,
    depth,
    radius: Math.sqrt(width ** 2 + height ** 2 + depth ** 2) * .5,
  }
}
