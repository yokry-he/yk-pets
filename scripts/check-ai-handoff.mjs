#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 校验 AI 交接包的机器状态、双语文档、ADR、视觉案例，并强制每个功能源码提交同步更新 AI 包。
 * Validates machine state, bilingual handoff docs, ADRs, visual cases, and enforces AI-package updates in every feature-source commit.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8')
const requiredFiles = [
  '.ai/ENFORCEMENT_START',
  '.ai/project-state.json',
  '.ai/session-start.md',
  '.ai/visual-cases.json',
  'docs/zh-CN/AI-DEVELOPMENT-HANDOFF.md',
  'docs/en/AI-DEVELOPMENT-HANDOFF.md',
  'docs/zh-CN/KNOWN-ISSUES.md',
  'docs/en/KNOWN-ISSUES.md',
  'docs/zh-CN/AI-DEVELOPMENT-ROADMAP.md',
  'docs/en/AI-DEVELOPMENT-ROADMAP.md',
  'docs/zh-CN/adr/0001-unified-studio-shell.md',
  'docs/en/adr/0001-unified-studio-shell.md',
  'docs/zh-CN/adr/0002-motion-asset-model.md',
  'docs/en/adr/0002-motion-asset-model.md',
  'docs/zh-CN/adr/0003-prop-asset-model.md',
  'docs/en/adr/0003-prop-asset-model.md',
  'docs/zh-CN/adr/0004-motion-keyframe-domain.md',
  'docs/en/adr/0004-motion-keyframe-domain.md',
  'docs/zh-CN/adr/0005-motion-timeline-preview-adapter.md',
  'docs/en/adr/0005-motion-timeline-preview-adapter.md',
]
const contextPaths = new Set([
  '.ai/session-start.md',
  '.ai/visual-cases.json',
  'docs/zh-CN/AI-DEVELOPMENT-HANDOFF.md',
  'docs/en/AI-DEVELOPMENT-HANDOFF.md',
  'docs/zh-CN/KNOWN-ISSUES.md',
  'docs/en/KNOWN-ISSUES.md',
  'docs/zh-CN/AI-DEVELOPMENT-ROADMAP.md',
  'docs/en/AI-DEVELOPMENT-ROADMAP.md',
])
const failures = []

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) failures.push(`缺少 AI 交接文件 / Missing AI handoff file: ${relativePath}`)
  else if (statSync(absolutePath).size < 40) failures.push(`AI 交接文件内容过短 / AI handoff file is too short: ${relativePath}`)
}

let state
let visualCases
try { state = JSON.parse(read('.ai/project-state.json')) }
catch { failures.push('无法解析 .ai/project-state.json / Cannot parse .ai/project-state.json') }
try { visualCases = JSON.parse(read('.ai/visual-cases.json')) }
catch { failures.push('无法解析 .ai/visual-cases.json / Cannot parse .ai/visual-cases.json') }

if (state) {
  expect(state.schemaVersion === 1, 'project-state schemaVersion 必须为 1 / project-state schemaVersion must be 1')
  expect(state.repository === 'yokry-he/yk-pets', 'project-state 仓库错误 / project-state repository is incorrect')
  expect(state.developmentBranch === 'agent/cloud-fox-studio-v0610', 'project-state 开发分支错误 / project-state development branch is incorrect')
  expect(state.pullRequest === 7, 'project-state PR 必须为 #7 / project-state PR must be #7')
  expect(state.baseBranch === 'agent/yk-pets-rebrand-v0610', 'project-state 目标分支错误 / project-state base branch is incorrect')
  expect(state.mergeAllowed === false, 'project-state 必须禁止自动合并 / project-state must disallow automatic merge')
  expect(state.liveVerificationRequired === true, 'project-state 必须要求实时核对 / project-state must require live verification')
  const routes = state.architecture?.studioRoutes || []
  for (const route of ['/studio/appearance', '/studio/motion', '/studio/props', '/studio/library']) expect(routes.includes(route), `project-state 缺少路由 / Missing route in project-state: ${route}`)
  expect(state.architecture?.canonicalRenderer === 'apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue', '唯一渲染器路径错误 / Canonical renderer path is incorrect')
  expect(state.architecture?.motionRig === 'cloud-fox-semantic-rig/v1', '动作 Rig 版本错误 / Motion Rig version is incorrect')
  expect(state.architecture?.motionAssetSchemaVersion === 2, '动作资产 schema 必须为 2 / Motion asset schema must be 2')
  expect(state.architecture?.customMotionRendererWiringComplete === true, '正式自定义动作渲染接入必须标记完成 / Production custom-motion renderer wiring must be marked complete')
  expect(state.mandatoryDevelopmentPolicy?.updateAiPackageForEveryFeatureCommit === true, '必须启用每个功能提交更新 AI 包 / Per-feature-commit AI update policy must be enabled')
  expect((state.completed || []).includes('motion-semantic-rig'), '必须标记语义 Rig 领域已完成 / Semantic Rig domain must be marked complete')
  expect((state.completed || []).includes('motion-domain-evaluator'), '必须标记无 UI 动作求值器已完成 / UI-free motion evaluator must be marked complete')
  expect((state.completed || []).includes('motion-keyframe-writing'), '必须标记时间轴关键帧写入已完成 / Timeline keyframe writing must be marked complete')
  expect((state.completed || []).includes('custom-motion-playback-runtime'), '必须标记正式自定义动作播放已完成 / Production custom-motion playback must be marked complete')
  expect((state.completed || []).includes('motion-renderer-pose-adapter'), '必须标记正式姿态适配器已完成 / Production pose adapter must be marked complete')
  expect((state.notCompleted || []).includes('prop-geometry-editor'), '必须标记道具几何编辑器尚未完成 / Prop geometry editor must remain marked incomplete')
  expect(state.nextPhase === 'motion-prop-event-tracks', '下一阶段必须是道具事件轨道 / Next phase must be prop event tracks')
}

