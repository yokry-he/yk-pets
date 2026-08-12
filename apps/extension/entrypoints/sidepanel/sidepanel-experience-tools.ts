/**
 * 文件职责 / File responsibility
 * 将 Side Panel 重排为任务优先的首页、记忆、审计、网络和云灵工作区，并复用原有按钮、存储和安全调用链。
 * Reorganizes the Side Panel into task-first Home, Memory, Audit, Network, and Zeph workspaces while reusing existing controls, storage, and safety flows.
 */
import {
  PET_MEMORY_STORAGE_KEY,
  memoryMatchesPage,
  normalizeMemoryPageUrl,
  normalizePetMemoryStore,
} from '@nova/shared/pet-memory'
import type { AuditReport } from '@nova/shared/audit'
import type { NovaRuntimeMessage } from '@nova/shared/messages'

const EXPERIENCE_ATTRIBUTE = 'data-yk-sidepanel-experience'
const MODE_ATTRIBUTE = 'data-yk-sidepanel-mode'
const STYLE_ID = 'yk-sidepanel-experience-style'
type SidePanelMode = 'home' | 'memory' | 'audit' | 'network' | 'pet'

export async function installSidePanelExperienceTools(documentRef: Document) {
  const shell = await waitForElement<HTMLElement>(documentRef, '.sidepanel-shell')
  const tabs = await waitForElement<HTMLElement>(documentRef, '.workspace-tabs')
  if (!shell || !tabs || shell.hasAttribute(EXPERIENCE_ATTRIBUTE)) return

  shell.setAttribute(EXPERIENCE_ATTRIBUTE, 'true')
  installStyles(documentRef)
  normalizeBrand(shell)

  const original = resolveOriginalTabs(tabs)
  if (!original.memory || !original.audit || !original.network) return
  original.memory.textContent = '记忆'
  original.audit.textContent = '审计'
  original.network.textContent = '网络'
  original.memory.dataset.ykWorkspace = 'memory'
  original.audit.dataset.ykWorkspace = 'audit'
  original.network.dataset.ykWorkspace = 'network'

  const homeButton = createWorkspaceButton(documentRef, 'home', '首页')
  const petButton = createWorkspaceButton(documentRef, 'pet', '云灵')
  tabs.prepend(homeButton)
  tabs.append(petButton)

  const home = createHomeWorkspace(documentRef)
  const pet = createPetWorkspace(documentRef)
  tabs.insertAdjacentElement('afterend', pet)
  tabs.insertAdjacentElement('afterend', home)

  let mode: SidePanelMode = 'home'
  let disposed = false
  let scheduled = false
  let refreshGeneration = 0

  const buttons: Record<SidePanelMode, HTMLButtonElement> = {
    home: homeButton,
    memory: original.memory,
    audit: original.audit,
    network: original.network,
    pet: petButton,
  }

  const selectMode = (next: SidePanelMode, clickOriginal = false) => {
    mode = next
    shell.setAttribute(MODE_ATTRIBUTE, next)
    for (const [id, button] of Object.entries(buttons)) {
      button.classList.toggle('active', id === next)
      button.setAttribute('aria-current', id === next ? 'page' : 'false')
    }
    home.hidden = next !== 'home'
    pet.hidden = next !== 'pet'
    if (clickOriginal && ['memory', 'audit', 'network'].includes(next)) buttons[next].click()
    if (next === 'home') scheduleRefresh()
    if (next === 'pet') movePetCards()
  }

  for (const next of ['memory', 'audit', 'network'] as const) {
    buttons[next].addEventListener('click', () => selectMode(next))
  }
  homeButton.addEventListener('click', () => selectMode('home'))
  petButton.addEventListener('click', () => selectMode('pet'))

  home.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-home-action]')?.dataset.homeAction
    if (action === 'memory') selectMode('memory', true)
    if (action === 'audit') selectMode('audit', true)
    if (action === 'network') selectMode('network', true)
    if (action === 'pet') selectMode('pet')
    if (action === 'agent') shell.querySelector<HTMLButtonElement>('.agent-toggle')?.click()
    if (action === 'run-audit') {
      selectMode('audit', true)
      requestAnimationFrame(() => shell.querySelector<HTMLButtonElement>('.audit-button')?.click())
    }
    if (action === 'refresh') scheduleRefresh()
  })

  const movePetCards = () => {
    const content = pet.querySelector<HTMLElement>('[data-pet-workspace-content]')
    if (!content) return
    for (const selector of ['.pet-entry-card', '.pet-voice-card', '[data-yk-pet-runtime-settings]', '[data-yk-pet-studio-tools]']) {
      const node = shell.querySelector<HTMLElement>(selector)
      if (node && node.parentElement !== content) content.append(node)
    }
  }

  const refreshHome = async () => {
    const generation = ++refreshGeneration
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (disposed || generation !== refreshGeneration) return
    const normalizedUrl = normalizeMemoryPageUrl(tab?.url)
    const keys = [PET_MEMORY_STORAGE_KEY, ...(tab?.id ? [`nova:report:${tab.id}`] : [])]
    const stored = await chrome.storage.local.get(keys)
    if (disposed || generation !== refreshGeneration) return
    const cards = normalizePetMemoryStore(stored[PET_MEMORY_STORAGE_KEY]).cards
    const pageMemories = cards.filter(card => memoryMatchesPage(card, normalizedUrl)).length
    const openTasks = cards.filter(card => card.status === 'todo' || card.status === 'doing').length
    const report = tab?.id ? stored[`nova:report:${tab.id}`] as AuditReport | undefined : undefined
    const agentState = shell.querySelector<HTMLElement>('.agent-toggle i')?.className || 'disconnected'
    renderHome(home, {
      title: tab?.title || '等待普通网页',
      url: normalizedUrl || 'Chrome 内部页或当前页面不可访问',
      pageMemories,
      openTasks,
      auditScore: report?.score,
      auditIssues: report?.summary.total || 0,
      agentState,
    })
  }

  function scheduleRefresh() {
    if (disposed || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      refreshHome().catch(error => renderHomeError(home, error))
    })
  }

  const onStorageChanged = () => scheduleRefresh()
  const onTabChanged = () => scheduleRefresh()
  const onRuntimeMessage = (message: NovaRuntimeMessage) => {
    if (message.type === 'YK_PET_MEMORY_DRAFT_READY') selectMode('memory')
    if (message.type !== 'NOVA_SIDE_PANEL_ACTION') return
    if (message.action === 'open-memory') selectMode('memory')
    if (message.action === 'open-report') selectMode('audit')
    if (message.action === 'network-lab') selectMode('network')
    if (message.action === 'connect-agent') scheduleRefresh()
  }
  const observer = new MutationObserver(() => {
    movePetCards()
    scheduleRefresh()
  })
  observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  chrome.storage.onChanged.addListener(onStorageChanged)
  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.tabs.onActivated.addListener(onTabChanged)
  chrome.tabs.onUpdated.addListener(onTabChanged)

  movePetCards()
  selectMode('home')
  scheduleRefresh()

  window.addEventListener('pagehide', () => {
    disposed = true
    observer.disconnect()
    chrome.storage.onChanged.removeListener(onStorageChanged)
    chrome.runtime.onMessage.removeListener(onRuntimeMessage)
    chrome.tabs.onActivated.removeListener(onTabChanged)
    chrome.tabs.onUpdated.removeListener(onTabChanged)
  }, { once: true })
}

