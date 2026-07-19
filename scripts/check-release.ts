import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function filesRecursively(directory: string): string[] {
  const output: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!['dist', 'artifacts', 'node_modules', '.git'].includes(entry.name)) output.push(...filesRecursively(path))
    }
    else output.push(path)
  }
  return output
}

const root = JSON.parse(readFileSync('package.json', 'utf8'))
assert.equal(root.version, '0.7.8')
assert.equal(root.name, 'yk-pets')
assert.match(root.engines.node, />=22/)
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
assert.equal(lock.version, '0.7.8')
assert.equal(lock.packages[''].version, '0.7.8')

const packageFiles = readdirSync('packages', { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join('packages', entry.name, 'package.json'))
  .filter(existsSync)
  .sort()
assert.equal(packageFiles.length, 28)
for (const file of packageFiles) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(pkg.version, '0.7.8', `${file} version`)
  assert.ok(existsSync(file.replace('package.json', 'dist/index.js')), `${file} dist JS`)
  assert.ok(existsSync(file.replace('package.json', 'dist/index.d.ts')), `${file} dist declarations`)
  assert.ok(existsSync(file.replace('package.json', 'dist/index.js.map')), `${file} source map`)
  assert.ok(existsSync(file.replace('package.json', 'dist/index.d.ts.map')), `${file} declaration map`)
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (name.startsWith('@yk-pets/')) assert.equal(version, '0.7.8', `${file} dependency ${name}`)
  }
}
assert.match(JSON.parse(readFileSync('packages/pet-local-agent-host/package.json', 'utf8')).engines.node, />=22/)

for (const file of [
  'README.zh-CN.md', 'README.en.md',
  'MIGRATION-v0.7.7-to-v0.7.8.zh-CN.md', 'RELEASE-NOTES-v0.7.8.md',
  'VALIDATION-v0.7.8.zh-CN.md', 'VALIDATION-v0.7.8.en.md',
  'MERGE-INSTRUCTIONS-v0.7.8.zh-CN.md',
  'docs/zh-CN/GITHUB-PROVIDER-v0.7.8.md', 'docs/en/GITHUB-PROVIDER-v0.7.8.md',
  'docs/zh-CN/PR-LIFECYCLE-v0.7.8.md', 'docs/en/PR-LIFECYCLE-v0.7.8.md',
  'docs/zh-CN/REVIEW-GOVERNANCE-v0.7.8.md', 'docs/en/REVIEW-GOVERNANCE-v0.7.8.md',
  'docs/zh-CN/MERGE-GATE-v0.7.8.md', 'docs/en/MERGE-GATE-v0.7.8.md',
  'docs/zh-CN/REMOTE-RELEASE-v0.7.8.md', 'docs/en/REMOTE-RELEASE-v0.7.8.md',
  'examples/github-collaboration-host.ts', 'examples/controlled-pr-lifecycle.ts', 'examples/extension-collaboration.ts',
]) assert.ok(existsSync(file), `${file} exists`)

const combined = filesRecursively('.')
  .filter(file => /\.(?:json|md|ts|mjs)$/.test(file))
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')
assert.match(combined, /0\.6\.10/)
assert.doesNotMatch(combined, /"version"\s*:\s*"0\.6\.1[1-9]"/)

const provider = readFileSync('packages/pet-github-provider/src/index.ts', 'utf8')
assert.match(provider, /yk-pets\.github-provider\/v1/)
assert.match(provider, /allowedRepositories/)
assert.match(provider, /checks:rerun-failed/)
assert.match(provider, /pull-request:merge/)
assert.match(provider, /branch:delete/)
assert.doesNotMatch(provider, /\bfetch\s*\(/)
assert.doesNotMatch(provider, /GraphQL|Runtime\.evaluate|shell: true/)
const lifecycle = readFileSync('packages/pet-pr-lifecycle/src/index.ts', 'utf8')
assert.match(lifecycle, /yk-pets\.pr-lifecycle\/v1/)
assert.match(lifecycle, /Pull request changed during lifecycle synchronization/)
assert.match(lifecycle, /compare-and-swap conflict/)
const review = readFileSync('packages/pet-review-governance/src/index.ts', 'utf8')
assert.match(review, /yk-pets\.review-plan\/v1/)
assert.match(review, /latestCommentId/)
assert.match(review, /Resolving a review thread without a reply is disabled/)
assert.match(review, /status: errors\.length === 0 \? 'complete' : 'partial'/)
assert.doesNotMatch(review, /dismissReview|editReviewComment/)
const merge = readFileSync('packages/pet-merge-gate/src/index.ts', 'utf8')
assert.match(merge, /yk-pets\.merge-gate\/v1/)
assert.match(merge, /required-check-ambiguous/)
assert.match(merge, /stale-snapshot/)
assert.match(merge, /unresolved-review-threads/)
const remote = readFileSync('packages/pet-remote-release/src/index.ts', 'utf8')
assert.match(remote, /yk-pets\.remote-approval\/v1/)
assert.match(remote, /Remote approval has already been used/)
assert.match(remote, /No failed checks are eligible for retry/)
assert.match(remote, /Post-release cleanup requires a merged pull request/)
assert.match(remote, /forceLocalCleanup/)
assert.match(remote, /base64url segment is non-canonical/)
const scopeApproval = readFileSync('packages/pet-scope-approval/src/index.ts', 'utf8')
assert.match(scopeApproval, /base64url segment is non-canonical/)
const publisher = readFileSync('packages/pet-repository-publisher/src/index.ts', 'utf8')
assert.match(publisher, /base64url segment is non-canonical/)
const extension = readFileSync('packages/pet-extension-runtime/src/index.ts', 'utf8')
assert.match(extension, /remote-collaboration/)
assert.match(extension, /collaboration:run/)
assert.match(extension, /authorizeCollaborationAction/)
const changeReport = readFileSync('packages/pet-change-report/src/index.ts', 'utf8')
assert.match(changeReport, /platformVersion: '0\.7\.8'/)

console.log(`v0.7.8 release checks: ${packageFiles.length} packages, remote collaboration gates present, extension baseline 0.6.10 unchanged`)
