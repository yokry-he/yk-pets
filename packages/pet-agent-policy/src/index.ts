/**
 * 文件职责 / File responsibility
 * 定义 Agent 工具能力、权限策略、确认令牌、执行包装器和审计记录。
 * Defines agent tool capabilities, permission policies, confirmation tokens, execution wrappers, and audit records.
 */

export type ToolRisk = 'low' | 'medium' | 'high' | 'critical'
export type ToolSideEffect = 'none' | 'read' | 'write' | 'network' | 'execute'
export type ToolExecutionLocation = 'browser' | 'local-agent' | 'server'
export type ToolConfirmationMode = 'never' | 'once' | 'every-time'

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  enum?: unknown[]
  additionalProperties?: boolean
}

export interface ToolCapabilityDeclaration {
  id: string
  version: string
  title: string
  description: string
  scopes: string[]
  risk: ToolRisk
  sideEffects: ToolSideEffect[]
  execution: ToolExecutionLocation
  confirmation: ToolConfirmationMode
  inputSchema?: JsonSchema
  outputSchema?: JsonSchema
  allowedOrigins?: string[]
  allowedProjectPatterns?: string[]
  timeoutMs?: number
  audit?: boolean
}

export interface PermissionGrant {
  id: string
  subject: string
  toolPattern: string
  scopes: string[]
  origins?: string[]
  projects?: string[]
  expiresAt?: number
  maxUses?: number
  uses?: number
  confirmation: 'prompt' | 'preapproved'
}

export interface PolicyRule {
  id: string
  effect: 'allow' | 'deny'
  toolPattern: string
  subjectPattern?: string
  scopes?: string[]
  origins?: string[]
  projects?: string[]
  reason?: string
}

export interface PolicyContext {
  subject: string
  toolId: string
  requestedScopes: string[]
  origin?: string
  projectRoot?: string
  now?: number
  interactive?: boolean
  confirmationToken?: string
}

export interface PolicyDecision {
  allow: boolean
  reason: string
  requiresConfirmation: boolean
  matchedGrantIds: string[]
  matchedRuleIds: string[]
  effectiveScopes: string[]
}

export interface AuditRecord {
  id: string
  at: number
  subject: string
  toolId: string
  decision: 'allow' | 'deny' | 'confirm'
  reason: string
  scopes: string[]
  origin?: string
  projectRoot?: string
  durationMs?: number
  success?: boolean
  error?: string
}

export class ToolCatalog {
  #tools = new Map<string, ToolCapabilityDeclaration>()

