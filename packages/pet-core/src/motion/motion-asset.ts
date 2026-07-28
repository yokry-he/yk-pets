/**
 * 文件职责 / File responsibility
 * 定义版本化动作资产、轨道与关键帧，并提供旧数据迁移、排序、去重和范围规范化。
 * Defines versioned motion assets, tracks, and keyframes with legacy migration, sorting, deduplication, and range normalization.
 */

import {
  CLOUD_FOX_RIG_CHANNELS,
  CLOUD_FOX_SEMANTIC_RIG_ID,
  getCloudFoxRigChannel,
  isCloudFoxRigChannelId,
  type CloudFoxRigChannelId,
} from './cloud-fox-rig'
import {
  normalizePropEventTracks,
  type MotionPropEventTrack,
} from './prop-events'
import {
  normalizeAdvancedInterpolation,
  normalizeInterruptionPolicy,
  normalizeMotionAudioCues,
  normalizeMotionLayers,
  type MotionAudioCue,
  type MotionInterruptionPolicy,
  type MotionLayer,
} from './motion-advanced'
import {
  normalizeDisplayFps,
  normalizeMotionDurationMs,
  normalizeMotionLoopMode,
  type StudioMotionLoopMode,
} from './motion-time'

export const STUDIO_MOTION_ASSET_SCHEMA_VERSION = 2 as const
export type MotionInterpolation = 'step' | 'linear' | 'smooth' | 'bezier'

export interface MotionKeyframe {
  id: string
  timeMs: number
  value: number
  interpolation: MotionInterpolation
  inTangent?: number
  outTangent?: number
}

export interface MotionTrack {
  id: string
  channelId: CloudFoxRigChannelId
  layerId: string
  muted: boolean
  keyframes: MotionKeyframe[]
}

export interface StudioMotionAssetV2 {
  schemaVersion: typeof STUDIO_MOTION_ASSET_SCHEMA_VERSION
  id: string
  nameZh: string
  nameEn: string
  rigId: typeof CLOUD_FOX_SEMANTIC_RIG_ID
  durationMs: number
  displayFps: number
  loopMode: StudioMotionLoopMode
  authoringAppearanceId?: string
  propIds: string[]
  tracks: MotionTrack[]
  propEventTracks: MotionPropEventTrack[]
  layers: MotionLayer[]
  interruptionPolicy: MotionInterruptionPolicy
  audioCues: MotionAudioCue[]
  createdAt: number
  updatedAt: number
  extensions?: Record<string, unknown>
}

export type MotionNormalizationDiagnosticCode =
  | 'legacy-schema-migrated'
  | 'rig-id-replaced'
  | 'duration-clamped'
  | 'fps-clamped'
  | 'unknown-channel-dropped'
  | 'duplicate-channel-track-merged'
  | 'keyframe-time-clamped'
  | 'keyframe-value-clamped'
  | 'duplicate-keyframe-time-replaced'
  | 'extensions-invalid'
  | 'extensions-access-failed'

export interface MotionNormalizationDiagnostic {
  code: MotionNormalizationDiagnosticCode
  path: string
  detail?: string
}

export interface NormalizeMotionAssetOptions {
  now?: number
  fallbackId?: string
  fallbackNameZh?: string
  fallbackNameEn?: string
}

export interface NormalizeMotionAssetResult {
  asset: StudioMotionAssetV2
  diagnostics: MotionNormalizationDiagnostic[]
}

export interface InsertMotionKeyframeInput {
  channelId: CloudFoxRigChannelId
  timeMs: number
  value: number
  interpolation?: MotionInterpolation
  keyframeId?: string
  trackId?: string
  layerId?: string
  inTangent?: number
  outTangent?: number
}

const KNOWN_ASSET_KEYS = new Set([
  'schemaVersion',
  'id',
  'nameZh',
  'nameEn',
  'rigId',
  'durationMs',
  'displayFps',
  'loopMode',
  'appearanceId',
  'authoringAppearanceId',
  'propIds',
  'tracks',
  'propEventTracks',
  'layers',
  'interruptionPolicy',
  'audioCues',
  'createdAt',
  'updatedAt',
  'extensions',
])

