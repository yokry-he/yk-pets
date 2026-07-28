/**
 * 文件职责 / File responsibility
 * 定义并实现双足萌宠语义姿态适配、Quaternion Clip 编译及安全采样传播；数值 Root Motion 由后续模块负责。
 */

import { BIPED_PET_RIG_PROFILE } from '../character/biped-pet-profile'
import { validateRigProfile, type CharacterRigProfile, type RigVector3 } from '../character/rig-profile'
import { evaluateNormalizedMotionAsset, type EvaluatedCloudFoxPose } from './motion-evaluator'
import { normalizeMotionAsset, type StudioMotionAssetV2 } from './motion-asset'
import { normalizeMotionDurationMs, resolveMotionTime, type ResolvedMotionTime, type StudioMotionLoopMode } from './motion-time'
import { IDENTITY_MOTION_QUATERNION, motionEulerToQuaternion, slerpMotionQuaternion, type MotionQuaternion } from './quaternion-motion'
import {
  normalizeBipedPetRootMotion,
  type BipedPetRootMotionDefinition,
} from './biped-pet-root-motion'

export const BIPED_PET_MOTION_ADAPTER_ID = 'biped-pet-motion-adapter/v1' as const
export const BIPED_PET_QUATERNION_CLIP_SCHEMA_VERSION = 1 as const
export const MAX_BIPED_PET_MOTION_CONTACT_CANDIDATES = 64
export const MAX_BIPED_PET_MOTION_SEMANTIC_EVENTS = 64

export interface BipedPetBoneQuaternionKeyframe {
  timeMs: number
  value: MotionQuaternion
}

export interface BipedPetBoneQuaternionTrack {
  boneId: string
  keyframes: readonly BipedPetBoneQuaternionKeyframe[]
}

export interface BipedPetRootPositionKeyframe {
  timeMs: number
  value: RigVector3
}

export interface BipedPetMotionContactCandidate {
  contactId: string
  startMs: number
  endMs: number
  confidence: number
  fadeIn?: boolean
  fadeOut?: boolean
}

export interface BipedPetMotionSemanticEvent {
  id: string
  kind: 'takeoff' | 'landing' | 'wave-peak' | 'hit'
  timeMs: number
}

export interface BipedPetMotionDiagnostic {
  id: string
  severity: 'warning' | 'error'
  message: string
  boneId?: string
}

export interface BipedPetQuaternionClip {
  schemaVersion: typeof BIPED_PET_QUATERNION_CLIP_SCHEMA_VERSION
  adapterId: typeof BIPED_PET_MOTION_ADAPTER_ID
  profileId: 'biped-pet/v1'
  sourceMotionId: string
  durationMs: number
  loopMode: StudioMotionLoopMode
  status: 'ready' | 'blocked'
  hash: string
  rootMotion: BipedPetRootMotionDefinition
  boneTracks: readonly BipedPetBoneQuaternionTrack[]
  rootPositionTrack: readonly BipedPetRootPositionKeyframe[]
  contacts: readonly BipedPetMotionContactCandidate[]
  events: readonly BipedPetMotionSemanticEvent[]
  diagnostics: readonly BipedPetMotionDiagnostic[]
}

export interface BipedPetMotionCompileTarget {
  profile?: CharacterRigProfile
  boneIds?: readonly string[]
}

export interface AdaptedBipedPetBonePose {
  boneId: string
  rotation: MotionQuaternion
}

export interface AdaptedBipedPetPose {
  bones: readonly AdaptedBipedPetBonePose[]
  rootPosition: RigVector3
  diagnostics: readonly BipedPetMotionDiagnostic[]
}

export interface SampledBipedPetMotion {
  sourceMotionId: string
  clipHash: string
  durationMs: number
  loopMode: StudioMotionLoopMode
  requestedTimeMs: number
  resolvedTimeMs: number
  iteration: number
  direction: ResolvedMotionTime['direction']
  rootMotion: BipedPetRootMotionDefinition
  bones: readonly { boneId: string, rotation: MotionQuaternion }[]
  rootPosition: RigVector3
  activeContacts: readonly string[]
  contactStates: readonly SampledBipedPetContactState[]
}

export interface SampledBipedPetContactState {
  contactId: string
  phase: 'acquiring' | 'locked' | 'releasing'
  weight: number
  confidence: number
}

