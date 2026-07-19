import {
  CommitLedger,
  MemoryCommitLedgerStore,
  PublishApprovalAuthority,
  PublishApprovalGate,
  RepositoryPublisher,
  WebCryptoHmacApprovalSigner,
  computePatchPlanDigest,
  touchedPaths,
  type GitWorktreeCoordinator,
  type PatchPlan,
  type ValidationEvidence,
} from '@yk-pets/pet-platform-adaptive'

export async function publishApprovedChanges(options: {
  worktrees: GitWorktreeCoordinator
  sessionId: string
  plan: PatchPlan
  subject: string
  validations: ValidationEvidence[]
}) {
  const session = options.worktrees.get(options.sessionId)
  const planDigest = await computePatchPlanDigest(options.plan)
  const commitSubject = `fix: ${options.plan.summary}`

  // Keep this secret only in a trusted Background, Local Agent, or CI host.
  const signer = new WebCryptoHmacApprovalSigner(new Uint8Array(32).fill(77))
  const authority = new PublishApprovalAuthority(signer)
  const { token, claims } = await authority.issue({
    subject: options.subject,
    projectId: session.projectId,
    repositoryId: session.repositoryId,
    sessionId: session.sessionId,
    planId: options.plan.id,
    planDigest,
    baseRevision: session.baseRevision,
    branch: session.branch,
    commitSubject,
    actions: ['commit', 'push'],
    remote: 'origin',
    reason: 'User approved the exact diff, validations, commit, and push target.',
  })

  const ledger = new CommitLedger(new MemoryCommitLedgerStore())
  const publisher = new RepositoryPublisher({
    worktrees: options.worktrees,
    approvals: new PublishApprovalGate(signer),
    ledger,
  })

  return publisher.publish({
    approvalToken: token,
    approvalId: claims.jti,
    subject: options.subject,
    sessionId: session.sessionId,
    planId: options.plan.id,
    planDigest,
    expectedPaths: touchedPaths(options.plan),
    commitSubject,
    validations: options.validations,
    gatePolicy: {
      allowedBranchPrefixes: ['yk-pets/'],
      requiredValidationIds: options.validations.map(item => item.id),
      failOnSecretSeverities: ['high', 'critical'],
    },
    push: { remote: 'origin', setUpstream: true },
  })
}
