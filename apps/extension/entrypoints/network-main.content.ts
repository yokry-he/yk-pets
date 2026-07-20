/**
 * 文件职责 / File responsibility
 * 页面主世界 Fetch/XHR 拦截器，执行 Mock、完整 JSON 响应替换、延迟和请求记录。
 * Page-main-world Fetch/XHR interceptor for Mocking, whole-JSON response replacement, delay, and request records.
 */
import {
  DEFAULT_NETWORK_SITE_SETTINGS,
  type NetworkEntry,
  type NetworkMockResponse,
  type NetworkResourceKind,
  type NetworkRule,
  type NetworkSiteSettings,
} from '@nova/shared/network'
import {
  findMatchingRule,
  resolveNetworkUrl,
  resolveResponseBody,
} from '../features/network-lab/domain/network-rule-matcher'
import {
  NOVA_NETWORK_CHANNEL,
  type PageNetworkCommand,
  type PageNetworkEvent,
} from '../features/network-lab/infrastructure/network-page-channel'

// 主世界仅保存当前配置，不直接依赖 Chrome API。 / The main world stores configuration only and never depends on Chrome APIs.
interface MainWorldState {
  settings: NetworkSiteSettings
  rules: NetworkRule[]
}

const MAX_EDITABLE_JSON_BYTES = 512 * 1024

interface XhrMeta {
  method: string
  url: string
  rule: NetworkRule | null
  startedAt: number
  delayed: boolean
  mocked: boolean
  modified: boolean
  requestHeaders: Record<string, string>
  requestBodyPreview?: unknown
  transformedResponse?: unknown
}

/**
 * 在页面主世界安装一次性拦截器，并通过 window.postMessage 接收配置。
 * Installs one interceptor in the page main world and receives configuration through window.postMessage.
 */
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const marker = '__novaNetworkLabInstalled__'
    const markedWindow = window as typeof window & Record<string, unknown>
    if (markedWindow[marker]) return
    markedWindow[marker] = true

    const state: MainWorldState = {
      settings: { ...DEFAULT_NETWORK_SITE_SETTINGS },
      rules: [],
    }

    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (event.source !== window || !isConfigurationMessage(event.data)) return
      state.settings = { ...DEFAULT_NETWORK_SITE_SETTINGS, ...event.data.payload.settings }
      state.rules = event.data.payload.rules.slice(0, 200)
      emitConfigured(state)
    })

    installFetchInterceptor(state)
    installXhrInterceptor(state)
    installWebSocketObserver(state)
    emitReady()
  },
})

