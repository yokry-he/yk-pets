/**
 * 文件职责 / File responsibility
 * 校验 v0.5.2 双语文档集合和所有手写源码文件的双语职责头。
 * Validates the v0.5.2 bilingual document set and responsibility header in every handwritten source file.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const pairedDocuments = [
  'USER-GUIDE',
  'NETWORK-LAB-OPERATIONS',
  'BUILD-AND-RELEASE',
  'TROUBLESHOOTING',
  'DEVELOPER-MAINTENANCE',
  'CODE-COMMENT-STANDARD',
  'NETWORK-LAB-v0.5.0',
  'MOCK-WORKBENCH-HIGH-ENERGY-v0.5.1',
  'DOCUMENTATION-AND-COMMENTS-v0.5.2',
]
const requiredDocuments = pairedDocuments.flatMap(name => [
  `docs/zh-CN/${name}.md`,
  `docs/en/${name}.md`,
])
const codeExtensions = new Set(['.ts', '.vue', '.css'])
const ignoredDirectories = new Set(['node_modules', 'dist', '.output', '.wxt', '.nuxt', '.git', 'coverage'])
const failures = []

// 文档必须存在且包含足够内容，避免只有占位标题。 / Documents must exist and contain more than placeholder headings.
for (const relativePath of requiredDocuments) {
  try {
    const info = await stat(path.join(root, relativePath))
    if (info.size < 120) failures.push(`文档内容过短 / Document is too short: ${relativePath}`)
  }
  catch {
    failures.push(`缺少文档 / Missing document: ${relativePath}`)
  }
}

// 每个手写文件必须先说明职责；生成目录和依赖目录不参与检查。 / Every handwritten file needs a responsibility header; generated and dependency directories are excluded.
for (const file of await collectSourceFiles(path.join(root, 'apps'))) {
  await validateHeader(file)
}
for (const file of await collectSourceFiles(path.join(root, 'packages'))) {
  await validateHeader(file)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
else {
  console.log('v0.5.2 文档与源码职责注释检查通过。 / v0.5.2 documentation and source responsibility headers passed.')
}

async function validateHeader(file) {
  const content = await readFile(file, 'utf8')
  const relativePath = path.relative(root, file)
  if (!content.slice(0, 800).includes('文件职责 / File responsibility')) {
    failures.push(`缺少双语文件职责注释 / Missing bilingual file responsibility header: ${relativePath}`)
  }
}

async function collectSourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectSourceFiles(absolutePath))
    else if (codeExtensions.has(path.extname(entry.name))) files.push(absolutePath)
  }
  return files
}
