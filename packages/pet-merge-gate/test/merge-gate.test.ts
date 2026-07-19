import assert from 'node:assert/strict'
import test from 'node:test'
import type { PullRequestLifecycleSnapshot } from '@yk-pets/pet-pr-lifecycle'
import { assertMergeEligible, evaluateMergeGate } from '../src/index.ts'

const HEAD = 'a'.repeat(40)
function snapshot(): PullRequestLifecycleSnapshot {
  return {
    schema: 'yk-pets.pr-lifecycle/v1', repository: 'org/repo', number: 1, capturedAt: 100,
    pullRequest: { repository: 'org/repo', number: 1, externalId: 'pr1', url: 'https://github.com/org/repo/pull/1', title: 'x', state: 'open', draft: false, baseBranch: 'main', headBranch: 'yk-pets/x', baseSha: 'b'.repeat(40), headSha: HEAD, mergeability: 'mergeable', author: 'dev', createdAt: 1, updatedAt: 2 },
    checks: [{ id: 'c1', name: 'test', status: 'completed', conclusion: 'success', required: true }],
    reviewThreads: [],
    reviews: [{ id: 'r1', author: 'alice', state: 'approved', submittedAt: 3, commitSha: HEAD }],
    summary: { totalChecks: 1, requiredChecks: 1, successfulChecks: 1, failedChecks: 0, pendingChecks: 0, unresolvedThreads: 0, currentApprovals: 1, currentChangesRequested: 0 },
    digest: 'd'.repeat(64),
  }
}
const policy = { expectedHeadSha: HEAD, baseBranch: 'main', requiredCheckNames: ['test'], minimumApprovals: 1, allowedMergeMethods: ['squash'] as const, maxSnapshotAgeMs: 100 }

test('eligible snapshot passes with allowed merge method', async () => {
  const decision = await evaluateMergeGate(snapshot(), policy, 150)
  assert.equal(decision.status, 'eligible')
  assert.doesNotThrow(() => assertMergeEligible(decision, 'squash'))
})

test('head movement and base branch changes block', async () => {
  const value = snapshot(); value.pullRequest.headSha = 'e'.repeat(40); value.pullRequest.baseBranch = 'develop'
  const decision = await evaluateMergeGate(value, policy, 150)
  assert.equal(decision.status, 'blocked')
  assert.ok(decision.reasons.some(reason => reason.code === 'head-moved'))
  assert.ok(decision.reasons.some(reason => reason.code === 'base-branch-changed'))
})

test('draft, closed, and conflicts block merge', async () => {
  const value = snapshot(); value.pullRequest.draft = true; value.pullRequest.state = 'closed'; value.pullRequest.mergeability = 'conflicting'
  const codes = (await evaluateMergeGate(value, policy, 150)).reasons.map(reason => reason.code)
  assert.ok(codes.includes('draft')); assert.ok(codes.includes('not-open')); assert.ok(codes.includes('merge-conflict'))
})

test('unknown mergeability waits rather than passing', async () => {
  const value = snapshot(); value.pullRequest.mergeability = 'unknown'
  const decision = await evaluateMergeGate(value, policy, 150)
  assert.equal(decision.status, 'waiting')
})

test('pending required check waits and failed check blocks', async () => {
  const pending = snapshot(); pending.checks[0] = { ...pending.checks[0]!, status: 'in_progress', conclusion: null }
  assert.equal((await evaluateMergeGate(pending, policy, 150)).status, 'waiting')
  const failed = snapshot(); failed.checks[0]!.conclusion = 'failure'
  assert.equal((await evaluateMergeGate(failed, policy, 150)).status, 'blocked')
})

test('missing named required check blocks', async () => {
  const value = snapshot(); value.checks = []
  const decision = await evaluateMergeGate(value, policy, 150)
  assert.ok(decision.reasons.some(reason => reason.code === 'required-check-missing'))
})

test('skipped and neutral required checks require explicit policy', async () => {
  const skipped = snapshot(); skipped.checks[0]!.conclusion = 'skipped'
  assert.equal((await evaluateMergeGate(skipped, policy, 150)).status, 'blocked')
  assert.equal((await evaluateMergeGate(skipped, { ...policy, allowSkippedRequiredChecks: true }, 150)).status, 'eligible')
})

test('unresolved review threads and changes requested block', async () => {
  const value = snapshot()
  value.reviewThreads = [{ id: 't1', resolved: false, outdated: false, comments: [{ id: 'x', author: 'alice', body: 'fix', createdAt: 4 }] }]
  value.reviews.push({ id: 'r2', author: 'bob', state: 'changes_requested', submittedAt: 4, commitSha: HEAD })
  const codes = (await evaluateMergeGate(value, policy, 150)).reasons.map(reason => reason.code)
  assert.ok(codes.includes('unresolved-review-threads')); assert.ok(codes.includes('changes-requested'))
})

test('author approval is excluded by default', async () => {
  const value = snapshot(); value.reviews = [{ id: 'r', author: 'dev', state: 'approved', submittedAt: 3, commitSha: HEAD }]
  assert.equal((await evaluateMergeGate(value, policy, 150)).status, 'blocked')
  assert.equal((await evaluateMergeGate(value, { ...policy, excludeAuthorApproval: false }, 150)).status, 'eligible')
})

test('trusted approver allowlist filters approvals', async () => {
  assert.equal((await evaluateMergeGate(snapshot(), { ...policy, trustedApprovers: ['bob'] }, 150)).status, 'blocked')
  assert.equal((await evaluateMergeGate(snapshot(), { ...policy, trustedApprovers: ['alice'] }, 150)).status, 'eligible')
})

test('stale or future snapshots block merge', async () => {
  assert.ok((await evaluateMergeGate(snapshot(), policy, 300)).reasons.some(reason => reason.code === 'stale-snapshot'))
  assert.ok((await evaluateMergeGate(snapshot(), policy, 50)).reasons.some(reason => reason.code === 'stale-snapshot'))
})

test('unapproved merge method is rejected even when gate is eligible', async () => {
  const decision = await evaluateMergeGate(snapshot(), policy, 150)
  assert.throws(() => assertMergeEligible(decision, 'merge'), /not eligible/)
})

test('decision digest is stable across evaluation timestamps', async () => {
  const first = await evaluateMergeGate(snapshot(), policy, 120)
  const second = await evaluateMergeGate(snapshot(), policy, 130)
  assert.equal(first.digest, second.digest)
})


test('duplicate required check names are ambiguous and block', async () => {
  const value = snapshot()
  value.checks.push({ id: 'c2', name: 'test', status: 'completed', conclusion: 'success', required: true })
  const decision = await evaluateMergeGate(value, policy, 150)
  assert.ok(decision.reasons.some(reason => reason.code === 'required-check-ambiguous'))
})
