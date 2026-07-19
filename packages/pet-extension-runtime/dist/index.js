/**
 * Site-aware extension host that integrates adaptive rendering, lifecycle suspension,
 * per-site policy, and split feature loading.
 */
import { AdaptiveRendererController, } from '@yk-pets/pet-runtime-adaptive';
import { FeatureModuleLoader } from '@yk-pets/pet-feature-loader';
import { BrowserLifecycleMonitor, RuntimeLifecycleController, scheduleIdleTask, } from '@yk-pets/pet-runtime-lifecycle';
import { SitePolicyManager, } from '@yk-pets/pet-site-policy';
export class ExtensionPetRuntime {
    options;
    sitePolicies;
    features;
    adaptive;
    lifecycle;
    now;
    #target = null;
    #url = null;
    #policy = null;
    #probe = null;
    #state = { behavior: 'idle' };
    #mounted = false;
    #started = false;
    #disposed = false;
    #browserMonitor = null;
    #warmupCancel = null;
    constructor(options) {
        if (options.renderer2d.kind !== '2d')
            throw new Error('renderer2d factory must have kind "2d"');
        this.options = options;
        this.sitePolicies = options.sitePolicies;
        this.now = options.now ?? Date.now;
        this.features = new FeatureModuleLoader([], this.now);
        this.features.register({
            name: 'renderer-3d',
            timeoutMs: options.renderer3dTimeoutMs ?? 8_000,
            load: options.loadRenderer3d,
            dispose: async (factory) => {
                const disposable = factory;
                await disposable.dispose?.();
            },
        });
        if (options.loadAuditFeature) {
            this.features.register({
                name: 'audit-collector',
                timeoutMs: options.auditTimeoutMs ?? 10_000,
                load: options.loadAuditFeature,
                dispose: feature => feature.dispose?.(),
            });
        }
        if (options.loadAnalysisFeature) {
            this.features.register({
                name: 'deep-analysis',
                timeoutMs: options.analysisTimeoutMs ?? 30_000,
                load: options.loadAnalysisFeature,
                dispose: feature => feature.dispose?.(),
            });
        }
        if (options.loadModificationFeature) {
            this.features.register({
                name: 'safe-modification',
                timeoutMs: options.modificationTimeoutMs ?? 120_000,
                load: options.loadModificationFeature,
                dispose: feature => feature.dispose?.(),
            });
        }
        if (options.loadRepositoryFeature) {
            this.features.register({
                name: 'repository-publish',
                timeoutMs: options.repositoryTimeoutMs ?? 180_000,
                load: options.loadRepositoryFeature,
                dispose: feature => feature.dispose?.(),
            });
        }
        if (options.loadCollaborationFeature) {
            this.features.register({
                name: 'remote-collaboration',
                timeoutMs: options.collaborationTimeoutMs ?? 180_000,
                load: options.loadCollaborationFeature,
                dispose: feature => feature.dispose?.(),
            });
        }
        const renderer3d = {
            kind: '3d',
            create: async () => {
                const factory = await this.features.load('renderer-3d');
                if (factory.kind !== '3d')
                    throw new Error('Lazy renderer feature must export a 3D renderer factory');
                return factory.create();
            },
        };
        this.adaptive = new AdaptiveRendererController({ '2d': options.renderer2d, '3d': renderer3d }, options.adaptive);
        const target = {
            activate: async () => {
                if (!this.#mounted)
                    return;
                await this.adaptive.setVisible(true);
                await this.adaptive.resume();
            },
            pause: async () => {
                if (!this.#mounted)
                    return;
                await this.adaptive.setVisible(true);
                await this.adaptive.pause();
            },
            hide: async () => {
                if (!this.#mounted)
                    return;
                await this.adaptive.pause();
                await this.adaptive.setVisible(false);
            },
        };
        this.lifecycle = new RuntimeLifecycleController(target, options.lifecycle, this.now);
    }
    get status() {
        const lifecycle = this.lifecycle.snapshot;
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
        };
    }
    async start(target, url, probe) {
        this.#assertUsable();
        this.#target = target;
        this.#url = url;
        this.#probe = probe ? cloneProbe(probe) : createSafeProbe(this.now(), '2d');
        this.#started = true;
        await this.refreshPolicy();
        return this.status;
    }
    async navigate(url, probe) {
        this.#assertStarted();
        this.#url = url;
        if (probe)
            this.#probe = cloneProbe(probe);
        await this.refreshPolicy();
        return this.status;
    }
    update(state) {
        this.#assertStarted();
        this.#state = clone(state);
        if (this.#mounted)
            this.adaptive.update(this.#state);
    }
    resize(width, height, devicePixelRatio = 1) {
        if (this.#mounted)
            this.adaptive.resize(width, height, devicePixelRatio);
    }
    async recordProbe(probe) {
        this.#assertStarted();
        this.#probe = cloneProbe(probe);
        if (!this.#mounted || !this.#policy || this.#policy.mode === 'hidden')
            return null;
        return this.adaptive.recordProbe({ ...this.#probe, preference: this.#policy.renderer });
    }
    async refreshPolicy() {
        this.#assertStarted();
        const policy = await this.sitePolicies.resolve(this.#url);
        this.#policy = policy;
        if (policy.mode !== 'hidden')
            await this.#ensureMounted(policy.mode === 'paused' ? '2d' : policy.renderer);
        await this.lifecycle.setSiteMode(policy.mode);
        if (this.#mounted && policy.mode === 'enabled') {
            await this.adaptive.recordProbe({
                ...(this.#probe ?? createSafeProbe(this.now(), policy.renderer)),
                now: this.now(),
                preference: policy.renderer,
            });
        }
        if (this.#mounted && policy.mode !== 'hidden') {
            this.adaptive.update({ ...this.#state, speaking: policy.audioEnabled ? this.#state.speaking : false });
        }
        if (policy.mode === 'enabled' && policy.renderer !== '2d')
            this.schedule3DWarmup();
        else
            this.#cancelWarmup();
        return clone(policy);
    }
    async setCurrentSitePolicy(patch, persistence = 'session', ttlMs) {
        this.#assertStarted();
        if (persistence === 'session') {
            this.sitePolicies.setSessionOverride(this.#url, patch, ttlMs);
        }
        else {
            const current = await this.sitePolicies.resolve(this.#url);
            const id = `origin:${current.siteKey}`;
            const pattern = `${current.origin}/*`;
            const existing = (await this.sitePolicies.listRules()).find(rule => rule.id === id);
            if (existing)
                await this.sitePolicies.updateRule(id, { pattern, policy: { ...existing.policy, ...patch }, priority: 1_000 });
            else
                await this.sitePolicies.addRule({ id, pattern, policy: patch, priority: 1_000 });
        }
        return this.refreshPolicy();
    }
    async forceRenderer(renderer) {
        this.#assertStarted();
        if (this.#policy?.mode === 'hidden')
            throw new Error('Renderer cannot be forced while the pet is hidden for this site');
        if (renderer === '3d' && this.features.status('renderer-3d').state === 'failed') {
            await this.features.reset('renderer-3d');
        }
        if (!this.#mounted)
            await this.#ensureMounted(renderer);
        await this.adaptive.force(renderer);
    }
    async runAudit(context, signal) {
        this.#assertStarted();
        if (!this.#policy?.auditEnabled)
            throw new Error('Audit is disabled for the current site');
        if (!this.features.has('audit-collector'))
            throw new Error('Audit collector feature is not registered');
        const feature = await this.features.load('audit-collector', { signal, retry: true });
        return feature.run(context, signal);
    }
    async runAnalysis(context, signal) {
        this.#assertStarted();
        if (!this.#policy?.auditEnabled)
            throw new Error('Deep analysis is disabled for the current site');
        if (!this.features.has('deep-analysis'))
            throw new Error('Deep analysis feature is not registered');
        const feature = await this.features.load('deep-analysis', { signal, retry: true });
        return feature.run(context, signal);
    }
    async runModification(context, signal) {
        this.#assertStarted();
        if (!this.#policy?.auditEnabled)
            throw new Error('Source modification is disabled for the current site');
        if (!this.features.has('safe-modification'))
            throw new Error('Safe modification feature is not registered');
        if (!this.options.authorizeModification)
            throw new Error('Source modification authorization callback is not configured');
        const allowed = await this.options.authorizeModification(clone(context), { url: this.#url, policy: clone(this.#policy) });
        if (!allowed)
            throw new Error('Source modification request was not authorized by the extension host');
        const feature = await this.features.load('safe-modification', { signal, retry: true });
        return feature.run(context, signal);
    }
    async runRepositoryPublish(context, signal) {
        this.#assertStarted();
        if (!this.#policy?.auditEnabled)
            throw new Error('Repository publishing is disabled for the current site');
        if (!this.features.has('repository-publish'))
            throw new Error('Repository publish feature is not registered');
        if (!this.options.authorizeRepositoryPublish)
            throw new Error('Repository publish authorization callback is not configured');
        const allowed = await this.options.authorizeRepositoryPublish(clone(context), { url: this.#url, policy: clone(this.#policy) });
        if (!allowed)
            throw new Error('Repository publish request was not authorized by the extension host');
        const feature = await this.features.load('repository-publish', { signal, retry: true });
        return feature.run(context, signal);
    }
    async runCollaboration(context, signal) {
        this.#assertStarted();
        if (!this.#policy?.auditEnabled)
            throw new Error('Remote collaboration is disabled for the current site');
        if (!this.features.has('remote-collaboration'))
            throw new Error('Remote collaboration feature is not registered');
        if (!this.options.authorizeCollaborationAction)
            throw new Error('Remote collaboration authorization callback is not configured');
        const allowed = await this.options.authorizeCollaborationAction(clone(context), { url: this.#url, policy: clone(this.#policy) });
        if (!allowed)
            throw new Error('Remote collaboration request was not authorized by the extension host');
        const feature = await this.features.load('remote-collaboration', { signal, retry: true });
        return feature.run(context, signal);
    }
    attachBrowserLifecycle(options = {}) {
        this.#assertStarted();
        this.#browserMonitor?.stop();
        const target = options.target ?? resolveElement(this.#target);
        this.#browserMonitor = new BrowserLifecycleMonitor(this.lifecycle, { ...options, target });
        this.#browserMonitor.start();
        return this.#browserMonitor;
    }
    schedule3DWarmup(scheduler) {
        this.#cancelWarmup();
        if (!this.#policy || this.#policy.mode !== 'enabled' || this.#policy.renderer === '2d')
            return () => { };
        const actualScheduler = scheduler ?? (task => scheduleIdleTask(() => task(), { timeoutMs: 3_000 }));
        this.#warmupCancel = this.features.schedulePrefetch(['renderer-3d'], actualScheduler);
        return () => this.#cancelWarmup();
    }
    async handleCommand(command) {
        try {
            let result;
            switch (command.type) {
                case 'runtime:get-status': break;
                case 'runtime:refresh-policy':
                    await this.refreshPolicy();
                    break;
                case 'runtime:set-manual-paused':
                    await this.lifecycle.setManualPaused(command.paused);
                    break;
                case 'site:set-policy':
                    await this.setCurrentSitePolicy(command.policy, command.persistence, command.ttlMs);
                    break;
                case 'renderer:force':
                    await this.forceRenderer(command.renderer);
                    break;
                case 'audit:run':
                    result = await this.runAudit(command.context);
                    break;
                case 'analysis:run':
                    result = await this.runAnalysis(command.context);
                    break;
                case 'modification:run':
                    result = await this.runModification(command.context);
                    break;
                case 'repository:publish':
                    result = await this.runRepositoryPublish(command.context);
                    break;
                case 'collaboration:run':
                    result = await this.runCollaboration(command.context);
                    break;
                default: assertNever(command);
            }
            return { ok: true, status: this.status, result };
        }
        catch (error) {
            return { ok: false, error: errorMessage(error), status: this.status };
        }
    }
    async dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.#cancelWarmup();
        this.#browserMonitor?.stop();
        this.#browserMonitor = null;
        await this.lifecycle.dispose();
        if (this.#mounted)
            await this.adaptive.dispose();
        await this.features.dispose();
        this.#mounted = false;
        this.#started = false;
        this.#target = null;
    }
    async #ensureMounted(preference) {
        if (this.#mounted)
            return;
        if (!this.#target)
            throw new Error('ExtensionPetRuntime target is unavailable');
        const probe = {
            ...(this.#probe ?? createSafeProbe(this.now(), preference)),
            now: this.now(),
            preference,
        };
        await this.adaptive.mount(this.#target, probe);
        this.#mounted = true;
        this.adaptive.update(this.#state);
    }
    #cancelWarmup() {
        this.#warmupCancel?.();
        this.#warmupCancel = null;
    }
    #assertStarted() {
        this.#assertUsable();
        if (!this.#started || !this.#url)
            throw new Error('ExtensionPetRuntime has not been started');
    }
    #assertUsable() {
        if (this.#disposed)
            throw new Error('ExtensionPetRuntime is disposed');
    }
}
export function createExtensionRuntimeMessageHandler(runtime) {
    return async (message) => {
        try {
            return runtime.handleCommand(validateCommand(message));
        }
        catch (error) {
            return { ok: false, error: errorMessage(error), status: runtime.status };
        }
    };
}
export function validateCommand(value) {
    if (!isRecord(value) || typeof value.type !== 'string')
        throw new Error('Invalid extension runtime command');
    switch (value.type) {
        case 'runtime:get-status':
        case 'runtime:refresh-policy':
            return { type: value.type };
        case 'runtime:set-manual-paused':
            if (typeof value.paused !== 'boolean')
                throw new Error('paused must be boolean');
            return { type: value.type, paused: value.paused };
        case 'site:set-policy':
            if (!isRecord(value.policy))
                throw new Error('site policy patch must be an object');
            if (value.persistence !== undefined && value.persistence !== 'session' && value.persistence !== 'origin') {
                throw new Error('Invalid site policy persistence');
            }
            if (value.ttlMs !== undefined && (typeof value.ttlMs !== 'number' || value.ttlMs <= 0))
                throw new Error('ttlMs must be positive');
            return {
                type: value.type,
                policy: value.policy,
                persistence: value.persistence,
                ttlMs: value.ttlMs,
            };
        case 'renderer:force':
            if (value.renderer !== '2d' && value.renderer !== '3d')
                throw new Error('Invalid renderer kind');
            return { type: value.type, renderer: value.renderer };
        case 'audit:run':
            return { type: value.type, context: value.context };
        case 'analysis:run':
            return { type: value.type, context: value.context };
        case 'modification:run':
            return { type: value.type, context: value.context };
        case 'repository:publish':
            return { type: value.type, context: value.context };
        case 'collaboration:run':
            return { type: value.type, context: value.context };
        default:
            throw new Error(`Unknown extension runtime command: ${value.type}`);
    }
}
function createSafeProbe(now, preference) {
    return { now, webglSupported: false, preference };
}
function cloneProbe(probe) {
    return { ...probe };
}
function resolveElement(target) {
    if (!target)
        return undefined;
    return 'host' in target ? target.host : target;
}
function assertNever(value) {
    throw new Error(`Unhandled command: ${String(value)}`);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function clone(value) {
    if (typeof structuredClone === 'function')
        return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=index.js.map