// Fetch 策略：完整 Mock 短路真实网络；修改响应先放行再转换；延迟只推迟调用。 / Fetch strategy: full Mock short-circuits network, transforms run after passthrough, and delay only postpones the call.
function installFetchInterceptor(state: MainWorldState) {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function novaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : null
    // Fetch 允许相对 URL；规则匹配和命中记录必须保留当前页面端口。 / Fetch accepts relative URLs; rule matching and hit records must preserve the current page port.
    const url = resolveNetworkUrl(request?.url || String(input), location.href)
    const method = String(init?.method || request?.method || 'GET').toUpperCase()
    const startedAt = performance.now()
    const rule = state.settings.enabled ? findMatchingRule(state.rules, { url, method, pageOrigin: location.origin }) : null
    const delayMs = getRuleDelay(rule)

    try {
      if (delayMs > 0) await wait(delayMs, init?.signal || request?.signal)

      if (rule?.action.type === 'mock' && rule.action.mock) {
        const response = createMockResponse(rule.action.mock)
        emitEntry(createPageEntry({
          url,
          method,
          source: 'fetch',
          startedAt,
          duration: performance.now() - startedAt,
          status: response.status,
          ok: response.ok,
          transferSize: estimateBodySize(rule.action.mock.body),
          mocked: true,
          modified: false,
          delayed: delayMs > 0,
          rule,
          requestHeaders: extractRequestHeaders(request, init),
          responseHeaders: sanitizeHeadersRecord(Object.fromEntries(response.headers.entries())),
          requestBodyPreview: sanitizePreview(serializeRequestBody(init?.body)),
          responsePreview: sanitizePreview(rule.action.mock.body),
          responseBody: rule.action.mock.bodyType === 'json' ? rule.action.mock.body : undefined,
        }))
        return response
      }

      const response = await originalFetch(input, init)

      if (rule?.action.type === 'modify-response') {
        const modified = await createModifiedResponse(response, rule)
        emitEntry(createPageEntry({
          url,
          method,
          source: 'fetch',
          startedAt,
          duration: performance.now() - startedAt,
          status: modified.response.status,
          ok: modified.response.ok,
          transferSize: modified.size,
          mocked: false,
          modified: modified.changed,
          delayed: delayMs > 0,
          rule,
          requestHeaders: extractRequestHeaders(request, init),
          responseHeaders: sanitizeHeadersRecord(Object.fromEntries(modified.response.headers.entries())),
          requestBodyPreview: sanitizePreview(serializeRequestBody(init?.body)),
          responsePreview: sanitizePreview(modified.preview),
          responseBody: modified.preview,
        }))
        return modified.response
      }

      if (state.settings.captureEnabled) {
        void captureFetchEntry(response, {
          url,
          method,
          startedAt,
          delayed: delayMs > 0,
          rule,
          requestHeaders: extractRequestHeaders(request, init),
          requestBodyPreview: sanitizePreview(serializeRequestBody(init?.body)),
        })
      }
      return response
    }
    catch (error) {
      emitEntry(createPageEntry({
        url,
        method,
        source: 'fetch',
        startedAt,
        duration: performance.now() - startedAt,
        status: null,
        ok: false,
        transferSize: 0,
        mocked: false,
        modified: false,
        delayed: delayMs > 0,
        rule,
        requestHeaders: extractRequestHeaders(request, init),
        requestBodyPreview: sanitizePreview(serializeRequestBody(init?.body)),
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  }
}

// XHR 适配器保持原型 API，并模拟必要事件以兼容页面框架。 / XHR adapter preserves the prototype API and simulates required events for framework compatibility.
function installXhrInterceptor(state: MainWorldState) {
  const OriginalXhr = window.XMLHttpRequest
  const originalOpen = OriginalXhr.prototype.open
  const originalSend = OriginalXhr.prototype.send
  const originalAbort = OriginalXhr.prototype.abort
  const originalSetRequestHeader = OriginalXhr.prototype.setRequestHeader
  const responseTextDescriptor = Object.getOwnPropertyDescriptor(OriginalXhr.prototype, 'responseText')
  const responseDescriptor = Object.getOwnPropertyDescriptor(OriginalXhr.prototype, 'response')
  const xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>()

  OriginalXhr.prototype.open = function novaOpen(method: string, url: string | URL, ...rest: any[]) {
    xhrMeta.set(this, {
      method: String(method || 'GET').toUpperCase(),
      url: new URL(String(url), location.href).href,
      rule: null,
      startedAt: 0,
      delayed: false,
      mocked: false,
      modified: false,
      requestHeaders: {},
    })
    return Reflect.apply(originalOpen, this, [method, String(url), ...rest])
  }

  OriginalXhr.prototype.setRequestHeader = function novaSetRequestHeader(name: string, value: string) {
    const meta = xhrMeta.get(this)
    if (meta) meta.requestHeaders[name.toLowerCase()] = String(value)
    return Reflect.apply(originalSetRequestHeader, this, [name, value])
  }

  OriginalXhr.prototype.send = function novaSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this) || {
      method: 'GET',
      url: location.href,
      rule: null,
      startedAt: 0,
      delayed: false,
      mocked: false,
      modified: false,
      requestHeaders: {},
    }
    meta.startedAt = performance.now()
    meta.rule = state.settings.enabled ? findMatchingRule(state.rules, { url: meta.url, method: meta.method, pageOrigin: location.origin }) : null
    meta.delayed = getRuleDelay(meta.rule) > 0
    meta.requestBodyPreview = sanitizePreview(serializeRequestBody(body))
    xhrMeta.set(this, meta)

    if (meta.rule?.action.type === 'mock' && meta.rule.action.mock) {
      const installed = installMockXhr(this, meta, meta.rule.action.mock, originalAbort)
      if (installed) return undefined
    }

    if (meta.rule?.action.type === 'modify-response') {
      installXhrResponseTransform(this, meta, responseTextDescriptor, responseDescriptor)
    }

    this.addEventListener('loadend', () => {
      if (!state.settings.captureEnabled && !meta.rule) return
      const preview = getXhrPreview(this, meta)
      const responseBody = getXhrJsonBody(this, meta)
      emitEntry(createPageEntry({
        url: meta.url,
        method: meta.method,
        source: 'xhr',
        startedAt: meta.startedAt,
        duration: performance.now() - meta.startedAt,
        status: safeNumber(() => this.status),
        ok: safeNumber(() => this.status) !== null ? safeNumber(() => this.status)! >= 200 && safeNumber(() => this.status)! < 400 : null,
        transferSize: estimateBodySize(preview),
        mocked: meta.mocked,
        modified: meta.modified,
        delayed: meta.delayed,
        rule: meta.rule,
        requestHeaders: sanitizeHeadersRecord(meta.requestHeaders),
        responseHeaders: parseXhrResponseHeaders(this),
        requestBodyPreview: meta.requestBodyPreview,
        responsePreview: sanitizePreview(preview),
        responseBody,
      }))
    }, { once: true })

    const delayMs = getRuleDelay(meta.rule)
    if (delayMs > 0) {
      window.setTimeout(() => originalSend.call(this, body), delayMs)
      return undefined
    }
    return originalSend.call(this, body)
  }
}

function installXhrResponseTransform(
  xhr: XMLHttpRequest,
  meta: XhrMeta,
  responseTextDescriptor?: PropertyDescriptor,
  responseDescriptor?: PropertyDescriptor,
) {
  const transform = (raw: unknown) => {
    if (meta.transformedResponse !== undefined) return meta.transformedResponse
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      meta.transformedResponse = resolveResponseBody(parsed, meta.rule?.action || { type: 'modify-response', delayMs: 0 })
      meta.modified = true
      return meta.transformedResponse
    }
    catch {
      return raw
    }
  }

  try {
    if (responseTextDescriptor?.get) {
      Object.defineProperty(xhr, 'responseText', {
        configurable: true,
        get() {
          const raw = responseTextDescriptor.get!.call(xhr)
          const transformed = transform(raw)
          return typeof transformed === 'string' ? transformed : JSON.stringify(transformed)
        },
      })
    }
    if (responseDescriptor?.get) {
      Object.defineProperty(xhr, 'response', {
        configurable: true,
        get() {
          const raw = responseDescriptor.get!.call(xhr)
          const transformed = transform(raw)
          return xhr.responseType === 'json' ? transformed : typeof transformed === 'string' ? transformed : JSON.stringify(transformed)
        },
      })
    }
  }
  catch {
    meta.modified = false
  }
}

