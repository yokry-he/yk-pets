import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PATCH_PLAN_SCHEMA,
  applyTextEdits,
  computePatchPlanDigest,
  normalizeProjectPath,
  summarizePatchPlan,
  touchedPaths,
  validatePatchPlan,
  type PatchPlan,
} from '../src/index.ts'

const hash = 'a'.repeat(64)
function plan(): PatchPlan {
  return {
    schema: PATCH_PLAN_SCHEMA,
    id: 'plan-1',
    projectId: 'demo',
    baseRevision: 'rev-1',
    createdAt: 100,
    summary: 'Update component and add test.',
    changes: [
      { id: 'c1', operation: 'update', path: 'src/App.vue', expectedSha256: hash, edits: [{ start: 0, end: 3, expectedText: 'old', replacement: 'new' }] },
      { id: 'c2', operation: 'create', path: 'test/App.test.ts', content: 'test()' },
    ],
  }
}

test('validates a deterministic patch plan and summary', () => {
  const value = plan()
  validatePatchPlan(value)
  assert.deepEqual(touchedPaths(value), ['src/App.vue', 'test/App.test.ts'])
  assert.deepEqual(summarizePatchPlan(value).operations, { create: 1, update: 1, delete: 0, move: 0 })
})

test('normalizes repeated separators but rejects traversal and absolute paths', () => {
  assert.equal(normalizeProjectPath('src//views/App.vue'), 'src/views/App.vue')
  assert.throws(() => normalizeProjectPath('../secret'), /traversal/)
  assert.throws(() => normalizeProjectPath('/etc/passwd'), /relative/)
  assert.throws(() => normalizeProjectPath('C:/secret'), /relative/)
  assert.throws(() => normalizeProjectPath('src\\App.vue'), /forward slashes/)
})

test('protected paths cannot be modified', () => {
  const value = plan()
  value.changes[0] = { id: 'git', operation: 'create', path: '.git/config', content: 'x' }
  assert.throws(() => validatePatchPlan(value), /Protected/)
})

test('rejects duplicate and conflicting paths', () => {
  const value = plan()
  value.changes.push({ id: 'c3', operation: 'delete', path: 'src/App.vue', expectedSha256: hash })
  assert.throws(() => validatePatchPlan(value), /modified by both/)
  value.changes.pop()
  value.changes[1]!.id = 'c1'
  assert.throws(() => validatePatchPlan(value), /Duplicate change id/)
})

test('rejects invalid hashes and overlapping edits', () => {
  const value = plan()
  const update = value.changes[0]
  if (update?.operation !== 'update') throw new Error('fixture')
  update.expectedSha256 = 'bad'
  assert.throws(() => validatePatchPlan(value), /SHA-256/)
  update.expectedSha256 = hash
  update.edits.push({ start: 2, end: 4, replacement: 'x' })
  assert.throws(() => validatePatchPlan(value), /overlap/)
})

test('applies sorted text edits from the end', () => {
  const result = applyTextEdits('hello world', [
    { start: 0, end: 5, expectedText: 'hello', replacement: 'hi' },
    { start: 6, end: 11, expectedText: 'world', replacement: 'YK Pets' },
  ])
  assert.equal(result, 'hi YK Pets')
})

test('text edit preconditions protect against stale source', () => {
  assert.throws(() => applyTextEdits('hello', [{ start: 0, end: 5, expectedText: 'world', replacement: 'x' }]), /precondition/)
  assert.throws(() => applyTextEdits('hello', [{ start: 0, end: 9, replacement: 'x' }]), /exceeds/)
})

test('move claims both source and target paths', () => {
  const value = plan()
  value.changes = [{ id: 'move', operation: 'move', fromPath: 'src/a.ts', toPath: 'src/b.ts', expectedSha256: hash }]
  assert.deepEqual(touchedPaths(value), ['src/a.ts', 'src/b.ts'])
  value.changes[0] = { id: 'move', operation: 'move', fromPath: 'src/a.ts', toPath: 'src/a.ts', expectedSha256: hash }
  assert.throws(() => validatePatchPlan(value), /identical/)
})

test('plan digest is stable across object key order', async () => {
  const first = plan()
  const second = { ...plan(), metadata: { z: 1, a: 2 } }
  const third = { ...plan(), metadata: { a: 2, z: 1 } }
  assert.equal(await computePatchPlanDigest(second), await computePatchPlanDigest(third))
  assert.notEqual(await computePatchPlanDigest(first), await computePatchPlanDigest(second))
})

test('enforces file and plan byte budgets', () => {
  const value = plan()
  value.changes = [{ id: 'large', operation: 'create', path: 'src/large.ts', content: '12345' }]
  assert.throws(() => validatePatchPlan(value, { maxFileBytes: 4 }), /maxFileBytes/)
  assert.throws(() => validatePatchPlan(value, { maxPlanBytes: 4 }), /maxPlanBytes/)
})
