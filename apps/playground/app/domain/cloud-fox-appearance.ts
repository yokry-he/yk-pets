
/**
 * 文件职责 / File responsibility
 * 定义云狐工坊的物种能力、可替换部件、外观配方、安全范围与迁移规则。
 * Defines Cloud Fox Studio species capabilities, replaceable parts, appearance recipes, safe ranges, and migration rules.
 */

export const CLOUD_FOX_APPEARANCE_SCHEMA_VERSION = 1 as const
export const CLOUD_FOX_STUDIO_STORAGE_KEY = 'yk-pets:studio:cloud-fox:v1'

export const CLOUD_FOX_PART_OPTIONS = {
  ears: [
    { id: 'pointed', label: '星云尖耳', labelEn: 'Nebula Point' },
    { id: 'rounded', label: '柔软圆耳', labelEn: 'Soft Round' },
    { id: 'wing', label: '羽翼耳', labelEn: 'Wing Ear' },
    { id: 'mechanical', label: '机械耳', labelEn: 'Mecha Ear' },
  ],
  eyes: [
    { id: 'round', label: '圆润眼', labelEn: 'Round' },
    { id: 'oval', label: '灵动椭圆眼', labelEn: 'Oval' },
    { id: 'spark', label: '星芒眼', labelEn: 'Spark' },
    { id: 'visor', label: '能量目镜', labelEn: 'Visor' },
  ],
  noses: [
    { id: 'soft', label: '柔软鼻', labelEn: 'Soft Nose' },
    { id: 'triangle', label: '狐狸三角鼻', labelEn: 'Fox Triangle' },
    { id: 'sensor', label: '感应器鼻', labelEn: 'Sensor' },
  ],
  mouths: [
    { id: 'smile', label: '微笑嘴', labelEn: 'Smile' },
    { id: 'cat', label: '猫系嘴', labelEn: 'Cat Mouth' },
    { id: 'line', label: '安静线条嘴', labelEn: 'Quiet Line' },
  ],
  tails: [
    { id: 'cloud', label: '标准云尾', labelEn: 'Cloud Tail' },
    { id: 'plume', label: '蓬松羽尾', labelEn: 'Plume Tail' },
    { id: 'long', label: '长流光尾', labelEn: 'Long Tail' },
    { id: 'energy', label: '能量尾', labelEn: 'Energy Tail' },
  ],
  antennas: [
    { id: 'none', label: '无触角', labelEn: 'None' },
    { id: 'twin', label: '双星触角', labelEn: 'Twin Star' },
    { id: 'arc', label: '弧光触角', labelEn: 'Arc Light' },
    { id: 'crystal', label: '晶体触角', labelEn: 'Crystal' },
  ],
} as const

export type CloudFoxEarStyle = typeof CLOUD_FOX_PART_OPTIONS.ears[number]['id']
export type CloudFoxEyeStyle = typeof CLOUD_FOX_PART_OPTIONS.eyes[number]['id']
export type CloudFoxNoseStyle = typeof CLOUD_FOX_PART_OPTIONS.noses[number]['id']
export type CloudFoxMouthStyle = typeof CLOUD_FOX_PART_OPTIONS.mouths[number]['id']
export type CloudFoxTailStyle = typeof CLOUD_FOX_PART_OPTIONS.tails[number]['id']
export type CloudFoxAntennaStyle = typeof CLOUD_FOX_PART_OPTIONS.antennas[number]['id']
export type CloudFoxGlowMode = 'fixed' | 'emotion' | 'rainbow'
export type CloudFoxStudioBehavior = 'idle' | 'greeting' | 'jumping' | 'stretching' | 'spinning' | 'resting'
export type CloudFoxStudioView = 'front' | 'left' | 'back' | 'right'
export type CloudFoxStudioBackground = 'dark' | 'light' | 'web'

export interface CloudFoxIdentityRecipe {
  petId: string
  nameZh: string
  nameEn: string
  monogram: string
}

export interface CloudFoxPartRecipe {
  ears: CloudFoxEarStyle
  eyes: CloudFoxEyeStyle
  nose: CloudFoxNoseStyle
  mouth: CloudFoxMouthStyle
  tail: CloudFoxTailStyle
  antenna: CloudFoxAntennaStyle
}

