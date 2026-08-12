/**
 * 文件职责 / File responsibility
 * 定义简单动作模式的直接操控能力和快速姿势卡，不包含拖拽求解或界面行为。
 * Defines simple-motion direct manipulation capabilities and quick pose cards without drag solving or UI behavior.
 */
import {
  getMotionControl,
  getMotionBodyPart,
  getMotionBodyPartControls,
  isMotionControlId,
  type MotionBodyPartId,
  type MotionControlDefinition,
  type MotionControlId,
} from './motion-controls'
import { getCloudFoxRigChannel } from './cloud-fox-rig'
import type { SimpleMotionIntent } from './simple-motion-authoring'

export type DirectMotionMode = 'translate' | 'rotate'
export type DirectMotionSemantic =
  | 'horizontal'
  | 'vertical'
  | 'depth'
  | 'swing'
  | 'spread'
  | 'twist'
  | 'bend'
  | 'pitch'
  | 'turn'
  | 'lean'
  | 'nod'
  | 'head-turn'
  | 'head-tilt'
  | 'tip-direction'
  | 'ear-perk'
  | 'tail-lift'
  | 'tail-sway'

export interface DirectMotionParameter {
  readonly semantic: DirectMotionSemantic
  readonly labelZh: string
  readonly controlId: MotionControlId
}

export interface DirectMotionCapability {
  readonly partId: MotionBodyPartId
  readonly modes: readonly DirectMotionMode[]
  readonly controlIds: readonly MotionControlId[]
  readonly parameters: readonly DirectMotionParameter[]
  readonly symmetryPartnerId?: MotionBodyPartId
  readonly endEffector: boolean
}

export interface DirectMotionPoseCard {
  readonly id: string
  readonly partId: MotionBodyPartId
  readonly intents: readonly SimpleMotionIntent[]
  readonly labelZh: string
  readonly icon: string
  readonly pose: Readonly<Partial<Record<MotionControlId, number>>>
}

export interface DirectMotionDragInput {
  partId: MotionBodyPartId
  mode: DirectMotionMode
  delta: Readonly<{ x: number, y: number, depth: number }>
  viewport: Readonly<{ width: number, height: number }>
  pose: Readonly<Partial<Record<MotionControlId, number>>>
}

export interface DirectMotionSolveResult {
  status: 'ready' | 'clamped' | 'blocked'
  pose: Readonly<Partial<Record<MotionControlId, number>>>
  diagnostics: readonly string[]
}

type DirectMotionParameterMetadata = Omit<DirectMotionParameter, 'controlId'>

const DIRECT_MOTION_MODES = ['translate', 'rotate'] as const satisfies readonly DirectMotionMode[]
const FORMAL_PART_IDS = [
  'root',
  'body',
  'head',
  'front-paw-left',
  'front-paw-right',
  'hind-paw-left',
  'hind-paw-right',
  'ear-left',
  'ear-right',
  'tail-root',
  'tail-mid',
  'tail-tip',
] as const satisfies readonly MotionBodyPartId[]
const FORMAL_PART_ID_SET = new Set<MotionBodyPartId>(FORMAL_PART_IDS)

const END_EFFECTOR_PART_IDS = new Set<MotionBodyPartId>([
  'front-paw-left',
  'front-paw-right',
  'hind-paw-left',
  'hind-paw-right',
  'ear-left',
  'ear-right',
  'tail-tip',
])
const DIRECT_MOTION_DIAGNOSTIC_LIMIT = 4
const DIRECT_MOTION_DRAG_SENSITIVITY = 1
const DIRECT_MOTION_SEMANTIC_INPUT = {
  horizontal: 'x',
  vertical: 'y',
  depth: 'depth',
  swing: 'y',
  spread: 'x',
  twist: 'depth',
  bend: 'y',
  pitch: 'y',
  turn: 'x',
  lean: 'x',
  nod: 'y',
  'head-turn': 'x',
  'head-tilt': 'x',
  'tip-direction': 'x',
  'ear-perk': 'y',
  'tail-lift': 'y',
  'tail-sway': 'x',
} as const satisfies Record<DirectMotionSemantic, 'x' | 'y' | 'depth'>

