/**
 * Per-site controls for the YK Pets browser pet.
 * The module is browser-API agnostic and can be backed by chrome.storage.local.
 */

export type SitePetMode = 'enabled' | 'paused' | 'hidden'
export type SiteRendererPreference = 'auto' | '2d' | '3d'

export interface SitePolicy {
  mode: SitePetMode
  renderer: SiteRendererPreference
  audioEnabled: boolean
  interactionsEnabled: boolean
  auditEnabled: boolean
}

export interface SitePolicyPatch {
  mode?: SitePetMode
  renderer?: SiteRendererPreference
  audioEnabled?: boolean
  interactionsEnabled?: boolean
  auditEnabled?: boolean
}

export interface SiteRule {
  id: string
  pattern: string
  policy: SitePolicyPatch
  priority?: number
  createdAt: number
  updatedAt: number
}

export interface SitePolicySnapshot {
  schema: 'yk-pets.site-policy/v1'
  defaultPolicy: SitePolicy
  rules: SiteRule[]
}

export interface ResolvedSitePolicy extends SitePolicy {
  url: string
  origin: string
  siteKey: string
  matchedRuleIds: string[]
  sessionOverride: boolean
}

export interface AsyncKeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  remove?(key: string): Promise<void>
}

export interface ChromeStorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove?(keys: string | string[]): Promise<void>
}

export interface SitePolicyManagerOptions {
  storageKey?: string
  now?: () => number
  defaultPolicy?: SitePolicyPatch
}

export interface SessionOverride {
  siteKey: string
  policy: SitePolicyPatch
  expiresAt?: number
}

export interface SitePolicyChangeEvent {
  type: 'default' | 'rule-added' | 'rule-updated' | 'rule-removed' | 'session' | 'import'
  at: number
  ruleId?: string
  siteKey?: string
}

interface ParsedSite {
  url: string
  protocol: string
  host: string
  hostname: string
  pathname: string
  origin: string
  siteKey: string
}

interface CompiledPattern {
  matches(site: ParsedSite): boolean
  specificity: number
}

const DEFAULT_POLICY: SitePolicy = Object.freeze({
  mode: 'enabled',
  renderer: 'auto',
  audioEnabled: true,
  interactionsEnabled: true,
  auditEnabled: true,
})

const VALID_MODES = new Set<SitePetMode>(['enabled', 'paused', 'hidden'])
const VALID_RENDERERS = new Set<SiteRendererPreference>(['auto', '2d', '3d'])

type Listener = (event: SitePolicyChangeEvent) => void

export class MemoryKeyValueStore implements AsyncKeyValueStore {
  readonly values = new Map<string, unknown>()

  async get(key: string): Promise<unknown> {
    return clone(this.values.get(key))
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, clone(value))
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }
}

export function createChromeStorageAdapter(area: ChromeStorageAreaLike): AsyncKeyValueStore {
  return {
    async get(key) {
      const result = await area.get(key)
      return clone(result[key])
    },
    async set(key, value) {
      await area.set({ [key]: clone(value) })
    },
    async remove(key) {
      await area.remove?.(key)
    },
  }
}

export class SitePolicyManager {
  readonly storage: AsyncKeyValueStore
  readonly storageKey: string
  readonly now: () => number

  #snapshot: SitePolicySnapshot
  #loaded = false
  #loading: Promise<void> | null = null
  #session = new Map<string, SessionOverride>()
  #listeners = new Set<Listener>()

