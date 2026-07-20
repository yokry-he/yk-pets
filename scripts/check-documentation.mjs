/**
 * 文件职责 / File responsibility
 * 校验核心中英文文档、源码职责头和手写代码中的双语注释。
 * Validates core Chinese/English documents, source responsibility headers, and bilingual comments in handwritten code.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const pairedDocuments = [
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
  'apps/playground/README.md',
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

// 文档必须存在并包含实际内容，避免残留空壳入口。 / Documents must exist and contain real content rather than placeholder shells.
for (const relativePath of requiredDocuments) {
  try {
    const info = await stat(path.join(root, relativePath))
    const minimumSize = relativePath === 'README.md' || relativePath === 'apps/playground/README.md' ? 40 : 120
    if (info.size < minimumSize) failures.push(`文档内容过短 / Document is too short: ${relativePath}`)
  }
  catch {
    failures.push(`缺少文档 / Missing document: ${relativePath}`)
  }
}

for (const directory of ['apps', 'packages', 'scripts']) {
  const absoluteDirectory = path.join(root, directory)
  for (const file of await collectSourceFiles(absoluteDirectory)) {
    await validateSourceFile(file)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
else {
  console.log('文档与双语源码注释检查通过。 / Documentation and bilingual source-comment checks passed.')
}

async function validateSourceFile(file) {
  const relativePath = path.relative(root, file)
  const content = await readFile(file, 'utf8')

  if (!content.slice(0, 900).includes('文件职责 / File responsibility')) {
    failures.push(`缺少双语文件职责注释 / Missing bilingual file responsibility header: ${relativePath}`)
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