// Mock XHR 通过实例属性覆盖和事件调度构造只读响应，不调用原始 send。 / Mock XHR constructs readonly response state and events without calling the original send.
function installMockXhr(
  xhr: XMLHttpRequest,
  meta: XhrMeta,
  mock: NetworkMockResponse,
  originalAbort: typeof XMLHttpRequest.prototype.abort,
): boolean {
  const headers = normalizeHeaders(mock.headers)
  const serialized = [101, 103, 204, 205, 304].includes(mock.status)
    ? ''
    : mock.bodyType === 'text' ? String(mock.body ?? '') : JSON.stringify(mock.body)
  const fake = {
    readyState: 1,
    status: 0,
    statusText: '',
    responseText: '',
    response: null as unknown,
    aborted: false,
  }

  try {
    Object.defineProperties(xhr, {
      readyState: { configurable: true, get: () => fake.readyState },
      status: { configurable: true, get: () => fake.status },
      statusText: { configurable: true, get: () => fake.statusText },
      responseURL: { configurable: true, get: () => meta.url },
      responseText: { configurable: true, get: () => fake.responseText },
      response: { configurable: true, get: () => fake.response },
      getResponseHeader: {
        configurable: true,
        value: (name: string) => headers[name.toLowerCase()] || null,
      },
      getAllResponseHeaders: {
        configurable: true,
        value: () => Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join(''),
      },
      abort: {
        configurable: true,
        value: () => {
          fake.aborted = true
          fake.readyState = 0
          xhr.dispatchEvent(new ProgressEvent('abort'))
          xhr.dispatchEvent(new ProgressEvent('loadend'))
          try { originalAbort.call(xhr) }
          catch { /* no native request was started */ }
        },
      },
    })
  }
  catch {
    return false
  }

  meta.mocked = true
  const delayMs = Math.max(0, mock.delayMs || meta.rule?.action.delayMs || 0)
  window.setTimeout(() => {
    if (fake.aborted) return
    fake.readyState = 2
    fake.status = mock.status
    fake.statusText = mock.statusText || statusText(mock.status)
    xhr.dispatchEvent(new Event('readystatechange'))

    fake.readyState = 3
    xhr.dispatchEvent(new Event('readystatechange'))

    fake.responseText = serialized
    fake.response = xhr.responseType === 'json' ? mock.body : serialized
    fake.readyState = 4
    xhr.dispatchEvent(new Event('readystatechange'))
    xhr.dispatchEvent(new ProgressEvent('load', { loaded: serialized.length, total: serialized.length }))
    xhr.dispatchEvent(new ProgressEvent('loadend', { loaded: serialized.length, total: serialized.length }))

    emitEntry(createPageEntry({
      url: meta.url,
      method: meta.method,
      source: 'xhr',
      startedAt: meta.startedAt,
      duration: performance.now() - meta.startedAt,
      status: mock.status,
      ok: mock.status >= 200 && mock.status < 400,
      transferSize: new TextEncoder().encode(serialized).byteLength,
      mocked: true,
      modified: false,
      delayed: delayMs > 0,
      rule: meta.rule,
      responsePreview: sanitizePreview(mock.body),
      responseBody: mock.bodyType === 'json' ? mock.body : undefined,
    }))
  }, delayMs)
  return true
}

