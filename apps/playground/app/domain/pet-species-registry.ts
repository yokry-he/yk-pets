/** Phase 6+9: species registry, Moon Cat implementation, style mapping, motion fallback, and continuous front-paw design. */
import {
  PET_STYLE_RULES,
  applyAppearanceScope,
  createPetStudioAppearanceV2,
  normalizePetStudioAppearanceV2,
  randomizeWithLocks,
  type AppearanceApplyScope,
  type AppearanceAuditFinding,
  type AppearanceLocks,
  type PetStyleId,
  type PetStudioAppearanceRecipe,
} from './pet-studio-phase4'
import type { CloudFoxStudioBehavior } from './pet-studio-phase4'

export type PetSpeciesId = 'cloud-fox' | 'moon-cat' | 'nebula-slime' | 'star-rabbit'
export type SpeciesStatus = 'active' | 'planned'
export interface PetSpeciesDefinition {
  id: PetSpeciesId
  label: string
  labelEn: string
  status: SpeciesStatus
  slots: readonly string[]
  supportedBehaviors: readonly CloudFoxStudioBehavior[]
  fallbackBehavior: CloudFoxStudioBehavior
  defaultStyle: PetStyleId
}

export const PET_SPECIES_REGISTRY: Readonly<Record<PetSpeciesId, PetSpeciesDefinition>> = {
  'cloud-fox': { id: 'cloud-fox', label: '云狐', labelEn: 'Cloud Fox', status: 'active', slots: ['ears','eyes','nose','mouth','antenna','front-paws','tail','chest-symbol','back-symbol'], supportedBehaviors: ['idle','greeting','jumping','stretching','spinning','resting'], fallbackBehavior: 'idle', defaultStyle: 'nebula' },
  'moon-cat': { id: 'moon-cat', label: '月猫', labelEn: 'Moon Cat', status: 'active', slots: ['ears','eyes','nose','mouth','whiskers','forehead-mark','tail','chest-symbol'], supportedBehaviors: ['idle','greeting','jumping','stretching','resting'], fallbackBehavior: 'greeting', defaultStyle: 'cute' },
  'nebula-slime': { id: 'nebula-slime', label: '星云史莱姆', labelEn: 'Nebula Slime', status: 'planned', slots: ['core','eyes','surface-pattern'], supportedBehaviors: ['idle'], fallbackBehavior: 'idle', defaultStyle: 'nebula' },
  'star-rabbit': { id: 'star-rabbit', label: '星兔', labelEn: 'Star Rabbit', status: 'planned', slots: ['ears','eyes','nose','tail','forehead-mark'], supportedBehaviors: ['idle'], fallbackBehavior: 'idle', defaultStyle: 'crystal' },
}

export interface SpeciesSpecificParts {
  whiskers: { enabled: boolean; length: number; spread: number; color: string }
  foreheadMark: { enabled: boolean; style: 'crescent' | 'star' | 'crystal'; color: string; glowIntensity: number }
  moonTailCurl: number
}

export const FRONT_PAW_STYLES = [
  { id: 'soft', label: '软胶囊爪', labelEn: 'Soft Capsule' },
  { id: 'tapered', label: '渐细短爪', labelEn: 'Tapered Paw' },
  { id: 'mitten', label: '糯米手套爪', labelEn: 'Mochi Mitten' },
  { id: 'mechanical', label: '机械关节爪', labelEn: 'Mechanical Joint' },
] as const
export type FrontPawStyle = typeof FRONT_PAW_STYLES[number]['id']
export interface FrontPawDesignRecipe {
  style: FrontPawStyle
  rootHeight: number
  embedDepth: number
  forwardOffset: number
  outwardAngle: number
  forwardAngle: number
  shoulderScale: number
  wristScale: number
  palmScale: number
}
export const FRONT_PAW_DESIGN_RANGES = Object.freeze({
  rootHeight: [-.24, .24] as const,
  embedDepth: [.06, .24] as const,
  forwardOffset: [-.08, .16] as const,
  outwardAngle: [-.12, .48] as const,
  forwardAngle: [-.42, .42] as const,
  shoulderScale: [.86, 1.42] as const,
  wristScale: [.68, 1.3] as const,
  palmScale: [.72, 1.55] as const,
})

export interface MultiSpeciesAppearanceRecipe extends Omit<PetStudioAppearanceRecipe, 'speciesId'> {
  speciesId: PetSpeciesId
  speciesParts: SpeciesSpecificParts
  frontPawDesign: FrontPawDesignRecipe
}

export function defaultSpeciesParts(): SpeciesSpecificParts {
  return { whiskers: { enabled: true, length: .58, spread: .24, color: '#a9b8d8' }, foreheadMark: { enabled: true, style: 'crescent', color: '#8fdcff', glowIntensity: 1.8 }, moonTailCurl: .72 }
}

