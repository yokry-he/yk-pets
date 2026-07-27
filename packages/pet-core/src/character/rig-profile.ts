/**
 * 文件职责 / File responsibility
 * 定义与渲染框架无关的角色 Rig Profile 契约，并校验骨骼拓扑、语义引用与局部变换数据。
 */

export type CharacterRigProfileId = 'biped-pet/v1' | 'humanoid/v1' | 'quadruped/v1' | 'mech/v1'
export type CharacterSide = 'center' | 'left' | 'right'
export type RigVector3 = readonly [number, number, number]
export type RigQuaternion = readonly [number, number, number, number]

export interface RigBoneDefinition {
  id: string
  parentId?: string
  semantic: string
  side: CharacterSide
  restPosition: RigVector3
  restRotation: RigQuaternion
}

export interface JointLimitDefinition {
  boneId: string
  minimum: RigVector3
  maximum: RigVector3
  bendAxis?: RigVector3
}

export interface RigContactDefinition {
  id: string
  boneId: string
  kind: 'foot' | 'hand' | 'body'
  localPosition: RigVector3
  localRotation: RigQuaternion
}

export interface RigSocketDefinition {
  id: string
  boneId: string
  localPosition: RigVector3
  localRotation: RigQuaternion
}

export interface OptionalRigChainDefinition {
  id: 'ears' | 'tail' | 'antennae' | 'wings'
  rootBoneId: string
  defaultSegments: number
}

export interface CharacterRigProfile {
  id: CharacterRigProfileId
  bones: readonly RigBoneDefinition[]
  semanticBones: Readonly<Record<string, string>>
  optionalChains: readonly OptionalRigChainDefinition[]
  jointLimits: readonly JointLimitDefinition[]
  contacts: readonly RigContactDefinition[]
  sockets: readonly RigSocketDefinition[]
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isFiniteVector3 = (value: unknown): value is RigVector3 => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item))
const isFiniteQuaternion = (value: unknown): value is RigQuaternion => Array.isArray(value) && value.length === 4 && value.every(item => typeof item === 'number' && Number.isFinite(item))
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const PROFILE_IDS = new Set<CharacterRigProfileId>(['biped-pet/v1', 'humanoid/v1', 'quadruped/v1', 'mech/v1'])
const SIDES = new Set<CharacterSide>(['center', 'left', 'right'])
const OPTIONAL_CHAIN_IDS = new Set<OptionalRigChainDefinition['id']>(['ears', 'tail', 'antennae', 'wings'])
const CONTACT_KINDS = new Set<RigContactDefinition['kind']>(['foot', 'hand', 'body'])

/**
 * 返回按 Profile 声明顺序生成的稳定诊断，供导入、生成和编辑器在不中断用户流程时呈现问题。
 */
