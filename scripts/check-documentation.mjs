/**
 * 文件职责 / File responsibility
 * 校验核心中英文文档、源码职责声明和手写代码中的双语注释。
 * Validates core Chinese/English documents, source responsibility declarations, and bilingual comments in handwritten code.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const pairedDocuments = [
  'BRAND-AND-PET-IDENTITY',
  'CLOUD-FOX-STUDIO',
  'PROJECT-STATUS',
  'RELEASE-HISTORY',
  'USER-GUIDE',
  'NETWORK-LAB-OPERATIONS',
  'BUILD-AND-RELEASE',
  'TROUBLESHOOTING',
  'DEVELOPER-MAINTENANCE',
  'DESIGN',
  'ARCHITECTURE',
  'DEVELOPMENT',
  'LOCAL-AGENT-PROTOCOL',
  'SECURITY',
  'ROADMAP',
  'PET-INTERACTION',
  'NEBULA-RADIAL-MENU',
  'TAIL-DESIGN',
  'MOTION-CONTROLS',
  'NOTICES-AND-MOTION-RUNTIME',
]
const requiredDocuments = [
  'README.md',
  'README.zh-CN.md',
  'README.en.md',
  'docs/README.md',
  ...pairedDocuments.flatMap(name => [
    `docs/zh-CN/${name}.md`,
    `docs/en/${name}.md`,
  ]),
  'apps/playground/README.zh-CN.md',
  'apps/playground/README.en.md',
]
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css'])
const ignoredDirectories = new Set([
  'node_modules',
  'dist',
  '.output',
  '.nuxt',
  '.wxt',
  '.git',
  'coverage',
])
const failures = []
let responsibilityRegistry = {}
try {
  responsibilityRegistry = JSON.parse(await readFile(path.join(root, 'docs/source-responsibilities.json'), 'utf8'))
}
catch {
  failures.push('缺少源码职责登记表 / Missing source responsibility registry: docs/source-responsibilities.json')
}

// 文档必须存在并包含实际内容，避免残留空壳入口。 / Documents must exist and contain real content rather than placeholder shells.
for (const relativePath of requiredDocuments) {
  try {
    const info = await stat(path.join(root, relativePath))
    const minimumSize = relativePath === 'README.md' ? 40 : 120
    if (info.size < minimumSize) failures.push(`文档内容过短 / Document is too short: ${relativePath}`)
  }
  catch {
    failures.push(`缺少文档 / Missing document: ${relativePath}`)
  }
}

// 集中登记的职责必须同时包含中英文内容。 / Centrally registered responsibilities must contain both Chinese and English content.
for (const [relativePath, entry] of Object.entries(responsibilityRegistry)) {
  const combined = `${entry?.zh || ''} ${entry?.en || ''}`
  if (!isBilingual(combined)) failures.push(`源码职责登记不是中英双语 / Source responsibility entry is not bilingual: ${relativePath}`)
}

// 产品源码必须在文件头或集中登记表中声明职责。 / Product source files must declare responsibility in the header or central registry.
for (const directory of ['apps', 'packages']) {
  const absoluteDirectory = path.join(root, directory)
  for (const file of await collectSourceFiles(absoluteDirectory)) {
    await validateSourceFile(file, true)
  }
}

// 回归脚本保留既有结构，只检查其中手写注释的双语一致性。 / Regression scripts keep their existing structure; only handwritten comments are checked for bilingual consistency.
for (const file of await collectSourceFiles(path.join(root, 'scripts'))) {
  await validateSourceFile(file, false)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
else {
  console.log('文档与双语源码注释检查通过。 / Documentation and bilingual source-comment checks passed.')
}

async function validateSourceFile(file, requireHeader) {
  const relativePath = path.relative(root, file)
  const content = await readFile(file, 'utf8')
  const hasInlineResponsibility = content.slice(0, 900).includes('文件职责 / File responsibility')
  const hasRegisteredResponsibility = Boolean(responsibilityRegistry[relativePath])

  if (requireHeader && !hasInlineResponsibility && !hasRegisteredResponsibility) {
    failures.push(`缺少双语文件职责声明 / Missing bilingual file responsibility declaration: ${relativePath}`)
  }

  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    const lineComment = trimmed.match(/^\/\/\s*(.+)$/)
    if (lineComment && !isBilingual(lineComment[1])) {
      failures.push(`${relativePath}:${index + 1} 单行注释不是中英双语 / Line comment is not bilingual`)
    }

    for (const match of line.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)) {
      if (!isBilingual(match[1])) {
        failures.push(`${relativePath}:${index + 1} 模板注释不是中英双语 / Template comment is not bilingual`)
      }
    }
  }
}

function isBilingual(comment) {
  const hasChinese = /[\u3400-\u9fff]/u.test(comment)
  const hasEnglish = /[A-Za-z]{2,}/u.test(comment)
  return hasChinese && hasEnglish
}

async function collectSourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectSourceFiles(absolutePath))
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolutePath)
  }
  return files
}
