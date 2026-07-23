/**
 * 文件职责 / File responsibility
 * 镜像 Chrome 扩展正式云狐的完整动作目录、分组、源时长和 Studio 预览时长。
 * Mirrors the complete production Chrome-extension Cloud Fox motion catalog, groups, source timing, and Studio preview timing.
 */

export const EXTENSION_CLOUD_FOX_MOTION_GROUPS = [
  { id: 'states', label: '基础状态' },
  { id: 'body', label: '基础动作' },
  { id: 'life', label: '生活 / 社交' },
  { id: 'advanced', label: '高能 / 场景' },
] as const

export type ExtensionCloudFoxMotionGroup = typeof EXTENSION_CLOUD_FOX_MOTION_GROUPS[number]['id']

export const EXTENSION_CLOUD_FOX_MOTIONS = [
  { id: 'idle', label: '待机', group: 'states', previewDurationMs: 3600 },
  { id: 'sleeping', label: '睡眠', group: 'states', previewDurationMs: 5200 },
  { id: 'thinking', label: '思考', group: 'states', previewDurationMs: 4200 },
  { id: 'happy', label: '开心', group: 'states', previewDurationMs: 3600 },
  { id: 'talking', label: '说话', group: 'states', previewDurationMs: 4200 },
  { id: 'excited', label: '兴奋', group: 'states', previewDurationMs: 4200 },
  { id: 'confused', label: '困惑', group: 'states', previewDurationMs: 4200 },
  { id: 'waking', label: '醒来', group: 'states', previewDurationMs: 3600 },
  { id: 'listening', label: '聆听', group: 'states', previewDurationMs: 3800 },
  { id: 'greeting', label: '招手', group: 'body', previewDurationMs: 2750, sourceDurationSeconds: 2.4 },
  { id: 'playing', label: '舞动', group: 'body', previewDurationMs: 5200 },
  { id: 'spinning', label: '旋转', group: 'body', previewDurationMs: 2600 },
  { id: 'jumping', label: '跳跃', group: 'body', previewDurationMs: 3200, sourceDurationSeconds: 1.25 },
  { id: 'flapping', label: '扑腾', group: 'body', previewDurationMs: 5200 },
  { id: 'resting', label: '趴下休息', group: 'body', previewDurationMs: 7600 },
  { id: 'stretching', label: '伸懒腰', group: 'body', previewDurationMs: 7350, sourceDurationSeconds: 7 },
  { id: 'playing-ball', label: '玩球', group: 'life', previewDurationMs: 8800, sourceDurationSeconds: 8.4 },
  { id: 'eating', label: '吃饭', group: 'life', previewDurationMs: 8350, sourceDurationSeconds: 8 },
  { id: 'diving-catch', label: '飞扑接球', group: 'life', previewDurationMs: 5750, sourceDurationSeconds: 7 },
  { id: 'shy-peek', label: '害羞偷看', group: 'life', previewDurationMs: 4850, sourceDurationSeconds: 4.5 },
  { id: 'star-juggle', label: '星星杂耍', group: 'life', previewDurationMs: 8550, sourceDurationSeconds: 8.2 },
  { id: 'cloud-nap', label: '云朵午睡', group: 'life', previewDurationMs: 18350, sourceDurationSeconds: 18 },
  { id: 'sparkle-sneeze', label: '星光喷嚏', group: 'life', previewDurationMs: 4550, sourceDurationSeconds: 3.9 },
  { id: 'curious-scan', label: '好奇扫描', group: 'life', previewDurationMs: 4350, sourceDurationSeconds: 4 },
  { id: 'backflip', label: '空翻落地', group: 'advanced', previewDurationMs: 4650, sourceDurationSeconds: 4.3 },
  { id: 'tail-tornado', label: '甩尾旋风', group: 'advanced', previewDurationMs: 5350, sourceDurationSeconds: 5 },
  { id: 'energy-burst', label: '能量爆发', group: 'advanced', previewDurationMs: 6950, sourceDurationSeconds: 6.2 },
  { id: 'fireworks-show', label: '高空烟花秀', group: 'advanced', previewDurationMs: 12000, sourceDurationSeconds: 12 },
  { id: 'antenna-charge', label: '触角聚能', group: 'advanced', previewDurationMs: 5550, sourceDurationSeconds: 5.2 },
  { id: 'tail-glow', label: '尾光流动', group: 'advanced', previewDurationMs: 5550, sourceDurationSeconds: 5.2 },
] as const satisfies readonly {
  id: string
  label: string
  group: ExtensionCloudFoxMotionGroup
  previewDurationMs: number
  sourceDurationSeconds?: number
}[]

export type ExtensionCloudFoxMotionId = typeof EXTENSION_CLOUD_FOX_MOTIONS[number]['id']

export function isExtensionCloudFoxMotion(value: unknown): value is ExtensionCloudFoxMotionId {
  return typeof value === 'string' && EXTENSION_CLOUD_FOX_MOTIONS.some(motion => motion.id === value)
}

export function getExtensionCloudFoxMotion(id: ExtensionCloudFoxMotionId) {
  return EXTENSION_CLOUD_FOX_MOTIONS.find(motion => motion.id === id)!
}

export function getExtensionCloudFoxMotionGroup(id: ExtensionCloudFoxMotionGroup) {
  return EXTENSION_CLOUD_FOX_MOTIONS.filter(motion => motion.group === id)
}