export function validateRigProfile(profile: unknown): string[] {
  const diagnostics: string[] = []
  if (!isRecord(profile)) {
    diagnostics.push('profile: expected object')
    return diagnostics
  }
  if (!PROFILE_IDS.has(profile.id as CharacterRigProfileId)) diagnostics.push(`id: unsupported rig profile id "${String(profile.id)}"`)

  const readArray = (key: string): readonly unknown[] => {
    const value = profile[key]
    if (Array.isArray(value)) return value
    diagnostics.push(`${key}: expected array`)
    return []
  }
  const bones = readArray('bones')
  const semanticBones = profile.semanticBones
  if (!isRecord(semanticBones)) diagnostics.push('semanticBones: expected object')
  const optionalChains = readArray('optionalChains')
  const jointLimits = readArray('jointLimits')
  const contacts = readArray('contacts')
  const sockets = readArray('sockets')
  const boneIds = new Set<string>()
  const parentByBoneId = new Map<string, string | undefined>()
  let rootCount = 0

  for (const [index, value] of bones.entries()) {
    const path = `bones[${index}]`
    if (!isRecord(value)) {
      diagnostics.push(`${path}: expected object`)
      continue
    }
    const id = value.id
    const parentId = value.parentId
    if (!isText(id)) diagnostics.push(`${path}.id: expected non-empty string`)
    else {
      if (boneIds.has(id)) diagnostics.push(`${path}.id: duplicate bone id "${id}"`)
      else parentByBoneId.set(id, isText(parentId) ? parentId : undefined)
      boneIds.add(id)
    }
    if (parentId !== undefined && !isText(parentId)) diagnostics.push(`${path}.parentId: expected non-empty string`)
    if (parentId === undefined && isText(id)) rootCount++
    if (!isText(value.semantic)) diagnostics.push(`${path}.semantic: expected non-empty string`)
    if (!SIDES.has(value.side as CharacterSide)) diagnostics.push(`${path}.side: expected center, left, or right`)
    if (!isFiniteVector3(value.restPosition)) diagnostics.push(`${path}.restPosition: expected finite Vector3`)
    if (!isFiniteQuaternion(value.restRotation)) diagnostics.push(`${path}.restRotation: expected finite Quaternion`)
  }

  if (rootCount !== 1) diagnostics.push(`bones: expected exactly one root, received ${rootCount}`)

  for (const [index, value] of bones.entries()) {
    if (isRecord(value) && isText(value.parentId) && !boneIds.has(value.parentId)) {
      diagnostics.push(`bones[${index}].parentId: unknown bone "${value.parentId}"`)
    }
  }

  const stateByBoneId = new Map<string, 0 | 1 | 2>()
  for (const startId of parentByBoneId.keys()) {
    if (stateByBoneId.get(startId) === 2) continue
    const path: string[] = []
    const pathIndexes = new Map<string, number>()
    let currentId: string | undefined = startId
    while (currentId && parentByBoneId.has(currentId) && stateByBoneId.get(currentId) !== 2) {
      const pathIndex = pathIndexes.get(currentId)
      if (pathIndex !== undefined) {
        diagnostics.push(`bones: cycle detected at "${currentId}"`)
        break
      }
      pathIndexes.set(currentId, path.length)
      path.push(currentId)
      stateByBoneId.set(currentId, 1)
      currentId = parentByBoneId.get(currentId)
    }
    for (const id of path) stateByBoneId.set(id, 2)
  }

  if (isRecord(semanticBones)) for (const [semantic, boneId] of Object.entries(semanticBones)) {
    if (!isText(boneId)) diagnostics.push(`semanticBones.${semantic}: expected non-empty string`)
    else if (!boneIds.has(boneId)) diagnostics.push(`semanticBones.${semantic}: unknown bone "${boneId}"`)
  }
  const optionalChainIds = new Set<string>()
  for (const [index, chain] of optionalChains.entries()) {
    const path = `optionalChains[${index}]`
    if (!isRecord(chain)) {
      diagnostics.push(`${path}: expected object`)
      continue
    }
    if (!isText(chain.id)) diagnostics.push(`${path}.id: expected non-empty string`)
    else {
      if (!OPTIONAL_CHAIN_IDS.has(chain.id as OptionalRigChainDefinition['id'])) diagnostics.push(`${path}.id: expected ears, tail, antennae, or wings`)
      if (optionalChainIds.has(chain.id)) diagnostics.push(`${path}.id: duplicate optional chain id "${chain.id}"`)
      optionalChainIds.add(chain.id)
    }
    if (!Number.isInteger(chain.defaultSegments) || typeof chain.defaultSegments !== 'number' || !Number.isFinite(chain.defaultSegments) || chain.defaultSegments <= 0) diagnostics.push(`${path}.defaultSegments: expected positive finite integer`)
    if (!isText(chain.rootBoneId)) diagnostics.push(`${path}.rootBoneId: expected non-empty string`)
    else if (!boneIds.has(chain.rootBoneId)) diagnostics.push(`${path}.rootBoneId: unknown bone "${chain.rootBoneId}"`)
  }
  for (const [index, limit] of jointLimits.entries()) {
    const path = `jointLimits[${index}]`
    if (!isRecord(limit)) {
      diagnostics.push(`${path}: expected object`)
      continue
    }
    if (!isText(limit.boneId)) diagnostics.push(`${path}.boneId: expected non-empty string`)
    else if (!boneIds.has(limit.boneId)) diagnostics.push(`${path}.boneId: unknown bone "${limit.boneId}"`)
    if (!isFiniteVector3(limit.minimum)) diagnostics.push(`${path}.minimum: expected finite Vector3`)
    if (!isFiniteVector3(limit.maximum)) diagnostics.push(`${path}.maximum: expected finite Vector3`)
    if (limit.bendAxis !== undefined && !isFiniteVector3(limit.bendAxis)) diagnostics.push(`${path}.bendAxis: expected finite Vector3`)
  }
  const contactIds = new Set<string>()
  for (const [index, contact] of contacts.entries()) {
    const path = `contacts[${index}]`
    if (!isRecord(contact)) {
      diagnostics.push(`${path}: expected object`)
      continue
    }
    if (!isText(contact.id)) diagnostics.push(`${path}.id: expected non-empty string`)
    else {
      if (contactIds.has(contact.id)) diagnostics.push(`${path}.id: duplicate contact id "${contact.id}"`)
      contactIds.add(contact.id)
    }
    if (!CONTACT_KINDS.has(contact.kind as RigContactDefinition['kind'])) diagnostics.push(`${path}.kind: expected foot, hand, or body`)
    if (!isText(contact.boneId)) diagnostics.push(`${path}.boneId: expected non-empty string`)
    else if (!boneIds.has(contact.boneId)) diagnostics.push(`${path}.boneId: unknown bone "${contact.boneId}"`)
    if (!isFiniteVector3(contact.localPosition)) diagnostics.push(`${path}.localPosition: expected finite Vector3`)
    if (!isFiniteQuaternion(contact.localRotation)) diagnostics.push(`${path}.localRotation: expected finite Quaternion`)
  }
  const socketIds = new Set<string>()
  for (const [index, socket] of sockets.entries()) {
    const path = `sockets[${index}]`
    if (!isRecord(socket)) {
      diagnostics.push(`${path}: expected object`)
      continue
    }
    if (!isText(socket.id)) diagnostics.push(`${path}.id: expected non-empty string`)
    else {
      if (socketIds.has(socket.id)) diagnostics.push(`${path}.id: duplicate socket id "${socket.id}"`)
      socketIds.add(socket.id)
    }
    if (!isText(socket.boneId)) diagnostics.push(`${path}.boneId: expected non-empty string`)
    else if (!boneIds.has(socket.boneId)) diagnostics.push(`${path}.boneId: unknown bone "${socket.boneId}"`)
    if (!isFiniteVector3(socket.localPosition)) diagnostics.push(`${path}.localPosition: expected finite Vector3`)
    if (!isFiniteQuaternion(socket.localRotation)) diagnostics.push(`${path}.localRotation: expected finite Quaternion`)
  }

  return diagnostics
}
