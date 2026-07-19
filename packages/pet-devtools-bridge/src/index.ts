/**
 * Restricted Chrome DevTools Protocol bridge for YK Pets.
 *
 * This package deliberately excludes arbitrary Runtime.evaluate, DOM mutation,
 * input synthesis, downloads, and script injection. Consumers must opt in to a
 * small command allowlist and bind every session to an explicit tab + origin.
 */

export interface CdpTarget {
  tabId: number
  origin: string
  url?: string
}

export interface ChromeDebuggerTarget {
  tabId: number
}

export interface ChromeDebuggerEventApi {
  addListener(listener: (source: ChromeDebuggerTarget, method: string, params?: unknown) => void): void
  removeListener(listener: (source: ChromeDebuggerTarget, method: string, params?: unknown) => void): void
}

export interface ChromeDebuggerApi {
  attach(target: ChromeDebuggerTarget, requiredVersion: string): Promise<void> | void
  detach(target: ChromeDebuggerTarget): Promise<void> | void
  sendCommand(target: ChromeDebuggerTarget, method: string, params?: Record<string, unknown>): Promise<unknown> | unknown
  onEvent: ChromeDebuggerEventApi
}

export interface CdpTransport {
  readonly attached: boolean
  readonly target: CdpTarget | null
  attach(target: CdpTarget): Promise<void>
  detach(): Promise<void>
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  onEvent(listener: CdpEventListener): () => void
}

export type CdpEventListener = (event: CdpEventRecord) => void

export interface CdpEventRecord {
  method: string
  params: unknown
  at: number
}

export interface CdpCommandRecord {
  id: number
  method: string
  params?: Record<string, unknown>
  startedAt: number
  finishedAt: number
  outcome: 'success' | 'error' | 'timeout' | 'denied'
  error?: string
}

export interface RestrictedCdpClientOptions {
  allowedMethods?: Iterable<string>
  allowedEvents?: Iterable<string>
  allowedOrigins?: string[]
  timeoutMs?: number
  maxCommands?: number
  eventBufferSize?: number
  now?: () => number
  redact?: (value: unknown) => unknown
}

export interface ElementCdpSnapshot {
  node: unknown
  boxModel: unknown | null
  matchedStyles: unknown | null
  accessibility: unknown | null
  capturedAt: number
}

export interface PerformanceCdpSnapshot {
  metrics: Array<{ name: string; value: number }>
  layoutMetrics: unknown | null
  capturedAt: number
}

export const DEFAULT_ALLOWED_CDP_METHODS = Object.freeze([
  'DOM.enable',
  'DOM.getDocument',
  'DOM.querySelector',
  'DOM.describeNode',
  'DOM.getBoxModel',
  'CSS.enable',
  'CSS.getMatchedStylesForNode',
  'Accessibility.enable',
  'Accessibility.getPartialAXTree',
  'Performance.enable',
  'Performance.getMetrics',
  'Page.getLayoutMetrics',
  'Network.enable',
  'Network.disable',
  'Log.enable',
  'Runtime.enable',
] as const)

export const DEFAULT_ALLOWED_CDP_EVENTS = Object.freeze([
  'Log.entryAdded',
  'Runtime.consoleAPICalled',
  'Runtime.exceptionThrown',
  'Network.loadingFailed',
  'Network.responseReceived',
  'Performance.metrics',
] as const)

const ALWAYS_DENIED_METHOD_PATTERNS = [
  /^Runtime\.(?:evaluate|callFunctionOn|compileScript|runScript|addBinding)$/,
  /^Page\.(?:addScriptToEvaluateOnNewDocument|removeScriptToEvaluateOnNewDocument|setDownloadBehavior|navigate|reload|stopLoading)$/,
  /^DOM\.(?:set|remove|move|copyTo|setFileInputFiles|focus|performSearch|discardSearch)/,
  /^(?:Input|Emulation|Browser|Storage|Fetch)\./,
  /^Network\.(?:setCookie|setCookies|deleteCookies|clearBrowserCookies|getAllCookies|getCookies|getResponseBody|setExtraHTTPHeaders|emulateNetworkConditions)$/,
] as const

