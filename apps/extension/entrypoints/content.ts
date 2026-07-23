/**
 * 文件职责 / File responsibility
 * 页面审计 Content Script，负责指标采集、问题定位、预览修复和宠物覆盖层装配。
 * Page-audit content script for metrics, issue navigation, preview repairs, and pet-overlay assembly.
 */
import {
  AUDIT_CATEGORIES,
  AUDIT_RULE_CODES,
  AUDIT_RULES,
  calculateAuditScore,
  createAuditSummary,
  type AuditCategory,
  type AuditIssue,
  type AuditIssueCode,
  type AuditReport,
  type AuditSeverity,
  type PageMetrics,
} from '@nova/shared/audit'
import type {
  NovaPetAction,
  NovaPetVisualState,
  NovaRuntimeMessage,
} from '@nova/shared/messages'
import overlayStyles from './content/nova-pet-overlay.css?inline'

// 页面审计使用的跨观察器状态。 / Cross-observer state used by the page audit.
interface PerformanceState {
  lcp: number | null
  cls: number
  longTaskDuration: number
}

interface PreviewSnapshot {
  element: HTMLElement
  attributes: Map<string, string | null>
  styles: Map<string, string>
}

/**
 * document_start 注入后先安装覆盖层和性能观察器，再等待用户触发审计。
 * At document_start, install the overlay and performance observers, then wait for user-triggered audits.
 */
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    const performanceState: PerformanceState = {
      lcp: null,
      cls: 0,
      longTaskDuration: 0,
    }
    const previews = new Map<string, PreviewSnapshot>()
    const highlight = createHighlightLayer()
    let latestReport: AuditReport | null = null
    let currentIssueIndex = 0
    let previewIssueId: string | null = null
    let auditRunning = false

    // 宠物动作路由：轻量反馈留在页面，复杂结果通过 Runtime 进入 Side Panel。 / Pet action router: keep lightweight feedback in-page and send complex results to the Side Panel.
    const overlay = createNovaOverlay(async (action) => {
      if (action === 'audit') {
        await runAuditAndPublish().catch(() => undefined)
        return
      }

      if (action === 'previous-issue' || action === 'next-issue') {
        selectIssue(action === 'next-issue' ? 1 : -1)
        return
      }

      if (action === 'preview-current') {
        previewCurrentIssue()
        return
      }

      if (action === 'rollback-preview') {
        rollbackCurrentPreview()
        return
      }

      const issue = getCurrentIssue()
      const isNavigationAction = action === 'open-report' || action === 'network-lab' || action === 'connect-agent'
      overlay.patch({
        behavior: isNavigationAction ? 'greeting' : 'thinking',
        speech: getDelegatedActionSpeech(action),
        busy: !isNavigationAction,
      })
      const response = await chrome.runtime.sendMessage({
        type: 'NOVA_OPEN_SIDE_PANEL',
        action,
        issueId: issue?.id,
      } satisfies NovaRuntimeMessage).catch(error => ({ ok: false, error: String(error) })) as { ok?: boolean; error?: string } | undefined

      if (!response?.ok) {
        overlay.patch({
          behavior: 'confused',
          speech: response?.error
            ? `无法打开右侧栏：${response.error}`
            : '无法打开右侧栏，请确认浏览器支持 Side Panel，并重新加载扩展后刷新页面。',
          busy: false,
        })
      }
      else if (isNavigationAction) {
        // 打开工作区只是导航，不得遗留任务忙碌状态。 / Opening a workspace is navigation and must never leave task busy state behind.
        overlay.patch({ behavior: 'greeting', busy: false })
      }
    })

    setupPerformanceObservers(performanceState)

    async function runAuditAndPublish(requestedCategories?: AuditCategory[], requestedRuleCodes?: AuditIssueCode[]) {
      const enabledRuleCodes = await resolveEnabledAuditRules(requestedRuleCodes, requestedCategories)
      if (!enabledRuleCodes.length) {
        overlay.patch({ behavior: 'confused', speech: '请先在页面审计中至少选择一条检查规则。', busy: false })
        throw new Error('至少选择一条审计规则后才能开始页面审计。')
      }
      const enabledCategories = categoriesForRules(enabledRuleCodes)
      if (auditRunning) throw new Error('页面审计正在进行，请稍候。')
      auditRunning = true
      overlay.patch({
        behavior: 'thinking',
        speech: `我正在执行你选择的 ${enabledRuleCodes.length} 条页面检查。`,
        busy: true,
      })
      try {
        const report = await runAudit(performanceState, enabledRuleCodes)
        latestReport = report
        currentIssueIndex = 0
        previewIssueId = null
        updateOverlayFromReport(report)
        chrome.runtime.sendMessage({ type: 'NOVA_AUDIT_RESULT', report } satisfies NovaRuntimeMessage).catch(() => undefined)
        return report
      }
      catch (error) {
        overlay.patch({
          behavior: 'confused',
          speech: error instanceof Error ? error.message : '页面审计失败，请刷新后重试。',
          busy: false,
        })
        throw error
      }
      finally {
        auditRunning = false
      }
    }

    function updateOverlayFromReport(report: AuditReport) {
      const currentIssue = report.issues[currentIssueIndex]
      const behavior = report.score >= 92
        ? 'happy'
        : report.summary.high > 0
          ? 'confused'
          : report.score < 75
            ? 'resting'
            : 'listening'
      const speech = report.summary.total === 0
        ? '页面状态很好，没有发现需要立即处理的问题。'
        : report.summary.high > 0
          ? `我发现 ${report.summary.high} 个高优先级问题，点击我可以逐个处理。`
          : `页面健康度 ${report.score}，我找到了 ${report.summary.total} 个改进机会。`

      overlay.patch({
        behavior,
        speech,
        score: report.score,
        issueCount: report.summary.total,
        currentIssueIndex,
        currentIssueTitle: currentIssue?.title || '',
        previewActive: false,
        busy: false,
      })
    }

    function getCurrentIssue() {
      return latestReport?.issues[currentIssueIndex] || null
    }

    function selectIssue(direction: number) {
      if (!latestReport?.issues.length) {
        overlay.patch({ behavior: 'confused', speech: '先摸摸我并开始一次页面审计吧。' })
        return
      }
      currentIssueIndex = (currentIssueIndex + direction + latestReport.issues.length) % latestReport.issues.length
      const issue = latestReport.issues[currentIssueIndex]!
      const element = findIssueElement(issue)
      if (element) highlight.show(element, issue.title)
      overlay.patch({
        behavior: 'listening',
        speech: `这是第 ${currentIssueIndex + 1} 个问题：${issue.title}`,
        currentIssueIndex,
        currentIssueTitle: issue.title,
        previewActive: previewIssueId === issue.id,
      })
    }

    function previewCurrentIssue() {
      const issue = getCurrentIssue()
      if (!issue) {
        overlay.patch({ behavior: 'confused', speech: '当前没有可以预览的问题。' })
        return
      }
      rollbackPreview(previews)
      const result = applyPreview(issue, previews)
      if (!result.ok) {
        overlay.patch({ behavior: 'confused', speech: result.error || '无法预览这个修改。' })
        return
      }
      previewIssueId = issue.id
      const element = findIssueElement(issue)
      if (element) highlight.show(element, `${issue.title} · 已预览`)
      overlay.patch({
        behavior: 'happy',
        speech: '临时修改已经应用。刷新页面前都可以随时撤销。',
        previewActive: true,
      })
    }

    function rollbackCurrentPreview() {
      const rolledBack = rollbackPreview(previews)
      previewIssueId = null
      overlay.patch({
        behavior: 'greeting',
        speech: rolledBack ? '临时预览已经撤销，页面恢复原状。' : '当前没有需要撤销的临时预览。',
        previewActive: false,
      })
    }

    chrome.runtime.onMessage.addListener((message: NovaRuntimeMessage, _sender, sendResponse) => {
      if (message.type === 'NOVA_RUN_AUDIT') {
        runAuditAndPublish(message.enabledCategories, message.enabledRuleCodes)
          .then(report => sendResponse({ ok: true, report }))
          .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        return true
      }

      if (message.type === 'NOVA_HIGHLIGHT_ISSUE') {
        const element = findIssueElement(message.issue)
        if (element) highlight.show(element, message.issue.title)
        if (latestReport) {
          const index = latestReport.issues.findIndex(issue => issue.id === message.issue.id)
          if (index >= 0) currentIssueIndex = index
        }
        overlay.patch({
          behavior: 'listening',
          speech: `我已经定位到：${message.issue.title}`,
          currentIssueIndex,
          currentIssueTitle: message.issue.title,
          previewActive: previewIssueId === message.issue.id,
        })
        sendResponse({ ok: Boolean(element) })
        return false
      }

      if (message.type === 'NOVA_CLEAR_HIGHLIGHT') {
        highlight.hide()
        sendResponse({ ok: true })
        return false
      }

      if (message.type === 'NOVA_APPLY_PREVIEW') {
        rollbackPreview(previews)
        const result = applyPreview(message.issue, previews)
        if (result.ok) previewIssueId = message.issue.id
        overlay.patch({
          behavior: result.ok ? 'happy' : 'confused',
          speech: result.ok ? '临时修改已经应用。' : result.error || '无法预览这个修改。',
          previewActive: result.ok,
        })
        sendResponse(result)
        return false
      }

      if (message.type === 'NOVA_ROLLBACK_PREVIEW') {
        const rolledBack = rollbackPreview(previews, message.issueId)
        if (!message.issueId || previewIssueId === message.issueId || rolledBack) previewIssueId = null
        overlay.patch({ behavior: 'greeting', speech: rolledBack ? '临时预览已经撤销。' : '当前没有需要撤销的临时预览。', previewActive: false })
        sendResponse({ ok: true, rolledBack })
        return false
      }

      if (message.type === 'NOVA_UPDATE_PET_STATE') {
        overlay.patch(message.state)
        sendResponse({ ok: true })
        return false
      }

      if (message.type === 'NOVA_GET_PAGE_CONTEXT') {
        sendResponse({ ok: true, url: location.href, title: document.title })
        return false
      }

      return false
    })
  },
})

