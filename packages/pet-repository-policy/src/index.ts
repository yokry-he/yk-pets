/** Fail-closed repository and pre-commit policy for controlled YK Pets changes. */

import { normalizeProjectPath, sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan'

export const REPOSITORY_GATE_SCHEMA = 'yk-pets.repository-gate/v1' as const
export type RepositoryChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked'
export type GateCheckStatus = 'passed' | 'failed' | 'warning'
export type ValidationStatus = 'passed' | 'failed' | 'skipped'
export type SecretSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface RepositoryChange {
  path: string
  oldPath?: string
  status: RepositoryChangeStatus
  staged: boolean
  bytesAdded?: number
  bytesDeleted?: number
}

export interface RepositorySnapshot {
  repositoryId: string
  projectId: string
  branch: string | null
  headRevision: string
  detached: boolean
  clean: boolean
  changes: RepositoryChange[]
}

export interface ValidationEvidence {
  id: string
  status: ValidationStatus
  summary: string
  startedAt: number
  completedAt: number
  command?: string
  artifactDigest?: string
}

export interface SecretFinding {
  id: string
  path: string
  severity: SecretSeverity
  rule: string
  line?: number
  redactedPreview?: string
}

export interface CommitGatePolicy {
  allowedBranchPrefixes?: string[]
  protectedBranches?: string[]
  protectedPathPrefixes?: string[]
  allowedPathPrefixes?: string[]
  maxFiles?: number
  maxChangedBytes?: number
  maxCommitSubjectLength?: number
  requireAllChangesStaged?: boolean
  allowUntracked?: boolean
  requireExactPathSet?: boolean
  requiredValidationIds?: string[]
  failOnSecretSeverities?: SecretSeverity[]
  forbiddenCommitSubjectPatterns?: RegExp[]
}

export interface CommitGateInput {
  snapshot: RepositorySnapshot
  expectedPaths: string[]
  expectedBaseRevision: string
  commitSubject: string
  validations?: ValidationEvidence[]
  secretFindings?: SecretFinding[]
  baselineClean?: boolean
  policy?: CommitGatePolicy
}

export interface CommitGateCheck {
  id: string
  status: GateCheckStatus
  message: string
  paths?: string[]
}

export interface CommitGateDecision {
  schema: typeof REPOSITORY_GATE_SCHEMA
  passed: boolean
  repositoryId: string
  projectId: string
  branch: string | null
  headRevision: string
  expectedBaseRevision: string
  commitSubject: string
  changedPaths: string[]
  changedBytes: number
  checks: CommitGateCheck[]
}

const DEFAULT_PROTECTED_BRANCHES = ['main', 'master', 'trunk', 'production', 'prod', 'release']
const DEFAULT_PROTECTED_PATHS = ['.git/', '.yk-pets/approvals/', '.yk-pets/secrets/', 'node_modules/', '.env', '.env.']
const DEFAULT_FORBIDDEN_SUBJECTS = [/^wip\b/i, /^fixup!/i, /^squash!/i, /\r|\n/]
const SHA_PATTERN = /^[a-f0-9]{7,64}$/i
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i

export function evaluateCommitGate(input: CommitGateInput): CommitGateDecision {
  validateSnapshot(input.snapshot)
  const policy = normalizePolicy(input.policy)
  const expectedPaths = normalizeUniquePaths(input.expectedPaths, 'expectedPaths')
  const checks: CommitGateCheck[] = []
  const actualPaths = changedPaths(input.snapshot.changes)
  const changedBytes = input.snapshot.changes.reduce((sum, change) => sum + nonNegative(change.bytesAdded ?? 0, 'bytesAdded') + nonNegative(change.bytesDeleted ?? 0, 'bytesDeleted'), 0)

  check(checks, 'baseline-clean', input.baselineClean !== false, input.baselineClean === false
    ? 'The isolated worktree was not clean before modification'
    : 'The isolated worktree started from a clean baseline')

  check(checks, 'head-revision', input.snapshot.headRevision === input.expectedBaseRevision,
    input.snapshot.headRevision === input.expectedBaseRevision
      ? 'The worktree HEAD matches the approved base revision'
      : 'The worktree HEAD does not match the approved base revision')

  check(checks, 'attached-branch', !input.snapshot.detached && input.snapshot.branch !== null,
    !input.snapshot.detached && input.snapshot.branch ? `Changes are on branch ${input.snapshot.branch}` : 'Detached HEAD is not allowed')

  const branch = input.snapshot.branch ?? ''
  const protectedBranch = policy.protectedBranches.some(name => branch === name || branch.startsWith(`${name}/`))
  check(checks, 'protected-branch', !protectedBranch,
    protectedBranch ? `Direct commits to protected branch ${branch} are forbidden` : 'The target branch is not protected')

  const allowedBranch = policy.allowedBranchPrefixes.length === 0 || policy.allowedBranchPrefixes.some(prefix => branch.startsWith(prefix))
  check(checks, 'branch-prefix', allowedBranch,
    allowedBranch ? 'The branch uses an approved prefix' : `Branch must start with one of: ${policy.allowedBranchPrefixes.join(', ')}`)

  const subjectError = validateCommitSubject(input.commitSubject, policy)
  check(checks, 'commit-subject', !subjectError, subjectError ?? 'Commit subject is valid')

  check(checks, 'changes-present', actualPaths.length > 0,
    actualPaths.length > 0 ? `${actualPaths.length} changed path(s) are present` : 'No repository changes are present')

  const extra = actualPaths.filter(path => !expectedPaths.includes(path))
  const missing = expectedPaths.filter(path => !actualPaths.includes(path))
  const exact = policy.requireExactPathSet ? extra.length === 0 && missing.length === 0 : extra.length === 0
  check(checks, 'approved-path-set', exact,
    exact ? 'Changed paths match the approved scope' : describePathMismatch(extra, missing), [...new Set([...extra, ...missing])])

  const protectedPaths = actualPaths.filter(path => isProtectedPath(path, policy.protectedPathPrefixes))
  check(checks, 'protected-paths', protectedPaths.length === 0,
    protectedPaths.length === 0 ? 'No protected repository paths are changed' : 'Protected repository paths cannot be committed', protectedPaths)

  const outsideAllowed = policy.allowedPathPrefixes.length === 0
    ? []
    : actualPaths.filter(path => !policy.allowedPathPrefixes.some(prefix => path === stripTrailing(prefix) || path.startsWith(prefix)))
  check(checks, 'allowed-path-prefixes', outsideAllowed.length === 0,
    outsideAllowed.length === 0 ? 'All changed paths are inside allowed prefixes' : 'Some changed paths are outside allowed prefixes', outsideAllowed)

  const unstaged = input.snapshot.changes.filter(change => !change.staged).flatMap(change => [normalizeProjectPath(change.path), ...(change.oldPath ? [normalizeProjectPath(change.oldPath)] : [])])
  check(checks, 'staged-state', !policy.requireAllChangesStaged || unstaged.length === 0,
    !policy.requireAllChangesStaged || unstaged.length === 0 ? 'All approved changes are staged' : 'Unstaged changes remain in the worktree', [...new Set(unstaged)].sort())

  const untracked = input.snapshot.changes.filter(change => change.status === 'untracked').map(change => normalizeProjectPath(change.path))
  check(checks, 'untracked-files', policy.allowUntracked || untracked.length === 0,
    policy.allowUntracked || untracked.length === 0 ? 'Untracked-file policy is satisfied' : 'Untracked files are not allowed', untracked)

  check(checks, 'file-budget', actualPaths.length <= policy.maxFiles,
    actualPaths.length <= policy.maxFiles ? `Changed file count is within ${policy.maxFiles}` : `Changed file count exceeds ${policy.maxFiles}`)
  check(checks, 'byte-budget', changedBytes <= policy.maxChangedBytes,
    changedBytes <= policy.maxChangedBytes ? `Changed byte estimate is within ${policy.maxChangedBytes}` : `Changed byte estimate exceeds ${policy.maxChangedBytes}`)

  const validations = normalizeValidations(input.validations ?? [])
  const validationFailures: string[] = []
  for (const id of policy.requiredValidationIds) {
    const evidence = validations.find(item => item.id === id)
    if (!evidence || evidence.status !== 'passed') validationFailures.push(id)
  }
  check(checks, 'required-validations', validationFailures.length === 0,
    validationFailures.length === 0 ? 'All required validations passed' : `Required validations did not pass: ${validationFailures.join(', ')}`)

  const secretFindings = normalizeSecretFindings(input.secretFindings ?? [])
  const blockingSecrets = secretFindings.filter(finding => policy.failOnSecretSeverities.includes(finding.severity))
  check(checks, 'secret-scan', blockingSecrets.length === 0,
    blockingSecrets.length === 0 ? 'No blocking secret findings were reported' : 'Blocking secret findings prevent commit', blockingSecrets.map(finding => finding.path))

  return {
    schema: REPOSITORY_GATE_SCHEMA,
    passed: checks.every(item => item.status !== 'failed'),
    repositoryId: input.snapshot.repositoryId,
    projectId: input.snapshot.projectId,
    branch: input.snapshot.branch,
    headRevision: input.snapshot.headRevision,
    expectedBaseRevision: input.expectedBaseRevision,
    commitSubject: input.commitSubject,
    changedPaths: actualPaths,
    changedBytes,
    checks,
  }
}

export function assertCommitGatePassed(decision: CommitGateDecision): void {
  if (decision.schema !== REPOSITORY_GATE_SCHEMA) throw new Error('Unsupported repository gate decision')
  if (!decision.passed) {
    const failed = decision.checks.filter(check => check.status === 'failed').map(check => `${check.id}: ${check.message}`)
    throw new Error(`Repository commit gate failed: ${failed.join('; ')}`)
  }
}

export async function computeCommitGateDigest(decision: CommitGateDecision): Promise<string> {
  return sha256Hex(stableStringify(decision))
}

export function createChangeBranchName(planId: string, summary: string, options: { prefix?: string; maxLength?: number } = {}): string {
  const prefix = validateBranchPrefix(options.prefix ?? 'yk-pets/')
  if (!ID_PATTERN.test(planId)) throw new Error('planId is invalid')
  const maxLength = positiveInteger(options.maxLength ?? 120, 'maxLength')
  const slug = summary
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'change'
  const suffix = planId.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 40)
  const branch = `${prefix}${slug}-${suffix}`.slice(0, maxLength).replace(/[./-]+$/g, '')
  validateBranchName(branch)
  return branch
}

