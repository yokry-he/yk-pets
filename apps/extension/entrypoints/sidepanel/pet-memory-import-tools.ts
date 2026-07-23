/**
 * 文件职责 / File responsibility
 * 为宠物记忆安装本地 JSON 导入和网页摘录重新定位控件，并提供加载、成功、失败和宠物反馈状态。
 * Installs local JSON import and page-excerpt relocation controls for Pet Memory with loading, success, failure, and pet feedback states.
 */
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import {
  PET_MEMORY_IMPORT_MAX_BYTES,
  PET_MEMORY_STORAGE_KEY,
  normalizeMemoryPageUrl,
  normalizePetMemoryStore,
  type PetMemoryCard,
  type PetMemoryImportResult,
  type PetMemoryRelocateInput,
  type PetMemoryRelocateResult,
} from '@nova/shared/pet-memory'

const TOOLS_ATTRIBUTE = 'data-yk-pet-memory-transfer'
const RELOCATE_SELECTOR = '[data-yk-pet-memory-relocate]'
const STYLE_ID = 'yk-pet-memory-import-tools-style'

export function installPetMemoryImportTools(documentRef: Document) {
  installStyles(documentRef)
  const install = () => {
    for (const details of documentRef.querySelectorAll<HTMLDetailsElement>('.memory-library .export-menu')) {
      if (!details.hasAttribute(TOOLS_ATTRIBUTE)) installTransferControl(documentRef, details)
    }
    for (const card of documentRef.querySelectorAll<HTMLElement>('.memory-list .memory-card')) {
      if (!card.querySelector(RELOCATE_SELECTOR)) installRelocateControl(documentRef, card)
    }
  }

  install()
  const observer = new MutationObserver(install)
  observer.observe(documentRef.documentElement, { childList: true, subtree: true })
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true })
}

function installTransferControl(documentRef: Document, details: HTMLDetailsElement) {
  const menu = details.querySelector<HTMLElement>(':scope > div')
  const summary = details.querySelector<HTMLElement>(':scope > summary')
  const toolbar = details.closest('.library-toolbar')
  if (!menu || !toolbar) return

  details.setAttribute(TOOLS_ATTRIBUTE, 'true')
  if (summary) {
    summary.textContent = '⇅'
    summary.setAttribute('aria-label', '导入或导出宠物记忆')
  }

  const fileInput = documentRef.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'application/json,.json'
  fileInput.hidden = true
  fileInput.dataset.memoryImportFile = 'true'

  const importButton = documentRef.createElement('button')
  importButton.type = 'button'
  importButton.className = 'yk-pet-memory-import-button'
  importButton.textContent = '导入 JSON'

  const status = documentRef.createElement('p')
  status.className = 'yk-pet-memory-import-status'
  status.dataset.memoryImportStatus = 'true'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.hidden = true

  menu.prepend(fileInput, importButton)
  toolbar.insertAdjacentElement('afterend', status)

  importButton.addEventListener('click', () => {
    status.hidden = true
    status.textContent = ''
    fileInput.click()
  })

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    details.open = false
    setBusy(importButton, true, '导入中…', '导入 JSON')
    showStatus(status, `正在检查 ${file.name}…`, 'loading')

    try {
      if (file.size > PET_MEMORY_IMPORT_MAX_BYTES) throw new Error('JSON 文件不能超过 8 MB。')
      const payload = JSON.parse(await file.text()) as unknown
      const response = await chrome.runtime.sendMessage({
        type: 'YK_PET_MEMORY_IMPORT',
        payload,
      } satisfies NovaRuntimeMessage) as { ok?: boolean; result?: PetMemoryImportResult; error?: string } | undefined
      if (!response?.ok || !response.result) throw new Error(response?.error || '无法导入宠物记忆。')

      showStatus(status, formatImportResult(response.result), 'success')
      await sendImportPetFeedback(response.result)
    }
    catch (error) {
      showStatus(status, `导入失败：${error instanceof Error ? error.message : String(error)}`, 'error')
      await sendImportFailureFeedback()
    }
    finally {
      setBusy(importButton, false, '导入中…', '导入 JSON')
    }
  })
}