function isRegisteredMotionControl(control: MotionControlDefinition): control is MotionControlDefinition<MotionControlId> {
  return isMotionControlId(control.id)
}

/**
 * 直接操控语义由领域注册表显式维护，避免从坐标轴或控制 ID 字符串猜测用户意图。
 */
const DIRECT_MOTION_PARAMETER_METADATA = {
  'root.translate.x': { semantic: 'horizontal', labelZh: '整体左右移动' },
  'root.translate.y': { semantic: 'vertical', labelZh: '整体上下移动' },
  'root.translate.z': { semantic: 'depth', labelZh: '整体前后移动' },
  'root.rotate.x': { semantic: 'pitch', labelZh: '整体前后倾斜' },
  'root.rotate.y': { semantic: 'turn', labelZh: '整体转向' },
  'root.rotate.z': { semantic: 'lean', labelZh: '整体侧倾' },

  'body.translate.x': { semantic: 'horizontal', labelZh: '身体左右移动' },
  'body.translate.y': { semantic: 'vertical', labelZh: '身体上下移动' },
  'body.translate.z': { semantic: 'depth', labelZh: '身体前后移动' },
  'body.rotate.x': { semantic: 'pitch', labelZh: '身体前后倾斜' },
  'body.rotate.y': { semantic: 'turn', labelZh: '身体转向' },
  'body.rotate.z': { semantic: 'lean', labelZh: '身体侧倾' },

  'head.translate.x': { semantic: 'horizontal', labelZh: '头部左右移动' },
  'head.translate.y': { semantic: 'vertical', labelZh: '头部上下移动' },
  'head.translate.z': { semantic: 'depth', labelZh: '头部前后移动' },
  'head.rotate.x': { semantic: 'nod', labelZh: '头部点头' },
  'head.rotate.y': { semantic: 'head-turn', labelZh: '头部转向' },
  'head.rotate.z': { semantic: 'head-tilt', labelZh: '头部歪斜' },

  'front-paw-left.rotate.x': { semantic: 'swing', labelZh: '前爪前后摆动' },
  'front-paw-left.rotate.y': { semantic: 'twist', labelZh: '前爪转向' },
  'front-paw-left.rotate.z': { semantic: 'spread', labelZh: '前爪侧摆' },
  'front-paw-left.rotate.tip-x': { semantic: 'bend', labelZh: '爪尖弯曲' },
  'front-paw-left.rotate.tip-z': { semantic: 'tip-direction', labelZh: '爪尖方向' },
  'front-paw-right.rotate.x': { semantic: 'swing', labelZh: '前爪前后摆动' },
  'front-paw-right.rotate.y': { semantic: 'twist', labelZh: '前爪转向' },
  'front-paw-right.rotate.z': { semantic: 'spread', labelZh: '前爪侧摆' },
  'front-paw-right.rotate.tip-x': { semantic: 'bend', labelZh: '爪尖弯曲' },
  'front-paw-right.rotate.tip-z': { semantic: 'tip-direction', labelZh: '爪尖方向' },

  'hind-paw-left.rotate.x': { semantic: 'swing', labelZh: '后爪前后摆动' },
  'hind-paw-left.rotate.y': { semantic: 'twist', labelZh: '后爪转向' },
  'hind-paw-left.rotate.z': { semantic: 'spread', labelZh: '后爪侧摆' },
  'hind-paw-right.rotate.x': { semantic: 'swing', labelZh: '后爪前后摆动' },
  'hind-paw-right.rotate.y': { semantic: 'twist', labelZh: '后爪转向' },
  'hind-paw-right.rotate.z': { semantic: 'spread', labelZh: '后爪侧摆' },

  'ear-left.rotate.x': { semantic: 'swing', labelZh: '耳朵前后摆动' },
  'ear-left.rotate.y': { semantic: 'twist', labelZh: '耳朵转向' },
  'ear-left.rotate.z': { semantic: 'ear-perk', labelZh: '耳朵竖起' },
  'ear-right.rotate.x': { semantic: 'swing', labelZh: '耳朵前后摆动' },
  'ear-right.rotate.y': { semantic: 'twist', labelZh: '耳朵转向' },
  'ear-right.rotate.z': { semantic: 'ear-perk', labelZh: '耳朵竖起' },

  'tail-root.rotate.x': { semantic: 'tail-lift', labelZh: '尾巴上下摆动' },
  'tail-root.rotate.y': { semantic: 'twist', labelZh: '尾巴扭转' },
  'tail-root.rotate.z': { semantic: 'tail-sway', labelZh: '尾巴摆动' },
  'tail-mid.rotate.x': { semantic: 'tail-lift', labelZh: '尾巴上下摆动' },
  'tail-mid.rotate.y': { semantic: 'twist', labelZh: '尾巴扭转' },
  'tail-mid.rotate.z': { semantic: 'tail-sway', labelZh: '尾巴摆动' },
  'tail-tip.rotate.x': { semantic: 'tail-lift', labelZh: '尾巴尖上下摆动' },
  'tail-tip.rotate.y': { semantic: 'twist', labelZh: '尾巴尖扭转' },
  'tail-tip.rotate.z': { semantic: 'tail-sway', labelZh: '尾巴尖摆动' },
} as const satisfies Partial<Record<MotionControlId, DirectMotionParameterMetadata>>
const DIRECT_MOTION_PARAMETER_METADATA_BY_ID: Readonly<Partial<Record<MotionControlId, DirectMotionParameterMetadata>>> = DIRECT_MOTION_PARAMETER_METADATA

