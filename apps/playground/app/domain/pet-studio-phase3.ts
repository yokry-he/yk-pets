/** Phase 3: schema v2, independent symbols, derived colors and geometry audit. */
import {
  CLOUD_FOX_STUDIO_STORAGE_KEY,
  createPetStudioAppearance,
  normalizePetStudioAppearance,
  randomizePetStudioAppearance,
  type CloudFoxStudioBackground,
  type CloudFoxStudioBehavior,
  type CloudFoxStudioView,
  type PetStudioAppearanceRecipe as Phase2Recipe,
} from './pet-studio-phase2'

export { CLOUD_FOX_STUDIO_STORAGE_KEY }
export type { CloudFoxStudioBackground, CloudFoxStudioBehavior, CloudFoxStudioView }
export const PET_STUDIO_SCHEMA_VERSION = 2 as const
export const PET_STUDIO_STORAGE_KEY_V2 = 'yk-pets:studio:appearance:v2'

export interface SymbolChannelRecipe {
  enabled: boolean
  text: string
  color: string
  scale: number
  rotation: number
  glowIntensity: number
}

export interface PetStudioAppearanceRecipe extends Omit<Phase2Recipe, 'schemaVersion' | 'symbols' | 'palette'> {
  schemaVersion: typeof PET_STUDIO_SCHEMA_VERSION
  palette: Phase2Recipe['palette'] & {
    highlight: string
    shade: string
    halo: string
  }
  symbols: {
    chest: SymbolChannelRecipe
    back: SymbolChannelRecipe
  }
}

export type AuditSeverity = 'info' | 'warning' | 'error'
export interface AppearanceAuditFinding {
  id: string
  severity: AuditSeverity
  message: string
  path: string
}

const HEX = /^#[0-9a-f]{6}$/i
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 3).toUpperCase() : fallback
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback

