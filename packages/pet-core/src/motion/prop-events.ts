/**
 * 文件职责 / File responsibility
 * 定义并求值确定性的道具事件轨道，将创建、挂载、分离、移动、显隐、样式和销毁事件归约为运行时实例。
 * Defines and evaluates deterministic prop-event tracks, reducing create, attach, detach, move, visibility, style, and destroy events into runtime instances.
 */
import { resolveMotionTime, type StudioMotionLoopMode } from './motion-time'

export type MotionPropEventKind = 'create' | 'show' | 'attach' | 'detach' | 'move' | 'hide' | 'style' | 'destroy'
export type MotionPropSpace = 'mount' | 'world'
export type MotionPropMountId = 'world' | 'pet-root' | 'head-top' | 'muzzle' | 'left-front-paw' | 'right-front-paw' | 'left-hind-paw' | 'right-hind-paw' | 'tail-tip'
export type MotionVector3 = readonly [number, number, number]

export interface MotionPropTransform {
  position: MotionVector3
  rotation: MotionVector3
  scale: MotionVector3
}

export interface MotionPropStyle {
  color: string
  opacity: number
  glow: number
  particleRate: number
}

export interface MotionPropEvent {
  id: string
  timeMs: number
  kind: MotionPropEventKind
  mountId?: MotionPropMountId
  space?: MotionPropSpace
  transform?: Partial<MotionPropTransform>
  style?: Partial<MotionPropStyle>
}

export interface MotionPropEventTrack {
  id: string
  instanceId: string
  propId: string
  events: MotionPropEvent[]
}

export interface EvaluatedMotionPropInstance {
  instanceId: string
  propId: string
  exists: boolean
  visible: boolean
  mountId: MotionPropMountId
  space: MotionPropSpace
  transform: MotionPropTransform
  style: MotionPropStyle
}

export interface PropEventDiagnostic {
  code: 'missing-prop-dependency' | 'duplicate-prop-event-time' | 'invalid-prop-event'
  path: string
  detail?: string
}

export interface EvaluateMotionPropEventsInput {
  durationMs: number
  loopMode: StudioMotionLoopMode
  propIds: readonly string[]
  propEventTracks: readonly MotionPropEventTrack[]
}

const EVENT_KINDS = new Set<MotionPropEventKind>(['create', 'show', 'attach', 'detach', 'move', 'hide', 'style', 'destroy'])
const MOUNTS = new Set<MotionPropMountId>(['world', 'pet-root', 'head-top', 'muzzle', 'left-front-paw', 'right-front-paw', 'left-hind-paw', 'right-hind-paw', 'tail-tip'])
const ZERO: MotionVector3 = [0, 0, 0]
const ONE: MotionVector3 = [1, 1, 1]
const DEFAULT_STYLE: MotionPropStyle = { color: '#66e8ff', opacity: 1, glow: .35, particleRate: 0 }
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const vector = (value: unknown, fallback: MotionVector3): MotionVector3 => Array.isArray(value)
  ? [finite(value[0], fallback[0]), finite(value[1], fallback[1]), finite(value[2], fallback[2])]
  : fallback

export function createDefaultPropTransform(): MotionPropTransform {
  return { position: [...ZERO], rotation: [...ZERO], scale: [...ONE] }
}

export function createDefaultPropStyle(): MotionPropStyle {
  return { ...DEFAULT_STYLE }
}

export function normalizePropEventTracks(input: unknown, durationMs: number, diagnostics: PropEventDiagnostic[] = []): MotionPropEventTrack[] {
  if (!Array.isArray(input)) return []
  const tracks: MotionPropEventTrack[] = []
  for (let trackIndex = 0; trackIndex < input.length; trackIndex += 1) {
    const source = input[trackIndex]
    if (!isRecord(source)) continue
    const propId = text(source.propId, '')
    const instanceId = text(source.instanceId, '')
    if (!propId || !instanceId) {
      diagnostics.push({ code: 'invalid-prop-event', path: `propEventTracks.${trackIndex}` })
      continue
    }
    const byTimeAndKind = new Map<string, MotionPropEvent>()
    const events = Array.isArray(source.events) ? source.events : []
    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      const eventSource = events[eventIndex]
      if (!isRecord(eventSource) || !EVENT_KINDS.has(eventSource.kind as MotionPropEventKind)) {
        diagnostics.push({ code: 'invalid-prop-event', path: `propEventTracks.${trackIndex}.events.${eventIndex}` })
        continue
      }
      const kind = eventSource.kind as MotionPropEventKind
      const timeMs = clamp(Math.round(finite(eventSource.timeMs)), 0, durationMs)
      const mountId = MOUNTS.has(eventSource.mountId as MotionPropMountId) ? eventSource.mountId as MotionPropMountId : undefined
      const transformSource = isRecord(eventSource.transform) ? eventSource.transform : undefined
      const styleSource = isRecord(eventSource.style) ? eventSource.style : undefined
      const event: MotionPropEvent = {
        id: text(eventSource.id, `prop-event-${trackIndex}-${eventIndex}-${timeMs}`),
        timeMs,
        kind,
        ...(mountId ? { mountId } : {}),
        ...(eventSource.space === 'world' || eventSource.space === 'mount' ? { space: eventSource.space } : {}),
        ...(transformSource ? { transform: {
          ...(transformSource.position ? { position: vector(transformSource.position, ZERO) } : {}),
          ...(transformSource.rotation ? { rotation: vector(transformSource.rotation, ZERO) } : {}),
          ...(transformSource.scale ? { scale: vector(transformSource.scale, ONE) } : {}),
        } } : {}),
        ...(styleSource ? { style: {
          ...(typeof styleSource.color === 'string' ? { color: styleSource.color } : {}),
          ...(styleSource.opacity !== undefined ? { opacity: clamp(finite(styleSource.opacity, 1), 0, 1) } : {}),
          ...(styleSource.glow !== undefined ? { glow: clamp(finite(styleSource.glow), 0, 8) } : {}),
          ...(styleSource.particleRate !== undefined ? { particleRate: clamp(finite(styleSource.particleRate), 0, 240) } : {}),
        } } : {}),
      }
      const key = `${timeMs}:${kind}`
      if (byTimeAndKind.has(key)) diagnostics.push({ code: 'duplicate-prop-event-time', path: `propEventTracks.${trackIndex}.events.${eventIndex}`, detail: key })
      byTimeAndKind.set(key, event)
    }
    const normalizedEvents = [...byTimeAndKind.values()].sort((left, right) => left.timeMs - right.timeMs || left.kind.localeCompare(right.kind))
    tracks.push({ id: text(source.id, `prop-track-${instanceId}`), instanceId, propId, events: normalizedEvents })
  }
  return tracks.sort((left, right) => left.instanceId.localeCompare(right.instanceId))
}

