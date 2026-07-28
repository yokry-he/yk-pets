/**
 * 文件职责 / File responsibility
 * 验证 Studio 内置动作与道具均可规范化、使用稳定唯一 ID，并且动作中的道具依赖可以解析。
 * Verifies that built-in Studio motions and props normalize cleanly, use stable unique ids, and resolve motion prop dependencies.
 */
import assert from 'node:assert/strict'
import {
  compileBipedPetMotion,
  deriveBipedPetMotionVfxSignals,
  isCloudFoxRigChannelId,
  normalizeMotionAsset,
  normalizePropAsset,
  sampleBipedPetMotion,
  sampleBipedPetRootMotion,
} from '../packages/pet-core/src/index.ts'
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
const normalWalk = createBasicBipedStudioMotion('walk', { speed: 1 })
const slowWalk = createBasicBipedStudioMotion('walk', { speed: .5 })
assert.equal(fastWalk.durationMs, 600)
assert.equal(fastWalk.loopMode, 'once')
const jumpClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-jump'))
const walkClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-walk'))
const idleClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-idle'))
const waveClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-wave'))
const punchClip = compileBipedPetMotion(BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-straight-punch'))
const sprintClip = compileBipedPetMotion(BUILT_IN_STUDIO_MOTIONS.find(item => item.id === 'builtin-sprint-stop'))
assert.deepEqual(jumpClip.events.map(item => item.kind), ['takeoff', 'landing'])

assert.equal(walkClip.rootMotion.mode, 'travel')
assert.equal(walkClip.rootMotion.distance, .42)
assert.equal(walkClip.rootMotion.verticalMode, 'grounded')
assert.deepEqual(walkClip.rootMotion.windows, [
  { id: 'walk-travel', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 },
])
assert.deepEqual(walkClip.rootMotion.vfxTags, ['speed-trail'])

for (const [motion, durationMs] of [[fastWalk, 600], [normalWalk, 1200], [slowWalk, 2400]] as const) {
  const clip = compileBipedPetMotion(motion)
  assert.equal(clip.durationMs, durationMs)
  assert.equal(clip.rootMotion.distance, .42, 'speed 只能缩放动作时间，不能改变归一化行走距离')
  assert.deepEqual(clip.rootMotion.windows, [
    { id: 'walk-travel', kind: 'travel', startMs: 0, endMs: durationMs, weight: 1 },
  ], 'speed 必须按相同比例缩放 Root Motion 窗口')
  assert.equal(compileBipedPetMotion(motion).hash, clip.hash, '同一动作重复编译必须产生确定哈希')
}
assert.notEqual(fastWalk.extensions, normalWalk.extensions, '不同模板实例不能共享 extensions 容器')
const fastWalkExtension = fastWalk.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>
const normalWalkExtension = normalWalk.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>
assert.notEqual(fastWalkExtension, normalWalkExtension, '不同模板实例不能共享版本化扩展')
assert.notEqual(fastWalkExtension.rootMotion, normalWalkExtension.rootMotion, '不同模板实例不能共享 Root Motion 描述')
const fastWalkExtensionSnapshot = structuredClone(fastWalkExtension)
const compiledFastWalk = compileBipedPetMotion(fastWalk)
assert.deepEqual(fastWalkExtension, fastWalkExtensionSnapshot, '编译不能突变源扩展')
assert.notEqual(compiledFastWalk.rootMotion, fastWalkExtension.rootMotion, '编译结果必须与源扩展隔离')
assert.notEqual(compiledFastWalk.rootMotion.windows, (fastWalkExtension.rootMotion as { windows: unknown }).windows, '编译窗口必须深拷贝')

assert.equal(jumpClip.rootMotion.mode, 'travel')
assert.equal(jumpClip.rootMotion.verticalMode, 'ballistic')
assert.equal(jumpClip.rootMotion.jumpHeight, .28)
assert.deepEqual(jumpClip.rootMotion.windows, [
  { id: 'jump-ballistic', kind: 'ballistic', startMs: 720, endMs: 1824, weight: 1 },
])
assert.deepEqual(jumpClip.rootMotion.vfxTags, ['landing-dust', 'landing-ring'])

for (const clip of [idleClip, waveClip, punchClip]) assert.equal(clip.rootMotion.mode, 'in-place')

assert.equal(sprintClip.rootMotion.mode, 'travel')
assert.equal(sprintClip.rootMotion.distance, 2.4)
assert.equal(sprintClip.rootMotion.verticalMode, 'grounded')
assert.deepEqual(sprintClip.rootMotion.windows, [
  { id: 'sprint', kind: 'travel', startMs: 0, endMs: 8300, weight: 1 },
  { id: 'brake', kind: 'brake', startMs: 6300, endMs: 8300, weight: 1 },
])
assert.deepEqual(sprintClip.rootMotion.vfxTags, ['brake-sparks', 'speed-trail'])
const sprintAsset = BUILT_IN_STUDIO_MOTIONS.find(item => item.id === 'builtin-sprint-stop')!
const sprintExtension = sprintAsset.extensions?.['yk-pets/biped-motion/v1'] as Record<string, unknown>
const sprintExtensionSnapshot = structuredClone(sprintExtension)
const recompiledSprint = compileBipedPetMotion(sprintAsset)
assert.equal(recompiledSprint.hash, sprintClip.hash, '冲刺动作重复编译必须产生确定哈希')
assert.deepEqual(sprintExtension, sprintExtensionSnapshot, '长动作编译不能突变 helper 生成的扩展')
assert.notEqual(recompiledSprint.rootMotion, sprintExtension.rootMotion, '长动作编译结果必须与源扩展隔离')
assert.notEqual(recompiledSprint.rootMotion.windows, (sprintExtension.rootMotion as { windows: unknown }).windows, '长动作编译窗口必须深拷贝')

const expectedMotionStructure = [
  ['builtin-biped-idle', 3600, 8, 36, []],
  ['builtin-biped-walk', 1200, 8, 30, []],
  ['builtin-biped-jump', 2400, 8, 48, []],
  ['builtin-biped-wave', 3200, 7, 34, []],
  ['builtin-biped-straight-punch', 4000, 11, 62, []],
  ['builtin-energetic-step', 8000, 16, 272, []],
  ['builtin-starlight-sway', 10000, 15, 255, ['builtin-glow-sticks']],
  ['builtin-horse-stance-punch', 8400, 15, 163, []],
  ['builtin-nebula-staff-spin', 12000, 16, 214, ['builtin-nebula-staff']],
  ['builtin-cartwheel', 8800, 16, 196, []],
  ['builtin-sprint-stop', 9200, 16, 222, []],
] as const
assert.deepEqual(BUILT_IN_STUDIO_MOTIONS.map(motion => [
  motion.id,
  motion.durationMs,
  motion.tracks.length,
  motion.tracks.reduce((sum, track) => sum + track.keyframes.length, 0),
  motion.propIds,
]), expectedMotionStructure, '补充移动语义不能改变已有动作时长、轨道或道具依赖')
for (const motion of BUILT_IN_STUDIO_MOTIONS) {
  if (motion.id === 'builtin-biped-walk' || motion.id === 'builtin-biped-jump' || motion.id === 'builtin-sprint-stop') continue
  assert.equal(compileBipedPetMotion(motion).rootMotion.mode, 'in-place', `${motion.id} 必须保持旧版原地兼容语义`)
}

function sampleRootMotionFrames(
  clip: ReturnType<typeof compileBipedPetMotion>,
  frames: readonly { timeMs: number; actionWeight: number }[],
) {
  let previous: ReturnType<typeof sampleBipedPetRootMotion> | undefined
  return frames.map((frame) => {
    const sample = sampleBipedPetRootMotion({
      definition: clip.rootMotion,
      requestedTimeMs: frame.timeMs,
      ...(previous === undefined ? {} : {
        previousRequestedTimeMs: previous.requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        ...(previous.landingAuthorization === undefined ? {} : {
          previousLandingAuthorization: previous.landingAuthorization,
        }),
      }),
      durationMs: clip.durationMs,
      loopMode: clip.loopMode,
      characterHeight: 1,
      facingRadians: 0,
      actionWeight: frame.actionWeight,
      footResidual: [0, 0, 0],
    })
    assert.equal(sample.requestedTimeMs, frame.timeMs, 'Root Motion 样本必须严格保留外层请求时间')
    previous = sample
    return sample
  })
}

function collectVfxKindsByTime(
  clip: ReturnType<typeof compileBipedPetMotion>,
  samples: readonly ReturnType<typeof sampleBipedPetRootMotion>[],
) {
  const signals = new Map<number, string[]>()
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!
    const current = samples[index]!
    const currentSignals = deriveBipedPetMotionVfxSignals({
      clipHash: clip.hash,
      previousRequestedTimeMs: previous.requestedTimeMs,
      requestedTimeMs: current.requestedTimeMs,
      tags: clip.rootMotion.vfxTags,
      rootMotion: current,
    })
    assert.ok(currentSignals.every(signal => signal.timeMs === current.requestedTimeMs), 'VFX 信号时间必须与 Root Motion 请求时间一致')
    signals.set(current.requestedTimeMs, currentSignals.map(signal => signal.kind))
  }
  return signals
}

