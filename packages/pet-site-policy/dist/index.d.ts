/**
 * Per-site controls for the YK Pets browser pet.
 * The module is browser-API agnostic and can be backed by chrome.storage.local.
 */
export type SitePetMode = 'enabled' | 'paused' | 'hidden';
export type SiteRendererPreference = 'auto' | '2d' | '3d';
export interface SitePolicy {
    mode: SitePetMode;
    renderer: SiteRendererPreference;
    audioEnabled: boolean;
    interactionsEnabled: boolean;
    auditEnabled: boolean;
}
export interface SitePolicyPatch {
    mode?: SitePetMode;
    renderer?: SiteRendererPreference;
    audioEnabled?: boolean;
    interactionsEnabled?: boolean;
    auditEnabled?: boolean;
}
export interface SiteRule {
    id: string;
    pattern: string;
    policy: SitePolicyPatch;
    priority?: number;
    createdAt: number;
    updatedAt: number;
}
export interface SitePolicySnapshot {
    schema: 'yk-pets.site-policy/v1';
    defaultPolicy: SitePolicy;
    rules: SiteRule[];
}
export interface ResolvedSitePolicy extends SitePolicy {
    url: string;
    origin: string;
    siteKey: string;
    matchedRuleIds: string[];
    sessionOverride: boolean;
}
export interface AsyncKeyValueStore {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove?(key: string): Promise<void>;
}
export interface ChromeStorageAreaLike {
    get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove?(keys: string | string[]): Promise<void>;
}
export interface SitePolicyManagerOptions {
    storageKey?: string;
    now?: () => number;
    defaultPolicy?: SitePolicyPatch;
}
export interface SessionOverride {
    siteKey: string;
    policy: SitePolicyPatch;
    expiresAt?: number;
}
export interface SitePolicyChangeEvent {
    type: 'default' | 'rule-added' | 'rule-updated' | 'rule-removed' | 'session' | 'import';
    at: number;
    ruleId?: string;
    siteKey?: string;
}
type Listener = (event: SitePolicyChangeEvent) => void;
export declare class MemoryKeyValueStore implements AsyncKeyValueStore {
    readonly values: Map<string, unknown>;
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
}
export declare function createChromeStorageAdapter(area: ChromeStorageAreaLike): AsyncKeyValueStore;
export declare class SitePolicyManager {
    #private;
    readonly storage: AsyncKeyValueStore;
    readonly storageKey: string;
    readonly now: () => number;
    constructor(storage?: AsyncKeyValueStore, options?: SitePolicyManagerOptions);
    onChange(listener: Listener): () => void;
    load(): Promise<void>;
    getSnapshot(): Promise<SitePolicySnapshot>;
    setDefaultPolicy(policy: SitePolicyPatch): Promise<SitePolicy>;
    listRules(): Promise<SiteRule[]>;
    addRule(input: Omit<SiteRule, 'createdAt' | 'updatedAt'> & Partial<Pick<SiteRule, 'createdAt' | 'updatedAt'>>): Promise<SiteRule>;
    updateRule(id: string, patch: Partial<Pick<SiteRule, 'pattern' | 'policy' | 'priority'>>): Promise<SiteRule>;
    removeRule(id: string): Promise<boolean>;
    setSessionOverride(url: string, policy: SitePolicyPatch, ttlMs?: number): SessionOverride;
    clearSessionOverride(urlOrSiteKey: string): boolean;
    resolve(url: string): Promise<ResolvedSitePolicy>;
    exportSnapshot(): Promise<string>;
    importSnapshot(value: string | unknown): Promise<SitePolicySnapshot>;
    reset(): Promise<void>;
}
export declare function getSiteKey(url: string): string;
export declare function matchesSitePattern(pattern: string, url: string): boolean;
export declare function validateSitePolicySnapshot(value: unknown): SitePolicySnapshot;
export {};
//# sourceMappingURL=index.d.ts.map