function directParameter(control: MotionControlDefinition<MotionControlId>): DirectMotionParameter {
  const metadata = DIRECT_MOTION_PARAMETER_METADATA_BY_ID[control.id]
  if (!metadata) throw new Error(`缺少直接操控参数元数据：${control.id}`)
  return { controlId: control.id, ...metadata }
}

function freezeCapability(capability: DirectMotionCapability): DirectMotionCapability {
  return Object.freeze({
    ...capability,
    modes: Object.freeze([...capability.modes]),
    controlIds: Object.freeze([...capability.controlIds]),
    parameters: Object.freeze(capability.parameters.map(parameter => Object.freeze({ ...parameter }))),
  })
}

function cloneCapability(capability: DirectMotionCapability): DirectMotionCapability {
  return freezeCapability(capability)
}

function createCapability(partId: MotionBodyPartId): DirectMotionCapability | undefined {
  const controls = DIRECT_MOTION_MODES
    .flatMap(mode => getMotionBodyPartControls(partId, mode))
    .filter(isRegisteredMotionControl)
  if (!controls.length) return undefined
  const bodyPart = getMotionBodyPart(partId)
  const symmetryPartnerId = bodyPart.symmetryPartnerId && FORMAL_PART_ID_SET.has(bodyPart.symmetryPartnerId)
    ? bodyPart.symmetryPartnerId
    : undefined
  return freezeCapability({
    partId,
    modes: DIRECT_MOTION_MODES.filter(mode => controls.some(control => control.mode === mode)),
    controlIds: controls.map(control => control.id),
    parameters: controls.map(directParameter),
    ...(symmetryPartnerId ? { symmetryPartnerId } : {}),
    endEffector: END_EFFECTOR_PART_IDS.has(partId),
  })
}

const DIRECT_MOTION_CAPABILITIES = new Map<MotionBodyPartId, DirectMotionCapability>(
  FORMAL_PART_IDS.flatMap(partId => {
    const capability = createCapability(partId)
    return capability ? [[partId, capability] as const] : []
  }),
)

function freezePoseCard(card: DirectMotionPoseCard): DirectMotionPoseCard {
  return Object.freeze({
    ...card,
    intents: Object.freeze([...card.intents]),
    pose: Object.freeze({ ...card.pose }),
  })
}

function poseCard(
  id: string,
  partId: MotionBodyPartId,
  intents: readonly SimpleMotionIntent[],
  labelZh: string,
  icon: string,
  pose: Readonly<Partial<Record<MotionControlId, number>>>,
): DirectMotionPoseCard {
  return freezePoseCard({ id, partId, intents, labelZh, icon, pose })
}

