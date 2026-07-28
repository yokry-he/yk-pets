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
  createNeutralCloudFoxPoseValues,
  motionEulerToQuaternion,
  normalizeMotionQuaternion,
  slerpMotionQuaternion,
  type CloudFoxRigChannelId,
  type EvaluatedCloudFoxPose,
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
