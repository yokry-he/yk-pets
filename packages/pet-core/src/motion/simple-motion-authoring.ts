/**
 * 文件职责 / File responsibility
 * 定义面向新手的阶段式动作配方、五类意图蓝图与有界归一化。
 * Defines beginner-facing staged-motion recipes, five intent blueprints, and bounded normalization.
 */
import {
  MOTION_CONTROLS,
  getIntensityAdjustedMotionControlRange,
  type MotionControlId,
} from './motion-controls'
import type { StudioMotionAssetV2 } from './motion-asset'
import type { StudioMotionLoopMode } from './motion-time'

export const SIMPLE_MOTION_AUTHORING_EXTENSION_KEY = 'yk-pets/simple-motion-authoring/v1' as const
export const SIMPLE_MOTION_AUTHORING_SCHEMA_VERSION = 1 as const
export const SIMPLE_MOTION_COMPILER_VERSION = 1 as const
export const SIMPLE_MOTION_STAGE_LIMIT = 16
export const SIMPLE_MOTION_STAGE_MIN_DURATION_MS = 100
export const SIMPLE_MOTION_STAGE_MAX_DURATION_MS = 10000
export const SIMPLE_MOTION_STAGE_MAX_INTENSITY = 1.5
export const SIMPLE_MOTION_MAX_DURATION_MS = 60000

export type SimpleMotionIntent = 'daily' | 'dance' | 'martial-arts' | 'sports' | 'custom'
export type SimpleMotionTransition = 'hold' | 'steady' | 'soft' | 'snappy'
export type SimpleMotionEffect = 'speed-trail' | 'landing-impact' | 'swing-trail' | 'hit-sparks'

export interface SimpleMotionAutomaticFeatures {
  symmetry: boolean
  balance: boolean
  footContact: boolean
  secondaryMotion: boolean
  effects: boolean
}

export interface SimpleMotionStage {
  id: string
  labelZh: string
  durationMs: number
  transition: SimpleMotionTransition
  intensity: number
  pose: Partial<Record<MotionControlId, number>>
  effects: SimpleMotionEffect[]
}

export interface SimpleMotionRecipeV1 {
  schemaVersion: typeof SIMPLE_MOTION_AUTHORING_SCHEMA_VERSION
  compilerVersion: typeof SIMPLE_MOTION_COMPILER_VERSION
  intent: SimpleMotionIntent
  loopIntent: StudioMotionLoopMode
  automaticFeatures: SimpleMotionAutomaticFeatures
  stages: SimpleMotionStage[]
}

export type SimpleMotionDiagnosticCode =
  | 'recipe-repaired'
  | 'stage-limit-applied'
  | 'stage-id-replaced'
  | 'stage-duration-clamped'
  | 'unknown-control-dropped'
  | 'control-value-repaired'
  | 'total-duration-scaled'

export interface SimpleMotionDiagnostic {
  code: SimpleMotionDiagnosticCode
  path: string
  message: string
}

export interface NormalizeSimpleMotionRecipeResult {
  value: SimpleMotionRecipeV1
  diagnostics: SimpleMotionDiagnostic[]
}

export const SIMPLE_MOTION_INTENTS = Object.freeze([
  { id: 'daily', labelZh: '日常', descriptionZh: '问候、待机与生活动作', icon: '◌', defaultNameZh: '日常动作', defaultNameEn: 'Daily Motion' },
  { id: 'dance', labelZh: '舞蹈', descriptionZh: '用节拍阶段组合舞步', icon: '♫', defaultNameZh: '舞蹈动作', defaultNameEn: 'Dance Motion' },
  { id: 'martial-arts', labelZh: '功夫', descriptionZh: '架势、发力、命中与收势', icon: '◆', defaultNameZh: '功夫动作', defaultNameEn: 'Martial Arts Motion' },
  { id: 'sports', labelZh: '运动', descriptionZh: '预备、爆发、缓冲与结束', icon: '▲', defaultNameZh: '运动动作', defaultNameEn: 'Sports Motion' },
  { id: 'custom', labelZh: '自定义', descriptionZh: '从起始、动作、结束三阶段开始', icon: '✦', defaultNameZh: '自定义动作', defaultNameEn: 'Custom Motion' },
] as const satisfies readonly {
  id: SimpleMotionIntent
  labelZh: string
  descriptionZh: string
  icon: string
  defaultNameZh: string
  defaultNameEn: string
}[])

