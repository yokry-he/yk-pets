/*
 * 文件职责 / File responsibility
 * 管理动作工坊的独立草稿、播放指针、关键帧选择、剪贴板和事务式撤销重做，不直接持久化资产。
 * Manages Motion Studio drafts, playhead, keyframe selection, clipboard, and transactional undo/redo without directly persisting assets.
 */
import {
  addMotionLayer,
  applyDirectMotionPoseCard,
  applyMotionPosePreset,
  assignTrackToLayer,
  compileSimpleMotionRecipe,
  copyMotionKeyframes,
  duplicateMotionAssetForDraft,
  insertMotionPropEvent,
  mirrorMotionAsset,
  moveMotionKeyframes,
  nudgeMotionControls,
  nudgeMotionControlValue,
  normalizeMotionAsset,
  normalizeSimpleMotionRecipe,
  normalizeBipedPetMotionAdaptation,
  normalizeBipedPetRootMotion,
  readMotionControlValue,
  readSimpleMotionRecipe,
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
  SIMPLE_MOTION_CORRECTION_LAYER_ID,
  SIMPLE_MOTION_STAGE_LIMIT,
  getMotionBodyPartControls,
  getMotionBodyPartModes,
  getMotionControl,
  getDirectMotionCapability,
  solveDirectMotionDrag,
  updateMotionLayer,
  writeMotionChannelValue,
  type CloudFoxRigChannelId,
  type MotionClipboardEntry,
  type MotionAudioCue,
  type MotionAuthoringScope,
  type MotionBodyPartId,
  type MotionControlId,
  type MotionTransformMode,
  type DirectMotionMode,
  type SimpleMotionEffect,
  type SimpleMotionRecipeV1,
  type SimpleMotionStage,
  type SimpleMotionTransition,
  type MotionInterruptionPolicy,
  type MotionInterpolation,
  type MotionLayerMode,
  type MotionPosePresetId,
  type MotionPropEvent,
  type MotionPropMountId,
  type StudioMotionAssetV2,
  type BipedPetMotionVfxTag,
  type BipedPetMotionAdaptationDefinition,
  type BipedPetRootMotionDefinition,
  type BipedPetRootMotionMode,
} from '@yk-pets/pet-core'
import { defineStore } from 'pinia'
import { BUILT_IN_STUDIO_MOTIONS } from '../domain/studio-built-in-motions'

interface DirectManipulationSession {
  active: boolean
  pointerId: number | null
  startX: number
  startY: number
  baselinePose: Readonly<Partial<Record<MotionControlId, number>>>
  status: 'ready' | 'clamped' | 'blocked'
  diagnostics: readonly string[]
  latestChanged: boolean
}

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
  playbackRequestedTimeMs: number
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
  directManipulationMode: DirectMotionMode
  directManipulation: DirectManipulationSession
  exactParametersExpanded: boolean
  partInspectorOpen: boolean
  selectedControlId: MotionControlId
  symmetryEnabled: boolean
  controlGestureBaseline: string
  selectedStageId: string
  authoringMode: 'guided' | 'advanced'
  saveState: 'saved' | 'saving' | 'failed'
}

const DEFAULT_CHANNEL: CloudFoxRigChannelId = 'root.position.y'
const BIPED_MOTION_EXTENSION_KEY = 'yk-pets/biped-motion/v1'
const BIPED_MOTION_ADAPTATION_EXTENSION_KEY = 'yk-pets/biped-motion-adaptation/v1'
const DEFAULT_TRAVEL_DISTANCE = .42
const serialize = (asset: StudioMotionAssetV2 | null) => asset ? JSON.stringify(asset) : ''
const parse = (value: string) => value ? normalizeMotionAsset(JSON.parse(value)).asset : null

function createDirectManipulationSession(overrides: Partial<DirectManipulationSession> = {}): DirectManipulationSession {
  return {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    baselinePose: Object.freeze({}),
    status: 'ready',
    diagnostics: Object.freeze([]),
    latestChanged: false,
    ...overrides,
  }
}

function simpleStageStart(recipe: SimpleMotionRecipeV1, stageId: string): number {
  let cursor = 0
  for (const stage of recipe.stages) {
    if (stage.id === stageId) return cursor
    cursor += stage.durationMs
  }
  return 0
}

type RootMotionSettingsPatch = {
  mode?: BipedPetRootMotionMode
  autoVfx?: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
  catch { return undefined }
}

function rootMotionSource(asset: StudioMotionAssetV2 | null | undefined): unknown {
  try {
    const extensions = record(asset?.extensions)
    return record(extensions?.[BIPED_MOTION_EXTENSION_KEY])?.rootMotion
  }
  catch { return undefined }
}

