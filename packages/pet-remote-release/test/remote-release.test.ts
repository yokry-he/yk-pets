import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubProvider, type GitHubProviderCommand } from '@yk-pets/pet-github-provider'
import type { GitWorktreeCoordinator } from '@yk-pets/pet-git-worktree'
import { evaluateMergeGate } from '@yk-pets/pet-merge-gate'
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan'
import { PullRequestSynchronizer } from '@yk-pets/pet-pr-lifecycle'
import { createReviewActionPlan } from '@yk-pets/pet-review-governance'
import { WebCryptoHmacApprovalSigner } from '@yk-pets/pet-scope-approval'
import { RemoteApprovalAuthority, RemoteApprovalGate, RemoteReleaseCoordinator, cleanupResourceDigest } from '../src/index.ts'

const HEAD = 'a'.repeat(40)
const BASE = 'b'.repeat(40)
const MERGE = 'c'.repeat(40)
class GitHubState {
  state: 'open' | 'merged' = 'open'
  updatedAt = 2
  checks = [
    { id: 'failed', name: 'test', status: 'completed', conclusion: 'failure', required: true },
    { id: 'success', name: 'lint', status: 'completed', conclusion: 'success', required: true },
    { id: 'pending', name: 'deploy', status: 'in_progress', conclusion: null, required: false },
  ]
  threads = [{ id: 't1', resolved: false, outdated: false, path: 'src/a.ts', line: 1, comments: [{ id: 'c1', author: 'alice', body: 'Fix this', createdAt: 3 }] }]
  reviews = [{ id: 'r1', author: 'alice', state: 'approved', submittedAt: 3, commitSha: HEAD }]
  calls: GitHubProviderCommand[] = []
  failDelete = false
  async invoke(command: GitHubProviderCommand): Promise<unknown> {
    this.calls.push(command)
    switch (command.type) {
      case 'pull-request:get': return { repository: 'org/repo', number: 1, externalId: 'pr1', url: 'https://github.com/org/repo/pull/1', title: 'Change', state: this.state, draft: false, baseBranch: 'main', headBranch: 'yk-pets/change', baseSha: BASE, headSha: HEAD, mergeability: 'mergeable', author: 'dev', createdAt: 1, updatedAt: this.updatedAt, ...(this.state === 'merged' ? { mergedAt: 20, closedAt: 20 } : {}) }
      case 'checks:list': return this.checks
      case 'review-threads:list': return this.threads
      case 'reviews:list': return this.reviews
      case 'checks:rerun-failed': return { repository: command.repository, number: command.number, headSha: command.expectedHeadSha, checkIds: command.checkIds, acceptedAt: 10 }
      case 'review-thread:reply': return { id: 'c2', author: 'yk-pets', body: command.body, createdAt: 11 }
      case 'review-thread:resolve': this.threads[0]!.resolved = true; return { threadId: command.threadId, resolved: true, resolvedAt: 12 }
      case 'pull-request:merge': this.state = 'merged'; this.updatedAt = 21; return { repository: command.repository, number: command.number, headSha: command.expectedHeadSha, mergeSha: MERGE, method: command.method, merged: true, mergedAt: 20 }
      case 'branch:delete': if (this.failDelete) throw new Error('delete denied'); return { repository: command.repository, resource: 'branch', identifier: command.branch, completedAt: 22 }
      case 'pull-request:close': return { repository: command.repository, resource: 'pull-request', identifier: String(command.number), completedAt: 22 }
    }
  }
}
async function setup(options: { state?: GitHubState; worktrees?: GitWorktreeCoordinator; now?: number } = {}) {
  const state = options.state ?? new GitHubState()
  const provider = new GitHubProvider(command => state.invoke(command), { allowedRepositories: ['org/repo'] })
  const sync = new PullRequestSynchronizer(provider, { now: () => options.now ?? 100 })
  const signer = new WebCryptoHmacApprovalSigner(new Uint8Array(32).fill(9))
  const authority = new RemoteApprovalAuthority(signer, () => 1_000)
  const approvals = new RemoteApprovalGate(signer, { now: () => 1_001 })
  const coordinator = new RemoteReleaseCoordinator({ provider, synchronizer: sync, approvals, worktrees: options.worktrees, now: () => options.now ?? 100 })
  return { state, provider, sync, authority, approvals, coordinator }
}

async function issue(authority: RemoteApprovalAuthority, input: { action: 'retry-failed-checks' | 'apply-review-plan' | 'merge' | 'cleanup-after-merge'; snapshotDigest: string; resourceDigest: string; mergeMethod?: 'squash'; sessionId?: string }) {
  return authority.issue({ subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, ...input })
}

test('remote approval is exact scope and one-time', async () => {
  const { authority, approvals } = await setup()
  const { token, claims } = await issue(authority, { action: 'retry-failed-checks', snapshotDigest: 'd'.repeat(64), resourceDigest: 'e'.repeat(64) })
  await approvals.authorize({ token, subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: claims.snapshotDigest, action: claims.action, resourceDigest: claims.resourceDigest })
  await assert.rejects(approvals.authorize({ token, subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: claims.snapshotDigest, action: claims.action, resourceDigest: claims.resourceDigest }), /already been used/)
})

