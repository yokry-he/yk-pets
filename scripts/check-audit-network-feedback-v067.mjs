import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = relative => fs.existsSync(path.join(root, relative))
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const messages = read('packages/shared/src/messages.ts')
const auditModel = read('packages/shared/src/audit.ts')
const networkModel = read('packages/shared/src/network.ts')
const content = read('apps/extension/entrypoints/content.ts')
const sidePanel = read('apps/extension/entrypoints/sidepanel/App.vue')
const networkBridge = read('apps/extension/entrypoints/network-bridge.content.ts')
const networkMain = read('apps/extension/entrypoints/network-main.content.ts')
const networkLab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const overlayCss = read('apps/extension/entrypoints/content/nova-pet-overlay.css')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')

const categories = ['performance', 'accessibility', 'seo', 'best-practice', 'dom']
const resourceTypes = ['manifest', 'socket', 'wasm']
const motionAssets = [
  'greeting', 'jumping', 'flapping', 'resting', 'stretching', 'eating', 'backflip', 'tail-tornado',
  'diving-catch', 'energy-burst', 'shy-peek', 'star-juggle', 'cloud-nap', 'sparkle-sneeze',
  'fireworks-show', 'curious-scan', 'antenna-charge', 'tail-glow',
]

const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'") && sidePanel.includes("NOVA_VERSION = '0.6.10'")],
  ['工作区导航不进入忙碌状态', content.includes("action === 'network-lab'") && content.includes('const isNavigationAction') && content.includes('busy: !isNavigationAction')],
  ['加载光环只由真实任务驱动', cloudFox.includes('<TresGroup v-if="speaking" ref="haloGroup"') && !cloudFox.includes("behavior === 'thinking' || speaking")],
  ['审计协议携带启用分类与规则', messages.includes('enabledCategories?: AuditCategory[]; enabledRuleCodes?: AuditIssueCode[]') && auditModel.includes('enabledRuleCodes: AuditIssueCode[]')],
  ['五类审计范围及子规则完整', categories.every(category => auditModel.includes(`'${category}'`)) && sidePanel.includes('audit-rule-groups') && sidePanel.includes('auditRuleLabels')],
  ['未选规则在执行前跳过', content.includes("enabled.has('image-dimensions-missing')") && content.includes("enabled.has('image-alt-missing')") && content.includes("enabled.has('viewport-meta-missing')")],
  ['审计结果支持类别和严重程度组合筛选', sidePanel.includes('issueCategoryFilter') && sidePanel.includes("filter.value !== 'all'") && sidePanel.includes("issueCategoryFilter.value !== 'all'")],
  ['扩展网络资源类型', resourceTypes.every(type => networkModel.includes(`'${type}'`)) && networkLab.includes('requestTypeFilters')],
  ['文档与 Socket 进入采集流程', networkBridge.includes('mapNavigationEntry') && networkMain.includes('installWebSocketObserver')],
  ['资源类型筛选与计数已接入', networkLab.includes('requestTypeCounts') && networkLab.includes('resourceFilter') && networkLab.includes('request-type-filters')],
  ['动作小气泡已移除', !overlay.includes('motionBubble') && !overlay.includes('nova-pet-motion-thought') && !overlayCss.includes('.nova-pet-motion-thought')],
  ['提示音合成已移除并使用 Web Audio', !overlay.includes('createOscillator') && !overlay.includes('playMotionSound') && overlay.includes('decodeAudioData') && overlay.includes('createBufferSource')],
  ['18 条内置中文动作语音存在', motionAssets.every(name => exists(`apps/extension/public/audio/motions/zh-CN/${name}.mp3`))],
  ['尾尖基础常亮并支持多色闪烁', cloudFox.includes('tailTipBase') && cloudFox.includes('tailFlashColor.setHSL') && cloudFox.includes('elapsed * 11')],
]

let failed = false
for (const [name, passed] of checks) {
  console.log(`${passed ? '✓' : '✗'} ${name}`)
  if (!passed) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.10 审计、网络与宠物反馈检查通过。`)
