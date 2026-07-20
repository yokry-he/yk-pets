/** Phase 6: species registry, Moon Cat implementation, style mapping and motion fallback. */
import {
  PET_STYLE_RULES,
  applyAppearanceScope,
  createPetStudioAppearanceV2,
  normalizePetStudioAppearanceV2,
  randomizeWithLocks,
  type AppearanceApplyScope,
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
  'cloud-fox': { id: 'cloud-fox', label: '云狐', labelEn: 'Cloud Fox', status: 'active', slots: ['ears','eyes','nose','mouth','antenna','tail','chest-symbol','back-symbol'], supportedBehaviors: ['idle','greeting','jumping','stretching','spinning','resting'], fallbackBehavior: 'idle', defaultStyle: 'nebula' },
  'moon-cat': { id: 'moon-cat', label: '月猫', labelEn: 'Moon Cat', status: 'active', slots: ['ears','eyes','nose','mouth','whiskers','forehead-mark','tail','chest-symbol'], supportedBehaviors: ['idle','greeting','jumping','stretching','resting'], fallbackBehavior: 'greeting', defaultStyle: 'cute' },
  'nebula-slime': { id: 'nebula-slime', label: '星云史莱姆', labelEn: 'Nebula Slime', status: 'planned', slots: ['core','eyes','surface-pattern'], supportedBehaviors: ['idle'], fallbackBehavior: 'idle', defaultStyle: 'nebula' },
  'star-rabbit': { id: 'star-rabbit', label: '星兔', labelEn: 'Star Rabbit', status: 'planned', slots: ['ears','eyes','nose','tail','forehead-mark'], supportedBehaviors: ['idle'], fallbackBehavior: 'idle', defaultStyle: 'crystal' },
}

export interface SpeciesSpecificParts {
  whiskers: { enabled: boolean; length: number; spread: number; color: string }
  foreheadMark: { enabled: boolean; style: 'crescent' | 'star' | 'crystal'; color: string; glowIntensity: number }
  moonTailCurl: number
}

export interface MultiSpeciesAppearanceRecipe extends Omit<PetStudioAppearanceRecipe, 'speciesId'> {
  speciesId: PetSpeciesId
  speciesParts: SpeciesSpecificParts
}

export function defaultSpeciesParts(): SpeciesSpecificParts {
  return { whiskers: { enabled: true, length: .58, spread: .24, color: '#a9b8d8' }, foreheadMark: { enabled: true, style: 'crescent', color: '#8fdcff', glowIntensity: 1.8 }, moonTailCurl: .72 }
}

export function createMultiSpeciesAppearance(speciesId: PetSpeciesId = 'cloud-fox'): MultiSpeciesAppearanceRecipe {
  const base = createPetStudioAppearanceV2()
  return { ...base, speciesId, speciesParts: defaultSpeciesParts() }
}

export function normalizeMultiSpeciesAppearance(input: unknown): MultiSpeciesAppearanceRecipe {
  const candidate = input && typeof input === 'object' ? input as Partial<MultiSpeciesAppearanceRecipe> : {}
  const validIds = Object.keys(PET_SPECIES_REGISTRY) as PetSpeciesId[]
  const speciesId = validIds.includes(candidate.speciesId as PetSpeciesId) ? candidate.speciesId as PetSpeciesId : 'cloud-fox'
  const base = normalizePetStudioAppearanceV2({ ...(candidate as object), speciesId: 'cloud-fox' })
  const fallback = defaultSpeciesParts()
  const parts = candidate.speciesParts || fallback
  const number = (value: unknown, min: number, max: number, fallbackValue: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallbackValue
  const color = (value: unknown, fallbackValue: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallbackValue
  const markStyles: SpeciesSpecificParts['foreheadMark']['style'][] = ['crescent','star','crystal']
  return {
    ...base,
    speciesId,
    speciesParts: {
      whiskers: { enabled: parts.whiskers?.enabled !== false, length: number(parts.whiskers?.length, .2, 1.1, fallback.whiskers.length), spread: number(parts.whiskers?.spread, .08, .55, fallback.whiskers.spread), color: color(parts.whiskers?.color, fallback.whiskers.color) },
      foreheadMark: { enabled: parts.foreheadMark?.enabled !== false, style: markStyles.includes(parts.foreheadMark?.style) ? parts.foreheadMark.style : fallback.foreheadMark.style, color: color(parts.foreheadMark?.color, fallback.foreheadMark.color), glowIntensity: number(parts.foreheadMark?.glowIntensity, 0, 4, fallback.foreheadMark.glowIntensity) },
      moonTailCurl: number(parts.moonTailCurl, .2, 1.4, fallback.moonTailCurl),
    },
  }
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
  const next = normalizeMultiSpeciesAppearance({ ...current, ...styled, speciesId: current.speciesId, speciesParts: current.speciesParts })
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
  return normalizeMultiSpeciesAppearance({ ...current, ...randomized, speciesId: current.speciesId, speciesParts: locks.shape ? current.speciesParts : { ...current.speciesParts, moonTailCurl: Number((.35 + random() * .85).toFixed(2)) } })
}
