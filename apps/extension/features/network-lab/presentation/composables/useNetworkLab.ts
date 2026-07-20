/**
 * 文件职责 / File responsibility
 * 网络实验室表现层协调器，管理当前标签页、快照、开关和规则操作。
 * Presentation coordinator for the active tab, snapshots, switches, and rule actions.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  DEFAULT_NETWORK_SITE_SETTINGS,
  type NetworkEntry,
  type NetworkRule,
  type NetworkSnapshot,
} from '@nova/shared/network'
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import { NetworkAnalysisService } from '../../application/network-analysis-service'
import { NetworkRuleApplicationService } from '../../application/network-rule-application-service'
import { NetworkRuleFactory } from '../../domain/network-rule-factory'
import type { NetworkRuleEditorMode } from '../../domain/network-rule-factory'
import {
  ChromeNetworkRepository,
} from '../../infrastructure/chrome-network-repository'
import {
  ChromeRuleDraftRepository,
  type NetworkRuleEditorDraft,
} from '../../infrastructure/chrome-rule-draft-repository'

/**
 * 将仓储、领域服务和页面通道组合为 UI 可使用的响应式状态。
 * Composes repositories, domain services, and the page channel into reactive UI state.
 */
export function useNetworkLab() {
  // 基础设施实例集中创建，组件不直接访问 Chrome API。 / Infrastructure instances are centralized so components never access Chrome APIs directly.
  const repository = new ChromeNetworkRepository()
  const draftRepository = new ChromeRuleDraftRepository()
  const ruleFactory = new NetworkRuleFactory()
  const ruleService = new NetworkRuleApplicationService(repository)
  const analyzer = new NetworkAnalysisService()
  const snapshot = ref<NetworkSnapshot | null>(null)
  const loading = ref(false)
  const error = ref('')
  const currentTab = ref<chrome.tabs.Tab | null>(null)
  let pollTimer: number | null = null

  // 派生数据只依赖快照，便于页面切换时保持单一事实来源。 / Derived data depends only on the snapshot, preserving a single source of truth across pages.
  const entries = computed(() => snapshot.value?.entries || [])
  const rules = computed(() => snapshot.value?.rules || [])
  const settings = computed(() => snapshot.value?.settings || DEFAULT_NETWORK_SITE_SETTINGS)
  const summary = computed(() => snapshot.value?.summary || analyzer.summarize([], settings.value.slowThresholdMs))
  const topSlow = computed(() => analyzer.topSlow(entries.value, 10))
  const resources = computed(() => analyzer.aggregateByType(entries.value))
  const diagnoses = computed(() => analyzer.diagnose(entries.value, settings.value.slowThresholdMs))
  const origin = computed(() => snapshot.value?.origin || safeOrigin(currentTab.value?.url))

  async function attach(tab: chrome.tabs.Tab | null, active: boolean) {
    currentTab.value = tab
    stopPolling()
    if (!tab?.id || !isInspectableUrl(tab.url)) {
      snapshot.value = null
      error.value = '请切换到普通 http/https 网页，并刷新页面后使用网络实验室。'
      return
    }
    await refresh()
    if (active) startPolling()
  }

  async function refresh(options: { quiet?: boolean } = {}) {
    const tab = currentTab.value
    if (!tab?.id || !tab.url) return
    if (!options.quiet) loading.value = true
    error.value = ''
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'NOVA_NETWORK_GET_STATE' } satisfies NovaRuntimeMessage) as {
        ok?: boolean
        snapshot?: NetworkSnapshot
        error?: string
      }
      if (!response?.ok || !response.snapshot) throw new Error(response?.error || '页面未返回网络状态')
      snapshot.value = response.snapshot
    }
    catch (reason) {
      const pageOrigin = new URL(tab.url).origin
      const [siteSettings, storedRules] = await Promise.all([
        repository.getSiteSettings(pageOrigin),
        repository.getRules(),
      ])
      snapshot.value = {
        pageUrl: tab.url,
        origin: pageOrigin,
        settings: siteSettings,
        rules: storedRules,
        entries: [],
        summary: analyzer.summarize([], siteSettings.slowThresholdMs),
      }
      error.value = '网络脚本尚未连接当前页面。请刷新目标网页后重试；规则仍可提前配置。'
      console.warn('[NOVA network lab]', reason)
    }
    finally {
      loading.value = false
    }
  }

  // 总开关先持久化再同步页面，失败时重新刷新真实状态。 / Persist the master switch before page sync and refresh actual state on failure.
  async function setEnabled(enabled: boolean) {
    const tab = currentTab.value
    if (!tab?.id || !snapshot.value) return false
    const nextSettings = { ...snapshot.value.settings, enabled }
    snapshot.value = { ...snapshot.value, settings: nextSettings }
    await repository.saveSiteSettings(snapshot.value.origin, nextSettings)
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'NOVA_NETWORK_SET_ENABLED',
        enabled,
      } satisfies NovaRuntimeMessage) as { ok?: boolean; snapshot?: NetworkSnapshot; error?: string }
      if (response?.snapshot) snapshot.value = response.snapshot
      if (!response?.ok) throw new Error(response?.error || '切换失败')
      error.value = ''
      return true
    }
    catch (reason) {
      error.value = '设置已经保存；刷新当前网页后会按新状态运行。'
      console.warn('[NOVA network toggle]', reason)
      return true
    }
  }

  async function updateSlowThreshold(slowThresholdMs: number) {
    if (!snapshot.value) return
    const nextSettings = {
      ...snapshot.value.settings,
      slowThresholdMs: Math.min(30_000, Math.max(100, Math.round(slowThresholdMs))),
    }
    snapshot.value = {
      ...snapshot.value,
      settings: nextSettings,
      summary: analyzer.summarize(snapshot.value.entries, nextSettings.slowThresholdMs),
    }
    await repository.saveSiteSettings(snapshot.value.origin, nextSettings)
    await sendToPage({ type: 'NOVA_NETWORK_SET_SETTINGS', settings: nextSettings })
  }

  async function saveRule(rule: NetworkRule) {
    const nextRules = await ruleService.save(rules.value, rule)
    await syncRules(nextRules)
  }

  async function removeRule(ruleId: string) {
    const nextRules = await ruleService.remove(rules.value, ruleId)
    await syncRules(nextRules)
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    const nextRules = await ruleService.toggle(rules.value, ruleId, enabled)
    await syncRules(nextRules)
  }

  function newRule() {
    return ruleFactory.createManual(origin.value)
  }

  function createRuleFromEntry(entry: NetworkEntry): NetworkRule {
    return ruleFactory.createFromEntry(entry, origin.value)
  }

  function duplicateRule(rule: NetworkRule): NetworkRule {
    return ruleFactory.duplicate(rule)
  }

  async function loadDraft(): Promise<NetworkRuleEditorDraft | null> {
    if (!origin.value) return null
    return draftRepository.load(origin.value)
  }

  async function saveDraft(draft: NetworkRuleEditorDraft) {
    await draftRepository.save(draft)
  }

  async function clearDraft() {
    if (!origin.value) return
    await draftRepository.clear(origin.value)
  }

  async function clearEntries() {
    if (!snapshot.value) return
    const response = await sendToPage({ type: 'NOVA_NETWORK_CLEAR' }) as { snapshot?: NetworkSnapshot } | null
    if (response?.snapshot) snapshot.value = response.snapshot
    else snapshot.value = {
      ...snapshot.value,
      entries: [],
      summary: analyzer.summarize([], snapshot.value.settings.slowThresholdMs),
    }
  }

  // 轮询仅用于轻量快照刷新；Side Panel 卸载时必须停止。 / Polling refreshes lightweight snapshots only and must stop when the Side Panel unmounts.
  function startPolling() {
    stopPolling()
    pollTimer = window.setInterval(() => refresh({ quiet: true }).catch(() => undefined), 1400)
  }

  function stopPolling() {
    if (pollTimer === null) return
    window.clearInterval(pollTimer)
    pollTimer = null
  }

  async function syncRules(nextRules: NetworkRule[], options: { persist?: boolean } = {}) {
    if (!snapshot.value) return
    snapshot.value = { ...snapshot.value, rules: nextRules }
    if (options.persist !== false) await repository.saveRules(nextRules)
    const response = await sendToPage({ type: 'NOVA_NETWORK_SYNC_RULES', rules: nextRules }) as { snapshot?: NetworkSnapshot } | null
    if (response?.snapshot) snapshot.value = response.snapshot
  }

  async function sendToPage(message: NovaRuntimeMessage): Promise<unknown> {
    if (!currentTab.value?.id) return null
    try {
      return await chrome.tabs.sendMessage(currentTab.value.id, message)
    }
    catch (reason) {
      console.warn('[NOVA network page message]', reason)
      return null
    }
  }

  onBeforeUnmount(stopPolling)

  return {
    snapshot,
    loading,
    error,
    entries,
    rules,
    settings,
    summary,
    topSlow,
    resources,
    diagnoses,
    origin,
    attach,
    refresh,
    setEnabled,
    updateSlowThreshold,
    saveRule,
    removeRule,
    toggleRule,
    newRule,
    createRuleFromEntry,
    duplicateRule,
    loadDraft,
    saveDraft,
    clearDraft,
    clearEntries,
    startPolling,
    stopPolling,
  }
}

export interface RuleEditorContext {
  mode: NetworkRuleEditorMode
  rule: NetworkRule
  sourceRuleId?: string
}

function isInspectableUrl(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url))
}

function safeOrigin(url?: string) {
  try { return url ? new URL(url).origin : '' }
  catch { return '' }
}