export function validateBranchName(branch: string): string {
  if (typeof branch !== 'string' || branch.length === 0 || branch.length > 200) throw new Error('Branch name length is invalid')
  if (branch.startsWith('-') || branch.startsWith('/') || branch.endsWith('/') || branch.endsWith('.') || branch.includes('..') || branch.includes('@{')) throw new Error('Branch name is invalid')
  if (/\s|[~^:?*\[\\\x00-\x1f\x7f]/.test(branch) || branch.split('/').some(part => part.length === 0 || part.startsWith('.') || part.endsWith('.lock'))) throw new Error('Branch name is invalid')
  return branch
}

function validateSnapshot(snapshot: RepositorySnapshot): void {
  if (!isRecord(snapshot)) throw new Error('Repository snapshot is invalid')
  boundedText(snapshot.repositoryId, 'repositoryId', 200)
  boundedText(snapshot.projectId, 'projectId', 200)
  if (snapshot.branch !== null) validateBranchName(snapshot.branch)
  if (typeof snapshot.detached !== 'boolean' || typeof snapshot.clean !== 'boolean') throw new Error('Repository snapshot flags are invalid')
  if (typeof snapshot.headRevision !== 'string' || !SHA_PATTERN.test(snapshot.headRevision)) throw new Error('Repository head revision is invalid')
  if (!Array.isArray(snapshot.changes)) throw new Error('Repository changes are invalid')
  for (const change of snapshot.changes) validateChange(change)
}

function validateChange(change: RepositoryChange): void {
  if (!isRecord(change) || !['added', 'modified', 'deleted', 'renamed', 'copied', 'untracked'].includes(change.status)) throw new Error('Repository change is invalid')
  normalizeProjectPath(change.path)
  if (change.oldPath !== undefined) normalizeProjectPath(change.oldPath)
  if ((change.status === 'renamed' || change.status === 'copied') && !change.oldPath) throw new Error(`${change.status} change requires oldPath`)
  if (typeof change.staged !== 'boolean') throw new Error('Repository change staged flag is invalid')
  if (change.bytesAdded !== undefined) nonNegative(change.bytesAdded, 'bytesAdded')
  if (change.bytesDeleted !== undefined) nonNegative(change.bytesDeleted, 'bytesDeleted')
}

function normalizePolicy(policy: CommitGatePolicy = {}): Required<CommitGatePolicy> {
  return {
    allowedBranchPrefixes: (policy.allowedBranchPrefixes ?? ['yk-pets/']).map(validateBranchPrefix),
    protectedBranches: (policy.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES).map(branch => validateBranchName(branch)),
    protectedPathPrefixes: (policy.protectedPathPrefixes ?? DEFAULT_PROTECTED_PATHS).map(normalizePrefix),
    allowedPathPrefixes: (policy.allowedPathPrefixes ?? []).map(normalizePrefix),
    maxFiles: positiveInteger(policy.maxFiles ?? 100, 'maxFiles'),
    maxChangedBytes: positiveInteger(policy.maxChangedBytes ?? 5_000_000, 'maxChangedBytes'),
    maxCommitSubjectLength: positiveInteger(policy.maxCommitSubjectLength ?? 72, 'maxCommitSubjectLength'),
    requireAllChangesStaged: policy.requireAllChangesStaged ?? true,
    allowUntracked: policy.allowUntracked ?? false,
    requireExactPathSet: policy.requireExactPathSet ?? true,
    requiredValidationIds: [...new Set((policy.requiredValidationIds ?? []).map(id => boundedText(id, 'validation id', 100)))].sort(),
    failOnSecretSeverities: [...new Set<SecretSeverity>(policy.failOnSecretSeverities ?? (['high', 'critical'] as SecretSeverity[]))],
    forbiddenCommitSubjectPatterns: policy.forbiddenCommitSubjectPatterns ?? DEFAULT_FORBIDDEN_SUBJECTS,
  }
}

function validateCommitSubject(subject: string, policy: Required<CommitGatePolicy>): string | null {
  if (typeof subject !== 'string') return 'Commit subject must be a string'
  const trimmed = subject.trim()
  if (trimmed !== subject || trimmed.length === 0) return 'Commit subject must be non-empty and have no surrounding whitespace'
  if (new TextEncoder().encode(subject).byteLength > policy.maxCommitSubjectLength) return `Commit subject exceeds ${policy.maxCommitSubjectLength} bytes`
  if (subject.endsWith('.')) return 'Commit subject must not end with a period'
  for (const pattern of policy.forbiddenCommitSubjectPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(subject)) return `Commit subject matches forbidden pattern ${String(pattern)}`
  }
  return null
}

