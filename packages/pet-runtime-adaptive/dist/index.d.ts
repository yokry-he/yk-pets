/**
 * 文件职责 / File responsibility
 * 提供 3D/2D 渲染器自适应选择、健康度评估、状态迁移和浏览器运行时采样。
 * Provides adaptive 3D/2D renderer selection, health evaluation, state migration, and browser runtime sampling.
 */
export type RendererKind = '2d' | '3d';
export type RendererPreference = 'auto' | RendererKind;
export type FallbackReason = 'initial-selection' | 'manual-2d' | 'manual-3d' | 'webgl-unsupported' | 'webgl-context-lost' | 'reduced-motion' | 'save-data' | 'low-battery' | 'low-memory' | 'low-fps' | 'long-tasks' | 'recovered' | 'renderer-error';
export interface PetPointerState {
    x: number;
    y: number;
}
export interface PetVisualState {
    behavior: string;
    emotion?: string;
    speaking?: boolean;
    score?: number;
    pointer?: PetPointerState;
    secretMode?: boolean;
    reducedMotion?: boolean;
    [key: string]: unknown;
}
export interface PetRendererSnapshot {
    state?: PetVisualState;
    payload?: unknown;
}
export interface PetRenderer {
    readonly kind: RendererKind;
    mount(target: Element | ShadowRoot): void | Promise<void>;
    update(state: PetVisualState): void;
    resize?(width: number, height: number, devicePixelRatio: number): void;
    start?(): void | Promise<void>;
    stop?(): void | Promise<void>;
    setVisible?(visible: boolean): void | Promise<void>;
    snapshot?(): PetRendererSnapshot | undefined;
    restore?(snapshot: PetRendererSnapshot): void;
    dispose(): void;
}
export interface PetRendererFactory {
    readonly kind: RendererKind;
    create(): PetRenderer | Promise<PetRenderer>;
}
export interface RuntimeProbe {
    now: number;
    webglSupported: boolean;
    webglContextLost?: boolean;
    averageFps?: number;
    longTaskRatio?: number;
    deviceMemoryGb?: number;
    saveData?: boolean;
    reducedMotion?: boolean;
    batteryLevel?: number;
    charging?: boolean;
    preference?: RendererPreference;
}
export interface AdaptiveRuntimeOptions {
    initialRenderer?: RendererKind;
    preference?: RendererPreference;
    minimumFps?: number;
    maximumLongTaskRatio?: number;
    minimumDeviceMemoryGb?: number;
    minimumBatteryLevel?: number;
    degradeVotes?: number;
    recoverVotes?: number;
    switchCooldownMs?: number;
    prefer2DWhenReducedMotion?: boolean;
    prefer2DWhenSaveData?: boolean;
    prefer2DWhenLowBattery?: boolean;
    prefer2DWhenLowMemory?: boolean;
}
export interface RuntimeEvaluation {
    target: RendererKind;
    reason: FallbackReason;
    hard: boolean;
    healthyFor3D: boolean;
    details: string[];
}
export interface RendererSwitchEvent {
    previous: RendererKind | null;
    current: RendererKind;
    reason: FallbackReason;
    at: number;
}
export type AdaptiveRuntimeEventMap = {
    switch: RendererSwitchEvent;
    error: {
        error: unknown;
        phase: 'create' | 'mount' | 'update' | 'dispose' | 'start' | 'stop' | 'visibility';
        at: number;
    };
    probe: {
        probe: RuntimeProbe;
        evaluation: RuntimeEvaluation;
        at: number;
    };
};
export declare class RuntimeHealthEvaluator {
    readonly options: Required<AdaptiveRuntimeOptions>;
    constructor(options?: AdaptiveRuntimeOptions);
    evaluate(probe: RuntimeProbe): RuntimeEvaluation;
}
type Listener<K extends keyof AdaptiveRuntimeEventMap> = (event: AdaptiveRuntimeEventMap[K]) => void;
export declare class AdaptiveRendererController {
    #private;
    readonly evaluator: RuntimeHealthEvaluator;
    readonly factories: Readonly<Record<RendererKind, PetRendererFactory>>;
    constructor(factories: Record<RendererKind, PetRendererFactory>, options?: AdaptiveRuntimeOptions);
    get currentKind(): RendererKind | null;
    get currentState(): Readonly<PetVisualState>;
    on<K extends keyof AdaptiveRuntimeEventMap>(type: K, listener: Listener<K>): () => void;
    mount(target: Element | ShadowRoot, initialProbe?: RuntimeProbe): Promise<void>;
    update(state: PetVisualState): void;
    resize(width: number, height: number, devicePixelRatio?: number): void;
    pause(): Promise<void>;
    resume(): Promise<void>;
    setVisible(visible: boolean): Promise<void>;
    recordProbe(probe: RuntimeProbe): Promise<RuntimeEvaluation>;
    force(kind: RendererKind, reason?: FallbackReason): Promise<void>;
    dispose(): Promise<void>;
}
export interface BrowserRuntimeMonitorOptions {
    sampleWindowMs?: number;
    probeIntervalMs?: number;
    webglCanvasFactory?: () => HTMLCanvasElement;
    now?: () => number;
}
export declare class BrowserRuntimeMonitor {
    #private;
    readonly options: Required<BrowserRuntimeMonitorOptions>;
    constructor(options?: BrowserRuntimeMonitorOptions);
    start(listener: (probe: RuntimeProbe) => void): void;
    stop(): void;
}
export {};
//# sourceMappingURL=index.d.ts.map