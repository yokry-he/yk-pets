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
const ORTHOGONAL_EPSILON = 1e-10
const HERON_ROUNDING_EPSILON = Number.EPSILON * 16
const MAX_SEGMENT_RELATIVE_ERROR = 1e-8

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isFiniteVector = (value: unknown): value is RigVector3 => Array.isArray(value)
  && value.length === 3
  && value.every(item => typeof item === 'number' && Number.isFinite(item))
const copyFiniteVector = (value: unknown): RigVector3 => isFiniteVector(value) ? [value[0], value[1], value[2]] : [0, 0, 0]
const subtract = (left: RigVector3, right: RigVector3): RigVector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const addScaled = (origin: RigVector3, direction: RigVector3, scale: number): RigVector3 => [
  origin[0] + direction[0] * scale,
  origin[1] + direction[1] * scale,
  origin[2] + direction[2] * scale,
]
const dot = (left: RigVector3, right: RigVector3): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
const length = (value: RigVector3): number => Math.hypot(value[0], value[1], value[2])

const normalize = (value: RigVector3): RigVector3 | null => {
  const scale = Math.max(Math.abs(value[0]), Math.abs(value[1]), Math.abs(value[2]))
  if (!Number.isFinite(scale) || scale === 0) return null
  const scaled: RigVector3 = [value[0] / scale, value[1] / scale, value[2] / scale]
  const magnitude = length(scaled)
  if (!Number.isFinite(magnitude) || magnitude === 0) return null
  const normalized: RigVector3 = [scaled[0] / magnitude, scaled[1] / magnitude, scaled[2] / magnitude]
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

const blockedResult = (input: unknown): AnalyticTwoBoneIkResult => {
  const record = isRecord(input) ? input : {}
  const root = copyFiniteVector(record.root)
  const mid = copyFiniteVector(record.mid)
  const tip = copyFiniteVector(record.tip)
  const target = record.target
  let error = Number.MAX_VALUE
  if (isFiniteVector(target)) {
    const residualOffset = subtract(tip, target)
    const residual = isFiniteVector(residualOffset) ? length(residualOffset) : Number.POSITIVE_INFINITY
    if (Number.isFinite(residual)) error = residual
  }
  return { status: 'blocked', root, mid, tip, positions: [root, mid, tip], error }
}

/** 使用 Kahan 重排的 Heron 公式，以公共尺度计算三角形对目标轴的高，避免长短段平方差消去。 */
const stableTriangleHeight = (upperLength: number, lowerLength: number, targetDistance: number): number | null => {
  const scale = Math.max(upperLength, lowerLength, targetDistance)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const sides = [upperLength / scale, lowerLength / scale, targetDistance / scale].sort((left, right) => right - left)
  const largest = sides[0]!
  const middle = sides[1]!
  const smallest = sides[2]!
  const rawFactors = [
    largest + (middle + smallest),
    smallest - (largest - middle),
    smallest + (largest - middle),
    largest + (middle - smallest),
  ]
  if (rawFactors.some(factor => !Number.isFinite(factor) || factor < -HERON_ROUNDING_EPSILON)) return null
  // 归一化边界运算最多吸收 EPSILON 量级的负舍入；明显违反三角不等式的负因子仍会被拒绝。
  const factors = rawFactors.map(factor => factor < 0 ? 0 : factor)
  const product = factors.reduce((result, factor) => result * factor, 1)
  const normalizedTarget = targetDistance / scale
  if (!Number.isFinite(product) || !Number.isFinite(normalizedTarget) || normalizedTarget <= 0) return null
  const height = scale * Math.sqrt(product) / (2 * normalizedTarget)
  return Number.isFinite(height) ? height : null
}

const segmentLengthIsValid = (start: RigVector3, end: RigVector3, expected: number, coordinateScale: number): boolean => {
  const offset = subtract(end, start)
  if (!isFiniteVector(offset)) return false
  const actual = length(offset)
  // 坐标量级用于估计浮点误差，但硬性封顶为 1e-8 相对误差；无法表达的巨大平移必须阻塞。
  const tolerance = Math.min(
    expected * MAX_SEGMENT_RELATIVE_ERROR,
    Math.max(Number.MIN_VALUE, expected * Number.EPSILON * 32, coordinateScale * Number.EPSILON * 32),
  )
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance
}

export function solveAnalyticTwoBoneIk(input: AnalyticTwoBoneIkInput): AnalyticTwoBoneIkResult {
  if (
    !isRecord(input)
    || !isFiniteVector(input.root)
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
  const maximumDistance = (upperLength + lowerLength) * input.maxStretchRatio
  // 有限非零的链仍可能因固定下界高于配置上限而没有可行区间；此时不能抬高上限伪造解。
  if (minimumDistance > maximumDistance) return blockedResult(input)
  // 只吸收由输入坐标求段长时产生的少量 ULP 边界漂移；明显越界（包括既有 5e-13 回归）仍严格钳制。
  const boundaryRoundingTolerance = Number.EPSILON * 8 * Math.max(1, minimumDistance, maximumDistance, targetDistance)
  const comparableTargetDistance = targetDistance < minimumDistance && minimumDistance - targetDistance <= boundaryRoundingTolerance
    ? minimumDistance
    : targetDistance > maximumDistance && targetDistance - maximumDistance <= boundaryRoundingTolerance
      ? maximumDistance
      : targetDistance
  const solvedDistance = Math.min(maximumDistance, Math.max(minimumDistance, comparableTargetDistance))
  if (![minimumDistance, maximumDistance, solvedDistance].every(Number.isFinite) || solvedDistance <= 0) return blockedResult(input)

  const normalizedPole = normalize(input.pole)
  let bendDirection: RigVector3 | null = null
  if (normalizedPole) {
    const poleAxisProjection = dot(normalizedPole, axis)
    if (!Number.isFinite(poleAxisProjection)) return blockedResult(input)
    const poleProjection = addScaled(normalizedPole, axis, -poleAxisProjection)
    const projectionLength = isFiniteVector(poleProjection) ? length(poleProjection) : Number.NaN
    if (Number.isFinite(projectionLength) && projectionLength > ORTHOGONAL_EPSILON) {
      bendDirection = normalize(poleProjection)
      if (
        !bendDirection
        || Math.abs(dot(bendDirection, axis)) > ORTHOGONAL_EPSILON
        || Math.abs(length(bendDirection) - 1) > ORTHOGONAL_EPSILON
      ) bendDirection = null
    }
  }
  bendDirection ??= stablePerpendicular(axis)
  if (
    !bendDirection
    || !isFiniteVector(bendDirection)
    || Math.abs(dot(bendDirection, axis)) > ORTHOGONAL_EPSILON
    || Math.abs(length(bendDirection) - 1) > ORTHOGONAL_EPSILON
  ) return blockedResult(input)

  // 边长先按公共尺度归一化；轴向投影与 Kahan-Heron 高度分别计算，避免 1e8:1 等链的平方差消去。
  const triangleScale = Math.max(upperLength, lowerLength, solvedDistance)
  const normalizedUpper = upperLength / triangleScale
  const normalizedLower = lowerLength / triangleScale
  const normalizedDistance = solvedDistance / triangleScale
  const midAxisDistance = triangleScale * (
    normalizedUpper * normalizedUpper
    - normalizedLower * normalizedLower
    + normalizedDistance * normalizedDistance
  ) / (2 * normalizedDistance)
  const bendDistance = stableTriangleHeight(upperLength, lowerLength, solvedDistance)
  if (!Number.isFinite(midAxisDistance) || bendDistance === null) return blockedResult(input)

  const root: RigVector3 = [input.root[0], input.root[1], input.root[2]]
  const axisMid = addScaled(root, axis, midAxisDistance)
  const mid = addScaled(axisMid, bendDirection, bendDistance)
  const tip = addScaled(root, axis, solvedDistance)
  const error = Math.abs(targetDistance - solvedDistance)
  if (![root, mid, tip].every(isFiniteVector) || !Number.isFinite(error)) return blockedResult(input)

  const coordinateScale = Math.max(
    upperLength,
    lowerLength,
    ...root.map(Math.abs),
    ...mid.map(Math.abs),
    ...tip.map(Math.abs),
  )
  if (
    !Number.isFinite(coordinateScale)
    || !segmentLengthIsValid(root, mid, upperLength, coordinateScale)
    || !segmentLengthIsValid(mid, tip, lowerLength, coordinateScale)
  ) return blockedResult(input)

  // 可达域是闭区间；除上述输入坐标重建产生的少量 ULP 外，原始距离严格越界就必须报告钳制。
  const status = comparableTargetDistance < minimumDistance || comparableTargetDistance > maximumDistance ? 'clamped' : 'solved'
  return { status, root, mid, tip, positions: [root, mid, tip], error }
}
