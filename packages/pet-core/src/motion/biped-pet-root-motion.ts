/**
 * 文件职责 / File responsibility
 * 定义双足萌宠版本兼容的 Root Motion 契约，规范化不可信持久化输入，并提供确定性纯数值采样。
 */

import { normalizeMotionDurationMs, resolveMotionTime, type ResolvedMotionTime, type StudioMotionLoopMode } from './motion-time'

export type BipedPetRootMotionMode = 'in-place' | 'travel'
export type BipedPetRootVerticalMode = 'grounded' | 'ballistic'
export type BipedPetRootMotionWindowKind = 'travel' | 'warp' | 'ballistic' | 'brake'
export type BipedPetMotionVfxTag = 'landing-ring' | 'landing-dust' | 'speed-trail' | 'brake-sparks'

export interface BipedPetRootMotionWindow {
  readonly id: string
  readonly kind: BipedPetRootMotionWindowKind
  readonly startMs: number
  readonly endMs: number
  readonly weight: number
}

export interface BipedPetRootMotionDefinition {
  readonly mode: BipedPetRootMotionMode
  readonly distance: number
  readonly turnRadians: number
  readonly verticalMode: BipedPetRootVerticalMode
  readonly jumpHeight: number
  readonly windows: readonly BipedPetRootMotionWindow[]
  readonly vfxTags: readonly BipedPetMotionVfxTag[]
}

export interface BipedPetRootMotionNormalizationResult {
  value: BipedPetRootMotionDefinition
  diagnostics: readonly { id: string; severity: 'warning'; message: string }[]
}

export interface SampleBipedPetRootMotionInput {
  readonly definition: BipedPetRootMotionDefinition
  readonly requestedTimeMs: number
  readonly previousRequestedTimeMs?: number
  readonly durationMs: number
  readonly loopMode: StudioMotionLoopMode
  readonly characterHeight: number
  readonly facingRadians: number
  readonly actionWeight: number
  readonly footResidual: readonly [number, number, number]
}

export interface SampledBipedPetRootMotion {
  readonly status: 'solved' | 'clamped' | 'reset' | 'blocked'
  readonly requestedTimeMs: number
  readonly resolvedTimeMs: number
  readonly iteration: number
  readonly cumulativeLocal: readonly [number, number, number]
  readonly cumulativeWorld: readonly [number, number, number]
  readonly deltaLocal: readonly [number, number, number]
  readonly deltaWorld: readonly [number, number, number]
  readonly cumulativeTurnRadians: number
  readonly deltaTurnRadians: number
  readonly linearVelocity: readonly [number, number, number]
  readonly angularVelocity: number
  readonly phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  readonly motionIntensity: number
  readonly landingImpulse: number
  readonly brakeIntensity: number
}

export const MAX_BIPED_PET_ROOT_MOTION_WINDOWS = 64
export const MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS = 16

type RootMotionDiagnostic = BipedPetRootMotionNormalizationResult['diagnostics'][number]
type SafeProperty = { ok: true; value: unknown } | { ok: false; value: undefined }

const FALLBACK_DURATION_MS = 1200
const MAX_DISTANCE = 4
const MAX_TURN_RADIANS = Math.PI * 2
const MAX_JUMP_HEIGHT = 1.5
const MAX_WINDOW_WEIGHT = 1
const WINDOW_KINDS = new Set<BipedPetRootMotionWindowKind>(['travel', 'warp', 'ballistic', 'brake'])
const VFX_TAGS = new Set<BipedPetMotionVfxTag>(['landing-ring', 'landing-dust', 'speed-trail', 'brake-sparks'])

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

function inPlaceRootMotion(): BipedPetRootMotionDefinition {
  return {
    mode: 'in-place',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [],
    vfxTags: [],
  }
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, character => character.codePointAt(0)!)
  const rightPoints = Array.from(right, character => character.codePointAt(0)!)
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!
    if (difference) return difference
  }
  return leftPoints.length - rightPoints.length
}