function bipedMotionNamespace(asset: StudioMotionAssetV2 | null | undefined): Record<string, unknown> | undefined {
  try { return record(record(asset?.extensions)?.[BIPED_MOTION_EXTENSION_KEY]) }
  catch { return undefined }
}

function motionAdaptationSource(asset: StudioMotionAssetV2 | null | undefined): unknown {
  try { return record(asset?.extensions)?.[BIPED_MOTION_ADAPTATION_EXTENSION_KEY] }
  catch { return undefined }
}

function hasAuthoredMotionAdaptation(asset: StudioMotionAssetV2 | null | undefined): boolean {
  try {
    const extensions = record(asset?.extensions)
    return Boolean(extensions && Object.hasOwn(extensions, BIPED_MOTION_ADAPTATION_EXTENSION_KEY))
  }
  catch { return false }
}

function normalizedMotionAdaptation(asset: StudioMotionAssetV2): BipedPetMotionAdaptationDefinition {
  return normalizeBipedPetMotionAdaptation(motionAdaptationSource(asset), asset.durationMs).value
}

function scaleMotionAdaptationRecommendation(
  adaptation: BipedPetMotionAdaptationDefinition,
  sourceDurationMs: number,
  targetDurationMs: number,
): BipedPetMotionAdaptationDefinition {
  const durationScale = targetDurationMs / sourceDurationMs
  return normalizeBipedPetMotionAdaptation({
    ...adaptation,
    phases: adaptation.phases.map(phase => ({
      ...phase,
      startMs: Math.round(phase.startMs * durationScale),
      endMs: Math.round(phase.endMs * durationScale),
    })),
    warpWindows: adaptation.warpWindows.map(window => ({ ...window })),
    constraints: adaptation.constraints.map(constraint => ({ ...constraint })),
    effectCues: adaptation.effectCues.map(cue => ({ ...cue, pointIds: [...cue.pointIds] })),
  }, targetDurationMs).value
}

function adaptationRecommendationFor(asset: StudioMotionAssetV2, baseline: string): BipedPetMotionAdaptationDefinition | undefined {
  const baselineAsset = parse(baseline)
  // 打开时的草稿是用户当前动作的权威推荐来源；只有它缺少适配时才读取显式模板来源。 / The opening baseline is authoritative; explicit template provenance is consulted only when it lacks adaptation.
  if (baselineAsset && hasAuthoredMotionAdaptation(baselineAsset)) {
    return scaleMotionAdaptationRecommendation(
      normalizedMotionAdaptation(baselineAsset),
      baselineAsset.durationMs,
      asset.durationMs,
    )
  }
  const declaredSourceId = bipedMotionNamespace(asset)?.sourceMotionId ?? bipedMotionNamespace(baselineAsset)?.sourceMotionId
  if (typeof declaredSourceId !== 'string' || !declaredSourceId) return undefined
  const source = BUILT_IN_STUDIO_MOTIONS.find(item => item.id === declaredSourceId)
  if (!source || !hasAuthoredMotionAdaptation(source)) return undefined
  return scaleMotionAdaptationRecommendation(normalizedMotionAdaptation(source), source.durationMs, asset.durationMs)
}

function hasAuthoredRootMotion(asset: StudioMotionAssetV2 | null | undefined): boolean {
  const namespace = bipedMotionNamespace(asset)
  return Boolean(namespace && Object.hasOwn(namespace, 'rootMotion'))
}

function normalizedRootMotion(asset: StudioMotionAssetV2): BipedPetRootMotionDefinition {
  return normalizeBipedPetRootMotion(rootMotionSource(asset), asset.durationMs).value
}

function scaleRootMotionRecommendation(rootMotion: BipedPetRootMotionDefinition, sourceDurationMs: number, targetDurationMs: number): BipedPetRootMotionDefinition {
  const durationScale = targetDurationMs / sourceDurationMs
  return normalizeBipedPetRootMotion({
    ...rootMotion,
    windows: rootMotion.windows.map(window => ({
      ...window,
      startMs: Math.round(window.startMs * durationScale),
      endMs: Math.round(window.endMs * durationScale),
    })),
  }, targetDurationMs).value
}

function builtInRecommendation(asset: StudioMotionAssetV2, baselineAsset?: StudioMotionAssetV2 | null): BipedPetRootMotionDefinition | undefined {
  const declaredSourceId = bipedMotionNamespace(asset)?.sourceMotionId ?? bipedMotionNamespace(baselineAsset)?.sourceMotionId
  const source = BUILT_IN_STUDIO_MOTIONS.find(item => item.id === asset.id || item.id === declaredSourceId)
  if (!source) return undefined
  const sourceRootMotion = normalizeBipedPetRootMotion(rootMotionSource(source), source.durationMs).value
  return scaleRootMotionRecommendation(sourceRootMotion, source.durationMs, asset.durationMs)
}

