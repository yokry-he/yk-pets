/**
 * 文件职责 / File responsibility
 * 将站内双足萌宠配方确定性地编译为骨骼、基础网格和四权重蒙皮数据；此模块不依赖 Three.js 或界面层。
 */

import { BIPED_PET_RIG_PROFILE } from './biped-pet-profile'
import { normalizeBipedPetModelRecipe, type CharacterModelRecipeV1 } from './model-recipe'
import { validateRigProfile, type CharacterIkSolver, type CharacterLimbIkDefinition, type JointLimitDefinition, type RigContactDefinition, type RigQuaternion, type RigSocketDefinition, type RigVector3 } from './rig-profile'

export interface CompiledCharacterBone {
  id: string
  parentIndex: number
  position: [number, number, number]
  semantic: string
  side: 'center' | 'left' | 'right'
}

export interface CompiledCharacterMesh {
  vertexCount: number
  positions: number[]
  indices: number[]
  skinIndices: number[]
  skinWeights: number[]
}

export interface CharacterCompilationDiagnostic {
  id: string
  severity: 'info' | 'warning' | 'error'
  message: string
  affectedSemantic?: string
}

export interface CompiledCharacterJointLimit {
  boneId: string
  minimum: [number, number, number]
  maximum: [number, number, number]
  bendAxis?: [number, number, number]
}

export interface CompiledCharacterContact {
  id: string
  boneId: string
  kind: 'foot' | 'hand' | 'body'
  localPosition: [number, number, number]
  localRotation: [number, number, number, number]
}

export interface CompiledCharacterSocket {
  id: string
  boneId: string
  localPosition: [number, number, number]
  localRotation: [number, number, number, number]
}

export interface CompiledCharacterLimbIk {
  id: string
  solver: CharacterIkSolver
  boneIds: string[]
  contactId: string
  poleAxis: [number, number, number]
  maxStretchRatio: number
  maxCorrectionRadians: number
  weight: number
}

export interface CompiledCharacterModel {
  status: 'ready' | 'blocked'
  hash: string
  profileId: 'biped-pet/v1'
  generatorVersion: 'biped-pet-generator/v1'
  bones: CompiledCharacterBone[]
  mesh: CompiledCharacterMesh
  jointLimits: CompiledCharacterJointLimit[]
  contacts: CompiledCharacterContact[]
  sockets: CompiledCharacterSocket[]
  limbIk: CompiledCharacterLimbIk[]
  diagnostics: CharacterCompilationDiagnostic[]
}

type Vector3 = [number, number, number]
type Pipe = { start: number, end: number, radius: number }

const RADIAL_SEGMENTS = 8
const AXIAL_SEGMENTS = 4
const emptyMesh = (): CompiledCharacterMesh => ({ vertexCount: 0, positions: [], indices: [], skinIndices: [], skinWeights: [] })
const finite = (value: number) => Number.isFinite(value)
const add = (left: Vector3, right: Vector3): Vector3 => [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
const subtract = (left: Vector3, right: Vector3): Vector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const multiply = (vector: Vector3, scalar: number): Vector3 => [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
const cross = (left: Vector3, right: Vector3): Vector3 => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]
const length = (vector: Vector3) => Math.hypot(vector[0], vector[1], vector[2])
const normalize = (vector: Vector3, fallback: Vector3): Vector3 => {
  const vectorLength = length(vector)
  return vectorLength > 1e-8 && finite(vectorLength) ? multiply(vector, 1 / vectorLength) : fallback
}
const smoothstep = (minimum: number, maximum: number, value: number) => {
  const clamped = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)))
  return clamped * clamped * (3 - 2 * clamped)
}
const clone3 = (value: RigVector3): Vector3 => [value[0], value[1], value[2]]
const clone4 = (value: RigQuaternion): [number, number, number, number] => [value[0], value[1], value[2], value[3]]

/**
 * Profile 的休止姿势以中性尺寸定义；只在相关肢体链上应用比例因子，避免把头部比例误传到腿或手部。
 */
