/**
 * 文件职责 / File responsibility
 * 验证 Studio 内置动作与道具均可规范化、使用稳定唯一 ID，并且动作中的道具依赖可以解析。
 * Verifies that built-in Studio motions and props normalize cleanly, use stable unique ids, and resolve motion prop dependencies.
 */
import assert from 'node:assert/strict'
import { compileBipedPetMotion, isCloudFoxRigChannelId, normalizeMotionAsset, normalizePropAsset, sampleBipedPetMotion } from '../packages/pet-core/src/index.ts'
import { BASIC_BIPED_STUDIO_MOTIONS, createBasicBipedStudioMotion } from '../apps/playground/app/domain/studio-basic-biped-motions.ts'
import { BUILT_IN_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-built-in-motions.ts'
import { BUILT_IN_STUDIO_PROPS } from '../apps/playground/app/domain/studio-built-in-props.ts'

assert.equal(BUILT_IN_STUDIO_PROPS.length, 6)
assert.equal(BUILT_IN_STUDIO_MOTIONS.length, 11)
assert.equal(new Set(BUILT_IN_STUDIO_PROPS.map(item => item.id)).size, BUILT_IN_STUDIO_PROPS.length)
assert.equal(new Set(BUILT_IN_STUDIO_MOTIONS.map(item => item.id)).size, BUILT_IN_STUDIO_MOTIONS.length)

const propIds = new Set(BUILT_IN_STUDIO_PROPS.map(item => item.id))
for (const prop of BUILT_IN_STUDIO_PROPS) {
  const result = normalizePropAsset(prop)
  assert.equal(result.asset.id, prop.id)
  assert.ok(result.asset.components.length >= 2)
  assert.ok(result.asset.components.length <= 48)
}

const basicMotionIds = new Set(BASIC_BIPED_STUDIO_MOTIONS.map(item => item.id))
for (const motion of BUILT_IN_STUDIO_MOTIONS) {
  const result = normalizeMotionAsset(motion)
  assert.equal(result.asset.id, motion.id)
  if (basicMotionIds.has(motion.id)) {
    assert.ok(result.asset.durationMs >= 1200 && result.asset.durationMs <= 4000, `${motion.id} 必须保持基础动作时长`)
    assert.ok(result.asset.tracks.length >= 6, `${motion.id} 至少使用 6 个动力链通道`)
    assert.equal(compileBipedPetMotion(result.asset).status, 'ready')
  }
  else {
    assert.ok(result.asset.durationMs >= 7000, `${motion.id} 时长至少为 7 秒`)
    assert.ok(result.asset.tracks.length >= 10, `${motion.id} 至少使用 10 个语义通道`)
    assert.ok(result.asset.tracks.reduce((sum, item) => sum + item.keyframes.length, 0) >= 45, `${motion.id} 至少包含 45 个关键帧`)
    assert.ok(new Set(result.asset.tracks.flatMap(item => item.keyframes.map(keyframe => keyframe.timeMs))).size >= 12, `${motion.id} 至少包含 12 个编排时刻`)
  }
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

const expectedBasicMotions = [
  ['builtin-biped-idle', 3600, 'loop'],
  ['builtin-biped-walk', 1200, 'loop'],
  ['builtin-biped-jump', 2400, 'once'],
  ['builtin-biped-wave', 3200, 'once'],
  ['builtin-biped-straight-punch', 4000, 'once'],
] as const
assert.equal(BASIC_BIPED_STUDIO_MOTIONS.length, expectedBasicMotions.length)
for (const [id, durationMs, loopMode] of expectedBasicMotions) {
  const motion = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === id)
  assert.ok(motion, `缺少基础动作 ${id}`)
  assert.equal(motion.durationMs, durationMs)
  assert.equal(motion.loopMode, loopMode)
}

const fastWalk = createBasicBipedStudioMotion('walk', { speed: 2, amplitude: 1.4, strength: 1.3, emotion: 'focused', loopMode: 'once' })
assert.equal(fastWalk.durationMs, 600)
assert.equal(fastWalk.loopMode, 'once')
const jumpClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-jump'))
const walkClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-walk'))
const idleClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-idle'))
const waveClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-wave'))
const punchClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-straight-punch'))
assert.deepEqual(jumpClip.events.map(item => item.kind), ['takeoff', 'landing'])

const nearlyEqual = (actual: number, expected: number) => Math.abs(actual - expected) <= 1e-12

function assertFullDurationDoubleSupport(
  clip: ReturnType<typeof compileBipedPetMotion>,
  motionId: string,
  expectedConfidence: Readonly<Record<'foot.left' | 'foot.right', number>>,
) {
  assert.deepEqual(clip.contacts.map(item => ({ contactId: item.contactId, startMs: item.startMs, endMs: item.endMs })), [
    { contactId: 'foot.left', startMs: 0, endMs: clip.durationMs },
    { contactId: 'foot.right', startMs: 0, endMs: clip.durationMs },
  ], `${motionId} 必须声明覆盖完整时长的左右脚支撑区间`)
  for (const [timeMs, phase, expectedWeight] of [[40, 'acquiring', .5], [clip.durationMs / 2, 'locked', 1], [clip.durationMs - 40, 'releasing', .5]] as const) {
    const sample = sampleBipedPetMotion(clip, timeMs)
    assert.deepEqual(sample.contactStates.map(item => item.contactId), ['foot.left', 'foot.right'], `${motionId}/${timeMs} 必须采样到双脚接触状态`)
    assert.ok(sample.contactStates.every(item => item.phase === phase), `${motionId}/${timeMs} 接触阶段必须为 ${phase}`)
    assert.ok(sample.contactStates.every(item => nearlyEqual(item.weight, expectedWeight)), `${motionId}/${timeMs} 接触权重必须为 ${expectedWeight}`)
    assert.ok(sample.contactStates.every(item => Number.isFinite(item.confidence)), `${motionId}/${timeMs} 接触置信度必须有限`)
    assert.ok(sample.contactStates.every(item => nearlyEqual(item.confidence, expectedConfidence[item.contactId as 'foot.left' | 'foot.right'])), `${motionId}/${timeMs} 必须保留模板接触置信度`)
    assert.deepEqual(sample.activeContacts, ['foot.left', 'foot.right'], `${motionId}/${timeMs} 必须保持双脚有效支撑`)
  }
}
assertFullDurationDoubleSupport(idleClip, 'builtin-biped-idle', { 'foot.left': .95, 'foot.right': .95 })
assertFullDurationDoubleSupport(waveClip, 'builtin-biped-wave', { 'foot.left': .9, 'foot.right': .9 })
assertFullDurationDoubleSupport(punchClip, 'builtin-biped-straight-punch', { 'foot.left': .82, 'foot.right': .9 })
assert.deepEqual(sampleBipedPetMotion(jumpClip, 200).activeContacts, ['foot.left', 'foot.right'])
assert.deepEqual(sampleBipedPetMotion(jumpClip, 1200).activeContacts, [])
assert.deepEqual(sampleBipedPetMotion(jumpClip, 2100).activeContacts, ['foot.left', 'foot.right'])
assert.deepEqual(sampleBipedPetMotion(walkClip, 40).activeContacts, ['foot.left', 'foot.right'])
assert.deepEqual(sampleBipedPetMotion(walkClip, 300).activeContacts, ['foot.left'])
assert.deepEqual(sampleBipedPetMotion(walkClip, 640).activeContacts, ['foot.right'])
assert.deepEqual(sampleBipedPetMotion(walkClip, 1180).activeContacts, ['foot.left', 'foot.right'])

assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-nebula-staff')))
assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-glow-sticks')))
console.log('Studio built-in assets passed: 6 props, 5 basic motions, 6 advanced motions, all dependencies resolved.')
