/**
 * 文件职责 / File responsibility
 * 定义简单动作模式的直接操控能力和快速姿势卡，不包含拖拽求解或界面行为。
 * Defines simple-motion direct manipulation capabilities and quick pose cards without drag solving or UI behavior.
 */
import {
  getMotionBodyPart,
  getMotionBodyPartControls,
  isMotionControlId,
  type MotionBodyPartId,
  type MotionControlDefinition,
  type MotionControlId,
} from './motion-controls'
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
