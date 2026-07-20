import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const cloudFox = read('apps/extension/components/avatar/CloudFox.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const styles = read('apps/extension/entrypoints/content/nova-pet-overlay.css')
const rootPackage = JSON.parse(read('package.json'))
const extensionPackage = JSON.parse(read('apps/extension/package.json'))
const wxtConfig = read('apps/extension/wxt.config.ts')

const checks = [
  ['尾巴三段持续向外延伸', cloudFox.includes('vec3(-0.58, 0.22, 0)') && cloudFox.includes('vec3(-0.42, 0.44, 0)') && cloudFox.includes('vec3(-0.38, 0.34, 0)')],
  ['尾巴根部位于身体后外侧', cloudFox.includes('vec3(-0.58, -0.48, -0.34)')],
  ['尾根摆幅受限', cloudFox.includes('rootWave * wagAmount * 0.24') && cloudFox.includes('中段与尾尖逐级放大')],
  ['前爪采用肩部前臂爪端三级结构', cloudFox.includes('ref="leftForearm"') && cloudFox.includes('ref="rightForearm"') && cloudFox.includes('ref="leftPawTip"') && cloudFox.includes('ref="rightPawTip"')],
  ['肩部根节点保持稳定', cloudFox.includes('Shoulder roots only receive small offsets') && cloudFox.includes('leftShoulderZ += leftTap * 0.035')],
  ['招手由前臂抬起和爪端摆动完成', cloudFox.includes('rightForearmRotZ = mix(0.06, 2.7, greetingPose)') && cloudFox.includes('rightTipRotZ = greetingPose * 0.12 + wave * 0.36')],
  ['玩球拍击集中在前臂和爪端', cloudFox.includes('leftForearmRotX = -0.14 - leftTap * 0.54') && cloudFox.includes('leftTipRotX = -0.1 - leftTap * 0.42')],
  ['吃饭时肩部稳定且爪端仅微动', cloudFox.includes('else if (isEating)') && cloudFox.includes('leftShoulderZ += 0.035') && cloudFox.includes('Math.sin(elapsed * 6.5) * 0.025')],
  ['伸懒腰由肩带小移和前臂伸展协同', cloudFox.includes('leftShoulderY += stretchEase * 0.15') && cloudFox.includes('leftForearmRotZ = mix(-0.06, -2.7, stretchEase)') && cloudFox.includes('leftForearmScaleY = 1 + stretchEase * 0.18')],
  ['球和饭盆锚点逻辑保留', cloudFox.includes('const leftStartX = leftPawLocal.x') && cloudFox.includes('const mealTargetX = mouthLocal.x')],
  ['三模式下方按钮共享同一配色变量', styles.includes('--pet-menu-button-icon-bg') && !styles.includes('[data-mode="motions"]') && !styles.includes('[data-mode="agent"]')],
  ['菜单不再输出仅用于配色的数据属性', !overlay.includes(':data-mode="activeMode"')],
  ['危险按钮也使用统一按钮边框', styles.includes('.nova-menu-action.danger:not(:disabled)') && styles.includes('border-color: var(--pet-menu-button-border)')],
  ['版本统一为 0.6.10', rootPackage.version === '0.6.10' && extensionPackage.version === '0.6.10' && wxtConfig.includes("version: '0.6.10'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.4.2 基线尾巴、前爪与菜单配色回归检查通过。`)
