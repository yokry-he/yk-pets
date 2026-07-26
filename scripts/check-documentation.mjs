/**
 * 文件职责 / File responsibility
 * 校验核心中英文文档、AI 交接文档、完整用户指南、源码职责声明和手写代码中的双语注释。
 * Validates core bilingual docs, AI handoff docs, complete user guides, source responsibilities, and bilingual comments in handwritten code.
 */
import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
// 中文文档使用可读中文文件名，英文文档保留稳定英文名；显式映射避免依赖同名假设。 / Chinese docs use readable Chinese filenames while English docs keep stable English names; explicit pairs avoid same-name assumptions.
const documentPairs = [
  ['品牌与宠物身份.md', 'BRAND-AND-PET-IDENTITY.md'],
  ['云狐工坊.md', 'CLOUD-FOX-STUDIO.md'],
  ['云狐视觉回归.md', 'CLOUD-FOX-VISUAL-REGRESSION.md'],
  ['项目状态.md', 'PROJECT-STATUS.md'],
  ['版本与验证历史.md', 'RELEASE-HISTORY.md'],
  ['使用指南.md', 'USER-GUIDE.md'],
  ['宠物记忆.md', 'PET-MEMORY.md'],
  ['宠物记忆验收.md', 'PET-MEMORY-ACCEPTANCE.md'],
  ['网络实验室操作.md', 'NETWORK-LAB-OPERATIONS.md'],
  ['构建打包与发布.md', 'BUILD-AND-RELEASE.md'],
  ['故障排查.md', 'TROUBLESHOOTING.md'],
  ['开发者维护指南.md', 'DEVELOPER-MAINTENANCE.md'],
  ['产品与交互设计.md', 'DESIGN.md'],
  ['技术栈.md', 'TECH-STACK.md'],
  ['技术架构.md', 'ARCHITECTURE.md'],
  ['开发与运行指南.md', 'DEVELOPMENT.md'],
  ['本地代理协议.md', 'LOCAL-AGENT-PROTOCOL.md'],
  ['安全设计.md', 'SECURITY.md'],
  ['路线图.md', 'ROADMAP.md'],
  ['宠物交互.md', 'PET-INTERACTION.md'],
  ['星云环形菜单.md', 'NEBULA-RADIAL-MENU.md'],
  ['尾巴设计.md', 'TAIL-DESIGN.md'],
  ['动作控制.md', 'MOTION-CONTROLS.md'],
  ['提示与动作运行时.md', 'NOTICES-AND-MOTION-RUNTIME.md'],
  ['宠物自定义.md', 'PET-CUSTOMIZATION.md'],
  ['宠物自定义验收.md', 'PET-CUSTOMIZATION-ACCEPTANCE.md'],
  ['宠物运行与导入.md', 'PET-RUNTIME-AND-IMPORT.md'],
  ['侧边栏体验.md', 'PET-SIDEPANEL-EXPERIENCE.md'],
  ['侧边栏体验验收.md', 'PET-SIDEPANEL-EXPERIENCE-ACCEPTANCE.md'],
  ['宠物工坊高级功能.md', 'PET-STUDIO-ADVANCED.md'],
  ['宠物工坊高级验收.md', 'PET-STUDIO-ADVANCED-ACCEPTANCE.md'],
  ['工坊工作区.md', 'STUDIO-WORKSPACES.md'],
  ['工坊工作区验收.md', 'STUDIO-WORKSPACES-ACCEPTANCE.md'],
  ['统一云狐渲染器.md', 'UNIFIED-CLOUD-FOX-RENDERER.md'],
  ['AI开发交接.md', 'AI-DEVELOPMENT-HANDOFF.md'],
  ['已知问题.md', 'KNOWN-ISSUES.md'],
  ['AI开发路线图.md', 'AI-DEVELOPMENT-ROADMAP.md'],
]
const adrPairs = [
  ['0001-统一工坊框架.md', '0001-unified-studio-shell.md'],
  ['0002-动作资产模型.md', '0002-motion-asset-model.md'],
  ['0003-道具资产模型.md', '0003-prop-asset-model.md'],
  ['0004-动作关键帧领域.md', '0004-motion-keyframe-domain.md'],
  ['0005-时间轴预览适配器.md', '0005-motion-timeline-preview-adapter.md'],
  ['0006-动作道具事件轨道.md', '0006-motion-prop-event-tracks.md'],
  ['0007-道具实体编辑器.md', '0007-prop-entity-editor.md'],
  ['0008-高级动作工具.md', '0008-advanced-motion-tools.md'],
  ['0009-动作直接操控.md', '0009-motion-direct-manipulation.md'],
]
const requiredDocuments = [
  'README.md',
  'README.zh-CN.md',
  'README.en.md',
  'docs/README.md',
  ...documentPairs.flatMap(([zh, en]) => [
    `docs/zh-CN/${zh}`,
    `docs/en/${en}`,
  ]),
  ...adrPairs.flatMap(([zh, en]) => [`docs/zh-CN/adr/${zh}`, `docs/en/adr/${en}`]),
  'apps/playground/README.zh-CN.md',
  'apps/playground/README.en.md',
]
const completeUserGuideRequirements = [
  {
    path: 'docs/zh-CN/使用指南.md',
    tokens: [
      '安装和加载浏览器扩展',
      '页面审计完整流程',
      'Network Lab 与 Mock',
      '连接 YK-PETS Local Agent',
      '宠物工坊完整使用说明',
      '将工坊外观同步到浏览器扩展',
      '完整人工验收清单',
    ],
  },
  {
    path: 'docs/en/USER-GUIDE.md',
    tokens: [
      'Build and load the browser extension',
      'Complete page-audit workflow',
      'Network Lab and mocking',
      'Connect the YK-PETS Local Agent',
      'Complete Pet Studio guide',
      'Synchronize a Studio appearance to the extension',
      'Complete manual acceptance checklist',
    ],
  },
]
const technologyStackRequirements = [
  {
    path: 'docs/zh-CN/技术栈.md',
    tokens: ['运行时与工程基线', '前端应用栈', '3D 渲染栈', '领域建模与数据验证', 'Local Agent 与源码安全', '构建与验证工具'],
  },
  {
    path: 'docs/en/TECH-STACK.md',
    tokens: ['Runtime and engineering baseline', 'Frontend application stack', '3D rendering stack', 'Domain modeling and validation', 'Local Agent and source safety', 'Build and validation tools'],
  },
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

// 完整使用手册必须覆盖安装、核心工作区、宠物工坊、同步和人工验收。 / Complete user guides must cover installation, core workspaces, Pet Studio, synchronization, and manual acceptance.
for (const requirement of completeUserGuideRequirements) {
  try {
    const content = await readFile(path.join(root, requirement.path), 'utf8')
    for (const token of requirement.tokens) {
      if (!content.includes(token)) failures.push(`完整使用手册缺少章节 / Complete user guide is missing a section: ${requirement.path} -> ${token}`)
    }
  }
  catch {
    // 文档缺失已由 requiredDocuments 检查报告。 / Missing documents are already reported by requiredDocuments.
  }
}

// 技术栈文档必须解释分层和边界，不能退化为依赖名称列表。 / Technology-stack docs must explain layers and boundaries instead of becoming dependency-name lists.
for (const requirement of technologyStackRequirements) {
  try {
    const content = await readFile(path.join(root, requirement.path), 'utf8')
    for (const token of requirement.tokens) {
      if (!content.includes(token)) failures.push(`技术栈文档缺少章节 / Technology stack guide is missing a section: ${requirement.path} -> ${token}`)
    }
  }
  catch {
    // 文档缺失已由 requiredDocuments 检查报告。 / Missing documents are already reported by requiredDocuments.
  }
}

// 中文目录中的专题文件必须包含中文名称，避免迁移后再次混入全英文文件名。 / Topic files in the Chinese directory must contain Chinese names so all-English filenames do not return after migration.
for (const file of await collectMarkdownFiles(path.join(root, 'docs/zh-CN'))) {
  if (!/[\u3400-\u9fff]/u.test(path.basename(file))) {
    failures.push(`中文文档文件名不是中文 / Chinese documentation filename is not Chinese: ${path.relative(root, file)}`)
  }
}

// 校验仓库内 Markdown 相对链接，重命名文档时立即发现断链。 / Validate repository-local Markdown links so renames expose broken references immediately.
for (const file of await collectDocumentationMarkdownFiles()) await validateMarkdownLinks(file)

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

async function collectMarkdownFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(absolutePath))
    else if (entry.name.endsWith('.md')) files.push(absolutePath)
  }
  return files
}

async function collectDocumentationMarkdownFiles() {
  const files = [
    path.join(root, 'README.md'),
    path.join(root, 'README.zh-CN.md'),
    path.join(root, 'README.en.md'),
    ...await collectMarkdownFiles(path.join(root, 'docs')),
  ]
  for (const app of ['apps/extension', 'apps/playground']) {
    const directory = path.join(root, app)
    try { files.push(...(await collectMarkdownFiles(directory)).filter(file => !file.includes(`${path.sep}node_modules${path.sep}`))) }
    catch { /* 可选应用目录不存在时由其他检查负责。 / Other checks handle an absent optional app directory. */ }
  }
  return [...new Set(files)]
}

async function validateMarkdownLinks(file) {
  const content = await readFile(file, 'utf8')
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '')
    if (!rawTarget || rawTarget.startsWith('#') || /^(?:https?:|mailto:|data:)/i.test(rawTarget)) continue
    const target = decodeURIComponent(rawTarget.split('#')[0].split('?')[0])
    const absoluteTarget = path.resolve(path.dirname(file), target)
    if (!existsSync(absoluteTarget)) failures.push(`Markdown 本地链接失效 / Broken local Markdown link: ${path.relative(root, file)} -> ${rawTarget}`)
  }
}
