/**
 * Runtime lifecycle coordination for YK Pets renderers.
 * Pauses expensive animation while a page is hidden, frozen, offscreen, or site-paused.
 */

export type RuntimeActivity = 'active' | 'paused' | 'hidden' | 'disposed'
export type SiteRuntimeMode = 'enabled' | 'paused' | 'hidden'
export type RuntimePauseReason =
  | 'site-paused'
  | 'site-hidden'
  | 'page-hidden'
  | 'offscreen'
  | 'frozen'
  | 'page-inactive'
  | 'manual'
  | 'disposed'
  | 'none'

export interface RuntimeLifecycleSignals {
  siteMode: SiteRuntimeMode
  pageVisible: boolean
  inViewport: boolean
  frozen: boolean
  pageActive: boolean
  manualPaused: boolean
}

export interface RuntimeLifecycleOptions {
  pauseWhenPageHidden?: boolean
  pauseWhenOffscreen?: boolean
  pauseWhenFrozen?: boolean
  pauseWhenPageInactive?: boolean
}

export interface RuntimeActivityTarget {
  activate(reason: RuntimePauseReason): void | Promise<void>
  pause(reason: RuntimePauseReason): void | Promise<void>
  hide(reason: RuntimePauseReason): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface RuntimeLifecycleSnapshot {
  activity: RuntimeActivity
  reason: RuntimePauseReason
  signals: RuntimeLifecycleSignals
  transitionAt: number
}

export interface RuntimeLifecycleEvent {
  previous: RuntimeActivity
  current: RuntimeActivity
  reason: RuntimePauseReason
  at: number
  signals: RuntimeLifecycleSignals
}

export interface DocumentEventSourceLike {
  visibilityState?: string
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
}

export interface WindowEventSourceLike {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
}

export interface IntersectionObserverEntryLike {
  isIntersecting: boolean
  intersectionRatio?: number
}

export interface IntersectionObserverLike {
  observe(target: Element): void
  disconnect(): void
}

export type IntersectionObserverFactory = (
  callback: (entries: IntersectionObserverEntryLike[]) => void,
) => IntersectionObserverLike

export interface BrowserLifecycleMonitorOptions {
  document?: DocumentEventSourceLike
  window?: WindowEventSourceLike
  intersectionObserverFactory?: IntersectionObserverFactory
  target?: Element
}

export interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining(): number
}

export interface IdleSchedulerHost {
  requestIdleCallback?(callback: (deadline: IdleDeadlineLike) => void, options?: { timeout?: number }): number
  cancelIdleCallback?(handle: number): void
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  clearTimeout(handle: ReturnType<typeof setTimeout>): void
}

export interface IdleTaskOptions {
  timeoutMs?: number
  fallbackDelayMs?: number
  signal?: AbortSignal
}

const DEFAULT_SIGNALS: RuntimeLifecycleSignals = Object.freeze({
  siteMode: 'enabled',
  pageVisible: true,
  inViewport: true,
  frozen: false,
  pageActive: true,
  manualPaused: false,
})

const DEFAULT_OPTIONS: Required<RuntimeLifecycleOptions> = Object.freeze({
  pauseWhenPageHidden: true,
  pauseWhenOffscreen: true,
  pauseWhenFrozen: true,
  pauseWhenPageInactive: true,
})

type LifecycleListener = (event: RuntimeLifecycleEvent) => void

export class RuntimeLifecycleController {
  readonly options: Required<RuntimeLifecycleOptions>
  readonly now: () => number

  #target: RuntimeActivityTarget | null
  #signals: RuntimeLifecycleSignals = { ...DEFAULT_SIGNALS }
  #activity: RuntimeActivity = 'paused'
  #reason: RuntimePauseReason = 'manual'
  #transitionAt = 0
  #queue: Promise<void> = Promise.resolve()
  #listeners = new Set<LifecycleListener>()
  #disposed = false

  constructor(target?: RuntimeActivityTarget | null, options: RuntimeLifecycleOptions = {}, now: () => number = Date.now) {
    this.#target = target ?? null
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.now = now
  }

