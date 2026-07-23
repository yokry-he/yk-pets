/**
 * 文件职责 / File responsibility
 * 将 Studio/导入配方完整归一化为扩展可渲染的身体、脸部、四肢、触角、尾巴、轨道和标志数据。
 * Normalizes Studio/import recipes into complete extension-renderable body, face, limb, antenna, tail, orbit, and symbol data.
 */
import { isRecord, type PetRecipeEnvelope, type PetRecord } from '@yk-pets/pet-core'
import { resolveExtensionCloudFoxAppearance, type ExtensionCloudFoxAppearance } from './appearance'

export interface StudioRecipeTailSegment {
  length: number
  width: number
  offsetX: number
  offsetY: number
  offsetZ: number
  rotationX: number
  rotationY: number
  rotationZ: number
}

export interface StudioRecipeCloudFoxAppearance extends ExtensionCloudFoxAppearance {
  parts: ExtensionCloudFoxAppearance['parts'] & {
    ears: string
    nose: string
    mouth: string
    antennaRod: string
    antennaTip: string
    tail: string
  }
  palette: ExtensionCloudFoxAppearance['palette'] & {
    innerEar: string
    highlight: string
    shade: string
    halo: string
  }
  earDesign: {
    outerColor: string
    innerColor: string
    tipColor: string
    innerGlowEnabled: boolean
    innerGlowColor: string
    innerGlowIntensity: number
  }
  antennaDesign: {
    spacing: number
    length: number
    thickness: number
    tilt: number
  }
  tailDesign: {
    rootOffsetX: number
    rootOffsetY: number
    rootOffsetZ: number
    rootExtensionLength: number
    rootExtensionWidth: number
    lateralOffset: number
    direction: 'left' | 'right' | 'up' | 'down' | 'back' | 'forward'
    tipGlow: { enabled: boolean; color: string; intensity: number; auraScale: number }
    segments: StudioRecipeTailSegment[]
  }
  frontPawDesign: {
    style: 'soft' | 'tapered' | 'mitten' | 'mechanical'
    rootHeight: number
    embedDepth: number
    forwardOffset: number
    outwardAngle: number
    forwardAngle: number
    shoulderScale: number
    wristScale: number
    palmScale: number
  }
  orbitDesign: {
    enabled: boolean
    ringCount: 1 | 2 | 3
    radius: number
    verticalScale: number
    tilt: number
    speed: number
    intensity: number
    particleCount: number
    primaryColor: string
    secondaryColor: string
  }
  glow: {
    mode: 'steady' | 'pulse' | 'emotion' | 'rainbow'
    intensity: number
    pulseSpeed: number
    tailEnabled: boolean
    antennaEnabled: boolean
  }
}

const defaultSegments: StudioRecipeTailSegment[] = [
  { length: .58, width: .27, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: .03, rotationY: .08, rotationZ: -.08 },
  { length: .58, width: .22, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .1 },
  { length: .52, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .16 },
]

