/**
 * 文件职责 / File responsibility
 * 定义参数化道具的动作语义点，并在缺少显式扩展时从站内几何与锚点推导安全 Rig。
 */

import { motionEulerToQuaternion, normalizeMotionQuaternion, type MotionQuaternion } from '../motion/quaternion-motion'
import { STUDIO_PROP_COMPONENT_LIMIT, type StudioPropAssetV2, type StudioPropPrimitive } from './prop-asset'

export const STUDIO_PROP_RIG_NAMESPACE = 'yk-pets/prop-rig/v1' as const

export type StudioPropRigPointId = 'primaryGrip' | 'secondaryGrip' | 'trailStart' | 'trailEnd' | 'impactPoint'
export type StudioPropRigStatus = 'ready' | 'derived' | 'primary-only'

export interface StudioPropRigPoint {
  readonly position: readonly [number, number, number]
  readonly rotation: MotionQuaternion
}

export interface StudioPropRigDefinition {
  readonly primaryGrip: StudioPropRigPoint
  readonly secondaryGrip?: StudioPropRigPoint
  readonly trailStart?: StudioPropRigPoint
  readonly trailEnd?: StudioPropRigPoint
  readonly impactPoint?: StudioPropRigPoint
}

export interface StudioPropRigDiagnostic {
  readonly id: string
  readonly severity: 'warning'
  readonly message: string
}

export interface StudioPropRigNormalizationResult {
  readonly status: 'ready' | 'primary-only'
  readonly value: StudioPropRigDefinition
  readonly diagnostics: readonly StudioPropRigDiagnostic[]
}

export interface StudioPropRigResolution {
  readonly status: StudioPropRigStatus
  readonly value: StudioPropRigDefinition
  readonly diagnostics: readonly StudioPropRigDiagnostic[]
}

type MutableRigDefinition = {
  primaryGrip: StudioPropRigPoint
  secondaryGrip?: StudioPropRigPoint
  trailStart?: StudioPropRigPoint
  trailEnd?: StudioPropRigPoint
  impactPoint?: StudioPropRigPoint
}

type Vector3 = [number, number, number]
type Matrix3 = [number, number, number, number, number, number, number, number, number]

interface SafePropComponent {
  readonly id: string
  readonly parentId?: string
  readonly visible: boolean
  readonly position: Vector3
  readonly linear: Matrix3
  readonly halfSize?: Vector3
}

interface ResolvedPropComponentTransform {
  readonly visible: boolean
  readonly position: Vector3
  readonly linear: Matrix3
}

const MAX_COORDINATE = 20
const MAX_RIG_DIAGNOSTICS = 32
const PRIMARY_AXIS_DOMINANCE_RATIO = 1.35
const IDENTITY_QUATERNION = Object.freeze([0, 0, 0, 1]) as MotionQuaternion
const SUPPORTED_PRIMITIVES = new Set<StudioPropPrimitive>(['sphere', 'box', 'cylinder', 'cone', 'torus', 'capsule', 'crystal', 'text', 'particles'])

