/**
 * 文件职责 / File responsibility
 * 定义双足萌宠动作适配扩展，并把站内持久化输入规范为与渲染框架无关的只读契约。
 */

import { normalizeMotionDurationMs } from './motion-time'
import {
  normalizeStudioPropRig,
  type StudioPropRigDefinition,
  type StudioPropRigPoint,
  type StudioPropRigPointId,
} from '../props/prop-rig'

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

export interface BipedPetMotionAdaptationCompileInput {
  readonly definition: BipedPetMotionAdaptationDefinition
  readonly clipHash: string
  readonly profileId: string
  readonly characterHash: string
  readonly characterHeight: number
  readonly armReach: Readonly<{ left: number; right: number }>
  readonly propRigs: Readonly<Record<string, StudioPropRigDefinition>>
}

export interface CompiledBipedPetMotionPhase extends BipedPetMotionPhase {
  readonly fadeMs: number
}

export interface CompiledBipedPetWarpWindow extends BipedPetMotionWarpWindow {
  readonly maxDistanceWorld: number
}

export interface CompiledBipedPetMotionConstraint extends BipedPetMotionConstraint {
  readonly armReachWorld: number
  readonly targetPoint: StudioPropRigPoint
}

export interface CompiledBipedPetMotionEffectCue extends BipedPetMotionEffectCue {
  readonly points: readonly StudioPropRigPoint[]
}

export interface CompiledBipedPetMotionAdaptationPlan {
  readonly key: string
  readonly phases: readonly CompiledBipedPetMotionPhase[]
  readonly warpWindows: readonly CompiledBipedPetWarpWindow[]
  readonly constraints: readonly CompiledBipedPetMotionConstraint[]
  readonly effectCues: readonly CompiledBipedPetMotionEffectCue[]
  readonly diagnostics: readonly BipedPetMotionAdaptationDiagnostic[]
}

