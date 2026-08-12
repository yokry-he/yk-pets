#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定简单动作直接操控的核心求解能力、Store 事务边界与切换清理规则。
 * Locks simple-motion direct manipulation solving, Store transaction boundaries, and session cleanup rules.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const core = read('packages/pet-core/src/motion/direct-motion-manipulation.ts')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')

const hasAll = (source, tokens) => tokens.every(token => source.includes(token))
const actionBody = (name, nextName) => {
  const start = store.indexOf(`    ${name}(`)
  const end = store.indexOf(`    ${nextName}(`, start + 1)
  return start >= 0 && end > start ? store.slice(start, end) : ''
}

const preview = actionBody('previewDirectManipulation', 'commitDirectManipulation')
const switchingActions = [
  actionBody('open', 'replaceFromSaved'),
  actionBody('replaceFromSaved', 'close'),
  actionBody('close', 'snapshot'),
  actionBody('undo', 'redo'),
  actionBody('redo', 'syncSimpleAuthoringState'),
  actionBody('setAuthoringMode', 'selectSimpleStage'),
  actionBody('selectSimpleStage', 'updateSimpleRecipe'),
  actionBody('setDirectManipulationMode', 'beginDirectManipulation'),
]

const checks = [
  ['core exposes direct drag solving', core.includes('export function solveDirectMotionDrag')],
  ['Store exposes direct manipulation state and commands', hasAll(store, [
    'directManipulationMode:',
    'directManipulation:',
    'beginDirectManipulation',
    'previewDirectManipulation',
    'commitDirectManipulation',
    'cancelDirectManipulation',
    'applyDirectPoseCard',
    'setDirectManipulationMode',
    'resetSelectedDirectPart',
  ])],
  ['Store direct session reuses the control gesture transaction baseline', preview.includes('controlGestureBaseline') && store.includes('this.beginControlGesture()') && store.includes('this.endControlGesture()')],
  ['preview passes the selected stage intensity explicitly', preview.includes('intensity: stage.intensity')],
  ['preview skips compiling and applying unchanged or blocked results', preview.includes('!result.changed') && preview.includes("result.status === 'blocked'") && preview.indexOf('!result.changed') < preview.indexOf('compileSimpleMotionRecipe')],
  ['stage action and mode switches cancel active direct sessions', switchingActions.every(source => source.includes('this.cancelDirectManipulation()'))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Direct motion manipulation check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Direct motion manipulation passed: ${checks.length} checks.`)
