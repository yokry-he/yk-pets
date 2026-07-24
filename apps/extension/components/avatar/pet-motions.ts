/**
 * 文件职责 / File responsibility
 * 集中注册宠物动作元数据，供菜单、调度、音频和统一 Studio/扩展动作运行时共享。
 * Centrally registers pet motion metadata shared by menus, scheduling, audio, and the unified Studio/extension motion runtime.
 */
import type { NovaPetBehavior } from '@nova/shared/messages'

// 动作分类决定菜单、道具、闲时频率和减少动态效果策略。 / Motion categories drive menus, props, idle frequency, and reduced-motion behavior.
export type PetMotionKind = 'body' | 'prop' | 'scene'
export type PetMotionCategory = 'social' | 'active' | 'calm' | 'life' | 'special'
export type PetPropKind = 'ball' | 'food-bowl' | null
export type PetMotionIntensity = 'micro' | 'normal' | 'high'
export type PetMotionIdleTier = 'normal' | 'rare' | 'high' | 'easter' | 'never'

export interface PetMotionDefinition {
  id: string
  behavior: NovaPetBehavior
  label: string
  description: string
  icon: string
  duration: number
  kind: PetMotionKind
  category: PetMotionCategory
  prop: PetPropKind
  intensity: PetMotionIntensity
  idleEligible: boolean
  idleTier: PetMotionIdleTier
  interruptible: boolean
  order: number
}

/**
 * 动作注册表是菜单、闲时调度与用户反馈时长的单一事实来源；统一渲染核心不会改变既有扩展动作节奏。
 * The registry is the single source for menu, idle scheduling, and feedback timing; the unified renderer does not change established extension motion pacing.
 */
export const PET_MOTIONS: readonly PetMotionDefinition[] = [
  { id: 'wave', behavior: 'greeting', label: '招手', description: '爪端朝上，以手腕为轴向你挥手', icon: '◡', duration: 2400, kind: 'body', category: 'social', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: true, order: 10 },
  { id: 'jump', behavior: 'jumping', label: '跳跃', description: '蓄力跳起并自然落地', icon: '↟', duration: 2400, kind: 'body', category: 'active', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: false, order: 20 },
  { id: 'flap', behavior: 'flapping', label: '扑腾', description: '两只前爪交替扑腾', icon: '≋', duration: 2800, kind: 'body', category: 'active', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: true, order: 40 },
  { id: 'rest', behavior: 'resting', label: '休息', description: '趴下来安静休息一会儿', icon: '☾', duration: 5000, kind: 'body', category: 'calm', prop: null, intensity: 'normal', idleEligible: false, idleTier: 'never', interruptible: true, order: 60 },
  { id: 'stretch', behavior: 'stretching', label: '伸懒腰', description: '双爪向上举起、打开胸口并仰头伸展', icon: '⌁', duration: 7000, kind: 'body', category: 'calm', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: false, order: 70 },
  { id: 'eat', behavior: 'eating', label: '吃饭', description: '召唤抬高餐桌和能量食盆，靠近嘴部进食', icon: '◒', duration: 8000, kind: 'prop', category: 'life', prop: 'food-bowl', intensity: 'normal', idleEligible: true, idleTier: 'rare', interruptible: false, order: 90 },
  { id: 'backflip', behavior: 'backflip', label: '空翻落地', description: '蓄力跃起、完成后空翻并释放落地波纹', icon: '↶', duration: 4300, kind: 'scene', category: 'special', prop: null, intensity: 'high', idleEligible: true, idleTier: 'high', interruptible: false, order: 100 },
  { id: 'tail-tornado', behavior: 'tail-tornado', label: '甩尾旋风', description: '尾巴蓄力横扫，带动身体高速旋转并收束拖尾', icon: '⌬', duration: 5000, kind: 'scene', category: 'special', prop: null, intensity: 'high', idleEligible: true, idleTier: 'high', interruptible: false, order: 110 },
  { id: 'diving-catch', behavior: 'diving-catch', label: '飞扑接球', description: '锁定高速能量球，飞扑后用双爪抱住', icon: '◉', duration: 7000, kind: 'prop', category: 'special', prop: 'ball', intensity: 'high', idleEligible: true, idleTier: 'high', interruptible: false, order: 120 },
  { id: 'energy-burst', behavior: 'energy-burst', label: '能量爆发', description: '双爪聚拢蓄力，释放多层能量环和星点', icon: '✺', duration: 6200, kind: 'scene', category: 'special', prop: null, intensity: 'high', idleEligible: true, idleTier: 'high', interruptible: false, order: 130 },
  { id: 'shy-peek', behavior: 'shy-peek', label: '害羞偷看', description: '双爪靠近脸颊，歪头偷偷看你', icon: '◔', duration: 4500, kind: 'body', category: 'social', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: true, order: 140 },
  { id: 'star-juggle', behavior: 'star-juggle', label: '星星杂耍', description: '用前爪和尾尖轮流接住三颗能量星', icon: '✧', duration: 8200, kind: 'scene', category: 'life', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'rare', interruptible: false, order: 150 },
  { id: 'cloud-nap', behavior: 'cloud-nap', label: '云朵午睡', description: '召唤软云平躺休息，触角进入长时间柔和呼吸光', icon: '☁', duration: 18000, kind: 'scene', category: 'life', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'rare', interruptible: true, order: 160 },
  { id: 'sparkle-sneeze', behavior: 'sparkle-sneeze', label: '星光喷嚏', description: '触角突然充能，打出一团可爱的星光喷嚏', icon: '※', duration: 3900, kind: 'scene', category: 'special', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'easter', interruptible: false, order: 170 },
  { id: 'fireworks-show', behavior: 'fireworks-show', label: '高空烟花秀', description: '连续发射高空烟花，随机展示精选花型与配色', icon: '✹', duration: 12000, kind: 'scene', category: 'special', prop: null, intensity: 'high', idleEligible: true, idleTier: 'easter', interruptible: false, order: 180 },
  { id: 'curious-scan', behavior: 'curious-scan', label: '好奇扫描', description: '歪头环顾四周，触角像雷达一样轻轻扫描', icon: '⌁', duration: 4000, kind: 'body', category: 'life', prop: null, intensity: 'micro', idleEligible: true, idleTier: 'normal', interruptible: true, order: 190 },
  { id: 'antenna-charge', behavior: 'antenna-charge', label: '触角聚能', description: '双触角向中间汇聚能量，形成明亮脉冲', icon: '⌃', duration: 5200, kind: 'scene', category: 'special', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'rare', interruptible: false, order: 210 },
  { id: 'tail-glow', behavior: 'tail-glow', label: '尾光流动', description: '能量从尾根流向尾尖，释放柔和发光拖尾', icon: '≈', duration: 5200, kind: 'scene', category: 'special', prop: null, intensity: 'normal', idleEligible: true, idleTier: 'normal', interruptible: false, order: 220 },
] as const

export function getPetMotion(behavior: NovaPetBehavior) {
  return PET_MOTIONS.find(motion => motion.behavior === behavior)
}
