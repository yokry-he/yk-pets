import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GitWorktreeCoordinator,
  type GitCommitInput,
  type GitPushInput,
  type GitWorktreeAdapter,
  type RepositoryInspection,
  type WorktreeCreateInput,
} from '../src/index.ts'
import type { RepositorySnapshot } from '@yk-pets/pet-repository-policy'

const BASE = 'a'.repeat(40)
class FakeAdapter implements GitWorktreeAdapter {
  branches = new Set<string>()
  snapshots = new Map<string, RepositorySnapshot>()
  removed: string[] = []
  createError: Error | null = null
  inspect: RepositoryInspection = { repositoryId: 'repo', projectId: 'project', defaultBranch: 'main', currentBranch: 'main', headRevision: BASE, bare: false, worktreeSupported: true }
  async inspectRepository() { return structuredClone(this.inspect) }
  async resolveRevision() { return BASE }
  async branchExists(_repo: string, branch: string) { return this.branches.has(branch) }
  async createWorktree(input: WorktreeCreateInput) {
    if (this.createError) throw this.createError
    this.branches.add(input.branch)
    this.snapshots.set(input.worktreeId, { repositoryId: input.repositoryId, projectId: input.projectId, branch: input.branch, headRevision: input.baseRevision, detached: false, clean: true, changes: [] })
  }
  async removeWorktree(id: string) { this.removed.push(id); this.snapshots.delete(id) }
  async getSnapshot(id: string) { const value = this.snapshots.get(id); if (!value) throw new Error('missing'); return structuredClone(value) }
  async stagePaths(id: string, paths: string[]) { const snapshot = this.snapshots.get(id)!; for (const path of paths) snapshot.changes.push({ path, status: 'modified', staged: true }); snapshot.clean = false }
  async commit(id: string, input: GitCommitInput) { const snapshot = this.snapshots.get(id)!; const commitSha = 'b'.repeat(40); snapshot.headRevision = commitSha; snapshot.clean = true; snapshot.changes = []; return { commitSha, treeSha: 'c'.repeat(40), parentShas: [input.expectedParentRevision], committedAt: 10 } }
  async push(_id: string, input: GitPushInput) { return { remote: input.remote, branch: input.branch, commitSha: input.expectedCommitSha, pushedAt: 11 } }
}
function coordinator(adapter = new FakeAdapter(), now = () => 1) {
  return new GitWorktreeCoordinator(adapter, { now, idFactory: () => 'wt-1', allowedBaseRefs: ['main'] })
}
function openInput() { return { sessionId: 's1', repositoryId: 'repo', projectId: 'project', baseRef: 'main', expectedBaseRevision: BASE, branch: 'yk-pets/change-1' } }

test('opens a clean isolated worktree bound to exact base revision', async () => {
  const manager = coordinator()
  const session = await manager.open(openInput())
  assert.equal(session.state, 'open')
  assert.equal(session.worktreeId, 'wt-1')
})

test('rejects stale base revision before worktree creation', async () => {
  const manager = coordinator()
  const input = openInput(); input.expectedBaseRevision = 'd'.repeat(40)
  await assert.rejects(manager.open(input), /no longer matches/)
})

test('rejects existing branch names', async () => {
  const adapter = new FakeAdapter(); adapter.branches.add('yk-pets/change-1')
  await assert.rejects(coordinator(adapter).open(openInput()), /already exists/)
})

test('rejects bare or unsupported repositories', async () => {
  for (const mutate of [(a: FakeAdapter) => { a.inspect.bare = true }, (a: FakeAdapter) => { a.inspect.worktreeSupported = false }]) {
    const adapter = new FakeAdapter(); mutate(adapter)
    await assert.rejects(coordinator(adapter).open(openInput()))
  }
})

test('new worktree must be clean and attached to requested branch', async () => {
  const adapter = new FakeAdapter()
  const original = adapter.createWorktree.bind(adapter)
  adapter.createWorktree = async input => { await original(input); adapter.snapshots.get(input.worktreeId)!.clean = false }
  await assert.rejects(coordinator(adapter).open(openInput()), /not clean/)
  assert.deepEqual(adapter.removed, ['wt-1'])
})

test('stages only normalized unique paths', async () => {
  const manager = coordinator()
  await manager.open(openInput())
  const snapshot = await manager.stage('s1', ['src/a.ts'])
  assert.equal(snapshot.changes[0]?.staged, true)
  await assert.rejects(manager.stage('s1', ['../escape']), /traversal/)
})

test('commit is parent-bound and advances the session', async () => {
  const manager = coordinator()
  await manager.open(openInput())
  await manager.stage('s1', ['src/a.ts'])
  const commit = await manager.commit('s1', { subject: 'fix: safe change' })
  assert.equal(commit.parentShas[0], BASE)
  assert.equal(manager.get('s1').state, 'committed')
})

test('push is bound to committed branch and SHA', async () => {
  const manager = coordinator()
  await manager.open(openInput())
  await manager.stage('s1', ['src/a.ts'])
  const commit = await manager.commit('s1', { subject: 'fix: safe change' })
  const pushed = await manager.push('s1', { remote: 'origin' })
  assert.equal(pushed.commitSha, commit.commitSha)
  assert.equal(manager.get('s1').state, 'pushed')
})

test('cannot push before commit or commit twice', async () => {
  const manager = coordinator()
  await manager.open(openInput())
  await assert.rejects(manager.push('s1', { remote: 'origin' }), /is open/)
  await manager.stage('s1', ['src/a.ts'])
  await manager.commit('s1', { subject: 'fix: safe change' })
  await assert.rejects(manager.commit('s1', { subject: 'fix: again' }), /is committed/)
})

test('close removes the opaque worktree and is idempotent', async () => {
  const adapter = new FakeAdapter(); const manager = coordinator(adapter)
  await manager.open(openInput())
  assert.equal((await manager.close('s1')).state, 'closed')
  assert.equal((await manager.close('s1')).state, 'closed')
  assert.deepEqual(adapter.removed, ['wt-1'])
})

test('session expiry blocks further work and triggers cleanup', async () => {
  let now = 1
  const adapter = new FakeAdapter()
  const manager = new GitWorktreeCoordinator(adapter, { now: () => now, idFactory: () => 'wt-1', allowedBaseRefs: ['main'], defaultTtlMs: 10, maxTtlMs: 20 })
  await manager.open(openInput())
  now = 11
  assert.equal(manager.get('s1').state, 'expired')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(adapter.removed, ['wt-1'])
})

test('open-session limit is enforced', async () => {
  const adapter = new FakeAdapter()
  let id = 0
  const manager = new GitWorktreeCoordinator(adapter, { maxOpenSessions: 1, idFactory: () => `wt-${++id}`, allowedBaseRefs: ['main'] })
  await manager.open(openInput())
  await assert.rejects(manager.open({ ...openInput(), sessionId: 's2', branch: 'yk-pets/change-2' }), /limit/)
})

test('dispose force-cleans active worktrees and becomes terminal', async () => {
  const adapter = new FakeAdapter(); const manager = coordinator(adapter)
  await manager.open(openInput())
  await manager.dispose()
  assert.deepEqual(adapter.removed, ['wt-1'])
  await assert.rejects(manager.open({ ...openInput(), sessionId: 's2' }), /disposed/)
})
