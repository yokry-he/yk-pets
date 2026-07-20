<!--
  文件职责 / File responsibility
  网络实验室主界面，协调概览、请求、规则列表和规则编辑页面。
  Network Lab shell coordinating overview, requests, rule list, and rule editor pages.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onErrorCaptured, onMounted, ref, watch } from 'vue'
import type { NetworkEntry, NetworkResourceKind, NetworkRule } from '@nova/shared/network'
import type { NovaPetVisualState, NovaRuntimeMessage } from '@nova/shared/messages'
import { displayName, formatBytes } from '../../application/network-analysis-service'
import type { NetworkRuleEditorMode } from '../../domain/network-rule-factory'
import { cloneNetworkValue } from '../../domain/network-value-clone'
import type { NetworkRuleEditorDraft } from '../../infrastructure/chrome-rule-draft-repository'
import { useNetworkLab } from '../composables/useNetworkLab'
import NetworkPerformanceCharts from './NetworkPerformanceCharts.vue'
import NetworkRuleEditorPage from '../pages/NetworkRuleEditorPage.vue'
import NetworkRuleListPage from '../pages/NetworkRuleListPage.vue'

const props = defineProps<{
  tab: chrome.tabs.Tab | null
  active: boolean
}>()

const emit = defineEmits<{
  petState: [state: Partial<NovaPetVisualState>]
}>()

interface EditorContext {
  mode: NetworkRuleEditorMode
  rule: NetworkRule
  sourceRuleId?: string
}

// 主组件只负责页面导航和展示，业务操作由 Composable/Application Service 完成。 / The shell owns navigation and presentation; composables/application services own business operations.
const lab = useNetworkLab()
const section = ref<'overview' | 'requests' | 'rules'>('overview')
const editorContext = ref<EditorContext | null>(null)
const editorError = ref('')
const requestQuery = ref('')
const onlySlow = ref(false)
type ResourceFilterId = 'all' | 'fetch-xhr' | NetworkResourceKind
const resourceFilter = ref<ResourceFilterId>('all')
const actionBusy = ref(false)
const expandedEntryIds = ref<string[]>([])
const copied = ref<'url' | 'response' | null>(null)
const highlightedRuleId = ref('')
const availableDraft = ref<NetworkRuleEditorDraft | null>(null)
let highlightTimer: number | null = null

const requestTypeFilters: Array<{ id: ResourceFilterId; label: string; types?: NetworkResourceKind[] }> = [
  { id: 'all', label: '全部' },
  { id: 'fetch-xhr', label: 'Fetch/XHR', types: ['fetch', 'xhr'] },
  { id: 'document', label: '文档', types: ['document'] },
  { id: 'style', label: 'CSS', types: ['style'] },
  { id: 'script', label: 'JS', types: ['script'] },
  { id: 'font', label: '字体', types: ['font'] },
  { id: 'image', label: '图片', types: ['image'] },
  { id: 'media', label: '媒体', types: ['media'] },
  { id: 'manifest', label: 'Manifest', types: ['manifest'] },
  { id: 'socket', label: 'Socket', types: ['socket'] },
  { id: 'wasm', label: 'Wasm', types: ['wasm'] },
  { id: 'other', label: '其他', types: ['other'] },
]

onErrorCaptured((reason) => {
  if (!editorContext.value) return
  editorError.value = reason instanceof Error ? reason.message : String(reason)
  console.error('[NOVA rule editor]', reason)
  return false
})