for (const routeFile of ['appearance.vue', 'motion.vue', 'props.vue', 'library.vue']) expect(existsSync(path.join(root, 'apps/playground/app/pages/studio', routeFile)), `缺少 Studio 路由文件 / Missing Studio route file: ${routeFile}`)
expect(existsSync(path.join(root, 'apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')), '缺少唯一正式云狐渲染器 / Missing canonical Cloud Fox renderer')
expect(existsSync(path.join(root, 'packages/pet-core/src/motion/motion-evaluator.ts')), '缺少动作领域求值器 / Missing motion-domain evaluator')

if (visualCases) {
  expect(visualCases.schemaVersion === 1, 'visual-cases schemaVersion 必须为 1 / visual-cases schemaVersion must be 1')
  expect(Array.isArray(visualCases.cases) && visualCases.cases.length >= 4, '视觉案例至少需要四项 / At least four visual cases are required')
  const ids = new Set()
  for (const item of visualCases.cases || []) {
    expect(typeof item.id === 'string' && item.id.length > 2, '视觉案例必须拥有稳定 ID / Visual case requires a stable ID')
    if (ids.has(item.id)) failures.push(`视觉案例 ID 重复 / Duplicate visual case ID: ${item.id}`)
    ids.add(item.id)
    expect(typeof item.route === 'string' && item.route.startsWith('/studio'), `视觉案例路由无效 / Invalid visual case route: ${item.id}`)
    expect(Array.isArray(item.automatedChecks) && item.automatedChecks.length > 0, `视觉案例缺少自动检查 / Missing automated checks: ${item.id}`)
    expect(Array.isArray(item.manualChecks) && item.manualChecks.length > 0, `视觉案例缺少人工检查 / Missing manual checks: ${item.id}`)
  }
}

const sessionStart = safeRead('.ai/session-start.md')
const handoffZh = safeRead('docs/zh-CN/AI-DEVELOPMENT-HANDOFF.md')
const handoffEn = safeRead('docs/en/AI-DEVELOPMENT-HANDOFF.md')
const knownZh = safeRead('docs/zh-CN/KNOWN-ISSUES.md')
const knownEn = safeRead('docs/en/KNOWN-ISSUES.md')
const roadmapZh = safeRead('docs/zh-CN/AI-DEVELOPMENT-ROADMAP.md')
const roadmapEn = safeRead('docs/en/AI-DEVELOPMENT-ROADMAP.md')
const packageJson = safeRead('package.json')

expect(sessionStart.includes('同一个提交') && sessionStart.includes('scripts/check-ai-handoff.mjs'), '启动协议必须声明同提交更新和强制门禁 / Session protocol must require same-commit updates and name the gate')
expect(sessionStart.includes('实际代码和运行结果') && sessionStart.includes('旧聊天记录'), '启动协议必须包含可信度顺序 / Session protocol must include the trust order')
expect(handoffZh.includes('时间轴编辑与正式预览') && handoffZh.includes('道具事件轨道'), '中文交接必须记录阶段 B 完成和阶段 C 下一步 / Chinese handoff must record completed Phase B and next Phase C')
expect(handoffEn.includes('Timeline authoring and production preview') && handoffEn.includes('Prop event tracks'), 'English handoff must record completed Phase B and next Phase C')
expect(knownZh.includes('HANDOFF-001') && knownEn.includes('HANDOFF-001'), '中英文已知问题必须记录强制 AI 更新 / Known issues must record mandatory AI updates')
expect(knownZh.includes('MOTION-004') && knownEn.includes('MOTION-004'), '中英文已知问题必须记录旧数据浏览器验收 / Known issues must record legacy-data browser acceptance')
expect(roadmapZh.includes('阶段 A：语义 Rig 与关键帧领域') && roadmapEn.includes('Phase A: Semantic Rig and keyframe domain'), '中英文路线图必须保留语义 Rig 阶段记录 / Roadmaps must retain the semantic Rig phase record')
expect(roadmapZh.includes('阶段 C：道具事件轨道') && roadmapZh.includes('状态：Next') && roadmapEn.includes('Phase C: Prop event tracks') && roadmapEn.includes('Status: Next'), '中英文路线图必须把道具事件标记为下一阶段 / Roadmaps must mark prop events as next')
expect(packageJson.includes('"check:ai-handoff"') && packageJson.includes('node scripts/check-ai-handoff.mjs'), 'package.json 必须运行 AI 交接门禁 / package.json must run the AI handoff gate')
expect(packageJson.includes('"check:motion-semantic-rig"') && packageJson.includes('node scripts/check-motion-semantic-rig.mjs'), 'package.json 必须运行动作领域门禁 / package.json must run the motion-domain gate')
expect(packageJson.includes('"check:motion-timeline-preview"') && packageJson.includes('node scripts/check-motion-timeline-preview.mjs'), 'package.json 必须运行时间轴预览门禁 / package.json must run the timeline-preview gate')

