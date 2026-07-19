import {
  FileTransactionExecutor,
  GitWorktreeCoordinator,
  LocalGitRepositoryAdapter,
  createChangeBranchName,
  type PatchPlan,
} from '@yk-pets/pet-platform-adaptive'

export async function openIsolatedRepository(options: {
  repositoryRoot: string
  worktreeRoot: string
  allowedRemoteUrl: string
  plan: PatchPlan
}) {
  const git = new LocalGitRepositoryAdapter([{
    repositoryId: 'local-app-repository',
    projectId: options.plan.projectId,
    repositoryRoot: options.repositoryRoot,
    worktreeRoot: options.worktreeRoot,
    defaultBranch: 'main',
    allowedRemotes: ['origin'],
    allowedRemoteUrls: [options.allowedRemoteUrl],
  }])

  const baseRevision = await git.resolveRevision('local-app-repository', 'main')
  const worktrees = new GitWorktreeCoordinator(git, {
    allowedBaseRefs: ['main'],
    defaultTtlMs: 30 * 60_000,
  })
  const session = await worktrees.open({
    sessionId: 'repair-session-001',
    repositoryId: 'local-app-repository',
    projectId: options.plan.projectId,
    baseRef: 'main',
    expectedBaseRevision: baseRevision,
    branch: createChangeBranchName(options.plan.id, options.plan.summary),
  })

  // Reuse the v0.7.6 content-hash transaction engine inside the isolated worktree.
  const transaction = new FileTransactionExecutor(git.createWorkspaceAdapter(session.worktreeId))
  const preview = await transaction.preview(options.plan)
  return { git, worktrees, session, transaction, preview }
}
