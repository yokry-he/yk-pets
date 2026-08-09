/**
 * 文件职责 / File responsibility
 * 将阶段式动作配方确定性编译为现有 StudioMotionAssetV2 轨道与运行时元数据。
 * Deterministically compiles staged-motion recipes into existing StudioMotionAssetV2 tracks and runtime metadata.
 */
import { getMotionControl, type MotionControlId } from './motion-controls'
import {
  normalizeMotionAsset,
  type MotionInterpolation,
  type MotionKeyframe,
  type MotionTrack,
  type StudioMotionAssetV2,
} from './motion-asset'
import {
  SIMPLE_MOTION_AUTHORING_EXTENSION_KEY,
  normalizeSimpleMotionRecipe,
  type SimpleMotionDiagnostic,
  type SimpleMotionEffect,
  type SimpleMotionRecipeV1,
  type SimpleMotionStage,
  type SimpleMotionTransition,
} from './simple-motion-authoring'

export const SIMPLE_MOTION_CORRECTION_LAYER_ID = 'simple-user-corrections' as const
const BIPED_MOTION_EXTENSION_KEY = 'yk-pets/biped-motion/v1'

export interface CompileSimpleMotionOptions {
  now?: number
}

export interface CompiledSimpleMotionStage {
  id: string
  startMs: number
  endMs: number
}

export interface CompileSimpleMotionResult {
  asset: StudioMotionAssetV2
  recipe: SimpleMotionRecipeV1
  stages: CompiledSimpleMotionStage[]
  diagnostics: SimpleMotionDiagnostic[]
}

const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const interpolationFor = (value: SimpleMotionTransition): MotionInterpolation => value === 'hold' ? 'step' : value === 'steady' ? 'linear' : value === 'snappy' ? 'bezier' : 'smooth'
const safeId = (value: string) => value.replace(/[^\p{L}\p{N}._-]+/gu, '-').replaceAll('.', '-').slice(0, 80)

function compileStageRanges(recipe: SimpleMotionRecipeV1): CompiledSimpleMotionStage[] {
  let cursor = 0
  return recipe.stages.map((stage) => {
    const startMs = cursor
    cursor += stage.durationMs
    return { id: stage.id, startMs, endMs: cursor }
  })
}

function stageChannelValues(stage: SimpleMotionStage): Map<string, number> {
  const values = new Map<string, number>()
  for (const controlId of Object.keys(stage.pose).sort() as MotionControlId[]) {
    const value = stage.pose[controlId]
    if (value === undefined) continue
    const control = getMotionControl(controlId)
    for (const channelId of control.channelIds) values.set(channelId, value * stage.intensity)
  }
  return values
}

function compileTracks(recipe: SimpleMotionRecipeV1, ranges: readonly CompiledSimpleMotionStage[]): MotionTrack[] {
  const channels = new Set<string>()
  const valuesByStage = recipe.stages.map((stage) => {
    const values = stageChannelValues(stage)
    for (const channelId of values.keys()) channels.add(channelId)
    return values
  })
  return [...channels].sort().map((channelId): MotionTrack => {
    const keyframes: MotionKeyframe[] = recipe.stages.map((stage, index) => {
      const timeMs = ranges[index]?.startMs ?? 0
      return {
        id: `simple-${safeId(stage.id)}-${safeId(channelId)}-${timeMs}`,
        timeMs,
        value: valuesByStage[index]?.get(channelId) ?? 0,
        interpolation: interpolationFor(stage.transition),
        ...(stage.transition === 'snappy' ? { inTangent: 0, outTangent: 0 } : {}),
      }
    })
    const finalStage = recipe.loopIntent === 'loop' ? recipe.stages[0]! : recipe.stages.at(-1)!
    const finalValues = recipe.loopIntent === 'loop' ? valuesByStage[0]! : valuesByStage.at(-1)!
    const durationMs = ranges.at(-1)?.endMs ?? 100
    keyframes.push({
      id: `simple-${safeId(finalStage.id)}-${safeId(channelId)}-${durationMs}`,
      timeMs: durationMs,
      value: finalValues.get(channelId) ?? 0,
      interpolation: interpolationFor(finalStage.transition),
      ...(finalStage.transition === 'snappy' ? { inTangent: 0, outTangent: 0 } : {}),
    })
    return {
      id: `simple-track-${safeId(channelId)}`,
      channelId: channelId as MotionTrack['channelId'],
      layerId: 'base',
      muted: false,
      keyframes,
    }
  })
}

