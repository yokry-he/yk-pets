#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定窄屏动作参数摘要与抽屉的浏览器焦点、键盘和滚动恢复行为，并用负向变异证明门禁会捕获回归。
 * Locks mobile motion inspector focus, keyboard, and scroll-restoration behavior, with negative mutations proving regression sensitivity.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const partInspector = read('apps/playground/app/components/studio/StudioMotionPartInspector.vue')

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`)
  if (start < 0) return ''
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(bodyStart + 1, index)
    }
  }
  return ''
}

function hasCapturedWindowKeyboard(source) {
  const body = functionBody(source, 'onPartInspectorWindowKeydown')
  const trap = functionBody(source, 'trapPartInspectorFocus')
  return source.includes("window.addEventListener('keydown', onPartInspectorWindowKeydown, true)")
    && source.includes("window.removeEventListener('keydown', onPartInspectorWindowKeydown, true)")
    && body.includes("event.key === 'Escape'")
    && body.includes("event.key !== 'Tab'")
    && body.includes('trapPartInspectorFocus(event)')
    && trap.includes('partInspectorPanel.value?.contains(document.activeElement)')
    && trap.includes('event.shiftKey ? last : first')
}

function hasExplicitFocusLifecycle(source) {
  const open = functionBody(source, 'openPartInspector')
  const close = functionBody(source, 'closePartInspector')
  return source.includes('ref="partInspectorCloseButton"')
    && open.includes('nextTick')
    && open.includes('partInspectorCloseButton.value?.focus')
    && close.includes('nextTick')
    && close.includes('compactPartInspector.value?.focusOpenButton()')
}

function hasDualOverflowLifecycle(source) {
  const lock = functionBody(source, 'lockDocumentOverflow')
  const restore = functionBody(source, 'restoreDocumentOverflow')
  const sync = functionBody(source, 'syncNarrowViewport')
  return lock.includes('document.documentElement')
    && lock.includes('document.body')
    && restore.includes('document.documentElement')
    && restore.includes('document.body')
    && restore.includes('overflowLockActive = false')
    && sync.includes('restoreDocumentOverflow()')
    && !/watch\(\(\) => editor\.partInspectorOpen,[\s\S]*?if \(!import\.meta\.client \|\| !narrowViewport\.value\) return/.test(source)
}

function hasCompactThreeControlSummary(source) {
  return source.includes('compact?: boolean')
    && source.includes('visibleParameters.value.slice(0, 3)')
    && source.includes('v-for="parameter in compactParameters"')
    && source.includes('<StudioDirectSemanticControl')
    && source.includes('部位操作方式')
    && source.includes('更多参数')
    && source.includes('focusOpenButton')
}

const checks = [
  ['window 捕获阶段处理 Escape 和真正的 Tab/Shift+Tab 约束', hasCapturedWindowKeyboard(motionPage)],
  ['打开后聚焦关闭按钮且关闭后恢复到更多参数触发器', hasExplicitFocusLifecycle(motionPage)],
  ['documentElement 与 body 的滚动样式在关闭、卸载和跨断点时恢复', hasDualOverflowLifecycle(motionPage)],
  ['窄屏摘要复用同一部位组件与语义参数组件动态显示前三项', hasCompactThreeControlSummary(partInspector)],
]

const mutations = [
  ['移除 keydown 捕获', hasCapturedWindowKeyboard(motionPage.replace("window.addEventListener('keydown', onPartInspectorWindowKeydown, true)", "window.addEventListener('keydown', onPartInspectorWindowKeydown)"))],
  ['移除 body 滚动恢复', hasDualOverflowLifecycle(motionPage.replaceAll('document.body', 'document.documentElement'))],
  ['恢复窄屏提前返回', hasDualOverflowLifecycle(motionPage.replace("if (!import.meta.client) return", "if (!import.meta.client || !narrowViewport.value) return"))],
  ['把常用参数扩大为四项', hasCompactThreeControlSummary(partInspector.replace('visibleParameters.value.slice(0, 3)', 'visibleParameters.value.slice(0, 4)'))],
]

for (const [name, survived] of mutations) checks.push([`负向变异必须失败：${name}`, !survived])

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('窄屏动作参数浏览器行为门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`窄屏动作参数浏览器行为门禁通过：${checks.length} 项。`)
