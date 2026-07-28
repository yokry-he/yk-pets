/**
 * 文件职责 / File responsibility
 * 定义双足萌宠语义动作适配器的版本化 Quaternion Clip 契约；具体映射、编译与采样在后续任务补充。
 */

import type { CharacterRigProfile, RigVector3 } from '../character/rig-profile'
import type { StudioMotionLoopMode } from './motion-time'
import type { MotionQuaternion } from './quaternion-motion'

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
