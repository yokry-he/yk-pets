/**
 * 文件职责 / File responsibility
 * 提供高级动作层、镜像预设、IK、音效轨道、路径采样和安全本地 GLB 校验的框架无关领域能力。
 * Provides framework-independent advanced motion layers, mirroring/presets, IK, audio cues, path sampling, and safe local GLB validation.
 */
import { createNeutralCloudFoxPoseValues, type CloudFoxRigChannelId } from './cloud-fox-rig'
import type { MotionInterpolation, MotionKeyframe, StudioMotionAssetV2 } from './motion-asset'

export type MotionLayerMode = 'override' | 'additive'
export interface MotionLayer { id: string; name: string; enabled: boolean; weight: number; mode: MotionLayerMode; priority: number }
export type MotionInterruptionMode = 'immediate' | 'finish-loop' | 'blend-out'
export interface MotionInterruptionPolicy { mode: MotionInterruptionMode; blendOutMs: number }
export type MotionAudioCueKind = 'tone' | 'local-audio'
export interface MotionAudioCue { id: string; timeMs: number; name: string; kind: MotionAudioCueKind; frequency: number; durationMs: number; volume: number; dataUrl?: string }
export type MotionPosePresetId = 'neutral' | 'wave-left' | 'wave-right' | 'squat' | 'look-up'
export interface TwoBoneIkResult { upperAngle: number; lowerAngle: number; distance: number; reachable: boolean }
export interface LocalGlbValidationResult { valid: boolean; byteLength: number; diagnostics: string[]; json?: Record<string, unknown> }

const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function createDefaultMotionLayers(): MotionLayer[] { return [{ id: 'base', name: 'Base', enabled: true, weight: 1, mode: 'override', priority: 0 }] }
export function normalizeMotionLayers(input: unknown): MotionLayer[] {
  const source = Array.isArray(input) ? input : []
  const byId = new Map<string, MotionLayer>()
  for (let index = 0; index < source.length; index += 1) {
    const item = isRecord(source[index]) ? source[index] as Record<string, unknown> : {}
    const id = text(item.id, `layer-${index + 1}`)
    byId.set(id, { id, name: text(item.name, id), enabled: item.enabled !== false, weight: clamp(finite(item.weight, 1), 0, 1), mode: item.mode === 'additive' ? 'additive' : 'override', priority: Math.round(clamp(finite(item.priority, index), -100, 100)) })
  }
  if (!byId.has('base')) byId.set('base', createDefaultMotionLayers()[0]!)
  return [...byId.values()].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
export function normalizeInterruptionPolicy(input: unknown): MotionInterruptionPolicy {
  const source = isRecord(input) ? input : {}
  const mode: MotionInterruptionMode = source.mode === 'finish-loop' || source.mode === 'blend-out' ? source.mode : 'immediate'
  return { mode, blendOutMs: Math.round(clamp(finite(source.blendOutMs, 180), 0, 5000)) }
}
export function normalizeMotionAudioCues(input: unknown, durationMs: number): MotionAudioCue[] {
  if (!Array.isArray(input)) return []
  const byId = new Map<string, MotionAudioCue>()
  for (let index = 0; index < input.length; index += 1) {
    const item = isRecord(input[index]) ? input[index] as Record<string, unknown> : {}
    const id = text(item.id, `audio-${index + 1}`)
    const dataUrl = typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:audio/') && item.dataUrl.length <= 700_000 ? item.dataUrl : undefined
    byId.set(id, {
      id, timeMs: Math.round(clamp(finite(item.timeMs), 0, durationMs)), name: text(item.name, 'Audio cue'),
      kind: dataUrl && item.kind === 'local-audio' ? 'local-audio' : 'tone', frequency: clamp(finite(item.frequency, 440), 40, 4000),
      durationMs: Math.round(clamp(finite(item.durationMs, 180), 20, 10000)), volume: clamp(finite(item.volume, .35), 0, 1), ...(dataUrl ? { dataUrl } : {}),
    })
  }
  return [...byId.values()].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id))
}

