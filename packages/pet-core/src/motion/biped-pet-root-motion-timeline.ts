/**
 * 文件职责 / File responsibility
 * 在单次共享预算内把 action-aware 复合弹道解析为可证明的 airborne 组件与双向转换。
 * 请求帧只负责把 canonical 转换映射到绝对时间，绝不参与结构边界或事件判定。
 */

import type { StudioMotionLoopMode } from './motion-time'

export const MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS = 512
export const BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON = 1e-12

const MAX_BIPED_PET_BALLISTIC_REQUEST_SEGMENTS = 4
const BALLISTIC_DERIVATIVE_CRITICAL_PROGRESS = Object.freeze([
  0.233783518068081,
  0.766216481931919,
])
// `4·smoothstep(t)·(1-smoothstep(t))` 转成六次 Bernstein 基后得到这组固定控制点。
const BALLISTIC_HEIGHT_BERNSTEIN_CONTROL_POINTS = Object.freeze([0, 0, .8, 2, .8, 0, 0])
const COMPOSITE_PEAK_RELATIVE_TOLERANCE = 1e-13

export type BipedPetBallisticTimelineEvidence = 'airborne' | 'grounded' | 'unknown'
export type BipedPetBallisticTimelineTransitionKind = 'takeoff' | 'touchdown'

export interface BipedPetBallisticTimelineWindow {
  readonly id: string
  readonly startMs: number
  readonly endMs: number
  readonly weight: number
}

export interface AnalyzeBipedPetBallisticTimelineInput {
  readonly windows: readonly BipedPetBallisticTimelineWindow[]
  readonly durationMs: number
  readonly loopMode: StudioMotionLoopMode
  readonly jumpHeight: number
  readonly actionWeight: number
}

export interface BipedPetBallisticTimelineStats {
  readonly workUnits: number
  readonly maximumWorkUnits: number
  readonly boundaryCount: number
  readonly supportComponentCount: number
  readonly exhausted: boolean
}

export interface BipedPetBallisticTimelineRegion {
  readonly startMs: number
  readonly endMs: number
  readonly evidence: BipedPetBallisticTimelineEvidence
  readonly witnessTimeMs?: number
}

/**
 * start/end 是可证明 airborne 的最外侧可表示点；相邻的 grounded 点用于双向事件映射，
 * 因而正向与反向均在自己真正进入 grounded 的一侧签发 touchdown。
 */
export interface BipedPetBallisticTimelineComponent {
  readonly index: number
  readonly startMs: number
  readonly endMs: number
  readonly startGroundedMs: number
  readonly endGroundedMs: number
  readonly strength: number
}

export interface BipedPetBallisticTimelineTransition {
  readonly componentIndex: number
  readonly resolvedTimeMs: number
  readonly traversalDirection: -1 | 1
  readonly kind: BipedPetBallisticTimelineTransitionKind
  readonly strength: number
}

export interface BipedPetBallisticRequestedTransition extends BipedPetBallisticTimelineTransition {
  readonly requestedTimeMs: number
}

interface BipedPetBallisticResolvedRange {
  readonly startMs: number
  readonly endMs: number
}

interface TimelineSample {
  readonly height: number
  readonly evidence: BipedPetBallisticTimelineEvidence
}

interface ClassifiedInterval {
  readonly startMs: number
  readonly endMs: number
  readonly evidence: BipedPetBallisticTimelineEvidence
  readonly witnessTimeMs?: number
}

interface ThresholdEdge {
  readonly airborneMs: number
  readonly groundedMs: number
}

interface BernsteinSplit {
  readonly left: readonly number[]
  readonly right: readonly number[]
}

interface CompositePeakNode {
  readonly startMs: number
  readonly endMs: number
  readonly controlPoints: readonly number[]
  readonly activeWindowCount: number
  readonly depth: number
  readonly upper: number
  readonly sequence: number
}

export interface BipedPetBallisticTimelineAnalysis {
  readonly durationMs: number
  readonly loopMode: StudioMotionLoopMode
  readonly boundaries: readonly number[]
  readonly boundaryEvidence: readonly BipedPetBallisticTimelineEvidence[]
  readonly regions: readonly BipedPetBallisticTimelineRegion[]
  readonly components: readonly BipedPetBallisticTimelineComponent[]
  readonly transitions: readonly BipedPetBallisticTimelineTransition[]
  readonly stats: BipedPetBallisticTimelineStats
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const positiveModulo = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus
const canonicalOffsetsAgree = (left: number, right: number, durationMs: number) => (
  Math.abs(left - right) <= Number.EPSILON * Math.max(1, durationMs) * 8
)

interface CanonicalIterationSegment {
  readonly startMs: number
  readonly endMs: number
}

function canonicalIterationSegment(
  iteration: number,
  durationMs: number,
): CanonicalIterationSegment | undefined {
  const startMs = iteration * durationMs
  const endMs = startMs + durationMs
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)
    || !canonicalOffsetsAgree(positiveModulo(startMs, durationMs), 0, durationMs)
    || !canonicalOffsetsAgree(endMs - startMs, durationMs, durationMs)) return undefined
  return Object.freeze({ startMs, endMs })
}

function canonicalRequestedOffset(
  requestedTimeMs: number,
  segmentStartMs: number,
  durationMs: number,
): number | undefined {
  const derivedOffsetMs = requestedTimeMs - segmentStartMs
  const resolvedOffsetMs = positiveModulo(requestedTimeMs, durationMs)
  return canonicalOffsetsAgree(derivedOffsetMs, resolvedOffsetMs, durationMs)
    ? resolvedOffsetMs
    : undefined
}

