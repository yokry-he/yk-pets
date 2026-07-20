/** Phase 2 additive model: richer face parts, composable antennae and an eight-segment tail. */
import {
  CLOUD_FOX_BODY_SHAPES,
  CLOUD_FOX_PART_OPTIONS,
  CLOUD_FOX_SPECIES_DEFINITION,
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  createDefaultCloudFoxAppearance,
  normalizeCloudFoxAppearance,
  randomizeCloudFoxAppearance,
  type CloudFoxAppearanceRecipe as BaseAppearanceRecipe,
  type CloudFoxStudioBackground,
  type CloudFoxStudioBehavior,
  type CloudFoxStudioView,
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
export const MAX_TAIL_SEGMENTS = 8 as const
export interface TailSegmentRecipe { length: number; width: number; rotationX: number; rotationY: number; rotationZ: number }
export interface TailDesignRecipe { direction: TailDirection; segments: TailSegmentRecipe[] }
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
const randomItem = <T>(items: readonly T[], random: () => number) => items[Math.min(items.length - 1, Math.floor(random() * items.length))]!
const randomNumber = (min: number, max: number, random: () => number) => Number((min + (max - min) * random()).toFixed(2))
const defaultSegments = (): TailSegmentRecipe[] => [
  { length: .58, width: .26, rotationX: .08, rotationY: .2, rotationZ: .18 },
  { length: .52, width: .22, rotationX: 0, rotationY: .04, rotationZ: .3 },
  { length: .46, width: .18, rotationX: 0, rotationY: -.04, rotationZ: -.18 },
]

export function createPetStudioAppearance(): PetStudioAppearanceRecipe {
  const base = createDefaultCloudFoxAppearance()
  return {
    ...base,
    parts: { ...base.parts, antennaRod: 'straight', antennaTip: 'orb' },
    tailDesign: { direction: 'left', segments: defaultSegments() },
    antennaDesign: { spacing: .44, length: .62, thickness: .04, tilt: .2 },
  }
}

export function normalizePetStudioAppearance(input: unknown): PetStudioAppearanceRecipe {
  const fallback = createPetStudioAppearance()
  const base = normalizeCloudFoxAppearance(input)
  const candidate = input && typeof input === 'object' ? input as Partial<PetStudioAppearanceRecipe> : {}
  const parts = candidate.parts || fallback.parts
  const tail = candidate.tailDesign || fallback.tailDesign
  const antenna = candidate.antennaDesign || fallback.antennaDesign
  const directions: TailDirection[] = ['left', 'right', 'up', 'down', 'back', 'forward']
  const sourceSegments = Array.isArray(tail.segments) && tail.segments.length ? tail.segments : fallback.tailDesign.segments
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
    tailDesign: {
      direction: directions.includes(tail.direction as TailDirection) ? tail.direction as TailDirection : fallback.tailDesign.direction,
      segments: sourceSegments.slice(0, MAX_TAIL_SEGMENTS).map((segment, index) => ({
        length: clamp(segment?.length, .18, .9, fallback.tailDesign.segments[index]?.length || .42),
        width: clamp(segment?.width, .08, .42, fallback.tailDesign.segments[index]?.width || .16),
        rotationX: clamp(segment?.rotationX, -Math.PI, Math.PI, 0),
        rotationY: clamp(segment?.rotationY, -Math.PI, Math.PI, 0),
        rotationZ: clamp(segment?.rotationZ, -Math.PI, Math.PI, 0),
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
      direction: randomItem(['left', 'right', 'up', 'down', 'back', 'forward'] as const, random),
      segments: Array.from({ length: 2 + Math.floor(random() * 7) }, (_, index) => ({
        length: randomNumber(.28, .7, random), width: Number(Math.max(.09, .3 - index * .025).toFixed(2)),
        rotationX: randomNumber(-.25, .25, random), rotationY: randomNumber(-.25, .25, random), rotationZ: randomNumber(-.3, .4, random),
      })),
    },
    antennaDesign: { spacing: randomNumber(.24, .66, random), length: randomNumber(.36, .94, random), thickness: randomNumber(.025, .075, random), tilt: randomNumber(-.4, .4, random) },
  })
}
