/**
 * Site-aware extension host that integrates adaptive rendering, lifecycle suspension,
 * per-site policy, and split feature loading.
 */

import {
  AdaptiveRendererController,
  type AdaptiveRuntimeOptions,
  type PetRendererFactory,
  type PetVisualState,
  type RendererKind,
  type RuntimeEvaluation,
  type RuntimeProbe,
} from '@yk-pets/pet-runtime-adaptive'
import { FeatureModuleLoader, type FeatureLoadContext, type FeatureStatus, type IdlePrefetchScheduler } from '@yk-pets/pet-feature-loader'
import {
  BrowserLifecycleMonitor,
  type BrowserLifecycleMonitorOptions,
  RuntimeLifecycleController,
  type RuntimeActivityTarget,
  type RuntimeLifecycleOptions,
  scheduleIdleTask,
} from '@yk-pets/pet-runtime-lifecycle'
import {
  SitePolicyManager,
  type ResolvedSitePolicy,
  type SitePolicyPatch,
  type SiteRendererPreference,
} from '@yk-pets/pet-site-policy'

export interface AuditFeature<TContext = unknown, TResult = unknown> {
  run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult
  dispose?(): Promise<void> | void
}

export interface AnalysisFeature<TContext = unknown, TResult = unknown> {
  run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult
  dispose?(): Promise<void> | void
}

export interface ModificationFeature<TContext = unknown, TResult = unknown> {
  run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult
  dispose?(): Promise<void> | void
}

export interface RepositoryFeature<TContext = unknown, TResult = unknown> {
  run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult
  dispose?(): Promise<void> | void
}

export interface CollaborationFeature<TContext = unknown, TResult = unknown> {
  run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult
  dispose?(): Promise<void> | void
}

export interface ModificationAuthorizationContext {
  url: string
  policy: ResolvedSitePolicy
}

export interface RepositoryAuthorizationContext {
  url: string
  policy: ResolvedSitePolicy
}

export interface CollaborationAuthorizationContext {
  url: string
  policy: ResolvedSitePolicy
}

export interface ExtensionPetRuntimeOptions<
  TAuditContext = unknown,
  TAuditResult = unknown,
  TAnalysisContext = unknown,
  TAnalysisResult = unknown,
  TModificationContext = unknown,
  TModificationResult = unknown,
  TRepositoryContext = unknown,
  TRepositoryResult = unknown,
  TCollaborationContext = unknown,
  TCollaborationResult = unknown,
> {
  sitePolicies: SitePolicyManager
  renderer2d: PetRendererFactory
  loadRenderer3d(context: FeatureLoadContext): Promise<PetRendererFactory> | PetRendererFactory
  loadAuditFeature?(context: FeatureLoadContext): Promise<AuditFeature<TAuditContext, TAuditResult>> | AuditFeature<TAuditContext, TAuditResult>
  loadAnalysisFeature?(context: FeatureLoadContext): Promise<AnalysisFeature<TAnalysisContext, TAnalysisResult>> | AnalysisFeature<TAnalysisContext, TAnalysisResult>
  loadModificationFeature?(context: FeatureLoadContext): Promise<ModificationFeature<TModificationContext, TModificationResult>> | ModificationFeature<TModificationContext, TModificationResult>
  authorizeModification?(context: TModificationContext, runtime: ModificationAuthorizationContext): Promise<boolean> | boolean
  loadRepositoryFeature?(context: FeatureLoadContext): Promise<RepositoryFeature<TRepositoryContext, TRepositoryResult>> | RepositoryFeature<TRepositoryContext, TRepositoryResult>
  authorizeRepositoryPublish?(context: TRepositoryContext, runtime: RepositoryAuthorizationContext): Promise<boolean> | boolean
  loadCollaborationFeature?(context: FeatureLoadContext): Promise<CollaborationFeature<TCollaborationContext, TCollaborationResult>> | CollaborationFeature<TCollaborationContext, TCollaborationResult>
  authorizeCollaborationAction?(context: TCollaborationContext, runtime: CollaborationAuthorizationContext): Promise<boolean> | boolean
  renderer3dTimeoutMs?: number
  auditTimeoutMs?: number
  analysisTimeoutMs?: number
  modificationTimeoutMs?: number
  repositoryTimeoutMs?: number
  collaborationTimeoutMs?: number
  adaptive?: AdaptiveRuntimeOptions
  lifecycle?: RuntimeLifecycleOptions
  now?: () => number
}

