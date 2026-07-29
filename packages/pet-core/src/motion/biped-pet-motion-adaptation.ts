/**
 * 文件职责 / File responsibility
 * 定义双足萌宠动作适配扩展，并把站内持久化输入规范为与渲染框架无关的只读契约。
 */

import { normalizeMotionDurationMs } from './motion-time'

export const BIPED_PET_MOTION_ADAPTATION_NAMESPACE = 'yk-pets/biped-motion-adaptation/v1' as const

export type BipedPetMotionPhaseRole = 'prepare' | 'spin' | 'handoff' | 'sweep' | 'takeoff' | 'impact' | 'recover'
export type BipedPetMotionWarpTarget = 'stage-forward'
export type BipedPetMotionConstraintKind = 'secondary-grip'
export type BipedPetMotionEffectCueKind = 'weapon-trail' | 'impact-sparks' | 'impact-ring'
export type BipedPetMotionLimbId = 'arm.left' | 'arm.right'

export interface BipedPetMotionPhase {
  readonly id: string
  readonly role: BipedPetMotionPhaseRole
  readonly startMs: number
  readonly endMs: number
  readonly intensity: number
}

export interface BipedPetMotionWarpWindow {
  readonly id: string
  readonly phaseId: string
  readonly target: BipedPetMotionWarpTarget
  readonly translation: boolean
  readonly rotation: boolean
  readonly maxDistance: number
  readonly maxTurnRadians: number
}

export interface BipedPetMotionConstraint {
  readonly id: string
  readonly kind: BipedPetMotionConstraintKind
  readonly phaseId: string
  readonly limbId: BipedPetMotionLimbId
  readonly propInstanceId: string
  readonly pointId: string
  readonly weight: number
}

export interface BipedPetMotionEffectCue {
  readonly id: string
  readonly kind: BipedPetMotionEffectCueKind
  readonly phaseId: string
  readonly propInstanceId: string
  readonly pointIds: readonly string[]
  readonly threshold: number
  readonly lifetimeMs: number
}

export interface BipedPetMotionAdaptationDefinition {
  readonly phases: readonly BipedPetMotionPhase[]
  readonly warpWindows: readonly BipedPetMotionWarpWindow[]
  readonly constraints: readonly BipedPetMotionConstraint[]
  readonly effectCues: readonly BipedPetMotionEffectCue[]
}

export interface BipedPetMotionAdaptationDiagnostic {
  readonly id: string
  readonly severity: 'warning'
  readonly message: string
}

export interface BipedPetMotionAdaptationNormalizationResult {
  readonly value: BipedPetMotionAdaptationDefinition
  readonly diagnostics: readonly BipedPetMotionAdaptationDiagnostic[]
}

export const MAX_BIPED_PET_MOTION_ADAPTATION_PHASES = 16
export const MAX_BIPED_PET_MOTION_ADAPTATION_WARP_WINDOWS = 32
export const MAX_BIPED_PET_MOTION_ADAPTATION_CONSTRAINTS = 16
export const MAX_BIPED_PET_MOTION_ADAPTATION_EFFECT_CUES = 32

const MAX_IDENTIFIER_CODE_POINTS = 128
const MAX_DIAGNOSTICS = 128
const MAX_WARP_DISTANCE = 4
const MAX_WARP_TURN_RADIANS = Math.PI * 2
const MAX_EFFECT_LIFETIME_MS = 2000
const PHASE_ROLES = new Set<BipedPetMotionPhaseRole>(['prepare', 'spin', 'handoff', 'sweep', 'takeoff', 'impact', 'recover'])
const WARP_TARGETS = new Set<BipedPetMotionWarpTarget>(['stage-forward'])
const CONSTRAINT_KINDS = new Set<BipedPetMotionConstraintKind>(['secondary-grip'])
const LIMB_IDS = new Set<BipedPetMotionLimbId>(['arm.left', 'arm.right'])
const EFFECT_KINDS = new Set<BipedPetMotionEffectCueKind>(['weapon-trail', 'impact-sparks', 'impact-ring'])

