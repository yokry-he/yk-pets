/**
 * Deduplicated, dependency-aware, timeout-bounded lazy feature loading.
 * Intended for splitting 3D rendering, audit collection, and optional agent features.
 */
export type FeatureLoadState = 'idle' | 'loading' | 'ready' | 'fallback' | 'failed' | 'disabled' | 'disposed';
export interface FeatureLoadContext {
    name: string;
    signal: AbortSignal;
    dependencyValues: ReadonlyMap<string, unknown>;
}
export interface FeatureDefinition<T = unknown> {
    name: string;
    dependencies?: string[];
    timeoutMs?: number;
    load(context: FeatureLoadContext): Promise<T> | T;
    fallback?(error: unknown, context: FeatureLoadContext): Promise<T> | T;
    dispose?(value: T): Promise<void> | void;
}
export interface FeatureStatus {
    name: string;
    state: FeatureLoadState;
    attempts: number;
    loadedAt?: number;
    failedAt?: number;
    error?: unknown;
    dependencies: string[];
}
export interface FeatureLoaderEvent {
    name: string;
    previous: FeatureLoadState;
    current: FeatureLoadState;
    at: number;
    error?: unknown;
}
export interface FeatureLoadOptions {
    signal?: AbortSignal;
    retry?: boolean;
}
export interface IdlePrefetchScheduler {
    (task: () => void | Promise<void>): () => void;
}
type FeatureListener = (event: FeatureLoaderEvent) => void;
export declare class FeatureModuleLoader {
    #private;
    readonly now: () => number;
    constructor(definitions?: FeatureDefinition[], now?: () => number);
    onChange(listener: FeatureListener): () => void;
    register<T>(definition: FeatureDefinition<T>): void;
    has(name: string): boolean;
    get<T>(name: string): T | undefined;
    status(name: string): FeatureStatus;
    list(): FeatureStatus[];
    load<T>(name: string, options?: FeatureLoadOptions): Promise<T>;
    prefetch(name: string): Promise<unknown>;
    schedulePrefetch(names: string[], scheduler: IdlePrefetchScheduler): () => void;
    disable(name: string): Promise<void>;
    enable(name: string): void;
    reset(name: string): Promise<void>;
    dispose(): Promise<void>;
}
export declare function validateFeatureGraph(definitions: FeatureDefinition[]): string[];
export {};
//# sourceMappingURL=index.d.ts.map