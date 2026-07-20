import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const editor = read('apps/extension/features/network-lab/presentation/pages/NetworkRuleEditorPage.vue')
const list = read('apps/extension/features/network-lab/presentation/pages/NetworkRuleListPage.vue')
const lab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const factory = read('apps/extension/features/network-lab/domain/network-rule-factory.ts')
const conflict = read('apps/extension/features/network-lab/domain/network-rule-conflict-service.ts')
const draft = read('apps/extension/features/network-lab/infrastructure/chrome-rule-draft-repository.ts')
const application = read('apps/extension/features/network-lab/application/network-rule-application-service.ts')
const matcher = read('apps/extension/features/network-lab/domain/network-rule-matcher.ts')
const main = read('apps/extension/entrypoints/network-main.content.ts')
const motions = read('apps/extension/components/avatar/pet-motions.ts')
const fox = read('apps/extension/components/avatar/CloudFox.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const css = read('apps/extension/entrypoints/content/nova-pet-overlay.css')
const rootPackage = JSON.parse(read('package.json'))
const extensionPackage = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')

const checks = [
  ['Side Panel 全页规则工作台', lab.includes('NetworkRuleEditorPage') && editor.includes('rule-editor-page')],
  ['新增不存在接口', factory.includes("urlPattern: '/api/example'") && editor.includes('尚不存在')],
  ['从请求生成并预填', factory.includes('createFromEntry') && lab.includes('openFromEntry')],
  ['规则编辑与复制', list.includes("emit('edit'") && list.includes("emit('duplicate'") && factory.includes('duplicate(rule')],
  ['规则删除与启停', list.includes("emit('remove'") && list.includes("emit('toggle'")],
  ['JSON 专注编辑', editor.includes('focus-json-textarea') && editor.includes('专注编辑')],
  ['草稿自动恢复', draft.includes('NetworkRuleEditorDraft') && editor.includes('已恢复草稿')],
  ['规则测试与冲突检测', conflict.includes('NetworkRuleConflictService') && editor.includes('测试与冲突')],
  ['Query 匹配', matcher.includes('matchesQuery') && editor.includes('Query 条件')],
  ['应用服务与仓储分离', application.includes('NetworkRuleApplicationService') && application.includes('NetworkRuleRepository')],
  ['不存在接口直接 Mock', main.includes("rule?.action.type === 'mock'") && main.indexOf("rule?.action.type === 'mock'") < main.indexOf('originalFetch(input, init)')],
  ['空翻落地', motions.includes("behavior: 'backflip'") && fox.includes('backflipProgress')],
  ['甩尾旋风', motions.includes("behavior: 'tail-tornado'") && fox.includes('tornadoStrength')],
  ['飞扑接球', motions.includes("behavior: 'diving-catch'") && fox.includes('catchDive')],
  ['能量蓄力爆发', motions.includes("behavior: 'energy-burst'") && fox.includes('energyRelease') && fox.includes('burstRingGroup')],
  ['高能动作低概率闲置', overlay.includes('scheduleHighIdleCarousel') && overlay.includes('100_000 + Math.round(Math.random() * 80_000)') && overlay.includes('Math.random() > 0.58')],
  ['减少动态效果降级', fox.includes('reducedMotionPreferred') && overlay.includes("prefers-reduced-motion: reduce")],
  ['分页点固定在阴影下方', css.includes('bottom: -10px;') && css.includes('width: 11px;')],
  ['版本统一为 0.6.10', rootPackage.version === '0.6.10' && extensionPackage.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.1 Mock 工作台与高能动作检查通过。`)
