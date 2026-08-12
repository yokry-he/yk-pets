#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定简单动作直接操控的核心求解能力、Store 事务边界与切换清理规则。
 * Locks simple-motion direct manipulation solving, Store transaction boundaries, and session cleanup rules.
 */
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const core = read('packages/pet-core/src/motion/direct-motion-manipulation.ts')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const manipulatorPath = new URL('../apps/playground/app/components/studio/StudioMotionDirectManipulator.vue', import.meta.url)
const manipulator = existsSync(manipulatorPath) ? readFileSync(manipulatorPath, 'utf8') : ''
const registryPath = new URL('../apps/playground/app/composables/useStudioMotionPartNodes.ts', import.meta.url)
const registry = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : ''
const alignedCloudFox = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const cloudFoxBody = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const cloudFoxHead = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const cloudFoxTail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')

const hasAll = (source, tokens) => tokens.every(token => source.includes(token))
const actionBody = (name, nextName) => {
  const start = store.indexOf(`    ${name}(`)
  const end = store.indexOf(`    ${nextName}(`, start + 1)
  return start >= 0 && end > start ? store.slice(start, end) : ''
}
const blockAfter = (source, marker) => {
  const markerIndex = source.indexOf(marker)
  const start = source.indexOf('{', markerIndex + marker.length)
  if (markerIndex < 0 || start < 0) return ''
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start + 1, index)
    }
  }
  return ''
}
const functionBody = (source, name) => blockAfter(source, `function ${name}(`)

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
const hasRealNodeProjection = source => hasAll(source, [
  'provideStudioMotionPartNodes',
  '@render="publishPartAnchorsAfterRender"',
  'context.camera.activeCamera.value',
  'setFromMatrixPosition(node.matrixWorld)',
  '.project(camera)',
  'anchorProjectionDirty = true',
]) && !source.includes('SEMANTIC_WORLD_ANCHORS')
  && !source.includes('semanticWorldAnchor')
