/**
 * 文件职责 / File responsibility
 * 在宠物记忆传输菜单中安装本地 JSON 导入控件，并提供加载、成功、失败和宠物反馈状态。
 * Installs local JSON import controls in the Pet Memory transfer menu with loading, success, failure, and pet feedback states.
 */
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import {
  PET_MEMORY_IMPORT_MAX_BYTES,
  type PetMemoryImportResult,
} from '@nova/shared/pet-memory'

const TOOLS_ATTRIBUTE = 'data-yk-pet-memory-transfer'
const STYLE_ID = 'yk-pet-memory-import-tools-style'

export function installPetMemoryImportTools(documentRef: Document) {
  installStyles(documentRef)
  const install = () => {
    for (const details of documentRef.querySelectorAll<HTMLDetailsElement>('.memory-library .export-menu')) {
      if (details.hasAttribute(TOOLS_ATTRIBUTE)) continue
      installTransferControl(documentRef, details)
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
    setBusy(importButton, true)
    showStatus(status, `正在检查 ${file.name}…`, false)

    try {
      if (file.size > PET_MEMORY_IMPORT_MAX_BYTES) throw new Error('JSON 文件不能超过 8 MB。')
      const payload = JSON.parse(await file.text()) as unknown
      const response = await chrome.runtime.sendMessage({
        type: 'YK_PET_MEMORY_IMPORT',
        payload,
      } satisfies NovaRuntimeMessage) as { ok?: boolean; result?: PetMemoryImportResult; error?: string } | undefined
      if (!response?.ok || !response.result) throw new Error(response?.error || '无法导入宠物记忆。')

      showStatus(status, formatImportResult(response.result), false)
      await sendPetFeedback(response.result)
    }
    catch (error) {
      showStatus(status, `导入失败：${error instanceof Error ? error.message : String(error)}`, true)
      await sendPetFailureFeedback()
    }
    finally {
      setBusy(importButton, false)
    }
  })
}

function setBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy
  button.textContent = busy ? '导入中…' : '导入 JSON'
  button.setAttribute('aria-busy', String(busy))
}

function showStatus(status: HTMLElement, message: string, error: boolean) {
  status.hidden = false
  status.textContent = message
  status.dataset.state = error ? 'error' : 'success'
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

async function sendPetFeedback(result: PetMemoryImportResult) {
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

async function sendPetFailureFeedback() {
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
    .yk-pet-memory-import-button:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}
    .yk-pet-memory-import-button:disabled{cursor:not-allowed;opacity:.55}
    .yk-pet-memory-import-status{margin:8px 2px 0;color:#72cfc4;font-size:8px;line-height:1.5}
    .yk-pet-memory-import-status[data-state="error"]{color:#ff9ab0}
    @media(prefers-reduced-motion:reduce){.yk-pet-memory-import-button{transition:none}}
  `
  documentRef.head.append(style)
}