export function evaluateMotionPropEvents(input: EvaluateMotionPropEventsInput, timeMs: number): { instances: EvaluatedMotionPropInstance[]; diagnostics: PropEventDiagnostic[] } {
  const diagnostics: PropEventDiagnostic[] = []
  const tracks = normalizePropEventTracks(input.propEventTracks, input.durationMs, diagnostics)
  const resolved = resolveMotionTime(timeMs, input.durationMs, input.loopMode)
  const dependencies = new Set(input.propIds)
  const instances: EvaluatedMotionPropInstance[] = []
  for (const track of tracks) {
    if (!dependencies.has(track.propId)) diagnostics.push({ code: 'missing-prop-dependency', path: `propEventTracks.${track.id}.propId`, detail: track.propId })
    const instance: EvaluatedMotionPropInstance = {
      instanceId: track.instanceId,
      propId: track.propId,
      exists: false,
      visible: false,
      mountId: 'world',
      space: 'world',
      transform: createDefaultPropTransform(),
      style: createDefaultPropStyle(),
    }
    for (const event of track.events) {
      if (event.timeMs > resolved.resolvedTimeMs) break
      applyPropEvent(instance, event)
    }
    if (instance.exists) instances.push(instance)
  }
  return { instances, diagnostics }
}

export function insertMotionPropEvent(tracks: readonly MotionPropEventTrack[], input: { propId: string; instanceId: string; event: MotionPropEvent }, durationMs: number): { tracks: MotionPropEventTrack[]; eventId: string } {
  const eventId = input.event.id || `prop-event-${input.instanceId}-${input.event.timeMs}-${input.event.kind}`
  const existing = tracks.find(track => track.instanceId === input.instanceId)
  const nextTrack: MotionPropEventTrack = existing
    ? { ...existing, propId: input.propId, events: [...existing.events, { ...input.event, id: eventId }] }
    : { id: `prop-track-${input.instanceId}`, instanceId: input.instanceId, propId: input.propId, events: [{ ...input.event, id: eventId }] }
  const next = existing ? tracks.map(track => track.instanceId === input.instanceId ? nextTrack : track) : [...tracks, nextTrack]
  return { tracks: normalizePropEventTracks(next, durationMs), eventId }
}

export function removeMotionPropEvents(tracks: readonly MotionPropEventTrack[], eventIds: readonly string[], durationMs: number): MotionPropEventTrack[] {
  const ids = new Set(eventIds)
  return normalizePropEventTracks(tracks.map(track => ({ ...track, events: track.events.filter(event => !ids.has(event.id)) })).filter(track => track.events.length), durationMs)
}

function applyPropEvent(instance: EvaluatedMotionPropInstance, event: MotionPropEvent) {
  if (event.kind === 'create') { instance.exists = true; instance.visible = true }
  if (event.kind === 'show') instance.visible = true
  if (event.kind === 'hide') instance.visible = false
  if (event.kind === 'destroy') { instance.exists = false; instance.visible = false }
  if (event.kind === 'attach') { instance.exists = true; instance.visible = true; instance.space = 'mount'; instance.mountId = event.mountId || 'pet-root' }
  if (event.kind === 'detach') { instance.space = 'world'; instance.mountId = 'world' }
  if (event.kind === 'move' && event.space) instance.space = event.space
  if (event.mountId) instance.mountId = event.mountId
  if (event.transform?.position) instance.transform.position = vector(event.transform.position, instance.transform.position)
  if (event.transform?.rotation) instance.transform.rotation = vector(event.transform.rotation, instance.transform.rotation)
  if (event.transform?.scale) instance.transform.scale = vector(event.transform.scale, instance.transform.scale)
  if (event.style?.color) instance.style.color = event.style.color
  if (event.style?.opacity !== undefined) instance.style.opacity = clamp(event.style.opacity, 0, 1)
  if (event.style?.glow !== undefined) instance.style.glow = clamp(event.style.glow, 0, 8)
  if (event.style?.particleRate !== undefined) instance.style.particleRate = clamp(event.style.particleRate, 0, 240)
}
