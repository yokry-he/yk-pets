/**
 * 文件职责 / File responsibility
 * 读取项目元数据并识别可执行脚本与框架信息。
 * Reads project metadata and identifies runnable scripts and framework information.
 */
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { ProjectInfo } from '@nova/shared/protocol'
import { AGENT_PROTOCOL_VERSION } from '@nova/shared/protocol'

export interface AgentConfig {
  token: string
  port: number
}

export async function resolveProjectRoot(input: string): Promise<string> {
  const absolute = path.resolve(process.cwd(), input)
  const root = await realpath(absolute)
  await access(root, constants.R_OK | constants.W_OK)
  return root
}

export async function loadOrCreateAgentConfig(root: string, requestedPort: number, tokenOverride?: string): Promise<AgentConfig> {
  const ykPetsDir = path.join(root, '.yk-pets')
  const configPath = path.join(ykPetsDir, 'agent.json')
  const legacyConfigPath = path.join(root, '.nova', 'agent.json')
  await mkdir(ykPetsDir, { recursive: true })

  let existing: Partial<AgentConfig> = {}
  try {
    existing = JSON.parse(await readFile(configPath, 'utf8')) as Partial<AgentConfig>
  }
  catch {
    try {
      // v0.6.10 compatibility: migrate the existing token and port instead of disconnecting users.
      existing = JSON.parse(await readFile(legacyConfigPath, 'utf8')) as Partial<AgentConfig>
    }
    catch {
      existing = {}
    }
  }

  const config: AgentConfig = {
    token: tokenOverride || existing.token || randomBytes(18).toString('base64url'),
    port: requestedPort || existing.port || 4736,
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  return config
}

export async function readProjectInfo(root: string): Promise<ProjectInfo> {
  const packageJsonPath = path.join(root, 'package.json')
  let packageJson: {
    name?: string
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  } = {}

  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  }
  catch {
    // 普通静态项目仍然可以作为有效的审计目标。 / A plain static project is still a valid audit target.
  }

  const allDependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  }

  return {
    root,
    name: packageJson.name || path.basename(root),
    packageManager: await detectPackageManager(root),
    framework: detectFramework(allDependencies),
    scripts: Object.keys(packageJson.scripts || {}).sort(),
    protocolVersion: AGENT_PROTOCOL_VERSION,
  }
}

export async function detectPackageManager(root: string): Promise<ProjectInfo['packageManager']> {
  const candidates: Array<[string, ProjectInfo['packageManager']]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ]

  for (const [file, manager] of candidates) {
    try {
      await access(path.join(root, file), constants.F_OK)
      return manager
    }
    catch {
      // 忽略当前探测失败并继续。 / Ignore the current probe failure and continue.
    }
  }

  return 'unknown'
}

function detectFramework(dependencies: Record<string, string>): string {
  if ('nuxt' in dependencies) return 'Nuxt'
  if ('next' in dependencies) return 'Next.js'
  if ('@angular/core' in dependencies) return 'Angular'
  if ('svelte' in dependencies || '@sveltejs/kit' in dependencies) return 'Svelte'
  if ('astro' in dependencies) return 'Astro'
  if ('vue' in dependencies) return 'Vue'
  if ('react' in dependencies) return 'React'
  return 'Web'
}