function scaleRestPosition(id: string, source: RigVector3, recipe: CharacterModelRecipeV1): Vector3 {
  const global = recipe.proportions.height / 1.35
  const torso = recipe.proportions.torsoLength / .72
  const arm = recipe.proportions.armLength / .82
  const leg = recipe.proportions.legLength / .94
  const head = recipe.proportions.headRatio / .34
  const shoulder = recipe.proportions.shoulderWidth / .78
  const hip = recipe.proportions.hipWidth / .66
  const position = clone3(source)
  if (id.includes('spine') || id === 'chest') return [position[0] * shoulder, position[1] * torso * global, position[2] * global]
  if (id === 'neck' || id === 'head') return [position[0], position[1] * head * global, position[2] * head]
  if (id.includes('clavicle')) return [position[0] * shoulder, position[1] * global, position[2] * global]
  if (id.includes('arm') || id.includes('elbow') || id.includes('forearm') || id.includes('wrist') || id.includes('hand')) return [position[0] * arm * global, position[1] * arm * global, position[2] * global]
  if (id.includes('hip')) return [position[0] * hip, position[1] * global, position[2] * global]
  if (id.includes('thigh') || id.includes('knee') || id.includes('calf') || id.includes('ankle') || id.includes('foot') || id.includes('toe')) return [position[0] * hip, position[1] * leg * global, position[2] * leg * global]
  return multiply(position, global)
}

function compileBones(recipe: CharacterModelRecipeV1) {
  const bones: CompiledCharacterBone[] = []
  const worlds: Vector3[] = []
  const boneIndexById = new Map<string, number>()
  for (const definition of BIPED_PET_RIG_PROFILE.bones) {
    const parentIndex = definition.parentId === undefined ? -1 : boneIndexById.get(definition.parentId) ?? -1
    const position = scaleRestPosition(definition.id, definition.restPosition, recipe)
    const index = bones.length
    bones.push({ id: definition.id, parentIndex, position, semantic: definition.semantic, side: definition.side })
    worlds.push(parentIndex === -1 ? position : add(worlds[parentIndex]!, position))
    boneIndexById.set(definition.id, index)
  }

  const append = (id: string, parentIndex: number, position: Vector3, semantic: string, side: CompiledCharacterBone['side']) => {
    const index = bones.length
    bones.push({ id, parentIndex, position, semantic, side })
    worlds.push(add(worlds[parentIndex]!, position))
    boneIndexById.set(id, index)
    return index
  }
  const addChain = (prefix: string, rootId: string, segments: number, first: Vector3, next: Vector3, semantic: string, side: CompiledCharacterBone['side']) => {
    let parentIndex = boneIndexById.get(rootId) ?? -1
    for (let segment = 1; segment <= segments && parentIndex >= 0; segment++) {
      parentIndex = append(`${prefix}.${segment}`, parentIndex, segment === 1 ? first : next, `${semantic}.${segment}`, side)
    }
  }
  const { ears, tail, antennae } = recipe.appendages
  if (ears.enabled) {
    const rise = ears.length / ears.segments
    addChain('ear.left', 'head', ears.segments, [-.16, rise, 0], [0, rise, 0], 'ear.left', 'left')
    addChain('ear.right', 'head', ears.segments, [.16, rise, 0], [0, rise, 0], 'ear.right', 'right')
  }
  // 根部保留轻微下沉，但每节都消耗相同的纵深长度；因此尾根到末端的 Z 位移严格等于配方长度。 / Keep a small root drop while every segment consumes equal depth, so root-to-tip Z displacement equals recipe length.
  if (tail.enabled) addChain('tail', 'pelvis', tail.segments, [0, -.04, -tail.length / tail.segments], [0, 0, -tail.length / tail.segments], 'tail', 'center')
  if (antennae.enabled) {
    const rise = antennae.length / antennae.segments
    addChain('antenna.left', 'head', antennae.segments, [-.1, rise, 0], [0, rise, 0], 'antenna.left', 'left')
    addChain('antenna.right', 'head', antennae.segments, [.1, rise, 0], [0, rise, 0], 'antenna.right', 'right')
  }
  return { bones, worlds, boneIndexById }
}

