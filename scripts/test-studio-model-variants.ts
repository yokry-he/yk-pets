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
import { compileBipedPetCharacter, createBipedPetModelRecipe } from '../packages/pet-core/src/index.ts'

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

setActivePinia(createPinia())
const complexStore = useStudioModelVariantsStore()
const firstDraft = complexStore.ensureComplexDraft('nova', 1_000)
assert.equal(firstDraft.complex.status, 'draft')
assert.deepEqual(firstDraft.complex.recipe, createBipedPetModelRecipe(1_000))

const userRecipe = complexStore.updateComplexRecipe('nova', {
  proportions: { height: 1.6 },
  material: { baseColor: '#123456' },
}, 1_010)
const repeatedDraft = complexStore.ensureComplexDraft('nova', 1_020)
assert.equal(repeatedDraft.complex.recipe?.proportions.height, 1.6)
assert.equal(repeatedDraft.complex.recipe?.material.baseColor, '#123456')
assert.deepEqual(repeatedDraft.complex.recipe, userRecipe.complex.recipe)

const partialPatch = { appendages: { tail: { enabled: false } } }
const patched = complexStore.updateComplexRecipe('nova', partialPatch, 1_030)
assert.equal(patched.complex.recipe?.appendages.tail.enabled, false)
assert.equal(patched.complex.recipe?.appendages.tail.segments, 4)
assert.equal(patched.complex.recipe?.appendages.ears.enabled, true)
assert.equal(patched.complex.recipe?.proportions.height, 1.6)
assert.equal(patched.complex.compilation, undefined)
assert.equal(patched.complex.status, 'draft')
assert.ok(patched.complex.pendingCapabilities.length > 0)
partialPatch.appendages.tail.enabled = true
assert.equal(complexStore.byPetId.nova?.complex.recipe?.appendages.tail.enabled, false)

const readyRecipe = complexStore.updateComplexRecipe('nova', { bodyStyle: 'athletic' }, 1_040).complex.recipe!
const readyCompilation = compileBipedPetCharacter(readyRecipe)
const committed = complexStore.commitComplexCompilation('nova', readyCompilation, 1_050)
assert.equal(committed.complex.status, 'ready')
assert.equal(committed.complex.completion, 100)
assert.deepEqual(committed.complex.pendingCapabilities, [])
assert.equal(committed.complex.compilation?.hash, readyCompilation.hash)

const stale = complexStore.commitComplexCompilation('nova', {
  ...readyCompilation,
  hash: `${readyCompilation.hash}-stale`,
}, 1_060)
assert.notEqual(stale.complex.status, 'ready')
assert.notEqual(stale.complex.completion, 100)
assert.ok(stale.complex.compilation?.diagnostics.some(item => item.id === 'stale-compilation'))

const blockedRecipe = complexStore.updateComplexRecipe('nova', { appendages: { antennae: { enabled: true } } }, 1_070).complex.recipe!
const blocked = complexStore.commitComplexCompilation('nova', {
  ...compileBipedPetCharacter(blockedRecipe),
  status: 'blocked',
  diagnostics: [{ id: 'runtime-blocked', severity: 'error', message: '模拟运行时阻塞。' }],
}, 1_080)
assert.equal(blocked.complex.status, 'blocked')
assert.equal(blocked.complex.recipe?.appendages.antennae.enabled, true)
assert.ok(blocked.complex.compilation?.diagnostics.some(item => item.id === 'runtime-blocked'))

const staleBlocked = complexStore.commitComplexCompilation('nova', {
  ...compileBipedPetCharacter(blockedRecipe),
  hash: 'blocked-but-stale',
  status: 'blocked',
  diagnostics: [{ id: 'old-runtime-blocked', severity: 'error', message: '过期诊断不得恢复。' }],
}, 1_081)
assert.equal(staleBlocked.complex.status, 'draft')
assert.ok(staleBlocked.complex.compilation?.diagnostics.some(item => item.id === 'stale-compilation'))
assert.equal(staleBlocked.complex.compilation?.diagnostics.some(item => item.id === 'old-runtime-blocked'), false)

const hydratedDamaged = normalizeStudioPetModelVariants({
  petId: 'damaged',
  complex: {
    status: 'ready',
    recipe: {
      bodyStyle: 'unknown',
      proportions: { height: 99 },
      appendages: { tail: { enabled: true, segments: 999, length: 0 } },
      material: { baseColor: 'bad-color' },
      updatedAt: -1,
    },
    compilation: { hash: 4, status: 'ready', diagnostics: 'broken', compiledAt: -1 },
  },
}, 'fallback', 1_100)
assert.equal(hydratedDamaged.complex.status, 'draft')
assert.equal(hydratedDamaged.complex.compilation, undefined)
assert.equal(hydratedDamaged.complex.recipe?.bodyStyle, 'soft')
assert.equal(hydratedDamaged.complex.recipe?.proportions.height, 1.35)
assert.equal(hydratedDamaged.complex.recipe?.appendages.tail.segments, 8)

