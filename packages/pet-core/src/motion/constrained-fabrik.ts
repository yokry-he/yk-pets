/**
 * 文件职责 / File responsibility
 * 提供框架无关的受约束 FABRIK 多段链求解，并对损坏或不可表示的输入安全阻塞。
 */

import type { RigVector3 } from '../character/rig-profile.ts'

export interface ConstrainedFabrikInput {
  positions: readonly RigVector3[]
  target: RigVector3
  pole: RigVector3
  maxIterations?: number
  tolerance?: number
  maxStretchRatio: number
}

export interface ConstrainedFabrikResult {
  status: 'solved' | 'clamped' | 'blocked'
  positions: readonly RigVector3[]
  iterations: number
  error: number
}

const DEFAULT_MAX_ITERATIONS = 8
const DEFAULT_TOLERANCE = 1e-4
const MIN_STRETCH_RATIO = .8
const MAX_STRETCH_RATIO = 1
const LENGTH_EPSILON = 1e-12
const MAX_SEGMENT_RELATIVE_ERROR = 1e-8

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isFiniteVector = (value: unknown): value is RigVector3 => Array.isArray(value)
  && value.length === 3
  && value.every(item => typeof item === 'number' && Number.isFinite(item))
const copyFiniteVector = (value: unknown): RigVector3 => isFiniteVector(value) ? [value[0], value[1], value[2]] : [0, 0, 0]
const subtract = (left: RigVector3, right: RigVector3): RigVector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const add = (left: RigVector3, right: RigVector3): RigVector3 => [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
const scale = (value: RigVector3, factor: number): RigVector3 => [value[0] * factor, value[1] * factor, value[2] * factor]
const addScaled = (origin: RigVector3, direction: RigVector3, amount: number): RigVector3 => add(origin, scale(direction, amount))
const dot = (left: RigVector3, right: RigVector3): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
const cross = (left: RigVector3, right: RigVector3): RigVector3 => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]
const length = (value: RigVector3): number => Math.hypot(value[0], value[1], value[2])
const distance = (left: RigVector3, right: RigVector3): number => length(subtract(left, right))

/** 先按最大分量缩放，再归一化，避免有限大向量在平方和阶段溢出。 */
const normalize = (value: RigVector3): RigVector3 | null => {
  const maximum = Math.max(Math.abs(value[0]), Math.abs(value[1]), Math.abs(value[2]))
  if (!Number.isFinite(maximum) || maximum === 0) return null
  const scaled: RigVector3 = [value[0] / maximum, value[1] / maximum, value[2] / maximum]
  const magnitude = length(scaled)
  if (!Number.isFinite(magnitude) || magnitude === 0) return null
  const result: RigVector3 = [scaled[0] / magnitude, scaled[1] / magnitude, scaled[2] / magnitude]
  return isFiniteVector(result) ? result : null
}

const stablePerpendicular = (axis: RigVector3): RigVector3 | null => {
  const absolute = axis.map(Math.abs)
  const basis: RigVector3 = absolute[0]! <= absolute[1]! && absolute[0]! <= absolute[2]!
    ? [1, 0, 0]
    : absolute[1]! <= absolute[2]!
      ? [0, 1, 0]
      : [0, 0, 1]
  return normalize(addScaled(basis, axis, -dot(basis, axis)))
}

const finiteResidual = (tip: RigVector3, target: unknown): number => {
  if (!isFiniteVector(target)) return Number.MAX_VALUE
  const residual = distance(tip, target)
  return Number.isFinite(residual) ? residual : Number.MAX_VALUE
}

const blockedResult = (input: unknown, positions?: readonly RigVector3[], iterations = 0): ConstrainedFabrikResult => {
  const record = isRecord(input) ? input : {}
  const source = positions ?? (Array.isArray(record.positions) ? record.positions.map(copyFiniteVector) : [])
  const copies = source.map(copyFiniteVector)
  const tip = copies.at(-1) ?? [0, 0, 0]
  return { status: 'blocked', positions: copies, iterations, error: finiteResidual(tip, record.target) }
}

