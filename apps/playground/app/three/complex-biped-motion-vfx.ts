/**
 * 文件职责 / File responsibility
 * 在角色同级 Three 场景中维护确定、有界且可完整释放的复杂双足运动特效对象池。
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
  RingGeometry,
  SphereGeometry,
  type ColorRepresentation,
} from 'three'
import type { BipedPetMotionVfxSignal, BipedPetMotionVfxTag } from '@yk-pets/pet-core'

export interface ComplexBipedMotionVfxFrame {
  requestedTimeMs: number
  /** 角色容器在 VFX Group 父级坐标系中的最终位置。 */
  position: readonly [number, number, number]
  facingRadians: number
}

export interface ComplexBipedMotionVfxSnapshot {
  readonly activeTotal: number
  readonly activeByKind: Readonly<Record<BipedPetMotionVfxTag, number>>
  readonly poolCapacityTotal: number
  readonly poolCapacityByKind: Readonly<Record<BipedPetMotionVfxTag, number>>
  readonly unavailableKinds: readonly BipedPetMotionVfxTag[]
  readonly disposed: boolean
}

export interface ComplexBipedMotionVfxController {
  readonly object: Group
  apply(signals: readonly BipedPetMotionVfxSignal[], frame: ComplexBipedMotionVfxFrame): void
  snapshot(): ComplexBipedMotionVfxSnapshot
  reset(): void
  dispose(): void
}

export interface ComplexBipedMotionVfxControllerOptions {
  /** 仅作为 Three 资源工厂边界；默认始终返回固定的内置 Geometry。 */
  createGeometry?: (
    kind: BipedPetMotionVfxTag,
    createDefault: () => BufferGeometry,
  ) => BufferGeometry
  /** 仅作为 Three 资源工厂边界；默认始终返回固定的内置 Material。 */
  createMaterial?: (
    kind: BipedPetMotionVfxTag,
    createDefault: () => Material,
  ) => Material
  /** 由宿主注入统一的 Three 挂载边界；默认直接加入控制器 Group。 */
  attachObject?: (kind: BipedPetMotionVfxTag, group: Group, child: Object3D) => void
}

const EFFECT_KINDS = Object.freeze([
  'landing-ring',
  'landing-dust',
  'speed-trail',
  'brake-sparks',
] as const satisfies readonly BipedPetMotionVfxTag[])

const POOL_CAPACITY = Object.freeze({
  'landing-ring': 8,
  'landing-dust': 24,
  'speed-trail': 8,
  'brake-sparks': 24,
}) satisfies Readonly<Record<BipedPetMotionVfxTag, number>>

const EFFECT_LABEL = Object.freeze({
  'landing-ring': '落地环',
  'landing-dust': '落地尘点',
  'speed-trail': '速度拖尾',
  'brake-sparks': '急停火花',
}) satisfies Readonly<Record<BipedPetMotionVfxTag, string>>

const EFFECT_COLOR = Object.freeze({
  'landing-ring': '#8ef2ff',
  'landing-dust': '#d9e3f0',
  'speed-trail': '#83e8ff',
  'brake-sparks': '#ffcf78',
}) satisfies Readonly<Record<BipedPetMotionVfxTag, ColorRepresentation>>

const EXPECTED_MODE = Object.freeze({
  'landing-ring': 'burst',
  'landing-dust': 'burst',
  'speed-trail': 'sustain',
  'brake-sparks': 'burst',
}) satisfies Readonly<Record<BipedPetMotionVfxTag, BipedPetMotionVfxSignal['mode']>>

const MAX_BURST_INSTANCES = 16
const MAX_LIFETIME_MS = 1200
const MAX_SIGNAL_INPUTS_PER_FRAME = 128
const MAX_RECENT_BURST_IDS = 256
const ZERO_MATRIX = new Matrix4().makeScale(0, 0, 0)

interface ActiveEffectInstance {
  active: boolean
  id: string
  mode: BipedPetMotionVfxSignal['mode']
  startTimeMs: number
  expiresTimeMs: number
  strength: number
  originX: number
  originY: number
  originZ: number
  facingRadians: number
  particleIndex: number
  activationSerial: number
}