function warning(diagnostics: StudioPropRigDiagnostic[], id: string, message: string): void {
  if (diagnostics.length >= MAX_RIG_DIAGNOSTICS) return
  diagnostics.push({ id, severity: 'warning', message })
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

function readFiniteTuple(value: unknown, length: 3 | 4): number[] | undefined {
  try {
    if (!Array.isArray(value) || Reflect.get(value, 'length') !== length) return undefined
    const tuple: number[] = []
    for (let index = 0; index < length; index += 1) {
      const item = Reflect.get(value, index)
      if (typeof item !== 'number' || !Number.isFinite(item)) return undefined
      tuple.push(item)
    }
    return tuple
  }
  catch {
    return undefined
  }
}

function freezeDiagnostics(diagnostics: readonly StudioPropRigDiagnostic[]): readonly StudioPropRigDiagnostic[] {
  return Object.freeze(diagnostics.map(item => Object.freeze({ ...item })))
}

function freezePoint(point: StudioPropRigPoint): StudioPropRigPoint {
  return Object.freeze({
    position: Object.freeze([...point.position]) as readonly [number, number, number],
    rotation: Object.freeze([...point.rotation]) as MotionQuaternion,
  })
}

function freezeDefinition(value: MutableRigDefinition): StudioPropRigDefinition {
  return Object.freeze({
    primaryGrip: freezePoint(value.primaryGrip),
    ...(value.secondaryGrip ? { secondaryGrip: freezePoint(value.secondaryGrip) } : {}),
    ...(value.trailStart ? { trailStart: freezePoint(value.trailStart) } : {}),
    ...(value.trailEnd ? { trailEnd: freezePoint(value.trailEnd) } : {}),
    ...(value.impactPoint ? { impactPoint: freezePoint(value.impactPoint) } : {}),
  })
}

function normalizePoint(
  input: unknown,
  pointId: StudioPropRigPointId,
  diagnostics: StudioPropRigDiagnostic[],
): StudioPropRigPoint | undefined {
  const source = safeRecord(input)
  if (!source) {
    warning(diagnostics, `prop-rig-${pointId}-invalid`, `道具 Rig 的 ${pointId} 不是对象，已忽略。`)
    return undefined
  }
  let positionInput: unknown
  let rotationInput: unknown
  try {
    positionInput = Reflect.get(source, 'position')
    rotationInput = Reflect.get(source, 'rotation')
  }
  catch {
    warning(diagnostics, `prop-rig-${pointId}-access-failed`, `道具 Rig 的 ${pointId} 无法安全读取，已忽略。`)
    return undefined
  }
  const positionTuple = readFiniteTuple(positionInput, 3)
  const rotationTuple = readFiniteTuple(rotationInput, 4)
  if (!positionTuple) {
    warning(diagnostics, `prop-rig-${pointId}-position-invalid`, `道具 Rig 的 ${pointId} 位置不是有限三元组，已忽略。`)
    return undefined
  }
  if (!rotationTuple) {
    warning(diagnostics, `prop-rig-${pointId}-rotation-invalid`, `道具 Rig 的 ${pointId} 旋转不是有限四元组，已忽略。`)
    return undefined
  }
  const position = positionTuple.map(value => Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value))) as Vector3
  if (position.some((value, index) => value !== positionTuple[index])) {
    warning(diagnostics, `prop-rig-${pointId}-position-clamped`, `道具 Rig 的 ${pointId} 位置已钳制到安全范围。`)
  }
  const quaternionLength = Math.hypot(...rotationTuple)
  const rotationDegenerate = !Number.isFinite(quaternionLength) || quaternionLength <= 1e-12
  const rotation = rotationDegenerate
    ? [...IDENTITY_QUATERNION] as MotionQuaternion
    : normalizeMotionQuaternion(rotationTuple)
  if (rotationDegenerate) {
    warning(diagnostics, `prop-rig-${pointId}-rotation-degenerate`, `道具 Rig 的 ${pointId} 使用退化 Quaternion，已回退单位旋转。`)
  }
  return { position, rotation }
}

function readPoint(
  source: Record<PropertyKey, unknown>,
  pointId: StudioPropRigPointId,
  diagnostics: StudioPropRigDiagnostic[],
): { present: boolean; value?: StudioPropRigPoint } {
  try {
    const input = Reflect.get(source, pointId)
    if (input === undefined) return { present: false }
    return { present: true, value: normalizePoint(input, pointId, diagnostics) }
  }
  catch {
    warning(diagnostics, `prop-rig-${pointId}-access-failed`, `道具 Rig 的 ${pointId} 无法安全读取，已忽略。`)
    return { present: true }
  }
}

function normalizationResult(
  status: 'ready' | 'primary-only',
  value: StudioPropRigDefinition,
  diagnostics: readonly StudioPropRigDiagnostic[],
): StudioPropRigNormalizationResult {
  return Object.freeze({ status, value, diagnostics: freezeDiagnostics(diagnostics) })
}