const walkVfxSamples = sampleRootMotionFrames(walkClip, Array.from({ length: 61 }, (_, index) => ({
  timeMs: index * 20,
  actionWeight: 1,
})))
const walkVfxKindsByTime = collectVfxKindsByTime(walkClip, walkVfxSamples)
assert.ok([...walkVfxKindsByTime.values()].some(kinds => kinds.includes('speed-trail')), '行走资产必须在自然连续播放中通过真实 applied 水平运动授权速度拖尾')

const sprintVfxSamples = sampleRootMotionFrames(sprintClip, Array.from({ length: 831 }, (_, index) => ({
  timeMs: index * 10,
  actionWeight: 1,
})))
const sprintVfxKindsByTime = collectVfxKindsByTime(sprintClip, sprintVfxSamples)
assert.ok([...sprintVfxKindsByTime].some(([timeMs, kinds]) => timeMs < 6300 && kinds.includes('speed-trail')), '冲刺资产必须在自然加速段授权速度拖尾')
assert.ok(sprintVfxKindsByTime.get(7300)?.includes('brake-sparks'), '冲刺资产必须在约 7300ms 的自然减速段由真实水平运动与 brake 窗共同授权急停火花')

const jumpVfxSamples = sampleRootMotionFrames(jumpClip, Array.from({ length: 61 }, (_, index) => ({
  timeMs: index * 40,
  actionWeight: 1,
})))
const jumpVfxKinds = new Set<string>()
for (let index = 1; index < jumpVfxSamples.length; index += 1) {
  for (const kind of deriveBipedPetMotionVfxSignals({
    clipHash: jumpClip.hash,
    previousRequestedTimeMs: jumpVfxSamples[index - 1]!.requestedTimeMs,
    requestedTimeMs: jumpVfxSamples[index]!.requestedTimeMs,
    tags: jumpClip.rootMotion.vfxTags,
    rootMotion: jumpVfxSamples[index]!,
  }).map(signal => signal.kind)) jumpVfxKinds.add(kind)
}
assert.ok(jumpVfxKinds.has('landing-ring'), '跳跃资产必须通过真实弹道落地授权落地环')

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
  const expectations = clip.loopMode === 'loop'
    ? [[-1, 'locked', 1], [0, 'locked', 1], [1, 'locked', 1], [clip.durationMs - 1, 'locked', 1], [clip.durationMs, 'locked', 1], [clip.durationMs + 1, 'locked', 1]] as const
    : [[40, 'acquiring', .5], [clip.durationMs / 2, 'locked', 1], [clip.durationMs - 40, 'releasing', .5]] as const
  for (const [timeMs, phase, expectedWeight] of expectations) {
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
for (const timeMs of [-1, 0, 1, 1199, 1200, 1201]) {
  assert.ok(sampleBipedPetMotion(walkClip, timeMs).contactStates.every(item => item.phase === 'locked' && nearlyEqual(item.weight, 1)))
  assert.deepEqual(sampleBipedPetMotion(walkClip, timeMs).activeContacts, ['foot.left', 'foot.right'])
}
assert.deepEqual(sampleBipedPetMotion(walkClip, 576).contactStates, [
  { contactId: 'foot.left', phase: 'releasing', weight: .3, confidence: .9 },
  { contactId: 'foot.right', phase: 'acquiring', weight: 0, confidence: .9 },
])
assert.deepEqual(sampleBipedPetMotion(walkClip, 600).contactStates, [
  { contactId: 'foot.left', phase: 'releasing', weight: 0, confidence: .9 },
  { contactId: 'foot.right', phase: 'acquiring', weight: .3, confidence: .9 },
])

assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-nebula-staff')))
assert.ok(BUILT_IN_STUDIO_MOTIONS.some(item => item.propIds.includes('builtin-glow-sticks')))
console.log('Studio built-in assets passed: 6 props, 5 basic motions, 6 advanced motions, all dependencies resolved.')