interface EffectPoolBase {
  kind: BipedPetMotionVfxTag
  geometry: BufferGeometry
  material: Material
  slots: ActiveEffectInstance[]
}

interface MeshEffectPool extends EffectPoolBase {
  storage: 'meshes'
  meshes: Mesh[]
}

interface InstancedEffectPool extends EffectPoolBase {
  storage: 'instanced'
  mesh: InstancedMesh
}

type EffectPool = MeshEffectPool | InstancedEffectPool

interface SafeSignal {
  id: string
  kind: BipedPetMotionVfxTag
  mode: BipedPetMotionVfxSignal['mode']
  strength: number
  timeMs: number
  lifetimeMs: number
  expiresTimeMs: number
}

function isEffectKind(value: unknown): value is BipedPetMotionVfxTag {
  return typeof value === 'string' && (EFFECT_KINDS as readonly string[]).includes(value)
}

function safeErrorDetail(error: unknown): string {
  try { return String(error instanceof Error ? error.message : error) }
  catch { return '未知错误' }
}

function createDefaultGeometry(kind: BipedPetMotionVfxTag): BufferGeometry {
  if (kind === 'landing-ring') return new RingGeometry(.34, .43, 32)
  if (kind === 'landing-dust') return new SphereGeometry(.035, 6, 4)
  if (kind === 'speed-trail') return new PlaneGeometry(.18, .52)
  return new PlaneGeometry(.035, .16)
}

function createDefaultMaterial(kind: BipedPetMotionVfxTag): Material {
  return new MeshBasicMaterial({
    color: EFFECT_COLOR[kind],
    transparent: true,
    opacity: kind === 'speed-trail' ? .32 : kind === 'landing-dust' ? .62 : .78,
    depthWrite: false,
    side: DoubleSide,
  })
}

function safeFrame(frame: ComplexBipedMotionVfxFrame): ComplexBipedMotionVfxFrame | undefined {
  try {
    if (!frame || typeof frame !== 'object') return undefined
    const source = frame as unknown as Record<PropertyKey, unknown>
    const requestedTimeMs = Reflect.get(source, 'requestedTimeMs')
    const facingRadians = Reflect.get(source, 'facingRadians')
    const position = Reflect.get(source, 'position')
    if (typeof requestedTimeMs !== 'number' || !Number.isFinite(requestedTimeMs) || requestedTimeMs < 0
      || typeof facingRadians !== 'number' || !Number.isFinite(facingRadians)
      || !Array.isArray(position) || Reflect.get(position, 'length') !== 3) return undefined
    const x = Reflect.get(position, 0)
    const y = Reflect.get(position, 1)
    const z = Reflect.get(position, 2)
    if (typeof x !== 'number' || !Number.isFinite(x)
      || typeof y !== 'number' || !Number.isFinite(y)
      || typeof z !== 'number' || !Number.isFinite(z)) return undefined
    // 后续只读取这份普通值副本，避免 Proxy 在校验后替换坐标或时间。 / Later stages consume only this plain-value copy so a Proxy cannot replace validated coordinates or time.
    return { requestedTimeMs, position: [x, y, z], facingRadians }
  }
  catch {
    return undefined
  }
}

