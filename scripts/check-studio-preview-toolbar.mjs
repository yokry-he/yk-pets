/**
 * 文件职责 / File responsibility
 * 校验三个 Studio 工作区复用同一预览控制栏，并统一接入固定视角、背景、缩放、旋转和复位能力。
 * Verifies that all three Studio workspaces reuse one preview toolbar wired to canonical views, background, scale, rotation, and reset.
 */
import fs from 'node:fs'

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const toolbar = read('apps/playground/app/components/studio/StudioPreviewToolbar.vue')
const orientation = read('apps/playground/app/composables/useStudioPreviewOrientation.ts')
const appearance = read('apps/playground/app/components/studio/StudioAppearanceWorkspace.vue')
const motion = read('apps/playground/app/pages/studio/motion.vue')
const props = read('apps/playground/app/pages/studio/props.vue')
const rootPackage = JSON.parse(read('package.json') || '{}')

const workspaces = [appearance, motion, props]
const checks = [
  ['共享预览控制栏组件存在', toolbar.includes('name="StudioPreviewToolbar"') || toolbar.includes('class="studio-preview-toolbar"')],
  ['控制栏按固定视角与预览变换分组', toolbar.includes('固定视角') && toolbar.includes('预览变换') && toolbar.includes('自由旋转')],
  ['控制栏提供背景、缩放、三轴和复位', toolbar.includes('背景') && toolbar.includes('type="range"') && toolbar.includes("['x', 'y', 'z']") && toolbar.includes('复位')],
  ['动作时间使用可选控制栏扩展', toolbar.includes('showTime') && motion.includes(':show-time="true"')],
  ['三个工坊都复用共享控制栏', workspaces.every(source => source.includes('StudioPreviewToolbar'))],
  ['三个工坊都把缩放传入正式预览', workspaces.every(source => source.includes(':preview-scale="previewScale"'))],
  ['共享预览状态负责缩放边界和滚轮', orientation.includes('const previewScale = ref') && orientation.includes('function updatePreviewScale') && orientation.includes('function wheelPreview')],
  ['三个工坊都接入统一背景和复位事件', workspaces.every(source => source.includes('@background="setBackground"') && source.includes('@reset="resetPreviewTransform"'))],
  ['外观工具栏保留部位定位和经典对比操作', appearance.includes('#actions') && appearance.includes('部位定位') && appearance.includes('对比经典')],
  ['根类型检查包含预览控制栏契约', rootPackage.scripts?.typecheck?.includes('check-studio-preview-toolbar.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Studio preview toolbar check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Studio preview toolbar passed: ${checks.length} checks.`)