function getDelegatedActionSpeech(action: NovaPetAction) {
  const messages: Partial<Record<NovaPetAction, string>> = {
    'open-report': '我把详细报告打开给你。',
    'network-lab': '正在打开网络实验室，你可以一键开启拦截与 Mock。',
    'connect-agent': '正在打开本地 Agent 连接设置。',
    'generate-patch': '我会去项目源码里定位当前问题并生成补丁。',
    'apply-patch': '正在准备确认写入当前补丁。',
    'run-checks': '我会运行类型检查、测试和生产构建。',
    'rollback-patch': '正在准备回滚最近一次源码修改。',
  }
  return messages[action] || '正在处理你的指令。'
}

// 浏览器性能观察器只写入聚合状态，不在回调中执行重型审计。 / Performance observers only update aggregate state and avoid heavy audit work in callbacks.
function setupPerformanceObservers(state: PerformanceState) {
  if (!('PerformanceObserver' in window)) return

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries.at(-1)
      if (last) state.lcp = Math.round(last.startTime)
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  }
  catch {
    // 当前浏览器或执行上下文不支持该指标。 / This metric is unsupported in the current browser or execution context.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
        if (!layoutShift.hadRecentInput && typeof layoutShift.value === 'number') state.cls += layoutShift.value
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
  }
  catch {
    // 当前浏览器或执行上下文不支持该指标。 / This metric is unsupported in the current browser or execution context.
  }

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      state.longTaskDuration += list.getEntries().reduce((sum, entry) => sum + entry.duration, 0)
    })
    longTaskObserver.observe({ type: 'longtask', buffered: true })
  }
  catch {
    // 当前浏览器或执行上下文不支持该指标。 / This metric is unsupported in the current browser or execution context.
  }
}

