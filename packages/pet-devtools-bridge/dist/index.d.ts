/**
 * Restricted Chrome DevTools Protocol bridge for YK Pets.
 *
 * This package deliberately excludes arbitrary Runtime.evaluate, DOM mutation,
 * input synthesis, downloads, and script injection. Consumers must opt in to a
 * small command allowlist and bind every session to an explicit tab + origin.
 */
export interface CdpTarget {
    tabId: number;
    origin: string;
    url?: string;
}
export interface ChromeDebuggerTarget {
    tabId: number;
}
export interface ChromeDebuggerEventApi {
    addListener(listener: (source: ChromeDebuggerTarget, method: string, params?: unknown) => void): void;
    removeListener(listener: (source: ChromeDebuggerTarget, method: string, params?: unknown) => void): void;
}
export interface ChromeDebuggerApi {
    attach(target: ChromeDebuggerTarget, requiredVersion: string): Promise<void> | void;
    detach(target: ChromeDebuggerTarget): Promise<void> | void;
    sendCommand(target: ChromeDebuggerTarget, method: string, params?: Record<string, unknown>): Promise<unknown> | unknown;
    onEvent: ChromeDebuggerEventApi;
}
export interface CdpTransport {
    readonly attached: boolean;
    readonly target: CdpTarget | null;
    attach(target: CdpTarget): Promise<void>;
    detach(): Promise<void>;
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
    onEvent(listener: CdpEventListener): () => void;
}
export type CdpEventListener = (event: CdpEventRecord) => void;
export interface CdpEventRecord {
    method: string;
    params: unknown;
    at: number;
}
export interface CdpCommandRecord {
    id: number;
    method: string;
    params?: Record<string, unknown>;
    startedAt: number;
    finishedAt: number;
    outcome: 'success' | 'error' | 'timeout' | 'denied';
    error?: string;
}
export interface RestrictedCdpClientOptions {
    allowedMethods?: Iterable<string>;
    allowedEvents?: Iterable<string>;
    allowedOrigins?: string[];
    timeoutMs?: number;
    maxCommands?: number;
    eventBufferSize?: number;
    now?: () => number;
    redact?: (value: unknown) => unknown;
}
export interface ElementCdpSnapshot {
    node: unknown;
    boxModel: unknown | null;
    matchedStyles: unknown | null;
    accessibility: unknown | null;
    capturedAt: number;
}
export interface PerformanceCdpSnapshot {
    metrics: Array<{
        name: string;
        value: number;
    }>;
    layoutMetrics: unknown | null;
    capturedAt: number;
}
export declare const DEFAULT_ALLOWED_CDP_METHODS: readonly ["DOM.enable", "DOM.getDocument", "DOM.querySelector", "DOM.describeNode", "DOM.getBoxModel", "CSS.enable", "CSS.getMatchedStylesForNode", "Accessibility.enable", "Accessibility.getPartialAXTree", "Performance.enable", "Performance.getMetrics", "Page.getLayoutMetrics", "Network.enable", "Network.disable", "Log.enable", "Runtime.enable"];
export declare const DEFAULT_ALLOWED_CDP_EVENTS: readonly ["Log.entryAdded", "Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Network.loadingFailed", "Network.responseReceived", "Performance.metrics"];
export declare class ChromeDebuggerTransport implements CdpTransport {
    #private;
    readonly api: ChromeDebuggerApi;
    readonly protocolVersion: string;
    readonly now: () => number;
    constructor(api: ChromeDebuggerApi, protocolVersion?: string, now?: () => number);
    get attached(): boolean;
    get target(): CdpTarget | null;
    attach(target: CdpTarget): Promise<void>;
    detach(): Promise<void>;
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
    onEvent(listener: CdpEventListener): () => void;
}
export declare class RestrictedCdpClient {
    #private;
    readonly transport: CdpTransport;
    readonly allowedMethods: ReadonlySet<string>;
    readonly allowedEvents: ReadonlySet<string>;
    readonly allowedOrigins: readonly string[];
    readonly timeoutMs: number;
    readonly maxCommands: number;
    readonly eventBufferSize: number;
    readonly now: () => number;
    readonly redact: (value: unknown) => unknown;
    constructor(transport: CdpTransport, options?: RestrictedCdpClientOptions);
    get attached(): boolean;
    get target(): CdpTarget | null;
    get commandCount(): number;
    get history(): readonly CdpCommandRecord[];
    attach(target: CdpTarget): Promise<void>;
    detach(): Promise<void>;
    send<T = unknown>(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
    events(options?: {
        since?: number;
        methods?: string[];
    }): readonly CdpEventRecord[];
    clearEvents(): void;
    captureElementSnapshot(nodeId: number, signal?: AbortSignal): Promise<ElementCdpSnapshot>;
    capturePerformanceSnapshot(signal?: AbortSignal): Promise<PerformanceCdpSnapshot>;
    enableReadOnlyDomains(signal?: AbortSignal): Promise<void>;
}
export declare function validateCommandParams(method: string, params?: Record<string, unknown>): void;
export declare function matchesOriginPattern(origin: string, pattern: string): boolean;
export declare function redactSensitiveData(value: unknown): unknown;
//# sourceMappingURL=index.d.ts.map