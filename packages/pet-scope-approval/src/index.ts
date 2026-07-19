/** Signed, one-time approvals bound to an exact patch plan and narrow file scope. */

import {
  computePatchPlanDigest,
  normalizeProjectPath,
  summarizePatchPlan,
  touchedPaths,
  validatePatchPlan,
  type PatchOperation,
  type PatchPlan,
} from '@yk-pets/pet-patch-plan'

export const SCOPE_APPROVAL_SCHEMA = 'yk-pets.scope-approval/v1' as const
const TOKEN_PREFIX = 'yk-pets-approval-v1'
const MAX_TOKEN_TTL_MS = 10 * 60_000
const OPERATION_SET = new Set<PatchOperation>(['create', 'update', 'delete', 'move'])

export type ApprovalPathScope =
  | { kind: 'file'; path: string; operations?: PatchOperation[] }
  | { kind: 'directory'; path: string; operations?: PatchOperation[] }

export interface ScopeApprovalClaims {
  schema: typeof SCOPE_APPROVAL_SCHEMA
  jti: string
  subject: string
  projectId: string
  planId: string
  planDigest: string
  issuedAt: number
  expiresAt: number
  allowedOperations: PatchOperation[]
  pathScopes: ApprovalPathScope[]
  maxFiles: number
  maxChangedBytes: number
  origin?: string
  baseRevision?: string
  reason?: string
}

export interface ScopeApprovalIssueRequest {
  subject: string
  pathScopes: ApprovalPathScope[]
  allowedOperations?: PatchOperation[]
  ttlMs?: number
  maxFiles?: number
  maxChangedBytes?: number
  origin?: string
  baseRevision?: string
  reason?: string
  now?: number
  jti?: string
}

export interface ApprovalAuthorizationRequest {
  token: string
  plan: PatchPlan
  subject: string
  projectId?: string
  origin?: string
  baseRevision?: string
  actualChangedBytes?: number
  now?: number
}

export interface ApprovalTokenSigner {
  sign(data: Uint8Array): Promise<Uint8Array>
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>
}

export interface ApprovalReplayStore {
  consume(jti: string, expiresAt: number, now: number): Promise<boolean> | boolean
  purge?(now: number): Promise<void> | void
}

export class InMemoryApprovalReplayStore implements ApprovalReplayStore {
  #consumed = new Map<string, number>()