function genericTravelRecommendation(asset: StudioMotionAssetV2): BipedPetRootMotionDefinition {
  return normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: DEFAULT_TRAVEL_DISTANCE,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [{ id: 'recommended-travel', kind: 'travel', startMs: 0, endMs: asset.durationMs, weight: 1 }],
    vfxTags: ['speed-trail'],
  }, asset.durationMs).value
}

function semanticVfxTags(rootMotion: BipedPetRootMotionDefinition): BipedPetMotionVfxTag[] {
  if (rootMotion.mode !== 'travel') return []
  const tags = new Set<BipedPetMotionVfxTag>()
  const hasHorizontalTravel = Math.abs(rootMotion.distance) > 1e-12
    && rootMotion.windows.some(window => window.kind === 'travel' || window.kind === 'warp')
  if (hasHorizontalTravel) tags.add('speed-trail')
  if (rootMotion.verticalMode === 'ballistic' && rootMotion.jumpHeight > 0
    && rootMotion.windows.some(window => window.kind === 'ballistic')) {
    tags.add('landing-ring')
    tags.add('landing-dust')
  }
  if (hasHorizontalTravel && rootMotion.windows.some(window => window.kind === 'brake')) tags.add('brake-sparks')
  return [...tags].sort()
}

function recommendationFor(asset: StudioMotionAssetV2, baseline: string): BipedPetRootMotionDefinition {
  const baselineAsset = parse(baseline)
  // 已保存的 Root Motion 是用户自己的推荐来源，必须优先于模板来源。 / Saved Root Motion is the user's recommendation and must precede template provenance.
  if (baselineAsset && hasAuthoredRootMotion(baselineAsset)) {
    return scaleRootMotionRecommendation(normalizedRootMotion(baselineAsset), baselineAsset.durationMs, asset.durationMs)
  }
  const builtIn = builtInRecommendation(asset, baselineAsset)
  if (builtIn) return builtIn
  if (baselineAsset) return normalizedRootMotion(baselineAsset)
  return normalizedRootMotion(asset)
}

function writeRootMotion(asset: StudioMotionAssetV2, rootMotion: BipedPetRootMotionDefinition): StudioMotionAssetV2 {
  const extensions = { ...(record(asset.extensions) ?? {}) }
  const namespace = { ...(record(extensions[BIPED_MOTION_EXTENSION_KEY]) ?? {}) }
  namespace.rootMotion = rootMotion
  extensions[BIPED_MOTION_EXTENSION_KEY] = namespace
  return normalizeMotionAsset({ ...asset, extensions, updatedAt: Date.now() }).asset
}