function effectSet(recipe: SimpleMotionRecipeV1): Set<SimpleMotionEffect> {
  return recipe.automaticFeatures.effects
    ? new Set(recipe.stages.flatMap(stage => stage.effects))
    : new Set()
}

function compileRuntimeMetadata(recipe: SimpleMotionRecipeV1, ranges: readonly CompiledSimpleMotionStage[]) {
  const effects = effectSet(recipe)
  const landingIndex = recipe.stages.findIndex(stage => stage.effects.includes('landing-impact'))
  const launchIndex = landingIndex > 0 ? Math.max(0, recipe.stages.findIndex(stage => stage.id.includes('launch'))) : -1
  const ballistic = landingIndex > 0
  const airborneStart = ballistic ? ranges[launchIndex >= 0 ? launchIndex : Math.max(0, landingIndex - 1)]?.startMs ?? 0 : 0
  const landingStart = ballistic ? ranges[landingIndex]?.startMs ?? ranges.at(-1)?.startMs ?? 0 : 0
  const durationMs = ranges.at(-1)?.endMs ?? 100
  const vfxTags = [
    ...(effects.has('speed-trail') ? ['speed-trail'] as const : []),
    ...(effects.has('landing-impact') ? ['landing-dust', 'landing-ring'] as const : []),
  ].sort()
  const groundedRanges = ballistic
    ? [[0, airborneStart], [landingStart, durationMs]] as const
    : [[0, durationMs]] as const
  const contacts = recipe.automaticFeatures.footContact
    ? groundedRanges.flatMap(([startMs, endMs], rangeIndex) => endMs > startMs
      ? (['left', 'right'] as const).map(side => ({
          contactId: `foot.${side}`,
          startMs,
          endMs,
          confidence: ballistic ? .88 : .9,
          sourceId: `simple-contact-${rangeIndex}-${side}`,
        }))
      : [])
    : []
  const events = ballistic ? [
    { id: 'simple-takeoff', kind: 'takeoff', timeMs: airborneStart },
    { id: 'simple-landing', kind: 'landing', timeMs: landingStart },
  ] : []
  return {
    contacts,
    events,
    rootMotion: {
      mode: ballistic ? 'travel' : 'in-place',
      distance: 0,
      turnRadians: 0,
      verticalMode: ballistic ? 'ballistic' : 'grounded',
      jumpHeight: ballistic ? .28 : 0,
      windows: ballistic ? [{ id: 'simple-ballistic', kind: 'ballistic', startMs: airborneStart, endMs: landingStart, weight: 1 }] : [],
      vfxTags,
    },
    simpleEffects: [...effects].sort(),
  }
}

export function compileSimpleMotionRecipe(
  assetInput: StudioMotionAssetV2,
  recipeInput: unknown,
  options: CompileSimpleMotionOptions = {},
): CompileSimpleMotionResult {
  const source = normalizeMotionAsset(assetInput).asset
  const normalized = normalizeSimpleMotionRecipe(recipeInput)
  const recipe = normalized.value
  const stages = compileStageRanges(recipe)
  const durationMs = stages.at(-1)?.endMs ?? 100
  const generatedTracks = compileTracks(recipe, stages)
  const userTracks = source.tracks.filter(track => track.layerId !== 'base')
  const correctionLayer = source.layers.find(layer => layer.id === SIMPLE_MOTION_CORRECTION_LAYER_ID) ?? {
    id: SIMPLE_MOTION_CORRECTION_LAYER_ID,
    name: '手动修正',
    enabled: true,
    weight: 1,
    mode: 'additive' as const,
    priority: Math.max(1, ...source.layers.map(layer => layer.priority + 1)),
  }
  const layers = [
    ...source.layers.filter(layer => layer.id !== SIMPLE_MOTION_CORRECTION_LAYER_ID),
    correctionLayer,
  ]
  const extensions = { ...(record(source.extensions) ?? {}) }
  const bipedMotion = { ...(record(extensions[BIPED_MOTION_EXTENSION_KEY]) ?? {}), ...compileRuntimeMetadata(recipe, stages) }
  extensions[SIMPLE_MOTION_AUTHORING_EXTENSION_KEY] = recipe
  extensions[BIPED_MOTION_EXTENSION_KEY] = bipedMotion
  const asset = normalizeMotionAsset({
    ...source,
    durationMs,
    loopMode: recipe.loopIntent,
    tracks: [...generatedTracks, ...userTracks],
    layers,
    extensions,
    updatedAt: options.now ?? source.updatedAt,
  }).asset
  return { asset, recipe, stages, diagnostics: normalized.diagnostics }
}
