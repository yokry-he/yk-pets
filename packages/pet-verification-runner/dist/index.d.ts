/**
 * Adapter-driven Lighthouse and Playwright verification for YK Pets.
 *
 * The package intentionally does not bundle or launch browsers. Hosts provide
 * audited adapters, while this layer validates declarative scenarios, enforces
 * origin scope and timeouts, normalizes results, and compares before/after runs.
 */
export interface VerificationTarget {
    label: string;
    url: string;
}
export interface LighthouseCategoryResult {
    score: number | null;
    title?: string;
}
export interface LighthouseAuditResult {
    score: number | null;
    title?: string;
    displayValue?: string;
}
export interface LighthouseResult {
    categories: Record<string, LighthouseCategoryResult>;
    metrics: Record<string, number>;
    audits: Record<string, LighthouseAuditResult>;
    warnings?: string[];
}
export interface PlaywrightAssertionResult {
    id: string;
    passed: boolean;
    message?: string;
    selector?: string;
    actual?: unknown;
    expected?: unknown;
}
export interface PlaywrightScenarioResult {
    id: string;
    title: string;
    passed: boolean;
    durationMs: number;
    assertions: PlaywrightAssertionResult[];
    consoleErrors?: string[];
    pageErrors?: string[];
    screenshotRefs?: string[];
}
export type SafePlaywrightStep = {
    action: 'click';
    selector: string;
} | {
    action: 'hover';
    selector: string;
} | {
    action: 'fill';
    selector: string;
    value: string;
} | {
    action: 'press';
    selector?: string;
    key: string;
} | {
    action: 'wait-for';
    selector: string;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeoutMs?: number;
} | {
    action: 'expect-visible';
    selector: string;
} | {
    action: 'expect-text';
    selector: string;
    text: string;
    exact?: boolean;
} | {
    action: 'expect-url';
    url: string;
} | {
    action: 'screenshot';
    name: string;
    selector?: string;
};
export interface SafePlaywrightScenario {
    id: string;
    title: string;
    steps: SafePlaywrightStep[];
    timeoutMs?: number;
    allowFormInput?: boolean;
}
export interface LighthouseAdapter {
    run(target: VerificationTarget, signal: AbortSignal): Promise<LighthouseResult>;
}
export interface PlaywrightAdapter {
    run(target: VerificationTarget, scenario: SafePlaywrightScenario, signal: AbortSignal): Promise<PlaywrightScenarioResult>;
}
export interface VerificationRunnerOptions {
    lighthouse?: LighthouseAdapter;
    playwright?: PlaywrightAdapter;
    allowedOrigins?: string[];
    timeoutMs?: number;
    now?: () => number;
}
export interface VerificationCapturePlan {
    lighthouse?: boolean;
    scenarios?: SafePlaywrightScenario[];
}
export interface VerificationSnapshot {
    target: VerificationTarget;
    capturedAt: number;
    lighthouse: LighthouseResult | null;
    scenarios: PlaywrightScenarioResult[];
    errors: Array<{
        source: 'lighthouse' | 'playwright';
        id?: string;
        message: string;
    }>;
}
export interface ScoreThreshold {
    min?: number;
    maxRegression?: number;
}
export interface MetricThreshold {
    direction?: 'lower-is-better' | 'higher-is-better';
    maxRegressionAbsolute?: number;
    maxRegressionRatio?: number;
}
export interface VerificationPolicy {
    scores?: Record<string, ScoreThreshold>;
    metrics?: Record<string, MetricThreshold>;
    requiredAudits?: string[];
    maxNewConsoleErrors?: number;
    maxNewPageErrors?: number;
    failOnCaptureError?: boolean;
}
export type VerificationFindingKind = 'score-below-minimum' | 'score-regression' | 'metric-regression' | 'required-audit-failed' | 'scenario-regression' | 'scenario-failed' | 'assertion-regression' | 'new-console-errors' | 'new-page-errors' | 'capture-error';
export interface VerificationFinding {
    id: string;
    kind: VerificationFindingKind;
    severity: 'error' | 'warning';
    message: string;
    before?: unknown;
    after?: unknown;
    limit?: unknown;
}
export interface VerificationImprovement {
    id: string;
    kind: 'score' | 'metric' | 'scenario' | 'assertion' | 'error-count';
    message: string;
    before?: unknown;
    after?: unknown;
}
export interface VerificationComparison {
    passed: boolean;
    before: VerificationSnapshot;
    after: VerificationSnapshot;
    findings: VerificationFinding[];
    improvements: VerificationImprovement[];
    summary: {
        errors: number;
        warnings: number;
        improvements: number;
        scenariosBeforePassed: number;
        scenariosAfterPassed: number;
    };
}
export declare class VerificationRunner {
    readonly lighthouse?: LighthouseAdapter;
    readonly playwright?: PlaywrightAdapter;
    readonly allowedOrigins: readonly string[];
    readonly timeoutMs: number;
    readonly now: () => number;
    constructor(options?: VerificationRunnerOptions);
    capture(target: VerificationTarget, plan?: VerificationCapturePlan, signal?: AbortSignal): Promise<VerificationSnapshot>;
    compare(before: VerificationSnapshot, after: VerificationSnapshot, policy?: VerificationPolicy): VerificationComparison;
    verify(beforeTarget: VerificationTarget, afterTarget: VerificationTarget, plan: VerificationCapturePlan, policy?: VerificationPolicy, signal?: AbortSignal): Promise<VerificationComparison>;
}
export declare function compareVerificationSnapshots(before: VerificationSnapshot, after: VerificationSnapshot, policy?: VerificationPolicy): VerificationComparison;
export declare function validateScenario(scenario: SafePlaywrightScenario, targetUrl?: string): void;
export declare function normalizeLighthouseResult(input: LighthouseResult): LighthouseResult;
//# sourceMappingURL=index.d.ts.map