function resolveOriginalTabs(tabs: HTMLElement) {
  const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('button')]
  return {
    memory: buttons.find(button => button.textContent?.includes('宠物记忆')),
    audit: buttons.find(button => button.textContent?.includes('页面审计')),
    network: buttons.find(button => button.textContent?.includes('网络实验室')),
  }
}

function createWorkspaceButton(documentRef: Document, mode: SidePanelMode, label: string) {
  const button = documentRef.createElement('button')
  button.type = 'button'
  button.dataset.ykWorkspace = mode
  button.textContent = label
  return button
}

function createHomeWorkspace(documentRef: Document) {
  const section = documentRef.createElement('section')
  section.className = 'yk-sidepanel-home'
  section.dataset.ykSidepanelHome = 'true'
  section.setAttribute('aria-labelledby', 'yk-sidepanel-home-title')
  section.innerHTML = `
    <header class="yk-home-hero">
      <div><span>YK-PETS HOME</span><h1 id="yk-sidepanel-home-title">当前页面工作台</h1><p data-home-page-title>正在读取当前页面…</p><small data-home-page-url></small></div>
      <button data-home-action="refresh" type="button" aria-label="刷新首页状态">↻</button>
    </header>
    <div class="yk-home-summary">
      <article><span>页面记忆</span><strong data-home-memory>0</strong><small>当前页面</small></article>
      <article><span>待办任务</span><strong data-home-tasks>0</strong><small>全部记忆</small></article>
      <article><span>页面健康</span><strong data-home-score>—</strong><small data-home-issues>尚未审计</small></article>
      <article><span>Local Agent</span><strong data-home-agent>离线</strong><small>本地安全连接</small></article>
    </div>
    <div class="yk-home-actions">
      <button class="primary" data-home-action="run-audit" type="button"><span>开始页面审计</span><small>检查性能、无障碍、SEO 与结构</small></button>
      <button data-home-action="memory" type="button"><span>打开宠物记忆</span><small>记录当前页面与后续任务</small></button>
      <button data-home-action="network" type="button"><span>进入 Network Lab</span><small>查看请求、规则与 Mock</small></button>
      <button data-home-action="pet" type="button"><span>配置云灵</span><small>外观、音色、3D 与闲时动作</small></button>
    </div>
    <footer><button data-home-action="agent" type="button">打开 Local Agent 设置</button><p data-home-status role="status" aria-live="polite">首页只读取扩展本地状态，不上传页面内容。</p></footer>
  `
  return section
}

