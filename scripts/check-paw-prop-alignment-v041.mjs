import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const avatarCanvas = read('apps/extension/components/avatar/AvatarCanvas.vue')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const rootPackage = JSON.parse(read('package.json'))
const extensionPackage = JSON.parse(read('apps/extension/package.json'))
const wxtConfig = read('apps/extension/wxt.config.ts')

const checks = [
  ['前爪基础位置上移到胸侧', cloudFox.includes('const FRONT_PAW_BASE_Y = -0.12') && cloudFox.includes('const FRONT_PAW_BASE_Z = 0.82')],
  ['左右前爪基础坐标统一', cloudFox.includes('FRONT_PAW_LEFT_X') && cloudFox.includes('FRONT_PAW_RIGHT_X')],
  ['左右前爪锚点', cloudFox.includes('ref="leftPawAnchor"') && cloudFox.includes('ref="rightPawAnchor"')],
  ['嘴部锚点', cloudFox.includes('ref="mouthAnchor"') && cloudFox.includes('readAnchorInPositionRig(mouthAnchor')],
  ['球从前爪附近生成', cloudFox.includes('readAnchorInPositionRig(\n    leftPawAnchor.value') && cloudFox.includes('const leftStartX = leftPawLocal.x')],
  ['玩球时长 8.4 秒', cloudFox.includes('const BALL_DURATION_SECONDS = 8.4') && registry.includes('duration: 8400')],
  ['玩球包含观察、拍球和回收阶段', cloudFox.includes('const gather = smoothStep') && cloudFox.includes('const leftTap = isPlayingBall') && cloudFox.includes('const settle = smoothStep')],
  ['饭盆按嘴部投影居中', cloudFox.includes('bowlTargetX') && cloudFox.includes('bowlTargetZ') && cloudFox.includes('GROUND_Y')],
  ['伸懒腰时长 5.4 秒', cloudFox.includes('const STRETCH_DURATION_SECONDS = 5.4') && registry.includes('duration: 5400')],
  ['伸懒腰全身姿态', cloudFox.includes('stretchStrength') && cloudFox.includes('torsoGroup') && cloudFox.includes('stretchHold')],
  ['伸懒腰联动尾巴和阴影', cloudFox.includes('const stretchTailLift') && cloudFox.includes('stretchEase * 0.32')],
  ['渲染器 ready 类型安全', avatarCanvas.includes('let renderer: WebGLRenderer | undefined')],
  ['版本统一为 0.4.1', rootPackage.version === '0.4.1' && extensionPackage.version === '0.4.1' && wxtConfig.includes("version: '0.4.1'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.4.1 前爪与道具对齐检查通过。`)
