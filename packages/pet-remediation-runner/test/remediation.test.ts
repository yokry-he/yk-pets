import assert from 'node:assert/strict'
import test from 'node:test'
import { FileTransactionExecutor, InMemoryWorkspaceAdapter } from '../../pet-file-transaction/src/index.ts'
import { PATCH_PLAN_SCHEMA, sha256Hex, type PatchPlan } from '../../pet-patch-plan/src/index.ts'
import {
  ScopeApprovalAuthority,
  ScopeApprovalGate,
  WebCryptoHmacApprovalSigner,
  createExactPathScopes,
} from '../../pet-scope-approval/src/index.ts'
import {
  MemoryRemediationAuditSink,
  RemediationRunner,
  toPublicRemediationResult,
} from '../src/index.ts'

const secret = new Uint8Array(32).fill(4)
async function plan(required = false): Promise<PatchPlan> {
  return {
    schema: PATCH_PLAN_SCHEMA,
    id: 'plan-remediate', projectId: 'demo', createdAt: 100, summary: 'Remediate source',
    changes: [{ id: 'edit', operation: 'update', path: 'src/App.ts', expectedSha256: await sha256Hex('old'), edits: [{ start: 0, end: 3, expectedText: 'old', replacement: 'new' }] }],
    verification: { required },
  }
}

async function setup(options: {
  verify?: (context: any) => any
  required?: boolean
  timeoutMs?: number
  failure?: (input: { operation: 'write' | 'delete'; path: string; count: number }) => Error | undefined
} = {}) {
  const value = await plan(options.required)
  const adapter = new InMemoryWorkspaceAdapter('demo', { 'src/App.ts': 'old' }, { failure: options.failure })
  const transactions = new FileTransactionExecutor(adapter)
  const signer = new WebCryptoHmacApprovalSigner(secret)
  const authority = new ScopeApprovalAuthority(signer)
  const approvals = new ScopeApprovalGate(signer)
  const audit = new MemoryRemediationAuditSink()
  const runner = new RemediationRunner({ approvals, transactions, verify: options.verify, verificationTimeoutMs: options.timeoutMs ?? 100, audit })
  const issued = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), maxChangedBytes: 100 })
  return { value, adapter, runner, audit, token: issued.token, authority, approvals }
}

test('dry run previews without approval consumption or file writes', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', dryRun: true })
  assert.equal(result.status, 'previewed')
  assert.equal(setupValue.adapter.mutationCount, 0)
  assert.equal(result.approval, undefined)
  assert.deepEqual(await setupValue.adapter.files(), { 'src/App.ts': 'old' })
})

test('approved modification applies when verification is optional', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'applied')
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'new')
  assert.equal(result.transaction?.status, 'committed')
})

test('missing approval fails closed before transaction', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user' })
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /approval token is required/)
  assert.equal(setupValue.adapter.mutationCount, 0)
})

test('approval subject mismatch fails without writes', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'other', approvalToken: setupValue.token })
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /subject/)
  assert.equal(setupValue.adapter.mutationCount, 0)
})

test('required verification without adapter rolls back automatically', async () => {
  const setupValue = await setup({ required: true })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'rolled-back')
  assert.match(result.error ?? '', /no verification adapter/)
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'old')
})

test('failed verification rolls back committed changes', async () => {
  const setupValue = await setup({ required: true, verify: () => ({ passed: false, summary: 'tests failed' }) })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'rolled-back')
  assert.equal(result.verification?.passed, false)
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'old')
  assert.deepEqual(result.audit.slice(-3).map(event => event.stage), ['verification-failed', 'rollback-started', 'rollback-complete'])
})

test('successful verification keeps committed changes', async () => {
  const setupValue = await setup({ required: true, verify: ({ transaction }) => ({ passed: transaction.status === 'committed', summary: 'checks passed' }) })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'applied')
  assert.equal(result.verification?.summary, 'checks passed')
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'new')
})

test('verification exceptions trigger rollback', async () => {
  const setupValue = await setup({ required: true, verify: () => { throw new Error('CI unavailable') } })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'rolled-back')
  assert.match(result.error ?? '', /CI unavailable/)
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'old')
})

test('verification timeout triggers rollback even when adapter ignores abort', async () => {
  const setupValue = await setup({ required: true, timeoutMs: 10, verify: () => new Promise(() => {}) })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'rolled-back')
  assert.match(result.error ?? '', /timed out/)
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'old')
})

test('transaction failure is surfaced without running verification', async () => {
  let verificationCalls = 0
  const setupValue = await setup({ verify: () => { verificationCalls += 1; return { passed: true } }, failure: ({ count }) => count === 1 ? new Error('disk read-only') : undefined })
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /disk read-only/)
  assert.equal(verificationCalls, 0)
})

test('approval token cannot replay after successful execution', async () => {
  const setupValue = await setup()
  const first = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(first.status, 'applied')
  if (!first.transaction) throw new Error('missing transaction')
  await setupValue.runner.transactions.rollback(first.transaction)
  const replay = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(replay.status, 'failed')
  assert.match(replay.error ?? '', /already been used/)
})

test('public result redacts approval nonce and rollback source contents', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  const publicResult = toPublicRemediationResult(result)
  assert.equal(publicResult.approval?.jti, '[redacted]')
  assert.equal(JSON.stringify(publicResult.transaction?.journal).includes('old'), false)
})

test('audit sink receives the same ordered stages returned by the run', async () => {
  const setupValue = await setup()
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.deepEqual(setupValue.audit.list().map(event => event.stage), result.audit.map(event => event.stage))
  assert.equal(result.audit.at(-1)?.stage, 'completed')
})

test('caller abort before execution prevents approval consumption and writes', async () => {
  const setupValue = await setup()
  const controller = new AbortController()
  controller.abort(new Error('user cancelled'))
  const result = await setupValue.runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token, signal: controller.signal })
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /user cancelled/)
  assert.equal(setupValue.adapter.mutationCount, 0)
})

test('audit sink failure cannot strand or bypass an approved transaction', async () => {
  const setupValue = await setup()
  const runner = new RemediationRunner({
    approvals: setupValue.runner.approvals,
    transactions: setupValue.runner.transactions,
    audit: { write: () => { throw new Error('telemetry offline') } },
  })
  const result = await runner.execute({ plan: setupValue.value, subject: 'user', approvalToken: setupValue.token })
  assert.equal(result.status, 'applied')
  assert.equal((await setupValue.adapter.files())['src/App.ts'], 'new')
  assert.equal(result.audit.at(-1)?.stage, 'completed')
})
