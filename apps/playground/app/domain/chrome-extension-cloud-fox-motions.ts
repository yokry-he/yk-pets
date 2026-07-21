/**
 * 文件职责 / File responsibility
 * 将正式 Chrome 扩展 CloudFox.vue 中的行为标识、中文名称、分组、原始时长和 Studio 演示时长同步到 Studio。
 * Mirrors production Chrome extension Cloud Fox motion ids, labels, groups, source durations, and Studio preview durations.
 */

export const EXTENSION_CLOUD_FOX_MOTION_GROUPS = [
  { id: 'state', label: '状态与情绪' },
  { id: 'basic', label: '基础动作' },
  { id: 'interaction', label: '互动与道具' },
  { id: 'energy', label: '高能与发光' },
] as const

export type ExtensionCloudFoxMotionGroup = typeof EXTENSION_CLOUD_FOX_MOTION_GROUPS[number]['id']

export const EXTENSION_CLOUD_FOX_MOTIONS = [
  { id: 'idle', label: '待机呼吸', labelEn: 'Idle', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 0 },
  { id: 'sleeping', label: '睡眠', labelEn: 'Sleeping', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 6200 },
  { id: 'thinking', label: '思考', labelEn: 'Thinking', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 6200 },
  { id: 'happy', label: '开心', labelEn: 'Happy', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 5200 },
  { id: 'talking', label: '说话', labelEn: 'Talking', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 5200 },
  { id: 'excited', label: '兴奋', labelEn: 'Excited', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 5200 },
  { id: 'confused', label: '疑惑', labelEn: 'Confused', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 5200 },
  { id: 'waking', label: '醒来', labelEn: 'Waking', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 4600 },
  { id: 'listening', label: '倾听', labelEn: 'Listening', group: 'state', sourceDurationSeconds: 0, previewDurationMs: 5200 },

  { id: 'greeting', label: '招手', labelEn: 'Greeting', group: 'basic', sourceDurationSeconds: 2.4, previewDurationMs: 2750 },
  { id: 'playing', label: '开心舞步', labelEn: 'Playing', group: 'basic', sourceDurationSeconds: 0, previewDurationMs: 5600 },
  { id: 'spinning', label: '转圈', labelEn: 'Spinning', group: 'basic', sourceDurationSeconds: 1.9, previewDurationMs: 2250 },
  { id: 'jumping', label: '跳跃', labelEn: 'Jumping', group: 'basic', sourceDurationSeconds: 1.25, previewDurationMs: 3200 },
  { id: 'flapping', label: '挥爪扑腾', labelEn: 'Flapping', group: 'basic', sourceDurationSeconds: 0, previewDurationMs: 5200 },
  { id: 'resting', label: '趴下休息', labelEn: 'Resting', group: 'basic', sourceDurationSeconds: 0, previewDurationMs: 7600 },
  { id: 'stretching', label: '伸懒腰', labelEn: 'Stretching', group: 'basic', sourceDurationSeconds: 7, previewDurationMs: 7350 },

  { id: 'playing-ball', label: '玩球', labelEn: 'Playing Ball', group: 'interaction', sourceDurationSeconds: 8.4, previewDurationMs: 8750 },
  { id: 'eating', label: '吃饭', labelEn: 'Eating', group: 'interaction', sourceDurationSeconds: 8, previewDurationMs: 8350 },
  { id: 'diving-catch', label: '飞扑接球', labelEn: 'Diving Catch', group: 'interaction', sourceDurationSeconds: 7, previewDurationMs: 5750 },
  { id: 'shy-peek', label: '害羞偷看', labelEn: 'Shy Peek', group: 'interaction', sourceDurationSeconds: 4.5, previewDurationMs: 4850 },
  { id: 'star-juggle', label: '星星杂耍', labelEn: 'Star Juggle', group: 'interaction', sourceDurationSeconds: 8.2, previewDurationMs: 8550 },
  { id: 'cloud-nap', label: '云朵小憩', labelEn: 'Cloud Nap', group: 'interaction', sourceDurationSeconds: 18, previewDurationMs: 18350 },
  { id: 'sparkle-sneeze', label: '闪光喷嚏', labelEn: 'Sparkle Sneeze', group: 'interaction', sourceDurationSeconds: 3.9, previewDurationMs: 4550 },
  { id: 'curious-scan', label: '好奇扫描', labelEn: 'Curious Scan', group: 'interaction', sourceDurationSeconds: 4, previewDurationMs: 4350 },

  { id: 'backflip', label: '后空翻', labelEn: 'Backflip', group: 'energy', sourceDurationSeconds: 4.3, previewDurationMs: 4650 },
  { id: 'tail-tornado', label: '尾巴龙卷', labelEn: 'Tail Tornado', group: 'energy', sourceDurationSeconds: 5, previewDurationMs: 5350 },
  { id: 'energy-burst', label: '能量爆发', labelEn: 'Energy Burst', group: 'energy', sourceDurationSeconds: 6.2, previewDurationMs: 6950 },
  { id: 'fireworks-show', label: '烟花秀', labelEn: 'Fireworks Show', group: 'energy', sourceDurationSeconds: 12, previewDurationMs: 12350 },
  { id: 'antenna-charge', label: '触角充能', labelEn: 'Antenna Charge', group: 'energy', sourceDurationSeconds: 5.2, previewDurationMs: 5550 },
  { id: 'tail-glow', label: '尾巴流光', labelEn: 'Tail Glow', group: 'energy', sourceDurationSeconds: 5.2, previewDurationMs: 5550 },
] as const satisfies readonly {
  id: string
  label: string
  labelEn: string
  group: ExtensionCloudFoxMotionGroup
  sourceDurationSeconds: number
  previewDurationMs: number
}[]

export type ExtensionCloudFoxMotionId = typeof EXTENSION_CLOUD_FOX_MOTIONS[number]['id']
export type ExtensionCloudFoxMotion = typeof EXTENSION_CLOUD_FOX_MOTIONS[number]

const MOTION_MAP = new Map<ExtensionCloudFoxMotionId, ExtensionCloudFoxMotion>(
  EXTENSION_CLOUD_FOX_MOTIONS.map(motion => [motion.id, motion]),
)

export function getExtensionCloudFoxMotion(id: ExtensionCloudFoxMotionId): ExtensionCloudFoxMotion {
  return MOTION_MAP.get(id) ?? EXTENSION_CLOUD_FOX_MOTIONS[0]
}

export function getExtensionCloudFoxMotionDurationMs(id: ExtensionCloudFoxMotionId) {
  return getExtensionCloudFoxMotion(id).previewDurationMs
}

export function isExtensionCloudFoxMotion(value: unknown): value is ExtensionCloudFoxMotionId {
  return typeof value === 'string' && MOTION_MAP.has(value as ExtensionCloudFoxMotionId)
}