type RotationDistribution = readonly (readonly [boneId: string, weight: number])[]
type MutableVector3 = [number, number, number]
type BipedPetMotionExtensionWarning = Readonly<{
  id: string
  severity: 'warning'
  message: string
}>

const ROOT_POSITION_SCALE = .24
const BODY_DISTRIBUTION: RotationDistribution = [
  ['pelvis', .2], ['spine.lower', .2], ['spine.middle', .2], ['spine.upper', .2], ['chest', .2],
]
const HEAD_DISTRIBUTION: RotationDistribution = [['neck', .35], ['head', .65]]
const FRONT_LEFT_DISTRIBUTION: RotationDistribution = [['clavicle.left', .12], ['upper-arm.left', .48], ['forearm.left', .25], ['wrist.left', .15]]
const FRONT_RIGHT_DISTRIBUTION: RotationDistribution = [['clavicle.right', .12], ['upper-arm.right', .48], ['forearm.right', .25], ['wrist.right', .15]]
const HIND_LEFT_DISTRIBUTION: RotationDistribution = [['hip.left', .1], ['thigh.left', .5], ['calf.left', .25], ['ankle.left', .15]]
const HIND_RIGHT_DISTRIBUTION: RotationDistribution = [['hip.right', .1], ['thigh.right', .5], ['calf.right', .25], ['ankle.right', .15]]

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const compareCodePoints = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const numericSuffix = (boneId: string) => Number.parseInt(boneId.split('.').at(-1) || '0', 10)
type SampledRootMotionCacheEntry =
  | { readonly status: 'blocked'; readonly rootMotion: BipedPetRootMotionDefinition }
  | {
    readonly status: 'ready'
    readonly source: unknown
    readonly durationMs: number
    readonly rootMotion: BipedPetRootMotionDefinition
  }
const sampledRootMotionCache = new WeakMap<object, SampledRootMotionCacheEntry>()

function freezeRootMotionDefinition(value: BipedPetRootMotionDefinition, durationMs: number): BipedPetRootMotionDefinition {
  return normalizeBipedPetRootMotion(value, durationMs).value
}

function canonicalInPlaceRootMotion(durationMs: number): BipedPetRootMotionDefinition {
  return freezeRootMotionDefinition(normalizeBipedPetRootMotion(undefined, durationMs).value, durationMs)
}

function sameRootMotionDefinition(
  left: BipedPetRootMotionDefinition,
  right: BipedPetRootMotionDefinition,
): boolean {
  if (left === right) return true
  if (left.mode !== right.mode || left.distance !== right.distance || left.turnRadians !== right.turnRadians
    || left.verticalMode !== right.verticalMode || left.jumpHeight !== right.jumpHeight
    || left.windows.length !== right.windows.length || left.vfxTags.length !== right.vfxTags.length) return false
  for (let index = 0; index < left.windows.length; index += 1) {
    const leftWindow = left.windows[index]!
    const rightWindow = right.windows[index]!
    if (leftWindow.id !== rightWindow.id || leftWindow.kind !== rightWindow.kind
      || leftWindow.startMs !== rightWindow.startMs || leftWindow.endMs !== rightWindow.endMs
      || leftWindow.weight !== rightWindow.weight) return false
  }
  return left.vfxTags.every((tag, index) => tag === right.vfxTags[index])
}

/**
 * 把现有云狐语义姿态分配到当前真实骨骼集合。输出是相对绑定姿态的 Quaternion，不包含渲染器对象。
 */