function smoothstep(progress: number): number {
  const bounded = clamp(progress, 0, 1)
  return bounded * bounded * (3 - 2 * bounded)
}

function normalizedBallisticHeightDerivative(progress: number, durationMs: number): number {
  const bounded = clamp(progress, 0, 1)
  const smoothed = smoothstep(bounded)
  return 24 * bounded * (1 - bounded) * (1 - 2 * smoothed) / durationMs
}

function normalizedCompositeHeight(
  windows: readonly BipedPetBallisticTimelineWindow[],
  maximumWeight: number,
  totalScaledWeight: number,
  timeMs: number,
): number {
  if (!(maximumWeight > 0) || !(totalScaledWeight > 0)) return 0
  let weightedHeight = 0
  for (const window of windows) {
    const progress = smoothstep((timeMs - window.startMs) / (window.endMs - window.startMs))
    weightedHeight += window.weight / maximumWeight * 4 * progress * (1 - progress)
  }
  return weightedHeight / totalScaledWeight
}

function splitBernsteinControlPoints(
  controlPoints: readonly number[],
  progress: number,
): BernsteinSplit {
  const rows: number[][] = [controlPoints.slice()]
  for (let level = 1; level < controlPoints.length; level += 1) {
    const previous = rows[level - 1]!
    const row: number[] = []
    for (let index = 0; index < previous.length - 1; index += 1) {
      row.push(previous[index]! * (1 - progress) + previous[index + 1]! * progress)
    }
    rows.push(row)
  }
  return Object.freeze({
    left: Object.freeze(rows.map(row => row[0]!)),
    right: Object.freeze(rows.slice().reverse().map(row => row.at(-1)!)),
  })
}

function restrictedBallisticHeightControlPoints(
  startProgress: number,
  endProgress: number,
): readonly number[] {
  let restricted = BALLISTIC_HEIGHT_BERNSTEIN_CONTROL_POINTS as readonly number[]
  if (endProgress < 1) restricted = splitBernsteinControlPoints(restricted, endProgress).left
  if (startProgress > 0) {
    restricted = splitBernsteinControlPoints(restricted, startProgress / endProgress).right
  }
  return restricted
}

function normalizedCompositeHeightControlPoints(
  windows: readonly BipedPetBallisticTimelineWindow[],
  maximumWeight: number,
  totalScaledWeight: number,
  startMs: number,
  endMs: number,
): readonly number[] {
  const controlPoints = Array.from({ length: BALLISTIC_HEIGHT_BERNSTEIN_CONTROL_POINTS.length }, () => 0)
  for (const window of windows) {
    const durationMs = window.endMs - window.startMs
    const startProgress = clamp((startMs - window.startMs) / durationMs, 0, 1)
    const endProgress = clamp((endMs - window.startMs) / durationMs, 0, 1)
    const windowControlPoints = restrictedBallisticHeightControlPoints(startProgress, endProgress)
    const normalizedWeight = window.weight / maximumWeight / totalScaledWeight
    for (let index = 0; index < controlPoints.length; index += 1) {
      controlPoints[index] = controlPoints[index]! + windowControlPoints[index]! * normalizedWeight
    }
  }
  return Object.freeze(controlPoints)
}

function compositePeakUpper(
  controlPoints: readonly number[],
  activeWindowCount: number,
  depth: number,
): number {
  const maximum = Math.max(...controlPoints)
  const magnitude = Math.max(1, ...controlPoints.map(Math.abs))
  // 正权重合成与 de Casteljau 只有凸组合；按窗口数和细分深度外扩舍入误差，保持控制凸包上界保守。
  const roundingPadding = Number.EPSILON * magnitude * (activeWindowCount + depth + 16) * 4
  return maximum + roundingPadding
}

/**
 * 每个弹道窗在自身中点前后分别单调。逐窗最小值之和是安全下界，逐窗最大值之和是安全上界；
 * 两者可能偏松，但不会把混合增减贡献中的 valley 伪造成整段 airborne 或 grounded。
 */
function normalizedCompositeHeightBounds(
  windows: readonly BipedPetBallisticTimelineWindow[],
  maximumWeight: number,
  totalScaledWeight: number,
  startMs: number,
  endMs: number,
): {
  readonly lower: number
  readonly upper: number
  readonly lowerDerivative: number
  readonly upperDerivative: number
} {
  if (!(maximumWeight > 0) || !(totalScaledWeight > 0)) {
    return Object.freeze({ lower: 0, upper: 0, lowerDerivative: 0, upperDerivative: 0 })
  }
  let lowerHeight = 0
  let upperHeight = 0
  let lowerDerivative = 0
  let upperDerivative = 0
  for (const window of windows) {
    if (endMs <= window.startMs || startMs >= window.endMs) continue
    const durationMs = window.endMs - window.startMs
    const startLinearProgress = clamp((startMs - window.startMs) / durationMs, 0, 1)
    const endLinearProgress = clamp((endMs - window.startMs) / durationMs, 0, 1)
    const startProgress = smoothstep(startLinearProgress)
    const endProgress = smoothstep(endLinearProgress)
    const startHeight = 4 * startProgress * (1 - startProgress)
    const endHeight = 4 * endProgress * (1 - endProgress)
    const peakMs = clamp(
      window.startMs + (window.endMs - window.startMs) * .5,
      Math.max(startMs, window.startMs),
      Math.min(endMs, window.endMs),
    )
    const progress = smoothstep((peakMs - window.startMs) / (window.endMs - window.startMs))
    const scaledWeight = window.weight / maximumWeight
    lowerHeight += scaledWeight * Math.min(startHeight, endHeight)
    upperHeight += scaledWeight * 4 * progress * (1 - progress)
    const derivativeCandidates = [
      normalizedBallisticHeightDerivative(startLinearProgress, durationMs),
      normalizedBallisticHeightDerivative(endLinearProgress, durationMs),
      ...BALLISTIC_DERIVATIVE_CRITICAL_PROGRESS
        .filter(candidate => candidate > startLinearProgress && candidate < endLinearProgress)
        .map(candidate => normalizedBallisticHeightDerivative(candidate, durationMs)),
    ]
    lowerDerivative += scaledWeight * Math.min(...derivativeCandidates)
    upperDerivative += scaledWeight * Math.max(...derivativeCandidates)
  }
  return Object.freeze({
    lower: lowerHeight / totalScaledWeight,
    upper: upperHeight / totalScaledWeight,
    lowerDerivative: lowerDerivative / totalScaledWeight,
    upperDerivative: upperDerivative / totalScaledWeight,
  })
}

