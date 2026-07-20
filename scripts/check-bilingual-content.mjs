import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const requiredDocuments = [
  'README.zh-CN.md',
  'README.en.md',
  'VALIDATION.zh-CN.md',
  'VALIDATION.en.md',
  ...[
    'DESIGN',
    'ARCHITECTURE',
    'DEVELOPMENT',
    'LOCAL-AGENT-PROTOCOL',
    'SECURITY',
    'ROADMAP',
    'PROJECT-STATUS',
    'NEBULA-RADIAL-MENU',
    'TAIL-DESIGN',
    'MOTION-CONTROLS',
    'USER-GUIDE',
    'NETWORK-LAB-OPERATIONS',
    'BUILD-AND-RELEASE',
    'TROUBLESHOOTING',
    'DEVELOPER-MAINTENANCE',
    'NETWORK-LAB-v0.5.0',
    'MOCK-WORKBENCH-HIGH-ENERGY-v0.5.1',
    'DOCUMENTATION-AND-COMMENTS-v0.5.2',
    'PET-VITALITY-FIREWORKS-v0.6.0',
    'ANIMATION-GLOW-SLEEP-v0.6.1',
    'INTERACTION-MOCK-v0.6.2',
    'MOTION-FEEDBACK-v0.6.3',
    'RULE-PROXY-FIX-v0.6.4',
    'FETCH-MOCK-INTERCEPTION-v0.6.5',
    'WHOLE-JSON-RESPONSE-v0.6.6',
    'AUDIT-NETWORK-PET-FEEDBACK-v0.6.7',
    'AUDIT-PET-AUDIO-v0.6.8',
    'MOTION-VOICE-AUDIO-v0.6.9',
    'PET-VOICE-PRESETS-v0.6.10',
  ].flatMap(name => [
    `docs/zh-CN/${name}.md`,
    `docs/en/${name}.md`,
  ]),
  ...['README', 'HOTFIX', 'MOTION_UPGRADE', 'VALIDATION'].flatMap(name => [
    `apps/playground/${name}.zh-CN.md`,
    `apps/playground/${name}.en.md`,
  ]),
]

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css'])
const ignoredDirectories = new Set(['node_modules', 'dist', '.output', '.nuxt', '.wxt', '.git', 'coverage'])
const failures = []

for (const relativePath of requiredDocuments) {
  try {
    await stat(path.join(root, relativePath))
  }
  catch {
    failures.push(`缺少文档 / Missing document: ${relativePath}`)
  }
}

for (const file of await collectCodeFiles(root)) {
  const relativePath = path.relative(root, file)
  const content = await readFile(file, 'utf8')
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

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
else {
  console.log('双语文档与代码注释检查通过。 / Bilingual documentation and code-comment checks passed.')
}

function isBilingual(comment) {
  const hasChinese = /[\u3400-\u9fff]/u.test(comment)
  const hasEnglish = /[A-Za-z]{2,}/u.test(comment)
  return hasChinese && hasEnglish
}

async function collectCodeFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectCodeFiles(absolutePath))
    }
    else if (codeExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath)
    }
  }
  return files
}
