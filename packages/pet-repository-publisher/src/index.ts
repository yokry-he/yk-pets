/** Controlled staging, commit, push, draft pull request, and ledger orchestration. */

import {
  CommitLedger,
  type CommitLedgerEntry,
  type DraftPullRequestRecord,
} from '@yk-pets/pet-commit-ledger'
import { GitWorktreeCoordinator, type GitCommitAuthor, type GitCommitResult, type GitPushResult } from '@yk-pets/pet-git-worktree'
import { normalizeProjectPath, sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan'
import {
  assertCommitGatePassed,
  computeCommitGateDigest,
  evaluateCommitGate,
  validateBranchName,
  type CommitGateDecision,
  type CommitGatePolicy,
  type SecretFinding,
  type ValidationEvidence,
} from '@yk-pets/pet-repository-policy'
import {
  InMemoryApprovalReplayStore,
  type ApprovalReplayStore,
  type ApprovalTokenSigner,
} from '@yk-pets/pet-scope-approval'

export const PUBLISH_APPROVAL_SCHEMA = 'yk-pets.publish-approval/v1' as const
const TOKEN_PREFIX = 'yk-pets-publish-v1'
const MAX_TTL_MS = 10 * 60_000
export type PublishAction = 'commit' | 'push' | 'pr-draft'

export interface PublishApprovalClaims {
  schema: typeof PUBLISH_APPROVAL_SCHEMA
  jti: string
  subject: string
  projectId: string
  repositoryId: string
  sessionId: string
  planId: string
  planDigest: string
  baseRevision: string
  branch: string
  commitSubject: string
  actions: PublishAction[]
  remote?: string
  pullRequestRepository?: string
  pullRequestBaseBranch?: string
  issuedAt: number
  expiresAt: number
  reason?: string
}

export interface PublishApprovalIssueRequest extends Omit<PublishApprovalClaims, 'schema' | 'jti' | 'issuedAt' | 'expiresAt'> {
  ttlMs?: number
  now?: number
  jti?: string
}

export interface PublishAuthorizationRequest {
  token: string
  subject: string
  projectId: string
  repositoryId: string
  sessionId: string
  planId: string
  planDigest: string
  baseRevision: string
  branch: string
  commitSubject: string
  actions: PublishAction[]
  remote?: string
  pullRequestRepository?: string
  pullRequestBaseBranch?: string
  now?: number
}

export interface PullRequestDraftRequest {
  provider: string
  repository: string
  title: string
  body: string
  baseBranch: string
  headBranch: string
  expectedCommitSha: string
  draft: true
}

export interface PullRequestDraftResult {
  provider: string
  repository: string
  baseBranch: string
  headBranch: string
  title: string
  createdAt: number
  draft: true
  number?: number
  url?: string
  externalId?: string
}

export interface PullRequestDraftAdapter {
  createDraft(request: PullRequestDraftRequest, signal?: AbortSignal): Promise<PullRequestDraftResult>
}

export interface GitHubDraftPullRequestInvoker {
  (input: {
    repositoryFullName: string
    title: string
    body: string
    head: string
    base: string
    draft: true
    expectedCommitSha: string
  }, signal?: AbortSignal): Promise<{
    repositoryFullName?: string
    number?: number
    url?: string
    externalId?: string
    createdAt?: number
    draft?: boolean
    head?: string
    base?: string
    title?: string
  }>
}

export function createGitHubDraftPullRequestAdapter(invoke: GitHubDraftPullRequestInvoker, now: () => number = Date.now): PullRequestDraftAdapter {
  if (typeof invoke !== 'function') throw new Error('GitHub pull request invoker must be a function')
  return {
    async createDraft(request, signal) {
      if (request.provider !== 'github') throw new Error('GitHub adapter only accepts provider "github"')
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.repository)) throw new Error('GitHub repository must use owner/name form')
      const result = await invoke({
        repositoryFullName: request.repository,
        title: request.title,
        body: request.body,
        head: request.headBranch,
        base: request.baseBranch,
        draft: true,
        expectedCommitSha: request.expectedCommitSha,
      }, signal)
      if (!isRecord(result) || result.draft === false || (result.repositoryFullName !== undefined && result.repositoryFullName !== request.repository) || (result.head !== undefined && result.head !== request.headBranch) || (result.base !== undefined && result.base !== request.baseBranch)) {
        throw new Error('GitHub draft pull request response does not match request')
      }
      return {
        provider: 'github',
        repository: request.repository,
        baseBranch: request.baseBranch,
        headBranch: request.headBranch,
        title: result.title ?? request.title,
        createdAt: result.createdAt ?? now(),
        draft: true,
        ...(result.number !== undefined ? { number: result.number } : {}),
        ...(result.url !== undefined ? { url: result.url } : {}),
        ...(result.externalId !== undefined ? { externalId: result.externalId } : {}),
      }
    },
  }
}

