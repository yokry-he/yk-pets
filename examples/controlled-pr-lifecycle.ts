import { GitHubProvider, type GitHubProviderInvoker } from '@yk-pets/pet-github-provider'
import { evaluateMergeGate } from '@yk-pets/pet-merge-gate'
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan'
import { PullRequestSynchronizer } from '@yk-pets/pet-pr-lifecycle'
import { RemoteApprovalAuthority, RemoteApprovalGate, RemoteReleaseCoordinator } from '@yk-pets/pet-remote-release'
import { WebCryptoHmacApprovalSigner } from '@yk-pets/pet-scope-approval'

export async function prepareFailedCheckRetry(
  invokeGitHub: GitHubProviderInvoker,
  approvalSecret: Uint8Array,
  expectedHeadSha: string,
) {
  const provider = new GitHubProvider(invokeGitHub, { allowedRepositories: ['example/yk-pets-project'] })
  const synchronizer = new PullRequestSynchronizer(provider)
  const signer = new WebCryptoHmacApprovalSigner(approvalSecret)
  const authority = new RemoteApprovalAuthority(signer)
  const approvals = new RemoteApprovalGate(signer)
  const lifecycle = await synchronizer.sync('example/yk-pets-project', 42, { expectedHeadSha })
  const failedCheckIds = lifecycle.snapshot.checks
    .filter(check => check.status === 'completed' && check.conclusion === 'failure')
    .map(check => check.id)
    .sort()
  const resourceDigest = await sha256Hex(stableStringify({ checkIds: failedCheckIds }))
  const { token } = await authority.issue({
    subject: 'user-123',
    repository: 'example/yk-pets-project',
    number: 42,
    headSha: expectedHeadSha,
    snapshotDigest: lifecycle.snapshot.digest,
    action: 'retry-failed-checks',
    resourceDigest,
    reason: 'User approved retrying the displayed failed checks',
  })
  const coordinator = new RemoteReleaseCoordinator({ provider, synchronizer, approvals })
  return coordinator.retryFailedChecks({ approvalToken: token, subject: 'user-123', repository: 'example/yk-pets-project', number: 42, expectedHeadSha })
}

export async function inspectMergeEligibility(invokeGitHub: GitHubProviderInvoker, expectedHeadSha: string) {
  const provider = new GitHubProvider(invokeGitHub, { allowedRepositories: ['example/yk-pets-project'] })
  const lifecycle = await new PullRequestSynchronizer(provider).sync('example/yk-pets-project', 42, { expectedHeadSha })
  return evaluateMergeGate(lifecycle.snapshot, {
    expectedHeadSha,
    baseBranch: 'main',
    requiredCheckNames: ['test', 'lint'],
    minimumApprovals: 1,
    allowedMergeMethods: ['squash'],
  })
}
