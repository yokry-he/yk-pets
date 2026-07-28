/**
 * 文件职责 / File responsibility
 * 以单次采样共享的固定工作预算分析复合弹道时间线，向授权逻辑提供可证明的 airborne/grounded 结论。
 */

import type { StudioMotionLoopMode } from './motion-time'

export const MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS = 512
export const BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON = 1e-12

const MAX_BIPED_PET_BALLISTIC_REQUEST_SEGMENTS = 4

export type BipedPetBallisticTimelineEvidence = 'airborne' | 'grounded' | 'unknown'

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
  readonly previousRequestedTimeMs: number
  readonly requestedTimeMs: number
}

export interface BipedPetBallisticTimelineStats {
  readonly workUnits: number
  readonly maximumWorkUnits: number
  readonly boundaryCount: number
  readonly supportComponentCount: number
  readonly exhausted: boolean
}

interface BipedPetBallisticTimelineRegion {
  readonly startMs: number
  readonly endMs: number
  readonly evidence: BipedPetBallisticTimelineEvidence
}

interface BipedPetBallisticResolvedRange {
  readonly startMs: number
  readonly endMs: number
}

export interface BipedPetBallisticTimelineAnalysis {
  readonly durationMs: number
  readonly loopMode: StudioMotionLoopMode
  readonly boundaries: readonly number[]
  readonly boundaryEvidence: readonly BipedPetBallisticTimelineEvidence[]
  readonly regions: readonly BipedPetBallisticTimelineRegion[]
  readonly stats: BipedPetBallisticTimelineStats
}

