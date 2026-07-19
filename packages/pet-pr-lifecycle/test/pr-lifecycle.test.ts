import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubProvider, type GitHubProviderCommand } from '@yk-pets/pet-github-provider'
import { MemoryPullRequestLifecycleStore, PullRequestSynchronizer, diffLifecycle, latestReviewByAuthor, summarize } from '../src/index.ts'

const HEAD = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const BASE = 'c'.repeat(40)
function pr(overrides = {}) { return { repository: 'org/repo', number: 1, externalId: 'pr1', url: 'https://github.com/org/repo/pull/1', title: 'Change', state: 'open', draft: false, baseBranch: 'main', headBranch: 'yk-pets/change', baseSha: BASE, headSha: HEAD, mergeability: 'mergeable', author: 'dev', createdAt: 1, updatedAt: 2, ...overrides } }
function create(commands?: (command: GitHubProviderCommand, call: number) => unknown) {
  let call = 0
  const provider = new GitHubProvider(async command => {
    call += 1
    if (commands) return commands(command, call)
    if (command.type === 'pull-request:get') return pr()
    if (command.type === 'checks:list') return [{ id: 'check', name: 'test', status: 'completed', conclusion: 'success', required: true }]
    if (command.type === 'review-threads:list') return []
    if (command.type === 'reviews:list') return [{ id: 'r1', author: 'alice', state: 'approved', submittedAt: 3, commitSha: HEAD }]
    throw new Error('unexpected')
  }, { allowedRepositories: ['org/repo'] })
  return new PullRequestSynchronizer(provider, { now: () => 10 })
}

test('sync captures a stable snapshot and summary', async () => {
  const result = await create().sync('org/repo', 1, { expectedHeadSha: HEAD })
  assert.equal(result.snapshot.summary.requiredChecks, 1)
  assert.equal(result.snapshot.summary.currentApprovals, 1)
  assert.equal(result.events[0]?.type, 'initial-snapshot')
  assert.equal(result.changed, true)
})

test('expected head mismatch fails before collecting dependent data', async () => {
  await assert.rejects(create().sync('org/repo', 1, { expectedHeadSha: OTHER }), /head no longer matches/)
})

test('head movement during collection fails closed', async () => {
  const sync = create((command, call) => {
    if (command.type === 'pull-request:get') return call === 1 ? pr() : pr({ headSha: OTHER, updatedAt: 3 })
    return []
  })
  await assert.rejects(sync.sync('org/repo', 1), /changed during/)
})

test('same lifecycle content has a stable digest independent of capture time', async () => {
  let now = 10
  const provider = new GitHubProvider(async command => command.type === 'pull-request:get' ? pr() : [], { allowedRepositories: ['org/repo'] })
  const store = new MemoryPullRequestLifecycleStore()
  const sync = new PullRequestSynchronizer(provider, { store, now: () => now++ })
  const first = await sync.sync('org/repo', 1)
  const second = await sync.sync('org/repo', 1)
  assert.equal(first.snapshot.digest, second.snapshot.digest)
  assert.equal(second.changed, false)
})

test('store compare-and-swap detects concurrent overwrite', async () => {
  const store = new MemoryPullRequestLifecycleStore()
  const first = await create().sync('org/repo', 1)
  await store.put(first.snapshot)
  await assert.rejects(store.put({ ...first.snapshot, capturedAt: 11 }, 'wrong'), /compare-and-swap/)
})

test('summary separates pending and failed checks', () => {
  const summary = summarize([
    { id: '1', name: 'a', status: 'queued', conclusion: null, required: true },
    { id: '2', name: 'b', status: 'completed', conclusion: 'failure', required: true },
    { id: '3', name: 'c', status: 'completed', conclusion: 'neutral', required: false },
  ], [], [], HEAD)
  assert.equal(summary.pendingChecks, 1)
  assert.equal(summary.failedChecks, 1)
  assert.equal(summary.successfulChecks, 1)
})

test('only latest review per author and current head counts', () => {
  const result = latestReviewByAuthor([
    { id: '1', author: 'alice', state: 'approved', submittedAt: 1, commitSha: OTHER },
    { id: '2', author: 'alice', state: 'changes_requested', submittedAt: 2, commitSha: HEAD },
    { id: '3', author: 'alice', state: 'approved', submittedAt: 3, commitSha: HEAD },
  ], HEAD)
  assert.equal(result.get('alice')?.state, 'approved')
})

test('outdated unresolved threads do not count as blockers', () => {
  const summary = summarize([], [{ id: 't', resolved: false, outdated: true, comments: [{ id: 'c', author: 'a', body: 'x', createdAt: 1 }] }], [], HEAD)
  assert.equal(summary.unresolvedThreads, 0)
})

test('diff emits check, thread, and review transitions', async () => {
  const first = await create().sync('org/repo', 1)
  const current = structuredClone(first.snapshot)
  current.capturedAt = 20
  current.checks[0]!.conclusion = 'failure'
  current.reviewThreads.push({ id: 't', resolved: false, outdated: false, comments: [{ id: 'c', author: 'bob', body: 'fix', createdAt: 4 }] })
  current.reviews.push({ id: 'r2', author: 'alice', state: 'changes_requested', submittedAt: 5, commitSha: HEAD })
  const events = diffLifecycle(first.snapshot, current)
  assert.deepEqual(events.map(event => event.type), ['check-changed', 'review-changed', 'thread-changed'])
})

test('diff reports head, state, and draft transitions', async () => {
  const first = await create().sync('org/repo', 1)
  const current = structuredClone(first.snapshot)
  current.capturedAt = 20
  current.pullRequest.headSha = OTHER
  current.pullRequest.state = 'closed'
  current.pullRequest.draft = true
  const types = diffLifecycle(first.snapshot, current).map(event => event.type)
  assert.ok(types.includes('head-changed'))
  assert.ok(types.includes('state-changed'))
  assert.ok(types.includes('draft-changed'))
})