function createPetWorkspace(documentRef: Document) {
  const section = documentRef.createElement('section')
  section.className = 'yk-sidepanel-pet-workspace'
  section.dataset.ykPetWorkspace = 'true'
  section.hidden = true
  section.innerHTML = `
    <header><span>CLOUD FOX</span><h1>云灵设置</h1><p>外观、音色和运行偏好集中在这里，不再阻挡页面任务。</p></header>
    <div data-pet-workspace-content></div>
  `
  return section
}

function renderHome(home: HTMLElement, state: {
  title: string
  url: string
  pageMemories: number
  openTasks: number
  auditScore?: number
  auditIssues: number
  agentState: string
}) {
  setText(home, '[data-home-page-title]', state.title)
  setText(home, '[data-home-page-url]', state.url)
  setText(home, '[data-home-memory]', String(state.pageMemories))
  setText(home, '[data-home-tasks]', String(state.openTasks))
  setText(home, '[data-home-score]', state.auditScore === undefined ? '—' : String(state.auditScore))
  setText(home, '[data-home-issues]', state.auditScore === undefined ? '尚未审计' : `${state.auditIssues} 个改进机会`)
  const agentLabel = state.agentState.includes('connected') && !state.agentState.includes('disconnected')
    ? '已连接'
    : state.agentState.includes('connecting') ? '连接中' : state.agentState.includes('error') ? '错误' : '离线'
  setText(home, '[data-home-agent]', agentLabel)
  setText(home, '[data-home-status]', '状态已从当前标签页和扩展本地存储更新。')
}

function renderHomeError(home: HTMLElement, error: unknown) {
  setText(home, '[data-home-status]', `首页状态读取失败：${error instanceof Error ? error.message : String(error)}`)
}

function setText(root: HTMLElement, selector: string, value: string) {
  const node = root.querySelector<HTMLElement>(selector)
  if (node) node.textContent = value
}

function normalizeBrand(shell: HTMLElement) {
  const brand = shell.querySelector<HTMLElement>('.brand')
  const mark = brand?.querySelector<HTMLElement>(':scope > span')
  const name = brand?.querySelector<HTMLElement>('strong')
  const description = brand?.querySelector<HTMLElement>('small')
  if (mark) mark.textContent = 'YK'
  if (name) name.textContent = 'YK-PETS'
  if (description) description.textContent = 'CLOUD FOX AGENT'
}

function waitForElement<T extends Element>(documentRef: Document, selector: string, timeoutMs = 4_000) {
  return new Promise<T | null>((resolve) => {
    const existing = documentRef.querySelector<T>(selector)
    if (existing) return resolve(existing)
    const observer = new MutationObserver(() => {
      const node = documentRef.querySelector<T>(selector)
      if (!node) return
      observer.disconnect()
      window.clearTimeout(timeout)
      resolve(node)
    })
    observer.observe(documentRef.documentElement, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      resolve(documentRef.querySelector<T>(selector))
    }, timeoutMs)
  })
}

