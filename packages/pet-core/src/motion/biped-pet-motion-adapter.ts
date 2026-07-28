/**
 * 文件职责 / File responsibility
 * 定义双足萌宠语义动作适配器的版本化 Quaternion Clip 契约；具体映射、编译与采样在后续任务补充。
 */

import { BIPED_PET_RIG_PROFILE } from '../character/biped-pet-profile'
import { validateRigProfile, type CharacterRigProfile, type RigVector3 } from '../character/rig-profile'
import type { EvaluatedCloudFoxPose } from './motion-evaluator'
import type { StudioMotionLoopMode } from './motion-time'
import { motionEulerToQuaternion, type MotionQuaternion } from './quaternion-motion'

export const BIPED_PET_MOTION_ADAPTER_ID = 'biped-pet-motion-adapter/v1' as const
export const BIPED_PET_QUATERNION_CLIP_SCHEMA_VERSION = 1 as const

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

type RotationDistribution = readonly (readonly [boneId: string, weight: number])[]
type MutableVector3 = [number, number, number]

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
const numericSuffix = (boneId: string) => Number.parseInt(boneId.split('.').at(-1) || '0', 10)

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
    if (!availableBoneIds.has(boneId) || value === 0) return
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