const INTENTS = new Set<SimpleMotionIntent>(SIMPLE_MOTION_INTENTS.map(item => item.id))
const TRANSITIONS = new Set<SimpleMotionTransition>(['hold', 'steady', 'soft', 'snappy'])
const EFFECTS = new Set<SimpleMotionEffect>(['speed-trail', 'landing-impact', 'swing-trail', 'hit-sparks'])
const CONTROL_IDS = new Set<string>(MOTION_CONTROLS.map(item => item.id))
const DEFAULT_AUTOMATIC_FEATURES: SimpleMotionAutomaticFeatures = Object.freeze({
  symmetry: true,
  balance: true,
  footContact: true,
  secondaryMotion: true,
  effects: true,
})

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : fallback

function stage(
  id: string,
  labelZh: string,
  durationMs: number,
  pose: SimpleMotionStage['pose'] = {},
  transition: SimpleMotionTransition = 'soft',
  intensity = 1,
  effects: SimpleMotionEffect[] = [],
): SimpleMotionStage {
  return { id, labelZh, durationMs, transition, intensity, pose, effects }
}

function blueprint(intent: SimpleMotionIntent): SimpleMotionRecipeV1 {
  const common = {
    schemaVersion: SIMPLE_MOTION_AUTHORING_SCHEMA_VERSION,
    compilerVersion: SIMPLE_MOTION_COMPILER_VERSION,
    intent,
    automaticFeatures: { ...DEFAULT_AUTOMATIC_FEATURES },
  } as const
  if (intent === 'daily') return {
    ...common,
    loopIntent: 'once',
    stages: [
      stage('daily-ready', '起势', 700, { 'root.translate.y': 0, 'head.rotate.z': 0 }),
      stage('daily-greet', '问候', 1500, { 'root.translate.y': .05, 'body.rotate.z': -.08, 'head.rotate.z': .12, 'front-paw-right.rotate.z': 1.25, 'front-paw-right.rotate.tip-z': -.35, 'tail-root.rotate.z': .28 }, 'soft', 1),
      stage('daily-settle', '回位', 800, { 'root.translate.y': 0, 'body.rotate.z': 0, 'head.rotate.z': 0, 'front-paw-right.rotate.z': 0, 'front-paw-right.rotate.tip-z': 0, 'tail-root.rotate.z': 0 }),
    ],
  }
  if (intent === 'dance') return {
    ...common,
    loopIntent: 'loop',
    stages: [
      stage('dance-ready', '预备', 500, { 'root.translate.y': -.04, 'front-paw-left.rotate.z': -.35, 'front-paw-right.rotate.z': .35 }, 'snappy'),
      stage('dance-left', '左拍', 650, { 'root.translate.x': -.12, 'root.translate.y': .08, 'body.rotate.z': .2, 'head.rotate.z': -.12, 'front-paw-left.rotate.z': -1, 'front-paw-right.rotate.z': .35, 'tail-root.rotate.z': -.3 }, 'snappy', 1.1),
      stage('dance-right', '右拍', 650, { 'root.translate.x': .12, 'root.translate.y': .08, 'body.rotate.z': -.2, 'head.rotate.z': .12, 'front-paw-left.rotate.z': -.35, 'front-paw-right.rotate.z': 1, 'tail-root.rotate.z': .3 }, 'snappy', 1.1),
      stage('dance-turn', '转折', 800, { 'root.rotate.y': Math.PI * .6, 'root.translate.y': .12, 'front-paw-left.rotate.z': -.9, 'front-paw-right.rotate.z': .9, 'tail-root.rotate.z': -.4 }, 'soft', 1.2, ['speed-trail']),
      stage('dance-pose', '定格', 600, { 'root.translate.y': 0, 'root.rotate.y': 0, 'body.rotate.z': .12, 'head.rotate.z': -.12, 'front-paw-left.rotate.z': -1.15, 'front-paw-right.rotate.z': .55, 'tail-root.rotate.z': .22 }, 'hold', 1.1),
    ],
  }
  if (intent === 'martial-arts') return {
    ...common,
    loopIntent: 'once',
    stages: [
      stage('martial-guard', '架势', 800, { 'root.translate.y': -.08, 'body.rotate.y': -.18, 'front-paw-left.rotate.z': -.85, 'front-paw-right.rotate.z': .85, 'hind-paw-left.rotate.x': .28, 'hind-paw-right.rotate.x': .38 }, 'steady'),
      stage('martial-charge', '蓄力', 650, { 'root.translate.x': -.08, 'root.translate.y': -.16, 'body.rotate.y': -.42, 'front-paw-left.rotate.z': -.45, 'front-paw-right.rotate.z': 1.12, 'tail-root.rotate.z': .35 }, 'soft', 1.1),
      stage('martial-strike', '攻击', 360, { 'root.translate.x': .16, 'root.translate.y': -.08, 'body.rotate.y': .48, 'front-paw-left.rotate.z': -.82, 'front-paw-right.rotate.z': .2, 'front-paw-right.rotate.tip-x': -.32, 'tail-root.rotate.z': -.42 }, 'snappy', 1.35, ['swing-trail']),
      stage('martial-impact', '命中', 260, { 'root.translate.x': .2, 'body.rotate.y': .56, 'front-paw-right.rotate.z': .12, 'front-paw-right.rotate.tip-x': -.4 }, 'hold', 1.5, ['hit-sparks']),
      stage('martial-recover', '收势', 930, { 'root.translate.x': 0, 'root.translate.y': 0, 'body.rotate.y': 0, 'front-paw-left.rotate.z': 0, 'front-paw-right.rotate.z': 0, 'front-paw-right.rotate.tip-x': 0, 'tail-root.rotate.z': 0 }, 'soft'),
    ],
  }
  if (intent === 'sports') return {
    ...common,
    loopIntent: 'once',
    stages: [
      stage('sports-ready', '预备', 700, { 'root.translate.y': -.06, 'front-paw-left.rotate.z': -.25, 'front-paw-right.rotate.z': .25 }, 'steady'),
      stage('sports-load', '发力', 650, { 'root.translate.y': -.28, 'body.rotate.x': .22, 'front-paw-left.rotate.z': -.65, 'front-paw-right.rotate.z': .65, 'hind-paw-left.rotate.x': .9, 'hind-paw-right.rotate.x': .9 }, 'soft', 1.15),
      stage('sports-launch', '起跳', 420, { 'root.translate.y': .22, 'body.rotate.x': -.18, 'front-paw-left.rotate.z': -1.05, 'front-paw-right.rotate.z': 1.05, 'hind-paw-left.rotate.x': -.35, 'hind-paw-right.rotate.x': -.35 }, 'snappy', 1.4, ['speed-trail']),
      stage('sports-air', '腾空', 800, { 'root.translate.y': 1.05, 'body.rotate.x': -.08, 'front-paw-left.rotate.z': -.8, 'front-paw-right.rotate.z': .8, 'hind-paw-left.rotate.x': -.6, 'hind-paw-right.rotate.x': -.6, 'tail-root.rotate.x': .3 }, 'soft', 1.2),
      stage('sports-land', '落地', 900, { 'root.translate.y': 0, 'body.rotate.x': .16, 'front-paw-left.rotate.z': -.25, 'front-paw-right.rotate.z': .25, 'hind-paw-left.rotate.x': .25, 'hind-paw-right.rotate.x': .25, 'tail-root.rotate.x': 0 }, 'soft', 1.1, ['landing-impact']),
    ],
  }
  return {
    ...common,
    loopIntent: 'once',
    stages: [
      stage('custom-start', '起始', 800, {}, 'soft'),
      stage('custom-action', '动作', 1200, { 'root.translate.y': .08, 'front-paw-left.rotate.z': -.45, 'front-paw-right.rotate.z': .45 }, 'soft'),
      stage('custom-end', '结束', 800, {}, 'soft'),
    ],
  }
}

