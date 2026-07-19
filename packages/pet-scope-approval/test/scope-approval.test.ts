import assert from 'node:assert/strict'
import test from 'node:test'
import { PATCH_PLAN_SCHEMA, type PatchPlan } from '../../pet-patch-plan/src/index.ts'
import {
  InMemoryApprovalReplayStore,
  ScopeApprovalAuthority,
  ScopeApprovalGate,
  WebCryptoHmacApprovalSigner,
  createExactPathScopes,
  decodeAndVerifyApprovalToken,
} from '../src/index.ts'

const hash = 'a'.repeat(64)
const secret = new Uint8Array(32).fill(7)
function plan(): PatchPlan {
  return {
    schema: PATCH_PLAN_SCHEMA,
    id: 'plan-approval', projectId: 'demo', baseRevision: 'rev-1', createdAt: 100, summary: 'Approved edit',
    changes: [{ id: 'edit', operation: 'update', path: 'src/App.vue', expectedSha256: hash, edits: [{ start: 0, end: 3, replacement: 'new' }] }],
  }
}

function setup(now = 100) {
  const signer = new WebCryptoHmacApprovalSigner(secret)
  const replay = new InMemoryApprovalReplayStore()
  const authority = new ScopeApprovalAuthority(signer, () => now)
  const gate = new ScopeApprovalGate(signer, { replay, now: () => now, maxClockSkewMs: 0 })
  return { signer, replay, authority, gate }
}

test('issues and consumes an exact one-time approval', async () => {
  const { authority, gate } = setup()
  const value = plan()
  const issued = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), baseRevision: 'rev-1', now: 100 })
  const claims = await gate.authorize({ token: issued.token, plan: value, subject: 'user', baseRevision: 'rev-1', now: 101 })
  assert.equal(claims.planId, value.id)
  await assert.rejects(gate.authorize({ token: issued.token, plan: value, subject: 'user', baseRevision: 'rev-1', now: 102 }), /already been used/)
})

test('signature tampering is rejected', async () => {
  const { authority, gate } = setup()
  const value = plan()
  const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value) })
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
  await assert.rejects(gate.authorize({ token: tampered, plan: value, subject: 'user', baseRevision: 'rev-1' }), /signature/)
})

test('approval is bound to exact plan digest', async () => {
  const { authority, gate } = setup()
  const value = plan()
  const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value) })
  value.summary = 'Changed after approval'
  await assert.rejects(gate.authorize({ token, plan: value, subject: 'user', baseRevision: 'rev-1' }), /digest/)
})

test('subject, origin, project, and revision are bound', async () => {
  const value = plan()
  for (const mismatch of ['subject', 'origin', 'project', 'revision'] as const) {
    const { authority, gate } = setup()
    const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), origin: 'https://app.example/x', baseRevision: 'rev-1' })
    const request = { token, plan: value, subject: 'user', projectId: 'demo', origin: 'https://app.example/y', baseRevision: 'rev-1' }
    if (mismatch === 'subject') request.subject = 'other'
    if (mismatch === 'origin') request.origin = 'https://other.example/'
    if (mismatch === 'project') request.projectId = 'other'
    if (mismatch === 'revision') request.baseRevision = 'rev-2'
    await assert.rejects(gate.authorize(request), new RegExp(mismatch === 'revision' ? 'revision' : mismatch))
  }
})

test('expired and future-issued approvals are rejected', async () => {
  const value = plan()
  const signer = new WebCryptoHmacApprovalSigner(secret)
  const authority = new ScopeApprovalAuthority(signer)
  const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), now: 100, ttlMs: 10 })
  await assert.rejects(new ScopeApprovalGate(signer, { maxClockSkewMs: 0 }).authorize({ token, plan: value, subject: 'user', baseRevision: 'rev-1', now: 110 }), /expired/)
  await assert.rejects(new ScopeApprovalGate(signer, { maxClockSkewMs: 0 }).authorize({ token, plan: value, subject: 'user', baseRevision: 'rev-1', now: 99 }), /future/)
})

test('path scope does not allow sibling paths', async () => {
  const { authority } = setup()
  const value = plan()
  await assert.rejects(authority.issue(value, { subject: 'user', pathScopes: [{ kind: 'file', path: 'src/Other.vue' }] }), /outside approval scope/)
  await authority.issue(value, { subject: 'user', pathScopes: [{ kind: 'directory', path: 'src' }] })
  await assert.rejects(authority.issue(value, { subject: 'user', pathScopes: [{ kind: 'directory', path: 'source' }] }), /outside approval scope/)
})

test('operation scope is enforced', async () => {
  const { authority } = setup()
  const value = plan()
  await assert.rejects(authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), allowedOperations: ['create'] }), /not approved/)
})

test('file and byte budgets are enforced at issue and authorization time', async () => {
  const value = plan()
  const { authority, gate } = setup()
  await assert.rejects(authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), maxChangedBytes: 2 }), /byte budget/)
  const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value), maxChangedBytes: 10 })
  await assert.rejects(gate.authorize({ token, plan: value, subject: 'user', baseRevision: 'rev-1', actualChangedBytes: 11 }), /byte budget/)
})

test('tokens can be decoded only with the correct signer', async () => {
  const { authority, signer } = setup()
  const value = plan()
  const { token } = await authority.issue(value, { subject: 'user', pathScopes: createExactPathScopes(value) })
  assert.equal((await decodeAndVerifyApprovalToken(token, signer)).subject, 'user')
  const other = new WebCryptoHmacApprovalSigner(new Uint8Array(32).fill(9))
  await assert.rejects(decodeAndVerifyApprovalToken(token, other), /signature/)
})

test('HMAC secrets shorter than 32 bytes are rejected', () => {
  assert.throws(() => new WebCryptoHmacApprovalSigner(new Uint8Array(16)), /32 bytes/)
})
