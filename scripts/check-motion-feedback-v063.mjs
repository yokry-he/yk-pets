import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const overlayCss = read('apps/extension/entrypoints/content/nova-pet-overlay.css')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const avatarCanvas = read('apps/extension/components/avatar/AvatarCanvas.vue')
const networkLab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const editor = read('apps/extension/features/network-lab/presentation/composables/useNetworkRuleEditor.ts')
const draftRepository = read('apps/extension/features/network-lab/infrastructure/chrome-rule-draft-repository.ts')

const retainedBehaviors = [
  'greeting', 'jumping', 'flapping', 'resting', 'stretching', 'eating', 'backflip', 'tail-tornado',
  'diving-catch', 'energy-burst', 'shy-peek', 'star-juggle', 'cloud-nap', 'sparkle-sneeze',
  'fireworks-show', 'curious-scan', 'antenna-charge', 'tail-glow',
]
const durationTokens = [2400, 2400, 2800, 5000, 7000, 8000, 4300, 5000, 7000, 6200, 4500, 8200, 18000, 3900, 12000, 4000, 5200, 5200]
const hoverHandler = overlay.slice(overlay.indexOf('function onAvatarEnter()'), overlay.indexOf('function behaviorPriority'))
const hoverCss = overlayCss.slice(overlayCss.indexOf('.nova-pet-avatar:hover'), overlayCss.indexOf('.nova-pet-avatar:active'))
const hasVoiceAsset = behavior => overlay.includes(`${behavior}: '${behavior}.mp3'`) || overlay.includes(`'${behavior}': '${behavior}.mp3'`)

const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['移除不安全的 setClearColor ready 回调', !avatarCanvas.includes('setClearColor') && !avatarCanvas.includes('@ready=')],
  ['新建编辑器保持稳定根容器', networkLab.includes('<section class="network-lab"') && networkLab.includes("'editor-active': editorContext")],
  ['规则编辑器提供可见错误边界', networkLab.includes('onErrorCaptured') && networkLab.includes('editor-runtime-error')],
  ['新建规则不再自动加载旧草稿', !editor.includes('onMounted') && networkLab.includes('@click="restoreDraft"')],
  ['规则构建可处理多层 Vue Proxy', editor.includes('cloneNetworkValue(value)') && !editor.includes('structuredClone(')],
  ['草稿必须具备完整规则结构', ['draft.rule.name', 'draft.rule.scopeOrigin', 'draft.rule.match.urlPattern', 'draft.rule.match.methods', 'draft.rule.action.type'].every(token => draftRepository.includes(token))],
  ['重复点击当前动作不重启', overlay.includes('activeBehaviorRequest === item.behavior') && overlay.includes('activeBehaviorRequest = request.behavior')],
  ['手动新动作经 240ms 中性过渡后打断', overlay.includes("source === 'manual'") && overlay.includes('interruptBehavior(request)') && overlay.includes('}, 240)')],
  ['悬停处理器不启动动作', hoverHandler.includes('avatarHovered = true') && !hoverHandler.includes('playBehavior')],
  ['进行中动作隔离鼠标视线', overlay.includes(':pointer="avatarPointer"') && overlay.includes("behavior.value === 'idle' || behavior.value === 'listening'")],
  ['悬停样式不再缩放或位移宠物', hoverCss.includes('filter:') && !hoverCss.includes('transform:')],
  ['所有保留动作都有延长后的时长', retainedBehaviors.every((behavior, index) => registry.includes(`behavior: '${behavior}'`) && registry.includes(`duration: ${durationTokens[index]}`))],
  ['云朵午睡平躺并持续 18 秒', cloudFox.includes('-1.52 * cloudNapPose') && cloudFox.includes('CLOUD_NAP_DURATION_SECONDS = 18') && registry.includes('duration: 18000')],
  ['每个动作都配置对应的内置语音', retainedBehaviors.every(hasVoiceAsset) && overlay.includes('playMotionVoice(item.behavior)') && !overlay.includes('createOscillator')],
  ['动作思考气泡不会遮挡页面', !overlay.includes('nova-pet-motion-thought') && !overlay.includes('motionCaption(item.behavior)') && !overlayCss.includes('.nova-pet-motion-thought')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.5 新增规则、动作、音效和气泡检查通过。`)
