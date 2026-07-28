/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Quaternion 动作契约、语义映射、Clip 编译与确定性采样。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BIPED_PET_MOTION_ADAPTER_ID,
  motionEulerToQuaternion,
  normalizeMotionQuaternion,
  slerpMotionQuaternion,
} from '../src/index.ts'

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
