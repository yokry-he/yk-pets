/**
 * 文件职责 / File responsibility
 * 在用户主动请求时重新定位网页摘录，使用有界文本扫描、精确选区和短时覆盖层高亮结果。
 * Relocates saved page excerpts on explicit user requests using bounded text scanning, an exact selection, and a short-lived highlight overlay.
 */
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import type { PetMemoryRelocateInput } from '@nova/shared/pet-memory'

const MAX_TEXT_SCAN_NODES = 20_000
const MAX_TEXT_SCAN_CHARACTERS = 2_000_000
const MAX_MATCHES = 50
const MAX_HIGHLIGHT_RECTS = 12
const HIGHLIGHT_DURATION_MS = 12_000

interface TextSegment {
  node: Text
  start: number
  end: number
}

interface LocatedSelection {
  range: Range
  matchCount: number
  usedSelector: boolean
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    const highlight = createMemoryRangeHighlightLayer()

    const onMessage = (message: NovaRuntimeMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
      if (message.type !== 'YK_PET_MEMORY_HIGHLIGHT') return false
      const located = locateMemorySelection(message.input)
      if (!located) {
        highlight.hide()
        sendResponse({
          ok: false,
          error: '页面内容可能已经变化，未找到完全匹配且可见的摘录。',
        })
        return false
      }

      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(located.range)
      const target = rangeCommonElement(located.range)
      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      })
      highlight.show(
        located.range,
        located.matchCount > 1 ? `找到摘录 · 共 ${located.matchCount} 处匹配` : '找到宠物记忆摘录',
      )
      sendResponse({
        ok: true,
        matchCount: located.matchCount,
        usedSelector: located.usedSelector,
      })
      return false
    }

    chrome.runtime.onMessage.addListener(onMessage)
    window.addEventListener('pagehide', () => {
      highlight.hide()
      chrome.runtime.onMessage.removeListener(onMessage)
    }, { once: true })
  },
})

function locateMemorySelection(input: PetMemoryRelocateInput): LocatedSelection | null {
  const query = normalizeWhitespace(input.selection).slice(0, 4_000)
  if (!query) return null

  const selectorRoot = resolveSelectorRoot(input.selector)
  if (selectorRoot) {
    const scoped = findVisibleTextRange(selectorRoot, query)
    if (scoped) return { ...scoped, usedSelector: true }
  }

  const root = document.body || document.documentElement
  const documentMatch = findVisibleTextRange(root, query)
  return documentMatch ? { ...documentMatch, usedSelector: false } : null
}

function resolveSelectorRoot(selector?: string) {
  if (!selector) return null
  try {
    return document.querySelector(selector)
  }
  catch {
    return null
  }
}

function findVisibleTextRange(root: Node, query: string): Omit<LocatedSelection, 'usedSelector'> | null {
  const collected = collectText(root)
  if (!collected.text) return null
  const normalized = normalizeTextWithOffsets(collected.text)
  const indices = findMatchIndices(normalized.text, query)
  if (!indices.length) return null

  let fallback: Range | null = null
  for (const index of indices) {
    const startOffset = normalized.offsets[index]
    const endOffset = normalized.offsets[index + query.length - 1]
    if (startOffset === undefined || endOffset === undefined) continue
    const range = createRangeFromOffsets(collected.segments, startOffset, endOffset + 1)
    if (!range) continue
    fallback ||= range
    if (rangeHasVisibleRect(range)) {
      return { range, matchCount: indices.length }
    }
  }

  return fallback && rangeHasVisibleRect(fallback)
    ? { range: fallback, matchCount: indices.length }
    : null
}

function collectText(root: Node) {
  const segments: TextSegment[] = []
  const chunks: string[] = []
  let length = 0
  let scannedNodes = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (scannedNodes >= MAX_TEXT_SCAN_NODES || length >= MAX_TEXT_SCAN_CHARACTERS) return NodeFilter.FILTER_REJECT
      const text = node.nodeValue || ''
      const parent = node.parentElement
      if (!text.trim() || !parent || parent.closest('script,style,noscript,template,[data-nova-extension-root]')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.nodeValue || ''
    scannedNodes += 1
    if (length && length < MAX_TEXT_SCAN_CHARACTERS) {
      chunks.push(' ')
      length += 1
    }
    const available = Math.max(0, MAX_TEXT_SCAN_CHARACTERS - length)
    const slice = text.slice(0, available)
    if (!slice) break
    const start = length
    chunks.push(slice)
    length += slice.length
    segments.push({ node, start, end: length })
    if (scannedNodes >= MAX_TEXT_SCAN_NODES || length >= MAX_TEXT_SCAN_CHARACTERS) break
  }

  return { text: chunks.join(''), segments }
}

function normalizeTextWithOffsets(value: string) {
  let text = ''
  const offsets: number[] = []
  let pendingSpaceOffset: number | null = null

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!
    if (/\s/u.test(character)) {
      if (text && pendingSpaceOffset === null) pendingSpaceOffset = index
      continue
    }
    if (pendingSpaceOffset !== null) {
      text += ' '
      offsets.push(pendingSpaceOffset)
      pendingSpaceOffset = null
    }
    text += character
    offsets.push(index)
  }

  return { text, offsets }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

function findMatchIndices(text: string, query: string) {
  const indices: number[] = []
  let cursor = 0
  while (indices.length < MAX_MATCHES) {
    const index = text.indexOf(query, cursor)
    if (index < 0) break
    indices.push(index)
    cursor = index + Math.max(1, query.length)
  }
  return indices
}

