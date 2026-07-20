/**
 * 文件职责 / File responsibility
 * 保存规则编辑草稿，支持 Side Panel 关闭后的恢复。
 * Persists rule-editor drafts for recovery after the Side Panel closes.
 */
import type { NetworkRule } from '@nova/shared/network'
import type { NetworkRuleEditorMode } from '../domain/network-rule-factory'
import { cloneNetworkValue } from '../domain/network-value-clone'

const DRAFT_PREFIX = 'nova:network:rule-draft:'

export interface NetworkRuleEditorDraft {
  origin: string
  mode: NetworkRuleEditorMode
  sourceRuleId?: string
  rule: NetworkRule
  mockBodyText: string
  testUrl: string
  testMethod: string
  updatedAt: string
}

export interface NetworkRuleDraftRepository {
  load(origin: string): Promise<NetworkRuleEditorDraft | null>
  save(draft: NetworkRuleEditorDraft): Promise<void>
  clear(origin: string): Promise<void>
}

/** Chrome Storage Adapter for editor drafts. */
export class ChromeRuleDraftRepository implements NetworkRuleDraftRepository {
  async load(origin: string): Promise<NetworkRuleEditorDraft | null> {
    const key = draftKey(origin)
    const stored = await chrome.storage.local.get(key)
    const draft = stored[key]
    return isDraft(draft) ? cloneNetworkValue(draft) : null
  }

  async save(draft: NetworkRuleEditorDraft): Promise<void> {
    await chrome.storage.local.set({ [draftKey(draft.origin)]: cloneNetworkValue(draft) })
  }

  async clear(origin: string): Promise<void> {
    await chrome.storage.local.remove(draftKey(origin))
  }
}

function draftKey(origin: string) {
  return `${DRAFT_PREFIX}${encodeURIComponent(origin || 'unknown')}`
}

function isDraft(value: unknown): value is NetworkRuleEditorDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<NetworkRuleEditorDraft>
  return typeof draft.origin === 'string'
    && ['create', 'from-request', 'edit', 'duplicate'].includes(draft.mode || '')
    && Boolean(
      draft.rule
      && typeof draft.rule.id === 'string'
      && typeof draft.rule.name === 'string'
      && typeof draft.rule.scopeOrigin === 'string'
      && draft.rule.match
      && typeof draft.rule.match.urlPattern === 'string'
      && Array.isArray(draft.rule.match.methods)
      && draft.rule.action
      && typeof draft.rule.action.type === 'string',
    )
    && typeof draft.mockBodyText === 'string'
}