export interface BipedPetBallisticRequestedRangeAnchors {
  /** 与 firstRequestedTimeMs 同一事件携带的 canonical 内部 resolved 边界，避免绝对时间相减产生 1 ULP 漂移。 */
  readonly firstResolvedTimeMs?: number
  /** 与 secondRequestedTimeMs 同一事件携带的 canonical 内部 resolved 边界。0/duration 必须保留分段侧别。 */
  readonly secondResolvedTimeMs?: number
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const positiveModulo = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus

function smoothstep(progress: number): number {
  const bounded = clamp(progress, 0, 1)
  return bounded * bounded * (3 - 2 * bounded)
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

function maximumNormalizedCompositeHeight(
  windows: readonly BipedPetBallisticTimelineWindow[],
  maximumWeight: number,
  totalScaledWeight: number,
  startMs: number,
  endMs: number,
): number {
  if (!(maximumWeight > 0) || !(totalScaledWeight > 0)) return 0
  let upperHeight = 0
  for (const window of windows) {
    if (endMs <= window.startMs || startMs >= window.endMs) continue
    const peakMs = clamp(
      window.startMs + (window.endMs - window.startMs) * .5,
      Math.max(startMs, window.startMs),
      Math.min(endMs, window.endMs),
    )
    const progress = smoothstep((peakMs - window.startMs) / (window.endMs - window.startMs))
    upperHeight += window.weight / maximumWeight * 4 * progress * (1 - progress)
  }
  return upperHeight / totalScaledWeight
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
  anchors?: BipedPetBallisticRequestedRangeAnchors,
): { readonly complete: boolean; readonly ranges: readonly BipedPetBallisticResolvedRange[] } {
  const startRequestedTimeMs = Math.max(0, Math.min(firstRequestedTimeMs, secondRequestedTimeMs))
  const endRequestedTimeMs = Math.max(0, Math.max(firstRequestedTimeMs, secondRequestedTimeMs))
  const orderedForward = firstRequestedTimeMs <= secondRequestedTimeMs
  const startResolvedAnchorMs = orderedForward ? anchors?.firstResolvedTimeMs : anchors?.secondResolvedTimeMs
  const endResolvedAnchorMs = orderedForward ? anchors?.secondResolvedTimeMs : anchors?.firstResolvedTimeMs
  const canonicalAnchor = (value: number | undefined) => typeof value === 'number'
    && Number.isFinite(value) && value > 0 && value < durationMs
    ? value
    : undefined
  const safeStartResolvedAnchorMs = canonicalAnchor(startResolvedAnchorMs)
  const safeEndResolvedAnchorMs = canonicalAnchor(endResolvedAnchorMs)
  if (!(endRequestedTimeMs > startRequestedTimeMs)) return Object.freeze({ complete: true, ranges: Object.freeze([]) })
  if (loopMode === 'once') {
    return Object.freeze({
      complete: true,
      ranges: Object.freeze([Object.freeze({
        startMs: safeStartResolvedAnchorMs ?? clamp(startRequestedTimeMs, 0, durationMs),
        endMs: safeEndResolvedAnchorMs ?? clamp(endRequestedTimeMs, 0, durationMs),
      })]),
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
    const segmentStartMs = iteration * durationMs
    const segmentEndMs = segmentStartMs + durationMs
    if (!Number.isFinite(segmentStartMs) || !Number.isFinite(segmentEndMs)) {
      return Object.freeze({ complete: false, ranges: Object.freeze([]) })
    }
    const requestStartMs = Math.max(startRequestedTimeMs, segmentStartMs)
    const requestEndMs = Math.min(endRequestedTimeMs, segmentEndMs)
    if (!(requestEndMs > requestStartMs)) continue
    const localStartMs = requestStartMs - segmentStartMs
    const localEndMs = requestEndMs - segmentStartMs
    const reverse = loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
    let resolvedRequestStartMs = reverse ? durationMs - localStartMs : localStartMs
    let resolvedRequestEndMs = reverse ? durationMs - localEndMs : localEndMs
    if (requestStartMs === startRequestedTimeMs && safeStartResolvedAnchorMs !== undefined) {
      resolvedRequestStartMs = safeStartResolvedAnchorMs
    }
    if (requestEndMs === endRequestedTimeMs && safeEndResolvedAnchorMs !== undefined) {
      resolvedRequestEndMs = safeEndResolvedAnchorMs
    }
    ranges.push(Object.freeze({
      startMs: Math.min(resolvedRequestStartMs, resolvedRequestEndMs),
      endMs: Math.max(resolvedRequestStartMs, resolvedRequestEndMs),
    }))
  }
  return Object.freeze({ complete: true, ranges: Object.freeze(ranges) })
}

/**
 * 每个唯一边界点与每个自适应区间各消耗一个 work unit；所有查询只读取返回值，不会追加隐藏状态或重置预算。
 */
export function analyzeBipedPetBallisticTimeline(
  input: AnalyzeBipedPetBallisticTimelineInput,
): BipedPetBallisticTimelineAnalysis {
  const durationMs = Number.isFinite(input.durationMs) && input.durationMs > 0 ? input.durationMs : 1
  const windows = safeWindows(input.windows, durationMs)
  const requestedRanges = resolvedRequestedRanges(
    input.previousRequestedTimeMs,
    input.requestedTimeMs,
    durationMs,
    input.loopMode,
  )
  const boundaries = [...new Set([
    0,
    durationMs,
    ...windows.flatMap(window => [window.startMs, window.endMs]),
    ...requestedRanges.ranges.flatMap(range => [range.startMs, range.endMs]),
  ])].sort((left, right) => left - right)
  const maximumWeight = windows.reduce((maximum, window) => Math.max(maximum, window.weight), 0)
  const totalScaledWeight = maximumWeight > 0
    ? windows.reduce((total, window) => total + window.weight / maximumWeight, 0)
    : 0
  const verticalIntentScale = input.jumpHeight * input.actionWeight
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
  const heightAt = (timeMs: number) => normalizedCompositeHeight(
    windows,
    maximumWeight,
    totalScaledWeight,
    timeMs,
  )
  const boundaryEvidence = boundaries.map<BipedPetBallisticTimelineEvidence>(boundaryMs => {
    if (!consumeWorkUnit()) return 'unknown'
    return heightAt(boundaryMs) > airborneThreshold ? 'airborne' : 'grounded'
  })
  const classifyInterval = (startMs: number, endMs: number): BipedPetBallisticTimelineEvidence => {
    if (!consumeWorkUnit()) return 'unknown'
    const midpointMs = startMs + (endMs - startMs) * .5
    if (heightAt(midpointMs) > airborneThreshold) return 'airborne'
    if (maximumNormalizedCompositeHeight(
      windows,
      maximumWeight,
      totalScaledWeight,
      startMs,
      endMs,
    ) <= airborneThreshold) return 'grounded'
    if (midpointMs === startMs || midpointMs === endMs) return 'unknown'
    const firstEvidence = classifyInterval(startMs, midpointMs)
    if (firstEvidence === 'airborne') return 'airborne'
    const secondEvidence = classifyInterval(midpointMs, endMs)
    if (secondEvidence === 'airborne') return 'airborne'
    return firstEvidence === 'grounded' && secondEvidence === 'grounded' ? 'grounded' : 'unknown'
  }
  const regions = boundaries.slice(0, -1).map((startMs, index) => Object.freeze({
    startMs,
    endMs: boundaries[index + 1]!,
    evidence: classifyInterval(startMs, boundaries[index + 1]!),
  }))
  const stats = Object.freeze({
    workUnits,
    maximumWorkUnits: MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS,
    boundaryCount: boundaries.length,
    supportComponentCount: supportComponentCount(windows),
    exhausted,
  })
  return Object.freeze({
    durationMs,
    loopMode: input.loopMode,
    boundaries: Object.freeze(boundaries),
    boundaryEvidence: Object.freeze(boundaryEvidence),
    regions: Object.freeze(regions),
    stats,
  })
}

export function classifyBipedPetBallisticResolvedRange(
  analysis: BipedPetBallisticTimelineAnalysis,
  firstTimeMs: number,
  secondTimeMs: number,
): BipedPetBallisticTimelineEvidence {
  const startMs = clamp(Math.min(firstTimeMs, secondTimeMs), 0, analysis.durationMs)
  const endMs = clamp(Math.max(firstTimeMs, secondTimeMs), 0, analysis.durationMs)
  const startIndex = analysis.boundaries.indexOf(startMs)
  const endIndex = analysis.boundaries.indexOf(endMs)
  if (startIndex < 0 || endIndex < startIndex) return 'unknown'
  let unknown = false
  for (let index = startIndex; index <= endIndex; index += 1) {
    const evidence = analysis.boundaryEvidence[index]
    if (evidence === 'airborne') return 'airborne'
    if (evidence === 'unknown') unknown = true
  }
  for (let index = startIndex; index < endIndex; index += 1) {
    const evidence = analysis.regions[index]?.evidence
    if (evidence === 'airborne') return 'airborne'
    if (evidence === 'unknown' || evidence === undefined) unknown = true
  }
  return unknown ? 'unknown' : 'grounded'
}

/**
 * 读取 canonical 边界某一侧紧邻区域的既有证据；越出 once 时间轴的区域按 grounded 处理。
 * 该查询不执行新采样、不消耗额外 work unit，loop/ping-pong 的 seam 映射由事件调用方明确提供。
 */
export function classifyBipedPetBallisticResolvedBoundarySide(
  analysis: BipedPetBallisticTimelineAnalysis,
  boundaryMs: number,
  direction: -1 | 1,
): BipedPetBallisticTimelineEvidence {
  const boundaryIndex = analysis.boundaries.indexOf(boundaryMs)
  if (boundaryIndex < 0) return 'unknown'
  const regionIndex = direction === -1 ? boundaryIndex - 1 : boundaryIndex
  return analysis.regions[regionIndex]?.evidence ?? 'grounded'
}

export function classifyBipedPetBallisticRequestedRange(
  analysis: BipedPetBallisticTimelineAnalysis,
  firstRequestedTimeMs: number,
  secondRequestedTimeMs: number,
  anchors?: BipedPetBallisticRequestedRangeAnchors,
): BipedPetBallisticTimelineEvidence {
  if (!(Math.max(firstRequestedTimeMs, secondRequestedTimeMs) > Math.min(firstRequestedTimeMs, secondRequestedTimeMs))) {
    return 'grounded'
  }
  const requestedRanges = resolvedRequestedRanges(
    firstRequestedTimeMs,
    secondRequestedTimeMs,
    analysis.durationMs,
    analysis.loopMode,
    anchors,
  )
  if (!requestedRanges.complete) return 'unknown'
  let unknown = false
  for (const range of requestedRanges.ranges) {
    const evidence = classifyBipedPetBallisticResolvedRange(analysis, range.startMs, range.endMs)
    if (evidence === 'airborne') return 'airborne'
    if (evidence === 'unknown') unknown = true
  }
  return unknown ? 'unknown' : 'grounded'
}
