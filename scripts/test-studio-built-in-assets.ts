/**
 * 文件职责 / File responsibility
 * 验证 Studio 内置动作与道具均可规范化、使用稳定唯一 ID，并且动作中的道具依赖可以解析。
 * Verifies that built-in Studio motions and props normalize cleanly, use stable unique ids, and resolve motion prop dependencies.
 */
import assert from 'node:assert/strict'
import { isCloudFoxRigChannelId, normalizeMotionAsset, normalizePropAsset } from '../packages/pet-core/src/index.ts'
import { BUILT_IN_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-built-in-motions.ts'
import { BUILT_IN_STUDIO_PROPS } from '../apps/playground/app/domain/studio-built-in-props.ts'

assert.equal(BUILT_IN_STUDIO_PROPS.length, 6)
assert.equal(BUILT_IN_STUDIO_MOTIONS.length, 6)
assert.equal(new Set(BUILT_IN_STUDIO_PROPS.map(item => item.id)).size, BUILT_IN_STUDIO_PROPS.length)
assert.equal(new Set(BUILT_IN_STUDIO_MOTIONS.map(item => item.id)).size, BUILT_IN_STUDIO_MOTIONS.length)

const propIds = new Set(BUILT_IN_STUDIO_PROPS.map(item => item.id))
for (const prop of BUILT_IN_STUDIO_PROPS) {
  const result = normalizePropAsset(prop)
  assert.equal(result.asset.id, prop.id)
  assert.ok(result.asset.components.length >= 2)
  assert.ok(result.asset.components.length <= 48)
}

for (const motion of BUILT_IN_STUDIO_MOTIONS) {
  const result = normalizeMotionAsset(motion)
  assert.equal(result.asset.id, motion.id)
  assert.ok(result.asset.durationMs >= 7000, `${motion.id} 时长至少为 7 秒`)
  assert.ok(result.asset.tracks.length >= 10, `${motion.id} 至少使用 10 个语义通道`)
  assert.ok(result.asset.tracks.reduce((sum, item) => sum + item.keyframes.length, 0) >= 45, `${motion.id} 至少包含 45 个关键帧`)
  assert.ok(new Set(result.asset.tracks.flatMap(item => item.keyframes.map(keyframe => keyframe.timeMs))).size >= 12, `${motion.id} 至少包含 12 个编排时刻`)
  assert.ok(result.asset.tracks.every(track => isCloudFoxRigChannelId(track.channelId)))
  assert.ok(result.asset.tracks.every(track => track.keyframes.every(keyframe => keyframe.timeMs >= 0 && keyframe.timeMs <= result.asset.durationMs)))
  assert.ok(result.asset.propIds.every(propId => propIds.has(propId)))
  assert.ok(result.asset.propEventTracks.every(track => result.asset.propIds.includes(track.propId)))

  if (result.asset.loopMode === 'loop') {
    for (const motionTrack of result.asset.tracks) {
      assert.equal(motionTrack.keyframes[0]?.timeMs, 0, `${motion.id}/${motionTrack.channelId} 循环轨道必须从 0 开始`)
      assert.equal(motionTrack.keyframes.at(-1)?.timeMs, result.asset.durationMs, `${motion.id}/${motionTrack.channelId} 循环轨道必须覆盖完整时长`)
      assert.equal(motionTrack.keyframes[0]?.value, motionTrack.keyframes.at(-1)?.value, `${motion.id}/${motionTrack.channelId} 循环轨道首尾值必须一致`)
    }
  }
}

assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-nebula-staff')))
assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-glow-sticks')))
console.log('Studio built-in assets passed: 6 props, 6 motions, all dependencies resolved.')