export interface RepositoryPublishRequest {
  approvalToken: string
  subject: string
  sessionId: string
  planId: string
  planDigest: string
  approvalId: string
  expectedPaths: string[]
  commitSubject: string
  commitBody?: string
  author?: GitCommitAuthor
  validations?: ValidationEvidence[]
  secretFindings?: SecretFinding[]
  gatePolicy?: CommitGatePolicy
  push?: { remote: string; setUpstream?: boolean }
  pullRequest?: {
    provider: string
    repository: string
    baseBranch: string
    title?: string
    body: string
  }
  metadata?: Record<string, string | number | boolean | null>
}

export interface RepositoryPublishResult {
  status: 'committed' | 'pushed' | 'draft-created' | 'partial'
  commit: GitCommitResult
  push?: GitPushResult
  pullRequest?: PullRequestDraftResult
  gate: CommitGateDecision
  ledger: CommitLedgerEntry
  error?: string
}

export class PublishApprovalAuthority {
  readonly signer: ApprovalTokenSigner
  readonly now: () => number

  constructor(signer: ApprovalTokenSigner, now: () => number = Date.now) {
    this.signer = signer
    this.now = now
  }

  async issue(request: PublishApprovalIssueRequest): Promise<{ token: string; claims: PublishApprovalClaims }> {
    const now = request.now ?? this.now()
    const ttlMs = positiveInteger(request.ttlMs ?? 60_000, 'ttlMs')
    if (ttlMs > MAX_TTL_MS) throw new Error(`Publish approval ttlMs cannot exceed ${MAX_TTL_MS}`)
    const claims: PublishApprovalClaims = {
      schema: PUBLISH_APPROVAL_SCHEMA,
      jti: request.jti ?? randomId(),
      subject: boundedText(request.subject, 'subject', 200),
      projectId: boundedText(request.projectId, 'projectId', 200),
      repositoryId: boundedText(request.repositoryId, 'repositoryId', 200),
      sessionId: validateId(request.sessionId, 'sessionId'),
      planId: validateId(request.planId, 'planId'),
      planDigest: validateDigest(request.planDigest, 'planDigest'),
      baseRevision: validateSha(request.baseRevision, 'baseRevision'),
      branch: validateBranchName(request.branch),
      commitSubject: validateCommitSubject(request.commitSubject),
      actions: normalizeActions(request.actions),
      remote: request.remote === undefined ? undefined : validateRemote(request.remote),
      pullRequestRepository: request.pullRequestRepository === undefined ? undefined : boundedText(request.pullRequestRepository, 'pullRequestRepository', 300),
      pullRequestBaseBranch: request.pullRequestBaseBranch === undefined ? undefined : validateBranchName(request.pullRequestBaseBranch),
      issuedAt: now,
      expiresAt: now + ttlMs,
      reason: request.reason === undefined ? undefined : boundedText(request.reason, 'reason', 500),
    }
    validatePublishClaims(claims)
    return { claims: clone(claims), token: await encodePublishApprovalToken(claims, this.signer) }
  }
}

export class PublishApprovalGate {
  readonly signer: ApprovalTokenSigner
  readonly replay: ApprovalReplayStore
  readonly now: () => number
  readonly maxClockSkewMs: number

  constructor(signer: ApprovalTokenSigner, options: { replay?: ApprovalReplayStore; now?: () => number; maxClockSkewMs?: number } = {}) {
    this.signer = signer
    this.replay = options.replay ?? new InMemoryApprovalReplayStore()
    this.now = options.now ?? Date.now
    this.maxClockSkewMs = nonNegativeInteger(options.maxClockSkewMs ?? 5_000, 'maxClockSkewMs')
  }

