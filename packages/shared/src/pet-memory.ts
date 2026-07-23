/**
 * 文件职责 / File responsibility
 * 定义跨扩展上下文共享的宠物记忆卡、导入计划、存储信封、草稿意图和规范化工具。
 * Defines pet-memory cards, import plans, storage envelopes, draft intents, and normalization utilities shared across extension contexts.
 */

export const PET_MEMORY_STORE_VERSION = 1
export const PET_MEMORY_STORAGE_KEY = 'yk-pets:pet-memory:v1'
export const PET_MEMORY_PENDING_PREFIX = 'yk-pets:pending-memory:'
export const PET_MEMORY_MAX_CARDS = 500
export const PET_MEMORY_IMPORT_MAX_BYTES = 8_000_000

export const PET_MEMORY_TYPES = [
  'note',
  'quote',
  'element',
  'audit-issue',
  'network-issue',
  'development-task',
] as const
export type PetMemoryType = typeof PET_MEMORY_TYPES[number]

export const PET_MEMORY_STATUSES = ['inbox', 'todo', 'doing', 'done', 'archived'] as const
export type PetMemoryStatus = typeof PET_MEMORY_STATUSES[number]

export const PET_MEMORY_PRIORITIES = ['low', 'medium', 'high'] as const
export type PetMemoryPriority = typeof PET_MEMORY_PRIORITIES[number]

export interface PetMemoryCard {
  id: string
  type: PetMemoryType
  title: string
  content: string
  selection?: string
  selector?: string
  pageUrl?: string
  pageTitle?: string
  status: PetMemoryStatus
  priority: PetMemoryPriority
  tags: string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
  relatedAuditIssueId?: string
  relatedNetworkRequestId?: string
  relatedPatchId?: string
}

export interface PetMemoryCreateInput {
  type?: PetMemoryType
  title?: string
  content?: string
  selection?: string
  selector?: string
  pageUrl?: string
  pageTitle?: string
  status?: Exclude<PetMemoryStatus, 'archived'>
  priority?: PetMemoryPriority
  tags?: string[]
  relatedAuditIssueId?: string
  relatedNetworkRequestId?: string
  relatedPatchId?: string
}

export type PetMemoryUpdatePatch = Partial<Pick<PetMemoryCard,
  | 'title'
  | 'content'
  | 'selection'
  | 'selector'
  | 'status'
  | 'priority'
  | 'tags'
  | 'relatedPatchId'
>>

export interface PetMemoryStore {
  version: typeof PET_MEMORY_STORE_VERSION
  cards: PetMemoryCard[]
  updatedAt: string
}

export interface PetMemoryImportResult {
  requestedCount: number
  importedCount: number
  duplicateCount: number
  conflictCount: number
  invalidCount: number
  truncatedCount: number
}

export interface PetMemoryImportPlan extends PetMemoryImportResult {
  cards: PetMemoryCard[]
}

export interface PetMemoryRelocateInput {
  cardId?: string
  selection: string
  selector?: string
  pageUrl?: string
  pageTitle?: string
}

export interface PetMemoryRelocateResult {
  matchCount: number
  usedSelector: boolean
  openedNewTab: boolean
}

export interface PetMemoryPageContext {
  pageUrl: string
  pageTitle: string
  selection?: string
}

export interface PetMemoryDraftIntent extends PetMemoryPageContext {
  source: 'shortcut' | 'context-menu' | 'pet' | 'page'
  focusComposer: boolean
  createdAt: number
}

export function createEmptyPetMemoryStore(): PetMemoryStore {
  return {
    version: PET_MEMORY_STORE_VERSION,
    cards: [],
    updatedAt: new Date(0).toISOString(),
  }
}

export function normalizePetMemoryStore(value: unknown): PetMemoryStore {
  if (!isRecord(value) || !Array.isArray(value.cards)) return createEmptyPetMemoryStore()
  const cards = value.cards
    .map(normalizePetMemoryCard)
    .filter((card): card is PetMemoryCard => Boolean(card))
    .slice(0, PET_MEMORY_MAX_CARDS)
  return {
    version: PET_MEMORY_STORE_VERSION,
    cards,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
  }
}

export function normalizePetMemoryCard(value: unknown): PetMemoryCard | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null
  const createdAt = normalizeIsoDate(value.createdAt) || new Date(0).toISOString()
  const updatedAt = normalizeIsoDate(value.updatedAt) || createdAt
  const status = PET_MEMORY_STATUSES.includes(value.status as PetMemoryStatus)
    ? value.status as PetMemoryStatus
    : 'inbox'
  return {
    id: value.id.trim(),
    type: PET_MEMORY_TYPES.includes(value.type as PetMemoryType) ? value.type as PetMemoryType : 'note',
    title: cleanText(value.title, 180),
    content: cleanText(value.content, 8_000),
    selection: optionalText(value.selection, 4_000),
    selector: optionalText(value.selector, 1_000),
    pageUrl: normalizeMemoryPageUrl(optionalText(value.pageUrl, 2_000)),
    pageTitle: optionalText(value.pageTitle, 300),
    status,
    priority: PET_MEMORY_PRIORITIES.includes(value.priority as PetMemoryPriority)
      ? value.priority as PetMemoryPriority
      : 'medium',
    tags: normalizePetMemoryTags(value.tags),
    createdAt,
    updatedAt,
    completedAt: status === 'done' ? normalizeIsoDate(value.completedAt) || updatedAt : undefined,
    relatedAuditIssueId: optionalText(value.relatedAuditIssueId, 180),
    relatedNetworkRequestId: optionalText(value.relatedNetworkRequestId, 180),
    relatedPatchId: optionalText(value.relatedPatchId, 180),
  }
}

