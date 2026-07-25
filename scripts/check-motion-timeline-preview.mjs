#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定动作草稿、时间轴关键帧编辑、单帧一次求值和唯一正式云狐渲染器的语义姿态消费链路。
 * Locks motion drafts, timeline keyframe editing, once-per-frame evaluation, and semantic-pose consumption through the sole production Cloud Fox renderer.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('apps/playground/app/pages/studio/motion.vue')
const editor = read('apps/playground/app/stores/studio-motion-editor.ts')
const timeline = read('apps/playground/app/components/studio/StudioMotionTimeline.vue')
const poseEditor = read('apps/playground/app/components/studio/StudioMotionPoseEditor.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const procedural = read('apps/playground/app/components/studio/ProceduralPet.vue')
const renderer = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const authoring = read('packages/pet-core/src/motion/motion-authoring.ts')
const manifest = read('apps/extension/wxt.config.ts')
const all = [page, editor, timeline, poseEditor, canvas, procedural, renderer, body, head, face, tail, authoring]

const checks = [
  ['motion editor owns an independent draft and transaction history', editor.includes('baseline') && editor.includes('undoStack') && editor.includes('redoStack') && editor.includes('snapshot()') && editor.includes('markSaved')],
  ['playhead supports once loop and ping-pong playback', editor.includes('playheadTimeMs') && editor.includes('advancePlayback') && editor.includes('resolveMotionTime') && editor.includes("loopMode === 'once'")],
  ['timeline supports selection dragging and multi-select', timeline.includes("emit('selectMany'") && timeline.includes("emit('moveSelected'") && timeline.includes('pointermove') && timeline.includes('selectedKeyframeIds')],
  ['pose editor writes semantic keyframes and controls step or linear', poseEditor.includes("emit('write'") && poseEditor.includes("emit('interpolation'") && poseEditor.includes('CLOUD_FOX_RIG_TRACK_GROUPS') && poseEditor.includes('step') && poseEditor.includes('linear')],
  ['authoring domain supports write copy paste move delete', ['writeMotionChannelValue', 'copyMotionKeyframes', 'pasteMotionKeyframes', 'moveMotionKeyframes', 'removeMotionKeyframes'].every(token => authoring.includes(token))],
  ['motion page evaluates once and passes one immutable pose to preview', page.includes('const pose = evaluateNormalizedMotionAsset(draft.value, editor.playheadTimeMs)') && page.includes(':custom-pose="evaluatedPose"')],
  ['custom pose flows through the sole preview and renderer', canvas.includes('customPose') && procedural.includes('customPose') && renderer.includes('customPose') && canvas.includes('<TresCanvas') && !timeline.includes('<TresCanvas') && !poseEditor.includes('<TresCanvas')],
  ['root body head paws face tail and antenna channels are consumed', renderer.includes("'root.position.x'") && renderer.includes("'body.position.x'") && body.includes("`${prefix}.rotation.x`") && body.includes("`${prefix}.rotation.z`") && body.includes("frontPaw.left") && body.includes("hindPaw.right") && head.includes("'head.rotation.x'") && head.includes("'ear.left.rotation.x'") && head.includes("'eye.left.closure'") && head.includes("'antenna.right.length'") && face.includes("'mouth.open'") && tail.includes("'tail.tip.rotation.z'")],
  ['un-authored face channels retain procedural behavior', face.includes('hasAuthoredPoseChannel') && head.includes('hasAuthoredPoseChannel')],
  ['no upload polling websocket permission or second renderer was added', all.every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(')) && manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Motion timeline preview check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Motion timeline preview passed: ${checks.length} checks.`)
