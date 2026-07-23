/**
 * 文件职责 / File responsibility
 * 定义扩展后台、Content Script、Side Panel 和宠物之间的运行时消息。
 * Defines runtime messages among background, content scripts, Side Panel, and pet UI.
 */
import type { AuditCategory, AuditIssue, AuditIssueCode, AuditReport } from './audit'
import type { NetworkEntry, NetworkRule, NetworkSiteSettings, NetworkSnapshot } from './network'
import type { PetIdentity } from './brand'
import type {
  PetMemoryCard,
  PetMemoryCreateInput,
  PetMemoryUpdatePatch,
} from './pet-memory'

export type YkPetAction =
  | 'audit'
  | 'previous-issue'
  | 'next-issue'
  | 'preview-current'
  | 'rollback-preview'
  | 'open-report'
  | 'open-memory'
  | 'network-lab'
  | 'connect-agent'
  | 'generate-patch'
  | 'apply-patch'
  | 'run-checks'
  | 'rollback-patch'

export type YkPetBehavior =
  | 'idle'
  | 'thinking'
  | 'happy'
  | 'confused'
  | 'excited'
  | 'listening'
  | 'greeting'
  | 'playing'
  | 'spinning'
  | 'jumping'
  | 'flapping'
  | 'resting'
  | 'stretching'
  | 'playing-ball'
  | 'eating'
  | 'backflip'
  | 'tail-tornado'
  | 'diving-catch'
  | 'energy-burst'
  | 'shy-peek'
  | 'star-juggle'
  | 'cloud-nap'
  | 'sparkle-sneeze'
  | 'fireworks-show'
  | 'curious-scan'
  | 'paw-tap'
  | 'antenna-charge'
  | 'tail-glow'

export const YK_PETS_VOICE_PRESETS = ['alien', 'cute-girl', 'cute-animal', 'mute'] as const
export type YkPetVoicePreset = typeof YK_PETS_VOICE_PRESETS[number]

export interface YkPetVisualState {
  /** 迁移期间可选；消费者应回退到 ZEPH_CLOUD_FOX_IDENTITY。 / Optional during migration; consumers should fall back to ZEPH_CLOUD_FOX_IDENTITY. */
  identity?: Readonly<PetIdentity>
  behavior: YkPetBehavior
  speech: string
  score: number
  issueCount: number
  currentIssueIndex: number
  currentIssueTitle: string
  previewActive: boolean
  busy: boolean
  agentConnected: boolean
  /** 当前页面关联的未归档记忆数量。 / Number of non-archived memories linked to the current page. */
  memoryCount?: number
}

/**
 * Wire Message 在一个兼容周期内保留 v0.6.10 的 NOVA 前缀；新领域使用 YK_PET 前缀。
 * Wire messages retain the v0.6.10 NOVA prefix for one compatibility cycle; new domains use the YK_PET prefix.
 */
export type YkPetsRuntimeMessage =
  | { type: 'NOVA_OPEN_SIDE_PANEL'; action?: YkPetAction; issueId?: string }
  | { type: 'NOVA_SIDE_PANEL_ACTION'; action: YkPetAction; issueId?: string; tabId: number }
  | { type: 'NOVA_UPDATE_PET_STATE'; state: Partial<YkPetVisualState> }
  | { type: 'NOVA_TTS_SPEAK'; text: string; preset: Exclude<YkPetVoicePreset, 'alien' | 'mute'> }
  | { type: 'NOVA_TTS_STOP' }
  | { type: 'NOVA_RUN_AUDIT'; enabledCategories?: AuditCategory[]; enabledRuleCodes?: AuditIssueCode[] }
  | { type: 'NOVA_AUDIT_RESULT'; report: AuditReport }
  | { type: 'NOVA_REPORT_UPDATED'; tabId: number; report: AuditReport }
  | { type: 'NOVA_HIGHLIGHT_ISSUE'; issue: AuditIssue }
  | { type: 'NOVA_CLEAR_HIGHLIGHT' }
  | { type: 'NOVA_APPLY_PREVIEW'; issue: AuditIssue }
  | { type: 'NOVA_ROLLBACK_PREVIEW'; issueId?: string }
  | { type: 'NOVA_GET_PAGE_CONTEXT' }
  | { type: 'NOVA_NETWORK_GET_STATE' }
  | { type: 'NOVA_NETWORK_SET_ENABLED'; enabled: boolean }
  | { type: 'NOVA_NETWORK_SET_SETTINGS'; settings: Partial<NetworkSiteSettings> }
  | { type: 'NOVA_NETWORK_SYNC_RULES'; rules: NetworkRule[] }
  | { type: 'NOVA_NETWORK_CLEAR' }
  | { type: 'NOVA_NETWORK_UPDATED'; pageUrl: string; entryCount: number }
  | { type: 'NOVA_NETWORK_ENTRY'; entry: NetworkEntry }
  | { type: 'NOVA_NETWORK_SNAPSHOT'; snapshot: NetworkSnapshot }
  | { type: 'YK_PET_MEMORY_LIST' }
  | { type: 'YK_PET_MEMORY_CREATE'; input: PetMemoryCreateInput }
  | { type: 'YK_PET_MEMORY_UPDATE'; cardId: string; patch: PetMemoryUpdatePatch }
  | { type: 'YK_PET_MEMORY_ARCHIVE'; cardId: string }
  | { type: 'YK_PET_MEMORY_UPDATED'; reason: 'created' | 'updated' | 'archived'; card: PetMemoryCard }
  | { type: 'YK_PET_MEMORY_DRAFT_READY'; tabId: number }
  | { type: 'YK_PET_MEMORY_GET_CONTEXT' }

/** @deprecated Use YkPetAction. */
export type NovaPetAction = YkPetAction
/** @deprecated Use YkPetBehavior. */
export type NovaPetBehavior = YkPetBehavior
/** @deprecated Use YkPetVoicePreset. */
export type NovaPetVoicePreset = YkPetVoicePreset
/** @deprecated Use YkPetVisualState. */
export type NovaPetVisualState = YkPetVisualState
/** @deprecated Use YkPetsRuntimeMessage. */
export type NovaRuntimeMessage = YkPetsRuntimeMessage
/** @deprecated Use YK_PETS_VOICE_PRESETS. */
export const NOVA_PET_VOICE_PRESETS = YK_PETS_VOICE_PRESETS
