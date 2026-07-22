#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 校验独立 yk-3d-pet 仓库的固定版本、集成入口和旧内嵌副本清理状态。
 * Validates the pinned independent yk-3d-pet repository, integration entrypoint, and removal of the legacy embedded copy.
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const sourcePath = path.join(root, 'skills/yk-3d-pet/source.json')
const readmePath = path.join(root, 'skills/yk-3d-pet/README.md')
const legacyPath = path.join(root, 'skills/yk-pets-3d-pet-authoring')
const failures = []

let source
try {
  source = JSON.parse(await readFile(sourcePath, 'utf8'))
}
catch (error) {
  failures.push(`无法读取 yk-3d-pet 固定版本：${error instanceof Error ? error.message : String(error)} / Cannot read pinned yk-3d-pet source.`)
}

if (source) {
  if (source.name !== 'yk-3d-pet') failures.push('source.json name 必须是 yk-3d-pet。 / source.json name must be yk-3d-pet.')
  if (source.repository !== 'https://github.com/yokry-he/yk-3d-pet') failures.push('source.json 仓库地址不正确。 / source.json repository is incorrect.')
  if (!/^\d+\.\d+\.\d+$/.test(String(source.version || ''))) failures.push('source.json version 必须是语义化版本。 / source.json version must be semantic.')
  if (!/^[0-9a-f]{40}$/.test(String(source.commit || ''))) failures.push('source.json commit 必须是完整 Git SHA。 / source.json commit must be a full Git SHA.')
  if (source.defaultPreset !== 'yk-pets') failures.push('YK-PETS 必须使用 yk-pets preset。 / YK-PETS must use the yk-pets preset.')
  if (!Number.isInteger(source.validatedWorkflowRun) || source.validatedWorkflowRun <= 0) failures.push('缺少有效的跨平台验证 Run。 / Missing a valid cross-platform validation run.')
  const platforms = Array.isArray(source.validationPlatforms) ? source.validationPlatforms : []
  for (const platform of ['ubuntu-latest', 'windows-latest', 'macos-latest']) {
    if (!platforms.includes(platform)) failures.push(`缺少验证平台：${platform} / Missing validation platform.`)
  }
}

try {
  const readme = await readFile(readmePath, 'utf8')
  for (const token of ['yokry-he/yk-3d-pet', 'source.json', '--preset yk-pets', 'front/left/back/right']) {
    if (!readme.includes(token)) failures.push(`集成 README 缺少：${token} / Integration README is missing required content.`)
  }
}
catch {
  failures.push('缺少 skills/yk-3d-pet/README.md。 / Missing skills/yk-3d-pet/README.md.')
}

try {
  const info = await stat(legacyPath)
  if (info.isDirectory()) failures.push('旧的完整 Skill 副本仍然存在。 / The legacy complete Skill copy still exists.')
}
catch {
  // 旧目录不存在是预期结果。 / Missing legacy directory is the expected result.
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
if (packageJson.scripts?.['check:3d-pet-skill'] !== 'node scripts/check-3d-pet-authoring-skill.mjs') {
  failures.push('根命令未保留独立 Skill 集成门禁。 / Root command does not retain the independent Skill integration gate.')
}

if (failures.length) {
  console.error(`yk-3d-pet 独立仓库集成检查失败，共 ${failures.length} 项：`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`yk-3d-pet 独立仓库集成检查通过：v${source.version} @ ${source.commit.slice(0, 12)}。`)
console.log(`Independent yk-3d-pet integration check passed: v${source.version}, workflow ${source.validatedWorkflowRun}.`)
