/** Strict repository-scoped GitHub collaboration provider. */

export const GITHUB_PROVIDER_SCHEMA = 'yk-pets.github-provider/v1' as const
export type PullRequestState = 'open' | 'closed' | 'merged'
export type Mergeability = 'mergeable' | 'conflicting' | 'unknown'
export type CheckStatus = 'queued' | 'in_progress' | 'completed'
export type CheckConclusion = 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped' | 'neutral' | 'action_required' | 'stale' | null
export type ReviewState = 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending'
export type MergeMethod = 'merge' | 'squash' | 'rebase'

export interface GitHubPullRequest {
  repository: string
  number: number
  externalId: string
  url: string
  title: string
  state: PullRequestState
  draft: boolean
  baseBranch: string
  headBranch: string
  baseSha: string
  headSha: string
  mergeability: Mergeability
  author: string
  createdAt: number
  updatedAt: number
  mergedAt?: number
  closedAt?: number
}

export interface GitHubCheckRun {
  id: string
  name: string
  status: CheckStatus
  conclusion: CheckConclusion
  required: boolean
  app?: string
  url?: string
  startedAt?: number
  completedAt?: number
}

export interface GitHubReviewComment {
  id: string
  author: string
  body: string
  createdAt: number
  updatedAt?: number
  url?: string
}

export interface GitHubReviewThread {
  id: string
  resolved: boolean
  outdated: boolean
  path?: string
  line?: number
  comments: GitHubReviewComment[]
}

export interface GitHubReview {
  id: string
  author: string
  state: ReviewState
  submittedAt?: number
  commitSha?: string
}

export interface GitHubRetryResult {
  repository: string
  number: number
  headSha: string
  checkIds: string[]
  acceptedAt: number
}

export interface GitHubMergeResult {
  repository: string
  number: number
  headSha: string
  mergeSha: string
  method: MergeMethod
  merged: true
  mergedAt: number
}

export interface GitHubCleanupResult {
  repository: string
  resource: 'pull-request' | 'branch'
  identifier: string
  completedAt: number
}

export type GitHubProviderCommand =
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'pull-request:get'; repository: string; number: number }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'checks:list'; repository: string; number: number; headSha: string }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'review-threads:list'; repository: string; number: number }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'reviews:list'; repository: string; number: number }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'checks:rerun-failed'; repository: string; number: number; expectedHeadSha: string; checkIds: string[] }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'review-thread:reply'; repository: string; number: number; threadId: string; body: string }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'review-thread:resolve'; repository: string; number: number; threadId: string }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'pull-request:merge'; repository: string; number: number; expectedHeadSha: string; method: MergeMethod }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'pull-request:close'; repository: string; number: number }
  | { schema: typeof GITHUB_PROVIDER_SCHEMA; type: 'branch:delete'; repository: string; branch: string; expectedHeadSha: string }

export interface GitHubProviderInvoker {
  (command: GitHubProviderCommand, signal?: AbortSignal): Promise<unknown>
}

export interface GitHubProviderOptions {
  allowedRepositories: string[]
  maxReviewBodyLength?: number
  now?: () => number
}

export class GitHubProvider {
  readonly invoke: GitHubProviderInvoker
  readonly allowedRepositories: Set<string>
  readonly maxReviewBodyLength: number
  readonly now: () => number

  constructor(invoke: GitHubProviderInvoker, options: GitHubProviderOptions) {
    if (typeof invoke !== 'function') throw new Error('GitHub provider invoker must be a function')
    if (!Array.isArray(options.allowedRepositories) || options.allowedRepositories.length === 0) throw new Error('At least one GitHub repository must be allowlisted')
    this.invoke = invoke
    this.allowedRepositories = new Set(options.allowedRepositories.map(validateRepository))
    this.maxReviewBodyLength = positiveInteger(options.maxReviewBodyLength ?? 20_000, 'maxReviewBodyLength')
    this.now = options.now ?? Date.now
  }

  async getPullRequest(repository: string, number: number, signal?: AbortSignal): Promise<GitHubPullRequest> {
    const scope = this.#scope(repository, number)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:get', ...scope }, signal)
    return validatePullRequest(result, scope.repository, scope.number)
  }

