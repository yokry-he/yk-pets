/**
 * 文件职责 / File responsibility
 * 验证双模型容器默认值、复杂草稿创建、损坏输入迁移与非覆盖语义。
 * Verifies dual-model defaults, complex-draft creation, damaged-input migration, and non-overwrite semantics.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from '../apps/playground/node_modules/pinia/dist/pinia.js'
import {
  createComplexModelDraft,
  createStudioPetModelVariants,
  normalizeStudioModelMode,
  normalizeStudioPetModelVariantCollection,
  normalizeStudioPetModelVariants,
} from '../apps/playground/app/domain/studio-model-variants'
import { useStudioModelVariantsStore } from '../apps/playground/app/stores/studio-model-variants'
import { useStudioMotionEditorStore } from '../apps/playground/app/stores/studio-motion-editor'
import { createBasicBipedStudioMotion } from '../apps/playground/app/domain/studio-basic-biped-motions'
import { compileBipedPetCharacter, createBipedPetModelRecipe, normalizeMotionAsset, type BipedPetRootMotionDefinition } from '../packages/pet-core/src/index.ts'

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
}, 'fallback', { now: 400 })
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
}, { mode: 'hydration', now: 500 })
assert.deepEqual(Object.keys(collection), ['zeph', 'broken'])
assert.equal(collection.zeph?.complex.status, 'draft')
assert.equal(collection.broken?.petId, 'broken')
assert.equal(collection.broken?.complex.status, 'missing')

// 集合水合只做轻量安全归一化；历史摘要必须等待当前宠物真正进入 renderer 后重新编译。
const historicalRecipe = createBipedPetModelRecipe(501)
const forgedHistoricalCompilation = {
  ...compileBipedPetCharacter(historicalRecipe),
  status: 'ready' as const,
  diagnostics: [{ id: 'forged-ready', severity: 'info' as const, message: '历史摘要不可直接信任。' }],
  compiledAt: 502,
}
const historicalCollectionInput = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [
  `history-${index}`,
  {
    petId: `forged-${index}`,
    simple: { kind: 'procedural', status: 'ready', updatedAt: 500 + index },
    complex: {
      kind: 'skinned',
      status: index % 2 === 0 ? 'ready' : 'blocked',
      completion: 100,
      pendingCapabilities: [],
      recipe: historicalRecipe,
      compilation: index % 2 === 0
        ? forgedHistoricalCompilation
        : {
            ...forgedHistoricalCompilation,
            status: 'blocked',
            diagnostics: [{ id: 'forged-blocked', severity: 'error', message: '伪造的阻塞摘要。' }],
          },
      updatedAt: 600 + index,
    },
  },
]))
const hydratedHistory = normalizeStudioPetModelVariantCollection(historicalCollectionInput, {
  mode: 'hydration',
  now: 700,
})
assert.equal(Object.keys(hydratedHistory).length, 100)
for (const [key, variants] of Object.entries(hydratedHistory)) {
  assert.equal(variants.petId, key)
  assert.equal(variants.simple.status, 'ready')
  assert.equal(variants.complex.status, 'draft')
  assert.equal(variants.complex.completion, 5)
  assert.equal(variants.complex.compilation, undefined)
  assert.equal(variants.complex.recipe?.rigProfileId, historicalRecipe.rigProfileId)
}

const summarylessHistoricalClaims = normalizeStudioPetModelVariantCollection({
  'ready-without-compilation': {
    complex: { status: 'ready', completion: 100, recipe: historicalRecipe },
  },
  'blocked-without-compilation': {
    complex: { status: 'blocked', completion: 100, recipe: historicalRecipe },
  },
  'draft-without-compilation': {
    complex: { status: 'draft', completion: 44, recipe: historicalRecipe },
  },
}, { mode: 'hydration', now: 701 })
assert.equal(summarylessHistoricalClaims['ready-without-compilation']?.complex.status, 'draft')
assert.equal(summarylessHistoricalClaims['ready-without-compilation']?.complex.completion, 5)
assert.equal(summarylessHistoricalClaims['ready-without-compilation']?.complex.compilation, undefined)
assert.equal(summarylessHistoricalClaims['blocked-without-compilation']?.complex.status, 'draft')
assert.equal(summarylessHistoricalClaims['blocked-without-compilation']?.complex.completion, 5)
assert.equal(summarylessHistoricalClaims['blocked-without-compilation']?.complex.compilation, undefined)
assert.equal(summarylessHistoricalClaims['draft-without-compilation']?.complex.status, 'draft')
assert.equal(summarylessHistoricalClaims['draft-without-compilation']?.complex.completion, 44)

const variantDomainSource = readFileSync(new URL('../apps/playground/app/domain/studio-model-variants.ts', import.meta.url), 'utf8')
const collectionNormalizerSource = variantDomainSource.match(/export function normalizeStudioPetModelVariantCollection[\s\S]*?\n}/)?.[0] || ''
assert.match(collectionNormalizerSource, /StudioPetModelVariantCollectionNormalizationOptions/)
assert.match(collectionNormalizerSource, /compilationTrust:\s*'discard-unverified'/)
assert.doesNotMatch(collectionNormalizerSource, /compileBipedPetCharacter\s*\(/)
assert.match(variantDomainSource, /compilationTrust\s*===\s*'verify-persisted'[\s\S]{0,80}compileBipedPetCharacter\(recipe\)/)

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
const playbackEditor = useStudioMotionEditorStore()
const playbackLoop = createBasicBipedStudioMotion('walk')
playbackEditor.open(playbackLoop)
playbackEditor.startPlayback(1_000)
playbackEditor.advancePlayback(3_500)
assert.equal(playbackEditor.playbackRequestedTimeMs, 2_500)
assert.equal(playbackEditor.playheadTimeMs, 100)
assert.equal(playbackEditor.playbackDirection, 1)
playbackEditor.pausePlayback(3_500)
assert.equal(playbackEditor.playbackRequestedTimeMs, 2_500)
playbackEditor.startPlayback(4_000)
playbackEditor.advancePlayback(4_500)
assert.equal(playbackEditor.playbackRequestedTimeMs, 3_000)
assert.equal(playbackEditor.playheadTimeMs, 600)

const playbackPingPong = normalizeMotionAsset({ ...playbackLoop, id: 'ping-pong-clock', loopMode: 'ping-pong' }).asset
playbackEditor.open(playbackPingPong)
playbackEditor.startPlayback(0)
playbackEditor.advancePlayback(1_500)
assert.equal(playbackEditor.playbackRequestedTimeMs, 1_500)
assert.equal(playbackEditor.playheadTimeMs, 900)
assert.equal(playbackEditor.playbackDirection, -1)
playbackEditor.advancePlayback(1_900)
assert.equal(playbackEditor.playbackRequestedTimeMs, 1_900)
assert.equal(playbackEditor.playheadTimeMs, 500)
playbackEditor.pausePlayback(1_900)
playbackEditor.startPlayback(3_000)
playbackEditor.advancePlayback(3_200)
assert.equal(playbackEditor.playbackRequestedTimeMs, 2_100)
assert.equal(playbackEditor.playheadTimeMs, 300)
playbackEditor.setPlayhead(800, false, 3_300)
assert.equal(playbackEditor.playbackRequestedTimeMs, 800)
playbackEditor.advancePlayback(3_400)
assert.equal(playbackEditor.playbackRequestedTimeMs, 900)
assert.equal(playbackEditor.playheadTimeMs, 900)
playbackEditor.stopPlayback()
assert.equal(playbackEditor.playbackRequestedTimeMs, 0)
assert.equal(playbackEditor.playheadTimeMs, 0)

setActivePinia(createPinia())
const motionEditor = useStudioMotionEditorStore()
const walkTemplate = createBasicBipedStudioMotion('walk')
const rootMotionNamespace = {
  sourceMotionId: walkTemplate.id,
  contacts: [{ contactId: 'foot.left', startMs: 0, endMs: 600, confidence: .9 }],
  events: [{ id: 'step', kind: 'hit', timeMs: 300 }],
  customAuthoringHint: { source: '用户保留字段' },
  rootMotion: {
    mode: 'in-place',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [],
    vfxTags: [],
  },
}
const rootMotionDraft = normalizeMotionAsset({
  ...walkTemplate,
  id: 'motion-walk-copy',
  nameZh: `${walkTemplate.nameZh} 副本`,
  nameEn: `${walkTemplate.nameEn} Copy`,
  extensions: {
    'yk-pets/biped-motion/v1': rootMotionNamespace,
    'third-party/retained': { enabled: true },
  },
}).asset
motionEditor.open(rootMotionDraft)
motionEditor.updateRootMotionSettings({ mode: 'travel', autoVfx: true })
const travelNamespace = motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>
const travelRootMotion = travelNamespace.rootMotion as { mode: string, distance: number, windows: unknown[], vfxTags: string[] }
assert.equal(travelRootMotion.mode, 'travel')
assert.equal(travelRootMotion.distance, .42)
assert.equal(travelRootMotion.windows.length, 1)
assert.deepEqual(travelRootMotion.vfxTags, ['speed-trail'])
assert.deepEqual(travelNamespace.contacts, rootMotionNamespace.contacts)
assert.deepEqual(travelNamespace.events, rootMotionNamespace.events)
assert.deepEqual(travelNamespace.customAuthoringHint, rootMotionNamespace.customAuthoringHint)
assert.equal(travelNamespace.sourceMotionId, walkTemplate.id)
assert.deepEqual(motionEditor.draft?.extensions?.['third-party/retained'], { enabled: true })
assert.equal(motionEditor.undoStack.length, 1)

motionEditor.undo()
assert.deepEqual((motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>).rootMotion, rootMotionNamespace.rootMotion)
assert.deepEqual(motionEditor.draft?.extensions?.['third-party/retained'], { enabled: true })

motionEditor.updateRootMotionSettings({ mode: 'travel', autoVfx: true })
motionEditor.updateRootMotionSettings({ mode: 'in-place' })
const inPlaceRootMotion = (motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.equal(inPlaceRootMotion.mode, 'in-place')
assert.equal(inPlaceRootMotion.distance, 0)
assert.equal(inPlaceRootMotion.turnRadians, 0)
assert.equal(inPlaceRootMotion.jumpHeight, 0)

motionEditor.updateRootMotionSettings({ autoVfx: false })
const noVfxRootMotion = (motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.deepEqual(noVfxRootMotion.vfxTags, [])
assert.deepEqual(noVfxRootMotion.windows, inPlaceRootMotion.windows)
assert.equal(noVfxRootMotion.mode, inPlaceRootMotion.mode)

motionEditor.updateRootMotionSettings({ autoVfx: true })
const inPlaceWithVfx = (motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.equal(inPlaceWithVfx.mode, 'in-place')
assert.equal(inPlaceWithVfx.distance, 0)
assert.deepEqual(inPlaceWithVfx.windows, noVfxRootMotion.windows)
assert.deepEqual(inPlaceWithVfx.vfxTags, [])
motionEditor.updateRootMotionSettings({ autoVfx: false })

motionEditor.updateRootMotionSettings({ mode: 'travel' })
const travelWithoutVfx = (motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.equal(travelWithoutVfx.mode, 'travel')
assert.equal(travelWithoutVfx.distance, .42)
assert.deepEqual(travelWithoutVfx.vfxTags, [])

motionEditor.restoreRootMotionRecommendations()
const restoredRootMotion = (motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.equal(restoredRootMotion.mode, 'in-place')
assert.equal(restoredRootMotion.distance, 0)
assert.equal(restoredRootMotion.windows.length, 0)
assert.deepEqual(restoredRootMotion.vfxTags, [])
assert.deepEqual((motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>).customAuthoringHint, rootMotionNamespace.customAuthoringHint)
assert.equal((motionEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>).sourceMotionId, walkTemplate.id)

setActivePinia(createPinia())
const scaledRecommendationEditor = useStudioMotionEditorStore()
const jumpTemplate = createBasicBipedStudioMotion('jump')
scaledRecommendationEditor.open(normalizeMotionAsset({
  ...structuredClone(jumpTemplate),
  id: 'motion-jump-short-copy',
  nameZh: `${jumpTemplate.nameZh} 副本`,
  nameEn: `${jumpTemplate.nameEn} Copy`,
  extensions: {
    'yk-pets/biped-motion/v1': {
      ...(jumpTemplate.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>),
      sourceMotionId: jumpTemplate.id,
    },
  },
}).asset)
scaledRecommendationEditor.updateMetadata({ durationMs: 1200 })
scaledRecommendationEditor.updateRootMotionSettings({ mode: 'in-place' })
scaledRecommendationEditor.restoreRootMotionRecommendations()
const scaledJumpRootMotion = (scaledRecommendationEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
assert.equal(scaledJumpRootMotion.jumpHeight, .28)
assert.deepEqual(scaledJumpRootMotion.windows.map((window: { startMs: number, endMs: number }) => [window.startMs, window.endMs]), [[360, 912]])

const customRecommendation: BipedPetRootMotionDefinition = {
  mode: 'travel',
  distance: 1.7,
  turnRadians: .25,
  verticalMode: 'grounded',
  jumpHeight: 0,
  windows: [{ id: 'user-travel', kind: 'travel', startMs: 100, endMs: 900, weight: .8 }],
  vfxTags: ['speed-trail'],
}
for (const [id, nameZh, nameEn] of [
  ['custom-zh-collision', walkTemplate.nameZh, 'Custom English Name'],
  ['custom-en-collision', '自定义中文名称', walkTemplate.nameEn],
  ['custom-bilingual-collision', walkTemplate.nameZh, walkTemplate.nameEn],
] as const) {
  setActivePinia(createPinia())
  const customEditor = useStudioMotionEditorStore()
  customEditor.open(normalizeMotionAsset({
    ...walkTemplate,
    id,
    nameZh,
    nameEn,
    extensions: { 'yk-pets/biped-motion/v1': { rootMotion: customRecommendation } },
  }).asset)
  customEditor.updateRootMotionSettings({ mode: 'in-place' })
  customEditor.restoreRootMotionRecommendations()
  const restoredCustom = (customEditor.draft?.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion: BipedPetRootMotionDefinition }).rootMotion
  assert.equal(restoredCustom.distance, 1.7)
  assert.equal(restoredCustom.turnRadians, .25)
  assert.deepEqual(restoredCustom.windows.map(window => window.id), ['user-travel'])
}

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
const ensuredReady = complexStore.ensurePet('nova', 1_051)
assert.equal(ensuredReady.complex.status, 'ready')
assert.equal(ensuredReady.complex.compilation?.hash, readyCompilation.hash)

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
const ensuredBlocked = complexStore.ensurePet('nova', 1_080)
assert.equal(ensuredBlocked.complex.status, 'blocked')
assert.ok(ensuredBlocked.complex.compilation?.diagnostics.some(item => item.id === 'runtime-blocked'))

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
}, 'fallback', { now: 1_100 })
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
}, 'fallback', { now: 1_102 })
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
}, 'fallback', { now: 1_105 })
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
}, 'fallback', { now: 1_107 })
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
}, 'fallback', { now: 1_108 })
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
}, 'fallback', { now: 1_109 })
assert.equal(validBlockedHydratedCompilation.complex.status, 'blocked')
assert.equal(validBlockedHydratedCompilation.complex.compilation?.diagnostics[0]?.id, 'runtime-blocked')

setActivePinia(createPinia())
const recompileAfterHydrationStore = useStudioModelVariantsStore()
recompileAfterHydrationStore.byPetId = normalizeStudioPetModelVariantCollection({
  current: {
    petId: 'current',
    complex: {
      status: 'ready',
      completion: 100,
      recipe: normalizedReadyRecipe,
      compilation: { ...normalizedReadyCompilation, compiledAt: 1_109 },
    },
  },
}, { mode: 'hydration', now: 1_110 })
assert.equal(recompileAfterHydrationStore.byPetId.current?.complex.status, 'draft')
assert.equal(recompileAfterHydrationStore.byPetId.current?.complex.compilation, undefined)
const reviewedCurrent = recompileAfterHydrationStore.commitComplexCompilation('current', normalizedReadyCompilation, 1_111)
assert.equal(reviewedCurrent.complex.status, 'ready')
assert.equal(reviewedCurrent.complex.compilation?.hash, normalizedReadyCompilation.hash)

const keyAuthoritativeCollection = normalizeStudioPetModelVariantCollection({
  outer: { petId: 'inner', complex: { status: 'draft', recipe: { bodyStyle: 'slender' } } },
}, { mode: 'hydration', now: 1_109 })
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

const roundTrip = normalizeStudioPetModelVariantCollection(JSON.parse(JSON.stringify(complexStore.byPetId)), { mode: 'hydration', now: 1_130 })
assert.deepEqual(roundTrip.nova?.complex.recipe, complexStore.byPetId.nova?.complex.recipe)
assert.deepEqual(roundTrip['simple-only']?.simple, simpleBefore)

console.log('Studio model variants passed')