function normalizeIntent(value: unknown): SimpleMotionIntent {
  return typeof value === 'string' && INTENTS.has(value as SimpleMotionIntent) ? value as SimpleMotionIntent : 'custom'
}

function normalizeLoopMode(value: unknown, fallback: StudioMotionLoopMode): StudioMotionLoopMode {
  return value === 'loop' || value === 'ping-pong' || value === 'once' ? value : fallback
}

function normalizeAutomaticFeatures(value: unknown): SimpleMotionAutomaticFeatures {
  const source = record(value)
  return {
    symmetry: typeof source?.symmetry === 'boolean' ? source.symmetry : true,
    balance: typeof source?.balance === 'boolean' ? source.balance : true,
    footContact: typeof source?.footContact === 'boolean' ? source.footContact : true,
    secondaryMotion: typeof source?.secondaryMotion === 'boolean' ? source.secondaryMotion : true,
    effects: typeof source?.effects === 'boolean' ? source.effects : true,
  }
}

function normalizePose(value: unknown, path: string, diagnostics: SimpleMotionDiagnostic[], intensity: number): SimpleMotionStage['pose'] {
  const source = record(value)
  if (!source) return {}
  const pose: Partial<Record<MotionControlId, number>> = {}
  for (const [id, rawValue] of Object.entries(source)) {
    if (!CONTROL_IDS.has(id)) {
      diagnostics.push({ code: 'unknown-control-dropped', path: `${path}.${id}`, message: '未知姿势控制已忽略。' })
      continue
    }
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      diagnostics.push({ code: 'control-value-repaired', path: `${path}.${id}`, message: '非有限姿势数值已忽略。' })
      continue
    }
    const [minimum, maximum] = getIntensityAdjustedMotionControlRange(id as MotionControlId, intensity)
    pose[id as MotionControlId] = clamp(rawValue, minimum, maximum)
  }
  return pose
}

