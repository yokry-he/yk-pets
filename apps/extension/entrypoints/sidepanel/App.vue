<!--
  文件职责 / File responsibility
  Side Panel 根页面，组合审计报告、Local Agent 和网络实验室。
  Side Panel root page composing audit reports, Local Agent, and Network Lab.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AUDIT_CATEGORIES,
  AUDIT_RULE_CODES,
  AUDIT_RULES,
  type AuditCategory,
  type AuditIssue,
  type AuditIssueCode,
  type AuditReport,
} from '@nova/shared/audit'
import { NOVA_PET_VOICE_PRESETS, type NovaPetAction, type NovaPetVisualState, type NovaPetVoicePreset, type NovaRuntimeMessage } from '@nova/shared/messages'
import type { CheckResult } from '@nova/shared/protocol'
import AgentConnection from './components/AgentConnection.vue'
import IssueCard from './components/IssueCard.vue'
import NetworkLab from '../../features/network-lab/presentation/components/NetworkLab.vue'
import PetMemory from '../../features/pet-memory/presentation/components/PetMemory.vue'
import { useLocalAgent } from './composables/useLocalAgent'

const NOVA_VERSION = '0.6.10'
const PET_VOICE_STORAGE_KEY = 'nova:pet:voice-preset'

// 根页面状态分为审计、补丁、Agent 连接和网络实验室四个领域。 / Root state is divided into audit, patch, Agent connection, and Network Lab domains.
const report = ref<AuditReport | null>(null)
const currentTab = ref<chrome.tabs.Tab | null>(null)
const auditing = ref(false)
const pageError = ref('')
const filter = ref<'all' | 'high' | 'medium' | 'low'>('all')
const issueCategoryFilter = ref<'all' | AuditCategory>('all')
const enabledRuleCodes = ref<AuditIssueCode[]>([...AUDIT_RULE_CODES])
const previewIssueId = ref<string | null>(null)
const patchBusy = ref(false)
const patchError = ref('')
const showAgent = ref(false)
const workspace = ref<'memory' | 'audit' | 'network'>('memory')
const agentUrl = ref('ws://127.0.0.1:4736')
const agentToken = ref('')
const petVoicePreset = ref<NovaPetVoicePreset>('alien')
const voicePreviewStatus = ref('')
let voicePreviewAudio: HTMLAudioElement | null = null
let systemVoicePreviewActive = false

const agent = useLocalAgent()

const petVoiceOptions: Array<{ value: NovaPetVoicePreset; label: string; description: string }> = [
  { value: 'alien', label: '星云外星人', description: '当前内置电子声，离线且跨设备一致' },
  { value: 'cute-girl', label: '萌系少女', description: '优先选择系统自然中文声线，柔和轻快' },
  { value: 'cute-animal', label: '萌宠伙伴', description: '动漫宠物风格的高音调与活泼语速' },
  { value: 'mute', label: '静音', description: '保留动作，不播放任何动作语音' },
]

const activePetVoice = computed(() => petVoiceOptions.find(option => option.value === petVoicePreset.value) || petVoiceOptions[0]!)

const auditCategoryOptions: Array<{ value: AuditCategory; label: string }> = [
  { value: 'performance', label: '性能' },
  { value: 'accessibility', label: '无障碍' },
  { value: 'seo', label: 'SEO' },
  { value: 'best-practice', label: '最佳实践' },
  { value: 'dom', label: 'DOM / 结构' },
]

const auditRuleLabels: Record<AuditIssueCode, string> = {
  'image-dimensions-missing': '图片没有声明固有尺寸',
  'image-lazy-missing': '首屏以下图片未延迟加载',
  'slow-navigation': '页面完整加载时间偏长',
  'long-task': '主线程存在长任务',
  'large-resource': '大型网络资源',
  'image-alt-missing': '图片缺少替代文本',
  'form-label-missing': '表单控件缺少可访问名称',
  'button-name-missing': '按钮没有可访问名称',
  'link-name-missing': '链接没有可访问名称',
  'heading-order': '标题层级发生跳跃',
  'document-title-missing': '页面缺少标题',
  'meta-description-missing': '页面缺少 Meta Description',
  'viewport-meta-missing': '页面缺少 Viewport 配置',
  'mixed-content-resource': 'HTTPS 页面引用不安全资源',
  'duplicate-id': '页面存在重复 ID',
  'dom-size-large': 'DOM 规模偏大',
}