for (const adrPath of requiredFiles.filter(item => item.includes('/adr/'))) {
  const content = safeRead(adrPath)
  expect(content.includes('Accepted'), `ADR 必须为 Accepted / ADR must be Accepted: ${adrPath}`)
}

checkCommitHistoryPolicy()

if (failures.length) {
  console.error('AI 交接包检查失败 / AI handoff package check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('AI 交接包检查通过，功能提交强制同步策略已启用。 / AI handoff package passed; per-feature-commit synchronization is enforced.')

function expect(condition, message) { if (!condition) failures.push(message) }
function safeRead(relativePath) { try { return read(relativePath) } catch { return '' } }
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
function ensureCommitAvailable(sha, headRef) {
  try { git(['cat-file', '-e', `${sha}^{commit}`]); return }
  catch {}
  if (headRef) {
    try { git(['fetch', '--no-tags', '--depth=1000', 'origin', `+refs/heads/${headRef}:refs/remotes/origin/${headRef}`]); return }
    catch {}
  }
  try { git(['fetch', '--no-tags', '--deepen=1000', 'origin']) }
  catch (error) { failures.push(`无法获取提交历史 / Cannot fetch commit history: ${error instanceof Error ? error.message : String(error)}`) }
}
function isFeatureSource(relativePath) {
  return /^(apps|packages)\//.test(relativePath)
    && !/(^|\/)README(?:\.[^/]+)?\.md$/i.test(relativePath)
    && /\.(?:ts|tsx|js|jsx|mjs|vue|css|json)$/i.test(relativePath)
}
function isContextPath(relativePath) {
  return contextPaths.has(relativePath)
    || /^docs\/(?:zh-CN|en)\/adr\//.test(relativePath)
}
function checkCommitHistoryPolicy() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) {
    console.log('未检测到 PR 事件，仅执行 AI 包结构检查。 / No PR event detected; structural AI-package checks only.')
    return
  }
  let event
  try { event = JSON.parse(readFileSync(eventPath, 'utf8')) }
  catch { failures.push('无法解析 GITHUB_EVENT_PATH / Cannot parse GITHUB_EVENT_PATH'); return }
  const pullRequest = event.pull_request
  if (!pullRequest) {
    console.log('当前不是 pull_request 事件，仅执行结构检查。 / This is not a pull_request event; structural checks only.')
    return
  }
  const headSha = pullRequest.head?.sha
  const headRef = pullRequest.head?.ref
  if (!headSha) { failures.push('PR 事件缺少 head SHA / PR event is missing head SHA'); return }
  ensureCommitAvailable(headSha, headRef)
  let markerCommit = ''
  try { markerCommit = git(['log', '--diff-filter=A', '--format=%H', '-n', '1', headSha, '--', '.ai/ENFORCEMENT_START']) }
  catch { failures.push('无法定位 AI 强制策略启用提交 / Cannot locate AI enforcement start commit'); return }
  if (!markerCommit) { failures.push('未找到 .ai/ENFORCEMENT_START 的添加提交 / Cannot find the commit adding .ai/ENFORCEMENT_START'); return }
  let commits = []
  try { commits = git(['rev-list', '--reverse', `${markerCommit}..${headSha}`]).split(/\s+/).filter(Boolean) }
  catch { failures.push('无法读取强制策略之后的提交 / Cannot read commits after AI enforcement start'); return }
  for (const commit of commits) {
    const parentLine = git(['rev-list', '--parents', '-n', '1', commit]).split(/\s+/)
    if (parentLine.length > 2) continue
    const changedFiles = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', commit]).split(/\r?\n/).filter(Boolean)
    if (!changedFiles.some(isFeatureSource)) continue
    const shortSha = commit.slice(0, 9)
    if (!changedFiles.includes('.ai/project-state.json')) failures.push(`功能提交 ${shortSha} 未更新 .ai/project-state.json / Feature commit ${shortSha} did not update .ai/project-state.json`)
    if (!changedFiles.some(isContextPath)) failures.push(`功能提交 ${shortSha} 未更新交接上下文 / Feature commit ${shortSha} did not update a handoff context file`)
  }
}
