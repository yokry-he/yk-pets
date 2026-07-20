import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const [overlay, styles] = await Promise.all([
  readFile(resolve(root, 'apps/extension/entrypoints/content/NovaPetOverlay.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content/nova-pet-overlay.css'), 'utf8'),
])

const checks = [
  ['默认单模式图标', overlay.includes('v-if="!modePickerOpen"') && overlay.includes('activeModeDefinition.icon')],
  ['点击展开三个模式', overlay.includes('toggleModePicker') && overlay.includes('v-for="mode in modeDefinitions"')],
  ['选择模式自动收回', overlay.includes('modePickerOpen.value = false') && overlay.includes('@click.stop="switchMenuMode(mode.id)"')],
  ['删除独立关闭按钮', !overlay.includes('nova-pet-close') && !styles.includes('.nova-pet-close')],
  ['外部点击关闭', overlay.includes("document.addEventListener('pointerdown', onDocumentPointerDown, true)")],
  ['Escape 关闭', overlay.includes("document.addEventListener('keydown', onDocumentKeydown)")],
  ['固定六槽位', overlay.includes('ORBIT_SLOTS') && overlay.includes('{ x: 10, y: -132 }')],
  ['模式入口不遮挡顶部槽位', styles.includes('bottom: 318px') && styles.includes('bottom: 102px')],
  ['窄屏模式入口适配', styles.includes('bottom: 294px') && styles.includes('right: 60px')],
  ['思考气泡保持独立', overlay.includes('v-if="noticeOpen" class="nova-pet-status"')],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) process.exit(1)
console.log(`\n${checks.length} 项极简菜单检查通过。`)
