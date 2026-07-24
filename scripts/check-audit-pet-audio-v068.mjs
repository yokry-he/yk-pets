import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const audit = read('packages/shared/src/audit.ts')
const messages = read('packages/shared/src/messages.ts')
const content = read('apps/extension/entrypoints/content.ts')
const sidePanel = read('apps/extension/entrypoints/sidepanel/App.vue')
const sidePanelCss = read('apps/extension/entrypoints/sidepanel/style.css')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const overlayCss = read('apps/extension/entrypoints/content/nova-pet-overlay.css')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')

const ruleCodes = [
  'image-dimensions-missing', 'image-lazy-missing', 'slow-navigation', 'long-task', 'large-resource',
  'image-alt-missing', 'form-label-missing', 'button-name-missing', 'link-name-missing', 'heading-order',
  'document-title-missing', 'meta-description-missing', 'viewport-meta-missing', 'mixed-content-resource',
  'duplicate-id', 'dom-size-large',
]

const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'") && sidePanel.includes("NOVA_VERSION = '0.6.10'")],
  ['16 条规则具有共享注册表', ruleCodes.every(code => audit.includes(`code: '${code}'`)) && audit.includes('AUDIT_RULE_CODES')],
  ['审计消息与报告记录规则范围', messages.includes('enabledRuleCodes?: AuditIssueCode[]') && audit.includes('enabledRuleCodes: AuditIssueCode[]')],
  ['Side Panel 显示分类和全部子规则', sidePanel.includes('auditRuleGroups') && sidePanel.includes('auditRuleLabels') && sidePanel.includes('toggleAuditCategory') && sidePanelCss.includes('.audit-rule-options')],
  ['规则选择被持久化并发送到页面', sidePanel.includes("'nova:audit:enabled-rule-codes'") && sidePanel.includes('enabledRuleCodes: [...enabledRuleCodes.value]')],
  ['图片固有尺寸可单独跳过', content.includes("enabled.has('image-dimensions-missing')") && content.includes('resolveEnabledAuditRules')],
  ['报告区区分已检查和未检查规则', sidePanel.includes('reportRuleCodes') && sidePanel.includes("? '已检查' : '未检查'")],
  ['动作思考气泡已彻底移除', !overlay.includes('motionBubble') && !overlay.includes('nova-pet-motion-thought') && !overlayCss.includes('.nova-pet-motion-thought')],
  ['内置语音首次播放时按需加载、缓存并解码', !overlay.includes('preloadMotionVoices()') && overlay.includes('loadMotionVoiceData(asset)') && overlay.includes('motionVoiceData.set(asset, request)') && overlay.includes('motionVoiceBuffers.set(asset, request)') && overlay.includes('decodeAudioData') && overlay.includes('createBufferSource')],
  ['语音不回退到提示音', !overlay.includes('createOscillator') && !overlay.includes('playMotionSound')],
  ['尾尖使用不透明亮核和加法光晕', cloudFox.includes('AdditiveBlending') && cloudFox.includes('<TresMeshBasicMaterial\n              :color="tailTipBase"') && cloudFox.includes(':tone-mapped="false"') && cloudFox.includes(':depth-write="false"')],
  ['动作期间尾尖保持多色闪烁', cloudFox.includes('tailFlashColor.setHSL') && cloudFox.includes('elapsed * 11')],
]

let failed = false
for (const [name, passed] of checks) {
  console.log(`${passed ? '✓' : '✗'} ${name}`)
  if (!passed) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.10 审计规则、宠物视觉与语音检查通过。`)