/**
 * 单窗或全部同向单调贡献的复合曲线没有内部 grounded valley；其 airborne 超水平集在当前区间内连通。
 */
function hasConnectedAirborneSuperlevel(
  windows: readonly BipedPetBallisticTimelineWindow[],
  startMs: number,
  endMs: number,
): boolean {
  const active = windows.filter(window => window.startMs < endMs && window.endMs > startMs)
  if (active.length <= 1) return true
  let allNonDecreasing = true
  let allNonIncreasing = true
  for (const window of active) {
    const peakMs = window.startMs + (window.endMs - window.startMs) * .5
    if (endMs > peakMs) allNonDecreasing = false
    if (startMs < peakMs) allNonIncreasing = false
  }
  return allNonDecreasing || allNonIncreasing
}

function safeWindows(
  windows: readonly BipedPetBallisticTimelineWindow[],
  durationMs: number,
): readonly BipedPetBallisticTimelineWindow[] {
  return Object.freeze(windows
    .filter(window => typeof window.id === 'string'
      && Number.isFinite(window.startMs) && window.startMs >= 0
      && Number.isFinite(window.endMs) && window.endMs <= durationMs && window.endMs > window.startMs
      && Number.isFinite(window.weight) && window.weight > 0)
    .map(window => Object.freeze({
      id: window.id,
      startMs: window.startMs,
      endMs: window.endMs,
      weight: window.weight,
    })))
}

function supportComponentCount(windows: readonly BipedPetBallisticTimelineWindow[]): number {
  const ordered = windows.slice().sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
  let count = 0
  let componentEndMs = Number.NEGATIVE_INFINITY
  for (const window of ordered) {
    if (window.startMs > componentEndMs) {
      count += 1
      componentEndMs = window.endMs
    }
    else componentEndMs = Math.max(componentEndMs, window.endMs)
  }
  return count
}

function resolvedRequestedRanges(
  firstRequestedTimeMs: number,
  secondRequestedTimeMs: number,
  durationMs: number,
  loopMode: StudioMotionLoopMode,
): { readonly complete: boolean; readonly ranges: readonly BipedPetBallisticResolvedRange[] } {
  const startRequestedTimeMs = Math.max(0, Math.min(firstRequestedTimeMs, secondRequestedTimeMs))
  const endRequestedTimeMs = Math.max(0, Math.max(firstRequestedTimeMs, secondRequestedTimeMs))
  if (!(endRequestedTimeMs > startRequestedTimeMs)) return Object.freeze({ complete: true, ranges: Object.freeze([]) })
  if (loopMode === 'once') {
    const startMs = clamp(startRequestedTimeMs, 0, durationMs)
    const endMs = clamp(endRequestedTimeMs, 0, durationMs)
    return Object.freeze({
      complete: true,
      ranges: Object.freeze(endMs > startMs ? [Object.freeze({ startMs, endMs })] : []),
    })
  }

  const firstIteration = Math.floor(startRequestedTimeMs / durationMs)
  const lastIteration = Math.floor(endRequestedTimeMs / durationMs)
  const segmentCount = lastIteration - firstIteration + 1
  if (!Number.isInteger(segmentCount) || segmentCount < 1
    || segmentCount > MAX_BIPED_PET_BALLISTIC_REQUEST_SEGMENTS) {
    return Object.freeze({ complete: false, ranges: Object.freeze([]) })
  }
  const ranges: BipedPetBallisticResolvedRange[] = []
  let priorIteration: number | undefined
  for (let offset = 0; offset < segmentCount; offset += 1) {
    const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
    if (priorIteration !== undefined && iteration <= priorIteration) {
      return Object.freeze({ complete: false, ranges: Object.freeze([]) })
    }
    priorIteration = iteration
    const segment = canonicalIterationSegment(iteration, durationMs)
    if (!segment) return Object.freeze({ complete: false, ranges: Object.freeze([]) })
    const requestStartMs = Math.max(startRequestedTimeMs, segment.startMs)
    const requestEndMs = Math.min(endRequestedTimeMs, segment.endMs)
    if (!(requestEndMs > requestStartMs)) continue
    const localStartMs = offset === 0
      ? canonicalRequestedOffset(requestStartMs, segment.startMs, durationMs)
      : 0
    const localEndMs = offset === segmentCount - 1
      ? canonicalRequestedOffset(requestEndMs, segment.startMs, durationMs)
      : durationMs
    if (localStartMs === undefined || localEndMs === undefined) {
      return Object.freeze({ complete: false, ranges: Object.freeze([]) })
    }
    const reverse = loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
    const resolvedStartMs = reverse ? durationMs - localStartMs : localStartMs
    const resolvedEndMs = reverse ? durationMs - localEndMs : localEndMs
    ranges.push(Object.freeze({
      startMs: Math.min(resolvedStartMs, resolvedEndMs),
      endMs: Math.max(resolvedStartMs, resolvedEndMs),
    }))
  }
  return Object.freeze({ complete: true, ranges: Object.freeze(ranges) })
}