  consume(jti: string, expiresAt: number, now: number): boolean {
    this.purge(now)
    if (this.#consumed.has(jti)) return false
    this.#consumed.set(jti, expiresAt)
    return true
  }

  purge(now: number): void {
    for (const [jti, expiry] of this.#consumed) if (expiry <= now) this.#consumed.delete(jti)
  }

  get size(): number { return this.#consumed.size }
}

export class WebCryptoHmacApprovalSigner implements ApprovalTokenSigner {
  readonly #keyPromise: Promise<CryptoKey>

  constructor(secret: Uint8Array) {
    if (!(secret instanceof Uint8Array) || secret.byteLength < 32) throw new Error('Approval HMAC secret must contain at least 32 bytes')
    const cryptoApi = requireCrypto()
    this.#keyPromise = cryptoApi.subtle.importKey('raw', secret.slice(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const signature = await requireCrypto().subtle.sign('HMAC', await this.#keyPromise, data)
    return new Uint8Array(signature)
  }

  async verify(data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return requireCrypto().subtle.verify('HMAC', await this.#keyPromise, signature, data)
  }
}

export class ScopeApprovalAuthority {
  readonly signer: ApprovalTokenSigner
  readonly now: () => number

  constructor(signer: ApprovalTokenSigner, now: () => number = Date.now) {
    this.signer = signer
    this.now = now
  }

  async issue(plan: PatchPlan, request: ScopeApprovalIssueRequest): Promise<{ token: string; claims: ScopeApprovalClaims }> {
    validatePatchPlan(plan)
    const now = request.now ?? this.now()
    const ttlMs = positiveInteger(request.ttlMs ?? 60_000, 'ttlMs')
    if (ttlMs > MAX_TOKEN_TTL_MS) throw new Error(`Approval ttlMs cannot exceed ${MAX_TOKEN_TTL_MS}`)
    const summary = summarizePatchPlan(plan)
    const claims: ScopeApprovalClaims = {
      schema: SCOPE_APPROVAL_SCHEMA,
      jti: request.jti ?? randomId(),
      subject: boundedText(request.subject, 'subject', 200),
      projectId: plan.projectId,
      planId: plan.id,
      planDigest: await computePatchPlanDigest(plan),
      issuedAt: now,
      expiresAt: now + ttlMs,
      allowedOperations: normalizeOperations(request.allowedOperations ?? operationsFromPlan(plan)),
      pathScopes: normalizePathScopes(request.pathScopes),
      maxFiles: positiveInteger(request.maxFiles ?? summary.touchedPaths.length, 'maxFiles'),
      maxChangedBytes: nonNegativeInteger(request.maxChangedBytes ?? summary.estimatedChangedBytes, 'maxChangedBytes'),
      origin: request.origin === undefined ? undefined : normalizeOrigin(request.origin),
      baseRevision: request.baseRevision ?? plan.baseRevision,
      reason: request.reason === undefined ? undefined : boundedText(request.reason, 'reason', 500),
    }
    validateClaims(claims)
    assertPlanWithinClaims(plan, claims, summary.estimatedChangedBytes)
    return { token: await encodeApprovalToken(claims, this.signer), claims: clone(claims) }
  }
}

export class ScopeApprovalGate {
  readonly signer: ApprovalTokenSigner
  readonly replay: ApprovalReplayStore
  readonly now: () => number
  readonly maxClockSkewMs: number

  constructor(
    signer: ApprovalTokenSigner,
    options: { replay?: ApprovalReplayStore; now?: () => number; maxClockSkewMs?: number } = {},
  ) {
    this.signer = signer
    this.replay = options.replay ?? new InMemoryApprovalReplayStore()
    this.now = options.now ?? Date.now
    this.maxClockSkewMs = nonNegativeInteger(options.maxClockSkewMs ?? 5_000, 'maxClockSkewMs')
  }

  async authorize(request: ApprovalAuthorizationRequest): Promise<ScopeApprovalClaims> {
    validatePatchPlan(request.plan)
    const now = request.now ?? this.now()
    const claims = await decodeAndVerifyApprovalToken(request.token, this.signer)
    validateClaims(claims)
    if (claims.issuedAt > now + this.maxClockSkewMs) throw new Error('Approval token was issued in the future')
    if (claims.expiresAt <= now) throw new Error('Approval token has expired')
    if (claims.subject !== request.subject) throw new Error('Approval subject does not match')
    if (claims.projectId !== (request.projectId ?? request.plan.projectId)) throw new Error('Approval project does not match')
    if (claims.planId !== request.plan.id) throw new Error('Approval plan id does not match')
    const digest = await computePatchPlanDigest(request.plan)
    if (claims.planDigest !== digest) throw new Error('Approval plan digest does not match')
    if (claims.origin !== undefined && claims.origin !== normalizeOriginRequired(request.origin)) throw new Error('Approval origin does not match')
    if (claims.baseRevision !== undefined && claims.baseRevision !== request.baseRevision) throw new Error('Approval base revision does not match')
    assertPlanWithinClaims(request.plan, claims, request.actualChangedBytes)
    await this.replay.purge?.(now)
    if (!await this.replay.consume(claims.jti, claims.expiresAt, now)) throw new Error('Approval token has already been used')
    return clone(claims)
  }
}

export function createExactPathScopes(plan: PatchPlan): ApprovalPathScope[] {
  return touchedPaths(plan).map(path => ({ kind: 'file', path }))
}

export async function encodeApprovalToken(claims: ScopeApprovalClaims, signer: ApprovalTokenSigner): Promise<string> {
  validateClaims(claims)
  const payload = base64UrlEncode(new TextEncoder().encode(stableStringify(claims)))
  const signingInput = new TextEncoder().encode(`${TOKEN_PREFIX}.${payload}`)
  const signature = base64UrlEncode(await signer.sign(signingInput))
  return `${TOKEN_PREFIX}.${payload}.${signature}`
}

export async function decodeAndVerifyApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<ScopeApprovalClaims> {
  if (typeof token !== 'string' || token.length > 32_000) throw new Error('Approval token is invalid')
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw new Error('Approval token format is invalid')
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlDecode(parts[2]!)
  if (!await signer.verify(signingInput, signature)) throw new Error('Approval token signature is invalid')
  let claims: unknown
  try { claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]!))) }
  catch { throw new Error('Approval token payload is invalid') }
  validateClaims(claims)
  return clone(claims)
}

