/**
 * 文件职责 / File responsibility
 * 定义简单动作模式的直接操控能力、快速姿势卡、拖拽与对称纯函数，不包含界面行为。
 * Defines simple-motion capabilities, quick pose cards, and pure drag/symmetry solvers without UI behavior.
 */
import {
  clampMotionControlValue,
  getMotionControl,
  getMotionBodyPart,
  getMotionBodyPartControls,
  isMotionControlId,
  type MotionBodyPartId,
  type MotionControlDefinition,
  type MotionControlId,
} from './motion-controls'
import { getCloudFoxRigChannel } from './cloud-fox-rig'
import {
  SIMPLE_MOTION_STAGE_MAX_INTENSITY,
  type SimpleMotionIntent,
} from './simple-motion-authoring'

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

export type DirectMotionDragSource = 'x' | 'y' | 'depth'

export interface DirectMotionDragBinding {
  readonly mode: DirectMotionMode
  readonly controlId: MotionControlId
  readonly source: DirectMotionDragSource
  readonly sign: 1 | -1
  readonly weight: number
  readonly role: 'primary' | 'auxiliary'
}

export interface DirectMotionSymmetryBinding {
  readonly controlId: MotionControlId
  readonly partnerControlId: MotionControlId
  readonly sign: 1 | -1
}

export interface DirectMotionCapability {
  readonly partId: MotionBodyPartId
  readonly modes: readonly DirectMotionMode[]
  readonly controlIds: readonly MotionControlId[]
  readonly parameters: readonly DirectMotionParameter[]
  readonly dragBindings: readonly DirectMotionDragBinding[]
  readonly symmetryBindings: readonly DirectMotionSymmetryBinding[]
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
  intensity: number
}