const MAX_AUDIT_ELEMENTS_PER_RULE = 160

function yieldToMain() {
  return new Promise<void>((resolve) => {
    if (document.visibilityState === 'visible') window.requestAnimationFrame(() => resolve())
    else window.setTimeout(resolve, 0)
  })
}

// 审计流水线：DOM 规则与性能规则合并后统一评分和排序。 / Audit pipeline: merge DOM and performance findings before scoring and ordering.
async function runAudit(performanceState: PerformanceState, enabledRuleCodes: AuditIssueCode[]): Promise<AuditReport> {
  if (document.readyState === 'loading') {
    await new Promise<void>(resolve => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }))
  }

  const enabled = new Set(enabledRuleCodes)
  const issues: AuditIssue[] = []
  auditImages(issues, enabled)
  await yieldToMain()
  auditFormControls(issues, enabled)
  await yieldToMain()
  auditInteractiveNames(issues, enabled)
  await yieldToMain()
  auditDocumentStructure(issues, enabled)
  await yieldToMain()
  auditBestPractices(issues, enabled)
  await yieldToMain()
  const metrics = collectMetrics(performanceState)
  auditPerformance(issues, metrics, enabled)
  const enabledCategories = categoriesForRules(enabledRuleCodes)

  const report: AuditReport = {
    id: crypto.randomUUID(),
    url: location.href,
    title: document.title || location.hostname,
    createdAt: new Date().toISOString(),
    enabledCategories: [...enabledCategories],
    enabledRuleCodes: [...enabledRuleCodes],
    score: calculateAuditScore(issues),
    summary: createAuditSummary(issues),
    metrics,
    issues,
  }

  return report
}