export function adaptCloudFoxPoseToBipedPet(
  pose: EvaluatedCloudFoxPose,
  target: BipedPetMotionCompileTarget = {},
): AdaptedBipedPetPose {
  const profile = target.profile ?? BIPED_PET_RIG_PROFILE
  const profileDiagnostics = validateRigProfile(profile)
  if (profile.id !== 'biped-pet/v1' || profileDiagnostics.length) {
    return {
      bones: [],
      rootPosition: [0, 0, 0],
      diagnostics: [{
        id: 'invalid-biped-pet-motion-profile',
        severity: 'error',
        message: `双足萌宠动作 Profile 无效：${profileDiagnostics[0] || profile.id}。`,
      }],
    }
  }

  const availableBoneIds = new Set(target.boneIds ?? profile.bones.map(item => item.id))
  const authoredChannels = new Set(pose.authoredChannels)
  const rotations = new Map<string, MutableVector3>()
  const diagnostics: BipedPetMotionDiagnostic[] = []

  const read = (channelId: keyof EvaluatedCloudFoxPose['values']) => {
    if (!authoredChannels.has(channelId)) return undefined
    const value = pose.values[channelId]
    if (Number.isFinite(value)) return value
    diagnostics.push({ id: 'non-finite-semantic-motion-channel', severity: 'warning', message: `动作通道 ${channelId} 不是有限数，已按中性值处理。` })
    return 0
  }
  const addAxis = (boneId: string, axis: 0 | 1 | 2, value: number) => {
    if (!availableBoneIds.has(boneId)) return
    const rotation = rotations.get(boneId) ?? [0, 0, 0]
    rotation[axis] += value
    rotations.set(boneId, rotation)
  }
  const distribute = (prefix: string, distribution: RotationDistribution) => {
    for (const [axis, suffix] of [[0, 'x'], [1, 'y'], [2, 'z']] as const) {
      const value = read(`${prefix}.${suffix}` as keyof EvaluatedCloudFoxPose['values'])
      if (value === undefined) continue
      for (const [boneId, weight] of distribution) addAxis(boneId, axis, value * weight)
    }
  }
  const addDirect = (prefix: string, boneId: string, axes: readonly (0 | 1 | 2)[] = [0, 1, 2]) => {
    for (const axis of axes) {
      const suffix = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'
      const value = read(`${prefix}.${suffix}` as keyof EvaluatedCloudFoxPose['values'])
      if (value !== undefined) addAxis(boneId, axis, value)
    }
  }

  addDirect('root.rotation', 'root')
  distribute('body.rotation', BODY_DISTRIBUTION)
  distribute('head.rotation', HEAD_DISTRIBUTION)
  distribute('frontPaw.left.rotation', FRONT_LEFT_DISTRIBUTION)
  distribute('frontPaw.right.rotation', FRONT_RIGHT_DISTRIBUTION)
  addDirect('frontPaw.left.tip.rotation', 'hand.left', [0, 2])
  addDirect('frontPaw.right.tip.rotation', 'hand.right', [0, 2])
  distribute('hindPaw.left.rotation', HIND_LEFT_DISTRIBUTION)
  distribute('hindPaw.right.rotation', HIND_RIGHT_DISTRIBUTION)

  const chain = (prefix: string) => [...availableBoneIds]
    .filter(boneId => boneId.startsWith(`${prefix}.`) && Number.isInteger(numericSuffix(boneId)))
    .sort((left, right) => numericSuffix(left) - numericSuffix(right))
  const addChainRotations = (prefix: 'tail' | 'ear.left' | 'ear.right' | 'antenna.left' | 'antenna.right') => {
    const boneIds = chain(prefix)
    if (!boneIds.length) return
    if (prefix === 'tail') {
      addDirect('tail.root.rotation', boneIds[0]!)
      addDirect('tail.mid.rotation', boneIds[Math.floor((boneIds.length - 1) / 2)]!)
      addDirect('tail.tip.rotation', boneIds.at(-1)!)
      return
    }
    addDirect(`${prefix}.rotation`, boneIds[0]!)
  }
  addChainRotations('tail')
  addChainRotations('ear.left')
  addChainRotations('ear.right')
  addChainRotations('antenna.left')
  addChainRotations('antenna.right')

  const limitsByBoneId = new Map(profile.jointLimits.map(limit => [limit.boneId, limit]))
  const orderedBoneIds = [...availableBoneIds]
  const bones = orderedBoneIds.flatMap((boneId): AdaptedBipedPetBonePose[] => {
    const rotation = rotations.get(boneId)
    if (!rotation) return []
    const limit = limitsByBoneId.get(boneId)
    const limited: RigVector3 = limit
      ? [
          clamp(rotation[0], limit.minimum[0], limit.maximum[0]),
          clamp(rotation[1], limit.minimum[1], limit.maximum[1]),
          clamp(rotation[2], limit.minimum[2], limit.maximum[2]),
        ]
      : rotation
    return [{ boneId, rotation: motionEulerToQuaternion(limited) }]
  })
  const rootPosition: RigVector3 = [
    (read('root.position.x') ?? 0) * ROOT_POSITION_SCALE,
    (read('root.position.y') ?? 0) * ROOT_POSITION_SCALE,
    (read('root.position.z') ?? 0) * ROOT_POSITION_SCALE,
  ]

  return { bones, rootPosition, diagnostics }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function motionHash(value: unknown) {
  let result = 2166136261
  for (const character of stableStringify(value)) {
    // `for...of` 已按完整 Unicode 字符迭代；使用 code point 可区分共享高代理的补充平面身份，并保持 ASCII 哈希不变。
    result ^= character.codePointAt(0)!
    result = Math.imul(result, 16777619)
  }
  return `bpm-${(result >>> 0).toString(16).padStart(8, '0')}`
}

function readBipedMotionExtensionSource(asset: StudioMotionAssetV2): {
  source?: Record<PropertyKey, unknown>
  diagnostics: BipedPetMotionDiagnostic[]
} {
  try {
    const extensions = asset.extensions
    if (extensions === undefined || !Object.hasOwn(extensions, 'yk-pets/biped-motion/v1')) return { diagnostics: [] }
    const source = Reflect.get(extensions, 'yk-pets/biped-motion/v1')
    if (source === undefined) return { diagnostics: [] }
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return {
        diagnostics: [{
          id: 'biped-motion-extension-invalid',
          severity: 'warning',
          message: '双足萌宠动作扩展命名空间不是对象，已忽略该扩展。',
        }],
      }
    }
    return { source: source as Record<PropertyKey, unknown>, diagnostics: [] }
  }
  catch {
    return {
      diagnostics: [{
        id: 'biped-motion-extension-access-failed',
        severity: 'warning',
        message: '双足萌宠动作扩展命名空间无法安全读取，已忽略该扩展。',
      }],
    }
  }
}

