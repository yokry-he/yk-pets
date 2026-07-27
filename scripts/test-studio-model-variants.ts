/**
 * 文件职责 / File responsibility
 * 验证双模型容器默认值、复杂草稿创建、损坏输入迁移与非覆盖语义。
 * Verifies dual-model defaults, complex-draft creation, damaged-input migration, and non-overwrite semantics.
 */
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from '../apps/playground/node_modules/pinia/dist/pinia.js'
import {
  createComplexModelDraft,
  createStudioPetModelVariants,
  normalizeStudioModelMode,
  normalizeStudioPetModelVariantCollection,
  normalizeStudioPetModelVariants,
} from '../apps/playground/app/domain/studio-model-variants'
import { useStudioModelVariantsStore } from '../apps/playground/app/stores/studio-model-variants'

const initial = createStudioPetModelVariants('zeph', 100)
assert.equal(initial.simple.status, 'ready')
assert.equal(initial.complex.status, 'missing')
assert.equal(initial.complex.completion, 0)

const draft = createComplexModelDraft(initial, 200)
assert.equal(draft.complex.status, 'draft')
assert.equal(draft.complex.completion, 5)
assert.equal(draft.complex.createdAt, 200)
assert.deepEqual(draft.complex.pendingCapabilities, ['renderer', 'skeleton', 'skin', 'rig-mapping'])

const preserved = createComplexModelDraft({
  ...draft,
  complex: { ...draft.complex, completion: 44, updatedAt: 250 },
}, 300)
assert.equal(preserved.complex.completion, 44)
assert.equal(preserved.complex.updatedAt, 250)

const normalized = normalizeStudioPetModelVariants({
  petId: '',
  simple: { updatedAt: -4 },
  complex: { status: 'broken', completion: 999, pendingCapabilities: ['skin', 'skin', 'unknown'] },
}, 'fallback', 400)
assert.equal(normalized.petId, 'fallback')
assert.equal(normalized.simple.updatedAt, 400)
assert.equal(normalized.complex.status, 'missing')
assert.equal(normalized.complex.completion, 0)
assert.deepEqual(normalized.complex.pendingCapabilities, ['renderer', 'skeleton', 'skin', 'rig-mapping'])

assert.equal(normalizeStudioModelMode('complex'), 'complex')
assert.equal(normalizeStudioModelMode('unexpected'), 'simple')
assert.equal(normalizeStudioModelMode(null), 'simple')

const collection = normalizeStudioPetModelVariantCollection({
  zeph: draft,
  '': createStudioPetModelVariants('invalid', 300),
  broken: null,
}, 500)
assert.deepEqual(Object.keys(collection), ['zeph', 'broken'])
assert.equal(collection.zeph?.complex.status, 'draft')
assert.equal(collection.broken?.petId, 'broken')
assert.equal(collection.broken?.complex.status, 'missing')

setActivePinia(createPinia())
const store = useStudioModelVariantsStore()
const zeph = store.ensurePet('zeph', 600)
assert.equal(zeph.simple.status, 'ready')
assert.equal(store.ensureComplexDraft('zeph', 700).complex.status, 'draft')
store.byPetId.zeph!.complex.completion = 52
assert.equal(store.ensureComplexDraft('zeph', 800).complex.completion, 52)
assert.equal(store.ensurePet('luna', 900).petId, 'luna')
assert.deepEqual(Object.keys(store.byPetId), ['zeph', 'luna'])

console.log('Studio model variants passed')
