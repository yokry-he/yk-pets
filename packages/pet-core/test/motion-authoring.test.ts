/**
 * 文件职责 / File responsibility
 * 验证动作时间轴编辑命令在吸附、复制、移动、删除和重复时间覆盖时保持确定性。
 * Verifies deterministic timeline authoring commands for snapping, copying, moving, deleting, and duplicate-time replacement.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyMotionKeyframes,
  createStudioMotionAsset,
  moveMotionKeyframes,
  pasteMotionKeyframes,
  removeMotionKeyframes,
  setMotionKeyframeInterpolation,
  writeMotionChannelValue,
} from '../src/index.ts'

const base = () => createStudioMotionAsset({
  id: 'motion-authoring',
  nameZh: '编辑',
  nameEn: 'Authoring',
  durationMs: 1000,
  displayFps: 10,
  loopMode: 'once',
  propIds: [],
  tracks: [],
  createdAt: 1,
  updatedAt: 1,
})

test('channel writing snaps to the FPS grid and replaces duplicate times', () => {
  const first = writeMotionChannelValue(base(), 'root.position.y', 149, 1)
  assert.equal(first.asset.tracks[0]?.keyframes[0]?.timeMs, 100)
  const second = writeMotionChannelValue(first.asset, 'root.position.y', 151, 2, 'step')
  assert.deepEqual(second.asset.tracks[0]?.keyframes.map(keyframe => [keyframe.timeMs, keyframe.value]), [[100, 1], [200, 2]])
  const replacement = writeMotionChannelValue(second.asset, 'root.position.y', 199, 3)
  assert.deepEqual(replacement.asset.tracks[0]?.keyframes.map(keyframe => [keyframe.timeMs, keyframe.value]), [[100, 1], [200, 3]])
})

test('copy, paste, move, interpolation, and delete preserve stable ids', () => {
  const a = writeMotionChannelValue(base(), 'head.rotation.z', 100, .2)
  const b = writeMotionChannelValue(a.asset, 'mouth.open', 300, .8, 'step')
  const ids = b.asset.tracks.flatMap(track => track.keyframes.map(keyframe => keyframe.id))
  const clipboard = copyMotionKeyframes(b.asset, ids)
  const pasted = pasteMotionKeyframes(b.asset, clipboard, 500)
  assert.equal(pasted.selectedKeyframeIds.length, 2)
  const moved = moveMotionKeyframes(pasted.asset, pasted.selectedKeyframeIds, 200)
  assert.deepEqual(moved.asset.tracks.flatMap(track => track.keyframes.map(keyframe => keyframe.timeMs)).sort((x, y) => x - y), [100, 300, 700, 900])
  const stepped = setMotionKeyframeInterpolation(moved.asset, moved.selectedKeyframeIds, 'step')
  assert.ok(stepped.tracks.flatMap(track => track.keyframes).filter(keyframe => moved.selectedKeyframeIds.includes(keyframe.id)).every(keyframe => keyframe.interpolation === 'step'))
  const removed = removeMotionKeyframes(stepped, moved.selectedKeyframeIds)
  assert.equal(removed.tracks.flatMap(track => track.keyframes).length, 2)
})
