import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const [overlay, styles, packageJson, wxtConfig] = await Promise.all([
  readFile(resolve(root, 'apps/extension/entrypoints/content/NovaPetOverlay.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content/nova-pet-overlay.css'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
  readFile(resolve(root, 'apps/extension/wxt.config.ts'), 'utf8'),
])

const version = JSON.parse(packageJson).version
const checks = [
  ['统一菜单项类型', overlay.includes('type MenuItem = ActionMenuItem | MotionMenuItem')],
  ['功能注册表', overlay.includes('const featureItems = computed<ActionMenuItem[]>')],
  ['动作注册表', overlay.includes('const motionItems: MotionMenuItem[]')],
  ['工程注册表', overlay.includes('const agentItems = computed<ActionMenuItem[]>')],
  ['每页最多六项', overlay.includes('const PAGE_SIZE = 6')],
  ['分页切片', overlay.includes('activeItems.value.slice(start, start + PAGE_SIZE)')],
  ['页码圆点', overlay.includes('nova-pet-page-dots') && styles.includes('.nova-pet-page-dots')],
  ['滚轮分页', overlay.includes('@wheel="onMenuWheel"')],
  ['统一固定六槽位', overlay.includes('const ORBIT_SLOTS = [') && !overlay.includes('genericSlots(')],
  ['从左下开始填充', overlay.includes('{ x: -148, y: 42 }') && overlay.includes('const slot = ORBIT_SLOTS[index]')],
  ['Agent 状态指示', overlay.includes('nova-agent-state') && styles.includes('.nova-agent-state.online')],
  ['模式本地持久化', overlay.includes('MENU_MODE_STORAGE_KEY') && overlay.includes('persistMenuMode') && overlay.includes('restoreMenuMode')],
  ['版本号与 WXT 一致', version === '0.6.10' && wxtConfig.includes("version: '0.6.10'")],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) process.exit(1)
console.log(`\n${checks.length} 项注册表和分页检查通过。`)