const CHANNEL_INDEX = new Map<CloudFoxRigChannelId, number>(
  CLOUD_FOX_RIG_CHANNELS.map((channel, index) => [channel.id, index]),
)

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finiteNumber = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const finiteInteger = (value: unknown, fallback = 0) => Math.round(finiteNumber(value, fallback))
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const interpolation = (value: unknown): MotionInterpolation => normalizeAdvancedInterpolation(value)

export function normalizeMotionAsset(input: unknown, options: NormalizeMotionAssetOptions = {}): NormalizeMotionAssetResult {
  const source = isRecord(input) ? input : {}
  const diagnostics: MotionNormalizationDiagnostic[] = []
  const now = finiteInteger(options.now, Date.now())
  const rawDuration = finiteInteger(source.durationMs, 1200)
  const durationMs = normalizeMotionDurationMs(rawDuration)
  const rawFps = finiteInteger(source.displayFps, 30)
  const displayFps = normalizeDisplayFps(rawFps)

  if (source.schemaVersion !== STUDIO_MOTION_ASSET_SCHEMA_VERSION) {
    diagnostics.push({ code: 'legacy-schema-migrated', path: 'schemaVersion' })
  }
  if (source.rigId !== undefined && source.rigId !== CLOUD_FOX_SEMANTIC_RIG_ID) {
    diagnostics.push({ code: 'rig-id-replaced', path: 'rigId', detail: String(source.rigId) })
  }
  if (rawDuration !== durationMs) diagnostics.push({ code: 'duration-clamped', path: 'durationMs' })
  if (rawFps !== displayFps) diagnostics.push({ code: 'fps-clamped', path: 'displayFps' })

  const layers = normalizeMotionLayers(source.layers)
  const tracks = normalizeTracks(source.tracks, durationMs, diagnostics, new Set(layers.map(layer => layer.id)))
  const propEventTracks = normalizePropEventTracks(source.propEventTracks, durationMs)
  const legacyAppearanceId = optionalText(source.appearanceId)
  const authoringAppearanceId = optionalText(source.authoringAppearanceId) || legacyAppearanceId
  const extensions = collectExtensions(source, diagnostics)

  return {
    asset: {
      schemaVersion: STUDIO_MOTION_ASSET_SCHEMA_VERSION,
      id: text(source.id, options.fallbackId || `motion-${now.toString(36)}`),
      nameZh: text(source.nameZh, options.fallbackNameZh || '新动作'),
      nameEn: text(source.nameEn, options.fallbackNameEn || 'Motion'),
      rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
      durationMs,
      displayFps,
      loopMode: normalizeMotionLoopMode(source.loopMode),
      ...(authoringAppearanceId ? { authoringAppearanceId } : {}),
      propIds: normalizeStringList(source.propIds),
      tracks,
      propEventTracks,
      layers,
      interruptionPolicy: normalizeInterruptionPolicy(source.interruptionPolicy),
      audioCues: normalizeMotionAudioCues(source.audioCues, durationMs),
      createdAt: finiteInteger(source.createdAt, now),
      updatedAt: finiteInteger(source.updatedAt, now),
      ...(Object.keys(extensions).length ? { extensions } : {}),
    },
    diagnostics,
  }
}

export function createStudioMotionAsset(input: Partial<StudioMotionAssetV2> & Pick<StudioMotionAssetV2, 'id' | 'nameZh' | 'nameEn'>): StudioMotionAssetV2 {
  return normalizeMotionAsset(input, {
    fallbackId: input.id,
    fallbackNameZh: input.nameZh,
    fallbackNameEn: input.nameEn,
    now: input.createdAt,
  }).asset
}

export function normalizeMotionAssetCollection(input: unknown, options: Omit<NormalizeMotionAssetOptions, 'fallbackId' | 'fallbackNameZh' | 'fallbackNameEn'> = {}): StudioMotionAssetV2[] {
  if (!Array.isArray(input)) return []
  return input.map((item, index) => normalizeMotionAsset(item, {
    ...options,
    fallbackId: `motion-legacy-${index + 1}`,
    fallbackNameZh: `新动作 ${index + 1}`,
    fallbackNameEn: `Motion ${index + 1}`,
  }).asset)
}