function installRelocateControl(documentRef: Document, article: HTMLElement) {
  const quote = article.querySelector<HTMLElement>(':scope > blockquote')
  const footer = article.querySelector<HTMLElement>(':scope > footer')
  if (!quote?.textContent?.trim() || !footer) return

  const button = documentRef.createElement('button')
  button.type = 'button'
  button.className = 'yk-pet-memory-relocate-button'
  button.dataset.ykPetMemoryRelocate = 'true'
  button.textContent = '定位摘录'
  button.setAttribute('aria-label', '打开来源页面并重新定位这段网页摘录')
  footer.children[1]?.insertAdjacentElement('beforebegin', button) || footer.append(button)

  button.addEventListener('click', async () => {
    const status = documentRef.querySelector<HTMLElement>('[data-memory-import-status]')
    setBusy(button, true, '定位中…', '定位摘录')
    if (status) showStatus(status, '正在来源页面中重新查找摘录…', 'loading')
    try {
      const card = await resolveRenderedMemoryCard(article)
      if (!card?.selection) throw new Error('无法从当前列表解析这张网页摘录卡。')
      const result = await relocateMemoryCard(card)
      if (status) showStatus(status, formatRelocateResult(result), 'success')
    }
    catch (error) {
      if (status) showStatus(status, `定位失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    }
    finally {
      setBusy(button, false, '定位中…', '定位摘录')
    }
  })
}

async function relocateMemoryCard(card: PetMemoryCard): Promise<PetMemoryRelocateResult> {
  const selection = card.selection?.trim().slice(0, 4_000)
  if (!selection) throw new Error('这张记忆卡没有可定位的网页摘录。')
  const pageUrl = normalizeMemoryPageUrl(card.pageUrl)
  if (!pageUrl) throw new Error('这张记忆卡没有可打开的 HTTP/HTTPS 来源页面。')
  const input: PetMemoryRelocateInput = {
    cardId: card.id,
    selection,
    selector: card.selector,
    pageUrl,
    pageTitle: card.pageTitle,
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id && normalizeMemoryPageUrl(activeTab.url) === pageUrl) {
    return await highlightMemorySelection(activeTab.id, input, false)
  }

  const createdTab = await chrome.tabs.create({ url: pageUrl, active: true })
  if (!createdTab.id) throw new Error('无法打开摘录的来源页面。')
  await waitForTabComplete(createdTab.id)
  return await highlightMemorySelection(createdTab.id, input, true)
}

async function highlightMemorySelection(
  tabId: number,
  input: PetMemoryRelocateInput,
  openedNewTab: boolean,
): Promise<PetMemoryRelocateResult> {
  const response = await sendMemoryHighlightMessage(tabId, input)
  if (!response?.ok || !response.matchCount) {
    await sendRelocatePetState(tabId, false, response?.error || '页面内容可能已经变化，我没有找到完全匹配的摘录。')
    throw new Error(response?.error || '页面内容可能已经变化，未找到完全匹配的摘录。')
  }

  await sendRelocatePetState(
    tabId,
    true,
    response.matchCount > 1
      ? `我找到了 ${response.matchCount} 处相同文字，已经定位到第一处可见摘录。`
      : '我已经重新找到并高亮这段网页摘录。',
  )
  return {
    matchCount: response.matchCount,
    usedSelector: Boolean(response.usedSelector),
    openedNewTab,
  }
}

async function sendMemoryHighlightMessage(tabId: number, input: PetMemoryRelocateInput) {
  let lastError: unknown
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: 'YK_PET_MEMORY_HIGHLIGHT',
        input,
      } satisfies NovaRuntimeMessage) as {
        ok?: boolean
        matchCount?: number
        usedSelector?: boolean
        error?: string
      } | undefined
    }
    catch (error) {
      lastError = error
      if (attempt < 5) await delay(120 * (attempt + 1))
    }
  }
  throw new Error(`无法连接来源页面：${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

async function sendRelocatePetState(tabId: number, found: boolean, speech: string) {
  await chrome.tabs.sendMessage(tabId, {
    type: 'NOVA_UPDATE_PET_STATE',
    state: { behavior: found ? 'happy' : 'confused', speech, busy: false },
  } satisfies NovaRuntimeMessage).catch(() => undefined)
}

function waitForTabComplete(tabId: number, timeoutMs = 15_000) {
  return new Promise<void>(async (resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => finish(new Error('来源页面加载超时，请稍后重试。')), timeoutMs)
    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish()
    }
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      if (error) reject(error)
      else resolve()
    }

    chrome.tabs.onUpdated.addListener(onUpdated)
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete') finish()
    }
    catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function delay(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function resolveRenderedMemoryCard(article: HTMLElement): Promise<PetMemoryCard | undefined> {
  const selection = article.querySelector<HTMLElement>(':scope > blockquote')?.textContent?.trim()
  const title = article.querySelector<HTMLElement>(':scope > h2')?.textContent?.trim()
  const pageTitle = article.querySelector<HTMLElement>(':scope > .page-source span')?.textContent?.trim()
  if (!selection) return undefined

  const stored = await chrome.storage.local.get(PET_MEMORY_STORAGE_KEY)
  const candidates = normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY]).cards
    .filter(card => card.status !== 'archived' && card.selection === selection)
    .filter(card => !title || card.title === title)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  return candidates.find(card => pageTitle && (card.pageTitle === pageTitle || card.pageUrl === pageTitle)) || candidates[0]
}

function setBusy(button: HTMLButtonElement, busy: boolean, busyLabel: string, idleLabel: string) {
  button.disabled = busy
  button.textContent = busy ? busyLabel : idleLabel
  button.setAttribute('aria-busy', String(busy))
}

function showStatus(status: HTMLElement, message: string, state: 'loading' | 'success' | 'error') {
  status.hidden = false
  status.textContent = message
  status.dataset.state = state
}

function formatImportResult(result: PetMemoryImportResult) {
  const details: string[] = []
  if (result.duplicateCount) details.push(`跳过重复 ${result.duplicateCount} 张`)
  if (result.conflictCount) details.push(`跳过 ID 冲突 ${result.conflictCount} 张`)
  if (result.invalidCount) details.push(`忽略无效 ${result.invalidCount} 张`)
  if (result.truncatedCount) details.push(`因容量上限未导入 ${result.truncatedCount} 张`)
  const summary = result.importedCount > 0 ? `已导入 ${result.importedCount} 张记忆卡` : '没有新增记忆卡'
  return `${summary}${details.length ? `，${details.join('，')}` : ''}。`
}

function formatRelocateResult(result: PetMemoryRelocateResult) {
  const destination = result.openedNewTab ? '已在新标签页打开来源并定位' : '已在当前页面定位'
  const matches = result.matchCount > 1 ? `，页面共有 ${result.matchCount} 处相同文字` : ''
  const anchor = result.usedSelector ? '，已使用保存的元素位置缩小范围' : ''
  return `${destination}${matches}${anchor}。高亮会在 12 秒后自动收起。`
}

async function sendImportPetFeedback(result: PetMemoryImportResult) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await chrome.tabs.sendMessage(tab.id, {
    type: 'NOVA_UPDATE_PET_STATE',
    state: {
      behavior: result.importedCount > 0 ? 'happy' : 'listening',
      speech: result.importedCount > 0
        ? `我整理好了 ${result.importedCount} 张导入记忆。`
        : '导入文件已经检查完成，没有新增记忆。',
      busy: false,
    },
  } satisfies NovaRuntimeMessage).catch(() => undefined)
}

async function sendImportFailureFeedback() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await chrome.tabs.sendMessage(tab.id, {
    type: 'NOVA_UPDATE_PET_STATE',
    state: {
      behavior: 'confused',
      speech: '这份 JSON 没有通过导入检查，请查看右侧栏中的原因。',
      busy: false,
    },
  } satisfies NovaRuntimeMessage).catch(() => undefined)
}

function installStyles(documentRef: Document) {
  if (documentRef.getElementById(STYLE_ID)) return
  const style = documentRef.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .export-menu[${TOOLS_ATTRIBUTE}]>div{width:132px}
    .yk-pet-memory-import-button{min-height:31px;padding:0 8px;border:0;border-radius:8px;color:#aeb6d2;background:transparent;text-align:left;cursor:pointer;font-size:8px}
    .yk-pet-memory-import-button:hover:not(:disabled){color:#fff;background:rgba(112,102,255,.14)}
    .yk-pet-memory-import-button:focus-visible,.yk-pet-memory-relocate-button:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}
    .yk-pet-memory-import-button:disabled,.yk-pet-memory-relocate-button:disabled{cursor:not-allowed;opacity:.55}
    .yk-pet-memory-import-status{margin:8px 2px 0;color:#72cfc4;font-size:8px;line-height:1.5}
    .yk-pet-memory-import-status[data-state="loading"]{color:#9ea7ca}
    .yk-pet-memory-import-status[data-state="error"]{color:#ff9ab0}
    .yk-pet-memory-relocate-button{border-color:rgba(82,224,208,.32)!important;color:#a9e8df!important;background:rgba(82,224,208,.07)!important}
    @media(prefers-reduced-motion:reduce){.yk-pet-memory-import-button,.yk-pet-memory-relocate-button{transition:none}}
  `
  documentRef.head.append(style)
}
