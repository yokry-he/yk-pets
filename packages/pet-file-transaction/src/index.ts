/** Conflict-safe file transactions and rollback journals for approved patch plans. */

import {
  applyTextEdits,
  normalizeProjectPath,
  sha256Hex,
  validatePatchPlan,
  type PatchPlan,
  type PatchPlanChange,
} from '@yk-pets/pet-patch-plan'

export type WorkspaceEntryKind = 'missing' | 'file' | 'directory' | 'symlink'

export type WorkspaceEntry =
  | { path: string; kind: 'missing' }
  | { path: string; kind: 'file'; content: string; sha256: string; size: number }
  | { path: string; kind: 'directory' | 'symlink' }

export type FileExpectation =
  | { kind: 'missing' }
  | { kind: 'file'; sha256: string }

export interface WorkspaceAdapter {
  readonly projectId: string
  read(path: string, signal?: AbortSignal): Promise<WorkspaceEntry>
  write(path: string, content: string, expected: FileExpectation, signal?: AbortSignal): Promise<Extract<WorkspaceEntry, { kind: 'file' }>>
  delete(path: string, expectedSha256: string, signal?: AbortSignal): Promise<void>
  getRevision?(signal?: AbortSignal): Promise<string | undefined>
}

export interface TransactionPreviewFile {
  changeId: string
  operation: PatchPlanChange['operation']
  path: string
  role: 'primary' | 'move-source' | 'move-target'
  before: PublicWorkspaceEntry
  after: PublicWorkspaceEntry
}

export type PublicWorkspaceEntry =
  | { kind: 'missing' }
  | { kind: 'file'; sha256: string; size: number }
  | { kind: 'directory' | 'symlink' }

export interface FileTransactionPreview {
  planId: string
  projectId: string
  revisionBefore?: string
  files: TransactionPreviewFile[]
  changedBytes: number
}

export interface TransactionJournalEntry {
  sequence: number
  changeId: string
  path: string
  primitive: 'write' | 'delete'
  before: WorkspaceEntry
  after: WorkspaceEntry
}

export type FileTransactionStatus = 'committed' | 'failed' | 'rolled-back' | 'rollback-failed'

export interface FileTransactionResult {
  transactionId: string
  planId: string
  projectId: string
  status: FileTransactionStatus
  startedAt: number
  finishedAt: number
  revisionBefore?: string
  revisionAfter?: string
  changedBytes: number
  files: TransactionPreviewFile[]
  /** Sensitive: may contain complete source file contents needed for safe rollback. */
  journal: TransactionJournalEntry[]
  error?: string
  rollbackErrors?: Array<{ path: string; error: string }>
}

export interface PublicFileTransactionSummary extends Omit<FileTransactionResult, 'journal'> {
  journal: Array<{ sequence: number; changeId: string; path: string; primitive: 'write' | 'delete'; before: PublicWorkspaceEntry; after: PublicWorkspaceEntry }>
}

interface PreparedMutation {
  changeId: string
  path: string
  primitive: 'write' | 'delete'
  before: WorkspaceEntry
  content?: string
}

interface PreparedTransaction {
  preview: FileTransactionPreview
  mutations: PreparedMutation[]
}

export class WorkspaceConflictError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'WorkspaceConflictError'
    this.path = path
  }
}

export class FileTransactionExecutor {
  readonly adapter: WorkspaceAdapter
  readonly now: () => number
  #queues = new Map<string, Promise<void>>()

  constructor(adapter: WorkspaceAdapter, now: () => number = Date.now) {
    this.adapter = adapter
    this.now = now
  }

