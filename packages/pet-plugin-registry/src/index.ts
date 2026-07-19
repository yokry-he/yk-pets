/**
 * 文件职责 / File responsibility
 * 定义插件清单、语义版本兼容检查、依赖解析、能力冲突和插件生命周期。
 * Defines plugin manifests, semantic-version compatibility checks, dependency resolution, capability conflicts, and plugin lifecycle.
 */

export interface PluginCapability {
  id: string
  version?: string
  exclusive?: boolean
}

export interface YkPetsPluginManifest {
  schema: 'yk-pets.plugin/v1'
  id: string
  name: string
  version: string
  description?: string
  engines: {
    ykPets: string
    petCore?: string
    api?: string
  }
  entrypoints: {
    browser?: string
    worker?: string
    server?: string
    styles?: string[]
  }
  capabilities?: {
    provides?: PluginCapability[]
    requires?: PluginCapability[]
  }
  permissions?: {
    tools?: string[]
    scopes?: string[]
    origins?: string[]
  }
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  integrity?: {
    algorithm: 'sha256'
    digest: string
  }
}

export interface PluginContext {
  manifest: YkPetsPluginManifest
  getPlugin(id: string): PluginModule | undefined
  resolveCapability(id: string): PluginModule | undefined
}

export interface PluginModule {
  activate?(context: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
  [key: string]: unknown
}

export type PluginStatus = 'registered' | 'active' | 'failed' | 'disabled'

export interface RegisteredPlugin {
  manifest: YkPetsPluginManifest
  module: PluginModule
  status: PluginStatus
  error?: string
}

export interface PluginRuntimeEnvironment {
  ykPetsVersion: string
  petCoreVersion?: string
  apiVersion?: string
  allowedTools?: string[]
  allowedScopes?: string[]
  allowedOrigins?: string[]
}

export interface CompatibilityIssue {
  code: string
  message: string
  path: string
  severity: 'error' | 'warning'
}

export interface CompatibilityReport {
  compatible: boolean
  issues: CompatibilityIssue[]
}

export class PluginRegistry {
  readonly environment: PluginRuntimeEnvironment
  #plugins = new Map<string, RegisteredPlugin>()
  #capabilities = new Map<string, { owners: string[]; exclusive: boolean }>()

  constructor(environment: PluginRuntimeEnvironment) {
    this.environment = { ...environment }
  }

