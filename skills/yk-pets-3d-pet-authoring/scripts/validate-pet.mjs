#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 验证 3D 宠物脚手架的物种定义、Rig、动作、标志和渲染器适配器契约。
 * Validates species definition, Rig, actions, symbols, and renderer-adapter contracts for a 3D pet scaffold.
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const rootValue = String(args.root || '').trim()
if (!rootValue) fail('缺少 `--root`。 / Missing `--root`.')
const root = path.resolve(process.cwd(), rootValue)
const failures = []
const warnings = []

const manifestPath = path.join(root, 'pet.manifest.json')
const manifest = await readJson(manifestPath, '宠物 Manifest / Pet manifest')
if (!manifest) finish()

check(manifest.schemaVersion === 1, 'pet.manifest.json schemaVersion 必须为 1。 / schemaVersion must be 1.')
check(typeof manifest.speciesId === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(manifest.speciesId), 'speciesId 必须是 kebab-case。 / speciesId must be kebab-case.')
check(typeof manifest.rendererId === 'string' && manifest.rendererId.length > 0, 'rendererId 不能为空。 / rendererId must not be empty.')
check(Array.isArray(manifest.capabilities), 'capabilities 必须是数组。 / capabilities must be an array.')

const files = manifest.files && typeof manifest.files === 'object' ? manifest.files : {}
const definitionPath = resolveManifestFile(files.definition, 'definition.ts')
const rigPath = resolveManifestFile(files.rig, '')
const actionsPath = resolveManifestFile(files.actions, 'actions.ts')
const adapterPath = resolveManifestFile(files.rendererAdapter, 'renderer-adapter.ts')

const [definition, rig, actions, adapter] = await Promise.all([
  readText(definitionPath, '物种定义 / Species definition'),
  readText(rigPath, 'Rig component'),
  readText(actionsPath, '动作注册表 / Action registry'),
  readText(adapterPath, '渲染器适配器 / Renderer adapter'),
])

if (definition) validateDefinition(definition)
if (rig) validateRig(rig, manifest.capabilities || [])
if (actions) validateActions(actions)
if (adapter) validateAdapter(adapter, manifest)

await checkFile(path.join(root, 'README.md'), '宠物 README / Pet README')
finish()

function validateDefinition(content) {
  requireTokens(content, [
    'PetSpeciesDefinition',
    'createDefault',
    'normalize',
    'safeRanges',
    'symbols',
    'chest',
    'back',
    'rendererIds',
  ], '物种定义')
  check(content.includes('Number.isFinite'), '物种定义应拒绝非有限数值。 / Species normalization should reject non-finite numbers.')
  check(content.includes('Math.min') && content.includes('Math.max'), '物种定义应限制安全范围。 / Species normalization should clamp safe ranges.')
  check(content.includes("/^#[0-9a-f]{6}$/i"), '物种定义应验证十六进制颜色。 / Species normalization should validate hex colors.')
}

function validateRig(content, capabilities) {
  requireTokens(content, [
    'ref="root"',
    'ref="body"',
    'ref="head"',
    'ref="leftEye"',
    'ref="rightEye"',
    'ref="leftPupil"',
    'ref="rightPupil"',
    'ref="leftFrontShoulder"',
    'ref="leftFrontForearm"',
    'ref="leftFrontPawTip"',
    'ref="rightFrontShoulder"',
    'ref="rightFrontForearm"',
    'ref="rightFrontPawTip"',
    'ref="leftHindLeg"',
    'ref="rightHindLeg"',
    'name="mouthAnchor"',
    'name="chestSymbolAnchor"',
    'name="backSymbolAnchor"',
    'name="propRoot"',
    'name="sceneEffectsRoot"',
  ], 'Rig')

  if (capabilities.includes('segmented-tail')) {
    requireTokens(content, ['ref="tailRoot"', 'ref="tailMid"', 'ref="tailTip"'], '分段尾巴 Rig')
  }

  check(content.includes('leftFrontPawAnchor') && content.includes('rightFrontPawAnchor'), '前爪必须提供左右道具 Anchor。 / Front paws must provide left and right prop anchors.')
  check(content.includes('motionKey'), 'Rig 应支持动作重启键。 / Rig should support a motion restart key.')
  check(content.includes('reducedMotion'), 'Rig 应支持减少动态效果。 / Rig should support reduced motion.')
  check(!/tail[^\n]{0,80}actionRig\.rotation\.y/si.test(content), '尾巴动作不得驱动整个 actionRig Y 旋转。 / Tail motion must not rotate the full actionRig on Y.')
  check(!content.includes('rightPupil.value.position.x = damp(rightPupil.value.position.x, -gazeX'), '左右眼追视不应使用相反水平符号。 / Left and right gaze should not use opposite horizontal signs.')
}

