/**
 * 文件职责 / File responsibility
 * 消费网页记忆徽章的一次性请求，重置残留筛选并聚焦 Side Panel 的“当前页面”记忆视图。
 * Consumes one-shot in-page memory badge requests, resets stale filters, and focuses the Side Panel's Current Page memory view.
 */
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import {
  PET_MEMORY_CURRENT_PAGE_REQUEST_KEY,
  normalizePetMemoryCurrentPageRequest,
} from '@nova/shared/pet-memory-navigation'
import { normalizeMemoryPageUrl } from '@nova/shared/pet-memory'

const STATUS_ID = 'yk-current-page-memory-status'
const STYLE_ID = 'yk-current-page-memory-status-style'

export function installPetMemoryCurrentPageTools(documentRef: Document) {
  installStyles(documentRef)
  let consuming = false
  let statusTimer: number | null = null

  const consume = async () => {
    if (consuming) return
    const stored = await chrome.storage.local.get(PET_MEMORY_CURRENT_PAGE_REQUEST_KEY)
    const rawRequest = stored[PET_MEMORY_CURRENT_PAGE_REQUEST_KEY]
    const request = normalizePetMemoryCurrentPageRequest(rawRequest)
    if (!request) {
      if (rawRequest !== undefined) await chrome.storage.local.remove(PET_MEMORY_CURRENT_PAGE_REQUEST_KEY)
      return
    }

    consuming = true
    const status = ensureStatus(documentRef)
    showStatus(status, '正在打开当前页面的宠物记忆…', 'loading')
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || normalizeMemoryPageUrl(tab.url) !== request.pageUrl) {
        throw new Error('当前活动标签页已经变化，请回到来源页面后重试。')
      }

      const controls = await waitForCurrentPageControls(documentRef)
      clearSearch(controls.search)
      controls.allTags?.click()
      controls.pageButton.click()
      await nextFrame()
      controls.pageButton.focus({ preventScroll: true })
      controls.library.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })

      const count = controls.pageButton.querySelector<HTMLElement>('b')?.textContent?.trim() || '0'
      showStatus(status, `已显示当前页面的 ${count} 条宠物记忆。`, 'success')
      if (statusTimer !== null) window.clearTimeout(statusTimer)
      statusTimer = window.setTimeout(() => {
        status.hidden = true
        statusTimer = null
      }, 5_000)
    }
    catch (error) {
      showStatus(status, `无法打开当前页面记忆：${error instanceof Error ? error.message : String(error)}`, 'error')
      if (statusTimer !== null) window.clearTimeout(statusTimer)
      statusTimer = window.setTimeout(() => {
        status.hidden = true
        statusTimer = null
      }, 8_000)
    }
    finally {
      await chrome.storage.local.remove(PET_MEMORY_CURRENT_PAGE_REQUEST_KEY).catch(() => undefined)
      consuming = false
    }
  }

  const onRuntimeMessage = (message: NovaRuntimeMessage) => {
    if (message.type === 'NOVA_SIDE_PANEL_ACTION' && message.action === 'open-memory') {
      consume().catch(() => undefined)
    }
  }
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[PET_MEMORY_CURRENT_PAGE_REQUEST_KEY]) consume().catch(() => undefined)
  }

  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.storage.onChanged.addListener(onStorageChanged)
  consume().catch(() => undefined)

  window.addEventListener('pagehide', () => {
    if (statusTimer !== null) window.clearTimeout(statusTimer)
    chrome.runtime.onMessage.removeListener(onRuntimeMessage)
    chrome.storage.onChanged.removeListener(onStorageChanged)
  }, { once: true })
}

function waitForCurrentPageControls(documentRef: Document, timeoutMs = 4_000) {
  return new Promise<{
    pageButton: HTMLButtonElement
    search: HTMLInputElement | null
    allTags: HTMLButtonElement | null
    library: HTMLElement
  }>((resolve, reject) => {
    let settled = false
    let observer: MutationObserver | null = null
    let timeout: number | null = null

    const find = () => {
      const library = documentRef.querySelector<HTMLElement>('.memory-library')
      const pageButton = [...documentRef.querySelectorAll<HTMLButtonElement>('.memory-views button')]
        .find(button => button.querySelector('span')?.textContent?.trim() === '当前页面')
      if (!library || !pageButton) return null
      const search = documentRef.querySelector<HTMLInputElement>('.memory-search input')
      const allTags = [...documentRef.querySelectorAll<HTMLButtonElement>('.memory-tags button')]
        .find(button => button.textContent?.trim().startsWith('全部标签')) || null
      return { pageButton, search, allTags, library }
    }
    const finish = (value?: ReturnType<typeof find>, error?: Error) => {
      if (settled) return
      settled = true
      observer?.disconnect()
      if (timeout !== null) window.clearTimeout(timeout)
      if (error || !value) reject(error || new Error('宠物记忆工作区尚未准备完成。'))
      else resolve(value)
    }

    const existing = find()
    if (existing) {
      finish(existing)
      return
    }

    observer = new MutationObserver(() => {
      const value = find()
      if (value) finish(value)
    })
    observer.observe(documentRef.documentElement, { childList: true, subtree: true })
    timeout = window.setTimeout(() => finish(undefined, new Error('宠物记忆工作区加载超时，请重试。')), timeoutMs)
  })
}

function clearSearch(input: HTMLInputElement | null) {
  if (!input || !input.value) return
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, '')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function ensureStatus(documentRef: Document) {
  const existing = documentRef.getElementById(STATUS_ID)
  if (existing) return existing
  const status = documentRef.createElement('p')
  status.id = STATUS_ID
  status.className = 'yk-current-page-memory-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const tabs = documentRef.querySelector('.workspace-tabs')
  if (tabs) tabs.insertAdjacentElement('afterend', status)
  else documentRef.querySelector('.sidepanel-shell')?.prepend(status)
  return status
}

function showStatus(status: HTMLElement, message: string, state: 'loading' | 'success' | 'error') {
  status.hidden = false
  status.textContent = message
  status.dataset.state = state
}

function installStyles(documentRef: Document) {
  if (documentRef.getElementById(STYLE_ID)) return
  const style = documentRef.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .yk-current-page-memory-status{margin:8px 2px 0;padding:8px 10px;border:1px solid rgba(82,224,208,.2);border-radius:10px;color:#92ded5;background:rgba(82,224,208,.06);font-size:8px;line-height:1.5}
    .yk-current-page-memory-status[data-state="loading"]{border-color:rgba(112,102,255,.24);color:#aeb6d2;background:rgba(112,102,255,.07)}
    .yk-current-page-memory-status[data-state="error"]{border-color:rgba(255,111,143,.25);color:#ff9ab0;background:rgba(255,111,143,.06)}
    @media(prefers-reduced-motion:reduce){.yk-current-page-memory-status{scroll-behavior:auto}}
  `
  documentRef.head.append(style)
}