function diagnostic(id: string, message: string): RootMotionDiagnostic {
  return { id, severity: 'warning', message }
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

function readProperty(
  source: Record<PropertyKey, unknown>,
  key: string,
  diagnostics: RootMotionDiagnostic[],
  id = `root-motion-${key}-access-failed`,
): SafeProperty {
  try {
    return { ok: true, value: Reflect.get(source, key) }
  }
  catch {
    diagnostics.push(diagnostic(id, `Root Motion 字段 ${key} 无法安全读取，已使用原地回退。`))
    return { ok: false, value: undefined }
  }
}

function readArray(
  value: unknown,
  diagnostics: RootMotionDiagnostic[],
  field: 'windows' | 'vfxTags',
  maximumItems: number,
): { values: unknown[]; accessFailed: boolean; validContainer: boolean } {
  try {
    if (!Array.isArray(value)) return { values: [], accessFailed: false, validContainer: false }
    const length = Reflect.get(value, 'length')
    if (!Number.isSafeInteger(length) || length < 0) throw new TypeError('invalid array length')
    const boundedLength = Math.min(length, maximumItems)
    if (length > maximumItems) {
      diagnostics.push(diagnostic(
        `root-motion-${field}-budget-exceeded`,
        `Root Motion 的 ${field} 超过 ${maximumItems} 项预算，仅处理预算内条目。`,
      ))
    }
    const values: unknown[] = []
    for (let index = 0; index < boundedLength; index += 1) values.push(Reflect.get(value, index))
    return { values, accessFailed: false, validContainer: true }
  }
  catch {
    diagnostics.push(diagnostic(`root-motion-${field}-access-failed`, `Root Motion 的 ${field} 无法安全读取，已忽略该字段。`))
    return { values: [], accessFailed: true, validContainer: false }
  }
}

function normalizeFiniteField(
  source: Record<PropertyKey, unknown>,
  key: 'distance' | 'turnRadians' | 'jumpHeight',
  minimum: number,
  maximum: number,
  diagnostics: RootMotionDiagnostic[],
): { value: number; invalid: boolean } {
  const property = readProperty(source, key, diagnostics)
  if (!property.ok) return { value: 0, invalid: true }
  if (property.value === undefined) return { value: 0, invalid: false }
  if (typeof property.value !== 'number' || !Number.isFinite(property.value)) {
    diagnostics.push(diagnostic(`root-motion-${key}-invalid`, `Root Motion 的 ${key} 不是有限数，已使用原地回退。`))
    return { value: 0, invalid: true }
  }
  const value = clamp(property.value, minimum, maximum)
  if (value !== property.value) {
    diagnostics.push(diagnostic(`root-motion-${key}-clamped`, `Root Motion 的 ${key} 超出安全范围，已钳制。`))
  }
  return { value, invalid: false }
}

function normalizeWindows(
  source: Record<PropertyKey, unknown>,
  durationMs: number,
  diagnostics: RootMotionDiagnostic[],
): { value: BipedPetRootMotionWindow[]; invalidContainer: boolean } {
  const property = readProperty(source, 'windows', diagnostics)
  if (!property.ok) return { value: [], invalidContainer: true }
  if (property.value === undefined) return { value: [], invalidContainer: false }
  const array = readArray(property.value, diagnostics, 'windows', MAX_BIPED_PET_ROOT_MOTION_WINDOWS)
  if (!array.validContainer) {
    if (!array.accessFailed) diagnostics.push(diagnostic('root-motion-windows-invalid', 'Root Motion 的 windows 不是数组，已忽略该字段。'))
    return { value: [], invalidContainer: true }
  }

  const windows: BipedPetRootMotionWindow[] = []
  for (const [index, candidate] of array.values.entries()) {
    const record = safeRecord(candidate)
    if (!record) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-invalid`, `Root Motion 窗口 ${index} 不是对象，已丢弃。`))
      continue
    }

    let id: unknown
    let kind: unknown
    let startMs: unknown
    let endMs: unknown
    let weight: unknown
    try {
      id = Reflect.get(record, 'id')
      kind = Reflect.get(record, 'kind')
      startMs = Reflect.get(record, 'startMs')
      endMs = Reflect.get(record, 'endMs')
      weight = Reflect.get(record, 'weight')
    }
    catch {
      diagnostics.push(diagnostic(`root-motion-window-${index}-access-failed`, `Root Motion 窗口 ${index} 无法安全读取，已丢弃。`))
      continue
    }

    if (typeof id !== 'string' || !id.trim()) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-id-invalid`, `Root Motion 窗口 ${index} 缺少有效 id，已丢弃。`))
      continue
    }
    if (!WINDOW_KINDS.has(kind as BipedPetRootMotionWindowKind)) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-kind-invalid`, `Root Motion 窗口 ${id.trim()} 的 kind 无效，已丢弃。`))
      continue
    }
    if (typeof startMs !== 'number' || !Number.isFinite(startMs) || typeof endMs !== 'number' || !Number.isFinite(endMs)) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-time-invalid`, `Root Motion 窗口 ${id.trim()} 的时间不是有限数，已丢弃。`))
      continue
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-weight-invalid`, `Root Motion 窗口 ${id.trim()} 的权重必须是正有限数，已丢弃。`))
      continue
    }

    const safeStartMs = clamp(startMs, 0, durationMs)
    const safeEndMs = clamp(endMs, 0, durationMs)
    if (safeStartMs !== startMs || safeEndMs !== endMs) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-time-clamped`, `Root Motion 窗口 ${id.trim()} 已限制在动作时长内。`))
    }
    if (safeEndMs <= safeStartMs) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-range-invalid`, `Root Motion 窗口 ${id.trim()} 是反向或零长度区间，已丢弃。`))
      continue
    }
    const safeWeight = clamp(weight, Number.MIN_VALUE, MAX_WINDOW_WEIGHT)
    if (safeWeight !== weight) {
      diagnostics.push(diagnostic(`root-motion-window-${index}-weight-clamped`, `Root Motion 窗口 ${id.trim()} 的权重超出安全范围，已钳制。`))
    }
    windows.push({
      id: id.trim(),
      kind: kind as BipedPetRootMotionWindowKind,
      startMs: safeStartMs,
      endMs: safeEndMs,
      weight: safeWeight,
    })
  }

  windows.sort((left, right) => left.startMs - right.startMs
    || left.endMs - right.endMs
    || compareCodePoints(left.id, right.id))
  return { value: windows, invalidContainer: false }
}

function normalizeVfxTags(
  source: Record<PropertyKey, unknown>,
  diagnostics: RootMotionDiagnostic[],
): { value: BipedPetMotionVfxTag[]; invalidContainer: boolean } {
  const property = readProperty(source, 'vfxTags', diagnostics)
  if (!property.ok) return { value: [], invalidContainer: true }
  if (property.value === undefined) return { value: [], invalidContainer: false }
  const array = readArray(property.value, diagnostics, 'vfxTags', MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS)
  if (!array.validContainer) {
    if (!array.accessFailed) diagnostics.push(diagnostic('root-motion-vfx-tags-invalid', 'Root Motion 的 vfxTags 不是数组，已忽略该字段。'))
    return { value: [], invalidContainer: true }
  }

  const tags = new Set<BipedPetMotionVfxTag>()
  for (const [index, candidate] of array.values.entries()) {
    if (!VFX_TAGS.has(candidate as BipedPetMotionVfxTag)) {
      diagnostics.push(diagnostic(`root-motion-vfx-tag-${index}-invalid`, `Root Motion 特效标签 ${index} 不受支持，已丢弃。`))
      continue
    }
    tags.add(candidate as BipedPetMotionVfxTag)
  }
  return { value: [...tags].sort(compareCodePoints), invalidContainer: false }
}

/**
 * 把动作扩展中的未知输入复制为有界 Root Motion 定义。缺失扩展是正常旧版本路径，不产生诊断。
 */
export function normalizeBipedPetRootMotion(input: unknown, durationMs: number): BipedPetRootMotionNormalizationResult {
  const diagnostics: RootMotionDiagnostic[] = []
  const safeDurationMs = typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : FALLBACK_DURATION_MS
  if (safeDurationMs !== durationMs) {
    diagnostics.push(diagnostic('root-motion-duration-invalid', `Root Motion 动作时长必须是正有限数，已回退为 ${FALLBACK_DURATION_MS}ms。`))
  }

  const source = safeRecord(input)
  if (!source) {
    if (input !== undefined) diagnostics.push(diagnostic('root-motion-input-invalid', 'Root Motion 扩展不是对象，已使用原地回退。'))
    return { value: inPlaceRootMotion(), diagnostics }
  }

  const modeProperty = readProperty(source, 'mode', diagnostics)
  const verticalModeProperty = readProperty(source, 'verticalMode', diagnostics)
  const mode = modeProperty.value === undefined ? 'in-place' : modeProperty.value
  const verticalMode = verticalModeProperty.value === undefined ? 'grounded' : verticalModeProperty.value
  let invalidCore = !modeProperty.ok || !verticalModeProperty.ok
  if (mode !== 'in-place' && mode !== 'travel') {
    diagnostics.push(diagnostic('root-motion-mode-invalid', 'Root Motion 的 mode 无效，已使用原地回退。'))
    invalidCore = true
  }
  if (verticalMode !== 'grounded' && verticalMode !== 'ballistic') {
    diagnostics.push(diagnostic('root-motion-vertical-mode-invalid', 'Root Motion 的 verticalMode 无效，已使用 grounded 回退。'))
    invalidCore = true
  }

  const distance = normalizeFiniteField(source, 'distance', -MAX_DISTANCE, MAX_DISTANCE, diagnostics)
  const turnRadians = normalizeFiniteField(source, 'turnRadians', -MAX_TURN_RADIANS, MAX_TURN_RADIANS, diagnostics)
  const jumpHeight = normalizeFiniteField(source, 'jumpHeight', 0, MAX_JUMP_HEIGHT, diagnostics)
  invalidCore ||= distance.invalid || turnRadians.invalid || jumpHeight.invalid
  const windows = normalizeWindows(source, safeDurationMs, diagnostics)
  const vfxTags = normalizeVfxTags(source, diagnostics)
  invalidCore ||= windows.invalidContainer || vfxTags.invalidContainer

  const safeMode: BipedPetRootMotionMode = mode === 'travel' && !invalidCore ? 'travel' : 'in-place'
  return {
    value: {
      mode: safeMode,
      distance: safeMode === 'travel' ? distance.value : 0,
      turnRadians: safeMode === 'travel' ? turnRadians.value : 0,
      verticalMode: verticalMode === 'ballistic' ? 'ballistic' : 'grounded',
      jumpHeight: safeMode === 'travel' ? jumpHeight.value : 0,
      windows: windows.value,
      vfxTags: vfxTags.value,
    },
    diagnostics,
  }
}

type RootMotionVector3 = readonly [number, number, number]
type RootMotionPhase = SampledBipedPetRootMotion['phase']

interface SafeSampleInput {
  definition: BipedPetRootMotionDefinition
  requestedTimeMs: number
  previousRequestedTimeMs?: number
  durationMs: number
  loopMode: StudioMotionLoopMode
  characterHeight: number
  facingRadians: number
  actionWeight: number
  footResidual: RootMotionVector3
}

interface SafeSampleParseResult {
  identity: ResolvedMotionTime
  value?: SafeSampleInput
}

interface RootMotionTarget {
  local: RootMotionVector3
  world: RootMotionVector3
  turnRadians: number
  phase: RootMotionPhase
}

const MAX_ROOT_MOTION_DELTA_RATIO = .25
const MAX_ROOT_MOTION_TURN_DELTA = Math.PI / 4
const MAX_ROOT_MOTION_FOOT_RESIDUAL_RATIO_PER_SECOND = .02
const ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND = .25
const MAX_ROOT_MOTION_CONTINUOUS_DELTA_MS = 250
const ROOT_MOTION_TAKEOFF_END = .25
const ROOT_MOTION_LANDING_START = .75
const ROOT_MOTION_SIGNAL_EPSILON = 1e-12

function canonicalZero(value: number): number {
  return value === 0 ? 0 : value
}

function frozenVector3(x: number, y: number, z: number): RootMotionVector3 {
  return Object.freeze([canonicalZero(x), canonicalZero(y), canonicalZero(z)]) as RootMotionVector3
}

function zeroVector3(): RootMotionVector3 {
  return frozenVector3(0, 0, 0)
}

function frozenSample(sample: SampledBipedPetRootMotion): SampledBipedPetRootMotion {
  return Object.freeze(sample)
}

function blockedRootMotionSample(identity: ResolvedMotionTime): SampledBipedPetRootMotion {
  return frozenSample({
    status: 'blocked',
    requestedTimeMs: Number.isFinite(identity.requestedTimeMs) ? identity.requestedTimeMs : 0,
    resolvedTimeMs: Number.isFinite(identity.resolvedTimeMs) ? identity.resolvedTimeMs : 0,
    iteration: Number.isFinite(identity.iteration) ? identity.iteration : 0,
    cumulativeLocal: zeroVector3(),
    cumulativeWorld: zeroVector3(),
    deltaLocal: zeroVector3(),
    deltaWorld: zeroVector3(),
    cumulativeTurnRadians: 0,
    deltaTurnRadians: 0,
    linearVelocity: zeroVector3(),
    angularVelocity: 0,
    phase: 'grounded',
    motionIntensity: 0,
    landingImpulse: 0,
    brakeIntensity: 0,
  })
}

function stationaryRootMotionSample(
  status: 'solved' | 'reset',
  resolved: ResolvedMotionTime,
  target: RootMotionTarget,
): SampledBipedPetRootMotion {
  return frozenSample({
    status,
    requestedTimeMs: resolved.requestedTimeMs,
    resolvedTimeMs: resolved.resolvedTimeMs,
    iteration: resolved.iteration,
    cumulativeLocal: target.local,
    cumulativeWorld: target.world,
    deltaLocal: zeroVector3(),
    deltaWorld: zeroVector3(),
    cumulativeTurnRadians: target.turnRadians,
    deltaTurnRadians: 0,
    linearVelocity: zeroVector3(),
    angularVelocity: 0,
    phase: target.phase,
    motionIntensity: 0,
    landingImpulse: 0,
    brakeIntensity: 0,
  })
}

function isSupportedLoopMode(value: unknown): value is StudioMotionLoopMode {
  return value === 'once' || value === 'loop' || value === 'ping-pong'
}

function copyFiniteVector3(value: unknown): RootMotionVector3 | undefined {
  try {
    if (!Array.isArray(value) || Reflect.get(value, 'length') !== 3) return undefined
    const x = Reflect.get(value, 0)
    const y = Reflect.get(value, 1)
    const z = Reflect.get(value, 2)
    return typeof x === 'number' && Number.isFinite(x)
      && typeof y === 'number' && Number.isFinite(y)
      && typeof z === 'number' && Number.isFinite(z)
      ? frozenVector3(x, y, z)
      : undefined
  }
  catch {
    return undefined
  }
}

function copySafeDefinition(value: unknown, durationMs: number): BipedPetRootMotionDefinition | undefined {
  try {
    const source = safeRecord(value)
    if (!source) return undefined
    const mode = Reflect.get(source, 'mode')
    const distance = Reflect.get(source, 'distance')
    const turnRadians = Reflect.get(source, 'turnRadians')
    const verticalMode = Reflect.get(source, 'verticalMode')
    const jumpHeight = Reflect.get(source, 'jumpHeight')
    const rawWindows = Reflect.get(source, 'windows')
    const rawVfxTags = Reflect.get(source, 'vfxTags')
    if ((mode !== 'in-place' && mode !== 'travel')
      || (verticalMode !== 'grounded' && verticalMode !== 'ballistic')
      || typeof distance !== 'number' || !Number.isFinite(distance) || distance < -MAX_DISTANCE || distance > MAX_DISTANCE
      || typeof turnRadians !== 'number' || !Number.isFinite(turnRadians) || turnRadians < -MAX_TURN_RADIANS || turnRadians > MAX_TURN_RADIANS
      || typeof jumpHeight !== 'number' || !Number.isFinite(jumpHeight) || jumpHeight < 0 || jumpHeight > MAX_JUMP_HEIGHT
      || !Array.isArray(rawWindows) || !Array.isArray(rawVfxTags)) return undefined

    const windowCount = Reflect.get(rawWindows, 'length')
    const tagCount = Reflect.get(rawVfxTags, 'length')
    if (!Number.isSafeInteger(windowCount) || windowCount < 0 || windowCount > MAX_BIPED_PET_ROOT_MOTION_WINDOWS
      || !Number.isSafeInteger(tagCount) || tagCount < 0 || tagCount > MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS) return undefined

    const windows: BipedPetRootMotionWindow[] = []
    for (let index = 0; index < windowCount; index += 1) {
      const windowSource = safeRecord(Reflect.get(rawWindows, index))
      if (!windowSource) return undefined
      const id = Reflect.get(windowSource, 'id')
      const kind = Reflect.get(windowSource, 'kind')
      const startMs = Reflect.get(windowSource, 'startMs')
      const endMs = Reflect.get(windowSource, 'endMs')
      const weight = Reflect.get(windowSource, 'weight')
      if (typeof id !== 'string' || !id.trim()
        || !WINDOW_KINDS.has(kind as BipedPetRootMotionWindowKind)
        || typeof startMs !== 'number' || !Number.isFinite(startMs) || startMs < 0
        || typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs > durationMs || endMs <= startMs
        || typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > MAX_WINDOW_WEIGHT) return undefined
      windows.push(Object.freeze({ id, kind: kind as BipedPetRootMotionWindowKind, startMs, endMs, weight }))
    }

    const vfxTags: BipedPetMotionVfxTag[] = []
    for (let index = 0; index < tagCount; index += 1) {
      const tag = Reflect.get(rawVfxTags, index)
      if (!VFX_TAGS.has(tag as BipedPetMotionVfxTag)) return undefined
      vfxTags.push(tag as BipedPetMotionVfxTag)
    }
    return Object.freeze({
      mode,
      distance,
      turnRadians,
      verticalMode,
      jumpHeight,
      windows: Object.freeze(windows),
      vfxTags: Object.freeze(vfxTags),
    })
  }
  catch {
    return undefined
  }
}

function parseSampleInput(input: unknown): SafeSampleParseResult {
  let identity: ResolvedMotionTime = { requestedTimeMs: 0, resolvedTimeMs: 0, direction: 1, iteration: 0 }
  try {
    const source = safeRecord(input)
    if (!source) return { identity }
    const requestedTimeMs = Reflect.get(source, 'requestedTimeMs')
    const previousRequestedTimeMs = Reflect.get(source, 'previousRequestedTimeMs')
    const rawDurationMs = Reflect.get(source, 'durationMs')
    const loopMode = Reflect.get(source, 'loopMode')
    if (typeof requestedTimeMs === 'number' && Number.isFinite(requestedTimeMs)
      && typeof rawDurationMs === 'number' && Number.isFinite(rawDurationMs) && rawDurationMs > 0
      && isSupportedLoopMode(loopMode)) {
      identity = resolveMotionTime(requestedTimeMs, rawDurationMs, loopMode)
    }
    if (typeof requestedTimeMs !== 'number' || !Number.isFinite(requestedTimeMs)
      || (previousRequestedTimeMs !== undefined && (typeof previousRequestedTimeMs !== 'number' || !Number.isFinite(previousRequestedTimeMs)))
      || typeof rawDurationMs !== 'number' || !Number.isFinite(rawDurationMs) || rawDurationMs <= 0
      || !isSupportedLoopMode(loopMode)) return { identity }

    const durationMs = normalizeMotionDurationMs(rawDurationMs)
    const definition = copySafeDefinition(Reflect.get(source, 'definition'), durationMs)
    const characterHeight = Reflect.get(source, 'characterHeight')
    const facingRadians = Reflect.get(source, 'facingRadians')
    const actionWeight = Reflect.get(source, 'actionWeight')
    const footResidual = copyFiniteVector3(Reflect.get(source, 'footResidual'))
    if (!definition || typeof characterHeight !== 'number' || !Number.isFinite(characterHeight) || characterHeight <= 0
      || typeof facingRadians !== 'number' || !Number.isFinite(facingRadians)
      || typeof actionWeight !== 'number' || !Number.isFinite(actionWeight)
      || !footResidual) return { identity }

    return {
      identity,
      value: {
        definition,
        requestedTimeMs,
        ...(previousRequestedTimeMs === undefined ? {} : { previousRequestedTimeMs }),
        durationMs,
        loopMode,
        characterHeight,
        facingRadians,
        actionWeight: clamp(actionWeight, 0, 1),
        footResidual,
      },
    }
  }
  catch {
    return { identity }
  }
}

function smoothstep(progress: number): number {
  const bounded = clamp(progress, 0, 1)
  return bounded * bounded * (3 - 2 * bounded)
}

function windowProgress(window: BipedPetRootMotionWindow, timeMs: number): number {
  return smoothstep((timeMs - window.startMs) / (window.endMs - window.startMs))
}

function weightedWindowProgress(
  windows: readonly BipedPetRootMotionWindow[],
  timeMs: number,
  kinds: ReadonlySet<BipedPetRootMotionWindowKind>,
): number {
  let maximumWeight = 0
  for (const window of windows) {
    if (kinds.has(window.kind)) maximumWeight = Math.max(maximumWeight, window.weight)
  }
  if (maximumWeight === 0) return 0
  let weightedProgress = 0
  let totalWeight = 0
  for (const window of windows) {
    if (!kinds.has(window.kind)) continue
    const scaledWeight = window.weight / maximumWeight
    weightedProgress += scaledWeight * windowProgress(window, timeMs)
    totalWeight += scaledWeight
  }
  return totalWeight > 0 ? weightedProgress / totalWeight : 0
}

function ballisticHeightAndPhase(
  definition: BipedPetRootMotionDefinition,
  timeMs: number,
  characterHeight: number,
  actionWeight: number,
  direction: 1 | -1,
): { height: number; phase: RootMotionPhase } {
  if (definition.mode !== 'travel' || definition.verticalMode !== 'ballistic'
    || definition.jumpHeight <= 0 || actionWeight <= 0) return { height: 0, phase: 'grounded' }

  let weightedHeight = 0
  let totalWeight = 0
  let activeProgress = 0
  let activeWeight = 0
  let maximumWeight = 0
  for (const window of definition.windows) {
    if (window.kind === 'ballistic') maximumWeight = Math.max(maximumWeight, window.weight)
  }
  if (maximumWeight === 0) return { height: 0, phase: 'grounded' }
  for (const window of definition.windows) {
    if (window.kind !== 'ballistic') continue
    const scaledWeight = window.weight / maximumWeight
    const linearProgress = clamp((timeMs - window.startMs) / (window.endMs - window.startMs), 0, 1)
    const shapedProgress = smoothstep(linearProgress)
    const height = 4 * definition.jumpHeight * characterHeight * shapedProgress * (1 - shapedProgress)
    weightedHeight += scaledWeight * height
    totalWeight += scaledWeight
    if (timeMs >= window.startMs && timeMs <= window.endMs) {
      const physicalProgress = direction === 1 ? linearProgress : 1 - linearProgress
      activeProgress += scaledWeight * physicalProgress
      activeWeight += scaledWeight
    }
  }
  const height = totalWeight > 0 ? weightedHeight / totalWeight * actionWeight : 0
  if (activeWeight <= 0) return { height, phase: 'grounded' }
  const progress = activeProgress / activeWeight
  return {
    height,
    phase: progress < ROOT_MOTION_TAKEOFF_END
      ? 'takeoff'
      : progress < ROOT_MOTION_LANDING_START ? 'airborne' : 'landing',
  }
}

const HORIZONTAL_WINDOW_KINDS = new Set<BipedPetRootMotionWindowKind>(['travel', 'warp'])

function evaluateRootMotionTarget(input: SafeSampleInput, resolved: ResolvedMotionTime): RootMotionTarget | undefined {
  const movementProgress = weightedWindowProgress(input.definition.windows, resolved.resolvedTimeMs, HORIZONTAL_WINDOW_KINDS)
  const hasHorizontalWindow = input.definition.windows.some(window => HORIZONTAL_WINDOW_KINDS.has(window.kind))
  // loop 的完整周期直接进入绝对目标，接缝处 iteration + progress 连续；ping-pong 则明确往返同一路径。 / Loop adds completed iterations to the absolute target for continuous seams, while ping-pong explicitly retraces the same path.
  const completedMotion = hasHorizontalWindow
    ? input.loopMode === 'loop' ? resolved.iteration + movementProgress : movementProgress
    : 0
  const horizontal = canonicalZero(input.definition.mode === 'travel'
    ? input.definition.distance * input.characterHeight * completedMotion * input.actionWeight
    : 0)
  const turnRadians = canonicalZero(input.definition.mode === 'travel'
    ? input.definition.turnRadians * completedMotion * input.actionWeight
    : 0)
  const ballistic = ballisticHeightAndPhase(
    input.definition,
    resolved.resolvedTimeMs,
    input.characterHeight,
    input.actionWeight,
    resolved.direction,
  )
  const local = frozenVector3(horizontal, ballistic.height, 0)
  const world = rotateLocalVector(local, input.facingRadians)
  return [horizontal, ballistic.height, turnRadians, ...world].every(Number.isFinite)
    ? { local, world, turnRadians, phase: ballistic.phase }
    : undefined
}

function clampVectorLength(vector: RootMotionVector3, maximumLength: number): { value: RootMotionVector3; clamped: boolean } | undefined {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!Number.isFinite(length) || !Number.isFinite(maximumLength) || maximumLength < 0) return undefined
  if (length <= maximumLength || length === 0) return { value: frozenVector3(...vector), clamped: false }
  const scale = maximumLength / length
  return { value: frozenVector3(vector[0] * scale, vector[1] * scale, vector[2] * scale), clamped: true }
}

function rotateLocalVector(vector: RootMotionVector3, facingRadians: number): RootMotionVector3 {
  // 遵循 Three.js 右手坐标约定：正 Y 转向把局部 +X 旋至世界 -Z。 / Match the Three.js right-handed convention: a positive Y rotation maps local +X to world -Z.
  const cosine = Math.cos(facingRadians)
  const sine = Math.sin(facingRadians)
  return frozenVector3(
    vector[0] * cosine + vector[2] * sine,
    vector[1],
    -vector[0] * sine + vector[2] * cosine,
  )
}

function stableSignal(value: number): number {
  const bounded = clamp(value, 0, 1)
  return bounded <= ROOT_MOTION_SIGNAL_EPSILON ? 0 : bounded
}

function brakeWindowIntensity(windows: readonly BipedPetRootMotionWindow[], timeMs: number): number {
  let maximumWeight = 0
  for (const window of windows) {
    if (window.kind === 'brake') maximumWeight = Math.max(maximumWeight, window.weight)
  }
  if (maximumWeight === 0) return 0
  let weightedIntensity = 0
  let totalWeight = 0
  for (const window of windows) {
    if (window.kind !== 'brake') continue
    const scaledWeight = window.weight / maximumWeight
    totalWeight += scaledWeight
    if (timeMs <= window.startMs || timeMs >= window.endMs) continue
    const shapedProgress = windowProgress(window, timeMs)
    weightedIntensity += scaledWeight * 4 * shapedProgress * (1 - shapedProgress)
  }
  return totalWeight > 0 ? weightedIntensity / totalWeight : 0
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function landingImpulseForCrossing(input: SafeSampleInput, previousTimeMs: number, currentTimeMs: number): number {
  if (input.definition.mode !== 'travel' || input.definition.verticalMode !== 'ballistic'
    || input.definition.jumpHeight <= 0 || input.actionWeight <= 0 || currentTimeMs <= previousTimeMs) return 0

  let impulse = 0
  const considerWindowBoundary = (window: BipedPetRootMotionWindow, boundaryTimeMs: number, progress: number) => {
    if (!(boundaryTimeMs > previousTimeMs && boundaryTimeMs <= currentTimeMs)) return
    const windowSeconds = (window.endMs - window.startMs) / 1000
    const normalizedDownwardSpeed = input.definition.jumpHeight * Math.abs(1 - 2 * progress) / windowSeconds
    impulse = Math.max(impulse, stableSignal(normalizedDownwardSpeed * input.actionWeight))
  }

  for (const window of input.definition.windows) {
    if (window.kind !== 'ballistic') continue
    if (input.loopMode === 'once') {
      considerWindowBoundary(window, window.endMs, 1)
      continue
    }

    // 连续阈值最多只允许跨过一个周期；只枚举端点所在周期，避免用请求时间大小决定工作量。 / The continuity limit crosses at most one cycle, so inspect only endpoint cycles and keep work independent of absolute request time.
    const firstIteration = Math.floor(previousTimeMs / input.durationMs)
    const lastIteration = Math.floor(currentTimeMs / input.durationMs)
    const iterations = firstIteration === lastIteration ? [firstIteration] : [firstIteration, lastIteration]
    for (const iteration of iterations) {
      const segmentStartMs = iteration * input.durationMs
      const reverse = input.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
      const touchdownTimeMs = reverse
        ? segmentStartMs + input.durationMs - window.startMs
        : segmentStartMs + window.endMs
      considerWindowBoundary(window, touchdownTimeMs, 1)
    }
  }
  return impulse
}

/**
 * 从绝对动作时间直接求累计 Root Motion；只有增量、速度和瞬时信号依赖前一请求时间。
 * 首帧、倒退或超过 min(250ms, duration×0.25) 的非连续跳跃会 reset，避免回拖生成反向速度。
 */
export function sampleBipedPetRootMotion(input: SampleBipedPetRootMotionInput): SampledBipedPetRootMotion {
  const parsed = parseSampleInput(input)
  if (!parsed.value) return blockedRootMotionSample(parsed.identity)
  const safeInput = parsed.value
  const currentResolved = resolveMotionTime(safeInput.requestedTimeMs, safeInput.durationMs, safeInput.loopMode)
  const currentTarget = evaluateRootMotionTarget(safeInput, currentResolved)
  if (!currentTarget) return blockedRootMotionSample(currentResolved)

  const previousTimeMs = safeInput.previousRequestedTimeMs
  const elapsedMs = previousTimeMs === undefined ? Number.NaN : safeInput.requestedTimeMs - previousTimeMs
  const continuityLimitMs = Math.min(MAX_ROOT_MOTION_CONTINUOUS_DELTA_MS, safeInput.durationMs * .25)
  const reset = previousTimeMs === undefined || elapsedMs < 0 || elapsedMs > continuityLimitMs
  if (reset) return stationaryRootMotionSample('reset', currentResolved, currentTarget)

  const previousResolved = resolveMotionTime(previousTimeMs, safeInput.durationMs, safeInput.loopMode)
  const previousTarget = evaluateRootMotionTarget(safeInput, previousResolved)
  if (!previousTarget) return blockedRootMotionSample(currentResolved)
  if (elapsedMs === 0) return stationaryRootMotionSample('solved', currentResolved, currentTarget)

  const elapsedSeconds = elapsedMs / 1000
  const residualCorrection = clampVectorLength(
    frozenVector3(
      safeInput.footResidual[0] * ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND * elapsedSeconds * safeInput.actionWeight,
      safeInput.footResidual[1] * ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND * elapsedSeconds * safeInput.actionWeight,
      safeInput.footResidual[2] * ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND * elapsedSeconds * safeInput.actionWeight,
    ),
    safeInput.characterHeight * MAX_ROOT_MOTION_FOOT_RESIDUAL_RATIO_PER_SECOND * elapsedSeconds,
  )
  if (!residualCorrection) return blockedRootMotionSample(currentResolved)
  const rawDeltaLocal = frozenVector3(
    currentTarget.local[0] - previousTarget.local[0] + residualCorrection.value[0],
    currentTarget.local[1] - previousTarget.local[1] + residualCorrection.value[1],
    currentTarget.local[2] - previousTarget.local[2] + residualCorrection.value[2],
  )
  const boundedDelta = clampVectorLength(rawDeltaLocal, safeInput.characterHeight * MAX_ROOT_MOTION_DELTA_RATIO)
  if (!boundedDelta) return blockedRootMotionSample(currentResolved)
  const rawDeltaTurn = currentTarget.turnRadians - previousTarget.turnRadians
  if (!Number.isFinite(rawDeltaTurn)) return blockedRootMotionSample(currentResolved)
  const deltaTurnRadians = canonicalZero(clamp(rawDeltaTurn, -MAX_ROOT_MOTION_TURN_DELTA, MAX_ROOT_MOTION_TURN_DELTA))
  const turnClamped = deltaTurnRadians !== rawDeltaTurn
  const deltaWorld = rotateLocalVector(boundedDelta.value, safeInput.facingRadians)
  const linearVelocity = frozenVector3(
    deltaWorld[0] / elapsedSeconds,
    deltaWorld[1] / elapsedSeconds,
    deltaWorld[2] / elapsedSeconds,
  )
  const angularVelocity = canonicalZero(deltaTurnRadians / elapsedSeconds)
  if (![...rawDeltaLocal, ...deltaWorld, ...linearVelocity, angularVelocity].every(Number.isFinite)) {
    return blockedRootMotionSample(currentResolved)
  }

  const motionIntensity = stableSignal(Math.max(
    Math.hypot(...linearVelocity) / (safeInput.characterHeight * 4),
    Math.abs(angularVelocity) / (Math.PI * 2),
  ))
  const brakeIntensity = stableSignal(
    brakeWindowIntensity(safeInput.definition.windows, currentResolved.resolvedTimeMs) * safeInput.actionWeight,
  )
  const landingImpulse = landingImpulseForCrossing(safeInput, previousTimeMs, safeInput.requestedTimeMs)
  return frozenSample({
    status: boundedDelta.clamped || turnClamped ? 'clamped' : 'solved',
    requestedTimeMs: currentResolved.requestedTimeMs,
    resolvedTimeMs: currentResolved.resolvedTimeMs,
    iteration: currentResolved.iteration,
    cumulativeLocal: currentTarget.local,
    cumulativeWorld: currentTarget.world,
    deltaLocal: boundedDelta.value,
    deltaWorld,
    cumulativeTurnRadians: currentTarget.turnRadians,
    deltaTurnRadians,
    linearVelocity,
    angularVelocity,
    phase: currentTarget.phase,
    motionIntensity,
    landingImpulse,
    brakeIntensity,
  })
}