function addVertex(mesh: CompiledCharacterMesh, position: Vector3, indices: readonly number[], weights: readonly number[]) {
  mesh.positions.push(position[0], position[1], position[2])
  mesh.skinIndices.push(indices[0] ?? 0, indices[1] ?? 0, indices[2] ?? 0, indices[3] ?? 0)
  mesh.skinWeights.push(weights[0] ?? 1, weights[1] ?? 0, weights[2] ?? 0, weights[3] ?? 0)
}

/** 每个管段固定为八径向、四轴向分段，生成器可用相同拓扑安全地替换后续材质与渲染实现。 */
function addPipe(mesh: CompiledCharacterMesh, start: Vector3, end: Vector3, pipe: Pipe) {
  const direction = normalize(subtract(end, start), [0, 1, 0])
  const reference: Vector3 = Math.abs(direction[1]) > .92 ? [1, 0, 0] : [0, 1, 0]
  const tangent = normalize(cross(direction, reference), [0, 0, 1])
  const bitangent = normalize(cross(direction, tangent), [1, 0, 0])
  const offset = mesh.vertexCount
  for (let axial = 0; axial <= AXIAL_SEGMENTS; axial++) {
    const t = axial / AXIAL_SEGMENTS
    const center = add(start, multiply(subtract(end, start), t))
    const endWeight = smoothstep(.18, .82, t)
    for (let radial = 0; radial < RADIAL_SEGMENTS; radial++) {
      const angle = radial / RADIAL_SEGMENTS * Math.PI * 2
      const ring = add(multiply(tangent, Math.cos(angle) * pipe.radius), multiply(bitangent, Math.sin(angle) * pipe.radius))
      addVertex(mesh, add(center, ring), [pipe.start, pipe.end, 0, 0], [1 - endWeight, endWeight, 0, 0])
    }
  }
  for (let axial = 0; axial < AXIAL_SEGMENTS; axial++) for (let radial = 0; radial < RADIAL_SEGMENTS; radial++) {
    const next = (radial + 1) % RADIAL_SEGMENTS
    const a = offset + axial * RADIAL_SEGMENTS + radial
    const b = offset + axial * RADIAL_SEGMENTS + next
    const c = offset + (axial + 1) * RADIAL_SEGMENTS + radial
    const d = offset + (axial + 1) * RADIAL_SEGMENTS + next
    mesh.indices.push(a, b, c, b, d, c)
  }
  mesh.vertexCount += (AXIAL_SEGMENTS + 1) * RADIAL_SEGMENTS
}

/** 头、手、脚是刚性区：每个顶点都完全绑定其语义末端骨，以便动作编辑器可以稳定驱动。 */
function addEllipsoid(mesh: CompiledCharacterMesh, center: Vector3, radii: Vector3, boneIndex: number) {
  const latitude = 6
  const longitude = 8
  const offset = mesh.vertexCount
  // 极点只保留一个共享顶点；纬圈不重复首尾顶点，避免 UV 球常见的零面积极点三角形。
  addVertex(mesh, [center[0], center[1] + radii[1], center[2]], [boneIndex, 0, 0, 0], [1, 0, 0, 0])
  for (let row = 1; row < latitude; row++) {
    const phi = row / latitude * Math.PI
    for (let column = 0; column < longitude; column++) {
      const theta = column / longitude * Math.PI * 2
      addVertex(mesh, [
        center[0] + Math.sin(phi) * Math.cos(theta) * radii[0],
        center[1] + Math.cos(phi) * radii[1],
        center[2] + Math.sin(phi) * Math.sin(theta) * radii[2],
      ], [boneIndex, 0, 0, 0], [1, 0, 0, 0])
    }
  }
  const bottom = offset + 1 + (latitude - 1) * longitude
  addVertex(mesh, [center[0], center[1] - radii[1], center[2]], [boneIndex, 0, 0, 0], [1, 0, 0, 0])
  const firstRing = offset + 1
  for (let column = 0; column < longitude; column++) {
    const next = (column + 1) % longitude
    mesh.indices.push(offset, firstRing + next, firstRing + column)
  }
  for (let row = 0; row < latitude - 2; row++) for (let column = 0; column < longitude; column++) {
    const next = (column + 1) % longitude
    const a = firstRing + row * longitude + column
    const b = firstRing + row * longitude + next
    const c = firstRing + (row + 1) * longitude + column
    const d = firstRing + (row + 1) * longitude + next
    mesh.indices.push(a, b, c, b, d, c)
  }
  const lastRing = firstRing + (latitude - 2) * longitude
  for (let column = 0; column < longitude; column++) {
    const next = (column + 1) % longitude
    mesh.indices.push(lastRing + column, lastRing + next, bottom)
  }
  mesh.vertexCount += 2 + (latitude - 1) * longitude
}