const originLabel = computed(() => lab.origin.value || '未连接网页')
const requestTypeCounts = computed(() => Object.fromEntries(requestTypeFilters.map((filter) => {
  const count = filter.id === 'all'
    ? lab.entries.value.length
    : lab.entries.value.filter(entry => filter.types?.includes(entry.resourceType)).length
  return [filter.id, count]
})) as Record<ResourceFilterId, number>)
const filteredEntries = computed(() => {
  const query = requestQuery.value.trim().toLowerCase()
  return lab.entries.value.filter((entry) => {
    const selected = requestTypeFilters.find(filter => filter.id === resourceFilter.value)
    if (selected?.types && !selected.types.includes(entry.resourceType)) return false
    if (onlySlow.value && entry.duration < lab.settings.value.slowThresholdMs) return false
    if (!query) return true
    return `${entry.method} ${entry.url} ${entry.status ?? ''}`.toLowerCase().includes(query)
  }).slice(0, 160)
})
const maxRequestDuration = computed(() => Math.max(1, ...filteredEntries.value.map(entry => entry.duration)))
const enabledRules = computed(() => lab.rules.value.filter(rule => rule.enabled).length)
const interceptorLabel = computed(() => {
  if (!lab.settings.value.enabled) return lab.snapshot.value?.interceptor?.ready ? '拦截器已连接' : '拦截器待连接'
  const status = lab.snapshot.value?.interceptor
  if (!status?.ready) return '未检测到页面拦截器，请刷新网页'
  if (!status.configured || !status.enabled) return '规则正在同步'
  return `拦截器已同步 ${status.ruleCount} 条规则`
})
const interceptorWarning = computed(() => lab.settings.value.enabled && !lab.snapshot.value?.interceptor?.configured)

watch(() => [props.tab?.id, props.tab?.url, props.active] as const, async () => {
  editorContext.value = null
  await lab.attach(props.tab, props.active)
  availableDraft.value = await lab.loadDraft()
}, { immediate: true })

onMounted(() => chrome.runtime.onMessage.addListener(onRuntimeMessage))
onBeforeUnmount(() => {
  chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  if (highlightTimer !== null) window.clearTimeout(highlightTimer)
})

function onRuntimeMessage(message: NovaRuntimeMessage) {
  if (message.type !== 'NOVA_NETWORK_UPDATED' || !props.active) return
  try {
    if (new URL(message.pageUrl).origin !== new URL(props.tab?.url || '').origin) return
  }
  catch { return }
  lab.refresh({ quiet: true }).catch(() => undefined)
}

async function toggleNetwork() {
  if (actionBusy.value) return
  actionBusy.value = true
  const enabled = !lab.settings.value.enabled
  try {
    await lab.setEnabled(enabled)
    emit('petState', {
      behavior: enabled ? 'excited' : 'greeting',
      speech: enabled
        ? `当前网站的网络拦截与 Mock 已开启，共有 ${enabledRules.value} 条启用规则。`
        : '当前网站的网络拦截与 Mock 已关闭，所有请求恢复真实响应。',
      busy: false,
    })
  }
  finally { actionBusy.value = false }
}

async function saveRule(rule: NetworkRule) {
  actionBusy.value = true
  try {
    await lab.saveRule(rule)
    await lab.clearDraft()
    availableDraft.value = null
    editorContext.value = null
    section.value = 'rules'
    highlightRule(rule.id)
    emit('petState', {
      behavior: 'happy',
      speech: lab.settings.value.enabled ? 'Mock 规则已保存并立即同步到当前页面。' : 'Mock 规则已保存。开启总开关后会立即生效。',
      busy: false,
    })
  }
  finally { actionBusy.value = false }
}

async function deleteRule(rule: NetworkRule) {
  if (!confirm(`删除规则“${rule.name}”？`)) return
  await lab.removeRule(rule.id)
}

function openCreate() {
  section.value = 'rules'
  editorError.value = ''
  editorContext.value = { mode: 'create', rule: lab.newRule() }
}

function openFromEntry(entry: NetworkEntry) {
  section.value = 'rules'
  editorError.value = ''
  editorContext.value = { mode: 'from-request', rule: lab.createRuleFromEntry(entry) }
}

function openEdit(rule: NetworkRule) {
  editorError.value = ''
  editorContext.value = { mode: 'edit', rule: cloneNetworkValue(rule), sourceRuleId: rule.id }
}

function openDuplicate(rule: NetworkRule) {
  editorError.value = ''
  editorContext.value = { mode: 'duplicate', rule: lab.duplicateRule(rule), sourceRuleId: rule.id }
}

function restoreDraft() {
  const stored = availableDraft.value
  if (!stored) return
  editorError.value = ''
  editorContext.value = {
    mode: stored.mode,
    rule: cloneNetworkValue(stored.rule),
    sourceRuleId: stored.sourceRuleId,
  }
}

