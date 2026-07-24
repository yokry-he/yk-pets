/**
 * 文件职责 / File responsibility
 * 定义与 Three.js 节点路径解耦的云狐语义 Rig、稳定通道范围和动作工坊分组。
 * Defines the stable Cloud Fox semantic Rig, channel ranges, and Motion Studio groups independently of Three.js node paths.
 */

export const CLOUD_FOX_SEMANTIC_RIG_ID = 'cloud-fox-semantic-rig/v1' as const

export type MotionChannelUnit = 'normalized-distance' | 'radian' | 'ratio-delta' | 'normalized'
export type MotionChannelBlendMode = 'add' | 'multiply-from-neutral' | 'semantic-override'

export interface RigChannelDefinition<TId extends string = string> {
  id: TId
  labelZh: string
  labelEn: string
  unit: MotionChannelUnit
  neutral: number
  minimum: number
  maximum: number
  blendMode: MotionChannelBlendMode
}

const distance = <TId extends string>(id: TId, labelZh: string, labelEn: string, minimum = -4, maximum = 4): RigChannelDefinition<TId> => ({
  id,
  labelZh,
  labelEn,
  unit: 'normalized-distance',
  neutral: 0,
  minimum,
  maximum,
  blendMode: 'add',
})

const rotation = <TId extends string>(id: TId, labelZh: string, labelEn: string, minimum = -Math.PI * 2, maximum = Math.PI * 2): RigChannelDefinition<TId> => ({
  id,
  labelZh,
  labelEn,
  unit: 'radian',
  neutral: 0,
  minimum,
  maximum,
  blendMode: 'add',
})

const ratio = <TId extends string>(id: TId, labelZh: string, labelEn: string, minimum = -.75, maximum = 2): RigChannelDefinition<TId> => ({
  id,
  labelZh,
  labelEn,
  unit: 'ratio-delta',
  neutral: 0,
  minimum,
  maximum,
  blendMode: 'multiply-from-neutral',
})

const normalized = <TId extends string>(id: TId, labelZh: string, labelEn: string, minimum = 0, maximum = 1): RigChannelDefinition<TId> => ({
  id,
  labelZh,
  labelEn,
  unit: 'normalized',
  neutral: 0,
  minimum,
  maximum,
  blendMode: 'semantic-override',
})

