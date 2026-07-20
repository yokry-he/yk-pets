import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const [overlay, styles, background, content] = await Promise.all([
  readFile(resolve(root, 'apps/extension/entrypoints/content/NovaPetOverlay.vue'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content/nova-pet-overlay.css'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/background.ts'), 'utf8'),
  readFile(resolve(root, 'apps/extension/entrypoints/content.ts'), 'utf8'),
])

const checks = [
  ['思考气泡连接点', overlay.includes('nova-pet-status__thought-dot--large') && overlay.includes('nova-pet-status__thought-dot--small')],
  ['审计结果操作位于气泡', overlay.includes('nova-pet-status__actions') && overlay.includes("runAction('previous-issue')") && overlay.includes("runAction('next-issue')")],
  ['预览和报告位于气泡', overlay.includes('runAction(previewAction)') && overlay.includes('openNoticeDetails')],
  ['气泡独立于三级菜单', overlay.includes('v-if="noticeOpen"') && overlay.includes("type MenuState = 'closed' | MenuMode")],
  ['气泡位于最高交互层', styles.includes('z-index: 70') && styles.includes('nova-thought-in')],
  ['气泡允许覆盖菜单', styles.includes('right: 94px') && styles.includes('bottom: 220px')],
  ['侧边栏先于异步存储打开', background.includes('const openPromise = openSidePanel(tabId)') && background.includes('Promise.all([openPromise, pendingPromise])')],
  ['侧边栏失败可见反馈', content.includes('无法打开右侧栏') && content.includes('response?.ok')],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) process.exit(1)
console.log(`\n${checks.length} 项思考气泡检查通过。`)
