/*
 * 文件职责 / File responsibility
 * 定义同一宠物的简单/复杂模型容器，并提供不依赖 UI 或存储的安全归一化与复杂草稿创建规则。
 * Defines one pet's simple/complex model container with UI- and storage-independent normalization and draft creation rules.
 */
export type StudioModelMode = 'simple' | 'complex'
export type StudioModelVariantStatus = 'missing' | 'draft' | 'ready' | 'blocked'
export type ComplexModelCapability = 'renderer' | 'skeleton' | 'skin' | 'rig-mapping'

export interface StudioPetModelVariantsV1 {
  schemaVersion: 1
  petId: string
  simple: {
    kind: 'procedural'
    status: 'ready'
    updatedAt: number
  }
  complex: {
    kind: 'skinned'
    status: StudioModelVariantStatus
    completion: number
    pendingCapabilities: ComplexModelCapability[]
    createdAt?: number
    updatedAt: number
  }
}

const COMPLEX_CAPABILITIES: readonly ComplexModelCapability[] = ['renderer', 'skeleton', 'skin', 'rig-mapping']
const COMPLEX_STATUSES: readonly StudioModelVariantStatus[] = ['missing', 'draft', 'ready', 'blocked']

function record(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

function timestamp(input: unknown, fallback: number) {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : fallback
}

function petId(input: unknown, fallback: string) {
  const value = typeof input === 'string' ? input.trim() : ''
  return value || fallback.trim() || 'active-appearance'
}

function completion(input: unknown) {
  const value = typeof input === 'number' && Number.isFinite(input) ? input : 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function capabilities(input: unknown) {
  if (!Array.isArray(input)) return [...COMPLEX_CAPABILITIES]
  const requested = new Set(input.filter((item): item is ComplexModelCapability => COMPLEX_CAPABILITIES.includes(item as ComplexModelCapability)))
  return COMPLEX_CAPABILITIES.filter(item => requested.has(item))
}

export function createStudioPetModelVariants(requestedPetId: string, now = Date.now()): StudioPetModelVariantsV1 {
  const safeNow = timestamp(now, Date.now())
  return {
    schemaVersion: 1,
    petId: petId(requestedPetId, 'active-appearance'),
    simple: { kind: 'procedural', status: 'ready', updatedAt: safeNow },
    complex: {
      kind: 'skinned',
      status: 'missing',
      completion: 0,
      pendingCapabilities: [...COMPLEX_CAPABILITIES],
      updatedAt: safeNow,
    },
  }
}

export function normalizeStudioPetModelVariants(input: unknown, fallbackPetId: string, now = Date.now()): StudioPetModelVariantsV1 {
  const safeNow = timestamp(now, Date.now())
  const source = record(input)
  const simpleSource = record(source.simple)
  const complexSource = record(source.complex)
  const requestedStatus = complexSource.status
  const status = typeof requestedStatus === 'string' && COMPLEX_STATUSES.includes(requestedStatus as StudioModelVariantStatus)
    ? requestedStatus as StudioModelVariantStatus
    : 'missing'
  const createdAt = complexSource.createdAt === undefined ? undefined : timestamp(complexSource.createdAt, safeNow)

  if (status === 'missing') return createStudioPetModelVariants(petId(source.petId, fallbackPetId), safeNow)

  const pendingCapabilities = status === 'ready' ? [] : capabilities(complexSource.pendingCapabilities)
  return {
    schemaVersion: 1,
    petId: petId(source.petId, fallbackPetId),
    simple: { kind: 'procedural', status: 'ready', updatedAt: timestamp(simpleSource.updatedAt, safeNow) },
    complex: {
      kind: 'skinned',
      status,
      completion: status === 'ready' ? 100 : completion(complexSource.completion),
      pendingCapabilities,
      ...(createdAt === undefined ? {} : { createdAt }),
      updatedAt: timestamp(complexSource.updatedAt, safeNow),
    },
  }
}

export function createComplexModelDraft(input: StudioPetModelVariantsV1, now = Date.now()): StudioPetModelVariantsV1 {
  if (input.complex.status !== 'missing') return input
  const safeNow = timestamp(now, Date.now())
  return {
    ...input,
    complex: {
      kind: 'skinned',
      status: 'draft',
      completion: 5,
      pendingCapabilities: [...COMPLEX_CAPABILITIES],
      createdAt: safeNow,
      updatedAt: safeNow,
    },
  }
}

export function normalizeStudioModelMode(input: unknown): StudioModelMode {
  return input === 'complex' ? 'complex' : 'simple'
}

export function normalizeStudioPetModelVariantCollection(input: unknown, now = Date.now()) {
  const source = record(input)
  const result: Record<string, StudioPetModelVariantsV1> = {}
  for (const [requestedPetId, value] of Object.entries(source)) {
    const normalizedPetId = requestedPetId.trim()
    if (!normalizedPetId) continue
    result[normalizedPetId] = normalizeStudioPetModelVariants(value, normalizedPetId, now)
  }
  return result
}