// 仅替换 JSON 正文；克隆响应保留状态、状态文本和响应头。 / Replace the JSON body only while preserving status, status text, and headers in a cloned response.
async function createModifiedResponse(response: Response, rule: NetworkRule) {
  try {
    const body = await response.clone().json()
    const replacement = resolveResponseBody(body, rule.action)
    const serialized = JSON.stringify(replacement)
    const headers = new Headers(response.headers)
    headers.set('content-type', 'application/json; charset=utf-8')
    headers.delete('content-length')
    return {
      response: new Response(serialized, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
      changed: true,
      preview: replacement,
      size: new TextEncoder().encode(serialized).byteLength,
    }
  }
  catch {
    return {
      response,
      changed: false,
      preview: undefined,
      size: contentLength(response.headers),
    }
  }
}

async function readJsonResponseBody(response: Response): Promise<unknown> {
  if (!isJsonResponse(response)) return undefined
  const declaredSize = contentLength(response.headers)
  if (declaredSize > MAX_EDITABLE_JSON_BYTES) return undefined
  try {
    const text = await response.clone().text()
    if (new TextEncoder().encode(text).byteLength > MAX_EDITABLE_JSON_BYTES) return undefined
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}

async function captureFetchEntry(
  response: Response,
  context: {
    url: string
    method: string
    startedAt: number
    delayed: boolean
    rule: NetworkRule | null
    requestHeaders?: Record<string, string>
    requestBodyPreview?: unknown
  },
) {
  const size = contentLength(response.headers)
  const responseBody = await readJsonResponseBody(response)
  emitEntry(createPageEntry({
    url: context.url,
    method: context.method,
    source: 'fetch',
    startedAt: context.startedAt,
    duration: performance.now() - context.startedAt,
    status: response.status,
    ok: response.ok,
    transferSize: size,
    mocked: false,
    modified: false,
    delayed: context.delayed,
    rule: context.rule,
    requestHeaders: context.requestHeaders,
    responseHeaders: sanitizeHeadersRecord(Object.fromEntries(response.headers.entries())),
    requestBodyPreview: context.requestBodyPreview,
    responsePreview: sanitizePreview(responseBody),
    responseBody,
    resourceType: detectPayloadResourceType(response.headers.get('content-type'), context.url),
  }))
}

// WebSocket 只记录连接生命周期，不读取或修改消息帧。 / WebSocket capture records connection lifecycle only and never reads or modifies frames.
function installWebSocketObserver(state: MainWorldState) {
  const OriginalWebSocket = window.WebSocket
  class NovaObservedWebSocket extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols as string | string[])
      const startedAt = performance.now()
      let emitted = false
      const publish = (status: number | null, error?: string) => {
        if (emitted || !state.settings.captureEnabled) return
        emitted = true
        emitEntry(createPageEntry({
          url: String(url),
          method: 'CONNECT',
          source: 'socket',
          resourceType: 'socket',
          startedAt,
          duration: performance.now() - startedAt,
          status,
          ok: status === 101,
          transferSize: 0,
          mocked: false,
          modified: false,
          delayed: false,
          rule: null,
          error,
        }))
      }
      this.addEventListener('open', () => publish(101), { once: true })
      this.addEventListener('error', () => publish(null, 'WebSocket connection failed'), { once: true })
      this.addEventListener('close', event => publish(null, `WebSocket closed before opening (${event.code})`), { once: true })
    }
  }
  window.WebSocket = NovaObservedWebSocket as typeof WebSocket
}

