/** Controlled remote collaboration and release lifecycle orchestration. */

import { GitHubProvider, type GitHubMergeResult, type GitHubRetryResult, type MergeMethod } from '@yk-pets/pet-github-provider'
import type { GitWorktreeCoordinator, RepositorySession } from '@yk-pets/pet-git-worktree'
import { assertMergeEligible, evaluateMergeGate, type MergeGateDecision, type MergeGatePolicy } from '@yk-pets/pet-merge-gate'
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan'
import { PullRequestSynchronizer, type PullRequestSyncResult } from '@yk-pets/pet-pr-lifecycle'
import { ReviewPlanExecutor, validateReviewActionPlan, type ReviewActionPlan, type ReviewExecutionResult } from '@yk-pets/pet-review-governance'
import { InMemoryApprovalReplayStore, type ApprovalReplayStore, type ApprovalTokenSigner } from '@yk-pets/pet-scope-approval'

export const REMOTE_APPROVAL_SCHEMA = 'yk-pets.remote-approval/v1' as const
const TOKEN_PREFIX = 'yk-pets-remote-v1'
const MAX_TTL_MS = 10 * 60_000
export type RemoteAction = 'retry-failed-checks' | 'apply-review-plan' | 'merge' | 'cleanup-after-merge'

export interface RemoteApprovalClaims {
  schema: typeof REMOTE_APPROVAL_SCHEMA
  jti: string
  subject: string
  repository: string
  number: number
  headSha: string
  snapshotDigest: string
  action: RemoteAction
  resourceDigest: string
  mergeMethod?: MergeMethod
  sessionId?: string
  issuedAt: number
  expiresAt: number
  reason?: string
}

export interface RemoteApprovalIssueRequest extends Omit<RemoteApprovalClaims, 'schema' | 'jti' | 'issuedAt' | 'expiresAt'> {
  ttlMs?: number
  now?: number
  jti?: string
}

export interface RemoteAuthorizationRequest {
  token: string
  subject: string
  repository: string
  number: number
  headSha: string
  snapshotDigest: string
  action: RemoteAction
  resourceDigest: string
  mergeMethod?: MergeMethod
  sessionId?: string
  now?: number
}

export class RemoteApprovalAuthority {
  readonly signer: ApprovalTokenSigner
  readonly now: () => number
  constructor(signer: ApprovalTokenSigner, now: () => number = Date.now) { this.signer = signer; this.now = now }
  async issue(request: RemoteApprovalIssueRequest): Promise<{ token: string; claims: RemoteApprovalClaims }> {
    const now = request.now ?? this.now()
    const ttlMs = positiveInteger(request.ttlMs ?? 60_000, 'ttlMs')
    if (ttlMs > MAX_TTL_MS) throw new Error(`Remote approval ttlMs cannot exceed ${MAX_TTL_MS}`)
    const claims: RemoteApprovalClaims = {
      schema: REMOTE_APPROVAL_SCHEMA,
      jti: request.jti ?? crypto.randomUUID(),
      subject: boundedText(request.subject, 'subject', 200),
      repository: validateRepository(request.repository),
      number: positiveInteger(request.number, 'pull request number'),
      headSha: validateSha(request.headSha, 'headSha'),
      snapshotDigest: validateDigest(request.snapshotDigest, 'snapshotDigest'),
      action: validateAction(request.action),
      resourceDigest: validateDigest(request.resourceDigest, 'resourceDigest'),
      ...(request.mergeMethod !== undefined ? { mergeMethod: validateMergeMethod(request.mergeMethod) } : {}),
      ...(request.sessionId !== undefined ? { sessionId: validateId(request.sessionId, 'sessionId') } : {}),
      issuedAt: now,
      expiresAt: now + ttlMs,
      ...(request.reason !== undefined ? { reason: boundedText(request.reason, 'reason', 500) } : {}),
    }
    validateRemoteApprovalClaims(claims)
    return { claims: clone(claims), token: await encodeRemoteApprovalToken(claims, this.signer) }
  }
}