function auditImages(issues: AuditIssue[], enabled: ReadonlySet<AuditIssueCode>) {
  for (const image of [...document.images].slice(0, MAX_AUDIT_ELEMENTS_PER_RULE)) {
    if (image.closest('[data-nova-extension-root]')) continue
    const selector = buildSelector(image)
    const src = image.currentSrc || image.src || image.getAttribute('src') || ''
    const baseEvidence = {
      src,
      id: image.id || '',
      naturalWidth: image.naturalWidth || 0,
      naturalHeight: image.naturalHeight || 0,
      altSuggestion: inferAltText(src),
    }

    if (enabled.has('image-alt-missing') && !image.hasAttribute('alt')) {
      issues.push(createIssue({
        code: 'image-alt-missing',
        category: 'accessibility',
        severity: 'medium',
        title: '图片缺少替代文本',
        description: '屏幕阅读器无法理解这张图片的用途。装饰图片应使用空 alt，内容图片应提供准确描述。',
        element: image,
        selector,
        evidence: baseEvidence,
        preview: { kind: 'attributes', attributes: { alt: inferAltText(src) || '图片' } },
        searchTerms: [src, image.id],
      }))
    }

    if (enabled.has('image-dimensions-missing') && image.naturalWidth > 0 && image.naturalHeight > 0 && !image.hasAttribute('width') && !image.hasAttribute('height')) {
      issues.push(createIssue({
        code: 'image-dimensions-missing',
        category: 'performance',
        severity: 'medium',
        title: '图片没有声明固有尺寸',
        description: '缺少 width/height 可能导致图片加载后推动页面内容，引发累计布局偏移。',
        element: image,
        selector,
        evidence: baseEvidence,
        preview: {
          kind: 'attributes',
          attributes: { width: String(image.naturalWidth), height: String(image.naturalHeight) },
        },
        searchTerms: [src, image.id],
      }))
    }

    const rect = image.getBoundingClientRect()
    if (enabled.has('image-lazy-missing') && rect.top > window.innerHeight * 1.25 && image.loading !== 'lazy') {
      issues.push(createIssue({
        code: 'image-lazy-missing',
        category: 'performance',
        severity: 'low',
        title: '首屏以下图片未延迟加载',
        description: '这张图片距离首屏较远，可以延迟下载以减少初始网络和解码开销。',
        element: image,
        selector,
        evidence: { ...baseEvidence, viewportTop: Math.round(rect.top) },
        preview: { kind: 'attributes', attributes: { loading: 'lazy', decoding: 'async' } },
        searchTerms: [src, image.id],
      }))
    }
  }
}

function auditFormControls(issues: AuditIssue[], enabled: ReadonlySet<AuditIssueCode>) {
  if (!enabled.has('form-label-missing')) return
  const controls = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
  for (const control of [...controls].slice(0, MAX_AUDIT_ELEMENTS_PER_RULE)) {
    if (control instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'image', 'reset'].includes(control.type)) continue
    if (!isElementVisible(control) || hasAccessibleName(control)) continue

    const placeholder = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
      ? control.placeholder
      : ''
    const label = placeholder || humanize(control.name || control.id) || '输入字段'
    issues.push(createIssue({
      code: 'form-label-missing',
      category: 'accessibility',
      severity: 'high',
      title: '表单控件缺少可访问名称',
      description: '该字段没有关联 label、aria-label 或 aria-labelledby，辅助技术无法说明它的用途。',
      element: control,
      selector: buildSelector(control),
      evidence: {
        id: control.id,
        name: control.name,
        placeholder,
        type: control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase(),
      },
      preview: { kind: 'attributes', attributes: { 'aria-label': label } },
      searchTerms: [control.id, control.name, placeholder],
    }))
  }
}

function auditInteractiveNames(issues: AuditIssue[], enabled: ReadonlySet<AuditIssueCode>) {
  if (enabled.has('button-name-missing')) {
    const buttons = document.querySelectorAll<HTMLElement>('button, [role="button"]')
    for (const button of [...buttons].slice(0, MAX_AUDIT_ELEMENTS_PER_RULE)) {
      if (!isElementVisible(button) || hasAccessibleName(button)) continue
      issues.push(createIssue({
      code: 'button-name-missing',
      category: 'accessibility',
      severity: 'high',
      title: '按钮没有可访问名称',
      description: '图标按钮需要 aria-label、可见文字或 aria-labelledby，才能让键盘和屏幕阅读器用户理解操作。',
      element: button,
      selector: buildSelector(button),
      evidence: { id: button.id, text: button.textContent?.trim() || '' },
      preview: { kind: 'attributes', attributes: { 'aria-label': humanize(button.id) || '操作按钮' } },
      searchTerms: [button.id, button.className, button.textContent || ''],
      }))
    }
  }

  if (enabled.has('link-name-missing')) {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href]')
    for (const link of [...links].slice(0, MAX_AUDIT_ELEMENTS_PER_RULE)) {
      if (!isElementVisible(link) || hasAccessibleName(link)) continue
      issues.push(createIssue({
      code: 'link-name-missing',
      category: 'accessibility',
      severity: 'high',
      title: '链接没有可访问名称',
      description: '链接需要可见文本或 aria-label，避免辅助技术只读出地址。',
      element: link,
      selector: buildSelector(link),
      evidence: { id: link.id, href: link.href, text: link.textContent?.trim() || '' },
      preview: { kind: 'attributes', attributes: { 'aria-label': humanize(link.id) || '链接' } },
      searchTerms: [link.id, link.getAttribute('href') || ''],
      }))
    }
  }
}