function mixHex(input: string, target: string, amount: number) {
  const a = input.replace('#', '')
  const b = target.replace('#', '')
  const channel = (offset: number) => Math.round(
    Number.parseInt(a.slice(offset, offset + 2), 16) * (1 - amount)
      + Number.parseInt(b.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

export function deriveAppearanceColors(coat: string, glow: string) {
  const safeCoat = color(coat, '#eef1ff')
  const safeGlow = color(glow, '#7066ff')
  return {
    highlight: mixHex(safeCoat, '#ffffff', .34),
    shade: mixHex(safeCoat, '#090b18', .28),
    halo: mixHex(safeGlow, '#ffffff', .18),
  }
}

function migrateSymbol(input: unknown, fallback: SymbolChannelRecipe): SymbolChannelRecipe {
  const candidate = input && typeof input === 'object' ? input as Partial<SymbolChannelRecipe> : {}
  return {
    enabled: candidate.enabled !== false,
    text: text(candidate.text, fallback.text),
    color: color(candidate.color, fallback.color),
    scale: clamp(candidate.scale, .45, 1.8, fallback.scale),
    rotation: clamp(candidate.rotation, -Math.PI, Math.PI, fallback.rotation),
    glowIntensity: clamp(candidate.glowIntensity, 0, 4, fallback.glowIntensity),
  }
}

export function createPetStudioAppearanceV2(): PetStudioAppearanceRecipe {
  const base = createPetStudioAppearance()
  const derived = deriveAppearanceColors(base.palette.coat, base.palette.primaryGlow)
  return {
    ...base,
    schemaVersion: PET_STUDIO_SCHEMA_VERSION,
    palette: { ...base.palette, ...derived },
    symbols: {
      chest: { enabled: base.symbols.chestEnabled, text: base.symbols.chestText, color: base.palette.symbolGlow, scale: base.symbols.symbolScale, rotation: 0, glowIntensity: 1.8 },
      back: { enabled: base.symbols.backEnabled, text: base.symbols.backText, color: base.palette.symbolGlow, scale: base.symbols.symbolScale, rotation: 0, glowIntensity: 1.6 },
    },
  }
}

export function normalizePetStudioAppearanceV2(input: unknown): PetStudioAppearanceRecipe {
  const fallback = createPetStudioAppearanceV2()
  const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const base = normalizePetStudioAppearance(input)
  const legacySymbols = base.symbols
  const symbols = candidate.symbols && typeof candidate.symbols === 'object' ? candidate.symbols as Record<string, unknown> : {}
  const paletteCandidate = candidate.palette && typeof candidate.palette === 'object' ? candidate.palette as Record<string, unknown> : {}
  const derived = deriveAppearanceColors(base.palette.coat, base.palette.primaryGlow)
  const legacyChest: SymbolChannelRecipe = { enabled: legacySymbols.chestEnabled, text: legacySymbols.chestText, color: base.palette.symbolGlow, scale: legacySymbols.symbolScale, rotation: 0, glowIntensity: 1.8 }
  const legacyBack: SymbolChannelRecipe = { enabled: legacySymbols.backEnabled, text: legacySymbols.backText, color: base.palette.symbolGlow, scale: legacySymbols.symbolScale, rotation: 0, glowIntensity: 1.6 }
  return {
    ...base,
    schemaVersion: PET_STUDIO_SCHEMA_VERSION,
    palette: {
      ...base.palette,
      highlight: color(paletteCandidate.highlight, derived.highlight),
      shade: color(paletteCandidate.shade, derived.shade),
      halo: color(paletteCandidate.halo, derived.halo),
    },
    symbols: {
      chest: migrateSymbol(symbols.chest, legacyChest),
      back: migrateSymbol(symbols.back, legacyBack),
    },
  }
}

export function randomizePetStudioAppearanceV2(current = createPetStudioAppearanceV2(), random: () => number = Math.random) {
  const base = randomizePetStudioAppearance(current as unknown as Phase2Recipe, random)
  return normalizePetStudioAppearanceV2({
    ...base,
    symbols: current.symbols,
  })
}

export function auditPetStudioAppearance(recipe: PetStudioAppearanceRecipe): AppearanceAuditFinding[] {
  const findings: AppearanceAuditFinding[] = []
  const width = recipe.proportions.bodyWidth
  const height = recipe.proportions.bodyHeight
  const depth = recipe.proportions.bodyDepth
  if (width > 1.28 && recipe.proportions.limbSpacing < .94) findings.push({ id: 'limb-body-overlap', severity: 'warning', message: '身体较宽且四肢间距偏小，可能发生穿模。', path: 'proportions.limbSpacing' })
  if (recipe.proportions.headScale > 1.16 && height < .88) findings.push({ id: 'head-body-overlap', severity: 'warning', message: '头部较大且身体较矮，颈部区域可能重叠。', path: 'proportions.headScale' })
  if (recipe.antennaDesign.spacing < .24 && recipe.antennaDesign.thickness > .075) findings.push({ id: 'antenna-overlap', severity: 'warning', message: '触角间距过小，杆体可能互相穿插。', path: 'antennaDesign.spacing' })
  const tailLength = recipe.tailDesign.segments.reduce((sum, segment) => sum + segment.length, 0)
  if (tailLength > 4.6 || recipe.tailDesign.segments.length > 7) findings.push({ id: 'tail-bounds', severity: 'info', message: '长尾会扩大宠物包围盒，镜头将自动后移。', path: 'tailDesign.segments' })
  if (depth < .82 && recipe.symbols.chest.scale > 1.4) findings.push({ id: 'chest-float', severity: 'warning', message: '胸口标志过大，薄身体上可能产生悬浮感。', path: 'symbols.chest.scale' })
  if (!findings.length) findings.push({ id: 'geometry-ok', severity: 'info', message: '当前造型位于安全边界内，未发现明显穿模风险。', path: '' })
  return findings
}