  async preview(plan: PatchPlan, signal?: AbortSignal): Promise<FileTransactionPreview> {
    return (await this.#prepare(plan, signal)).preview
  }

  async apply(plan: PatchPlan, signal?: AbortSignal): Promise<FileTransactionResult> {
    validatePatchPlan(plan)
    if (plan.projectId !== this.adapter.projectId) throw new Error('Patch plan project does not match workspace adapter')
    return this.#withProjectLock(async () => {
      const transactionId = randomId()
      const startedAt = this.now()
      let prepared: PreparedTransaction | undefined
      const journal: TransactionJournalEntry[] = []
      try {
        prepared = await this.#prepare(plan, signal)
        for (const mutation of prepared.mutations) {
          throwIfAborted(signal)
          const after = mutation.primitive === 'write'
            ? await this.adapter.write(mutation.path, mutation.content!, expectationFor(mutation.before), signal)
            : await deleteAndReturnMissing(this.adapter, mutation.path, requireFile(mutation.before).sha256, signal)
          journal.push({
            sequence: journal.length + 1,
            changeId: mutation.changeId,
            path: mutation.path,
            primitive: mutation.primitive,
            before: cloneEntry(mutation.before),
            after: cloneEntry(after),
          })
        }
        return {
          transactionId, planId: plan.id, projectId: plan.projectId, status: 'committed', startedAt, finishedAt: this.now(),
          revisionBefore: prepared.preview.revisionBefore,
          revisionAfter: await this.adapter.getRevision?.(signal),
          changedBytes: prepared.preview.changedBytes,
          files: clone(prepared.preview.files), journal: clone(journal),
        }
      }
      catch (error) {
        const rollbackErrors = journal.length > 0 ? await this.#rollbackJournal(journal) : []
        return {
          transactionId, planId: plan.id, projectId: plan.projectId,
          status: journal.length === 0 ? 'failed' : rollbackErrors.length === 0 ? 'rolled-back' : 'rollback-failed',
          startedAt, finishedAt: this.now(), revisionBefore: prepared?.preview.revisionBefore,
          revisionAfter: await safeRevision(this.adapter), changedBytes: prepared?.preview.changedBytes ?? 0,
          files: clone(prepared?.preview.files ?? []), journal: clone(journal), error: errorMessage(error),
          rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined,
        }
      }
    })
  }

  async rollback(receipt: FileTransactionResult, signal?: AbortSignal): Promise<FileTransactionResult> {
    if (receipt.projectId !== this.adapter.projectId) throw new Error('Transaction receipt project does not match workspace adapter')
    if (receipt.status !== 'committed') throw new Error(`Only committed transactions can be rolled back, received ${receipt.status}`)
    return this.#withProjectLock(async () => {
      throwIfAborted(signal)
      const errors = await this.#rollbackJournal(receipt.journal, signal)
      return {
        ...clone(receipt),
        status: errors.length === 0 ? 'rolled-back' : 'rollback-failed',
        finishedAt: this.now(),
        revisionAfter: await safeRevision(this.adapter),
        rollbackErrors: errors.length > 0 ? errors : undefined,
        error: errors.length > 0 ? 'One or more rollback operations failed' : undefined,
      }
    })
  }

  async #prepare(plan: PatchPlan, signal?: AbortSignal): Promise<PreparedTransaction> {
    validatePatchPlan(plan)
    if (plan.projectId !== this.adapter.projectId) throw new Error('Patch plan project does not match workspace adapter')
    throwIfAborted(signal)
    const revisionBefore = await this.adapter.getRevision?.(signal)
    if (plan.baseRevision !== undefined && revisionBefore !== plan.baseRevision) {
      throw new WorkspaceConflictError('<project>', `base revision mismatch; expected ${plan.baseRevision}, received ${revisionBefore ?? 'unknown'}`)
    }
    const cache = new Map<string, WorkspaceEntry>()
    const read = async (path: string): Promise<WorkspaceEntry> => {
      const normalized = normalizeProjectPath(path)
      const existing = cache.get(normalized)
      if (existing) return cloneEntry(existing)
      const entry = normalizeEntry(await this.adapter.read(normalized, signal), normalized)
      cache.set(normalized, entry)
      return cloneEntry(entry)
    }
    const mutations: PreparedMutation[] = []
    const files: TransactionPreviewFile[] = []
    let changedBytes = 0

    for (const change of plan.changes) {
      throwIfAborted(signal)
      switch (change.operation) {
        case 'create': {
          const path = normalizeProjectPath(change.path)
          const before = await read(path)
          requireMissing(before)
          const after = await fileEntry(path, change.content)
          mutations.push({ changeId: change.id, path, primitive: 'write', before, content: change.content })
          files.push(previewFile(change.id, change.operation, path, 'primary', before, after))
          changedBytes += after.size
          cache.set(path, after)
          break
        }
        case 'update': {
          const path = normalizeProjectPath(change.path)
          const before = requireFile(await read(path))
          requireHash(before, change.expectedSha256)
          const content = applyTextEdits(before.content, change.edits)
          const after = await fileEntry(path, content)
          mutations.push({ changeId: change.id, path, primitive: 'write', before, content })
          files.push(previewFile(change.id, change.operation, path, 'primary', before, after))
          changedBytes += after.size
          cache.set(path, after)
          break
        }
        case 'delete': {
          const path = normalizeProjectPath(change.path)
          const before = requireFile(await read(path))
          requireHash(before, change.expectedSha256)
          const after: WorkspaceEntry = { path, kind: 'missing' }
          mutations.push({ changeId: change.id, path, primitive: 'delete', before })
          files.push(previewFile(change.id, change.operation, path, 'primary', before, after))
          cache.set(path, after)
          break
        }
        case 'move': {
          const fromPath = normalizeProjectPath(change.fromPath)
          const toPath = normalizeProjectPath(change.toPath)
          const source = requireFile(await read(fromPath))
          requireHash(source, change.expectedSha256)
          const target = await read(toPath)
          requireMissing(target)
          const moved = await fileEntry(toPath, source.content)
          mutations.push({ changeId: change.id, path: toPath, primitive: 'write', before: target, content: source.content })
          mutations.push({ changeId: change.id, path: fromPath, primitive: 'delete', before: source })
          files.push(previewFile(change.id, change.operation, fromPath, 'move-source', source, { path: fromPath, kind: 'missing' }))
          files.push(previewFile(change.id, change.operation, toPath, 'move-target', target, moved))
          changedBytes += moved.size
          cache.set(fromPath, { path: fromPath, kind: 'missing' })
          cache.set(toPath, moved)
          break
        }
      }
    }
    files.sort((a, b) => a.path.localeCompare(b.path) || a.role.localeCompare(b.role))
    return { preview: { planId: plan.id, projectId: plan.projectId, revisionBefore, files, changedBytes }, mutations }
  }

  async #rollbackJournal(journal: TransactionJournalEntry[], signal?: AbortSignal): Promise<Array<{ path: string; error: string }>> {
    const errors: Array<{ path: string; error: string }> = []
    for (let index = journal.length - 1; index >= 0; index -= 1) {
      const entry = journal[index]!
      try {
        throwIfAborted(signal)
        await restoreEntry(this.adapter, entry.before, entry.after, signal)
      }
      catch (error) { errors.push({ path: entry.path, error: errorMessage(error) }) }
    }
    return errors
  }

  async #withProjectLock<T>(operation: () => Promise<T>): Promise<T> {
    const key = this.adapter.projectId
    const previous = this.#queues.get(key) ?? Promise.resolve()
    let release!: () => void
    const next = new Promise<void>(resolve => { release = resolve })
    const tail = previous.then(() => next)
    this.#queues.set(key, tail)
    await previous
    try { return await operation() }
    finally {
      release()
      if (this.#queues.get(key) === tail) this.#queues.delete(key)
    }
  }
}