function normalizeValidations(input: ValidationEvidence[]): ValidationEvidence[] {
  const ids = new Set<string>()
  return input.map(item => {
    if (!isRecord(item)) throw new Error('Validation evidence is invalid')
    const id = boundedText(item.id, 'validation id', 100)
    if (ids.has(id)) throw new Error(`Duplicate validation evidence: ${id}`)
    ids.add(id)
    if (!['passed', 'failed', 'skipped'].includes(item.status)) throw new Error(`Validation ${id} status is invalid`)
    boundedText(item.summary, `validation ${id} summary`, 1_000)
    if (!Number.isFinite(item.startedAt) || !Number.isFinite(item.completedAt) || item.startedAt <= 0 || item.completedAt < item.startedAt) throw new Error(`Validation ${id} timestamps are invalid`)
    if (item.command !== undefined) boundedText(item.command, `validation ${id} command`, 500)
    if (item.artifactDigest !== undefined && !/^[a-f0-9]{64}$/.test(item.artifactDigest)) throw new Error(`Validation ${id} artifact digest is invalid`)
    return { ...item }
  })
}

function normalizeSecretFindings(input: SecretFinding[]): SecretFinding[] {
  const ids = new Set<string>()
  return input.map(finding => {
    if (!isRecord(finding)) throw new Error('Secret finding is invalid')
    const id = boundedText(finding.id, 'secret finding id', 100)
    if (ids.has(id)) throw new Error(`Duplicate secret finding: ${id}`)
    ids.add(id)
    const path = normalizeProjectPath(finding.path)
    if (!['low', 'medium', 'high', 'critical'].includes(finding.severity)) throw new Error(`Secret finding ${id} severity is invalid`)
    boundedText(finding.rule, `secret finding ${id} rule`, 200)
    if (finding.line !== undefined && (!Number.isInteger(finding.line) || finding.line <= 0)) throw new Error(`Secret finding ${id} line is invalid`)
    if (finding.redactedPreview !== undefined) boundedText(finding.redactedPreview, `secret finding ${id} preview`, 200)
    return { ...finding, path }
  })
}

