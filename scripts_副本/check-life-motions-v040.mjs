import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const messages = read('packages/shared/src/messages.ts')

const checks = [
  ['动作注册表', registry.includes('PET_MOTIONS') && registry.includes("kind: 'prop'")],
  ['伸懒腰动作', registry.includes("behavior: 'stretching'") && messages.includes("| 'stretching'")],
  ['已移除玩球入口', !registry.includes("behavior: 'playing-ball'")],
  ['吃饭动作', registry.includes("behavior: 'eating'") && cloudFox.includes('ref="bowlGroup"')],
  ['动作分页可扩展', overlay.includes('PAGE_SIZE = 6') && overlay.includes('PET_MOTIONS')],
  ['普通与稀有闲时队列', overlay.includes('scheduleRareIdleCarousel') && registry.includes("idleTier: 'rare'")],
  ['分层动画 Rig', cloudFox.includes('ref="positionRig"') && cloudFox.includes('ref="actionRig"') && cloudFox.includes('ref="lookRig"')],
  ['完整四肢', cloudFox.includes('ref="leftPaw"') && cloudFox.includes('ref="rightPaw"') && cloudFox.includes('ref="leftHindLeg"') && cloudFox.includes('ref="rightHindLeg"')],
  ['动态软阴影', cloudFox.includes('ref="shadowCore"') && cloudFox.includes('heightRatio') && cloudFox.includes('landingPunch')],
  ['尾尖拖尾', cloudFox.includes('ref="tailTrailPrimary"') && cloudFox.includes('ref="tailTrailSecondary"')],
  ['尾尖星点', cloudFox.includes('ref="tailParticleA"') && cloudFox.includes('particleStrength')],
  ['已移除转圈入口', !registry.includes("behavior: 'spinning'")],
  ['道具进退场', cloudFox.includes('const enter = visible') && cloudFox.includes('const exit = visible')],
  ['中文界面', registry.includes("label: '吃饭'") && registry.includes("label: '伸懒腰'") && registry.includes("label: '云朵午睡'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.4.0 生活动作检查通过。`)