function cloneJointLimit(limit: JointLimitDefinition): CompiledCharacterJointLimit {
  return { boneId: limit.boneId, minimum: clone3(limit.minimum), maximum: clone3(limit.maximum), ...(limit.bendAxis ? { bendAxis: clone3(limit.bendAxis) } : {}) }
}
function cloneContact(contact: RigContactDefinition): CompiledCharacterContact {
  return { id: contact.id, boneId: contact.boneId, kind: contact.kind, localPosition: clone3(contact.localPosition), localRotation: clone4(contact.localRotation) }
}
function cloneSocket(socket: RigSocketDefinition): CompiledCharacterSocket {
  return { id: socket.id, boneId: socket.boneId, localPosition: clone3(socket.localPosition), localRotation: clone4(socket.localRotation) }
}
function cloneLimbIk(limb: CharacterLimbIkDefinition): CompiledCharacterLimbIk {
  return {
    id: limb.id,
    solver: limb.solver,
    boneIds: [...limb.boneIds],
    contactId: limb.contactId,
    poleAxis: clone3(limb.poleAxis),
    maxStretchRatio: limb.maxStretchRatio,
    maxCorrectionRadians: limb.maxCorrectionRadians,
    weight: limb.weight,
  }
}

/**
 * 接触点与 Socket 是几何编译结果的一部分，而不是固定 Profile 常量：局部偏移必须随实际生成的末端尺寸变化。
 */
function compileContacts(recipe: CharacterModelRecipeV1): CompiledCharacterContact[] {
  const footSize = recipe.proportions.footSize
  return BIPED_PET_RIG_PROFILE.contacts.map(contact => {
    const compiled = cloneContact(contact)
    if (compiled.kind === 'foot') {
      compiled.localPosition = [
        compiled.localPosition[0] * footSize / .28,
        -footSize * .65,
        compiled.localPosition[2] * footSize / .28,
      ]
    }
    return compiled
  })
}

function compileSockets(recipe: CharacterModelRecipeV1): CompiledCharacterSocket[] {
  const global = recipe.proportions.height / 1.35
  const footSize = recipe.proportions.footSize
  const head = recipe.proportions.headRatio / .34
  const shoulder = recipe.proportions.shoulderWidth / .78
  const torso = recipe.proportions.torsoLength / .72
  const hip = recipe.proportions.hipWidth / .66
  return BIPED_PET_RIG_PROFILE.sockets.map(socket => {
    const compiled = cloneSocket(socket)
    switch (compiled.id) {
      case 'foot.left':
      case 'foot.right':
        compiled.localPosition = [compiled.localPosition[0] * footSize / .28, -footSize * .65, compiled.localPosition[2] * footSize / .28]
        break
      case 'head':
        compiled.localPosition = multiply(compiled.localPosition, head)
        break
      case 'back':
        // 萌宠没有独立胸深参数，先以肩宽作为胸深代理，同时保留躯干高度比例。 / Biped pets have no chest-depth control, so shoulder width proxies depth while torso height stays proportional.
        compiled.localPosition = [compiled.localPosition[0] * shoulder * global, compiled.localPosition[1] * torso * global, compiled.localPosition[2] * shoulder * global]
        break
      case 'tail.base':
        compiled.localPosition = [compiled.localPosition[0] * hip, compiled.localPosition[1] * global, compiled.localPosition[2] * hip * global]
        break
    }
    return compiled
  })
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}
function hash(value: unknown) {
  let result = 2166136261
  for (const character of stableStringify(value)) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return `bpc-${(result >>> 0).toString(16).padStart(8, '0')}`
}

