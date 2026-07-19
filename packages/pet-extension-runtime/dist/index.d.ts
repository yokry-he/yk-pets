/**
 * Site-aware extension host that integrates adaptive rendering, lifecycle suspension,
 * per-site policy, and split feature loading.
 */
import { AdaptiveRendererController, type AdaptiveRuntimeOptions, type PetRendererFactory, type PetVisualState, type RendererKind, type RuntimeEvaluation, type RuntimeProbe } from '@yk-pets/pet-runtime-adaptive';
import { FeatureModuleLoader, type FeatureLoadContext, type FeatureStatus, type IdlePrefetchScheduler } from '@yk-pets/pet-feature-loader';
import { BrowserLifecycleMonitor, type BrowserLifecycleMonitorOptions, RuntimeLifecycleController, type RuntimeLifecycleOptions } from '@yk-pets/pet-runtime-lifecycle';
import { SitePolicyManager, type ResolvedSitePolicy, type SitePolicyPatch } from '@yk-pets/pet-site-policy';
export interface AuditFeature<TContext = unknown, TResult = unknown> {
    run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult;
    dispose?(): Promise<void> | void;
}
export interface AnalysisFeature<TContext = unknown, TResult = unknown> {
    run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult;
    dispose?(): Promise<void> | void;
}
export interface ModificationFeature<TContext = unknown, TResult = unknown> {
    run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult;
    dispose?(): Promise<void> | void;
}
export interface RepositoryFeature<TContext = unknown, TResult = unknown> {
    run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult;
    dispose?(): Promise<void> | void;
}
export interface CollaborationFeature<TContext = unknown, TResult = unknown> {
    run(context: TContext, signal?: AbortSignal): Promise<TResult> | TResult;
    dispose?(): Promise<void> | void;
}
export interface ModificationAuthorizationContext {
    url: string;
    policy: ResolvedSitePolicy;
}
export interface RepositoryAuthorizationContext {
    url: string;
    policy: ResolvedSitePolicy;
}
export interface CollaborationAuthorizationContext {
    url: string;
    policy: ResolvedSitePolicy;
}
export interface ExtensionPetRuntimeOptions<TAuditContext = unknown, TAuditResult = unknown, TAnalysisContext = unknown, TAnalysisResult = unknown, TModificationContext = unknown, TModificationResult = unknown, TRepositoryContext = unknown, TRepositoryResult = unknown, TCollaborationContext = unknown, TCollaborationResult = unknown> {
    sitePolicies: SitePolicyManager;
    renderer2d: PetRendererFactory;
    loadRenderer3d(context: FeatureLoadContext): Promise<PetRendererFactory> | PetRendererFactory;
    loadAuditFeature?(context: FeatureLoadContext): Promise<AuditFeature<TAuditContext, TAuditResult>> | AuditFeature<TAuditContext, TAuditResult>;
    loadAnalysisFeature?(context: FeatureLoadContext): Promise<AnalysisFeature<TAnalysisContext, TAnalysisResult>> | AnalysisFeature<TAnalysisContext, TAnalysisResult>;
    loadModificationFeature?(context: FeatureLoadContext): Promise<ModificationFeature<TModificationContext, TModificationResult>> | ModificationFeature<TModificationContext, TModificationResult>;
    authorizeModification?(context: TModificationContext, runtime: ModificationAuthorizationContext): Promise<boolean> | boolean;
    loadRepositoryFeature?(context: FeatureLoadContext): Promise<RepositoryFeature<TRepositoryContext, TRepositoryResult>> | RepositoryFeature<TRepositoryContext, TRepositoryResult>;
    authorizeRepositoryPublish?(context: TRepositoryContext, runtime: RepositoryAuthorizationContext): Promise<boolean> | boolean;
    loadCollaborationFeature?(context: FeatureLoadContext): Promise<CollaborationFeature<TCollaborationContext, TCollaborationResult>> | CollaborationFeature<TCollaborationContext, TCollaborationResult>;
    authorizeCollaborationAction?(context: TCollaborationContext, runtime: CollaborationAuthorizationContext): Promise<boolean> | boolean;
    renderer3dTimeoutMs?: number;
    auditTimeoutMs?: number;
    analysisTimeoutMs?: number;
    modificationTimeoutMs?: number;
    repositoryTimeoutMs?: number;
    collaborationTimeoutMs?: number;
    adaptive?: AdaptiveRuntimeOptions;
    lifecycle?: RuntimeLifecycleOptions;
    now?: () => number;
}
export type ExtensionRuntimeCommand<TAuditContext = unknown, TAnalysisContext = unknown, TModificationContext = unknown, TRepositoryContext = unknown, TCollaborationContext = unknown> = {
    type: 'runtime:get-status';
} | {
    type: 'runtime:refresh-policy';
} | {
    type: 'runtime:set-manual-paused';
    paused: boolean;
} | {
    type: 'site:set-policy';
    policy: SitePolicyPatch;
    persistence?: 'session' | 'origin';
    ttlMs?: number;
} | {
    type: 'renderer:force';
    renderer: RendererKind;
} | {
    type: 'audit:run';
    context: TAuditContext;
} | {
    type: 'analysis:run';
    context: TAnalysisContext;
} | {
    type: 'modification:run';
    context: TModificationContext;
} | {
    type: 'repository:publish';
    context: TRepositoryContext;
} | {
    type: 'collaboration:run';
    context: TCollaborationContext;
};
export type ExtensionRuntimeCommandResult<TResult = unknown> = {
    ok: true;
    status: ExtensionPetRuntimePublicStatus;
    result?: TResult;
} | {
    ok: false;
    error: string;
    status: ExtensionPetRuntimePublicStatus;
};
export interface ExtensionPetRuntimePublicStatus {
    started: boolean;
    mounted: boolean;
    url: string | null;
    policy: ResolvedSitePolicy | null;
    renderer: RendererKind | null;
    lifecycle: {
        activity: 'active' | 'paused' | 'hidden' | 'disposed';
        reason: string;
        transitionAt: number;
    };
    features: FeatureStatus[];
}
export declare class ExtensionPetRuntime<TAuditContext = unknown, TAuditResult = unknown, TAnalysisContext = unknown, TAnalysisResult = unknown, TModificationContext = unknown, TModificationResult = unknown, TRepositoryContext = unknown, TRepositoryResult = unknown, TCollaborationContext = unknown, TCollaborationResult = unknown> {
    #private;
    readonly options: ExtensionPetRuntimeOptions<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>;
    readonly sitePolicies: SitePolicyManager;
    readonly features: FeatureModuleLoader;
    readonly adaptive: AdaptiveRendererController;
    readonly lifecycle: RuntimeLifecycleController;
    readonly now: () => number;
    constructor(options: ExtensionPetRuntimeOptions<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>);
    get status(): ExtensionPetRuntimePublicStatus;
    start(target: Element | ShadowRoot, url: string, probe?: RuntimeProbe): Promise<ExtensionPetRuntimePublicStatus>;
    navigate(url: string, probe?: RuntimeProbe): Promise<ExtensionPetRuntimePublicStatus>;
    update(state: PetVisualState): void;
    resize(width: number, height: number, devicePixelRatio?: number): void;
    recordProbe(probe: RuntimeProbe): Promise<RuntimeEvaluation | null>;
    refreshPolicy(): Promise<ResolvedSitePolicy>;
    setCurrentSitePolicy(patch: SitePolicyPatch, persistence?: 'session' | 'origin', ttlMs?: number): Promise<ResolvedSitePolicy>;
    forceRenderer(renderer: RendererKind): Promise<void>;
    runAudit(context: TAuditContext, signal?: AbortSignal): Promise<TAuditResult>;
    runAnalysis(context: TAnalysisContext, signal?: AbortSignal): Promise<TAnalysisResult>;
    runModification(context: TModificationContext, signal?: AbortSignal): Promise<TModificationResult>;
    runRepositoryPublish(context: TRepositoryContext, signal?: AbortSignal): Promise<TRepositoryResult>;
    runCollaboration(context: TCollaborationContext, signal?: AbortSignal): Promise<TCollaborationResult>;
    attachBrowserLifecycle(options?: Omit<BrowserLifecycleMonitorOptions, 'target'> & {
        target?: Element;
    }): BrowserLifecycleMonitor;
    schedule3DWarmup(scheduler?: IdlePrefetchScheduler): () => void;
    handleCommand(command: ExtensionRuntimeCommand<TAuditContext, TAnalysisContext, TModificationContext, TRepositoryContext, TCollaborationContext>): Promise<ExtensionRuntimeCommandResult<TAuditResult | TAnalysisResult | TModificationResult | TRepositoryResult | TCollaborationResult>>;
    dispose(): Promise<void>;
}
export declare function createExtensionRuntimeMessageHandler<TAuditContext = unknown, TAuditResult = unknown, TAnalysisContext = unknown, TAnalysisResult = unknown, TModificationContext = unknown, TModificationResult = unknown, TRepositoryContext = unknown, TRepositoryResult = unknown, TCollaborationContext = unknown, TCollaborationResult = unknown>(runtime: ExtensionPetRuntime<TAuditContext, TAuditResult, TAnalysisContext, TAnalysisResult, TModificationContext, TModificationResult, TRepositoryContext, TRepositoryResult, TCollaborationContext, TCollaborationResult>): (message: unknown) => Promise<ExtensionRuntimeCommandResult<TAuditResult | TAnalysisResult | TModificationResult | TRepositoryResult | TCollaborationResult>>;
export declare function validateCommand<TAuditContext = unknown, TAnalysisContext = unknown, TModificationContext = unknown, TRepositoryContext = unknown, TCollaborationContext = unknown>(value: unknown): ExtensionRuntimeCommand<TAuditContext, TAnalysisContext, TModificationContext, TRepositoryContext, TCollaborationContext>;
//# sourceMappingURL=index.d.ts.map