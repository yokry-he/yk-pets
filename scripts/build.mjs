import { spawnSync } from 'node:child_process'
const packages = [
  'pet-runtime-adaptive',
  'pet-renderer-canvas2d',
  'pet-agent-policy',
  'pet-plugin-registry',
  'pet-site-policy',
  'pet-runtime-lifecycle',
  'pet-feature-loader',
  'pet-devtools-bridge',
  'pet-source-mapper',
  'pet-verification-runner',
  'pet-patch-plan',
  'pet-scope-approval',
  'pet-file-transaction',
  'pet-project-host',
  'pet-remediation-runner',
  'pet-change-report',
  'pet-repository-policy',
  'pet-git-worktree',
  'pet-commit-ledger',
  'pet-local-agent-host',
  'pet-repository-publisher',
  'pet-github-provider',
  'pet-pr-lifecycle',
  'pet-review-governance',
  'pet-merge-gate',
  'pet-remote-release',
  'pet-extension-runtime',
  'pet-platform-adaptive',
]
for (const name of packages) {
  const result = spawnSync('tsc', ['-p', `packages/${name}/tsconfig.json`], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
