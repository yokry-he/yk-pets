import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubProvider, GITHUB_PROVIDER_SCHEMA, type GitHubProviderCommand } from '../src/index.ts'

const HEAD = 'a'.repeat(40)
const BASE = 'b'.repeat(40)
const MERGE = 'c'.repeat(40)
function pull() { return { repository: 'org/repo', number: 7, externalId: 'PR_kw', url: 'https://github.com/org/repo/pull/7', title: 'Change', state: 'open', draft: false, baseBranch: 'main', headBranch: 'yk-pets/change', baseSha: BASE, headSha: HEAD, mergeability: 'mergeable', author: 'dev', createdAt: 1, updatedAt: 2 } }
function provider(handler?: (command: GitHubProviderCommand) => unknown) {
  const commands: GitHubProviderCommand[] = []
  return { commands, value: new GitHubProvider(async command => { commands.push(command); return handler?.(command) ?? pull() }, { allowedRepositories: ['org/repo'], now: () => 10 }) }
}

test('provider sends a fixed schema-scoped pull request command', async () => {
  const { commands, value } = provider()
  const result = await value.getPullRequest('org/repo', 7)
  assert.equal(result.headSha, HEAD)
  assert.deepEqual(commands, [{ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:get', repository: 'org/repo', number: 7 }])
})

test('repository allowlist is fail closed', async () => {
  const { value } = provider()
  await assert.rejects(value.getPullRequest('other/repo', 7), /not allowlisted/)
})

test('pull request response must match requested scope', async () => {
  const { value } = provider(() => ({ ...pull(), number: 8 }))
  await assert.rejects(value.getPullRequest('org/repo', 7), /does not match/)
})

test('checks are validated, deduplicated, and sorted with required first', async () => {
  const { value } = provider(() => [
    { id: '2', name: 'lint', status: 'completed', conclusion: 'success', required: false },
    { id: '1', name: 'test', status: 'completed', conclusion: 'failure', required: true },
  ])
  const checks = await value.listChecks('org/repo', 7, HEAD)
  assert.deepEqual(checks.map(check => check.id), ['1', '2'])
})

test('incomplete checks cannot report a conclusion', async () => {
  const { value } = provider(() => [{ id: '1', name: 'test', status: 'queued', conclusion: 'success', required: true }])
  await assert.rejects(value.listChecks('org/repo', 7, HEAD), /Incomplete/)
})

test('review threads require comments and safe project paths', async () => {
  const { value } = provider(() => [{ id: 't1', resolved: false, outdated: false, path: 'src/a.ts', line: 3, comments: [{ id: 'c1', author: 'reviewer', body: 'Please fix', createdAt: 1 }] }])
  const threads = await value.listReviewThreads('org/repo', 7)
  assert.equal(threads[0]?.comments[0]?.body, 'Please fix')
})

test('review URLs must be credential-free HTTPS', async () => {
  const { value } = provider(() => [{ id: 't1', resolved: false, outdated: false, comments: [{ id: 'c1', author: 'reviewer', body: 'Please fix', createdAt: 1, url: 'https://u:p@example.com/x' }] }])
  await assert.rejects(value.listReviewThreads('org/repo', 7), /credential-free HTTPS/)
})

test('failed check retry binds exact sorted check ids and head sha', async () => {
  const { commands, value } = provider(command => command.type === 'checks:rerun-failed' ? { repository: 'org/repo', number: 7, headSha: HEAD, checkIds: ['a', 'b'], acceptedAt: 4 } : pull())
  const result = await value.rerunFailedChecks('org/repo', 7, HEAD, ['b', 'a'])
  assert.deepEqual(result.checkIds, ['a', 'b'])
  assert.equal(commands[0]?.type, 'checks:rerun-failed')
})

test('retry response cannot silently change check ids', async () => {
  const { value } = provider(() => ({ repository: 'org/repo', number: 7, headSha: HEAD, checkIds: ['other'], acceptedAt: 4 }))
  await assert.rejects(value.rerunFailedChecks('org/repo', 7, HEAD, ['a']), /do not match/)
})

test('review reply uses a fixed command and bounded body', async () => {
  const { commands, value } = provider(command => command.type === 'review-thread:reply' ? { id: 'c2', author: 'yk-pets', body: command.body, createdAt: 3 } : pull())
  const comment = await value.replyReviewThread('org/repo', 7, 't1', 'Addressed in the latest commit.')
  assert.equal(comment.id, 'c2')
  assert.equal(commands[0]?.type, 'review-thread:reply')
})

test('thread resolution response is scope bound', async () => {
  const { value } = provider(() => ({ threadId: 'other', resolved: true, resolvedAt: 4 }))
  await assert.rejects(value.resolveReviewThread('org/repo', 7, 't1'), /does not match/)
})

test('merge binds expected head SHA and merge method', async () => {
  const { commands, value } = provider(command => command.type === 'pull-request:merge' ? { repository: 'org/repo', number: 7, headSha: HEAD, mergeSha: MERGE, method: 'squash', merged: true, mergedAt: 5 } : pull())
  const result = await value.mergePullRequest('org/repo', 7, HEAD, 'squash')
  assert.equal(result.mergeSha, MERGE)
  assert.equal(commands[0]?.type, 'pull-request:merge')
})

test('cleanup operations validate exact resource identifiers', async () => {
  const { value } = provider(command => command.type === 'branch:delete' ? { repository: 'org/repo', resource: 'branch', identifier: 'yk-pets/change', completedAt: 8 } : { repository: 'org/repo', resource: 'pull-request', identifier: '7', completedAt: 7 })
  assert.equal((await value.closePullRequest('org/repo', 7)).resource, 'pull-request')
  assert.equal((await value.deleteBranch('org/repo', 'yk-pets/change', HEAD)).identifier, 'yk-pets/change')
})

test('branch validation rejects traversal-like refs', async () => {
  const { value } = provider()
  await assert.rejects(value.deleteBranch('org/repo', '../main', HEAD), /branch is invalid/)
})