export const CLOUD_FOX_RIG_CHANNELS = Object.freeze([
  distance('root.position.x', '根节点位移 X', 'Root position X'),
  distance('root.position.y', '根节点位移 Y', 'Root position Y'),
  distance('root.position.z', '根节点位移 Z', 'Root position Z'),
  rotation('root.rotation.x', '根节点旋转 X', 'Root rotation X'),
  rotation('root.rotation.y', '根节点旋转 Y', 'Root rotation Y'),
  rotation('root.rotation.z', '根节点旋转 Z', 'Root rotation Z'),
  ratio('root.scale.x', '根节点缩放 X', 'Root scale X'),
  ratio('root.scale.y', '根节点缩放 Y', 'Root scale Y'),
  ratio('root.scale.z', '根节点缩放 Z', 'Root scale Z'),

  distance('body.position.x', '身体位移 X', 'Body position X', -1, 1),
  distance('body.position.y', '身体位移 Y', 'Body position Y', -1, 1),
  distance('body.position.z', '身体位移 Z', 'Body position Z', -1, 1),
  rotation('body.rotation.x', '身体旋转 X', 'Body rotation X', -Math.PI, Math.PI),
  rotation('body.rotation.y', '身体旋转 Y', 'Body rotation Y', -Math.PI, Math.PI),
  rotation('body.rotation.z', '身体旋转 Z', 'Body rotation Z', -Math.PI, Math.PI),
  ratio('body.scale.x', '身体缩放 X', 'Body scale X', -.5, 1.5),
  ratio('body.scale.y', '身体缩放 Y', 'Body scale Y', -.5, 1.5),
  ratio('body.scale.z', '身体缩放 Z', 'Body scale Z', -.5, 1.5),

  distance('head.position.x', '头部位移 X', 'Head position X', -1, 1),
  distance('head.position.y', '头部位移 Y', 'Head position Y', -1, 1),
  distance('head.position.z', '头部位移 Z', 'Head position Z', -1, 1),
  rotation('head.rotation.x', '头部旋转 X', 'Head rotation X', -Math.PI, Math.PI),
  rotation('head.rotation.y', '头部旋转 Y', 'Head rotation Y', -Math.PI, Math.PI),
  rotation('head.rotation.z', '头部旋转 Z', 'Head rotation Z', -Math.PI, Math.PI),

  rotation('frontPaw.left.rotation.x', '左前爪旋转 X', 'Left front paw rotation X', -Math.PI, Math.PI),
  rotation('frontPaw.left.rotation.y', '左前爪旋转 Y', 'Left front paw rotation Y', -Math.PI, Math.PI),
  rotation('frontPaw.left.rotation.z', '左前爪旋转 Z', 'Left front paw rotation Z', -Math.PI, Math.PI),
  ratio('frontPaw.left.length', '左前爪长度偏移', 'Left front paw length offset', -.5, 1),
  rotation('frontPaw.left.tip.rotation.x', '左前爪尖旋转 X', 'Left front paw tip rotation X', -Math.PI, Math.PI),
  rotation('frontPaw.left.tip.rotation.z', '左前爪尖旋转 Z', 'Left front paw tip rotation Z', -Math.PI, Math.PI),
  rotation('frontPaw.right.rotation.x', '右前爪旋转 X', 'Right front paw rotation X', -Math.PI, Math.PI),
  rotation('frontPaw.right.rotation.y', '右前爪旋转 Y', 'Right front paw rotation Y', -Math.PI, Math.PI),
  rotation('frontPaw.right.rotation.z', '右前爪旋转 Z', 'Right front paw rotation Z', -Math.PI, Math.PI),
  ratio('frontPaw.right.length', '右前爪长度偏移', 'Right front paw length offset', -.5, 1),
  rotation('frontPaw.right.tip.rotation.x', '右前爪尖旋转 X', 'Right front paw tip rotation X', -Math.PI, Math.PI),
  rotation('frontPaw.right.tip.rotation.z', '右前爪尖旋转 Z', 'Right front paw tip rotation Z', -Math.PI, Math.PI),

  rotation('hindPaw.left.rotation.x', '左后爪旋转 X', 'Left hind paw rotation X', -Math.PI, Math.PI),
  rotation('hindPaw.left.rotation.y', '左后爪旋转 Y', 'Left hind paw rotation Y', -Math.PI, Math.PI),
  rotation('hindPaw.left.rotation.z', '左后爪旋转 Z', 'Left hind paw rotation Z', -Math.PI, Math.PI),
  rotation('hindPaw.right.rotation.x', '右后爪旋转 X', 'Right hind paw rotation X', -Math.PI, Math.PI),
  rotation('hindPaw.right.rotation.y', '右后爪旋转 Y', 'Right hind paw rotation Y', -Math.PI, Math.PI),
  rotation('hindPaw.right.rotation.z', '右后爪旋转 Z', 'Right hind paw rotation Z', -Math.PI, Math.PI),

  rotation('ear.left.rotation.x', '左耳旋转 X', 'Left ear rotation X', -Math.PI, Math.PI),
  rotation('ear.left.rotation.y', '左耳旋转 Y', 'Left ear rotation Y', -Math.PI, Math.PI),
  rotation('ear.left.rotation.z', '左耳旋转 Z', 'Left ear rotation Z', -Math.PI, Math.PI),
  rotation('ear.right.rotation.x', '右耳旋转 X', 'Right ear rotation X', -Math.PI, Math.PI),
  rotation('ear.right.rotation.y', '右耳旋转 Y', 'Right ear rotation Y', -Math.PI, Math.PI),
  rotation('ear.right.rotation.z', '右耳旋转 Z', 'Right ear rotation Z', -Math.PI, Math.PI),

  normalized('eye.left.closure', '左眼闭合', 'Left eye closure'),
  normalized('eye.right.closure', '右眼闭合', 'Right eye closure'),
  normalized('eye.gaze.x', '视线 X', 'Eye gaze X', -1, 1),
  normalized('eye.gaze.y', '视线 Y', 'Eye gaze Y', -1, 1),
  normalized('mouth.open', '嘴部开合', 'Mouth opening'),

  rotation('tail.root.rotation.x', '尾根旋转 X', 'Tail root rotation X', -Math.PI, Math.PI),
  rotation('tail.root.rotation.y', '尾根旋转 Y', 'Tail root rotation Y', -Math.PI, Math.PI),
  rotation('tail.root.rotation.z', '尾根旋转 Z', 'Tail root rotation Z', -Math.PI * 2, Math.PI * 2),
  rotation('tail.mid.rotation.x', '尾中段旋转 X', 'Tail middle rotation X', -Math.PI, Math.PI),
  rotation('tail.mid.rotation.y', '尾中段旋转 Y', 'Tail middle rotation Y', -Math.PI, Math.PI),
  rotation('tail.mid.rotation.z', '尾中段旋转 Z', 'Tail middle rotation Z', -Math.PI, Math.PI),
  rotation('tail.tip.rotation.x', '尾尖旋转 X', 'Tail tip rotation X', -Math.PI, Math.PI),
  rotation('tail.tip.rotation.y', '尾尖旋转 Y', 'Tail tip rotation Y', -Math.PI, Math.PI),
  rotation('tail.tip.rotation.z', '尾尖旋转 Z', 'Tail tip rotation Z', -Math.PI, Math.PI),

  rotation('antenna.left.rotation.x', '左触角旋转 X', 'Left antenna rotation X', -Math.PI, Math.PI),
  rotation('antenna.left.rotation.y', '左触角旋转 Y', 'Left antenna rotation Y', -Math.PI, Math.PI),
  rotation('antenna.left.rotation.z', '左触角旋转 Z', 'Left antenna rotation Z', -Math.PI, Math.PI),
  ratio('antenna.left.length', '左触角长度偏移', 'Left antenna length offset', -.5, 1),
  rotation('antenna.right.rotation.x', '右触角旋转 X', 'Right antenna rotation X', -Math.PI, Math.PI),
  rotation('antenna.right.rotation.y', '右触角旋转 Y', 'Right antenna rotation Y', -Math.PI, Math.PI),
  rotation('antenna.right.rotation.z', '右触角旋转 Z', 'Right antenna rotation Z', -Math.PI, Math.PI),
  ratio('antenna.right.length', '右触角长度偏移', 'Right antenna length offset', -.5, 1),
] as const)