  get snapshot(): RuntimeLifecycleSnapshot {
    return {
      activity: this.#activity,
      reason: this.#reason,
      signals: { ...this.#signals },
      transitionAt: this.#transitionAt,
    }
  }

  onChange(listener: LifecycleListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async bind(target: RuntimeActivityTarget, synchronize = true): Promise<void> {
    if (this.#disposed) throw new Error('RuntimeLifecycleController is disposed')
    this.#target = target
    if (synchronize) await this.#transition(true)
  }

  unbind(): void {
    this.#target = null
  }

  async update(signals: Partial<RuntimeLifecycleSignals>): Promise<RuntimeLifecycleSnapshot> {
    if (this.#disposed) throw new Error('RuntimeLifecycleController is disposed')
    this.#signals = validateSignals({ ...this.#signals, ...signals })
    await this.#transition()
    return this.snapshot
  }

  setSiteMode(mode: SiteRuntimeMode): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ siteMode: mode })
  }

  setPageVisible(visible: boolean): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ pageVisible: visible })
  }

  setInViewport(inViewport: boolean): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ inViewport })
  }

  setFrozen(frozen: boolean): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ frozen })
  }

  setPageActive(pageActive: boolean): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ pageActive })
  }

  setManualPaused(manualPaused: boolean): Promise<RuntimeLifecycleSnapshot> {
    return this.update({ manualPaused })
  }

  async dispose(disposeTarget = false): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    await this.#queue
    const previous = this.#activity
    this.#activity = 'disposed'
    this.#reason = 'disposed'
    this.#transitionAt = this.now()
    if (disposeTarget) await this.#target?.dispose?.()
    this.#emit({
      previous,
      current: 'disposed',
      reason: 'disposed',
      at: this.#transitionAt,
      signals: { ...this.#signals },
    })
    this.#target = null
  }

  async #transition(force = false): Promise<void> {
    const evaluation = evaluateActivity(this.#signals, this.options)
    this.#queue = this.#queue.then(async () => {
      if (this.#disposed) return
      const previous = this.#activity
      if (!force && previous === evaluation.activity && this.#reason === evaluation.reason) return
      if (this.#target) {
        if (evaluation.activity === 'active') await this.#target.activate(evaluation.reason)
        else if (evaluation.activity === 'paused') await this.#target.pause(evaluation.reason)
        else await this.#target.hide(evaluation.reason)
      }
      this.#activity = evaluation.activity
      this.#reason = evaluation.reason
      this.#transitionAt = this.now()
      this.#emit({
        previous,
        current: evaluation.activity,
        reason: evaluation.reason,
        at: this.#transitionAt,
        signals: { ...this.#signals },
      })
    })
    await this.#queue
  }

  #emit(event: RuntimeLifecycleEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
}

export class BrowserLifecycleMonitor {
  readonly controller: RuntimeLifecycleController
  readonly options: BrowserLifecycleMonitorOptions

  #started = false
  #observer: IntersectionObserverLike | null = null
  #visibility = () => { void this.controller.setPageVisible(this.options.document?.visibilityState !== 'hidden') }
  #freeze = () => { void this.controller.setFrozen(true) }
  #resume = () => { void this.controller.setFrozen(false) }
  #pageHide = () => { void this.controller.setPageActive(false) }
  #pageShow = () => { void this.controller.setPageActive(true) }

  constructor(controller: RuntimeLifecycleController, options: BrowserLifecycleMonitorOptions = {}) {
    this.controller = controller
    this.options = options
  }