type AdaptationArrayField = 'phases' | 'warpWindows' | 'constraints' | 'effectCues'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
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

function warning(
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
  id: string,
  message: string,
): void {
  if (diagnostics.length >= MAX_DIAGNOSTICS) return
  diagnostics.push({ id, severity: 'warning', message })
}

function readArrayField(
  source: Record<PropertyKey, unknown>,
  field: AdaptationArrayField,
  maximum: number,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): unknown[] {
  try {
    const candidate = Reflect.get(source, field)
    if (candidate === undefined) return []
    if (!Array.isArray(candidate)) {
      warning(diagnostics, `motion-adaptation-${field}-invalid`, `动作适配的 ${field} 不是数组，已忽略。`)
      return []
    }
    const length = Reflect.get(candidate, 'length')
    if (!Number.isSafeInteger(length) || length < 0) throw new TypeError('invalid array length')
    if (length > maximum) {
      warning(diagnostics, `motion-adaptation-${field}-budget-exceeded`, `动作适配的 ${field} 超过 ${maximum} 项预算，仅处理预算内条目。`)
    }
    const values: unknown[] = []
    for (let index = 0; index < Math.min(length, maximum); index += 1) {
      try {
        values.push(Reflect.get(candidate, index))
      }
      catch {
        warning(diagnostics, `motion-adaptation-${field}-${index}-access-failed`, `动作适配的 ${field}[${index}] 无法安全读取，已丢弃。`)
      }
    }
    return values
  }
  catch {
    warning(diagnostics, `motion-adaptation-${field}-access-failed`, `动作适配的 ${field} 无法安全读取，已忽略。`)
    return []
  }
}

function normalizeIdentifier(
  value: unknown,
  diagnosticPrefix: string,
  field: string,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    warning(diagnostics, `${diagnosticPrefix}-${field}-invalid`, `${diagnosticPrefix} 的 ${field} 不是有效文本，已丢弃。`)
    return undefined
  }
  const normalized = value.trim()
  let codePointCount = 0
  for (const _character of normalized) {
    codePointCount += 1
    if (codePointCount > MAX_IDENTIFIER_CODE_POINTS) break
  }
  if (codePointCount > MAX_IDENTIFIER_CODE_POINTS) {
    warning(diagnostics, `${diagnosticPrefix}-${field}-too-long`, `${diagnosticPrefix} 的 ${field} 超过 ${MAX_IDENTIFIER_CODE_POINTS} 个字符，已丢弃。`)
    return undefined
  }
  return normalized
}

function readFields(
  record: Record<PropertyKey, unknown>,
  fields: readonly string[],
  diagnosticPrefix: string,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): Record<string, unknown> | undefined {
  try {
    return Object.fromEntries(fields.map(field => [field, Reflect.get(record, field)]))
  }
  catch {
    warning(diagnostics, `${diagnosticPrefix}-access-failed`, `${diagnosticPrefix} 无法安全读取，已丢弃。`)
    return undefined
  }
}

