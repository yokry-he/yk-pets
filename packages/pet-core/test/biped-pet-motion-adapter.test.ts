/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Quaternion 动作契约、语义映射、Clip 编译与确定性采样。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adaptCloudFoxPoseToBipedPet,
  BIPED_PET_MOTION_ADAPTER_ID,
  BIPED_PET_RIG_PROFILE,
  CLOUD_FOX_SEMANTIC_RIG_ID,
  compileBipedPetMotion,
  createStudioMotionAsset,
  createNeutralCloudFoxPoseValues,
  motionEulerToQuaternion,
  normalizeMotionQuaternion,
  sampleBipedPetMotion,
  slerpMotionQuaternion,
  type CloudFoxRigChannelId,
  type EvaluatedCloudFoxPose,
  type MotionTrack,
} from '../src/index.ts'

function createPose(values: Partial<Record<CloudFoxRigChannelId, number>>): EvaluatedCloudFoxPose {
  const authoredChannels = Object.keys(values) as CloudFoxRigChannelId[]
  return {
    rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
    requestedTimeMs: 0,
    resolvedTimeMs: 0,
    direction: 1,
    iteration: 0,
    values: { ...createNeutralCloudFoxPoseValues(), ...values },
    authoredChannels,
  }
}

function quaternionDot(left: readonly number[], right: readonly number[]) {
  return Math.abs(left.reduce((sum, value, index) => sum + value * right[index]!, 0))
}

function track(channelId: CloudFoxRigChannelId, points: readonly (readonly [number, number])[]): MotionTrack {
  return {
    id: `track-${channelId}`,
    layerId: 'base',
    channelId,
    muted: false,
    keyframes: points.map(([timeMs, value], index) => ({
      id: `key-${channelId}-${index}`,
      timeMs,
      value,
      interpolation: 'linear',
    })),
  }
}

test('Quaternion 规范化会把零长度和非有限输入恢复为单位旋转', () => {
  assert.deepEqual(normalizeMotionQuaternion([0, 0, 0, 0]), [0, 0, 0, 1])
  assert.deepEqual(normalizeMotionQuaternion([Number.NaN, 0, 0, 1]), [0, 0, 0, 1])

  const normalized = normalizeMotionQuaternion([1, 2, 3, 4])
  assert.ok(Math.abs(Math.hypot(...normalized) - 1) < 1e-12)
})

test('Quaternion 插值使用同半球最短路径并保持有限单位长度', () => {
  const halfway = slerpMotionQuaternion([0, 0, 0, 1], [0, 0, 0, -1], .5)

  assert.ok(halfway.every(Number.isFinite))
  assert.ok(Math.abs(Math.hypot(...halfway) - 1) < 1e-12)
  assert.ok(Math.abs(halfway[3] - 1) < 1e-12)
})

test('Euler 转换和动作适配器身份保持稳定', () => {
  const rotation = motionEulerToQuaternion([Math.PI / 3, -Math.PI / 4, Math.PI / 5])

  assert.equal(BIPED_PET_MOTION_ADAPTER_ID, 'biped-pet-motion-adapter/v1')
  assert.ok(rotation.every(Number.isFinite))
  assert.ok(Math.abs(Math.hypot(...rotation) - 1) < 1e-12)
})

test('语义姿态沿身体与四肢动力链分配到真实骨骼', () => {
  const pose = createPose({
    'body.rotation.y': 1,
    'frontPaw.right.rotation.z': 1.4,
    'hindPaw.left.rotation.x': 9,
  })
  const adapted = adaptCloudFoxPoseToBipedPet(pose, {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })
  const boneIds = adapted.bones.map(item => item.boneId)

  assert.equal(adapted.diagnostics.some(item => item.severity === 'error'), false)
  for (const boneId of ['pelvis', 'chest', 'upper-arm.right', 'forearm.right', 'thigh.left', 'calf.left']) {
    assert.ok(boneIds.includes(boneId), `缺少动力链骨骼 ${boneId}`)
  }
  assert.ok(adapted.bones.every(item => Math.abs(Math.hypot(...item.rotation) - 1) < 1e-8))
})

test('语义映射在生成 Quaternion 前遵守 Profile 关节限制', () => {
  const adapted = adaptCloudFoxPoseToBipedPet(createPose({ 'hindPaw.left.rotation.x': 9 }), {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })
  const thigh = adapted.bones.find(item => item.boneId === 'thigh.left')
  const limit = BIPED_PET_RIG_PROFILE.jointLimits.find(item => item.boneId === 'thigh.left')

  assert.ok(thigh && limit)
  const expected = motionEulerToQuaternion([limit.maximum[0], 0, 0])
  assert.ok(quaternionDot(thigh.rotation, expected) > 1 - 1e-8)
})

test('不存在的可选骨骼链会跳过而不会产生坏引用', () => {
  const adapted = adaptCloudFoxPoseToBipedPet(createPose({
    'tail.root.rotation.z': .4,
    'tail.mid.rotation.z': .8,
    'tail.tip.rotation.z': 1.2,
  }), {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })

  assert.equal(adapted.bones.some(item => item.boneId.startsWith('tail.')), false)
  assert.equal(adapted.diagnostics.some(item => item.severity === 'error'), false)
})