test('remote approval signature and resource binding reject tampering', async () => {
  const { authority, approvals } = await setup()
  const { token, claims } = await issue(authority, { action: 'retry-failed-checks', snapshotDigest: 'd'.repeat(64), resourceDigest: 'e'.repeat(64) })
  await assert.rejects(approvals.authorize({ token: `${token.slice(0, -1)}x`, subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: claims.snapshotDigest, action: claims.action, resourceDigest: claims.resourceDigest }), /signature|base64url/)
  await assert.rejects(approvals.authorize({ token, subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: claims.snapshotDigest, action: claims.action, resourceDigest: 'f'.repeat(64) }), /resource digest/)
})

test('retry reruns only completed failed checks', async () => {
  const { coordinator, authority, sync, state } = await setup()
  const lifecycle = await sync.sync('org/repo', 1, { expectedHeadSha: HEAD })
  const resourceDigest = await sha256Hex(stableStringify({ checkIds: ['failed'] }))
  const { token } = await issue(authority, { action: 'retry-failed-checks', snapshotDigest: lifecycle.snapshot.digest, resourceDigest })
  const result = await coordinator.retryFailedChecks({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD })
  assert.deepEqual(result.retry.checkIds, ['failed'])
  const command = state.calls.find(call => call.type === 'checks:rerun-failed')
  assert.deepEqual(command && 'checkIds' in command ? command.checkIds : [], ['failed'])
})

test('retry refuses when no failed checks exist', async () => {
  const state = new GitHubState(); state.checks = [{ id: 'ok', name: 'test', status: 'completed', conclusion: 'success', required: true }]
  const { coordinator } = await setup({ state })
  await assert.rejects(coordinator.retryFailedChecks({ approvalToken: 'unused', subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD }), /No failed checks/)
})

test('review plan requires exact approval and executes reply then resolve', async () => {
  const { coordinator, authority, sync, state } = await setup()
  const lifecycle = await sync.sync('org/repo', 1)
  const plan = await createReviewActionPlan(lifecycle.snapshot, 'review-1', [{ threadId: 't1', action: 'reply-and-resolve', replyBody: 'Fixed.' }], { now: 101 })
  const { token } = await issue(authority, { action: 'apply-review-plan', snapshotDigest: lifecycle.snapshot.digest, resourceDigest: plan.digest })
  const result = await coordinator.applyReviewPlan({ approvalToken: token, subject: 'user', plan })
  assert.equal(result.execution.replies.length, 1)
  assert.equal(result.execution.resolutions.length, 1)
  assert.deepEqual(state.calls.filter(call => call.type.startsWith('review-thread:')).map(call => call.type), ['review-thread:reply', 'review-thread:resolve'])
})

test('stale review plan fails before mutation', async () => {
  const { coordinator, authority, sync, state } = await setup()
  const lifecycle = await sync.sync('org/repo', 1)
  const plan = await createReviewActionPlan(lifecycle.snapshot, 'review-1', [{ threadId: 't1', action: 'reply', replyBody: 'Fixed.' }])
  plan.snapshotDigest = 'f'.repeat(64)
  const { token } = await issue(authority, { action: 'apply-review-plan', snapshotDigest: plan.snapshotDigest, resourceDigest: plan.digest })
  await assert.rejects(coordinator.applyReviewPlan({ approvalToken: token, subject: 'user', plan }), /digest does not match|stale/)
  assert.equal(state.calls.some(call => call.type === 'review-thread:reply'), false)
})

test('eligible pull request merges with exact approved method', async () => {
  const state = new GitHubState(); state.checks = [{ id: 'ok', name: 'test', status: 'completed', conclusion: 'success', required: true }]; state.threads = []
  const { coordinator, authority, sync } = await setup({ state, now: 100 })
  const lifecycle = await sync.sync('org/repo', 1)
  const policy = { expectedHeadSha: HEAD, baseBranch: 'main', requiredCheckNames: ['test'], minimumApprovals: 1, allowedMergeMethods: ['squash'] as const, maxSnapshotAgeMs: 100 }
  const gate = await evaluateMergeGate(lifecycle.snapshot, policy, 100)
  const { token } = await issue(authority, { action: 'merge', snapshotDigest: lifecycle.snapshot.digest, resourceDigest: gate.digest, mergeMethod: 'squash' })
  const result = await coordinator.merge({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, method: 'squash', policy })
  assert.equal(result.merge.mergeSha, MERGE)
  assert.equal(state.state, 'merged')
})

test('blocked merge does not consume GitHub merge operation', async () => {
  const { coordinator, state } = await setup({ now: 100 })
  await assert.rejects(coordinator.merge({ approvalToken: 'unused', subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, method: 'squash', policy: { expectedHeadSha: HEAD, requiredCheckNames: ['test'], minimumApprovals: 1, maxSnapshotAgeMs: 100 } }), /Merge gate is blocked/)
  assert.equal(state.calls.some(call => call.type === 'pull-request:merge'), false)
})

