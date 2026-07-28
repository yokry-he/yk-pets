/**
 * 文件职责 / File responsibility
 * 提供与渲染框架无关的解析式两段链 IK，并在退化数值输入下返回有限安全结果。
 */

import type { RigVector3 } from '../character/rig-profile.ts'

export interface AnalyticTwoBoneIkInput {
  root: RigVector3
  mid: RigVector3
  tip: RigVector3
  target: RigVector3
  pole: RigVector3
  maxStretchRatio: number
}

export interface AnalyticTwoBoneIkResult {
  status: 'solved' | 'clamped' | 'blocked'
  root: RigVector3
  mid: RigVector3
  tip: RigVector3
  positions: readonly RigVector3[]
  error: number
}

const MIN_REACH_EPSILON = 1e-6
const LENGTH_EPSILON = 1e-12

const isFiniteVector = (value: RigVector3): boolean => value.every(Number.isFinite)
const copyFiniteVector = (value: RigVector3): RigVector3 => isFiniteVector(value) ? [value[0], value[1], value[2]] : [0, 0, 0]
const subtract = (left: RigVector3, right: RigVector3): RigVector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const addScaled = (origin: RigVector3, direction: RigVector3, scale: number): RigVector3 => [
  origin[0] + direction[0] * scale,
  origin[1] + direction[1] * scale,
  origin[2] + direction[2] * scale,
]
const dot = (left: RigVector3, right: RigVector3): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
const length = (value: RigVector3): number => Math.hypot(value[0], value[1], value[2])

const normalize = (value: RigVector3): RigVector3 | null => {
  const magnitude = length(value)
  if (!Number.isFinite(magnitude) || magnitude <= LENGTH_EPSILON) return null
  const normalized: RigVector3 = [value[0] / magnitude, value[1] / magnitude, value[2] / magnitude]
  return isFiniteVector(normalized) ? normalized : null
}

/**
 * 当 Pole 与主轴共线时，选择主轴绝对值最小分量对应的单位轴进行正交化；
 * 这让同一输入始终落到同一个弯曲半平面，也避免依赖随机扰动。
 */
const stablePerpendicular = (axis: RigVector3): RigVector3 | null => {
  const absolute = axis.map(Math.abs)
  const basis: RigVector3 = absolute[0]! <= absolute[1]! && absolute[0]! <= absolute[2]!
    ? [1, 0, 0]
    : absolute[1]! <= absolute[2]!
      ? [0, 1, 0]
      : [0, 0, 1]
  return normalize(addScaled(basis, axis, -dot(basis, axis)))
}

const blockedResult = (input: AnalyticTwoBoneIkInput): AnalyticTwoBoneIkResult => {
  const root = copyFiniteVector(input.root)
  const mid = copyFiniteVector(input.mid)
  const tip = copyFiniteVector(input.tip)
  return { status: 'blocked', root, mid, tip, positions: [root, mid, tip], error: 0 }
}

export function solveAnalyticTwoBoneIk(input: AnalyticTwoBoneIkInput): AnalyticTwoBoneIkResult {
  if (
    !isFiniteVector(input.root)
    || !isFiniteVector(input.mid)
    || !isFiniteVector(input.tip)
    || !isFiniteVector(input.target)
    || !isFiniteVector(input.pole)
    || !Number.isFinite(input.maxStretchRatio)
    || input.maxStretchRatio < 0.8
    || input.maxStretchRatio > 1
  ) return blockedResult(input)

  const upperOffset = subtract(input.mid, input.root)
  const lowerOffset = subtract(input.tip, input.mid)
  const targetOffset = subtract(input.target, input.root)
  if (![upperOffset, lowerOffset, targetOffset].every(isFiniteVector)) return blockedResult(input)

  const upperLength = length(upperOffset)
  const lowerLength = length(lowerOffset)
  const targetDistance = length(targetOffset)
  if (
    ![upperLength, lowerLength, targetDistance].every(Number.isFinite)
    || upperLength <= LENGTH_EPSILON
    || lowerLength <= LENGTH_EPSILON
  ) return blockedResult(input)

  const axis = normalize(targetOffset) ?? normalize(subtract(input.tip, input.root)) ?? normalize(upperOffset)
  if (!axis) return blockedResult(input)

  const minimumDistance = Math.abs(upperLength - lowerLength) + MIN_REACH_EPSILON
  if (minimumDistance > upperLength + lowerLength) return blockedResult(input)
  const maximumDistance = Math.max(minimumDistance, (upperLength + lowerLength) * input.maxStretchRatio)
  const solvedDistance = Math.min(maximumDistance, Math.max(minimumDistance, targetDistance))
  if (![minimumDistance, maximumDistance, solvedDistance].every(Number.isFinite) || solvedDistance <= 0) return blockedResult(input)

  const poleAxisProjection = dot(input.pole, axis)
  if (!Number.isFinite(poleAxisProjection)) return blockedResult(input)
  const poleProjection = addScaled(input.pole, axis, -poleAxisProjection)
  if (!isFiniteVector(poleProjection)) return blockedResult(input)
  const bendDirection = normalize(poleProjection) ?? stablePerpendicular(axis)
  if (!bendDirection) return blockedResult(input)

  // 余弦定理给出第一段沿主轴的投影，非负开方抵消浮点边界上的微小负数。
  const midAxisDistance = (
    upperLength * upperLength
    - lowerLength * lowerLength
    + solvedDistance * solvedDistance
  ) / (2 * solvedDistance)
  const bendDistance = Math.sqrt(Math.max(0, upperLength * upperLength - midAxisDistance * midAxisDistance))
  if (![midAxisDistance, bendDistance].every(Number.isFinite)) return blockedResult(input)

  const root: RigVector3 = [input.root[0], input.root[1], input.root[2]]
  const axisMid = addScaled(root, axis, midAxisDistance)
  const mid = addScaled(axisMid, bendDirection, bendDistance)
  const tip = addScaled(root, axis, solvedDistance)
  const error = Math.abs(targetDistance - solvedDistance)
  if (![root, mid, tip].every(isFiniteVector) || !Number.isFinite(error)) return blockedResult(input)

  const status = Math.abs(targetDistance - solvedDistance) <= LENGTH_EPSILON ? 'solved' : 'clamped'
  return { status, root, mid, tip, positions: [root, mid, tip], error }
}