function record(value: unknown): PetRecord {
  return isRecord(value) ? value : {}
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function number(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function mixHex(input: string, target: string, amount: number) {
  const a = input.replace('#', '')
  const b = target.replace('#', '')
  const channel = (offset: number) => Math.round(
    Number.parseInt(a.slice(offset, offset + 2), 16) * (1 - amount)
      + Number.parseInt(b.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

export function isStudioRecipeCloudFox(recipe?: PetRecipeEnvelope | null) {
  if (!recipe || recipe.speciesId !== 'cloud-fox') return false
  if (recipe.source === 'studio' || recipe.source === 'import') return true
  const appearance = record(recipe.appearance)
  const parts = record(appearance.parts)
  return isRecord(appearance.earDesign)
    || isRecord(appearance.tailDesign)
    || isRecord(appearance.antennaDesign)
    || isRecord(appearance.frontPawDesign)
    || typeof parts.ears === 'string'
    || typeof parts.nose === 'string'
    || typeof parts.mouth === 'string'
}

export function resolveStudioRecipeCloudFoxAppearance(recipe?: PetRecipeEnvelope | null): StudioRecipeCloudFoxAppearance {
  const base = resolveExtensionCloudFoxAppearance(recipe)
  const appearance = record(recipe?.appearance)
  const parts = record(appearance.parts)
  const palette = record(appearance.palette)
  const ear = record(appearance.earDesign)
  const antenna = record(appearance.antennaDesign)
  const tail = record(appearance.tailDesign)
  const tipGlow = record(tail.tipGlow)
  const paw = record(appearance.frontPawDesign)
  const orbit = record(appearance.orbitDesign)
  const glow = record(appearance.glow)
  const coat = color(palette.coat, base.palette.coat)
  const primaryGlow = color(palette.primaryGlow, base.palette.primaryGlow)
  const directions: StudioRecipeCloudFoxAppearance['tailDesign']['direction'][] = ['left', 'right', 'up', 'down', 'back', 'forward']
  const pawStyles: StudioRecipeCloudFoxAppearance['frontPawDesign']['style'][] = ['soft', 'tapered', 'mitten', 'mechanical']
  const glowModes: StudioRecipeCloudFoxAppearance['glow']['mode'][] = ['steady', 'pulse', 'emotion', 'rainbow']
  const sourceSegments = Array.isArray(tail.segments) && tail.segments.length ? tail.segments : defaultSegments
  const segments = sourceSegments.slice(0, 8).map((input, index) => {
    const segment = record(input)
    const fallback = defaultSegments[index] || defaultSegments.at(-1)!
    return {
      length: number(segment.length, fallback.length, .18, .9),
      width: number(segment.width, fallback.width, .08, .42),
      offsetX: number(segment.offsetX, fallback.offsetX, -.6, .6),
      offsetY: number(segment.offsetY, fallback.offsetY, -.6, .6),
      offsetZ: number(segment.offsetZ, fallback.offsetZ, -.6, .6),
      rotationX: number(segment.rotationX, fallback.rotationX, -Math.PI, Math.PI),
      rotationY: number(segment.rotationY, fallback.rotationY, -Math.PI, Math.PI),
      rotationZ: number(segment.rotationZ, fallback.rotationZ, -Math.PI, Math.PI),
    }
  })
  while (segments.length < 3) segments.push({ ...defaultSegments[segments.length]! })

  return {
    ...base,
    parts: {
      ...base.parts,
      ears: text(parts.ears, 'pointed'),
      nose: text(parts.nose, 'button'),
      mouth: text(parts.mouth, 'open'),
      antennaRod: text(parts.antennaRod, 'straight'),
      antennaTip: text(parts.antennaTip, 'orb'),
      tail: text(parts.tail, 'solid'),
    },
    palette: {
      ...base.palette,
      coat,
      coatShadow: color(palette.coatShadow, base.palette.coatShadow),
      coatWarm: color(palette.coatWarm, base.palette.coatWarm),
      innerEar: color(palette.innerEar, primaryGlow),
      highlight: color(palette.highlight, mixHex(coat, '#ffffff', .34)),
      shade: color(palette.shade, mixHex(coat, '#090b18', .28)),
      halo: color(palette.halo, mixHex(primaryGlow, '#ffffff', .18)),
    },
    earDesign: {
      outerColor: color(ear.outerColor, coat),
      innerColor: color(ear.innerColor, color(palette.innerEar, primaryGlow)),
      tipColor: color(ear.tipColor, base.palette.coatWarm),
      innerGlowEnabled: bool(ear.innerGlowEnabled, true),
      innerGlowColor: color(ear.innerGlowColor, primaryGlow),
      innerGlowIntensity: number(ear.innerGlowIntensity, .25, 0, 4),
    },
    antennaDesign: {
      spacing: number(antenna.spacing, .44, .18, .82),
      length: number(antenna.length, .62, .24, 1.2),
      thickness: number(antenna.thickness, .04, .018, .1),
      tilt: number(antenna.tilt, .2, -.72, .72),
    },
    tailDesign: {
      rootOffsetX: number(tail.rootOffsetX, 0, -.8, .8),
      rootOffsetY: number(tail.rootOffsetY, 0, -.8, .8),
      rootOffsetZ: number(tail.rootOffsetZ, 0, -.8, .8),
      rootExtensionLength: number(tail.rootExtensionLength, .38, .12, .9),
      rootExtensionWidth: number(tail.rootExtensionWidth, .24, .08, .42),
      lateralOffset: number(tail.lateralOffset, -.58, -1.2, 1.2),
      direction: directions.includes(tail.direction as StudioRecipeCloudFoxAppearance['tailDesign']['direction'])
        ? tail.direction as StudioRecipeCloudFoxAppearance['tailDesign']['direction']
        : 'left',
      tipGlow: {
        enabled: bool(tipGlow.enabled, true),
        color: color(tipGlow.color, base.palette.tailGlow),
        intensity: number(tipGlow.intensity, 1.65, 0, 5),
        auraScale: number(tipGlow.auraScale, 1.55, .5, 3),
      },
      segments,
    },
    frontPawDesign: {
      style: pawStyles.includes(paw.style as StudioRecipeCloudFoxAppearance['frontPawDesign']['style'])
        ? paw.style as StudioRecipeCloudFoxAppearance['frontPawDesign']['style']
        : 'soft',
      rootHeight: number(paw.rootHeight, 0, -.24, .24),
      embedDepth: number(paw.embedDepth, .1, .06, .24),
      forwardOffset: number(paw.forwardOffset, .04, -.08, .16),
      outwardAngle: number(paw.outwardAngle, .06, -.12, .48),
      forwardAngle: number(paw.forwardAngle, 0, -.42, .42),
      shoulderScale: number(paw.shoulderScale, 1, .86, 1.42),
      wristScale: number(paw.wristScale, 1, .68, 1.3),
      palmScale: number(paw.palmScale, 1, .72, 1.55),
    },
    orbitDesign: {
      enabled: bool(orbit.enabled, false),
      ringCount: [1, 2, 3].includes(orbit.ringCount as number) ? orbit.ringCount as 1 | 2 | 3 : 2,
      radius: number(orbit.radius, 1.36, 1.02, 1.9),
      verticalScale: number(orbit.verticalScale, .82, .58, 1.15),
      tilt: number(orbit.tilt, .52, -1.2, 1.2),
      speed: number(orbit.speed, .34, .05, 1.5),
      intensity: number(orbit.intensity, 1.15, .15, 3.2),
      particleCount: Math.round(number(orbit.particleCount, 0, 0, 24)),
      primaryColor: color(orbit.primaryColor, primaryGlow),
      secondaryColor: color(orbit.secondaryColor, base.palette.secondaryGlow),
    },
    glow: {
      mode: glowModes.includes(glow.mode as StudioRecipeCloudFoxAppearance['glow']['mode'])
        ? glow.mode as StudioRecipeCloudFoxAppearance['glow']['mode']
        : 'pulse',
      intensity: number(glow.intensity, 1.4, 0, 4),
      pulseSpeed: number(glow.pulseSpeed, 1, .1, 4),
      tailEnabled: bool(glow.tailEnabled, true),
      antennaEnabled: bool(glow.antennaEnabled, true),
    },
  }
}