  constructor(storage: AsyncKeyValueStore = new MemoryKeyValueStore(), options: SitePolicyManagerOptions = {}) {
    this.storage = storage
    this.storageKey = options.storageKey ?? 'yk-pets.site-policy.v1'
    this.now = options.now ?? Date.now
    this.#snapshot = {
      schema: 'yk-pets.site-policy/v1',
      defaultPolicy: mergePolicy(DEFAULT_POLICY, options.defaultPolicy),
      rules: [],
    }
  }

  onChange(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async load(): Promise<void> {
    if (this.#loaded) return
    if (this.#loading) return this.#loading
    this.#loading = (async () => {
      const stored = await this.storage.get(this.storageKey)
      if (stored !== undefined && stored !== null) this.#snapshot = validateSnapshot(stored)
      this.#loaded = true
      this.#loading = null
    })()
    return this.#loading
  }

  async getSnapshot(): Promise<SitePolicySnapshot> {
    await this.load()
    return clone(this.#snapshot)
  }

  async setDefaultPolicy(policy: SitePolicyPatch): Promise<SitePolicy> {
    await this.load()
    this.#snapshot.defaultPolicy = mergePolicy(this.#snapshot.defaultPolicy, validatePolicyPatch(policy))
    await this.#persist()
    this.#emit({ type: 'default', at: this.now() })
    return clone(this.#snapshot.defaultPolicy)
  }

  async listRules(): Promise<SiteRule[]> {
    await this.load()
    return clone(this.#snapshot.rules)
  }

  async addRule(input: Omit<SiteRule, 'createdAt' | 'updatedAt'> & Partial<Pick<SiteRule, 'createdAt' | 'updatedAt'>>): Promise<SiteRule> {
    await this.load()
    if (!input.id.trim()) throw new Error('Site rule id is required')
    if (this.#snapshot.rules.some(rule => rule.id === input.id)) throw new Error(`Site rule already exists: ${input.id}`)
    compilePattern(input.pattern)
    const at = this.now()
    const rule: SiteRule = {
      id: input.id,
      pattern: input.pattern,
      policy: validatePolicyPatch(input.policy),
      priority: normalizePriority(input.priority),
      createdAt: input.createdAt ?? at,
      updatedAt: input.updatedAt ?? at,
    }
    this.#snapshot.rules.push(rule)
    await this.#persist()
    this.#emit({ type: 'rule-added', at, ruleId: rule.id })
    return clone(rule)
  }

  async updateRule(id: string, patch: Partial<Pick<SiteRule, 'pattern' | 'policy' | 'priority'>>): Promise<SiteRule> {
    await this.load()
    const rule = this.#snapshot.rules.find(candidate => candidate.id === id)
    if (!rule) throw new Error(`Unknown site rule: ${id}`)
    if (patch.pattern !== undefined) {
      compilePattern(patch.pattern)
      rule.pattern = patch.pattern
    }
    if (patch.policy !== undefined) rule.policy = validatePolicyPatch(patch.policy)
    if (patch.priority !== undefined) rule.priority = normalizePriority(patch.priority)
    rule.updatedAt = this.now()
    await this.#persist()
    this.#emit({ type: 'rule-updated', at: rule.updatedAt, ruleId: id })
    return clone(rule)
  }

  async removeRule(id: string): Promise<boolean> {
    await this.load()
    const index = this.#snapshot.rules.findIndex(rule => rule.id === id)
    if (index < 0) return false
    this.#snapshot.rules.splice(index, 1)
    await this.#persist()
    this.#emit({ type: 'rule-removed', at: this.now(), ruleId: id })
    return true
  }

  setSessionOverride(url: string, policy: SitePolicyPatch, ttlMs?: number): SessionOverride {
    const site = parseSite(url)
    if (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0)) throw new Error('Session override ttlMs must be positive')
    const override: SessionOverride = {
      siteKey: site.siteKey,
      policy: validatePolicyPatch(policy),
      expiresAt: ttlMs === undefined ? undefined : this.now() + ttlMs,
    }
    this.#session.set(site.siteKey, override)
    this.#emit({ type: 'session', at: this.now(), siteKey: site.siteKey })
    return clone(override)
  }

  clearSessionOverride(urlOrSiteKey: string): boolean {
    let siteKey = urlOrSiteKey
    try { siteKey = parseSite(urlOrSiteKey).siteKey }
    catch { /* already a site key */ }
    const removed = this.#session.delete(siteKey)
    if (removed) this.#emit({ type: 'session', at: this.now(), siteKey })
    return removed
  }

  async resolve(url: string): Promise<ResolvedSitePolicy> {
    await this.load()
    const site = parseSite(url)
    const matched = this.#snapshot.rules
      .map(rule => ({ rule, compiled: compilePattern(rule.pattern) }))
      .filter(item => item.compiled.matches(site))
      .sort((a, b) => {
        const specificity = a.compiled.specificity - b.compiled.specificity
        if (specificity !== 0) return specificity
        const priority = (a.rule.priority ?? 0) - (b.rule.priority ?? 0)
        if (priority !== 0) return priority
        return a.rule.updatedAt - b.rule.updatedAt
      })

    let policy = clone(this.#snapshot.defaultPolicy)
    for (const { rule } of matched) policy = mergePolicy(policy, rule.policy)

    let sessionOverride = false
    const session = this.#session.get(site.siteKey)
    if (session) {
      if (session.expiresAt !== undefined && session.expiresAt <= this.now()) this.#session.delete(site.siteKey)
      else {
        policy = mergePolicy(policy, session.policy)
        sessionOverride = true
      }
    }

    return {
      ...policy,
      url: site.url,
      origin: site.origin,
      siteKey: site.siteKey,
      matchedRuleIds: matched.map(item => item.rule.id),
      sessionOverride,
    }
  }

  async exportSnapshot(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2)
  }

  async importSnapshot(value: string | unknown): Promise<SitePolicySnapshot> {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    this.#snapshot = validateSnapshot(parsed)
    this.#loaded = true
    await this.#persist()
    this.#emit({ type: 'import', at: this.now() })
    return clone(this.#snapshot)
  }

  async reset(): Promise<void> {
    this.#snapshot = { schema: 'yk-pets.site-policy/v1', defaultPolicy: clone(DEFAULT_POLICY), rules: [] }
    this.#session.clear()
    this.#loaded = true
    await this.storage.remove?.(this.storageKey)
    this.#emit({ type: 'import', at: this.now() })
  }

  async #persist(): Promise<void> {
    await this.storage.set(this.storageKey, clone(this.#snapshot))
  }

  #emit(event: SitePolicyChangeEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
}

export function getSiteKey(url: string): string {
  return parseSite(url).siteKey
}

export function matchesSitePattern(pattern: string, url: string): boolean {
  return compilePattern(pattern).matches(parseSite(url))
}

export function validateSitePolicySnapshot(value: unknown): SitePolicySnapshot {
  return validateSnapshot(value)
}

function parseSite(value: string): ParsedSite {
  let url: URL
  try { url = new URL(value) }
  catch { throw new Error(`Invalid site URL: ${value}`) }
  const protocol = url.protocol.slice(0, -1).toLowerCase()
  const hostname = url.hostname.toLowerCase()
  const host = url.host.toLowerCase()
  const origin = url.origin === 'null' ? `${url.protocol}//${host}` : url.origin.toLowerCase()
  const siteKey = host ? `${protocol}://${host}` : `${protocol}://`
  return { url: url.href, protocol, host, hostname, pathname: url.pathname || '/', origin, siteKey }
}

function compilePattern(pattern: string): CompiledPattern {
  const input = pattern.trim()
  if (!input) throw new Error('Site pattern is required')
  if (input === '<all_urls>' || input === '*') return { matches: () => true, specificity: 0 }

  let schemePattern = '*'
  let hostPattern = input
  let pathPattern = '/*'

  if (input.includes('://')) {
    const match = /^([^:]+):\/\/([^/]*)(\/.*)?$/.exec(input)
    if (!match) throw new Error(`Invalid site pattern: ${pattern}`)
    schemePattern = match[1]!.toLowerCase()
    hostPattern = match[2]!.toLowerCase()
    pathPattern = match[3] ?? '/*'
  }
  else {
    const slash = input.indexOf('/')
    if (slash >= 0) {
      hostPattern = input.slice(0, slash).toLowerCase()
      pathPattern = input.slice(slash)
    }
    else hostPattern = input.toLowerCase()
  }

  if (!hostPattern && schemePattern !== 'file') throw new Error(`Invalid site pattern host: ${pattern}`)
  if (schemePattern !== '*' && !/^[a-z][a-z0-9+.-]*$/.test(schemePattern)) throw new Error(`Invalid site pattern scheme: ${pattern}`)
  if (hostPattern.includes('**')) throw new Error(`Invalid site pattern wildcard: ${pattern}`)

  const schemeRegex = wildcardRegex(schemePattern)
  const hostRegex = hostPattern.startsWith('*.')
    ? new RegExp(`^(?:[^.]+\\.)*${escapeRegex(hostPattern.slice(2))}$`, 'i')
    : wildcardRegex(hostPattern)
  const pathRegex = wildcardRegex(pathPattern)
  const specificity = nonWildcardLength(schemePattern) * 10_000 + nonWildcardLength(hostPattern) * 100 + nonWildcardLength(pathPattern)

  return {
    specificity,
    matches(site) {
      const candidateHost = hostPattern.includes(':') ? site.host : site.hostname
      return schemeRegex.test(site.protocol) && hostRegex.test(candidateHost) && pathRegex.test(site.pathname)
    },
  }
}

function wildcardRegex(value: string): RegExp {
  return new RegExp(`^${value.split('*').map(escapeRegex).join('.*')}$`, 'i')
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&')
}

function nonWildcardLength(value: string): number {
  return value.replace(/\*/g, '').length
}

function normalizePriority(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error('Site rule priority must be an integer')
  return Math.max(-10_000, Math.min(10_000, value))
}

function mergePolicy(base: SitePolicy, patch: SitePolicyPatch | undefined): SitePolicy {
  if (!patch) return clone(base)
  return {
    mode: patch.mode ?? base.mode,
    renderer: patch.renderer ?? base.renderer,
    audioEnabled: patch.audioEnabled ?? base.audioEnabled,
    interactionsEnabled: patch.interactionsEnabled ?? base.interactionsEnabled,
    auditEnabled: patch.auditEnabled ?? base.auditEnabled,
  }
}

function validatePolicyPatch(value: unknown): SitePolicyPatch {
  if (!isRecord(value)) throw new Error('Site policy patch must be an object')
  const output: SitePolicyPatch = {}
  if (value.mode !== undefined) {
    if (!VALID_MODES.has(value.mode as SitePetMode)) throw new Error(`Invalid site mode: ${String(value.mode)}`)
    output.mode = value.mode as SitePetMode
  }
  if (value.renderer !== undefined) {
    if (!VALID_RENDERERS.has(value.renderer as SiteRendererPreference)) throw new Error(`Invalid renderer preference: ${String(value.renderer)}`)
    output.renderer = value.renderer as SiteRendererPreference
  }
  for (const key of ['audioEnabled', 'interactionsEnabled', 'auditEnabled'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') throw new Error(`${key} must be boolean`)
      output[key] = value[key]
    }
  }
  return output
}

function validateSnapshot(value: unknown): SitePolicySnapshot {
  if (!isRecord(value) || value.schema !== 'yk-pets.site-policy/v1') throw new Error('Invalid site policy snapshot schema')
  if (!isRecord(value.defaultPolicy)) throw new Error('Invalid default site policy')
  const defaultPatch = validatePolicyPatch(value.defaultPolicy)
  const defaultPolicy = mergePolicy(DEFAULT_POLICY, defaultPatch)
  if (!Array.isArray(value.rules)) throw new Error('Site policy rules must be an array')
  const ids = new Set<string>()
  const rules = value.rules.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`Site rule ${index} must be an object`)
    const id = String(candidate.id ?? '').trim()
    const pattern = String(candidate.pattern ?? '').trim()
    if (!id || ids.has(id)) throw new Error(`Invalid or duplicate site rule id: ${id}`)
    ids.add(id)
    compilePattern(pattern)
    const createdAt = Number(candidate.createdAt)
    const updatedAt = Number(candidate.updatedAt)
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) throw new Error(`Invalid timestamps for site rule: ${id}`)
    return {
      id,
      pattern,
      policy: validatePolicyPatch(candidate.policy),
      priority: normalizePriority(candidate.priority === undefined ? undefined : Number(candidate.priority)),
      createdAt,
      updatedAt,
    }
  })
  return { schema: 'yk-pets.site-policy/v1', defaultPolicy, rules }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  if (value === undefined) return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T
}