export function assertPlanWithinClaims(plan: PatchPlan, claims: ScopeApprovalClaims, actualChangedBytes?: number): void {
  validatePatchPlan(plan)
  validateClaims(claims)
  const summary = summarizePatchPlan(plan)
  if (summary.touchedPaths.length > claims.maxFiles) throw new Error('Patch plan exceeds approved file count')
  const changedBytes = actualChangedBytes ?? summary.estimatedChangedBytes
  if (!Number.isInteger(changedBytes) || changedBytes < 0) throw new Error('actualChangedBytes is invalid')
  if (changedBytes > claims.maxChangedBytes) throw new Error('Patch plan exceeds approved changed byte budget')
  const allowed = new Set(claims.allowedOperations)
  for (const change of plan.changes) {
    if (!allowed.has(change.operation)) throw new Error(`Patch operation is not approved: ${change.operation}`)
    const paths = change.operation === 'move' ? [change.fromPath, change.toPath] : [change.path]
    for (const rawPath of paths) {
      const path = normalizeProjectPath(rawPath)
      if (!claims.pathScopes.some(scope => pathScopeMatches(scope, path, change.operation))) {
        throw new Error(`Patch path is outside approval scope: ${path}`)
      }
    }
  }
}

export function validateClaims(value: unknown): asserts value is ScopeApprovalClaims {
  if (!isRecord(value) || value.schema !== SCOPE_APPROVAL_SCHEMA) throw new Error('Unsupported approval schema')
  boundedText(value.jti, 'jti', 200)
  boundedText(value.subject, 'subject', 200)
  boundedText(value.projectId, 'projectId', 200)
  boundedText(value.planId, 'planId', 200)
  if (typeof value.planDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.planDigest)) throw new Error('planDigest is invalid')
  if (!Number.isFinite(value.issuedAt) || !Number.isFinite(value.expiresAt) || value.expiresAt <= value.issuedAt) throw new Error('Approval timestamps are invalid')
  if (value.expiresAt - value.issuedAt > MAX_TOKEN_TTL_MS) throw new Error('Approval lifetime is too long')
  normalizeOperations(value.allowedOperations)
  normalizePathScopes(value.pathScopes)
  positiveInteger(value.maxFiles, 'maxFiles')
  nonNegativeInteger(value.maxChangedBytes, 'maxChangedBytes')
  if (value.origin !== undefined && value.origin !== normalizeOrigin(value.origin)) throw new Error('origin is not normalized')
  if (value.baseRevision !== undefined) boundedText(value.baseRevision, 'baseRevision', 256)
  if (value.reason !== undefined) boundedText(value.reason, 'reason', 500)
}

function normalizePathScopes(scopes: ApprovalPathScope[]): ApprovalPathScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.length > 500) throw new Error('pathScopes must contain 1-500 entries')
  const normalized: ApprovalPathScope[] = []
  const seen = new Set<string>()
  for (const scope of scopes) {
    if (!isRecord(scope) || (scope.kind !== 'file' && scope.kind !== 'directory')) throw new Error('Approval path scope is invalid')
    const path = normalizeProjectPath(scope.path)
    const operations = scope.operations === undefined ? undefined : normalizeOperations(scope.operations)
    const key = `${scope.kind}:${path}:${operations?.join(',') ?? '*'}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ kind: scope.kind, path, operations })
  }
  return normalized.sort((a, b) => `${a.kind}:${a.path}`.localeCompare(`${b.kind}:${b.path}`))
}

function pathScopeMatches(scope: ApprovalPathScope, path: string, operation: PatchOperation): boolean {
  if (scope.operations && !scope.operations.includes(operation)) return false
  const scopePath = normalizeProjectPath(scope.path)
  return scope.kind === 'file' ? path === scopePath : path.startsWith(`${scopePath}/`)
}

function normalizeOperations(operations: PatchOperation[]): PatchOperation[] {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error('allowedOperations cannot be empty')
  const output = [...new Set(operations)]
  for (const operation of output) if (!OPERATION_SET.has(operation)) throw new Error(`Invalid approved operation: ${String(operation)}`)
  return output.sort()
}

function operationsFromPlan(plan: PatchPlan): PatchOperation[] {
  return [...new Set(plan.changes.map(change => change.operation))].sort()
}

function normalizeOrigin(input: string): string {
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
    return url.origin
  }
  catch { throw new Error('Approval origin is invalid') }
}

function normalizeOriginRequired(input: string | undefined): string {
  if (!input) throw new Error('Approval requires an origin')
  return normalizeOrigin(input)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Approval token base64url segment is invalid')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  let binary: string
  try { binary = atob(padded) }
  catch { throw new Error('Approval token base64url segment is invalid') }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  if (base64UrlEncode(bytes) !== value) throw new Error('Approval token base64url segment is non-canonical')
  return bytes
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (isRecord(value)) {
    const output: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) output[key] = sortJson(value[key])
    return output
  }
  return value
}

function randomId(): string {
  const cryptoApi = requireCrypto()
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable')
  return globalThis.crypto
}

function boundedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new Error(`${label} must be a positive integer`)
  return value as number
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`)
  return value as number
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T
}