function blockedByProfile(recipe: CharacterModelRecipeV1, profileDiagnostics: readonly string[]): CompiledCharacterModel {
  const diagnostics = profileDiagnostics.map((message, index): CharacterCompilationDiagnostic => ({
    id: `profile-validation-${index}`,
    severity: 'error',
    message: `Rig Profile 无法安全编译：${message}`,
  }))
  return {
    status: 'blocked',
    hash: hash({ recipe: { ...recipe, updatedAt: undefined }, profileDiagnostics }),
    profileId: 'biped-pet/v1',
    generatorVersion: 'biped-pet-generator/v1',
    bones: [],
    mesh: emptyMesh(),
    jointLimits: [],
    contacts: [],
    sockets: [],
    limbIk: [],
    diagnostics,
  }
}

const isFiniteVector3 = (value: readonly number[]) => value.length === 3 && value.every(Number.isFinite)
const isFiniteQuaternion = (value: readonly number[]) => value.length === 4 && value.every(Number.isFinite)
const COMPILED_IK_SOLVERS = new Set<CharacterIkSolver>(['analytic-two-bone', 'fabrik', 'auto'])

/**
 * 编译器是跨运行时的安全边界。即使 Profile 常量被调试代码或未来扩展意外污染，也必须返回可检查的 blocked 结果，
 * 而不是把非法索引、NaN 或悬空 Socket 交给渲染器。
 */