const auditRuleGroups = auditCategoryOptions.map(category => ({
  ...category,
  rules: AUDIT_RULES.filter(rule => rule.category === category.value).map(rule => ({
    code: rule.code,
    label: auditRuleLabels[rule.code],
  })),
}))

const enabledCategories = computed<AuditCategory[]>(() => {
  const enabled = new Set(enabledRuleCodes.value)
  return AUDIT_CATEGORIES.filter(category => AUDIT_RULES.some(rule => rule.category === category && enabled.has(rule.code)))
})

const filteredIssues = computed(() => {
  if (!report.value) return []
  return report.value.issues.filter((issue) => {
    if (filter.value !== 'all' && issue.severity !== filter.value) return false
    if (issueCategoryFilter.value !== 'all' && issue.category !== issueCategoryFilter.value) return false
    return true
  })
})

const reportCategories = computed<AuditCategory[]>(() => {
  const categories = report.value?.enabledCategories
  return categories?.length ? categories : [...AUDIT_CATEGORIES]
})

const reportRuleCodes = computed<AuditIssueCode[]>(() => {
  if (!report.value) return []
  if (Array.isArray(report.value.enabledRuleCodes)) return report.value.enabledRuleCodes
  const categories = new Set(reportCategories.value)
  return AUDIT_RULES.filter(rule => categories.has(rule.category)).map(rule => rule.code)
})

const scoreClass = computed(() => {
  const score = report.value?.score ?? 0
  if (score >= 90) return 'good'
  if (score >= 70) return 'warning'
  return 'danger'
})

const metricCards = computed(() => {
  const metrics = report.value?.metrics
  if (!metrics) return []
  return [
    { label: 'DOM', value: String(metrics.domNodes), hint: 'nodes' },
    { label: '资源', value: String(metrics.resources), hint: formatBytes(metrics.transferredBytes) },
    { label: 'LCP', value: metrics.largestContentfulPaint === null ? '—' : `${metrics.largestContentfulPaint}ms`, hint: 'largest paint' },
    { label: 'CLS', value: metrics.cumulativeLayoutShift === null ? '—' : String(metrics.cumulativeLayoutShift), hint: 'layout shift' },
  ]
})

onMounted(async () => {
  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.tabs.onActivated.addListener(onTabActivated)
  chrome.tabs.onUpdated.addListener(onTabUpdated)
  await loadSettings()
  await refreshCurrentTab()
  await consumePendingPetAction()
})

onBeforeUnmount(() => {
  chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  chrome.tabs.onActivated.removeListener(onTabActivated)
  chrome.tabs.onUpdated.removeListener(onTabUpdated)
  stopVoicePreview()
})

watch(agent.connected, (connected) => {
  syncPetState({
    agentConnected: connected,
    behavior: connected ? 'happy' : 'listening',
    speech: connected ? '本地 Agent 已连接，可以从我这里生成、写入和验证补丁。' : '本地 Agent 已断开。',
    busy: false,
  }).catch(() => undefined)
})

async function refreshCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab.value = tab || null
  pageError.value = ''
  report.value = null
  previewIssueId.value = null
  agent.proposal.value = null

  if (tab?.id) {
    const stored = await chrome.storage.local.get(`nova:report:${tab.id}`)
    report.value = (stored[`nova:report:${tab.id}`] as AuditReport | undefined) || null
  }
}

async function runAudit() {
  if (!currentTab.value?.id || !enabledRuleCodes.value.length) return
  workspace.value = 'audit'
  auditing.value = true
  pageError.value = ''
  try {
    const response = await chrome.tabs.sendMessage(currentTab.value.id, {
      type: 'NOVA_RUN_AUDIT',
      enabledCategories: [...enabledCategories.value],
      enabledRuleCodes: [...enabledRuleCodes.value],
    } satisfies NovaRuntimeMessage) as {
      ok: boolean
      report?: AuditReport
      error?: string
    }
    if (!response?.ok || !response.report) throw new Error(response?.error || '页面没有返回审计结果')
    report.value = response.report
    filter.value = 'all'
    issueCategoryFilter.value = 'all'
    await chrome.storage.local.set({ [`nova:report:${currentTab.value.id}`]: response.report })
  }
  catch (error) {
    pageError.value = isRestrictedUrl(currentTab.value.url)
      ? 'Chrome 内部页面和扩展商店页面不允许注入审计脚本。请切换到普通网页。'
      : '无法连接当前页面。安装或重新加载扩展后，请先刷新目标网页再试。'
    console.warn('[NOVA audit]', error)
  }
  finally {
    auditing.value = false
  }
}