  register(declaration: ToolCapabilityDeclaration): void {
    validateToolDeclaration(declaration)
    if (this.#tools.has(declaration.id)) throw new Error(`Tool already registered: ${declaration.id}`)
    this.#tools.set(declaration.id, freezeTool(declaration))
  }

  replace(declaration: ToolCapabilityDeclaration): void {
    validateToolDeclaration(declaration)
    this.#tools.set(declaration.id, freezeTool(declaration))
  }

  get(id: string): ToolCapabilityDeclaration | undefined { return this.#tools.get(id) }
  has(id: string): boolean { return this.#tools.has(id) }
  list(): ToolCapabilityDeclaration[] { return [...this.#tools.values()] }
}

export class PermissionStore {
  #grants = new Map<string, PermissionGrant>()

  grant(grant: PermissionGrant): void {
    if (!grant.id || !grant.subject || !grant.toolPattern) throw new Error('Invalid permission grant')
    if (grant.maxUses !== undefined && grant.maxUses < 1) throw new Error('maxUses must be positive')
    this.#grants.set(grant.id, { ...grant, scopes: [...grant.scopes], uses: grant.uses ?? 0 })
  }

  revoke(id: string): boolean { return this.#grants.delete(id) }
  list(): PermissionGrant[] {
    return [...this.#grants.values()].map(grant => ({
      ...grant,
      scopes: [...grant.scopes],
      origins: grant.origins ? [...grant.origins] : undefined,
      projects: grant.projects ? [...grant.projects] : undefined,
    }))
  }

  matching(context: PolicyContext): PermissionGrant[] {
    const now = context.now ?? Date.now()
    return [...this.#grants.values()].filter((grant) => {
      if (grant.subject !== context.subject && grant.subject !== '*') return false
      if (!wildcardMatch(grant.toolPattern, context.toolId)) return false
      if (grant.expiresAt !== undefined && grant.expiresAt <= now) return false
      if (grant.maxUses !== undefined && (grant.uses ?? 0) >= grant.maxUses) return false
      if (!covers(grant.scopes, context.requestedScopes)) return false
      if (grant.origins && !matchesAny(grant.origins, context.origin)) return false
      if (grant.projects && !matchesAny(grant.projects, context.projectRoot)) return false
      return true
    })
  }

  consume(ids: string[]): void {
    for (const id of ids) {
      const grant = this.#grants.get(id)
      if (grant) grant.uses = (grant.uses ?? 0) + 1
    }
  }
}

interface ConfirmationRecord {
  token: string
  subject: string
  toolId: string
  scopes: string[]
  expiresAt: number
  remainingUses: number
}

export class ConfirmationBroker {
  #tokens = new Map<string, ConfirmationRecord>()

  issue(input: { subject: string; toolId: string; scopes: string[]; ttlMs?: number; uses?: number; now?: number }): string {
    const now = input.now ?? Date.now()
    const token = `yk-pets-confirm-${randomId()}`
    this.#tokens.set(token, {
      token,
      subject: input.subject,
      toolId: input.toolId,
      scopes: [...input.scopes],
      expiresAt: now + (input.ttlMs ?? 60_000),
      remainingUses: input.uses ?? 1,
    })
    return token
  }

  consume(token: string | undefined, context: PolicyContext): boolean {
    if (!token) return false
    const record = this.#tokens.get(token)
    const now = context.now ?? Date.now()
    if (!record || record.expiresAt <= now || record.remainingUses <= 0) return false
    if (record.subject !== context.subject || record.toolId !== context.toolId) return false
    if (!covers(record.scopes, context.requestedScopes)) return false
    record.remainingUses -= 1
    if (record.remainingUses <= 0) this.#tokens.delete(token)
    return true
  }
}

export class MemoryAuditSink {
  #records: AuditRecord[] = []
  write(record: AuditRecord): void { this.#records.push({ ...record, scopes: [...record.scopes] }) }
  list(): AuditRecord[] { return this.#records.map(record => ({ ...record, scopes: [...record.scopes] })) }
  clear(): void { this.#records = [] }
}

export interface PolicyEngineOptions {
  rules?: PolicyRule[]
  grants?: PermissionStore
  confirmations?: ConfirmationBroker
  audit?: MemoryAuditSink
  allowLowRiskReadWithoutGrant?: boolean
}

export class PolicyEngine {
  readonly catalog: ToolCatalog
  readonly grants: PermissionStore
  readonly confirmations: ConfirmationBroker
  readonly audit: MemoryAuditSink
  readonly rules: PolicyRule[]
  readonly allowLowRiskReadWithoutGrant: boolean

  constructor(catalog: ToolCatalog, options: PolicyEngineOptions = {}) {
    this.catalog = catalog
    this.grants = options.grants ?? new PermissionStore()
    this.confirmations = options.confirmations ?? new ConfirmationBroker()
    this.audit = options.audit ?? new MemoryAuditSink()
    this.rules = [...(options.rules ?? [])]
    this.allowLowRiskReadWithoutGrant = options.allowLowRiskReadWithoutGrant ?? false
  }

  evaluate(context: PolicyContext): PolicyDecision {
    const tool = this.catalog.get(context.toolId)
    if (!tool) return this.#decision(context, false, 'Tool is not declared', false, [], [])
    if (!covers(tool.scopes, context.requestedScopes)) return this.#decision(context, false, 'Requested scope is not declared by the tool', false, [], [])
    if (tool.allowedOrigins && !matchesAny(tool.allowedOrigins, context.origin)) return this.#decision(context, false, 'Origin is outside tool declaration', false, [], [])
    if (tool.allowedProjectPatterns && !matchesAny(tool.allowedProjectPatterns, context.projectRoot)) return this.#decision(context, false, 'Project is outside tool declaration', false, [], [])

    const matchingRules = this.rules.filter(rule => ruleMatches(rule, context))
    const deny = matchingRules.find(rule => rule.effect === 'deny')
    if (deny) return this.#decision(context, false, deny.reason ?? 'Denied by policy rule', false, [], matchingRules.map(rule => rule.id))

    const matchingGrants = this.grants.matching(context)
    const implicitLowRiskRead = this.allowLowRiskReadWithoutGrant
      && tool.risk === 'low'
      && tool.sideEffects.every(effect => effect === 'none' || effect === 'read')
    const allowedByRule = matchingRules.some(rule => rule.effect === 'allow')
    const hasGrant = matchingGrants.length > 0
    if (!hasGrant && !allowedByRule && !implicitLowRiskRead) {
      return this.#decision(context, false, 'No matching permission grant', false, [], matchingRules.map(rule => rule.id))
    }

    const critical = tool.risk === 'critical'
    const promptGrant = matchingGrants.some(grant => grant.confirmation === 'prompt')
    const preapproved = matchingGrants.some(grant => grant.confirmation === 'preapproved')
    const requiresConfirmation = critical
      || tool.confirmation === 'every-time'
      || (tool.confirmation === 'once' && !preapproved)
      || promptGrant

    if (requiresConfirmation && !this.confirmations.consume(context.confirmationToken, context)) {
      return this.#decision(context, false, 'Explicit confirmation required', true, matchingGrants.map(grant => grant.id), matchingRules.map(rule => rule.id))
    }

    this.grants.consume(matchingGrants.map(grant => grant.id))
    return this.#decision(context, true, 'Allowed', false, matchingGrants.map(grant => grant.id), matchingRules.map(rule => rule.id))
  }

  #decision(context: PolicyContext, allow: boolean, reason: string, requiresConfirmation: boolean, grantIds: string[], ruleIds: string[]): PolicyDecision {
    const decision: PolicyDecision = {
      allow,
      reason,
      requiresConfirmation,
      matchedGrantIds: grantIds,
      matchedRuleIds: ruleIds,
      effectiveScopes: allow ? [...context.requestedScopes] : [],
    }
    this.audit.write({
      id: randomId(),
      at: context.now ?? Date.now(),
      subject: context.subject,
      toolId: context.toolId,
      decision: requiresConfirmation ? 'confirm' : allow ? 'allow' : 'deny',
      reason,
      scopes: context.requestedScopes,
      origin: context.origin,
      projectRoot: context.projectRoot,
    })
    return decision
  }
}

export interface ToolInvocation<I = unknown> {
  context: PolicyContext
  input: I
}

export type ToolHandler<I = unknown, O = unknown> = (input: I, context: PolicyContext, signal: AbortSignal) => O | Promise<O>

export class GovernedToolExecutor {
  readonly policy: PolicyEngine

  constructor(policy: PolicyEngine) {
    this.policy = policy
  }

  async execute<I, O>(invocation: ToolInvocation<I>, handler: ToolHandler<I, O>): Promise<O> {
    const declaration = this.policy.catalog.get(invocation.context.toolId)
    if (!declaration) throw new PolicyDeniedError('Tool is not declared')
    const inputErrors = validateJsonSchema(declaration.inputSchema, invocation.input)
    if (inputErrors.length) throw new TypeError(`Invalid tool input: ${inputErrors.join('; ')}`)
    const decision = this.policy.evaluate(invocation.context)
    if (!decision.allow) throw new PolicyDeniedError(decision.reason, decision.requiresConfirmation)

    const startedAt = Date.now()
    const controller = new AbortController()
    const timeoutMs = declaration.timeoutMs ?? 30_000
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error(`Tool execution timed out after ${timeoutMs}ms`)
        controller.abort(error)
        reject(error)
      }, timeoutMs)
    })
    try {
      const output = await Promise.race([
        Promise.resolve(handler(invocation.input, invocation.context, controller.signal)),
        timeoutPromise,
      ])
      const outputErrors = validateJsonSchema(declaration.outputSchema, output)
      if (outputErrors.length) throw new TypeError(`Invalid tool output: ${outputErrors.join('; ')}`)
      this.policy.audit.write({
        id: randomId(), at: Date.now(), subject: invocation.context.subject, toolId: declaration.id,
        decision: 'allow', reason: 'Execution completed', scopes: invocation.context.requestedScopes,
        origin: invocation.context.origin, projectRoot: invocation.context.projectRoot,
        durationMs: Date.now() - startedAt, success: true,
      })
      return output
    }
    catch (error) {
      this.policy.audit.write({
        id: randomId(), at: Date.now(), subject: invocation.context.subject, toolId: declaration.id,
        decision: 'allow', reason: 'Execution failed', scopes: invocation.context.requestedScopes,
        origin: invocation.context.origin, projectRoot: invocation.context.projectRoot,
        durationMs: Date.now() - startedAt, success: false, error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
    finally { if (timeout) clearTimeout(timeout) }
  }
}

export class PolicyDeniedError extends Error {
  readonly requiresConfirmation: boolean

  constructor(message: string, requiresConfirmation = false) {
    super(message)
    this.name = 'PolicyDeniedError'
    this.requiresConfirmation = requiresConfirmation
  }
}

export function createLocalAgentToolDeclarations(): ToolCapabilityDeclaration[] {
  return [
    {
      id: 'local-agent.connect', version: '1.0.0', title: 'Connect Local Agent',
      description: 'Connect to the user-configured local YK Pets Agent endpoint.', scopes: ['agent:connect'],
      risk: 'low', sideEffects: ['network'], execution: 'browser', confirmation: 'once', timeoutMs: 10_000,
      inputSchema: { type: 'object', required: ['url'], properties: { url: { type: 'string' }, token: { type: 'string' } } },
    },
    {
      id: 'patch.generate', version: '1.0.0', title: 'Generate Source Patch',
      description: 'Read project source candidates and generate a deterministic patch proposal.', scopes: ['project:read', 'patch:generate'],
      risk: 'medium', sideEffects: ['read'], execution: 'local-agent', confirmation: 'once', timeoutMs: 30_000,
    },
    {
      id: 'patch.apply', version: '1.0.0', title: 'Apply Source Patch',
      description: 'Verify hashes, create a backup, and write an approved patch.', scopes: ['project:write', 'patch:apply'],
      risk: 'high', sideEffects: ['write'], execution: 'local-agent', confirmation: 'every-time', timeoutMs: 30_000,
    },
    {
      id: 'checks.run', version: '1.0.0', title: 'Run Project Checks',
      description: 'Run allowlisted typecheck, test, and build commands.', scopes: ['project:execute', 'checks:run'],
      risk: 'high', sideEffects: ['execute'], execution: 'local-agent', confirmation: 'every-time', timeoutMs: 180_000,
    },
    {
      id: 'patch.rollback', version: '1.0.0', title: 'Rollback Latest Patch',
      description: 'Restore the latest backup after verifying the current post-patch hash.', scopes: ['project:write', 'patch:rollback'],
      risk: 'high', sideEffects: ['write'], execution: 'local-agent', confirmation: 'every-time', timeoutMs: 30_000,
    },
  ]
}

export function validateToolDeclaration(tool: ToolCapabilityDeclaration): void {
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(tool.id)) throw new Error(`Invalid tool id: ${tool.id}`)
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tool.version)) throw new Error(`Invalid tool version: ${tool.version}`)
  if (!tool.title.trim() || !tool.description.trim()) throw new Error('Tool title and description are required')
  if (!tool.scopes.length || new Set(tool.scopes).size !== tool.scopes.length) throw new Error('Tool scopes must be unique and non-empty')
  if (tool.timeoutMs !== undefined && tool.timeoutMs < 1) throw new Error('Tool timeout must be positive')
}

