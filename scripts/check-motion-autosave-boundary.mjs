#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定动作自动保存与控制手势的真实页面连线，防止预览或取消路径越过事务边界落盘。
 * Locks real page wiring between motion autosave and control gestures so previews and cancellations cannot persist.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('apps/playground/app/pages/studio/motion.vue')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')
const controller = read('apps/playground/app/utils/studio-motion-auto-save.ts')

function hasPageWiring(source) {
  return source.includes('createStudioMotionAutoSaveController')
    && source.includes('isGestureActive: () => editor.isControlGestureActive')
    && source.includes('watch(() => editor.controlGestureOutcome')
    && source.includes("outcome === 'active'")
    && source.includes("outcome === 'committed' || outcome === 'cancelled'")
    && source.includes('autoSaveController.settleGesture(outcome)')
    && source.includes('autoSaveController.dispose()')
    && !source.includes('autoSaveTimer')
}

function hasStoreBoundary(source) {
  return source.includes("controlGestureOutcome: 'idle' | 'active' | 'committed' | 'cancelled'")
    && source.includes('isControlGestureActive: state => Boolean(state.controlGestureBaseline)')
    && source.includes("this.controlGestureOutcome = 'active'")
    && source.includes("this.controlGestureOutcome = changed ? 'committed' : 'cancelled'")
    && source.includes("this.controlGestureOutcome = 'cancelled'")
}

function hasControllerBoundary(source) {
  const guards = source.match(/options\.isGestureActive\(\) \|\| !options\.isDirty\(\)/g)?.length || 0
  return guards >= 2
    && source.includes("if (outcome === 'committed') schedule()")
    && !source.includes("outcome === 'cancelled') schedule()")
}

const checks = [
  ['页面使用 Store 活动态并按提交/取消结果收束保存', hasPageWiring(page)],
  ['Store 明确暴露活动态与提交/取消结果', hasStoreBoundary(store)],
  ['调度与立即保存双重阻止活动手势且取消不调度', hasControllerBoundary(controller)],
  ['负向变异必须失败：页面不再监听手势结果', !hasPageWiring(page.replace('watch(() => editor.controlGestureOutcome', 'watch(() => editor.saveState'))],
  ['负向变异必须失败：flush 绕过活动手势', !hasControllerBoundary(controller.replace('options.isGestureActive() || !options.isDirty()', '!options.isDirty()'))],
  ['负向变异必须失败：取消也进入保存调度', !hasControllerBoundary(controller.replace("if (outcome === 'committed') schedule()", "if (outcome === 'committed' || outcome === 'cancelled') schedule()"))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('动作自动保存手势边界门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`动作自动保存手势边界门禁通过：${checks.length} 项。`)