  async listChecks(repository: string, number: number, headSha: string, signal?: AbortSignal): Promise<GitHubCheckRun[]> {
    const scope = this.#scope(repository, number)
    const sha = validateSha(headSha, 'headSha')
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'checks:list', ...scope, headSha: sha }, signal)
    if (!Array.isArray(result)) throw new Error('GitHub checks response must be an array')
    const checks = result.map(validateCheckRun)
    const ids = new Set<string>()
    for (const check of checks) {
      if (ids.has(check.id)) throw new Error(`Duplicate GitHub check id: ${check.id}`)
      ids.add(check.id)
    }
    return checks.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  }

  async listReviewThreads(repository: string, number: number, signal?: AbortSignal): Promise<GitHubReviewThread[]> {
    const scope = this.#scope(repository, number)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-threads:list', ...scope }, signal)
    if (!Array.isArray(result)) throw new Error('GitHub review threads response must be an array')
    const threads = result.map(value => validateReviewThread(value, this.maxReviewBodyLength))
    uniqueIds(threads, 'GitHub review thread')
    return threads.sort((a, b) => a.id.localeCompare(b.id))
  }

  async listReviews(repository: string, number: number, signal?: AbortSignal): Promise<GitHubReview[]> {
    const scope = this.#scope(repository, number)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'reviews:list', ...scope }, signal)
    if (!Array.isArray(result)) throw new Error('GitHub reviews response must be an array')
    const reviews = result.map(validateReview)
    uniqueIds(reviews, 'GitHub review')
    return reviews.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0) || a.id.localeCompare(b.id))
  }

  async rerunFailedChecks(repository: string, number: number, expectedHeadSha: string, checkIds: string[], signal?: AbortSignal): Promise<GitHubRetryResult> {
    const scope = this.#scope(repository, number)
    const headSha = validateSha(expectedHeadSha, 'expectedHeadSha')
    const ids = normalizeIds(checkIds, 'checkIds')
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'checks:rerun-failed', ...scope, expectedHeadSha: headSha, checkIds: ids }, signal)
    if (!isRecord(result) || result.repository !== scope.repository || result.number !== scope.number || result.headSha !== headSha) throw new Error('GitHub retry response does not match request')
    const returnedIds = normalizeIds(result.checkIds as string[], 'retry checkIds')
    if (JSON.stringify(returnedIds) !== JSON.stringify(ids)) throw new Error('GitHub retry response check ids do not match request')
    return { repository: scope.repository, number: scope.number, headSha, checkIds: ids, acceptedAt: positiveTimestamp(result.acceptedAt, 'acceptedAt') }
  }

  async replyReviewThread(repository: string, number: number, threadId: string, body: string, signal?: AbortSignal): Promise<GitHubReviewComment> {
    const scope = this.#scope(repository, number)
    const id = boundedText(threadId, 'threadId', 300)
    const message = boundedText(body, 'review reply body', this.maxReviewBodyLength)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-thread:reply', ...scope, threadId: id, body: message }, signal)
    return validateReviewComment(result, this.maxReviewBodyLength)
  }

  async resolveReviewThread(repository: string, number: number, threadId: string, signal?: AbortSignal): Promise<{ threadId: string; resolved: true; resolvedAt: number }> {
    const scope = this.#scope(repository, number)
    const id = boundedText(threadId, 'threadId', 300)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-thread:resolve', ...scope, threadId: id }, signal)
    if (!isRecord(result) || result.threadId !== id || result.resolved !== true) throw new Error('GitHub review thread resolution response does not match request')
    return { threadId: id, resolved: true, resolvedAt: positiveTimestamp(result.resolvedAt, 'resolvedAt') }
  }

  async mergePullRequest(repository: string, number: number, expectedHeadSha: string, method: MergeMethod, signal?: AbortSignal): Promise<GitHubMergeResult> {
    const scope = this.#scope(repository, number)
    const headSha = validateSha(expectedHeadSha, 'expectedHeadSha')
    const mergeMethod = validateMergeMethod(method)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:merge', ...scope, expectedHeadSha: headSha, method: mergeMethod }, signal)
    if (!isRecord(result) || result.repository !== scope.repository || result.number !== scope.number || result.headSha !== headSha || result.method !== mergeMethod || result.merged !== true) throw new Error('GitHub merge response does not match request')
    return { repository: scope.repository, number: scope.number, headSha, method: mergeMethod, merged: true, mergeSha: validateSha(result.mergeSha as string, 'mergeSha'), mergedAt: positiveTimestamp(result.mergedAt, 'mergedAt') }
  }

  async closePullRequest(repository: string, number: number, signal?: AbortSignal): Promise<GitHubCleanupResult> {
    const scope = this.#scope(repository, number)
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:close', ...scope }, signal)
    return validateCleanupResult(result, scope.repository, 'pull-request', String(scope.number))
  }

  async deleteBranch(repository: string, branch: string, expectedHeadSha: string, signal?: AbortSignal): Promise<GitHubCleanupResult> {
    const repo = this.#repository(repository)
    const branchName = validateBranch(branch)
    const headSha = validateSha(expectedHeadSha, 'expectedHeadSha')
    const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'branch:delete', repository: repo, branch: branchName, expectedHeadSha: headSha }, signal)
    return validateCleanupResult(result, repo, 'branch', branchName)
  }

  #scope(repository: string, number: number): { repository: string; number: number } {
    return { repository: this.#repository(repository), number: positiveInteger(number, 'pull request number') }
  }

  #repository(repository: string): string {
    const normalized = validateRepository(repository)
    if (!this.allowedRepositories.has(normalized)) throw new Error(`GitHub repository is not allowlisted: ${normalized}`)
    return normalized
  }
}

