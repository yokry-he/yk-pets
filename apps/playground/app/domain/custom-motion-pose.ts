/**
 * 文件职责 / File responsibility
 * 将框架无关的语义姿态安全映射为唯一云狐渲染器可消费的已写入通道和值。
 * Safely maps framework-neutral semantic poses into authored channels and values consumed by the sole Cloud Fox renderer.
 */
import type { CloudFoxRigChannelId, EvaluatedCloudFoxPose } from '@yk-pets/pet-core'

export const CUSTOM_MOTION_DISTANCE_SCALE = .24

export function hasAuthoredPoseChannel(pose: EvaluatedCloudFoxPose | null | undefined, channelId: CloudFoxRigChannelId): boolean {
  return Boolean(pose?.authoredChannels.includes(channelId))
}

export function customPoseValue(pose: EvaluatedCloudFoxPose | null | undefined, channelId: CloudFoxRigChannelId, fallback = 0): number {
  return hasAuthoredPoseChannel(pose, channelId) ? pose?.values[channelId] ?? fallback : fallback
}

export function customPoseScale(pose: EvaluatedCloudFoxPose | null | undefined, channelId: CloudFoxRigChannelId): number {
  return Math.max(.05, 1 + customPoseValue(pose, channelId))
}