function normalizePhases(
  source: Record<PropertyKey, unknown>,
  durationMs: number,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): BipedPetMotionPhase[] {
  const candidates = readArrayField(source, 'phases', MAX_BIPED_PET_MOTION_ADAPTATION_PHASES, diagnostics)
  const phases: BipedPetMotionPhase[] = []
  const seenIds = new Set<string>()

  for (const [index, candidate] of candidates.entries()) {
    const prefix = `motion-adaptation-phase-${index}`
    const record = safeRecord(candidate)
    if (!record) {
      warning(diagnostics, `${prefix}-invalid`, `动作适配阶段 ${index} 不是对象，已丢弃。`)
      continue
    }
    const fields = readFields(record, ['id', 'role', 'startMs', 'endMs', 'intensity'], prefix, diagnostics)
    if (!fields) continue
    const id = normalizeIdentifier(fields.id, prefix, 'id', diagnostics)
    if (!id) continue
    if (seenIds.has(id)) {
      warning(diagnostics, `${prefix}-id-duplicate`, `动作适配阶段 ${id} 的 id 重复，已保留首项。`)
      continue
    }
    if (!PHASE_ROLES.has(fields.role as BipedPetMotionPhaseRole)) {
      warning(diagnostics, `${prefix}-role-invalid`, `动作适配阶段 ${id} 的 role 无效，已丢弃。`)
      continue
    }
    if (typeof fields.startMs !== 'number' || !Number.isFinite(fields.startMs)
      || typeof fields.endMs !== 'number' || !Number.isFinite(fields.endMs)) {
      warning(diagnostics, `${prefix}-time-invalid`, `动作适配阶段 ${id} 的时间不是有限数，已丢弃。`)
      continue
    }
    if (typeof fields.intensity !== 'number' || !Number.isFinite(fields.intensity) || fields.intensity <= 0) {
      warning(diagnostics, `${prefix}-intensity-invalid`, `动作适配阶段 ${id} 的强度不是正有限数，已丢弃。`)
      continue
    }
    const startMs = clamp(fields.startMs, 0, durationMs)
    const endMs = clamp(fields.endMs, 0, durationMs)
    if (startMs !== fields.startMs || endMs !== fields.endMs) {
      warning(diagnostics, `${prefix}-time-clamped`, `动作适配阶段 ${id} 已限制在动作时长内。`)
    }
    if (endMs <= startMs) {
      warning(diagnostics, `${prefix}-range-invalid`, `动作适配阶段 ${id} 是反向或零长度区间，已丢弃。`)
      continue
    }
    const intensity = clamp(fields.intensity, Number.MIN_VALUE, 1)
    if (intensity !== fields.intensity) {
      warning(diagnostics, `${prefix}-intensity-clamped`, `动作适配阶段 ${id} 的强度已钳制到安全范围。`)
    }
    seenIds.add(id)
    phases.push({ id, role: fields.role as BipedPetMotionPhaseRole, startMs, endMs, intensity })
  }

  phases.sort((left, right) => compareCodePoints(left.id, right.id))
  return phases
}

