<!--
  文件职责 / File responsibility
  提供本地优先的宠物记忆工作区：快速记录、页面上下文、状态流转、搜索标签、编辑、导出和撤销归档。
  Provides the local-first pet-memory workspace with quick capture, page context, status flow, search, tags, editing, export, and archive undo.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  PET_MEMORY_PENDING_PREFIX,
  memoryMatchesPage,
  normalizeMemoryPageUrl,
  type PetMemoryCard,
  type PetMemoryDraftIntent,
  type PetMemoryPriority,
  type PetMemoryStatus,
} from '@nova/shared/pet-memory'
import type { NovaPetVisualState, NovaRuntimeMessage } from '@nova/shared/messages'
import { usePetMemory } from '../composables/usePetMemory'

const props = defineProps<{
  tab: chrome.tabs.Tab | null
  active: boolean
}>()

const emit = defineEmits<{
  petState: [state: Partial<NovaPetVisualState>]
}>()

type MemoryView = 'inbox' | 'todo' | 'done' | 'page'

const memory = usePetMemory()
const activeView = ref<MemoryView>('inbox')
const query = ref('')
const activeTag = ref('')
const composerTitle = ref('')
const composerContent = ref('')
const composerTags = ref('')
const composerPriority = ref<PetMemoryPriority>('medium')
const pendingSelection = ref('')
const composerStatus = ref('')
const composerRef = ref<HTMLTextAreaElement>()
const editingId = ref<string | null>(null)
const editDraft = reactive({ title: '', content: '', tags: '', priority: 'medium' as PetMemoryPriority })
const undoArchive = ref<{ cardId: string; status: PetMemoryStatus } | null>(null)
let undoTimer: number | null = null

const currentPageUrl = computed(() => normalizeMemoryPageUrl(props.tab?.url))
const currentPageTitle = computed(() => props.tab?.title?.trim() || '当前页面')
const activeCards = computed(() => memory.cards.value.filter(card => card.status !== 'archived'))
const currentPageCards = computed(() => activeCards.value.filter(card => memoryMatchesPage(card, currentPageUrl.value)))
const inboxCount = computed(() => activeCards.value.filter(card => card.status === 'inbox').length)
const todoCount = computed(() => activeCards.value.filter(card => card.status === 'todo' || card.status === 'doing').length)
const doneCount = computed(() => activeCards.value.filter(card => card.status === 'done').length)

const allTags = computed(() => {
  const counts = new Map<string, number>()
  for (const card of activeCards.value) {
    for (const tag of card.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
})

const filteredCards = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return activeCards.value.filter((card) => {
    if (activeView.value === 'inbox' && card.status !== 'inbox') return false
    if (activeView.value === 'todo' && card.status !== 'todo' && card.status !== 'doing') return false
    if (activeView.value === 'done' && card.status !== 'done') return false
    if (activeView.value === 'page' && !memoryMatchesPage(card, currentPageUrl.value)) return false
    if (activeTag.value && !card.tags.includes(activeTag.value)) return false
    if (!normalizedQuery) return true
    return [card.title, card.content, card.selection, card.pageTitle, card.pageUrl, ...card.tags]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(normalizedQuery))
  })
})

const saveDisabled = computed(() => memory.saving.value || !(
  composerTitle.value.trim()
  || composerContent.value.trim()
  || pendingSelection.value.trim()
  || currentPageUrl.value
))

const viewOptions: Array<{ id: MemoryView; label: string; count: () => number }> = [
  { id: 'inbox', label: '收件箱', count: () => inboxCount.value },
  { id: 'todo', label: '待办', count: () => todoCount.value },
  { id: 'done', label: '已完成', count: () => doneCount.value },
  { id: 'page', label: '当前页面', count: () => currentPageCards.value.length },
]

onMounted(async () => {
  chrome.runtime.onMessage.addListener(onMemoryRuntimeMessage)
  await memory.refresh()
  await consumePendingIntent()
})

