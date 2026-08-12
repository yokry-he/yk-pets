/**
 * 文件职责 / File responsibility
 * 把 Root Motion 的有限运动信号与动作标签组合为确定、可去重且与渲染框架无关的 VFX 指令。
 */

import {
  MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS,
  type BipedPetMotionVfxTag,
  type SampledBipedPetRootMotion,
} from './biped-pet-root-motion'

export interface BipedPetMotionVfxSignal {
  readonly id: string
  readonly kind: BipedPetMotionVfxTag
  readonly mode: 'burst' | 'sustain'
  readonly strength: number
  readonly timeMs: number
  readonly lifetimeMs: number
}

export interface DeriveBipedPetMotionVfxSignalsInput {
  readonly clipHash: string
  readonly previousRequestedTimeMs: number
  readonly requestedTimeMs: number
  readonly tags: readonly BipedPetMotionVfxTag[]
  readonly rootMotion: Pick<
    SampledBipedPetRootMotion,
    'requestedTimeMs' | 'status' | 'phase' | 'motionIntensity' | 'landingImpulse' | 'brakeIntensity'
  >
}

type SafeMotionVfxInput = {
  clipHash: string
  previousRequestedTimeMs: number
  requestedTimeMs: number
  tags: readonly BipedPetMotionVfxTag[]
  status: 'solved' | 'clamped'
  phase: SampledBipedPetRootMotion['phase']
  motionIntensity: number
  landingImpulse: number
  brakeIntensity: number
}

const SUPPORTED_TAGS = new Set<BipedPetMotionVfxTag>([
  'landing-ring',
  'landing-dust',
  'speed-trail',
  'brake-sparks',
])

const SIGNAL_RULES = Object.freeze({
  'landing-ring': Object.freeze({ mode: 'burst' as const, threshold: .25, lifetimeMs: 480 }),
  'landing-dust': Object.freeze({ mode: 'burst' as const, threshold: .4, lifetimeMs: 480 }),
  'speed-trail': Object.freeze({ mode: 'sustain' as const, threshold: .55, lifetimeMs: 160 }),
  'brake-sparks': Object.freeze({ mode: 'burst' as const, threshold: .45, lifetimeMs: 320 }),
})

function emptySignals(): readonly BipedPetMotionVfxSignal[] {
  // 每次返回独立冻结数组，避免调用方通过空结果身份携带隐式状态。 / Return a fresh frozen array so empty-result identity cannot carry hidden state.
  return Object.freeze([])
}

function safeRecord(value: unknown): Record<PropertyKey, unknown> | undefined {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<PropertyKey, unknown>
      : undefined
  }
  catch {
    return undefined
  }
}

function isValidClipHash(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false
  const points = Array.from(value)
  return points.length > 0
    && points.length <= 256
    && !/\p{Cc}/u.test(value)
    && !/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(value)
    && !/[\ud800-\udfff]/u.test(value)
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, character => character.codePointAt(0)!)
  const rightPoints = Array.from(right, character => character.codePointAt(0)!)
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

function copyTags(value: unknown): readonly BipedPetMotionVfxTag[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined
    const length = Reflect.get(value, 'length')
    if (!Number.isSafeInteger(length) || length < 0) return undefined
    const tags = new Set<BipedPetMotionVfxTag>()
    const boundedLength = Math.min(length, MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS)
    for (let index = 0; index < boundedLength; index += 1) {
      const tag = Reflect.get(value, index)
      if (SUPPORTED_TAGS.has(tag as BipedPetMotionVfxTag)) tags.add(tag as BipedPetMotionVfxTag)
    }
    return Object.freeze([...tags].sort(compareCodePoints))
  }
  catch {
    return undefined
  }
}

