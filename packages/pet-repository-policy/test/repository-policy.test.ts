import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertCommitGatePassed,
  computeCommitGateDigest,
  createChangeBranchName,
  evaluateCommitGate,
  validateBranchName,
  type CommitGateInput,
} from '../src/index.ts'

const REV = 'a'.repeat(40)
function validInput(): CommitGateInput {
  return {
    expectedBaseRevision: REV,
    expectedPaths: ['src/a.ts'],
    commitSubject: 'fix: stabilize pet renderer',
    baselineClean: true,
    snapshot: {
      repositoryId: 'repo-1', projectId: 'project-1', branch: 'yk-pets/stabilize-plan-1', headRevision: REV, detached: false, clean: false,
      changes: [{ path: 'src/a.ts', status: 'modified', staged: true, bytesAdded: 12, bytesDeleted: 3 }],
    },
    validations: [{ id: 'test', status: 'passed', summary: 'ok', startedAt: 1, completedAt: 2 }],
    policy: { requiredValidationIds: ['test'] },
  }
}

test('valid exact staged change passes every gate', () => {
  const decision = evaluateCommitGate(validInput())
  assert.equal(decision.passed, true)
  assert.equal(decision.changedBytes, 15)
  assert.doesNotThrow(() => assertCommitGatePassed(decision))
})

test('protected branches and detached HEAD fail closed', () => {
  const input = validInput()
  input.snapshot.branch = 'main'
  input.snapshot.detached = true
  const decision = evaluateCommitGate(input)
  assert.equal(decision.passed, false)
  assert.match(decision.checks.filter(item => item.status === 'failed').map(item => item.id).join(','), /attached-branch/)
  assert.match(decision.checks.filter(item => item.status === 'failed').map(item => item.id).join(','), /protected-branch/)
})

test('branch must use approved prefix', () => {
  const input = validInput()
  input.snapshot.branch = 'feature/test'
  assert.equal(evaluateCommitGate(input).passed, false)
})

test('unapproved and missing paths fail exact scope', () => {
  const input = validInput()
  input.snapshot.changes.push({ path: 'src/extra.ts', status: 'added', staged: true })
  const decision = evaluateCommitGate(input)
  assert.equal(decision.passed, false)
  assert.deepEqual(decision.checks.find(item => item.id === 'approved-path-set')?.paths, ['src/extra.ts'])
})

test('protected paths cannot be committed even if expected', () => {
  const input = validInput()
  input.expectedPaths = ['.env']
  input.snapshot.changes = [{ path: '.env', status: 'modified', staged: true }]
  const decision = evaluateCommitGate(input)
  assert.equal(decision.passed, false)
  assert.equal(decision.checks.find(item => item.id === 'protected-paths')?.status, 'failed')
})

test('unstaged and untracked changes fail by default', () => {
  const input = validInput()
  input.snapshot.changes = [{ path: 'src/a.ts', status: 'untracked', staged: false }]
  const failed = evaluateCommitGate(input).checks.filter(item => item.status === 'failed').map(item => item.id)
  assert.ok(failed.includes('staged-state'))
  assert.ok(failed.includes('untracked-files'))
})

test('file and byte budgets are enforced', () => {
  const input = validInput()
  input.policy = { maxFiles: 1, maxChangedBytes: 10 }
  input.snapshot.changes[0]!.bytesAdded = 11
  const decision = evaluateCommitGate(input)
  assert.equal(decision.checks.find(item => item.id === 'byte-budget')?.status, 'failed')
})

test('required validation must exist and pass', () => {
  const input = validInput()
  input.validations = [{ id: 'test', status: 'failed', summary: 'bad', startedAt: 1, completedAt: 2 }]
  assert.equal(evaluateCommitGate(input).passed, false)
})

test('high and critical secret findings block commits', () => {
  const input = validInput()
  input.secretFindings = [{ id: 's1', path: 'src/a.ts', severity: 'high', rule: 'api-key', redactedPreview: '***' }]
  const decision = evaluateCommitGate(input)
  assert.equal(decision.checks.find(item => item.id === 'secret-scan')?.status, 'failed')
})

test('base revision drift fails the gate', () => {
  const input = validInput()
  input.snapshot.headRevision = 'b'.repeat(40)
  assert.equal(evaluateCommitGate(input).checks.find(item => item.id === 'head-revision')?.status, 'failed')
})

test('WIP, multiline, and trailing-period subjects are rejected', () => {
  for (const commitSubject of ['WIP temporary', 'fix: one\nmore', 'fix: period.']) {
    const input = validInput(); input.commitSubject = commitSubject
    assert.equal(evaluateCommitGate(input).checks.find(item => item.id === 'commit-subject')?.status, 'failed')
  }
})

test('assertion includes failed check details', () => {
  const input = validInput(); input.snapshot.branch = 'main'
  assert.throws(() => assertCommitGatePassed(evaluateCommitGate(input)), /Repository commit gate failed/)
})

test('decision digest is deterministic', async () => {
  const one = evaluateCommitGate(validInput())
  const two = evaluateCommitGate(validInput())
  assert.equal(await computeCommitGateDigest(one), await computeCommitGateDigest(two))
})

test('branch builder generates a valid constrained branch', () => {
  const branch = createChangeBranchName('plan-42', 'Fix animated cloud fox tail')
  assert.equal(branch, 'yk-pets/fix-animated-cloud-fox-tail-plan-42')
  assert.equal(validateBranchName(branch), branch)
})

test('invalid branch syntax and path traversal are rejected', () => {
  assert.throws(() => validateBranchName('yk-pets/../bad'), /invalid/)
  const input = validInput(); input.expectedPaths = ['../escape']
  assert.throws(() => evaluateCommitGate(input), /traversal/)
})
