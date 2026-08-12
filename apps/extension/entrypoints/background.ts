/**
 * 文件职责 / File responsibility
 * 扩展后台入口，负责 Side Panel、宠物记忆、标签页桥接、语音和运行时消息路由。
 * Extension background entry for Side Panel, pet memory, tab bridging, voice, and runtime message routing.
 */
import type { AuditReport } from '@nova/shared/audit'
import type { NovaPetAction, NovaPetVoicePreset, NovaRuntimeMessage } from '@nova/shared/messages'
import {
  PET_MEMORY_PENDING_PREFIX,
  normalizeMemoryPageUrl,
  type PetMemoryDraftIntent,
  type PetMemoryPageContext,
} from '@nova/shared/pet-memory'
import {
  archivePetMemoryCard,
  createPetMemoryCard,
  importPetMemoryCards,
  listPetMemoryCards,
  updatePetMemoryCard,
} from '../features/pet-memory/infrastructure/chrome-pet-memory-repository'

const MEMORY_SELECTION_MENU_ID = 'yk-pets-memory-selection'
const MEMORY_PAGE_MENU_ID = 'yk-pets-memory-page'
const QUICK_MEMORY_COMMAND = 'quick-pet-memory'

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined)
    setupPetMemoryContextMenus().catch(error => console.warn('[YK-PETS memory menu]', error))
  })

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return
    await openSidePanel(tab.id)
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return
    if (info.menuItemId === MEMORY_SELECTION_MENU_ID) {
      saveSelectionMemory(info.selectionText || '', tab).catch(error => console.warn('[YK-PETS memory selection]', error))
      return
    }
    if (info.menuItemId === MEMORY_PAGE_MENU_ID) {
      openMemoryComposer(tab, 'context-menu').catch(error => console.warn('[YK-PETS memory page]', error))
    }
  })

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== QUICK_MEMORY_COMMAND || !tab?.id) return
    openMemoryComposer(tab, 'shortcut').catch(error => console.warn('[YK-PETS memory shortcut]', error))
  })

  chrome.runtime.onMessage.addListener((message: NovaRuntimeMessage, sender, sendResponse) => {
    if (message.type === 'NOVA_OPEN_SIDE_PANEL' && sender.tab?.id) {
      const tabId = sender.tab.id
      openSidePanelWithAction(tabId, message.action, message.issueId)
        .then(() => sendResponse({ ok: true }))
        .catch(error => sendResponse({ ok: false, error: String(error) }))
      return true
    }

    if (message.type === 'NOVA_AUDIT_RESULT' && sender.tab?.id) {
      saveReport(sender.tab.id, message.report).catch(() => undefined)
      chrome.runtime.sendMessage({
        type: 'NOVA_REPORT_UPDATED',
        tabId: sender.tab.id,
        report: message.report,
      } satisfies NovaRuntimeMessage).catch(() => undefined)
    }

    if (message.type === 'NOVA_TTS_SPEAK') {
      speakWithPetVoice(message.text, message.preset)
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    if (message.type === 'NOVA_TTS_STOP') {
      chrome.tts.stop()
      sendResponse({ ok: true })
      return false
    }

    if (message.type === 'YK_PET_MEMORY_LIST') {
      listPetMemoryCards()
        .then(cards => sendResponse({ ok: true, cards }))
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    if (message.type === 'YK_PET_MEMORY_CREATE') {
      createPetMemoryCard(message.input)
        .then(async (card) => {
          await notifyPetMemoryUpdated('created', card)
          sendResponse({ ok: true, card })
        })
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    if (message.type === 'YK_PET_MEMORY_IMPORT') {
      importPetMemoryCards(message.payload)
        .then(async (result) => {
          if (result.importedCount > 0) await notifyPetMemoryImported()
          sendResponse({ ok: true, result })
        })
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    if (message.type === 'YK_PET_MEMORY_UPDATE') {
      updatePetMemoryCard(message.cardId, message.patch)
        .then(async (card) => {
          const reason = card.status === 'archived' ? 'archived' : 'updated'
          await notifyPetMemoryUpdated(reason, card)
          sendResponse({ ok: true, card })
        })
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    if (message.type === 'YK_PET_MEMORY_ARCHIVE') {
      archivePetMemoryCard(message.cardId)
        .then(async (card) => {
          await notifyPetMemoryUpdated('archived', card)
          sendResponse({ ok: true, card })
        })
        .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      return true
    }

    return false
  })
})

async function setupPetMemoryContextMenus() {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: MEMORY_SELECTION_MENU_ID,
    title: '交给云灵记住“%s”',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  })
  chrome.contextMenus.create({
    id: MEMORY_PAGE_MENU_ID,
    title: '在宠物记忆中记录此页',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  })
}

async function saveSelectionMemory(selection: string, tab: chrome.tabs.Tab) {
  const cleanSelection = selection.trim().slice(0, 4_000)
  if (!cleanSelection) return
  const card = await createPetMemoryCard({
    type: 'quote',
    title: firstLine(cleanSelection),
    selection: cleanSelection,
    pageUrl: tab.url,
    pageTitle: tab.title,
    status: 'inbox',
    priority: 'medium',
    tags: ['网页摘录'],
  })
  await notifyPetMemoryUpdated('created', card)
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'NOVA_UPDATE_PET_STATE',
      state: {
        behavior: 'greeting',
        speech: '这段文字我已经收进宠物记忆了。',
        busy: false,
      },
    } satisfies NovaRuntimeMessage).catch(() => undefined)
  }
}

