import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubProvider, type GitHubProviderCommand } from '@yk-pets/pet-github-provider'
import type { PullRequestLifecycleSnapshot } from '@yk-pets/pet-pr-lifecycle'
import { ReviewPlanExecutor, createReviewActionPlan, summarizeReviewBlockers, validateReviewActionPlan } from '../src/index.ts'

const HEAD = 'a'.repeat(40)
function snapshot(): PullRequestLifecycleSnapshot {
  return {
    schema: 'yk-pets.pr-lifecycle/v1', repository: 'org/repo', number: 1, capturedAt: 1,
    pullRequest: { repository: 'org/repo', number: 1, externalId: 'pr1', url: 'https://github.com/org/repo/pull/1', title: 'x', state: 'open', draft: false, baseBranch: 'main', headBranch: 'yk-pets/x', baseSha: 'b'.repeat(40), headSha: HEAD, mergeability: 'mergeable', author: 'dev', createdAt: 1, updatedAt: 2 },
    checks: [],
    reviewThreads: [
      { id: 't1', resolved: false, outdated: false, path: 'src/a.ts', line: 3, comments: [{ id: 'c1', author: 'alice', body: 'Please fix', createdAt: 3 }] },
      { id: 't2', resolved: false, outdated: true, comments: [{ id: 'c2', author: 'bob', body: 'Old', createdAt: 3 }] },
    ],
    reviews: [
      { id: 'r1', author: 'alice', state: 'changes_requested', submittedAt: 3, commitSha: HEAD },
      { id: 'r2', author: 'bob', state: 'approved', submittedAt: 3, commitSha: HEAD },
    ],
    summary: { totalChecks: 0, requiredChecks: 0, successfulChecks: 0, failedChecks: 0, pendingChecks: 0, unresolvedThreads: 1, currentApprovals: 1, currentChangesRequested: 1 },
    digest: 'd'.repeat(64),
  }
}

test('creates a digest-bound reply and resolve plan', async () => {
  const plan = await createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't1', action: 'reply-and-resolve', replyBody: 'Fixed in the latest commit.' }], { now: 10 })
  assert.equal(plan.actions[0]?.latestCommentId, 'c1')
  await validateReviewActionPlan(plan)
})

test('resolve without a reply is disabled by default', async () => {
  await assert.rejects(createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't1', action: 'resolve' }]), /without a reply/)
})

test('resolve without a reply requires explicit policy opt-in', async () => {
  const plan = await createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't1', action: 'resolve' }], { allowResolveWithoutReply: true })
  assert.equal(plan.actions[0]?.action, 'resolve')
})

test('outdated and resolved threads cannot be modified', async () => {
  await assert.rejects(createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't2', action: 'reply', replyBody: 'x' }]), /Outdated/)
  const value = snapshot(); value.reviewThreads[0]!.resolved = true
  await assert.rejects(createReviewActionPlan(value, 'plan-1', [{ threadId: 't1', action: 'reply', replyBody: 'x' }]), /already resolved/)
})

test('duplicate actions and unsupported dismiss operations are rejected', async () => {
  await assert.rejects(createReviewActionPlan(snapshot(), 'plan-1', [
    { threadId: 't1', action: 'reply', replyBody: 'a' },
    { threadId: 't1', action: 'reply', replyBody: 'b' },
  ]), /Duplicate/)
  await assert.rejects(createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't1', action: 'dismiss' as never }]), /Unsupported/)
})

test('blocker summary separates active and outdated threads', () => {
  const result = summarizeReviewBlockers(snapshot())
  assert.deepEqual(result.activeThreadIds, ['t1'])
  assert.deepEqual(result.outdatedUnresolvedThreadIds, ['t2'])
  assert.deepEqual(result.changesRequestedBy, ['alice'])
  assert.equal(result.blockerCount, 2)
})

test('executor performs reply before resolution', async () => {
  const calls: string[] = []
  const provider = new GitHubProvider(async (command: GitHubProviderCommand) => {
    calls.push(command.type)
    if (command.type === 'review-thread:reply') return { id: 'c3', author: 'yk-pets', body: command.body, createdAt: 11 }
    if (command.type === 'review-thread:resolve') return { threadId: command.threadId, resolved: true, resolvedAt: 12 }
    throw new Error('unexpected')
  }, { allowedRepositories: ['org/repo'] })
  const current = snapshot()
  const plan = await createReviewActionPlan(current, 'plan-1', [{ threadId: 't1', action: 'reply-and-resolve', replyBody: 'Done.' }], { now: 10 })
  const result = await new ReviewPlanExecutor(provider, () => 13).execute(plan, current)
  assert.deepEqual(calls, ['review-thread:reply', 'review-thread:resolve'])
  assert.equal(result.status, 'complete')
  assert.deepEqual(result.errors, [])
  assert.equal(result.completedAt, 13)
})

test('executor rejects stale head and snapshot digest', async () => {
  const provider = new GitHubProvider(async () => ({}), { allowedRepositories: ['org/repo'] })
  const current = snapshot()
  const plan = await createReviewActionPlan(current, 'plan-1', [{ threadId: 't1', action: 'reply', replyBody: 'Done.' }])
  const changed = snapshot(); changed.pullRequest.headSha = 'e'.repeat(40)
  await assert.rejects(new ReviewPlanExecutor(provider).execute(plan, changed), /head SHA is stale/)
  changed.pullRequest.headSha = HEAD; changed.digest = 'e'.repeat(64)
  await assert.rejects(new ReviewPlanExecutor(provider).execute(plan, changed), /snapshot digest is stale/)
})

test('executor rejects changed latest comment precondition', async () => {
  const provider = new GitHubProvider(async () => ({}), { allowedRepositories: ['org/repo'] })
  const current = snapshot()
  const plan = await createReviewActionPlan(current, 'plan-1', [{ threadId: 't1', action: 'reply', replyBody: 'Done.' }])
  current.reviewThreads[0]!.comments.push({ id: 'new', author: 'alice', body: 'More', createdAt: 4 })
  await assert.rejects(new ReviewPlanExecutor(provider).execute(plan, current), /precondition changed/)
})

test('plan digest detects content tampering', async () => {
  const plan = await createReviewActionPlan(snapshot(), 'plan-1', [{ threadId: 't1', action: 'reply', replyBody: 'Done.' }])
  plan.actions[0]!.replyBody = 'Changed.'
  await assert.rejects(validateReviewActionPlan(plan), /digest does not match/)
})


test('executor returns an explicit partial result when resolution fails after reply', async () => {
  const provider = new GitHubProvider(async (command: GitHubProviderCommand) => {
    if (command.type === 'review-thread:reply') return { id: 'c3', author: 'yk-pets', body: command.body, createdAt: 11 }
    if (command.type === 'review-thread:resolve') throw new Error('resolution denied')
    throw new Error('unexpected')
  }, { allowedRepositories: ['org/repo'] })
  const current = snapshot()
  const plan = await createReviewActionPlan(current, 'plan-1', [{ threadId: 't1', action: 'reply-and-resolve', replyBody: 'Done.' }])
  const result = await new ReviewPlanExecutor(provider).execute(plan, current)
  assert.equal(result.status, 'partial')
  assert.equal(result.replies.length, 1)
  assert.equal(result.resolutions.length, 0)
  assert.match(result.errors[0]!, /resolution denied/)
})
