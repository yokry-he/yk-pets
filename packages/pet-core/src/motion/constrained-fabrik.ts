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
 * 在 Root→Target/Pole 二维平面中构造固定段长链。链段加闭合边组成凸圆内接多边形，
 * 多边形不等式与链的物理可达域等价；连续求解公共圆半径可避免离散距离采样遗漏窄可行窗。
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
  const totalLength = suffixReach.maximum[0]!
  const minimumReach = suffixReach.minimum[0]!
  const boundaryTolerance = Math.max(tolerance, totalLength * Number.EPSILON * 64)

  const mapToRig = (planar: readonly [number, number][]): RigVector3[] => planar.map(([axisDistance, poleDistance]) => add(
    addScaled(root, targetDirection, axisDistance),
    scale(bendDirection, poleDistance),
  ))
  const validates = (result: readonly RigVector3[]): boolean => result.every(isFiniteVector)
    && segmentLengthsArePreserved(result, segmentLengths)
    && distance(result.at(-1)!, target) <= tolerance

  // 物理最大边界和非零最小边界具有唯一的共线折叠语义，直接解析构造可避免圆相切误差。
  if (Math.abs(targetDistance - totalLength) <= boundaryTolerance) {
    let travelled = 0
    const planar: [number, number][] = [[0, 0]]
    for (const segmentLength of segmentLengths) {
      travelled += segmentLength
      planar.push([travelled, 0])
    }
    const result = mapToRig(planar)
    return validates(result) ? result : null
  }
  if (minimumReach > 0 && Math.abs(targetDistance - minimumReach) <= boundaryTolerance) {
    const longestIndex = segmentLengths.indexOf(Math.max(...segmentLengths))
    let travelled = 0
    const planar: [number, number][] = [[0, 0]]
    for (let index = 0; index < segmentLengths.length; index += 1) {
      travelled += segmentLengths[index]! * (index === longestIndex ? 1 : -1)
      planar.push([travelled, 0])
    }
    const result = mapToRig(planar)
    return validates(result) ? result : null
  }

  /**
   * 把链段和闭合边视为一个凸圆内接多边形。多边形不等式与固定段长链物理可达域等价；
   * 因此只需求解公共外接圆半径这一维连续根，而无需离散采样每层的剩余距离。
   */
  const closingSides = [...segmentLengths, targetDistance]
  const longestIndex = closingSides.indexOf(Math.max(...closingSides))
  const longestSide = closingSides[longestIndex]!
  const radiusFloor = longestSide / 2
  const NUMERICAL_BUDGET = 16_384
  let evaluations = 0
  const minorAngles = (radius: number): number[] | null => {
    evaluations += 1
    if (evaluations > NUMERICAL_BUDGET || !Number.isFinite(radius) || radius < radiusFloor) return null
    const angles = closingSides.map(side => 2 * Math.asin(Math.max(-1, Math.min(1, side / (2 * radius)))))
    return angles.every(Number.isFinite) ? angles : null
  }
  const floorAngles = minorAngles(radiusFloor)
  if (!floorAngles) return null
  const floorSum = floorAngles.reduce((sum, angle) => sum + angle, 0)
  const useMajorArc = floorSum < Math.PI * 2
  const residual = (radius: number): number | null => {
    const angles = minorAngles(radius)
    if (!angles) return null
    return useMajorArc
      ? angles[longestIndex]! - angles.reduce((sum, angle, index) => index === longestIndex ? sum : sum + angle, 0)
      : angles.reduce((sum, angle) => sum + angle, 0) - Math.PI * 2
  }

  const floorResidual = useMajorArc
    ? floorAngles[longestIndex]! - floorAngles.reduce((sum, angle, index) => index === longestIndex ? sum : sum + angle, 0)
    : floorSum - Math.PI * 2
  let radius = radiusFloor
  if (Math.abs(floorResidual) > Number.EPSILON * 64) {
    let low = radiusFloor
    let high = Math.max(radiusFloor * 2, radiusFloor + LENGTH_EPSILON)
    let highResidual = residual(high)
    while (highResidual !== null && highResidual > 0 && evaluations < NUMERICAL_BUDGET) {
      high *= 2
      if (!Number.isFinite(high)) return null
      highResidual = residual(high)
    }
    if (highResidual === null || highResidual > 0) return null
    for (let iteration = 0; iteration < 128 && evaluations < NUMERICAL_BUDGET; iteration += 1) {
      const middle = (low + high) / 2
      const middleResidual = residual(middle)
      if (middleResidual === null) return null
      if (middleResidual > 0) low = middle
      else high = middle
      // 圆半径根误差会累积到整条链的闭合角；必须收敛到机器精度，不能按末端 tolerance 提前停止。
      if (high - low <= Number.EPSILON * Math.max(1, high) * 8) break
    }
    radius = (low + high) / 2
  }
  const solvedMinorAngles = minorAngles(radius)
  if (!solvedMinorAngles) return null
  const centralAngles = solvedMinorAngles.map((angle, index) => useMajorArc && index === longestIndex ? Math.PI * 2 - angle : angle)
  let angle = 0
  const circlePoints: [number, number][] = [[radius, 0]]
  for (let index = 0; index < segmentLengths.length; index += 1) {
    angle += centralAngles[index]!
    circlePoints.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }

  let planar: [number, number][]
  if (targetDistance <= LENGTH_EPSILON) {
    // 闭合点与根重合时，用根处切线作为主轴、朝圆心方向作为 Pole 正侧。
    planar = circlePoints.map(point => [point[1], radius - point[0]])
  } else {
    const rootPoint = circlePoints[0]!
    const tipPoint = circlePoints.at(-1)!
    const tipOffset: [number, number] = [tipPoint[0] - rootPoint[0], tipPoint[1] - rootPoint[1]]
    const chordLength = Math.hypot(tipOffset[0], tipOffset[1])
    if (!Number.isFinite(chordLength) || chordLength <= LENGTH_EPSILON) return null
    const axisX = tipOffset[0] / chordLength
    const axisY = tipOffset[1] / chordLength
    planar = circlePoints.map((point) => {
      const offsetX = point[0] - rootPoint[0]
      const offsetY = point[1] - rootPoint[1]
      return [offsetX * axisX + offsetY * axisY, -offsetX * axisY + offsetY * axisX]
    })
    const poleSum = planar.slice(1, -1).reduce((sum, point) => sum + point[1], 0)
    if (poleSum < 0) planar = planar.map(point => [point[0], -point[1]])
  }
  const result = mapToRig(planar)
  return validates(result) ? result : null
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
  let iterationFailed = false
  iterationLoop: while (iterations < maxIterations && solveError > tolerance) {
    positions[positions.length - 1] = [...effectiveTarget] as RigVector3
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      const direction = normalize(subtract(positions[index]!, positions[index + 1]!))
      if (!direction) {
        iterationFailed = true
        break iterationLoop
      }
      positions[index] = addScaled(positions[index + 1]!, direction, segmentLengths[index]!)
      if (!isFiniteVector(positions[index])) {
        iterationFailed = true
        break iterationLoop
      }
    }

    positions[0] = [...root] as RigVector3
    for (let index = 1; index < positions.length; index += 1) {
      const direction = normalize(subtract(positions[index]!, positions[index - 1]!))
      if (!direction) {
        iterationFailed = true
        break iterationLoop
      }
      positions[index] = addScaled(positions[index - 1]!, direction, segmentLengths[index - 1]!)
      if (!isFiniteVector(positions[index])) {
        iterationFailed = true
        break iterationLoop
      }
    }
    for (let index = 1; index < positions.length - 1; index += 1) {
      if (!projectJointTowardsPole(positions, index, polePoint)) {
        iterationFailed = true
        break iterationLoop
      }
    }
    iterations += 1
    solveError = distance(positions.at(-1)!, effectiveTarget)
    if (!Number.isFinite(solveError)) {
      iterationFailed = true
      break
    }
  }

  const iterativeLengthsAreValid = segmentLengthsArePreserved(positions, segmentLengths)
  const iterativePlaneIsValid = iterativeLengthsAreValid
    && satisfiesPolePlaneConstraint(positions, root, mainAxis, bendDirection, totalLength)
  if (iterationFailed || solveError > tolerance || !iterativePlaneIsValid) {
    const fallbackPositions = constructPoleHalfPlaneChain(root, effectiveTarget, mainAxis, bendDirection, segmentLengths, tolerance)
    if (!fallbackPositions || !satisfiesPolePlaneConstraint(fallbackPositions, root, mainAxis, bendDirection, totalLength)) {
      return blockedResult(input, positions, iterations)
    }
    return { status: 'solved', positions: fallbackPositions, iterations, error: distance(fallbackPositions.at(-1)!, input.target) }
  }
  const resultPositions = positions.map(position => [...position] as RigVector3)
  return {
    status: 'solved',
    positions: resultPositions,
    iterations,
    error: distance(resultPositions.at(-1)!, input.target),
  }
}
