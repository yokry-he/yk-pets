import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import {
  LocalGitRepositoryAdapter,
  RepositoryRpcAdapter,
  createLocalRepositoryTransport,
  createRepositoryHostMessageHandler,
} from '../src/index.ts'
import { sha256Hex } from '@yk-pets/pet-patch-plan'

const exec = promisify(execFile)
async function git(cwd: string, ...args: string[]): Promise<string> { return (await exec('git', ['-C', cwd, ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim() }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'yk-pets-git-host-'))
  const repo = join(root, 'repo')
  const worktrees = join(root, 'worktrees')
  const remote = join(root, 'remote.git')
  await mkdir(repo); await mkdir(worktrees)
  await exec('git', ['init', '--bare', remote])
  await exec('git', ['init', '-b', 'main', repo])
  await git(repo, 'config', 'user.name', 'YK Pets Test')
  await git(repo, 'config', 'user.email', 'yk-pets@example.test')
  await writeFile(join(repo, 'a.txt'), 'one\n')
  await git(repo, 'add', 'a.txt'); await git(repo, 'commit', '-m', 'initial')
  await git(repo, 'remote', 'add', 'origin', remote)
  const base = await git(repo, 'rev-parse', 'HEAD')
  const adapter = new LocalGitRepositoryAdapter([{ repositoryId: 'repo', projectId: 'project', repositoryRoot: repo, worktreeRoot: worktrees, defaultBranch: 'main', allowedRemotes: ['origin'], allowedRemoteUrls: [remote] }], { now: () => 100 })
  return { root, repo, worktrees, remote, base, adapter }
}

async function withFixture(run: (value: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const value = await fixture()
  try { await run(value) } finally { await rm(value.root, { recursive: true, force: true }) }
}

test('inspects a real repository and resolves exact revisions', async () => withFixture(async ({ adapter, base }) => {
  const info = await adapter.inspectRepository('repo')
  assert.equal(info.currentBranch, 'main')
  assert.equal(info.headRevision, base)
  assert.equal(await adapter.resolveRevision('repo', 'main'), base)
}))

test('creates a real isolated worktree on a new branch', async () => withFixture(async ({ adapter, base }) => {
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  const snapshot = await adapter.getSnapshot('wt-1')
  assert.equal(snapshot.clean, true)
  assert.equal(snapshot.branch, 'yk-pets/change-1')
  await adapter.removeWorktree('wt-1')
}))

test('workspace adapter performs hash-bound real file writes', async () => withFixture(async ({ adapter, base }) => {
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  const workspace = adapter.createWorkspaceAdapter('wt-1')
  const before = await workspace.read('a.txt')
  assert.equal(before.kind, 'file')
  if (before.kind !== 'file') throw new Error('expected file')
  const after = await workspace.write('a.txt', 'two\n', { kind: 'file', sha256: before.sha256 })
  assert.equal(after.sha256, await sha256Hex('two\n'))
  await assert.rejects(workspace.write('a.txt', 'three\n', { kind: 'file', sha256: before.sha256 }), /SHA-256 mismatch/)
}))

test('workspace adapter rejects path traversal and symlink ancestors', async () => withFixture(async ({ adapter, base, root }) => {
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  const workspace = adapter.createWorkspaceAdapter('wt-1')
  await assert.rejects(workspace.read('../escape'), /traversal/)
  const worktree = adapter.worktreePathForTesting('wt-1')
  await symlink(root, join(worktree, 'linked'))
  await assert.rejects(workspace.write('linked/x.txt', 'x', { kind: 'missing' }), /symbolic-link ancestor/)
}))

test('status, exact staging, commit, and push use real Git', async () => withFixture(async ({ adapter, base, remote }) => {
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  const workspace = adapter.createWorkspaceAdapter('wt-1')
  const before = await workspace.read('a.txt'); if (before.kind !== 'file') throw new Error('expected file')
  await workspace.write('a.txt', 'two\n', { kind: 'file', sha256: before.sha256 })
  let snapshot = await adapter.getSnapshot('wt-1')
  assert.equal(snapshot.changes[0]?.staged, false)
  await adapter.stagePaths('wt-1', ['a.txt'])
  snapshot = await adapter.getSnapshot('wt-1')
  assert.equal(snapshot.changes[0]?.staged, true)
  const commit = await adapter.commit('wt-1', { subject: 'fix: update a', expectedParentRevision: base })
  assert.equal(commit.parentShas[0], base)
  const push = await adapter.push('wt-1', { remote: 'origin', branch: 'yk-pets/change-1', expectedCommitSha: commit.commitSha, setUpstream: true })
  assert.equal(push.commitSha, commit.commitSha)
  assert.equal(await exec('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/yk-pets/change-1']).then(r => r.stdout.trim()), commit.commitSha)
}))