export function planPetMemoryImport(
  existingCards: PetMemoryCard[],
  value: unknown,
  maxCards = PET_MEMORY_MAX_CARDS,
): PetMemoryImportPlan {
  const parsed = parsePetMemoryImport(value)
  const existingById = new Map(existingCards.map(card => [card.id, card]))
  const fingerprints = new Set(existingCards.map(memoryCardFingerprint))
  const candidates: PetMemoryCard[] = []
  let duplicateCount = parsed.duplicateCount
  let conflictCount = parsed.conflictCount

  for (const card of parsed.cards) {
    const existing = existingById.get(card.id)
    const fingerprint = memoryCardFingerprint(card)
    if (existing) {
      if (memoryCardFingerprint(existing) === fingerprint) duplicateCount += 1
      else conflictCount += 1
      continue
    }
    if (fingerprints.has(fingerprint)) {
      duplicateCount += 1
      continue
    }
    fingerprints.add(fingerprint)
    candidates.push(card)
  }

  const availableSlots = Math.max(0, maxCards - existingCards.length)
  const prioritizedCandidates = [
    ...candidates.filter(card => card.status !== 'archived'),
    ...candidates.filter(card => card.status === 'archived'),
  ]
  const imported = prioritizedCandidates.slice(0, availableSlots)

  return {
    cards: [...imported, ...existingCards].slice(0, maxCards),
    requestedCount: parsed.requestedCount,
    importedCount: imported.length,
    duplicateCount,
    conflictCount,
    invalidCount: parsed.invalidCount,
    truncatedCount: Math.max(0, prioritizedCandidates.length - imported.length),
  }
}

export function normalizePetMemoryTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const tags = value
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim().replace(/^#+/, '').slice(0, 28))
    .filter(Boolean)
  return [...new Set(tags)].slice(0, 10)
}

export function normalizeMemoryPageUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
    url.hash = ''
    return url.toString()
  }
  catch {
    return undefined
  }
}

export function memoryMatchesPage(card: PetMemoryCard, pageUrl?: string): boolean {
  const normalized = normalizeMemoryPageUrl(pageUrl)
  return Boolean(normalized && card.pageUrl === normalized && card.status !== 'archived')
}

function parsePetMemoryImport(value: unknown) {
  const envelope = Array.isArray(value) ? { cards: value } : value
  if (!isRecord(envelope) || !Array.isArray(envelope.cards)) {
    throw new Error('JSON 文件必须包含 cards 数组。')
  }
  if (envelope.version !== undefined && envelope.version !== PET_MEMORY_STORE_VERSION) {
    throw new Error(`不支持的宠物记忆版本：${String(envelope.version)}。`)
  }

  const cards: PetMemoryCard[] = []
  const fingerprintsById = new Map<string, string>()
  let invalidCount = 0
  let duplicateCount = 0
  let conflictCount = 0

  for (const value of envelope.cards) {
    const card = normalizePetMemoryCard(value)
    if (!card || !isMeaningfulMemoryCard(card)) {
      invalidCount += 1
      continue
    }
    const fingerprint = memoryCardFingerprint(card)
    const previousFingerprint = fingerprintsById.get(card.id)
    if (previousFingerprint) {
      if (previousFingerprint === fingerprint) duplicateCount += 1
      else conflictCount += 1
      continue
    }
    fingerprintsById.set(card.id, fingerprint)
    cards.push(card)
  }

  return {
    cards,
    requestedCount: envelope.cards.length,
    invalidCount,
    duplicateCount,
    conflictCount,
  }
}

function isMeaningfulMemoryCard(card: PetMemoryCard) {
  return Boolean(card.title || card.content || card.selection || card.pageUrl)
}

function memoryCardFingerprint(card: PetMemoryCard) {
  return JSON.stringify({
    type: card.type,
    title: card.title,
    content: card.content,
    selection: card.selection,
    selector: card.selector,
    pageUrl: card.pageUrl,
    pageTitle: card.pageTitle,
    status: card.status,
    priority: card.priority,
    tags: card.tags,
    relatedAuditIssueId: card.relatedAuditIssueId,
    relatedNetworkRequestId: card.relatedNetworkRequestId,
    relatedPatchId: card.relatedPatchId,
  })
}

function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function optionalText(value: unknown, limit: number): string | undefined {
  const text = cleanText(value, limit)
  return text || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