const unknownStatusWithRecipe = normalizeStudioPetModelVariants({
  petId: 'legacy-recipe',
  complex: {
    status: 'future-status',
    recipe: { bodyStyle: 'round', proportions: { height: 1.2 } },
    compilation: { hash: 'broken', status: 'unknown', diagnostics: [], compiledAt: 1_101 },
  },
}, 'fallback', 1_102)
assert.equal(unknownStatusWithRecipe.complex.status, 'draft')
assert.equal(unknownStatusWithRecipe.complex.recipe?.bodyStyle, 'round')
assert.equal(unknownStatusWithRecipe.complex.compilation, undefined)

const normalizedReadyRecipe = createBipedPetModelRecipe(1_103)
const normalizedReadyCompilation = compileBipedPetCharacter(normalizedReadyRecipe)
const staleHydratedCompilation = normalizeStudioPetModelVariants({
  petId: 'stale-hydrated',
  complex: {
    status: 'ready',
    recipe: normalizedReadyRecipe,
    compilation: { ...normalizedReadyCompilation, hash: 'totally-stale', compiledAt: 1_104 },
  },
}, 'fallback', 1_105)
assert.equal(staleHydratedCompilation.complex.status, 'draft')
assert.equal(staleHydratedCompilation.complex.completion, 5)
assert.equal(staleHydratedCompilation.complex.compilation, undefined)

const validHydratedCompilation = normalizeStudioPetModelVariants({
  petId: 'ready-hydrated',
  complex: {
    status: 'ready',
    recipe: normalizedReadyRecipe,
    compilation: { ...normalizedReadyCompilation, compiledAt: 1_106 },
  },
}, 'fallback', 1_107)
assert.equal(validHydratedCompilation.complex.status, 'ready')
assert.equal(validHydratedCompilation.complex.completion, 100)
assert.equal(validHydratedCompilation.complex.compilation?.hash, normalizedReadyCompilation.hash)

const readyHydratedWithForgedDiagnostic = normalizeStudioPetModelVariants({
  petId: 'ready-forged-diagnostic',
  complex: {
    status: 'ready',
    recipe: normalizedReadyRecipe,
    compilation: {
      ...normalizedReadyCompilation,
      diagnostics: [{ id: 'forged-error', severity: 'error', message: '持久化摘要不应伪造就绪错误。' }],
      compiledAt: 1_107,
    },
  },
}, 'fallback', 1_108)
assert.equal(readyHydratedWithForgedDiagnostic.complex.status, 'ready')
assert.equal(readyHydratedWithForgedDiagnostic.complex.compilation?.diagnostics.some(item => item.id === 'forged-error'), false)

const validBlockedHydratedCompilation = normalizeStudioPetModelVariants({
  petId: 'blocked-hydrated',
  complex: {
    status: 'blocked',
    recipe: normalizedReadyRecipe,
    compilation: {
      ...normalizedReadyCompilation,
      status: 'blocked',
      diagnostics: [{ id: 'runtime-blocked', severity: 'error', message: '渲染运行时不可用。' }],
      compiledAt: 1_108,
    },
  },
}, 'fallback', 1_109)
assert.equal(validBlockedHydratedCompilation.complex.status, 'blocked')
assert.equal(validBlockedHydratedCompilation.complex.compilation?.diagnostics[0]?.id, 'runtime-blocked')

const keyAuthoritativeCollection = normalizeStudioPetModelVariantCollection({
  outer: { petId: 'inner', complex: { status: 'draft', recipe: { bodyStyle: 'slender' } } },
}, 1_109)
assert.equal(keyAuthoritativeCollection.outer?.petId, 'outer')
assert.equal(keyAuthoritativeCollection.inner, undefined)
complexStore.byPetId['key-authoritative'] = {
  ...createStudioPetModelVariants('internal-id', 1_110),
  petId: 'internal-id',
}
const keyAuthoritativeAction = complexStore.updateComplexRecipe('key-authoritative', { proportions: { height: 1.5 } }, 1_111)
assert.equal(keyAuthoritativeAction.petId, 'key-authoritative')
assert.equal(complexStore.byPetId['key-authoritative']?.complex.recipe?.proportions.height, 1.5)
assert.equal(complexStore.byPetId['internal-id'], undefined)

const simpleBefore = complexStore.ensurePet('simple-only', 1_110).simple
complexStore.ensureComplexDraft('nova', 1_120)
assert.deepEqual(complexStore.byPetId['simple-only']?.simple, simpleBefore)

const roundTrip = normalizeStudioPetModelVariantCollection(JSON.parse(JSON.stringify(complexStore.byPetId)), 1_130)
assert.deepEqual(roundTrip.nova?.complex.recipe, complexStore.byPetId.nova?.complex.recipe)
assert.deepEqual(roundTrip['simple-only']?.simple, simpleBefore)

console.log('Studio model variants passed')
