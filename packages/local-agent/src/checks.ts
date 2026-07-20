/**
 * 文件职责 / File responsibility
 * 限制并执行允许的项目校验命令。
 * Restricts and runs allowlisted project validation commands.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CheckResult, ProjectInfo } from '@nova/shared/protocol'
import { detectPackageManager } from './project'

const ALLOWED_SCRIPTS = new Set(['typecheck', 'test', 'build'])
const MAX_OUTPUT = 120_000
const TIMEOUT_MS = 120_000

export async function runChecks(root: string, requestedScripts: string[]): Promise<CheckResult[]> {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  const scripts = packageJson.scripts || {}
  const packageManager = await detectPackageManager(root)
  const results: CheckResult[] = []

  for (const script of requestedScripts) {
    if (!ALLOWED_SCRIPTS.has(script)) {
      results.push({ script, success: false, exitCode: null, durationMs: 0, output: '脚本不在 NOVA 允许列表中。' })
      continue
    }
    if (!scripts[script]) {
      results.push({ script, success: false, exitCode: null, durationMs: 0, output: `package.json 中没有 ${script} 脚本。` })
      continue
    }
    results.push(await runPackageScript(root, packageManager, script))
  }

  return results
}

async function runPackageScript(root: string, packageManager: ProjectInfo['packageManager'], script: string): Promise<CheckResult> {
  const command = packageManager === 'unknown' ? 'npm' : packageManager
  const args = command === 'npm' ? ['run', script] : ['run', script]
  const startedAt = Date.now()

  return await new Promise<CheckResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    const append = (chunk: Buffer) => {
      if (output.length < MAX_OUTPUT) output += chunk.toString('utf8')
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      output += '\n[NOVA] 检查超时，进程已终止。'
    }, TIMEOUT_MS)

    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve({
        script,
        success: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        output: `${output}\n${error.message}`.trim(),
      })
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({
        script,
        success: code === 0,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        output: output.trim(),
      })
    })
  })
}
