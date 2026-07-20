import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const [overlay, styles] = await Promise.all([
  readFile(resolve(root, 'apps/extension/entrypoints/content/NovaPetOverlay.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content/nova-pet-overlay.css'), 'utf8'),
])

const checks = [
  ['单一互斥菜单状态', overlay.includes("type MenuState = 'closed' | MenuMode") && !overlay.includes('toolsOpen')],
  ['三级模式同级', overlay.includes("'features' | 'motions' | 'agent'") && overlay.includes('const modeDefinitions: ModeDefinition[]')],
  ['重新打开保留上次模式', overlay.includes('lastMenuMode.value') && overlay.includes('menuState.value = lastMenuMode.value')],
  ['点击宠物统一开关菜单', overlay.includes('@click="toggleMenu"') && overlay.includes('function closeMenu()')],
  ['三类按钮全部纯图标', overlay.includes('<span aria-hidden="true">{{ item.icon }}</span>') && !overlay.includes('<b>{{ item.label }}</b>')],
  ['统一中文 Tooltip', overlay.includes('showTooltipContent') && styles.includes('.nova-pet-tooltip')],
  ['工程模式不再显示网页大面板', !overlay.includes('nova-pet-toolbox') && overlay.includes("mode: 'agent'")],
  ['工程操作进入侧边栏', overlay.includes("action: 'connect-agent'") && overlay.includes("action: 'run-checks'")],
  ['极简单图标模式入口', overlay.includes('class="nova-mode-current"') && styles.includes('.nova-mode-current')],
  ['模式选择器按需展开', overlay.includes('modePickerOpen') && overlay.includes('class="nova-mode-picker"')],
  ['菜单关闭同步隐藏全部控件', overlay.includes('v-if="menuOpen"\n      class="nova-pet-mode-control"') && overlay.includes('v-if="menuOpen"\n      class="nova-pet-menu-ring"') && !overlay.includes('nova-pet-close')],
  ['外部点击和 Esc 关闭', overlay.includes('onDocumentPointerDown') && overlay.includes("event.key === 'Escape'")],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) process.exit(1)
console.log(`\n${checks.length} 项菜单交互检查通过。`)