export type ExtensionRuntimeCommand<TAuditContext = unknown, TAnalysisContext = unknown, TModificationContext = unknown, TRepositoryContext = unknown, TCollaborationContext = unknown> =
  | { type: 'runtime:get-status' }
  | { type: 'runtime:refresh-policy' }
  | { type: 'runtime:set-manual-paused'; paused: boolean }
  | { type: 'site:set-policy'; policy: SitePolicyPatch; persistence?: 'session' | 'origin'; ttlMs?: number }
  | { type: 'renderer:force'; renderer: RendererKind }
  | { type: 'audit:run'; context: TAuditContext }
  | { type: 'analysis:run'; context: TAnalysisContext }
  | { type: 'modification:run'; context: TModificationContext }
  | { type: 'repository:publish'; context: TRepositoryContext }
  | { type: 'collaboration:run'; context: TCollaborationContext }

export type ExtensionRuntimeCommandResult<TResult = unknown> =
  | { ok: true; status: ExtensionPetRuntimePublicStatus; result?: TResult }
  | { ok: false; error: string; status: ExtensionPetRuntimePublicStatus }

export interface ExtensionPetRuntimePublicStatus {
  started: boolean
  mounted: boolean
  url: string | null
  policy: ResolvedSitePolicy | null
  renderer: RendererKind | null
  lifecycle: {
    activity: 'active' | 'paused' | 'hidden' | 'disposed'
    reason: string
    transitionAt: number
  }
  features: FeatureStatus[]
}

export class ExtensionPetRuntime<
  TAuditContext = unknown,
  TAuditResult = unknown,
  TAnalysisContext = unknown,
  TAnalysisResult = unknown,
  TModificationContext = unknown,
  TModificationResult = unknown,
  TRepositoryContext = unknown,
  TRepositoryResult = unknown,
  TCollaborationContext = unknown,
  TCollaborationResult = unknown,
