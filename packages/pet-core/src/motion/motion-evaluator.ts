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
  const authoredChannels = new Set<CloudFoxRigChannelId>()
  const layerById = new Map(asset.layers.map(layer => [layer.id, layer]))
  const tracks = [...asset.tracks].sort((left, right) => (layerById.get(left.layerId)?.priority ?? 0) - (layerById.get(right.layerId)?.priority ?? 0))

  for (const track of tracks) {
    const layer = layerById.get(track.layerId)
    if (track.muted || track.keyframes.length === 0 || layer?.enabled === false || (layer?.weight ?? 1) <= 0) continue
    const trackValue = evaluateTrack(track, resolved.resolvedTimeMs)
    const weight = layer?.weight ?? 1
    values[track.channelId] = layer?.mode === 'additive'
      ? values[track.channelId] + trackValue * weight
      : values[track.channelId] + (trackValue - values[track.channelId]) * weight
    authoredChannels.add(track.channelId)
  }

  return {
    rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
    requestedTimeMs: resolved.requestedTimeMs,
    resolvedTimeMs: resolved.resolvedTimeMs,
    direction: resolved.direction,
    iteration: resolved.iteration,
    values,
    authoredChannels: [...authoredChannels],
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
    if (current.interpolation === 'smooth') {
      const smooth = progress * progress * (3 - 2 * progress)
      return current.value + (next.value - current.value) * smooth
    }
    if (current.interpolation === 'bezier') {
      const inverse = 1 - progress
      const controlA = current.value + (current.outTangent ?? 0)
      const controlB = next.value - (next.inTangent ?? 0)
      return inverse ** 3 * current.value + 3 * inverse ** 2 * progress * controlA + 3 * inverse * progress ** 2 * controlB + progress ** 3 * next.value
    }
    return current.value + (next.value - current.value) * progress
  }

  return last.value
}
