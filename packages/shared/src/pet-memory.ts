/**
 * 文件职责 / File responsibility
 * 定义跨扩展上下文共享的宠物记忆卡、存储信封、草稿意图和规范化工具。
 * Defines pet-memory cards, storage envelopes, draft intents, and normalization utilities shared across extension contexts.
 */

export const PET_MEMORY_STORE_VERSION = 1
export const PET_MEMORY_STORAGE_KEY = 'yk-pets:pet-memory:v1'
export const PET_MEMORY_PENDING_PREFIX = 'yk-pets:pending-memory:'
export const PET_MEMORY_MAX_CARDS = 500

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