async function highlightIssue(issue: AuditIssue) {
  await sendToPage({ type: 'NOVA_HIGHLIGHT_ISSUE', issue })
}

async function previewIssue(issue: AuditIssue) {
  const response = await sendToPage({ type: 'NOVA_APPLY_PREVIEW', issue })
  if (response?.ok) previewIssueId.value = issue.id
  else pageError.value = response?.error || '无法预览该修改'
}

async function rollbackPreview(issue: AuditIssue) {
  await sendToPage({ type: 'NOVA_ROLLBACK_PREVIEW', issueId: issue.id })
  if (previewIssueId.value === issue.id) previewIssueId.value = null
}

async function rememberIssue(issue: AuditIssue) {
  const response = await chrome.runtime.sendMessage({
    type: 'YK_PET_MEMORY_CREATE',
    input: {
      type: 'audit-issue',
      title: issue.title,
      content: issue.description,
      selector: issue.selector,
      pageUrl: report.value?.url || currentTab.value?.url,
      pageTitle: report.value?.title || currentTab.value?.title,
      status: 'todo',
      priority: issue.severity === 'high' ? 'high' : issue.severity === 'low' ? 'low' : 'medium',
      tags: ['页面审计', auditCategoryLabel(issue.category)],
      relatedAuditIssueId: issue.id,
    },
  } satisfies NovaRuntimeMessage) as { ok?: boolean; error?: string } | undefined
  if (!response?.ok) {
    pageError.value = response?.error || '无法保存审计问题。'
    return
  }
  workspace.value = 'memory'
  await syncPetState({ behavior: 'greeting', speech: '这个审计问题已经加入宠物记忆和待办。', busy: false })
}

async function generatePatch(issue: AuditIssue) {
  if (!report.value) return
  if (!await ensureAgentConnected()) return
  patchBusy.value = true
  patchError.value = ''
  showAgent.value = true
  await syncPetState({
    behavior: 'thinking',
    speech: '我正在项目源码中定位当前问题并生成最小补丁。',
    busy: true,
  })
  try {
    const proposal = await agent.generatePatch(issue, report.value.url)
    await syncPetState({
      behavior: proposal.canApply ? 'happy' : 'confused',
      speech: proposal.canApply ? '源码补丁已经准备好，摸摸我可以确认写入。' : proposal.reason,
      busy: false,
    })
  }
  catch (error) {
    patchError.value = error instanceof Error ? error.message : String(error)
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
  }
  finally {
    patchBusy.value = false
  }
}

async function applyPatch() {
  if (!agent.proposal.value?.canApply) {
    patchError.value = '当前没有可以写入的补丁，请先为一个问题生成源码补丁。'
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
    return
  }
  patchBusy.value = true
  patchError.value = ''
  await syncPetState({ behavior: 'thinking', speech: '正在安全写入补丁，并保留可回滚备份。', busy: true })
  try {
    await agent.applyPatch()
    await syncPetState({ behavior: 'excited', speech: '补丁已经写入项目。下一步可以直接让我运行完整验证。', busy: false })
  }
  catch (error) {
    patchError.value = error instanceof Error ? error.message : String(error)
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
  }
  finally {
    patchBusy.value = false
  }
}

async function rollbackPatch() {
  if (!agent.proposal.value?.applied) {
    patchError.value = '当前没有已经写入的补丁可以回滚。'
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
    return
  }
  patchBusy.value = true
  patchError.value = ''
  await syncPetState({ behavior: 'thinking', speech: '正在恢复补丁写入前的源码。', busy: true })
  try {
    await agent.rollbackPatch()
    await syncPetState({ behavior: 'greeting', speech: '源码已经安全回滚。', busy: false })
  }
  catch (error) {
    patchError.value = error instanceof Error ? error.message : String(error)
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
  }
  finally {
    patchBusy.value = false
  }
}

