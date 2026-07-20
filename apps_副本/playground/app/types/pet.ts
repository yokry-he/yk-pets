/**
 * 文件职责 / File responsibility
 * Playground 宠物共享类型。
 * Shared Playground pet types.
 */
export type PetTheme = 'dark' | 'light'

export type PetEmotion =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'confused'
  | 'sleepy'
  | 'excited'

export type PetAnimation =
  | 'idle'
  | 'happy'
  | 'curious'
  | 'confused'
  | 'sleepy'
  | 'excited'
  | 'thinking'
  | 'greeting'
  | 'playful'
  | 'spinning'
  | 'listening'
  | 'jumping'
  | 'flapping'
  | 'resting'

export type PetActionType =
  | 'none'
  | 'toggle-theme'
  | 'scroll-abilities'
  | 'reveal-secret'
  | 'sleep'

export interface PetCommand {
  message: string
  emotion: PetEmotion
  animation: PetAnimation
  action: {
    type: PetActionType
    value: string
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'pet'
  content: string
}