test('merge approval is bound to exact merge method', async () => {
  const state = new GitHubState(); state.checks = [{ id: 'ok', name: 'test', status: 'completed', conclusion: 'success', required: true }]; state.threads = []
  const { coordinator, authority, sync } = await setup({ state, now: 100 })
  const lifecycle = await sync.sync('org/repo', 1)
  const policy = { expectedHeadSha: HEAD, requiredCheckNames: ['test'], minimumApprovals: 1, allowedMergeMethods: ['merge', 'squash'] as const, maxSnapshotAgeMs: 100 }
  const gate = await evaluateMergeGate(lifecycle.snapshot, policy, 100)
  const { token } = await issue(authority, { action: 'merge', snapshotDigest: lifecycle.snapshot.digest, resourceDigest: gate.digest, mergeMethod: 'squash' })
  await assert.rejects(coordinator.merge({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, method: 'merge', policy }), /merge method/)
})

test('cleanup requires a merged pull request and a concrete operation', async () => {
  const { coordinator } = await setup()
  await assert.rejects(coordinator.cleanupAfterMerge({ approvalToken: 'unused', subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, deleteBranch: true }), /requires a merged/)
})

test('post-merge cleanup deletes branch and closes local worktree', async () => {
  const state = new GitHubState(); state.state = 'merged'; state.updatedAt = 20
  const closed: string[] = []
  const worktrees = { close: async (id: string) => { closed.push(id); return { schema: 'yk-pets.repository-session/v1', sessionId: id, worktreeId: 'wt', repositoryId: 'repo', projectId: 'project', baseRef: 'main', baseRevision: BASE, branch: 'yk-pets/change', state: 'closed', openedAt: 1, expiresAt: 2 } } } as unknown as GitWorktreeCoordinator
  const { coordinator, authority, sync } = await setup({ state, worktrees })
  const lifecycle = await sync.sync('org/repo', 1)
  const resourceDigest = await cleanupResourceDigest({ branch: 'yk-pets/change', headSha: HEAD, deleteBranch: true, sessionId: 'session-1', forceLocalCleanup: false })
  const { token } = await issue(authority, { action: 'cleanup-after-merge', snapshotDigest: lifecycle.snapshot.digest, resourceDigest, sessionId: 'session-1' })
  const result = await coordinator.cleanupAfterMerge({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, deleteBranch: true, sessionId: 'session-1' })
  assert.equal(result.status, 'complete')
  assert.equal(result.branchDeleted, true)
  assert.deepEqual(closed, ['session-1'])
})

test('cleanup reports partial failures without hiding merged release', async () => {
  const state = new GitHubState(); state.state = 'merged'; state.updatedAt = 20; state.failDelete = true
  const { coordinator, authority, sync } = await setup({ state })
  const lifecycle = await sync.sync('org/repo', 1)
  const resourceDigest = await cleanupResourceDigest({ branch: 'yk-pets/change', headSha: HEAD, deleteBranch: true, forceLocalCleanup: false })
  const { token } = await issue(authority, { action: 'cleanup-after-merge', snapshotDigest: lifecycle.snapshot.digest, resourceDigest })
  const result = await coordinator.cleanupAfterMerge({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, deleteBranch: true })
  assert.equal(result.status, 'partial')
  assert.match(result.errors[0]!, /delete denied/)
})

test('expired remote approval is rejected', async () => {
  const { authority, approvals } = await setup()
  const { token, claims } = await authority.issue({ subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: 'd'.repeat(64), action: 'retry-failed-checks', resourceDigest: 'e'.repeat(64), ttlMs: 1 })
  await assert.rejects(approvals.authorize({ token, subject: 'user', repository: 'org/repo', number: 1, headSha: HEAD, snapshotDigest: claims.snapshotDigest, action: claims.action, resourceDigest: claims.resourceDigest, now: 1_002 }), /expired/)
})


test('cleanup approval binds the force-local-cleanup flag', async () => {
  const state = new GitHubState(); state.state = 'merged'; state.updatedAt = 20
  const worktrees = { close: async () => { throw new Error('must not run') } } as unknown as GitWorktreeCoordinator
  const { coordinator, authority, sync } = await setup({ state, worktrees })
  const lifecycle = await sync.sync('org/repo', 1)
  const resourceDigest = await cleanupResourceDigest({ branch: 'yk-pets/change', headSha: HEAD, deleteBranch: false, sessionId: 'session-1', forceLocalCleanup: false })
  const { token } = await issue(authority, { action: 'cleanup-after-merge', snapshotDigest: lifecycle.snapshot.digest, resourceDigest, sessionId: 'session-1' })
  await assert.rejects(coordinator.cleanupAfterMerge({ approvalToken: token, subject: 'user', repository: 'org/repo', number: 1, expectedHeadSha: HEAD, sessionId: 'session-1', forceLocalCleanup: true }), /resource digest/)
})