export class ChromeDebuggerTransport implements CdpTransport {
  readonly api: ChromeDebuggerApi
  readonly protocolVersion: string
  readonly now: () => number
  #target: CdpTarget | null = null
  #listeners = new Set<CdpEventListener>()
  #boundEvent: (source: ChromeDebuggerTarget, method: string, params?: unknown) => void

  constructor(api: ChromeDebuggerApi, protocolVersion = '1.3', now: () => number = Date.now) {
    this.api = api
    this.protocolVersion = protocolVersion
    this.now = now
    this.#boundEvent = (source, method, params) => {
      if (!this.#target || source.tabId !== this.#target.tabId) return
      const event: CdpEventRecord = { method, params, at: this.now() }
      for (const listener of this.#listeners) listener(event)
    }
  }

  get attached(): boolean {
    return this.#target !== null
  }

  get target(): CdpTarget | null {
    return this.#target ? { ...this.#target } : null
  }

  async attach(target: CdpTarget): Promise<void> {
    validateTarget(target)
    if (this.#target) {
      if (this.#target.tabId === target.tabId && this.#target.origin === target.origin) return
      throw new Error('CDP transport is already attached to another target')
    }
    await this.api.attach({ tabId: target.tabId }, this.protocolVersion)
    this.#target = { ...target, origin: normalizeOrigin(target.origin) }
    this.api.onEvent.addListener(this.#boundEvent)
  }

  async detach(): Promise<void> {
    const target = this.#target
    if (!target) return
    this.#target = null
    this.api.onEvent.removeListener(this.#boundEvent)
    await this.api.detach({ tabId: target.tabId })
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.#target) throw new Error('CDP transport is not attached')
    return this.api.sendCommand({ tabId: this.#target.tabId }, method, params)
  }

  onEvent(listener: CdpEventListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

export class RestrictedCdpClient {
  readonly transport: CdpTransport
  readonly allowedMethods: ReadonlySet<string>
  readonly allowedEvents: ReadonlySet<string>
  readonly allowedOrigins: readonly string[]
  readonly timeoutMs: number
  readonly maxCommands: number
  readonly eventBufferSize: number
  readonly now: () => number
  readonly redact: (value: unknown) => unknown

  #commandCount = 0
  #nextCommandId = 1
  #events: CdpEventRecord[] = []
  #history: CdpCommandRecord[] = []
  #detachEvents: (() => void) | null = null

  constructor(transport: CdpTransport, options: RestrictedCdpClientOptions = {}) {
    this.transport = transport
    this.allowedMethods = new Set(options.allowedMethods ?? DEFAULT_ALLOWED_CDP_METHODS)
    this.allowedEvents = new Set(options.allowedEvents ?? DEFAULT_ALLOWED_CDP_EVENTS)
    this.allowedOrigins = Object.freeze([...(options.allowedOrigins ?? [])])
    this.timeoutMs = positiveInteger(options.timeoutMs ?? 5_000, 'timeoutMs')
    this.maxCommands = positiveInteger(options.maxCommands ?? 250, 'maxCommands')
    this.eventBufferSize = positiveInteger(options.eventBufferSize ?? 200, 'eventBufferSize')
    this.now = options.now ?? Date.now
    this.redact = options.redact ?? redactSensitiveData
    for (const method of this.allowedMethods) assertMethodCanBeAllowed(method)
  }

  get attached(): boolean {
    return this.transport.attached
  }

  get target(): CdpTarget | null {
    return this.transport.target
  }

  get commandCount(): number {
    return this.#commandCount
  }

  get history(): readonly CdpCommandRecord[] {
    return this.#history.map(record => ({ ...record, params: record.params ? clone(record.params) : undefined }))
  }

  async attach(target: CdpTarget): Promise<void> {
    validateTarget(target)
    if (this.allowedOrigins.length > 0 && !this.allowedOrigins.some(pattern => matchesOriginPattern(target.origin, pattern))) {
      throw new Error(`CDP target origin is outside the allowed scope: ${normalizeOrigin(target.origin)}`)
    }
    await this.transport.attach({ ...target, origin: normalizeOrigin(target.origin) })
    this.#detachEvents ??= this.transport.onEvent(event => this.#recordEvent(event))
  }

  async detach(): Promise<void> {
    this.#detachEvents?.()
    this.#detachEvents = null
    await this.transport.detach()
  }

  async send<T = unknown>(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const startedAt = this.now()
    const id = this.#nextCommandId++
    let outcome: CdpCommandRecord['outcome'] = 'success'
    let errorMessage: string | undefined
    try {
      this.#assertCommandAllowed(method, params)
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
      if (this.#commandCount >= this.maxCommands) throw new Error(`CDP command budget exceeded (${this.maxCommands})`)
      this.#commandCount += 1
      const result = await withTimeout(this.transport.send(method, params), this.timeoutMs, signal, method)
      return this.redact(result) as T
    }
    catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
      outcome = /not allowed|outside|budget|invalid|denied/i.test(errorMessage)
        ? 'denied'
        : /timed out/i.test(errorMessage)
          ? 'timeout'
          : 'error'
      throw error
    }
    finally {
      this.#history.push({
        id,
        method,
        params: params ? this.redact(params) as Record<string, unknown> : undefined,
        startedAt,
        finishedAt: this.now(),
        outcome,
        error: errorMessage,
      })
    }
  }

  events(options: { since?: number; methods?: string[] } = {}): readonly CdpEventRecord[] {
    const methods = options.methods ? new Set(options.methods) : null
    return this.#events
      .filter(event => (options.since === undefined || event.at >= options.since) && (!methods || methods.has(event.method)))
      .map(event => ({ ...event, params: clone(event.params) }))
  }

  clearEvents(): void {
    this.#events = []
  }

  async captureElementSnapshot(nodeId: number, signal?: AbortSignal): Promise<ElementCdpSnapshot> {
    assertInteger(nodeId, 'nodeId', 1)
    const node = await this.send('DOM.describeNode', { nodeId, depth: 1, pierce: true }, signal)
    const [boxModel, matchedStyles, accessibility] = await Promise.all([
      this.#optional('DOM.getBoxModel', { nodeId }, signal),
      this.#optional('CSS.getMatchedStylesForNode', { nodeId }, signal),
      this.#optional('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false }, signal),
    ])
    return { node, boxModel, matchedStyles, accessibility, capturedAt: this.now() }
  }

  async capturePerformanceSnapshot(signal?: AbortSignal): Promise<PerformanceCdpSnapshot> {
    const performance = await this.send<{ metrics?: Array<{ name?: unknown; value?: unknown }> }>('Performance.getMetrics', undefined, signal)
    const layoutMetrics = await this.#optional('Page.getLayoutMetrics', undefined, signal)
    const metrics = (performance.metrics ?? [])
      .filter(metric => typeof metric.name === 'string' && typeof metric.value === 'number' && Number.isFinite(metric.value))
      .map(metric => ({ name: metric.name as string, value: metric.value as number }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { metrics, layoutMetrics, capturedAt: this.now() }
  }

  async enableReadOnlyDomains(signal?: AbortSignal): Promise<void> {
    for (const method of ['DOM.enable', 'CSS.enable', 'Accessibility.enable', 'Performance.enable', 'Network.enable', 'Log.enable', 'Runtime.enable']) {
      if (this.allowedMethods.has(method)) await this.send(method, undefined, signal)
    }
  }

  async #optional(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<unknown | null> {
    if (!this.allowedMethods.has(method)) return null
    try {
      return await this.send(method, params, signal)
    }
    catch {
      return null
    }
  }

  #assertCommandAllowed(method: string, params?: Record<string, unknown>): void {
    if (!this.transport.attached) throw new Error('CDP client is not attached')
    assertMethodCanBeAllowed(method)
    if (!this.allowedMethods.has(method)) throw new Error(`CDP method is not allowed: ${method}`)
    validateCommandParams(method, params)
  }

  #recordEvent(event: CdpEventRecord): void {
    if (!this.allowedEvents.has(event.method)) return
    this.#events.push({ method: event.method, params: this.redact(event.params), at: event.at })
    if (this.#events.length > this.eventBufferSize) this.#events.splice(0, this.#events.length - this.eventBufferSize)
  }
}

export function validateCommandParams(method: string, params?: Record<string, unknown>): void {
  const value = params ?? {}
  assertPlainObject(value, 'CDP params')
  switch (method) {
    case 'DOM.enable':
    case 'CSS.enable':
    case 'Accessibility.enable':
    case 'Performance.enable':
    case 'Performance.getMetrics':
    case 'Page.getLayoutMetrics':
    case 'Network.disable':
    case 'Log.enable':
    case 'Runtime.enable':
      assertOnlyKeys(value, [])
      return
    case 'DOM.getDocument':
      assertOnlyKeys(value, ['depth', 'pierce'])
      optionalInteger(value.depth, 'depth', -1, 100)
      optionalBoolean(value.pierce, 'pierce')
      return
    case 'DOM.querySelector':
      assertOnlyKeys(value, ['nodeId', 'selector'])
      assertInteger(value.nodeId, 'nodeId', 1)
      assertSafeSelector(value.selector)
      return
    case 'DOM.describeNode':
      assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId', 'depth', 'pierce'])
      assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId'])
      optionalInteger(value.nodeId, 'nodeId', 1)
      optionalInteger(value.backendNodeId, 'backendNodeId', 1)
      optionalSafeString(value.objectId, 'objectId', 512)
      optionalInteger(value.depth, 'depth', -1, 100)
      optionalBoolean(value.pierce, 'pierce')
      return
    case 'DOM.getBoxModel':
      assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId'])
      assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId'])
      optionalInteger(value.nodeId, 'nodeId', 1)
      optionalInteger(value.backendNodeId, 'backendNodeId', 1)
      optionalSafeString(value.objectId, 'objectId', 512)
      return
    case 'CSS.getMatchedStylesForNode':
      assertOnlyKeys(value, ['nodeId'])
      assertInteger(value.nodeId, 'nodeId', 1)
      return
    case 'Accessibility.getPartialAXTree':
      assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId', 'fetchRelatives'])
      assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId'])
      optionalInteger(value.nodeId, 'nodeId', 1)
      optionalInteger(value.backendNodeId, 'backendNodeId', 1)
      optionalSafeString(value.objectId, 'objectId', 512)
      optionalBoolean(value.fetchRelatives, 'fetchRelatives')
      return
    case 'Network.enable':
      assertOnlyKeys(value, ['maxTotalBufferSize', 'maxResourceBufferSize', 'maxPostDataSize', 'reportDirectSocketTraffic', 'enableDurableMessages'])
      for (const key of ['maxTotalBufferSize', 'maxResourceBufferSize', 'maxPostDataSize'] as const) optionalInteger(value[key], key, 0, 100_000_000)
      optionalBoolean(value.reportDirectSocketTraffic, 'reportDirectSocketTraffic')
      optionalBoolean(value.enableDurableMessages, 'enableDurableMessages')
      return
    default:
      // Additional caller-provided read-only commands still receive structural limits.
      if (JSON.stringify(value).length > 32_768) throw new Error(`CDP params are too large: ${method}`)
  }
}

export function matchesOriginPattern(origin: string, pattern: string): boolean {
  const normalized = normalizeOrigin(origin)
  const trimmed = pattern.trim()
  if (!trimmed) return false
  if (trimmed === '*') return true
  if (!trimmed.includes('*')) return normalized === normalizeOrigin(trimmed)
  const escaped = trimmed
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.\\/:]+')
  return new RegExp(`^${escaped}$`, 'i').test(normalized)
}

export function redactSensitiveData(value: unknown): unknown {
  return redactInternal(value, new WeakSet<object>(), 0)
}

function redactInternal(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 12) return '[MaxDepth]'
  if (typeof value === 'string') return redactString(value)
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.slice(0, 500).map(item => redactInternal(item, seen, depth + 1))
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    output[key] = isSensitiveKey(key) ? '[REDACTED]' : redactInternal(item, seen, depth + 1)
  }
  return output
}

function redactString(value: string): string {
  if (value.length > 20_000) value = `${value.slice(0, 20_000)}…[truncated]`
  return value
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/([?&](?:token|access_token|api_key|key|secret|password)=)[^&#\s]+/gi, '$1[REDACTED]')
}

function isSensitiveKey(key: string): boolean {
  return /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|client_secret|access_token|refresh_token|api[_-]?key|private[_-]?key)$/i.test(key)
}

function assertMethodCanBeAllowed(method: string): void {
  if (!/^[A-Z][A-Za-z]+\.[A-Za-z][A-Za-z0-9]+$/.test(method)) throw new Error(`Invalid CDP method: ${method}`)
  if (ALWAYS_DENIED_METHOD_PATTERNS.some(pattern => pattern.test(method))) throw new Error(`CDP method is permanently denied: ${method}`)
}

function validateTarget(target: CdpTarget): void {
  assertInteger(target.tabId, 'tabId', 0)
  normalizeOrigin(target.origin)
  if (target.url !== undefined) {
    const url = new URL(target.url)
    if (url.origin !== normalizeOrigin(target.origin)) throw new Error('CDP target URL and origin do not match')
  }
}

function normalizeOrigin(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) CDP targets are allowed')
  if (url.username || url.password) throw new Error('CDP target origin must not contain credentials')
  return url.origin
}

function assertSafeSelector(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_048 || /[\u0000\r\n]/.test(value)) {
    throw new Error('Invalid selector')
  }
}

function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Unsupported CDP parameter: ${key}`)
}

function assertAtLeastOne(value: Record<string, unknown>, keys: readonly string[]): void {
  if (!keys.some(key => value[key] !== undefined)) throw new Error(`One of ${keys.join(', ')} is required`)
}

function optionalBoolean(value: unknown, name: string): void {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${name} must be a boolean`)
}

function optionalSafeString(value: unknown, name: string, max: number): void {
  if (value !== undefined && (typeof value !== 'string' || !value || value.length > max || /[\u0000\r\n]/.test(value))) {
    throw new Error(`${name} must be a safe string`)
  }
}

function optionalInteger(value: unknown, name: string, min: number, max = Number.MAX_SAFE_INTEGER): void {
  if (value !== undefined) assertInteger(value, name, min, max)
}

function assertInteger(value: unknown, name: string, min: number, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${name} must be an integer between ${min} and ${max}`)
}

function positiveInteger(value: number, name: string): number {
  assertInteger(value, name, 1)
  return value
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal: AbortSignal | undefined, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let detach = () => {}
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`CDP command timed out after ${timeoutMs}ms: ${label}`)), timeoutMs)
  })
  const aborted = new Promise<never>((_, reject) => {
    if (!signal) return
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) abort()
    else {
      signal.addEventListener('abort', abort, { once: true })
      detach = () => signal.removeEventListener('abort', abort)
    }
  })
  try {
    return await Promise.race([promise, timeout, aborted])
  }
  finally {
    if (timer) clearTimeout(timer)
    detach()
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value)
}