export class RemoteApprovalGate {
  readonly signer: ApprovalTokenSigner
  readonly replay: ApprovalReplayStore
  readonly now: () => number
  readonly maxClockSkewMs: number
  constructor(signer: ApprovalTokenSigner, options: { replay?: ApprovalReplayStore; now?: () => number; maxClockSkewMs?: number } = {}) {
    this.signer = signer; this.replay = options.replay ?? new InMemoryApprovalReplayStore(); this.now = options.now ?? Date.now; this.maxClockSkewMs = nonNegativeInteger(options.maxClockSkewMs ?? 5_000, 'maxClockSkewMs')
  }
  async authorize(request: RemoteAuthorizationRequest): Promise<RemoteApprovalClaims> {
    const claims = await decodeAndVerifyRemoteApprovalToken(request.token, this.signer)
    const now = request.now ?? this.now()
    if (claims.issuedAt > now + this.maxClockSkewMs) throw new Error('Remote approval was issued in the future')
    if (claims.expiresAt <= now) throw new Error('Remote approval has expired')
    const fields: Array<[unknown, unknown, string]> = [
      [claims.subject, request.subject, 'subject'], [claims.repository, request.repository, 'repository'], [claims.number, request.number, 'pull request number'],
      [claims.headSha, request.headSha, 'head SHA'], [claims.snapshotDigest, request.snapshotDigest, 'snapshot digest'], [claims.action, request.action, 'action'],
      [claims.resourceDigest, request.resourceDigest, 'resource digest'], [claims.mergeMethod, request.mergeMethod, 'merge method'], [claims.sessionId, request.sessionId, 'session'],
    ]
    for (const [actual, expected, label] of fields) if (actual !== expected) throw new Error(`Remote approval ${label} does not match`)
    await this.replay.purge?.(now)
    if (!await this.replay.consume(claims.jti, claims.expiresAt, now)) throw new Error('Remote approval has already been used')
    return clone(claims)
  }
}

export interface RemoteReleaseCoordinatorOptions {
  provider: GitHubProvider
  synchronizer: PullRequestSynchronizer
  approvals: RemoteApprovalGate
  reviews?: ReviewPlanExecutor
  worktrees?: GitWorktreeCoordinator
  now?: () => number
}

export interface RetryFailedChecksRequest { approvalToken: string; subject: string; repository: string; number: number; expectedHeadSha: string }
export interface ApplyReviewPlanRequest { approvalToken: string; subject: string; plan: ReviewActionPlan }
export interface MergePullRequestRequest { approvalToken: string; subject: string; repository: string; number: number; expectedHeadSha: string; method: MergeMethod; policy: MergeGatePolicy }
export interface CleanupAfterMergeRequest { approvalToken: string; subject: string; repository: string; number: number; expectedHeadSha: string; deleteBranch?: boolean; sessionId?: string; forceLocalCleanup?: boolean }

export interface CleanupAfterMergeResult {
  status: 'complete' | 'partial'
  branchDeleted: boolean
  session?: RepositorySession
  completedAt: number
  errors: string[]
}

export class RemoteReleaseCoordinator {
  readonly provider: GitHubProvider
  readonly synchronizer: PullRequestSynchronizer
  readonly approvals: RemoteApprovalGate
  readonly reviews: ReviewPlanExecutor
  readonly worktrees?: GitWorktreeCoordinator
  readonly now: () => number

  constructor(options: RemoteReleaseCoordinatorOptions) {
    this.provider = options.provider
    this.synchronizer = options.synchronizer
    this.approvals = options.approvals
    this.reviews = options.reviews ?? new ReviewPlanExecutor(options.provider, options.now)
    this.worktrees = options.worktrees
    this.now = options.now ?? Date.now
  }

  sync(repository: string, number: number, expectedHeadSha?: string, signal?: AbortSignal): Promise<PullRequestSyncResult> {
    return this.synchronizer.sync(repository, number, { ...(expectedHeadSha ? { expectedHeadSha } : {}), signal })
  }

  async retryFailedChecks(request: RetryFailedChecksRequest, signal?: AbortSignal): Promise<{ lifecycle: PullRequestSyncResult; retry: GitHubRetryResult; resourceDigest: string }> {
    const lifecycle = await this.sync(request.repository, request.number, request.expectedHeadSha, signal)
    const ids = lifecycle.snapshot.checks
      .filter(check => check.status === 'completed' && ['failure', 'cancelled', 'timed_out', 'action_required', 'stale'].includes(check.conclusion ?? ''))
      .map(check => check.id).sort()
    if (ids.length === 0) throw new Error('No failed checks are eligible for retry')
    const resourceDigest = await sha256Hex(stableStringify({ checkIds: ids }))
    await this.approvals.authorize({ token: request.approvalToken, subject: request.subject, repository: request.repository, number: request.number, headSha: lifecycle.snapshot.pullRequest.headSha, snapshotDigest: lifecycle.snapshot.digest, action: 'retry-failed-checks', resourceDigest })
    const retry = await this.provider.rerunFailedChecks(request.repository, request.number, lifecycle.snapshot.pullRequest.headSha, ids, signal)
    return { lifecycle, retry, resourceDigest }
  }