function resolution(
  status: StudioPropRigStatus,
  value: StudioPropRigDefinition,
  diagnostics: readonly StudioPropRigDiagnostic[],
): StudioPropRigResolution {
  return Object.freeze({ status, value, diagnostics: freezeDiagnostics(diagnostics) })
}

/** 把不可信显式五点定义复制为只读单位 Quaternion 契约。五点不完整时安全退回主握点。 */
export function normalizeStudioPropRig(input: unknown): StudioPropRigNormalizationResult {
  const diagnostics: StudioPropRigDiagnostic[] = []
  const source = safeRecord(input)
  if (!source) {
    if (input !== undefined) warning(diagnostics, 'prop-rig-input-invalid', '道具 Rig 扩展不是对象，已回退主握点。')
    return normalizationResult('primary-only', freezeDefinition({
      primaryGrip: { position: [0, 0, 0], rotation: IDENTITY_QUATERNION },
    }), diagnostics)
  }

  const primary = readPoint(source, 'primaryGrip', diagnostics)
  const secondary = readPoint(source, 'secondaryGrip', diagnostics)
  const trailStart = readPoint(source, 'trailStart', diagnostics)
  const trailEnd = readPoint(source, 'trailEnd', diagnostics)
  const impactPoint = readPoint(source, 'impactPoint', diagnostics)
  if (!primary.present) warning(diagnostics, 'prop-rig-primaryGrip-missing', '道具 Rig 缺少 primaryGrip，已使用安全回退。')
  const primaryGrip = primary.value ?? { position: [0, 0, 0] as Vector3, rotation: IDENTITY_QUATERNION }
  const complete = Boolean(primary.value && secondary.value && trailStart.value && trailEnd.value && impactPoint.value)
  if (!complete) {
    if (secondary.present || trailStart.present || trailEnd.present || impactPoint.present) {
      warning(diagnostics, 'prop-rig-points-incomplete', '道具 Rig 五个语义点不完整，已仅保留主握点。')
    }
    return normalizationResult('primary-only', freezeDefinition({ primaryGrip }), diagnostics)
  }
  return normalizationResult('ready', freezeDefinition({
    primaryGrip,
    secondaryGrip: secondary.value,
    trailStart: trailStart.value,
    trailEnd: trailEnd.value,
    impactPoint: impactPoint.value,
  }), diagnostics)
}

function multiplyMatrix(left: Matrix3, right: Matrix3): Matrix3 {
  const result = Array<number>(9).fill(0)
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = left[row * 3]! * right[column]!
        + left[row * 3 + 1]! * right[3 + column]!
        + left[row * 3 + 2]! * right[6 + column]!
    }
  }
  return result as Matrix3
}

function transformVector(matrix: Matrix3, vector: Vector3): Vector3 {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ]
}