function ensureCompiledData(model: Omit<CompiledCharacterModel, 'status' | 'hash'>): CharacterCompilationDiagnostic[] {
  const errors: CharacterCompilationDiagnostic[] = []
  const error = (id: string, message: string, affectedSemantic?: string) => errors.push({ id, severity: 'error', message, ...(affectedSemantic ? { affectedSemantic } : {}) })
  const boneIds = new Set<string>()
  const boneIndexById = new Map<string, number>()
  for (const [index, bone] of model.bones.entries()) {
    if (boneIds.has(bone.id)) error('bone-id-duplicate', `骨骼 ${index} 的 ID 重复：${bone.id}。`, bone.semantic)
    boneIds.add(bone.id)
    boneIndexById.set(bone.id, index)
    if (!isFiniteVector3(bone.position)) error('bone-position', `骨骼 ${bone.id} 包含非有限位置。`, bone.semantic)
    if (bone.parentIndex !== -1 && (!Number.isInteger(bone.parentIndex) || bone.parentIndex < 0 || bone.parentIndex >= index)) {
      error('bone-parent-index', `骨骼 ${bone.id} 的父级索引必须位于当前骨骼之前。`, bone.semantic)
    }
  }

  const { mesh } = model
  if (!Number.isInteger(mesh.vertexCount) || mesh.vertexCount < 0 || mesh.positions.length !== mesh.vertexCount * 3) {
    error('mesh-vertex-layout', '网格顶点数量与 position 数组长度不一致。')
  }
  if (!mesh.positions.every(Number.isFinite)) error('mesh-position', '生成网格包含非有限位置。')
  if (!mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.vertexCount)) {
    error('mesh-index', '生成网格包含越界或非整数索引。')
  }
  const expectedSkinLength = mesh.vertexCount * 4
  if (mesh.skinIndices.length !== expectedSkinLength || mesh.skinWeights.length !== expectedSkinLength) {
    error('skin-layout', '蒙皮索引或权重数组长度与顶点数量不一致。')
  }
  if (!mesh.skinIndices.every(index => Number.isInteger(index) && index >= 0 && index < model.bones.length)) {
    error('skin-index', '蒙皮包含越界或非整数骨骼索引。')
  }
  if (!mesh.skinWeights.every(weight => Number.isFinite(weight) && weight >= 0)) error('skin-weight', '蒙皮包含非有限或负权重。')
  if (mesh.skinWeights.length === expectedSkinLength) for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
    const offset = vertex * 4
    const total = mesh.skinWeights[offset]! + mesh.skinWeights[offset + 1]! + mesh.skinWeights[offset + 2]! + mesh.skinWeights[offset + 3]!
    if (!Number.isFinite(total) || Math.abs(total - 1) >= 1e-6) {
      error('skin-weight-sum', '每个顶点的四槽蒙皮权重之和必须为 1。')
      break
    }
  }

  for (const limit of model.jointLimits) {
    if (!boneIds.has(limit.boneId)) error('joint-limit-reference', `关节限制引用了不存在的骨骼：${limit.boneId}。`)
    if (!isFiniteVector3(limit.minimum) || !isFiniteVector3(limit.maximum) || (limit.bendAxis !== undefined && !isFiniteVector3(limit.bendAxis))) {
      error('joint-limit-vector', `关节限制 ${limit.boneId} 包含非有限向量。`)
    }
  }
  const contactIds = new Set<string>()
  for (const contact of model.contacts) {
    contactIds.add(contact.id)
    if (!boneIds.has(contact.boneId)) error('contact-reference', `接触点 ${contact.id} 引用了不存在的骨骼：${contact.boneId}。`)
    if (!isFiniteVector3(contact.localPosition) || !isFiniteQuaternion(contact.localRotation)) {
      error('contact-transform', `接触点 ${contact.id} 包含非有限局部变换。`)
    }
  }
  for (const socket of model.sockets) {
    if (!boneIds.has(socket.boneId)) error('socket-reference', `Socket ${socket.id} 引用了不存在的骨骼：${socket.boneId}。`)
    if (!isFiniteVector3(socket.localPosition) || !isFiniteQuaternion(socket.localRotation)) {
      error('socket-transform', `Socket ${socket.id} 包含非有限局部变换。`)
    }
  }

  const limbIds = new Set<string>()
  for (const [index, limb] of model.limbIk.entries()) {
    const label = `IK 肢体 ${index}`
    if (typeof limb.id !== 'string' || limb.id.trim().length === 0) error('limb-ik-id', `${label} 的 ID 必须为非空字符串。`)
    else {
      if (limbIds.has(limb.id)) error('limb-ik-id-duplicate', `${label} 的 ID 重复：${limb.id}。`)
      limbIds.add(limb.id)
    }
    if (!COMPILED_IK_SOLVERS.has(limb.solver)) error('limb-ik-solver', `${label} 的求解器类型无效。`)
    if (!Array.isArray(limb.boneIds) || limb.boneIds.length < 3) error('limb-ik-chain-length', `${label} 至少需要三根连续骨骼。`)
    else for (const [boneIndex, boneId] of limb.boneIds.entries()) {
      if (typeof boneId !== 'string' || !boneIds.has(boneId)) {
        error('limb-ik-bone-reference', `${label} 引用了不存在的骨骼：${String(boneId)}。`)
        continue
      }
      if (boneIndex > 0) {
        const previousId = limb.boneIds[boneIndex - 1]
        const currentIndex = boneIndexById.get(boneId)
        const previousIndex = typeof previousId === 'string' ? boneIndexById.get(previousId) : undefined
        if (currentIndex !== undefined && previousIndex !== undefined && model.bones[currentIndex]?.parentIndex !== previousIndex) {
          error('limb-ik-chain', `${label} 在 ${previousId} 与 ${boneId} 之间的父子路径不连续。`)
        }
      }
    }
    if (typeof limb.contactId !== 'string' || !contactIds.has(limb.contactId)) error('limb-ik-contact-reference', `${label} 引用了不存在的接触点：${String(limb.contactId)}。`)
    const poleLength = isFiniteVector3(limb.poleAxis) ? Math.hypot(...limb.poleAxis) : Number.NaN
    if (!Number.isFinite(poleLength) || poleLength <= 0) error('limb-ik-pole-axis', `${label} 的极向量必须为非零有限向量。`)
    if (!Number.isFinite(limb.maxStretchRatio) || limb.maxStretchRatio < .8 || limb.maxStretchRatio > 1) error('limb-ik-stretch', `${label} 的伸展比必须为 [0.8, 1] 内的有限数值。`)
    if (!Number.isFinite(limb.maxCorrectionRadians) || limb.maxCorrectionRadians <= 0 || limb.maxCorrectionRadians > Math.PI) error('limb-ik-correction', `${label} 的单帧修正角必须为 (0, Math.PI] 内的有限数值。`)
    if (!Number.isFinite(limb.weight) || limb.weight < 0 || limb.weight > 1) error('limb-ik-weight', `${label} 的权重必须为 [0, 1] 内的有限数值。`)
  }
  return errors
}

