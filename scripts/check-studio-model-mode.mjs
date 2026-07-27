#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定双模型全局模式、自动复杂草稿、工坊预览接线与无网络副作用。
 * Locks global dual-model mode, automatic complex drafts, workspace preview wiring, and no network side effects.
 */
import fs from 'node:fs'

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
const modeSwitch = read('apps/playground/app/components/studio/StudioModelModeSwitch.vue')
const layout = read('apps/playground/app/layouts/studio.vue')
const session = read('apps/playground/app/stores/studio-session.ts')
const variants = read('apps/playground/app/stores/studio-model-variants.ts')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const appearance = read('apps/playground/app/components/studio/StudioAppearanceWorkspace.vue')
const motion = read('apps/playground/app/pages/studio/motion.vue')
const props = read('apps/playground/app/pages/studio/props.vue')
const library = read('apps/playground/app/pages/studio/library.vue')
const rootPackage = JSON.parse(read('package.json') || '{}')
const workspaces = [appearance, motion, props]

const checks = [
  ['全局切换器具有简单和复杂模式', modeSwitch.includes('简单模型') && modeSwitch.includes('复杂模型')],
  ['切换器提供 pressed 状态和分组名称', modeSwitch.includes('aria-pressed') && modeSwitch.includes('role="group"') && modeSwitch.includes('模型模式')],
  ['切换器只声明模型真实状态', ['未创建', '草稿', '就绪', '需修复'].every(label => modeSwitch.includes(label))],
  ['布局装配全局模型模式切换器', layout.includes('StudioModelModeSwitch') && layout.includes('modelMode')],
  ['本地持久化的模型模式仅在客户端渲染', /<ClientOnly>[\s\S]*?<StudioModelModeSwitch[\s\S]*?<\/ClientOnly>/.test(layout) && /<ClientOnly>[\s\S]*?complex-model-notice[\s\S]*?<\/ClientOnly>/.test(layout)],
  ['布局自动建立复杂草稿', layout.includes('ensureComplexDraft') && layout.includes('setModelMode')],
  ['复杂模式说明为非阻断页面状态', layout.includes('复杂模型草稿') && !layout.includes('confirm(')],
  ['会话和双模型状态保持职责分离', session.includes('modelMode') && !session.includes('pendingCapabilities') && variants.includes('byPetId')],
  ['三个工坊传入同一个共享模型模式', workspaces.every(source => source.includes(':model-mode="session.modelMode"'))],
  ['统一画布声明模型模式适配入口', canvas.includes('modelMode?: StudioModelMode') && canvas.includes(':data-model-mode="modelMode"')],
  ['复杂模型草稿明确使用兼容预览', canvas.includes('复杂模型草稿') && canvas.includes('当前使用简单模型兼容预览')],
  ['资产库展示简单和复杂模型真实状态', library.includes('简单模型') && library.includes('复杂模型') && library.includes('complexStatusLabel') && library.includes('complex.completion')],
  ['双模型基础不增加网络和轮询', [modeSwitch, layout, session, variants].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval('))],
  ['根类型检查包含双模型契约', rootPackage.scripts?.typecheck?.includes('check-studio-model-mode.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Studio model mode check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Studio model mode passed: ${checks.length} checks.`)