function stableComponentStrength(value: number): number {
  const bounded = clamp(value, 0, 1)
  if (bounded <= BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON) return 0
  return bounded >= 1 - BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON ? 1 : bounded
}

/**
 * 每个高度样本、区间上界证明各消耗一个共享 work unit。任何预算耗尽或不可表示区间均保留 unknown，
 * 且整个分析不输出转换，避免局部证明改变 caller-owned 授权。
 */
export function analyzeBipedPetBallisticTimeline(
  input: AnalyzeBipedPetBallisticTimelineInput,
): BipedPetBallisticTimelineAnalysis {
  const durationMs = Number.isFinite(input.durationMs) && input.durationMs > 0 ? input.durationMs : 1
  const windows = safeWindows(input.windows, durationMs)
  // 只有动作结构可以形成 canonical 边界；请求帧端点绝不进入这里。
  const boundaries = [...new Set([
    0,
    durationMs,
    ...windows.flatMap(window => [window.startMs, window.endMs]),
  ])].sort((left, right) => left - right)
  const maximumWeight = windows.reduce((maximum, window) => Math.max(maximum, window.weight), 0)
  const totalScaledWeight = maximumWeight > 0
    ? windows.reduce((total, window) => total + window.weight / maximumWeight, 0)
    : 0
  const verticalIntentScale = Number.isFinite(input.jumpHeight * input.actionWeight)
    ? input.jumpHeight * input.actionWeight
    : 0
  const airborneThreshold = verticalIntentScale > 0
    ? Math.max(BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON, BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON / verticalIntentScale)
    : Number.POSITIVE_INFINITY
  let workUnits = 0
  let exhausted = false
  const consumeWorkUnit = () => {
    if (workUnits >= MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS) {
      exhausted = true
      return false
    }
    workUnits += 1
    return true
  }
  const samples = new Map<number, TimelineSample>()
  const sampleAt = (timeMs: number): TimelineSample => {
    const cached = samples.get(timeMs)
    if (cached) return cached
    if (!consumeWorkUnit()) return Object.freeze({ height: 0, evidence: 'unknown' })
    const height = normalizedCompositeHeight(windows, maximumWeight, totalScaledWeight, timeMs)
    const sample = Object.freeze({
      height,
      evidence: height > airborneThreshold ? 'airborne' as const : 'grounded' as const,
    })
    samples.set(timeMs, sample)
    return sample
  }
  const boundsAt = (startMs: number, endMs: number): ReturnType<typeof normalizedCompositeHeightBounds> | undefined => {
    if (!consumeWorkUnit()) return undefined
    return normalizedCompositeHeightBounds(windows, maximumWeight, totalScaledWeight, startMs, endMs)
  }
  /**
   * 强度取阈值组件内的真实复合高度峰值，不能复用 proof witness 或窗口中点提示。
   * 单窗、共同峰心及同向区间直接解析；其余区间共享一个 Bernstein 凸包上界优先队列。
   * 每次细分与真实采样都纳入 512 work-unit，耗尽即令整个分析 unknown；控制多边形上界只作证明，绝不成为强度。
   */
  const maximumCompositeHeightInRange = (rangeStartMs: number, rangeEndMs: number): number | undefined => {
    let maximumHeight = 0
    let nextNodeSequence = 0
    const pendingNodes: CompositePeakNode[] = []
    const consider = (timeMs: number) => {
      const sample = sampleAt(timeMs)
      if (sample.evidence === 'unknown') return false
      maximumHeight = Math.max(maximumHeight, sample.height)
      return true
    }
    const createNode = (
      startMs: number,
      endMs: number,
      controlPoints: readonly number[],
      activeWindowCount: number,
      depth: number,
    ): CompositePeakNode => Object.freeze({
      startMs,
      endMs,
      controlPoints,
      activeWindowCount,
      depth,
      upper: compositePeakUpper(controlPoints, activeWindowCount, depth),
      sequence: nextNodeSequence++,
    })
    const compareNodes = (left: CompositePeakNode, right: CompositePeakNode) => {
      if (left.upper !== right.upper) return right.upper - left.upper
      if (left.startMs !== right.startMs) return left.startMs - right.startMs
      if (left.endMs !== right.endMs) return left.endMs - right.endMs
      return left.sequence - right.sequence
    }

    if (!consider(rangeStartMs) || !consider(rangeEndMs)) return undefined
    const rangeBoundaries = [
      rangeStartMs,
      ...boundaries.filter(boundaryMs => boundaryMs > rangeStartMs && boundaryMs < rangeEndMs),
      rangeEndMs,
    ]
    for (let index = 0; index < rangeBoundaries.length - 1; index += 1) {
      const startMs = rangeBoundaries[index]!
      const endMs = rangeBoundaries[index + 1]!
      const activeWindows = windows.filter(window => window.startMs < endMs && window.endMs > startMs)
      if (activeWindows.length === 0) continue
      const firstPeakMs = activeWindows[0]!.startMs
        + (activeWindows[0]!.endMs - activeWindows[0]!.startMs) * .5
      if (activeWindows.length === 1
        || activeWindows.every(window => (
          window.startMs + (window.endMs - window.startMs) * .5 === firstPeakMs
        ))) {
        if (!consider(clamp(firstPeakMs, startMs, endMs))) return undefined
        continue
      }
      const peakTimes = activeWindows.map(window => window.startMs + (window.endMs - window.startMs) * .5)
      if (peakTimes.every(peakMs => peakMs >= endMs)) {
        if (!consider(endMs)) return undefined
        continue
      }
      if (peakTimes.every(peakMs => peakMs <= startMs)) {
        if (!consider(startMs)) return undefined
        continue
      }
      if (!consumeWorkUnit()) return undefined
      const controlPoints = normalizedCompositeHeightControlPoints(
        activeWindows,
        maximumWeight,
        totalScaledWeight,
        startMs,
        endMs,
      )
      const midpointMs = startMs + (endMs - startMs) * .5
      if (!consider(midpointMs)) return undefined
      pendingNodes.push(createNode(startMs, endMs, controlPoints, activeWindows.length, 0))
    }

    while (pendingNodes.length > 0) {
      pendingNodes.sort(compareNodes)
      const node = pendingNodes.shift()!
      const tolerance = Math.max(1, Math.abs(maximumHeight)) * COMPOSITE_PEAK_RELATIVE_TOLERANCE
      if (node.upper <= maximumHeight + tolerance) break
      const midpointMs = node.startMs + (node.endMs - node.startMs) * .5
      if (midpointMs === node.startMs || midpointMs === node.endMs) {
        if (!consider(node.startMs) || !consider(node.endMs)) return undefined
        continue
      }
      if (!consumeWorkUnit()) return undefined
      const split = splitBernsteinControlPoints(node.controlPoints, .5)
      if (!consider(midpointMs)) return undefined
      const nextDepth = node.depth + 1
      const left = createNode(
        node.startMs,
        midpointMs,
        split.left,
        node.activeWindowCount,
        nextDepth,
      )
      const right = createNode(
        midpointMs,
        node.endMs,
        split.right,
        node.activeWindowCount,
        nextDepth,
      )
      const nextTolerance = Math.max(1, Math.abs(maximumHeight)) * COMPOSITE_PEAK_RELATIVE_TOLERANCE
      if (left.upper > maximumHeight + nextTolerance) pendingNodes.push(left)
      if (right.upper > maximumHeight + nextTolerance) pendingNodes.push(right)
    }
    return maximumHeight
  }
  const classifyInterval = (startMs: number, endMs: number): readonly ClassifiedInterval[] => {
    const midpointMs = startMs + (endMs - startMs) * .5
    if (midpointMs === startMs || midpointMs === endMs) {
      // 相邻浮点数之间虽无可采样内点，但非负窗的严格上界仍能证明这个正宽 ULP gap 为 grounded。
      const bounds = boundsAt(startMs, endMs)
      if (bounds?.upper !== undefined && bounds.upper <= airborneThreshold) {
        return [Object.freeze({ startMs, endMs, evidence: 'grounded' })]
      }
      const start = sampleAt(startMs)
      const end = sampleAt(endMs)
      if (start.evidence === 'unknown' || end.evidence === 'unknown') {
        return [Object.freeze({ startMs, endMs, evidence: 'unknown' })]
      }
      const witnessTimeMs = start.evidence === 'airborne'
        ? startMs
        : end.evidence === 'airborne' ? endMs : undefined
      return [Object.freeze({
        startMs,
        endMs,
        evidence: witnessTimeMs === undefined ? 'unknown' : 'airborne',
        ...(witnessTimeMs === undefined ? {} : { witnessTimeMs }),
      })]
    }
    const midpoint = sampleAt(midpointMs)
    if (midpoint.evidence === 'unknown') {
      return [Object.freeze({ startMs, endMs, evidence: 'unknown' })]
    }
    const connectedAirborneSuperlevel = hasConnectedAirborneSuperlevel(windows, startMs, endMs)
    if (midpoint.evidence === 'airborne' && connectedAirborneSuperlevel) {
      return [Object.freeze({
        startMs,
        endMs,
        evidence: 'airborne',
        witnessTimeMs: midpointMs,
      })]
    }
    const bounds = boundsAt(startMs, endMs)
    if (bounds === undefined) return [Object.freeze({ startMs, endMs, evidence: 'unknown' })]
    if (bounds.upper <= airborneThreshold) return [Object.freeze({ startMs, endMs, evidence: 'grounded' })]
    if (midpoint.evidence === 'airborne' && bounds.lower > airborneThreshold) {
      return [Object.freeze({
        startMs,
        endMs,
        evidence: 'airborne',
        witnessTimeMs: midpointMs,
      })]
    }
    if (!connectedAirborneSuperlevel) {
      const start = sampleAt(startMs)
      const end = sampleAt(endMs)
      if (start.evidence === 'unknown' || end.evidence === 'unknown') {
        return [Object.freeze({ startMs, endMs, evidence: 'unknown' })]
      }
      const nonDecreasing = bounds.lowerDerivative >= 0
      const nonIncreasing = bounds.upperDerivative <= 0
      if ((nonDecreasing && end.evidence === 'grounded')
        || (nonIncreasing && start.evidence === 'grounded')) {
        return [Object.freeze({ startMs, endMs, evidence: 'grounded' })]
      }
      if ((nonDecreasing && start.evidence === 'airborne')
        || (nonIncreasing && end.evidence === 'airborne')) {
        const witnessTimeMs = start.evidence === 'airborne' ? startMs : endMs
        return [Object.freeze({ startMs, endMs, evidence: 'airborne', witnessTimeMs })]
      }
      if ((nonDecreasing || nonIncreasing) && start.evidence !== end.evidence) {
        const witnessTimeMs = start.evidence === 'airborne' ? startMs : endMs
        return [Object.freeze({ startMs, endMs, evidence: 'airborne', witnessTimeMs })]
      }
    }
    /*
     * 混合增减贡献中，airborne witness 也只证明“存在 air”；只有下界证明整段 air 后才能停止。
     * 其余情况保留左右有序证明叶，避免居中或偏心的正宽 grounded valley 被吞并。
     */
    const first = classifyInterval(startMs, midpointMs)
    const second = classifyInterval(midpointMs, endMs)
    return Object.freeze([...first, ...second])
  }

  const boundaryEvidence = boundaries.map(boundaryMs => sampleAt(boundaryMs).evidence)
  const classifiedRegions = boundaries.slice(0, -1).flatMap((startMs, index) => (
    classifyInterval(startMs, boundaries[index + 1]!)
  ))
  const publicRegions = classifiedRegions.map(region => Object.freeze({
    startMs: region.startMs,
    endMs: region.endMs,
    evidence: region.evidence,
    ...(region.witnessTimeMs === undefined ? {} : { witnessTimeMs: region.witnessTimeMs }),
  }))

  const refineStartEdge = (groundedMs: number, airborneMs: number): ThresholdEdge | undefined => {
    let ground = groundedMs
    let air = airborneMs
    if (sampleAt(ground).evidence !== 'grounded' || sampleAt(air).evidence !== 'airborne') return undefined
    if (air - ground <= Number.EPSILON * Math.max(1, Math.abs(ground), Math.abs(air)) * 32) {
      return Object.freeze({ airborneMs: air, groundedMs: ground })
    }
    while (true) {
      const midpointMs = ground + (air - ground) * .5
      if (midpointMs === ground || midpointMs === air) break
      const midpoint = sampleAt(midpointMs)
      if (midpoint.evidence === 'unknown') return undefined
      if (midpoint.evidence === 'airborne') air = midpointMs
      else ground = midpointMs
    }
    return Object.freeze({ airborneMs: air, groundedMs: ground })
  }
  const refineEndEdge = (airborneMs: number, groundedMs: number): ThresholdEdge | undefined => {
    let air = airborneMs
    let ground = groundedMs
    if (sampleAt(air).evidence !== 'airborne' || sampleAt(ground).evidence !== 'grounded') return undefined
    if (ground - air <= Number.EPSILON * Math.max(1, Math.abs(air), Math.abs(ground)) * 32) {
      return Object.freeze({ airborneMs: air, groundedMs: ground })
    }
    while (true) {
      const midpointMs = air + (ground - air) * .5
      if (midpointMs === air || midpointMs === ground) break
      const midpoint = sampleAt(midpointMs)
      if (midpoint.evidence === 'unknown') return undefined
      if (midpoint.evidence === 'airborne') air = midpointMs
      else ground = midpointMs
    }
    return Object.freeze({ airborneMs: air, groundedMs: ground })
  }

  const components: BipedPetBallisticTimelineComponent[] = []
  const hasUnknownStructure = boundaryEvidence.includes('unknown')
    || classifiedRegions.some(region => region.evidence === 'unknown')
  if (!hasUnknownStructure) {
    let firstAirborneRegionIndex: number | undefined
    const finishComponent = (lastAirborneRegionIndex: number) => {
      if (firstAirborneRegionIndex === undefined) return
      const firstRegion = classifiedRegions[firstAirborneRegionIndex]!
      const lastRegion = classifiedRegions[lastAirborneRegionIndex]!
      const firstWitnessMs = firstRegion.witnessTimeMs
      const lastWitnessMs = lastRegion.witnessTimeMs
      if (firstWitnessMs === undefined || lastWitnessMs === undefined) {
        exhausted = true
        return
      }
      const startEdge = refineStartEdge(firstRegion.startMs, firstWitnessMs)
      const endEdge = refineEndEdge(lastWitnessMs, lastRegion.endMs)
      if (!startEdge || !endEdge) {
        exhausted = true
        return
      }
      const maximumHeight = maximumCompositeHeightInRange(startEdge.airborneMs, endEdge.airborneMs)
      if (maximumHeight === undefined) {
        exhausted = true
        return
      }
      const strength = stableComponentStrength(maximumHeight * verticalIntentScale)
      if (!(strength > 0)) return
      components.push(Object.freeze({
        index: components.length,
        startMs: startEdge.airborneMs,
        endMs: endEdge.airborneMs,
        startGroundedMs: startEdge.groundedMs,
        endGroundedMs: endEdge.groundedMs,
        strength,
      }))
    }
    const hasExactSupportAdjacency = (boundaryMs: number) => windows.some(window => window.endMs === boundaryMs)
      && windows.some(window => window.startMs === boundaryMs)
    for (let index = 0; index < classifiedRegions.length; index += 1) {
      const region = classifiedRegions[index]!
      if (region.evidence === 'airborne') {
        if (firstAirborneRegionIndex === undefined) firstAirborneRegionIndex = index
        else if (index > firstAirborneRegionIndex
          && sampleAt(region.startMs).evidence === 'grounded'
          && !hasExactSupportAdjacency(region.startMs)) {
          /*
           * grounded 边界仅在窗口精确首尾相接时桥接；overlap 内的正宽 grounded gap 必须形成两组转换。
           * Bridge a grounded boundary only for exact window adjacency; a positive-width overlap valley must produce two transition pairs.
           */
          finishComponent(index - 1)
          firstAirborneRegionIndex = index
          if (exhausted) break
        }
        continue
      }
      if (firstAirborneRegionIndex !== undefined) {
        finishComponent(index - 1)
        firstAirborneRegionIndex = undefined
        if (exhausted) break
      }
    }
    if (!exhausted && firstAirborneRegionIndex !== undefined) finishComponent(classifiedRegions.length - 1)
  }

  // 任何未知/耗尽都返回无转换，避免部分组件改变旧授权。 / Unknown or exhausted analyses emit no transitions, so partial components cannot alter prior authorization.
  const safeComponents = exhausted || hasUnknownStructure ? [] : components
  const rawTransitions = safeComponents.flatMap<BipedPetBallisticTimelineTransition>(component => [
    Object.freeze({
      componentIndex: component.index,
      resolvedTimeMs: component.startMs,
      traversalDirection: 1,
      kind: 'takeoff',
      strength: component.strength,
    }),
    Object.freeze({
      componentIndex: component.index,
      resolvedTimeMs: component.endGroundedMs,
      traversalDirection: 1,
      kind: 'touchdown',
      strength: component.strength,
    }),
    Object.freeze({
      componentIndex: component.index,
      resolvedTimeMs: component.endMs,
      traversalDirection: -1,
      kind: 'takeoff',
      strength: component.strength,
    }),
    Object.freeze({
      componentIndex: component.index,
      resolvedTimeMs: component.startGroundedMs,
      traversalDirection: -1,
      kind: 'touchdown',
      strength: component.strength,
    }),
  ])
  const firstComponentIndex = safeComponents[0]?.index
  const lastComponentIndex = safeComponents.at(-1)?.index
  const firstRegionIsAirborne = classifiedRegions[0]?.evidence === 'airborne'
  const lastRegionIsAirborne = classifiedRegions.at(-1)?.evidence === 'airborne'
  const hasSupportAtStart = windows.some(window => window.startMs === 0)
  const hasSupportAtEnd = windows.some(window => window.endMs === durationMs)
  const transitions = rawTransitions.filter(transition => {
    if (input.loopMode === 'loop' && firstRegionIsAirborne && lastRegionIsAirborne
      && hasSupportAtStart && hasSupportAtEnd) {
      if (transition.traversalDirection === 1
        && ((transition.componentIndex === firstComponentIndex && transition.kind === 'takeoff')
          || (transition.componentIndex === lastComponentIndex && transition.kind === 'touchdown'))) return false
    }
    if (input.loopMode === 'ping-pong') {
      if (lastRegionIsAirborne && hasSupportAtEnd && transition.componentIndex === lastComponentIndex
        && ((transition.traversalDirection === 1 && transition.kind === 'touchdown')
          || (transition.traversalDirection === -1 && transition.kind === 'takeoff'))) return false
      if (firstRegionIsAirborne && hasSupportAtStart && transition.componentIndex === firstComponentIndex
        && ((transition.traversalDirection === -1 && transition.kind === 'touchdown')
          || (transition.traversalDirection === 1 && transition.kind === 'takeoff'))) return false
    }
    return true
  }).sort((left, right) => left.traversalDirection - right.traversalDirection
    || left.resolvedTimeMs - right.resolvedTimeMs
    || (left.kind === right.kind ? 0 : left.kind === 'takeoff' ? -1 : 1))
  const stats = Object.freeze({
    workUnits,
    maximumWorkUnits: MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS,
    boundaryCount: boundaries.length,
    supportComponentCount: supportComponentCount(windows),
    exhausted: exhausted || hasUnknownStructure,
  })
  return Object.freeze({
    durationMs,
    loopMode: input.loopMode,
    boundaries: Object.freeze(boundaries),
    boundaryEvidence: Object.freeze(boundaryEvidence),
    regions: Object.freeze(publicRegions),
    components: Object.freeze(safeComponents),
    transitions: Object.freeze(transitions),
    stats,
  })
}