function writeMotionAdaptation(asset: StudioMotionAssetV2, adaptation: BipedPetMotionAdaptationDefinition): StudioMotionAssetV2 {
  const extensions = { ...(record(asset.extensions) ?? {}) }
  extensions[BIPED_MOTION_ADAPTATION_EXTENSION_KEY] = adaptation
  return normalizeMotionAsset({ ...asset, extensions, updatedAt: Date.now() }).asset
}

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
    playbackRequestedTimeMs: 0,
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
    directManipulationMode: 'translate',
    directManipulation: createDirectManipulationSession(),
    exactParametersExpanded: false,
    partInspectorOpen: false,
    selectedControlId: 'root.translate.y',
    symmetryEnabled: false,
    controlGestureBaseline: '',
    selectedStageId: '',
    authoringMode: 'guided',
    saveState: 'saved',
  }),
  getters: {
    isDirty: state => Boolean(state.draft) && serialize(state.draft) !== state.baseline,
    canUndo: state => state.undoStack.length > 0,
    canRedo: state => state.redoStack.length > 0,
    selectedKeyframeCount: state => state.selectedKeyframeIds.length,
    canRestoreMotionAdaptation: state => Boolean(state.draft && adaptationRecommendationFor(state.draft, state.baseline)),
    simpleRecipe: state => state.draft ? readSimpleMotionRecipe(state.draft) : undefined,
    selectedSimpleStage: (state): SimpleMotionStage | undefined => {
      const recipe = state.draft ? readSimpleMotionRecipe(state.draft) : undefined
      return recipe?.stages.find(stage => stage.id === state.selectedStageId)
    },
  },
  actions: {
    open(asset: StudioMotionAssetV2) {
      this.cancelDirectManipulation()
      if (this.motionId === asset.id && this.draft) return
      this.motionId = asset.id
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = 0
      this.playbackRequestedTimeMs = 0
      this.playbackOriginTimeMs = 0
      this.playbackStartedAt = 0
      this.playing = false
      this.lastDiagnostics = []
      this.selectedPropEventIds = []
      this.activeLayerId = this.draft.layers[0]?.id || 'base'
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
      const recipe = readSimpleMotionRecipe(this.draft)
      this.selectedStageId = recipe?.stages[0]?.id || ''
      this.authoringMode = recipe ? 'guided' : 'advanced'
      this.saveState = 'saved'
    },
    replaceFromSaved(asset: StudioMotionAssetV2) {
      // 必须先恢复旧草稿的手势基线，避免替换后把旧资产覆盖到新动作。 / Restore the old gesture baseline before replacing the draft so it cannot overwrite the new motion.
      this.cancelDirectManipulation()
      const previousStageId = this.selectedStageId
      this.motionId = asset.id
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = Math.min(this.playheadTimeMs, asset.durationMs)
      this.playbackRequestedTimeMs = this.playheadTimeMs
      this.playbackOriginTimeMs = this.playheadTimeMs
      this.playbackStartedAt = 0
      this.playing = false
      this.activeLayerId = this.draft.layers[0]?.id || 'base'
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
      const recipe = readSimpleMotionRecipe(this.draft)
      this.selectedStageId = recipe?.stages.some(stage => stage.id === previousStageId)
        ? previousStageId
        : recipe?.stages[0]?.id || ''
      if (!recipe) this.authoringMode = 'advanced'
      this.saveState = 'saved'
    },
    close() {
      this.cancelDirectManipulation()
      this.motionId = ''
      this.draft = null
      this.baseline = ''
      this.undoStack = []
      this.redoStack = []
      this.selectedKeyframeIds = []
      this.playheadTimeMs = 0
      this.playbackRequestedTimeMs = 0
      this.playbackOriginTimeMs = 0
      this.playbackStartedAt = 0
      this.playing = false
      this.selectedPropEventIds = []
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
      this.controlGestureBaseline = ''
      this.selectedStageId = ''
      this.authoringMode = 'guided'
      this.saveState = 'saved'
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
      this.syncSimpleAuthoringState()
    },
    mutate(mutator: (asset: StudioMotionAssetV2) => StudioMotionAssetV2, selectedKeyframeIds?: string[]) {
      if (!this.draft) return
      this.snapshot()
      this.apply(mutator(this.draft), selectedKeyframeIds)
    },
    undo() {
      this.cancelDirectManipulation()
      const previous = this.undoStack.pop()
      if (!previous || !this.draft) return
      this.redoStack.push(serialize(this.draft))
      this.draft = parse(previous)
      this.selectedKeyframeIds = []
      this.playing = false
      this.syncSimpleAuthoringState()
    },
    redo() {
      this.cancelDirectManipulation()
      const next = this.redoStack.pop()
      if (!next || !this.draft) return
      this.undoStack.push(serialize(this.draft))
      this.draft = parse(next)
      this.selectedKeyframeIds = []
      this.playing = false
      this.syncSimpleAuthoringState()
    },
    syncSimpleAuthoringState() {
      const recipe = this.draft ? readSimpleMotionRecipe(this.draft) : undefined
      if (!recipe) {
        this.selectedStageId = ''
        this.authoringMode = 'advanced'
        return
      }
      if (!recipe.stages.some(stage => stage.id === this.selectedStageId)) {
        this.selectedStageId = recipe.stages[0]?.id || ''
      }
    },
    setSaveState(state: MotionEditorState['saveState']) {
      this.saveState = state
    },
    setAuthoringMode(mode: MotionEditorState['authoringMode']) {
      this.cancelDirectManipulation()
      if (mode === 'guided' && (!this.draft || !readSimpleMotionRecipe(this.draft))) return
      this.authoringMode = mode
      this.activeLayerId = mode === 'guided'
        ? 'base'
        : this.draft?.layers.some(layer => layer.id === SIMPLE_MOTION_CORRECTION_LAYER_ID)
          ? SIMPLE_MOTION_CORRECTION_LAYER_ID
          : 'base'
    },
    selectSimpleStage(stageId: string) {
      this.cancelDirectManipulation()
      if (!this.draft) return false
      const recipe = readSimpleMotionRecipe(this.draft)
      if (!recipe?.stages.some(stage => stage.id === stageId)) return false
      this.selectedStageId = stageId
      this.playing = false
      this.setPlayhead(simpleStageStart(recipe, stageId), false)
      return true
    },
    updateSimpleRecipe(mutator: (recipe: SimpleMotionRecipeV1) => SimpleMotionRecipeV1) {
      if (!this.draft) return false
      const current = readSimpleMotionRecipe(this.draft)
      if (!current) return false
      const nextInput = mutator(structuredClone(current))
      const nextRecipe = normalizeSimpleMotionRecipe(nextInput).value
      const compiled = compileSimpleMotionRecipe(this.draft, nextRecipe, { now: Date.now() })
      this.snapshot()
      this.apply(compiled.asset)
      this.selectedStageId = nextRecipe.stages.some(stage => stage.id === this.selectedStageId)
        ? this.selectedStageId
        : nextRecipe.stages[0]?.id || ''
      return true
    },
    updateSimpleStage(stageId: string, patch: Partial<Omit<SimpleMotionStage, 'id'>>) {
      return this.updateSimpleRecipe(recipe => ({
        ...recipe,
        stages: recipe.stages.map(stage => stage.id === stageId
          ? {
              ...stage,
              ...patch,
              pose: patch.pose ? { ...patch.pose } : stage.pose,
              effects: patch.effects ? [...patch.effects] : stage.effects,
            }
          : stage),
      }))
    },
    duplicateSimpleStage(stageId: string) {
      const recipe = this.draft ? readSimpleMotionRecipe(this.draft) : undefined
      const sourceIndex = recipe?.stages.findIndex(stage => stage.id === stageId) ?? -1
      if (!recipe || sourceIndex < 0 || recipe.stages.length >= SIMPLE_MOTION_STAGE_LIMIT) return false
      const source = recipe.stages[sourceIndex]!
      const duplicateId = `stage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const updated = this.updateSimpleRecipe(current => {
        const stages = [...current.stages]
        stages.splice(sourceIndex + 1, 0, {
          ...source,
          id: duplicateId,
          labelZh: `${source.labelZh} 副本`,
          pose: { ...source.pose },
          effects: [...source.effects],
        })
        return { ...current, stages }
      })
      if (updated) this.selectSimpleStage(duplicateId)
      return updated
    },
    moveSimpleStage(stageId: string, offset: -1 | 1) {
      const recipe = this.draft ? readSimpleMotionRecipe(this.draft) : undefined
      const sourceIndex = recipe?.stages.findIndex(stage => stage.id === stageId) ?? -1
      const targetIndex = sourceIndex + offset
      if (!recipe || sourceIndex < 0 || targetIndex < 0 || targetIndex >= recipe.stages.length) return false
      const updated = this.updateSimpleRecipe(current => {
        const stages = [...current.stages]
        const [stage] = stages.splice(sourceIndex, 1)
        if (stage) stages.splice(targetIndex, 0, stage)
        return { ...current, stages }
      })
      if (updated) this.selectSimpleStage(stageId)
      return updated
    },
    removeSimpleStage(stageId: string) {
      const recipe = this.draft ? readSimpleMotionRecipe(this.draft) : undefined
      const sourceIndex = recipe?.stages.findIndex(stage => stage.id === stageId) ?? -1
      if (!recipe || sourceIndex < 0 || recipe.stages.length <= 2) return false
      const nextStageId = recipe.stages[sourceIndex + 1]?.id || recipe.stages[sourceIndex - 1]?.id || ''
      const updated = this.updateSimpleRecipe(current => ({
        ...current,
        stages: current.stages.filter(stage => stage.id !== stageId),
      }))
      if (updated && nextStageId) this.selectSimpleStage(nextStageId)
      return updated
    },
    updateSelectedSimpleStage(patch: Partial<Omit<SimpleMotionStage, 'id'>>) {
      return this.selectedStageId ? this.updateSimpleStage(this.selectedStageId, patch) : false
    },
    setSelectedSimpleStageEffects(effects: SimpleMotionEffect[]) {
      return this.updateSelectedSimpleStage({ effects })
    },
    setSelectedSimpleStageTransition(transition: SimpleMotionTransition) {
      return this.updateSelectedSimpleStage({ transition })
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
    setPlayhead(timeMs: number, snap?: boolean, now = performance.now()) {
      if (!this.draft) return
      const raw = Math.max(0, Math.min(this.draft.durationMs, Math.round(Number.isFinite(timeMs) ? timeMs : 0)))
      const shouldSnap = snap ?? this.snapToFrames
      if (!shouldSnap) this.playheadTimeMs = raw
      else {
        const frameMs = 1000 / this.draft.displayFps
        this.playheadTimeMs = Math.max(0, Math.min(this.draft.durationMs, Math.round(Math.round(raw / frameMs) * frameMs)))
      }
      // 用户拖动时间轴属于显式定位：显示时间与运行时请求时间在此对齐；若正在播放，则从新位置重建墙钟原点。 / Scrubbing explicitly realigns display/runtime time and rebases the playback clock.
      this.playbackRequestedTimeMs = this.playheadTimeMs
      this.playbackOriginTimeMs = this.playbackRequestedTimeMs
      this.playbackStartedAt = now
      this.playbackDirection = resolveMotionTime(this.playbackRequestedTimeMs, this.draft.durationMs, this.draft.loopMode).direction
    },
    startPlayback(now = performance.now()) {
      if (!this.draft) return
      this.playing = true
      this.playbackWeight = 1
      this.interruptionPending = false
      // 暂停后恢复必须沿用未解析的单调时间，不能从 loop/ping-pong 的显示 playhead 重新起算。 / Resume from monotonic requested time, not the resolved loop/ping-pong playhead.
      this.playbackOriginTimeMs = this.playbackRequestedTimeMs
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
      this.playbackRequestedTimeMs = 0
      this.playbackOriginTimeMs = 0
      this.playbackStartedAt = 0
      this.playbackWeight = 1
      this.interruptionPending = false
      this.playbackDirection = 1
    },
    togglePlayback(now = performance.now()) {
      if (this.playing) this.pausePlayback(now)
      else this.startPlayback(now)
    },
    advancePlayback(now = performance.now()) {
      if (!this.playing || !this.draft) return
      const requested = this.playbackOriginTimeMs + Math.max(0, now - this.playbackStartedAt)
      const resolved = resolveMotionTime(requested, this.draft.durationMs, this.draft.loopMode)
      // Renderer 消费单调 requested；编辑器和时间轴只消费 resolved playhead。 / Renderer consumes monotonic requested time while editor UI consumes the resolved playhead.
      this.playbackRequestedTimeMs = requested
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
      this.cancelDirectManipulation()
      this.selectedBodyPartId = partId
      const capability = getDirectMotionCapability(partId)
      if (capability) {
        const mode = capability.modes.includes(this.directManipulationMode)
          ? this.directManipulationMode
          : capability.modes.includes('translate')
            ? 'translate'
            : capability.modes.includes('rotate')
              ? 'rotate'
              : undefined
        if (mode) {
          this.directManipulationMode = mode
          this.transformMode = mode
        }
      }
      const modes = getMotionBodyPartModes(partId)
      if (!modes.includes(this.transformMode)) this.transformMode = modes[0] || 'rotate'
      const first = getMotionBodyPartControls(partId, this.transformMode)[0]
      if (first) this.selectControl(first.id as MotionControlId)
    },
    setAuthoringScope(scope: MotionAuthoringScope) {
      this.authoringScope = scope
    },
    setTransformMode(mode: MotionTransformMode) {
      this.cancelDirectManipulation()
      const controls = getMotionBodyPartControls(this.selectedBodyPartId, mode)
      if (!controls.length) return
      this.transformMode = mode
      this.selectControl(controls[0]!.id as MotionControlId)
    },
    selectControl(controlId: MotionControlId) {
      this.cancelDirectManipulation()
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
      if (this.authoringMode === 'guided' && this.selectedStageId) {
        const stage = readSimpleMotionRecipe(this.draft)?.stages.find(item => item.id === this.selectedStageId)
        if (!stage) return
        this.updateSimpleStage(stage.id, { pose: { ...stage.pose, [controlId]: value } })
        this.selectControl(controlId)
        return
      }
      this.snapshot()
      const result = setMotionControlValue(this.draft, controlId, value, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
      this.selectControl(controlId)
    },
    nudgeControl(controlId: MotionControlId, delta: number) {
      if (!this.draft || (this.authoringScope === 'selected-keyframes' && !this.selectedKeyframeIds.length)) return
      if (this.authoringMode === 'guided' && this.selectedStageId) {
        const stage = readSimpleMotionRecipe(this.draft)?.stages.find(item => item.id === this.selectedStageId)
        if (!stage) return
        this.updateSimpleStage(stage.id, { pose: { ...stage.pose, [controlId]: (stage.pose[controlId] ?? 0) + delta } })
        this.selectControl(controlId)
        return
      }
      this.snapshot()
      const result = nudgeMotionControlValue(this.draft, controlId, delta, this.controlOptions())
      this.apply(result.asset, result.selectedKeyframeIds)
      this.selectControl(controlId)
    },
    resetControl(controlId?: MotionControlId) {
      const targetControlId = controlId ?? this.selectedControlId
      if (!this.draft || (this.authoringScope === 'selected-keyframes' && !this.selectedKeyframeIds.length)) return
      if (this.authoringMode === 'guided' && this.selectedStageId) {
        const stage = readSimpleMotionRecipe(this.draft)?.stages.find(item => item.id === this.selectedStageId)
        if (!stage) return
        const pose = { ...stage.pose }
        delete pose[targetControlId]
        this.updateSimpleStage(stage.id, { pose })
        return
      }
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
      if (!this.draft || this.controlGestureBaseline) return false
      this.controlGestureBaseline = serialize(this.draft)
      this.snapshot()
      return true
    },
    previewControlGesture(edits: readonly { controlId: MotionControlId; delta: number }[]) {
      if (!this.draft || !this.controlGestureBaseline) return
      const baseline = parse(this.controlGestureBaseline)
      if (!baseline) return
      if (this.authoringMode === 'guided' && this.selectedStageId) {
        const recipe = readSimpleMotionRecipe(baseline)
        const stage = recipe?.stages.find(item => item.id === this.selectedStageId)
        if (!recipe || !stage) return
        const pose = { ...stage.pose }
        for (const edit of edits) pose[edit.controlId] = (pose[edit.controlId] ?? 0) + edit.delta
        const nextRecipe = {
          ...recipe,
          stages: recipe.stages.map(item => item.id === stage.id ? { ...item, pose } : item),
        }
        this.apply(compileSimpleMotionRecipe(baseline, nextRecipe, { now: Date.now() }).asset)
        return
      }
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
      this.syncSimpleAuthoringState()
    },

    setDirectManipulationMode(mode: DirectMotionMode) {
      this.cancelDirectManipulation()
      const capability = getDirectMotionCapability(this.selectedBodyPartId)
      if (!capability?.modes.includes(mode)) return false
      this.directManipulationMode = mode
      // 旧控件继续消费 transformMode；简单直接操控本身只接受 translate/rotate。 / Legacy controls keep consuming transformMode while simple direct manipulation only accepts translate/rotate.
      this.transformMode = mode
      const first = getMotionBodyPartControls(this.selectedBodyPartId, mode)[0]
      if (first) this.selectControl(first.id as MotionControlId)
      return true
    },
    beginDirectManipulation(pointerId: number, x: number, y: number) {
      if (this.authoringMode !== 'guided' || !this.draft || !this.selectedStageId || this.directManipulation.active) return false
      const recipe = readSimpleMotionRecipe(this.draft)
      const stage = recipe?.stages.find(item => item.id === this.selectedStageId)
      const capability = getDirectMotionCapability(this.selectedBodyPartId)
      if (!stage || !capability?.modes.includes(this.directManipulationMode)) return false
      if (!this.beginControlGesture()) return false
      const baseline = parse(this.controlGestureBaseline)
      const baselineStage = baseline
        ? readSimpleMotionRecipe(baseline)?.stages.find(item => item.id === this.selectedStageId)
        : undefined
      if (!baselineStage) {
        this.cancelControlGesture()
        return false
      }
      this.directManipulation = createDirectManipulationSession({
        active: true,
        pointerId,
        startX: x,
        startY: y,
        baselinePose: Object.freeze({ ...baselineStage.pose }),
      })
      return true
    },
    previewDirectManipulation(
      pointerId: number,
      x: number,
      y: number,
      viewport: Readonly<{ width: number, height: number }>,
      depth = 0,
    ) {
      const session = this.directManipulation
      if (!session.active || session.pointerId !== pointerId || !this.draft || !this.controlGestureBaseline) return false
      const baseline = parse(this.controlGestureBaseline)
      const baselineRecipe = baseline ? readSimpleMotionRecipe(baseline) : undefined
      const baselineStage = baselineRecipe?.stages.find(item => item.id === this.selectedStageId)
      if (!baseline || !baselineRecipe || !baselineStage) return false
      const result = solveDirectMotionDrag({
        partId: this.selectedBodyPartId,
        mode: this.directManipulationMode,
        delta: { x: x - session.startX, y: y - session.startY, depth },
        viewport,
        pose: session.baselinePose,
        intensity: baselineStage.intensity,
      })
      const diagnostics = result.status === 'clamped'
        ? [...result.diagnostics, '直接拖拽已限制在安全范围。']
        : [...result.diagnostics]
      const latestChanged = result.status !== 'blocked' && result.changed
      this.directManipulation = {
        ...session,
        status: result.status,
        diagnostics: Object.freeze(diagnostics),
        latestChanged,
      }
      if (!latestChanged) return false
      const nextRecipe: SimpleMotionRecipeV1 = {
        ...baselineRecipe,
        stages: baselineRecipe.stages.map(item => item.id === baselineStage.id
          ? { ...item, pose: { ...result.pose } }
          : item),
      }
      this.apply(compileSimpleMotionRecipe(baseline, nextRecipe, { now: Date.now() }).asset)
      return true
    },
    commitDirectManipulation(pointerId: number) {
      if (!this.directManipulation.active || this.directManipulation.pointerId !== pointerId) return false
      const latestChanged = this.directManipulation.latestChanged
      this.directManipulation = { ...this.directManipulation, active: false, pointerId: null }
      if (latestChanged) this.endControlGesture()
      else this.cancelControlGesture()
      return true
    },
    cancelDirectManipulation() {
      const wasActive = this.directManipulation.active
      if (wasActive) this.cancelControlGesture()
      this.directManipulation = createDirectManipulationSession()
      return wasActive
    },
    applyDirectPoseCard(cardId: string) {
      this.cancelDirectManipulation()
      if (this.authoringMode !== 'guided' || !this.draft || !this.selectedStageId) return false
      const stage = readSimpleMotionRecipe(this.draft)?.stages.find(item => item.id === this.selectedStageId)
      if (!stage) return false
      const result = applyDirectMotionPoseCard(stage.pose, cardId)
      this.directManipulation = createDirectManipulationSession({
        status: result.status,
        diagnostics: Object.freeze([...result.diagnostics]),
      })
      if (result.status === 'blocked' || !result.changed) return false
      return this.updateSimpleStage(stage.id, { pose: { ...result.pose } })
    },
    resetSelectedDirectPart() {
      this.cancelDirectManipulation()
      if (this.authoringMode !== 'guided' || !this.draft || !this.selectedStageId) return false
      const capability = getDirectMotionCapability(this.selectedBodyPartId)
      const stage = readSimpleMotionRecipe(this.draft)?.stages.find(item => item.id === this.selectedStageId)
      if (!capability || !stage) return false
      const pose = { ...stage.pose }
      let changed = false
      for (const controlId of capability.controlIds) {
        if (!Object.hasOwn(pose, controlId)) continue
        delete pose[controlId]
        changed = true
      }
      return changed ? this.updateSimpleStage(stage.id, { pose }) : false
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
    updateRootMotionSettings(patch: RootMotionSettingsPatch) {
      if (!this.draft || (patch.mode === undefined && patch.autoVfx === undefined)) return
      const current = normalizedRootMotion(this.draft)
      const recommended = recommendationFor(this.draft, this.baseline)
      let next = current
      if (patch.mode === 'in-place') {
        next = normalizeBipedPetRootMotion({
          ...current,
          mode: 'in-place',
          distance: 0,
          turnRadians: 0,
          verticalMode: 'grounded',
          jumpHeight: 0,
        }, this.draft.durationMs).value
      }
      else if (patch.mode === 'travel') {
        const travelSource = current.mode === 'travel'
          ? current
          : recommended.mode === 'travel'
            ? recommended
            : genericTravelRecommendation(this.draft)
        next = normalizeBipedPetRootMotion({ ...travelSource, mode: 'travel', vfxTags: current.vfxTags }, this.draft.durationMs).value
      }
      if (patch.autoVfx !== undefined) {
        const vfxSource = next.mode === 'travel' ? next : recommended
        next = normalizeBipedPetRootMotion({
          ...next,
          vfxTags: patch.autoVfx ? semanticVfxTags(vfxSource) : [],
        }, this.draft.durationMs).value
      }
      if (JSON.stringify(current) === JSON.stringify(next)) return
      this.mutate(asset => writeRootMotion(asset, next))
    },
    restoreRootMotionRecommendations() {
      if (!this.draft) return
      const current = normalizedRootMotion(this.draft)
      const recommended = recommendationFor(this.draft, this.baseline)
      if (JSON.stringify(current) === JSON.stringify(recommended)) return
      this.mutate(asset => writeRootMotion(asset, recommended))
    },
    restoreMotionAdaptationRecommendations() {
      if (!this.draft) return
      const recommended = adaptationRecommendationFor(this.draft, this.baseline)
      if (!recommended) return
      const current = hasAuthoredMotionAdaptation(this.draft) ? normalizedMotionAdaptation(this.draft) : undefined
      if (current && JSON.stringify(current) === JSON.stringify(recommended)) return
      this.mutate(asset => writeMotionAdaptation(asset, recommended))
    },
    markSaved(asset: StudioMotionAssetV2) {
      this.draft = duplicateMotionAssetForDraft(asset)
      this.baseline = serialize(this.draft)
      this.saveState = 'saved'
      this.syncSimpleAuthoringState()
    },
  },
})
