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
export type DirectMotionSemantic = 'horizontal' | 'vertical' | 'depth' | 'swing' | 'spread' | 'twist' | 'bend'

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

function directSemantic(control: MotionControlDefinition): DirectMotionSemantic {
  if (control.mode === 'translate') {
    if (control.axis === 'x') return 'horizontal'
    if (control.axis === 'y') return 'vertical'
    return 'depth'
  }
  if (control.id.endsWith('.rotate.tip-x')) return 'bend'
  if (control.id.endsWith('.rotate.tip-z')) return 'spread'
  if (control.axis === 'x') return 'swing'
  if (control.axis === 'y') return 'twist'
  return 'spread'
}

function isRegisteredMotionControl(control: MotionControlDefinition): control is MotionControlDefinition<MotionControlId> {
  return isMotionControlId(control.id)
}

function directLabelZh(semantic: DirectMotionSemantic): string {
  const labels: Record<DirectMotionSemantic, string> = {
    horizontal: '左右移动',
    vertical: '上下移动',
    depth: '前后移动',
    swing: '前后摆动',
    spread: '左右展开',
    twist: '扭转',
    bend: '弯曲',
  }
  return labels[semantic]
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
    parameters: controls.map(control => {
      const semantic = directSemantic(control)
      return { semantic, labelZh: directLabelZh(semantic), controlId: control.id }
    }),
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
  poseCard('ear-left-perk', 'ear-left', ['daily'], '竖耳', '◁', { 'ear-left.rotate.z': -.3 }),
  poseCard('ear-right-perk', 'ear-right', ['daily'], '竖耳', '▷', { 'ear-right.rotate.z': .3 }),

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