function createMockResponse(mock: NetworkMockResponse): Response {
  const headers = new Headers(mock.headers)
  const bodyAllowed = ![101, 103, 204, 205, 304].includes(mock.status)
  if (bodyAllowed && !headers.has('content-type')) {
    headers.set('content-type', mock.bodyType === 'text' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8')
  }
  const body = bodyAllowed
    ? mock.bodyType === 'text' ? String(mock.body ?? '') : JSON.stringify(mock.body)
    : null
  return new Response(body, {
    status: mock.status,
    statusText: mock.statusText,
    headers,
  })
}

function createPageEntry(input: {
  url: string
  method: string
  source: NetworkEntry['source']
  resourceType?: NetworkResourceKind
  startedAt: number
  duration: number
  status: number | null
  ok: boolean | null
  transferSize: number
  mocked: boolean
  modified: boolean
  delayed: boolean
  rule: NetworkRule | null
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBodyPreview?: unknown
  responsePreview?: unknown
  responseBody?: unknown
  error?: string
}): NetworkEntry {
  const parsed = safeUrl(input.url)
  return {
    id: crypto.randomUUID(),
    url: parsed.href,
    pathname: parsed.pathname,
    method: input.method,
    source: input.source,
    resourceType: input.resourceType || (input.source === 'resource' ? 'other' : input.source),
    initiatorType: input.source,
    status: input.status,
    ok: input.ok,
    startedAt: performance.timeOrigin + input.startedAt,
    timestamp: new Date().toISOString(),
    duration: round(input.duration),
    timing: {
      dns: 0,
      connect: 0,
      tls: 0,
      request: 0,
      ttfb: round(input.duration),
      download: 0,
    },
    transferSize: Math.max(0, input.transferSize),
    encodedBodySize: Math.max(0, input.transferSize),
    decodedBodySize: Math.max(0, input.transferSize),
    mocked: input.mocked,
    modified: input.modified,
    delayed: input.delayed,
    ruleId: input.rule?.id,
    ruleName: input.rule?.name,
    requestHeaders: input.requestHeaders,
    responseHeaders: input.responseHeaders,
    requestBodyPreview: input.requestBodyPreview,
    responsePreview: input.responsePreview,
    responseBody: input.responseBody,
    error: input.error,
  }
}

function detectPayloadResourceType(contentType: string | null, url: string): NetworkResourceKind | undefined {
  const normalized = String(contentType || '').toLowerCase()
  const pathname = safeUrl(url).pathname
  if (normalized.includes('application/wasm') || /\.wasm$/i.test(pathname)) return 'wasm'
  if (normalized.includes('application/manifest+json') || /\.webmanifest$/i.test(pathname)) return 'manifest'
  return undefined
}

function emitReady() {
  const event: PageNetworkEvent = {
    source: NOVA_NETWORK_CHANNEL,
    direction: 'page-to-extension',
    type: 'READY',
  }
  window.postMessage(event, '*')
}

function emitConfigured(state: MainWorldState) {
  const event: PageNetworkEvent = {
    source: NOVA_NETWORK_CHANNEL,
    direction: 'page-to-extension',
    type: 'CONFIGURED',
    payload: {
      enabled: state.settings.enabled,
      ruleCount: state.rules.length,
    },
  }
  window.postMessage(event, '*')
}

function emitEntry(entry: NetworkEntry) {
  const event: PageNetworkEvent = {
    source: NOVA_NETWORK_CHANNEL,
    direction: 'page-to-extension',
    type: 'ENTRY',
    payload: entry,
  }
  window.postMessage(event, '*')
}

function isConfigurationMessage(value: unknown): value is PageNetworkCommand {
  if (!value || typeof value !== 'object') return false
  const command = value as Partial<PageNetworkCommand>
  return command.source === NOVA_NETWORK_CHANNEL
    && command.direction === 'extension-to-page'
    && command.type === 'CONFIGURE'
    && Boolean(command.payload)
}

function getRuleDelay(rule: NetworkRule | null): number {
  if (!rule) return 0
  if (rule.action.type === 'mock') return Math.max(0, rule.action.mock?.delayMs || rule.action.delayMs || 0)
  return Math.max(0, rule.action.delayMs || 0)
}

function wait(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('The operation was aborted.', 'AbortError'))
      return
    }
    const timer = window.setTimeout(resolve, milliseconds)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(signal.reason || new DOMException('The operation was aborted.', 'AbortError'))
    }, { once: true })
  })
}