export interface SampledBipedPetMotionAdaptation {
  readonly requestedTimeMs: number
  readonly resolvedTimeMs: number
  readonly activePhaseIds: readonly string[]
  readonly constraintWeights: Readonly<Record<string, number>>
  readonly activeEffectCueIds: readonly string[]
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
const MOTION_ADAPTATION_FADE_MS = 120
const MAX_COMPILED_PLAN_CACHE_ENTRIES = 64
const MAX_CHARACTER_DIMENSION = 1000
const PHASE_ROLES = new Set<BipedPetMotionPhaseRole>(['prepare', 'spin', 'handoff', 'sweep', 'takeoff', 'impact', 'recover'])
const WARP_TARGETS = new Set<BipedPetMotionWarpTarget>(['stage-forward'])
const CONSTRAINT_KINDS = new Set<BipedPetMotionConstraintKind>(['secondary-grip'])
const LIMB_IDS = new Set<BipedPetMotionLimbId>(['arm.left', 'arm.right'])
const EFFECT_KINDS = new Set<BipedPetMotionEffectCueKind>(['weapon-trail', 'impact-sparks', 'impact-ring'])
const PROP_RIG_POINT_IDS = new Set<StudioPropRigPointId>(['primaryGrip', 'secondaryGrip', 'trailStart', 'trailEnd', 'impactPoint'])

const compiledPlanCache = new Map<string, CompiledBipedPetMotionAdaptationPlan>()

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

function inferAdaptationDurationMs(definition: unknown): number {
  try {
    const source = safeRecord(definition)
    if (!source) return 1200
    const phases = Reflect.get(source, 'phases')
    if (!Array.isArray(phases)) return 1200
    const length = Math.min(
      Number.isSafeInteger(Reflect.get(phases, 'length')) ? Reflect.get(phases, 'length') : 0,
      MAX_BIPED_PET_MOTION_ADAPTATION_PHASES,
    )
    let maximumEndMs = 0
    for (let index = 0; index < length; index += 1) {
      const phase = safeRecord(Reflect.get(phases, index))
      const endMs = phase ? Reflect.get(phase, 'endMs') : undefined
      if (typeof endMs === 'number' && Number.isFinite(endMs)) maximumEndMs = Math.max(maximumEndMs, endMs)
    }
    return normalizeMotionDurationMs(maximumEndMs || 1200)
  }
  catch {
    return 1200
  }
}

function stablePlanIdentity(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stablePlanIdentity).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort(compareCodePoints).map(key => `${JSON.stringify(key)}:${stablePlanIdentity(record[key])}`).join(',')}}`
}

function planHash(identity: string): string {
  let result = 2166136261
  for (const character of identity) {
    result ^= character.codePointAt(0)!
    result = Math.imul(result, 16777619)
  }
  return `bpma-${(result >>> 0).toString(16).padStart(8, '0')}`
}

function freezeCompiledPoint(point: StudioPropRigPoint): StudioPropRigPoint {
  return Object.freeze({
    position: Object.freeze([...point.position]) as readonly [number, number, number],
    rotation: Object.freeze([...point.rotation]) as StudioPropRigPoint['rotation'],
  })
}

function readPositiveDimension(
  value: unknown,
  fallback: number,
  id: string,
  label: string,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    warning(diagnostics, id, `${label}不是正有限数，已回退为 ${fallback}。`)
    return fallback
  }
  const normalized = clamp(value, Number.MIN_VALUE, MAX_CHARACTER_DIMENSION)
  if (normalized !== value) warning(diagnostics, `${id}-clamped`, `${label}已钳制到安全范围。`)
  return normalized
}

function readCompileInput(input: BipedPetMotionAdaptationCompileInput): {
  definition: unknown
  clipHash: string
  profileId: string
  characterHash: string
  characterHeight: number
  armReach: { left: number; right: number }
  propRigs?: Record<PropertyKey, unknown>
  diagnostics: BipedPetMotionAdaptationDiagnostic[]
} {
  const diagnostics: BipedPetMotionAdaptationDiagnostic[] = []
  const source = safeRecord(input)
  if (!source) {
    warning(diagnostics, 'motion-adaptation-compile-input-invalid', '动作适配计划输入不是对象，已使用安全空计划。')
    return {
      definition: undefined,
      clipHash: 'unknown-clip',
      profileId: 'unknown-profile',
      characterHash: 'unknown-character',
      characterHeight: 1,
      armReach: { left: 1, right: 1 },
      diagnostics,
    }
  }
  let fields: Record<string, unknown>
  try {
    fields = Object.fromEntries([
      'definition', 'clipHash', 'profileId', 'characterHash', 'characterHeight', 'armReach', 'propRigs',
    ].map(field => [field, Reflect.get(source, field)]))
  }
  catch {
    warning(diagnostics, 'motion-adaptation-compile-input-access-failed', '动作适配计划输入无法安全读取，已使用安全空计划。')
    return {
      definition: undefined,
      clipHash: 'unknown-clip',
      profileId: 'unknown-profile',
      characterHash: 'unknown-character',
      characterHeight: 1,
      armReach: { left: 1, right: 1 },
      diagnostics,
    }
  }
  const textIdentity = (value: unknown, fallback: string, id: string, label: string) => {
    if (typeof value === 'string' && value.trim()) return value.trim()
    warning(diagnostics, id, `${label}无效，已使用安全身份。`)
    return fallback
  }
  let leftReach: unknown
  let rightReach: unknown
  try {
    const reach = safeRecord(fields.armReach)
    leftReach = reach && Reflect.get(reach, 'left')
    rightReach = reach && Reflect.get(reach, 'right')
  }
  catch {
    warning(diagnostics, 'motion-adaptation-arm-reach-access-failed', '角色臂展无法安全读取，已使用安全尺寸。')
  }
  return {
    definition: fields.definition,
    clipHash: textIdentity(fields.clipHash, 'unknown-clip', 'motion-adaptation-clip-hash-invalid', 'Clip 哈希'),
    profileId: textIdentity(fields.profileId, 'unknown-profile', 'motion-adaptation-profile-id-invalid', 'Profile 身份'),
    characterHash: textIdentity(fields.characterHash, 'unknown-character', 'motion-adaptation-character-hash-invalid', '角色哈希'),
    characterHeight: readPositiveDimension(fields.characterHeight, 1, 'motion-adaptation-character-height-invalid', '角色高度', diagnostics),
    armReach: {
      left: readPositiveDimension(leftReach, 1, 'motion-adaptation-left-arm-reach-invalid', '左臂展', diagnostics),
      right: readPositiveDimension(rightReach, 1, 'motion-adaptation-right-arm-reach-invalid', '右臂展', diagnostics),
    },
    propRigs: safeRecord(fields.propRigs),
    diagnostics,
  }
}

function readPropRig(
  propRigs: Record<PropertyKey, unknown> | undefined,
  propInstanceId: string,
  diagnostics: BipedPetMotionAdaptationDiagnostic[],
): StudioPropRigDefinition {
  let candidate: unknown
  try {
    candidate = propRigs && Object.hasOwn(propRigs, propInstanceId)
      ? Reflect.get(propRigs, propInstanceId)
      : undefined
  }
  catch {
    warning(diagnostics, `motion-adaptation-prop-${propInstanceId}-access-failed`, `动作适配道具 ${propInstanceId} 无法安全读取，已关闭关联增强。`)
  }
  const normalized = normalizeStudioPropRig(candidate)
  for (const diagnostic of normalized.diagnostics) {
    warning(diagnostics, `motion-adaptation-prop-${propInstanceId}-${diagnostic.id}`, `道具 ${propInstanceId}：${diagnostic.message}`)
  }
  return normalized.value
}

function compiledPoint(
  rig: StudioPropRigDefinition,
  pointId: string,
): StudioPropRigPoint | undefined {
  if (!PROP_RIG_POINT_IDS.has(pointId as StudioPropRigPointId)) return undefined
  return rig[pointId as StudioPropRigPointId]
}

/**
 * 把规范化动作意图按当前角色和道具尺寸编译为可缓存的纯数值计划。
 * 缺失语义点只移除依赖它的增强，基础动作、阶段和 Warp 继续可用。
 */
export function compileBipedPetMotionAdaptationPlan(
  input: BipedPetMotionAdaptationCompileInput,
): CompiledBipedPetMotionAdaptationPlan {
  const safeInput = readCompileInput(input)
  const normalized = normalizeBipedPetMotionAdaptation(
    safeInput.definition,
    inferAdaptationDurationMs(safeInput.definition),
  )
  const diagnostics = [...safeInput.diagnostics, ...normalized.diagnostics]
  const definition = normalized.value
  const propIds = [...new Set([
    ...definition.constraints.map(item => item.propInstanceId),
    ...definition.effectCues.map(item => item.propInstanceId),
  ])].sort(compareCodePoints)
  const rigs = new Map<string, StudioPropRigDefinition>()
  for (const propInstanceId of propIds) {
    rigs.set(propInstanceId, readPropRig(safeInput.propRigs, propInstanceId, diagnostics))
  }

  const phases = definition.phases.map((phase): CompiledBipedPetMotionPhase => Object.freeze({
    ...phase,
    fadeMs: Math.min(MOTION_ADAPTATION_FADE_MS, (phase.endMs - phase.startMs) / 2),
  }))
  const warpWindows = definition.warpWindows.map((window): CompiledBipedPetWarpWindow => Object.freeze({
    ...window,
    maxDistanceWorld: window.maxDistance * safeInput.characterHeight,
  }))
  const constraints = definition.constraints.flatMap((constraint): CompiledBipedPetMotionConstraint[] => {
    const targetPoint = compiledPoint(rigs.get(constraint.propInstanceId)!, constraint.pointId)
    if (!targetPoint) {
      warning(
        diagnostics,
        `motion-adaptation-constraint-${constraint.id}-point-missing`,
        `动作适配约束 ${constraint.id} 缺少道具语义点 ${constraint.pointId}，已关闭该约束。`,
      )
      return []
    }
    return [Object.freeze({
      ...constraint,
      armReachWorld: constraint.limbId === 'arm.left' ? safeInput.armReach.left : safeInput.armReach.right,
      targetPoint: freezeCompiledPoint(targetPoint),
    })]
  })
  const effectCues = definition.effectCues.flatMap((cue): CompiledBipedPetMotionEffectCue[] => {
    const rig = rigs.get(cue.propInstanceId)!
    const points = cue.pointIds.map(pointId => compiledPoint(rig, pointId))
    if (points.some(point => !point)) {
      warning(
        diagnostics,
        `motion-adaptation-effect-${cue.id}-point-missing`,
        `动作适配特效 ${cue.id} 缺少所需道具语义点，已关闭该特效。`,
      )
      return []
    }
    return [Object.freeze({
      ...cue,
      pointIds: Object.freeze([...cue.pointIds]),
      points: Object.freeze(points.map(point => freezeCompiledPoint(point!))),
    })]
  })
  const identity = stablePlanIdentity({
    clipHash: safeInput.clipHash,
    profileId: safeInput.profileId,
    characterHash: safeInput.characterHash,
    characterHeight: safeInput.characterHeight,
    armReach: safeInput.armReach,
    definition,
    propRigs: propIds.map(propInstanceId => ({ propInstanceId, rig: rigs.get(propInstanceId) })),
    diagnostics,
  })
  const cached = compiledPlanCache.get(identity)
  if (cached) {
    compiledPlanCache.delete(identity)
    compiledPlanCache.set(identity, cached)
    return cached
  }
  const plan = Object.freeze({
    key: planHash(identity),
    phases: Object.freeze(phases),
    warpWindows: Object.freeze(warpWindows),
    constraints: Object.freeze(constraints),
    effectCues: Object.freeze(effectCues),
    diagnostics: Object.freeze(diagnostics.map(item => Object.freeze({ ...item }))),
  })
  compiledPlanCache.set(identity, plan)
  if (compiledPlanCache.size > MAX_COMPILED_PLAN_CACHE_ENTRIES) {
    const oldestKey = compiledPlanCache.keys().next().value
    if (oldestKey !== undefined) compiledPlanCache.delete(oldestKey)
  }
  return plan
}

function smoothstep(progress: number): number {
  const value = clamp(progress, 0, 1)
  return value * value * (3 - 2 * value)
}

function sampledPhaseWeight(phase: CompiledBipedPetMotionPhase, timeMs: number): number {
  if (timeMs < phase.startMs || timeMs > phase.endMs) return 0
  if (phase.fadeMs <= 0) return phase.intensity
  const fadeIn = smoothstep((timeMs - phase.startMs) / phase.fadeMs)
  const fadeOut = smoothstep((phase.endMs - timeMs) / phase.fadeMs)
  return phase.intensity * Math.min(fadeIn, fadeOut)
}

/** 在调用方已经解析循环时间后采样阶段、约束权重与特效提示；函数不持有播放状态。 */
export function sampleBipedPetMotionAdaptation(
  plan: CompiledBipedPetMotionAdaptationPlan,
  requestedTimeMs: number,
  resolvedTimeMs: number,
): SampledBipedPetMotionAdaptation {
  const safeRequestedTimeMs = typeof requestedTimeMs === 'number' && Number.isFinite(requestedTimeMs) ? requestedTimeMs : 0
  const safeResolvedTimeMs = typeof resolvedTimeMs === 'number' && Number.isFinite(resolvedTimeMs) ? resolvedTimeMs : 0
  const phaseWeights = new Map<string, number>()
  const activePhaseIds: string[] = []
  for (const phase of plan.phases) {
    if (safeResolvedTimeMs < phase.startMs || safeResolvedTimeMs > phase.endMs) continue
    activePhaseIds.push(phase.id)
    phaseWeights.set(phase.id, sampledPhaseWeight(phase, safeResolvedTimeMs))
  }
  const constraintWeights = Object.fromEntries(plan.constraints.flatMap((constraint) => {
    if (!phaseWeights.has(constraint.phaseId)) return []
    return [[constraint.id, constraint.weight * phaseWeights.get(constraint.phaseId)!]]
  }))
  const activeEffectCueIds = plan.effectCues
    .filter(cue => phaseWeights.has(cue.phaseId))
    .map(cue => cue.id)
  return Object.freeze({
    requestedTimeMs: safeRequestedTimeMs,
    resolvedTimeMs: safeResolvedTimeMs,
    activePhaseIds: Object.freeze(activePhaseIds),
    constraintWeights: Object.freeze(constraintWeights),
    activeEffectCueIds: Object.freeze(activeEffectCueIds),
  })
}
