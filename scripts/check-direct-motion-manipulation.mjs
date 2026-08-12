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
const commit = actionBody('commitDirectManipulation', 'cancelDirectManipulation')
const selectBodyPart = actionBody('selectBodyPart', 'setAuthoringScope')
const setDirectManipulationMode = actionBody('setDirectManipulationMode', 'beginDirectManipulation')
const unchangedGuardIndex = preview.indexOf('if (!latestChanged) return false')
const compileIndex = preview.indexOf('compileSimpleMotionRecipe')
const beforeUnchangedGuard = unchangedGuardIndex >= 0 ? preview.slice(0, unchangedGuardIndex) : preview
const switchingActions = [
  actionBody('open', 'replaceFromSaved'),
  actionBody('replaceFromSaved', 'close'),
  actionBody('close', 'snapshot'),
  actionBody('undo', 'redo'),
  actionBody('redo', 'syncSimpleAuthoringState'),
  actionBody('setAuthoringMode', 'selectSimpleStage'),
  actionBody('selectSimpleStage', 'updateSimpleRecipe'),
  actionBody('selectBodyPart', 'setAuthoringScope'),
  actionBody('setDirectManipulationMode', 'beginDirectManipulation'),
]

const checks = [
  ['core exposes capabilities drag solving and pose cards', hasAll(core, [
    'export function getDirectMotionCapability',
    'export function solveDirectMotionDrag',
    'export function applyDirectMotionPoseCard',
  ])],
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
    'baselinePose:',
    'latestChanged:',
  ])],
  ['Store direct session reuses the control gesture transaction baseline', preview.includes('controlGestureBaseline') && store.includes('this.beginControlGesture()') && store.includes('this.endControlGesture()')],
  ['preview reads recipe stage and intensity only from the baseline asset', hasAll(preview, [
    'const baseline = parse(this.controlGestureBaseline)',
    'readSimpleMotionRecipe(baseline)',
    'pose: session.baselinePose',
    'intensity: baselineStage.intensity',
  ]) && !preview.includes('readSimpleMotionRecipe(this.draft)')],
  ['preview leaves the draft untouched when the latest solve is unchanged or blocked', unchangedGuardIndex >= 0
    && preview.includes("const latestChanged = result.status !== 'blocked' && result.changed")
    && compileIndex > unchangedGuardIndex
    && !beforeUnchangedGuard.includes('this.apply(')
    && !beforeUnchangedGuard.includes('this.draft =')],
  ['commit restores the baseline for an unchanged final solve and ends changed transactions', hasAll(commit, [
    'latestChanged',
    'this.cancelControlGesture()',
    'this.endControlGesture()',
  ])],
  ['part and direct mode changes cancel the active session before changing selection',
    selectBodyPart.indexOf('this.cancelDirectManipulation()') < selectBodyPart.indexOf('this.selectedBodyPartId = partId')
    && setDirectManipulationMode.indexOf('this.cancelDirectManipulation()') < setDirectManipulationMode.indexOf('getDirectMotionCapability')],
  ['stage action and mode switches cancel active direct sessions', switchingActions.every(source => source.includes('this.cancelDirectManipulation()'))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Direct motion manipulation check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Direct motion manipulation passed: ${checks.length} checks.`)
