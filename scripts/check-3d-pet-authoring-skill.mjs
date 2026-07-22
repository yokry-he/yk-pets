#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 校验 3D 宠物生成 Skill 的结构，并通过临时脚手架执行生成与验证烟雾测试。
 * Validates the 3D pet authoring Skill structure and smoke-tests scaffold generation and validation in a temporary directory.
 */
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const skillRoot = path.join(root, 'skills/yk-pets-3d-pet-authoring')
const requiredFiles = [
  'SKILL.md',
  'references/rig-and-anchors.md',
  'references/motion-and-idle.md',
  'references/appearance-symbols-and-effects.md',
  'references/acceptance-and-performance.md',
  'templates/pet-definition.ts.template',
  'templates/procedural-pet.vue.template',
  'templates/action-definition.ts.template',
  'templates/renderer-adapter.ts.template',
  'scripts/scaffold-pet.mjs',
  'scripts/validate-pet.mjs',
  'examples/cloud-fox-request.json',
]
const failures = []

for (const relativePath of requiredFiles) {
  const target = path.join(skillRoot, relativePath)
  try {
    const info = await stat(target)
    if (!info.isFile() || info.size < 80) failures.push(`Skill 文件内容过短：${relativePath} / Skill file is too short.`)
  }
  catch {
    failures.push(`缺少 Skill 文件：${relativePath} / Missing Skill file.`)
  }
}

const skill = await safeRead(path.join(skillRoot, 'SKILL.md'))
for (const token of [
  'name: yk-pets-3d-pet-authoring',
  'description:',
  'Rig',
  '闲时',
  '胸前',
  '后背',
  '四视角',
  'scaffold-pet.mjs',
  'validate-pet.mjs',
]) {
  if (!skill.includes(token)) failures.push(`SKILL.md 缺少关键内容：${token} / SKILL.md is missing required content.`)
}

const definitionTemplate = await safeRead(path.join(skillRoot, 'templates/pet-definition.ts.template'))
const rigTemplate = await safeRead(path.join(skillRoot, 'templates/procedural-pet.vue.template'))
const actionTemplate = await safeRead(path.join(skillRoot, 'templates/action-definition.ts.template'))
const adapterTemplate = await safeRead(path.join(skillRoot, 'templates/renderer-adapter.ts.template'))
const placeholderRequirements = [
  ['definition', definitionTemplate, ['__SPECIES_ID__', '__PET_NAME__', '__PASCAL_NAME__', '__CONSTANT_NAME__', '__MONOGRAM__']],
  ['rig', rigTemplate, ['__PET_NAME__', '__PASCAL_NAME__']],
  ['action', actionTemplate, ['__PET_NAME__', '__PASCAL_NAME__', '__CONSTANT_NAME__']],
  ['adapter', adapterTemplate, ['__PET_NAME__', '__PASCAL_NAME__', '__CONSTANT_NAME__']],
]
for (const [label, content, tokens] of placeholderRequirements) {
  for (const token of tokens) {
    if (!content.includes(token)) failures.push(`${label} 模板缺少占位符 ${token}。 / Template is missing placeholder.`)
  }
}

if (!rigTemplate.includes('leftFrontShoulder') || !rigTemplate.includes('rightFrontShoulder') || !rigTemplate.includes('leftHindLeg') || !rigTemplate.includes('rightHindLeg')) {
  failures.push('Rig 模板必须包含四肢。 / Rig template must contain four limbs.')
}
if (!rigTemplate.includes('tailRoot') || !rigTemplate.includes('tailMid') || !rigTemplate.includes('tailTip')) {
  failures.push('Rig 模板必须包含分段尾巴。 / Rig template must contain a segmented tail.')
}
if (!rigTemplate.includes('leftEye') || !rigTemplate.includes('rightEye') || !rigTemplate.includes('leftPupil') || !rigTemplate.includes('rightPupil')) {
  failures.push('Rig 模板必须包含独立眼睛和瞳孔。 / Rig template must contain independent eyes and pupils.')
}
if (!definitionTemplate.includes('chest') || !definitionTemplate.includes('back')) {
  failures.push('物种模板必须包含胸前和后背标志。 / Species template must contain chest and back symbols.')
}

if (!failures.length) await smokeTest()

if (failures.length) {
  console.error(`3D 宠物生成 Skill 检查失败，共 ${failures.length} 项：`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`3D 宠物生成 Skill 检查通过：${requiredFiles.length} 个文件和脚手架烟雾测试。`)
console.log(`3D pet authoring Skill check passed: ${requiredFiles.length} files and scaffold smoke test.`)

async function smokeTest() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'yk-pets-3d-skill-'))
  const output = path.join(temporaryRoot, 'test-pet')
  try {
    const scaffold = runNode(path.join(skillRoot, 'scripts/scaffold-pet.mjs'), [
      '--species', 'test-fox',
      '--name', 'Test Fox',
      '--output', output,
    ])
    if (scaffold.status !== 0) {
      failures.push(`脚手架烟雾测试失败：${scaffold.stderr || scaffold.stdout} / Scaffold smoke test failed.`)
      return
    }

    const validate = runNode(path.join(skillRoot, 'scripts/validate-pet.mjs'), ['--root', output])
    if (validate.status !== 0) failures.push(`生成结果验证失败：${validate.stderr || validate.stdout} / Generated scaffold validation failed.`)

    const manifest = JSON.parse(await readFile(path.join(output, 'pet.manifest.json'), 'utf8'))
    if (manifest.speciesId !== 'test-fox' || manifest.rendererId !== 'test-fox-procedural') {
      failures.push('脚手架 Manifest 内容不正确。 / Scaffold manifest content is incorrect.')
    }
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
}

async function safeRead(target) {
  try {
    return await readFile(target, 'utf8')
  }
  catch {
    return ''
  }
}