/**
 * 将 canonical 双向转换映射到本次绝对请求区间；最多处理四个周期，超大 iteration 保守返回 incomplete。
 */
export function bipedPetBallisticTransitionsInRequestedRange(
  analysis: BipedPetBallisticTimelineAnalysis,
  previousRequestedTimeMs: number,
  requestedTimeMs: number,
): { readonly complete: boolean; readonly transitions: readonly BipedPetBallisticRequestedTransition[] } {
  if (analysis.stats.exhausted || !(requestedTimeMs > previousRequestedTimeMs) || requestedTimeMs < 0) {
    return Object.freeze({ complete: !analysis.stats.exhausted, transitions: Object.freeze([]) })
  }
  const events: Array<{
    readonly event: BipedPetBallisticRequestedTransition
    readonly sequence: number
  }> = []
  let sequence = 0
  const appendIteration = (
    segmentStartMs: number,
    direction: -1 | 1,
    localStartMs: number,
    localEndMs: number,
    includeLocalStart: boolean,
  ) => {
    if (localEndMs < localStartMs) return
    const ordered = analysis.transitions
      .filter(transition => transition.traversalDirection === direction)
      .map(transition => Object.freeze({
        transition,
        localOffsetMs: direction === 1
          ? transition.resolvedTimeMs
          : analysis.durationMs - transition.resolvedTimeMs,
      }))
      .sort((left, right) => left.localOffsetMs - right.localOffsetMs)
    for (const { transition, localOffsetMs } of ordered) {
      const afterStart = localOffsetMs > localStartMs
        || (includeLocalStart && localOffsetMs === localStartMs)
      if (!afterStart || localOffsetMs > localEndMs) continue
      const eventRequestedTimeMs = segmentStartMs + localOffsetMs
      if (!Number.isFinite(eventRequestedTimeMs)) continue
      events.push(Object.freeze({
        event: Object.freeze({ ...transition, requestedTimeMs: eventRequestedTimeMs }),
        sequence,
      }))
      sequence += 1
    }
  }
  if (analysis.loopMode === 'once') {
    appendIteration(
      0,
      1,
      clamp(previousRequestedTimeMs, 0, analysis.durationMs),
      clamp(requestedTimeMs, 0, analysis.durationMs),
      previousRequestedTimeMs < 0,
    )
  }
  else {
    const startRequestedTimeMs = Math.max(0, previousRequestedTimeMs)
    const firstIteration = Math.floor(startRequestedTimeMs / analysis.durationMs)
    const lastIteration = Math.floor(requestedTimeMs / analysis.durationMs)
    const segmentCount = lastIteration - firstIteration + 1
    if (!Number.isInteger(segmentCount) || segmentCount < 1
      || segmentCount > MAX_BIPED_PET_BALLISTIC_REQUEST_SEGMENTS) {
      return Object.freeze({ complete: false, transitions: Object.freeze([]) })
    }
    let priorIteration: number | undefined
    for (let offset = 0; offset < segmentCount; offset += 1) {
      const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
      if (priorIteration !== undefined && iteration <= priorIteration) {
        return Object.freeze({ complete: false, transitions: Object.freeze([]) })
      }
      priorIteration = iteration
      const segment = canonicalIterationSegment(iteration, analysis.durationMs)
      if (!segment) return Object.freeze({ complete: false, transitions: Object.freeze([]) })
      const localStartMs = offset === 0
        ? canonicalRequestedOffset(startRequestedTimeMs, segment.startMs, analysis.durationMs)
        : 0
      const localEndMs = offset === segmentCount - 1
        ? canonicalRequestedOffset(requestedTimeMs, segment.startMs, analysis.durationMs)
        : analysis.durationMs
      if (localStartMs === undefined || localEndMs === undefined) {
        return Object.freeze({ complete: false, transitions: Object.freeze([]) })
      }
      const direction = analysis.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0 ? -1 : 1
      appendIteration(
        segment.startMs,
        direction,
        localStartMs,
        localEndMs,
        segment.startMs > previousRequestedTimeMs,
      )
    }
  }
  events.sort((left, right) => left.event.requestedTimeMs - right.event.requestedTimeMs
    || left.sequence - right.sequence)
  return Object.freeze({ complete: true, transitions: Object.freeze(events.map(item => item.event)) })
}

