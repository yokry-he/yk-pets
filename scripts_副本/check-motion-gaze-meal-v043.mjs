import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const registry = read('apps/extension/components/avatar/pet-motions.ts')
const rootPackage = JSON.parse(read('package.json'))
const extensionPackage = JSON.parse(read('apps/extension/package.json'))
const wxtConfig = read('apps/extension/wxt.config.ts')

const checks = [
  ['招手分为抬起、摆动和回落阶段', cloudFox.includes('greetingEnter') && cloudFox.includes('greetingExit') && cloudFox.includes('greetingWave')],
  ['招手前臂竖起', cloudFox.includes('rightForearmRotZ = mix(0.06, 2.7, greetingPose)')],
  ['招手摆动集中在爪端', cloudFox.includes('rightTipRotZ = greetingPose * 0.12 + wave * 0.36')],
  ['伸懒腰双爪上举', cloudFox.includes('leftForearmRotZ = mix(-0.06, -2.7, stretchEase)') && cloudFox.includes('rightForearmRotZ = mix(0.06, 2.7, stretchEase)')],
  ['伸懒腰头部后仰并向上拉伸', cloudFox.includes('headTargetXRotation = -0.28 - stretchEase * 0.22') && cloudFox.includes('? 0.92 + stretchEase * 0.14') && cloudFox.includes('? 1 + stretchEase * 0.13 + stretchHoldBreath')],
  ['能量球放大', cloudFox.includes('const BALL_RADIUS = 0.34') && cloudFox.includes('[BALL_RADIUS, 32, 32]')],
  ['能量球下移', cloudFox.includes('const groundBallY = GROUND_Y + 0.06')],
  ['玩球头部持续锁定球', cloudFox.includes('const ballLookX = isPlayingBall') && cloudFox.includes('const ballLookY = isPlayingBall') && cloudFox.includes('headTargetXRotation = ballLookY')],
  ['玩球眼球持续锁定球', cloudFox.includes('if (isPlayingBall)') && cloudFox.includes("eyeOffsetY = clamp(((ballGroup.value?.position.y || GROUND_Y) - head.position.y) * 0.032")],
  ['鼠标眼球上下方向修正', cloudFox.includes('let eyeOffsetY = -pointerY * 0.036') && cloudFox.includes('let headTargetXRotation = pointerY * 0.18')],
  ['视线中心死区与阻尼', cloudFox.includes('function applyDeadzone') && cloudFox.includes('leftEye.value.position.y = damp')],
  ['视线优先级明确', cloudFox.includes('视线优先级：球 > 饭盆 > 动作目标 > 鼠标')],
  ['吃饭增加抬高餐桌', cloudFox.includes('const MEAL_TABLE_HEIGHT = 0.84') && cloudFox.includes('ref="mealGroup"') && cloudFox.includes('A raised meal table brings the bowl close to the mouth')],
  ['饭盆按嘴部水平对齐', cloudFox.includes('const mealTargetX = mouthLocal.x') && cloudFox.includes('const mealTargetZ = mouthLocal.z + 0.02')],
  ['吃饭嘴部更靠近饭盆', cloudFox.includes('? 0.34') && cloudFox.includes('MEAL_BOWL_LOCAL_Y = MEAL_TABLE_HEIGHT + 0.13')],
  ['动作描述已更新', registry.includes("description: '双爪向上举起、打开胸口并仰头伸展'") && registry.includes("description: '召唤抬高餐桌和能量食盆，靠近嘴部进食'")],
  ['版本统一为 0.6.10', rootPackage.version === '0.6.10' && extensionPackage.version === '0.6.10' && wxtConfig.includes("version: '0.6.10'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 招手、伸展、视线与餐桌回归检查通过。`)