async function openMemoryComposer(tab: chrome.tabs.Tab, source: PetMemoryDraftIntent['source']) {
  if (!tab.id) return
  // 用户手势到达后立即打开 Side Panel，后续上下文读取不会消耗手势。 / Open immediately on the user gesture before asynchronous context collection.
  const openPromise = openSidePanel(tab.id)
  const context = await getMemoryPageContext(tab)
  const intent: PetMemoryDraftIntent = {
    source,
    focusComposer: true,
    createdAt: Date.now(),
    pageUrl: context.pageUrl,
    pageTitle: context.pageTitle,
    selection: context.selection,
  }
  const pendingKey = `${PET_MEMORY_PENDING_PREFIX}${tab.id}`
  await Promise.all([
    openPromise,
    chrome.storage.local.set({ [pendingKey]: intent }),
  ])
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_DRAFT_READY', tabId: tab.id! } satisfies NovaRuntimeMessage).catch(() => undefined)
  }, 180)
}

async function getMemoryPageContext(tab: chrome.tabs.Tab): Promise<PetMemoryPageContext> {
  const fallback: PetMemoryPageContext = {
    pageUrl: normalizeMemoryPageUrl(tab.url) || '',
    pageTitle: tab.title || '当前页面',
  }
  if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) return fallback
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'YK_PET_MEMORY_GET_CONTEXT' } satisfies NovaRuntimeMessage) as {
      ok?: boolean
      pageUrl?: string
      pageTitle?: string
      selection?: string
    } | undefined
    if (!response?.ok) return fallback
    return {
      pageUrl: normalizeMemoryPageUrl(response.pageUrl) || fallback.pageUrl,
      pageTitle: response.pageTitle?.trim() || fallback.pageTitle,
      selection: response.selection?.trim().slice(0, 4_000) || undefined,
    }
  }
  catch {
    return fallback
  }
}

async function notifyPetMemoryUpdated(reason: 'created' | 'updated' | 'archived', card: Awaited<ReturnType<typeof createPetMemoryCard>>) {
  await chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_UPDATED', reason, card } satisfies NovaRuntimeMessage).catch(() => undefined)
}

async function notifyPetMemoryImported() {
  await chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_UPDATED', reason: 'imported' } satisfies NovaRuntimeMessage).catch(() => undefined)
}

function firstLine(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 96) || '网页摘录'
}

async function openSidePanelWithAction(tabId: number, action?: NovaPetAction, issueId?: string) {
  // 必须在用户点击消息到达后立即调用 open，避免异步存储使用户手势失效。 / Open immediately after the click message so async storage does not consume the user gesture.
  const openPromise = openSidePanel(tabId)
  const pendingPromise = action
    ? chrome.storage.local.set({
        [`nova:pending-action:${tabId}`]: {
          action,
          issueId,
          createdAt: Date.now(),
        },
      })
    : Promise.resolve()

  await Promise.all([openPromise, pendingPromise])

  if (action) {
    setTimeout(async () => {
      const key = `nova:pending-action:${tabId}`
      const stored = await chrome.storage.local.get(key)
      if (!stored[key]) return
      chrome.runtime.sendMessage({
        type: 'NOVA_SIDE_PANEL_ACTION',
        action,
        issueId,
        tabId,
      } satisfies NovaRuntimeMessage).catch(() => undefined)
    }, 220)
  }
}

async function openSidePanel(tabId: number) {
  await chrome.sidePanel.open({ tabId })
}

async function saveReport(tabId: number, report: AuditReport) {
  await chrome.storage.local.set({ [`nova:report:${tabId}`]: report })
}

async function speakWithPetVoice(text: string, preset: Exclude<NovaPetVoicePreset, 'alien' | 'mute'>) {
  const voices = await chrome.tts.getVoices()
  const voice = chooseChineseVoice(voices)
  const options: chrome.tts.TtsOptions = {
    lang: 'zh-CN',
    voiceName: voice?.voiceName,
    enqueue: false,
    volume: 0.92,
    pitch: preset === 'cute-animal' ? 1.7 : 1.28,
    rate: preset === 'cute-animal' ? 1.12 : 0.94,
    onEvent(event) {
      if (event.type === 'error') console.warn('[YK-PETS system voice]', event.errorMessage || '未知语音错误')
    },
  }
  await chrome.tts.speak(text, options)
  return { voiceName: voice?.voiceName || '系统默认中文声线' }
}

function chooseChineseVoice(voices: chrome.tts.TtsVoice[]) {
  const candidates = voices.filter(voice => /^zh(?:-|$)/i.test(voice.lang || ''))
  if (!candidates.length) return undefined
  return candidates
    .map(voice => ({ voice, score: scoreChineseVoice(voice) }))
    .sort((left, right) => right.score - left.score)[0]?.voice
}

function scoreChineseVoice(voice: chrome.tts.TtsVoice) {
  const name = voice.voiceName || ''
  let score = /^zh-CN$/i.test(voice.lang || '') ? 100 : 60
  if (/xiaoxiao|xiaoyi|yunxia|huihui|tingting|meijia|sinji|female|女|晓|小/i.test(name)) score += 30
  if (/natural|neural|premium|enhanced|自然|神经/i.test(name)) score += 24
  if (!voice.remote) score += 4
  return score
}