export function insertMotionKeyframe(assetInput: StudioMotionAssetV2, input: InsertMotionKeyframeInput): NormalizeMotionAssetResult & { keyframeId: string } {
  const source = normalizeMotionAsset(assetInput).asset
  const targetLayerId = input.layerId || 'base'
  const existingTrack = source.tracks.find(track => track.channelId === input.channelId && track.layerId === targetLayerId)
  const keyframeId = input.keyframeId || `key-${input.channelId.replaceAll('.', '-')}-${Math.round(input.timeMs)}-${existingTrack?.keyframes.length || 0}`
  const nextTrack: MotionTrack = existingTrack
    ? {
        ...existingTrack,
        layerId: existingTrack.layerId || input.layerId || 'base',
        keyframes: [...existingTrack.keyframes, {
          id: keyframeId,
          timeMs: input.timeMs,
          value: input.value,
          interpolation: input.interpolation || 'linear',
          ...(input.inTangent !== undefined ? { inTangent: input.inTangent } : {}),
          ...(input.outTangent !== undefined ? { outTangent: input.outTangent } : {}),
        }],
      }
    : {
        id: input.trackId || `track-${input.channelId}`,
        channelId: input.channelId,
        layerId: input.layerId || 'base',
        muted: false,
        keyframes: [{
          id: keyframeId,
          timeMs: input.timeMs,
          value: input.value,
          interpolation: input.interpolation || 'linear',
          ...(input.inTangent !== undefined ? { inTangent: input.inTangent } : {}),
          ...(input.outTangent !== undefined ? { outTangent: input.outTangent } : {}),
        }],
      }

  const tracks = existingTrack
    ? source.tracks.map(track => track.channelId === input.channelId && track.layerId === targetLayerId ? nextTrack : track)
    : [...source.tracks, nextTrack]
  const result = normalizeMotionAsset({ ...source, tracks, updatedAt: Date.now() })
  return { ...result, keyframeId }
}

function normalizeTracks(input: unknown, durationMs: number, diagnostics: MotionNormalizationDiagnostic[], layerIds: Set<string>): MotionTrack[] {
  if (!Array.isArray(input)) return []
  const merged = new Map<string, { id: string; channelId: CloudFoxRigChannelId; layerId: string; muted: boolean; keyframes: unknown[] }>()

  for (let trackIndex = 0; trackIndex < input.length; trackIndex += 1) {
    const source = input[trackIndex]
    if (!isRecord(source) || !isCloudFoxRigChannelId(source.channelId)) {
      diagnostics.push({ code: 'unknown-channel-dropped', path: `tracks.${trackIndex}.channelId`, detail: String(isRecord(source) ? source.channelId : '') })
      continue
    }
    const channelId = source.channelId
    const layerId = typeof source.layerId === 'string' && layerIds.has(source.layerId) ? source.layerId : 'base'
    const mergeKey = `${layerId}:${channelId}`
    const keyframes = Array.isArray(source.keyframes) ? source.keyframes : []
    const existing = merged.get(mergeKey)
    if (existing) {
      diagnostics.push({ code: 'duplicate-channel-track-merged', path: `tracks.${trackIndex}.channelId`, detail: channelId })
      existing.keyframes.push(...keyframes)
      existing.muted = source.muted === true
    }
    else {
      merged.set(mergeKey, {
        id: text(source.id, `track-${channelId}`),
        channelId,
        layerId,
        muted: source.muted === true,
        keyframes: [...keyframes],
      })
    }
  }

  return [...merged.values()]
    .map(track => ({
      id: track.id,
      channelId: track.channelId,
      layerId: track.layerId,
      muted: track.muted,
      keyframes: normalizeKeyframes(track.keyframes, track.channelId, durationMs, diagnostics),
    }))
    .filter(track => track.keyframes.length > 0)
    .sort((left, right) => left.layerId.localeCompare(right.layerId) || (CHANNEL_INDEX.get(left.channelId) ?? 0) - (CHANNEL_INDEX.get(right.channelId) ?? 0))
}