function normalizeWarpWindows(
  source: Record<PropertyKey, unknown>,
  phaseIds: ReadonlySet<string>,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): BipedPetMotionWarpWindow[] {
  const candidates = readArrayField(source, 'warpWindows', MAX_BIPED_PET_MOTION_ADAPTATION_WARP_WINDOWS, diagnostics)
  const windows: BipedPetMotionWarpWindow[] = []
  const seenIds = new Set<string>()

  for (const [index, candidate] of candidates.entries()) {
    const prefix = `motion-adaptation-warp-${index}`
    const record = safeRecord(candidate)
    if (!record) {
      warning(diagnostics, `${prefix}-invalid`, `动作适配 Warp ${index} 不是对象，已丢弃。`)
      continue
    }
    const fields = readFields(record, ['id', 'phaseId', 'target', 'translation', 'rotation', 'maxDistance', 'maxTurnRadians'], prefix, diagnostics)
    if (!fields) continue
    const id = normalizeIdentifier(fields.id, prefix, 'id', diagnostics)
    const phaseId = normalizeIdentifier(fields.phaseId, prefix, 'phase-id', diagnostics)
    if (!id || !phaseId) continue
    if (seenIds.has(id)) {
      warning(diagnostics, `${prefix}-id-duplicate`, `动作适配 Warp ${id} 的 id 重复，已保留首项。`)
      continue
    }
    if (!phaseIds.has(phaseId)) {
      warning(diagnostics, `${prefix}-phase-missing`, `动作适配 Warp ${id} 引用的阶段不存在，已丢弃。`)
      continue
    }
    if (!WARP_TARGETS.has(fields.target as BipedPetMotionWarpTarget)) {
      warning(diagnostics, `${prefix}-target-invalid`, `动作适配 Warp ${id} 的 target 无效，已丢弃。`)
      continue
    }
    if (typeof fields.translation !== 'boolean' || typeof fields.rotation !== 'boolean' || (!fields.translation && !fields.rotation)) {
      warning(diagnostics, `${prefix}-channels-invalid`, `动作适配 Warp ${id} 未声明有效通道，已丢弃。`)
      continue
    }
    if (typeof fields.maxDistance !== 'number' || !Number.isFinite(fields.maxDistance) || fields.maxDistance < 0
      || typeof fields.maxTurnRadians !== 'number' || !Number.isFinite(fields.maxTurnRadians) || fields.maxTurnRadians < 0) {
      warning(diagnostics, `${prefix}-limits-invalid`, `动作适配 Warp ${id} 的限制不是非负有限数，已丢弃。`)
      continue
    }
    const maxDistance = clamp(fields.maxDistance, 0, MAX_WARP_DISTANCE)
    const maxTurnRadians = clamp(fields.maxTurnRadians, 0, MAX_WARP_TURN_RADIANS)
    if (maxDistance !== fields.maxDistance || maxTurnRadians !== fields.maxTurnRadians) {
      warning(diagnostics, `${prefix}-limits-clamped`, `动作适配 Warp ${id} 的限制已钳制到安全范围。`)
    }
    seenIds.add(id)
    windows.push({
      id,
      phaseId,
      target: fields.target as BipedPetMotionWarpTarget,
      translation: fields.translation,
      rotation: fields.rotation,
      maxDistance,
      maxTurnRadians,
    })
  }

  windows.sort((left, right) => compareCodePoints(left.id, right.id))
  return windows
}

function normalizeConstraints(
  source: Record<PropertyKey, unknown>,
  phaseIds: ReadonlySet<string>,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): BipedPetMotionConstraint[] {
  const candidates = readArrayField(source, 'constraints', MAX_BIPED_PET_MOTION_ADAPTATION_CONSTRAINTS, diagnostics)
  const constraints: BipedPetMotionConstraint[] = []
  const seenIds = new Set<string>()

  for (const [index, candidate] of candidates.entries()) {
    const prefix = `motion-adaptation-constraint-${index}`
    const record = safeRecord(candidate)
    if (!record) {
      warning(diagnostics, `${prefix}-invalid`, `动作适配约束 ${index} 不是对象，已丢弃。`)
      continue
    }
    const fields = readFields(record, ['id', 'kind', 'phaseId', 'limbId', 'propInstanceId', 'pointId', 'weight'], prefix, diagnostics)
    if (!fields) continue
    const id = normalizeIdentifier(fields.id, prefix, 'id', diagnostics)
    const phaseId = normalizeIdentifier(fields.phaseId, prefix, 'phase-id', diagnostics)
    const propInstanceId = normalizeIdentifier(fields.propInstanceId, prefix, 'prop-instance-id', diagnostics)
    const pointId = normalizeIdentifier(fields.pointId, prefix, 'point-id', diagnostics)
    if (!id || !phaseId || !propInstanceId || !pointId) continue
    if (seenIds.has(id)) {
      warning(diagnostics, `${prefix}-id-duplicate`, `动作适配约束 ${id} 的 id 重复，已保留首项。`)
      continue
    }
    if (!phaseIds.has(phaseId)) {
      warning(diagnostics, `${prefix}-phase-missing`, `动作适配约束 ${id} 引用的阶段不存在，已丢弃。`)
      continue
    }
    if (!CONSTRAINT_KINDS.has(fields.kind as BipedPetMotionConstraintKind)
      || !LIMB_IDS.has(fields.limbId as BipedPetMotionLimbId)) {
      warning(diagnostics, `${prefix}-semantic-invalid`, `动作适配约束 ${id} 的类型或肢体无效，已丢弃。`)
      continue
    }
    if (typeof fields.weight !== 'number' || !Number.isFinite(fields.weight) || fields.weight <= 0) {
      warning(diagnostics, `${prefix}-weight-invalid`, `动作适配约束 ${id} 的权重不是正有限数，已丢弃。`)
      continue
    }
    const weight = clamp(fields.weight, Number.MIN_VALUE, 1)
    if (weight !== fields.weight) {
      warning(diagnostics, `${prefix}-weight-clamped`, `动作适配约束 ${id} 的权重已钳制到安全范围。`)
    }
    seenIds.add(id)
    constraints.push({
      id,
      kind: fields.kind as BipedPetMotionConstraintKind,
      phaseId,
      limbId: fields.limbId as BipedPetMotionLimbId,
      propInstanceId,
      pointId,
      weight,
    })
  }

  constraints.sort((left, right) => compareCodePoints(left.id, right.id))
  return constraints
}