  async applyReviewPlan(request: ApplyReviewPlanRequest, signal?: AbortSignal): Promise<{ lifecycle: PullRequestSyncResult; execution: ReviewExecutionResult }> {
    await validateReviewActionPlan(request.plan)
    const lifecycle = await this.sync(request.plan.repository, request.plan.number, request.plan.headSha, signal)
    if (lifecycle.snapshot.digest !== request.plan.snapshotDigest) throw new Error('Review plan lifecycle snapshot is stale')
    await this.approvals.authorize({ token: request.approvalToken, subject: request.subject, repository: request.plan.repository, number: request.plan.number, headSha: request.plan.headSha, snapshotDigest: request.plan.snapshotDigest, action: 'apply-review-plan', resourceDigest: request.plan.digest })
    const execution = await this.reviews.execute(request.plan, lifecycle.snapshot, signal)
    return { lifecycle, execution }
  }

  async merge(request: MergePullRequestRequest, signal?: AbortSignal): Promise<{ lifecycle: PullRequestSyncResult; gate: MergeGateDecision; merge: GitHubMergeResult }> {
    const lifecycle = await this.sync(request.repository, request.number, request.expectedHeadSha, signal)
    const gate = await evaluateMergeGate(lifecycle.snapshot, request.policy, this.now())
    assertMergeEligible(gate, request.method)
    await this.approvals.authorize({ token: request.approvalToken, subject: request.subject, repository: request.repository, number: request.number, headSha: lifecycle.snapshot.pullRequest.headSha, snapshotDigest: lifecycle.snapshot.digest, action: 'merge', resourceDigest: gate.digest, mergeMethod: request.method })
    const merge = await this.provider.mergePullRequest(request.repository, request.number, lifecycle.snapshot.pullRequest.headSha, request.method, signal)
    return { lifecycle, gate, merge }
  }

  async cleanupAfterMerge(request: CleanupAfterMergeRequest, signal?: AbortSignal): Promise<CleanupAfterMergeResult> {
    const lifecycle = await this.sync(request.repository, request.number, request.expectedHeadSha, signal)
    if (lifecycle.snapshot.pullRequest.state !== 'merged') throw new Error('Post-release cleanup requires a merged pull request')
    if (request.deleteBranch !== true && request.sessionId === undefined) throw new Error('Cleanup request has no approved operation')
    const resourceDigest = await cleanupResourceDigest({ branch: lifecycle.snapshot.pullRequest.headBranch, headSha: lifecycle.snapshot.pullRequest.headSha, deleteBranch: request.deleteBranch === true, sessionId: request.sessionId, forceLocalCleanup: request.forceLocalCleanup ?? false })
    await this.approvals.authorize({ token: request.approvalToken, subject: request.subject, repository: request.repository, number: request.number, headSha: lifecycle.snapshot.pullRequest.headSha, snapshotDigest: lifecycle.snapshot.digest, action: 'cleanup-after-merge', resourceDigest, ...(request.sessionId ? { sessionId: request.sessionId } : {}) })
    const errors: string[] = []
    let branchDeleted = false
    let session: RepositorySession | undefined
    if (request.deleteBranch === true) {
      try { await this.provider.deleteBranch(request.repository, lifecycle.snapshot.pullRequest.headBranch, lifecycle.snapshot.pullRequest.headSha, signal); branchDeleted = true }
      catch (error) { errors.push(`remote branch cleanup failed: ${errorMessage(error)}`) }
    }
    if (request.sessionId !== undefined) {
      if (!this.worktrees) errors.push('local worktree cleanup is not configured')
      else {
        try { session = await this.worktrees.close(request.sessionId, { force: request.forceLocalCleanup ?? false }, signal) }
        catch (error) { errors.push(`local worktree cleanup failed: ${errorMessage(error)}`) }
      }
    }
    return { status: errors.length === 0 ? 'complete' : 'partial', branchDeleted, ...(session ? { session } : {}), completedAt: this.now(), errors }
  }
}