function auditDocumentStructure(issues: AuditIssue[], enabled: ReadonlySet<AuditIssueCode>) {
  if (enabled.has('document-title-missing') && !document.title.trim()) {
    issues.push(createSimpleIssue('document-title-missing', 'seo', 'high', '页面缺少标题', '浏览器标签、搜索结果和辅助技术都需要明确的 document title。'))
  }

  if (enabled.has('meta-description-missing') && !document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()) {
    issues.push(createSimpleIssue('meta-description-missing', 'seo', 'low', '页面缺少 Meta Description', '为页面提供简短、具体的说明，有利于分享和搜索结果展示。'))
  }

  if (enabled.has('duplicate-id')) {
    const idMap = new Map<string, Element[]>()
    for (const element of document.querySelectorAll<HTMLElement>('[id]')) {
      if (!element.id || element.closest('[data-nova-extension-root]')) continue
      const list = idMap.get(element.id) || []
      list.push(element)
      idMap.set(element.id, list)
    }
    for (const [id, elements] of idMap) {
      if (elements.length < 2) continue
      const element = elements[1]
      if (!element) continue
      issues.push(createIssue({
        code: 'duplicate-id',
        category: 'dom',
        severity: 'high',
        title: `重复的 id：${id}`,
        description: '同一页面中的 id 必须唯一，否则标签关联、CSS 选择器和脚本查询可能指向错误元素。',
        element,
        selector: buildSelector(element),
        evidence: { id, count: elements.length },
        searchTerms: [id],
      }))
    }
  }

  if (enabled.has('heading-order')) {
    const headings = [...document.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')]
    let previousLevel = 0
    for (const heading of headings) {
      const level = Number.parseInt(heading.tagName.slice(1), 10)
      if (previousLevel > 0 && level > previousLevel + 1) {
        issues.push(createIssue({
          code: 'heading-order',
          category: 'accessibility',
          severity: 'low',
          title: '标题层级发生跳跃',
          description: `标题从 H${previousLevel} 直接跳到了 H${level}，可能让文档结构难以理解。`,
          element: heading,
          selector: buildSelector(heading),
          evidence: { previousLevel, level, text: heading.textContent?.trim() || '' },
          searchTerms: [heading.textContent || ''],
        }))
      }
      previousLevel = level
    }
  }

  const domNodes = enabled.has('dom-size-large') ? document.getElementsByTagName('*').length : 0
  if (enabled.has('dom-size-large') && domNodes > 1500) {
    issues.push(createSimpleIssue('dom-size-large', 'dom', domNodes > 3000 ? 'high' : 'medium', 'DOM 规模偏大', `当前页面约有 ${domNodes} 个元素。大量节点会增加样式计算、布局和内存成本。`, { domNodes }))
  }
}

function auditBestPractices(issues: AuditIssue[], enabled: ReadonlySet<AuditIssueCode>) {
  if (enabled.has('viewport-meta-missing') && !document.querySelector('meta[name="viewport"]')) {
    issues.push(createSimpleIssue(
      'viewport-meta-missing',
      'best-practice',
      'medium',
      '页面缺少 Viewport 配置',
      '缺少 viewport 元信息可能导致移动设备使用桌面宽度渲染，影响响应式布局和可读性。',
    ))
  }

  if (!enabled.has('mixed-content-resource') || location.protocol !== 'https:') return
  const mixedResource = [...document.querySelectorAll<HTMLElement>('[src], link[href]')]
    .map(element => element.getAttribute('src') || element.getAttribute('href') || '')
    .find(url => /^http:\/\//i.test(url))
  if (mixedResource) {
    issues.push(createSimpleIssue(
      'mixed-content-resource',
      'best-practice',
      'high',
      'HTTPS 页面引用了不安全资源',
      '页面通过 HTTP 加载资源，浏览器可能阻止请求，并削弱页面传输安全性。',
      { src: mixedResource },
    ))
  }
}

async function resolveEnabledAuditCategories(requested?: AuditCategory[]): Promise<AuditCategory[]> {
  const valid = new Set<AuditCategory>(AUDIT_CATEGORIES)
  const normalize = (categories: unknown) => Array.isArray(categories)
    ? categories.filter((category): category is AuditCategory => typeof category === 'string' && valid.has(category as AuditCategory))
    : []
  if (requested !== undefined) return [...new Set(normalize(requested))]
  const stored = await chrome.storage.local.get('nova:audit:enabled-categories')
  if (Array.isArray(stored['nova:audit:enabled-categories'])) {
    return [...new Set(normalize(stored['nova:audit:enabled-categories']))]
  }
  return [...AUDIT_CATEGORIES]
}

async function resolveEnabledAuditRules(requested?: AuditIssueCode[], requestedCategories?: AuditCategory[]): Promise<AuditIssueCode[]> {
  const valid = new Set<AuditIssueCode>(AUDIT_RULE_CODES)
  const normalize = (codes: unknown) => Array.isArray(codes)
    ? codes.filter((code): code is AuditIssueCode => typeof code === 'string' && valid.has(code as AuditIssueCode))
    : []
  if (requested !== undefined) return [...new Set(normalize(requested))]

  const stored = await chrome.storage.local.get('nova:audit:enabled-rule-codes')
  if (Array.isArray(stored['nova:audit:enabled-rule-codes'])) {
    return [...new Set(normalize(stored['nova:audit:enabled-rule-codes']))]
  }

  const categories = await resolveEnabledAuditCategories(requestedCategories)
  const categorySet = new Set(categories)
  return AUDIT_RULES.filter(rule => categorySet.has(rule.category)).map(rule => rule.code)
}

function categoriesForRules(ruleCodes: readonly AuditIssueCode[]): AuditCategory[] {
  const enabled = new Set(ruleCodes)
  return AUDIT_CATEGORIES.filter(category => AUDIT_RULES.some(rule => rule.category === category && enabled.has(rule.code)))
}

function collectMetrics(state: PerformanceState): PageMetrics {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return {
    domNodes: document.getElementsByTagName('*').length,
    images: document.images.length,
    resources: resources.length,
    transferredBytes: Math.round(resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0)),
    navigationDuration: navigation ? Math.round(navigation.duration) : null,
    domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
    loadEvent: navigation ? Math.round(navigation.loadEventEnd) : null,
    largestContentfulPaint: state.lcp,
    cumulativeLayoutShift: Number(state.cls.toFixed(3)),
    longTaskDuration: Math.round(state.longTaskDuration),
  }
}

function auditPerformance(issues: AuditIssue[], metrics: PageMetrics, enabled: ReadonlySet<AuditIssueCode>) {
  if (enabled.has('slow-navigation') && metrics.navigationDuration && metrics.navigationDuration > 3000) {
    issues.push(createSimpleIssue('slow-navigation', 'performance', metrics.navigationDuration > 5000 ? 'high' : 'medium', '页面完整加载时间偏长', `Navigation Timing 记录的加载耗时约为 ${metrics.navigationDuration}ms。`, { duration: metrics.navigationDuration }))
  }

  if (enabled.has('long-task') && metrics.longTaskDuration > 200) {
    issues.push(createSimpleIssue('long-task', 'performance', metrics.longTaskDuration > 1000 ? 'high' : 'medium', '主线程存在长任务', `已观测到约 ${metrics.longTaskDuration}ms 的长任务时间，可能导致输入响应迟缓。`, { duration: metrics.longTaskDuration }))
  }

  if (!enabled.has('large-resource')) return
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  for (const resource of resources
    .filter(item => item.transferSize > 500_000)
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 8)) {
    issues.push(createSimpleIssue('large-resource', 'performance', resource.transferSize > 1_500_000 ? 'high' : 'medium', '发现大型网络资源', `${shortUrl(resource.name)} 传输了约 ${formatBytes(resource.transferSize)}。`, {
      src: resource.name,
      transferSize: resource.transferSize,
      initiatorType: resource.initiatorType,
    }))
  }
}