  start(): void {
    if (this.#started) return
    this.#started = true
    const documentSource = this.options.document ?? (typeof document !== 'undefined' ? document : undefined)
    const windowSource = this.options.window ?? (typeof window !== 'undefined' ? window : undefined)

    if (documentSource) {
      ;(this.options as { document?: DocumentEventSourceLike }).document = documentSource
      documentSource.addEventListener('visibilitychange', this.#visibility)
      documentSource.addEventListener('freeze', this.#freeze)
      documentSource.addEventListener('resume', this.#resume)
      void this.controller.setPageVisible(documentSource.visibilityState !== 'hidden')
    }
    if (windowSource) {
      ;(this.options as { window?: WindowEventSourceLike }).window = windowSource
      windowSource.addEventListener('pagehide', this.#pageHide)
      windowSource.addEventListener('pageshow', this.#pageShow)
    }

    const factory = this.options.intersectionObserverFactory
      ?? (typeof IntersectionObserver !== 'undefined'
        ? callback => new IntersectionObserver(entries => callback(entries))
        : undefined)
    if (factory && this.options.target) {
      this.#observer = factory(entries => {
        const entry = entries.at(-1)
        if (entry) void this.controller.setInViewport(entry.isIntersecting && (entry.intersectionRatio ?? 1) > 0)
      })
      this.#observer.observe(this.options.target)
    }
  }

  stop(): void {
    if (!this.#started) return
    this.#started = false
    this.options.document?.removeEventListener('visibilitychange', this.#visibility)
    this.options.document?.removeEventListener('freeze', this.#freeze)
    this.options.document?.removeEventListener('resume', this.#resume)
    this.options.window?.removeEventListener('pagehide', this.#pageHide)
    this.options.window?.removeEventListener('pageshow', this.#pageShow)
    this.#observer?.disconnect()
    this.#observer = null
  }
}

export function createAnimationActivityTarget(options: {
  start(): void | Promise<void>
  stop(): void | Promise<void>
  show?(): void | Promise<void>
  hide?(): void | Promise<void>
  dispose?(): void | Promise<void>
}): RuntimeActivityTarget {
  return {
    async activate() {
      await options.show?.()
      await options.start()
    },
    async pause() {
      await options.show?.()
      await options.stop()
    },
    async hide() {
      await options.stop()
      await options.hide?.()
    },
    dispose: options.dispose,
  }
}

export function scheduleIdleTask(task: (deadline: IdleDeadlineLike) => void | Promise<void>, options: IdleTaskOptions = {}): () => void {
  const host: IdleSchedulerHost = {
    requestIdleCallback: typeof globalThis.requestIdleCallback === 'function'
      ? globalThis.requestIdleCallback.bind(globalThis) as IdleSchedulerHost['requestIdleCallback']
      : undefined,
    cancelIdleCallback: typeof globalThis.cancelIdleCallback === 'function'
      ? globalThis.cancelIdleCallback.bind(globalThis) as IdleSchedulerHost['cancelIdleCallback']
      : undefined,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  }
  return scheduleIdleTaskWithHost(host, task, options)
}

export function scheduleIdleTaskWithHost(
  host: IdleSchedulerHost,
  task: (deadline: IdleDeadlineLike) => void | Promise<void>,
  options: IdleTaskOptions = {},
): () => void {
  if (options.signal?.aborted) return () => {}
  let cancelled = false
  let idleHandle: number | undefined
  let timerHandle: ReturnType<typeof setTimeout> | undefined

  const run = (deadline: IdleDeadlineLike) => {
    if (cancelled || options.signal?.aborted) return
    cancelled = true
    cleanup()
    void task(deadline)
  }
  const abort = () => {
    cancelled = true
    cleanup()
  }
  const cleanup = () => {
    if (idleHandle !== undefined) host.cancelIdleCallback?.(idleHandle)
    if (timerHandle !== undefined) host.clearTimeout(timerHandle)
    options.signal?.removeEventListener('abort', abort)
  }

  options.signal?.addEventListener('abort', abort, { once: true })
  if (host.requestIdleCallback) {
    idleHandle = host.requestIdleCallback(run, { timeout: options.timeoutMs ?? 2_000 })
  }
  else {
    timerHandle = host.setTimeout(
      () => run({ didTimeout: true, timeRemaining: () => 0 }),
      options.fallbackDelayMs ?? 50,
    )
  }
  return abort
}

export function evaluateActivity(
  signals: RuntimeLifecycleSignals,
  options: Required<RuntimeLifecycleOptions> = DEFAULT_OPTIONS,
): { activity: Exclude<RuntimeActivity, 'disposed'>; reason: RuntimePauseReason } {
  if (signals.siteMode === 'hidden') return { activity: 'hidden', reason: 'site-hidden' }
  if (signals.siteMode === 'paused') return { activity: 'paused', reason: 'site-paused' }
  if (signals.manualPaused) return { activity: 'paused', reason: 'manual' }
  if (options.pauseWhenFrozen && signals.frozen) return { activity: 'paused', reason: 'frozen' }
  if (options.pauseWhenPageInactive && !signals.pageActive) return { activity: 'paused', reason: 'page-inactive' }
  if (options.pauseWhenPageHidden && !signals.pageVisible) return { activity: 'paused', reason: 'page-hidden' }
  if (options.pauseWhenOffscreen && !signals.inViewport) return { activity: 'paused', reason: 'offscreen' }
  return { activity: 'active', reason: 'none' }
}

function validateSignals(signals: RuntimeLifecycleSignals): RuntimeLifecycleSignals {
  if (!['enabled', 'paused', 'hidden'].includes(signals.siteMode)) throw new Error(`Invalid site runtime mode: ${signals.siteMode}`)
  for (const key of ['pageVisible', 'inViewport', 'frozen', 'pageActive', 'manualPaused'] as const) {
    if (typeof signals[key] !== 'boolean') throw new Error(`${key} must be boolean`)
  }
  return { ...signals }
}