/**
 * 左右部位的卡片分别声明各自的控制 ID 与数值，避免界面层通过文案替换推导镜像姿势。
 */
export const DIRECT_MOTION_POSE_CARDS: readonly DirectMotionPoseCard[] = Object.freeze([
  poseCard('root-rise', 'root', ['daily', 'sports'], '整体抬升', '↥', { 'root.translate.y': .12 }),
  poseCard('body-lean', 'body', ['sports', 'martial-arts'], '身体前倾', '↗', { 'body.rotate.x': .22 }),
  poseCard('head-nod', 'head', ['daily'], '点头', '↓', { 'head.rotate.x': .24 }),
  poseCard('head-tilt', 'head', ['dance', 'custom'], '歪头', '◒', { 'head.rotate.z': -.24 }),

  poseCard('front-paw-left-raise-hand', 'front-paw-left', ['daily', 'martial-arts'], '抬手', '↖', { 'front-paw-left.rotate.z': -.85 }),
  poseCard('front-paw-right-raise-hand', 'front-paw-right', ['daily', 'martial-arts'], '抬手', '↗', { 'front-paw-right.rotate.z': .85 }),
  poseCard('hind-paw-left-kick-back', 'hind-paw-left', ['sports', 'martial-arts'], '后蹬', '◀', { 'hind-paw-left.rotate.x': .48 }),
  poseCard('hind-paw-right-kick-back', 'hind-paw-right', ['sports', 'martial-arts'], '后蹬', '▶', { 'hind-paw-right.rotate.x': .48 }),
  poseCard('ear-left-perk', 'ear-left', ['daily'], '竖耳', '◁', { 'ear-left.rotate.z': .3 }),
  poseCard('ear-right-perk', 'ear-right', ['daily'], '竖耳', '▷', { 'ear-right.rotate.z': -.3 }),

  poseCard('tail-root-sway', 'tail-root', ['daily', 'dance'], '摆尾', '⌁', { 'tail-root.rotate.z': .38 }),
  poseCard('tail-mid-sway', 'tail-mid', ['daily', 'dance'], '摆尾', '⌁', { 'tail-mid.rotate.z': .32 }),
  poseCard('tail-tip-flick', 'tail-tip', ['daily', 'dance'], '甩尾尖', '⌁', { 'tail-tip.rotate.z': .42 }),
])

/**
 * 返回独立冻结副本，调用方无法借由结果污染能力注册表或其他读取者。
 */
export function getDirectMotionCapability(partId: MotionBodyPartId): DirectMotionCapability | undefined {
  const capability = DIRECT_MOTION_CAPABILITIES.get(partId)
  return capability ? cloneCapability(capability) : undefined
}

/**
 * 姿势卡保持声明顺序，并为每次读取创建独立冻结副本以隔离调用方状态。
 */
export function getDirectMotionPoseCards(partId: MotionBodyPartId, intent: SimpleMotionIntent): readonly DirectMotionPoseCard[] {
  return Object.freeze(
    DIRECT_MOTION_POSE_CARDS
      .filter(card => card.partId === partId && card.intents.includes(intent))
      .map(card => freezePoseCard(card)),
  )
}

interface PoseNormalizationResult {
  readonly pose: Partial<Record<MotionControlId, number>>
  readonly malformed: boolean
  readonly clamped: boolean
}

interface SafeReadResult {
  readonly ok: boolean
  readonly value: unknown
}

interface FiniteReadResult {
  readonly ok: true
  readonly value: number
}

function addDiagnostic(diagnostics: string[], message: string) {
  if (diagnostics.length < DIRECT_MOTION_DIAGNOSTIC_LIMIT) diagnostics.push(message)
}

function safeRead(source: unknown, key: string): SafeReadResult {
  if (!source || (typeof source !== 'object' && typeof source !== 'function')) return { ok: false, value: undefined }
  try {
    return { ok: true, value: (source as Record<string, unknown>)[key] }
  }
  catch {
    return { ok: false, value: undefined }
  }
}

