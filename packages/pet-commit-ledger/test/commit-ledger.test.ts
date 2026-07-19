import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CommitLedger,
  GENESIS_DIGEST,
  MemoryCommitLedgerStore,
  computeCommitRecordPayloadDigest,
  renderCommitLedgerMarkdown,
  verifyCommitLedger,
  type CommitRecordPayload,
} from '../src/index.ts'

const BASE = 'a'.repeat(40)
const COMMIT = 'b'.repeat(40)
function payload(id = 'record-1'): CommitRecordPayload {
  return {
    id, projectId: 'project', repositoryId: 'repo', sessionId: 'session-1', planId: 'plan-1', planDigest: '1'.repeat(64), approvalId: 'approval-1',
    baseRevision: BASE, branch: 'yk-pets/change-1', commit: { sha: COMMIT, treeSha: 'c'.repeat(40), parentShas: [BASE], subject: 'fix: safe change', committedAt: 10 },
    gateDigest: '2'.repeat(64), validationDigests: { test: '3'.repeat(64) }, changedPaths: ['src/a.ts'],
  }
}

test('appends a genesis record and verifies its digest', async () => {
  const ledger = new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 })
  const entry = await ledger.append(payload())
  assert.equal(entry.sequence, 1)
  assert.equal(entry.previousDigest, GENESIS_DIGEST)
  await verifyCommitLedger([entry], 'project')
})

test('second entry chains to the first digest', async () => {
  const ledger = new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 })
  const first = await ledger.append(payload())
  const second = await ledger.append({ ...payload('record-2'), sessionId: 'session-2', approvalId: 'approval-2' })
  assert.equal(second.previousDigest, first.digest)
  assert.equal(second.sequence, 2)
})

test('mutation is detected by ledger verification', async () => {
  const ledger = new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 })
  const entry = await ledger.append(payload())
  entry.commit.subject = 'tampered'
  await assert.rejects(verifyCommitLedger([entry]), /digest mismatch/)
})

test('deletion and reordering break sequence or chain', async () => {
  const ledger = new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 })
  const first = await ledger.append(payload())
  const second = await ledger.append({ ...payload('record-2'), sessionId: 'session-2', approvalId: 'approval-2' })
  await assert.rejects(verifyCommitLedger([second]), /sequence|chain/)
  await assert.rejects(verifyCommitLedger([second, first]), /sequence|chain/)
})

test('store compare-and-swap prevents concurrent fork', async () => {
  const store = new MemoryCommitLedgerStore()
  const ledger = new CommitLedger(store, { now: () => 20 })
  const entry = await ledger.append(payload())
  await assert.rejects(async () => store.append('project', { ...entry, id: 'record-x', sequence: 2 }, GENESIS_DIGEST), /conflict/)
})

test('commit must descend from recorded base', async () => {
  const bad = payload(); bad.commit.parentShas = ['d'.repeat(40)]
  await assert.rejects(new CommitLedger(new MemoryCommitLedgerStore()).append(bad), /first parent/)
})

test('push and PR records must match commit branch and SHA', async () => {
  const good = payload()
  good.push = { remote: 'origin', branch: good.branch, commitSha: COMMIT, pushedAt: 11 }
  good.pullRequest = { provider: 'github', repository: 'org/repo', baseBranch: 'main', headBranch: good.branch, title: 'fix: safe change', createdAt: 12, number: 7, url: 'https://github.com/org/repo/pull/7' }
  const entry = await new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 }).append(good)
  assert.equal(entry.pullRequest?.number, 7)
  const bad = payload('bad'); bad.push = { remote: 'origin', branch: bad.branch, commitSha: 'd'.repeat(40), pushedAt: 11 }
  await assert.rejects(new CommitLedger(new MemoryCommitLedgerStore()).append(bad), /does not match/)
})

test('changed paths must be normalized unique and sorted', async () => {
  const bad = payload(); bad.changedPaths = ['src/b.ts', 'src/a.ts']
  await assert.rejects(new CommitLedger(new MemoryCommitLedgerStore()).append(bad), /unique and sorted/)
})

test('payload digest is deterministic', async () => {
  assert.equal(await computeCommitRecordPayloadDigest(payload()), await computeCommitRecordPayloadDigest(payload()))
})

test('Markdown includes commit, paths, push, and draft PR', async () => {
  const value = payload()
  value.push = { remote: 'origin', branch: value.branch, commitSha: COMMIT, pushedAt: 11 }
  value.pullRequest = { provider: 'github', repository: 'org/repo', baseBranch: 'main', headBranch: value.branch, title: 'Draft change', createdAt: 12 }
  const entry = await new CommitLedger(new MemoryCommitLedgerStore(), { now: () => 20 }).append(value)
  const markdown = renderCommitLedgerMarkdown(entry)
  assert.match(markdown, /Changed paths/)
  assert.match(markdown, /origin\/yk-pets\/change-1/)
  assert.match(markdown, /Draft pull request/)
})