const hasCanvasProjectionLifecycle = source => {
  const publishBody = functionBody(source, 'publishPartAnchorsAfterRender')
  const resizeBody = blockAfter(source, 'new ResizeObserver(() =>')
  const frameReadIndex = publishBody.indexOf('renderer.info?.render?.frame')
  const frameGuardIndex = publishBody.indexOf('frame === lastProjectionFrame')
  const frameWriteIndex = publishBody.indexOf('lastProjectionFrame = frame')
  const emitIndex = publishBody.lastIndexOf("emit('part-anchors'")
  return frameReadIndex >= 0
    && frameGuardIndex > frameReadIndex
    && frameWriteIndex > frameGuardIndex
    && emitIndex > frameWriteIndex
    && resizeBody.includes('anchorProjectionDirty = true')
    && !resizeBody.includes("emit('part-anchors'")
    && !resizeBody.includes('publishPartAnchorsAfterRender(')
    && !source.includes('requestAnimationFrame')
}
const hasInactiveProjectionGuard = source => {
  const publishBody = functionBody(source, 'publishPartAnchorsAfterRender')
  const editableReadIndex = publishBody.indexOf('const editableParts = props.editableParts || []')
  const emptyGuardIndex = publishBody.indexOf('if (!editableParts.length)')
  const rendererReadIndex = publishBody.indexOf('context.renderer.instance')
  const cameraReadIndex = publishBody.indexOf('context.camera.activeCamera.value')
  const emptyEmitIndex = publishBody.indexOf("emit('part-anchors', Object.freeze([]))")
  return editableReadIndex >= 0
    && emptyGuardIndex > editableReadIndex
    && emptyGuardIndex < rendererReadIndex
    && emptyGuardIndex < cameraReadIndex
    && emptyEmitIndex > emptyGuardIndex
    && publishBody.includes('if (!anchorProjectionDirty || !hasPublishedEditableProjection) return')
    && publishBody.includes('hasPublishedEditableProjection = false')
    && publishBody.includes('anchorProjectionDirty = false')
    && publishBody.includes('hasPublishedEditableProjection = true')
}
const hasManipulatorCancellationLifecycle = source => {
  const lostCaptureBody = functionBody(source, 'onLostPointerCapture')
  const blurBody = functionBody(source, 'onWindowBlur')
  const unmountBody = blockAfter(source, 'onBeforeUnmount(() =>')
  return hasAll(source, [
    '@lostpointercapture="onLostPointerCapture"',
    "window.addEventListener('blur', onWindowBlur)",
    "window.removeEventListener('blur', onWindowBlur)",
  ])
    && lostCaptureBody.includes('cancelPointerManipulation()')
    && blurBody.includes('cancelPointerManipulation()')
    && unmountBody.includes('cancelPointerManipulation()')
}
const hasStableManipulatorInteraction = source => {
  const hotspotKeyBody = functionBody(source, 'onHotspotKeydown')
  const nudgeBody = functionBody(source, 'nudgeWithKeyboard')
  const anchorGuardBody = blockAfter(source, 'watch([')
  return hasAll(source, [
    '1 - anchor.depth',
    "flush: 'sync'",
    'selectedAnchor?.visible',
  ])
    && /props\.editableParts\s*\.map\(partId\s*=>\s*anchorByPartId\.value\.get\(partId\)\)/.test(source)
    && !source.includes('.sort((left, right) => left.depth - right.depth)')
    && !source.includes('@keydown.stop')
    && anchorGuardBody.includes('cancelPointerManipulation()')
    && !hotspotKeyBody.includes("event.key === 'Enter'")
    && hotspotKeyBody.includes("event.key === 'Escape' && editor.directManipulation.active")
    && nudgeBody.indexOf("event.key === 'ArrowLeft'") < nudgeBody.indexOf('selectPart(partId)')
}
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
  ['唯一 Studio Canvas 从真实节点世界矩阵和当前相机发布纯数值锚点', hasAll(canvas, [
    'export interface StudioMotionPartAnchor',
    'editableParts?: readonly MotionBodyPartId[]',
    "'part-anchors': [anchors: readonly StudioMotionPartAnchor[]]",
    "emit('part-anchors'",
    'ResizeObserver',
  ]) && hasRealNodeProjection(canvas)
    && (canvas.match(/<TresCanvas\b/g) || []).length === 1
    && !/export interface StudioMotionPartAnchor\s*{[^}]*\b(?:Object3D|Vector3|Group|Mesh)\b[^}]*}/.test(canvas)],
  ['Canvas 投影按 renderer frame 去重且 Resize 只标脏', hasCanvasProjectionLifecycle(canvas)],
  ['Canvas 无可编辑部位时不投影且仅在非空转空时清理一次', hasInactiveProjectionGuard(canvas)],
  ['语义节点注册表只在渲染树内部保存 Object3D 且覆盖正式部位真实节点', hasAll(registry, [
    'Map<MotionBodyPartId, Object3D>',
    'provideStudioMotionPartNodes',
    'useStudioMotionPartNodes',
  ]) && hasAll(alignedCloudFox, ["registerStudioMotionPartNode('root'", ':ref="setMotionRef"'])
    && hasAll(cloudFoxBody, ["registerStudioMotionPartNode('body'", "'front-paw-left'", "'hind-paw-left'", 'setPawTipRef', 'setHindTipRef'])
    && hasAll(cloudFoxHead, ["registerStudioMotionPartNode('head'", "'ear-left'", 'setEarRef'])
    && hasAll(cloudFoxTail, ["registerStudioMotionPartNode('tail-root'", "registerStudioMotionPartNode('tail-mid'", "registerStudioMotionPartNode('tail-tip'"])],
  ['真实投影门禁自身拒绝缺失相机投影和硬编码锚点回退', !hasRealNodeProjection(canvas.replace('.project(camera)', ''))
    && !hasRealNodeProjection(canvas.replace('setFromMatrixPosition(node.matrixWorld)', 'set(0, 0, 0)'))
    && !hasRealNodeProjection(`${canvas}\nconst SEMANTIC_WORLD_ANCHORS = { root: [0, 0, 0] }`)],
  ['直接操控覆盖层只让热点和工具接收指针并提供中文键盘语义', hasAll(manipulator, [
    'studio-motion-direct-manipulator',
    'tabindex="0"',
    ':aria-label="partAriaLabel(anchor.bodyPartId)"',
    '@keydown="onHotspotKeydown(anchor, $event)"',
    '@pointerdown="beginPointerManipulation(anchor, $event)"',
    '移动',
    '旋转',
  ]) && /\.studio-motion-direct-manipulator\s*{[^}]*pointer-events\s*:\s*none/.test(manipulator)
    && /\.(?:direct-part-hotspot|direct-floating-tool)\s*{[^}]*pointer-events\s*:\s*auto/.test(manipulator)],
  ['直接操控覆盖层严格通过 Store 手势 API 提交且没有第二画布或动画循环', hasAll(manipulator, [
    'editor.selectBodyPart',
    'editor.setDirectManipulationMode',
    'editor.beginDirectManipulation',
    'editor.previewDirectManipulation',
    'editor.commitDirectManipulation',
    'editor.cancelDirectManipulation',
    'setPointerCapture',
    'releasePointerCapture',
  ]) && !manipulator.includes('<TresCanvas')
    && !manipulator.includes('requestAnimationFrame')
    && !manipulator.includes('.draft =')],
  ['悬浮工具依据覆盖层尺寸钳制位置并反馈安全范围', hasAll(manipulator, [
    'floatingToolPosition',
    'clamp(',
    "directManipulation.status === 'clamped'",
    '已到安全范围',
    '@pointercancel="cancelPointerManipulation"',
    "event.key === 'Escape'",
  ])],
  ['不可见部位仍可从折叠式完整列表键盘选择', hasAll(manipulator, [
    '<details class="direct-part-fallback"',
    'v-for="partId in editableParts"',
    ':aria-current="editor.selectedBodyPartId === partId',
    'selectPart(partId)',
    '完整部位列表',
  ])],
  ['指针捕获丢失、窗口失焦和卸载都取消事务且正常释放不会重复取消', hasManipulatorCancellationLifecycle(manipulator) && hasAll(manipulator, [
    'releasingPointerCapture',
    'editor.cancelDirectManipulation()',
  ])],
  ['活动部位失效会同步取消且热点顺序、深度层级和键盘传播稳定', hasStableManipulatorInteraction(manipulator)],
  ['生命周期门禁自身拒绝删除帧去重、新增 RAF、Resize 直发和删除卸载取消',
    !hasCanvasProjectionLifecycle(canvas.replace("if (typeof frame === 'number' && frame === lastProjectionFrame) return", ''))
    && !hasCanvasProjectionLifecycle(`${canvas}\nrequestAnimationFrame(() => {})`)
    && !hasCanvasProjectionLifecycle(canvas.replace(
      'new ResizeObserver(() => { anchorProjectionDirty = true })',
      "new ResizeObserver(() => { emit('part-anchors', Object.freeze([])) })",
    ))
    && !hasManipulatorCancellationLifecycle(manipulator.replace(
      'onBeforeUnmount(() => {\n  cancelPointerManipulation()',
      'onBeforeUnmount(() => {',
    ))],
  ['交互稳定性门禁自身拒绝空闲持续投影、深度正序、删除活动部位取消和恢复根级键盘拦截',
    !hasInactiveProjectionGuard(canvas.replace('if (!editableParts.length)', 'if (false)'))
    && !hasStableManipulatorInteraction(manipulator.replace('1 - anchor.depth', '1 + anchor.depth'))
    && !hasStableManipulatorInteraction(manipulator.replace(
      'if (!stillEditable || !selectedAnchor?.visible) cancelPointerManipulation()',
      'if (!stillEditable || !selectedAnchor?.visible) { /* 取消已删除 */ }',
    ))
    && !hasStableManipulatorInteraction(manipulator.replace('aria-label="3D 宠物部位直接操控层"', 'aria-label="3D 宠物部位直接操控层" @keydown.stop'))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Direct motion manipulation check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Direct motion manipulation passed: ${checks.length} checks.`)
