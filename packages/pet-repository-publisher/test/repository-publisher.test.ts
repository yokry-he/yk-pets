import assert from 'node:assert/strict'
import test from 'node:test'
import { CommitLedger, MemoryCommitLedgerStore } from '@yk-pets/pet-commit-ledger'
import { GitWorktreeCoordinator, type GitCommitInput, type GitPushInput, type GitWorktreeAdapter, type WorktreeCreateInput } from '@yk-pets/pet-git-worktree'
import type { RepositorySnapshot } from '@yk-pets/pet-repository-policy'
import { WebCryptoHmacApprovalSigner } from '@yk-pets/pet-scope-approval'
import {
  PublishApprovalAuthority,
  PublishApprovalGate,
  RepositoryPublisher,
  type PullRequestDraftAdapter,
  type PublishApprovalIssueRequest,
  type RepositoryPublishRequest,
} from '../src/index.ts'

const BASE = 'a'.repeat(40)
const PLAN_DIGEST = '1'.repeat(64)
class Adapter implements GitWorktreeAdapter {
  snapshots = new Map<string, RepositorySnapshot>()
  async inspectRepository() { return { repositoryId: 'repo', projectId: 'project', defaultBranch: 'main', currentBranch: 'main', headRevision: BASE, bare: false, worktreeSupported: true } }
  async resolveRevision() { return BASE }
  async branchExists() { return false }
  async createWorktree(input: WorktreeCreateInput) { this.snapshots.set(input.worktreeId, { repositoryId: 'repo', projectId: 'project', branch: input.branch, headRevision: BASE, detached: false, clean: true, changes: [] }) }
  async removeWorktree() {}
  async getSnapshot(id: string) { return structuredClone(this.snapshots.get(id)!) }
  async stagePaths(id: string, paths: string[]) { this.snapshots.get(id)!.changes = paths.map(path => ({ path, status: 'modified', staged: true, bytesAdded: 5, bytesDeleted: 1 })); this.snapshots.get(id)!.clean = false }
  async commit(id: string, input: GitCommitInput) { const result = { commitSha: 'b'.repeat(40), treeSha: 'c'.repeat(40), parentShas: [input.expectedParentRevision], committedAt: 10 }; const snapshot = this.snapshots.get(id)!; snapshot.headRevision = result.commitSha; snapshot.changes = []; snapshot.clean = true; return result }
  async push(_id: string, input: GitPushInput) { return { remote: input.remote, branch: input.branch, commitSha: input.expectedCommitSha, pushedAt: 11 } }
}
async function setup(pr?: PullRequestDraftAdapter) {
  const signer = new WebCryptoHmacApprovalSigner(new Uint8Array(32).fill(7))
  const authority = new PublishApprovalAuthority(signer, () => 1_000)
  const gate = new PublishApprovalGate(signer, { now: () => 1_001 })
  const adapter = new Adapter()
  const worktrees = new GitWorktreeCoordinator(adapter, { idFactory: () => 'wt-1', allowedBaseRefs: ['main'], now: () => 1 })
  await worktrees.open({ sessionId: 'session-1', repositoryId: 'repo', projectId: 'project', baseRef: 'main', expectedBaseRevision: BASE, branch: 'yk-pets/change-1' })
  const publisher = new RepositoryPublisher({ worktrees, approvals: gate, ledger: new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 }), pullRequests: pr, idFactory: () => 'record-1' })
  return { authority, publisher }
}
function approvalRequest(actions: Array<'commit' | 'push' | 'pr-draft'> = ['commit']): PublishApprovalIssueRequest {
  return { subject: 'user', projectId: 'project', repositoryId: 'repo', sessionId: 'session-1', planId: 'plan-1', planDigest: PLAN_DIGEST, baseRevision: BASE, branch: 'yk-pets/change-1', commitSubject: 'fix: safe change', actions, remote: actions.includes('push') ? 'origin' : undefined, pullRequestRepository: actions.includes('pr-draft') ? 'org/repo' : undefined, pullRequestBaseBranch: actions.includes('pr-draft') ? 'main' : undefined }
}
function publishRequest(token: string): RepositoryPublishRequest {
  return { approvalToken: token, subject: 'user', sessionId: 'session-1', planId: 'plan-1', planDigest: PLAN_DIGEST, approvalId: 'scope-1', expectedPaths: ['src/a.ts'], commitSubject: 'fix: safe change', validations: [{ id: 'test', status: 'passed', summary: 'ok', startedAt: 1, completedAt: 2 }], gatePolicy: { requiredValidationIds: ['test'] } }
}