async function runChecks() {
  if (!await ensureAgentConnected()) return
  patchBusy.value = true
  patchError.value = ''
  await syncPetState({ behavior: 'thinking', speech: '正在运行 Typecheck、Test 和生产构建。', busy: true })
  try {
    const results = await agent.runProjectChecks()
    const success = results.every(result => result.success)
    await syncPetState({
      behavior: success ? 'excited' : 'confused',
      speech: success ? '所有项目检查都通过了，修改可以安全保留。' : '有检查没有通过，我已经把详细输出放在侧边栏。',
      busy: false,
    })
  }
  catch (error) {
    patchError.value = error instanceof Error ? error.message : String(error)
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
  }
  finally {
    patchBusy.value = false
  }
}

async function connectAgent() {
  patchError.value = ''
  await chrome.storage.local.set({
    'nova:agent:url': agentUrl.value,
    'nova:agent:token': agentToken.value,
  })
  await syncPetState({ behavior: 'thinking', speech: '正在连接本地项目 Agent。', busy: true })
  try {
    await agent.connect(agentUrl.value, agentToken.value)
  }
  catch {
    await syncPetState({
      behavior: 'confused',
      speech: agent.error.value || '无法连接本地 Agent，请检查地址和口令。',
      busy: false,
      agentConnected: false,
    })
  }
}

function disconnectAgent() {
  agent.disconnect()
  syncPetState({ behavior: 'listening', speech: '本地 Agent 已断开。', busy: false, agentConnected: false }).catch(() => undefined)
}

async function ensureAgentConnected() {
  showAgent.value = true
  if (agent.connected.value) return true
  if (!agentToken.value.trim()) {
    patchError.value = '请先填写本地 Agent 连接口令。'
    await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
    return false
  }
  await connectAgent()
  return agent.connected.value
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(['nova:agent:url', 'nova:agent:token', 'nova:audit:enabled-categories', 'nova:audit:enabled-rule-codes', PET_VOICE_STORAGE_KEY])
  agentUrl.value = String(stored['nova:agent:url'] || agentUrl.value)
  agentToken.value = String(stored['nova:agent:token'] || '')
  petVoicePreset.value = normalizePetVoicePreset(stored[PET_VOICE_STORAGE_KEY])
  if (Array.isArray(stored['nova:audit:enabled-rule-codes'])) {
    enabledRuleCodes.value = normalizeAuditRuleCodes(stored['nova:audit:enabled-rule-codes'])
    return
  }
  // 从 v0.6.7 的大类配置迁移：已启用大类下的规则默认全部启用。 / Migrate v0.6.7 category settings by enabling every rule in selected categories.
  if (Array.isArray(stored['nova:audit:enabled-categories'])) {
    const legacyCategories = new Set(normalizeAuditCategories(stored['nova:audit:enabled-categories']))
    enabledRuleCodes.value = AUDIT_RULES.filter(rule => legacyCategories.has(rule.category)).map(rule => rule.code)
  }
}

function normalizePetVoicePreset(value: unknown): NovaPetVoicePreset {
  return typeof value === 'string' && NOVA_PET_VOICE_PRESETS.includes(value as NovaPetVoicePreset)
    ? value as NovaPetVoicePreset
    : 'alien'
}

async function selectPetVoice(preset: NovaPetVoicePreset) {
  stopVoicePreview()
  petVoicePreset.value = preset
  voicePreviewStatus.value = preset === 'mute' ? '动作语音已关闭。' : `已切换为${activePetVoice.value.label}。`
  await chrome.storage.local.set({ [PET_VOICE_STORAGE_KEY]: preset })
}

async function previewPetVoice() {
  stopVoicePreview()
  if (petVoicePreset.value === 'mute') {
    voicePreviewStatus.value = '当前为静音模式。'
    return
  }
  voicePreviewStatus.value = '正在准备试听…'
  if (petVoicePreset.value === 'alien') {
    const audio = new Audio(chrome.runtime.getURL('audio/motions/zh-CN/greeting.mp3'))
    voicePreviewAudio = audio
    audio.volume = 0.9
    try {
      await audio.play()
      voicePreviewStatus.value = '正在试听：星云外星人'
    }
    catch (error) {
      voicePreviewStatus.value = `试听失败：${error instanceof Error ? error.message : String(error)}`
    }
    return
  }

  const response = await chrome.runtime.sendMessage({
    type: 'NOVA_TTS_SPEAK',
    text: '嗨！我是诺瓦，今天也一起加油吧。',
    preset: petVoicePreset.value,
  } satisfies NovaRuntimeMessage) as { ok?: boolean; error?: string; voiceName?: string } | undefined
  systemVoicePreviewActive = Boolean(response?.ok)
  voicePreviewStatus.value = response?.ok
    ? `正在试听：${response.voiceName || activePetVoice.value.label}`
    : `试听失败：${response?.error || '系统没有可用的中文语音'}`
}

