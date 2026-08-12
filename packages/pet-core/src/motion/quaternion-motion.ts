/**
 * 文件职责 / File responsibility
 * 提供不依赖 Three.js 的有限单位 Quaternion 运算，供复杂角色动作编译和采样复用。
 */

import type { RigVector3 } from '../character/rig-profile'

export type MotionQuaternion = readonly [number, number, number, number]

export const IDENTITY_MOTION_QUATERNION: MotionQuaternion = Object.freeze([0, 0, 0, 1])

const finite = (value: number) => Number.isFinite(value)
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

/** 将外部或计算中的四元数修复为有限单位旋转；退化输入安全回到 identity。 */
export function normalizeMotionQuaternion(value: readonly number[]): MotionQuaternion {
  if (value.length !== 4 || !value.every(finite)) return [...IDENTITY_MOTION_QUATERNION]
  const length = Math.hypot(value[0]!, value[1]!, value[2]!, value[3]!)
  if (!Number.isFinite(length) || length <= 1e-12) return [...IDENTITY_MOTION_QUATERNION]
  return [value[0]! / length, value[1]! / length, value[2]! / length, value[3]! / length]
}

/** 按固定 XYZ 顺序把 Euler 偏移转换为单位 Quaternion。 */
export function motionEulerToQuaternion(value: RigVector3): MotionQuaternion {
  if (!value.every(finite)) return [...IDENTITY_MOTION_QUATERNION]
  const [x, y, z] = value
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return normalizeMotionQuaternion([
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ])
}

/** 在同半球上执行最短路径球面插值，避免等价四元数之间绕远路。 */
export function slerpMotionQuaternion(leftInput: MotionQuaternion, rightInput: MotionQuaternion, progressInput: number): MotionQuaternion {
  const left = normalizeMotionQuaternion(leftInput)
  let right = normalizeMotionQuaternion(rightInput)
  const progress = clamp(Number.isFinite(progressInput) ? progressInput : 0, 0, 1)
  let dot = left[0] * right[0] + left[1] * right[1] + left[2] * right[2] + left[3] * right[3]
  if (dot < 0) {
    right = [-right[0], -right[1], -right[2], -right[3]]
    dot = -dot
  }
  if (dot > .9995) return normalizeMotionQuaternion(left.map((value, index) => value + (right[index]! - value) * progress))
  const theta = Math.acos(clamp(dot, -1, 1))
  const sinTheta = Math.sin(theta)
  if (Math.abs(sinTheta) <= 1e-12) return [...left]
  const leftWeight = Math.sin((1 - progress) * theta) / sinTheta
  const rightWeight = Math.sin(progress * theta) / sinTheta
  return normalizeMotionQuaternion(left.map((value, index) => value * leftWeight + right[index]! * rightWeight))
}
