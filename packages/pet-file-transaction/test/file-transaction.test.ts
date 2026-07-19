import assert from 'node:assert/strict'
import test from 'node:test'
import { PATCH_PLAN_SCHEMA, sha256Hex, type PatchPlan } from '../../pet-patch-plan/src/index.ts'
import {
  FileTransactionExecutor,
  InMemoryWorkspaceAdapter,
  WorkspaceConflictError,
  toPublicTransactionSummary,
} from '../src/index.ts'

async function updatePlan(content = 'old'): Promise<PatchPlan> {
  return {
    schema: PATCH_PLAN_SCHEMA, id: 'plan-update', projectId: 'demo', createdAt: 100, summary: 'Update file',
    changes: [{ id: 'edit', operation: 'update', path: 'src/App.ts', expectedSha256: await sha256Hex(content), edits: [{ start: 0, end: 3, expectedText: 'old', replacement: 'new' }] }],
  }
}

test('previews actual full-file write bytes without mutating workspace', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old content' })
  const executor = new FileTransactionExecutor(adapter)
  const value = await updatePlan('old content')
  const preview = await executor.preview(value)
  assert.equal(preview.changedBytes, new TextEncoder().encode('new content').byteLength)
  assert.equal(adapter.mutationCount, 0)
  assert.deepEqual(await adapter.files(), { 'src/App.ts': 'old content' })
})

test('commits create, update, delete, and move operations', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/a.ts': 'old', 'src/delete.ts': 'bye', 'src/move.ts': 'move' })
  const plan: PatchPlan = {
    schema: PATCH_PLAN_SCHEMA, id: 'all', projectId: 'demo', createdAt: 100, summary: 'All operations',
    changes: [
      { id: 'create', operation: 'create', path: 'src/new.ts', content: 'created' },
      { id: 'update', operation: 'update', path: 'src/a.ts', expectedSha256: await sha256Hex('old'), edits: [{ start: 0, end: 3, replacement: 'new' }] },
      { id: 'delete', operation: 'delete', path: 'src/delete.ts', expectedSha256: await sha256Hex('bye') },
      { id: 'move', operation: 'move', fromPath: 'src/move.ts', toPath: 'src/moved.ts', expectedSha256: await sha256Hex('move') },
    ],
  }
  const result = await new FileTransactionExecutor(adapter).apply(plan)
  assert.equal(result.status, 'committed')
  assert.deepEqual(await adapter.files(), { 'src/a.ts': 'new', 'src/moved.ts': 'move', 'src/new.ts': 'created' })
  assert.equal(result.journal.length, 5)
})

test('stale hash fails before any mutation', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'changed externally' })
  const result = await new FileTransactionExecutor(adapter).apply(await updatePlan('old content'))
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /SHA-256 mismatch/)
  assert.equal(adapter.mutationCount, 0)
})

test('base revision mismatch fails before reading changes', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' })
  const plan = await updatePlan('old')
  plan.baseRevision = 'wrong'
  const result = await new FileTransactionExecutor(adapter).apply(plan)
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /base revision mismatch/)
  assert.equal(adapter.mutationCount, 0)
})

test('mid-transaction failure automatically restores completed writes', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/a.ts': 'a', 'src/b.ts': 'b' }, {
    failure: ({ count }) => count === 2 ? new Error('injected write failure') : undefined,
  })
  const plan: PatchPlan = {
    schema: PATCH_PLAN_SCHEMA, id: 'rollback', projectId: 'demo', createdAt: 100, summary: 'Rollback',
    changes: [
      { id: 'a', operation: 'update', path: 'src/a.ts', expectedSha256: await sha256Hex('a'), edits: [{ start: 0, end: 1, replacement: 'A' }] },
      { id: 'b', operation: 'update', path: 'src/b.ts', expectedSha256: await sha256Hex('b'), edits: [{ start: 0, end: 1, replacement: 'B' }] },
    ],
  }
  const result = await new FileTransactionExecutor(adapter).apply(plan)
  assert.equal(result.status, 'rolled-back')
  assert.match(result.error ?? '', /injected/)
  assert.deepEqual(await adapter.files(), { 'src/a.ts': 'a', 'src/b.ts': 'b' })
})

test('rollback conflict is reported and never overwrites external edits', async () => {
  let adapter!: InMemoryWorkspaceAdapter
  adapter = new InMemoryWorkspaceAdapter('demo', { 'src/a.ts': 'a', 'src/b.ts': 'b' }, {
    failure: ({ count, path }) => {
      if (count === 2 && path === 'src/b.ts') {
        adapter.setFailure(undefined)
        adapter.simulateExternalWrite('src/a.ts', 'external')
        return new Error('trigger rollback')
      }
      return undefined
    },
  })
  const plan: PatchPlan = {
    schema: PATCH_PLAN_SCHEMA, id: 'rollback-conflict', projectId: 'demo', createdAt: 100, summary: 'Rollback conflict',
    changes: [
      { id: 'a', operation: 'update', path: 'src/a.ts', expectedSha256: await sha256Hex('a'), edits: [{ start: 0, end: 1, replacement: 'A' }] },
      { id: 'b', operation: 'update', path: 'src/b.ts', expectedSha256: await sha256Hex('b'), edits: [{ start: 0, end: 1, replacement: 'B' }] },
    ],
  }
  const result = await new FileTransactionExecutor(adapter).apply(plan)
  assert.equal(result.status, 'rollback-failed')
  assert.equal((await adapter.files())['src/a.ts'], 'external')
  assert.equal(result.rollbackErrors?.[0]?.path, 'src/a.ts')
})

test('explicit rollback restores a committed transaction', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' })
  const executor = new FileTransactionExecutor(adapter)
  const committed = await executor.apply(await updatePlan('old'))
  assert.equal(committed.status, 'committed')
  assert.equal((await adapter.files())['src/App.ts'], 'new')
  const rolledBack = await executor.rollback(committed)
  assert.equal(rolledBack.status, 'rolled-back')
  assert.equal((await adapter.files())['src/App.ts'], 'old')
})

test('symlinks and directories are never followed or replaced', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/link.ts': { kind: 'symlink' }, 'src/folder': { kind: 'directory' } })
  const executor = new FileTransactionExecutor(adapter)
  for (const path of ['src/link.ts', 'src/folder']) {
    const plan: PatchPlan = { schema: PATCH_PLAN_SCHEMA, id: `create-${path.replace('/', '-')}`, projectId: 'demo', createdAt: 100, summary: 'Unsafe', changes: [{ id: 'c', operation: 'create', path, content: 'x' }] }
    const result = await executor.apply(plan)
    assert.equal(result.status, 'failed')
    assert.match(result.error ?? '', /expected missing/)
  }
})

test('project identity is mandatory', async () => {
  const adapter = new InMemoryWorkspaceAdapter('other', { 'src/App.ts': 'old' })
  await assert.rejects(new FileTransactionExecutor(adapter).apply(await updatePlan('old')), /project does not match/)
})

test('public transaction summary removes source contents from rollback journal', async () => {
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' })
  const result = await new FileTransactionExecutor(adapter).apply(await updatePlan('old'))
  const publicResult = toPublicTransactionSummary(result)
  assert.equal('content' in publicResult.journal[0]!.before, false)
  assert.equal(JSON.stringify(publicResult).includes('old'), false)
})

test('workspace conflict error includes confined path', () => {
  const error = new WorkspaceConflictError('src/App.ts', 'changed')
  assert.equal(error.path, 'src/App.ts')
  assert.match(error.message, /^src\/App\.ts:/)
})
