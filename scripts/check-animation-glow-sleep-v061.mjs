import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const protocol = read('packages/shared/src/messages.ts')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')

const retainedBehaviors = ['curious-scan', 'antenna-charge', 'tail-glow']
const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['悬停不直接覆盖主动画', overlay.includes('@mouseenter="onAvatarEnter"') && !overlay.includes('@mouseenter="playBehavior')],
  ['悬停不启动任何动作', overlay.includes('function onAvatarEnter()') && overlay.includes('Hover only updates gaze intent')],
  ['动作请求队列', overlay.includes('interface QueuedBehaviorRequest') && overlay.includes('queuedBehavior') && overlay.includes('behaviorPriority')],
  ['动作间中性稳定阶段', overlay.includes("localBehavior.value = 'idle'") && overlay.includes('}, 240)')],
  ['普通闲时动作 10-18 秒', overlay.includes('10_000 + Math.round(Math.random() * 8_000)')],
  ['生活动作缩短到 34-64 秒', overlay.includes('34_000 + Math.round(Math.random() * 30_000)')],
  ['高能与彩蛋保持低频但不超长', overlay.includes('100_000 + Math.round(Math.random() * 80_000)') && overlay.includes('150_000 + Math.round(Math.random() * 150_000)')],
  ['保留动作进入共享协议', retainedBehaviors.every(behavior => protocol.includes(`'${behavior}'`))],
  ['保留动作进入注册表', retainedBehaviors.every(behavior => registry.includes(`behavior: '${behavior}'`))],
  ['触角根部贴合头顶', cloudFox.includes('vec3(-0.24, 0.7, 0.05)') && cloudFox.includes('vec3(0.24, 0.7, 0.05)')],
  ['触角聚能主动发光', cloudFox.includes('isAntennaCharge') && cloudFox.includes('antennaChargePose') && cloudFox.includes('antennaRelease')],
  ['尾光流动主动控制', cloudFox.includes('isTailGlow') && cloudFox.includes('tailGlowWave') && cloudFox.includes('tailMidMesh') && cloudFox.includes('tailTipMesh')],
  ['云朵午睡平躺且延长', cloudFox.includes('-1.52 * cloudNapPose') && cloudFox.includes('CLOUD_NAP_DURATION_SECONDS = 18')],
  ['云朵承托位置提高', cloudFox.includes('cloudNapGroup.value.position.y = -1.02') && cloudFox.includes('vec3(-0.02, -1.02, 0.12)')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.1 动画、发光与午睡检查通过。`)
