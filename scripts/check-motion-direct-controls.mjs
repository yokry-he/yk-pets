#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定动作身体部件树、三种作用范围、移动旋转缩放直接操控、对称编辑和整段非破坏修正层。
 * Locks the motion body-part tree, three authoring scopes, direct translate/rotate/scale controls, symmetry, and the non-destructive whole-clip correction layer.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const controls = read('packages/pet-core/src/motion/motion-controls.ts')
const tests = read('packages/pet-core/test/motion-controls-direct.test.ts')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')
const page = read('apps/playground/app/pages/studio/motion.vue')
const panel = read('apps/playground/app/components/studio/StudioMotionTransformEditor.vue')
const pad = read('apps/playground/app/components/studio/StudioMotionDirectPad.vue')
const checks = [
  ['framework-neutral body-part and control registry exists', controls.includes('MOTION_BODY_PARTS') && controls.includes('MOTION_CONTROLS') && controls.includes("'root.scale.uniform'") && controls.includes("'body.scale.uniform'")],
  ['three authoring scopes are domain contracts', controls.includes("'current-frame' | 'selected-keyframes' | 'entire-motion'") && controls.includes('applyCurrentFrameAssignments') && controls.includes('applySelectedKeyframeAssignments') && controls.includes('applyEntireMotionAssignments')],
  ['whole motion uses a separate additive correction layer', controls.includes("MOTION_CLIP_ADJUSTMENT_LAYER_ID = 'clip-adjustment'") && controls.includes("mode: 'additive'") && controls.includes('priority: 100')],
  ['symmetry uses semantic channel mirroring', controls.includes('mirrorCloudFoxChannelId') && controls.includes('expandSymmetryAssignments') && controls.includes('shouldInvertMirroredValue')],
  ['editor store exposes part scope mode gesture and reset commands', ['selectBodyPart','setAuthoringScope','setTransformMode','writeControlValue','nudgeControl','resetControl','beginControlGesture','previewControlGesture','endControlGesture'].every(token => store.includes(token))],
  ['Motion Studio mounts direct pad and appearance-style transform panel', page.includes('StudioMotionDirectPad') && page.includes('StudioMotionTransformEditor') && page.includes("event.key.toLowerCase() === 'w'") && page.includes("event.key.toLowerCase() === 'k'")],
  ['panel exposes part tree scopes symmetry and safe scale', panel.includes('动作身体部件树') && panel.includes('当前帧') && panel.includes('已选关键帧') && panel.includes('整段动作') && panel.includes('对称编辑') && panel.includes('自动关键帧')],
  ['part tree exposes nose and motion-safe expression deformation', controls.includes("id: 'nose'") && controls.includes("'eye.expressionTilt'") && controls.includes("'nose.sniff'") && controls.includes("'tail.fluff'")],
  ['motion-safe controls reuse current-frame keyframe commands', panel.includes('editor.writeControlValue') && store.includes('setMotionControlValue') && store.includes('playheadTimeMs: this.playheadTimeMs')],
  ['preview pad supports direct translate rotate and scale gestures', pad.includes('setPointerCapture') && pad.includes('beginControlGesture') && pad.includes('previewControlGesture') && pad.includes("['translate','rotate','scale']")],
  ['domain tests cover registry current selected whole clip symmetry and scale', ['body-part and control registries','current-frame uniform scale','symmetry writes','selected-keyframe scope','whole-motion edits'].every(token => tests.includes(token))],
  ['direct controls add no upload polling websocket or second canvas', [controls, store, panel, pad].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(') && !source.includes('<TresCanvas'))],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Motion direct controls check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Motion direct controls passed: ${checks.length} checks.`)
