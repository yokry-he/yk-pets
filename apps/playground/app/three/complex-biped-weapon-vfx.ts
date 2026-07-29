/**
 * 文件职责 / File responsibility
 * 在复杂双足角色的同级 Three 场景中维护确定、有界且可完整释放的持械轨迹与命中特效对象池。
 */

import {
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three'
import type { BipedPetWeaponVfxKind, BipedPetWeaponVfxSignal } from '@yk-pets/pet-core'

export interface ComplexBipedWeaponVfxFrame {
  readonly requestedTimeMs: number
  readonly characterHeight: number
}

export interface ComplexBipedWeaponVfxSnapshot {
  readonly activeTotal: number
  readonly activeByKind: Readonly<Record<BipedPetWeaponVfxKind, number>>
  readonly poolCapacityTotal: number
  readonly poolCapacityByKind: Readonly<Record<BipedPetWeaponVfxKind, number>>
  readonly unavailableKinds: readonly BipedPetWeaponVfxKind[]
  readonly disposed: boolean
}

export interface ComplexBipedWeaponVfxController {
  readonly object: Group
  apply(signals: readonly BipedPetWeaponVfxSignal[], frame: ComplexBipedWeaponVfxFrame): void
  snapshot(): ComplexBipedWeaponVfxSnapshot
  reset(): void
  dispose(): void
}

export interface ComplexBipedWeaponVfxControllerOptions {
  readonly createGeometry?: (
    kind: BipedPetWeaponVfxKind,
    createDefault: () => BufferGeometry,
  ) => BufferGeometry
  readonly createMaterial?: (
    kind: BipedPetWeaponVfxKind,
    createDefault: () => Material,
  ) => Material
  readonly attachObject?: (
    kind: BipedPetWeaponVfxKind,
    group: Group,
    child: Object3D,
  ) => void
}

const EFFECT_KINDS = Object.freeze([
  'weapon-trail',
  'impact-sparks',
  'impact-ring',
] as const satisfies readonly BipedPetWeaponVfxKind[])

const POOL_CAPACITY = Object.freeze({
  'weapon-trail': 24,
  'impact-sparks': 32,
  'impact-ring': 8,
}) satisfies Readonly<Record<BipedPetWeaponVfxKind, number>>

const EFFECT_LABEL = Object.freeze({
  'weapon-trail': '轨迹段',
  'impact-sparks': '命中火花',
  'impact-ring': '冲击环',
}) satisfies Readonly<Record<BipedPetWeaponVfxKind, string>>

const EFFECT_COLOR = Object.freeze({
  'weapon-trail': '#7ff5ff',
  'impact-sparks': '#ffd27a',
  'impact-ring': '#9cf8ff',
}) satisfies Readonly<Record<BipedPetWeaponVfxKind, ColorRepresentation>>

const MAX_SIGNAL_INPUTS_PER_FRAME = 128
const MAX_SIGNAL_LIFETIME_MS = 2000
const MAX_SPARKS_PER_SIGNAL = 16
const MAX_RECENT_SIGNAL_IDS = 512
const ZERO_MATRIX = new Matrix4().makeScale(0, 0, 0)

interface ActiveWeaponEffect {
  active: boolean
  id: string
  startTimeMs: number
  expiresTimeMs: number
  strength: number
  startX: number
  startY: number
  startZ: number
  endX: number
  endY: number
  endZ: number
  particleIndex: number
  activationSerial: number
}

interface WeaponEffectPoolBase {
  kind: BipedPetWeaponVfxKind
  geometry: BufferGeometry
  material: Material
  slots: ActiveWeaponEffect[]
}

interface MeshWeaponEffectPool extends WeaponEffectPoolBase {
  storage: 'meshes'
  meshes: Mesh[]
}

interface InstancedWeaponEffectPool extends WeaponEffectPoolBase {
  storage: 'instanced'
  mesh: InstancedMesh
}

type WeaponEffectPool = MeshWeaponEffectPool | InstancedWeaponEffectPool

interface SafeWeaponSignal {
  id: string
  kind: BipedPetWeaponVfxKind
  requestedTimeMs: number
  expiresTimeMs: number
  strength: number
  points: readonly (readonly [number, number, number])[]
}

const isEffectKind = (value: unknown): value is BipedPetWeaponVfxKind => (
  typeof value === 'string' && (EFFECT_KINDS as readonly string[]).includes(value)
)

const safeErrorDetail = (error: unknown): string => {
  try { return String(error instanceof Error ? error.message : error) }
  catch { return '未知错误' }
}

function createDefaultGeometry(kind: BipedPetWeaponVfxKind): BufferGeometry {
  if (kind === 'weapon-trail') return new PlaneGeometry(1, 1)
  if (kind === 'impact-sparks') return new SphereGeometry(1, 5, 3)
  return new RingGeometry(.65, 1, 32)
}

function createDefaultMaterial(kind: BipedPetWeaponVfxKind): Material {
  return new MeshBasicMaterial({
    color: EFFECT_COLOR[kind],
    transparent: true,
    opacity: kind === 'weapon-trail' ? .34 : .82,
    depthWrite: false,
    side: DoubleSide,
  })
}

function createSlots(capacity: number): ActiveWeaponEffect[] {
  return Array.from({ length: capacity }, () => ({
    active: false,
    id: '',
    startTimeMs: 0,
    expiresTimeMs: 0,
    strength: 0,
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    particleIndex: 0,
    activationSerial: 0,
  }))
}

function safeFrame(frame: ComplexBipedWeaponVfxFrame): { requestedTimeMs: number; characterHeight: number } | undefined {
  try {
    if (!frame || typeof frame !== 'object') return undefined
    const source = frame as unknown as Record<PropertyKey, unknown>
    const requestedTimeMs = Reflect.get(source, 'requestedTimeMs')
    const characterHeight = Reflect.get(source, 'characterHeight')
    if (typeof requestedTimeMs !== 'number' || !Number.isFinite(requestedTimeMs) || requestedTimeMs < 0
      || typeof characterHeight !== 'number' || !Number.isFinite(characterHeight) || !(characterHeight > 0)) return undefined
    return { requestedTimeMs, characterHeight }
  }
  catch {
    return undefined
  }
}

function safePoint(candidate: unknown): readonly [number, number, number] | undefined {
  try {
    if (!Array.isArray(candidate) || Reflect.get(candidate, 'length') !== 3) return undefined
    const point = [Reflect.get(candidate, 0), Reflect.get(candidate, 1), Reflect.get(candidate, 2)]
    if (!point.every(value => typeof value === 'number' && Number.isFinite(value))) return undefined
    return point as [number, number, number]
  }
  catch {
    return undefined
  }
}

function safeSignal(value: unknown, frameTimeMs: number): SafeWeaponSignal | undefined {
  try {
    if (!value || typeof value !== 'object') return undefined
    const source = value as Record<PropertyKey, unknown>
    const id = Reflect.get(source, 'id')
    const kind = Reflect.get(source, 'kind')
    const requestedTimeMs = Reflect.get(source, 'requestedTimeMs')
    const strength = Reflect.get(source, 'strength')
    const lifetimeMs = Reflect.get(source, 'lifetimeMs')
    const candidates = Reflect.get(source, 'points')
    if (typeof id !== 'string' || !id || id.length > 512 || !isEffectKind(kind)
      || typeof requestedTimeMs !== 'number' || !Number.isFinite(requestedTimeMs) || requestedTimeMs < 0 || requestedTimeMs > frameTimeMs
      || typeof strength !== 'number' || !Number.isFinite(strength) || !(strength > 0)
      || typeof lifetimeMs !== 'number' || !Number.isFinite(lifetimeMs) || !(lifetimeMs > 0)
      || !Array.isArray(candidates)) return undefined
    const expectedPointCount = kind === 'weapon-trail' ? 2 : 1
    if (Reflect.get(candidates, 'length') !== expectedPointCount) return undefined
    const points = Array.from({ length: expectedPointCount }, (_, index) => safePoint(Reflect.get(candidates, index)))
    if (points.some(point => !point)) return undefined
    const boundedLifetimeMs = Math.min(MAX_SIGNAL_LIFETIME_MS, lifetimeMs)
    const expiresTimeMs = requestedTimeMs + boundedLifetimeMs
    if (!Number.isFinite(expiresTimeMs) || !(expiresTimeMs > frameTimeMs)) return undefined
    return {
      id,
      kind,
      requestedTimeMs,
      expiresTimeMs,
      strength: Math.min(1, strength),
      points: points as readonly (readonly [number, number, number])[],
    }
  }
  catch {
    return undefined
  }
}

function hashUnit(id: string, particleIndex: number, salt: number): number {
  let hash = (2166136261 ^ particleIndex ^ salt) >>> 0
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash / 0xffffffff
}

/**
 * 创建与角色容器同父级挂载的持械 VFX Group；每类资源独立初始化并使用固定容量。
 */
export function createComplexBipedWeaponVfxController(
  options: ComplexBipedWeaponVfxControllerOptions = {},
): ComplexBipedWeaponVfxController {
  const object = new Group()
  object.name = '复杂双足持械特效'
  const pools = new Map<BipedPetWeaponVfxKind, WeaponEffectPool>()
  const unavailableKinds: BipedPetWeaponVfxKind[] = []
  const ownedObjects: Object3D[] = []
  const ownedGeometries = new Set<BufferGeometry>()
  const ownedMaterials = new Set<Material>()
  const partialGeometries = new Set<BufferGeometry>()
  const partialMaterials = new Set<Material>()
  const recentSignalIds = new Set<string>()
  const recentSignalQueue: Array<string | undefined> = Array(MAX_RECENT_SIGNAL_IDS)
  const hiddenMatrix = ZERO_MATRIX.clone()
  const matrixDummy = new Object3D()
  const start = new Vector3()
  const end = new Vector3()
  const direction = new Vector3()
  const midpoint = new Vector3()
  const up = new Vector3(0, 1, 0)
  const trailRotation = new Quaternion()
  let disposed = false
  let disposing = false
  let lastRequestedTimeMs: number | undefined
  let nextActivationSerial = 0
  let recentSignalStart = 0
  let recentSignalCount = 0

  for (const kind of EFFECT_KINDS) {
    let geometry: BufferGeometry | undefined
    let material: Material | undefined
    let provisionalGeometry: BufferGeometry | undefined
    let provisionalMaterial: Material | undefined
    const attachedObjects: Object3D[] = []
    try {
      const defaultGeometry = () => provisionalGeometry ??= createDefaultGeometry(kind)
      const defaultMaterial = () => provisionalMaterial ??= createDefaultMaterial(kind)
      geometry = options.createGeometry ? options.createGeometry(kind, defaultGeometry) : defaultGeometry()
      if (provisionalGeometry && provisionalGeometry !== geometry) partialGeometries.add(provisionalGeometry)
      material = options.createMaterial ? options.createMaterial(kind, defaultMaterial) : defaultMaterial()
      if (provisionalMaterial && provisionalMaterial !== material) partialMaterials.add(provisionalMaterial)
      if (!(geometry instanceof BufferGeometry) || !(material instanceof Material)) throw new Error('资源工厂返回了无效的 Three 对象。')

      const capacity = POOL_CAPACITY[kind]
      if (kind === 'impact-sparks') {
        const mesh = new InstancedMesh(geometry, material, capacity)
        mesh.name = `复杂双足持械特效-${EFFECT_LABEL[kind]}`
        mesh.frustumCulled = false
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        for (let index = 0; index < capacity; index += 1) mesh.setMatrixAt(index, hiddenMatrix)
        mesh.instanceMatrix.needsUpdate = true
        attachedObjects.push(mesh)
        if (options.attachObject) options.attachObject(kind, object, mesh)
        else object.add(mesh)
        pools.set(kind, { kind, storage: 'instanced', geometry, material, mesh, slots: createSlots(capacity) })
      }
      else {
        const meshes = Array.from({ length: capacity }, (_, index) => {
          const mesh = new Mesh(geometry!, material!)
          mesh.name = `复杂双足持械特效-${EFFECT_LABEL[kind]}-${index}`
          mesh.visible = false
          mesh.frustumCulled = false
          attachedObjects.push(mesh)
          if (options.attachObject) options.attachObject(kind, object, mesh)
          else object.add(mesh)
          return mesh
        })
        pools.set(kind, { kind, storage: 'meshes', geometry, material, meshes, slots: createSlots(capacity) })
      }
      ownedObjects.push(...attachedObjects)
      ownedGeometries.add(geometry)
      ownedMaterials.add(material)
      partialGeometries.delete(geometry)
      partialMaterials.delete(material)
    }
    catch {
      for (const child of attachedObjects) {
        try { child.removeFromParent() }
        catch { /* 当前效果类已隔离，解绑异常不能阻断其余类初始化。 */ }
      }
      if (geometry) partialGeometries.add(geometry)
      if (material) partialMaterials.add(material)
      if (provisionalGeometry) partialGeometries.add(provisionalGeometry)
      if (provisionalMaterial) partialMaterials.add(provisionalMaterial)
      unavailableKinds.push(kind)
    }
  }

  for (const geometry of partialGeometries) {
    if (ownedGeometries.has(geometry)) continue
    try { geometry.dispose() }
    catch { /* 单类初始化失败不能阻断控制器创建。 */ }
  }
  for (const material of partialMaterials) {
    if (ownedMaterials.has(material)) continue
    try { material.dispose() }
    catch { /* 单类初始化失败不能阻断控制器创建。 */ }
  }
  partialGeometries.clear()
  partialMaterials.clear()

  const assertUsable = () => {
    if (disposing || disposed) throw new Error('复杂双足持械特效控制器已释放，不能继续更新。')
  }

  const hideSlot = (pool: WeaponEffectPool, slotIndex: number) => {
    if (pool.storage === 'meshes') pool.meshes[slotIndex]!.visible = false
    else pool.mesh.setMatrixAt(slotIndex, hiddenMatrix)
  }

  const deactivateSlot = (pool: WeaponEffectPool, slotIndex: number) => {
    const slot = pool.slots[slotIndex]
    if (!slot?.active) return
    slot.active = false
    slot.id = ''
    hideSlot(pool, slotIndex)
  }

  const clearActivity = () => {
    for (const pool of pools.values()) {
      for (let index = 0; index < pool.slots.length; index += 1) deactivateSlot(pool, index)
      if (pool.storage === 'instanced') pool.mesh.instanceMatrix.needsUpdate = true
    }
  }

  const clearRecentSignals = () => {
    recentSignalIds.clear()
    recentSignalQueue.fill(undefined)
    recentSignalStart = 0
    recentSignalCount = 0
  }

  const rememberSignal = (id: string) => {
    if (recentSignalIds.has(id)) return
    if (recentSignalCount < MAX_RECENT_SIGNAL_IDS) {
      const index = (recentSignalStart + recentSignalCount) % MAX_RECENT_SIGNAL_IDS
      recentSignalQueue[index] = id
      recentSignalCount += 1
    }
    else {
      const evicted = recentSignalQueue[recentSignalStart]
      if (evicted) recentSignalIds.delete(evicted)
      recentSignalQueue[recentSignalStart] = id
      recentSignalStart = (recentSignalStart + 1) % MAX_RECENT_SIGNAL_IDS
    }
    recentSignalIds.add(id)
  }

  const nextSlotIndex = (pool: WeaponEffectPool): number => {
    const inactive = pool.slots.findIndex(slot => !slot.active)
    if (inactive >= 0) return inactive
    let oldestIndex = 0
    for (let index = 1; index < pool.slots.length; index += 1) {
      if (pool.slots[index]!.activationSerial < pool.slots[oldestIndex]!.activationSerial) oldestIndex = index
    }
    return oldestIndex
  }

  const hasActiveSignal = (id: string) => {
    for (const pool of pools.values()) {
      if (pool.slots.some(slot => slot.active && slot.id === id)) return true
    }
    return false
  }

  const activateSlot = (pool: WeaponEffectPool, signal: SafeWeaponSignal, particleIndex: number) => {
    const slotIndex = nextSlotIndex(pool)
    const slot = pool.slots[slotIndex]!
    const firstPoint = signal.points[0]!
    const secondPoint = signal.points[1] ?? firstPoint
    slot.active = true
    slot.id = signal.id
    slot.startTimeMs = signal.requestedTimeMs
    slot.expiresTimeMs = signal.expiresTimeMs
    slot.strength = signal.strength
    slot.startX = firstPoint[0]
    slot.startY = firstPoint[1]
    slot.startZ = firstPoint[2]
    slot.endX = secondPoint[0]
    slot.endY = secondPoint[1]
    slot.endZ = secondPoint[2]
    slot.particleIndex = particleIndex
    slot.activationSerial = nextActivationSerial
    nextActivationSerial += 1
    if (pool.storage === 'meshes') pool.meshes[slotIndex]!.visible = true
  }

  const updatePool = (pool: WeaponEffectPool, requestedTimeMs: number, characterHeight: number) => {
    for (const [slotIndex, slot] of pool.slots.entries()) {
      if (!slot.active) continue
      if (requestedTimeMs >= slot.expiresTimeMs) {
        deactivateSlot(pool, slotIndex)
        continue
      }
      const progress = Math.max(0, Math.min(1, (requestedTimeMs - slot.startTimeMs) / (slot.expiresTimeMs - slot.startTimeMs)))
      const fade = Math.max(.001, 1 - progress)
      if (pool.kind === 'weapon-trail' && pool.storage === 'meshes') {
        start.set(slot.startX, slot.startY, slot.startZ)
        end.set(slot.endX, slot.endY, slot.endZ)
        direction.subVectors(end, start)
        const length = direction.length()
        if (!(length > 1e-9)) {
          deactivateSlot(pool, slotIndex)
          continue
        }
        midpoint.copy(start).add(end).multiplyScalar(.5)
        trailRotation.setFromUnitVectors(up, direction.multiplyScalar(1 / length))
        const mesh = pool.meshes[slotIndex]!
        mesh.position.copy(midpoint)
        mesh.quaternion.copy(trailRotation)
        mesh.scale.set(characterHeight * .018 * fade, length, 1)
        mesh.updateMatrix()
      }
      else if (pool.kind === 'impact-ring' && pool.storage === 'meshes') {
        const mesh = pool.meshes[slotIndex]!
        mesh.position.set(slot.startX, slot.startY + characterHeight * .003, slot.startZ)
        mesh.rotation.set(-Math.PI / 2, 0, 0)
        const ringScale = characterHeight * (.15 + progress * .28) * slot.strength
        mesh.scale.set(ringScale, ringScale, ringScale * fade)
        mesh.updateMatrix()
      }
      else if (pool.kind === 'impact-sparks' && pool.storage === 'instanced') {
        const angle = hashUnit(slot.id, slot.particleIndex, 17) * Math.PI * 2
        const radius = characterHeight * (.018 + hashUnit(slot.id, slot.particleIndex, 31) * .08) * progress
        const rise = characterHeight * (.04 + hashUnit(slot.id, slot.particleIndex, 47) * .12)
        matrixDummy.position.set(
          slot.startX + Math.cos(angle) * radius,
          slot.startY + rise * progress - characterHeight * .1 * progress * progress,
          slot.startZ + Math.sin(angle) * radius,
        )
        const particleScale = characterHeight * .025 * fade * (.6 + slot.strength * .4)
        matrixDummy.scale.setScalar(particleScale)
        matrixDummy.quaternion.identity()
        matrixDummy.updateMatrix()
        pool.mesh.setMatrixAt(slotIndex, matrixDummy.matrix)
      }
    }
    if (pool.storage === 'instanced') pool.mesh.instanceMatrix.needsUpdate = true
  }

  return {
    object,
    apply(signals, frame) {
      assertUsable()
      const safe = safeFrame(frame)
      if (!safe) return
      if (lastRequestedTimeMs !== undefined && safe.requestedTimeMs < lastRequestedTimeMs) {
        clearActivity()
        clearRecentSignals()
      }
      for (const pool of pools.values()) updatePool(pool, safe.requestedTimeMs, safe.characterHeight)

      let signalCount = 0
      try {
        const length = Reflect.get(signals, 'length')
        signalCount = Math.min(
          Number.isSafeInteger(length) && length >= 0 ? length : 0,
          MAX_SIGNAL_INPUTS_PER_FRAME,
        )
      }
      catch {
        lastRequestedTimeMs = safe.requestedTimeMs
        return
      }
      for (let index = 0; index < signalCount; index += 1) {
        let signal: SafeWeaponSignal | undefined
        try { signal = safeSignal(Reflect.get(signals, index), safe.requestedTimeMs) }
        catch { signal = undefined }
        if (!signal || recentSignalIds.has(signal.id) || hasActiveSignal(signal.id)) continue
        const pool = pools.get(signal.kind)
        if (!pool) continue
        const instanceCount = signal.kind === 'impact-sparks'
          ? Math.min(MAX_SPARKS_PER_SIGNAL, 4 + Math.ceil(signal.strength * 12))
          : 1
        for (let particleIndex = 0; particleIndex < instanceCount; particleIndex += 1) activateSlot(pool, signal, particleIndex)
        rememberSignal(signal.id)
      }
      for (const pool of pools.values()) updatePool(pool, safe.requestedTimeMs, safe.characterHeight)
      lastRequestedTimeMs = safe.requestedTimeMs
    },
    snapshot() {
      const activeByKind = Object.fromEntries(EFFECT_KINDS.map(kind => [
        kind,
        pools.get(kind)?.slots.filter(slot => slot.active).length ?? 0,
      ])) as Record<BipedPetWeaponVfxKind, number>
      return Object.freeze({
        activeTotal: Object.values(activeByKind).reduce((sum, value) => sum + value, 0),
        activeByKind: Object.freeze(activeByKind),
        poolCapacityTotal: Object.values(POOL_CAPACITY).reduce((sum, value) => sum + value, 0),
        poolCapacityByKind: POOL_CAPACITY,
        unavailableKinds: Object.freeze([...unavailableKinds]),
        disposed: disposed || disposing,
      })
    },
    reset() {
      assertUsable()
      clearActivity()
      clearRecentSignals()
      lastRequestedTimeMs = undefined
    },
    dispose() {
      if (disposed || disposing) return
      disposing = true
      const failures: string[] = []
      const attempt = (label: string, operation: () => void) => {
        try { operation() }
        catch (error) { failures.push(`${label}：${safeErrorDetail(error)}`) }
      }
      try {
        attempt('活动实例清理', clearActivity)
        for (const geometry of ownedGeometries) attempt('Geometry 释放', () => geometry.dispose())
        for (const material of ownedMaterials) attempt('Material 释放', () => material.dispose())
        for (const child of ownedObjects) attempt('特效对象解绑', () => child.removeFromParent())
        attempt('特效父级解绑', () => object.removeFromParent())
        attempt('特效父级清理', () => object.clear())
      }
      finally {
        pools.clear()
        ownedObjects.length = 0
        ownedGeometries.clear()
        ownedMaterials.clear()
        unavailableKinds.length = 0
        clearRecentSignals()
        lastRequestedTimeMs = undefined
        disposed = true
        disposing = false
      }
      if (failures.length) throw new Error(`复杂双足持械特效资源释放失败：${failures.join('；')}`)
    },
  }
}