function stopVoicePreview() {
  if (voicePreviewAudio) {
    voicePreviewAudio.pause()
    voicePreviewAudio.currentTime = 0
    voicePreviewAudio = null
  }
  if (systemVoicePreviewActive) {
    systemVoicePreviewActive = false
    chrome.runtime.sendMessage({ type: 'NOVA_TTS_STOP' } satisfies NovaRuntimeMessage).catch(() => undefined)
  }
}

function normalizeAuditCategories(value: unknown[]): AuditCategory[] {
  const valid = new Set<AuditCategory>(AUDIT_CATEGORIES)
  return [...new Set(value.filter((item): item is AuditCategory => typeof item === 'string' && valid.has(item as AuditCategory)))]
}

function normalizeAuditRuleCodes(value: unknown[]): AuditIssueCode[] {
  const valid = new Set<AuditIssueCode>(AUDIT_RULE_CODES)
  return [...new Set(value.filter((item): item is AuditIssueCode => typeof item === 'string' && valid.has(item as AuditIssueCode)))]
}

async function saveAuditRules() {
  enabledRuleCodes.value = normalizeAuditRuleCodes(enabledRuleCodes.value)
  await chrome.storage.local.set({
    'nova:audit:enabled-rule-codes': [...enabledRuleCodes.value],
    'nova:audit:enabled-categories': [...enabledCategories.value],
  })
}

function rulesForCategory(category: AuditCategory) {
  return AUDIT_RULES.filter(rule => rule.category === category).map(rule => rule.code)
}

function isAuditCategoryChecked(category: AuditCategory) {
  const selected = new Set(enabledRuleCodes.value)
  return rulesForCategory(category).every(code => selected.has(code))
}

function isAuditCategoryIndeterminate(category: AuditCategory) {
  const selected = new Set(enabledRuleCodes.value)
  const rules = rulesForCategory(category)
  const count = rules.filter(code => selected.has(code)).length
  return count > 0 && count < rules.length
}

function selectedRuleCount(category: AuditCategory) {
  const selected = new Set(enabledRuleCodes.value)
  return rulesForCategory(category).filter(code => selected.has(code)).length
}

function toggleAuditCategory(category: AuditCategory, checked: boolean) {
  const selected = new Set(enabledRuleCodes.value)
  for (const code of rulesForCategory(category)) {
    if (checked) selected.add(code)
    else selected.delete(code)
  }
  enabledRuleCodes.value = AUDIT_RULE_CODES.filter(code => selected.has(code))
  saveAuditRules().catch(() => undefined)
}

function selectAllAuditRules() {
  enabledRuleCodes.value = [...AUDIT_RULE_CODES]
  saveAuditRules().catch(() => undefined)
}

function clearAuditRules() {
  enabledRuleCodes.value = []
  saveAuditRules().catch(() => undefined)
}

function auditCategoryLabel(category: AuditCategory) {
  return auditCategoryOptions.find(option => option.value === category)?.label || category
}

async function sendToPage(message: unknown): Promise<any> {
  if (!currentTab.value?.id) return null
  try {
    return await chrome.tabs.sendMessage(currentTab.value.id, message)
  }
  catch (error) {
    pageError.value = '当前页面无法接收命令，请刷新页面后重试。'
    return { ok: false, error: String(error) }
  }
}

function onRuntimeMessage(message: NovaRuntimeMessage) {
  if (message.type === 'YK_PET_MEMORY_DRAFT_READY' && message.tabId === currentTab.value?.id) {
    workspace.value = 'memory'
    return
  }

  if (message.type === 'NOVA_REPORT_UPDATED' && message.tabId === currentTab.value?.id) {
    report.value = message.report
    return
  }

  if (message.type === 'NOVA_SIDE_PANEL_ACTION' && message.tabId === currentTab.value?.id) {
    chrome.storage.local.remove(`nova:pending-action:${message.tabId}`).catch(() => undefined)
    executePetAction(message.action, message.issueId).catch(error => {
      patchError.value = error instanceof Error ? error.message : String(error)
    })
  }
}