export type CloudFoxRigChannelId = typeof CLOUD_FOX_RIG_CHANNELS[number]['id']

export interface CloudFoxRigTrackGroup {
  id: 'root' | 'body' | 'head' | 'front-paws' | 'hind-paws' | 'ears' | 'face' | 'tail' | 'antennae'
  labelZh: string
  labelEn: string
  channelIds: readonly CloudFoxRigChannelId[]
}

const channelIdsByPrefix = (prefixes: readonly string[]) => CLOUD_FOX_RIG_CHANNELS
  .filter(channel => prefixes.some(prefix => channel.id.startsWith(prefix)))
  .map(channel => channel.id)

export const CLOUD_FOX_RIG_TRACK_GROUPS: readonly CloudFoxRigTrackGroup[] = Object.freeze([
  { id: 'root', labelZh: '宠物根节点', labelEn: 'Pet root', channelIds: channelIdsByPrefix(['root.']) },
  { id: 'body', labelZh: '身体', labelEn: 'Body', channelIds: channelIdsByPrefix(['body.']) },
  { id: 'head', labelZh: '头部', labelEn: 'Head', channelIds: channelIdsByPrefix(['head.']) },
  { id: 'front-paws', labelZh: '前爪', labelEn: 'Front paws', channelIds: channelIdsByPrefix(['frontPaw.']) },
  { id: 'hind-paws', labelZh: '后爪', labelEn: 'Hind paws', channelIds: channelIdsByPrefix(['hindPaw.']) },
  { id: 'ears', labelZh: '耳朵', labelEn: 'Ears', channelIds: channelIdsByPrefix(['ear.']) },
  { id: 'face', labelZh: '眼睛与嘴部', labelEn: 'Eyes and mouth', channelIds: channelIdsByPrefix(['eye.', 'mouth.']) },
  { id: 'tail', labelZh: '尾巴', labelEn: 'Tail', channelIds: channelIdsByPrefix(['tail.']) },
  { id: 'antennae', labelZh: '触角', labelEn: 'Antennae', channelIds: channelIdsByPrefix(['antenna.']) },
])

const CHANNEL_MAP = new Map<CloudFoxRigChannelId, RigChannelDefinition<CloudFoxRigChannelId>>(
  CLOUD_FOX_RIG_CHANNELS.map(channel => [channel.id, channel]),
)

export function isCloudFoxRigChannelId(value: unknown): value is CloudFoxRigChannelId {
  return typeof value === 'string' && CHANNEL_MAP.has(value as CloudFoxRigChannelId)
}

export function getCloudFoxRigChannel(id: CloudFoxRigChannelId): RigChannelDefinition<CloudFoxRigChannelId> {
  return CHANNEL_MAP.get(id) as RigChannelDefinition<CloudFoxRigChannelId>
}

export function createNeutralCloudFoxPoseValues(): Record<CloudFoxRigChannelId, number> {
  return Object.fromEntries(CLOUD_FOX_RIG_CHANNELS.map(channel => [channel.id, channel.neutral])) as Record<CloudFoxRigChannelId, number>
}