function isFiniteRead(result: SafeReadResult): result is FiniteReadResult {
  return result.ok && typeof result.value === 'number' && Number.isFinite(result.value)
}

function finiteControlRange(controlId: MotionControlId): readonly [number, number] {
  const channels = getMotionControl(controlId).channelIds.map(getCloudFoxRigChannel)
  return [Math.max(...channels.map(channel => channel.minimum)), Math.min(...channels.map(channel => channel.maximum))]
}

function clampControlValue(controlId: MotionControlId, value: number): readonly [number, boolean] {
  const [minimum, maximum] = finiteControlRange(controlId)
  const clamped = Math.max(minimum, Math.min(maximum, value))
  return [clamped, clamped !== value]
}

function normalizeDirectMotionPose(source: unknown, diagnostics: string[]): PoseNormalizationResult {
  const pose: Partial<Record<MotionControlId, number>> = {}
  let entries: [string, unknown][]
  try {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      addDiagnostic(diagnostics, '姿势输入格式异常，已安全阻断。')
      return { pose, malformed: true, clamped: false }
    }
    entries = Object.entries(source).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  }
  catch {
    addDiagnostic(diagnostics, '姿势输入无法安全读取，已安全阻断。')
    return { pose, malformed: true, clamped: false }
  }

  let malformed = false
  let clamped = false
  for (const [id, value] of entries) {
    if (!isMotionControlId(id)) {
      malformed = true
      addDiagnostic(diagnostics, '姿势含未知控制，已忽略。')
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      malformed = true
      addDiagnostic(diagnostics, '姿势含非有限数值，已忽略。')
      continue
    }
    const [safeValue, didClamp] = clampControlValue(id, value)
    pose[id] = safeValue
    if (didClamp) {
      clamped = true
      addDiagnostic(diagnostics, '姿势数值已钳制到 Rig 安全范围。')
    }
  }
  return { pose, malformed, clamped }
}

function frozenSolveResult(
  status: DirectMotionSolveResult['status'],
  pose: Readonly<Partial<Record<MotionControlId, number>>>,
  diagnostics: readonly string[],
): DirectMotionSolveResult {
  return Object.freeze({
    status,
    pose: Object.freeze({ ...pose }),
    diagnostics: Object.freeze([...diagnostics]),
  })
}

function normalizedDragValue(value: number, shortSide: number): readonly [number, boolean] {
  const normalized = value / shortSide * DIRECT_MOTION_DRAG_SENSITIVITY
  if (Number.isFinite(normalized)) return [normalized, false]
  return [Math.sign(value || 1) * Number.MAX_VALUE, true]
}

function semanticDragValue(
  semantic: DirectMotionSemantic,
  normalized: Readonly<{ x: number, y: number, depth: number }>,
): number {
  const source = DIRECT_MOTION_SEMANTIC_INPUT[semantic]
  return source === 'y' ? -normalized.y : normalized[source]
}

/**
 * 把屏幕拖拽保守映射到已注册的语义控制；这不是 IK，也不会改变缩放或骨骼长度。
 */
