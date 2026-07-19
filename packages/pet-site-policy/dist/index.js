/**
 * Per-site controls for the YK Pets browser pet.
 * The module is browser-API agnostic and can be backed by chrome.storage.local.
 */
const DEFAULT_POLICY = Object.freeze({
    mode: 'enabled',
    renderer: 'auto',
    audioEnabled: true,
    interactionsEnabled: true,
    auditEnabled: true,
});
const VALID_MODES = new Set(['enabled', 'paused', 'hidden']);
const VALID_RENDERERS = new Set(['auto', '2d', '3d']);
export class MemoryKeyValueStore {
    values = new Map();
    async get(key) {
        return clone(this.values.get(key));
    }
    async set(key, value) {
        this.values.set(key, clone(value));
    }
    async remove(key) {
        this.values.delete(key);
    }
}
export function createChromeStorageAdapter(area) {
    return {
        async get(key) {
            const result = await area.get(key);
            return clone(result[key]);
        },
        async set(key, value) {
            await area.set({ [key]: clone(value) });
        },
        async remove(key) {
            await area.remove?.(key);
        },
    };
}
export class SitePolicyManager {
    storage;
    storageKey;
    now;
    #snapshot;
    #loaded = false;
    #loading = null;
    #session = new Map();
    #listeners = new Set();
    constructor(storage = new MemoryKeyValueStore(), options = {}) {
        this.storage = storage;
        this.storageKey = options.storageKey ?? 'yk-pets.site-policy.v1';
        this.now = options.now ?? Date.now;
        this.#snapshot = {
            schema: 'yk-pets.site-policy/v1',
            defaultPolicy: mergePolicy(DEFAULT_POLICY, options.defaultPolicy),
            rules: [],
        };
    }
    onChange(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    async load() {
        if (this.#loaded)
            return;
        if (this.#loading)
            return this.#loading;
        this.#loading = (async () => {
            const stored = await this.storage.get(this.storageKey);
            if (stored !== undefined && stored !== null)
                this.#snapshot = validateSnapshot(stored);
            this.#loaded = true;
            this.#loading = null;
        })();
        return this.#loading;
    }
    async getSnapshot() {
        await this.load();
        return clone(this.#snapshot);
    }
    async setDefaultPolicy(policy) {
        await this.load();
        this.#snapshot.defaultPolicy = mergePolicy(this.#snapshot.defaultPolicy, validatePolicyPatch(policy));
        await this.#persist();
        this.#emit({ type: 'default', at: this.now() });
        return clone(this.#snapshot.defaultPolicy);
    }
    async listRules() {
        await this.load();
        return clone(this.#snapshot.rules);
    }
    async addRule(input) {
        await this.load();
        if (!input.id.trim())
            throw new Error('Site rule id is required');
        if (this.#snapshot.rules.some(rule => rule.id === input.id))
            throw new Error(`Site rule already exists: ${input.id}`);
        compilePattern(input.pattern);
        const at = this.now();
        const rule = {
            id: input.id,
            pattern: input.pattern,
            policy: validatePolicyPatch(input.policy),
            priority: normalizePriority(input.priority),
            createdAt: input.createdAt ?? at,
            updatedAt: input.updatedAt ?? at,
        };
        this.#snapshot.rules.push(rule);
        await this.#persist();
        this.#emit({ type: 'rule-added', at, ruleId: rule.id });
        return clone(rule);
    }
    async updateRule(id, patch) {
        await this.load();
        const rule = this.#snapshot.rules.find(candidate => candidate.id === id);
        if (!rule)
            throw new Error(`Unknown site rule: ${id}`);
        if (patch.pattern !== undefined) {
            compilePattern(patch.pattern);
            rule.pattern = patch.pattern;
        }
        if (patch.policy !== undefined)
            rule.policy = validatePolicyPatch(patch.policy);
        if (patch.priority !== undefined)
            rule.priority = normalizePriority(patch.priority);
        rule.updatedAt = this.now();
        await this.#persist();
        this.#emit({ type: 'rule-updated', at: rule.updatedAt, ruleId: id });
        return clone(rule);
    }
    async removeRule(id) {
        await this.load();
        const index = this.#snapshot.rules.findIndex(rule => rule.id === id);
        if (index < 0)
            return false;
        this.#snapshot.rules.splice(index, 1);
        await this.#persist();
        this.#emit({ type: 'rule-removed', at: this.now(), ruleId: id });
        return true;
    }
    setSessionOverride(url, policy, ttlMs) {
        const site = parseSite(url);
        if (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0))
            throw new Error('Session override ttlMs must be positive');
        const override = {
            siteKey: site.siteKey,
            policy: validatePolicyPatch(policy),
            expiresAt: ttlMs === undefined ? undefined : this.now() + ttlMs,
        };
        this.#session.set(site.siteKey, override);
        this.#emit({ type: 'session', at: this.now(), siteKey: site.siteKey });
        return clone(override);
    }
    clearSessionOverride(urlOrSiteKey) {
        let siteKey = urlOrSiteKey;
        try {
            siteKey = parseSite(urlOrSiteKey).siteKey;
        }
        catch { /* already a site key */ }
        const removed = this.#session.delete(siteKey);
        if (removed)
            this.#emit({ type: 'session', at: this.now(), siteKey });
        return removed;
    }
    async resolve(url) {
        await this.load();
        const site = parseSite(url);
        const matched = this.#snapshot.rules
            .map(rule => ({ rule, compiled: compilePattern(rule.pattern) }))
            .filter(item => item.compiled.matches(site))
            .sort((a, b) => {
            const specificity = a.compiled.specificity - b.compiled.specificity;
            if (specificity !== 0)
                return specificity;
            const priority = (a.rule.priority ?? 0) - (b.rule.priority ?? 0);
            if (priority !== 0)
                return priority;
            return a.rule.updatedAt - b.rule.updatedAt;
        });
        let policy = clone(this.#snapshot.defaultPolicy);
        for (const { rule } of matched)
            policy = mergePolicy(policy, rule.policy);
        let sessionOverride = false;
        const session = this.#session.get(site.siteKey);
        if (session) {
            if (session.expiresAt !== undefined && session.expiresAt <= this.now())
                this.#session.delete(site.siteKey);
            else {
                policy = mergePolicy(policy, session.policy);
                sessionOverride = true;
            }
        }
        return {
            ...policy,
            url: site.url,
            origin: site.origin,
            siteKey: site.siteKey,
            matchedRuleIds: matched.map(item => item.rule.id),
            sessionOverride,
        };
    }
    async exportSnapshot() {
        return JSON.stringify(await this.getSnapshot(), null, 2);
    }
    async importSnapshot(value) {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        this.#snapshot = validateSnapshot(parsed);
        this.#loaded = true;
        await this.#persist();
        this.#emit({ type: 'import', at: this.now() });
        return clone(this.#snapshot);
    }
    async reset() {
        this.#snapshot = { schema: 'yk-pets.site-policy/v1', defaultPolicy: clone(DEFAULT_POLICY), rules: [] };
        this.#session.clear();
        this.#loaded = true;
        await this.storage.remove?.(this.storageKey);
        this.#emit({ type: 'import', at: this.now() });
    }
    async #persist() {
        await this.storage.set(this.storageKey, clone(this.#snapshot));
    }
    #emit(event) {
        for (const listener of this.#listeners)
            listener(event);
    }
}
export function getSiteKey(url) {
    return parseSite(url).siteKey;
}
export function matchesSitePattern(pattern, url) {
    return compilePattern(pattern).matches(parseSite(url));
}
export function validateSitePolicySnapshot(value) {
    return validateSnapshot(value);
}
function parseSite(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error(`Invalid site URL: ${value}`);
    }
    const protocol = url.protocol.slice(0, -1).toLowerCase();
    const hostname = url.hostname.toLowerCase();
    const host = url.host.toLowerCase();
    const origin = url.origin === 'null' ? `${url.protocol}//${host}` : url.origin.toLowerCase();
    const siteKey = host ? `${protocol}://${host}` : `${protocol}://`;
    return { url: url.href, protocol, host, hostname, pathname: url.pathname || '/', origin, siteKey };
}
function compilePattern(pattern) {
    const input = pattern.trim();
    if (!input)
        throw new Error('Site pattern is required');
    if (input === '<all_urls>' || input === '*')
        return { matches: () => true, specificity: 0 };
    let schemePattern = '*';
    let hostPattern = input;
    let pathPattern = '/*';
    if (input.includes('://')) {
        const match = /^([^:]+):\/\/([^/]*)(\/.*)?$/.exec(input);
        if (!match)
            throw new Error(`Invalid site pattern: ${pattern}`);
        schemePattern = match[1].toLowerCase();
        hostPattern = match[2].toLowerCase();
        pathPattern = match[3] ?? '/*';
    }
    else {
        const slash = input.indexOf('/');
        if (slash >= 0) {
            hostPattern = input.slice(0, slash).toLowerCase();
            pathPattern = input.slice(slash);
        }
        else
            hostPattern = input.toLowerCase();
    }
    if (!hostPattern && schemePattern !== 'file')
        throw new Error(`Invalid site pattern host: ${pattern}`);
    if (schemePattern !== '*' && !/^[a-z][a-z0-9+.-]*$/.test(schemePattern))
        throw new Error(`Invalid site pattern scheme: ${pattern}`);
    if (hostPattern.includes('**'))
        throw new Error(`Invalid site pattern wildcard: ${pattern}`);
    const schemeRegex = wildcardRegex(schemePattern);
    const hostRegex = hostPattern.startsWith('*.')
        ? new RegExp(`^(?:[^.]+\\.)*${escapeRegex(hostPattern.slice(2))}$`, 'i')
        : wildcardRegex(hostPattern);
    const pathRegex = wildcardRegex(pathPattern);
    const specificity = nonWildcardLength(schemePattern) * 10_000 + nonWildcardLength(hostPattern) * 100 + nonWildcardLength(pathPattern);
    return {
        specificity,
        matches(site) {
            const candidateHost = hostPattern.includes(':') ? site.host : site.hostname;
            return schemeRegex.test(site.protocol) && hostRegex.test(candidateHost) && pathRegex.test(site.pathname);
        },
    };
}
function wildcardRegex(value) {
    return new RegExp(`^${value.split('*').map(escapeRegex).join('.*')}$`, 'i');
}
function escapeRegex(value) {
    return value.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
}
function nonWildcardLength(value) {
    return value.replace(/\*/g, '').length;
}
function normalizePriority(value) {
    if (value === undefined)
        return 0;
    if (!Number.isFinite(value) || !Number.isInteger(value))
        throw new Error('Site rule priority must be an integer');
    return Math.max(-10_000, Math.min(10_000, value));
}
function mergePolicy(base, patch) {
    if (!patch)
        return clone(base);
    return {
        mode: patch.mode ?? base.mode,
        renderer: patch.renderer ?? base.renderer,
        audioEnabled: patch.audioEnabled ?? base.audioEnabled,
        interactionsEnabled: patch.interactionsEnabled ?? base.interactionsEnabled,
        auditEnabled: patch.auditEnabled ?? base.auditEnabled,
    };
}
function validatePolicyPatch(value) {
    if (!isRecord(value))
        throw new Error('Site policy patch must be an object');
    const output = {};
    if (value.mode !== undefined) {
        if (!VALID_MODES.has(value.mode))
            throw new Error(`Invalid site mode: ${String(value.mode)}`);
        output.mode = value.mode;
    }
    if (value.renderer !== undefined) {
        if (!VALID_RENDERERS.has(value.renderer))
            throw new Error(`Invalid renderer preference: ${String(value.renderer)}`);
        output.renderer = value.renderer;
    }
    for (const key of ['audioEnabled', 'interactionsEnabled', 'auditEnabled']) {
        if (value[key] !== undefined) {
            if (typeof value[key] !== 'boolean')
                throw new Error(`${key} must be boolean`);
            output[key] = value[key];
        }
    }
    return output;
}
function validateSnapshot(value) {
    if (!isRecord(value) || value.schema !== 'yk-pets.site-policy/v1')
        throw new Error('Invalid site policy snapshot schema');
    if (!isRecord(value.defaultPolicy))
        throw new Error('Invalid default site policy');
    const defaultPatch = validatePolicyPatch(value.defaultPolicy);
    const defaultPolicy = mergePolicy(DEFAULT_POLICY, defaultPatch);
    if (!Array.isArray(value.rules))
        throw new Error('Site policy rules must be an array');
    const ids = new Set();
    const rules = value.rules.map((candidate, index) => {
        if (!isRecord(candidate))
            throw new Error(`Site rule ${index} must be an object`);
        const id = String(candidate.id ?? '').trim();
        const pattern = String(candidate.pattern ?? '').trim();
        if (!id || ids.has(id))
            throw new Error(`Invalid or duplicate site rule id: ${id}`);
        ids.add(id);
        compilePattern(pattern);
        const createdAt = Number(candidate.createdAt);
        const updatedAt = Number(candidate.updatedAt);
        if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt))
            throw new Error(`Invalid timestamps for site rule: ${id}`);
        return {
            id,
            pattern,
            policy: validatePolicyPatch(candidate.policy),
            priority: normalizePriority(candidate.priority === undefined ? undefined : Number(candidate.priority)),
            createdAt,
            updatedAt,
        };
    });
    return { schema: 'yk-pets.site-policy/v1', defaultPolicy, rules };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function clone(value) {
    if (value === undefined)
        return value;
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=index.js.map