> {
  readonly options: ExtensionPetRuntimeOptions<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>
  readonly sitePolicies: SitePolicyManager
  readonly features: FeatureModuleLoader
  readonly adaptive: AdaptiveRendererController
  readonly lifecycle: RuntimeLifecycleController
  readonly now: () => number

  #target: Element | ShadowRoot | null = null
  #url: string | null = null
  #policy: ResolvedSitePolicy | null = null
  #probe: RuntimeProbe | null = null
  #state: PetVisualState = { behavior: 'idle' }
  #mounted = false
  #started = false
  #disposed = false
  #browserMonitor: BrowserLifecycleMonitor | null = null
  #warmupCancel: (() => void) | null = null

  constructor(options: ExtensionPetRuntimeOptions<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>) {
    if (options.renderer2d.kind !== '2d') throw new Error('renderer2d factory must have kind "2d"')
    this.options = options
    this.sitePolicies = options.sitePolicies
    this.now = options.now ?? Date.now
    this.features = new FeatureModuleLoader([], this.now)
    this.features.register<PetRendererFactory>({
      name: 'renderer-3d',
      timeoutMs: options.renderer3dTimeoutMs ?? 8_000,
      load: options.loadRenderer3d,
      dispose: async factory => {
        const disposable = factory as PetRendererFactory & { dispose?: () => void | Promise<void> }
        await disposable.dispose?.()
      },
    })
    if (options.loadAuditFeature) {
      this.features.register<AuditFeature<TAuditContext, TAuditResult>>({
        name: 'audit-collector',
        timeoutMs: options.auditTimeoutMs ?? 10_000,
        load: options.loadAuditFeature,
        dispose: feature => feature.dispose?.(),
      })
    }
    if (options.loadAnalysisFeature) {
      this.features.register<AnalysisFeature<TAnalysisContext, TAnalysisResult>>({
        name: 'deep-analysis',
        timeoutMs: options.analysisTimeoutMs ?? 30_000,
        load: options.loadAnalysisFeature,
        dispose: feature => feature.dispose?.(),
      })
    }
    if (options.loadModificationFeature) {
      this.features.register<ModificationFeature<TModificationContext, TModificationResult>>({
        name: 'safe-modification',
        timeoutMs: options.modificationTimeoutMs ?? 120_000,
        load: options.loadModificationFeature,
        dispose: feature => feature.dispose?.(),
      })
    }
    if (options.loadRepositoryFeature) {
      this.features.register<RepositoryFeature<TRepositoryContext, TRepositoryResult>>({
        name: 'repository-publish',
        timeoutMs: options.repositoryTimeoutMs ?? 180_000,
        load: options.loadRepositoryFeature,
        dispose: feature => feature.dispose?.(),
      })
    }
    if (options.loadCollaborationFeature) {
      this.features.register<CollaborationFeature<TCollaborationContext, TCollaborationResult>>({
        name: 'remote-collaboration',
        timeoutMs: options.collaborationTimeoutMs ?? 180_000,
        load: options.loadCollaborationFeature,
        dispose: feature => feature.dispose?.(),
      })
    }

    const renderer3d: PetRendererFactory = {
      kind: '3d',
      create: async () => {
        const factory = await this.features.load<PetRendererFactory>('renderer-3d')
        if (factory.kind !== '3d') throw new Error('Lazy renderer feature must export a 3D renderer factory')
        return factory.create()
      },
    }
    this.adaptive = new AdaptiveRendererController(
      { '2d': options.renderer2d, '3d': renderer3d },
      options.adaptive,
    )

    const target: RuntimeActivityTarget = {
      activate: async () => {
        if (!this.#mounted) return
        await this.adaptive.setVisible(true)
        await this.adaptive.resume()
      },
      pause: async () => {
        if (!this.#mounted) return
        await this.adaptive.setVisible(true)
        await this.adaptive.pause()
      },
      hide: async () => {
        if (!this.#mounted) return
        await this.adaptive.pause()
        await this.adaptive.setVisible(false)
      },
    }
    this.lifecycle = new RuntimeLifecycleController(target, options.lifecycle, this.now)
  }

  get status(): ExtensionPetRuntimePublicStatus {
    const lifecycle = this.lifecycle.snapshot
    return {
      started: this.#started,
      mounted: this.#mounted,
      url: this.#url,
      policy: this.#policy ? clone(this.#policy) : null,
      renderer: this.adaptive.currentKind,
      lifecycle: {
        activity: lifecycle.activity,
        reason: lifecycle.reason,
        transitionAt: lifecycle.transitionAt,
      },
      features: this.features.list(),
    }
  }

  async start(target: Element | ShadowRoot, url: string, probe?: RuntimeProbe): Promise<ExtensionPetRuntimePublicStatus> {
    this.#assertUsable()
    this.#target = target
    this.#url = url
    this.#probe = probe ? cloneProbe(probe) : createSafeProbe(this.now(), '2d')
    this.#started = true
    await this.refreshPolicy()
    return this.status
  }

  async navigate(url: string, probe?: RuntimeProbe): Promise<ExtensionPetRuntimePublicStatus> {
    this.#assertStarted()
    this.#url = url
    if (probe) this.#probe = cloneProbe(probe)
    await this.refreshPolicy()
    return this.status
  }

  update(state: PetVisualState): void {
    this.#assertStarted()
    this.#state = clone(state)
    if (this.#mounted) this.adaptive.update(this.#state)
  }

  resize(width: number, height: number, devicePixelRatio = 1): void {
    if (this.#mounted) this.adaptive.resize(width, height, devicePixelRatio)
  }

  async recordProbe(probe: RuntimeProbe): Promise<RuntimeEvaluation | null> {
    this.#assertStarted()
    this.#probe = cloneProbe(probe)
    if (!this.#mounted || !this.#policy || this.#policy.mode === 'hidden') return null
    return this.adaptive.recordProbe({ ...this.#probe, preference: this.#policy.renderer })
  }

  async refreshPolicy(): Promise<ResolvedSitePolicy> {
    this.#assertStarted()
    const policy = await this.sitePolicies.resolve(this.#url!)
    this.#policy = policy

    if (policy.mode !== 'hidden') await this.#ensureMounted(policy.mode === 'paused' ? '2d' : policy.renderer)
    await this.lifecycle.setSiteMode(policy.mode)

    if (this.#mounted && policy.mode === 'enabled') {
      await this.adaptive.recordProbe({
        ...(this.#probe ?? createSafeProbe(this.now(), policy.renderer)),
        now: this.now(),
        preference: policy.renderer,
      })
    }
    if (this.#mounted && policy.mode !== 'hidden') {
      this.adaptive.update({ ...this.#state, speaking: policy.audioEnabled ? this.#state.speaking : false })
    }

    if (policy.mode === 'enabled' && policy.renderer !== '2d') this.schedule3DWarmup()
    else this.#cancelWarmup()
    return clone(policy)
  }

  async setCurrentSitePolicy(
    patch: SitePolicyPatch,
    persistence: 'session' | 'origin' = 'session',
    ttlMs?: number,
  ): Promise<ResolvedSitePolicy> {
    this.#assertStarted()
    if (persistence === 'session') {
      this.sitePolicies.setSessionOverride(this.#url!, patch, ttlMs)
    }
    else {
      const current = await this.sitePolicies.resolve(this.#url!)
      const id = `origin:${current.siteKey}`
      const pattern = `${current.origin}/*`
      const existing = (await this.sitePolicies.listRules()).find(rule => rule.id === id)
      if (existing) await this.sitePolicies.updateRule(id, { pattern, policy: { ...existing.policy, ...patch }, priority: 1_000 })
      else await this.sitePolicies.addRule({ id, pattern, policy: patch, priority: 1_000 })
    }
    return this.refreshPolicy()
  }

  async forceRenderer(renderer: RendererKind): Promise<void> {
    this.#assertStarted()
    if (this.#policy?.mode === 'hidden') throw new Error('Renderer cannot be forced while the pet is hidden for this site')
    if (renderer === '3d' && this.features.status('renderer-3d').state === 'failed') {
      await this.features.reset('renderer-3d')
    }
    if (!this.#mounted) await this.#ensureMounted(renderer)
    await this.adaptive.force(renderer)
  }

  async runAudit(context: TAuditContext, signal?: AbortSignal): Promise<TAuditResult> {
    this.#assertStarted()
    if (!this.#policy?.auditEnabled) throw new Error('Audit is disabled for the current site')
    if (!this.features.has('audit-collector')) throw new Error('Audit collector feature is not registered')
    const feature = await this.features.load<AuditFeature<TAuditContext, TAuditResult>>('audit-collector', { signal, retry: true })
    return feature.run(context, signal)
  }

  async runAnalysis(context: TAnalysisContext, signal?: AbortSignal): Promise<TAnalysisResult> {
    this.#assertStarted()
    if (!this.#policy?.auditEnabled) throw new Error('Deep analysis is disabled for the current site')
    if (!this.features.has('deep-analysis')) throw new Error('Deep analysis feature is not registered')
    const feature = await this.features.load<AnalysisFeature<TAnalysisContext, TAnalysisResult>>('deep-analysis', { signal, retry: true })
    return feature.run(context, signal)
  }

  async runModification(context: TModificationContext, signal?: AbortSignal): Promise<TModificationResult> {
    this.#assertStarted()
    if (!this.#policy?.auditEnabled) throw new Error('Source modification is disabled for the current site')
    if (!this.features.has('safe-modification')) throw new Error('Safe modification feature is not registered')
    if (!this.options.authorizeModification) throw new Error('Source modification authorization callback is not configured')
    const allowed = await this.options.authorizeModification(clone(context), { url: this.#url!, policy: clone(this.#policy) })
    if (!allowed) throw new Error('Source modification request was not authorized by the extension host')
    const feature = await this.features.load<ModificationFeature<TModificationContext, TModificationResult>>('safe-modification', { signal, retry: true })
    return feature.run(context, signal)
  }

  async runRepositoryPublish(context: TRepositoryContext, signal?: AbortSignal): Promise<TRepositoryResult> {
    this.#assertStarted()
    if (!this.#policy?.auditEnabled) throw new Error('Repository publishing is disabled for the current site')
    if (!this.features.has('repository-publish')) throw new Error('Repository publish feature is not registered')
    if (!this.options.authorizeRepositoryPublish) throw new Error('Repository publish authorization callback is not configured')
    const allowed = await this.options.authorizeRepositoryPublish(clone(context), { url: this.#url!, policy: clone(this.#policy) })
    if (!allowed) throw new Error('Repository publish request was not authorized by the extension host')
    const feature = await this.features.load<RepositoryFeature<TRepositoryContext, TRepositoryResult>>('repository-publish', { signal, retry: true })
    return feature.run(context, signal)
  }

  async runCollaboration(context: TCollaborationContext, signal?: AbortSignal): Promise<TCollaborationResult> {
    this.#assertStarted()
    if (!this.#policy?.auditEnabled) throw new Error('Remote collaboration is disabled for the current site')
    if (!this.features.has('remote-collaboration')) throw new Error('Remote collaboration feature is not registered')
    if (!this.options.authorizeCollaborationAction) throw new Error('Remote collaboration authorization callback is not configured')
    const allowed = await this.options.authorizeCollaborationAction(clone(context), { url: this.#url!, policy: clone(this.#policy) })
    if (!allowed) throw new Error('Remote collaboration request was not authorized by the extension host')
    const feature = await this.features.load<CollaborationFeature<TCollaborationContext, TCollaborationResult>>('remote-collaboration', { signal, retry: true })
    return feature.run(context, signal)
  }

  attachBrowserLifecycle(options: Omit<BrowserLifecycleMonitorOptions, 'target'> & { target?: Element } = {}): BrowserLifecycleMonitor {
    this.#assertStarted()
    this.#browserMonitor?.stop()
    const target = options.target ?? resolveElement(this.#target)
    this.#browserMonitor = new BrowserLifecycleMonitor(this.lifecycle, { ...options, target })
    this.#browserMonitor.start()
    return this.#browserMonitor
  }

  schedule3DWarmup(scheduler?: IdlePrefetchScheduler): () => void {
    this.#cancelWarmup()
    if (!this.#policy || this.#policy.mode !== 'enabled' || this.#policy.renderer === '2d') return () => {}
    const actualScheduler: IdlePrefetchScheduler = scheduler ?? (task => scheduleIdleTask(() => task(), { timeoutMs: 3_000 }))
    this.#warmupCancel = this.features.schedulePrefetch(['renderer-3d'], actualScheduler)
    return () => this.#cancelWarmup()
  }

  async handleCommand(command: ExtensionRuntimeCommand<TAuditContext, TAnalysisContext, TModificationContext, TRepositoryContext, TCollaborationContext>): Promise<ExtensionRuntimeCommandResult<TAuditResult | TAnalysisResult | TModificationResult | TRepositoryResult | TCollaborationResult>> {
    try {
      let result: TAuditResult | TAnalysisResult | TModificationResult | TRepositoryResult | TCollaborationResult | undefined
      switch (command.type) {
        case 'runtime:get-status': break
        case 'runtime:refresh-policy': await this.refreshPolicy(); break
        case 'runtime:set-manual-paused': await this.lifecycle.setManualPaused(command.paused); break
        case 'site:set-policy': await this.setCurrentSitePolicy(command.policy, command.persistence, command.ttlMs); break
        case 'renderer:force': await this.forceRenderer(command.renderer); break
        case 'audit:run': result = await this.runAudit(command.context); break
        case 'analysis:run': result = await this.runAnalysis(command.context); break
        case 'modification:run': result = await this.runModification(command.context); break
        case 'repository:publish': result = await this.runRepositoryPublish(command.context); break
        case 'collaboration:run': result = await this.runCollaboration(command.context); break
        default: assertNever(command)
      }
      return { ok: true, status: this.status, result }
    }
    catch (error) {
      return { ok: false, error: errorMessage(error), status: this.status }
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    this.#cancelWarmup()
    this.#browserMonitor?.stop()
    this.#browserMonitor = null
    await this.lifecycle.dispose()
    if (this.#mounted) await this.adaptive.dispose()
    await this.features.dispose()
    this.#mounted = false
    this.#started = false
    this.#target = null
  }

  async #ensureMounted(preference: SiteRendererPreference): Promise<void> {
    if (this.#mounted) return
    if (!this.#target) throw new Error('ExtensionPetRuntime target is unavailable')
    const probe = {
      ...(this.#probe ?? createSafeProbe(this.now(), preference)),
      now: this.now(),
      preference,
    }
    await this.adaptive.mount(this.#target, probe)
    this.#mounted = true
    this.adaptive.update(this.#state)
  }

  #cancelWarmup(): void {
    this.#warmupCancel?.()
    this.#warmupCancel = null
  }

  #assertStarted(): void {
    this.#assertUsable()
    if (!this.#started || !this.#url) throw new Error('ExtensionPetRuntime has not been started')
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('ExtensionPetRuntime is disposed')
  }
}

export function createExtensionRuntimeMessageHandler<
  TAuditContext = unknown,
  TAuditResult = unknown,
  TAnalysisContext = unknown,
  TAnalysisResult = unknown,
  TModificationContext = unknown,
  TModificationResult = unknown,
  TRepositoryContext = unknown,
  TRepositoryResult = unknown,
  TCollaborationContext = unknown,
  TCollaborationResult = unknown,
>(
  runtime: ExtensionPetRuntime<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>,
): (message: unknown) => Promise<ExtensionRuntimeCommandResult<TAuditResult | TAnalysisResult | TModificationResult | TRepositoryResult | TCollaborationResult>> {
  return async message => {
    try { return runtime.handleCommand(validateCommand<TAuditContext, TAnalysisContext, TModificationContext, TRepositoryContext, TCollaborationContext>(message)) }
    catch (error) { return { ok: false, error: errorMessage(error), status: runtime.status } }
  }
}

export function validateCommand<TAuditContext = unknown, TAnalysisContext = unknown, TModificationContext = unknown, TRepositoryContext = unknown, TCollaborationContext = unknown>(value: unknown): ExtensionRuntimeCommand<TAuditContext, TAnalysisContext, TModificationContext, TRepositoryContext, TCollaborationContext> {
  if (!isRecord(value) || typeof value.type !== 'string') throw new Error('Invalid extension runtime command')
  switch (value.type) {
    case 'runtime:get-status':
    case 'runtime:refresh-policy':
      return { type: value.type }
    case 'runtime:set-manual-paused':
      if (typeof value.paused !== 'boolean') throw new Error('paused must be boolean')
      return { type: value.type, paused: value.paused }
    case 'site:set-policy':
      if (!isRecord(value.policy)) throw new Error('site policy patch must be an object')
      if (value.persistence !== undefined && value.persistence !== 'session' && value.persistence !== 'origin') {
        throw new Error('Invalid site policy persistence')
      }
      if (value.ttlMs !== undefined && (typeof value.ttlMs !== 'number' || value.ttlMs <= 0)) throw new Error('ttlMs must be positive')
      return {
        type: value.type,
        policy: value.policy as SitePolicyPatch,
        persistence: value.persistence,
        ttlMs: value.ttlMs,
      }
    case 'renderer:force':
      if (value.renderer !== '2d' && value.renderer !== '3d') throw new Error('Invalid renderer kind')
      return { type: value.type, renderer: value.renderer }
    case 'audit:run':
      return { type: value.type, context: value.context as TAuditContext }
    case 'analysis:run':
      return { type: value.type, context: value.context as TAnalysisContext }
    case 'modification:run':
      return { type: value.type, context: value.context as TModificationContext }
    case 'repository:publish':
      return { type: value.type, context: value.context as TRepositoryContext }
    case 'collaboration:run':
      return { type: value.type, context: value.context as TCollaborationContext }
    default:
      throw new Error(`Unknown extension runtime command: ${value.type}`)
  }
}

function createSafeProbe(now: number, preference: SiteRendererPreference): RuntimeProbe {
  return { now, webglSupported: false, preference }
}

function cloneProbe(probe: RuntimeProbe): RuntimeProbe {
  return { ...probe }
}

function resolveElement(target: Element | ShadowRoot | null): Element | undefined {
  if (!target) return undefined
  return 'host' in target ? target.host : target
}

function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${String(value)}`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
