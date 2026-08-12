/**
 * 文件职责 / File responsibility
 * 定义动作工坊的身体部件控制注册表，并提供当前帧、已选关键帧和整段动作修正的统一编辑命令。
 * Defines the Motion Studio body-part control registry and unified commands for current-frame, selected-keyframe, and whole-motion correction editing.
 */

import {
  getCloudFoxRigChannel,
  type CloudFoxRigChannelId,
} from './cloud-fox-rig'
import {
  collectMotionKeyframes,
  writeMotionChannelValue,
} from './motion-authoring'
import {
  normalizeMotionAsset,
  type MotionInterpolation,
  type MotionKeyframe,
  type MotionTrack,
  type StudioMotionAssetV2,
} from './motion-asset'
import { evaluateNormalizedMotionAsset } from './motion-evaluator'
import { mirrorCloudFoxChannelId } from './motion-advanced'

export const MOTION_CLIP_ADJUSTMENT_LAYER_ID = 'clip-adjustment' as const

export type MotionAuthoringScope = 'current-frame' | 'selected-keyframes' | 'entire-motion'
export type MotionTransformMode = 'translate' | 'rotate' | 'scale' | 'semantic'
export type MotionControlAxis = 'x' | 'y' | 'z' | 'uniform' | 'value'
export type MotionControlDisplayUnit = 'distance' | 'degree' | 'ratio' | 'normalized'

export type MotionBodyPartId =
  | 'root'
  | 'body'
  | 'head'
  | 'front-paw-left'
  | 'front-paw-right'
  | 'hind-paw-left'
  | 'hind-paw-right'
  | 'ear-left'
  | 'ear-right'
  | 'face'
  | 'nose'
  | 'tail-root'
  | 'tail-mid'
  | 'tail-tip'
  | 'antenna-left'
  | 'antenna-right'

export interface MotionBodyPartDefinition {
  id: MotionBodyPartId
  parentId?: MotionBodyPartId
  labelZh: string
  labelEn: string
  icon: string
  symmetryPartnerId?: MotionBodyPartId
}

export interface MotionControlDefinition<TId extends string = string> {
  id: TId
  partId: MotionBodyPartId
  mode: MotionTransformMode
  axis: MotionControlAxis
  labelZh: string
  labelEn: string
  channelIds: readonly CloudFoxRigChannelId[]
  displayUnit: MotionControlDisplayUnit
  step: number
  fineStep: number
  composite?: boolean
}

const control = <TId extends string>(definition: MotionControlDefinition<TId>) => Object.freeze(definition)

export const MOTION_BODY_PARTS: readonly MotionBodyPartDefinition[] = Object.freeze([
  { id: 'root', labelZh: '整只宠物', labelEn: 'Whole pet', icon: '◎' },
  { id: 'body', parentId: 'root', labelZh: '身体', labelEn: 'Body', icon: '⬭' },
  { id: 'front-paw-left', parentId: 'body', labelZh: '左前爪', labelEn: 'Left front paw', icon: 'L', symmetryPartnerId: 'front-paw-right' },
  { id: 'front-paw-right', parentId: 'body', labelZh: '右前爪', labelEn: 'Right front paw', icon: 'R', symmetryPartnerId: 'front-paw-left' },
  { id: 'hind-paw-left', parentId: 'body', labelZh: '左后爪', labelEn: 'Left hind paw', icon: 'L', symmetryPartnerId: 'hind-paw-right' },
  { id: 'hind-paw-right', parentId: 'body', labelZh: '右后爪', labelEn: 'Right hind paw', icon: 'R', symmetryPartnerId: 'hind-paw-left' },
  { id: 'head', parentId: 'root', labelZh: '头部', labelEn: 'Head', icon: '◉' },
  { id: 'ear-left', parentId: 'head', labelZh: '左耳', labelEn: 'Left ear', icon: 'L', symmetryPartnerId: 'ear-right' },
  { id: 'ear-right', parentId: 'head', labelZh: '右耳', labelEn: 'Right ear', icon: 'R', symmetryPartnerId: 'ear-left' },
  { id: 'face', parentId: 'head', labelZh: '眼睛与嘴部', labelEn: 'Eyes and mouth', icon: '◌' },
  { id: 'nose', parentId: 'face', labelZh: '鼻子', labelEn: 'Nose', icon: '◆' },
  { id: 'antenna-left', parentId: 'head', labelZh: '左触角', labelEn: 'Left antenna', icon: 'L', symmetryPartnerId: 'antenna-right' },
  { id: 'antenna-right', parentId: 'head', labelZh: '右触角', labelEn: 'Right antenna', icon: 'R', symmetryPartnerId: 'antenna-left' },
  { id: 'tail-root', parentId: 'root', labelZh: '尾巴根部', labelEn: 'Tail root', icon: '≈' },
  { id: 'tail-mid', parentId: 'tail-root', labelZh: '尾巴中段', labelEn: 'Tail middle', icon: '≈' },
  { id: 'tail-tip', parentId: 'tail-mid', labelZh: '尾巴尖端', labelEn: 'Tail tip', icon: '≈' },
])

