/**
 * Deduplicated, dependency-aware, timeout-bounded lazy feature loading.
 * Intended for splitting 3D rendering, audit collection, and optional agent features.
 */

export type FeatureLoadState = 'idle' | 'loading' | 'ready' | 'fallback' | 'failed' | 'disabled' | 'disposed'

export interface FeatureLoadContext {
  name: string
  signal: AbortSignal
  dependencyValues: ReadonlyMap<string, unknown>
}

export interface FeatureDefinition<T = unknown> {
  name: string
  dependencies?: string[]
  timeoutMs?: number
  load(context: FeatureLoadContext): Promise<T> | T
  fallback?(error: unknown, context: FeatureLoadContext): Promise<T> | T
  dispose?(value: T): Promise<void> | void
}

export interface FeatureStatus {
  name: string
  state: FeatureLoadState
  attempts: number
  loadedAt?: number
  failedAt?: number
  error?: unknown
  dependencies: string[]
}

export interface FeatureLoaderEvent {
  name: string
  previous: FeatureLoadState
  current: FeatureLoadState
  at: number
  error?: unknown
}

export interface FeatureLoadOptions {
  signal?: AbortSignal
  retry?: boolean
}

export interface IdlePrefetchScheduler {
  (task: () => void | Promise<void>): () => void
}

interface FeatureRecord<T = unknown> {
  definition: FeatureDefinition<T>
  state: FeatureLoadState
  attempts: number
  value?: T
  error?: unknown
  loadedAt?: number
  failedAt?: number
  promise?: Promise<T>
  controller?: AbortController
}

type FeatureListener = (event: FeatureLoaderEvent) => void

export class FeatureModuleLoader {
  readonly now: () => number
  #records = new Map<string, FeatureRecord>()
  #listeners = new Set<FeatureListener>()
  #disposed = false

  constructor(definitions: FeatureDefinition[] = [], now: () => number = Date.now) {
    this.now = now
    for (const definition of definitions) this.register(definition)
  }