function normalizeEffects(value: unknown): SimpleMotionEffect[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is SimpleMotionEffect => typeof item === 'string' && EFFECTS.has(item as SimpleMotionEffect)))].sort()
}

function normalizeStages(value: unknown, fallback: SimpleMotionStage[], diagnostics: SimpleMotionDiagnostic[]): SimpleMotionStage[] {
  const source = Array.isArray(value) && value.length ? value : fallback
  if (!Array.isArray(value) || !value.length) diagnostics.push({ code: 'recipe-repaired', path: 'stages', message: '缺少阶段，已恢复该意图的默认阶段。' })
  if (source.length > SIMPLE_MOTION_STAGE_LIMIT) diagnostics.push({ code: 'stage-limit-applied', path: 'stages', message: `阶段已限制为 ${SIMPLE_MOTION_STAGE_LIMIT} 个。` })
  const usedIds = new Set<string>()
  const stages = source.slice(0, SIMPLE_MOTION_STAGE_LIMIT).map((item, index): SimpleMotionStage => {
    const raw = record(item) ?? {}
    const baseId = text(raw.id, `stage-${index + 1}`).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 48) || `stage-${index + 1}`
    let id = baseId
    let suffix = 2
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`
    if (id !== raw.id) diagnostics.push({ code: 'stage-id-replaced', path: `stages[${index}].id`, message: '阶段 ID 已修复为稳定唯一值。' })
    usedIds.add(id)
    const fallbackStage = fallback[Math.min(index, fallback.length - 1)] ?? stage(`stage-${index + 1}`, `阶段 ${index + 1}`, 800)
    const rawDuration = finite(raw.durationMs, fallbackStage.durationMs)
    const durationMs = Math.round(clamp(rawDuration, SIMPLE_MOTION_STAGE_MIN_DURATION_MS, SIMPLE_MOTION_STAGE_MAX_DURATION_MS))
    if (durationMs !== rawDuration) diagnostics.push({ code: 'stage-duration-clamped', path: `stages[${index}].durationMs`, message: '阶段时长已修复到安全范围。' })
    const intensity = clamp(finite(raw.intensity, fallbackStage.intensity), 0, SIMPLE_MOTION_STAGE_MAX_INTENSITY)
    return {
      id,
      labelZh: text(raw.labelZh, fallbackStage.labelZh || `阶段 ${index + 1}`),
      durationMs,
      transition: typeof raw.transition === 'string' && TRANSITIONS.has(raw.transition as SimpleMotionTransition) ? raw.transition as SimpleMotionTransition : fallbackStage.transition,
      intensity,
      pose: normalizePose(raw.pose ?? fallbackStage.pose, `stages[${index}].pose`, diagnostics, intensity),
      effects: normalizeEffects(raw.effects ?? fallbackStage.effects),
    }
  })
  while (stages.length < 2) {
    const fallbackStage = fallback[stages.length] ?? stage(`stage-${stages.length + 1}`, stages.length ? '结束' : '起始', 800)
    const intensity = clamp(finite(fallbackStage.intensity, 1), 0, SIMPLE_MOTION_STAGE_MAX_INTENSITY)
    stages.push({
      ...fallbackStage,
      intensity,
      pose: normalizePose(fallbackStage.pose, `stages[${stages.length}].pose`, diagnostics, intensity),
      effects: [...fallbackStage.effects],
    })
    diagnostics.push({ code: 'recipe-repaired', path: 'stages', message: '阶段数不足，已补齐起始与结束阶段。' })
  }
  const totalDuration = stages.reduce((sum, item) => sum + item.durationMs, 0)
  if (totalDuration > SIMPLE_MOTION_MAX_DURATION_MS) {
    const scale = SIMPLE_MOTION_MAX_DURATION_MS / totalDuration
    for (const item of stages) item.durationMs = Math.max(SIMPLE_MOTION_STAGE_MIN_DURATION_MS, Math.floor(item.durationMs * scale))
    while (stages.reduce((sum, item) => sum + item.durationMs, 0) > SIMPLE_MOTION_MAX_DURATION_MS) {
      const target = [...stages].sort((left, right) => right.durationMs - left.durationMs)[0]
      if (!target || target.durationMs <= SIMPLE_MOTION_STAGE_MIN_DURATION_MS) break
      target.durationMs--
    }
    diagnostics.push({ code: 'total-duration-scaled', path: 'stages', message: '动作总时长已等比缩短到 60000ms 以内。' })
  }
  return stages
}

export function createSimpleMotionRecipe(intent: SimpleMotionIntent): SimpleMotionRecipeV1 {
  const source = blueprint(normalizeIntent(intent))
  return {
    ...source,
    automaticFeatures: { ...source.automaticFeatures },
    stages: source.stages.map(item => ({ ...item, pose: { ...item.pose }, effects: [...item.effects] })),
  }
}

export function normalizeSimpleMotionRecipe(input: unknown): NormalizeSimpleMotionRecipeResult {
  const diagnostics: SimpleMotionDiagnostic[] = []
  try {
    const source = record(input) ?? {}
    const intent = normalizeIntent(source.intent)
    const fallback = blueprint(intent)
    if (!record(input) || source.schemaVersion !== SIMPLE_MOTION_AUTHORING_SCHEMA_VERSION || source.compilerVersion !== SIMPLE_MOTION_COMPILER_VERSION || intent !== source.intent) {
      diagnostics.push({ code: 'recipe-repaired', path: '', message: '阶段配方版本或意图已恢复为当前格式。' })
    }
    return {
      value: {
        schemaVersion: SIMPLE_MOTION_AUTHORING_SCHEMA_VERSION,
        compilerVersion: SIMPLE_MOTION_COMPILER_VERSION,
        intent,
        loopIntent: normalizeLoopMode(source.loopIntent, fallback.loopIntent),
        automaticFeatures: normalizeAutomaticFeatures(source.automaticFeatures),
        stages: normalizeStages(source.stages, fallback.stages, diagnostics),
      },
      diagnostics,
    }
  }
  catch {
    diagnostics.push({ code: 'recipe-repaired', path: '', message: '阶段配方无法安全读取，已恢复自定义默认配方。' })
    return { value: createSimpleMotionRecipe('custom'), diagnostics }
  }
}

export function readSimpleMotionRecipe(asset: StudioMotionAssetV2): SimpleMotionRecipeV1 | undefined {
  try {
    const input = asset.extensions?.[SIMPLE_MOTION_AUTHORING_EXTENSION_KEY]
    return input === undefined ? undefined : normalizeSimpleMotionRecipe(input).value
  }
  catch {
    return undefined
  }
}