function changedPaths(changes: RepositoryChange[]): string[] {
  const paths = new Set<string>()
  for (const change of changes) {
    paths.add(normalizeProjectPath(change.path))
    if (change.oldPath) paths.add(normalizeProjectPath(change.oldPath))
  }
  return [...paths].sort()
}

function normalizeUniquePaths(paths: string[], label: string): string[] {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error(`${label} must contain at least one path`)
  const normalized = paths.map(path => normalizeProjectPath(path))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicate paths`)
  return normalized.sort()
}

function describePathMismatch(extra: string[], missing: string[]): string {
  const parts: string[] = []
  if (extra.length) parts.push(`unapproved: ${extra.join(', ')}`)
  if (missing.length) parts.push(`missing: ${missing.join(', ')}`)
  return `Changed paths do not match approved scope (${parts.join('; ')})`
}

function isProtectedPath(path: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => path === stripTrailing(prefix) || path.startsWith(prefix))
}

function normalizePrefix(prefix: string): string {
  if (typeof prefix !== 'string' || prefix.length === 0) throw new Error('Path prefix is invalid')
  const trailing = prefix.endsWith('/')
  const normalized = normalizeProjectPath(prefix, { allowTrailingSlash: trailing })
  return trailing ? normalized : normalized
}

function stripTrailing(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function validateBranchPrefix(prefix: string): string {
  if (typeof prefix !== 'string' || !prefix.endsWith('/') || prefix.length > 80) throw new Error('Branch prefix must end with /')
  validateBranchName(`${prefix}x`)
  return prefix
}

function check(checks: CommitGateCheck[], id: string, passed: boolean, message: string, paths?: string[]): void {
  checks.push({ id, status: passed ? 'passed' : 'failed', message, ...(paths && paths.length ? { paths: [...new Set(paths)].sort() } : {}) })
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number`)
  return value
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} is invalid`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
