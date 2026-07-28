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

/**
 * 由采样器签发、调用方逐帧原样回传的最小落地授权。
 * 令牌只冻结一次合法 target touchdown 的绝对请求时间与强度，不持有任何可变引用。
 */
export interface BipedPetLandingAuthorization {
  readonly touchdownRequestedTimeMs: number
  readonly impulse: number
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
  /** 调用方上一帧实际写入容器的世界状态；与 previousAppliedTurnRadians 成对提供。 */
  readonly previousAppliedWorld?: readonly [number, number, number]
  readonly previousAppliedTurnRadians?: number
  /** 上一帧采样器返回且尚未消费的落地授权；reset 时调用方与采样器都必须清除。 */
  readonly previousLandingAuthorization?: BipedPetLandingAuthorization
  /** 局部水平接触残差；有限 X/Z 正值推动根节点沿同轴正向修正，Y 完全忽略。 */
  readonly footResidual: readonly [number, number, number]
}

export interface SampledBipedPetRootMotion {
  readonly status: 'solved' | 'clamped' | 'reset' | 'blocked'
  readonly requestedTimeMs: number
  readonly resolvedTimeMs: number
  readonly iteration: number
  readonly cumulativeLocal: readonly [number, number, number]
  readonly cumulativeWorld: readonly [number, number, number]
  readonly appliedLocal: readonly [number, number, number]
  readonly appliedWorld: readonly [number, number, number]
  readonly deltaLocal: readonly [number, number, number]
  readonly deltaWorld: readonly [number, number, number]
  readonly cumulativeTurnRadians: number
  readonly appliedTurnRadians: number
  readonly deltaTurnRadians: number
  readonly linearVelocity: readonly [number, number, number]
  readonly angularVelocity: number
  /** 实际 applied 高度与本帧实际垂直差值决定的运行时相位，不是 target 时间相位。 */
  readonly phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  readonly motionIntensity: number
  /** 仅在合法 target touchdown 已发生且 applied 本帧真实穿入 grounded 时输出一次。 */
  readonly landingImpulse: number
  /** 尚未被真实 applied touchdown 消费的授权；调用方负责在下一连续帧原样回传。 */
  readonly landingAuthorization?: BipedPetLandingAuthorization
  readonly brakeIntensity: number
}

export const MAX_BIPED_PET_ROOT_MOTION_WINDOWS = 64
export const MAX_BIPED_PET_MOTION_VFX_TAG_INPUTS = 16

type RootMotionDiagnostic = BipedPetRootMotionNormalizationResult['diagnostics'][number]
type SafeProperty = { ok: true; value: unknown } | { ok: false; value: undefined }

const MAX_DISTANCE = 4
const MAX_TURN_RADIANS = Math.PI * 2
const MAX_JUMP_HEIGHT = 1.5
const MAX_WINDOW_WEIGHT = 1
const WINDOW_KINDS = new Set<BipedPetRootMotionWindowKind>(['travel', 'warp', 'ballistic', 'brake'])
const VFX_TAGS = new Set<BipedPetMotionVfxTag>(['landing-ring', 'landing-dust', 'speed-trail', 'brake-sparks'])
const canonicalRootMotionDurations = new WeakMap<object, number>()

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

function canonicalRootMotionDefinition(
  value: BipedPetRootMotionDefinition,
  durationMs: number,
): BipedPetRootMotionDefinition {
  if (canonicalRootMotionDurations.get(value) === durationMs) return value
  const rootMotion = Object.freeze({
    ...value,
    windows: Object.freeze(value.windows.map(window => Object.freeze({ ...window }))),
    vfxTags: Object.freeze([...value.vfxTags]),
  })
  canonicalRootMotionDurations.set(rootMotion, durationMs)
  return rootMotion
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
  const safeDurationMs = normalizeMotionDurationMs(durationMs)
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    diagnostics.push(diagnostic('root-motion-duration-invalid', `Root Motion 动作时长必须是有限数，已回退为 ${safeDurationMs}ms。`))
  }
  else if (!Object.is(safeDurationMs, durationMs)) {
    diagnostics.push(diagnostic('root-motion-duration-normalized', `Root Motion 动作时长已规范为 ${safeDurationMs}ms。`))
  }

  const source = safeRecord(input)
  if (!source) {
    if (input !== undefined) diagnostics.push(diagnostic('root-motion-input-invalid', 'Root Motion 扩展不是对象，已使用原地回退。'))
    return { value: canonicalRootMotionDefinition(inPlaceRootMotion(), safeDurationMs), diagnostics }
  }
  const trustedDurationMs = canonicalRootMotionDurations.get(source)
  if (Object.is(trustedDurationMs, safeDurationMs)) {
    return { value: source as unknown as BipedPetRootMotionDefinition, diagnostics }
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
    value: canonicalRootMotionDefinition({
      mode: safeMode,
      distance: safeMode === 'travel' ? distance.value : 0,
      turnRadians: safeMode === 'travel' ? turnRadians.value : 0,
      verticalMode: verticalMode === 'ballistic' ? 'ballistic' : 'grounded',
      jumpHeight: safeMode === 'travel' ? jumpHeight.value : 0,
      windows: windows.value,
      vfxTags: vfxTags.value,
    }, safeDurationMs),
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
  previousAppliedWorld?: RootMotionVector3
  previousAppliedTurnRadians?: number
  previousLandingAuthorization?: BipedPetLandingAuthorization
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
}

interface RootMotionAppliedState {
  local: RootMotionVector3
  world: RootMotionVector3
  turnRadians: number
}