function readFiniteNumber(source: Record<PropertyKey, unknown>, key: string): number | undefined {
  const value = Reflect.get(source, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseInput(input: unknown): SafeMotionVfxInput | undefined {
  try {
    const source = safeRecord(input)
    if (!source) return undefined
    const clipHash = Reflect.get(source, 'clipHash')
    const previousRequestedTimeMs = readFiniteNumber(source, 'previousRequestedTimeMs')
    const requestedTimeMs = readFiniteNumber(source, 'requestedTimeMs')
    const tags = copyTags(Reflect.get(source, 'tags'))
    const rootMotion = safeRecord(Reflect.get(source, 'rootMotion'))
    if (!isValidClipHash(clipHash)
      || previousRequestedTimeMs === undefined
      || requestedTimeMs === undefined
      || previousRequestedTimeMs < 0
      || requestedTimeMs < 0
      || !tags
      || !rootMotion
      || !(requestedTimeMs > previousRequestedTimeMs)) return undefined

    const status = Reflect.get(rootMotion, 'status')
    const phase = Reflect.get(rootMotion, 'phase')
    const rootRequestedTimeMs = readFiniteNumber(rootMotion, 'requestedTimeMs')
    const motionIntensity = readFiniteNumber(rootMotion, 'motionIntensity')
    const landingImpulse = readFiniteNumber(rootMotion, 'landingImpulse')
    const brakeIntensity = readFiniteNumber(rootMotion, 'brakeIntensity')
    if ((status !== 'solved' && status !== 'clamped')
      || (phase !== 'grounded' && phase !== 'takeoff' && phase !== 'airborne' && phase !== 'landing')
      || rootRequestedTimeMs === undefined
      || rootRequestedTimeMs !== requestedTimeMs
      || motionIntensity === undefined
      || landingImpulse === undefined
      || brakeIntensity === undefined) return undefined

    return {
      clipHash,
      previousRequestedTimeMs,
      requestedTimeMs,
      tags,
      status,
      phase,
      motionIntensity: Math.max(0, Math.min(1, motionIntensity)),
      landingImpulse: Math.max(0, Math.min(1, landingImpulse)),
      brakeIntensity: Math.max(0, Math.min(1, brakeIntensity)),
    }
  }
  catch {
    return undefined
  }
}

function signalStrength(input: SafeMotionVfxInput, kind: BipedPetMotionVfxTag): number | undefined {
  if (kind === 'landing-ring' || kind === 'landing-dust') {
    // 求解器在实际 touchdown 帧先归类 grounded，再输出一次性冲量；保留 landing 兼容计划夹具。 / The solver classifies the real touchdown frame as grounded before emitting its one-shot impulse; landing remains compatible with plan fixtures.
    return input.phase === 'landing' || input.phase === 'grounded'
      ? input.landingImpulse
      : undefined
  }
  if (kind === 'speed-trail') return input.motionIntensity
  return input.phase === 'grounded' ? input.brakeIntensity : undefined
}

/**
 * 信号派生保持无状态：burst 由 Clip、种类和动作时间唯一标识，sustain 在有效区间复用 active 标识。
 * 同时刻与倒退由时间边界直接拒绝；运行时无需依赖隐藏历史才能避免重复触发。
 */
export function deriveBipedPetMotionVfxSignals(
  input: DeriveBipedPetMotionVfxSignalsInput,
): readonly BipedPetMotionVfxSignal[] {
  const safeInput = parseInput(input)
  if (!safeInput || safeInput.tags.length === 0) return emptySignals()

  const signals: BipedPetMotionVfxSignal[] = []
  for (const kind of safeInput.tags) {
    const rule = SIGNAL_RULES[kind]
    const strength = signalStrength(safeInput, kind)
    // 设计语义是“超过阈值”；相等时保持静默，避免阈值舍入抖动。 / The contract is strictly greater-than; equality stays silent to avoid threshold jitter.
    if (strength === undefined || !(strength > rule.threshold)) continue
    signals.push(Object.freeze({
      id: rule.mode === 'burst'
        ? `${safeInput.clipHash}:${kind}:${Math.round(safeInput.requestedTimeMs)}`
        : `${safeInput.clipHash}:${kind}:active`,
      kind,
      mode: rule.mode,
      strength,
      timeMs: safeInput.requestedTimeMs,
      lifetimeMs: rule.lifetimeMs,
    }))
  }
  return Object.freeze(signals)
}
