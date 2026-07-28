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
  && [0, 1, 2].every(index => Object.hasOwn(value, index) && typeof value[index] === 'number' && Number.isFinite(value[index]))
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
  const recordPositions = record.positions
  const source = positions ?? (Array.isArray(recordPositions)
    ? Array.from({ length: recordPositions.length }, (_, index) => copyFiniteVector(recordPositions[index]))
    : [])
  const copies = Array.from({ length: source.length }, (_, index) => copyFiniteVector(source[index]))
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

interface SuffixReachIntervals {
  minimum: readonly number[]
  maximum: readonly number[]
}

/** 任意固定段长后缀的完整可达区间为 [max(0, 2*最长段-总长), 总长]。 */
const computeSuffixReachIntervals = (segmentLengths: readonly number[]): SuffixReachIntervals => {
  const minimum = Array.from({ length: segmentLengths.length + 1 }, () => 0)
  const maximum = Array.from({ length: segmentLengths.length + 1 }, () => 0)
  let longest = 0
  for (let index = segmentLengths.length - 1; index >= 0; index -= 1) {
    maximum[index] = maximum[index + 1]! + segmentLengths[index]!
    longest = Math.max(longest, segmentLengths[index]!)
    minimum[index] = Math.max(0, 2 * longest - maximum[index]!)
  }
  return { minimum, maximum }
}

/**
 * 在 Root→Target/Pole 二维平面中逐段构造固定段长链。每一步选择下一节点到 Target 的距离，
 * 该距离必须同时落在当前圆约束区间和剩余后缀的完整可达区间；随后取两个圆在 Pole 正半平面的交点。
 * 因而它覆盖完整物理可达域，不依赖某个连续前后缀刚好能聚合成两段三角形。
 */
const constructPoleHalfPlaneChain = (
  root: RigVector3,
  target: RigVector3,
  targetDirection: RigVector3,
  bendDirection: RigVector3,
  segmentLengths: readonly number[],
  tolerance: number,
): RigVector3[] | null => {
  const targetDistance = distance(root, target)
  if (!Number.isFinite(targetDistance)) return null
  const suffixReach = computeSuffixReachIntervals(segmentLengths)
  const planar: [number, number][] = [[0, 0]]
  for (let index = 0; index < segmentLengths.length - 1; index += 1) {
    const current = planar[index]!
    const segmentLength = segmentLengths[index]!
    const toTargetX = targetDistance - current[0]
    const toTargetY = -current[1]
    const currentDistance = Math.hypot(toTargetX, toTargetY)
    if (!Number.isFinite(currentDistance)) return null
    const numericalTolerance = Math.max(tolerance, segmentLength * Number.EPSILON * 32)
    const feasibleMinimum = Math.max(
      Math.abs(currentDistance - segmentLength),
      suffixReach.minimum[index + 1]!,
    )
    const feasibleMaximum = Math.min(
      currentDistance + segmentLength,
      suffixReach.maximum[index + 1]!,
    )
    if (feasibleMinimum > feasibleMaximum + numericalTolerance) return null
    const nextDistance = (feasibleMinimum + feasibleMaximum) / 2

    if (currentDistance <= LENGTH_EPSILON) {
      if (Math.abs(segmentLength - nextDistance) > numericalTolerance) return null
      planar.push([current[0], current[1] + segmentLength])
      continue
    }

    const commonScale = Math.max(segmentLength, nextDistance, currentDistance)
    const normalizedSegment = segmentLength / commonScale
    const normalizedNext = nextDistance / commonScale
    const normalizedCurrent = currentDistance / commonScale
    const axisDistance = (
      normalizedSegment * normalizedSegment
      - normalizedNext * normalizedNext
      + normalizedCurrent * normalizedCurrent
    ) / (2 * normalizedCurrent) * commonScale
    const normalizedHeightSquared = normalizedSegment * normalizedSegment
      - (axisDistance / commonScale) * (axisDistance / commonScale)
    if (normalizedHeightSquared < -Number.EPSILON * 64) return null
    const height = Math.sqrt(Math.max(0, normalizedHeightSquared)) * commonScale
    const directionX = toTargetX / currentDistance
    const directionY = toTargetY / currentDistance
    const baseX = current[0] + directionX * axisDistance
    const baseY = current[1] + directionY * axisDistance
    const first: [number, number] = [baseX - directionY * height, baseY + directionX * height]
    const second: [number, number] = [baseX + directionY * height, baseY - directionX * height]
    planar.push(first[1] >= second[1] ? first : second)
  }
  planar.push([targetDistance, 0])

  const result = planar.map(([axisDistance, poleDistance]) => add(
    addScaled(root, targetDirection, axisDistance),
    scale(bendDirection, poleDistance),
  ))
  if (!result.every(isFiniteVector)
    || !segmentLengthsArePreserved(result, segmentLengths)
    || distance(result.at(-1)!, target) > tolerance) return null
  return result
}

const hasContinuousAggregateSplit = (segmentLengths: readonly number[], targetDistance: number): boolean => {
  const totalLength = segmentLengths.reduce((sum, item) => sum + item, 0)
  let prefixLength = 0
  for (let index = 0; index < segmentLengths.length - 1; index += 1) {
    prefixLength += segmentLengths[index]!
    const suffixLength = totalLength - prefixLength
    if (targetDistance >= Math.abs(prefixLength - suffixLength) && targetDistance <= totalLength) return true
  }
  return false
}