const MIRROR_PAIRS: readonly [string, string][] = [
  ['frontPaw.left.', 'frontPaw.right.'], ['hindPaw.left.', 'hindPaw.right.'], ['ear.left.', 'ear.right.'], ['eye.left.', 'eye.right.'], ['antenna.left.', 'antenna.right.'],
]
export function mirrorCloudFoxChannelId(id: CloudFoxRigChannelId): CloudFoxRigChannelId {
  for (const [left, right] of MIRROR_PAIRS) {
    if (id.startsWith(left)) return id.replace(left, right) as CloudFoxRigChannelId
    if (id.startsWith(right)) return id.replace(right, left) as CloudFoxRigChannelId
  }
  return id
}
export function mirrorMotionAsset(asset: StudioMotionAssetV2): StudioMotionAssetV2 {
  const mirrored = structuredClone(asset)
  mirrored.tracks = mirrored.tracks.map(track => ({ ...track, id: `${track.id}-mirror`, channelId: mirrorCloudFoxChannelId(track.channelId), keyframes: track.keyframes.map(keyframe => ({ ...keyframe, value: shouldInvert(track.channelId) ? -keyframe.value : keyframe.value })) }))
  mirrored.updatedAt = Date.now()
  return mirrored
}
function shouldInvert(id: CloudFoxRigChannelId) { return id.endsWith('.y') || id.endsWith('.z') || id === 'eye.gaze.x' || id === 'root.position.x' }

export function applyMotionPosePreset(asset: StudioMotionAssetV2, preset: MotionPosePresetId, timeMs: number): StudioMotionAssetV2 {
  const values: Partial<Record<CloudFoxRigChannelId, number>> = preset === 'wave-left' ? { 'frontPaw.left.rotation.x': -1.4, 'frontPaw.left.rotation.z': -.7, 'head.rotation.z': .12 }
    : preset === 'wave-right' ? { 'frontPaw.right.rotation.x': -1.4, 'frontPaw.right.rotation.z': .7, 'head.rotation.z': -.12 }
      : preset === 'squat' ? { 'root.position.y': -.35, 'hindPaw.left.rotation.x': .7, 'hindPaw.right.rotation.x': .7 }
        : preset === 'look-up' ? { 'head.rotation.x': -.45, 'eye.gaze.y': .65, 'antenna.left.rotation.x': -.3, 'antenna.right.rotation.x': -.3 }
          : createNeutralCloudFoxPoseValues()
  const next = structuredClone(asset)
  for (const [channelId, value] of Object.entries(values) as [CloudFoxRigChannelId, number][]) {
    let track = next.tracks.find(item => item.channelId === channelId && item.layerId === 'base')
    if (!track) { track = { id: `track-${channelId}`, layerId: 'base', channelId, muted: false, keyframes: [] }; next.tracks.push(track) }
    const existing = track.keyframes.find(keyframe => keyframe.timeMs === timeMs)
    const keyframe: MotionKeyframe = { id: existing?.id || `key-${channelId.replaceAll('.','-')}-${timeMs}`, timeMs, value, interpolation: 'smooth' }
    track.keyframes = [...track.keyframes.filter(item => item.timeMs !== timeMs), keyframe].sort((a,b)=>a.timeMs-b.timeMs)
  }
  next.updatedAt = Date.now()
  return next
}

export function addMotionLayer(asset: StudioMotionAssetV2, name: string, mode: MotionLayerMode = 'override'): StudioMotionAssetV2 {
  const next = structuredClone(asset); const id = `layer-${Date.now().toString(36)}`
  next.layers.push({ id, name: text(name, 'Layer'), enabled: true, weight: 1, mode, priority: next.layers.length }); next.updatedAt = Date.now(); return next
}
export function updateMotionLayer(asset: StudioMotionAssetV2, layerId: string, patch: Partial<MotionLayer>): StudioMotionAssetV2 {
  const next = structuredClone(asset); next.layers = next.layers.map(layer => layer.id === layerId ? { ...layer, ...patch, id: layer.id } : layer); next.updatedAt = Date.now(); return next
}
export function removeMotionLayer(asset: StudioMotionAssetV2, layerId: string): StudioMotionAssetV2 {
  if (layerId === 'base') return asset
  const next = structuredClone(asset); next.layers = next.layers.filter(layer => layer.id !== layerId); next.tracks = next.tracks.map(track => track.layerId === layerId ? { ...track, layerId: 'base' } : track); next.updatedAt = Date.now(); return next
}
export function assignTrackToLayer(asset: StudioMotionAssetV2, channelId: CloudFoxRigChannelId, layerId: string): StudioMotionAssetV2 {
  const next = structuredClone(asset); next.tracks = next.tracks.map(track => track.channelId === channelId ? { ...track, layerId } : track); next.updatedAt = Date.now(); return next
}