test('commit rejects parent drift and push rejects non-allowlisted remote', async () => withFixture(async ({ adapter, base }) => {
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  const workspace = adapter.createWorkspaceAdapter('wt-1')
  const before = await workspace.read('a.txt'); if (before.kind !== 'file') throw new Error('expected file')
  await workspace.write('a.txt', 'two\n', { kind: 'file', sha256: before.sha256 }); await adapter.stagePaths('wt-1', ['a.txt'])
  await assert.rejects(adapter.commit('wt-1', { subject: 'fix: update a', expectedParentRevision: 'f'.repeat(40) }), /changed before commit/)
  const commit = await adapter.commit('wt-1', { subject: 'fix: update a', expectedParentRevision: base })
  await assert.rejects(adapter.push('wt-1', { remote: 'evil', branch: 'yk-pets/change-1', expectedCommitSha: commit.commitSha }), /not allowed/)
}))

test('strict RPC roundtrip exposes only fixed repository commands', async () => withFixture(async ({ adapter, base }) => {
  const calls: string[] = []
  const handler = createRepositoryHostMessageHandler(adapter, { repositoryId: 'repo', projectId: 'project', authorize: input => { calls.push(input.command.type); return true } })
  const rpc = new RepositoryRpcAdapter('repo', 'project', createLocalRepositoryTransport(handler))
  assert.equal((await rpc.inspectRepository('repo')).headRevision, base)
  await rpc.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-1', branch: 'yk-pets/change-1', baseRevision: base })
  assert.equal((await rpc.getSnapshot('wt-1')).branch, 'yk-pets/change-1')
  assert.deepEqual(calls, ['repository:inspect', 'repository:create-worktree', 'repository:get-snapshot'])
  const denied = await handler({ channel: 'yk-pets.repository-host/v1', requestId: 'r1', repositoryId: 'repo', projectId: 'project', command: { type: 'shell:exec', command: 'rm -rf /' } })
  assert.equal(denied.ok, false)
  if (!denied.ok) assert.match(denied.error, /Unsupported/)
}))

test('RPC authorization denial prevents adapter execution', async () => withFixture(async ({ adapter }) => {
  const handler = createRepositoryHostMessageHandler(adapter, { repositoryId: 'repo', projectId: 'project', authorize: () => false })
  const rpc = new RepositoryRpcAdapter('repo', 'project', createLocalRepositoryTransport(handler))
  await assert.rejects(rpc.inspectRepository('repo'), /authorization denied/)
}))

test('repository and project mismatches fail closed', async () => withFixture(async ({ adapter }) => {
  const handler = createRepositoryHostMessageHandler(adapter, { repositoryId: 'repo', projectId: 'project', authorize: () => true })
  const response = await handler({ channel: 'yk-pets.repository-host/v1', requestId: 'r1', repositoryId: 'other', projectId: 'project', command: { type: 'repository:inspect' } })
  assert.equal(response.ok, false)
}))


test('unsafe executable Git configuration is rejected before repository operations', async () => withFixture(async ({ adapter, repo }) => {
  await git(repo, 'config', 'core.hooksPath', '/tmp/unsafe-hooks')
  const fresh = new LocalGitRepositoryAdapter([{ repositoryId: 'repo', projectId: 'project', repositoryRoot: repo, worktreeRoot: join(repo, '..', 'other-worktrees'), defaultBranch: 'main' }])
  await assert.rejects(fresh.inspectRepository('repo'), /executable or redirecting Git config/)
}))

test('push is disabled when the exact remote URL is not allowlisted', async () => withFixture(async ({ repo, worktrees, base, remote }) => {
  const adapter = new LocalGitRepositoryAdapter([{ repositoryId: 'repo', projectId: 'project', repositoryRoot: repo, worktreeRoot: worktrees, defaultBranch: 'main', allowedRemotes: ['origin'] }])
  await adapter.createWorktree({ repositoryId: 'repo', projectId: 'project', worktreeId: 'wt-x', branch: 'yk-pets/no-push', baseRevision: base })
  const workspace = adapter.createWorkspaceAdapter('wt-x')
  const before = await workspace.read('a.txt'); if (before.kind !== 'file') throw new Error('expected file')
  await workspace.write('a.txt', 'blocked\n', { kind: 'file', sha256: before.sha256 }); await adapter.stagePaths('wt-x', ['a.txt'])
  const commit = await adapter.commit('wt-x', { subject: 'fix: blocked push', expectedParentRevision: base })
  await assert.rejects(adapter.push('wt-x', { remote: 'origin', branch: 'yk-pets/no-push', expectedCommitSha: commit.commitSha }), /not explicitly allowlisted/)
  assert.equal(await exec('git', ['--git-dir', remote, 'show-ref', '--verify', '--quiet', 'refs/heads/yk-pets/no-push']).then(() => true, () => false), false)
}))