const projectJointTowardsPole = (
  positions: RigVector3[],
  jointIndex: number,
  polePoint: RigVector3,
): boolean => {
  const previous = positions[jointIndex - 1]!
  const joint = positions[jointIndex]!
  const next = positions[jointIndex + 1]!
  const axis = normalize(subtract(next, previous))
  if (!axis) return false

  const jointOffset = subtract(joint, previous)
  const poleOffset = subtract(polePoint, previous)
  const jointProjection = addScaled(jointOffset, axis, -dot(jointOffset, axis))
  const poleProjection = addScaled(poleOffset, axis, -dot(poleOffset, axis))
  const jointDirection = normalize(jointProjection)
  const poleDirection = normalize(poleProjection)
  if (!jointDirection || !poleDirection) return true

  const cosine = Math.max(-1, Math.min(1, dot(jointDirection, poleDirection)))
  const sine = dot(axis, cross(jointDirection, poleDirection))
  const angle = Math.atan2(sine, cosine)
  const cosineAngle = Math.cos(angle)
  const sineAngle = Math.sin(angle)
  const rotated = add(
    add(scale(jointOffset, cosineAngle), scale(cross(axis, jointOffset), sineAngle)),
    scale(axis, dot(axis, jointOffset) * (1 - cosineAngle)),
  )
  const nextJoint = add(previous, rotated)
  if (!isFiniteVector(nextJoint)) return false
  positions[jointIndex] = nextJoint
  return true
}

const segmentLengthsArePreserved = (positions: readonly RigVector3[], segmentLengths: readonly number[]): boolean => segmentLengths.every(
  (expected, index) => {
    const actual = distance(positions[index]!, positions[index + 1]!)
    return Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(LENGTH_EPSILON, expected * MAX_SEGMENT_RELATIVE_ERROR)
  },
)

/**
 * 把多段链在一个内部关节点处分成前、后两条聚合段，先精确解出聚合三角形，
 * 再沿两条射线按原始段长展开各关节点。这样无需等待奇异直线姿态渐近收敛，
 * 同时保证所有内部点都位于 Root→Target 主轴和 Pole 定义的同一半平面。
 */
const constructPoleHalfPlaneChain = (
  root: RigVector3,
  target: RigVector3,
  bendDirection: RigVector3,
  segmentLengths: readonly number[],
  tolerance: number,
): RigVector3[] | null => {
  const targetOffset = subtract(target, root)
  const targetDirection = normalize(targetOffset)
  const targetDistance = distance(root, target)
  if (!targetDirection || !Number.isFinite(targetDistance) || targetDistance <= LENGTH_EPSILON) return null

  const totalLength = segmentLengths.reduce((sum, item) => sum + item, 0)
  let prefixLength = 0
  let best: { split: number, axisDistance: number, height: number } | null = null
  for (let split = 1; split < segmentLengths.length; split += 1) {
    prefixLength += segmentLengths[split - 1]!
    const suffixLength = totalLength - prefixLength
    const commonScale = Math.max(prefixLength, suffixLength, targetDistance)
    const normalizedPrefix = prefixLength / commonScale
    const normalizedSuffix = suffixLength / commonScale
    const normalizedTarget = targetDistance / commonScale
    const feasibilityEpsilon = Number.EPSILON * 32
    if (normalizedTarget < Math.abs(normalizedPrefix - normalizedSuffix) - feasibilityEpsilon
      || normalizedTarget > normalizedPrefix + normalizedSuffix + feasibilityEpsilon) continue

    const normalizedAxisDistance = (
      normalizedPrefix * normalizedPrefix
      - normalizedSuffix * normalizedSuffix
      + normalizedTarget * normalizedTarget
    ) / (2 * normalizedTarget)
    const normalizedHeightSquared = normalizedPrefix * normalizedPrefix - normalizedAxisDistance * normalizedAxisDistance
    if (normalizedHeightSquared < -feasibilityEpsilon) continue
    const height = Math.sqrt(Math.max(0, normalizedHeightSquared)) * commonScale
    const candidate = {
      split,
      axisDistance: normalizedAxisDistance * commonScale,
      height,
    }
    // 优先选择三角形高度最大的分割，远离退化直线能让 Pole 朝向更稳定。
    if (!best || candidate.height > best.height) best = candidate
  }
  if (!best) return null

  const pivot = add(addScaled(root, targetDirection, best.axisDistance), scale(bendDirection, best.height))
  const prefixDirection = normalize(subtract(pivot, root))
  const suffixDirection = normalize(subtract(target, pivot))
  if (!isFiniteVector(pivot) || !prefixDirection || !suffixDirection) return null

  const result: RigVector3[] = [[...root] as RigVector3]
  let travelled = 0
  for (let index = 1; index <= best.split; index += 1) {
    travelled += segmentLengths[index - 1]!
    result.push(addScaled(root, prefixDirection, travelled))
  }
  travelled = 0
  for (let index = best.split + 1; index <= segmentLengths.length; index += 1) {
    travelled += segmentLengths[index - 1]!
    result.push(addScaled(pivot, suffixDirection, travelled))
  }
  if (!result.every(isFiniteVector)
    || !segmentLengthsArePreserved(result, segmentLengths)
    || distance(result.at(-1)!, target) > tolerance) return null
  return result
}