async function consumePendingPetAction() {
  const tabId = currentTab.value?.id
  if (!tabId) return
  const key = `nova:pending-action:${tabId}`
  const stored = await chrome.storage.local.get(key)
  const pending = stored[key] as { action?: NovaPetAction; issueId?: string; createdAt?: number } | undefined
  if (!pending?.action) return
  await chrome.storage.local.remove(key)
  if (pending.createdAt && Date.now() - pending.createdAt > 30_000) return
  await executePetAction(pending.action, pending.issueId)
}

// 宠物工程动作在此映射为 Side Panel 用例，避免页面覆盖层直接访问 Agent。 / Pet engineering actions map to Side Panel use cases here so the page overlay never accesses the Agent directly.
async function executePetAction(action: NovaPetAction, issueId?: string) {
  if (action === 'open-memory') {
    workspace.value = 'memory'
    showAgent.value = false
    await nextTick()
    document.querySelector('.memory-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    await syncPetState({ behavior: 'greeting', speech: '宠物记忆已经打开。', busy: false })
    return
  }

  if (action === 'open-report') {
    await nextTick()
    document.querySelector('.report-section, .page-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    await syncPetState({ behavior: 'greeting', speech: '详细审计工作区已经打开。', busy: false })
    return
  }

  if (action === 'network-lab') {
    workspace.value = 'network'
    showAgent.value = false
    await nextTick()
    document.querySelector('.network-lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    await syncPetState({ behavior: 'greeting', speech: '网络实验室已经打开。', busy: false })
    return
  }

  if (action === 'connect-agent') {
    showAgent.value = true
    await nextTick()
    document.querySelector('.agent-connection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (agentToken.value.trim() && !agent.connected.value) await connectAgent()
    else await syncPetState({ behavior: 'greeting', speech: '本地 Agent 连接设置已经打开。', busy: false })
    return
  }

  const issue = report.value?.issues.find(item => item.id === issueId) || report.value?.issues[0]
  if (action === 'generate-patch') {
    if (!issue) {
      patchError.value = '请先运行页面审计并选择一个问题。'
      await syncPetState({ behavior: 'confused', speech: patchError.value, busy: false })
      return
    }
    await generatePatch(issue)
    return
  }

  if (action === 'apply-patch') {
    showAgent.value = true
    await applyPatch()
    return
  }

  if (action === 'run-checks') {
    showAgent.value = true
    await runChecks()
    return
  }

  if (action === 'rollback-patch') {
    showAgent.value = true
    await rollbackPatch()
  }
}

async function syncPetState(state: Partial<NovaPetVisualState>) {
  await sendToPage({ type: 'NOVA_UPDATE_PET_STATE', state } satisfies NovaRuntimeMessage)
}

function onTabActivated() {
  refreshCurrentTab().catch(() => undefined)
}

function onTabUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) {
  if (tabId === currentTab.value?.id && changeInfo.status === 'complete') refreshCurrentTab().catch(() => undefined)
}

function isRestrictedUrl(url?: string) {
  return !url || /^(chrome|edge|about|chrome-extension):/.test(url)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function compactOutput(result: CheckResult) {
  const lines = result.output.split('\n').filter(Boolean)
  return lines.slice(Math.max(0, lines.length - 12)).join('\n')
}
</script>

<template>
  <!-- Side Panel 应用外壳 / Side Panel application shell -->
  <main class="sidepanel-shell">
    <header class="app-header">
      <div class="brand">
        <span>N</span>
        <div><strong>NOVA</strong><small>BROWSER AGENT</small></div>
      </div>
      <button class="agent-toggle" type="button" :class="{ active: showAgent }" @click="showAgent = !showAgent">
        <i :class="agent.status.value" /> Agent
      </button>
    </header>

    <section class="pet-entry-card">
      <div class="pet-entry-icon">N</div>
      <div>
        <span>PRIMARY INTERACTION</span>
        <h2>网页右下角的 3D NOVA 是主入口</h2>
        <p>单击打开功能，双击立即审计，右键打开工程工具；也可以拖动宠物调整位置。</p>
      </div>
      <button type="button" @click="syncPetState({ behavior: 'greeting', speech: '我在这里。摸摸我即可打开全部功能。', busy: false })">呼叫</button>
    </section>

    <section class="pet-voice-card">
      <div class="pet-voice-heading">
        <div><span>PET VOICE</span><h2>动作语音音色</h2></div>
        <button type="button" :disabled="petVoicePreset === 'mute'" @click="previewPetVoice">试听</button>
      </div>
      <div class="pet-voice-options" role="radiogroup" aria-label="动作语音音色">
        <button
          v-for="option in petVoiceOptions"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="petVoicePreset === option.value"
          :class="{ active: petVoicePreset === option.value }"
          @click="selectPetVoice(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <p>{{ activePetVoice.description }}</p>
      <small v-if="voicePreviewStatus">{{ voicePreviewStatus }}</small>
    </section>

    <nav class="workspace-tabs" aria-label="工作区切换">
      <button type="button" :class="{ active: workspace === 'memory' }" @click="workspace = 'memory'">宠物记忆</button>
      <button type="button" :class="{ active: workspace === 'audit' }" @click="workspace = 'audit'">页面审计</button>
      <button type="button" :class="{ active: workspace === 'network' }" @click="workspace = 'network'">网络实验室</button>
    </nav>

    <PetMemory
      v-if="workspace === 'memory'"
      :tab="currentTab"
      :active="workspace === 'memory'"
      @pet-state="syncPetState"
    />

    <template v-else-if="workspace === 'audit'">
    <section class="page-card">
      <div class="page-meta">
        <div>
          <span>CURRENT PAGE</span>
          <h1>{{ currentTab?.title || '等待网页' }}</h1>
          <p>{{ currentTab?.url || '打开一个 http/https 网页开始审计' }}</p>
        </div>
        <div v-if="report" class="score-ring" :class="scoreClass">
          <strong>{{ report.score }}</strong>
          <span>HEALTH</span>
        </div>
      </div>
      <fieldset class="audit-scope">
        <legend><span>审计范围 · {{ enabledRuleCodes.length }}/{{ AUDIT_RULE_CODES.length }}</span><small>未勾选的规则不会执行</small></legend>
        <div class="audit-rule-groups">
          <section v-for="group in auditRuleGroups" :key="group.value" class="audit-rule-group">
            <label class="audit-category-parent">
              <input
                type="checkbox"
                :checked="isAuditCategoryChecked(group.value)"
                :indeterminate="isAuditCategoryIndeterminate(group.value)"
                @change="toggleAuditCategory(group.value, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ group.label }}</span>
              <small>{{ selectedRuleCount(group.value) }}/{{ group.rules.length }}</small>
            </label>
            <div class="audit-rule-options">
              <label v-for="rule in group.rules" :key="rule.code">
                <input v-model="enabledRuleCodes" type="checkbox" :value="rule.code" @change="saveAuditRules">
                <span>{{ rule.label }}</span>
              </label>
            </div>
          </section>
        </div>
        <div class="audit-scope-actions">
          <button type="button" @click="selectAllAuditRules">全选</button>
          <button type="button" @click="clearAuditRules">清空</button>
        </div>
      </fieldset>
      <p v-if="!enabledRuleCodes.length" class="audit-scope-warning">请至少选择一条审计规则。</p>
      <button class="audit-button" type="button" :disabled="auditing || !enabledRuleCodes.length" @click="runAudit">
        <span>{{ auditing ? '正在分析…' : '开始页面审计' }}</span><b>↗</b>
      </button>
      <p v-if="pageError" class="page-error">{{ pageError }}</p>
    </section>

    <section v-if="report" class="report-section">
      <div class="metrics-grid">
        <article v-for="metric in metricCards" :key="metric.label">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      </div>

      <div class="issues-heading">
        <div>
          <span>AUDIT RESULT</span>
          <h2>{{ report.summary.total }} 个改进机会</h2>
        </div>
        <div class="severity-summary">
          <b>{{ report.summary.high }}</b>/<span>{{ report.summary.medium }}</span>/<i>{{ report.summary.low }}</i>
        </div>
      </div>

      <div class="report-scope" aria-label="本次审计范围">
        <span
          v-for="option in auditCategoryOptions"
          :key="option.value"
          :class="{ unchecked: !reportCategories.includes(option.value) }"
        >
          {{ option.label }} · {{ reportCategories.includes(option.value) ? '已检查' : '未检查' }}
        </span>
      </div>

      <details class="report-rule-scope">
        <summary>本次执行 {{ reportRuleCodes.length }}/{{ AUDIT_RULE_CODES.length }} 条规则</summary>
        <div>
          <span
            v-for="rule in AUDIT_RULES"
            :key="rule.code"
            :class="{ unchecked: !reportRuleCodes.includes(rule.code) }"
          >
            {{ auditRuleLabels[rule.code] }} · {{ reportRuleCodes.includes(rule.code) ? '已检查' : '未检查' }}
          </span>
        </div>
      </details>

      <div class="filter-row">
        <button v-for="option in ['all', 'high', 'medium', 'low'] as const" :key="option" type="button" :class="{ active: filter === option }" @click="filter = option">
          {{ option === 'all' ? '全部' : option === 'high' ? '高' : option === 'medium' ? '中' : '低' }}
        </button>
      </div>

      <div class="filter-row category-filter-row" aria-label="按问题类型筛选">
        <button type="button" :class="{ active: issueCategoryFilter === 'all' }" @click="issueCategoryFilter = 'all'">全部类型</button>
        <button
          v-for="category in reportCategories"
          :key="category"
          type="button"
          :class="{ active: issueCategoryFilter === category }"
          @click="issueCategoryFilter = category"
        >
          {{ auditCategoryLabel(category) }}
        </button>
      </div>

      <div class="issues-list">
        <IssueCard
          v-for="issue in filteredIssues"
          :key="issue.id"
          :issue="issue"
          :previewing="previewIssueId === issue.id"
          :agent-connected="agent.connected.value"
          :busy="patchBusy"
          @highlight="highlightIssue"
          @preview="previewIssue"
          @rollback-preview="rollbackPreview"
          @remember="rememberIssue"
          @patch="generatePatch"
        />
      </div>
    </section>
    </template>

    <NetworkLab
      v-else
      :tab="currentTab"
      :active="workspace === 'network'"
      @pet-state="syncPetState"
    />

    <AgentConnection
      v-if="showAgent"
      v-model:url="agentUrl"
      v-model:token="agentToken"
      :status="agent.status.value"
      :error="agent.error.value"
      :project="agent.project.value"
      @connect="connectAgent"
      @disconnect="disconnectAgent"
    />

    <section v-if="showAgent && agent.proposal.value" class="patch-panel">
      <div class="section-title">
        <div><span>PATCH PROPOSAL</span><h2>源码修改建议</h2></div>
        <span class="confidence">{{ Math.round(agent.proposal.value.confidence * 100) }}%</span>
      </div>
      <p>{{ agent.proposal.value.reason }}</p>
      <code v-if="agent.proposal.value.filePath" class="file-path">{{ agent.proposal.value.filePath }}</code>

      <pre v-if="agent.proposal.value.diff" class="diff-view">{{ agent.proposal.value.diff }}</pre>
      <div v-else-if="agent.proposal.value.candidates.length" class="candidate-list">
        <span>候选源码文件</span>
        <code v-for="candidate in agent.proposal.value.candidates" :key="candidate.filePath">{{ candidate.filePath }} · {{ candidate.score }}</code>
      </div>

      <p v-if="patchError" class="page-error">{{ patchError }}</p>

      <div class="patch-actions">
        <button v-if="agent.proposal.value.canApply && !agent.proposal.value.applied" type="button" :disabled="patchBusy" @click="applyPatch">确认写入</button>
        <button v-if="agent.proposal.value.applied" type="button" :disabled="patchBusy" @click="runChecks">运行检查</button>
        <button v-if="agent.proposal.value.applied" class="secondary" type="button" :disabled="patchBusy" @click="rollbackPatch">回滚补丁</button>
      </div>

      <div v-if="agent.checks.value.length" class="check-results">
        <article v-for="result in agent.checks.value" :key="result.script" :class="{ success: result.success }">
          <header><strong>{{ result.script }}</strong><span>{{ result.success ? 'PASS' : 'FAIL' }} · {{ result.durationMs }}ms</span></header>
          <pre>{{ compactOutput(result) }}</pre>
        </article>
      </div>
    </section>

    <footer class="app-footer">
      <span>NOVA {{ NOVA_VERSION }}</span>
      <span>AUDIT → NETWORK → MOCK → VERIFY</span>
    </footer>
  </main>
</template>
