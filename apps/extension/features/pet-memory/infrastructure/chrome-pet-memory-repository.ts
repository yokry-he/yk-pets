/**
 * 文件职责 / File responsibility
 * 以单写入队列管理 chrome.storage.local 中的宠物记忆卡，并执行输入清洗、容量控制和状态迁移。
 * Manages pet-memory cards in chrome.storage.local through a serialized mutation queue with input sanitation, capacity limits, and status transitions.
 */
import {
  PET_MEMORY_MAX_CARDS,
  PET_MEMORY_PRIORITIES,
  PET_MEMORY_STATUSES,
  PET_MEMORY_STORAGE_KEY,
  PET_MEMORY_TYPES,
  createEmptyPetMemoryStore,
  normalizeMemoryPageUrl,
  normalizePetMemoryStore,
  normalizePetMemoryTags,
  type PetMemoryCard,
  type PetMemoryCreateInput,
  type PetMemoryStatus,
  type PetMemoryStore,
  type PetMemoryUpdatePatch,
} from '@nova/shared/pet-memory'

let mutationQueue: Promise<unknown> = Promise.resolve()

export async function listPetMemoryCards(options: { includeArchived?: boolean } = {}): Promise<PetMemoryCard[]> {
  const store = await readPetMemoryStore()
  return store.cards
    .filter(card => options.includeArchived || card.status !== 'archived')
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

export async function readPetMemoryStore(): Promise<PetMemoryStore> {
  const stored = await chrome.storage.local.get(PET_MEMORY_STORAGE_KEY)
  return normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY])
}

export function createPetMemoryCard(input: PetMemoryCreateInput): Promise<PetMemoryCard> {
  return enqueueMutation(async (store) => {
    const now = new Date().toISOString()
    const selection = cleanText(input.selection, 4_000)
    const content = cleanText(input.content, 8_000)
    const pageTitle = cleanText(input.pageTitle, 300)
    const title = cleanText(input.title, 180)
      || firstMeaningfulLine(content)
      || firstMeaningfulLine(selection)
      || pageTitle
      || '新的宠物记忆'
    const status = input.status && PET_MEMORY_STATUSES.includes(input.status)
      ? input.status
      : 'inbox'
    const card: PetMemoryCard = {
      id: crypto.randomUUID(),
      type: input.type && PET_MEMORY_TYPES.includes(input.type) ? input.type : selection ? 'quote' : 'note',
      title,
      content,
      selection: selection || undefined,
      selector: cleanText(input.selector, 1_000) || undefined,
      pageUrl: normalizeMemoryPageUrl(input.pageUrl),
      pageTitle: pageTitle || undefined,
      status,
      priority: input.priority && PET_MEMORY_PRIORITIES.includes(input.priority) ? input.priority : 'medium',
      tags: normalizePetMemoryTags(input.tags),
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : undefined,
      relatedAuditIssueId: cleanText(input.relatedAuditIssueId, 180) || undefined,
      relatedNetworkRequestId: cleanText(input.relatedNetworkRequestId, 180) || undefined,
      relatedPatchId: cleanText(input.relatedPatchId, 180) || undefined,
    }
    store.cards.unshift(card)
    compactStore(store)
    return card
  })
}

export function updatePetMemoryCard(cardId: string, patch: PetMemoryUpdatePatch): Promise<PetMemoryCard> {
  return enqueueMutation(async (store) => {
    const index = store.cards.findIndex(card => card.id === cardId)
    if (index < 0) throw new Error('记忆卡不存在或已经被删除。')
    const current = store.cards[index]!
    const now = new Date().toISOString()
    const nextStatus = patch.status && PET_MEMORY_STATUSES.includes(patch.status)
      ? patch.status
      : current.status
    const next: PetMemoryCard = {
      ...current,
      title: patch.title === undefined ? current.title : cleanText(patch.title, 180) || current.title,
      content: patch.content === undefined ? current.content : cleanText(patch.content, 8_000),
      selection: patch.selection === undefined ? current.selection : cleanText(patch.selection, 4_000) || undefined,
      selector: patch.selector === undefined ? current.selector : cleanText(patch.selector, 1_000) || undefined,
      status: nextStatus,
      priority: patch.priority && PET_MEMORY_PRIORITIES.includes(patch.priority) ? patch.priority : current.priority,
      tags: patch.tags === undefined ? current.tags : normalizePetMemoryTags(patch.tags),
      relatedPatchId: patch.relatedPatchId === undefined ? current.relatedPatchId : cleanText(patch.relatedPatchId, 180) || undefined,
      updatedAt: now,
      completedAt: nextStatus === 'done' ? current.completedAt || now : undefined,
    }
    store.cards[index] = next
    return next
  })
}

export function archivePetMemoryCard(cardId: string): Promise<PetMemoryCard> {
  return updatePetMemoryCard(cardId, { status: 'archived' })
}

async function enqueueMutation<T>(mutation: (store: PetMemoryStore) => Promise<T> | T): Promise<T> {
  const task = mutationQueue.then(async () => {
    const store = await readPetMemoryStore().catch(() => createEmptyPetMemoryStore())
    const result = await mutation(store)
    store.updatedAt = new Date().toISOString()
    await chrome.storage.local.set({ [PET_MEMORY_STORAGE_KEY]: store })
    return result
  })
  mutationQueue = task.catch(() => undefined)
  return await task
}

function compactStore(store: PetMemoryStore) {
  if (store.cards.length <= PET_MEMORY_MAX_CARDS) return
  const active = store.cards.filter(card => card.status !== 'archived')
  const archived = store.cards.filter(card => card.status === 'archived')
  store.cards = [...active, ...archived].slice(0, PET_MEMORY_MAX_CARDS)
}

function cleanText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function firstMeaningfulLine(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 96) || ''
}

export function countActiveMemoriesForPage(cards: PetMemoryCard[], pageUrl?: string) {
  const normalized = normalizeMemoryPageUrl(pageUrl)
  return normalized
    ? cards.filter(card => card.pageUrl === normalized && card.status !== 'archived').length
    : 0
}

export function statusAfterPrimaryAction(status: PetMemoryStatus): PetMemoryStatus {
  if (status === 'inbox') return 'todo'
  if (status === 'todo' || status === 'doing') return 'done'
  if (status === 'done') return 'todo'
  return 'inbox'
}