const MAX_ROOT_MOTION_DELTA_RATIO = .25
const MAX_ROOT_MOTION_TURN_DELTA = Math.PI / 4
const MAX_ROOT_MOTION_FOOT_RESIDUAL_RATIO_PER_SECOND = .02
const ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND = .25
const ROOT_MOTION_CONTINUITY_BASE_MS = 250
const ROOT_MOTION_CONTINUITY_DURATION_RATIO = .5
const MAX_ROOT_MOTION_CONTINUITY_SEGMENTS = 4
const ROOT_MOTION_SIGNAL_EPSILON = 1e-12
const MAX_ROOT_MOTION_AIRBORNE_SEARCH_NODES = 512

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
    appliedLocal: zeroVector3(),
    appliedWorld: zeroVector3(),
    deltaLocal: zeroVector3(),
    deltaWorld: zeroVector3(),
    cumulativeTurnRadians: 0,
    appliedTurnRadians: 0,
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
  applied: RootMotionAppliedState,
  characterHeight: number,
  landingAuthorization?: BipedPetLandingAuthorization,
): SampledBipedPetRootMotion {
  return frozenSample({
    status,
    requestedTimeMs: resolved.requestedTimeMs,
    resolvedTimeMs: resolved.resolvedTimeMs,
    iteration: resolved.iteration,
    cumulativeLocal: target.local,
    cumulativeWorld: target.world,
    appliedLocal: applied.local,
    appliedWorld: applied.world,
    deltaLocal: zeroVector3(),
    deltaWorld: zeroVector3(),
    cumulativeTurnRadians: target.turnRadians,
    appliedTurnRadians: applied.turnRadians,
    deltaTurnRadians: 0,
    linearVelocity: zeroVector3(),
    angularVelocity: 0,
    phase: appliedPhase(applied.world, zeroVector3(), characterHeight),
    motionIntensity: 0,
    landingImpulse: 0,
    ...(landingAuthorization === undefined ? {} : { landingAuthorization }),
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

function copyFiniteHorizontalResidual(value: unknown): RootMotionVector3 | undefined {
  try {
    if (!Array.isArray(value) || Reflect.get(value, 'length') !== 3) return undefined
    const x = Reflect.get(value, 0)
    const z = Reflect.get(value, 2)
    return typeof x === 'number' && Number.isFinite(x)
      && typeof z === 'number' && Number.isFinite(z)
      ? frozenVector3(x, 0, z)
      : undefined
  }
  catch {
    return undefined
  }
}

function copyLandingAuthorization(value: unknown): BipedPetLandingAuthorization | undefined {
  try {
    const source = safeRecord(value)
    if (!source) return undefined
    const touchdownRequestedTimeMs = Reflect.get(source, 'touchdownRequestedTimeMs')
    const impulse = Reflect.get(source, 'impulse')
    return typeof touchdownRequestedTimeMs === 'number'
      && Number.isFinite(touchdownRequestedTimeMs)
      && touchdownRequestedTimeMs >= 0
      && typeof impulse === 'number'
      && Number.isFinite(impulse)
      && impulse > 0
      && impulse <= 1
      ? Object.freeze({ touchdownRequestedTimeMs, impulse })
      : undefined
  }
  catch {
    return undefined
  }
}

function copySafeDefinition(value: unknown, durationMs: number): BipedPetRootMotionDefinition | undefined {
  try {
    if (value !== null && typeof value === 'object' && Object.is(canonicalRootMotionDurations.get(value), durationMs)) {
      return value as BipedPetRootMotionDefinition
    }
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
    const durationMs = normalizeMotionDurationMs(rawDurationMs)
    if (typeof requestedTimeMs === 'number' && Number.isFinite(requestedTimeMs)
      && isSupportedLoopMode(loopMode)) {
      identity = resolveMotionTime(requestedTimeMs, durationMs, loopMode)
    }
    if (typeof requestedTimeMs !== 'number' || !Number.isFinite(requestedTimeMs)
      || (previousRequestedTimeMs !== undefined && (typeof previousRequestedTimeMs !== 'number' || !Number.isFinite(previousRequestedTimeMs)))
      || !isSupportedLoopMode(loopMode)) return { identity }

    const definition = copySafeDefinition(Reflect.get(source, 'definition'), durationMs)
    const characterHeight = Reflect.get(source, 'characterHeight')
    const facingRadians = Reflect.get(source, 'facingRadians')
    const actionWeight = Reflect.get(source, 'actionWeight')
    const rawPreviousAppliedWorld = Reflect.get(source, 'previousAppliedWorld')
    const previousAppliedTurnRadians = Reflect.get(source, 'previousAppliedTurnRadians')
    const rawPreviousLandingAuthorization = Reflect.get(source, 'previousLandingAuthorization')
    const previousAppliedWorld = rawPreviousAppliedWorld === undefined
      ? undefined
      : copyFiniteVector3(rawPreviousAppliedWorld)
    const previousLandingAuthorization = rawPreviousLandingAuthorization === undefined
      ? undefined
      : copyLandingAuthorization(rawPreviousLandingAuthorization)
    const footResidual = copyFiniteHorizontalResidual(Reflect.get(source, 'footResidual'))
    const hasPreviousAppliedWorld = rawPreviousAppliedWorld !== undefined
    const hasPreviousAppliedTurn = previousAppliedTurnRadians !== undefined
    if (!definition || typeof characterHeight !== 'number' || !Number.isFinite(characterHeight) || characterHeight <= 0
      || typeof facingRadians !== 'number' || !Number.isFinite(facingRadians)
      || typeof actionWeight !== 'number' || !Number.isFinite(actionWeight)
      || hasPreviousAppliedWorld !== hasPreviousAppliedTurn
      || (hasPreviousAppliedWorld && !previousAppliedWorld)
      || (hasPreviousAppliedTurn && (typeof previousAppliedTurnRadians !== 'number' || !Number.isFinite(previousAppliedTurnRadians)))
      || (rawPreviousLandingAuthorization !== undefined && !previousLandingAuthorization)
      || (previousLandingAuthorization !== undefined && previousRequestedTimeMs !== undefined
        && previousLandingAuthorization.touchdownRequestedTimeMs > previousRequestedTimeMs)
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
        ...(previousAppliedWorld === undefined ? {} : {
          previousAppliedWorld,
          previousAppliedTurnRadians: previousAppliedTurnRadians as number,
        }),
        ...(previousLandingAuthorization === undefined ? {} : { previousLandingAuthorization }),
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

interface BallisticTouchdownCandidate {
  readonly boundaryMs: number
  readonly weight: number
}

const effectiveBallisticWindowCache = new WeakMap<BipedPetRootMotionDefinition, readonly BipedPetRootMotionWindow[]>()
const ballisticTouchdownCandidateCache = new WeakMap<BipedPetRootMotionDefinition, {
  readonly forward: readonly BallisticTouchdownCandidate[]
  readonly reverse: readonly BallisticTouchdownCandidate[]
  readonly totalWeight: number
}>()

function effectiveBallisticWindows(definition: BipedPetRootMotionDefinition): readonly BipedPetRootMotionWindow[] {
  const cached = effectiveBallisticWindowCache.get(definition)
  if (cached) return cached
  let maximumWeight = 0
  for (const window of definition.windows) {
    if (window.kind === 'ballistic') maximumWeight = Math.max(maximumWeight, window.weight)
  }
  if (maximumWeight === 0) {
    const empty = Object.freeze([]) as readonly BipedPetRootMotionWindow[]
    effectiveBallisticWindowCache.set(definition, empty)
    return empty
  }
  // 与 grounded 稳定零阈值使用同一尺度，避免数值上已接地的极小尾窗延后并放大 touchdown。
  const windows = Object.freeze(definition.windows.filter(window => (
    window.kind === 'ballistic' && window.weight / maximumWeight > ROOT_MOTION_SIGNAL_EPSILON
  )))
  effectiveBallisticWindowCache.set(definition, windows)
  return windows
}

function normalizedCompositeBallisticHeight(
  windows: readonly BipedPetRootMotionWindow[],
  timeMs: number,
): number {
  let maximumWeight = 0
  for (const window of windows) maximumWeight = Math.max(maximumWeight, window.weight)
  if (maximumWeight === 0) return 0
  let weightedHeight = 0
  let totalWeight = 0
  for (const window of windows) {
    const scaledWeight = window.weight / maximumWeight
    const progress = smoothstep((timeMs - window.startMs) / (window.endMs - window.startMs))
    weightedHeight += scaledWeight * 4 * progress * (1 - progress)
    totalWeight += scaledWeight
  }
  return totalWeight > 0 ? weightedHeight / totalWeight : 0
}

function isCompositeTouchdownBoundary(
  windows: readonly BipedPetRootMotionWindow[],
  boundaryMs: number,
  direction: 1 | -1,
): boolean {
  // 精确相邻窗口按连续支撑处理；只有严格正 gap 才形成新的 touchdown。 / Exact adjacency stays continuous; only a positive gap creates a touchdown.
  const hasAdjacentContinuation = direction === 1
    ? windows.some(window => window.startMs === boundaryMs)
    : windows.some(window => window.endMs === boundaryMs)
  if (hasAdjacentContinuation) return false

  const endingContributors = windows.filter(window => (
    direction === 1 ? window.endMs === boundaryMs : window.startMs === boundaryMs
  ))
  const continuingWindows = windows.filter(window => window.startMs < boundaryMs && window.endMs > boundaryMs)
  // 同终点微型窗不得缩小长主窗的 before probe；任一真实结束贡献都可证明前侧仍在空中。 / Probe each ending contributor independently so a tiny peer cannot hide a real landing.
  const airborneBefore = endingContributors.some(window => {
    const physicalInsideEndMs = direction === 1 ? window.startMs : window.endMs
    const maximumProbeMs = Math.abs(boundaryMs - physicalInsideEndMs) * .5
    const preferredProbeMs = Math.min(1, (window.endMs - window.startMs) * .01, maximumProbeMs)
    let sampleTimeMs = boundaryMs - direction * preferredProbeMs
    if (!(sampleTimeMs > window.startMs && sampleTimeMs < window.endMs)) {
      sampleTimeMs = window.startMs + (window.endMs - window.startMs) * .5
    }
    return sampleTimeMs > window.startMs && sampleTimeMs < window.endMs
      && normalizedCompositeBallisticHeight(windows, sampleTimeMs) > ROOT_MOTION_SIGNAL_EPSILON
  })
  if (!airborneBefore) return false

  // after 侧逐窗取可表示的内部点；不跨过正 gap，也不让其他极短窗改变探针。 / Probe each continuing window at its own representable interior point without crossing a positive gap.
  const airborneAfter = continuingWindows.some(window => {
    const physicalEndMs = direction === 1 ? window.endMs : window.startMs
    const maximumProbeMs = Math.abs(physicalEndMs - boundaryMs) * .5
    const preferredProbeMs = Math.min(1, (window.endMs - window.startMs) * .01, maximumProbeMs)
    let sampleTimeMs = boundaryMs + direction * preferredProbeMs
    if (!(direction === 1 ? sampleTimeMs > boundaryMs && sampleTimeMs < physicalEndMs : sampleTimeMs < boundaryMs && sampleTimeMs > physicalEndMs)) {
      sampleTimeMs = boundaryMs + (physicalEndMs - boundaryMs) * .5
    }
    const isInterior = direction === 1
      ? sampleTimeMs > boundaryMs && sampleTimeMs < physicalEndMs
      : sampleTimeMs < boundaryMs && sampleTimeMs > physicalEndMs
    return isInterior && normalizedCompositeBallisticHeight(windows, sampleTimeMs) > ROOT_MOTION_SIGNAL_EPSILON
  })
  return !airborneAfter
}

function ballisticTouchdownCandidates(definition: BipedPetRootMotionDefinition): {
  readonly forward: readonly BallisticTouchdownCandidate[]
  readonly reverse: readonly BallisticTouchdownCandidate[]
  readonly totalWeight: number
} {
  const cached = ballisticTouchdownCandidateCache.get(definition)
  if (cached) return cached
  const windows = effectiveBallisticWindows(definition)
  const totalWeight = windows.reduce((sum, window) => sum + window.weight, 0)
  const forwardWeights = new Map<number, number>()
  const reverseWeights = new Map<number, number>()
  for (const window of windows) {
    forwardWeights.set(window.endMs, (forwardWeights.get(window.endMs) ?? 0) + window.weight)
    reverseWeights.set(window.startMs, (reverseWeights.get(window.startMs) ?? 0) + window.weight)
  }
  const candidates = (weights: ReadonlyMap<number, number>, direction: 1 | -1) => Object.freeze(
    [...weights]
      .map(([boundaryMs, weight]) => Object.freeze({ boundaryMs, weight }))
      .filter(candidate => isCompositeTouchdownBoundary(windows, candidate.boundaryMs, direction))
      .sort((left, right) => left.boundaryMs - right.boundaryMs),
  )
  const result = Object.freeze({
    forward: candidates(forwardWeights, 1),
    reverse: candidates(reverseWeights, -1),
    totalWeight,
  })
  ballisticTouchdownCandidateCache.set(definition, result)
  return result
}

function ballisticHeight(
  definition: BipedPetRootMotionDefinition,
  timeMs: number,
  characterHeight: number,
  actionWeight: number,
): number {
  if (definition.mode !== 'travel' || definition.verticalMode !== 'ballistic'
    || definition.jumpHeight <= 0 || actionWeight <= 0) return 0

  let weightedHeight = 0
  let totalWeight = 0
  const ballisticWindows = effectiveBallisticWindows(definition)
  let maximumWeight = 0
  for (const window of ballisticWindows) {
    maximumWeight = Math.max(maximumWeight, window.weight)
  }
  if (maximumWeight === 0) return 0
  for (const window of ballisticWindows) {
    const scaledWeight = window.weight / maximumWeight
    const linearProgress = clamp((timeMs - window.startMs) / (window.endMs - window.startMs), 0, 1)
    const shapedProgress = smoothstep(linearProgress)
    const height = 4 * definition.jumpHeight * characterHeight * shapedProgress * (1 - shapedProgress)
    weightedHeight += scaledWeight * height
    totalWeight += scaledWeight
  }
  const height = totalWeight > 0 ? weightedHeight / totalWeight * actionWeight : 0
  const maximumHeight = definition.jumpHeight * characterHeight * actionWeight
  return height <= maximumHeight * ROOT_MOTION_SIGNAL_EPSILON ? 0 : height
}

function maximumNormalizedBallisticHeightInRange(
  windows: readonly BipedPetRootMotionWindow[],
  startMs: number,
  endMs: number,
): number {
  let maximumWeight = 0
  for (const window of windows) maximumWeight = Math.max(maximumWeight, window.weight)
  if (maximumWeight === 0) return 0
  let upperHeight = 0
  let totalWeight = 0
  for (const window of windows) {
    const scaledWeight = window.weight / maximumWeight
    totalWeight += scaledWeight
    if (endMs <= window.startMs || startMs >= window.endMs) continue
    const peakMs = clamp(
      window.startMs + (window.endMs - window.startMs) * .5,
      Math.max(startMs, window.startMs),
      Math.min(endMs, window.endMs),
    )
    const linearProgress = clamp((peakMs - window.startMs) / (window.endMs - window.startMs), 0, 1)
    const shapedProgress = smoothstep(linearProgress)
    upperHeight += scaledWeight * 4 * shapedProgress * (1 - shapedProgress)
  }
  return totalWeight > 0 ? upperHeight / totalWeight : 0
}

function hasCompositeBallisticAirborneInRange(
  definition: BipedPetRootMotionDefinition,
  durationMs: number,
  actionWeight: number,
  firstTimeMs: number,
  secondTimeMs: number,
): boolean {
  const startMs = clamp(Math.min(firstTimeMs, secondTimeMs), 0, durationMs)
  const endMs = clamp(Math.max(firstTimeMs, secondTimeMs), 0, durationMs)
  if (!(endMs > startMs)) return false
  const windows = effectiveBallisticWindows(definition)
  if (windows.length === 0) return false
  const verticalIntentScale = definition.jumpHeight * actionWeight
  if (!(verticalIntentScale > 0)) return false
  // 同时遵守 target 的相对零化与 applied 的世界接地阈值，避免低/高强度微窗在两层尺度之间制造伪 takeoff。 / Match both target-relative zeroing and applied world grounding so low/high-intensity micro-windows cannot create a false takeoff between scales.
  const normalizedAirborneThreshold = Math.max(
    ROOT_MOTION_SIGNAL_EPSILON,
    ROOT_MOTION_SIGNAL_EPSILON / verticalIntentScale,
  )

  const pending: Array<readonly [number, number]> = [[startMs, endMs]]
  let visitedNodes = 0
  while (pending.length > 0) {
    const [rangeStartMs, rangeEndMs] = pending.pop()!
    const midpointMs = rangeStartMs + (rangeEndMs - rangeStartMs) * .5
    if (normalizedCompositeBallisticHeight(windows, rangeEndMs) > normalizedAirborneThreshold
      || normalizedCompositeBallisticHeight(windows, midpointMs) > normalizedAirborneThreshold) return true
    if (maximumNormalizedBallisticHeightInRange(windows, rangeStartMs, rangeEndMs) <= normalizedAirborneThreshold) continue
    if (midpointMs === rangeStartMs || midpointMs === rangeEndMs) return true
    visitedNodes += 1
    // 上界仍无法证明 grounded 时继续二分；达到固定工作预算后保守清除旧授权，绝不把未知区间误当成持续接地。 / Subdivide unresolved bounds; once the fixed work budget is exhausted, conservatively clear stale authorization.
    if (visitedNodes >= MAX_ROOT_MOTION_AIRBORNE_SEARCH_NODES) return true
    pending.push([rangeStartMs, midpointMs], [midpointMs, rangeEndMs])
  }
  return false
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
  const ballistic = ballisticHeight(
    input.definition,
    resolved.resolvedTimeMs,
    input.characterHeight,
    input.actionWeight,
  )
  const local = frozenVector3(horizontal, ballistic, 0)
  const world = rotateLocalVector(local, input.facingRadians)
  return [horizontal, ballistic, turnRadians, ...world].every(Number.isFinite)
    ? { local, world, turnRadians }
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

function rotateWorldVector(vector: RootMotionVector3, facingRadians: number): RootMotionVector3 {
  return rotateLocalVector(vector, -facingRadians)
}

function appliedPhase(
  appliedWorld: RootMotionVector3,
  deltaWorld: RootMotionVector3,
  characterHeight: number,
): RootMotionPhase {
  const groundedThreshold = characterHeight * ROOT_MOTION_SIGNAL_EPSILON
  if (appliedWorld[1] <= groundedThreshold) return 'grounded'
  if (deltaWorld[1] > 0) return 'takeoff'
  if (deltaWorld[1] < 0) return 'landing'
  return 'airborne'
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

function rootMotionContinuityLimitMs(durationMs: number): number {
  // 与足锁身份策略统一：短动作至少保留 250ms，长动作允许半个周期内连续追赶。
  return Math.max(ROOT_MOTION_CONTINUITY_BASE_MS, durationMs * ROOT_MOTION_CONTINUITY_DURATION_RATIO)
}

interface HorizontalSupportComponent {
  readonly startMs: number
  readonly endMs: number
}

const horizontalSupportComponentCache = new WeakMap<BipedPetRootMotionDefinition, readonly HorizontalSupportComponent[]>()

function horizontalSupportComponents(definition: BipedPetRootMotionDefinition): readonly HorizontalSupportComponent[] {
  const cached = horizontalSupportComponentCache.get(definition)
  if (cached) return cached
  const windows = definition.windows
    .filter(window => HORIZONTAL_WINDOW_KINDS.has(window.kind))
    .slice()
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || compareCodePoints(left.id, right.id))
  const components: { startMs: number; endMs: number }[] = []
  for (const window of windows) {
    const previous = components.at(-1)
    if (previous && window.startMs <= previous.endMs) previous.endMs = Math.max(previous.endMs, window.endMs)
    else components.push({ startMs: window.startMs, endMs: window.endMs })
  }
  const frozen = Object.freeze(components.map(component => Object.freeze(component)))
  horizontalSupportComponentCache.set(definition, frozen)
  return frozen
}

function supportCoversRange(components: readonly HorizontalSupportComponent[], firstMs: number, secondMs: number): boolean {
  const startMs = Math.min(firstMs, secondMs)
  const endMs = Math.max(firstMs, secondMs)
  if (endMs <= startMs) return true
  return components.some(component => component.startMs <= startMs && component.endMs >= endMs)
}

function isContinuouslyActiveHorizontalWindow(
  input: SafeSampleInput,
  previousRequestedTimeMs: number,
  currentResolved: ResolvedMotionTime,
): boolean {
  if (input.definition.mode !== 'travel' || input.actionWeight <= 0) return false
  const components = horizontalSupportComponents(input.definition)
  if (!components.some(component => (
    currentResolved.resolvedTimeMs > component.startMs && currentResolved.resolvedTimeMs < component.endMs
  ))) return false

  if (input.loopMode === 'once') {
    const previousResolved = resolveMotionTime(previousRequestedTimeMs, input.durationMs, input.loopMode)
    return supportCoversRange(components, previousResolved.resolvedTimeMs, currentResolved.resolvedTimeMs)
  }

  const firstIteration = Math.floor(previousRequestedTimeMs / input.durationMs)
  const lastIteration = Math.floor(input.requestedTimeMs / input.durationMs)
  const segmentCount = lastIteration - firstIteration + 1
  if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > MAX_ROOT_MOTION_CONTINUITY_SEGMENTS) return false
  let priorIteration: number | undefined
  for (let offset = 0; offset < segmentCount; offset += 1) {
    const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
    // 超安全整数范围后相邻 iteration 可能不可表示；此时保守停用残差，而不是让扫描停滞或重复消费同一段。 / Adjacent iterations may be unrepresentable above the safe range; disable residual feedback instead of stalling or reusing a segment.
    if (priorIteration !== undefined && iteration <= priorIteration) return false
    priorIteration = iteration
    const segmentStartMs = iteration * input.durationMs
    const requestStartMs = Math.max(previousRequestedTimeMs, segmentStartMs)
    const requestEndMs = Math.min(input.requestedTimeMs, segmentStartMs + input.durationMs)
    if (requestEndMs <= requestStartMs) continue
    const localStartMs = requestStartMs - segmentStartMs
    const localEndMs = requestEndMs - segmentStartMs
    const reverse = input.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
    const resolvedStartMs = reverse ? input.durationMs - localStartMs : localStartMs
    const resolvedEndMs = reverse ? input.durationMs - localEndMs : localEndMs
    if (!supportCoversRange(components, resolvedStartMs, resolvedEndMs)) return false
  }
  return true
}

function appliedState(
  world: RootMotionVector3,
  turnRadians: number,
  facingRadians: number,
): RootMotionAppliedState | undefined {
  const local = rotateWorldVector(world, facingRadians)
  return [...local, ...world, turnRadians].every(Number.isFinite)
    ? { local, world, turnRadians }
    : undefined
}

interface QualifiedTouchdownEvent {
  readonly transitionTimeMs: number
  readonly impulse: number
}

interface QualifiedTakeoffEvent {
  readonly transitionTimeMs: number
}

function touchdownCandidateIsQualified(
  input: SafeSampleInput,
  candidate: BallisticTouchdownCandidate,
  reverse: boolean,
  candidates: readonly BallisticTouchdownCandidate[],
): boolean {
  const index = candidates.indexOf(candidate)
  if (index < 0) return false
  // 每个候选只检查上一个 touchdown 后属于自己的支撑段，避免后置微尾窗借用主窗的 airborne 峰值取得授权。
  const firstBoundaryMs = reverse
    ? candidate.boundaryMs
    : (candidates[index - 1]?.boundaryMs ?? 0)
  const secondBoundaryMs = reverse
    ? (candidates[index + 1]?.boundaryMs ?? input.durationMs)
    : candidate.boundaryMs
  return hasCompositeBallisticAirborneInRange(
    input.definition,
    input.durationMs,
    input.actionWeight,
    firstBoundaryMs,
    secondBoundaryMs,
  )
}

function requestedRangeHasTargetAirborne(
  input: SafeSampleInput,
  firstRequestedTimeMs: number,
  secondRequestedTimeMs: number,
): boolean {
  const startRequestedTimeMs = Math.max(0, Math.min(firstRequestedTimeMs, secondRequestedTimeMs))
  const endRequestedTimeMs = Math.max(0, Math.max(firstRequestedTimeMs, secondRequestedTimeMs))
  if (!(endRequestedTimeMs > startRequestedTimeMs)) return false
  if (input.loopMode === 'once') {
    const start = resolveMotionTime(startRequestedTimeMs, input.durationMs, input.loopMode)
    const end = resolveMotionTime(endRequestedTimeMs, input.durationMs, input.loopMode)
    return hasCompositeBallisticAirborneInRange(
      input.definition,
      input.durationMs,
      input.actionWeight,
      start.resolvedTimeMs,
      end.resolvedTimeMs,
    )
  }

  const firstIteration = Math.floor(startRequestedTimeMs / input.durationMs)
  const lastIteration = Math.floor(endRequestedTimeMs / input.durationMs)
  const segmentCount = lastIteration - firstIteration + 1
  if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > MAX_ROOT_MOTION_CONTINUITY_SEGMENTS) return true
  let priorIteration: number | undefined
  for (let offset = 0; offset < segmentCount; offset += 1) {
    const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
    if (priorIteration !== undefined && iteration <= priorIteration) return true
    priorIteration = iteration
    const segmentStartMs = iteration * input.durationMs
    const segmentEndMs = segmentStartMs + input.durationMs
    const requestStartMs = Math.max(startRequestedTimeMs, segmentStartMs)
    const requestEndMs = Math.min(endRequestedTimeMs, segmentEndMs)
    if (!(requestEndMs > requestStartMs)) continue
    const localStartMs = requestStartMs - segmentStartMs
    const localEndMs = requestEndMs - segmentStartMs
    const reverse = input.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
    const resolvedStartMs = reverse ? input.durationMs - localStartMs : localStartMs
    const resolvedEndMs = reverse ? input.durationMs - localEndMs : localEndMs
    if (hasCompositeBallisticAirborneInRange(
      input.definition,
      input.durationMs,
      input.actionWeight,
      resolvedStartMs,
      resolvedEndMs,
    )) return true
  }
  return false
}

function qualifiedTouchdownEventsInRange(
  input: SafeSampleInput,
  previousRequestedTimeMs: number,
): readonly QualifiedTouchdownEvent[] {
  if (input.definition.mode !== 'travel' || input.definition.verticalMode !== 'ballistic'
    || input.definition.jumpHeight <= 0 || input.actionWeight <= 0 || input.requestedTimeMs < 0) return []
  const candidateSet = ballisticTouchdownCandidates(input.definition)
  if (!Number.isFinite(candidateSet.totalWeight) || candidateSet.totalWeight <= 0) return []
  const events: QualifiedTouchdownEvent[] = []
  const considerCandidate = (
    transitionTimeMs: number,
    candidate: BallisticTouchdownCandidate,
    reverse: boolean,
    candidates: readonly BallisticTouchdownCandidate[],
  ) => {
    if (!(transitionTimeMs > previousRequestedTimeMs && transitionTimeMs <= input.requestedTimeMs)
      || !touchdownCandidateIsQualified(input, candidate, reverse, candidates)) return
    const impulse = stableSignal(
      input.definition.jumpHeight * input.actionWeight * candidate.weight / candidateSet.totalWeight,
    )
    if (impulse > 0) events.push(Object.freeze({ transitionTimeMs, impulse }))
  }

  if (input.loopMode === 'once') {
    for (const candidate of candidateSet.forward) {
      considerCandidate(candidate.boundaryMs, candidate, false, candidateSet.forward)
    }
  }
  else {
    const startRequestedTimeMs = Math.max(0, previousRequestedTimeMs)
    const firstIteration = Math.floor(startRequestedTimeMs / input.durationMs)
    const lastIteration = Math.floor(input.requestedTimeMs / input.durationMs)
    const segmentCount = lastIteration - firstIteration + 1
    if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > MAX_ROOT_MOTION_CONTINUITY_SEGMENTS) return []
    let priorIteration: number | undefined
    for (let offset = 0; offset < segmentCount; offset += 1) {
      const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
      if (priorIteration !== undefined && iteration <= priorIteration) return []
      priorIteration = iteration
      const segmentStartMs = iteration * input.durationMs
      const reverse = input.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
      const candidates = reverse ? candidateSet.reverse : candidateSet.forward
      for (const candidate of candidates) {
        const transitionTimeMs = reverse
          ? segmentStartMs + input.durationMs - candidate.boundaryMs
          : segmentStartMs + candidate.boundaryMs
        considerCandidate(transitionTimeMs, candidate, reverse, candidates)
      }
    }
  }
  return Object.freeze(events.sort((left, right) => (
    left.transitionTimeMs - right.transitionTimeMs || left.impulse - right.impulse
  )))
}

function qualifiedTakeoffEventsInRange(
  input: SafeSampleInput,
  previousRequestedTimeMs: number,
): readonly QualifiedTakeoffEvent[] {
  if (input.definition.mode !== 'travel' || input.definition.verticalMode !== 'ballistic'
    || input.definition.jumpHeight <= 0 || input.actionWeight <= 0 || input.requestedTimeMs < 0) return []
  const windows = effectiveBallisticWindows(input.definition)
  const events: QualifiedTakeoffEvent[] = []
  const considerWindow = (transitionTimeMs: number) => {
    if (!(transitionTimeMs > previousRequestedTimeMs && transitionTimeMs <= input.requestedTimeMs)
      || !requestedRangeHasTargetAirborne(input, transitionTimeMs, input.requestedTimeMs)) return
    events.push(Object.freeze({ transitionTimeMs }))
  }

  if (input.loopMode === 'once') {
    for (const window of windows) considerWindow(window.startMs)
  }
  else {
    const startRequestedTimeMs = Math.max(0, previousRequestedTimeMs)
    const firstIteration = Math.floor(startRequestedTimeMs / input.durationMs)
    const lastIteration = Math.floor(input.requestedTimeMs / input.durationMs)
    const segmentCount = lastIteration - firstIteration + 1
    if (!Number.isInteger(segmentCount) || segmentCount < 1 || segmentCount > MAX_ROOT_MOTION_CONTINUITY_SEGMENTS) return []
    let priorIteration: number | undefined
    for (let offset = 0; offset < segmentCount; offset += 1) {
      const iteration = offset === segmentCount - 1 ? lastIteration : firstIteration + offset
      if (priorIteration !== undefined && iteration <= priorIteration) return []
      priorIteration = iteration
      const segmentStartMs = iteration * input.durationMs
      const reverse = input.loopMode === 'ping-pong' && positiveModulo(iteration, 2) !== 0
      for (const window of windows) {
        const transitionTimeMs = reverse
          ? segmentStartMs + input.durationMs - window.endMs
          : segmentStartMs + window.startMs
        considerWindow(transitionTimeMs)
      }
    }
  }
  return Object.freeze(events.sort((left, right) => left.transitionTimeMs - right.transitionTimeMs))
}

function targetIsGroundedAtRequestedTime(input: SafeSampleInput, requestedTimeMs: number): boolean {
  const resolved = resolveMotionTime(
    requestedTimeMs,
    input.durationMs,
    input.loopMode,
  )
  return ballisticHeight(
    input.definition,
    resolved.resolvedTimeMs,
    input.characterHeight,
    input.actionWeight,
  ) <= input.characterHeight * ROOT_MOTION_SIGNAL_EPSILON
}

function authorizationStartsFromGroundedTarget(
  input: SafeSampleInput,
  authorization: BipedPetLandingAuthorization,
): boolean {
  return targetIsGroundedAtRequestedTime(input, authorization.touchdownRequestedTimeMs)
}

function advanceLandingAuthorization(
  input: SafeSampleInput,
  previousRequestedTimeMs: number,
): BipedPetLandingAuthorization | undefined {
  let authorization = input.previousLandingAuthorization
  let cursorTimeMs = previousRequestedTimeMs
  const timeline = [
    ...qualifiedTakeoffEventsInRange(input, previousRequestedTimeMs).map(event => ({ ...event, kind: 'takeoff' as const })),
    ...qualifiedTouchdownEventsInRange(input, previousRequestedTimeMs).map(event => ({ ...event, kind: 'touchdown' as const })),
  ].sort((left, right) => left.transitionTimeMs - right.transitionTimeMs
    || (left.kind === right.kind ? 0 : left.kind === 'takeoff' ? -1 : 1))
  for (const event of timeline) {
    if (event.kind === 'takeoff') {
      // 新的有效腾空是独立动作事实；即使旧 ULP touchdown 因时间映射舍入仍落在窗内，也必须清除旧授权。
      authorization = undefined
    }
    else {
      if (authorization
        && (authorizationStartsFromGroundedTarget(input, authorization)
          || targetIsGroundedAtRequestedTime(input, cursorTimeMs))
        && requestedRangeHasTargetAirborne(input, cursorTimeMs, event.transitionTimeMs)) authorization = undefined
      authorization = Object.freeze({
        touchdownRequestedTimeMs: event.transitionTimeMs,
        impulse: event.impulse,
      })
    }
    cursorTimeMs = event.transitionTimeMs
  }
  if (authorization
    && (authorizationStartsFromGroundedTarget(input, authorization)
      || targetIsGroundedAtRequestedTime(input, cursorTimeMs))
    && requestedRangeHasTargetAirborne(input, cursorTimeMs, input.requestedTimeMs)) return undefined
  return authorization
}

/**
 * cumulative 是由绝对动作时间求出的期望目标；applied 才是调用方本帧可安全写入容器的状态。
 * 高频运行时应先 normalize/compile 一次并复用 canonical 冻结定义；不可信 raw definition 每帧都会防御复制与校验。
 * 连续帧从 previousAppliedWorld 追赶目标并受预算限制；首帧、缺少应用状态、倒退或超出连续阈值会 reset。
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
  const reset = previousTimeMs === undefined
    || safeInput.previousAppliedWorld === undefined
    || safeInput.previousAppliedTurnRadians === undefined
    || elapsedMs < 0
    || elapsedMs > rootMotionContinuityLimitMs(safeInput.durationMs)
  if (reset) return stationaryRootMotionSample(
    'reset',
    currentResolved,
    currentTarget,
    currentTarget,
    safeInput.characterHeight,
  )

  const previousApplied = appliedState(
    safeInput.previousAppliedWorld!,
    safeInput.previousAppliedTurnRadians!,
    safeInput.facingRadians,
  )
  if (!previousApplied) return blockedRootMotionSample(currentResolved)
  if (elapsedMs === 0) return stationaryRootMotionSample(
    'solved', currentResolved, currentTarget, previousApplied, safeInput.characterHeight,
    safeInput.previousLandingAuthorization,
  )

  const elapsedSeconds = elapsedMs / 1000
  const targetErrorWorld = frozenVector3(
    currentTarget.world[0] - previousApplied.world[0],
    currentTarget.world[1] - previousApplied.world[1],
    currentTarget.world[2] - previousApplied.world[2],
  )
  const horizontalTargetError = Math.hypot(targetErrorWorld[0], targetErrorWorld[2])
  const horizontalIntentScale = clamp(
    horizontalTargetError / (safeInput.characterHeight * elapsedSeconds),
    0,
    1,
  )
  const residualActive = isContinuouslyActiveHorizontalWindow(safeInput, previousTimeMs, currentResolved)
    && horizontalTargetError > ROOT_MOTION_SIGNAL_EPSILON
  const residualCorrection = clampVectorLength(
    residualActive
      ? frozenVector3(
          safeInput.footResidual[0] * ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND * elapsedSeconds * safeInput.actionWeight,
          0,
          safeInput.footResidual[2] * ROOT_MOTION_FOOT_RESIDUAL_GAIN_PER_SECOND * elapsedSeconds * safeInput.actionWeight,
        )
      : zeroVector3(),
    residualActive
      ? safeInput.characterHeight
        * MAX_ROOT_MOTION_FOOT_RESIDUAL_RATIO_PER_SECOND
        * elapsedSeconds
        * safeInput.actionWeight
        * horizontalIntentScale
      : 0,
  )
  if (!residualCorrection) return blockedRootMotionSample(currentResolved)
  const residualCorrectionWorld = rotateLocalVector(residualCorrection.value, safeInput.facingRadians)
  const rawDeltaWorld = frozenVector3(
    targetErrorWorld[0] + residualCorrectionWorld[0],
    targetErrorWorld[1],
    targetErrorWorld[2] + residualCorrectionWorld[2],
  )
  const boundedDelta = clampVectorLength(rawDeltaWorld, safeInput.characterHeight * MAX_ROOT_MOTION_DELTA_RATIO)
  if (!boundedDelta) return blockedRootMotionSample(currentResolved)
  const rawDeltaTurn = currentTarget.turnRadians - previousApplied.turnRadians
  if (!Number.isFinite(rawDeltaTurn)) return blockedRootMotionSample(currentResolved)
  const boundedDeltaTurnRadians = canonicalZero(clamp(rawDeltaTurn, -MAX_ROOT_MOTION_TURN_DELTA, MAX_ROOT_MOTION_TURN_DELTA))
  const turnClamped = boundedDeltaTurnRadians !== rawDeltaTurn
  const appliedWorld = !boundedDelta.clamped && residualCorrection.value.every(value => value === 0)
    ? currentTarget.world
    : frozenVector3(
        previousApplied.world[0] + boundedDelta.value[0],
        previousApplied.world[1] + boundedDelta.value[1],
        previousApplied.world[2] + boundedDelta.value[2],
      )
  const appliedLocal = rotateWorldVector(appliedWorld, safeInput.facingRadians)
  const appliedTurnRadians = canonicalZero(turnClamped
    ? previousApplied.turnRadians + boundedDeltaTurnRadians
    : currentTarget.turnRadians)
  const deltaWorld = frozenVector3(
    appliedWorld[0] - previousApplied.world[0],
    appliedWorld[1] - previousApplied.world[1],
    appliedWorld[2] - previousApplied.world[2],
  )
  const deltaLocal = rotateWorldVector(deltaWorld, safeInput.facingRadians)
  const deltaTurnRadians = canonicalZero(appliedTurnRadians - previousApplied.turnRadians)
  const linearVelocity = frozenVector3(
    deltaWorld[0] / elapsedSeconds,
    deltaWorld[1] / elapsedSeconds,
    deltaWorld[2] / elapsedSeconds,
  )
  const angularVelocity = canonicalZero(deltaTurnRadians / elapsedSeconds)
  if (![...rawDeltaWorld, ...appliedLocal, ...appliedWorld, ...deltaLocal, ...deltaWorld, ...linearVelocity, appliedTurnRadians, angularVelocity].every(Number.isFinite)) {
    return blockedRootMotionSample(currentResolved)
  }

  const motionIntensity = stableSignal(Math.max(
    Math.hypot(...linearVelocity) / (safeInput.characterHeight * 4),
    Math.abs(angularVelocity) / (Math.PI * 2),
  ))
  const brakeIntensity = stableSignal(
    brakeWindowIntensity(safeInput.definition.windows, currentResolved.resolvedTimeMs) * safeInput.actionWeight,
  )
  const groundedThreshold = safeInput.characterHeight * ROOT_MOTION_SIGNAL_EPSILON
  const appliedTouchedDown = previousApplied.world[1] > groundedThreshold && appliedWorld[1] <= groundedThreshold
  const pendingLandingAuthorization = advanceLandingAuthorization(safeInput, previousTimeMs)
  const landingImpulse = appliedTouchedDown ? pendingLandingAuthorization?.impulse ?? 0 : 0
  const landingAuthorization = appliedTouchedDown ? undefined : pendingLandingAuthorization
  return frozenSample({
    status: boundedDelta.clamped || turnClamped ? 'clamped' : 'solved',
    requestedTimeMs: currentResolved.requestedTimeMs,
    resolvedTimeMs: currentResolved.resolvedTimeMs,
    iteration: currentResolved.iteration,
    cumulativeLocal: currentTarget.local,
    cumulativeWorld: currentTarget.world,
    appliedLocal,
    appliedWorld,
    deltaLocal,
    deltaWorld,
    cumulativeTurnRadians: currentTarget.turnRadians,
    appliedTurnRadians,
    deltaTurnRadians,
    linearVelocity,
    angularVelocity,
    phase: appliedPhase(appliedWorld, deltaWorld, safeInput.characterHeight),
    motionIntensity,
    landingImpulse,
    ...(landingAuthorization === undefined ? {} : { landingAuthorization }),
    brakeIntensity,
  })
}
