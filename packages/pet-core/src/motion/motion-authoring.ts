/**
 * 文件职责 / File responsibility
 * 提供与 UI 无关的动作时间轴编辑命令，包括关键帧选择、复制、移动、删除和通道值写入。
 * Provides UI-independent timeline authoring commands for selecting, copying, moving, deleting, and writing motion keyframes.
 */

import {
  insertMotionKeyframe,
  normalizeMotionAsset,
  type MotionInterpolation,
  type MotionKeyframe,
  type MotionTrack,
  type StudioMotionAssetV2,
} from './motion-asset'
import { snapMillisecondsToFrame } from './motion-time'
import type { CloudFoxRigChannelId } from './cloud-fox-rig'

export interface MotionKeyframeReference {
  trackId: string
  channelId: CloudFoxRigChannelId
  keyframeId: string
  timeMs: number
  value: number
  interpolation: MotionInterpolation
}

export interface MotionClipboardEntry {
  channelId: CloudFoxRigChannelId
  offsetMs: number
  value: number
  interpolation: MotionInterpolation
}

export interface MotionAuthoringOptions {
  snapToFrames?: boolean
  displayFps?: number
}

export interface MotionMoveResult {
  asset: StudioMotionAssetV2
  selectedKeyframeIds: string[]
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function collectMotionKeyframes(assetInput: StudioMotionAssetV2): MotionKeyframeReference[] {
  const asset = normalizeMotionAsset(assetInput).asset
  return asset.tracks.flatMap(track => track.keyframes.map(keyframe => ({
    trackId: track.id,
    channelId: track.channelId,
    keyframeId: keyframe.id,
    timeMs: keyframe.timeMs,
    value: keyframe.value,
    interpolation: keyframe.interpolation,
  })))
}

export function resolveMotionAuthoringTime(asset: StudioMotionAssetV2, timeMs: number, options: MotionAuthoringOptions = {}): number {
  const raw = Math.max(0, Math.min(asset.durationMs, Math.round(Number.isFinite(timeMs) ? timeMs : 0)))
  return options.snapToFrames === false ? raw : Math.max(0, Math.min(asset.durationMs, snapMillisecondsToFrame(raw, options.displayFps || asset.displayFps)))
}

export function writeMotionChannelValue(
  assetInput: StudioMotionAssetV2,
  channelId: CloudFoxRigChannelId,
  timeMs: number,
  value: number,
  interpolation: MotionInterpolation = 'linear',
  options: MotionAuthoringOptions = {},
): MotionMoveResult {
  const asset = normalizeMotionAsset(assetInput).asset
  const resolvedTime = resolveMotionAuthoringTime(asset, timeMs, options)
  const existing = asset.tracks.find(track => track.channelId === channelId)?.keyframes.find(keyframe => keyframe.timeMs === resolvedTime)
  const result = insertMotionKeyframe(asset, {
    channelId,
    timeMs: resolvedTime,
    value,
    interpolation,
    keyframeId: existing?.id,
  })
  return { asset: result.asset, selectedKeyframeIds: [result.keyframeId] }
}

export function removeMotionKeyframes(assetInput: StudioMotionAssetV2, keyframeIds: readonly string[]): StudioMotionAssetV2 {
  const selected = new Set(keyframeIds)
  const asset = normalizeMotionAsset(assetInput).asset
  const tracks = asset.tracks
    .map(track => ({ ...track, keyframes: track.keyframes.filter(keyframe => !selected.has(keyframe.id)) }))
    .filter(track => track.keyframes.length > 0)
  return normalizeMotionAsset({ ...asset, tracks, updatedAt: Date.now() }).asset
}

export function setMotionKeyframeInterpolation(
  assetInput: StudioMotionAssetV2,
  keyframeIds: readonly string[],
  interpolation: MotionInterpolation,
): StudioMotionAssetV2 {
  const selected = new Set(keyframeIds)
  const asset = normalizeMotionAsset(assetInput).asset
  const tracks = asset.tracks.map(track => ({
    ...track,
    keyframes: track.keyframes.map(keyframe => selected.has(keyframe.id) ? { ...keyframe, interpolation } : keyframe),
  }))
  return normalizeMotionAsset({ ...asset, tracks, updatedAt: Date.now() }).asset
}

export function copyMotionKeyframes(assetInput: StudioMotionAssetV2, keyframeIds: readonly string[]): MotionClipboardEntry[] {
  const selected = new Set(keyframeIds)
  const references = collectMotionKeyframes(assetInput).filter(item => selected.has(item.keyframeId))
  const firstTime = references.length ? Math.min(...references.map(item => item.timeMs)) : 0
  return references.map(item => ({
    channelId: item.channelId,
    offsetMs: item.timeMs - firstTime,
    value: item.value,
    interpolation: item.interpolation,
  }))
}

export function pasteMotionKeyframes(
  assetInput: StudioMotionAssetV2,
  clipboard: readonly MotionClipboardEntry[],
  targetTimeMs: number,
  options: MotionAuthoringOptions = {},
): MotionMoveResult {
  let asset = normalizeMotionAsset(assetInput).asset
  const selectedKeyframeIds: string[] = []
  for (let index = 0; index < clipboard.length; index += 1) {
    const entry = clipboard[index]
    if (!entry) continue
    const timeMs = resolveMotionAuthoringTime(asset, targetTimeMs + entry.offsetMs, options)
    const id = `key-${entry.channelId.replaceAll('.', '-')}-${timeMs}-paste-${index}`
    const result = insertMotionKeyframe(asset, {
      channelId: entry.channelId,
      timeMs,
      value: entry.value,
      interpolation: entry.interpolation,
      keyframeId: id,
    })
    asset = result.asset
    selectedKeyframeIds.push(result.keyframeId)
  }
  return { asset, selectedKeyframeIds }
}

export function moveMotionKeyframes(
  assetInput: StudioMotionAssetV2,
  keyframeIds: readonly string[],
  deltaMs: number,
  options: MotionAuthoringOptions = {},
): MotionMoveResult {
  const selected = new Set(keyframeIds)
  const asset = normalizeMotionAsset(assetInput).asset
  const movedIds: string[] = []
  const tracks: MotionTrack[] = asset.tracks.map(track => ({
    ...track,
    keyframes: track.keyframes.map((keyframe): MotionKeyframe => {
      if (!selected.has(keyframe.id)) return keyframe
      movedIds.push(keyframe.id)
      return {
        ...keyframe,
        timeMs: resolveMotionAuthoringTime(asset, keyframe.timeMs + deltaMs, options),
      }
    }),
  }))
  return {
    asset: normalizeMotionAsset({ ...asset, tracks, updatedAt: Date.now() }).asset,
    selectedKeyframeIds: movedIds,
  }
}

export function duplicateMotionAssetForDraft(asset: StudioMotionAssetV2): StudioMotionAssetV2 {
  return clone(normalizeMotionAsset(asset).asset)
}