export const MOTION_CONTROLS = Object.freeze([
  control({ id: 'root.translate.x', partId: 'root', mode: 'translate', axis: 'x', labelZh: '位置 X', labelEn: 'Position X', channelIds: ['root.position.x'], displayUnit: 'distance', step: .05, fineStep: .01 }),
  control({ id: 'root.translate.y', partId: 'root', mode: 'translate', axis: 'y', labelZh: '位置 Y', labelEn: 'Position Y', channelIds: ['root.position.y'], displayUnit: 'distance', step: .05, fineStep: .01 }),
  control({ id: 'root.translate.z', partId: 'root', mode: 'translate', axis: 'z', labelZh: '位置 Z', labelEn: 'Position Z', channelIds: ['root.position.z'], displayUnit: 'distance', step: .05, fineStep: .01 }),
  control({ id: 'root.rotate.x', partId: 'root', mode: 'rotate', axis: 'x', labelZh: '旋转 X', labelEn: 'Rotation X', channelIds: ['root.rotation.x'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'root.rotate.y', partId: 'root', mode: 'rotate', axis: 'y', labelZh: '旋转 Y', labelEn: 'Rotation Y', channelIds: ['root.rotation.y'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'root.rotate.z', partId: 'root', mode: 'rotate', axis: 'z', labelZh: '旋转 Z', labelEn: 'Rotation Z', channelIds: ['root.rotation.z'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'root.scale.uniform', partId: 'root', mode: 'scale', axis: 'uniform', labelZh: '整体等比缩放', labelEn: 'Uniform scale', channelIds: ['root.scale.x', 'root.scale.y', 'root.scale.z'], displayUnit: 'ratio', step: .05, fineStep: .01, composite: true }),
  control({ id: 'root.scale.x', partId: 'root', mode: 'scale', axis: 'x', labelZh: '缩放 X', labelEn: 'Scale X', channelIds: ['root.scale.x'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'root.scale.y', partId: 'root', mode: 'scale', axis: 'y', labelZh: '缩放 Y', labelEn: 'Scale Y', channelIds: ['root.scale.y'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'root.scale.z', partId: 'root', mode: 'scale', axis: 'z', labelZh: '缩放 Z', labelEn: 'Scale Z', channelIds: ['root.scale.z'], displayUnit: 'ratio', step: .05, fineStep: .01 }),

  control({ id: 'body.translate.x', partId: 'body', mode: 'translate', axis: 'x', labelZh: '身体位置 X', labelEn: 'Body position X', channelIds: ['body.position.x'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'body.translate.y', partId: 'body', mode: 'translate', axis: 'y', labelZh: '身体位置 Y', labelEn: 'Body position Y', channelIds: ['body.position.y'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'body.translate.z', partId: 'body', mode: 'translate', axis: 'z', labelZh: '身体位置 Z', labelEn: 'Body position Z', channelIds: ['body.position.z'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'body.rotate.x', partId: 'body', mode: 'rotate', axis: 'x', labelZh: '身体旋转 X', labelEn: 'Body rotation X', channelIds: ['body.rotation.x'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'body.rotate.y', partId: 'body', mode: 'rotate', axis: 'y', labelZh: '身体旋转 Y', labelEn: 'Body rotation Y', channelIds: ['body.rotation.y'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'body.rotate.z', partId: 'body', mode: 'rotate', axis: 'z', labelZh: '身体旋转 Z', labelEn: 'Body rotation Z', channelIds: ['body.rotation.z'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'body.scale.uniform', partId: 'body', mode: 'scale', axis: 'uniform', labelZh: '身体等比缩放', labelEn: 'Body uniform scale', channelIds: ['body.scale.x', 'body.scale.y', 'body.scale.z'], displayUnit: 'ratio', step: .05, fineStep: .01, composite: true }),
  control({ id: 'body.scale.x', partId: 'body', mode: 'scale', axis: 'x', labelZh: '身体缩放 X', labelEn: 'Body scale X', channelIds: ['body.scale.x'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'body.scale.y', partId: 'body', mode: 'scale', axis: 'y', labelZh: '身体缩放 Y', labelEn: 'Body scale Y', channelIds: ['body.scale.y'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'body.scale.z', partId: 'body', mode: 'scale', axis: 'z', labelZh: '身体缩放 Z', labelEn: 'Body scale Z', channelIds: ['body.scale.z'], displayUnit: 'ratio', step: .05, fineStep: .01 }),

  control({ id: 'head.translate.x', partId: 'head', mode: 'translate', axis: 'x', labelZh: '头部位置 X', labelEn: 'Head position X', channelIds: ['head.position.x'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'head.translate.y', partId: 'head', mode: 'translate', axis: 'y', labelZh: '头部位置 Y', labelEn: 'Head position Y', channelIds: ['head.position.y'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'head.translate.z', partId: 'head', mode: 'translate', axis: 'z', labelZh: '头部位置 Z', labelEn: 'Head position Z', channelIds: ['head.position.z'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'head.rotate.x', partId: 'head', mode: 'rotate', axis: 'x', labelZh: '头部旋转 X', labelEn: 'Head rotation X', channelIds: ['head.rotation.x'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'head.rotate.y', partId: 'head', mode: 'rotate', axis: 'y', labelZh: '头部旋转 Y', labelEn: 'Head rotation Y', channelIds: ['head.rotation.y'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'head.rotate.z', partId: 'head', mode: 'rotate', axis: 'z', labelZh: '头部旋转 Z', labelEn: 'Head rotation Z', channelIds: ['head.rotation.z'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'head.scale.dynamic', partId: 'head', mode: 'scale', axis: 'uniform', labelZh: '头部动态比例', labelEn: 'Animated head scale', channelIds: ['head.scale'], displayUnit: 'ratio', step: .05, fineStep: .01 }),

  ...sideRotationControls('front-paw-left', 'frontPaw.left', '左前爪', 'Left front paw'),
  ...sideRotationControls('front-paw-right', 'frontPaw.right', '右前爪', 'Right front paw'),
  control({ id: 'front-paw-left.scale.length', partId: 'front-paw-left', mode: 'scale', axis: 'uniform', labelZh: '左前爪长度', labelEn: 'Left front paw length', channelIds: ['frontPaw.left.length'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'front-paw-right.scale.length', partId: 'front-paw-right', mode: 'scale', axis: 'uniform', labelZh: '右前爪长度', labelEn: 'Right front paw length', channelIds: ['frontPaw.right.length'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'front-paw-left.rotate.tip-x', partId: 'front-paw-left', mode: 'rotate', axis: 'x', labelZh: '左爪尖弯曲', labelEn: 'Left paw tip bend', channelIds: ['frontPaw.left.tip.rotation.x'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'front-paw-left.rotate.tip-z', partId: 'front-paw-left', mode: 'rotate', axis: 'z', labelZh: '左爪尖侧摆', labelEn: 'Left paw tip side', channelIds: ['frontPaw.left.tip.rotation.z'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'front-paw-right.rotate.tip-x', partId: 'front-paw-right', mode: 'rotate', axis: 'x', labelZh: '右爪尖弯曲', labelEn: 'Right paw tip bend', channelIds: ['frontPaw.right.tip.rotation.x'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  control({ id: 'front-paw-right.rotate.tip-z', partId: 'front-paw-right', mode: 'rotate', axis: 'z', labelZh: '右爪尖侧摆', labelEn: 'Right paw tip side', channelIds: ['frontPaw.right.tip.rotation.z'], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),

  ...sideRotationControls('hind-paw-left', 'hindPaw.left', '左后爪', 'Left hind paw'),
  ...sideRotationControls('hind-paw-right', 'hindPaw.right', '右后爪', 'Right hind paw'),
  ...sideRotationControls('ear-left', 'ear.left', '左耳', 'Left ear'),
  ...sideRotationControls('ear-right', 'ear.right', '右耳', 'Right ear'),
  ...sideRotationControls('tail-root', 'tail.root', '尾巴根部', 'Tail root'),
  ...sideRotationControls('tail-mid', 'tail.mid', '尾巴中段', 'Tail middle'),
  ...sideRotationControls('tail-tip', 'tail.tip', '尾巴尖端', 'Tail tip'),
  ...sideRotationControls('antenna-left', 'antenna.left', '左触角', 'Left antenna'),
  ...sideRotationControls('antenna-right', 'antenna.right', '右触角', 'Right antenna'),
  control({ id: 'antenna-left.scale.length', partId: 'antenna-left', mode: 'scale', axis: 'uniform', labelZh: '左触角长度', labelEn: 'Left antenna length', channelIds: ['antenna.left.length'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'antenna-right.scale.length', partId: 'antenna-right', mode: 'scale', axis: 'uniform', labelZh: '右触角长度', labelEn: 'Right antenna length', channelIds: ['antenna.right.length'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'antenna-left.semantic.glow', partId: 'antenna-left', mode: 'semantic', axis: 'value', labelZh: '触角发光', labelEn: 'Antenna glow', channelIds: ['antenna.glow'], displayUnit: 'normalized', step: .1, fineStep: .02 }),

  control({ id: 'face.scale.eye', partId: 'face', mode: 'scale', axis: 'uniform', labelZh: '眼睛动态比例', labelEn: 'Animated eye scale', channelIds: ['eye.scale'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'face.scale.pupil', partId: 'face', mode: 'scale', axis: 'uniform', labelZh: '瞳孔比例', labelEn: 'Pupil scale', channelIds: ['eye.pupilScale'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'face.semantic.gaze-x', partId: 'face', mode: 'semantic', axis: 'x', labelZh: '视线 X', labelEn: 'Gaze X', channelIds: ['eye.gaze.x'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic.gaze-y', partId: 'face', mode: 'semantic', axis: 'y', labelZh: '视线 Y', labelEn: 'Gaze Y', channelIds: ['eye.gaze.y'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic.spacing', partId: 'face', mode: 'semantic', axis: 'x', labelZh: '眼距动态偏移', labelEn: 'Animated eye spacing', channelIds: ['eye.spacing'], displayUnit: 'distance', step: .04, fineStep: .01 }),
  control({ id: 'face.semantic.tilt', partId: 'face', mode: 'semantic', axis: 'value', labelZh: '眼部表情倾斜', labelEn: 'Eye expression tilt', channelIds: ['eye.expressionTilt'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic-eye-left', partId: 'face', mode: 'semantic', axis: 'value', labelZh: '左眼闭合', labelEn: 'Left eye closure', channelIds: ['eye.left.closure'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic-eye-right', partId: 'face', mode: 'semantic', axis: 'value', labelZh: '右眼闭合', labelEn: 'Right eye closure', channelIds: ['eye.right.closure'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic-mouth', partId: 'face', mode: 'semantic', axis: 'value', labelZh: '嘴部开合', labelEn: 'Mouth opening', channelIds: ['mouth.open'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'face.semantic-mouth-curve', partId: 'face', mode: 'semantic', axis: 'value', labelZh: '嘴部表情曲线', labelEn: 'Mouth expression curve', channelIds: ['mouth.curve'], displayUnit: 'normalized', step: .1, fineStep: .02 }),

  control({ id: 'nose.translate.y', partId: 'nose', mode: 'translate', axis: 'y', labelZh: '鼻子上下偏移', labelEn: 'Nose offset Y', channelIds: ['nose.offset.y'], displayUnit: 'distance', step: .03, fineStep: .01 }),
  control({ id: 'nose.scale.x', partId: 'nose', mode: 'scale', axis: 'x', labelZh: '鼻子缩放 X', labelEn: 'Nose scale X', channelIds: ['nose.scale.x'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'nose.scale.y', partId: 'nose', mode: 'scale', axis: 'y', labelZh: '鼻子缩放 Y', labelEn: 'Nose scale Y', channelIds: ['nose.scale.y'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'nose.scale.z', partId: 'nose', mode: 'scale', axis: 'z', labelZh: '鼻子缩放 Z', labelEn: 'Nose scale Z', channelIds: ['nose.scale.z'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'nose.semantic.sniff', partId: 'nose', mode: 'semantic', axis: 'value', labelZh: '嗅闻强度', labelEn: 'Sniff intensity', channelIds: ['nose.sniff'], displayUnit: 'normalized', step: .1, fineStep: .02 }),
  control({ id: 'nose.semantic.glow', partId: 'nose', mode: 'semantic', axis: 'value', labelZh: '鼻子发光', labelEn: 'Nose glow', channelIds: ['nose.glow'], displayUnit: 'normalized', step: .1, fineStep: .02 }),

  control({ id: 'tail-root.scale.length', partId: 'tail-root', mode: 'scale', axis: 'uniform', labelZh: '尾巴动态长度', labelEn: 'Animated tail length', channelIds: ['tail.length'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
  control({ id: 'tail-root.scale.fluff', partId: 'tail-root', mode: 'scale', axis: 'uniform', labelZh: '尾巴蓬松比例', labelEn: 'Tail fluff', channelIds: ['tail.fluff'], displayUnit: 'ratio', step: .05, fineStep: .01 }),
] as const)

function sideRotationControls<TPart extends MotionBodyPartId, TPrefix extends string>(partId: TPart, prefix: TPrefix, labelZh: string, labelEn: string) {
  return [
    control({ id: `${partId}.rotate.x`, partId, mode: 'rotate', axis: 'x', labelZh: `${labelZh}旋转 X`, labelEn: `${labelEn} rotation X`, channelIds: [`${prefix}.rotation.x` as CloudFoxRigChannelId], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
    control({ id: `${partId}.rotate.y`, partId, mode: 'rotate', axis: 'y', labelZh: `${labelZh}旋转 Y`, labelEn: `${labelEn} rotation Y`, channelIds: [`${prefix}.rotation.y` as CloudFoxRigChannelId], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
    control({ id: `${partId}.rotate.z`, partId, mode: 'rotate', axis: 'z', labelZh: `${labelZh}旋转 Z`, labelEn: `${labelEn} rotation Z`, channelIds: [`${prefix}.rotation.z` as CloudFoxRigChannelId], displayUnit: 'degree', step: Math.PI / 36, fineStep: Math.PI / 180 }),
  ] as const
}

export type MotionControlId = typeof MOTION_CONTROLS[number]['id']

const BODY_PART_MAP = new Map(MOTION_BODY_PARTS.map(item => [item.id, item]))
const CONTROL_MAP = new Map<string, MotionControlDefinition>(MOTION_CONTROLS.map(item => [item.id, item]))
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

export function isMotionBodyPartId(value: unknown): value is MotionBodyPartId {
  return typeof value === 'string' && BODY_PART_MAP.has(value as MotionBodyPartId)
}

export function isMotionControlId(value: unknown): value is MotionControlId {
  return typeof value === 'string' && CONTROL_MAP.has(value)
}

export function getMotionBodyPart(id: MotionBodyPartId): MotionBodyPartDefinition {
  return BODY_PART_MAP.get(id) as MotionBodyPartDefinition
}

export function getMotionBodyPartChildren(parentId?: MotionBodyPartId): readonly MotionBodyPartDefinition[] {
  return MOTION_BODY_PARTS.filter(item => item.parentId === parentId)
}

export function getMotionBodyPartControls(partId: MotionBodyPartId, mode?: MotionTransformMode): readonly MotionControlDefinition[] {
  return MOTION_CONTROLS.filter(item => item.partId === partId && (!mode || item.mode === mode))
}

export function getMotionBodyPartModes(partId: MotionBodyPartId): readonly MotionTransformMode[] {
  return [...new Set(getMotionBodyPartControls(partId).map(item => item.mode))]
}

export function getMotionControl(id: MotionControlId | string): MotionControlDefinition {
  const definition = CONTROL_MAP.get(id)
  if (!definition) throw new Error(`Unknown motion control: ${id}`)
  return definition
}

/**
 * 返回阶段原始控制值在给定力度下的安全范围。最终编译会把姿势乘以力度，因此范围取
 * Rig 原始边界与 `Rig 边界 / 力度` 的交集；低力度不会反向放宽既有姿势。
 */
export function getIntensityAdjustedMotionControlRange(
  controlId: MotionControlId,
  intensity = 1,
): readonly [number, number] {
  if (!Number.isFinite(intensity) || intensity <= 0) return Object.freeze([0, 0] as const)
  const channels = getMotionControl(controlId).channelIds.map(getCloudFoxRigChannel)
  const rawMinimum = Math.max(...channels.map(channel => channel.minimum))
  const rawMaximum = Math.min(...channels.map(channel => channel.maximum))
  const adjustedMinimum = rawMinimum / intensity
  const adjustedMaximum = rawMaximum / intensity
  return Object.freeze([
    Math.max(rawMinimum, Number.isFinite(adjustedMinimum) ? adjustedMinimum : rawMinimum),
    Math.min(rawMaximum, Number.isFinite(adjustedMaximum) ? adjustedMaximum : rawMaximum),
  ] as const)
}

export function toMotionControlDisplayValue(value: number, unit: MotionControlDisplayUnit): number {
  return unit === 'degree' ? value * 180 / Math.PI : value
}

export function fromMotionControlDisplayValue(value: number, unit: MotionControlDisplayUnit): number {
  return unit === 'degree' ? value * Math.PI / 180 : value
}

export interface MotionControlEditOptions {
  scope: MotionAuthoringScope
  playheadTimeMs: number
  selectedKeyframeIds?: readonly string[]
  interpolation?: MotionInterpolation
  snapToFrames?: boolean
  displayFps?: number
  layerId?: string
  symmetry?: boolean
}

export interface MotionControlEditResult {
  asset: StudioMotionAssetV2
  selectedKeyframeIds: string[]
  affectedChannelIds: CloudFoxRigChannelId[]
}

interface ChannelAssignment {
  channelId: CloudFoxRigChannelId
  value: number
}

export function readMotionControlValue(
  assetInput: StudioMotionAssetV2,
  controlId: MotionControlId | string,
  scope: MotionAuthoringScope,
  options: Pick<MotionControlEditOptions, 'playheadTimeMs' | 'selectedKeyframeIds'>,
): number | undefined {
  const asset = normalizeMotionAsset(assetInput).asset
  const definition = getMotionControl(controlId)
  let values: number[] = []
  if (scope === 'current-frame') {
    const pose = evaluateNormalizedMotionAsset(asset, options.playheadTimeMs)
    values = definition.channelIds.map(channelId => pose.values[channelId])
  }
  else if (scope === 'entire-motion') {
    values = definition.channelIds.map(channelId => {
      const track = asset.tracks.find(item => item.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID && item.channelId === channelId)
      return track?.keyframes[0]?.value ?? 0
    })
  }
  else {
    const selected = new Set(options.selectedKeyframeIds || [])
    values = collectMotionKeyframes(asset)
      .filter(item => selected.has(item.keyframeId) && definition.channelIds.includes(item.channelId))
      .map(item => item.value)
  }
  if (!values.length) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function setMotionControlValue(
  assetInput: StudioMotionAssetV2,
  controlId: MotionControlId | string,
  value: number,
  options: MotionControlEditOptions,
): MotionControlEditResult {
  return applyMotionControl(assetInput, controlId, value, 'absolute', options)
}

export function nudgeMotionControlValue(
  assetInput: StudioMotionAssetV2,
  controlId: MotionControlId | string,
  delta: number,
  options: MotionControlEditOptions,
): MotionControlEditResult {
  return applyMotionControl(assetInput, controlId, delta, 'delta', options)
}

export function resetMotionControlValue(
  assetInput: StudioMotionAssetV2,
  controlId: MotionControlId | string,
  options: MotionControlEditOptions,
): MotionControlEditResult {
  return setMotionControlValue(assetInput, controlId, 0, options)
}

export function nudgeMotionControls(
  assetInput: StudioMotionAssetV2,
  edits: readonly { controlId: MotionControlId | string; delta: number }[],
  options: MotionControlEditOptions,
): MotionControlEditResult {
  let result: MotionControlEditResult = {
    asset: normalizeMotionAsset(assetInput).asset,
    selectedKeyframeIds: [...(options.selectedKeyframeIds || [])],
    affectedChannelIds: [],
  }
  for (const edit of edits) {
    result = nudgeMotionControlValue(result.asset, edit.controlId, edit.delta, {
      ...options,
      selectedKeyframeIds: result.selectedKeyframeIds,
    })
  }
  return result
}

function applyMotionControl(
  assetInput: StudioMotionAssetV2,
  controlId: MotionControlId | string,
  value: number,
  operation: 'absolute' | 'delta',
  options: MotionControlEditOptions,
): MotionControlEditResult {
  const asset = normalizeMotionAsset(assetInput).asset
  const definition = getMotionControl(controlId)
  const baseAssignments = definition.channelIds.map(channelId => ({ channelId, value: finite(value) }))
  const assignments = expandSymmetryAssignments(baseAssignments, options.symmetry === true)

  if (options.scope === 'entire-motion') {
    const next = applyEntireMotionAssignments(asset, assignments, operation)
    return { asset: next, selectedKeyframeIds: [...(options.selectedKeyframeIds || [])], affectedChannelIds: assignments.map(item => item.channelId) }
  }
  if (options.scope === 'selected-keyframes') {
    return applySelectedKeyframeAssignments(asset, assignments, operation, options.selectedKeyframeIds || [])
  }
  return applyCurrentFrameAssignments(asset, assignments, operation, options)
}

function applyCurrentFrameAssignments(
  assetInput: StudioMotionAssetV2,
  assignments: readonly ChannelAssignment[],
  operation: 'absolute' | 'delta',
  options: MotionControlEditOptions,
): MotionControlEditResult {
  let asset = assetInput
  const selectedKeyframeIds: string[] = []
  const pose = evaluateNormalizedMotionAsset(asset, options.playheadTimeMs)
  for (const assignment of assignments) {
    const nextValue = operation === 'delta' ? pose.values[assignment.channelId] + assignment.value : assignment.value
    const result = writeMotionChannelValue(asset, assignment.channelId, options.playheadTimeMs, nextValue, options.interpolation || 'smooth', {
      snapToFrames: options.snapToFrames,
      displayFps: options.displayFps || asset.displayFps,
      layerId: options.layerId || 'base',
    })
    asset = result.asset
    selectedKeyframeIds.push(...result.selectedKeyframeIds)
  }
  return { asset, selectedKeyframeIds: [...new Set(selectedKeyframeIds)], affectedChannelIds: assignments.map(item => item.channelId) }
}

function applySelectedKeyframeAssignments(
  assetInput: StudioMotionAssetV2,
  assignments: readonly ChannelAssignment[],
  operation: 'absolute' | 'delta',
  selectedKeyframeIds: readonly string[],
): MotionControlEditResult {
  const selected = new Set(selectedKeyframeIds)
  const assignmentMap = new Map(assignments.map(item => [item.channelId, item.value]))
  const asset = normalizeMotionAsset(assetInput).asset
  const affected = new Set<CloudFoxRigChannelId>()
  const tracks: MotionTrack[] = asset.tracks.map(track => {
    const assigned = assignmentMap.get(track.channelId)
    if (assigned === undefined) return track
    let changed = false
    const keyframes = track.keyframes.map((keyframe): MotionKeyframe => {
      if (!selected.has(keyframe.id)) return keyframe
      changed = true
      affected.add(track.channelId)
      return { ...keyframe, value: operation === 'delta' ? keyframe.value + assigned : assigned }
    })
    return changed ? { ...track, keyframes } : track
  })
  const normalized = normalizeMotionAsset({ ...asset, tracks, updatedAt: Date.now() }).asset
  return { asset: normalized, selectedKeyframeIds: [...selectedKeyframeIds], affectedChannelIds: [...affected] }
}

function applyEntireMotionAssignments(
  assetInput: StudioMotionAssetV2,
  assignments: readonly ChannelAssignment[],
  operation: 'absolute' | 'delta',
): StudioMotionAssetV2 {
  const asset = normalizeMotionAsset(assetInput).asset
  const assignmentMap = new Map(assignments.map(item => [item.channelId, item.value]))
  const affected = new Set(assignmentMap.keys())
  const otherTracks = asset.tracks.filter(track => !(track.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID && affected.has(track.channelId)))
  const correctionTracks: MotionTrack[] = []

  for (const [channelId, value] of assignmentMap) {
    const existing = asset.tracks.find(track => track.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID && track.channelId === channelId)
    const current = existing?.keyframes[0]?.value ?? 0
    const nextValue = operation === 'delta' ? current + value : value
    if (Math.abs(nextValue) < 1e-9) continue
    correctionTracks.push({
      id: existing?.id || `track-${MOTION_CLIP_ADJUSTMENT_LAYER_ID}-${channelId}`,
      channelId,
      layerId: MOTION_CLIP_ADJUSTMENT_LAYER_ID,
      muted: false,
      keyframes: [
        { id: `key-${MOTION_CLIP_ADJUSTMENT_LAYER_ID}-${channelId.replaceAll('.', '-')}-0`, timeMs: 0, value: nextValue, interpolation: 'linear' },
        { id: `key-${MOTION_CLIP_ADJUSTMENT_LAYER_ID}-${channelId.replaceAll('.', '-')}-end`, timeMs: asset.durationMs, value: nextValue, interpolation: 'linear' },
      ],
    })
  }

  const hasOtherCorrections = otherTracks.some(track => track.layerId === MOTION_CLIP_ADJUSTMENT_LAYER_ID)
  const layers = hasOtherCorrections || correctionTracks.length
    ? [
        ...asset.layers.filter(layer => layer.id !== MOTION_CLIP_ADJUSTMENT_LAYER_ID),
        { id: MOTION_CLIP_ADJUSTMENT_LAYER_ID, name: 'Clip adjustment', enabled: true, weight: 1, mode: 'additive' as const, priority: 100 },
      ]
    : asset.layers.filter(layer => layer.id !== MOTION_CLIP_ADJUSTMENT_LAYER_ID)

  return normalizeMotionAsset({ ...asset, layers, tracks: [...otherTracks, ...correctionTracks], updatedAt: Date.now() }).asset
}

function expandSymmetryAssignments(assignments: readonly ChannelAssignment[], enabled: boolean): ChannelAssignment[] {
  const byChannel = new Map<CloudFoxRigChannelId, number>()
  for (const assignment of assignments) {
    byChannel.set(assignment.channelId, assignment.value)
    if (!enabled) continue
    const mirroredId = mirrorCloudFoxChannelId(assignment.channelId)
    if (mirroredId === assignment.channelId) continue
    byChannel.set(mirroredId, shouldInvertMirroredValue(assignment.channelId) ? -assignment.value : assignment.value)
  }
  return [...byChannel.entries()].map(([channelId, value]) => ({ channelId, value }))
}

function shouldInvertMirroredValue(channelId: CloudFoxRigChannelId): boolean {
  return channelId.endsWith('.y') || channelId.endsWith('.z') || channelId === 'eye.gaze.x' || channelId === 'root.position.x'
}

export function clampMotionControlValue(controlId: MotionControlId | string, value: number): number {
  const definition = getMotionControl(controlId)
  const minimum = Math.max(...definition.channelIds.map(channelId => getCloudFoxRigChannel(channelId).minimum))
  const maximum = Math.min(...definition.channelIds.map(channelId => getCloudFoxRigChannel(channelId).maximum))
  return round(Math.max(minimum, Math.min(maximum, finite(value))))
}
