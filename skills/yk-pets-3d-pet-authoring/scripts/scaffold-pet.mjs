#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 根据 Skill 模板创建一个包含定义、Rig、动作和渲染器适配器的程序化 3D 宠物目录。
 * Creates a procedural 3D pet directory with definition, Rig, actions, and renderer adapter from Skill templates.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const skillDirectory = path.resolve(scriptDirectory, '..')
const templateDirectory = path.join(skillDirectory, 'templates')

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const speciesId = String(args.species || '').trim().toLowerCase()
const petName = String(args.name || '').trim()
const outputValue = String(args.output || '').trim()
const force = Boolean(args.force)
const dryRun = Boolean(args['dry-run'])

if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(speciesId)) fail('`--species` 必须是 kebab-case，例如 cloud-cat。 / `--species` must be kebab-case, for example cloud-cat.')
if (!petName) fail('缺少 `--name`。 / Missing `--name`.')
if (!outputValue) fail('缺少 `--output`。 / Missing `--output`.')

const outputDirectory = path.resolve(process.cwd(), outputValue)
const pascalName = toPascalCase(petName.replace(/[^A-Za-z0-9]+/g, ' ') || speciesId)
const constantName = speciesId.replace(/-/g, '_').toUpperCase()
const monogram = deriveMonogram(petName)
const rendererId = `${speciesId}-procedural`

const replacements = new Map([
  ['__SPECIES_ID__', speciesId],
  ['__PET_NAME__', petName],
  ['__PASCAL_NAME__', pascalName],
  ['__CONSTANT_NAME__', constantName],
  ['__MONOGRAM__', monogram],
])

const files = [
  ['pet-definition.ts.template', 'definition.ts'],
  ['procedural-pet.vue.template', `${pascalName}Rig.vue`],
  ['action-definition.ts.template', 'actions.ts'],
  ['renderer-adapter.ts.template', 'renderer-adapter.ts'],
]

const planned = files.map(([template, destination]) => ({
  template: path.join(templateDirectory, template),
  destination: path.join(outputDirectory, destination),
}))

planned.push({ destination: path.join(outputDirectory, 'pet.manifest.json'), generated: true })
planned.push({ destination: path.join(outputDirectory, 'README.md'), generated: true })

if (!force) {
  const existing = []
  for (const item of planned) {
    if (await exists(item.destination)) existing.push(path.relative(process.cwd(), item.destination))
  }
  if (existing.length) fail(`目标文件已经存在，请更换目录或使用 --force：\n${existing.join('\n')}\nTarget files already exist; choose another directory or use --force.`)
}

if (dryRun) {
  console.log('将创建以下文件 / Files that would be created:')
  for (const item of planned) console.log(`- ${path.relative(process.cwd(), item.destination)}`)
  process.exit(0)
}

await mkdir(outputDirectory, { recursive: true })

for (const [templateName, destinationName] of files) {
  const template = await readFile(path.join(templateDirectory, templateName), 'utf8')
  const content = replaceTokens(template, replacements)
  await writeFile(path.join(outputDirectory, destinationName), content, 'utf8')
}

const manifest = {
  schemaVersion: 1,
  speciesId,
  petName,
  rendererId,
  implementation: 'procedural-tresjs',
  files: {
    definition: 'definition.ts',
    rig: `${pascalName}Rig.vue`,
    actions: 'actions.ts',
    rendererAdapter: 'renderer-adapter.ts',
  },
  capabilities: [
    'four-limbs',
    'independent-eyes',
    'gaze',
    'segmented-tail',
    'chest-symbol',
    'back-symbol',
    'explicit-actions',
    'idle-motion',
  ],
}
await writeFile(path.join(outputDirectory, 'pet.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
await writeFile(path.join(outputDirectory, 'README.md'), createReadme({ speciesId, petName, pascalName, rendererId }), 'utf8')

console.log(`已创建 3D 宠物脚手架：${path.relative(process.cwd(), outputDirectory)}`)
console.log(`Created 3D pet scaffold: ${path.relative(process.cwd(), outputDirectory)}`)
console.log('下一步 / Next:')
console.log(`1. 根据参考图修改 ${pascalName}Rig.vue 的比例和几何。`)
console.log('2. 在 actions.ts 增加物种动作和共享运动姿态。')
console.log('3. 注册 renderer-adapter.ts，并把物种加入 Studio 注册表。')
console.log(`4. 运行 node ${path.relative(process.cwd(), path.join(scriptDirectory, 'validate-pet.mjs'))} --root ${path.relative(process.cwd(), outputDirectory)}`)

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--help' || value === '-h') {
      result.help = true
      continue
    }
    if (value === '--force' || value === '--dry-run') {
      result[value.slice(2)] = true
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

function replaceTokens(content, values) {
  let output = content
  for (const [token, value] of values) output = output.split(token).join(value)
  return output
}

function toPascalCase(value) {
  const result = value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join('')
  return result || 'GeneratedPet'
}

function deriveMonogram(value) {
  const words = value.trim().split(/[^A-Za-z0-9\u3400-\u9fff]+/u).filter(Boolean)
  const initials = words.map(word => word[0]).join('').slice(0, 3)
  return (initials || value.slice(0, 1) || 'P').toUpperCase()
}

function createReadme({ speciesId: id, petName: name, pascalName: component, rendererId: renderer }) {
  return `# ${name} 3D Pet\n\nGenerated by \`yk-pets-3d-pet-authoring\`. The scaffold is a starting point and must be adjusted to the intended reference design.\n\n## Identity\n\n- Species ID: \`${id}\`\n- Renderer ID: \`${renderer}\`\n- Rig component: \`${component}Rig.vue\`\n\n## Required follow-up\n\n1. Replace template proportions and geometry with the target design.\n2. Verify all semantic anchors.\n3. Add requested actions and idle policy.\n4. Register the species and renderer.\n5. Run the Skill validator and repository CI.\n6. Perform front, left, back, and right visual checks.\n`
}

async function exists(target) {
  try {
    await access(target)
    return true
  }
  catch {
    return false
  }
}

function fail(message) {
  console.error(message)
  printHelp()
  process.exit(1)
}

function printHelp() {
  console.log(`\nUsage:\n  node skills/yk-pets-3d-pet-authoring/scripts/scaffold-pet.mjs --species <kebab-id> --name <display-name> --output <directory> [--force] [--dry-run]\n\nExample:\n  node skills/yk-pets-3d-pet-authoring/scripts/scaffold-pet.mjs --species cloud-cat --name Luma --output apps/playground/app/components/pets/cloud-cat\n`)
}