function createIssue(input: {
  code: AuditIssueCode
  category: AuditIssue['category']
  severity: AuditSeverity
  title: string
  description: string
  selector?: string
  element?: Element
  evidence?: AuditIssue['evidence']
  preview?: AuditIssue['preview']
  searchTerms?: Array<string | null | undefined>
}): AuditIssue {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    category: input.category,
    severity: input.severity,
    title: input.title,
    description: input.description,
    selector: input.selector,
    element: input.element
      ? {
          tagName: input.element.tagName.toLowerCase(),
          text: input.element.textContent?.trim().slice(0, 120),
          html: input.element.outerHTML.slice(0, 400),
        }
      : undefined,
    evidence: input.evidence || {},
    preview: input.preview,
    sourceHint: {
      searchTerms: (input.searchTerms || []).filter((term): term is string => Boolean(term?.trim())).map(term => term.trim()).slice(0, 12),
      preferredExtensions: ['.vue', '.tsx', '.jsx', '.html', '.svelte', '.astro'],
    },
  }
}

function createSimpleIssue(
  code: AuditIssueCode,
  category: AuditIssue['category'],
  severity: AuditSeverity,
  title: string,
  description: string,
  evidence: AuditIssue['evidence'] = {},
): AuditIssue {
  return createIssue({ code, category, severity, title, description, evidence })
}