function validateActions(content) {
  requireTokens(content, [
    'PetActionDefinition',
    'durationMs',
    'requiredAnchors',
    'interruptible',
    'idleTier',
    'evaluate(',
    "id: 'idle'",
    "id: 'greeting'",
    "id: 'jumping'",
  ], '动作注册表')

  const ids = [...content.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map(match => match[1])
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  check(duplicates.length === 0, `动作 ID 重复：${[...new Set(duplicates)].join(', ')} / Duplicate action IDs.`)
  check(content.includes('normalized'), '动作应使用归一化时间线。 / Actions should use a normalized timeline.')
  check(content.includes('enter') || content.includes('smoothStep(0'), '动作应包含进入阶段。 / Actions should include an enter phase.')
  check(content.includes('exit') || content.includes('smoothStep(0.82'), '动作应包含退出阶段。 / Actions should include an exit phase.')
  check(!/scale[^\n]+1\s*-\s*normalized/si.test(content), '不要用整体缩小模拟爆炸粒子回收。 / Do not use whole-scale shrinkage to simulate particle recall.')
}

function validateAdapter(content, manifestValue) {
  requireTokens(content, [
    'petRendererRegistry.register',
    'createVuePetRendererAdapter',
    'defineYkPetElement',
    'supports:',
    'mapProps',
  ], '渲染器适配器')
  check(content.includes(manifestValue.rendererId) || content.includes('RENDERER_ID'), '适配器应使用 Manifest 的 rendererId 常量。 / Adapter should use the manifest renderer ID constant.')
  check(content.includes('state.recipe.appearance'), '适配器应把配方外观传给组件。 / Adapter should pass recipe appearance to the component.')
  check(content.includes('state.behavior'), '适配器应传递当前动作。 / Adapter should pass the current behavior.')
}

function requireTokens(content, tokens, label) {
  for (const token of tokens) check(content.includes(token), `${label} 缺少 ${token}。 / ${label} is missing ${token}.`)
}

function resolveManifestFile(value, fallback) {
  const relative = typeof value === 'string' && value.trim() ? value.trim() : fallback
  if (!relative) {
    failures.push('Manifest 缺少 Rig 文件路径。 / Manifest is missing the Rig file path.')
    return path.join(root, '__missing__')
  }
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    failures.push(`Manifest 文件路径逃逸根目录：${relative} / Manifest file path escapes root.`)
    return path.join(root, '__invalid__')
  }
  return resolved
}

async function readText(target, label) {
  try {
    return await readFile(target, 'utf8')
  }
  catch {
    failures.push(`缺少${label}：${path.relative(process.cwd(), target)} / Missing ${label}.`)
    return ''
  }
}

async function readJson(target, label) {
  try {
    const content = await readFile(target, 'utf8')
    return JSON.parse(content)
  }
  catch (error) {
    failures.push(`${label} 无法读取或不是有效 JSON：${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function checkFile(target, label) {
  try {
    const info = await stat(target)
    check(info.isFile() && info.size > 80, `${label} 内容过短。 / ${label} is too short.`)
  }
  catch {
    failures.push(`缺少${label}：${path.relative(process.cwd(), target)} / Missing ${label}.`)
  }
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function finish() {
  for (const warning of warnings) console.warn(`WARN: ${warning}`)
  if (failures.length) {
    console.error(`3D 宠物验证失败，共 ${failures.length} 项： / 3D pet validation failed with ${failures.length} issue(s):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log('3D 宠物 Skill 验证通过。 / 3D pet Skill validation passed.')
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--help' || value === '-h') {
      result.help = true
      continue
    }
    if (!value.startsWith('--')) fail(`未知参数：${value} / Unknown argument: ${value}`)
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith('--')) fail(`参数 ${value} 缺少值。 / ${value} requires a value.`)
    result[key] = next
    index += 1
  }
  return result
}

function fail(message) {
  console.error(message)
  printHelp()
  process.exit(1)
}

function printHelp() {
  console.log(`\nUsage:\n  node skills/yk-pets-3d-pet-authoring/scripts/validate-pet.mjs --root <pet-directory>\n`)
}
