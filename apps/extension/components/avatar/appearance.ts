/**
 * 文件职责 / File responsibility
 * 将 pet-core 的通用配方信封映射为扩展 CloudFox 可直接消费的安全视觉数据。
 * Maps generic pet-core recipe envelopes into safe visual data consumed directly by the extension CloudFox.
 */
import { isRecord, type PetRecipeEnvelope, type PetRecord } from '@yk-pets/pet-core'

export type ExtensionBellyPatchStyle = 'oval' | 'shield' | 'bean' | 'teardrop' | 'heart'
export type ExtensionChestDisplayMode = 'none' | 'energy-core' | 'symbol' | 'hybrid'

export interface ExtensionSymbolAppearance {
  enabled: boolean
  text: string
  color: string
  scale: number
  rotation: number
  glowIntensity: number
  offsetX: number
  offsetY: number
  offsetZ: number
}

export interface ExtensionCloudFoxAppearance {
  parts: {
    bodyShape: string
    eyes: string
    antenna: string
  }
  palette: {
    coat: string
    coatShadow: string
    coatWarm: string
    eye: string
    primaryGlow: string
    secondaryGlow: string
    tailGlow: string
    antennaGlow: string
  }
  proportions: {
    bodyWidth: number
    bodyHeight: number
    bodyDepth: number
    headScale: number
    limbLength: number
    limbThickness: number
    limbSpacing: number
    pawScale: number
    earScale: number
    eyeScale: number
    eyeSpacing: number
    tailLength: number
    tailWidth: number
    antennaScale: number
  }
  bellyPatchDesign: {
    visible: boolean
    style: ExtensionBellyPatchStyle
    width: number
    height: number
    offsetY: number
  }
  chestDisplay: { mode: ExtensionChestDisplayMode }
  symbols: {
    chest: ExtensionSymbolAppearance
    back: ExtensionSymbolAppearance
  }
}

const defaults: ExtensionCloudFoxAppearance = {
  parts: { bodyShape: 'ellipsoid', eyes: 'round', antenna: 'twin' },
  palette: {
    coat: '#e9ecff', coatShadow: '#aeb6e8', coatWarm: '#f9fbff', eye: '#141629',
    primaryGlow: '#7066ff', secondaryGlow: '#52e0d0', tailGlow: '#caffff', antennaGlow: '#52e0d0',
  },
  proportions: {
    bodyWidth: 1, bodyHeight: 1, bodyDepth: 1, headScale: 1, limbLength: 1, limbThickness: 1,
    limbSpacing: 1, pawScale: 1, earScale: 1, eyeScale: 1, eyeSpacing: 1, tailLength: 1, tailWidth: 1, antennaScale: 1,
  },
  bellyPatchDesign: { visible: true, style: 'shield', width: 1, height: 1, offsetY: 0 },
  chestDisplay: { mode: 'energy-core' },
  symbols: {
    chest: { enabled: false, text: 'Z', color: '#52e0d0', scale: 1, rotation: 0, glowIntensity: 1.8, offsetX: 0, offsetY: 0, offsetZ: 0 },
    back: { enabled: false, text: 'YK', color: '#7066ff', scale: 1, rotation: 0, glowIntensity: 1.6, offsetX: 0, offsetY: .18, offsetZ: .02 },
  },
}

function record(value: unknown): PetRecord {
  return isRecord(value) ? value : {}
}

function number(value: unknown, fallback: number, minimum = .2, maximum = 3) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
}

function offset(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(.6, Math.max(-.6, value)) : fallback
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 3).toUpperCase() : fallback
}

function symbol(input: unknown, fallback: ExtensionSymbolAppearance): ExtensionSymbolAppearance {
  const value = record(input)
  return {
    enabled: value.enabled !== false,
    text: text(value.text, fallback.text),
    color: color(value.color, fallback.color),
    scale: number(value.scale, fallback.scale, .35, 2.2),
    rotation: number(value.rotation, fallback.rotation, -Math.PI, Math.PI),
    glowIntensity: number(value.glowIntensity, fallback.glowIntensity, 0, 4),
    offsetX: offset(value.offsetX, fallback.offsetX),
    offsetY: offset(value.offsetY, fallback.offsetY),
    offsetZ: offset(value.offsetZ, fallback.offsetZ),
  }
}