export function defaultFrontPawDesign(): FrontPawDesignRecipe {
  return { style: 'soft', rootHeight: 0, embedDepth: .1, forwardOffset: .04, outwardAngle: .06, forwardAngle: 0, shoulderScale: 1, wristScale: 1, palmScale: 1 }
}

export function createMultiSpeciesAppearance(speciesId: PetSpeciesId = 'cloud-fox'): MultiSpeciesAppearanceRecipe {
  const base = createPetStudioAppearanceV2()
  return { ...base, speciesId, speciesParts: defaultSpeciesParts(), frontPawDesign: defaultFrontPawDesign() }
}

export function normalizeMultiSpeciesAppearance(input: unknown): MultiSpeciesAppearanceRecipe {
  const candidate = input && typeof input === 'object' ? input as Partial<MultiSpeciesAppearanceRecipe> : {}
  const validIds = Object.keys(PET_SPECIES_REGISTRY) as PetSpeciesId[]
  const speciesId = validIds.includes(candidate.speciesId as PetSpeciesId) ? candidate.speciesId as PetSpeciesId : 'cloud-fox'
  const base = normalizePetStudioAppearanceV2({ ...(candidate as object), speciesId: 'cloud-fox' })
  const fallback = defaultSpeciesParts()
  const parts = candidate.speciesParts || fallback
  const pawFallback = defaultFrontPawDesign()
  const paw = candidate.frontPawDesign || pawFallback
  const number = (value: unknown, min: number, max: number, fallbackValue: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallbackValue
  const color = (value: unknown, fallbackValue: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallbackValue
  const markStyles: SpeciesSpecificParts['foreheadMark']['style'][] = ['crescent','star','crystal']
  const pawStyles = FRONT_PAW_STYLES.map(item => item.id)
  return {
    ...base,
    speciesId,
    speciesParts: {
      whiskers: { enabled: parts.whiskers?.enabled !== false, length: number(parts.whiskers?.length, .2, 1.1, fallback.whiskers.length), spread: number(parts.whiskers?.spread, .08, .55, fallback.whiskers.spread), color: color(parts.whiskers?.color, fallback.whiskers.color) },
      foreheadMark: { enabled: parts.foreheadMark?.enabled !== false, style: markStyles.includes(parts.foreheadMark?.style) ? parts.foreheadMark.style : fallback.foreheadMark.style, color: color(parts.foreheadMark?.color, fallback.foreheadMark.color), glowIntensity: number(parts.foreheadMark?.glowIntensity, 0, 4, fallback.foreheadMark.glowIntensity) },
      moonTailCurl: number(parts.moonTailCurl, .2, 1.4, fallback.moonTailCurl),
    },
    frontPawDesign: {
      style: pawStyles.includes(paw.style as FrontPawStyle) ? paw.style as FrontPawStyle : pawFallback.style,
      rootHeight: number(paw.rootHeight, ...FRONT_PAW_DESIGN_RANGES.rootHeight, pawFallback.rootHeight),
      embedDepth: number(paw.embedDepth, ...FRONT_PAW_DESIGN_RANGES.embedDepth, pawFallback.embedDepth),
      forwardOffset: number(paw.forwardOffset, ...FRONT_PAW_DESIGN_RANGES.forwardOffset, pawFallback.forwardOffset),
      outwardAngle: number(paw.outwardAngle, ...FRONT_PAW_DESIGN_RANGES.outwardAngle, pawFallback.outwardAngle),
      forwardAngle: number(paw.forwardAngle, ...FRONT_PAW_DESIGN_RANGES.forwardAngle, pawFallback.forwardAngle),
      shoulderScale: number(paw.shoulderScale, ...FRONT_PAW_DESIGN_RANGES.shoulderScale, pawFallback.shoulderScale),
      wristScale: number(paw.wristScale, ...FRONT_PAW_DESIGN_RANGES.wristScale, pawFallback.wristScale),
      palmScale: number(paw.palmScale, ...FRONT_PAW_DESIGN_RANGES.palmScale, pawFallback.palmScale),
    },
  }
}

export function auditFrontPawDesign(recipe: FrontPawDesignRecipe): AppearanceAuditFinding[] {
  const findings: AppearanceAuditFinding[] = []
  if (recipe.forwardOffset - recipe.embedDepth > .035) findings.push({ id: 'front-paw-root-safety-limit', severity: 'info', message: '前爪前移较多且埋入深度偏小，防截断安全限位将自动保持肩部与身体重叠。', path: 'frontPawDesign.embedDepth' })
  if (Math.abs(recipe.rootHeight) > .2) findings.push({ id: 'front-paw-root-height', severity: 'info', message: '前爪根部接近身体收窄区域，建议同时查看正面和侧面轮廓。', path: 'frontPawDesign.rootHeight' })
  if (recipe.shoulderScale < .94 && recipe.wristScale > 1.16) findings.push({ id: 'front-paw-shoulder-balance', severity: 'warning', message: '肩部过小而手腕较粗，连接处虽然不会截断，但轮廓可能显得突兀。', path: 'frontPawDesign.shoulderScale' })
  return findings
}

export function switchPetSpecies(current: MultiSpeciesAppearanceRecipe, speciesId: PetSpeciesId) {
  const next = normalizeMultiSpeciesAppearance({ ...current, speciesId })
  if (speciesId === 'moon-cat') {
    next.parts.antenna = 'none'; next.parts.ears = 'rounded'; next.parts.eyes = 'oval'; next.parts.nose = 'button'; next.parts.mouth = 'cat'; next.parts.tail = 'plume'
    next.identity.nameZh = current.identity.nameZh === '云灵' ? '月璃' : current.identity.nameZh
    next.identity.nameEn = current.identity.nameEn === 'Zeph' ? 'Luna' : current.identity.nameEn
  }
  return next
}

export function resolveSpeciesBehavior(speciesId: PetSpeciesId, requested: CloudFoxStudioBehavior) {
  const definition = PET_SPECIES_REGISTRY[speciesId]
  return definition.supportedBehaviors.includes(requested) ? requested : definition.fallbackBehavior
}

export function applyStyleAcrossSpecies(current: MultiSpeciesAppearanceRecipe, style: PetStyleId, scope: AppearanceApplyScope) {
  const cloudRecipe = normalizePetStudioAppearanceV2({ ...current, speciesId: 'cloud-fox' })
  const styled = applyAppearanceScope(cloudRecipe, PET_STYLE_RULES[style](cloudRecipe), scope)
  const next = normalizeMultiSpeciesAppearance({ ...current, ...styled, speciesId: current.speciesId, speciesParts: current.speciesParts, frontPawDesign: current.frontPawDesign })
  if (scope === 'all' || scope === 'shape') {
    const pawStyle: Record<PetStyleId, FrontPawStyle> = { cute: 'mitten', mechanical: 'mechanical', nebula: 'soft', crystal: 'tapered' }
    next.frontPawDesign.style = pawStyle[style]
    if (style === 'cute') { next.frontPawDesign.palmScale = 1.2; next.frontPawDesign.outwardAngle = .1 }
    if (style === 'mechanical') { next.frontPawDesign.shoulderScale = 1.12; next.frontPawDesign.wristScale = .86 }
    if (style === 'crystal') { next.frontPawDesign.palmScale = .92; next.frontPawDesign.forwardAngle = -.08 }
  }
  if (current.speciesId === 'moon-cat') {
    if (style === 'cute') { next.parts.ears = 'rounded'; next.parts.eyes = 'sleepy'; next.speciesParts.whiskers.length = .48; next.speciesParts.foreheadMark.style = 'crescent' }
    if (style === 'mechanical') { next.parts.ears = 'mechanical'; next.parts.eyes = 'visor'; next.speciesParts.whiskers.enabled = false; next.speciesParts.foreheadMark.style = 'crystal' }
    if (style === 'nebula') { next.parts.eyes = 'spark'; next.speciesParts.whiskers.color = '#a88cff'; next.speciesParts.foreheadMark.style = 'star' }
    if (style === 'crystal') { next.parts.eyes = 'diamond'; next.speciesParts.foreheadMark.style = 'crystal'; next.speciesParts.foreheadMark.glowIntensity = 2.4 }
  }
  return next
}

export function randomizeMultiSpeciesAppearance(current: MultiSpeciesAppearanceRecipe, locks: AppearanceLocks, random: () => number = Math.random) {
  const cloudRecipe = normalizePetStudioAppearanceV2({ ...current, speciesId: 'cloud-fox' })
  const randomized = randomizeWithLocks(cloudRecipe, locks, random)
  const pawStyles = FRONT_PAW_STYLES.map(item => item.id)
  const frontPawDesign = locks.shape ? current.frontPawDesign : {
    ...current.frontPawDesign,
    style: pawStyles[Math.min(pawStyles.length - 1, Math.floor(random() * pawStyles.length))]!,
    rootHeight: Number((-.08 + random() * .16).toFixed(2)),
    embedDepth: Number((.08 + random() * .08).toFixed(2)),
    forwardOffset: Number((-.01 + random() * .08).toFixed(2)),
    outwardAngle: Number((.02 + random() * .24).toFixed(2)),
    forwardAngle: Number((-.18 + random() * .36).toFixed(2)),
    shoulderScale: Number((.92 + random() * .28).toFixed(2)),
    wristScale: Number((.82 + random() * .28).toFixed(2)),
    palmScale: Number((.86 + random() * .36).toFixed(2)),
  }
  return normalizeMultiSpeciesAppearance({ ...current, ...randomized, speciesId: current.speciesId, speciesParts: locks.shape ? current.speciesParts : { ...current.speciesParts, moonTailCurl: Number((.35 + random() * .85).toFixed(2)) }, frontPawDesign })
}
