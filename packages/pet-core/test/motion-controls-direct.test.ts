/**
 * 文件职责 / File responsibility
 * 验证身体部件控制注册表以及当前帧、已选关键帧、整段修正与对称编辑命令。
 * Verifies the body-part control registry and current-frame, selected-keyframe, whole-clip, and symmetry authoring commands.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MOTION_BODY_PARTS,
  MOTION_CLIP_ADJUSTMENT_LAYER_ID,
  MOTION_CONTROLS,
  createStudioMotionAsset,
  evaluateNormalizedMotionAsset,
  fromMotionControlDisplayValue,
  getMotionBodyPartControls,
  nudgeMotionControlValue,
  readMotionControlValue,
  resetMotionControlValue,
  setMotionControlValue,
  toMotionControlDisplayValue,
  writeMotionChannelValue,
} from '../src/index.ts'

const base = () => createStudioMotionAsset({
  id: 'motion-direct-controls',
  nameZh: '直接操控',
  nameEn: 'Direct controls',
  durationMs: 1000,
  displayFps: 10,
  loopMode: 'once',
  propIds: [],
  tracks: [],
  createdAt: 1,
  updatedAt: 1,
})

const options = {
  scope: 'current-frame' as const,
  playheadTimeMs: 149,
  selectedKeyframeIds: [] as string[],
  interpolation: 'linear' as const,
  snapToFrames: true,
  displayFps: 10,
  layerId: 'base',
  symmetry: false,
}

test('body-part and control registries remain unique and only reference semantic channels', () => {
  assert.equal(new Set(MOTION_BODY_PARTS.map(item => item.id)).size, MOTION_BODY_PARTS.length)
  assert.equal(new Set(MOTION_CONTROLS.map(item => item.id)).size, MOTION_CONTROLS.length)
  assert.ok(getMotionBodyPartControls('root', 'translate').length === 3)
  assert.ok(getMotionBodyPartControls('root', 'scale').some(item => item.id === 'root.scale.uniform'))
  assert.ok(getMotionBodyPartControls('face', 'semantic').length >= 5)
  assert.ok(MOTION_BODY_PARTS.some(item => item.id === 'nose' && item.parentId === 'face'))
  assert.ok(getMotionBodyPartControls('nose', 'semantic').some(item => item.channelIds.includes('nose.sniff')))
  assert.ok(getMotionBodyPartControls('tail-root', 'scale').some(item => item.channelIds.includes('tail.fluff')))
  assert.ok(MOTION_CONTROLS.every(item => item.channelIds.every(channelId => !channelId.includes('mesh') && !channelId.includes('/'))))
})

test('current-frame uniform scale writes three snapped semantic keyframes', () => {
  const result = setMotionControlValue(base(), 'root.scale.uniform', .25, options)
  assert.equal(result.affectedChannelIds.length, 3)
  assert.equal(result.selectedKeyframeIds.length, 3)
  assert.deepEqual(
    result.asset.tracks.map(track => [track.channelId, track.keyframes[0]?.timeMs, track.keyframes[0]?.value]).sort(),
    [
      ['root.scale.x', 100, .25],
      ['root.scale.y', 100, .25],
      ['root.scale.z', 100, .25],
    ],
  )
  const pose = evaluateNormalizedMotionAsset(result.asset, 100)
  assert.equal(pose.values['root.scale.x'], .25)
  assert.equal(pose.values['root.scale.y'], .25)
  assert.equal(pose.values['root.scale.z'], .25)
})

test('symmetry writes the partner channel with mirrored rotation sign', () => {
  const result = nudgeMotionControlValue(base(), 'front-paw-left.rotate.z', .4, { ...options, symmetry: true })
  assert.deepEqual(
    result.asset.tracks.map(track => [track.channelId, track.keyframes[0]?.value]).sort(),
    [
      ['frontPaw.left.rotation.z', .4],
      ['frontPaw.right.rotation.z', -.4],
    ],
  )
})

test('selected-keyframe scope only edits selected matching channels', () => {
  const left = writeMotionChannelValue(base(), 'head.rotation.x', 100, .1, 'linear', { snapToFrames: false })
  const right = writeMotionChannelValue(left.asset, 'head.rotation.x', 400, .2, 'linear', { snapToFrames: false })
  const unrelated = writeMotionChannelValue(right.asset, 'mouth.open', 400, .8, 'linear', { snapToFrames: false })
  const target = right.asset.tracks.find(track => track.channelId === 'head.rotation.x')?.keyframes[1]?.id
  assert.ok(target)
  const result = nudgeMotionControlValue(unrelated.asset, 'head.rotate.x', .3, {
    ...options,
    scope: 'selected-keyframes',
    selectedKeyframeIds: [target!],
  })
  const head = result.asset.tracks.find(track => track.channelId === 'head.rotation.x')!
  assert.deepEqual(head.keyframes.map(item => item.value), [.1, .5])
  assert.equal(result.asset.tracks.find(track => track.channelId === 'mouth.open')?.keyframes[0]?.value, .8)
})

test('whole-motion edits use a removable additive correction layer', () => {
  const first = setMotionControlValue(base(), 'root.translate.y', .4, { ...options, scope: 'entire-motion' })
  assert.ok(first.asset.layers.some(layer => layer.id === MOTION_CLIP_ADJUSTMENT_LAYER_ID && layer.mode === 'additive'))
  const track = first.asset.tracks.find(item => item.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID && item.channelId === 'root.position.y')
  assert.deepEqual(track?.keyframes.map(item => [item.timeMs, item.value]), [[0, .4], [1000, .4]])
  assert.equal(readMotionControlValue(first.asset, 'root.translate.y', 'entire-motion', { playheadTimeMs: 500 }), .4)
  assert.equal(evaluateNormalizedMotionAsset(first.asset, 500).values['root.position.y'], .4)

  const reset = resetMotionControlValue(first.asset, 'root.translate.y', { ...options, scope: 'entire-motion' })
  assert.equal(reset.asset.tracks.some(item => item.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID), false)
  assert.equal(reset.asset.layers.some(item => item.id === MOTION_CLIP_ADJUSTMENT_LAYER_ID), false)
})

test('degree display conversion round-trips without changing stored radians', () => {
  const radians = fromMotionControlDisplayValue(45, 'degree')
  assert.ok(Math.abs(radians - Math.PI / 4) < 1e-9)
  assert.ok(Math.abs(toMotionControlDisplayValue(radians, 'degree') - 45) < 1e-9)
})