export function solveTwoBoneIk2D(targetX: number, targetY: number, upperLength: number, lowerLength: number): TwoBoneIkResult {
  const distance = Math.hypot(targetX, targetY)
  const clampedDistance = clamp(distance, Math.abs(upperLength - lowerLength) + 1e-6, upperLength + lowerLength - 1e-6)
  const lowerAngle = Math.acos(clamp((upperLength ** 2 + lowerLength ** 2 - clampedDistance ** 2) / (2 * upperLength * lowerLength), -1, 1))
  const offset = Math.acos(clamp((upperLength ** 2 + clampedDistance ** 2 - lowerLength ** 2) / (2 * upperLength * clampedDistance), -1, 1))
  return { upperAngle: Math.atan2(targetY, targetX) - offset, lowerAngle: Math.PI - lowerAngle, distance, reachable: distance <= upperLength + lowerLength && distance >= Math.abs(upperLength - lowerLength) }
}

export function sampleMotionChannelPath(asset: StudioMotionAssetV2, channelX: CloudFoxRigChannelId, channelY: CloudFoxRigChannelId, channelZ: CloudFoxRigChannelId, samples: number, evaluate: (asset: StudioMotionAssetV2, timeMs: number) => { values: Record<CloudFoxRigChannelId, number> }): readonly [number, number, number][] {
  return Array.from({ length: Math.max(2, Math.min(240, samples)) }, (_, index) => {
    const timeMs = asset.durationMs * index / Math.max(1, samples - 1); const values = evaluate(asset, timeMs).values
    return [values[channelX], values[channelY], values[channelZ]] as const
  })
}

export function validateLocalGlb(input: ArrayBuffer, maximumBytes = 2_000_000): LocalGlbValidationResult {
  const diagnostics: string[] = []; const bytes = new Uint8Array(input)
  if (bytes.byteLength > maximumBytes) diagnostics.push('file-too-large')
  if (bytes.byteLength < 20 || String.fromCharCode(...bytes.slice(0,4)) !== 'glTF') diagnostics.push('invalid-glb-header')
  const view = new DataView(input)
  if (bytes.byteLength >= 12 && view.getUint32(4, true) !== 2) diagnostics.push('unsupported-glb-version')
  if (bytes.byteLength >= 12 && view.getUint32(8, true) !== bytes.byteLength) diagnostics.push('glb-length-mismatch')
  let jsonData: Record<string, unknown> | undefined
  if (!diagnostics.includes('invalid-glb-header') && bytes.byteLength >= 20) {
    try {
      const chunkLength = view.getUint32(12, true); const chunkType = view.getUint32(16, true)
      if (chunkType !== 0x4E4F534A || 20 + chunkLength > bytes.byteLength) diagnostics.push('missing-json-chunk')
      else {
        jsonData = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + chunkLength)).replace(/\0+$/,'')) as Record<string, unknown>
        const uris: string[] = []
        for (const key of ['buffers','images'] as const) for (const item of Array.isArray(jsonData[key]) ? jsonData[key] as unknown[] : []) if (isRecord(item) && typeof item.uri === 'string') uris.push(item.uri)
        if (uris.some(uri => !uri.startsWith('data:'))) diagnostics.push('external-uri-forbidden')
      }
    } catch { diagnostics.push('invalid-json-chunk') }
  }
  return { valid: diagnostics.length === 0, byteLength: bytes.byteLength, diagnostics, ...(jsonData ? { json: jsonData } : {}) }
}

export function normalizeAdvancedInterpolation(value: unknown): MotionInterpolation {
  return value === 'step' || value === 'smooth' || value === 'bezier' ? value : 'linear'
}
