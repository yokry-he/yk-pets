import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const temp = await mkdtemp(join(tmpdir(), 'yk-pets-v078-smoke-'))
try {
  await writeFile(join(temp, 'package.json'), JSON.stringify({ name: 'yk-pets-v078-smoke', private: true, type: 'module' }))
  const tarballs = (await readdir('artifacts/npm'))
    .filter(name => name.endsWith('.tgz'))
    .map(name => join(process.cwd(), 'artifacts/npm', name))
  if (tarballs.length !== 28) throw new Error(`Expected 28 SDK tarballs, found ${tarballs.length}`)
  const install = spawnSync('npm', ['install', '--offline', '--legacy-peer-deps', '--ignore-scripts', ...tarballs], { cwd: temp, encoding: 'utf8' })
  if (install.status !== 0) throw new Error(install.stderr || install.stdout)
  const smoke = spawnSync('node', ['--input-type=module', '--eval', `
    import * as sdk from '@yk-pets/pet-platform-adaptive'
    const required = [
      'AdaptiveRendererController', 'BrowserRuntimeMonitor', 'Canvas2DPetRenderer',
      'GovernedToolExecutor', 'PluginRegistry', 'SitePolicyManager',
      'RuntimeLifecycleController', 'FeatureModuleLoader', 'ExtensionPetRuntime',
      'RestrictedCdpClient', 'SourceLocator', 'VerificationRunner', 'ChangeReportBuilder',
      'validatePatchPlan', 'ScopeApprovalGate', 'FileTransactionExecutor', 'WorkspaceRpcAdapter', 'RemediationRunner',
      'evaluateCommitGate', 'GitWorktreeCoordinator', 'CommitLedger', 'LocalGitRepositoryAdapter', 'RepositoryPublisher',
      'GitHubProvider', 'PullRequestSynchronizer', 'createReviewActionPlan', 'evaluateMergeGate', 'RemoteReleaseCoordinator',
    ]
    for (const name of required) if (typeof sdk[name] !== 'function') throw new Error('Missing export ' + name)
    console.log('package smoke test: 28/28 umbrella exports resolved')
  `], { cwd: temp, encoding: 'utf8' })
  if (smoke.status !== 0) throw new Error(smoke.stderr || smoke.stdout)
  process.stdout.write(smoke.stdout)
  if (!/found 0 vulnerabilities/.test(install.stdout)) throw new Error('npm audit did not report zero vulnerabilities')
  console.log('package install audit: 0 vulnerabilities')
}
finally {
  await rm(temp, { recursive: true, force: true })
}