function readExtensionField(
  source: Record<PropertyKey, unknown>,
  field: 'rootMotion' | 'contacts' | 'events',
): { ok: true; value: unknown } | {
  ok: false
  diagnostic: BipedPetMotionExtensionWarning
} {
  try {
    return { ok: true, value: Reflect.get(source, field) }
  }
  catch {
    return {
      ok: false,
      diagnostic: {
        id: `biped-motion-${field}-access-failed`,
        severity: 'warning',
        message: `双足萌宠动作扩展字段 ${field} 无法安全读取，已忽略该字段。`,
      },
    }
  }
}

function readExtensionArray(
  value: unknown,
  field: 'contacts' | 'events',
  maximumItems: number,
  diagnostics: BipedPetMotionDiagnostic[],
): unknown[] {
  try {
    if (!Array.isArray(value)) return []
    const length = Reflect.get(value, 'length')
    if (!Number.isSafeInteger(length) || length < 0) throw new TypeError('invalid extension array length')
    const boundedLength = Math.min(length, maximumItems)
    if (length > maximumItems) {
      diagnostics.push({
        id: `biped-motion-${field}-budget-exceeded`,
        severity: 'warning',
        message: `双足萌宠动作扩展字段 ${field} 超过 ${maximumItems} 项预算，仅处理预算内条目。`,
      })
    }
    const items: unknown[] = []
    for (let index = 0; index < boundedLength; index += 1) items.push(Reflect.get(value, index))
    return items
  }
  catch {
    diagnostics.push({
      id: `biped-motion-${field}-array-access-failed`,
      severity: 'warning',
      message: `双足萌宠动作扩展字段 ${field} 无法安全遍历，已忽略该字段。`,
    })
    return []
  }
}

function readRootMotionDefinition(
  asset: StudioMotionAssetV2,
  source: Record<PropertyKey, unknown> | undefined,
): ReturnType<typeof normalizeBipedPetRootMotion> {
  if (!source) return normalizeBipedPetRootMotion(undefined, asset.durationMs)
  const field = readExtensionField(source, 'rootMotion')
  if (field.ok) return normalizeBipedPetRootMotion(field.value, asset.durationMs)
  return {
    value: normalizeBipedPetRootMotion(undefined, asset.durationMs).value,
    diagnostics: [field.diagnostic],
  }
}