test('动作资产会确定性编译为真实骨骼 Quaternion Clip', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-turn',
    nameZh: '转体测试',
    nameEn: 'Turn fixture',
    durationMs: 1000,
    loopMode: 'once',
    tracks: [
      track('body.rotation.y', [[0, 0], [1000, Math.PI]]),
      track('root.position.x', [[0, 0], [1000, 1]]),
    ],
    createdAt: 1,
    updatedAt: 1,
  })
  const target = { profile: BIPED_PET_RIG_PROFILE, boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id) }
  const first = compileBipedPetMotion(asset, target)
  const second = compileBipedPetMotion(structuredClone(asset), target)

  assert.equal(first.status, 'ready')
  assert.equal(first.hash, second.hash)
  assert.deepEqual(first, second)
  assert.ok(first.boneTracks.some(item => item.boneId === 'pelvis'))
  assert.ok(first.boneTracks.some(item => item.boneId === 'chest'))
  assert.deepEqual(first.rootPositionTrack.map(item => item.timeMs), [0, 1000])
})

test('Clip 采样使用动作循环时间、Quaternion 最短路径和根位移线性插值', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-loop',
    nameZh: '循环测试',
    nameEn: 'Loop fixture',
    durationMs: 1000,
    loopMode: 'loop',
    tracks: [
      track('head.rotation.z', [[0, 0], [1000, Math.PI / 2]]),
      track('root.position.y', [[0, 0], [1000, 1]]),
    ],
    createdAt: 1,
    updatedAt: 1,
  })
  const clip = compileBipedPetMotion(asset)
  const sample = sampleBipedPetMotion(clip, 1500)

  assert.equal(sample.resolvedTimeMs, 500)
  assert.ok(sample.bones.every(item => Math.abs(Math.hypot(...item.rotation) - 1) < 1e-8))
  assert.ok(Math.abs(sample.rootPosition[1] - .12) < 1e-8)
})

test('损坏 Profile 会阻塞 Clip 且采样安全回退为空姿态', () => {
  const asset = createStudioMotionAsset({ id: 'fixture', nameZh: '测试', nameEn: 'Fixture', durationMs: 1000 })
  const clip = compileBipedPetMotion(asset, { profile: { ...BIPED_PET_RIG_PROFILE, bones: [] } })
  const sample = sampleBipedPetMotion(clip, 100)

  assert.equal(clip.status, 'blocked')
  assert.ok(clip.diagnostics.some(item => item.severity === 'error'))
  assert.deepEqual(sample.bones, [])
  assert.deepEqual(sample.rootPosition, [0, 0, 0])
  assert.equal(sample.sourceMotionId, 'fixture')
  assert.equal(sample.clipHash, clip.hash)
  assert.equal(sample.durationMs, 1000)
  assert.equal(sample.loopMode, 'once')
  assert.deepEqual(sample.contactStates, [])
})

test('接触采样以 80ms 淡入淡出输出确定阶段、权重和置信度', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-contact-loop',
    nameZh: '接触循环测试',
    nameEn: 'Contact loop fixture',
    durationMs: 1200,
    loopMode: 'loop',
    extensions: {
      'yk-pets/biped-motion/v1': {
        contacts: [
          { contactId: 'foot.left', startMs: 0, endMs: 576, confidence: .9 },
          { contactId: 'foot.right', startMs: 600, endMs: 1176, confidence: .8 },
        ],
      },
    },
    createdAt: 1,
    updatedAt: 1,
  })
  const clip = compileBipedPetMotion(asset)

  assert.deepEqual(sampleBipedPetMotion(clip, 40).contactStates, [{ contactId: 'foot.left', phase: 'acquiring', weight: .5, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 200).contactStates, [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 540).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: .45, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 1240).contactStates, sampleBipedPetMotion(clip, 40).contactStates)
  assert.deepEqual(sampleBipedPetMotion(clip, 0).contactStates, [{ contactId: 'foot.left', phase: 'acquiring', weight: 0, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 576).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: 0, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 0).activeContacts, [])
  assert.deepEqual(sampleBipedPetMotion(clip, 576).activeContacts, [])
})

test('接触采样裁剪极短区间淡变并对 once 与 ping-pong 使用解析后的时间', () => {
  const makeClip = (loopMode: 'once' | 'ping-pong') => compileBipedPetMotion(createStudioMotionAsset({
    id: `motion-contact-${loopMode}`,
    nameZh: '短接触测试',
    nameEn: 'Short contact fixture',
    durationMs: 100,
    loopMode,
    extensions: {
      'yk-pets/biped-motion/v1': {
        contacts: [
          { contactId: 'foot.left', startMs: 20, endMs: 40, confidence: .7 },
          { contactId: 'foot.left', startMs: 20, endMs: 40, confidence: .5 },
          { contactId: 'foot.right', startMs: 60, endMs: 60, confidence: .6 },
        ],
      },
    },
    createdAt: 1,
    updatedAt: 1,
  }))

  const once = makeClip('once')
  assert.deepEqual(sampleBipedPetMotion(once, 30).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: 1, confidence: .7 }])
  assert.deepEqual(sampleBipedPetMotion(once, 30).activeContacts, ['foot.left'])
  assert.deepEqual(sampleBipedPetMotion(once, 200).contactStates, [])
  assert.deepEqual(sampleBipedPetMotion(once, 60).contactStates, [])
  const pingPong = makeClip('ping-pong')
  assert.deepEqual(sampleBipedPetMotion(pingPong, 170).contactStates, sampleBipedPetMotion(pingPong, 30).contactStates)
})