const satisfiesPolePlaneConstraint = (
  positions: readonly RigVector3[],
  root: RigVector3,
  targetDirection: RigVector3,
  bendDirection: RigVector3,
  totalLength: number,
): boolean => {
  const tolerance = Math.max(LENGTH_EPSILON, totalLength * 1e-10)
  const planeNormal = normalize(cross(targetDirection, bendDirection))
  if (!planeNormal) return false
  return positions.slice(1, -1).every((position) => {
    const rootOffset = subtract(position, root)
    const planeDistance = dot(rootOffset, planeNormal)
    const halfPlaneCoordinate = dot(rootOffset, bendDirection)
    return Number.isFinite(planeDistance)
      && Number.isFinite(halfPlaneCoordinate)
      && Math.abs(planeDistance) <= tolerance
      && halfPlaneCoordinate >= -tolerance
  })
}

export const solveConstrainedFabrik = (input: ConstrainedFabrikInput): ConstrainedFabrikResult => {
  if (!isRecord(input)) return blockedResult(input)
  const rawPositions = input.positions
  const maxIterations = input.maxIterations === undefined ? DEFAULT_MAX_ITERATIONS : input.maxIterations
  const tolerance = input.tolerance === undefined ? DEFAULT_TOLERANCE : input.tolerance
  if (!Array.isArray(rawPositions)
    || rawPositions.length < 3
    || !Array.from({ length: rawPositions.length }, (_, index) => Object.hasOwn(rawPositions, index) && isFiniteVector(rawPositions[index])).every(Boolean)
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

  const positions = rawPositions.map(position => [position[0], position[1], position[2]] as RigVector3)
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
  const physicalReach = computeSuffixReachIntervals(segmentLengths)
  const minimumReach = physicalReach.minimum[0]!
  const maximumReach = Math.min(totalLength, totalLength * input.maxStretchRatio)
  if (!Number.isFinite(maximumReach) || maximumReach <= 0 || minimumReach > maximumReach) return blockedResult(input)
  const effectiveDistance = Math.max(minimumReach, Math.min(maximumReach, targetDistance))
  const wasClamped = targetDistance < minimumReach || targetDistance > maximumReach
  const effectiveTarget = wasClamped
    ? addScaled(root, targetDirection, effectiveDistance)
    : [...input.target] as RigVector3
  if (!isFiniteVector(effectiveTarget)) return blockedResult(input)

  const mainAxis = normalize(subtract(effectiveTarget, root)) ?? targetDirection
  const normalizedPole = normalize(input.pole)
  const projectedPole = normalizedPole && normalize(addScaled(normalizedPole, mainAxis, -dot(normalizedPole, mainAxis)))
  const bendDirection = projectedPole ?? stablePerpendicular(mainAxis)
  if (!bendDirection) return blockedResult(input)
  const polePoint = addScaled(root, bendDirection, totalLength)
  if (!isFiniteVector(polePoint)) return blockedResult(input)

  // 所有越界目标都由完整二维可达域构造直接命中上下边界，避免直线奇异与骨骼缩放。
  if (wasClamped) {
    const constrainedPositions = constructPoleHalfPlaneChain(root, effectiveTarget, mainAxis, bendDirection, segmentLengths, tolerance)
    if (!constrainedPositions || !satisfiesPolePlaneConstraint(constrainedPositions, root, mainAxis, bendDirection, totalLength)) {
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
  if (solveError > tolerance) {
    if (maxIterations < DEFAULT_MAX_ITERATIONS) return blockedResult(input, positions, iterations)
    const fallbackPositions = constructPoleHalfPlaneChain(root, effectiveTarget, mainAxis, bendDirection, segmentLengths, tolerance)
    if (!fallbackPositions || !satisfiesPolePlaneConstraint(fallbackPositions, root, mainAxis, bendDirection, totalLength)) {
      return blockedResult(input, positions, iterations)
    }
    return { status: 'solved', positions: fallbackPositions, iterations, error: distance(fallbackPositions.at(-1)!, input.target) }
  }
  // 顺序 Pole 投影可能被后续关节再次改变局部轴；成功返回前统一复核全链半平面，
  // 可用连续前后缀聚合证明平面可行时，改用一般二维构造恢复约束；否则绝不伪称 solved。
  const iterativePositionsAreValid = satisfiesPolePlaneConstraint(positions, root, mainAxis, bendDirection, totalLength)
  const constrainedPositions = !iterativePositionsAreValid && hasContinuousAggregateSplit(segmentLengths, effectiveDistance)
    ? constructPoleHalfPlaneChain(root, effectiveTarget, mainAxis, bendDirection, segmentLengths, tolerance)
    : null
  const resultPositions = iterativePositionsAreValid
    ? positions.map(position => [...position] as RigVector3)
    : constrainedPositions && satisfiesPolePlaneConstraint(constrainedPositions, root, mainAxis, bendDirection, totalLength)
      ? constrainedPositions
      : null
  if (!resultPositions) return blockedResult(input, positions, iterations)
  return {
    status: 'solved',
    positions: resultPositions,
    iterations,
    error: distance(resultPositions.at(-1)!, input.target),
  }
}