function normalizePointIds(
  candidate: unknown,
  kind: BipedPetMotionEffectCueKind,
  prefix: string,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): string[] | undefined {
  try {
    if (!Array.isArray(candidate)) throw new TypeError('not array')
    const length = Reflect.get(candidate, 'length')
    const expectedLength = kind === 'weapon-trail' ? 2 : 1
    if (length !== expectedLength) {
      warning(diagnostics, `${prefix}-point-count-invalid`, `动作适配特效的语义点数量与 ${kind} 不匹配，已丢弃。`)
      return undefined
    }
    const pointIds: string[] = []
    for (let index = 0; index < expectedLength; index += 1) {
      const pointId = normalizeIdentifier(Reflect.get(candidate, index), prefix, `point-${index}`, diagnostics)
      if (!pointId) return undefined
      pointIds.push(pointId)
    }
    if (new Set(pointIds).size !== pointIds.length) {
      warning(diagnostics, `${prefix}-point-duplicate`, `动作适配特效的语义点不能重复，已丢弃。`)
      return undefined
    }
    return pointIds
  }
  catch {
    warning(diagnostics, `${prefix}-points-access-failed`, `动作适配特效的语义点无法安全读取，已丢弃。`)
    return undefined
  }
}

function normalizeEffectCues(
  source: Record<PropertyKey, unknown>,
  phaseIds: ReadonlySet<string>,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): BipedPetMotionEffectCue[] {
  const candidates = readArrayField(source, 'effectCues', MAX_BIPED_PET_MOTION_ADAPTATION_EFFECT_CUES, diagnostics)
  const effectCues: BipedPetMotionEffectCue[] = []
  const seenIds = new Set<string>()

  for (const [index, candidate] of candidates.entries()) {
    const prefix = `motion-adaptation-effect-${index}`
    const record = safeRecord(candidate)
    if (!record) {
      warning(diagnostics, `${prefix}-invalid`, `动作适配特效 ${index} 不是对象，已丢弃。`)
      continue
    }
    const fields = readFields(record, ['id', 'kind', 'phaseId', 'propInstanceId', 'pointIds', 'threshold', 'lifetimeMs'], prefix, diagnostics)
    if (!fields) continue
    const id = normalizeIdentifier(fields.id, prefix, 'id', diagnostics)
    const phaseId = normalizeIdentifier(fields.phaseId, prefix, 'phase-id', diagnostics)
    const propInstanceId = normalizeIdentifier(fields.propInstanceId, prefix, 'prop-instance-id', diagnostics)
    if (!id || !phaseId || !propInstanceId) continue
    if (seenIds.has(id)) {
      warning(diagnostics, `${prefix}-id-duplicate`, `动作适配特效 ${id} 的 id 重复，已保留首项。`)
      continue
    }
    if (!phaseIds.has(phaseId)) {
      warning(diagnostics, `${prefix}-phase-missing`, `动作适配特效 ${id} 引用的阶段不存在，已丢弃。`)
      continue
    }
    if (!EFFECT_KINDS.has(fields.kind as BipedPetMotionEffectCueKind)) {
      warning(diagnostics, `${prefix}-kind-invalid`, `动作适配特效 ${id} 的 kind 无效，已丢弃。`)
      continue
    }
    const kind = fields.kind as BipedPetMotionEffectCueKind
    const pointIds = normalizePointIds(fields.pointIds, kind, prefix, diagnostics)
    if (!pointIds) continue
    if (typeof fields.threshold !== 'number' || !Number.isFinite(fields.threshold) || fields.threshold < 0
      || typeof fields.lifetimeMs !== 'number' || !Number.isFinite(fields.lifetimeMs) || fields.lifetimeMs <= 0) {
      warning(diagnostics, `${prefix}-limits-invalid`, `动作适配特效 ${id} 的阈值或寿命无效，已丢弃。`)
      continue
    }
    const threshold = clamp(fields.threshold, 0, 1)
    const lifetimeMs = clamp(fields.lifetimeMs, 1, MAX_EFFECT_LIFETIME_MS)
    if (threshold !== fields.threshold || lifetimeMs !== fields.lifetimeMs) {
      warning(diagnostics, `${prefix}-limits-clamped`, `动作适配特效 ${id} 的阈值或寿命已钳制到安全范围。`)
    }
    seenIds.add(id)
    effectCues.push({ id, kind, phaseId, propInstanceId, pointIds, threshold, lifetimeMs })
  }

  effectCues.sort((left, right) => compareCodePoints(left.id, right.id))
  return effectCues
}

