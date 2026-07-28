/**
 * 文件职责 / File responsibility
 * 定义双足萌宠版本兼容的 Root Motion 扩展契约，并把不可信持久化输入规范化为安全定义。
 */

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