function safeSignal(value: unknown, requestedTimeMs: number): SafeSignal | undefined {
  try {
    if (!value || typeof value !== 'object') return undefined
    const source = value as Record<PropertyKey, unknown>
    const id = Reflect.get(source, 'id')
    const kind = Reflect.get(source, 'kind')
    const mode = Reflect.get(source, 'mode')
    const strength = Reflect.get(source, 'strength')
    const timeMs = Reflect.get(source, 'timeMs')
    const lifetimeMs = Reflect.get(source, 'lifetimeMs')
    if (typeof id !== 'string' || id.length === 0 || id.length > 512
      || !isEffectKind(kind) || mode !== EXPECTED_MODE[kind]
      || typeof strength !== 'number' || !Number.isFinite(strength) || !(strength > 0)
      || typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0 || timeMs !== requestedTimeMs
      || typeof lifetimeMs !== 'number' || !Number.isFinite(lifetimeMs) || !(lifetimeMs > 0)) return undefined
    const boundedLifetimeMs = Math.min(MAX_LIFETIME_MS, lifetimeMs)
    const expiresTimeMs = timeMs + boundedLifetimeMs
    if (!Number.isFinite(expiresTimeMs) || !(expiresTimeMs > timeMs)) return undefined
    return {
      id,
      kind,
      mode: mode as BipedPetMotionVfxSignal['mode'],
      strength: Math.min(1, strength),
      timeMs,
      lifetimeMs: boundedLifetimeMs,
      expiresTimeMs,
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

function burstInstanceCount(kind: BipedPetMotionVfxTag, strength: number): number {
  if (kind === 'landing-ring') return 1
  return Math.min(MAX_BURST_INSTANCES, 6 + Math.ceil(strength * 10))
}

function createEffectSlots(capacity: number): ActiveEffectInstance[] {
  return Array.from({ length: capacity }, () => ({
    active: false,
    id: '',
    mode: 'burst',
    startTimeMs: 0,
    expiresTimeMs: 0,
    strength: 0,
    originX: 0,
    originY: 0,
    originZ: 0,
    facingRadians: 0,
    particleIndex: 0,
    activationSerial: 0,
  }))
}

/**
 * 创建与角色容器同父级挂载的 VFX Group。每类效果独立初始化，单类失败不会让其他池失效。
 */
export function createComplexBipedMotionVfxController(
  options: ComplexBipedMotionVfxControllerOptions = {},
): ComplexBipedMotionVfxController {
  const object = new Group()
  object.name = '复杂双足运动特效'
  object.matrixAutoUpdate = true
  const pools = new Map<BipedPetMotionVfxTag, EffectPool>()
  const unavailableKinds: BipedPetMotionVfxTag[] = []
  const ownedObjects: Object3D[] = []
  const ownedGeometries = new Set<BufferGeometry>()
  const ownedMaterials = new Set<Material>()
  const partialGeometries = new Set<BufferGeometry>()
  const partialMaterials = new Set<Material>()
  const recentBurstIds = new Set<string>()
  const recentBurstQueue: Array<string | undefined> = Array(MAX_RECENT_BURST_IDS)
  const sustainSlots = new Map<string, number>()
  const matrixDummy = new Object3D()
  let disposed = false
  let disposing = false
  let lastRequestedTimeMs: number | undefined
  let nextActivationSerial = 0
  let recentBurstStart = 0
  let recentBurstCount = 0

  for (const kind of EFFECT_KINDS) {
    let geometry: BufferGeometry | undefined
    let material: Material | undefined
    let provisionalGeometry: BufferGeometry | undefined
    let provisionalMaterial: Material | undefined
    const attachedObjects: Object3D[] = []
    try {
      // 工厂可多次调用 default；惰性缓存保证每类每种资源至多产生一个 provisional 对象。 / A factory may call default repeatedly; lazy caching creates at most one provisional resource per class.
      const defaultGeometry = () => provisionalGeometry ??= createDefaultGeometry(kind)
      const defaultMaterial = () => provisionalMaterial ??= createDefaultMaterial(kind)
      geometry = options.createGeometry ? options.createGeometry(kind, defaultGeometry) : defaultGeometry()
      if (provisionalGeometry && provisionalGeometry !== geometry) partialGeometries.add(provisionalGeometry)
      material = options.createMaterial ? options.createMaterial(kind, defaultMaterial) : defaultMaterial()
      if (provisionalMaterial && provisionalMaterial !== material) partialMaterials.add(provisionalMaterial)
      if (!(geometry instanceof BufferGeometry) || !(material instanceof Material)) throw new Error('资源工厂返回了无效的 Three 对象。')

      const capacity = POOL_CAPACITY[kind]
      if (kind === 'landing-dust' || kind === 'brake-sparks') {
        const mesh = new InstancedMesh(geometry, material, capacity)
        mesh.name = `复杂双足运动特效-${EFFECT_LABEL[kind]}`
        mesh.frustumCulled = false
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        for (let index = 0; index < capacity; index += 1) mesh.setMatrixAt(index, ZERO_MATRIX)
        mesh.instanceMatrix.needsUpdate = true
        attachedObjects.push(mesh)
        if (options.attachObject) options.attachObject(kind, object, mesh)
        else object.add(mesh)
        pools.set(kind, { kind, storage: 'instanced', geometry, material, mesh, slots: createEffectSlots(capacity) })
      }
      else {
        const meshes = Array.from({ length: capacity }, (_, index) => {
          const mesh = new Mesh(geometry!, material!)
          mesh.name = `复杂双足运动特效-${EFFECT_LABEL[kind]}-${index}`
          mesh.visible = false
          mesh.frustumCulled = false
          attachedObjects.push(mesh)
          if (options.attachObject) options.attachObject(kind, object, mesh)
          else object.add(mesh)
          return mesh
        })
        pools.set(kind, { kind, storage: 'meshes', geometry, material, meshes, slots: createEffectSlots(capacity) })
      }
      ownedObjects.push(...attachedObjects)
      ownedGeometries.add(geometry)
      ownedMaterials.add(material)
      partialGeometries.delete(geometry)
      partialMaterials.delete(material)
    }
    catch {
      // 初始化失败只隔离当前效果类；已经取得的部分资源仍各尝试释放一次。 / A class failure is isolated while any partially acquired resource is still attempted once.
      for (const child of attachedObjects) {
        try { child.removeFromParent() }
        catch { /* 当前池不可用，解绑异常不应阻塞其余效果初始化。 */ }
      }
      if (geometry) partialGeometries.add(geometry)
      if (material) partialMaterials.add(material)
      if (provisionalGeometry) partialGeometries.add(provisionalGeometry)
      if (provisionalMaterial) partialMaterials.add(provisionalMaterial)
      unavailableKinds.push(kind)
    }
  }

  // 等全部效果类完成后再释放真正无人持有的部分资源，兼容工厂跨 kind 复用同一对象。 / Release only truly unowned partial resources after all classes initialize, allowing a factory to share identity across kinds.
  for (const geometry of partialGeometries) {
    if (ownedGeometries.has(geometry)) continue
    try { geometry.dispose() }
    catch { /* 单类初始化失败不能阻塞控制器创建。 */ }
  }
  for (const material of partialMaterials) {
    if (ownedMaterials.has(material)) continue
    try { material.dispose() }
    catch { /* 同上。 */ }
  }
  partialGeometries.clear()
  partialMaterials.clear()

  const assertUsable = () => {
    if (disposing || disposed) throw new Error('复杂双足运动特效控制器已释放，不能继续更新。')
  }

  const hideSlot = (pool: EffectPool, slotIndex: number) => {
    if (pool.storage === 'meshes') pool.meshes[slotIndex]!.visible = false
    else pool.mesh.setMatrixAt(slotIndex, ZERO_MATRIX)
  }

  const deactivateSlot = (pool: EffectPool, slotIndex: number) => {
    const active = pool.slots[slotIndex]
    if (!active?.active) return
    const sustainIndex = sustainSlots.get(active.id)
    if (pool.kind === 'speed-trail' && sustainIndex === slotIndex) sustainSlots.delete(active.id)
    active.active = false
    active.id = ''
    hideSlot(pool, slotIndex)
  }

  const clearActive = (clearDedupe: boolean) => {
    for (const pool of pools.values()) {
      for (let slotIndex = 0; slotIndex < pool.slots.length; slotIndex += 1) deactivateSlot(pool, slotIndex)
      if (pool.storage === 'instanced') pool.mesh.instanceMatrix.needsUpdate = true
    }
    sustainSlots.clear()
    if (clearDedupe) {
      recentBurstIds.clear()
      recentBurstQueue.fill(undefined)
      recentBurstStart = 0
      recentBurstCount = 0
      nextActivationSerial = 0
    }
  }

  const expireAt = (requestedTimeMs: number) => {
    for (const pool of pools.values()) {
      let changed = false
      for (let slotIndex = 0; slotIndex < pool.slots.length; slotIndex += 1) {
        const active = pool.slots[slotIndex]
        if (active?.active && requestedTimeMs >= active.expiresTimeMs) {
          deactivateSlot(pool, slotIndex)
          changed = true
        }
      }
      if (changed && pool.storage === 'instanced') pool.mesh.instanceMatrix.needsUpdate = true
    }
  }

  const acquireSlot = (pool: EffectPool): number => {
    const freeIndex = pool.slots.findIndex(slot => !slot.active)
    if (freeIndex >= 0) return freeIndex
    let oldestIndex = 0
    let oldestExpiry = Number.POSITIVE_INFINITY
    let oldestSerial = Number.POSITIVE_INFINITY
    for (let index = 0; index < pool.slots.length; index += 1) {
      const active = pool.slots[index]
      const expiry = active?.active ? active.expiresTimeMs : Number.NEGATIVE_INFINITY
      const serial = active?.active ? active.activationSerial : Number.NEGATIVE_INFINITY
      if (expiry < oldestExpiry || (expiry === oldestExpiry && serial < oldestSerial)) {
        oldestExpiry = expiry
        oldestSerial = serial
        oldestIndex = index
      }
    }
    deactivateSlot(pool, oldestIndex)
    return oldestIndex
  }

  const rememberBurst = (id: string) => {
    if (recentBurstIds.has(id)) return
    recentBurstIds.add(id)
    if (recentBurstCount < MAX_RECENT_BURST_IDS) {
      const index = (recentBurstStart + recentBurstCount) % MAX_RECENT_BURST_IDS
      recentBurstQueue[index] = id
      recentBurstCount += 1
    }
    else {
      const expiredId = recentBurstQueue[recentBurstStart]
      if (expiredId !== undefined) recentBurstIds.delete(expiredId)
      recentBurstQueue[recentBurstStart] = id
      recentBurstStart = (recentBurstStart + 1) % MAX_RECENT_BURST_IDS
    }
  }

  const hasActiveBurst = (id: string) => {
    for (const pool of pools.values()) {
      for (const active of pool.slots) if (active.active && active.mode === 'burst' && active.id === id) return true
    }
    return false
  }

  const activate = (
    pool: EffectPool,
    signal: SafeSignal,
    frame: ComplexBipedMotionVfxFrame,
    particleIndex: number,
  ) => {
    const slotIndex = acquireSlot(pool)
    const slot = pool.slots[slotIndex]!
    slot.active = true
    slot.id = signal.id
    slot.mode = signal.mode
    slot.startTimeMs = signal.timeMs
    slot.expiresTimeMs = signal.expiresTimeMs
    slot.strength = signal.strength
    slot.originX = frame.position[0]
    slot.originY = frame.position[1]
    slot.originZ = frame.position[2]
    slot.facingRadians = frame.facingRadians
    slot.particleIndex = particleIndex
    slot.activationSerial = nextActivationSerial++
    if (signal.mode === 'sustain') sustainSlots.set(signal.id, slotIndex)
  }

  const updateSustain = (
    pool: EffectPool,
    slotIndex: number,
    signal: SafeSignal,
    frame: ComplexBipedMotionVfxFrame,
  ) => {
    const active = pool.slots[slotIndex]
    if (!active?.active || active.mode !== 'sustain' || pool.kind !== signal.kind) return false
    active.startTimeMs = signal.timeMs
    active.expiresTimeMs = signal.expiresTimeMs
    active.strength = signal.strength
    active.originX = frame.position[0]
    active.originY = frame.position[1]
    active.originZ = frame.position[2]
    active.facingRadians = frame.facingRadians
    active.activationSerial = nextActivationSerial++
    return true
  }

  const updateMeshVisual = (pool: MeshEffectPool, active: ActiveEffectInstance, slotIndex: number, requestedTimeMs: number) => {
    const mesh = pool.meshes[slotIndex]!
    const lifetime = Math.max(1, active.expiresTimeMs - active.startTimeMs)
    const progress = Math.max(0, Math.min(1, (requestedTimeMs - active.startTimeMs) / lifetime))
    const remaining = 1 - progress
    mesh.visible = true
    if (pool.kind === 'landing-ring') {
      const scale = .35 + progress * (1.75 + active.strength * .65)
      mesh.position.set(active.originX, active.originY + .018, active.originZ)
      mesh.rotation.set(-Math.PI / 2, 0, active.facingRadians)
      mesh.scale.setScalar(scale * Math.max(.08, remaining))
    }
    else {
      const backward = .22 + active.strength * .2
      const forwardX = Math.sin(active.facingRadians)
      const forwardZ = Math.cos(active.facingRadians)
      mesh.position.set(
        active.originX - forwardX * backward,
        active.originY + .2,
        active.originZ - forwardZ * backward,
      )
      mesh.rotation.set(-Math.PI / 2, 0, active.facingRadians)
      mesh.scale.set(.7 + active.strength * .55, Math.max(.1, remaining), 1)
    }
  }

  const updateInstancedVisual = (pool: InstancedEffectPool, active: ActiveEffectInstance, slotIndex: number, requestedTimeMs: number) => {
    const lifetime = Math.max(1, active.expiresTimeMs - active.startTimeMs)
    const progress = Math.max(0, Math.min(1, (requestedTimeMs - active.startTimeMs) / lifetime))
    const remaining = 1 - progress
    const angle = hashUnit(active.id, active.particleIndex, 31) * Math.PI * 2
    const spread = .08 + hashUnit(active.id, active.particleIndex, 67) * .24
    if (pool.kind === 'landing-dust') {
      matrixDummy.position.set(
        active.originX + Math.cos(angle) * spread * (1 + progress),
        active.originY + .025 + Math.sin(Math.PI * progress) * (.08 + active.strength * .13),
        active.originZ + Math.sin(angle) * spread * (1 + progress),
      )
      matrixDummy.rotation.set(0, angle, 0)
      matrixDummy.scale.setScalar((.55 + active.strength * .8) * Math.max(.05, remaining))
    }
    else {
      const forwardX = Math.sin(active.facingRadians)
      const forwardZ = Math.cos(active.facingRadians)
      const side = (hashUnit(active.id, active.particleIndex, 113) - .5) * .34
      const travel = progress * (.28 + active.strength * .48)
      matrixDummy.position.set(
        active.originX - forwardX * travel - forwardZ * side,
        active.originY + .035 + Math.sin(Math.PI * progress) * .09,
        active.originZ - forwardZ * travel + forwardX * side,
      )
      matrixDummy.rotation.set(0, active.facingRadians, angle)
      matrixDummy.scale.set(.75 + active.strength, Math.max(.05, remaining), 1)
    }
    matrixDummy.updateMatrix()
    pool.mesh.setMatrixAt(slotIndex, matrixDummy.matrix)
  }

  const updateVisuals = (requestedTimeMs: number) => {
    for (const pool of pools.values()) {
      for (let slotIndex = 0; slotIndex < pool.slots.length; slotIndex += 1) {
        const active = pool.slots[slotIndex]
        if (!active?.active) continue
        if (pool.storage === 'meshes') updateMeshVisual(pool, active, slotIndex, requestedTimeMs)
        else updateInstancedVisual(pool, active, slotIndex, requestedTimeMs)
      }
      if (pool.storage === 'instanced') pool.mesh.instanceMatrix.needsUpdate = true
    }
  }

  const snapshot = (): ComplexBipedMotionVfxSnapshot => {
    const activeByKind = {
      'landing-ring': 0,
      'landing-dust': 0,
      'speed-trail': 0,
      'brake-sparks': 0,
    } satisfies Record<BipedPetMotionVfxTag, number>
    const poolCapacityByKind = {
      'landing-ring': 0,
      'landing-dust': 0,
      'speed-trail': 0,
      'brake-sparks': 0,
    } satisfies Record<BipedPetMotionVfxTag, number>
    for (const kind of EFFECT_KINDS) {
      const slots = pools.get(kind)?.slots
      if (slots) {
        poolCapacityByKind[kind] = slots.length
        for (const active of slots) if (active.active) activeByKind[kind] += 1
      }
    }
    const activeTotal = EFFECT_KINDS.reduce((total, kind) => total + activeByKind[kind], 0)
    const poolCapacityTotal = EFFECT_KINDS.reduce((total, kind) => total + poolCapacityByKind[kind], 0)
    return Object.freeze({
      activeTotal,
      activeByKind: Object.freeze(activeByKind),
      poolCapacityTotal,
      poolCapacityByKind: Object.freeze(poolCapacityByKind),
      unavailableKinds: Object.freeze([...unavailableKinds]),
      disposed,
    })
  }

  return {
    object,
    apply(signals, frameInput) {
      assertUsable()
      const frame = safeFrame(frameInput)
      if (!frame) return
      if (lastRequestedTimeMs !== undefined && frame.requestedTimeMs < lastRequestedTimeMs) clearActive(true)
      lastRequestedTimeMs = frame.requestedTimeMs
      expireAt(frame.requestedTimeMs)
      try {
        if (Array.isArray(signals)) {
          const length = Math.min(signals.length, MAX_SIGNAL_INPUTS_PER_FRAME)
          for (let index = 0; index < length; index += 1) {
            const signal = safeSignal(Reflect.get(signals, index), frame.requestedTimeMs)
            if (!signal) continue
            const pool = pools.get(signal.kind)
            if (!pool) continue
            if (signal.mode === 'sustain') {
              const existingIndex = sustainSlots.get(signal.id)
              if (existingIndex !== undefined && updateSustain(pool, existingIndex, signal, frame)) continue
              activate(pool, signal, frame, 0)
              continue
            }
            if (recentBurstIds.has(signal.id) || hasActiveBurst(signal.id)) continue
            rememberBurst(signal.id)
            const count = burstInstanceCount(signal.kind, signal.strength)
            for (let particleIndex = 0; particleIndex < count; particleIndex += 1) activate(pool, signal, frame, particleIndex)
          }
        }
      }
      catch {
        // 畸形数组或 Proxy 只终止当前输入批次；已有特效仍按本帧动作时间更新。 / A malformed array only ends this input batch; existing effects still update at action time.
      }
      updateVisuals(frame.requestedTimeMs)
    },
    snapshot,
    reset() {
      assertUsable()
      clearActive(true)
      lastRequestedTimeMs = undefined
    },
    dispose() {
      // Three 资源会在 dispose() 内同步派发事件；先封存入口，防止监听器重入导致资源重复释放。 / Three resources dispatch dispose events synchronously, so seal the entry before cleanup to prevent listener re-entry from releasing resources twice.
      if (disposing || disposed) return
      disposing = true
      const failures: string[] = []
      const attempt = (label: string, operation: () => void) => {
        try { operation() }
        catch (error) { failures.push(`${label}：${safeErrorDetail(error)}`) }
      }
      try {
        attempt('活动实例清理', () => clearActive(true))
        let geometryIndex = 0
        for (const geometry of ownedGeometries) attempt(`Geometry ${++geometryIndex}`, () => geometry.dispose())
        let materialIndex = 0
        for (const material of ownedMaterials) attempt(`Material ${++materialIndex}`, () => material.dispose())
        for (let index = 0; index < ownedObjects.length; index += 1) {
          const child = ownedObjects[index]!
          attempt(`特效子节点 ${index + 1} 移除`, () => child.removeFromParent())
        }
        attempt('场景移除', () => object.removeFromParent())
        attempt('子节点移除', () => object.clear())
      }
      finally {
        pools.clear()
        ownedGeometries.clear()
        ownedMaterials.clear()
        ownedObjects.length = 0
        sustainSlots.clear()
        recentBurstIds.clear()
        recentBurstQueue.fill(undefined)
        recentBurstStart = 0
        recentBurstCount = 0
        nextActivationSerial = 0
        lastRequestedTimeMs = undefined
        disposed = true
        disposing = false
      }
      if (failures.length > 0) throw new Error(`复杂双足运动特效资源释放失败：${failures.join('；')}`)
    },
  }
}