export function validateJsonSchema(schema: JsonSchema | undefined, value: unknown, path = '$'): string[] {
  if (!schema) return []
  const errors: string[] = []
  if (schema.enum && !schema.enum.some(item => deepEqual(item, value))) errors.push(`${path} is not in enum`)
  if (schema.type) {
    const valid = schema.type === 'null' ? value === null
      : schema.type === 'array' ? Array.isArray(value)
        : schema.type === 'object' ? typeof value === 'object' && value !== null && !Array.isArray(value)
          : schema.type === 'integer' ? Number.isInteger(value)
            : typeof value === schema.type
    if (!valid) return [...errors, `${path} must be ${schema.type}`]
  }
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) if (!(key in record)) errors.push(`${path}.${key} is required`)
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in record) errors.push(...validateJsonSchema(child, record[key], `${path}.${key}`))
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is not allowed`)
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...validateJsonSchema(schema.items, item, `${path}[${index}]`)))
  }
  return errors
}

function freezeTool(tool: ToolCapabilityDeclaration): ToolCapabilityDeclaration {
  return Object.freeze({
    ...tool,
    scopes: Object.freeze([...tool.scopes]) as unknown as string[],
    sideEffects: Object.freeze([...tool.sideEffects]) as unknown as ToolSideEffect[],
    allowedOrigins: tool.allowedOrigins ? Object.freeze([...tool.allowedOrigins]) as unknown as string[] : undefined,
    allowedProjectPatterns: tool.allowedProjectPatterns ? Object.freeze([...tool.allowedProjectPatterns]) as unknown as string[] : undefined,
  })
}

function ruleMatches(rule: PolicyRule, context: PolicyContext): boolean {
  if (!wildcardMatch(rule.toolPattern, context.toolId)) return false
  if (rule.subjectPattern && !wildcardMatch(rule.subjectPattern, context.subject)) return false
  if (rule.scopes && !context.requestedScopes.some(scope => rule.scopes!.some(pattern => wildcardMatch(pattern, scope)))) return false
  if (rule.origins && !matchesAny(rule.origins, context.origin)) return false
  if (rule.projects && !matchesAny(rule.projects, context.projectRoot)) return false
  return true
}

function matchesAny(patterns: string[], value: string | undefined): boolean {
  return value !== undefined && patterns.some(pattern => wildcardMatch(pattern, value))
}

function covers(granted: string[], requested: string[]): boolean {
  return requested.every(scope => granted.some(pattern => wildcardMatch(pattern, scope)))
}

export function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(value)
}

function randomId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function deepEqual(a: unknown, b: unknown): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b) }
  catch { return Object.is(a, b) }
}