export interface CloudFoxProportionRecipe {
  bodyScale: number
  headScale: number
  limbLength: number
  limbSpacing: number
  pawScale: number
  earScale: number
  eyeScale: number
  eyeSpacing: number
  tailLength: number
  tailWidth: number
  antennaScale: number
}

export interface CloudFoxPaletteRecipe {
  coat: string
  coatShadow: string
  coatWarm: string
  innerEar: string
  eye: string
  primaryGlow: string
  secondaryGlow: string
  tailGlow: string
  antennaGlow: string
  symbolGlow: string
}

export interface CloudFoxGlowRecipe {
  mode: CloudFoxGlowMode
  tailEnabled: boolean
  antennaEnabled: boolean
  intensity: number
  pulseSpeed: number
}

export interface CloudFoxSymbolRecipe {
  chestEnabled: boolean
  chestText: string
  backEnabled: boolean
  backText: string
  symbolScale: number
}

export interface CloudFoxAppearanceRecipe {
  schemaVersion: typeof CLOUD_FOX_APPEARANCE_SCHEMA_VERSION
  speciesId: 'cloud-fox'
  identity: CloudFoxIdentityRecipe
  parts: CloudFoxPartRecipe
  proportions: CloudFoxProportionRecipe
  palette: CloudFoxPaletteRecipe
  glow: CloudFoxGlowRecipe
  symbols: CloudFoxSymbolRecipe
}

export interface CloudFoxSpeciesDefinition {
  id: 'cloud-fox'
  label: '云狐'
  labelEn: 'Cloud Fox'
  supportedSlots: readonly string[]
  safeRanges: Readonly<Record<keyof CloudFoxProportionRecipe | 'glowIntensity' | 'pulseSpeed' | 'symbolScale', readonly [number, number]>>
}

export const CLOUD_FOX_SPECIES_DEFINITION: CloudFoxSpeciesDefinition = Object.freeze({
  id: 'cloud-fox',
  label: '云狐',
  labelEn: 'Cloud Fox',
  supportedSlots: Object.freeze(['ears', 'eyes', 'nose', 'mouth', 'tail', 'antenna', 'front-limbs', 'chest-symbol', 'back-symbol']),
  safeRanges: Object.freeze({
    bodyScale: [0.82, 1.18],
    headScale: [0.84, 1.2],
    limbLength: [0.78, 1.22],
    limbSpacing: [0.82, 1.2],
    pawScale: [0.76, 1.32],
    earScale: [0.76, 1.28],
    eyeScale: [0.76, 1.32],
    eyeSpacing: [0.82, 1.18],
    tailLength: [0.78, 1.34],
    tailWidth: [0.76, 1.32],
    antennaScale: [0.72, 1.36],
    glowIntensity: [0.35, 2.4],
    pulseSpeed: [0.4, 2.5],
    symbolScale: [0.65, 1.4],
  }),
})

export function derivePetMonogram(nameEn: string) {
  return nameEn.trim().match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() || 'Z'
}

export function createDefaultCloudFoxAppearance(): CloudFoxAppearanceRecipe {
  return {
    schemaVersion: CLOUD_FOX_APPEARANCE_SCHEMA_VERSION,
    speciesId: 'cloud-fox',
    identity: {
      petId: 'zeph',
      nameZh: '云灵',
      nameEn: 'Zeph',
      monogram: 'Z',
    },
    parts: {
      ears: 'pointed',
      eyes: 'round',
      nose: 'soft',
      mouth: 'smile',
      tail: 'cloud',
      antenna: 'twin',
    },
    proportions: {
      bodyScale: 1,
      headScale: 1,
      limbLength: 1,
      limbSpacing: 1,
      pawScale: 1,
      earScale: 1,
      eyeScale: 1,
      eyeSpacing: 1,
      tailLength: 1,
      tailWidth: 1,
      antennaScale: 1,
    },
    palette: {
      coat: '#eef1ff',
      coatShadow: '#aeb6e8',
      coatWarm: '#ffffff',
      innerEar: '#7066ff',
      eye: '#15172b',
      primaryGlow: '#7066ff',
      secondaryGlow: '#52e0d0',
      tailGlow: '#52e0d0',
      antennaGlow: '#75e6ff',
      symbolGlow: '#8fdcff',
    },
    glow: {
      mode: 'emotion',
      tailEnabled: true,
      antennaEnabled: true,
      intensity: 1.15,
      pulseSpeed: 1,
    },
    symbols: {
      chestEnabled: true,
      chestText: 'Z',
      backEnabled: true,
      backText: 'YK',
      symbolScale: 1,
    },
  }
}