function readBipedMotionMetadata(
  asset: StudioMotionAssetV2,
  profile: CharacterRigProfile,
  source: Record<PropertyKey, unknown> | undefined,
) {
  const diagnostics: BipedPetMotionDiagnostic[] = []
  const contacts: BipedPetMotionContactCandidate[] = []
  const events: BipedPetMotionSemanticEvent[] = []
  if (!source) return { contacts, events, diagnostics }
  const contactsField = readExtensionField(source, 'contacts')
  const eventsField = readExtensionField(source, 'events')
  if (!contactsField.ok) diagnostics.push(contactsField.diagnostic)
  if (!eventsField.ok) diagnostics.push(eventsField.diagnostic)
  const contactItems = contactsField.ok
    ? readExtensionArray(contactsField.value, 'contacts', MAX_BIPED_PET_MOTION_CONTACT_CANDIDATES, diagnostics)
    : []
  const eventItems = eventsField.ok
    ? readExtensionArray(eventsField.value, 'events', MAX_BIPED_PET_MOTION_SEMANTIC_EVENTS, diagnostics)
    : []
  const contactIds = new Set(profile.contacts.map(item => item.id))
  for (const [index, item] of contactItems.entries()) {
    let value: Record<string, unknown> | undefined
    try {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        value = {
          contactId: Reflect.get(item, 'contactId'),
          startMs: Reflect.get(item, 'startMs'),
          endMs: Reflect.get(item, 'endMs'),
          confidence: Reflect.get(item, 'confidence'),
        }
      }
    }
    catch {
      diagnostics.push({ id: `contact-metadata-${index}-access-failed`, severity: 'warning', message: '复杂动作接触候选无法安全读取，已忽略。' })
      continue
    }
    if (!value) {
      diagnostics.push({ id: `invalid-contact-metadata-${index}`, severity: 'warning', message: '复杂动作接触候选不是对象，已忽略。' })
      continue
    }
    if (typeof value.contactId !== 'string' || !contactIds.has(value.contactId) || !Number.isFinite(value.startMs) || !Number.isFinite(value.endMs) || !Number.isFinite(value.confidence)) {
      diagnostics.push({ id: `invalid-contact-metadata-${index}`, severity: 'warning', message: '复杂动作接触候选字段无效，已忽略。' })
      continue
    }
    const startMs = clamp(Number(value.startMs), 0, asset.durationMs)
    const endMs = clamp(Number(value.endMs), 0, asset.durationMs)
    // 零长度或反向区间没有可采样接触；静默移除可保证它们不会只改变 Clip 哈希。
    if (endMs <= startMs) continue
    contacts.push({ contactId: value.contactId, startMs, endMs, confidence: clamp(Number(value.confidence), 0, 1), fadeIn: true, fadeOut: true })
  }
  const eventKinds = new Set<BipedPetMotionSemanticEvent['kind']>(['takeoff', 'landing', 'wave-peak', 'hit'])
  for (const [index, item] of eventItems.entries()) {
    let value: Record<string, unknown> | undefined
    try {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        value = {
          id: Reflect.get(item, 'id'),
          kind: Reflect.get(item, 'kind'),
          timeMs: Reflect.get(item, 'timeMs'),
        }
      }
    }
    catch {
      diagnostics.push({ id: `event-metadata-${index}-access-failed`, severity: 'warning', message: '复杂动作语义事件无法安全读取，已忽略。' })
      continue
    }
    if (!value) {
      diagnostics.push({ id: `invalid-event-metadata-${index}`, severity: 'warning', message: '复杂动作语义事件不是对象，已忽略。' })
      continue
    }
    if (typeof value.id !== 'string' || !value.id.trim() || !eventKinds.has(value.kind as BipedPetMotionSemanticEvent['kind']) || !Number.isFinite(value.timeMs)) {
      diagnostics.push({ id: `invalid-event-metadata-${index}`, severity: 'warning', message: '复杂动作语义事件字段无效，已忽略。' })
      continue
    }
    events.push({ id: value.id.trim(), kind: value.kind as BipedPetMotionSemanticEvent['kind'], timeMs: clamp(Number(value.timeMs), 0, asset.durationMs) })
  }
  const mergedContacts: BipedPetMotionContactCandidate[] = []
  const contactsById = new Map<string, BipedPetMotionContactCandidate[]>()
  for (const contact of contacts) {
    const group = contactsById.get(contact.contactId) ?? []
    group.push(contact)
    contactsById.set(contact.contactId, group)
  }
  for (const contactId of [...contactsById.keys()].sort(compareCodePoints)) {
    const group = contactsById.get(contactId)!
      .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || right.confidence - left.confidence)
    const components: BipedPetMotionContactCandidate[] = []
    for (const contact of group) {
      const previous = components.at(-1)
      if (previous && contact.startMs <= previous.endMs) {
        previous.endMs = Math.max(previous.endMs, contact.endMs)
        previous.confidence = Math.max(previous.confidence, contact.confidence)
      }
      else components.push({ ...contact })
    }
    const first = components[0]
    const last = components.at(-1)
    if (first && last && first.startMs === 0 && last.endMs === asset.durationMs) {
      if (asset.loopMode === 'loop') {
        const seamConfidence = Math.max(first.confidence, last.confidence)
        first.fadeIn = false
        last.fadeOut = false
        first.confidence = seamConfidence
        last.confidence = seamConfidence
      }
      else if (asset.loopMode === 'ping-pong' && first === last) {
        first.fadeIn = false
        first.fadeOut = false
      }
    }
    mergedContacts.push(...components)
  }
  events.sort((left, right) => left.timeMs - right.timeMs || left.id.localeCompare(right.id))
  return { contacts: mergedContacts, events, diagnostics }
}