function closeEditor() {
  editorError.value = ''
  editorContext.value = null
  section.value = 'rules'
  lab.loadDraft().then(draft => { availableDraft.value = draft }).catch(() => undefined)
}

function toggleEntry(entry: NetworkEntry) {
  expandedEntryIds.value = expandedEntryIds.value.includes(entry.id)
    ? expandedEntryIds.value.filter(id => id !== entry.id)
    : expandedEntryIds.value.concat(entry.id)
}

function isEntryExpanded(entryId: string) {
  return expandedEntryIds.value.includes(entryId)
}

function previewText(value: unknown) {
  if (value === undefined) return ''
  try { return JSON.stringify(value, null, 2) }
  catch { return String(value) }
}

function entryResponsePreview(entry: NetworkEntry) {
  return previewText(entry.responsePreview)
}

function entryRequestPreview(entry: NetworkEntry) {
  return previewText(entry.requestBodyPreview)
}

function entryTiming(entry: NetworkEntry) {
  return [
    ['DNS', entry.timing.dns],
    ['连接', entry.timing.connect],
    ['TLS', entry.timing.tls],
    ['TTFB', entry.timing.ttfb],
    ['下载', entry.timing.download],
  ].filter(([, value]) => Number(value) > 0) as Array<[string, number]>
}

function entryQueryPairs(entry: NetworkEntry) {
  try {
    const url = new URL(entry.url)
    return Array.from(url.searchParams.entries())
  }
  catch {
    return [] as Array<[string, string]>
  }
}

async function copyValue(kind: 'url' | 'response', value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copied.value = kind
    window.setTimeout(() => {
      if (copied.value === kind) copied.value = null
    }, 1200)
  }
  catch { copied.value = null }
}

function requestStateClass(entry: NetworkEntry) {
  if (entry.error || (entry.status || 0) >= 400) return 'error'
  if (entry.mocked || entry.modified) return 'mocked'
  if (entry.duration >= lab.settings.value.slowThresholdMs) return 'slow'
  return ''
}

function formatDuration(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
}

function resourceTypeLabel(type: NetworkResourceKind) {
  const filter = requestTypeFilters.find(item => item.types?.length === 1 && item.types[0] === type)
  if (filter) return filter.label
  if (type === 'fetch' || type === 'xhr') return type.toUpperCase()
  return type
}

function highlightRule(ruleId: string) {
  highlightedRuleId.value = ruleId
  if (highlightTimer !== null) window.clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(() => { highlightedRuleId.value = '' }, 2600)
}
</script>