export class InMemoryWorkspaceAdapter implements WorkspaceAdapter {
  readonly projectId: string
  #entries = new Map<string, { kind: 'file'; content: string } | { kind: 'directory' | 'symlink' }>()
  #mutationCount = 0
  #failure?: (input: { operation: 'write' | 'delete'; path: string; count: number }) => Error | undefined

  constructor(
    projectId: string,
    initial: Record<string, string | { kind: 'directory' | 'symlink' }> = {},
    options: { failure?: (input: { operation: 'write' | 'delete'; path: string; count: number }) => Error | undefined } = {},
  ) {
    this.projectId = projectId
    this.#failure = options.failure
    for (const [path, value] of Object.entries(initial)) {
      const normalized = normalizeProjectPath(path)
      this.#entries.set(normalized, typeof value === 'string' ? { kind: 'file', content: value } : { kind: value.kind })
    }
  }

  get mutationCount(): number { return this.#mutationCount }

  setFailure(failure: ((input: { operation: 'write' | 'delete'; path: string; count: number }) => Error | undefined) | undefined): void {
    this.#failure = failure
  }

  simulateExternalWrite(path: string, content: string): void {
    this.#entries.set(normalizeProjectPath(path), { kind: 'file', content })
  }

  async read(path: string, signal?: AbortSignal): Promise<WorkspaceEntry> {
    throwIfAborted(signal)
    const normalized = normalizeProjectPath(path)
    const entry = this.#entries.get(normalized)
    if (!entry) return { path: normalized, kind: 'missing' }
    if (entry.kind !== 'file') return { path: normalized, kind: entry.kind }
    return fileEntry(normalized, entry.content)
  }

  async write(path: string, content: string, expected: FileExpectation, signal?: AbortSignal): Promise<Extract<WorkspaceEntry, { kind: 'file' }>> {
    throwIfAborted(signal)
    const normalized = normalizeProjectPath(path)
    const before = await this.read(normalized, signal)
    assertExpectation(before, expected)
    this.#mutationCount += 1
    const failure = this.#failure?.({ operation: 'write', path: normalized, count: this.#mutationCount })
    if (failure) throw failure
    this.#entries.set(normalized, { kind: 'file', content })
    return fileEntry(normalized, content)
  }

  async delete(path: string, expectedSha256: string, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    const normalized = normalizeProjectPath(path)
    const before = requireFile(await this.read(normalized, signal))
    requireHash(before, expectedSha256)
    this.#mutationCount += 1
    const failure = this.#failure?.({ operation: 'delete', path: normalized, count: this.#mutationCount })
    if (failure) throw failure
    this.#entries.delete(normalized)
  }

  async getRevision(signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal)
    const values: string[] = []
    for (const path of [...this.#entries.keys()].sort()) {
      const entry = await this.read(path, signal)
      values.push(entry.kind === 'file' ? `${path}:file:${entry.sha256}` : `${path}:${entry.kind}`)
    }
    return sha256Hex(values.join('\n'))
  }

  async files(): Promise<Record<string, string>> {
    const output: Record<string, string> = {}
    for (const [path, entry] of [...this.#entries].sort(([a], [b]) => a.localeCompare(b))) if (entry.kind === 'file') output[path] = entry.content
    return output
  }
}

export function toPublicTransactionSummary(result: FileTransactionResult): PublicFileTransactionSummary {
  return {
    ...clone(result),
    journal: result.journal.map(entry => ({
      sequence: entry.sequence,
      changeId: entry.changeId,
      path: entry.path,
      primitive: entry.primitive,
      before: publicEntry(entry.before),
      after: publicEntry(entry.after),
    })),
  }
}

async function restoreEntry(adapter: WorkspaceAdapter, before: WorkspaceEntry, after: WorkspaceEntry, signal?: AbortSignal): Promise<void> {
  if (before.kind === 'missing') {
    const afterFile = requireFile(after)
    await adapter.delete(afterFile.path, afterFile.sha256, signal)
    return
  }
  const beforeFile = requireFile(before)
  if (after.kind === 'missing') {
    await adapter.write(beforeFile.path, beforeFile.content, { kind: 'missing' }, signal)
    return
  }
  const afterFile = requireFile(after)
  await adapter.write(beforeFile.path, beforeFile.content, { kind: 'file', sha256: afterFile.sha256 }, signal)
}

function previewFile(changeId: string, operation: PatchPlanChange['operation'], path: string, role: TransactionPreviewFile['role'], before: WorkspaceEntry, after: WorkspaceEntry): TransactionPreviewFile {
  return { changeId, operation, path, role, before: publicEntry(before), after: publicEntry(after) }
}

function publicEntry(entry: WorkspaceEntry): PublicWorkspaceEntry {
  return entry.kind === 'file' ? { kind: 'file', sha256: entry.sha256, size: entry.size } : { kind: entry.kind }
}

function expectationFor(entry: WorkspaceEntry): FileExpectation {
  return entry.kind === 'missing' ? { kind: 'missing' } : { kind: 'file', sha256: requireFile(entry).sha256 }
}

function assertExpectation(actual: WorkspaceEntry, expected: FileExpectation): void {
  if (expected.kind === 'missing') {
    if (actual.kind !== 'missing') throw new WorkspaceConflictError(actual.path, `expected missing entry, received ${actual.kind}`)
    return
  }
  const file = requireFile(actual)
  requireHash(file, expected.sha256)
}

function requireMissing(entry: WorkspaceEntry): Extract<WorkspaceEntry, { kind: 'missing' }> {
  if (entry.kind !== 'missing') throw new WorkspaceConflictError(entry.path, `expected missing entry, received ${entry.kind}`)
  return entry
}

function requireFile(entry: WorkspaceEntry): Extract<WorkspaceEntry, { kind: 'file' }> {
  if (entry.kind !== 'file') throw new WorkspaceConflictError(entry.path, `expected regular file, received ${entry.kind}`)
  return entry
}

function requireHash(entry: Extract<WorkspaceEntry, { kind: 'file' }>, expected: string): void {
  if (entry.sha256 !== expected) throw new WorkspaceConflictError(entry.path, `SHA-256 mismatch; expected ${expected}, received ${entry.sha256}`)
}

async function fileEntry(path: string, content: string): Promise<Extract<WorkspaceEntry, { kind: 'file' }>> {
  return { path, kind: 'file', content, sha256: await sha256Hex(content), size: new TextEncoder().encode(content).byteLength }
}

async function deleteAndReturnMissing(adapter: WorkspaceAdapter, path: string, expectedSha256: string, signal?: AbortSignal): Promise<WorkspaceEntry> {
  await adapter.delete(path, expectedSha256, signal)
  return { path, kind: 'missing' }
}

function normalizeEntry(entry: WorkspaceEntry, expectedPath: string): WorkspaceEntry {
  if (!entry || entry.path !== expectedPath) throw new Error(`Workspace adapter returned an invalid path for ${expectedPath}`)
  if (entry.kind === 'missing' || entry.kind === 'directory' || entry.kind === 'symlink') return { path: expectedPath, kind: entry.kind }
  if (entry.kind !== 'file' || typeof entry.content !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isInteger(entry.size) || entry.size < 0) {
    throw new Error(`Workspace adapter returned an invalid file entry for ${expectedPath}`)
  }
  return cloneEntry(entry)
}

async function safeRevision(adapter: WorkspaceAdapter): Promise<string | undefined> {
  try { return await adapter.getRevision?.() }
  catch { return undefined }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted')
}

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues(bytes)
  return `txn-${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function cloneEntry(entry: WorkspaceEntry): WorkspaceEntry {
  return entry.kind === 'file' ? { ...entry } : { path: entry.path, kind: entry.kind }
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