watch(
  () => [props.active, props.tab?.id] as const,
  async ([active]) => {
    if (!active) return
    await memory.refresh()
    await consumePendingIntent()
  },
)

onBeforeUnmount(() => {
  clearUndoTimer()
  chrome.runtime.onMessage.removeListener(onMemoryRuntimeMessage)
})

function onMemoryRuntimeMessage(message: NovaRuntimeMessage) {
  if (message.type !== 'YK_PET_MEMORY_DRAFT_READY' || message.tabId !== props.tab?.id || !props.active) return
  consumePendingIntent().catch(() => undefined)
}

async function consumePendingIntent() {
  const tabId = props.tab?.id
  if (!tabId) return
  const key = `${PET_MEMORY_PENDING_PREFIX}${tabId}`
  const stored = await chrome.storage.local.get(key)
  const intent = stored[key] as PetMemoryDraftIntent | undefined
  if (!intent) return
  await chrome.storage.local.remove(key)
  if (Date.now() - intent.createdAt > 60_000) return
  composerTitle.value = intent.selection ? firstLine(intent.selection) : ''
  composerContent.value = ''
  pendingSelection.value = intent.selection || ''
  activeView.value = 'page'
  composerStatus.value = intent.selection ? '已带入当前选中文字。' : '已带入当前页面上下文。'
  if (intent.focusComposer) await focusComposer()
}

async function focusComposer() {
  await nextTick()
  composerRef.value?.focus()
}

async function saveMemory() {
  if (saveDisabled.value) return
  composerStatus.value = '正在交给云灵保存…'
  try {
    const card = await memory.create({
      type: pendingSelection.value ? 'quote' : 'note',
      title: composerTitle.value,
      content: composerContent.value,
      selection: pendingSelection.value,
      pageUrl: currentPageUrl.value,
      pageTitle: currentPageTitle.value,
      priority: composerPriority.value,
      tags: parseTags(composerTags.value),
      status: 'inbox',
    })
    composerTitle.value = ''
    composerContent.value = ''
    composerTags.value = ''
    composerPriority.value = 'medium'
    pendingSelection.value = ''
    composerStatus.value = `已保存「${card.title}」`
    activeView.value = 'inbox'
    emit('petState', {
      behavior: 'greeting',
      speech: '我帮你记住了。需要处理时，打开宠物记忆就能继续。',
      busy: false,
    })
  }
  catch {
    composerStatus.value = memory.error.value || '保存失败，请稍后重试。'
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    saveMemory().catch(() => undefined)
  }
}

function clearSelection() {
  pendingSelection.value = ''
  composerStatus.value = ''
}