export function validateRepository(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.length > 200 || value.includes('..')) throw new Error('GitHub repository must use safe owner/name form')
  return value
}

export function validateBranch(value: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 240 || /[\u0000-\u0020~^:?*\\[\]]/.test(value) || value.startsWith('/') || value.endsWith('/') || value.endsWith('.') || value.includes('..') || value.includes('@{') || value.includes('//')) throw new Error('GitHub branch is invalid')
  return value
}

export function validateSha(value: string, label = 'sha'): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error(`${label} must be a 40-character Git SHA`)
  return value.toLowerCase()
}

function validatePullRequest(value: unknown, repository: string, number: number): GitHubPullRequest {
  if (!isRecord(value) || value.repository !== repository || value.number !== number) throw new Error('GitHub pull request response does not match request')
  const state = value.state
  if (state !== 'open' && state !== 'closed' && state !== 'merged') throw new Error('GitHub pull request state is invalid')
  const mergeability = value.mergeability
  if (mergeability !== 'mergeable' && mergeability !== 'conflicting' && mergeability !== 'unknown') throw new Error('GitHub mergeability is invalid')
  const createdAt = positiveTimestamp(value.createdAt, 'createdAt')
  const updatedAt = positiveTimestamp(value.updatedAt, 'updatedAt')
  if (updatedAt < createdAt) throw new Error('GitHub pull request timestamps are invalid')
  return {
    repository,
    number,
    externalId: boundedText(value.externalId, 'externalId', 300),
    url: safeUrl(value.url, 'pull request url'),
    title: boundedText(value.title, 'title', 500),
    state,
    draft: boolean(value.draft, 'draft'),
    baseBranch: validateBranch(value.baseBranch as string),
    headBranch: validateBranch(value.headBranch as string),
    baseSha: validateSha(value.baseSha as string, 'baseSha'),
    headSha: validateSha(value.headSha as string, 'headSha'),
    mergeability,
    author: boundedText(value.author, 'author', 200),
    createdAt,
    updatedAt,
    ...(value.mergedAt !== undefined ? { mergedAt: positiveTimestamp(value.mergedAt, 'mergedAt') } : {}),
    ...(value.closedAt !== undefined ? { closedAt: positiveTimestamp(value.closedAt, 'closedAt') } : {}),
  }
}

function validateCheckRun(value: unknown): GitHubCheckRun {
  if (!isRecord(value)) throw new Error('GitHub check run is invalid')
  const status = value.status
  if (status !== 'queued' && status !== 'in_progress' && status !== 'completed') throw new Error('GitHub check status is invalid')
  const conclusion = value.conclusion
  if (![null, 'success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale'].includes(conclusion as never)) throw new Error('GitHub check conclusion is invalid')
  if (status !== 'completed' && conclusion !== null) throw new Error('Incomplete GitHub check cannot have a conclusion')
  if (status === 'completed' && conclusion === null) throw new Error('Completed GitHub check requires a conclusion')
  return {
    id: boundedText(value.id, 'check id', 300),
    name: boundedText(value.name, 'check name', 300),
    status,
    conclusion: conclusion as CheckConclusion,
    required: boolean(value.required, 'required'),
    ...(value.app !== undefined ? { app: boundedText(value.app, 'check app', 200) } : {}),
    ...(value.url !== undefined ? { url: safeUrl(value.url, 'check url') } : {}),
    ...(value.startedAt !== undefined ? { startedAt: positiveTimestamp(value.startedAt, 'startedAt') } : {}),
    ...(value.completedAt !== undefined ? { completedAt: positiveTimestamp(value.completedAt, 'completedAt') } : {}),
  }
}