function getXhrPreview(xhr: XMLHttpRequest, meta: XhrMeta): unknown {
  if (meta.transformedResponse !== undefined) return meta.transformedResponse
  try {
    if (xhr.responseType === 'json') return xhr.response
    if (xhr.responseType === '' || xhr.responseType === 'text') {
      const text = xhr.responseText
      if (!text || text.length > 64 * 1024) return undefined
      try { return JSON.parse(text) }
      catch { return text.slice(0, 2000) }
    }
  }
  catch { /* response unavailable */ }
  return undefined
}

function getXhrJsonBody(xhr: XMLHttpRequest, meta: XhrMeta): unknown {
  try {
    let body: unknown
    if (meta.transformedResponse !== undefined) body = meta.transformedResponse
    else if (xhr.responseType === 'json') body = xhr.response
    else if (xhr.responseType === '' || xhr.responseType === 'text') {
      const text = xhr.responseText
      if (!text || new TextEncoder().encode(text).byteLength > MAX_EDITABLE_JSON_BYTES) return undefined
      const contentType = xhr.getResponseHeader('content-type') || ''
      if (!/application\/(?:[\w.+-]*\+)?json/i.test(contentType) && !/^\s*[\[{]/.test(text)) return undefined
      body = JSON.parse(text)
    }
    return estimateBodySize(body) <= MAX_EDITABLE_JSON_BYTES ? body : undefined
  }
  catch {
    return undefined
  }
}

// 响应预览限制深度和长度，并对敏感键脱敏后才发送到扩展世界。 / Response previews are bounded and sensitive keys are sanitized before crossing into the extension world.
function sanitizePreview(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value
  if (depth > 5) return '[已截断]'
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizePreview(item, depth + 1))

  const output: Record<string, unknown> = {}
  const sensitive = /authorization|cookie|token|password|secret|session|credential/i
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 60)) {
    output[key] = sensitive.test(key) ? '[已脱敏]' : sanitizePreview(item, depth + 1)
  }
  return output
}


