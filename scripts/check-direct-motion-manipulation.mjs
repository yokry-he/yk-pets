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
const directBegin = actionBody('beginDirectManipulation', 'previewDirectManipulation')
const controlBegin = actionBody('beginControlGesture', 'previewControlGesture')
const controlEnd = actionBody('endControlGesture', 'cancelControlGesture')
const controlCancel = actionBody('cancelControlGesture', 'setDirectManipulationMode')
const commit = actionBody('commitDirectManipulation', 'cancelDirectManipulation')
const unchangedGuardIndex = preview.indexOf('if (!latestChanged) return false')
const compileIndex = preview.indexOf('compileSimpleMotionRecipe')
const nextRecipeIndex = preview.indexOf('const nextRecipe: SimpleMotionRecipeV1')
const beforeUnchangedGuard = unchangedGuardIndex >= 0 ? preview.slice(0, unchangedGuardIndex) : preview
const baselineParseIndex = directBegin.indexOf('const baseline = parse(this.controlGestureBaseline)')
const baselineRecipeReadIndex = directBegin.indexOf('readSimpleMotionRecipe(baseline)')
const baselineStageDeclarationIndex = directBegin.indexOf('const baselineStage =')
const inlineBaselineStageIndex = directBegin.indexOf('readSimpleMotionRecipe(baseline)?.stages.find')
const namedBaselineStageIndex = directBegin.indexOf('baselineRecipe?.stages.find')
const baselineStageSourceIndex = inlineBaselineStageIndex >= 0 ? inlineBaselineStageIndex : namedBaselineStageIndex
const baselinePoseIndex = directBegin.indexOf('baselinePose: Object.freeze({ ...baselineStage.pose })')
const directBaselineSourceChain = baselineParseIndex >= 0
  && baselineRecipeReadIndex > baselineParseIndex
  && baselineStageDeclarationIndex > baselineParseIndex
  && baselineStageSourceIndex >= baselineRecipeReadIndex
  && baselinePoseIndex > baselineStageSourceIndex
const commitUsesLatestSolve = /if\s*\(latestChanged\)\s*this\.endControlGesture\(\)\s*else\s*this\.cancelControlGesture\(\)/.test(commit)
const switchingActions = [
  ['open', 'replaceFromSaved', 'this.motionId = asset.id'],
  ['replaceFromSaved', 'close', 'this.motionId = asset.id'],
  ['close', 'snapshot', "this.motionId = ''"],
  ['undo', 'redo', 'const previous = this.undoStack.pop()'],
  ['redo', 'syncSimpleAuthoringState', 'const next = this.redoStack.pop()'],
  ['setAuthoringMode', 'selectSimpleStage', 'this.authoringMode = mode'],
  ['selectSimpleStage', 'updateSimpleRecipe', 'this.selectedStageId = stageId'],
  ['selectBodyPart', 'setAuthoringScope', 'this.selectedBodyPartId = partId'],
  ['setTransformMode', 'selectControl', 'this.transformMode = mode'],
  ['selectControl', 'controlOptions', 'this.selectedControlId = controlId'],
  ['setDirectManipulationMode', 'beginDirectManipulation', 'this.directManipulationMode = mode'],
].map(([name, nextName, firstStateWrite]) => {
  const source = actionBody(name, nextName)
  return {
    name,
    source,
    cancelIndex: source.indexOf('this.cancelDirectManipulation()'),
    firstStateWriteIndex: source.indexOf(firstStateWrite),
  }
})

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
  ['direct session pose follows the parsed baseline recipe stage source chain', directBaselineSourceChain],
  ['gesture begin and cancel preserve undo redo history', !controlBegin.includes('this.snapshot()')
    && !controlBegin.includes('undoStack')
    && !controlBegin.includes('redoStack')
    && !controlCancel.includes('undoStack')
    && !controlCancel.includes('redoStack')],
  ['gesture end commits only changed baselines with one bounded undo entry', hasAll(controlEnd, [
    'serialize(this.draft) !== this.controlGestureBaseline',
    'this.undoStack.at(-1) !== this.controlGestureBaseline',
    'this.undoStack.push(this.controlGestureBaseline)',
    'if (this.undoStack.length > 100) this.undoStack.shift()',
    'this.redoStack = []',
  ])],
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
  ['preview derives and compiles only the selected baseline recipe stage', nextRecipeIndex > unchangedGuardIndex
    && hasAll(preview.slice(nextRecipeIndex), [
      '...baselineRecipe,',
      'stages: baselineRecipe.stages.map',
      'compileSimpleMotionRecipe(baseline, nextRecipe',
    ])],
  ['commit ends only a changed latest solve and otherwise restores the baseline', commitUsesLatestSolve],
  ['all stage action control and mode switches cancel before their first state write', switchingActions.every(action =>
    action.source
    && action.cancelIndex >= 0
    && action.firstStateWriteIndex >= 0
    && action.cancelIndex < action.firstStateWriteIndex)],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Direct motion manipulation check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Direct motion manipulation passed: ${checks.length} checks.`)