function validateReviewThread(value: unknown, maxBody: number): GitHubReviewThread {
  if (!isRecord(value) || !Array.isArray(value.comments) || value.comments.length === 0) throw new Error('GitHub review thread is invalid')
  const comments = value.comments.map(comment => validateReviewComment(comment, maxBody))
  uniqueIds(comments, 'GitHub review comment')
  return {
    id: boundedText(value.id, 'thread id', 300),
    resolved: boolean(value.resolved, 'resolved'),
    outdated: boolean(value.outdated, 'outdated'),
    ...(value.path !== undefined ? { path: safePath(value.path) } : {}),
    ...(value.line !== undefined ? { line: positiveInteger(value.line, 'review line') } : {}),
    comments: comments.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
  }
}

function validateReviewComment(value: unknown, maxBody: number): GitHubReviewComment {
  if (!isRecord(value)) throw new Error('GitHub review comment is invalid')
  return {
    id: boundedText(value.id, 'comment id', 300),
    author: boundedText(value.author, 'comment author', 200),
    body: boundedText(value.body, 'comment body', maxBody),
    createdAt: positiveTimestamp(value.createdAt, 'comment createdAt'),
    ...(value.updatedAt !== undefined ? { updatedAt: positiveTimestamp(value.updatedAt, 'comment updatedAt') } : {}),
    ...(value.url !== undefined ? { url: safeUrl(value.url, 'comment url') } : {}),
  }
}

function validateReview(value: unknown): GitHubReview {
  if (!isRecord(value)) throw new Error('GitHub review is invalid')
  const state = value.state
  if (!['approved', 'changes_requested', 'commented', 'dismissed', 'pending'].includes(state as string)) throw new Error('GitHub review state is invalid')
  return {
    id: boundedText(value.id, 'review id', 300),
    author: boundedText(value.author, 'review author', 200),
    state: state as ReviewState,
    ...(value.submittedAt !== undefined ? { submittedAt: positiveTimestamp(value.submittedAt, 'submittedAt') } : {}),
    ...(value.commitSha !== undefined ? { commitSha: validateSha(value.commitSha as string, 'review commitSha') } : {}),
  }
}

function validateCleanupResult(value: unknown, repository: string, resource: 'pull-request' | 'branch', identifier: string): GitHubCleanupResult {
  if (!isRecord(value) || value.repository !== repository || value.resource !== resource || value.identifier !== identifier) throw new Error('GitHub cleanup response does not match request')
  return { repository, resource, identifier, completedAt: positiveTimestamp(value.completedAt, 'completedAt') }
}

function normalizeIds(value: string[], label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error(`${label} must contain 1-100 ids`)
  const ids = value.map(id => boundedText(id, label, 300)).sort()
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicates`)
  return ids
}

function uniqueIds(values: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>()
  for (const value of values) {
    if (ids.has(value.id)) throw new Error(`Duplicate ${label} id: ${value.id}`)
    ids.add(value.id)
  }
}

function safePath(value: unknown): string {
  const text = boundedText(value, 'review path', 1_000)
  if (text.startsWith('/') || text.includes('\\') || text.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Review path is invalid')
  return text
}

function safeUrl(value: unknown, label: string): string {
  const text = boundedText(value, label, 2_000)
  let url: URL
  try { url = new URL(text) }
  catch { throw new Error(`${label} is invalid`) }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be credential-free HTTPS`)
  return url.toString()
}

function validateMergeMethod(value: string): MergeMethod {
  if (value !== 'merge' && value !== 'squash' && value !== 'rebase') throw new Error('Merge method is invalid')
  return value
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${label} must be a positive integer`)
  return value as number
}

function positiveTimestamp(value: unknown, label: string): number {
  if (!Number.isFinite(value) || (value as number) <= 0) throw new Error(`${label} must be a positive timestamp`)
  return value as number
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