function addVector(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

function quaternionScaleMatrix(rotation: MotionQuaternion, scale: Vector3): Matrix3 {
  const [x, y, z, w] = rotation
  const xx = x * x
  const yy = y * y
  const zz = z * z
  const xy = x * y
  const xz = x * z
  const yz = y * z
  const wx = w * x
  const wy = w * y
  const wz = w * z
  return [
    (1 - 2 * (yy + zz)) * scale[0], (2 * (xy - wz)) * scale[1], (2 * (xz + wy)) * scale[2],
    (2 * (xy + wz)) * scale[0], (1 - 2 * (xx + zz)) * scale[1], (2 * (yz - wx)) * scale[2],
    (2 * (xz - wy)) * scale[0], (2 * (yz + wx)) * scale[1], (1 - 2 * (xx + yy)) * scale[2],
  ]
}

function halfSizeForPrimitive(primitive: StudioPropPrimitive, geometry: Record<PropertyKey, unknown>): Vector3 | undefined {
  const finitePositive = (key: string): number | undefined => {
    try {
      const value = Reflect.get(geometry, key)
      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
    }
    catch {
      return undefined
    }
  }
  const radius = finitePositive('radius')
  const width = finitePositive('width')
  const height = finitePositive('height')
  const depth = finitePositive('depth')
  if (primitive === 'particles') return undefined
  if (primitive === 'sphere') return radius === undefined ? undefined : [radius, radius, radius]
  if (primitive === 'cylinder' || primitive === 'cone' || primitive === 'capsule') {
    return radius === undefined || height === undefined ? undefined : [radius, height / 2, radius]
  }
  if (primitive === 'torus') {
    const tube = finitePositive('tube')
    return radius === undefined || tube === undefined ? undefined : [radius + tube, radius + tube, tube]
  }
  return width === undefined || height === undefined || depth === undefined
    ? undefined
    : [width / 2, height / 2, primitive === 'text' ? Math.min(depth, .06) / 2 : depth / 2]
}

function safeComponent(input: unknown, index: number, diagnostics: StudioPropRigDiagnostic[]): SafePropComponent | undefined {
  const source = safeRecord(input)
  if (!source) {
    warning(diagnostics, `prop-rig-component-${index}-invalid`, `道具组件 ${index} 不是对象，已忽略。`)
    return undefined
  }
  try {
    const id = Reflect.get(source, 'id')
    const parentId = Reflect.get(source, 'parentId')
    const primitive = Reflect.get(source, 'primitive')
    const transform = safeRecord(Reflect.get(source, 'transform'))
    const geometry = safeRecord(Reflect.get(source, 'geometry'))
    if (typeof id !== 'string' || !id || !transform || !geometry) throw new TypeError('invalid component')
    const position = readFiniteTuple(Reflect.get(transform, 'position'), 3)
    const rotation = readFiniteTuple(Reflect.get(transform, 'rotation'), 3)
    const scale = readFiniteTuple(Reflect.get(transform, 'scale'), 3)
    if (!position || !rotation || !scale) throw new TypeError('invalid transform')
    if (!SUPPORTED_PRIMITIVES.has(primitive as StudioPropPrimitive)) throw new TypeError('invalid primitive')
    return {
      id,
      ...(typeof parentId === 'string' && parentId ? { parentId } : {}),
      visible: Reflect.get(source, 'visible') !== false,
      position: position as Vector3,
      linear: quaternionScaleMatrix(motionEulerToQuaternion(rotation as Vector3), scale as Vector3),
      halfSize: halfSizeForPrimitive(primitive as StudioPropPrimitive, geometry),
    }
  }
  catch {
    warning(diagnostics, `prop-rig-component-${index}-access-failed`, `道具组件 ${index} 无法安全读取，已忽略。`)
    return undefined
  }
}

function readComponents(asset: StudioPropAssetV2, diagnostics: StudioPropRigDiagnostic[]): SafePropComponent[] {
  try {
    const input = Reflect.get(asset, 'components')
    if (!Array.isArray(input)) throw new TypeError('invalid components')
    const length = Reflect.get(input, 'length')
    if (!Number.isSafeInteger(length) || length < 0) throw new TypeError('invalid length')
    if (length > STUDIO_PROP_COMPONENT_LIMIT) {
      warning(diagnostics, 'prop-rig-components-budget-exceeded', `道具 Rig 仅分析前 ${STUDIO_PROP_COMPONENT_LIMIT} 个组件。`)
    }
    const components: SafePropComponent[] = []
    for (let index = 0; index < Math.min(length, STUDIO_PROP_COMPONENT_LIMIT); index += 1) {
      const component = safeComponent(Reflect.get(input, index), index, diagnostics)
      if (component) components.push(component)
    }
    return components
  }
  catch {
    warning(diagnostics, 'prop-rig-components-access-failed', '道具参数化组件无法安全读取，已停止自动推导。')
    return []
  }
}

function primaryGripFromAsset(asset: StudioPropAssetV2, diagnostics: StudioPropRigDiagnostic[]): StudioPropRigPoint {
  try {
    const anchors = Reflect.get(asset, 'anchors')
    if (!Array.isArray(anchors)) throw new TypeError('invalid anchors')
    const length = Math.min(Number(Reflect.get(anchors, 'length')) || 0, 16)
    for (let index = 0; index < length; index += 1) {
      const anchor = safeRecord(Reflect.get(anchors, index))
      if (!anchor || Reflect.get(anchor, 'id') !== 'grip') continue
      const transform = safeRecord(Reflect.get(anchor, 'transform'))
      if (!transform) break
      const position = readFiniteTuple(Reflect.get(transform, 'position'), 3)
      const rotation = readFiniteTuple(Reflect.get(transform, 'rotation'), 3)
      if (position && rotation) return { position: position as Vector3, rotation: motionEulerToQuaternion(rotation as Vector3) }
      break
    }
  }
  catch {
    warning(diagnostics, 'prop-rig-grip-anchor-access-failed', '道具 grip 锚点无法安全读取，已使用原点主握点。')
  }
  return { position: [0, 0, 0], rotation: IDENTITY_QUATERNION }
}

function readExplicitExtension(
  asset: StudioPropAssetV2,
  diagnostics: StudioPropRigDiagnostic[],
): { present: boolean; value?: unknown } {
  try {
    const extensions = Reflect.get(asset, 'extensions')
    if (extensions === undefined) return { present: false }
    const source = safeRecord(extensions)
    if (!source) {
      warning(diagnostics, 'prop-rig-extension-invalid', '道具 extensions 不是对象，已回退自动推导。')
      return { present: true }
    }
    return { present: true, value: Reflect.get(source, STUDIO_PROP_RIG_NAMESPACE) }
  }
  catch {
    warning(diagnostics, 'prop-rig-extension-access-failed', '道具 Rig 扩展无法安全读取，已回退自动推导。')
    return { present: true }
  }
}

function deriveFromGeometry(
  asset: StudioPropAssetV2,
  primaryGrip: StudioPropRigPoint,
  diagnostics: StudioPropRigDiagnostic[],
): StudioPropRigResolution {
  const components = readComponents(asset, diagnostics)
  const byId = new Map(components.map(component => [component.id, component]))
  const resolved = new Map<string, ResolvedPropComponentTransform>()
  const resolving = new Set<string>()
  const resolveTransform = (component: SafePropComponent): ResolvedPropComponentTransform | undefined => {
    const cached = resolved.get(component.id)
    if (cached) return cached
    if (resolving.has(component.id)) return undefined
    resolving.add(component.id)
    const parent = component.parentId ? byId.get(component.parentId) : undefined
    const parentTransform = parent ? resolveTransform(parent) : undefined
    const value = parent && !parentTransform
      ? undefined
      : {
          visible: component.visible && (parentTransform?.visible ?? true),
          position: parentTransform
            ? addVector(parentTransform.position, transformVector(parentTransform.linear, component.position))
            : [...component.position] as Vector3,
          linear: parentTransform ? multiplyMatrix(parentTransform.linear, component.linear) : [...component.linear] as Matrix3,
        }
    resolving.delete(component.id)
    if (value) resolved.set(component.id, value)
    return value
  }

  const minimum: Vector3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const maximum: Vector3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  let boundedComponentCount = 0
  for (const component of components) {
    const transform = resolveTransform(component)
    if (!transform?.visible || !component.halfSize) continue
    const halfExtent: Vector3 = [
      Math.abs(transform.linear[0]) * component.halfSize[0] + Math.abs(transform.linear[1]) * component.halfSize[1] + Math.abs(transform.linear[2]) * component.halfSize[2],
      Math.abs(transform.linear[3]) * component.halfSize[0] + Math.abs(transform.linear[4]) * component.halfSize[1] + Math.abs(transform.linear[5]) * component.halfSize[2],
      Math.abs(transform.linear[6]) * component.halfSize[0] + Math.abs(transform.linear[7]) * component.halfSize[1] + Math.abs(transform.linear[8]) * component.halfSize[2],
    ]
    if (![...transform.position, ...halfExtent].every(Number.isFinite)) continue
    boundedComponentCount += 1
    for (const axis of [0, 1, 2] as const) {
      minimum[axis] = Math.min(minimum[axis], transform.position[axis] - halfExtent[axis])
      maximum[axis] = Math.max(maximum[axis], transform.position[axis] + halfExtent[axis])
    }
  }
  if (!boundedComponentCount) {
    warning(diagnostics, 'prop-rig-geometry-unavailable', '道具缺少可证明的参数化几何，已仅保留主握点。')
    return resolution('primary-only', freezeDefinition({ primaryGrip }), diagnostics)
  }

  const dimensions: Vector3 = [maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]]
  const orderedAxes = ([0, 1, 2] as Array<0 | 1 | 2>).sort((left, right) => dimensions[right] - dimensions[left])
  const axis = orderedAxes[0] ?? 0
  const secondAxis = orderedAxes[1] ?? 1
  if (!(dimensions[axis] > 1e-6 && dimensions[axis] > dimensions[secondAxis] * PRIMARY_AXIS_DOMINANCE_RATIO)) {
    warning(diagnostics, 'prop-rig-primary-axis-ambiguous', '道具没有稳定的最长主轴，已仅保留主握点。')
    return resolution('primary-only', freezeDefinition({ primaryGrip }), diagnostics)
  }

  const center: Vector3 = [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ]
  const start: Vector3 = [...center]
  const end: Vector3 = [...center]
  const secondary: Vector3 = [...center]
  start[axis] = minimum[axis]
  end[axis] = maximum[axis]
  secondary[axis] = minimum[axis] + dimensions[axis] * .35
  const trailStart = { position: start, rotation: IDENTITY_QUATERNION }
  const trailEnd = { position: end, rotation: IDENTITY_QUATERNION }
  return resolution('derived', freezeDefinition({
    primaryGrip,
    secondaryGrip: { position: secondary, rotation: IDENTITY_QUATERNION },
    trailStart,
    trailEnd,
    impactPoint: trailEnd,
  }), diagnostics)
}

