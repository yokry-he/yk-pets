import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const networkLab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const avatarCanvas = read('apps/extension/components/avatar/AvatarCanvas.vue')
const editor = read('apps/extension/features/network-lab/presentation/composables/useNetworkRuleEditor.ts')

const removedMotions = ['spinning', 'playing', 'playing-ball', 'paw-tap']
const checks = [
  ['网络实验室保持稳定根容器', networkLab.includes('<section class="network-lab"') && networkLab.includes("'editor-active': editorContext")],
  ['从请求和手动新增进入规则编辑态', networkLab.includes("mode: 'from-request'") && networkLab.includes("mode: 'create'") && networkLab.includes("section.value = 'rules'")],
  ['移除四个无用动作入口', removedMotions.every(motion => !registry.includes(`behavior: '${motion}'`))],
  ['午睡时长为十八秒', registry.includes('duration: 18000') && cloudFox.includes('CLOUD_NAP_DURATION_SECONDS = 18')],
  ['午睡为平躺姿态', cloudFox.includes('-1.52 * cloudNapPose') && cloudFox.includes('lays the body flat across the cloud')],
  ['只有真实任务显示数据光环', cloudFox.includes('v-if="speaking" ref="haloGroup"') && !cloudFox.includes("behavior === 'thinking' || speaking")],
  ['悬停不进入动作队列', overlay.includes("if (source === 'hover') return") && overlay.includes('Hover only updates gaze intent')],
  ['动作结束后不补播悬停问候', !overlay.includes("if (avatarHovered && !hoverGreetingPlayed")],
  ['用户动作可打断当前动作', overlay.includes("source === 'manual'") && overlay.includes('interruptBehavior(request)')],
  ['打断经过中性过渡', overlay.includes("localBehavior.value = 'idle'") && overlay.includes('}, 240)')],
  ['画布不再调用不安全渲染器 API', !avatarCanvas.includes('setClearColor') && !avatarCanvas.includes('@ready=')],
  ['新建规则不被旧草稿自动覆盖', !editor.includes('onMounted') && networkLab.includes('@click="restoreDraft"')],
  ['编辑器异常不再显示空白页', networkLab.includes('onErrorCaptured') && networkLab.includes('editor-runtime-error')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.5 交互与 Mock 入口检查通过。`)
