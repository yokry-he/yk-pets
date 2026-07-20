/**
 * 文件职责 / File responsibility
 * 扩展后台入口，负责 Side Panel 打开、标签页桥接和运行时消息路由。
 * Extension background entry for Side Panel opening, tab bridging, and runtime message routing.
 */
import type { AuditReport } from '@nova/shared/audit'
import type { NovaPetAction, NovaPetVoicePreset, NovaRuntimeMessage } from '@nova/shared/messages'

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined)
  })

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return
    await openSidePanel(tab.id)
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

    return false
  })
})

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
      if (event.type === 'error') console.warn('[NOVA system voice]', event.errorMessage || '未知语音错误')
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
