/*
 * 文件职责 / File responsibility
 * 管理动作工坊的独立草稿、播放指针、关键帧选择、剪贴板和事务式撤销重做，不直接持久化资产。
 * Manages Motion Studio drafts, playhead, keyframe selection, clipboard, and transactional undo/redo without directly persisting assets.
 */
import {
  copyMotionKeyframes,
  duplicateMotionAssetForDraft,
  insertMotionPropEvent,
  moveMotionKeyframes,
  normalizeMotionAsset,
  pasteMotionKeyframes,
  removeMotionKeyframes,
  removeMotionPropEvents,
  resolveMotionTime,
  setMotionKeyframeInterpolation,
  writeMotionChannelValue,
  type CloudFoxRigChannelId,
  type MotionClipboardEntry,
  type MotionInterpolation,
  type MotionPropEvent,
  type MotionPropMountId,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'
import { defineStore } from 'pinia'

interface MotionEditorState {
  motionId: string
  draft: StudioMotionAssetV2 | null
  baseline: string
  undoStack: string[]
  redoStack: string[]
  selectedChannelId: CloudFoxRigChannelId
  selectedKeyframeIds: string[]
  clipboard: MotionClipboardEntry[]
  playheadTimeMs: number
  playing: boolean
  playbackOriginTimeMs: number
  playbackStartedAt: number
  snapToFrames: boolean
  autoKey: boolean
  lastDiagnostics: string[]
  selectedPropEventIds: string[]
}

const DEFAULT_CHANNEL: CloudFoxRigChannelId = 'root.position.y'
const serialize = (asset: StudioMotionAssetV2 | null) => asset ? JSON.stringify(asset) : ''
const parse = (value: string) => value ? normalizeMotionAsset(JSON.parse(value)).asset : null

export const useStudioMotionEditorStore = defineStore('studio-motion-editor', {
  state: (): MotionEditorState => ({
    motionId: '',
    draft: null,
    baseline: '',
    undoStack: [],
    redoStack: [],
    selectedChannelId: DEFAULT_CHANNEL,
    selectedKeyframeIds: [],
    clipboard: [],
    playheadTimeMs: 0,
    playing: false,
    playbackOriginTimeMs: 0,
    playbackStartedAt: 0,
    snapToFrames: true,
    autoKey: true,
    lastDiagnostics: [],
    selectedPropEventIds: [],
  }),
  getters: {
    isDirty: state => Boolean(state.draft) && serialize(state.draft) !== state.baseline,
    canUndo: state => state.undoStack.length > 0,
    canRedo: state => state.redoStack.length > 0,
    selectedKeyframeCount: state => state.selectedKeyframeIds.length,
  },
  actions: {
    open(asset: StudioMotionAssetV2) {
      if (this.motionId === asset.id && this.draft) return
      this.motionId = asset.id
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = 0
      this.playing = false
      this.lastDiagnostics = []
      this.selectedPropEventIds = []
    },
    replaceFromSaved(asset: StudioMotionAssetV2) {
      this.motionId = asset.id
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = Math.min(this.playheadTimeMs, asset.durationMs)
    },
    close() {
      this.motionId = ''
      this.draft = null
      this.baseline = ''
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playing = false
      this.selectedPropEventIds = []
    },
    snapshot() {
      if (!this.draft) return
      const value = serialize(this.draft)
      if (this.undoStack.at(-1) !== value) this.undoStack.push(value)
      if (this.undoStack.length > 100) this.undoStack.shift()
      this.redoStack = []
    },
    apply(asset: StudioMotionAssetV2, selectedKeyframeIds?: string[]) {
      const normalized = normalizeMotionAsset(asset)
      this.draft = normalized.asset
      this.selectedKeyframeIds = selectedKeyframeIds ?? this.selectedKeyframeIds
      this.lastDiagnostics = normalized.diagnostics.map(item => `${item.code}:${item.path}`)
      this.playheadTimeMs = Math.min(this.playheadTimeMs, normalized.asset.durationMs)
    },
    mutate(mutator: (asset: StudioMotionAssetV2) => StudioMotionAssetV2, selectedKeyframeIds?: string[]) {
      if (!this.draft) return
      this.snapshot()
      this.apply(mutator(this.draft), selectedKeyframeIds)
    },
    undo() {
      const previous = this.undoStack.pop()
      if (!previous || !this.draft) return
      this.redoStack.push(serialize(this.draft))
      this.draft = parse(previous)
      this.selectedKeyframeIds = []
      this.playing = false
    },
    redo() {
      const next = this.redoStack.pop()
      if (!next || !this.draft) return
      this.undoStack.push(serialize(this.draft))
      this.draft = parse(next)
      this.selectedKeyframeIds = []
      this.playing = false
    },
    setSelectedChannel(channelId: CloudFoxRigChannelId) {
      this.selectedChannelId = channelId
    },
    selectKeyframe(id: string, additive = false) {
      if (additive) {
        this.selectedKeyframeIds = this.selectedKeyframeIds.includes(id)
          ? this.selectedKeyframeIds.filter(item => item !== id)
          : [...this.selectedKeyframeIds, id]
      }
      else this.selectedKeyframeIds = [id]
    },
    selectKeyframes(ids: string[]) {
      this.selectedKeyframeIds = [...new Set(ids)]
    },
    clearSelection() {
      this.selectedKeyframeIds = []
    },
    setPlayhead(timeMs: number, snap?: boolean) {
      if (!this.draft) return
      const raw = Math.max(0, Math.min(this.draft.durationMs, Math.round(Number.isFinite(timeMs) ? timeMs : 0)))
      const shouldSnap = snap ?? this.snapToFrames
      if (!shouldSnap) this.playheadTimeMs = raw
      else {
        const frameMs = 1000 / this.draft.displayFps
        this.playheadTimeMs = Math.max(0, Math.min(this.draft.durationMs, Math.round(Math.round(raw / frameMs) * frameMs)))
      }
    },
    startPlayback(now = performance.now()) {
      if (!this.draft) return
      this.playing = true
      this.playbackOriginTimeMs = this.playheadTimeMs
      this.playbackStartedAt = now
    },
    pausePlayback(now = performance.now()) {
      if (!this.playing) return
      this.advancePlayback(now)
      this.playing = false
    },
    stopPlayback() {
      this.playing = false
      this.playheadTimeMs = 0
    },
    togglePlayback(now = performance.now()) {
      if (this.playing) this.pausePlayback(now)
      else this.startPlayback(now)
    },
    advancePlayback(now = performance.now()) {
      if (!this.playing || !this.draft) return
      const requested = this.playbackOriginTimeMs + Math.max(0, now - this.playbackStartedAt)
      const resolved = resolveMotionTime(requested, this.draft.durationMs, this.draft.loopMode)
      this.playheadTimeMs = resolved.resolvedTimeMs
      if (this.draft.loopMode === 'once' && requested >= this.draft.durationMs) this.playing = false
    },
    writeChannelValue(value: number, interpolation: MotionInterpolation = 'linear') {
      if (!this.draft) return
      this.snapshot()
      const result = writeMotionChannelValue(this.draft, this.selectedChannelId, this.playheadTimeMs, value, interpolation, {
        snapToFrames: this.snapToFrames,
        displayFps: this.draft.displayFps,
      })
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    deleteSelected() {
      if (!this.draft || !this.selectedKeyframeIds.length) return
      const ids = [...this.selectedKeyframeIds]
      this.mutate(asset => removeMotionKeyframes(asset, ids), [])
    },
    copySelected() {
      if (!this.draft) return
      this.clipboard = copyMotionKeyframes(this.draft, this.selectedKeyframeIds)
    },
    pasteAtPlayhead() {
      if (!this.draft || !this.clipboard.length) return
      this.snapshot()
      const result = pasteMotionKeyframes(this.draft, this.clipboard, this.playheadTimeMs, {
        snapToFrames: this.snapToFrames,
        displayFps: this.draft.displayFps,
      })
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    moveSelected(deltaMs: number) {
      if (!this.draft || !this.selectedKeyframeIds.length) return
      this.snapshot()
      const result = moveMotionKeyframes(this.draft, this.selectedKeyframeIds, deltaMs, {
        snapToFrames: this.snapToFrames,
        displayFps: this.draft.displayFps,
      })
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    setSelectedInterpolation(interpolation: MotionInterpolation) {
      if (!this.draft || !this.selectedKeyframeIds.length) return
      const ids = [...this.selectedKeyframeIds]
      this.mutate(asset => setMotionKeyframeInterpolation(asset, ids, interpolation), ids)
    },

    addPropEvent(input: { propId: string; instanceId: string; kind: MotionPropEvent['kind']; mountId?: MotionPropMountId; transform?: MotionPropEvent['transform']; style?: MotionPropEvent['style'] }) {
      if (!this.draft) return
      this.snapshot()
      const eventId = `prop-event-${input.instanceId}-${Math.round(this.playheadTimeMs)}-${input.kind}-${Date.now().toString(36)}`
      const event: MotionPropEvent = {
        id: eventId,
        timeMs: this.playheadTimeMs,
        kind: input.kind,
        ...(input.mountId ? { mountId: input.mountId } : {}),
        ...(input.kind === 'detach' || input.kind === 'move' ? { space: 'world' as const } : input.kind === 'attach' ? { space: 'mount' as const } : {}),
        ...(input.transform ? { transform: input.transform } : {}),
        ...(input.style ? { style: input.style } : {}),
      }
      const result = insertMotionPropEvent(this.draft.propEventTracks, { propId: input.propId, instanceId: input.instanceId, event }, this.draft.durationMs)
      const propIds = this.draft.propIds.includes(input.propId) ? this.draft.propIds : [...this.draft.propIds, input.propId]
      this.apply({ ...this.draft, propIds, propEventTracks: result.tracks, updatedAt: Date.now() })
      this.selectedPropEventIds = [result.eventId]
    },
    deletePropEvents(eventIds?: string[]) {
      const ids = eventIds ?? this.selectedPropEventIds
      if (!this.draft || !ids.length) return
      this.snapshot()
      this.apply({ ...this.draft, propEventTracks: removeMotionPropEvents(this.draft.propEventTracks, ids, this.draft.durationMs), updatedAt: Date.now() })
      this.selectedPropEventIds = []
    },
    selectPropEvent(id: string, additive = false) {
      this.selectedPropEventIds = additive
        ? this.selectedPropEventIds.includes(id) ? this.selectedPropEventIds.filter(item => item !== id) : [...this.selectedPropEventIds, id]
        : [id]
    },
    updateMetadata(patch: Partial<Pick<StudioMotionAssetV2, 'nameZh' | 'nameEn' | 'durationMs' | 'displayFps' | 'loopMode' | 'propIds'>>) {
      if (!this.draft) return
      this.mutate(asset => normalizeMotionAsset({ ...asset, ...patch, updatedAt: Date.now() }).asset)
    },
    markSaved(asset: StudioMotionAssetV2) {
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
    },
  },
})