function startEdit(card: PetMemoryCard) {
  editingId.value = card.id
  editDraft.title = card.title
  editDraft.content = card.content
  editDraft.tags = card.tags.join(', ')
  editDraft.priority = card.priority
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(card: PetMemoryCard) {
  await memory.update(card.id, {
    title: editDraft.title,
    content: editDraft.content,
    tags: parseTags(editDraft.tags),
    priority: editDraft.priority,
  })
  editingId.value = null
  emit('petState', { behavior: 'happy', speech: '记忆卡已经更新。', busy: false })
}

async function runPrimaryAction(card: PetMemoryCard) {
  const nextStatus = primaryNextStatus(card.status)
  const updated = await memory.update(card.id, { status: nextStatus })
  if (updated.status === 'done') {
    emit('petState', {
      behavior: 'excited',
      speech: `完成了「${updated.title}」，干得漂亮！`,
      busy: false,
    })
  }
  else {
    emit('petState', {
      behavior: 'greeting',
      speech: updated.status === 'todo' ? '已经加入待办，我会替你保管。' : '任务状态已经更新。',
      busy: false,
    })
  }
}

async function archiveCard(card: PetMemoryCard) {
  clearUndoTimer()
  undoArchive.value = { cardId: card.id, status: card.status }
  await memory.archive(card.id)
  undoTimer = window.setTimeout(() => {
    undoArchive.value = null
    undoTimer = null
  }, 6_000)
}

async function undoArchiveCard() {
  const undo = undoArchive.value
  if (!undo) return
  clearUndoTimer()
  await memory.update(undo.cardId, { status: undo.status })
  undoArchive.value = null
}

function clearUndoTimer() {
  if (undoTimer === null) return
  window.clearTimeout(undoTimer)
  undoTimer = null
}

async function openSourcePage(card: PetMemoryCard) {
  if (!card.pageUrl) return
  await chrome.tabs.create({ url: card.pageUrl })
}

function exportMemories(format: 'markdown' | 'json') {
  const cards = activeCards.value
  const content = format === 'json'
    ? `${JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards }, null, 2)}\n`
    : toMarkdown(cards)
  const extension = format === 'json' ? 'json' : 'md'
  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `yk-pets-memory-${new Date().toISOString().slice(0, 10)}.${extension}`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function toMarkdown(cards: PetMemoryCard[]) {
  const lines = ['# YK-PETS 宠物记忆', '', `导出时间：${new Date().toLocaleString()}`, '']
  for (const card of cards) {
    lines.push(`## ${card.title}`, '')
    lines.push(`- 状态：${statusLabel(card.status)}`)
    lines.push(`- 优先级：${priorityLabel(card.priority)}`)
    if (card.pageTitle) lines.push(`- 页面：${card.pageTitle}`)
    if (card.pageUrl) lines.push(`- 地址：${card.pageUrl}`)
    if (card.tags.length) lines.push(`- 标签：${card.tags.map(tag => `#${tag}`).join(' ')}`)
    lines.push(`- 更新时间：${new Date(card.updatedAt).toLocaleString()}`, '')
    if (card.selection) lines.push('> ' + card.selection.replace(/\n/g, '\n> '), '')
    if (card.content) lines.push(card.content, '')
  }
  return `${lines.join('\n').trim()}\n`
}

function firstLine(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 96) || ''
}

function parseTags(value: string) {
  return [...new Set(value.split(/[,，#\n]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 10)
}

function primaryNextStatus(status: PetMemoryStatus): PetMemoryStatus {
  if (status === 'inbox') return 'todo'
  if (status === 'todo' || status === 'doing') return 'done'
  if (status === 'done') return 'todo'
  return 'inbox'
}

function primaryActionLabel(status: PetMemoryStatus) {
  if (status === 'inbox') return '加入待办'
  if (status === 'todo' || status === 'doing') return '标记完成'
  if (status === 'done') return '恢复待办'
  return '恢复'
}

function statusLabel(status: PetMemoryStatus) {
  return ({ inbox: '收件箱', todo: '待办', doing: '进行中', done: '已完成', archived: '已归档' } as const)[status]
}

function priorityLabel(priority: PetMemoryPriority) {
  return ({ low: '低', medium: '中', high: '高' } as const)[priority]
}

function typeIcon(card: PetMemoryCard) {
  if (card.type === 'quote') return '“”'
  if (card.type === 'audit-issue') return '✦'
  if (card.type === 'network-issue') return '⇄'
  if (card.type === 'development-task') return '⌘'
  if (card.type === 'element') return '⌖'
  return '✎'
}

function relativeTime(input: string) {
  const delta = Date.now() - Date.parse(input)
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)} 天前`
  return new Date(input).toLocaleDateString()
}
</script>

<template>
  <section class="memory-workspace" aria-labelledby="pet-memory-title">
    <header class="memory-hero">
      <div class="memory-hero__orb" aria-hidden="true"><span>✦</span></div>
      <div class="memory-hero__copy">
        <span>PET MEMORY</span>
        <h1 id="pet-memory-title">宠物记忆</h1>
        <p>把当前网页的想法、原文和任务交给云灵，本地保存，之后继续处理。</p>
      </div>
      <div class="memory-hero__stats" aria-label="记忆统计">
        <strong>{{ activeCards.length }}</strong>
        <small>全部</small>
      </div>
    </header>

    <section class="memory-composer" aria-label="快速记录">
      <div class="composer-context">
        <span class="context-dot" aria-hidden="true" />
        <div>
          <strong>{{ currentPageTitle }}</strong>
          <small>{{ currentPageUrl || '当前页面不支持保存上下文' }}</small>
        </div>
        <kbd>⌘/Ctrl ↵</kbd>
      </div>

      <blockquote v-if="pendingSelection" class="selection-preview">
        <span>当前选中文字</span>
        <p>{{ pendingSelection }}</p>
        <button type="button" aria-label="移除选中文字" @click="clearSelection">×</button>
      </blockquote>

      <input v-model="composerTitle" class="composer-title" type="text" maxlength="180" placeholder="标题（可选）">
      <textarea
        ref="composerRef"
        v-model="composerContent"
        rows="4"
        maxlength="8000"
        placeholder="记下想法、下一步或为什么值得保留…"
        @keydown="onComposerKeydown"
      />

      <div class="composer-meta">
        <label>
          <span>标签</span>
          <input v-model="composerTags" type="text" placeholder="设计, 待确认">
        </label>
        <fieldset>
          <legend>优先级</legend>
          <button
            v-for="priority in ['low', 'medium', 'high'] as const"
            :key="priority"
            type="button"
            :class="{ active: composerPriority === priority }"
            @click="composerPriority = priority"
          >
            {{ priorityLabel(priority) }}
          </button>
        </fieldset>
      </div>

      <div class="composer-actions">
        <p aria-live="polite">{{ composerStatus || memory.error.value }}</p>
        <button class="save-memory" type="button" :disabled="saveDisabled" @click="saveMemory">
          <span>{{ memory.saving.value ? '保存中…' : '交给云灵记住' }}</span><b>↗</b>
        </button>
      </div>
    </section>

    <section class="memory-library" aria-label="记忆库">
      <div class="library-toolbar">
        <label class="memory-search">
          <span aria-hidden="true">⌕</span>
          <input v-model="query" type="search" placeholder="搜索标题、内容、页面或标签">
          <button v-if="query" type="button" aria-label="清空搜索" @click="query = ''">×</button>
        </label>
        <details class="export-menu">
          <summary aria-label="导出宠物记忆">⇩</summary>
          <div>
            <button type="button" @click="exportMemories('markdown')">导出 Markdown</button>
            <button type="button" @click="exportMemories('json')">导出 JSON</button>
          </div>
        </details>
      </div>

      <nav class="memory-views" aria-label="记忆状态筛选">
        <button
          v-for="view in viewOptions"
          :key="view.id"
          type="button"
          :class="{ active: activeView === view.id }"
          @click="activeView = view.id"
        >
          <span>{{ view.label }}</span><b>{{ view.count() }}</b>
        </button>
      </nav>

      <div v-if="allTags.length" class="memory-tags" aria-label="标签筛选">
        <button type="button" :class="{ active: !activeTag }" @click="activeTag = ''">全部标签</button>
        <button
          v-for="[tag, count] in allTags"
          :key="tag"
          type="button"
          :class="{ active: activeTag === tag }"
          @click="activeTag = activeTag === tag ? '' : tag"
        >
          #{{ tag }} <small>{{ count }}</small>
        </button>
      </div>

      <div v-if="memory.loading.value" class="memory-empty" aria-live="polite">
        <div class="empty-orbit" aria-hidden="true" />
        <strong>正在整理记忆…</strong>
      </div>

      <div v-else-if="!filteredCards.length" class="memory-empty">
        <div class="empty-orbit" aria-hidden="true"><span>✦</span></div>
        <strong>{{ activeView === 'page' ? '这个页面还没有记忆' : '这里暂时是空的' }}</strong>
        <p>{{ activeView === 'page' ? '在上方记录一条想法，或选中文字后使用“交给云灵记住”。' : '新的内容会先进入收件箱，再由你决定何时处理。' }}</p>
        <button type="button" @click="focusComposer">写下第一条</button>
      </div>

      <div v-else class="memory-list">
        <article
          v-for="card in filteredCards"
          :key="card.id"
          class="memory-card"
          :data-status="card.status"
          :data-priority="card.priority"
        >
          <header>
            <span class="memory-type" aria-hidden="true">{{ typeIcon(card) }}</span>
            <div>
              <span>{{ statusLabel(card.status) }} · {{ priorityLabel(card.priority) }}优先级</span>
              <small>{{ relativeTime(card.updatedAt) }}</small>
            </div>
            <button type="button" aria-label="编辑记忆卡" @click="editingId === card.id ? cancelEdit() : startEdit(card)">•••</button>
          </header>

          <template v-if="editingId === card.id">
            <div class="memory-edit">
              <input v-model="editDraft.title" type="text" maxlength="180">
              <textarea v-model="editDraft.content" rows="4" maxlength="8000" />
              <div>
                <input v-model="editDraft.tags" type="text" placeholder="标签">
                <select v-model="editDraft.priority">
                  <option value="low">低优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="high">高优先级</option>
                </select>
              </div>
              <footer>
                <button type="button" @click="cancelEdit">取消</button>
                <button class="primary" type="button" :disabled="memory.saving.value" @click="saveEdit(card)">保存修改</button>
              </footer>
            </div>
          </template>

          <template v-else>
            <h2>{{ card.title }}</h2>
            <blockquote v-if="card.selection">{{ card.selection }}</blockquote>
            <p v-if="card.content">{{ card.content }}</p>
            <div v-if="card.tags.length" class="card-tags">
              <button v-for="tag in card.tags" :key="tag" type="button" @click="activeTag = tag">#{{ tag }}</button>
            </div>
            <button v-if="card.pageUrl" class="page-source" type="button" @click="openSourcePage(card)">
              <span>{{ card.pageTitle || card.pageUrl }}</span><small>打开来源 ↗</small>
            </button>
            <footer>
              <button class="primary" type="button" :disabled="memory.saving.value" @click="runPrimaryAction(card)">{{ primaryActionLabel(card.status) }}</button>
              <button type="button" @click="startEdit(card)">编辑</button>
              <button class="quiet" type="button" @click="archiveCard(card)">归档</button>
            </footer>
          </template>
        </article>
      </div>
    </section>

    <div v-if="undoArchive" class="memory-toast" role="status">
      <span>记忆卡已归档</span>
      <button type="button" @click="undoArchiveCard">撤销</button>
    </div>
  </section>
</template>

<style scoped>
.memory-workspace{position:relative;display:grid;gap:12px;margin-top:12px;color:#eef1ff}.memory-hero{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;padding:15px;overflow:hidden;border:1px solid rgba(125,116,255,.3);border-radius:20px;background:radial-gradient(circle at 8% 0%,rgba(112,102,255,.24),transparent 38%),radial-gradient(circle at 92% 100%,rgba(82,224,208,.14),transparent 42%),linear-gradient(145deg,rgba(18,22,43,.98),rgba(10,14,28,.96));box-shadow:0 18px 42px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.04)}.memory-hero::after{content:"";position:absolute;inset:auto -30px -45px auto;width:130px;height:130px;border:1px solid rgba(82,224,208,.16);border-radius:50%;box-shadow:0 0 0 18px rgba(112,102,255,.04),0 0 0 42px rgba(82,224,208,.025)}.memory-hero__orb{position:relative;z-index:1;width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:linear-gradient(145deg,#756aff,#4adac8);box-shadow:0 12px 28px rgba(83,76,224,.32)}.memory-hero__orb span{font-size:19px;text-shadow:0 0 12px #fff}.memory-hero__copy{min-width:0;position:relative;z-index:1}.memory-hero__copy>span{color:#7f89af;font:800 7px/1 ui-monospace,monospace;letter-spacing:.18em}.memory-hero h1{margin:5px 0 4px;font-size:17px;letter-spacing:-.02em}.memory-hero p{margin:0;color:#929ab8;font-size:9px;line-height:1.55}.memory-hero__stats{position:relative;z-index:1;display:grid;min-width:45px;text-align:right}.memory-hero__stats strong{font-size:22px;line-height:1}.memory-hero__stats small{margin-top:4px;color:#777f9f;font-size:8px}.memory-composer,.memory-library{padding:13px;border:1px solid rgba(116,126,170,.2);border-radius:18px;background:rgba(14,18,32,.9);box-shadow:inset 0 1px rgba(255,255,255,.025)}.composer-context{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:8px;margin-bottom:10px}.context-dot{width:7px;height:7px;border-radius:50%;background:#52e0d0;box-shadow:0 0 12px rgba(82,224,208,.8)}.composer-context div{min-width:0;display:grid;gap:2px}.composer-context strong{overflow:hidden;color:#cfd4e9;font-size:9px;white-space:nowrap;text-overflow:ellipsis}.composer-context small{overflow:hidden;color:#666f91;font-size:7px;white-space:nowrap;text-overflow:ellipsis}.composer-context kbd{padding:4px 6px;border:1px solid #29304b;border-radius:7px;color:#737c9e;background:#0b0f1d;font:700 7px/1 ui-monospace,monospace}.selection-preview{position:relative;margin:0 0 9px;padding:10px 34px 10px 11px;border:1px solid rgba(82,224,208,.24);border-left:3px solid #52e0d0;border-radius:11px;background:rgba(82,224,208,.06)}.selection-preview span{color:#65d9c9;font:800 7px/1 ui-monospace,monospace;letter-spacing:.12em}.selection-preview p{display:-webkit-box;margin:6px 0 0;overflow:hidden;color:#bbc3dc;font-size:9px;line-height:1.55;-webkit-box-orient:vertical;-webkit-line-clamp:4}.selection-preview button{position:absolute;right:7px;top:7px;width:24px;height:24px;border:0;border-radius:8px;color:#8f98b8;background:transparent;cursor:pointer}.composer-title,.memory-composer textarea,.composer-meta input,.memory-search input,.memory-edit input,.memory-edit textarea,.memory-edit select{width:100%;min-width:0;border:1px solid #252c47;border-radius:10px;outline:0;color:#eef1ff;background:#0b0f1d;transition:border-color 140ms ease,box-shadow 140ms ease}.composer-title{height:38px;padding:0 10px;font-size:11px;font-weight:750}.memory-composer textarea{margin-top:7px;padding:10px;resize:vertical;font-size:10px;line-height:1.55}.composer-title:focus,.memory-composer textarea:focus,.composer-meta input:focus,.memory-search:focus-within,.memory-edit input:focus,.memory-edit textarea:focus,.memory-edit select:focus{border-color:#7066ff;box-shadow:0 0 0 3px rgba(112,102,255,.12)}.composer-meta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin-top:9px}.composer-meta label{display:grid;gap:5px;color:#7d86a7;font-size:8px}.composer-meta input{height:32px;padding:0 9px;font-size:9px}.composer-meta fieldset{display:flex;align-items:flex-end;gap:3px;margin:0;padding:0;border:0}.composer-meta legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.composer-meta fieldset button{width:28px;height:32px;border:1px solid #29304b;border-radius:8px;color:#7780a1;background:#101526;cursor:pointer;font-size:8px}.composer-meta fieldset button.active{border-color:#7066ff;color:#fff;background:rgba(112,102,255,.2)}.composer-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:10px}.composer-actions p{margin:0;color:#72cfc4;font-size:8px;line-height:1.4}.save-memory{min-width:126px;height:38px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;border-radius:11px;color:#fff;background:linear-gradient(100deg,#7066ff,#5795ff);box-shadow:0 10px 24px rgba(112,102,255,.22);cursor:pointer;font-size:9px;font-weight:800}.library-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:7px}.memory-search{height:36px;display:grid;grid-template-columns:24px minmax(0,1fr) 24px;align-items:center;border:1px solid #252c47;border-radius:11px;background:#0b0f1d}.memory-search>span{color:#717a9d;text-align:center}.memory-search input{height:34px;padding:0;border:0;background:transparent;box-shadow:none;font-size:9px}.memory-search button{width:22px;height:22px;border:0;border-radius:7px;color:#7982a3;background:transparent;cursor:pointer}.export-menu{position:relative}.export-menu summary{width:34px;height:36px;display:grid;place-items:center;border:1px solid #29304b;border-radius:11px;color:#aab2cd;background:#101526;cursor:pointer;list-style:none}.export-menu summary::-webkit-details-marker{display:none}.export-menu>div{position:absolute;z-index:20;right:0;top:42px;width:126px;padding:5px;display:grid;gap:4px;border:1px solid #2a3150;border-radius:11px;background:#111628;box-shadow:0 16px 34px rgba(0,0,0,.38)}.export-menu button{min-height:31px;padding:0 8px;border:0;border-radius:8px;color:#aeb6d2;background:transparent;text-align:left;cursor:pointer;font-size:8px}.export-menu button:hover{color:#fff;background:rgba(112,102,255,.14)}.memory-views{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:9px;padding:4px;border:1px solid #232941;border-radius:12px;background:#0b0f1d}.memory-views button{min-width:0;min-height:38px;padding:5px 4px;display:grid;place-items:center;gap:2px;border:0;border-radius:9px;color:#737c9f;background:transparent;cursor:pointer;font-size:8px}.memory-views button b{font:800 8px/1 ui-monospace,monospace}.memory-views button.active{color:#f1f2ff;background:linear-gradient(145deg,rgba(112,102,255,.22),rgba(82,224,208,.09));box-shadow:inset 0 0 0 1px rgba(112,102,255,.22)}.memory-tags{display:flex;gap:5px;margin-top:9px;overflow-x:auto;scrollbar-width:none}.memory-tags::-webkit-scrollbar{display:none}.memory-tags button{flex:0 0 auto;min-height:27px;padding:0 8px;border:1px solid #282f4b;border-radius:999px;color:#818aab;background:#0e1323;cursor:pointer;font-size:8px}.memory-tags button.active{border-color:rgba(82,224,208,.48);color:#73ddce;background:rgba(82,224,208,.08)}.memory-tags small{font-size:7px;opacity:.7}.memory-list{display:grid;gap:8px;margin-top:10px}.memory-card{position:relative;padding:11px;overflow:hidden;border:1px solid #252c47;border-radius:14px;background:linear-gradient(145deg,#101526,#0c101d);box-shadow:inset 0 1px rgba(255,255,255,.025)}.memory-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#7066ff}.memory-card[data-priority="high"]::before{background:#ff6f8f}.memory-card[data-priority="low"]::before{background:#52e0d0}.memory-card[data-status="done"]{opacity:.72}.memory-card>header{display:grid;grid-template-columns:30px minmax(0,1fr) 26px;align-items:center;gap:7px}.memory-type{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(112,102,255,.24);border-radius:9px;color:#c9c6ff;background:rgba(112,102,255,.1);font-size:10px;font-weight:900}.memory-card>header div{min-width:0;display:grid;gap:2px}.memory-card>header div span{color:#8992b3;font-size:7px}.memory-card>header div small{color:#5f6889;font-size:7px}.memory-card>header>button{width:26px;height:26px;border:0;border-radius:8px;color:#7881a1;background:transparent;cursor:pointer;letter-spacing:.05em}.memory-card h2{margin:9px 0 0;font-size:12px;line-height:1.4}.memory-card>p{display:-webkit-box;margin:7px 0 0;overflow:hidden;color:#9da5c2;font-size:9px;line-height:1.55;white-space:pre-wrap;-webkit-box-orient:vertical;-webkit-line-clamp:5}.memory-card>blockquote{margin:8px 0 0;padding:8px 9px;border-left:2px solid #52e0d0;border-radius:0 8px 8px 0;color:#aeb7d2;background:rgba(82,224,208,.055);font-size:9px;line-height:1.55}.card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.card-tags button{min-height:23px;padding:0 7px;border:0;border-radius:999px;color:#8f98ba;background:#171d31;cursor:pointer;font-size:7px}.page-source{width:100%;min-width:0;margin-top:8px;padding:8px 9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border:1px solid #252c47;border-radius:9px;color:#858eaf;background:#0b0f1d;text-align:left;cursor:pointer}.page-source span{overflow:hidden;font-size:8px;white-space:nowrap;text-overflow:ellipsis}.page-source small{color:#6f78a0;font-size:7px}.memory-card>footer,.memory-edit footer{display:flex;gap:5px;margin-top:9px}.memory-card>footer button,.memory-edit footer button{min-height:30px;padding:0 9px;border:1px solid #29304b;border-radius:9px;color:#939cbb;background:#11172a;cursor:pointer;font-size:8px}.memory-card>footer button.primary,.memory-edit footer button.primary{border-color:rgba(112,102,255,.5);color:#fff;background:rgba(112,102,255,.18)}.memory-card>footer button.quiet{margin-left:auto;border-color:transparent;background:transparent}.memory-edit{display:grid;gap:7px;margin-top:9px}.memory-edit input,.memory-edit select{height:34px;padding:0 9px;font-size:9px}.memory-edit textarea{padding:9px;resize:vertical;font-size:9px;line-height:1.5}.memory-edit>div{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:6px}.memory-empty{min-height:180px;margin-top:10px;padding:20px;display:grid;place-items:center;align-content:center;text-align:center;border:1px dashed #29304b;border-radius:14px;background:radial-gradient(circle,rgba(112,102,255,.08),transparent 62%)}.empty-orbit{width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(112,102,255,.32);border-radius:50%;box-shadow:0 0 0 8px rgba(112,102,255,.04),0 0 0 16px rgba(82,224,208,.025)}.memory-empty strong{margin-top:14px;font-size:11px}.memory-empty p{max-width:210px;margin:6px 0 0;color:#7c85a5;font-size:8px;line-height:1.55}.memory-empty button{min-height:30px;margin-top:10px;padding:0 10px;border:1px solid rgba(112,102,255,.4);border-radius:9px;color:#dfe2f5;background:rgba(112,102,255,.12);cursor:pointer;font-size:8px}.memory-toast{position:sticky;z-index:40;bottom:10px;margin:0 8px;padding:9px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(82,224,208,.34);border-radius:11px;color:#dfe5f7;background:rgba(11,16,29,.96);box-shadow:0 14px 34px rgba(0,0,0,.4);backdrop-filter:blur(14px);font-size:9px}.memory-toast button{height:27px;padding:0 9px;border:1px solid rgba(82,224,208,.45);border-radius:8px;color:#72ddce;background:rgba(82,224,208,.08);cursor:pointer;font-size:8px}@media(max-width:330px){.memory-hero{grid-template-columns:42px minmax(0,1fr)}.memory-hero__orb{width:42px;height:42px}.memory-hero__stats{display:none}.composer-meta{grid-template-columns:1fr}.composer-meta fieldset{justify-content:flex-end}.composer-actions{grid-template-columns:1fr}.save-memory{width:100%}.memory-views{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