  async authorize(request: PublishAuthorizationRequest): Promise<PublishApprovalClaims> {
    const claims = await decodeAndVerifyPublishApprovalToken(request.token, this.signer)
    const now = request.now ?? this.now()
    if (claims.issuedAt > now + this.maxClockSkewMs) throw new Error('Publish approval was issued in the future')
    if (claims.expiresAt <= now) throw new Error('Publish approval has expired')
    const comparisons: Array<[unknown, unknown, string]> = [
      [claims.subject, request.subject, 'subject'], [claims.projectId, request.projectId, 'project'], [claims.repositoryId, request.repositoryId, 'repository'],
      [claims.sessionId, request.sessionId, 'session'], [claims.planId, request.planId, 'plan id'], [claims.planDigest, request.planDigest, 'plan digest'],
      [claims.baseRevision, request.baseRevision, 'base revision'], [claims.branch, request.branch, 'branch'], [claims.commitSubject, request.commitSubject, 'commit subject'],
      [claims.remote, request.remote, 'remote'], [claims.pullRequestRepository, request.pullRequestRepository, 'pull request repository'],
      [claims.pullRequestBaseBranch, request.pullRequestBaseBranch, 'pull request base branch'],
    ]
    for (const [actual, expected, label] of comparisons) if (actual !== expected) throw new Error(`Publish approval ${label} does not match`)
    const requestedActions = normalizeActions(request.actions)
    if (stableStringify(claims.actions) !== stableStringify(requestedActions)) throw new Error('Publish approval actions do not match')
    await this.replay.purge?.(now)
    if (!await this.replay.consume(claims.jti, claims.expiresAt, now)) throw new Error('Publish approval has already been used')
    return clone(claims)
  }
}

export class RepositoryPublisher {
  readonly worktrees: GitWorktreeCoordinator
  readonly approvals: PublishApprovalGate
  readonly ledger: CommitLedger
  readonly pullRequests?: PullRequestDraftAdapter
  readonly idFactory: () => string

  constructor(options: { worktrees: GitWorktreeCoordinator; approvals: PublishApprovalGate; ledger: CommitLedger; pullRequests?: PullRequestDraftAdapter; idFactory?: () => string }) {
    this.worktrees = options.worktrees
    this.approvals = options.approvals
    this.ledger = options.ledger
    this.pullRequests = options.pullRequests
    this.idFactory = options.idFactory ?? (() => `record-${crypto.randomUUID()}`)
  }