export async function cleanupResourceDigest(value: { branch: string; headSha: string; deleteBranch: boolean; sessionId?: string; forceLocalCleanup?: boolean }): Promise<string> {
  return sha256Hex(stableStringify(value))
}

export async function encodeRemoteApprovalToken(claims: RemoteApprovalClaims, signer: ApprovalTokenSigner): Promise<string> {
  validateRemoteApprovalClaims(claims)
  const payload = base64UrlEncode(new TextEncoder().encode(stableStringify(claims)))
  const input = new TextEncoder().encode(`${TOKEN_PREFIX}.${payload}`)
  return `${TOKEN_PREFIX}.${payload}.${base64UrlEncode(await signer.sign(input))}`
}

export async function decodeAndVerifyRemoteApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<RemoteApprovalClaims> {
  if (typeof token !== 'string' || token.length > 32_000) throw new Error('Remote approval token is invalid')
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw new Error('Remote approval token format is invalid')
  const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  if (!await signer.verify(input, base64UrlDecode(parts[2]!))) throw new Error('Remote approval token signature is invalid')
  let claims: unknown
  try { claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]!))) }
  catch { throw new Error('Remote approval token payload is invalid') }
  validateRemoteApprovalClaims(claims)
  return clone(claims)
}

export function validateRemoteApprovalClaims(value: unknown): asserts value is RemoteApprovalClaims {
  if (!isRecord(value) || value.schema !== REMOTE_APPROVAL_SCHEMA) throw new Error('Unsupported remote approval schema')
  validateId(value.jti, 'jti'); boundedText(value.subject, 'subject', 200); validateRepository(value.repository); positiveInteger(value.number, 'pull request number')
  validateSha(value.headSha, 'headSha'); validateDigest(value.snapshotDigest, 'snapshotDigest'); validateAction(value.action); validateDigest(value.resourceDigest, 'resourceDigest')
  if (value.action === 'merge' ? value.mergeMethod === undefined : value.mergeMethod !== undefined) throw new Error('Remote approval merge method/action mismatch')
  if (value.mergeMethod !== undefined) validateMergeMethod(value.mergeMethod)
  if (value.action === 'cleanup-after-merge' ? false : value.sessionId !== undefined) throw new Error('Remote approval session is only valid for cleanup')
  if (value.sessionId !== undefined) validateId(value.sessionId, 'sessionId')
  if (!Number.isFinite(value.issuedAt) || !Number.isFinite(value.expiresAt) || value.expiresAt <= value.issuedAt || value.expiresAt - value.issuedAt > MAX_TTL_MS) throw new Error('Remote approval timestamps are invalid')
  if (value.reason !== undefined) boundedText(value.reason, 'reason', 500)
}

function validateAction(value: unknown): RemoteAction { if (!['retry-failed-checks', 'apply-review-plan', 'merge', 'cleanup-after-merge'].includes(value as string)) throw new Error('Remote action is invalid'); return value as RemoteAction }
function validateMergeMethod(value: unknown): MergeMethod { if (value !== 'merge' && value !== 'squash' && value !== 'rebase') throw new Error('Merge method is invalid'); return value }
function validateRepository(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.includes('..')) throw new Error('Repository is invalid'); return value }
function validateSha(value: unknown, label: string): string { if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error(`${label} is invalid`); return value.toLowerCase() }
function validateDigest(value: unknown, label: string): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is invalid`); return value }
function validateId(value: unknown, label: string): string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$/.test(value)) throw new Error(`${label} is invalid`); return value }
function boundedText(value: unknown, label: string, max: number): string { if (typeof value !== 'string' || value.trim().length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`); return value }
function positiveInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${label} must be a positive integer`); return value as number }
function nonNegativeInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`); return value as number }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function clone<T>(value: T): T { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T }
function base64UrlEncode(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') }
function base64UrlDecode(value: string): Uint8Array { if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Remote approval base64url segment is invalid'); const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); let binary: string; try { binary = atob(padded) } catch { throw new Error('Remote approval base64url segment is invalid') }; const bytes = Uint8Array.from(binary, character => character.charCodeAt(0)); if (base64UrlEncode(bytes) !== value) throw new Error('Remote approval base64url segment is non-canonical'); return bytes }