<template>
  <!-- 稳定根容器在列表和编辑态之间保持不变，避免 Side Panel 切换时出现空白工作区。 / The stable root remains mounted across list/editor modes to prevent a blank Side Panel workspace. -->
  <section class="network-lab" :class="{ 'editor-active': editorContext }">
    <section v-if="editorContext && editorError" class="editor-runtime-error" role="alert">
      <strong>规则编辑器未能打开</strong>
      <p>{{ editorError }}</p>
      <button type="button" @click="closeEditor">返回规则列表</button>
    </section>

    <NetworkRuleEditorPage
      v-else-if="editorContext"
      :key="`${editorContext.mode}:${editorContext.rule.id}`"
      :rule="editorContext.rule"
      :mode="editorContext.mode"
      :origin="lab.origin.value"
      :source-rule-id="editorContext.sourceRuleId"
      :rules="lab.rules.value"
      :busy="actionBusy"
      @save="saveRule"
      @cancel="closeEditor"
    />

    <template v-else>
    <div class="network-master-card" :class="{ enabled: lab.settings.value.enabled }">
      <div class="network-master-copy">
        <span>NETWORK LAB · CURRENT SITE</span>
        <h2>网络拦截与性能分析</h2>
        <p>{{ originLabel }}</p>
      </div>
      <button class="network-master-toggle" type="button" role="switch" :aria-checked="lab.settings.value.enabled" :disabled="actionBusy" @click="toggleNetwork">
        <i /><strong>{{ lab.settings.value.enabled ? '已开启' : '已关闭' }}</strong>
      </button>
      <div class="master-status-row">
        <span>{{ enabledRules }} 条规则启用</span>
        <span>{{ lab.summary.value.requestCount }} 条请求已采集</span>
        <span :class="{ warning: interceptorWarning }">{{ interceptorLabel }}</span>
      </div>
    </div>

    <p v-if="lab.error.value" class="network-notice">{{ lab.error.value }}</p>

    <nav class="network-tabs" aria-label="网络实验室视图">
      <button type="button" :class="{ active: section === 'overview' }" @click="section = 'overview'">概览</button>
      <button type="button" :class="{ active: section === 'requests' }" @click="section = 'requests'">请求 <b>{{ lab.summary.value.requestCount }}</b></button>
      <button type="button" :class="{ active: section === 'rules' }" @click="section = 'rules'">规则 <b>{{ lab.rules.value.length }}</b></button>
    </nav>

    <template v-if="section === 'overview'">
      <div class="network-metrics">
        <article><span>性能评分</span><strong>{{ lab.summary.value.score }}</strong><small>NETWORK SCORE</small></article>
        <article><span>慢请求</span><strong>{{ lab.summary.value.slowCount }}</strong><small>≥ {{ lab.settings.value.slowThresholdMs }}ms</small></article>
        <article><span>P95</span><strong>{{ formatDuration(lab.summary.value.p95Duration) }}</strong><small>响应耗时</small></article>
        <article><span>传输体积</span><strong>{{ formatBytes(lab.summary.value.totalTransferSize) }}</strong><small>{{ lab.summary.value.errorCount }} 个错误</small></article>
      </div>

      <div class="threshold-control">
        <label for="slow-threshold">慢请求阈值</label>
        <select id="slow-threshold" :value="lab.settings.value.slowThresholdMs" @change="lab.updateSlowThreshold(Number(($event.target as HTMLSelectElement).value))">
          <option :value="500">500ms</option><option :value="800">800ms</option><option :value="1000">1 秒</option><option :value="1500">1.5 秒</option><option :value="3000">3 秒</option>
        </select>
        <button type="button" :disabled="lab.loading.value" @click="lab.refresh()">{{ lab.loading.value ? '刷新中…' : '刷新数据' }}</button>
      </div>

      <NetworkPerformanceCharts :entries="lab.entries.value" :top-slow="lab.topSlow.value" :resources="lab.resources.value" />

      <section class="diagnosis-card">
        <header><div><span>AUTO DIAGNOSIS</span><h3>自动诊断</h3></div><b>{{ lab.diagnoses.value.length }}</b></header>
        <div v-if="lab.diagnoses.value.length" class="diagnosis-list">
          <article v-for="item in lab.diagnoses.value" :key="item.id" :data-severity="item.severity">
            <i /><div><strong>{{ item.title }}</strong><p>{{ item.description }}</p><small>{{ item.suggestion }}</small></div>
          </article>
        </div>
        <p v-else class="empty-state">暂未发现明显的慢请求或错误请求。</p>
      </section>
    </template>

    <template v-else-if="section === 'requests'">
      <div class="request-toolbar">
        <input v-model="requestQuery" type="search" placeholder="筛选 URL、方法或状态码" aria-label="筛选网络请求">
        <button type="button" :class="{ active: onlySlow }" @click="onlySlow = !onlySlow">只看慢请求</button>
        <button type="button" @click="lab.clearEntries">清空</button>
      </div>

      <nav class="request-type-filters" aria-label="按资源类型筛选">
        <button
          v-for="option in requestTypeFilters"
          :key="option.id"
          type="button"
          :class="{ active: resourceFilter === option.id }"
          @click="resourceFilter = option.id"
        >
          {{ option.label }} <b>{{ requestTypeCounts[option.id] }}</b>
        </button>
      </nav>

      <div v-if="filteredEntries.length" class="request-list">
        <article
          v-for="entry in filteredEntries"
          :key="entry.id"
          :class="[requestStateClass(entry), { selected: isEntryExpanded(entry.id) }]"
        >
          <header class="request-card-header">
            <span class="method">{{ entry.method }}</span>
            <strong :title="entry.url">{{ displayName(entry) }}</strong>
            <b>{{ entry.status ?? '—' }}</b>
          </header>
          <p :title="entry.url">{{ entry.pathname }}</p>
          <div class="request-duration-track"><i :style="{ width: `${Math.max(2, entry.duration / maxRequestDuration * 100)}%` }" /></div>
          <footer class="request-card-footer">
            <span>{{ formatDuration(entry.duration) }}</span>
            <span>{{ formatBytes(entry.transferSize) }}</span>
            <em class="resource-kind">{{ resourceTypeLabel(entry.resourceType) }}</em>
            <em v-if="entry.mocked">MOCK</em>
            <em v-else-if="entry.modified">MODIFIED</em>
            <button v-if="entry.source === 'fetch' || entry.source === 'xhr'" type="button" @click.stop="openFromEntry(entry)">生成 Mock</button>
            <button type="button" class="detail-toggle" @click.stop="toggleEntry(entry)">{{ isEntryExpanded(entry.id) ? '收起详情' : '展开详情' }}</button>
          </footer>

          <section v-if="isEntryExpanded(entry.id)" class="request-inline-detail">
            <code :title="entry.url">{{ entry.url }}</code>
            <div class="detail-metrics">
              <span><small>状态</small><b>{{ entry.status ?? '—' }}</b></span>
              <span><small>耗时</small><b>{{ formatDuration(entry.duration) }}</b></span>
              <span><small>体积</small><b>{{ formatBytes(entry.transferSize) }}</b></span>
              <span><small>类型</small><b>{{ resourceTypeLabel(entry.resourceType) }}</b></span>
            </div>
            <div v-if="entryTiming(entry).length" class="detail-timing">
              <span v-for="item in entryTiming(entry)" :key="item[0]"><small>{{ item[0] }}</small><b>{{ formatDuration(item[1]) }}</b></span>
            </div>
            <div v-if="entryQueryPairs(entry).length" class="detail-query-list">
              <strong>Query 参数</strong>
              <div>
                <span v-for="item in entryQueryPairs(entry)" :key="`${item[0]}:${item[1]}`">{{ item[0] }}={{ item[1] }}</span>
              </div>
            </div>
            <div v-if="entry.requestHeaders || entry.responseHeaders" class="detail-header-grid">
              <section v-if="entry.requestHeaders">
                <header>请求头</header>
                <pre>{{ previewText(entry.requestHeaders) }}</pre>
              </section>
              <section v-if="entry.responseHeaders">
                <header>响应头</header>
                <pre>{{ previewText(entry.responseHeaders) }}</pre>
              </section>
            </div>
            <div v-if="entryRequestPreview(entry) || entryResponsePreview(entry)" class="detail-payload-grid">
              <section v-if="entryRequestPreview(entry)">
                <header>请求体</header>
                <pre>{{ entryRequestPreview(entry) }}</pre>
              </section>
              <section v-if="entryResponsePreview(entry)">
                <header>响应预览</header>
                <pre>{{ entryResponsePreview(entry) }}</pre>
              </section>
            </div>
            <p v-else class="detail-note">当前请求没有可展示的请求/响应预览。跨域资源或大型响应可能只记录性能数据。</p>
            <div v-if="entry.error" class="detail-error">{{ entry.error }}</div>
            <footer class="request-detail-actions">
              <button type="button" @click="copyValue('url', entry.url)">{{ copied === 'url' ? '已复制' : '复制 URL' }}</button>
              <button v-if="entryResponsePreview(entry)" type="button" @click="copyValue('response', entryResponsePreview(entry))">{{ copied === 'response' ? '已复制' : '复制响应' }}</button>
              <button v-if="entry.source === 'fetch' || entry.source === 'xhr'" type="button" class="primary" @click="openFromEntry(entry)">基于请求生成规则</button>
            </footer>
          </section>
        </article>
      </div>
      <p v-else class="empty-state">没有符合条件的请求。刷新网页后可看到完整采集结果。</p>
    </template>

    <template v-else>
      <button v-if="availableDraft" type="button" class="draft-restore-banner" @click="restoreDraft">
        <span>检测到未完成草稿</span><strong>恢复“{{ availableDraft.rule.name }}”</strong><b>继续编辑 →</b>
      </button>
      <NetworkRuleListPage
        :rules="lab.rules.value"
        :entries="lab.entries.value"
        :origin="lab.origin.value"
        :highlighted-rule-id="highlightedRuleId"
        @create="openCreate"
        @edit="openEdit"
        @duplicate="openDuplicate"
        @remove="deleteRule"
        @toggle="lab.toggleRule"
      />
    </template>
    </template>
  </section>