function createRangeFromOffsets(segments: TextSegment[], start: number, end: number) {
  const startPoint = pointAtOffset(segments, start, 'start')
  const endPoint = pointAtOffset(segments, end, 'end')
  if (!startPoint || !endPoint) return null
  const range = document.createRange()
  try {
    range.setStart(startPoint.node, startPoint.offset)
    range.setEnd(endPoint.node, endPoint.offset)
    return range.collapsed ? null : range
  }
  catch {
    return null
  }
}

function pointAtOffset(segments: TextSegment[], offset: number, bias: 'start' | 'end') {
  if (bias === 'start') {
    for (const segment of segments) {
      if (offset < segment.end) {
        return { node: segment.node, offset: clamp(offset - segment.start, 0, segment.node.length) }
      }
    }
    const last = segments.at(-1)
    return last ? { node: last.node, offset: last.node.length } : null
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!
    if (offset > segment.start) {
      return { node: segment.node, offset: clamp(offset - segment.start, 0, segment.node.length) }
    }
  }
  const first = segments[0]
  return first ? { node: first.node, offset: 0 } : null
}

function rangeHasVisibleRect(range: Range) {
  const viewportWidth = window.visualViewport?.width || window.innerWidth
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  return [...range.getClientRects()].some(rect => (
    rect.width > 0
    && rect.height > 0
    && rect.right > 0
    && rect.bottom > 0
    && rect.left < viewportWidth
    && rect.top < viewportHeight
  )) || [...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)
}

function rangeCommonElement(range: Range) {
  const node = range.commonAncestorContainer
  return node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement
}

function createMemoryRangeHighlightLayer() {
  const host = document.createElement('div')
  host.dataset.novaExtensionRoot = 'memory-highlight'
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `
    :host{all:initial}
    .rect{position:fixed;border:1px solid rgba(82,224,208,.95);border-radius:4px;background:rgba(82,224,208,.22);box-shadow:0 0 0 2px rgba(82,224,208,.08),0 5px 18px rgba(0,0,0,.18)}
    .label{position:fixed;max-width:min(280px,calc(100vw - 16px));padding:7px 9px;border:1px solid rgba(82,224,208,.45);border-radius:8px;color:#f4fffd;background:rgba(10,18,28,.96);box-shadow:0 10px 28px rgba(0,0,0,.3);font:700 11px/1.4 ui-sans-serif,system-ui,sans-serif;overflow-wrap:anywhere}
    @media(prefers-reduced-motion:reduce){.rect,.label{transition:none!important}}
  `
  const rectLayer = document.createElement('div')
  const label = document.createElement('div')
  label.className = 'label'
  shadow.append(style, rectLayer, label)

  let activeRange: Range | null = null
  let hideTimer: number | null = null
  let updateFrame: number | null = null
  let tracking = false
  const viewport = window.visualViewport

  const render = () => {
    updateFrame = null
    rectLayer.replaceChildren()
    if (!activeRange) {
      host.hidden = true
      return
    }
    const rects = [...activeRange.getClientRects()]
      .filter(rect => rect.width > 0 && rect.height > 0)
      .slice(0, MAX_HIGHLIGHT_RECTS)
    if (!rects.length) {
      host.hidden = true
      return
    }
    host.hidden = false
    for (const rect of rects) {
      const marker = document.createElement('div')
      marker.className = 'rect'
      Object.assign(marker.style, {
        left: `${rect.left - 2}px`,
        top: `${rect.top - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`,
      })
      rectLayer.append(marker)
    }
    const first = rects[0]!
    const viewportWidth = viewport?.width || window.innerWidth
    const viewportHeight = viewport?.height || window.innerHeight
    const labelRect = label.getBoundingClientRect()
    const left = clamp(first.left, 8, viewportWidth - Math.min(labelRect.width, viewportWidth - 16) - 8)
    const preferredTop = first.top - labelRect.height - 8
    const top = preferredTop >= 8 ? preferredTop : clamp(first.bottom + 8, 8, viewportHeight - labelRect.height - 8)
    Object.assign(label.style, { left: `${left}px`, top: `${top}px` })
  }

  const scheduleRender = () => {
    if (updateFrame !== null) return
    updateFrame = requestAnimationFrame(render)
  }
  const startTracking = () => {
    if (tracking) return
    tracking = true
    window.addEventListener('scroll', scheduleRender, true)
    window.addEventListener('resize', scheduleRender)
    viewport?.addEventListener('scroll', scheduleRender)
    viewport?.addEventListener('resize', scheduleRender)
  }
  const stopTracking = () => {
    if (!tracking) return
    tracking = false
    window.removeEventListener('scroll', scheduleRender, true)
    window.removeEventListener('resize', scheduleRender)
    viewport?.removeEventListener('scroll', scheduleRender)
    viewport?.removeEventListener('resize', scheduleRender)
  }
  const hide = () => {
    if (hideTimer !== null) window.clearTimeout(hideTimer)
    hideTimer = null
    if (updateFrame !== null) cancelAnimationFrame(updateFrame)
    updateFrame = null
    activeRange = null
    rectLayer.replaceChildren()
    host.hidden = true
    stopTracking()
  }

  mountWhenReady(host)
  return {
    show(range: Range, title: string) {
      hide()
      activeRange = range.cloneRange()
      label.textContent = `YK-PETS · ${title}`
      startTracking()
      scheduleRender()
      hideTimer = window.setTimeout(hide, HIGHLIGHT_DURATION_MS)
    },
    hide,
  }
}

function mountWhenReady(element: HTMLElement) {
  if (document.documentElement) document.documentElement.append(element)
  else document.addEventListener('DOMContentLoaded', () => document.documentElement.append(element), { once: true })
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}