export interface DirectMotionSolveResult {
  status: 'ready' | 'clamped' | 'blocked'
  changed: boolean
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

/**
 * 拖拽绑定是每个部位的交互契约，而非从控制 ID 或参数语义推导。
 * primary 绑定决定屏幕三轴的主观感受；只有明确声明的 auxiliary 才会连带细节控制。
 */
const DIRECT_MOTION_DRAG_BINDINGS_BY_PART: Readonly<Partial<Record<MotionBodyPartId, readonly DirectMotionDragBinding[]>>> = {
  root: [
    { mode: 'translate', controlId: 'root.translate.x', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'root.translate.y', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'root.translate.z', source: 'depth', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'root.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'root.rotate.y', source: 'x', sign: 1, weight: 1, role: 'primary' },
  ],
  body: [
    { mode: 'translate', controlId: 'body.translate.x', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'body.translate.y', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'body.translate.z', source: 'depth', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'body.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'body.rotate.y', source: 'x', sign: 1, weight: 1, role: 'primary' },
  ],
  head: [
    { mode: 'translate', controlId: 'head.translate.x', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'head.translate.y', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'translate', controlId: 'head.translate.z', source: 'depth', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'head.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'head.rotate.y', source: 'x', sign: 1, weight: 1, role: 'primary' },
  ],
  'front-paw-left': [
    { mode: 'rotate', controlId: 'front-paw-left.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-left.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-left.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-left.rotate.tip-x', source: 'y', sign: -1, weight: .25, role: 'auxiliary' },
  ],
  'front-paw-right': [
    { mode: 'rotate', controlId: 'front-paw-right.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-right.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-right.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'front-paw-right.rotate.tip-x', source: 'y', sign: -1, weight: .25, role: 'auxiliary' },
  ],
  'hind-paw-left': [
    { mode: 'rotate', controlId: 'hind-paw-left.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'hind-paw-left.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'hind-paw-left.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'hind-paw-right': [
    { mode: 'rotate', controlId: 'hind-paw-right.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'hind-paw-right.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'hind-paw-right.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'ear-left': [
    { mode: 'rotate', controlId: 'ear-left.rotate.z', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'ear-left.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'ear-right': [
    { mode: 'rotate', controlId: 'ear-right.rotate.z', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'ear-right.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'tail-root': [
    { mode: 'rotate', controlId: 'tail-root.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-root.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-root.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'tail-mid': [
    { mode: 'rotate', controlId: 'tail-mid.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-mid.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-mid.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
  'tail-tip': [
    { mode: 'rotate', controlId: 'tail-tip.rotate.z', source: 'x', sign: 1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-tip.rotate.x', source: 'y', sign: -1, weight: 1, role: 'primary' },
    { mode: 'rotate', controlId: 'tail-tip.rotate.y', source: 'depth', sign: 1, weight: 1, role: 'primary' },
  ],
} as const satisfies Partial<Record<MotionBodyPartId, readonly DirectMotionDragBinding[]>>

/**
 * 对称控制对和符号是 Rig 能力的一部分。这里显式声明，Store 与界面不得通过控制 ID 文本猜测左右关系。
 */
const DIRECT_MOTION_SYMMETRY_BINDINGS_BY_PART: Readonly<Partial<Record<MotionBodyPartId, readonly DirectMotionSymmetryBinding[]>>> = {
  'front-paw-left': [
    { controlId: 'front-paw-left.rotate.x', partnerControlId: 'front-paw-right.rotate.x', sign: 1 },
    { controlId: 'front-paw-left.rotate.y', partnerControlId: 'front-paw-right.rotate.y', sign: -1 },
    { controlId: 'front-paw-left.rotate.z', partnerControlId: 'front-paw-right.rotate.z', sign: -1 },
    { controlId: 'front-paw-left.rotate.tip-x', partnerControlId: 'front-paw-right.rotate.tip-x', sign: 1 },
    { controlId: 'front-paw-left.rotate.tip-z', partnerControlId: 'front-paw-right.rotate.tip-z', sign: -1 },
  ],
  'front-paw-right': [
    { controlId: 'front-paw-right.rotate.x', partnerControlId: 'front-paw-left.rotate.x', sign: 1 },
    { controlId: 'front-paw-right.rotate.y', partnerControlId: 'front-paw-left.rotate.y', sign: -1 },
    { controlId: 'front-paw-right.rotate.z', partnerControlId: 'front-paw-left.rotate.z', sign: -1 },
    { controlId: 'front-paw-right.rotate.tip-x', partnerControlId: 'front-paw-left.rotate.tip-x', sign: 1 },
    { controlId: 'front-paw-right.rotate.tip-z', partnerControlId: 'front-paw-left.rotate.tip-z', sign: -1 },
  ],
  'hind-paw-left': [
    { controlId: 'hind-paw-left.rotate.x', partnerControlId: 'hind-paw-right.rotate.x', sign: 1 },
    { controlId: 'hind-paw-left.rotate.y', partnerControlId: 'hind-paw-right.rotate.y', sign: -1 },
    { controlId: 'hind-paw-left.rotate.z', partnerControlId: 'hind-paw-right.rotate.z', sign: -1 },
  ],
  'hind-paw-right': [
    { controlId: 'hind-paw-right.rotate.x', partnerControlId: 'hind-paw-left.rotate.x', sign: 1 },
    { controlId: 'hind-paw-right.rotate.y', partnerControlId: 'hind-paw-left.rotate.y', sign: -1 },
    { controlId: 'hind-paw-right.rotate.z', partnerControlId: 'hind-paw-left.rotate.z', sign: -1 },
  ],
  'ear-left': [
    { controlId: 'ear-left.rotate.x', partnerControlId: 'ear-right.rotate.x', sign: 1 },
    { controlId: 'ear-left.rotate.y', partnerControlId: 'ear-right.rotate.y', sign: -1 },
    { controlId: 'ear-left.rotate.z', partnerControlId: 'ear-right.rotate.z', sign: -1 },
  ],
  'ear-right': [
    { controlId: 'ear-right.rotate.x', partnerControlId: 'ear-left.rotate.x', sign: 1 },
    { controlId: 'ear-right.rotate.y', partnerControlId: 'ear-left.rotate.y', sign: -1 },
    { controlId: 'ear-right.rotate.z', partnerControlId: 'ear-left.rotate.z', sign: -1 },
  ],
} as const satisfies Partial<Record<MotionBodyPartId, readonly DirectMotionSymmetryBinding[]>>

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
    dragBindings: Object.freeze(capability.dragBindings.map(binding => Object.freeze({ ...binding }))),
    symmetryBindings: Object.freeze(capability.symmetryBindings.map(binding => Object.freeze({ ...binding }))),
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
    dragBindings: DIRECT_MOTION_DRAG_BINDINGS_BY_PART[partId] || [],
    symmetryBindings: DIRECT_MOTION_SYMMETRY_BINDINGS_BY_PART[partId] || [],
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

/**
 * 仅把当前手势相对基线真正改变的控制镜像到伙伴部位，避免覆盖伙伴侧未参与本次编辑的姿势。
 */
export function applyDirectMotionSymmetry(
  baselinePose: Readonly<Partial<Record<MotionControlId, number>>>,
  pose: Readonly<Partial<Record<MotionControlId, number>>>,
  partId: MotionBodyPartId,
  enabled: boolean,
): Readonly<Partial<Record<MotionControlId, number>>> {
  const mirrored: Partial<Record<MotionControlId, number>> = { ...pose }
  const capability = DIRECT_MOTION_CAPABILITIES.get(partId)
  if (!enabled || !capability?.symmetryPartnerId) return Object.freeze(mirrored)

  for (const binding of capability.symmetryBindings) {
    const value = pose[binding.controlId]
    if (typeof value !== 'number' || !Number.isFinite(value) || value === baselinePose[binding.controlId]) continue
    mirrored[binding.partnerControlId] = clampMotionControlValue(binding.partnerControlId, value * binding.sign)
  }
  return Object.freeze(mirrored)
}

interface PoseNormalizationResult {
  readonly pose: Partial<Record<MotionControlId, number>>
  readonly malformed: boolean
  readonly clamped: boolean
  readonly changed: boolean
}

interface SafeReadResult {
  readonly ok: boolean
  readonly value: unknown
}

interface FiniteReadResult {
  readonly ok: true
  readonly value: number
}

function addDiagnostic(diagnostics: string[], message: string, terminal = false) {
  if (diagnostics.includes(message)) return
  if (diagnostics.length < DIRECT_MOTION_DIAGNOSTIC_LIMIT) {
    diagnostics.push(message)
    return
  }
  if (terminal) diagnostics[diagnostics.length - 1] = message
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

function rawControlRange(controlId: MotionControlId, intensity = 1): readonly [number, number] {
  const channels = getMotionControl(controlId).channelIds.map(getCloudFoxRigChannel)
  const rawMinimum = Math.max(...channels.map(channel => channel.minimum))
  const rawMaximum = Math.min(...channels.map(channel => channel.maximum))
  return [
    Math.max(rawMinimum, finiteSaturation(rawMinimum / intensity)),
    Math.min(rawMaximum, finiteSaturation(rawMaximum / intensity)),
  ]
}

function finiteSaturation(value: number): number {
  if (Number.isFinite(value)) return value
  if (Number.isNaN(value)) return 0
  return Math.sign(value) * Number.MAX_VALUE
}

function saturatingAdd(left: number, right: number): readonly [number, boolean] {
  const sum = left + right
  if (Number.isFinite(sum)) return [sum, false]
  return [Math.sign(left || right || 1) * Number.MAX_VALUE, true]
}

function clampControlValue(controlId: MotionControlId, value: number, intensity = 1): readonly [number, boolean] {
  const [minimum, maximum] = rawControlRange(controlId, intensity)
  const clamped = Math.max(minimum, Math.min(maximum, value))
  return [clamped, clamped !== value]
}

function normalizeDirectMotionPose(source: unknown, diagnostics: string[], intensity = 1): PoseNormalizationResult {
  const pose: Partial<Record<MotionControlId, number>> = {}
  let entries: [string, unknown][]
  try {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      addDiagnostic(diagnostics, '姿势输入格式异常，已安全阻断。')
      return { pose, malformed: true, clamped: false, changed: false }
    }
    entries = Object.entries(source).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  }
  catch {
    addDiagnostic(diagnostics, '姿势输入无法安全读取，已安全阻断。')
    return { pose, malformed: true, clamped: false, changed: false }
  }

  let malformed = false
  let clamped = false
  let changed = false
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
    const [safeValue, didClamp] = clampControlValue(id, value, intensity)
    pose[id] = safeValue
    if (didClamp) {
      clamped = true
      changed = true
      addDiagnostic(diagnostics, '姿势数值已钳制到 Rig 安全范围。')
    }
  }
  return { pose, malformed, clamped, changed }
}

function frozenSolveResult(
  status: DirectMotionSolveResult['status'],
  changed: boolean,
  pose: Readonly<Partial<Record<MotionControlId, number>>>,
  diagnostics: readonly string[],
): DirectMotionSolveResult {
  return Object.freeze({
    status,
    changed,
    pose: Object.freeze({ ...pose }),
    diagnostics: Object.freeze([...diagnostics]),
  })
}

function normalizedDragValue(value: number, shortSide: number): readonly [number, boolean] {
  const normalized = value / shortSide * DIRECT_MOTION_DRAG_SENSITIVITY
  if (Number.isFinite(normalized)) return [normalized, false]
  return [Math.sign(value || 1) * Number.MAX_VALUE, true]
}

/**
 * 把屏幕拖拽保守映射到已注册的语义控制；这不是 IK，也不会改变缩放或骨骼长度。
 */
export function solveDirectMotionDrag(input: DirectMotionDragInput): DirectMotionSolveResult {
  const diagnostics: string[] = []
  const poseRead = safeRead(input, 'pose')
  const partRead = safeRead(input, 'partId')
  const modeRead = safeRead(input, 'mode')
  const deltaRead = safeRead(input, 'delta')
  const viewportRead = safeRead(input, 'viewport')
  const intensityRead = safeRead(input, 'intensity')
  const intensity = intensityRead.value
  const validIntensity = typeof intensity === 'number'
    && Number.isFinite(intensity)
    && intensity > 0
    && intensity <= SIMPLE_MOTION_STAGE_MAX_INTENSITY
  const normalizedPose = normalizeDirectMotionPose(poseRead.ok ? poseRead.value : undefined, diagnostics, validIntensity ? intensity : 1)
  if (!poseRead.ok) addDiagnostic(diagnostics, '拖拽姿势无法安全读取，已安全阻断。')

  if (!partRead.ok || !modeRead.ok || !deltaRead.ok || !viewportRead.ok) {
    addDiagnostic(diagnostics, '拖拽输入无法安全读取，已安全阻断。', true)
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }
  if (!validIntensity) {
    const message = intensity === 0
      ? '当前阶段力度为 0，请先提高动作力度。'
      : `拖拽强度必须大于 0 且不超过 ${SIMPLE_MOTION_STAGE_MAX_INTENSITY}，已安全阻断。`
    addDiagnostic(diagnostics, message, true)
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }

  const capability = typeof partRead.value === 'string'
    ? DIRECT_MOTION_CAPABILITIES.get(partRead.value as MotionBodyPartId)
    : undefined
  if (!capability || (modeRead.value !== 'translate' && modeRead.value !== 'rotate') || !capability.modes.includes(modeRead.value)) {
    addDiagnostic(diagnostics, '当前部位不支持该直接操控模式，已安全阻断。', true)
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }

  const deltaX = safeRead(deltaRead.value, 'x')
  const deltaY = safeRead(deltaRead.value, 'y')
  const deltaDepth = safeRead(deltaRead.value, 'depth')
  const viewportWidth = safeRead(viewportRead.value, 'width')
  const viewportHeight = safeRead(viewportRead.value, 'height')
  if (!isFiniteRead(deltaX) || !isFiniteRead(deltaY) || !isFiniteRead(deltaDepth) || !isFiniteRead(viewportWidth) || !isFiniteRead(viewportHeight)) {
    addDiagnostic(diagnostics, '拖拽增量或视口含非有限数值，已安全阻断。', true)
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }
  const shortSide = Math.min(viewportWidth.value, viewportHeight.value)
  if (!(shortSide > 0)) {
    addDiagnostic(diagnostics, '视口尺寸必须为正有限数，已安全阻断。', true)
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }
  if (normalizedPose.malformed) return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)

  const bindings = capability.dragBindings.filter(binding => binding.mode === modeRead.value)
  const rawDelta = { x: deltaX.value, y: deltaY.value, depth: deltaDepth.value }
  const normalized: Partial<Record<DirectMotionDragSource, number>> = {}
  let clamped = normalizedPose.clamped
  for (const source of new Set(bindings.map(binding => binding.source))) {
    const [value, overflow] = normalizedDragValue(rawDelta[source], shortSide)
    normalized[source] = value
    clamped ||= overflow
    if (overflow) addDiagnostic(diagnostics, '拖拽增量过大，已按 Rig 安全范围钳制。')
  }

  const pose: Partial<Record<MotionControlId, number>> = { ...normalizedPose.pose }
  let changed = normalizedPose.changed
  for (const binding of bindings) {
    const delta = (normalized[binding.source] ?? 0) * binding.sign * binding.weight
    if (delta === 0) continue
    const baseline = pose[binding.controlId] ?? 0
    const [requested, additionOverflow] = saturatingAdd(baseline, delta)
    const [safeValue, didClamp] = clampControlValue(binding.controlId, requested, intensity)
    clamped ||= didClamp || additionOverflow
    if (safeValue === baseline) continue
    pose[binding.controlId] = safeValue
    changed = true
  }
  if (clamped) addDiagnostic(diagnostics, '拖拽结果已钳制到 Rig 安全范围。')
  return frozenSolveResult(clamped ? 'clamped' : 'ready', changed, pose, diagnostics)
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
    return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
  }
  if (normalizedPose.malformed) return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)

  const merged: Partial<Record<MotionControlId, number>> = { ...normalizedPose.pose }
  let clamped = normalizedPose.clamped
  let changed = normalizedPose.changed
  for (const [id, value] of Object.entries(card.pose)) {
    if (!isMotionControlId(id) || typeof value !== 'number' || !Number.isFinite(value)) {
      addDiagnostic(diagnostics, '姿势卡包含无效控制，已安全阻断。')
      return frozenSolveResult('blocked', false, normalizedPose.pose, diagnostics)
    }
    const [safeValue, didClamp] = clampControlValue(id, value)
    clamped ||= didClamp
    if (merged[id] === safeValue) continue
    merged[id] = safeValue
    changed = true
  }
  if (clamped) addDiagnostic(diagnostics, '姿势卡结果已钳制到 Rig 安全范围。')
  return frozenSolveResult(clamped ? 'clamped' : 'ready', changed, merged, diagnostics)
}
