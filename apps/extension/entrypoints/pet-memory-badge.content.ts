/**
 * 文件职责 / File responsibility
 * 将网页宠物中的只读记忆数量增强为独立可聚焦按钮，并以一次性本地请求打开当前页面记忆筛选。
 * Enhances the in-page pet's read-only memory count into an independent focusable button that opens the Current Page memory filter through a one-shot local request.
 */
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import {
  PET_MEMORY_CURRENT_PAGE_REQUEST_KEY,
  type PetMemoryCurrentPageRequest,
} from '@nova/shared/pet-memory-navigation'
import { normalizeMemoryPageUrl } from '@nova/shared/pet-memory'

const OVERLAY_SELECTOR = '[data-nova-extension-root="overlay"]'
const BUTTON_SELECTOR = '[data-yk-current-page-memory-button]'
const STYLE_ID = 'yk-current-page-memory-button-style'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    let documentObserver: MutationObserver | null = null
    let shadowObserver: MutationObserver | null = null
    let resetTimer: number | null = null

    const attach = (host: HTMLElement) => {
      const shadow = host.shadowRoot
      if (!shadow) return false
      documentObserver?.disconnect()
      documentObserver = null
      installStyle(shadow)
      const sync = () => syncCurrentPageButton(shadow, () => resetTimer, timer => { resetTimer = timer })
      sync()
      shadowObserver?.disconnect()
      shadowObserver = new MutationObserver(sync)
      shadowObserver.observe(shadow, { childList: true, subtree: true, characterData: true })
      return true
    }

    const findAndAttach = () => {
      const host = document.querySelector<HTMLElement>(OVERLAY_SELECTOR)
      return Boolean(host && attach(host))
    }

    if (!findAndAttach()) {
      documentObserver = new MutationObserver(() => {
        findAndAttach()
      })
      documentObserver.observe(document.documentElement, { childList: true, subtree: true })
    }

    window.addEventListener('pagehide', () => {
      if (resetTimer !== null) window.clearTimeout(resetTimer)
      documentObserver?.disconnect()
      shadowObserver?.disconnect()
    }, { once: true })
  },
})

function syncCurrentPageButton(
  shadow: ShadowRoot,
  getResetTimer: () => number | null,
  setResetTimer: (timer: number | null) => void,
) {
  const shell = shadow.querySelector<HTMLElement>('.nova-pet-shell')
  const original = shadow.querySelector<HTMLElement>('.nova-pet-memory-badge')
  let button = shadow.querySelector<HTMLButtonElement>(BUTTON_SELECTOR)
  if (!shell) return

  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'yk-current-page-memory-button'
    button.dataset.ykCurrentPageMemoryButton = 'true'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openCurrentPageMemories(button!).catch(error => {
        button!.dataset.state = 'error'
        button!.title = `无法打开当前页面记忆：${error instanceof Error ? error.message : String(error)}`
        button!.setAttribute('aria-label', button!.title)
        const previousTimer = getResetTimer()
        if (previousTimer !== null) window.clearTimeout(previousTimer)
        setResetTimer(window.setTimeout(() => {
          button!.dataset.state = 'idle'
          syncButtonLabel(button!, original)
          setResetTimer(null)
        }, 4_000))
      })
    })
    shell.append(button)
  }

  if (!original) {
    button.hidden = true
    return
  }

  original.setAttribute('aria-hidden', 'true')
  original.style.visibility = 'hidden'
  button.hidden = false
  if (button.dataset.state !== 'loading' && button.dataset.state !== 'error') syncButtonLabel(button, original)
}

async function openCurrentPageMemories(button: HTMLButtonElement) {
  const pageUrl = normalizeMemoryPageUrl(location.href)
  if (!pageUrl) throw new Error('当前页面不是可记录的 HTTP/HTTPS 页面。')
  const request: PetMemoryCurrentPageRequest = {
    pageUrl,
    pageTitle: document.title.trim().slice(0, 300) || location.hostname,
    createdAt: Date.now(),
  }

  button.dataset.state = 'loading'
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.title = '正在打开当前页面的宠物记忆…'
  button.setAttribute('aria-label', button.title)

  // 两个 Promise 在点击调用栈中立即启动，避免异步存储消耗 Side Panel 所需的用户手势。 / Start both promises synchronously in the click stack so storage does not consume the user gesture required by Side Panel.
  const requestWrite = chrome.storage.local.set({ [PET_MEMORY_CURRENT_PAGE_REQUEST_KEY]: request })
  const openRequest = chrome.runtime.sendMessage({
    type: 'NOVA_OPEN_SIDE_PANEL',
    action: 'open-memory',
  } satisfies NovaRuntimeMessage) as Promise<{ ok?: boolean; error?: string } | undefined>
  const [, response] = await Promise.all([requestWrite, openRequest])
  if (!response?.ok) {
    await chrome.storage.local.remove(PET_MEMORY_CURRENT_PAGE_REQUEST_KEY).catch(() => undefined)
    throw new Error(response?.error || '浏览器没有打开 Side Panel。')
  }

  button.dataset.state = 'success'
  button.disabled = false
  button.setAttribute('aria-busy', 'false')
  button.title = '已打开当前页面的宠物记忆'
  button.setAttribute('aria-label', button.title)
}

function syncButtonLabel(button: HTMLButtonElement, original: HTMLElement | null) {
  const count = original?.textContent?.replace(/[^0-9]/g, '') || '0'
  button.textContent = `✎ ${count}`
  button.title = `打开当前页面的 ${count} 条宠物记忆`
  button.setAttribute('aria-label', button.title)
  button.setAttribute('aria-busy', 'false')
  button.disabled = false
  button.dataset.state = 'idle'
}

function installStyle(shadow: ShadowRoot) {
  if (shadow.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .yk-current-page-memory-button{
      position:absolute;right:152px;bottom:195px;z-index:26;min-width:34px;height:25px;display:grid;place-items:center;padding:0 7px;
      border:2px solid rgba(9,12,25,.88);border-radius:999px;color:#f2f0ff;background:linear-gradient(110deg,#7066ff,#5d8cff);
      box-shadow:0 8px 18px rgba(0,0,0,.22),0 0 18px rgba(112,102,255,.2);font:850 9px/1 Inter,ui-sans-serif,system-ui,sans-serif;
      cursor:pointer;pointer-events:auto;transition:transform 140ms ease,filter 140ms ease,box-shadow 140ms ease;
    }
    .yk-current-page-memory-button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 10px 22px rgba(0,0,0,.24),0 0 22px rgba(112,102,255,.28)}
    .yk-current-page-memory-button:focus-visible{outline:3px solid rgba(82,224,208,.9);outline-offset:2px}
    .yk-current-page-memory-button:disabled{cursor:wait;opacity:.68}
    .yk-current-page-memory-button[data-state="loading"]{filter:saturate(.7)}
    .yk-current-page-memory-button[data-state="error"]{background:linear-gradient(110deg,#d55678,#8f5bff)}
    @media(max-width:520px){.yk-current-page-memory-button{right:118px;bottom:165px}}
    @media(prefers-reduced-motion:reduce){.yk-current-page-memory-button{transition:none}.yk-current-page-memory-button:hover:not(:disabled){transform:none}}
  `
  shadow.append(style)
}