/**
 * 编译路径固定为：配方归一化 → 骨架 → 可选附属链 → 网格/权重 → 引用克隆与诊断 → 哈希。
 * 即使传入损坏的持久化数据，归一化层也会先将它收敛为可安全生成的站内配方。
 */
export function compileBipedPetCharacter(input: unknown): CompiledCharacterModel {
  const recipe = normalizeBipedPetModelRecipe(input)
  // 先验证再编译，确保未知父级、短向量等畸形 Profile 不会被默认值或额外 Root 静默掩盖。
  const profileDiagnostics = validateRigProfile(BIPED_PET_RIG_PROFILE)
  if (profileDiagnostics.length > 0) return blockedByProfile(recipe, profileDiagnostics)
  try {
    const { bones, worlds, boneIndexById } = compileBones(recipe)
    const mesh = emptyMesh()
    const pipes: Pipe[] = []
    for (const bone of bones) if (bone.parentIndex >= 0) {
      if (bone.id === 'pelvis' || bone.id === 'root') continue
      const radius = bone.id.includes('arm') || bone.id.includes('elbow') || bone.id.includes('forearm') || bone.id.includes('wrist') || bone.id.includes('hand') ? recipe.proportions.handSize * .48
        : bone.id.includes('hip') || bone.id.includes('thigh') || bone.id.includes('knee') || bone.id.includes('calf') || bone.id.includes('ankle') || bone.id.includes('foot') || bone.id.includes('toe') ? recipe.proportions.footSize * .55
          : bone.id.includes('ear') || bone.id.includes('antenna') ? .035
            : bone.id.includes('tail') ? .055 : recipe.proportions.shoulderWidth * .22
      pipes.push({ start: bone.parentIndex, end: boneIndexById.get(bone.id) ?? 0, radius })
    }
    for (const pipe of pipes) addPipe(mesh, worlds[pipe.start]!, worlds[pipe.end]!, pipe)
    const head = boneIndexById.get('head') ?? 0
    addEllipsoid(mesh, worlds[head]!, [recipe.proportions.headRatio * .64, recipe.proportions.headRatio * .58, recipe.proportions.headRatio * .54], head)
    for (const id of ['hand.left', 'hand.right']) {
      const index = boneIndexById.get(id) ?? 0
      addEllipsoid(mesh, worlds[index]!, [recipe.proportions.handSize, recipe.proportions.handSize, recipe.proportions.handSize], index)
    }
    for (const id of ['foot.left', 'foot.right']) {
      const index = boneIndexById.get(id) ?? 0
      addEllipsoid(mesh, worlds[index]!, [recipe.proportions.footSize, recipe.proportions.footSize * .65, recipe.proportions.footSize * 1.2], index)
    }
    const model = {
      profileId: 'biped-pet/v1' as const,
      generatorVersion: 'biped-pet-generator/v1' as const,
      bones,
      mesh,
      jointLimits: BIPED_PET_RIG_PROFILE.jointLimits.map(cloneJointLimit),
      contacts: compileContacts(recipe),
      sockets: compileSockets(recipe),
      limbIk: (BIPED_PET_RIG_PROFILE.limbIk ?? []).map(cloneLimbIk),
      diagnostics: [] as CharacterCompilationDiagnostic[],
    }
    const errors = ensureCompiledData(model)
    model.diagnostics.push(...errors)
    const hashInput = { recipe: { ...recipe, updatedAt: undefined }, ...model }
    if (errors.length > 0) return { ...model, status: 'blocked', hash: hash(hashInput), limbIk: [] }
    return { ...model, status: 'ready', hash: hash(hashInput) }
  } catch {
    const diagnostics: CharacterCompilationDiagnostic[] = [{ id: 'compiler-failure', severity: 'error', message: '角色生成器无法安全编译当前数据。' }]
    return {
      status: 'blocked',
      hash: hash({ recipe: { ...recipe, updatedAt: undefined }, diagnostics }),
      profileId: 'biped-pet/v1',
      generatorVersion: 'biped-pet-generator/v1',
      bones: [],
      mesh: emptyMesh(),
      jointLimits: [],
      contacts: [],
      sockets: [],
      limbIk: [],
      diagnostics,
    }
  }
}
