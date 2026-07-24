/**
 * 文件职责 / File responsibility
 * 在无 UI 和无渲染器条件下求值规范化动作轨道，输出完整且确定性的云狐语义姿态。
 * Evaluates normalized motion tracks without UI or renderer dependencies and returns a complete deterministic Cloud Fox semantic pose.
 */

import {
  CLOUD_FOX_SEMANTIC_RIG_ID,
  createNeutralCloudFoxPoseValues,
  type CloudFoxRigChannelId,
} from './cloud-fox-rig'
import {
  normalizeMotionAsset,
  type MotionKeyframe,
  type MotionNormalizationDiagnostic,
  type MotionTrack,
  type StudioMotionAssetV2,
} from './motion-asset'
import { resolveMotionTime } from './motion-time'

export interface EvaluatedCloudFoxPose {
  rigId: typeof CLOUD_FOX_SEMANTIC_RIG_ID
  requestedTimeMs: number
  resolvedTimeMs: number
  direction: 1 | -1
  iteration: number
  values: Record<CloudFoxRigChannelId, number>
  authoredChannels: readonly CloudFoxRigChannelId[]
}

export interface EvaluateMotionAssetResult {
  asset: StudioMotionAssetV2
  pose: EvaluatedCloudFoxPose
  diagnostics: MotionNormalizationDiagnostic[]
}

export function evaluateMotionAsset(input: unknown, timeMs: number): EvaluateMotionAssetResult {
  const normalized = normalizeMotionAsset(input)
  return {
    asset: normalized.asset,
    pose: evaluateNormalizedMotionAsset(normalized.asset, timeMs),
    diagnostics: normalized.diagnostics,
  }
}

export function evaluateNormalizedMotionAsset(asset: StudioMotionAssetV2, timeMs: number): EvaluatedCloudFoxPose {
  const resolved = resolveMotionTime(timeMs, asset.durationMs, asset.loopMode)
  const values = createNeutralCloudFoxPoseValues()
  const authoredChannels: CloudFoxRigChannelId[] = []

  for (const track of asset.tracks) {
    if (track.muted || track.keyframes.length === 0) continue
    values[track.channelId] = evaluateTrack(track, resolved.resolvedTimeMs)
    authoredChannels.push(track.channelId)
  }

  return {
    rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
    requestedTimeMs: resolved.requestedTimeMs,
    resolvedTimeMs: resolved.resolvedTimeMs,
    direction: resolved.direction,
    iteration: resolved.iteration,
    values,
    authoredChannels,
  }
}

export function evaluateTrack(track: MotionTrack, timeMs: number): number {
  const keyframes = track.keyframes
  if (keyframes.length === 0) return 0
  const first = keyframes[0] as MotionKeyframe
  const last = keyframes[keyframes.length - 1] as MotionKeyframe
  if (timeMs <= first.timeMs) return first.value
  if (timeMs >= last.timeMs) return last.value

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index] as MotionKeyframe
    const next = keyframes[index + 1] as MotionKeyframe
    if (timeMs >= next.timeMs) continue
    if (current.interpolation === 'step') return current.value
    const progress = (timeMs - current.timeMs) / Math.max(1, next.timeMs - current.timeMs)
    return current.value + (next.value - current.value) * progress
  }

  return last.value
}