  async publish(request: RepositoryPublishRequest, signal?: AbortSignal): Promise<RepositoryPublishResult> {
    throwIfAborted(signal)
    const session = this.worktrees.get(request.sessionId)
    if (session.state !== 'open') throw new Error(`Repository session must be open, not ${session.state}`)
    validateDigest(request.planDigest, 'planDigest')
    validateId(request.planId, 'planId')
    validateId(request.approvalId, 'approvalId')
    const expectedPaths = normalizePaths(request.expectedPaths)
    const actions: PublishAction[] = ['commit']
    if (request.push) actions.push('push')
    if (request.pullRequest) actions.push('pr-draft')
    if (request.pullRequest && !request.push) throw new Error('Draft pull request requires an explicit push request')
    if (request.pullRequest && !this.pullRequests) throw new Error('Draft pull request adapter is not configured')

    await this.approvals.authorize({
      token: request.approvalToken,
      subject: request.subject,
      projectId: session.projectId,
      repositoryId: session.repositoryId,
      sessionId: session.sessionId,
      planId: request.planId,
      planDigest: request.planDigest,
      baseRevision: session.baseRevision,
      branch: session.branch,
      commitSubject: request.commitSubject,
      actions,
      remote: request.push?.remote,
      pullRequestRepository: request.pullRequest?.repository,
      pullRequestBaseBranch: request.pullRequest?.baseBranch,
    })

    await this.worktrees.stage(session.sessionId, expectedPaths, signal)
    const snapshot = await this.worktrees.snapshot(session.sessionId, signal)
    const gate = evaluateCommitGate({
      snapshot,
      expectedPaths,
      expectedBaseRevision: session.baseRevision,
      commitSubject: request.commitSubject,
      validations: request.validations,
      secretFindings: request.secretFindings,
      baselineClean: true,
      policy: request.gatePolicy,
    })
    assertCommitGatePassed(gate)
    const gateDigest = await computeCommitGateDigest(gate)
    const validationDigests = await digestValidations(request.validations ?? [])
    const commit = await this.worktrees.commit(session.sessionId, { subject: request.commitSubject, body: request.commitBody, author: request.author }, signal)

    let push: GitPushResult | undefined
    let pullRequest: PullRequestDraftResult | undefined
    let publicationError: string | undefined
    if (request.push) {
      try { push = await this.worktrees.push(session.sessionId, request.push, signal) }
      catch (error) { publicationError = `Push failed after commit: ${errorMessage(error)}` }
    }
    if (!publicationError && request.pullRequest && push) {
      try {
        const result = await this.pullRequests!.createDraft({
          provider: boundedText(request.pullRequest.provider, 'PR provider', 100),
          repository: boundedText(request.pullRequest.repository, 'PR repository', 300),
          title: boundedText(request.pullRequest.title ?? request.commitSubject, 'PR title', 300),
          body: validatePullRequestBody(request.pullRequest.body),
          baseBranch: validateBranchName(request.pullRequest.baseBranch),
          headBranch: session.branch,
          expectedCommitSha: commit.commitSha,
          draft: true,
        }, signal)
        pullRequest = validatePullRequestResult(result, session.branch, request.pullRequest.repository, request.pullRequest.baseBranch)
      }
      catch (error) { publicationError = `Draft pull request failed after push: ${errorMessage(error)}` }
    }

    const ledger = await this.ledger.append({
      id: validateId(this.idFactory(), 'record id'),
      projectId: session.projectId,
      repositoryId: session.repositoryId,
      sessionId: session.sessionId,
      planId: request.planId,
      planDigest: request.planDigest,
      approvalId: request.approvalId,
      baseRevision: session.baseRevision,
      branch: session.branch,
      commit: { sha: commit.commitSha, treeSha: commit.treeSha, parentShas: commit.parentShas, subject: request.commitSubject, committedAt: commit.committedAt },
      gateDigest,
      validationDigests,
      changedPaths: gate.changedPaths,
      ...(push ? { push } : {}),
      ...(pullRequest ? { pullRequest: toPullRequestRecord(pullRequest) } : {}),
      metadata: { ...(request.metadata ?? {}), ...(publicationError ? { publicationError } : {}) },
    })

    const status: RepositoryPublishResult['status'] = publicationError ? 'partial' : pullRequest ? 'draft-created' : push ? 'pushed' : 'committed'
    return { status, commit, gate, ledger, ...(push ? { push } : {}), ...(pullRequest ? { pullRequest } : {}), ...(publicationError ? { error: publicationError } : {}) }
  }
}

export async function encodePublishApprovalToken(claims: PublishApprovalClaims, signer: ApprovalTokenSigner): Promise<string> {
  validatePublishClaims(claims)
  const payload = base64UrlEncode(new TextEncoder().encode(stableStringify(claims)))
  const input = new TextEncoder().encode(`${TOKEN_PREFIX}.${payload}`)
  return `${TOKEN_PREFIX}.${payload}.${base64UrlEncode(await signer.sign(input))}`
}

export async function decodeAndVerifyPublishApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<PublishApprovalClaims> {
  if (typeof token !== 'string' || token.length > 32_000) throw new Error('Publish approval token is invalid')
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw new Error('Publish approval token format is invalid')
  const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  if (!await signer.verify(input, base64UrlDecode(parts[2]!))) throw new Error('Publish approval token signature is invalid')
  let claims: unknown
  try { claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]!))) }
  catch { throw new Error('Publish approval token payload is invalid') }
  validatePublishClaims(claims)
  return clone(claims)
}

export function validatePublishClaims(value: unknown): asserts value is PublishApprovalClaims {
  if (!isRecord(value) || value.schema !== PUBLISH_APPROVAL_SCHEMA) throw new Error('Unsupported publish approval schema')
  validateId(value.jti, 'jti')
  boundedText(value.subject, 'subject', 200)
  boundedText(value.projectId, 'projectId', 200)
  boundedText(value.repositoryId, 'repositoryId', 200)
  validateId(value.sessionId, 'sessionId')
  validateId(value.planId, 'planId')
  validateDigest(value.planDigest, 'planDigest')
  validateSha(value.baseRevision, 'baseRevision')
  validateBranchName(value.branch)
  validateCommitSubject(value.commitSubject)
  const actions = normalizeActions(value.actions)
  if (actions.includes('push') !== (value.remote !== undefined)) throw new Error('Publish approval remote/action mismatch')
  if (value.remote !== undefined) validateRemote(value.remote)
  const wantsPr = actions.includes('pr-draft')
  if (wantsPr !== (value.pullRequestRepository !== undefined && value.pullRequestBaseBranch !== undefined)) throw new Error('Publish approval pull request scope mismatch')
  if (value.pullRequestRepository !== undefined) boundedText(value.pullRequestRepository, 'pullRequestRepository', 300)
  if (value.pullRequestBaseBranch !== undefined) validateBranchName(value.pullRequestBaseBranch)
  if (!Number.isFinite(value.issuedAt) || !Number.isFinite(value.expiresAt) || value.expiresAt <= value.issuedAt || value.expiresAt - value.issuedAt > MAX_TTL_MS) throw new Error('Publish approval timestamps are invalid')
  if (value.reason !== undefined) boundedText(value.reason, 'reason', 500)
}