  onChange(listener: FeatureListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  register<T>(definition: FeatureDefinition<T>): void {
    if (this.#disposed) throw new Error('FeatureModuleLoader is disposed')
    validateDefinition(definition)
    if (this.#records.has(definition.name)) throw new Error(`Feature already registered: ${definition.name}`)
    this.#records.set(definition.name, {
      definition: { ...definition, dependencies: [...(definition.dependencies ?? [])] },
      state: 'idle',
      attempts: 0,
    })
  }

  has(name: string): boolean {
    return this.#records.has(name)
  }

  get<T>(name: string): T | undefined {
    const record = this.#records.get(name)
    if (!record || (record.state !== 'ready' && record.state !== 'fallback')) return undefined
    return record.value as T | undefined
  }

  status(name: string): FeatureStatus {
    const record = this.#require(name)
    return snapshot(record)
  }

  list(): FeatureStatus[] {
    return [...this.#records.values()].map(snapshot)
  }

  async load<T>(name: string, options: FeatureLoadOptions = {}): Promise<T> {
    if (this.#disposed) throw new Error('FeatureModuleLoader is disposed')
    return this.#loadInternal<T>(name, options, [])
  }

  prefetch(name: string): Promise<unknown> {
    return this.load(name).catch(() => undefined)
  }

  schedulePrefetch(names: string[], scheduler: IdlePrefetchScheduler): () => void {
    if (this.#disposed) return () => {}
    return scheduler(async () => {
      for (const name of names) {
        if (this.#disposed) return
        await this.prefetch(name)
      }
    })
  }

  async disable(name: string): Promise<void> {
    const record = this.#require(name)
    record.controller?.abort(new DOMException(`Feature disabled: ${name}`, 'AbortError'))
    if (record.value !== undefined) await record.definition.dispose?.(record.value)
    record.value = undefined
    record.promise = undefined
    record.controller = undefined
    record.error = undefined
    record.loadedAt = undefined
    record.failedAt = undefined
    this.#setState(record, 'disabled')
  }

  enable(name: string): void {
    const record = this.#require(name)
    if (record.state !== 'disabled') return
    record.error = undefined
    record.promise = undefined
    record.controller = undefined
    this.#setState(record, 'idle')
  }

  async reset(name: string): Promise<void> {
    const record = this.#require(name)
    record.controller?.abort(new DOMException(`Feature reset: ${name}`, 'AbortError'))
    if (record.value !== undefined) await record.definition.dispose?.(record.value)
    record.value = undefined
    record.error = undefined
    record.promise = undefined
    record.controller = undefined
    record.loadedAt = undefined
    record.failedAt = undefined
    this.#setState(record, 'idle')
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    for (const record of this.#records.values()) record.controller?.abort(new DOMException('Feature loader disposed', 'AbortError'))
    await Promise.all([...this.#records.values()].map(async record => {
      try {
        if (record.value !== undefined) await record.definition.dispose?.(record.value)
      }
      finally {
        record.value = undefined
        record.promise = undefined
        record.controller = undefined
        this.#setState(record, 'disposed')
      }
    }))
    this.#listeners.clear()
  }

  async #loadInternal<T>(name: string, options: FeatureLoadOptions, stack: string[]): Promise<T> {
    const record = this.#require(name)
    if (record.state === 'disabled') throw new Error(`Feature is disabled: ${name}`)
    if (record.state === 'disposed') throw new Error(`Feature is disposed: ${name}`)
    if (record.state === 'ready' || record.state === 'fallback') return record.value as T
    if (record.state === 'loading' && record.promise) return record.promise as Promise<T>
    if (record.state === 'failed' && !options.retry) throw record.error
    if (stack.includes(name)) throw new Error(`Feature dependency cycle: ${[...stack, name].join(' -> ')}`)

    const dependencyValues = new Map<string, unknown>()
    for (const dependency of record.definition.dependencies ?? []) {
      dependencyValues.set(dependency, await this.#loadInternal(dependency, options, [...stack, name]))
    }

    const controller = new AbortController()
    const detachSignal = pipeAbort(options.signal, controller)
    const context: FeatureLoadContext = { name, signal: controller.signal, dependencyValues }
    record.attempts += 1
    record.error = undefined
    record.controller = controller
    this.#setState(record, 'loading')

    const promise = (async () => {
      try {
        const value = await withTimeout(
          Promise.resolve(record.definition.load(context)),
          record.definition.timeoutMs,
          controller,
          name,
        )
        if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException('Aborted', 'AbortError')
        record.value = value
        record.loadedAt = this.now()
        record.failedAt = undefined
        this.#setState(record, 'ready')
        return value as T
      }
      catch (error) {
        if (this.#disposed || record.state === 'disposed' || record.state === 'disabled') throw error
        if (record.definition.fallback && !isAbortError(error)) {
          try {
            const fallbackValue = await record.definition.fallback(error, context)
            record.value = fallbackValue
            record.error = error
            record.loadedAt = this.now()
            this.#setState(record, 'fallback', error)
            return fallbackValue as T
          }
          catch (fallbackError) {
            error = new AggregateError([error, fallbackError], `Feature and fallback failed: ${name}`)
          }
        }
        record.value = undefined
        record.error = error
        record.failedAt = this.now()
        this.#setState(record, 'failed', error)
        throw error
      }
      finally {
        detachSignal()
        record.promise = undefined
        record.controller = undefined
      }
    })()
    record.promise = promise
    return promise as Promise<T>
  }

  #require(name: string): FeatureRecord {
    const record = this.#records.get(name)
    if (!record) throw new Error(`Unknown feature: ${name}`)
    return record
  }

  #setState(record: FeatureRecord, state: FeatureLoadState, error?: unknown): void {
    const previous = record.state
    record.state = state
    if (previous === state && error === undefined) return
    const event = { name: record.definition.name, previous, current: state, at: this.now(), error }
    for (const listener of this.#listeners) listener(event)
  }
}

export function validateFeatureGraph(definitions: FeatureDefinition[]): string[] {
  const map = new Map(definitions.map(definition => [definition.name, definition]))
  if (map.size !== definitions.length) throw new Error('Feature graph contains duplicate names')
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []

  const visit = (name: string, path: string[]) => {
    if (visited.has(name)) return
    if (visiting.has(name)) throw new Error(`Feature dependency cycle: ${[...path, name].join(' -> ')}`)
    const definition = map.get(name)
    if (!definition) throw new Error(`Unknown feature dependency: ${name}`)
    visiting.add(name)
    for (const dependency of definition.dependencies ?? []) visit(dependency, [...path, name])
    visiting.delete(name)
    visited.add(name)
    order.push(name)
  }

  for (const definition of definitions) {
    validateDefinition(definition)
    visit(definition.name, [])
  }
  return order
}

function validateDefinition(definition: FeatureDefinition): void {
  if (!definition.name.trim()) throw new Error('Feature name is required')
  if (typeof definition.load !== 'function') throw new Error(`Feature loader is required: ${definition.name}`)
  if (definition.timeoutMs !== undefined && (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)) {
    throw new Error(`Feature timeout must be positive: ${definition.name}`)
  }
  const dependencies = definition.dependencies ?? []
  if (new Set(dependencies).size !== dependencies.length) throw new Error(`Feature dependencies contain duplicates: ${definition.name}`)
  if (dependencies.includes(definition.name)) throw new Error(`Feature cannot depend on itself: ${definition.name}`)
}

function snapshot(record: FeatureRecord): FeatureStatus {
  return {
    name: record.definition.name,
    state: record.state,
    attempts: record.attempts,
    loadedAt: record.loadedAt,
    failedAt: record.failedAt,
    error: record.error,
    dependencies: [...(record.definition.dependencies ?? [])],
  }
}

function pipeAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => {}
  const abort = () => controller.abort(signal.reason ?? new DOMException('Aborted', 'AbortError'))
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  return () => signal.removeEventListener('abort', abort)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, controller: AbortController, name: string): Promise<T> {
  if (timeoutMs === undefined) return promise
  let handle: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => {
      const error = new Error(`Feature load timed out after ${timeoutMs}ms: ${name}`)
      controller.abort(error)
      reject(error)
    }, timeoutMs)
  })
  try { return await Promise.race([promise, timeout]) }
  finally { if (handle !== undefined) clearTimeout(handle) }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
