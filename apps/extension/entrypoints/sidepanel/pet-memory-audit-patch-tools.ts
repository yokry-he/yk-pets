/**
 * 文件职责 / File responsibility
 * 为审计记忆卡安装“生成补丁”入口，恢复精确审计问题并继续使用现有 Local Agent 补丁安全流程。
 * Installs the Generate Patch action for audit memory cards, restores the exact audit issue, and continues through the existing Local Agent patch safety flow.
 */
import type { AuditReport } from '@nova/shared/audit'
import {
  PET_MEMORY_STORAGE_KEY,
  normalizeMemoryPageUrl,
  normalizePetMemoryStore,
  type PetMemoryCard,
} from '@nova/shared/pet-memory'

const CONTROL_ATTRIBUTE = 'data-yk-pet-memory-audit-patch'
const CONTROL_SELECTOR = `[${CONTROL_ATTRIBUTE}]`
const STATUS_ID = 'yk-pet-memory-audit-patch-status'
const STYLE_ID = 'yk-pet-memory-audit-patch-style'
const REPORT_STORAGE_PREFIX = 'nova:report:'

export function installPetMemoryAuditPatchTools(documentRef: Document) {
  installStyles(documentRef)
  let disposed = false
  let scheduled = false
  let installing = false
  let statusTimer: number | null = null

  const showStatus = (message: string, state: 'loading' | 'success' | 'error', hideAfter = 0) => {
    const status = ensureStatus(documentRef)
    status.hidden = false
    status.textContent = message
    status.dataset.state = state
    if (statusTimer !== null) window.clearTimeout(statusTimer)
    statusTimer = hideAfter > 0
      ? window.setTimeout(() => {
          status.hidden = true
          statusTimer = null
        }, hideAfter)
      : null
  }

  const install = async () => {
    if (disposed || installing) return
    installing = true
    try {
      const stored = await chrome.storage.local.get(PET_MEMORY_STORAGE_KEY)
      const cards = normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY]).cards
      for (const article of documentRef.querySelectorAll<HTMLElement>('.memory-list .memory-card')) {
        if (article.querySelector(CONTROL_SELECTOR)) continue
        const card = resolveRenderedAuditMemoryCard(article, cards)
        if (!card) continue
        installAuditPatchControl(documentRef, article, card.id, showStatus)
      }
    }
    finally {
      installing = false
    }
  }

  const scheduleInstall = () => {
    if (disposed || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      install().catch(error => console.warn('[YK-PETS memory audit patch]', error))
    })
  }

  const observer = new MutationObserver(scheduleInstall)
  observer.observe(documentRef.documentElement, { childList: true, subtree: true })
  scheduleInstall()

  window.addEventListener('pagehide', () => {
    disposed = true
    observer.disconnect()
    if (statusTimer !== null) window.clearTimeout(statusTimer)
  }, { once: true })
}