const optionIds = {
  ears: new Set(CLOUD_FOX_PART_OPTIONS.ears.map(option => option.id)),
  eyes: new Set(CLOUD_FOX_PART_OPTIONS.eyes.map(option => option.id)),
  noses: new Set(CLOUD_FOX_PART_OPTIONS.noses.map(option => option.id)),
  mouths: new Set(CLOUD_FOX_PART_OPTIONS.mouths.map(option => option.id)),
  tails: new Set(CLOUD_FOX_PART_OPTIONS.tails.map(option => option.id)),
  antennas: new Set(CLOUD_FOX_PART_OPTIONS.antennas.map(option => option.id)),
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

function normalizeText(value: unknown, fallback: string, maximum = 24) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : fallback
}

function normalizeHex(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function normalizePart<T extends string>(value: unknown, valid: ReadonlySet<string>, fallback: T): T {
  return typeof value === 'string' && valid.has(value) ? value as T : fallback
}

export function normalizeCloudFoxAppearance(input: unknown): CloudFoxAppearanceRecipe {
  const fallback = createDefaultCloudFoxAppearance()
  if (!input || typeof input !== 'object') return fallback
  const candidate = input as Partial<CloudFoxAppearanceRecipe>
  const identity = candidate.identity || fallback.identity
  const parts = candidate.parts || fallback.parts
  const proportions = candidate.proportions || fallback.proportions
  const palette = candidate.palette || fallback.palette
  const glow = candidate.glow || fallback.glow
  const symbols = candidate.symbols || fallback.symbols
  const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges
  const nameEn = normalizeText(identity.nameEn, fallback.identity.nameEn)

  return {
    schemaVersion: CLOUD_FOX_APPEARANCE_SCHEMA_VERSION,
    speciesId: 'cloud-fox',
    identity: {
      petId: normalizeText(identity.petId, fallback.identity.petId, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || fallback.identity.petId,
      nameZh: normalizeText(identity.nameZh, fallback.identity.nameZh, 16),
      nameEn,
      monogram: normalizeText(identity.monogram, derivePetMonogram(nameEn), 3).toUpperCase(),
    },
    parts: {
      ears: normalizePart(parts.ears, optionIds.ears, fallback.parts.ears),
      eyes: normalizePart(parts.eyes, optionIds.eyes, fallback.parts.eyes),
      nose: normalizePart(parts.nose, optionIds.noses, fallback.parts.nose),
      mouth: normalizePart(parts.mouth, optionIds.mouths, fallback.parts.mouth),
      tail: normalizePart(parts.tail, optionIds.tails, fallback.parts.tail),
      antenna: normalizePart(parts.antenna, optionIds.antennas, fallback.parts.antenna),
    },
    proportions: {
      bodyScale: clamp(proportions.bodyScale, ...ranges.bodyScale, fallback.proportions.bodyScale),
      headScale: clamp(proportions.headScale, ...ranges.headScale, fallback.proportions.headScale),
      limbLength: clamp(proportions.limbLength, ...ranges.limbLength, fallback.proportions.limbLength),
      limbSpacing: clamp(proportions.limbSpacing, ...ranges.limbSpacing, fallback.proportions.limbSpacing),
      pawScale: clamp(proportions.pawScale, ...ranges.pawScale, fallback.proportions.pawScale),
      earScale: clamp(proportions.earScale, ...ranges.earScale, fallback.proportions.earScale),
      eyeScale: clamp(proportions.eyeScale, ...ranges.eyeScale, fallback.proportions.eyeScale),
      eyeSpacing: clamp(proportions.eyeSpacing, ...ranges.eyeSpacing, fallback.proportions.eyeSpacing),
      tailLength: clamp(proportions.tailLength, ...ranges.tailLength, fallback.proportions.tailLength),
      tailWidth: clamp(proportions.tailWidth, ...ranges.tailWidth, fallback.proportions.tailWidth),
      antennaScale: clamp(proportions.antennaScale, ...ranges.antennaScale, fallback.proportions.antennaScale),
    },
    palette: {
      coat: normalizeHex(palette.coat, fallback.palette.coat),
      coatShadow: normalizeHex(palette.coatShadow, fallback.palette.coatShadow),
      coatWarm: normalizeHex(palette.coatWarm, fallback.palette.coatWarm),
      innerEar: normalizeHex(palette.innerEar, fallback.palette.innerEar),
      eye: normalizeHex(palette.eye, fallback.palette.eye),
      primaryGlow: normalizeHex(palette.primaryGlow, fallback.palette.primaryGlow),
      secondaryGlow: normalizeHex(palette.secondaryGlow, fallback.palette.secondaryGlow),
      tailGlow: normalizeHex(palette.tailGlow, fallback.palette.tailGlow),
      antennaGlow: normalizeHex(palette.antennaGlow, fallback.palette.antennaGlow),
      symbolGlow: normalizeHex(palette.symbolGlow, fallback.palette.symbolGlow),
    },
    glow: {
      mode: glow.mode === 'fixed' || glow.mode === 'rainbow' ? glow.mode : 'emotion',
      tailEnabled: glow.tailEnabled !== false,
      antennaEnabled: glow.antennaEnabled !== false,
      intensity: clamp(glow.intensity, ...ranges.glowIntensity, fallback.glow.intensity),
      pulseSpeed: clamp(glow.pulseSpeed, ...ranges.pulseSpeed, fallback.glow.pulseSpeed),
    },
    symbols: {
      chestEnabled: symbols.chestEnabled !== false,
      chestText: normalizeText(symbols.chestText, derivePetMonogram(nameEn), 3).toUpperCase(),
      backEnabled: symbols.backEnabled !== false,
      backText: normalizeText(symbols.backText, 'YK', 3).toUpperCase(),
      symbolScale: clamp(symbols.symbolScale, ...ranges.symbolScale, fallback.symbols.symbolScale),
    },
  }
}

function randomItem<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!
}

function randomRange([minimum, maximum]: readonly [number, number], random: () => number) {
  return Number((minimum + (maximum - minimum) * random()).toFixed(2))
}

export function randomizeCloudFoxAppearance(current = createDefaultCloudFoxAppearance(), random: () => number = Math.random) {
  const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges
  const colors = ['#7066ff', '#52e0d0', '#75e6ff', '#ff78c8', '#ffd36a', '#8dff9d', '#ff8c72'] as const
  return normalizeCloudFoxAppearance({
    ...current,
    parts: {
      ears: randomItem(CLOUD_FOX_PART_OPTIONS.ears, random).id,
      eyes: randomItem(CLOUD_FOX_PART_OPTIONS.eyes, random).id,
      nose: randomItem(CLOUD_FOX_PART_OPTIONS.noses, random).id,
      mouth: randomItem(CLOUD_FOX_PART_OPTIONS.mouths, random).id,
      tail: randomItem(CLOUD_FOX_PART_OPTIONS.tails, random).id,
      antenna: randomItem(CLOUD_FOX_PART_OPTIONS.antennas, random).id,
    },
    proportions: {
      bodyScale: randomRange(ranges.bodyScale, random),
      headScale: randomRange(ranges.headScale, random),
      limbLength: randomRange(ranges.limbLength, random),
      limbSpacing: randomRange(ranges.limbSpacing, random),
      pawScale: randomRange(ranges.pawScale, random),
      earScale: randomRange(ranges.earScale, random),
      eyeScale: randomRange(ranges.eyeScale, random),
      eyeSpacing: randomRange(ranges.eyeSpacing, random),
      tailLength: randomRange(ranges.tailLength, random),
      tailWidth: randomRange(ranges.tailWidth, random),
      antennaScale: randomRange(ranges.antennaScale, random),
    },
    palette: {
      ...current.palette,
      innerEar: randomItem(colors, random),
      primaryGlow: randomItem(colors, random),
      secondaryGlow: randomItem(colors, random),
      tailGlow: randomItem(colors, random),
      antennaGlow: randomItem(colors, random),
      symbolGlow: randomItem(colors, random),
    },
  })
}
