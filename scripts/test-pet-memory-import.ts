/**
 * 文件职责 / File responsibility
 * 验证宠物记忆 JSON 导入的版本校验、安全合并、去重、冲突统计和容量边界。
 * Verifies version validation, safe merging, deduplication, conflict reporting, and capacity boundaries for Pet Memory JSON imports.
 */
import assert from 'node:assert/strict'
import {
  PET_MEMORY_MAX_CARDS,
  planPetMemoryImport,
  type PetMemoryCard,
} from '../packages/shared/src/pet-memory'

const baseTime = '2026-07-23T00:00:00.000Z'

function memoryCard(id: string, overrides: Partial<PetMemoryCard> = {}): PetMemoryCard {
  return {
    id,
    type: 'note',
    title: `Memory ${id}`,
    content: `Content ${id}`,
    status: 'inbox',
    priority: 'medium',
    tags: ['import-test'],
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides,
  }
}

const existing = memoryCard('existing')
const incoming = memoryCard('incoming')
const duplicateWithNewId = memoryCard('incoming-copy', {
  title: incoming.title,
  content: incoming.content,
})

const merged = planPetMemoryImport([existing], {
  version: 1,
  exportedAt: '2026-07-23T01:00:00.000Z',
  cards: [
    existing,
    memoryCard('existing', { content: 'Conflicting newer content' }),
    incoming,
    duplicateWithNewId,
    { title: 'Missing id' },
  ],
})

assert.equal(merged.requestedCount, 5)
assert.equal(merged.importedCount, 1)
assert.equal(merged.duplicateCount, 2)
assert.equal(merged.conflictCount, 1)
assert.equal(merged.invalidCount, 1)
assert.equal(merged.truncatedCount, 0)
assert.deepEqual(merged.cards.map(card => card.id), ['incoming', 'existing'])

const fullStore = Array.from({ length: PET_MEMORY_MAX_CARDS }, (_, index) => memoryCard(`full-${index}`))
const capacityPlan = planPetMemoryImport(fullStore, [memoryCard('overflow')])
assert.equal(capacityPlan.importedCount, 0)
assert.equal(capacityPlan.truncatedCount, 1)
assert.equal(capacityPlan.cards.length, PET_MEMORY_MAX_CARDS)

const priorityPlan = planPetMemoryImport(
  Array.from({ length: PET_MEMORY_MAX_CARDS - 1 }, (_, index) => memoryCard(`priority-${index}`)),
  [
    memoryCard('archived-import', { status: 'archived' }),
    memoryCard('active-import', { status: 'todo' }),
  ],
)
assert.equal(priorityPlan.importedCount, 1)
assert.equal(priorityPlan.cards[0]?.id, 'active-import')
assert.equal(priorityPlan.truncatedCount, 1)

assert.throws(
  () => planPetMemoryImport([], { version: 2, cards: [] }),
  /不支持的宠物记忆版本/,
)
assert.throws(
  () => planPetMemoryImport([], { version: 1 }),
  /cards 数组/,
)

console.log('pet memory import tests passed')