function installAuditPatchControl(
  documentRef: Document,
  article: HTMLElement,
  cardId: string,
  showStatus: (message: string, state: 'loading' | 'success' | 'error', hideAfter?: number) => void,
) {
  const footer = article.querySelector<HTMLElement>(':scope > footer')
  if (!footer) return

  article.dataset.memoryCardId = cardId
  const button = documentRef.createElement('button')
  button.type = 'button'
  button.className = 'yk-pet-memory-audit-patch-button'
  button.setAttribute(CONTROL_ATTRIBUTE, 'true')
  button.dataset.memoryCardId = cardId
  button.textContent = '生成补丁'
  button.setAttribute('aria-label', '定位关联审计问题并通过现有 Local Agent 流程生成源码补丁')
  footer.children[1]?.insertAdjacentElement('beforebegin', button) || footer.append(button)

  let active = false
  button.addEventListener('click', async () => {
    if (active) return
    active = true
    setBusy(button, true)
    showStatus('云灵正在恢复关联审计问题…', 'loading')

    try {
      const card = await loadAuditMemoryCard(cardId)
      const issueId = card.relatedAuditIssueId
      if (!issueId) throw new Error('这张审计记忆卡缺少关联问题标识。')

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeUrl = normalizeMemoryPageUrl(tab?.url)
      const sourceUrl = normalizeMemoryPageUrl(card.pageUrl)
      if (!tab?.id || !activeUrl || !sourceUrl || activeUrl !== sourceUrl) {
        throw new Error('当前活动标签页不是这张记忆卡的来源页面，请先打开来源页面再重试。')
      }

      const reportKey = `${REPORT_STORAGE_PREFIX}${tab.id}`
      const stored = await chrome.storage.local.get(reportKey)
      const report = stored[reportKey] as AuditReport | undefined
      if (!report || !Array.isArray(report.issues)) throw new Error('当前页面没有可恢复的审计报告，请重新运行页面审计。')
      if (normalizeMemoryPageUrl(report.url) !== activeUrl) throw new Error('保存的审计报告不属于当前页面，请重新运行页面审计。')
      if (!report.issues.some(issue => issue.id === issueId)) throw new Error('关联审计问题已不在当前报告中，请重新审计并更新记忆卡。')

      const auditTab = findAuditWorkspaceButton(documentRef)
      if (!auditTab) throw new Error('页面审计工作区尚未准备完成。')
      auditTab.click()

      const controls = await waitForAuditControls(documentRef)
      controls.severityAll.click()
      controls.categoryAll.click()
      await nextFrame()
      await nextFrame()

      const issueCard = await waitForIssueCard(documentRef, issueId)
      const patchButton = issueCard.querySelector<HTMLButtonElement>('[data-issue-action="generate-patch"]')
      if (!patchButton) throw new Error('关联问题缺少现有源码补丁入口。')
      if (isAgentConnecting(documentRef)) throw new Error('Local Agent 正在连接，请等待连接完成后再试。')
      if (patchButton.disabled) throw new Error('另一个补丁操作正在进行，请完成后再试。')

      issueCard.focus({ preventScroll: true })
      issueCard.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      })
      patchButton.click()
      showStatus('已定位审计问题并进入现有 Local Agent 补丁流程；连接、Diff、Apply、Checks 与 Rollback 仍由原流程控制。', 'success', 8_000)
    }
    catch (error) {
      showStatus(`无法继续审计补丁：${error instanceof Error ? error.message : String(error)}`, 'error', 10_000)
    }
    finally {
      active = false
      setBusy(button, false)
    }
  })
}

async function loadAuditMemoryCard(cardId: string): Promise<PetMemoryCard> {
  const stored = await chrome.storage.local.get(PET_MEMORY_STORAGE_KEY)
  const card = normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY]).cards.find(item => item.id === cardId)
  if (!card || card.status === 'archived') throw new Error('这张记忆卡已不存在或已归档。')
  if (card.type !== 'audit-issue') throw new Error('只有审计类型记忆卡可以继续生成源码补丁。')
  return card
}