function extractRequestHeaders(request: Request | null, init?: RequestInit) {
  const records: Record<string, string> = {}
  const append = (name: string, value: string) => {
    records[name.toLowerCase()] = sensitiveHeader(name) ? '[已脱敏]' : value
  }
  const sources = [request?.headers, init?.headers]
  for (const source of sources) {
    if (!source) continue
    const headers = new Headers(source)
    for (const [name, value] of headers.entries()) append(name, value)
  }
  return Object.keys(records).length ? records : undefined
}

function parseXhrResponseHeaders(xhr: XMLHttpRequest) {
  try {
    const raw = xhr.getAllResponseHeaders()
    if (!raw) return undefined
    const headers: Record<string, string> = {}
    for (const line of raw.trim().split(/\r?\n/)) {
      const index = line.indexOf(':')
      if (index <= 0) continue
      const name = line.slice(0, index).trim().toLowerCase()
      const value = line.slice(index + 1).trim()
      headers[name] = sensitiveHeader(name) ? '[已脱敏]' : value
    }
    return Object.keys(headers).length ? headers : undefined
  }
  catch {
    return undefined
  }
}

function sanitizeHeadersRecord(headers?: Record<string, string>) {
  if (!headers) return undefined
  const output: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    output[name.toLowerCase()] = sensitiveHeader(name) ? '[已脱敏]' : String(value)
  }
  return Object.keys(output).length ? output : undefined
}

function sensitiveHeader(name: string) {
  return /authorization|cookie|token|secret|credential|session/i.test(name)
}

function serializeRequestBody(body: unknown) {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') {
    try { return JSON.parse(body) }
    catch { return body.slice(0, 2000) }
  }
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries())
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const output: Record<string, unknown> = {}
    for (const [key, value] of body.entries()) {
      output[key] = typeof value === 'string' ? value : `[Blob ${value.type || 'application/octet-stream'}]`
    }
    return output
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[Blob ${body.type || 'application/octet-stream'} · ${body.size}B]`
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength}B]`
  if (ArrayBuffer.isView(body)) return `[TypedArray ${body.byteLength}B]`
  if (typeof Document !== 'undefined' && body instanceof Document) return body.documentElement?.outerHTML?.slice(0, 2000) || '[Document]'
  return body
}

function safeUrl(url: string): URL {
  try { return new URL(url, location.href) }
  catch { return new URL(location.href) }
}

function normalizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
}

function isJsonResponse(response: Response) {
  return /application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type') || '')
}

function contentLength(headers: Headers) {
  const length = Number(headers.get('content-length'))
  return Number.isFinite(length) ? Math.max(0, length) : 0
}

function estimateBodySize(body: unknown) {
  try { return new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).byteLength }
  catch { return 0 }
}

function statusText(status: number) {
  const values: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' }
  return values[status] || 'Mock Response'
}

function safeNumber(read: () => number): number | null {
  try {
    const value = read()
    return Number.isFinite(value) ? value : null
  }
  catch { return null }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