</template>

<style scoped>
.network-lab { display: grid; gap: 11px; margin-top: 12px; }
.editor-runtime-error { display: grid; gap: 9px; padding: 18px; border: 1px solid rgba(255,111,143,.34); border-radius: 14px; background: rgba(43,13,25,.72); color: #ffd8e1; }.editor-runtime-error strong { font-size: 13px; }.editor-runtime-error p { margin: 0; color: #ff9bb0; font: 9px/1.55 ui-monospace, monospace; word-break: break-word; }.editor-runtime-error button { justify-self: start; min-height: 32px; padding: 0 10px; border: 1px solid #3a405d; border-radius: 9px; background: #111629; color: #d8dcef; cursor: pointer; }
.network-master-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 14px; border: 1px solid #282f4b; border-radius: 18px; background: linear-gradient(145deg, rgba(15,18,32,.96), rgba(9,13,25,.96)); transition: border-color .18s ease, box-shadow .18s ease; }
.network-master-card.enabled { border-color: rgba(112,102,255,.62); box-shadow: 0 16px 38px rgba(112,102,255,.12), inset 0 1px rgba(255,255,255,.035); }
.network-master-copy { min-width: 0; }
.network-master-copy > span, .diagnosis-card header span { color: #757e9f; font: 700 8px/1 ui-monospace, monospace; letter-spacing: .14em; }
.network-master-copy h2 { margin: 6px 0 4px; font-size: 15px; }
.network-master-copy p { margin: 0; overflow: hidden; color: #707898; font: 9px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.network-master-toggle { min-width: 90px; height: 40px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid #343b58; border-radius: 12px; background: #101526; color: #8d95b5; cursor: pointer; }
.network-master-toggle i { width: 9px; height: 9px; border-radius: 50%; background: #69718f; }
.enabled .network-master-toggle { border-color: rgba(112,102,255,.6); color: #f0efff; background: rgba(112,102,255,.14); }
.enabled .network-master-toggle i { background: #8c84ff; box-shadow: 0 0 12px rgba(112,102,255,.88); }
.master-status-row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
.master-status-row span { padding: 5px 7px; border-radius: 7px; background: #0a0e1a; color: #707999; font-size: 8px; }
.master-status-row span.warning { color: #ffd36a; background: rgba(255,211,106,.08); }
.network-notice { margin: 0; padding: 9px 10px; border: 1px solid rgba(255,211,106,.2); border-radius: 10px; background: rgba(255,211,106,.06); color: #b8aa7c; font-size: 9px; line-height: 1.45; }
.network-tabs { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 5px; padding: 4px; border: 1px solid #232941; border-radius: 12px; background: #090d18; }
.network-tabs button { min-height: 34px; border: 0; border-radius: 9px; background: transparent; color: #747d9d; cursor: pointer; }
.network-tabs button.active { color: #f0efff; background: rgba(112,102,255,.16); box-shadow: inset 0 0 0 1px rgba(112,102,255,.26); }
.network-tabs b { margin-left: 3px; color: #8e87ff; }
.network-metrics { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }
.network-metrics article { min-width: 0; padding: 11px; border: 1px solid #242b45; border-radius: 13px; background: #0a0e1a; }
.network-metrics span { display: block; color: #747d9e; font-size: 8px; }
.network-metrics strong { display: block; margin: 5px 0 3px; overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.network-metrics small { display: block; color: #555f7e; font-size: 7px; }
.threshold-control { display: grid; grid-template-columns: minmax(0,1fr) 94px 88px; align-items: center; gap: 7px; padding: 9px 10px; border: 1px solid #242b45; border-radius: 12px; background: #0a0e1a; }
.threshold-control label { color: #7c84a4; font-size: 9px; }
.threshold-control select, .threshold-control button, .request-toolbar input, .request-toolbar button { min-height: 32px; border: 1px solid #2a3150; border-radius: 9px; background: #101526; color: #aeb5d0; font-size: 9px; }
.threshold-control select { padding: 0 6px; }.threshold-control button { cursor: pointer; }
.diagnosis-card { padding: 12px; border: 1px solid #242b45; border-radius: 14px; background: #0a0e1a; }
.diagnosis-card > header { display: flex; justify-content: space-between; align-items: center; }.diagnosis-card h3 { margin: 5px 0 0; font-size: 12px; }.diagnosis-card header b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; background: rgba(112,102,255,.13); color: #a49eff; }
.diagnosis-list { display: grid; gap: 7px; margin-top: 11px; }.diagnosis-list article { display: grid; grid-template-columns: 7px minmax(0,1fr); gap: 8px; padding: 9px; border-radius: 10px; background: #0d1221; }.diagnosis-list i { width: 7px; height: 7px; margin-top: 3px; border-radius: 50%; background: #61dcca; }.diagnosis-list article[data-severity="medium"] i { background: #ffd36a; }.diagnosis-list article[data-severity="high"] i { background: #ff6f8f; }.diagnosis-list strong { font-size: 10px; }.diagnosis-list p { margin: 4px 0; color: #8e96b5; font-size: 9px; line-height: 1.4; }.diagnosis-list small { color: #646d8c; font-size: 8px; line-height: 1.45; }
.request-toolbar { display: grid; grid-template-columns: minmax(0,1fr) 82px 48px; gap: 6px; }.request-toolbar input { min-width: 0; padding: 0 9px; outline: 0; }.request-toolbar button { padding: 0 6px; cursor: pointer; }.request-toolbar button.active { border-color: #7066ff; color: #eeeaff; background: rgba(112,102,255,.14); }
.request-type-filters { display: flex; gap: 6px; overflow-x: auto; padding: 1px 0 4px; scrollbar-width: thin; }.request-type-filters button { min-width: max-content; min-height: 29px; padding: 0 9px; border: 1px solid #272e49; border-radius: 999px; background: #0b0f1c; color: #747d9e; cursor: pointer; font-size: 8px; }.request-type-filters button b { margin-left: 3px; color: #9a94ff; }.request-type-filters button.active { border-color: #7066ff; color: #f1f2ff; background: rgba(112,102,255,.15); }
.request-list { display: grid; gap: 8px; }.request-list article { display: grid; gap: 7px; padding: 10px; border: 1px solid #242b45; border-left: 3px solid #5d6688; border-radius: 12px; background: #0a0e1a; transition: border-color .16s ease, background .16s ease; }.request-list article.slow { border-left-color: #ffd36a; }.request-list article.error { border-left-color: #ff6f8f; }.request-list article.mocked { border-left-color: #8d84ff; }.request-list article:hover, .request-list article.selected { border-color: rgba(112,102,255,.48); background: rgba(112,102,255,.055); }.request-card-header { display: grid; grid-template-columns: 38px minmax(0,1fr) 30px; align-items: center; gap: 6px; }.request-list .method { color: #9b94ff; font: 700 8px ui-monospace, monospace; }.request-card-header strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.request-card-header b { color: #7e87a7; font: 8px ui-monospace, monospace; text-align: right; }.request-list p { margin: 0; overflow: hidden; color: #626b8b; font: 8px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }.request-duration-track { height: 4px; overflow: hidden; border-radius: 999px; background: #151b2e; }.request-duration-track i { display: block; height: 100%; border-radius: inherit; background: #7066ff; }.request-card-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: #747d9e; font: 8px ui-monospace, monospace; }.request-card-footer em { padding: 3px 5px; border-radius: 5px; background: rgba(112,102,255,.13); color: #a9a2ff; font-style: normal; }.request-card-footer button { min-height: 26px; padding: 0 7px; border: 1px solid rgba(112,102,255,.38); border-radius: 7px; background: rgba(112,102,255,.1); color: #c8c4ff; font-size: 8px; cursor: pointer; }.request-card-footer .detail-toggle { margin-left: auto; }
.request-card-footer em.resource-kind { background: rgba(82,224,208,.08); color: #74d8ca; }
.request-inline-detail { display: grid; gap: 9px; padding-top: 3px; border-top: 1px solid rgba(112,102,255,.12); }.request-inline-detail > code { overflow: hidden; color: #777f9e; font: 8px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }.detail-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; }.detail-metrics span, .detail-timing span { min-width: 0; padding: 7px; border-radius: 8px; background: #0e1322; }.detail-metrics small, .detail-timing small, .detail-query-list strong, .detail-header-grid header, .detail-payload-grid header { display: block; color: #606987; font-size: 7px; }.detail-metrics b, .detail-timing b { display: block; margin-top: 3px; overflow: hidden; color: #cbd0e8; font: 8px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }.detail-timing { display: flex; flex-wrap: wrap; gap: 5px; }.detail-timing span { min-width: 58px; flex: 1; }.detail-query-list { display: grid; gap: 5px; }.detail-query-list div { display: flex; flex-wrap: wrap; gap: 5px; }.detail-query-list span { padding: 4px 6px; border-radius: 999px; background: rgba(112,102,255,.12); color: #cfd3ec; font: 8px ui-monospace, monospace; }.detail-header-grid, .detail-payload-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }.detail-header-grid section, .detail-payload-grid section { display: grid; gap: 5px; }.request-inline-detail pre { max-height: 220px; margin: 0; padding: 10px; overflow: auto; border: 1px solid #242b45; border-radius: 10px; background: #060a13; color: #aeb5d1; font: 8px/1.55 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }.detail-note { margin: 0; color: #66708f; font-size: 8px; line-height: 1.5; }.detail-error { padding: 8px; border-radius: 9px; border: 1px solid rgba(255,111,143,.28); background: rgba(43,13,25,.86); color: #ff9bb0; font-size: 8px; line-height: 1.5; }.request-detail-actions { display: flex; flex-wrap: wrap; gap: 6px; }.request-detail-actions button { min-height: 30px; padding: 0 8px; border: 1px solid #303752; border-radius: 8px; background: #111629; color: #aab1cd; font-size: 8px; cursor: pointer; }.request-detail-actions button.primary { margin-left: auto; border-color: rgba(112,102,255,.45); background: rgba(112,102,255,.15); color: #d8d5ff; }
.draft-restore-banner { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 3px 10px; padding: 10px; border: 1px solid rgba(82,224,208,.3); border-radius: 12px; background: rgba(82,224,208,.07); color: #d7f8f2; text-align: left; cursor: pointer; }.draft-restore-banner span { color: #69cabe; font-size: 7px; }.draft-restore-banner strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.draft-restore-banner b { grid-row: 1 / 3; grid-column: 2; align-self: center; color: #86dcd1; font-size: 8px; }
.empty-state { margin: 0; padding: 24px 12px; border: 1px dashed #2a3150; border-radius: 13px; color: #68718f; font-size: 9px; line-height: 1.5; text-align: center; }
@media (min-width: 520px) { .network-metrics { grid-template-columns: repeat(4,minmax(0,1fr)); } }
@media (max-width: 360px) { .network-master-card { grid-template-columns: 1fr; }.network-master-toggle { width: 100%; }.master-status-row { grid-column: 1; }.threshold-control { grid-template-columns: 1fr 94px; }.threshold-control button { grid-column: 1 / -1; }.request-toolbar { grid-template-columns: 1fr 1fr; }.request-toolbar input { grid-column: 1 / -1; }.detail-metrics, .detail-header-grid, .detail-payload-grid { grid-template-columns: 1fr; }.request-detail-actions button.primary { margin-left: 0; width: 100%; } }
</style>