  register(manifest: YkPetsPluginManifest, module: PluginModule): RegisteredPlugin {
    const report = checkPluginCompatibility(manifest, this.environment)
    if (!report.compatible) throw new PluginCompatibilityError(report)
    if (this.#plugins.has(manifest.id)) throw new Error(`Plugin already registered: ${manifest.id}`)

    for (const capability of manifest.capabilities?.provides ?? []) {
      const existing = this.#capabilities.get(capability.id)
      if (existing && (existing.exclusive || capability.exclusive !== false)) {
        throw new Error(`Exclusive capability conflict: ${capability.id} already provided by ${existing.owners.join(', ')}`)
      }
    }

    const record: RegisteredPlugin = {
      manifest: deepFreezeManifest(manifest),
      module,
      status: 'registered',
    }
    this.#plugins.set(manifest.id, record)
    for (const capability of manifest.capabilities?.provides ?? []) {
      const existing = this.#capabilities.get(capability.id)
      if (existing) existing.owners.push(manifest.id)
      else this.#capabilities.set(capability.id, { owners: [manifest.id], exclusive: capability.exclusive !== false })
    }
    return record
  }

  unregister(id: string): boolean {
    const record = this.#plugins.get(id)
    if (!record) return false
    if (record.status === 'active') throw new Error(`Deactivate plugin before unregistering: ${id}`)
    this.#plugins.delete(id)
    for (const [capability, registration] of this.#capabilities) {
      registration.owners = registration.owners.filter(owner => owner !== id)
      if (!registration.owners.length) this.#capabilities.delete(capability)
    }
    return true
  }

  get(id: string): RegisteredPlugin | undefined { return this.#plugins.get(id) }
  list(): RegisteredPlugin[] { return [...this.#plugins.values()] }

  resolveCapability(id: string): PluginModule | undefined {
    const registration = this.#capabilities.get(id)
    if (!registration) return undefined
    const owner = registration.owners.find(candidate => this.#plugins.get(candidate)?.status === 'active') ?? registration.owners[0]
    return owner ? this.#plugins.get(owner)?.module : undefined
  }

  activationOrder(ids = [...this.#plugins.keys()]): string[] {
    const selected = new Set(ids)
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (id: string, chain: string[]) => {
      if (visited.has(id)) return
      if (visiting.has(id)) throw new Error(`Plugin dependency cycle: ${[...chain, id].join(' -> ')}`)
      const record = this.#plugins.get(id)
      if (!record) throw new Error(`Plugin is not registered: ${id}`)
      visiting.add(id)
      for (const [dependencyId, range] of Object.entries(record.manifest.dependencies ?? {})) {
        const dependency = this.#plugins.get(dependencyId)
        if (!dependency) throw new Error(`Missing required plugin dependency: ${dependencyId}`)
        if (!satisfiesVersion(dependency.manifest.version, range)) throw new Error(`Incompatible plugin dependency ${dependencyId}: ${dependency.manifest.version} does not satisfy ${range}`)
        selected.add(dependencyId)
        visit(dependencyId, [...chain, id])
      }
      for (const requirement of record.manifest.capabilities?.requires ?? []) {
        const registration = this.#capabilities.get(requirement.id)
        const providerId = registration?.owners[0]
        if (!providerId) throw new Error(`Missing required capability: ${requirement.id}`)
        if (providerId !== id) {
          selected.add(providerId)
          visit(providerId, [...chain, id])
        }
      }
      visiting.delete(id)
      visited.add(id)
      order.push(id)
    }

    for (const id of selected) visit(id, [])
    return order
  }

  async activate(ids?: string[]): Promise<string[]> {
    const order = this.activationOrder(ids)
    for (const id of order) {
      const record = this.#plugins.get(id)!
      if (record.status === 'active') continue
      this.#assertCapabilities(record.manifest)
      try {
        await record.module.activate?.({
          manifest: record.manifest,
          getPlugin: pluginId => this.#plugins.get(pluginId)?.module,
          resolveCapability: capabilityId => this.resolveCapability(capabilityId),
        })
        record.status = 'active'
        record.error = undefined
      }
      catch (error) {
        record.status = 'failed'
        record.error = error instanceof Error ? error.message : String(error)
        throw error
      }
    }
    return order
  }

  async deactivate(ids?: string[]): Promise<string[]> {
    const order = this.activationOrder(ids).reverse()
    for (const id of order) {
      const record = this.#plugins.get(id)!
      if (record.status !== 'active') continue
      await record.module.deactivate?.()
      record.status = 'registered'
    }
    return order
  }

  #assertCapabilities(manifest: YkPetsPluginManifest): void {
    for (const requirement of manifest.capabilities?.requires ?? []) {
      const registration = this.#capabilities.get(requirement.id)
      const owner = registration?.owners[0]
      if (!owner) throw new Error(`Missing required capability: ${requirement.id}`)
      if (requirement.version) {
        const provider = this.#plugins.get(owner)?.manifest.capabilities?.provides?.find(item => item.id === requirement.id)
        if (!provider?.version || !satisfiesVersion(provider.version, requirement.version)) {
          throw new Error(`Capability ${requirement.id} does not satisfy ${requirement.version}`)
        }
      }
    }
  }
}

export class PluginCompatibilityError extends Error {
  readonly report: CompatibilityReport

  constructor(report: CompatibilityReport) {
    super(report.issues.map(issue => issue.message).join('; '))
    this.name = 'PluginCompatibilityError'
    this.report = report
  }
}

export function validatePluginManifest(manifest: YkPetsPluginManifest): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = []
  if (manifest.schema !== 'yk-pets.plugin/v1') issues.push(error('schema', 'Unsupported plugin schema', 'schema'))
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(manifest.id)) issues.push(error('id', 'Plugin id must be reverse-domain-like lowercase segments', 'id'))
  if (!manifest.name?.trim()) issues.push(error('name', 'Plugin name is required', 'name'))
  if (!parseVersion(manifest.version)) issues.push(error('version', 'Plugin version must be semantic version', 'version'))
  if (!manifest.engines?.ykPets) issues.push(error('engine', 'engines.ykPets is required', 'engines.ykPets'))
  if (!Object.values(manifest.entrypoints ?? {}).some(value => Array.isArray(value) ? value.length : Boolean(value))) issues.push(error('entrypoint', 'At least one entrypoint is required', 'entrypoints'))
  if (manifest.integrity && !/^[a-f0-9]{64}$/i.test(manifest.integrity.digest)) issues.push(error('integrity', 'SHA-256 digest must contain 64 hexadecimal characters', 'integrity.digest'))

  const provides = manifest.capabilities?.provides ?? []
  if (new Set(provides.map(item => item.id)).size !== provides.length) issues.push(error('capability-duplicate', 'Provided capability ids must be unique', 'capabilities.provides'))
  const dependencies = manifest.dependencies ?? {}
  if (manifest.id in dependencies) issues.push(error('dependency-self', 'Plugin cannot depend on itself', 'dependencies'))
  for (const [id, range] of Object.entries({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
    if (!id || !range || !isValidRange(range)) issues.push(error('dependency-range', `Invalid dependency range for ${id}`, `dependencies.${id}`))
  }
  return issues
}

export function checkPluginCompatibility(manifest: YkPetsPluginManifest, environment: PluginRuntimeEnvironment): CompatibilityReport {
  const issues = validatePluginManifest(manifest)
  if (manifest.engines?.ykPets && !satisfiesVersion(environment.ykPetsVersion, manifest.engines.ykPets)) {
    issues.push(error('engine-yk-pets', `YK Pets ${environment.ykPetsVersion} does not satisfy ${manifest.engines.ykPets}`, 'engines.ykPets'))
  }
  if (manifest.engines?.petCore) {
    if (!environment.petCoreVersion) issues.push(error('engine-pet-core-missing', 'pet-core runtime is unavailable', 'engines.petCore'))
    else if (!satisfiesVersion(environment.petCoreVersion, manifest.engines.petCore)) issues.push(error('engine-pet-core', `pet-core ${environment.petCoreVersion} does not satisfy ${manifest.engines.petCore}`, 'engines.petCore'))
  }
  if (manifest.engines?.api) {
    if (!environment.apiVersion) issues.push(error('engine-api-missing', 'Plugin API runtime is unavailable', 'engines.api'))
    else if (!satisfiesVersion(environment.apiVersion, manifest.engines.api)) issues.push(error('engine-api', `Plugin API ${environment.apiVersion} does not satisfy ${manifest.engines.api}`, 'engines.api'))
  }

  for (const tool of manifest.permissions?.tools ?? []) if (!matchesPermission(environment.allowedTools, tool)) issues.push(error('permission-tool', `Tool permission is not allowed: ${tool}`, 'permissions.tools'))
  for (const scope of manifest.permissions?.scopes ?? []) if (!matchesPermission(environment.allowedScopes, scope)) issues.push(error('permission-scope', `Scope permission is not allowed: ${scope}`, 'permissions.scopes'))
  for (const origin of manifest.permissions?.origins ?? []) if (!matchesPermission(environment.allowedOrigins, origin)) issues.push(error('permission-origin', `Origin permission is not allowed: ${origin}`, 'permissions.origins'))

  return { compatible: !issues.some(issue => issue.severity === 'error'), issues }
}

interface SemVersion { major: number; minor: number; patch: number; prerelease?: string }

export function parseVersion(input: string): SemVersion | null {
  const match = input.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] }
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) throw new Error('Invalid semantic version')
  for (const key of ['major', 'minor', 'patch'] as const) if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1
  if (left.prerelease === right.prerelease) return 0
  if (!left.prerelease) return 1
  if (!right.prerelease) return -1
  return left.prerelease.localeCompare(right.prerelease)
}

export function satisfiesVersion(version: string, range: string): boolean {
  if (!parseVersion(version) || !isValidRange(range)) return false
  return range.split('||').some(group => group.trim().split(/\s+/).filter(Boolean).every(token => satisfiesToken(version, token)))
}

export function isValidRange(range: string): boolean {
  if (!range.trim()) return false
  return range.split('||').every(group => group.trim().split(/\s+/).filter(Boolean).every(token => {
    if (token === '*' || /^\d+(?:\.x|\.\*)?(?:\.x|\.\*)?$/.test(token)) return true
    if (/^[~^]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(token)) return true
    if (/^(?:>=|<=|>|<|=)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(token)) return true
    return false
  }))
}

function satisfiesToken(version: string, token: string): boolean {
  if (token === '*') return true
  if (/^\d+$/.test(token)) return parseVersion(version)!.major === Number(token)
  const wildcard = token.match(/^(\d+)\.(x|\*|\d+)(?:\.(x|\*|\d+))?$/)
  if (wildcard && (wildcard[2] === 'x' || wildcard[2] === '*' || wildcard[3] === 'x' || wildcard[3] === '*')) {
    const parsed = parseVersion(version)!
    if (parsed.major !== Number(wildcard[1])) return false
    if (wildcard[2] !== 'x' && wildcard[2] !== '*' && parsed.minor !== Number(wildcard[2])) return false
    if (wildcard[3] && wildcard[3] !== 'x' && wildcard[3] !== '*' && parsed.patch !== Number(wildcard[3])) return false
    return true
  }

  const comparator = token.match(/^(>=|<=|>|<|=)?(.+)$/)!
  const operator = comparator[1] ?? '='
  const target = comparator[2]!
  if (target.startsWith('^')) {
    const base = target.slice(1)
    const parsed = parseVersion(base)!
    const upper = parsed.major > 0 ? `${parsed.major + 1}.0.0` : parsed.minor > 0 ? `0.${parsed.minor + 1}.0` : `0.0.${parsed.patch + 1}`
    return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0
  }
  if (target.startsWith('~')) {
    const base = target.slice(1)
    const parsed = parseVersion(base)!
    const upper = `${parsed.major}.${parsed.minor + 1}.0`
    return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0
  }
  const compared = compareVersions(version, target)
  return operator === '>' ? compared > 0 : operator === '>=' ? compared >= 0 : operator === '<' ? compared < 0 : operator === '<=' ? compared <= 0 : compared === 0
}

function matchesPermission(allowed: string[] | undefined, requested: string): boolean {
  if (!allowed) return false
  return allowed.some(pattern => permissionPatternCovers(pattern, requested))
}

function permissionPatternCovers(allowed: string, requested: string): boolean {
  if (allowed === '*' || allowed === requested) return true
  // A plugin cannot escalate a narrow host allowlist by requesting its own wildcard.
  if (requested.includes('*')) return false
  return wildcardMatch(allowed, requested)
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(value)
}

function error(code: string, message: string, path: string): CompatibilityIssue {
  return { code, message, path, severity: 'error' }
}

function deepFreezeManifest(manifest: YkPetsPluginManifest): YkPetsPluginManifest {
  const copy = JSON.parse(JSON.stringify(manifest)) as YkPetsPluginManifest
  const freeze = (value: unknown): unknown => {
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  return freeze(copy) as YkPetsPluginManifest
}