function normalizeKeyframes(input: unknown[], channelId: CloudFoxRigChannelId, durationMs: number, diagnostics: MotionNormalizationDiagnostic[]): MotionKeyframe[] {
  const definition = getCloudFoxRigChannel(channelId)
  const byTime = new Map<number, MotionKeyframe>()

  for (let keyframeIndex = 0; keyframeIndex < input.length; keyframeIndex += 1) {
    const candidate = input[keyframeIndex]
    const source: Record<string, unknown> = isRecord(candidate) ? candidate : {}
    const rawTime = finiteInteger(source.timeMs)
    const timeMs = clamp(rawTime, 0, durationMs)
    const rawValue = finiteNumber(source.value, definition.neutral)
    const value = clamp(rawValue, definition.minimum, definition.maximum)

    if (rawTime !== timeMs) diagnostics.push({ code: 'keyframe-time-clamped', path: `tracks.${channelId}.keyframes.${keyframeIndex}.timeMs` })
    if (rawValue !== value) diagnostics.push({ code: 'keyframe-value-clamped', path: `tracks.${channelId}.keyframes.${keyframeIndex}.value` })
    if (byTime.has(timeMs)) diagnostics.push({ code: 'duplicate-keyframe-time-replaced', path: `tracks.${channelId}.keyframes.${keyframeIndex}.timeMs`, detail: String(timeMs) })

    byTime.set(timeMs, {
      id: text(source.id, `key-${channelId.replaceAll('.', '-')}-${timeMs}-${keyframeIndex}`),
      timeMs,
      value,
      interpolation: interpolation(source.interpolation),
      ...(source.inTangent !== undefined ? { inTangent: clamp(finiteNumber(source.inTangent), -8, 8) } : {}),
      ...(source.outTangent !== undefined ? { outTangent: clamp(finiteNumber(source.outTangent), -8, 8) } : {}),
    })
  }

  return [...byTime.values()].sort((left, right) => left.timeMs - right.timeMs)
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return [...new Set(input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()))]
}

function collectExtensions(source: Record<string, unknown>, diagnostics: MotionNormalizationDiagnostic[]): Record<string, unknown> {
  const extensions: Record<string, unknown> = {}
  let explicitExtensions: unknown
  try {
    explicitExtensions = Reflect.get(source, 'extensions')
  }
  catch {
    diagnostics.push({ code: 'extensions-access-failed', path: 'extensions' })
  }

  if (explicitExtensions !== undefined) {
    let extensionKeys: (string | symbol)[] | undefined
    try {
      if (!explicitExtensions || typeof explicitExtensions !== 'object' || Array.isArray(explicitExtensions)) {
        diagnostics.push({ code: 'extensions-invalid', path: 'extensions' })
      }
      else extensionKeys = Reflect.ownKeys(explicitExtensions)
    }
    catch {
      diagnostics.push({ code: 'extensions-access-failed', path: 'extensions' })
    }
    for (const key of extensionKeys ?? []) {
      if (typeof key !== 'string') continue
      try {
        const descriptor = Reflect.getOwnPropertyDescriptor(explicitExtensions as object, key)
        if (descriptor?.enumerable) extensions[key] = Reflect.get(explicitExtensions as object, key)
      }
      catch {
        diagnostics.push({ code: 'extensions-access-failed', path: `extensions.${key}` })
      }
    }
  }

  let sourceKeys: (string | symbol)[] = []
  try {
    sourceKeys = Reflect.ownKeys(source)
  }
  catch {
    diagnostics.push({ code: 'extensions-access-failed', path: '$' })
  }
  for (const key of sourceKeys) {
    if (typeof key !== 'string' || KNOWN_ASSET_KEYS.has(key)) continue
    try {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key)
      if (descriptor?.enumerable) extensions[key] = Reflect.get(source, key)
    }
    catch {
      diagnostics.push({ code: 'extensions-access-failed', path: key })
    }
  }
  return extensions
}
