import { readFileSync } from 'node:fs'

const overlay = readFileSync(new URL('../apps/extension/entrypoints/content/NovaPetOverlay.vue', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../apps/extension/entrypoints/content/nova-pet-overlay.css', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('../apps/extension/components/avatar/AvatarCanvas.vue', import.meta.url), 'utf8')
const fox = readFileSync(new URL('../apps/extension/components/avatar/CloudFox.vue', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const checks = [
  ['中文单语按钮', !overlay.includes('english:') && !overlay.includes('preset.english') && !overlay.includes('<small>Audit</small>')],
  ['紧凑环形按钮', styles.includes('--orbit-x: -166px') && styles.includes('--orbit-y: -142px')],
  ['前爪上移', fox.includes('vec3(-0.38, -0.62, 0.6)') && fox.includes('const basePawY = -0.62')],
  ['后爪结构', fox.includes('leftHindLeg') && fox.includes('rightHindLeg') && fox.includes('<!-- 后爪 / Hind paws -->')],
  ['实体底座已移除', !fox.includes('<!-- 浮空底座 / Floating platform -->') && !fox.includes('<TresRingGeometry :args="[0.72, 1.18, 64]"')],
  ['动态接触阴影', fox.includes('shadowCore') && fox.includes('shadowSoft') && fox.includes('heightRatio') && fox.includes('landingPunch')],
  ['转圈连续角度', fox.includes('wrapAngleNear') && fox.includes('pet.rotation.y %= Math.PI * 2')],
  ['完整身体相机', avatar.includes('vec3(0, 0.08, 9.7)') && avatar.includes('compact ? 33 : 35')],
  ['克制闲时动作', overlay.includes('25_000 + Math.round(Math.random() * 20_000)')],
  ['版本号', packageJson.version === '0.2.7'],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) {
  console.error(`\n${failed.length} 项 v0.2.7 检查失败。`)
  process.exit(1)
}
console.log(`\n${checks.length} 项 v0.2.7 检查通过。`)