function toPullRequestRecord(value: PullRequestDraftResult): DraftPullRequestRecord {
  return {
    provider: value.provider,
    repository: value.repository,
    baseBranch: value.baseBranch,
    headBranch: value.headBranch,
    title: value.title,
    createdAt: value.createdAt,
    ...(value.number !== undefined ? { number: value.number } : {}),
    ...(value.url !== undefined ? { url: value.url } : {}),
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
  }
}

function validatePullRequestResult(value: PullRequestDraftResult, branch: string, repository: string, baseBranch: string): PullRequestDraftResult {
  if (!isRecord(value) || value.draft !== true || value.headBranch !== branch || value.repository !== repository || value.baseBranch !== baseBranch) throw new Error('Draft pull request result does not match the request')
  boundedText(value.provider, 'PR provider', 100)
  boundedText(value.title, 'PR title', 300)
  if (!Number.isFinite(value.createdAt) || value.createdAt <= 0) throw new Error('PR timestamp is invalid')
  if (value.number !== undefined && (!Number.isInteger(value.number) || value.number <= 0)) throw new Error('PR number is invalid')
  if (value.url !== undefined) validateHttpsUrl(value.url, 'PR URL')
  if (value.externalId !== undefined) boundedText(value.externalId, 'PR externalId', 300)
  return clone(value)
}

async function digestValidations(validations: ValidationEvidence[]): Promise<Record<string, string>> {
  const output: Record<string, string> = {}
  for (const evidence of [...validations].sort((a, b) => a.id.localeCompare(b.id))) output[evidence.id] = await sha256Hex(stableStringify(evidence))
  return output
}

function normalizeActions(actions: PublishAction[]): PublishAction[] {
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('Publish actions cannot be empty')
  const allowed = new Set<PublishAction>(['commit', 'push', 'pr-draft'])
  const output = [...new Set(actions)]
  for (const action of output) if (!allowed.has(action)) throw new Error(`Invalid publish action: ${String(action)}`)
  if (!output.includes('commit')) throw new Error('Publish approval must include commit')
  if (output.includes('pr-draft') && !output.includes('push')) throw new Error('Draft pull request approval requires push')
  return output.sort()
}

function normalizePaths(paths: string[]): string[] {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('expectedPaths cannot be empty')
  const output = paths.map(path => normalizeProjectPath(path)).sort()
  if (new Set(output).size !== output.length) throw new Error('expectedPaths contains duplicates')
  return output
}

function validateCommitSubject(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('commitSubject is invalid')
  return value
}

function validatePullRequestBody(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 50_000 || value.includes('\u0000')) throw new Error('PR body is invalid')
  return value
}

function validateRemote(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value) || value.startsWith('-')) throw new Error('remote is invalid')
  return value
}

function validateHttpsUrl(value: string, label: string): void {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} is invalid`)
}

function validateSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/i.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function validateDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function validateId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function positiveInteger(value: number, label: string): number { if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`); return value }
function nonNegativeInteger(value: number, label: string): number { if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`); return value }
function randomId(): string { return crypto.randomUUID() }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted') }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function clone<T>(value: T): T { if (typeof structuredClone === 'function') return structuredClone(value); return JSON.parse(JSON.stringify(value)) as T }

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Publish approval base64url segment is invalid')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  let binary: string
  try { binary = atob(padded) } catch { throw new Error('Publish approval base64url segment is invalid') }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  if (base64UrlEncode(bytes) !== value) throw new Error('Publish approval base64url segment is non-canonical')
  return bytes
}