function sameQuaternion(left: MotionQuaternion, right: MotionQuaternion) {
  return Math.abs(
    left[0] * right[0]
    + left[1] * right[1]
    + left[2] * right[2]
    + left[3] * right[3],
  ) > 1 - 1e-12
}

function blockedMotionClip(
  asset: StudioMotionAssetV2,
  profile: CharacterRigProfile,
  diagnostics: readonly BipedPetMotionDiagnostic[],
): BipedPetQuaternionClip {
  const value = {
    schemaVersion: BIPED_PET_QUATERNION_CLIP_SCHEMA_VERSION,
    adapterId: BIPED_PET_MOTION_ADAPTER_ID,
    profileId: 'biped-pet/v1' as const,
    sourceMotionId: asset.id,
    durationMs: asset.durationMs,
    loopMode: asset.loopMode,
    status: 'blocked' as const,
    rootMotion: canonicalInPlaceRootMotion(asset.durationMs),
    boneTracks: [],
    rootPositionTrack: [],
    contacts: [],
    events: [],
    diagnostics: diagnostics.map(item => ({ ...item })),
  }
  return { ...value, hash: motionHash({ ...value, profileId: profile.id }) }
}

/** 将完整语义动作资产编译为当前真实骨骼集合可消费的确定性 Quaternion Clip。 */
export function compileBipedPetMotion(input: unknown, target: BipedPetMotionCompileTarget = {}): BipedPetQuaternionClip {
  const normalized = normalizeMotionAsset(input)
  const asset = normalized.asset
  const profile = target.profile ?? BIPED_PET_RIG_PROFILE
  const diagnostics: BipedPetMotionDiagnostic[] = normalized.diagnostics.map((item, index) => ({
    id: `motion-normalization-${index}`,
    severity: 'warning',
    message: `动作资产已规范化：${item.code}:${item.path}`,
  }))
  const extension = readBipedMotionExtensionSource(asset)
  diagnostics.push(...extension.diagnostics)
  const rootMotion = readRootMotionDefinition(asset, extension.source)
  diagnostics.push(...rootMotion.diagnostics)
  const compiledRootMotion = freezeRootMotionDefinition(rootMotion.value, asset.durationMs)
  const profileDiagnostics = validateRigProfile(profile)
  if (profile.id !== 'biped-pet/v1' || profileDiagnostics.length) {
    diagnostics.push(...profileDiagnostics.map((message, index): BipedPetMotionDiagnostic => ({
      id: `motion-profile-validation-${index}`,
      severity: 'error',
      message: `双足萌宠动作 Profile 无法安全编译：${message}`,
    })))
    return blockedMotionClip(asset, profile, diagnostics)
  }

  const times = [...new Set([0, asset.durationMs, ...asset.tracks.flatMap(track => track.keyframes.map(keyframe => keyframe.timeMs))])]
    .sort((left, right) => left - right)
  const boneKeyframes = new Map<string, BipedPetBoneQuaternionKeyframe[]>()
  const rootPositionTrack: BipedPetRootPositionKeyframe[] = []
  // 编译关键帧必须读取原始 0..duration 区间；循环只属于运行时采样，否则 duration 端点会提前回绕到 0。 / Compile the raw 0..duration range; looping belongs to runtime sampling so the duration endpoint does not wrap to zero.
  const evaluationAsset: StudioMotionAssetV2 = asset.loopMode === 'once' ? asset : { ...asset, loopMode: 'once' }
  const metadata = readBipedMotionMetadata(asset, profile, extension.source)
  diagnostics.push(...metadata.diagnostics)
  const hasRootPosition = asset.tracks.some(track => track.channelId.startsWith('root.position.'))

  for (const timeMs of times) {
    const adapted = adaptCloudFoxPoseToBipedPet(evaluateNormalizedMotionAsset(evaluationAsset, timeMs), target)
    diagnostics.push(...adapted.diagnostics)
    for (const bone of adapted.bones) {
      const keyframes = boneKeyframes.get(bone.boneId) ?? []
      const previous = keyframes.at(-1)
      if (!previous || !sameQuaternion(previous.value, bone.rotation) || timeMs === asset.durationMs) {
        keyframes.push({ timeMs, value: bone.rotation })
        boneKeyframes.set(bone.boneId, keyframes)
      }
    }
    if (hasRootPosition) {
      const previous = rootPositionTrack.at(-1)
      if (!previous || previous.value.some((value, index) => Math.abs(value - adapted.rootPosition[index]!) > 1e-12) || timeMs === asset.durationMs) {
        rootPositionTrack.push({ timeMs, value: adapted.rootPosition })
      }
    }
  }
  if (diagnostics.some(item => item.severity === 'error')) {
    return blockedMotionClip(asset, profile, diagnostics)
  }

  const value = {
    schemaVersion: BIPED_PET_QUATERNION_CLIP_SCHEMA_VERSION,
    adapterId: BIPED_PET_MOTION_ADAPTER_ID,
    profileId: 'biped-pet/v1' as const,
    sourceMotionId: asset.id,
    durationMs: asset.durationMs,
    loopMode: asset.loopMode,
    status: 'ready' as const,
    rootMotion: compiledRootMotion,
    boneTracks: [...boneKeyframes].map(([boneId, keyframes]) => ({ boneId, keyframes })),
    rootPositionTrack,
    contacts: metadata.contacts,
    events: metadata.events,
    diagnostics,
  }
  return { ...value, hash: motionHash(value) }
}