const satisfiesPoleHalfPlane = (
  positions: readonly RigVector3[],
  root: RigVector3,
  bendDirection: RigVector3,
  totalLength: number,
): boolean => {
  const tolerance = Math.max(LENGTH_EPSILON, totalLength * 1e-10)
  return positions.slice(1, -1).every(position => dot(subtract(position, root), bendDirection) >= -tolerance)
}

export const solveConstrainedFabrik = (input: ConstrainedFabrikInput): ConstrainedFabrikResult => {
  if (!isRecord(input)) return blockedResult(input)
  const rawPositions = input.positions
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const tolerance = input.tolerance ?? DEFAULT_TOLERANCE
  if (!Array.isArray(rawPositions)
    || rawPositions.length < 3
    || !rawPositions.every(isFiniteVector)
    || !isFiniteVector(input.target)
    || !isFiniteVector(input.pole)
    || !Number.isInteger(maxIterations)
    || maxIterations < 1
    || maxIterations > DEFAULT_MAX_ITERATIONS
    || !Number.isFinite(tolerance)
    || tolerance <= 0
    || !Number.isFinite(input.maxStretchRatio)
    || input.maxStretchRatio < MIN_STRETCH_RATIO
    || input.maxStretchRatio > MAX_STRETCH_RATIO) {
    return blockedResult(input)
  }

  const positions = rawPositions.map(position => [...position] as RigVector3)
  const root = [...positions[0]!] as RigVector3
  const segmentLengths: number[] = []
  let totalLength = 0
  for (let index = 1; index < positions.length; index += 1) {
    const segmentLength = distance(positions[index - 1]!, positions[index]!)
    if (!Number.isFinite(segmentLength) || segmentLength <= LENGTH_EPSILON) return blockedResult(input)
    segmentLengths.push(segmentLength)
    totalLength += segmentLength
    if (!Number.isFinite(totalLength)) return blockedResult(input)
  }

  const targetOffset = subtract(input.target, root)
  const targetDirection = normalize(targetOffset) ?? normalize(subtract(positions.at(-1)!, root)) ?? [1, 0, 0]
  const targetDistance = distance(root, input.target)
  if (!Number.isFinite(targetDistance)) return blockedResult(input)
  const maximumReach = totalLength * input.maxStretchRatio
  if (!Number.isFinite(maximumReach) || maximumReach <= 0) return blockedResult(input)
  const wasClamped = targetDistance > maximumReach
  const effectiveTarget = wasClamped ? addScaled(root, targetDirection, maximumReach) : [...input.target] as RigVector3
  if (!isFiniteVector(effectiveTarget)) return blockedResult(input)

  // 物理链长就是配置上限时，最大伸展解唯一；直接展开可避免 FABRIK 在奇异直线姿态附近渐近收敛。
  if (wasClamped && input.maxStretchRatio === 1) {
    positions[0] = [...root] as RigVector3
    for (let index = 1; index < positions.length; index += 1) {
      positions[index] = addScaled(positions[index - 1]!, targetDirection, segmentLengths[index - 1]!)
      if (!isFiniteVector(positions[index])) return blockedResult(input, positions)
    }
    if (!segmentLengthsArePreserved(positions, segmentLengths)) return blockedResult(input, positions)
    return { status: 'clamped', positions, iterations: 0, error: finiteResidual(positions.at(-1)!, input.target) }
  }

  const mainAxis = normalize(subtract(effectiveTarget, root)) ?? targetDirection
  const normalizedPole = normalize(input.pole)
  const projectedPole = normalizedPole && normalize(addScaled(normalizedPole, mainAxis, -dot(normalizedPole, mainAxis)))
  const bendDirection = projectedPole ?? stablePerpendicular(mainAxis)
  if (!bendDirection) return blockedResult(input)
  const polePoint = addScaled(root, bendDirection, totalLength)
  if (!isFiniteVector(polePoint)) return blockedResult(input)

  // 配置上限小于物理链长时，直线展开会违反“保持原段长”；使用聚合两段三角形直接命中钳制点。
  if (wasClamped) {
    const constrainedPositions = constructPoleHalfPlaneChain(root, effectiveTarget, bendDirection, segmentLengths, tolerance)
    if (!constrainedPositions || !satisfiesPoleHalfPlane(constrainedPositions, root, bendDirection, totalLength)) {
      return blockedResult(input)
    }
    return {
      status: 'clamped',
      positions: constrainedPositions,
      iterations: 0,
      error: finiteResidual(constrainedPositions.at(-1)!, input.target),
    }
  }

  let iterations = 0
  let solveError = distance(positions.at(-1)!, effectiveTarget)
  while (iterations < maxIterations && solveError > tolerance) {
    positions[positions.length - 1] = [...effectiveTarget] as RigVector3
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      const direction = normalize(subtract(positions[index]!, positions[index + 1]!))
      if (!direction) return blockedResult(input, positions, iterations)
      positions[index] = addScaled(positions[index + 1]!, direction, segmentLengths[index]!)
      if (!isFiniteVector(positions[index])) return blockedResult(input, positions, iterations)
    }

    positions[0] = [...root] as RigVector3
    for (let index = 1; index < positions.length; index += 1) {
      const direction = normalize(subtract(positions[index]!, positions[index - 1]!))
      if (!direction) return blockedResult(input, positions, iterations)
      positions[index] = addScaled(positions[index - 1]!, direction, segmentLengths[index - 1]!)
      if (!isFiniteVector(positions[index])) return blockedResult(input, positions, iterations)
    }
    for (let index = 1; index < positions.length - 1; index += 1) {
      if (!projectJointTowardsPole(positions, index, polePoint)) return blockedResult(input, positions, iterations)
    }
    iterations += 1
    solveError = distance(positions.at(-1)!, effectiveTarget)
    if (!Number.isFinite(solveError)) return blockedResult(input, positions, iterations)
  }

  if (!segmentLengthsArePreserved(positions, segmentLengths)) return blockedResult(input, positions, iterations)
  if (solveError > tolerance) return blockedResult(input, positions, iterations)
  // 顺序 Pole 投影可能被后续关节再次改变局部轴；成功返回前统一复核全链半平面，
  // 有可行聚合分割时改用同一平面内的确定性保长解，否则绝不伪称 solved。
  const constrainedPositions = constructPoleHalfPlaneChain(root, effectiveTarget, bendDirection, segmentLengths, tolerance)
  const resultPositions = constrainedPositions
    && satisfiesPoleHalfPlane(constrainedPositions, root, bendDirection, totalLength)
    ? constrainedPositions
    : (satisfiesPoleHalfPlane(positions, root, bendDirection, totalLength)
      ? positions.map(position => [...position] as RigVector3)
      : null)
  if (!resultPositions) return blockedResult(input, positions, iterations)
  return {
    status: 'solved',
    positions: resultPositions,
    iterations,
    error: distance(resultPositions.at(-1)!, input.target),
  }
}