function freezeDefinition(value: BipedPetMotionAdaptationDefinition): BipedPetMotionAdaptationDefinition {
  return Object.freeze({
    phases: Object.freeze(value.phases.map(item => Object.freeze({ ...item }))),
    warpWindows: Object.freeze(value.warpWindows.map(item => Object.freeze({ ...item }))),
    constraints: Object.freeze(value.constraints.map(item => Object.freeze({ ...item }))),
    effectCues: Object.freeze(value.effectCues.map(item => Object.freeze({
      ...item,
      pointIds: Object.freeze([...item.pointIds]),
    }))),
  })
}

/**
 * 将不可信动作扩展复制为有界只读值；损坏增强只产生 warning，不阻断原动作资产。
 */
export function normalizeBipedPetMotionAdaptation(
  input: unknown,
  durationMs: number,
): BipedPetMotionAdaptationNormalizationResult {
  const diagnostics: BipedPetMotionAdaptationDiagnostic[] = []
  const safeDurationMs = normalizeMotionDurationMs(durationMs)
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    warning(diagnostics, 'motion-adaptation-duration-invalid', `动作适配时长无效，已回退为 ${safeDurationMs}ms。`)
  }
  else if (durationMs !== safeDurationMs) {
    warning(diagnostics, 'motion-adaptation-duration-normalized', `动作适配时长已规范为 ${safeDurationMs}ms。`)
  }

  const source = safeRecord(input)
  if (!source) {
    if (input !== undefined) warning(diagnostics, 'motion-adaptation-input-invalid', '动作适配扩展不是对象，已忽略增强。')
    return Object.freeze({
      value: freezeDefinition({ phases: [], warpWindows: [], constraints: [], effectCues: [] }),
      diagnostics: Object.freeze(diagnostics.map(item => Object.freeze(item))),
    })
  }

  const phases = normalizePhases(source, safeDurationMs, diagnostics)
  const phaseIds = new Set(phases.map(item => item.id))
  const value = freezeDefinition({
    phases,
    warpWindows: normalizeWarpWindows(source, phaseIds, diagnostics),
    constraints: normalizeConstraints(source, phaseIds, diagnostics),
    effectCues: normalizeEffectCues(source, phaseIds, diagnostics),
  })
  return Object.freeze({
    value,
    diagnostics: Object.freeze(diagnostics.map(item => Object.freeze(item))),
  })
}