export function resolveExtensionCloudFoxAppearance(recipe?: PetRecipeEnvelope | null): ExtensionCloudFoxAppearance {
  const appearance = record(recipe?.appearance)
  const parts = record(appearance.parts)
  const palette = record(appearance.palette)
  const proportions = record(appearance.proportions)
  const belly = record(appearance.bellyPatchDesign)
  const chestDisplay = record(appearance.chestDisplay)
  const symbols = record(appearance.symbols)
  const bellyStyles: ExtensionBellyPatchStyle[] = ['oval', 'shield', 'bean', 'teardrop', 'heart']
  const chestModes: ExtensionChestDisplayMode[] = ['none', 'energy-core', 'symbol', 'hybrid']
  return {
    parts: {
      bodyShape: typeof parts.bodyShape === 'string' ? parts.bodyShape : defaults.parts.bodyShape,
      eyes: typeof parts.eyes === 'string' ? parts.eyes : defaults.parts.eyes,
      antenna: typeof parts.antenna === 'string' ? parts.antenna : defaults.parts.antenna,
    },
    palette: {
      coat: color(palette.coat, defaults.palette.coat),
      coatShadow: color(palette.coatShadow, defaults.palette.coatShadow),
      coatWarm: color(palette.coatWarm, defaults.palette.coatWarm),
      eye: color(palette.eye, defaults.palette.eye),
      primaryGlow: color(palette.primaryGlow, defaults.palette.primaryGlow),
      secondaryGlow: color(palette.secondaryGlow, defaults.palette.secondaryGlow),
      tailGlow: color(palette.tailGlow, defaults.palette.tailGlow),
      antennaGlow: color(palette.antennaGlow, defaults.palette.antennaGlow),
    },
    proportions: {
      bodyWidth: number(proportions.bodyWidth, 1, .65, 1.4),
      bodyHeight: number(proportions.bodyHeight, 1, .65, 1.4),
      bodyDepth: number(proportions.bodyDepth, 1, .65, 1.4),
      headScale: number(proportions.headScale, 1, .7, 1.35),
      limbLength: number(proportions.limbLength, 1, .55, 1.25),
      limbThickness: number(proportions.limbThickness, 1, .65, 1.45),
      limbSpacing: number(proportions.limbSpacing, 1, .7, 1.35),
      pawScale: number(proportions.pawScale, 1, .65, 1.5),
      earScale: number(proportions.earScale, 1, .65, 1.45),
      eyeScale: number(proportions.eyeScale, 1, .65, 1.5),
      eyeSpacing: number(proportions.eyeSpacing, 1, .7, 1.4),
      tailLength: number(proportions.tailLength, 1, .65, 1.5),
      tailWidth: number(proportions.tailWidth, 1, .65, 1.5),
      antennaScale: number(proportions.antennaScale, 1, .65, 1.5),
    },
    bellyPatchDesign: {
      visible: belly.visible !== false,
      style: bellyStyles.includes(belly.style as ExtensionBellyPatchStyle) ? belly.style as ExtensionBellyPatchStyle : 'shield',
      width: number(belly.width, 1, .65, 1.3),
      height: number(belly.height, 1, .65, 1.25),
      offsetY: offset(belly.offsetY, 0),
    },
    chestDisplay: {
      mode: chestModes.includes(chestDisplay.mode as ExtensionChestDisplayMode)
        ? chestDisplay.mode as ExtensionChestDisplayMode
        : record(symbols.chest).enabled === true ? 'symbol' : 'energy-core',
    },
    symbols: {
      chest: symbol(symbols.chest, defaults.symbols.chest),
      back: symbol(symbols.back, defaults.symbols.back),
    },
  }
}
