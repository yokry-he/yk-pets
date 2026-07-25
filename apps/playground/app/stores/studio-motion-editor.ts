/*
 * 文件职责 / File responsibility
 * 管理动作工坊的独立草稿、播放指针、关键帧选择、剪贴板和事务式撤销重做，不直接持久化资产。
 * Manages Motion Studio drafts, playhead, keyframe selection, clipboard, and transactional undo/redo without directly persisting assets.
 */
import {
  addMotionLayer,
  applyMotionPosePreset,
  assignTrackToLayer,
  copyMotionKeyframes,
  duplicateMotionAssetForDraft,
  insertMotionPropEvent,
  mirrorMotionAsset,
  moveMotionKeyframes,
  nudgeMotionControls,
  nudgeMotionControlValue,
  normalizeMotionAsset,
  readMotionControlValue,
  resetMotionControlValue,
  setMotionControlValue,
  pasteMotionKeyframes,
  removeMotionKeyframes,
  removeMotionLayer,
  removeMotionPropEvents,
  resolveMotionTime,
  setMotionKeyframeInterpolation,
  setMotionKeyframeTangents,
  solveTwoBoneIk2D,
  getMotionBodyPartControls,
  getMotionBodyPartModes,
  getMotionControl,
  updateMotionLayer,
  writeMotionChannelValue,
  type CloudFoxRigChannelId,
  type MotionClipboardEntry,
  type MotionAudioCue,
  type MotionAuthoringScope,
  type MotionBodyPartId,
  type MotionControlId,
  type MotionTransformMode,
  type MotionInterruptionPolicy,
  type MotionInterpolation,
  type MotionLayerMode,
  type MotionPosePresetId,
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
  activeLayerId: string
  onionSkin: boolean
  showMotionPath: boolean
  playbackWeight: number
  interruptionPending: boolean
  interruptionMode: MotionInterruptionPolicy['mode']
  interruptionDeadline: number
  blendOutStartedAt: number
  blendOutDurationMs: number
  playbackDirection: 1 | -1
  selectedBodyPartId: MotionBodyPartId
  authoringScope: MotionAuthoringScope
  transformMode: MotionTransformMode
  selectedControlId: MotionControlId
  symmetryEnabled: boolean
  controlGestureBaseline: string
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
    activeLayerId: 'base',
    onionSkin: false,
    showMotionPath: false,
    playbackWeight: 1,
    interruptionPending: false,
    interruptionMode: 'immediate',
    interruptionDeadline: 0,
    blendOutStartedAt: 0,
    blendOutDurationMs: 0,
    playbackDirection: 1,
    selectedBodyPartId: 'root',
    authoringScope: 'current-frame',
    transformMode: 'translate',
    selectedControlId: 'root.translate.y',
    symmetryEnabled: false,
    controlGestureBaseline: '',
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
      this.activeLayerId = this.draft.layers[0]?.id || 'base'
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
    },
    replaceFromSaved(asset: StudioMotionAssetV2) {
      this.motionId = asset.id
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = Math.min(this.playheadTimeMs, asset.durationMs)
      this.activeLayerId = this.draft.layers[0]?.id || 'base'
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
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
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
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
      this.playbackWeight = 1
      this.interruptionPending = false
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
      this.playbackWeight = 1
      this.interruptionPending = false
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
      this.playbackDirection = resolved.direction
      if (this.interruptionPending && this.interruptionMode === 'finish-loop' && requested >= this.interruptionDeadline) {
        this.playing = false
        this.interruptionPending = false
        this.playbackWeight = 0
        return
      }
      if (this.interruptionPending && this.interruptionMode === 'blend-out') {
        const progress = Math.max(0, Math.min(1, (now - this.blendOutStartedAt) / Math.max(1, this.blendOutDurationMs)))
        this.playbackWeight = 1 - progress
        if (progress >= 1) {
          this.playing = false
          this.interruptionPending = false
          this.playbackWeight = 0
          return
        }
      }
      if (this.draft.loopMode === 'once' && requested >= this.draft.durationMs) this.playing = false
    },
    requestPlaybackInterruption(now = performance.now()) {
      if (!this.playing || !this.draft) return true
      const policy = this.draft.interruptionPolicy
      if (policy.mode === 'immediate') {
        this.playing = false
        this.interruptionPending = false
        this.playbackWeight = 0
        return true
      }
      this.interruptionPending = true
      this.interruptionMode = policy.mode
      if (policy.mode === 'blend-out') {
        this.blendOutStartedAt = now
        this.blendOutDurationMs = Math.max(1, policy.blendOutMs)
      }
      else {
        const requested = this.playbackOriginTimeMs + Math.max(0, now - this.playbackStartedAt)
        const cycle = this.draft.loopMode === 'ping-pong' ? this.draft.durationMs * 2 : this.draft.durationMs
        this.interruptionDeadline = (Math.floor(requested / Math.max(1, cycle)) + 1) * Math.max(1, cycle)
      }
      return false
    },
    selectBodyPart(partId: MotionBodyPartId) {
      this.selectedBodyPartId = partId
      const modes = getMotionBodyPartModes(partId)
      if (!modes.includes(this.transformMode)) this.transformMode = modes[0] || 'rotate'
      const first = getMotionBodyPartControls(partId, this.transformMode)[0]
      if (first) this.selectControl(first.id as MotionControlId)
    },
    setAuthoringScope(scope: MotionAuthoringScope) {
      this.authoringScope = scope
    },
    setTransformMode(mode: MotionTransformMode) {
      const controls = getMotionBodyPartControls(this.selectedBodyPartId, mode)
      if (!controls.length) return
      this.transformMode = mode
      this.selectControl(controls[0]!.id as MotionControlId)
    },
    selectControl(controlId: MotionControlId) {
      const definition = getMotionControl(controlId)
      this.selectedControlId = controlId
      this.selectedBodyPartId = definition.partId
      this.transformMode = definition.mode
      this.selectedChannelId = definition.channelIds[0]!
    },
    controlOptions(scope?: MotionAuthoringScope) {
      const targetScope = scope ?? this.authoringScope
      return {
        scope: targetScope,
        playheadTimeMs: this.playheadTimeMs,
        selectedKeyframeIds: this.selectedKeyframeIds,
        interpolation: 'smooth' as MotionInterpolation,
        snapToFrames: this.snapToFrames,
        displayFps: this.draft?.displayFps || 30,
        layerId: this.activeLayerId,
        symmetry: this.symmetryEnabled,
      }
    },
    writeControlValue(controlId: MotionControlId, value: number) {
      if (!this.draft || (this.authoringScope === 'selected-keyframes' && !this.selectedKeyframeIds.length)) return
      this.snapshot()
      const result = setMotionControlValue(this.draft, controlId, value, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
      this.selectControl(controlId)
    },
    nudgeControl(controlId: MotionControlId, delta: number) {
      if (!this.draft || (this.authoringScope === 'selected-keyframes' && !this.selectedKeyframeIds.length)) return
      this.snapshot()
      const result = nudgeMotionControlValue(this.draft, controlId, delta, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
      this.selectControl(controlId)
    },
    resetControl(controlId?: MotionControlId) {
      const targetControlId = controlId ?? this.selectedControlId
      if (!this.draft || (this.authoringScope === 'selected-keyframes' && !this.selectedKeyframeIds.length)) return
      this.snapshot()
      const result = resetMotionControlValue(this.draft, targetControlId, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    keySelectedControl() {
      if (!this.draft) return
      const value = readMotionControlValue(this.draft, this.selectedControlId, 'current-frame', { playheadTimeMs: this.playheadTimeMs }) ?? 0
      this.snapshot()
      const result = setMotionControlValue(this.draft, this.selectedControlId, value, this.controlOptions('current-frame'))
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    beginControlGesture() {
      if (!this.draft || this.controlGestureBaseline) return
      this.controlGestureBaseline = serialize(this.draft)
      this.snapshot()
    },
    previewControlGesture(edits: readonly { controlId: MotionControlId; delta: number }[]) {
      if (!this.draft || !this.controlGestureBaseline) return
      const baseline = parse(this.controlGestureBaseline)
      if (!baseline) return
      const result = nudgeMotionControls(baseline, edits, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
    },
    endControlGesture() {
      if (!this.controlGestureBaseline) return
      if (serialize(this.draft) === this.controlGestureBaseline) this.undoStack.pop()
      this.controlGestureBaseline = ''
    },
    cancelControlGesture() {
      if (!this.controlGestureBaseline) return
      this.draft = parse(this.controlGestureBaseline)
      this.undoStack.pop()
      this.controlGestureBaseline = ''
    },

    writeChannelValue(value: number, interpolation: MotionInterpolation = 'linear') {
      if (!this.draft) return
      this.snapshot()
      const result = writeMotionChannelValue(this.draft, this.selectedChannelId, this.playheadTimeMs, value, interpolation, {
        snapToFrames: this.snapToFrames,
        displayFps: this.draft.displayFps,
        layerId: this.activeLayerId,
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

    setSelectedTangents(inTangent: number, outTangent: number) {
      if (!this.draft || !this.selectedKeyframeIds.length) return
      const ids = [...this.selectedKeyframeIds]
      this.mutate(asset => setMotionKeyframeTangents(asset, ids, inTangent, outTangent), ids)
    },
    mirrorDraft() { if (this.draft) this.mutate(asset => normalizeMotionAsset(mirrorMotionAsset(asset)).asset) },
    applyPreset(preset: MotionPosePresetId) { if (this.draft) this.mutate(asset => normalizeMotionAsset(applyMotionPosePreset(asset, preset, Math.round(this.playheadTimeMs))).asset) },
    addLayer(name: string, mode: MotionLayerMode) {
      if (!this.draft) return
      this.mutate(asset => addMotionLayer(asset, name, mode))
      this.activeLayerId = this.draft.layers.at(-1)?.id || 'base'
    },
    updateLayer(layerId: string, patch: Parameters<typeof updateMotionLayer>[2]) { if (this.draft) this.mutate(asset => normalizeMotionAsset(updateMotionLayer(asset, layerId, patch)).asset) },
    deleteLayer(layerId: string) { if (this.draft && layerId !== 'base') { this.mutate(asset => normalizeMotionAsset(removeMotionLayer(asset, layerId)).asset); this.activeLayerId = 'base' } },
    assignSelectedChannelToLayer(layerId: string) { if (this.draft) { this.mutate(asset => normalizeMotionAsset(assignTrackToLayer(asset, this.selectedChannelId, layerId)).asset); this.activeLayerId = layerId } },
    updateInterruptionPolicy(patch: Partial<MotionInterruptionPolicy>) { if (this.draft) this.mutate(asset => normalizeMotionAsset({ ...asset, interruptionPolicy: { ...asset.interruptionPolicy, ...patch }, updatedAt: Date.now() }).asset) },
    applyFrontPawIk(side: 'left' | 'right', targetX: number, targetY: number) {
      if (!this.draft) return
      this.snapshot()
      const ik = solveTwoBoneIk2D(targetX, targetY, .65, .55)
      let asset = writeMotionChannelValue(this.draft, `frontPaw.${side}.rotation.z` as CloudFoxRigChannelId, this.playheadTimeMs, side === 'left' ? ik.upperAngle : -ik.upperAngle, 'smooth', { snapToFrames: this.snapToFrames, displayFps: this.draft.displayFps, layerId: this.activeLayerId }).asset
      asset = writeMotionChannelValue(asset, `frontPaw.${side}.tip.rotation.x` as CloudFoxRigChannelId, this.playheadTimeMs, ik.lowerAngle, 'smooth', { snapToFrames: this.snapToFrames, displayFps: this.draft.displayFps, layerId: this.activeLayerId }).asset
      this.apply(asset)
    },
    addAudioCue(cue: Omit<MotionAudioCue, 'id' | 'timeMs'>) {
      if (!this.draft) return
      const item: MotionAudioCue = { ...cue, id: `audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`, timeMs: Math.round(this.playheadTimeMs) }
      this.mutate(asset => normalizeMotionAsset({ ...asset, audioCues: [...asset.audioCues, item], updatedAt: Date.now() }).asset)
    },
    removeAudioCue(id: string) { if (this.draft) this.mutate(asset => normalizeMotionAsset({ ...asset, audioCues: asset.audioCues.filter(cue => cue.id !== id), updatedAt: Date.now() }).asset) },
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
