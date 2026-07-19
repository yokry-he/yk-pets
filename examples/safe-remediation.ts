import {
  FileTransactionExecutor,
  InMemoryWorkspaceAdapter,
  PATCH_PLAN_SCHEMA,
  RemediationRunner,
  ScopeApprovalAuthority,
  ScopeApprovalGate,
  WebCryptoHmacApprovalSigner,
  createExactPathScopes,
  sha256Hex,
  type PatchPlan,
} from '@yk-pets/pet-platform-adaptive'

const workspace = new InMemoryWorkspaceAdapter('demo-project', {
  'src/App.vue': '<button>Save</button>',
})
const transaction = new FileTransactionExecutor(workspace)
const original = '<button>Save</button>'
const plan: PatchPlan = {
  schema: PATCH_PLAN_SCHEMA,
  id: 'fix-button-label',
  projectId: 'demo-project',
  createdAt: Date.now(),
  summary: 'Clarify the primary action label.',
  changes: [{
    id: 'update-label',
    operation: 'update',
    path: 'src/App.vue',
    expectedSha256: await sha256Hex(original),
    edits: [{ start: 8, end: 12, expectedText: 'Save', replacement: 'Save changes' }],
  }],
  verification: { required: true, scenarios: ['primary-action'] },
}

// Preview before asking the user to approve the exact files and actual write bytes.
const preview = await transaction.preview(plan)
const signer = new WebCryptoHmacApprovalSigner(new Uint8Array(32).fill(42)) // Store only in a trusted host.
const authority = new ScopeApprovalAuthority(signer)
const { token } = await authority.issue(plan, {
  subject: 'user-123',
  pathScopes: createExactPathScopes(plan),
  maxFiles: preview.files.length,
  maxChangedBytes: preview.changedBytes,
  reason: 'User approved the displayed patch preview.',
})

const runner = new RemediationRunner({
  approvals: new ScopeApprovalGate(signer),
  transactions: transaction,
  verify: async () => ({ passed: true, summary: 'Declared UI scenario passed.' }),
})

const result = await runner.execute({ plan, subject: 'user-123', approvalToken: token })
console.log(result.status)