/**
 * 只读取站内参数化组件和锚点。最长轴不明显时保守返回 primary-only，不读取 localModel。
 */
export function deriveStudioPropRig(asset: StudioPropAssetV2): StudioPropRigResolution {
  const diagnostics: StudioPropRigDiagnostic[] = []
  const primaryGrip = primaryGripFromAsset(asset, diagnostics)
  const extension = readExplicitExtension(asset, diagnostics)
  if (extension.present && extension.value !== undefined) {
    const explicit = normalizeStudioPropRig(extension.value)
    for (const item of explicit.diagnostics) warning(diagnostics, item.id, item.message)
    if (explicit.status === 'ready') return resolution('ready', explicit.value, diagnostics)
    warning(diagnostics, 'prop-rig-extension-incomplete-fallback', '显式道具 Rig 不完整，已回退参数化几何推导。')
    const explicitPrimaryInvalid = explicit.diagnostics.some(item => item.id === 'prop-rig-input-invalid'
      || item.id.startsWith('prop-rig-primaryGrip-invalid')
      || item.id.startsWith('prop-rig-primaryGrip-missing')
      || item.id.startsWith('prop-rig-primaryGrip-access-failed')
      || item.id.startsWith('prop-rig-primaryGrip-position-invalid')
      || item.id.startsWith('prop-rig-primaryGrip-rotation-invalid'))
    return deriveFromGeometry(asset, explicitPrimaryInvalid ? primaryGrip : explicit.value.primaryGrip, diagnostics)
  }
  return deriveFromGeometry(asset, primaryGrip, diagnostics)
}