test('exact one-time approval permits staged gated commit and ledger append', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest())
  const result = await publisher.publish(publishRequest(token))
  assert.equal(result.status, 'committed')
  assert.equal(result.ledger.commit.sha, result.commit.commitSha)
  assert.equal(result.ledger.changedPaths[0], 'src/a.ts')
})

test('publish approval is bound to branch, subject, plan digest, and actions', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest())
  const request = publishRequest(token); request.commitSubject = 'fix: different'
  await assert.rejects(publisher.publish(request), /commit subject does not match/)
})

test('publish approval cannot be replayed', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest())
  await publisher.publish(publishRequest(token))
  await assert.rejects(publisher.publish(publishRequest(token)), /session must be open|already been used/i)
})

test('failed repository gate creates no commit', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest())
  const request = publishRequest(token); request.secretFindings = [{ id: 's1', path: 'src/a.ts', severity: 'critical', rule: 'secret' }]
  await assert.rejects(publisher.publish(request), /commit gate failed/)
})

test('push requires exact approved action and remote', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest(['commit', 'push']))
  const request = publishRequest(token); request.push = { remote: 'origin' }
  const result = await publisher.publish(request)
  assert.equal(result.status, 'pushed')
  assert.equal(result.push?.remote, 'origin')
})

test('draft PR requires push and configured adapter', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue(approvalRequest(['commit']))
  const request = publishRequest(token); request.pullRequest = { provider: 'github', repository: 'org/repo', baseBranch: 'main', body: 'Body' }
  await assert.rejects(publisher.publish(request), /requires an explicit push/)
})

test('creates a draft PR only after successful push', async () => {
  const calls: string[] = []
  const pr: PullRequestDraftAdapter = { createDraft: async request => { calls.push(request.expectedCommitSha); return { ...request, createdAt: 12, number: 5, url: 'https://github.com/org/repo/pull/5' } } }
  const { authority, publisher } = await setup(pr)
  const { token } = await authority.issue(approvalRequest(['commit', 'push', 'pr-draft']))
  const request = publishRequest(token); request.push = { remote: 'origin' }; request.pullRequest = { provider: 'github', repository: 'org/repo', baseBranch: 'main', body: 'Body' }
  const result = await publisher.publish(request)
  assert.equal(result.status, 'draft-created')
  assert.equal(result.pullRequest?.draft, true)
  assert.deepEqual(calls, [result.commit.commitSha])
})

test('PR result mismatch is recorded as partial rather than hiding pushed commit', async () => {
  const pr: PullRequestDraftAdapter = { createDraft: async request => ({ ...request, repository: 'other/repo', createdAt: 12 }) }
  const { authority, publisher } = await setup(pr)
  const { token } = await authority.issue(approvalRequest(['commit', 'push', 'pr-draft']))
  const request = publishRequest(token); request.push = { remote: 'origin' }; request.pullRequest = { provider: 'github', repository: 'org/repo', baseBranch: 'main', body: 'Body' }
  const result = await publisher.publish(request)
  assert.equal(result.status, 'partial')
  assert.match(result.error!, /Draft pull request failed/)
  assert.equal(result.ledger.push?.commitSha, result.commit.commitSha)
})

test('approval token tampering and expiry are rejected', async () => {
  const { authority, publisher } = await setup()
  const { token } = await authority.issue({ ...approvalRequest(), ttlMs: 1 })
  await assert.rejects(publisher.publish(publishRequest(`${token.slice(0, -1)}x`)), /signature|base64url/)
})

test('approval action schema rejects PR without push', async () => {
  const { authority } = await setup()
  await assert.rejects(authority.issue({ ...approvalRequest(), actions: ['commit', 'pr-draft'], pullRequestRepository: 'org/repo', pullRequestBaseBranch: 'main' }), /requires push/)
})

test('GitHub adapter sends a forced draft request and validates returned scope', async () => {
  const { createGitHubDraftPullRequestAdapter } = await import('../src/index.ts')
  let received: unknown
  const adapter = createGitHubDraftPullRequestAdapter(async input => { received = input; return { repositoryFullName: 'org/repo', number: 9, url: 'https://github.com/org/repo/pull/9', draft: true, head: 'yk-pets/change-1', base: 'main' } }, () => 12)
  const result = await adapter.createDraft({ provider: 'github', repository: 'org/repo', title: 'Change', body: 'Body', baseBranch: 'main', headBranch: 'yk-pets/change-1', expectedCommitSha: 'b'.repeat(40), draft: true })
  assert.equal(result.number, 9)
  assert.deepEqual(received, { repositoryFullName: 'org/repo', title: 'Change', body: 'Body', head: 'yk-pets/change-1', base: 'main', draft: true, expectedCommitSha: 'b'.repeat(40) })
})