function sampleVectorTrack(track: readonly BipedPetRootPositionKeyframe[], timeMs: number): RigVector3 {
  if (!track.length) return [0, 0, 0]
  const first = track[0]!
  const last = track.at(-1)!
  if (timeMs <= first.timeMs) return [...first.value]
  if (timeMs >= last.timeMs) return [...last.value]
  const nextIndex = track.findIndex(keyframe => keyframe.timeMs > timeMs)
  const next = track[nextIndex]!
  const previous = track[nextIndex - 1]!
  const progress = (timeMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs)
  return previous.value.map((value, index) => value + (next.value[index]! - value) * progress) as [number, number, number]
}

function sampleBoneTrack(track: BipedPetBoneQuaternionTrack, timeMs: number): MotionQuaternion {
  if (!track.keyframes.length) return [...IDENTITY_MOTION_QUATERNION]
  const first = track.keyframes[0]!
  const last = track.keyframes.at(-1)!
  if (timeMs <= first.timeMs) return [...first.value]
  if (timeMs >= last.timeMs) return [...last.value]
  const nextIndex = track.keyframes.findIndex(keyframe => keyframe.timeMs > timeMs)
  const next = track.keyframes[nextIndex]!
  const previous = track.keyframes[nextIndex - 1]!
  const progress = (timeMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs)
  return slerpMotionQuaternion(previous.value, next.value, progress)
}

const CONTACT_FADE_MS = 80