function buildSelector(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`

  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== document.body && parts.length < 4) {
    let part = current.tagName.toLowerCase()
    const stableClass = [...current.classList].find(name => !/^(active|open|selected|hover|focus|css-|sc-)/.test(name))
    if (stableClass) part += `.${CSS.escape(stableClass)}`

    const parent: Element | null = current.parentElement
    if (parent) {
      const sameTag = [...parent.children].filter(child => child.tagName === current?.tagName)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
    }
    parts.unshift(part)
    current = parent
  }
  return parts.join(' > ')
}

function hasAccessibleName(element: HTMLElement): boolean {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ')
    if (text) return true
  }
  if (element.getAttribute('aria-label')?.trim()) return true
  if (element.getAttribute('title')?.trim()) return true
  if (element.textContent?.trim()) return true
  if (element instanceof HTMLInputElement && element.labels && [...element.labels].some(label => label.textContent?.trim())) return true
  if (element instanceof HTMLSelectElement && element.labels && [...element.labels].some(label => label.textContent?.trim())) return true
  if (element instanceof HTMLTextAreaElement && element.labels && [...element.labels].some(label => label.textContent?.trim())) return true
  if (element.querySelector('img[alt]:not([alt=""])')) return true
  return false
}

function isElementVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

function findIssueElement(issue: AuditIssue): HTMLElement | null {
  if (!issue.selector) return null
  try {
    return document.querySelector<HTMLElement>(issue.selector)
  }
  catch {
    return null
  }
}

// 临时预览必须先保存原始属性和样式，确保可逆且不写入源码。 / Temporary previews snapshot original attributes and styles so changes stay reversible and source-free.
function applyPreview(issue: AuditIssue, previews: Map<string, PreviewSnapshot>): { ok: boolean; error?: string } {
  if (!issue.preview) return { ok: false, error: '该问题没有可预览的修改' }
  const element = findIssueElement(issue)
  if (!element) return { ok: false, error: '无法重新定位页面元素' }

  rollbackPreview(previews, issue.id)
  const snapshot: PreviewSnapshot = { element, attributes: new Map(), styles: new Map() }

  if (issue.preview.kind === 'attributes') {
    for (const [name, value] of Object.entries(issue.preview.attributes)) {
      snapshot.attributes.set(name, element.getAttribute(name))
      element.setAttribute(name, value)
    }
  }
  else {
    for (const [name, value] of Object.entries(issue.preview.styles)) {
      snapshot.styles.set(name, element.style.getPropertyValue(name))
      element.style.setProperty(name, value, 'important')
    }
  }

  element.dataset.novaPreview = issue.id
  previews.set(issue.id, snapshot)
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return { ok: true }
}

function rollbackPreview(previews: Map<string, PreviewSnapshot>, issueId?: string) {
  const targets = issueId && previews.has(issueId)
    ? [[issueId, previews.get(issueId)] as const]
    : [...previews.entries()]
  let rolledBack = false
  for (const [id, snapshot] of targets) {
    if (!snapshot) continue
    for (const [name, value] of snapshot.attributes) {
      if (value === null) snapshot.element.removeAttribute(name)
      else snapshot.element.setAttribute(name, value)
    }
    for (const [name, value] of snapshot.styles) {
      if (value) snapshot.element.style.setProperty(name, value)
      else snapshot.element.style.removeProperty(name)
    }
    delete snapshot.element.dataset.novaPreview
    previews.delete(id)
    rolledBack = true
  }
  return rolledBack
}

// 高亮层独立于目标 DOM，避免改变页面布局或覆盖可点击内容。 / The highlight layer is independent of target DOM to avoid layout shifts or blocked controls.
function createHighlightLayer() {
  const host = document.createElement('div')
  host.dataset.novaExtensionRoot = 'highlight'
  host.hidden = true

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    :host {
      all: initial !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      contain: layout style !important;
    }
    :host([hidden]) { display: none !important; }
    .outline {
      position: absolute;
      border: 2px solid #7066ff;
      border-radius: 8px;
      background: transparent;
      box-shadow: 0 0 0 4px rgba(112,102,255,.18), 0 12px 40px rgba(0,0,0,.25);
      transition: left 140ms ease, top 140ms ease, width 140ms ease, height 140ms ease;
    }
    .label {
      position: absolute;
      max-width: min(320px, calc(100vw - 16px));
      padding: 7px 10px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      color: #fff;
      background: rgba(72,61,205,.96);
      box-shadow: 0 10px 28px rgba(0,0,0,.3);
      font: 600 12px/1.4 ui-sans-serif, system-ui, sans-serif;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      backdrop-filter: blur(10px);
    }
  `

  const outline = document.createElement('div')
  outline.className = 'outline'
  const label = document.createElement('div')
  label.className = 'label'
  shadow.append(style, outline, label)

  let target: HTMLElement | null = null
  const resizeObserver = new ResizeObserver(() => update())

  const update = () => {
    if (!target || !document.contains(target)) {
      host.hidden = true
      return
    }

    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      host.hidden = true
      return
    }

    host.hidden = false
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    const margin = 8
    const gap = 10
    const left = Math.max(margin, rect.left - 4)
    const top = Math.max(margin, rect.top - 4)
    const right = Math.min(viewportWidth - margin, rect.right + 4)
    const bottom = Math.min(viewportHeight - margin, rect.bottom + 4)

    Object.assign(outline.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(0, right - left)}px`,
      height: `${Math.max(0, bottom - top)}px`,
    })

    label.style.visibility = 'hidden'
    label.style.left = `${margin}px`
    label.style.top = `${margin}px`
    const labelRect = label.getBoundingClientRect()
    const labelWidth = Math.min(labelRect.width, viewportWidth - margin * 2)
    const labelHeight = labelRect.height
    const aboveTop = top - labelHeight - gap
    const belowTop = bottom + gap
    const rightLeft = right + gap
    const leftLeft = left - labelWidth - gap

    let labelLeft = clamp(left, margin, viewportWidth - labelWidth - margin)
    let labelTop = aboveTop

    if (aboveTop >= margin) {
      labelTop = aboveTop
    }
    else if (belowTop + labelHeight <= viewportHeight - margin) {
      labelTop = belowTop
    }
    else if (rightLeft + labelWidth <= viewportWidth - margin) {
      labelLeft = rightLeft
      labelTop = clamp(top, margin, viewportHeight - labelHeight - margin)
    }
    else if (leftLeft >= margin) {
      labelLeft = leftLeft
      labelTop = clamp(top, margin, viewportHeight - labelHeight - margin)
    }
    else {
      const topSpace = Math.max(0, top - margin)
      const bottomSpace = Math.max(0, viewportHeight - bottom - margin)
      labelTop = topSpace >= bottomSpace
        ? margin
        : Math.max(margin, viewportHeight - labelHeight - margin)
    }

    Object.assign(label.style, {
      left: `${labelLeft}px`,
      top: `${labelTop}px`,
      visibility: 'visible',
    })
  }

  const viewport = window.visualViewport
  let highlightTracking = false
  const startHighlightTracking = () => {
    if (highlightTracking) return
    highlightTracking = true
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
  }
  const stopHighlightTracking = () => {
    if (!highlightTracking) return
    highlightTracking = false
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
    viewport?.removeEventListener('resize', update)
    viewport?.removeEventListener('scroll', update)
  }

  mountWhenReady(host)
  return {
    show(element: HTMLElement, title: string) {
      startHighlightTracking()
      if (target !== element) {
        resizeObserver.disconnect()
        resizeObserver.observe(element)
      }
      target = element
      label.textContent = `NOVA · ${title}`
      host.hidden = false
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      requestAnimationFrame(update)
      window.setTimeout(update, 220)
    },
    hide() {
      resizeObserver.disconnect()
      stopHighlightTracking()
      target = null
      host.hidden = true
    },
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

// Shadow DOM 隔离页面样式，并暴露最小的状态更新接口。 / Shadow DOM isolates page styles and exposes only a minimal state-update surface.
function createNovaOverlay(onAction: (action: NovaPetAction) => void | Promise<void>) {
  const host = document.createElement('div')
  host.dataset.novaExtensionRoot = 'overlay'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = overlayStyles
  const mountPoint = document.createElement('div')
  const fallback = document.createElement('button')
  fallback.type = 'button'
  fallback.className = 'nova-pet-loader'
  fallback.textContent = 'N'
  fallback.title = 'NOVA 正在进入网页'
  shadow.append(style, mountPoint, fallback)
  mountWhenReady(host)

  const pendingState: NovaPetVisualState = {
    behavior: 'idle',
    speech: '摸摸我可以打开所有网页审计和工程功能。',
    score: 0,
    issueCount: 0,
    currentIssueIndex: 0,
    currentIssueTitle: '',
    previewActive: false,
    busy: false,
    agentConnected: false,
  }
  let liveState: NovaPetVisualState | null = null

  const mountApp = async () => {
    try {
      const [{ createApp, reactive }, { default: NovaPetOverlay }] = await Promise.all([
        import('vue'),
        import('./content/NovaPetOverlay.vue'),
      ])
      liveState = reactive({ ...pendingState })
      fallback.remove()
      createApp(NovaPetOverlay, {
        state: liveState,
        onAction,
      }).mount(mountPoint)
    }
    catch (error) {
      fallback.title = `NOVA 3D 模型加载失败：${error instanceof Error ? error.message : String(error)}`
      fallback.addEventListener('click', () => onAction('open-report'))
    }
  }

  window.requestIdleCallback(() => {
    mountApp().catch(() => undefined)
  }, { timeout: 1200 })

  return {
    host,
    patch(next: Partial<NovaPetVisualState>) {
      Object.assign(pendingState, next)
      if (liveState) Object.assign(liveState, next)
    },
  }
}

function mountWhenReady(element: HTMLElement) {
  const mount = () => {
    if (!document.documentElement.contains(element)) (document.body || document.documentElement).append(element)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount, { once: true })
}

function inferAltText(src: string): string {
  const filename = src.split('?')[0]?.split('/').at(-1)?.replace(/\.[a-z0-9]+$/i, '') || ''
  return humanize(filename)
}

function humanize(input: string): string {
  return input.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()).trim()
}

function shortUrl(input: string): string {
  try {
    const url = new URL(input)
    return `${url.hostname}${url.pathname}`.slice(0, 90)
  }
  catch {
    return input.slice(0, 90)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