function resolveRenderedAuditMemoryCard(article: HTMLElement, cards: PetMemoryCard[]) {
  const title = textOf(article.querySelector(':scope > h2'))
  if (!title) return undefined
  const content = textOf(article.querySelector(':scope > p'))
  const selection = textOf(article.querySelector(':scope > blockquote'))
  const source = textOf(article.querySelector('.page-source span'))
  const tags = [...article.querySelectorAll<HTMLElement>('.card-tags button')]
    .map(button => button.textContent?.trim().replace(/^#/, '') || '')
    .filter(Boolean)
  const meta = textOf(article.querySelector(':scope > header div span'))
  const status = statusFromMeta(meta)
  const priority = priorityFromMeta(meta)

  const candidates = cards.filter(card => (
    card.status !== 'archived'
    && card.type === 'audit-issue'
    && Boolean(card.relatedAuditIssueId)
    && card.title === title
    && card.content === content
    && (card.selection || '') === selection
    && (card.pageTitle || card.pageUrl || '') === source
    && (!status || card.status === status)
    && (!priority || card.priority === priority)
    && card.tags.length === tags.length
    && card.tags.every((tag, index) => tag === tags[index])
  ))

  return candidates.length === 1 ? candidates[0] : undefined
}

function statusFromMeta(meta: string): PetMemoryCard['status'] | undefined {
  if (meta.startsWith('收件箱')) return 'inbox'
  if (meta.startsWith('待办')) return 'todo'
  if (meta.startsWith('进行中')) return 'doing'
  if (meta.startsWith('已完成')) return 'done'
  return undefined
}

function priorityFromMeta(meta: string): PetMemoryCard['priority'] | undefined {
  if (meta.includes('低优先级')) return 'low'
  if (meta.includes('中优先级')) return 'medium'
  if (meta.includes('高优先级')) return 'high'
  return undefined
}

function findAuditWorkspaceButton(documentRef: Document) {
  return documentRef.querySelector<HTMLButtonElement>('.workspace-tabs button:nth-of-type(2)')
    || [...documentRef.querySelectorAll<HTMLButtonElement>('.workspace-tabs button')]
      .find(button => button.textContent?.trim() === '页面审计')
}

function waitForAuditControls(documentRef: Document, timeoutMs = 4_000) {
  return waitForElementSet(documentRef, () => {
    const report = documentRef.querySelector<HTMLElement>('.report-section')
    const severityAll = documentRef.querySelector<HTMLButtonElement>('.filter-row:not(.category-filter-row) button:first-of-type')
    const categoryAll = documentRef.querySelector<HTMLButtonElement>('.category-filter-row button:first-of-type')
    return report && severityAll && categoryAll ? { severityAll, categoryAll } : null
  }, '页面审计结果尚未准备完成。', timeoutMs)
}

function waitForIssueCard(documentRef: Document, issueId: string, timeoutMs = 4_000) {
  const selector = `[data-issue-id="${CSS.escape(issueId)}"]`
  return waitForElementSet(documentRef, () => documentRef.querySelector<HTMLElement>(selector), '无法在当前审计报告中显示关联问题。', timeoutMs)
}

function waitForElementSet<T>(
  documentRef: Document,
  find: () => T | null,
  timeoutMessage: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    let observer: MutationObserver | null = null
    let timeout: number | null = null

    const finish = (value?: T | null, error?: Error) => {
      if (settled) return
      settled = true
      observer?.disconnect()
      if (timeout !== null) window.clearTimeout(timeout)
      if (error || !value) reject(error || new Error(timeoutMessage))
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
    timeout = window.setTimeout(() => finish(null, new Error(timeoutMessage)), timeoutMs)
  })
}

function isAgentConnecting(documentRef: Document) {
  return documentRef.querySelector('.agent-toggle i')?.classList.contains('connecting') === true
}

function textOf(element: Element | null) {
  return element?.textContent?.trim() || ''
}

function setBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy
  button.textContent = busy ? '处理中…' : '生成补丁'
  button.setAttribute('aria-busy', String(busy))
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function ensureStatus(documentRef: Document) {
  const existing = documentRef.getElementById(STATUS_ID)
  if (existing) return existing
  const status = documentRef.createElement('p')
  status.id = STATUS_ID
  status.className = 'yk-pet-memory-audit-patch-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.hidden = true
  const tabs = documentRef.querySelector('.workspace-tabs')
  if (tabs) tabs.insertAdjacentElement('afterend', status)
  else documentRef.querySelector('.sidepanel-shell')?.prepend(status)
  return status
}

function installStyles(documentRef: Document) {
  if (documentRef.getElementById(STYLE_ID)) return
  const style = documentRef.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .yk-pet-memory-audit-patch-button{min-height:28px;padding:0 9px;border:1px solid rgba(112,102,255,.35);border-radius:8px;color:#c9c5ff;background:rgba(112,102,255,.1);font-size:8px;font-weight:700;line-height:1;cursor:pointer}
    .yk-pet-memory-audit-patch-button:hover{border-color:rgba(112,102,255,.62);background:rgba(112,102,255,.18)}
    .yk-pet-memory-audit-patch-button:disabled{cursor:wait;opacity:.58}
    .yk-pet-memory-audit-patch-button:focus-visible,.issue-card[data-issue-id]:focus{outline:2px solid #52e0d0;outline-offset:2px}
    .yk-pet-memory-audit-patch-status{margin:8px 2px 0;padding:8px 10px;border:1px solid rgba(82,224,208,.2);border-radius:10px;color:#92ded5;background:rgba(82,224,208,.06);font-size:8px;line-height:1.5}
    .yk-pet-memory-audit-patch-status[data-state="loading"]{border-color:rgba(112,102,255,.24);color:#aeb6d2;background:rgba(112,102,255,.07)}
    .yk-pet-memory-audit-patch-status[data-state="error"]{border-color:rgba(255,111,143,.25);color:#ff9ab0;background:rgba(255,111,143,.06)}
    @media(prefers-reduced-motion:reduce){.yk-pet-memory-audit-patch-button{transition:none}}
  `
  documentRef.head.append(style)
}