function installStyles(documentRef: Document) {
  if (documentRef.getElementById(STYLE_ID)) return
  const style = documentRef.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .sidepanel-shell[${EXPERIENCE_ATTRIBUTE}]{--yk-panel-border:rgba(126,133,177,.2);--yk-panel-bg:rgba(12,16,30,.94)}
    .sidepanel-shell[${EXPERIENCE_ATTRIBUTE}]>.pet-entry-card,.sidepanel-shell[${EXPERIENCE_ATTRIBUTE}]>.pet-voice-card,.sidepanel-shell[${EXPERIENCE_ATTRIBUTE}]>[data-yk-pet-runtime-settings],.sidepanel-shell[${EXPERIENCE_ATTRIBUTE}]>[data-yk-pet-studio-tools]{display:none!important}
    .sidepanel-shell[${MODE_ATTRIBUTE}="home"] .memory-workspace,.sidepanel-shell[${MODE_ATTRIBUTE}="home"]>.page-card,.sidepanel-shell[${MODE_ATTRIBUTE}="home"]>.report-section,.sidepanel-shell[${MODE_ATTRIBUTE}="home"]>.network-lab,.sidepanel-shell[${MODE_ATTRIBUTE}="pet"] .memory-workspace,.sidepanel-shell[${MODE_ATTRIBUTE}="pet"]>.page-card,.sidepanel-shell[${MODE_ATTRIBUTE}="pet"]>.report-section,.sidepanel-shell[${MODE_ATTRIBUTE}="pet"]>.network-lab{display:none!important}
    .workspace-tabs{position:sticky;top:0;z-index:12;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;padding:5px!important;border:1px solid var(--yk-panel-border);border-radius:14px!important;background:rgba(8,12,24,.92)!important;backdrop-filter:blur(18px)}
    .workspace-tabs button{min-height:36px!important;padding:0 5px!important;border:1px solid transparent!important;border-radius:10px!important;font-size:10px!important;white-space:nowrap}.workspace-tabs button.active{border-color:rgba(82,224,208,.35)!important;background:linear-gradient(135deg,rgba(112,102,255,.24),rgba(82,224,208,.14))!important}
    .yk-sidepanel-home,.yk-sidepanel-pet-workspace{display:grid;gap:12px;margin-top:12px}.yk-sidepanel-home[hidden],.yk-sidepanel-pet-workspace[hidden]{display:none!important}
    .yk-home-hero,.yk-sidepanel-pet-workspace>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px;border:1px solid rgba(112,102,255,.28);border-radius:20px;background:radial-gradient(circle at 10% 0,rgba(112,102,255,.25),transparent 42%),radial-gradient(circle at 100% 100%,rgba(82,224,208,.14),transparent 45%),linear-gradient(145deg,#12172c,#090e1c)}
    .yk-home-hero span,.yk-sidepanel-pet-workspace>header span{color:#8089ab;font:800 8px/1 ui-monospace,monospace;letter-spacing:.18em}.yk-home-hero h1,.yk-sidepanel-pet-workspace h1{margin:6px 0 5px;font-size:18px}.yk-home-hero p,.yk-sidepanel-pet-workspace>header p{margin:0;color:#a4acc9;font-size:10px;line-height:1.5}.yk-home-hero small{display:block;max-width:270px;margin-top:4px;overflow:hidden;color:#687192;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.yk-home-hero>button{width:34px;height:34px;border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;background:rgba(255,255,255,.07);cursor:pointer}
    .yk-home-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.yk-home-summary article{display:grid;gap:4px;padding:12px;border:1px solid var(--yk-panel-border);border-radius:15px;background:var(--yk-panel-bg)}.yk-home-summary span{color:#7f89aa;font-size:9px}.yk-home-summary strong{font-size:21px}.yk-home-summary small{color:#626b8c;font-size:8px}
    .yk-home-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.yk-home-actions button{display:grid;gap:4px;min-height:70px;padding:12px;border:1px solid rgba(126,133,177,.22);border-radius:15px;color:#e9edff;text-align:left;background:rgba(14,18,34,.92);cursor:pointer}.yk-home-actions button.primary{border-color:rgba(82,224,208,.38);background:linear-gradient(145deg,rgba(112,102,255,.25),rgba(82,224,208,.12))}.yk-home-actions span{font-size:12px;font-weight:800}.yk-home-actions small{color:#8992b2;font-size:9px;line-height:1.45}
    .yk-sidepanel-home>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px}.yk-sidepanel-home>footer button{min-height:34px;padding:0 10px;border:1px solid rgba(112,102,255,.3);border-radius:9px;color:#dce2ff;background:rgba(112,102,255,.1);cursor:pointer}.yk-sidepanel-home>footer p{margin:0;color:#697292;font-size:8px;line-height:1.45;text-align:right}
    .yk-sidepanel-pet-workspace>header{display:grid;justify-content:stretch}.yk-sidepanel-pet-workspace [data-pet-workspace-content]{display:grid;gap:12px}.yk-sidepanel-pet-workspace .pet-entry-card,.yk-sidepanel-pet-workspace .pet-voice-card,.yk-sidepanel-pet-workspace [data-yk-pet-runtime-settings],.yk-sidepanel-pet-workspace [data-yk-pet-studio-tools]{display:flex!important;margin:0!important}
    .brand>span{font-size:9px!important}.brand strong{letter-spacing:.03em}.app-header{position:relative;z-index:13}
    .yk-sidepanel-home button:focus-visible,.yk-sidepanel-pet-workspace button:focus-visible,.workspace-tabs button:focus-visible{outline:2px solid #52e0d0!important;outline-offset:2px}
    @media(max-width:360px){.workspace-tabs button{font-size:9px!important}.yk-home-actions{grid-template-columns:1fr}}
    @media(prefers-reduced-motion:reduce){.workspace-tabs{scroll-behavior:auto}}
  `
  documentRef.head.append(style)
}
