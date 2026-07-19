import { mkdir, rename, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { basename } from 'node:path'

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
await rm('artifacts/npm', { recursive: true, force: true })
await mkdir('artifacts/npm', { recursive: true })
for (const name of packages) {
  const result = spawnSync('npm', ['pack', '--json', `./packages/${name}`], { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
  const [{ filename }] = JSON.parse(result.stdout)
  const destination = `artifacts/npm/${basename(filename)}`
  await rm(destination, { force: true })
  await rename(filename, destination)
}