function sampleContactState(contact: BipedPetMotionContactCandidate, timeMs: number): SampledBipedPetContactState | undefined {
  const durationMs = contact.endMs - contact.startMs
  if (durationMs <= 0 || timeMs < contact.startMs || timeMs > contact.endMs) return undefined
  const fadeMs = Math.min(CONTACT_FADE_MS, durationMs / 2)
  // V1 历史 Clip 没有连续性标志；缺省必须保持原有的双侧淡变语义。
  if (contact.fadeIn !== false && timeMs < contact.startMs + fadeMs) {
    return { contactId: contact.contactId, phase: 'acquiring', weight: clamp((timeMs - contact.startMs) / fadeMs, 0, 1), confidence: contact.confidence }
  }
  if (contact.fadeOut !== false && timeMs >= contact.endMs - fadeMs) {
    return { contactId: contact.contactId, phase: 'releasing', weight: clamp((contact.endMs - timeMs) / fadeMs, 0, 1), confidence: contact.confidence }
  }
  return { contactId: contact.contactId, phase: 'locked', weight: 1, confidence: contact.confidence }
}

function sampleContactStates(contacts: readonly BipedPetMotionContactCandidate[], timeMs: number): readonly SampledBipedPetContactState[] {
  const states = new Map<string, SampledBipedPetContactState>()
  for (const contact of contacts) {
    const state = sampleContactState(contact, timeMs)
    const previous = state && states.get(state.contactId)
    if (state && (!previous || state.weight > previous.weight)) states.set(state.contactId, state)
  }
  return [...states.values()].sort((left, right) => compareCodePoints(left.contactId, right.contactId))
}

function rootMotionForSample(clip: BipedPetQuaternionClip): BipedPetRootMotionDefinition {
  if (clip.status !== 'ready') {
    const cached = sampledRootMotionCache.get(clip)
    if (cached?.status === 'blocked') return cached.rootMotion
    const rootMotion = canonicalInPlaceRootMotion(clip.durationMs)
    sampledRootMotionCache.set(clip, { status: 'blocked', rootMotion })
    return rootMotion
  }
  let input: unknown
  try {
    input = Reflect.get(clip, 'rootMotion')
  }
  catch {
    input = undefined
  }
  const durationMs = normalizeMotionDurationMs(clip.durationMs)
  const cached = sampledRootMotionCache.get(clip)
  const normalized = normalizeBipedPetRootMotion(input, durationMs)
  const hasUnsafeRepair = normalized.diagnostics.some(item => (
    item.id !== 'root-motion-duration-normalized' && !/^root-motion-window-\d+-time-clamped$/u.test(item.id)
  ))
  const rootMotion = hasUnsafeRepair
    ? canonicalInPlaceRootMotion(durationMs)
    : normalized.value
  if (cached?.status === 'ready' && cached.source === input && Object.is(cached.durationMs, durationMs)
    && sameRootMotionDefinition(cached.rootMotion, rootMotion)) return cached.rootMotion
  sampledRootMotionCache.set(clip, { status: 'ready', source: input, durationMs, rootMotion })
  return rootMotion
}

/** 在任意时间采样 Clip；blocked 输入始终返回可直接忽略的空姿态。 */
export function sampleBipedPetMotion(clip: BipedPetQuaternionClip, timeMs: number): SampledBipedPetMotion {
  const resolved = resolveMotionTime(timeMs, clip.durationMs, clip.loopMode)
  const identity = {
    sourceMotionId: clip.sourceMotionId,
    clipHash: clip.hash,
    durationMs: clip.durationMs,
    loopMode: clip.loopMode,
    requestedTimeMs: resolved.requestedTimeMs,
    resolvedTimeMs: resolved.resolvedTimeMs,
    iteration: resolved.iteration,
    direction: resolved.direction,
    rootMotion: rootMotionForSample(clip),
  }
  if (clip.status !== 'ready') return { ...identity, bones: [], rootPosition: [0, 0, 0], activeContacts: [], contactStates: [] }
  const contactStates = sampleContactStates(clip.contacts, resolved.resolvedTimeMs)
  return {
    ...identity,
    bones: clip.boneTracks.map(track => ({ boneId: track.boneId, rotation: sampleBoneTrack(track, resolved.resolvedTimeMs) })),
    rootPosition: sampleVectorTrack(clip.rootPositionTrack, resolved.resolvedTimeMs),
    activeContacts: contactStates.filter(contact => contact.weight > 0).map(contact => contact.contactId),
    contactStates,
  }
}