export function solveDirectMotionDrag(input: DirectMotionDragInput): DirectMotionSolveResult {
  const diagnostics: string[] = []
  const poseRead = safeRead(input, 'pose')
  const normalizedPose = normalizeDirectMotionPose(poseRead.ok ? poseRead.value : undefined, diagnostics)
  if (!poseRead.ok) addDiagnostic(diagnostics, '拖拽姿势无法安全读取，已安全阻断。')

  const partRead = safeRead(input, 'partId')
  const modeRead = safeRead(input, 'mode')
  const deltaRead = safeRead(input, 'delta')
  const viewportRead = safeRead(input, 'viewport')
  if (!partRead.ok || !modeRead.ok || !deltaRead.ok || !viewportRead.ok) {
    addDiagnostic(diagnostics, '拖拽输入无法安全读取，已安全阻断。')
    return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
  }

  const capability = typeof partRead.value === 'string'
    ? DIRECT_MOTION_CAPABILITIES.get(partRead.value as MotionBodyPartId)
    : undefined
  if (!capability || (modeRead.value !== 'translate' && modeRead.value !== 'rotate') || !capability.modes.includes(modeRead.value)) {
    addDiagnostic(diagnostics, '当前部位不支持该直接操控模式，已安全阻断。')
    return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
  }

  const deltaX = safeRead(deltaRead.value, 'x')
  const deltaY = safeRead(deltaRead.value, 'y')
  const deltaDepth = safeRead(deltaRead.value, 'depth')
  const viewportWidth = safeRead(viewportRead.value, 'width')
  const viewportHeight = safeRead(viewportRead.value, 'height')
  if (!isFiniteRead(deltaX) || !isFiniteRead(deltaY) || !isFiniteRead(deltaDepth) || !isFiniteRead(viewportWidth) || !isFiniteRead(viewportHeight)) {
    addDiagnostic(diagnostics, '拖拽增量或视口含非有限数值，已安全阻断。')
    return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
  }
  const shortSide = Math.min(viewportWidth.value, viewportHeight.value)
  if (!(shortSide > 0)) {
    addDiagnostic(diagnostics, '视口尺寸必须为正有限数，已安全阻断。')
    return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
  }
  if (normalizedPose.malformed) return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)

  const [x, xOverflow] = normalizedDragValue(deltaX.value, shortSide)
  const [y, yOverflow] = normalizedDragValue(deltaY.value, shortSide)
  const [depth, depthOverflow] = normalizedDragValue(deltaDepth.value, shortSide)
  let clamped = normalizedPose.clamped || xOverflow || yOverflow || depthOverflow
  if (xOverflow || yOverflow || depthOverflow) addDiagnostic(diagnostics, '拖拽增量过大，已按 Rig 安全范围钳制。')

  const pose: Partial<Record<MotionControlId, number>> = { ...normalizedPose.pose }
  for (const parameter of capability.parameters) {
    const control = getMotionControl(parameter.controlId)
    if (control.mode !== modeRead.value) continue
    const baseline = pose[parameter.controlId] ?? 0
    const requested = baseline + semanticDragValue(parameter.semantic, { x, y, depth })
    const [safeValue, didClamp] = clampControlValue(parameter.controlId, requested)
    pose[parameter.controlId] = Number.isFinite(safeValue) ? safeValue : 0
    clamped ||= didClamp
  }
  if (clamped) addDiagnostic(diagnostics, '拖拽结果已钳制到 Rig 安全范围。')
  return frozenSolveResult(clamped ? 'clamped' : 'ready', pose, diagnostics)
}

/**
 * 精确叠加注册姿势卡，并复用与拖拽相同的 Rig 范围与不可变输出边界。
 */
export function applyDirectMotionPoseCard(
  pose: Readonly<Partial<Record<MotionControlId, number>>>,
  cardId: string,
): DirectMotionSolveResult {
  const diagnostics: string[] = []
  const normalizedPose = normalizeDirectMotionPose(pose, diagnostics)
  const card = typeof cardId === 'string' ? DIRECT_MOTION_POSE_CARDS.find(item => item.id === cardId) : undefined
  if (!card) {
    addDiagnostic(diagnostics, '未知姿势卡，已安全阻断。')
    return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
  }
  if (normalizedPose.malformed) return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)

  const merged: Partial<Record<MotionControlId, number>> = { ...normalizedPose.pose }
  let clamped = normalizedPose.clamped
  for (const [id, value] of Object.entries(card.pose)) {
    if (!isMotionControlId(id) || typeof value !== 'number' || !Number.isFinite(value)) {
      addDiagnostic(diagnostics, '姿势卡包含无效控制，已安全阻断。')
      return frozenSolveResult('blocked', normalizedPose.pose, diagnostics)
    }
    const [safeValue, didClamp] = clampControlValue(id, value)
    merged[id] = safeValue
    clamped ||= didClamp
  }
  if (clamped) addDiagnostic(diagnostics, '姿势卡结果已钳制到 Rig 安全范围。')
  return frozenSolveResult(clamped ? 'clamped' : 'ready', merged, diagnostics)
}