export function classifyBipedPetBallisticResolvedRange(
  analysis: BipedPetBallisticTimelineAnalysis,
  firstTimeMs: number,
  secondTimeMs: number,
): BipedPetBallisticTimelineEvidence {
  if (analysis.stats.exhausted) return 'unknown'
  const startMs = clamp(Math.min(firstTimeMs, secondTimeMs), 0, analysis.durationMs)
  const endMs = clamp(Math.max(firstTimeMs, secondTimeMs), 0, analysis.durationMs)
  if (!(endMs > startMs)) return 'grounded'
  if (analysis.components.some(component => endMs >= component.startMs && startMs <= component.endMs)) return 'airborne'
  return analysis.regions.some(region => region.evidence === 'unknown'
    && region.endMs > startMs && region.startMs < endMs)
    ? 'unknown'
    : 'grounded'
}

export function classifyBipedPetBallisticRequestedRange(
  analysis: BipedPetBallisticTimelineAnalysis,
  firstRequestedTimeMs: number,
  secondRequestedTimeMs: number,
): BipedPetBallisticTimelineEvidence {
  if (!(Math.max(firstRequestedTimeMs, secondRequestedTimeMs) > Math.min(firstRequestedTimeMs, secondRequestedTimeMs))) {
    return 'grounded'
  }
  const requestedRanges = resolvedRequestedRanges(
    firstRequestedTimeMs,
    secondRequestedTimeMs,
    analysis.durationMs,
    analysis.loopMode,
  )
  if (!requestedRanges.complete || analysis.stats.exhausted) return 'unknown'
  let unknown = false
  for (const range of requestedRanges.ranges) {
    const evidence = classifyBipedPetBallisticResolvedRange(analysis, range.startMs, range.endMs)
    if (evidence === 'airborne') return 'airborne'
    if (evidence === 'unknown') unknown = true
  }
  return unknown ? 'unknown' : 'grounded'
}
