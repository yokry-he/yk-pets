/**
 * Runtime lifecycle coordination for YK Pets renderers.
 * Pauses expensive animation while a page is hidden, frozen, offscreen, or site-paused.
 */
export type RuntimeActivity = 'active' | 'paused' | 'hidden' | 'disposed';
export type SiteRuntimeMode = 'enabled' | 'paused' | 'hidden';
export type RuntimePauseReason = 'site-paused' | 'site-hidden' | 'page-hidden' | 'offscreen' | 'frozen' | 'page-inactive' | 'manual' | 'disposed' | 'none';
export interface RuntimeLifecycleSignals {
    siteMode: SiteRuntimeMode;
    pageVisible: boolean;
    inViewport: boolean;
    frozen: boolean;
    pageActive: boolean;
    manualPaused: boolean;
}
export interface RuntimeLifecycleOptions {
    pauseWhenPageHidden?: boolean;
    pauseWhenOffscreen?: boolean;
    pauseWhenFrozen?: boolean;
    pauseWhenPageInactive?: boolean;
}
export interface RuntimeActivityTarget {
    activate(reason: RuntimePauseReason): void | Promise<void>;
    pause(reason: RuntimePauseReason): void | Promise<void>;
    hide(reason: RuntimePauseReason): void | Promise<void>;
    dispose?(): void | Promise<void>;
}
export interface RuntimeLifecycleSnapshot {
    activity: RuntimeActivity;
    reason: RuntimePauseReason;
    signals: RuntimeLifecycleSignals;
    transitionAt: number;
}
export interface RuntimeLifecycleEvent {
    previous: RuntimeActivity;
    current: RuntimeActivity;
    reason: RuntimePauseReason;
    at: number;
    signals: RuntimeLifecycleSignals;
}
export interface DocumentEventSourceLike {
    visibilityState?: string;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}
export interface WindowEventSourceLike {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}
export interface IntersectionObserverEntryLike {
    isIntersecting: boolean;
    intersectionRatio?: number;
}
export interface IntersectionObserverLike {
    observe(target: Element): void;
    disconnect(): void;
}
export type IntersectionObserverFactory = (callback: (entries: IntersectionObserverEntryLike[]) => void) => IntersectionObserverLike;
export interface BrowserLifecycleMonitorOptions {
    document?: DocumentEventSourceLike;
    window?: WindowEventSourceLike;
    intersectionObserverFactory?: IntersectionObserverFactory;
    target?: Element;
}
export interface IdleDeadlineLike {
    didTimeout: boolean;
    timeRemaining(): number;
}
export interface IdleSchedulerHost {
    requestIdleCallback?(callback: (deadline: IdleDeadlineLike) => void, options?: {
        timeout?: number;
    }): number;
    cancelIdleCallback?(handle: number): void;
    setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
    clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}
export interface IdleTaskOptions {
    timeoutMs?: number;
    fallbackDelayMs?: number;
    signal?: AbortSignal;
}
type LifecycleListener = (event: RuntimeLifecycleEvent) => void;
export declare class RuntimeLifecycleController {
    #private;
    readonly options: Required<RuntimeLifecycleOptions>;
    readonly now: () => number;
    constructor(target?: RuntimeActivityTarget | null, options?: RuntimeLifecycleOptions, now?: () => number);
    get snapshot(): RuntimeLifecycleSnapshot;
    onChange(listener: LifecycleListener): () => void;
    bind(target: RuntimeActivityTarget, synchronize?: boolean): Promise<void>;
    unbind(): void;
    update(signals: Partial<RuntimeLifecycleSignals>): Promise<RuntimeLifecycleSnapshot>;
    setSiteMode(mode: SiteRuntimeMode): Promise<RuntimeLifecycleSnapshot>;
    setPageVisible(visible: boolean): Promise<RuntimeLifecycleSnapshot>;
    setInViewport(inViewport: boolean): Promise<RuntimeLifecycleSnapshot>;
    setFrozen(frozen: boolean): Promise<RuntimeLifecycleSnapshot>;
    setPageActive(pageActive: boolean): Promise<RuntimeLifecycleSnapshot>;
    setManualPaused(manualPaused: boolean): Promise<RuntimeLifecycleSnapshot>;
    dispose(disposeTarget?: boolean): Promise<void>;
}
export declare class BrowserLifecycleMonitor {
    #private;
    readonly controller: RuntimeLifecycleController;
    readonly options: BrowserLifecycleMonitorOptions;
    constructor(controller: RuntimeLifecycleController, options?: BrowserLifecycleMonitorOptions);
    start(): void;
    stop(): void;
}
export declare function createAnimationActivityTarget(options: {
    start(): void | Promise<void>;
    stop(): void | Promise<void>;
    show?(): void | Promise<void>;
    hide?(): void | Promise<void>;
    dispose?(): void | Promise<void>;
}): RuntimeActivityTarget;
export declare function scheduleIdleTask(task: (deadline: IdleDeadlineLike) => void | Promise<void>, options?: IdleTaskOptions): () => void;
export declare function scheduleIdleTaskWithHost(host: IdleSchedulerHost, task: (deadline: IdleDeadlineLike) => void | Promise<void>, options?: IdleTaskOptions): () => void;
export declare function evaluateActivity(signals: RuntimeLifecycleSignals, options?: Required<RuntimeLifecycleOptions>): {
    activity: Exclude<RuntimeActivity, 'disposed'>;
    reason: RuntimePauseReason;
};
export {};
//# sourceMappingURL=index.d.ts.map