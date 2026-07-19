/**
 * Restricted Chrome DevTools Protocol bridge for YK Pets.
 *
 * This package deliberately excludes arbitrary Runtime.evaluate, DOM mutation,
 * input synthesis, downloads, and script injection. Consumers must opt in to a
 * small command allowlist and bind every session to an explicit tab + origin.
 */
export const DEFAULT_ALLOWED_CDP_METHODS = Object.freeze([
    'DOM.enable',
    'DOM.getDocument',
    'DOM.querySelector',
    'DOM.describeNode',
    'DOM.getBoxModel',
    'CSS.enable',
    'CSS.getMatchedStylesForNode',
    'Accessibility.enable',
    'Accessibility.getPartialAXTree',
    'Performance.enable',
    'Performance.getMetrics',
    'Page.getLayoutMetrics',
    'Network.enable',
    'Network.disable',
    'Log.enable',
    'Runtime.enable',
]);
export const DEFAULT_ALLOWED_CDP_EVENTS = Object.freeze([
    'Log.entryAdded',
    'Runtime.consoleAPICalled',
    'Runtime.exceptionThrown',
    'Network.loadingFailed',
    'Network.responseReceived',
    'Performance.metrics',
]);
const ALWAYS_DENIED_METHOD_PATTERNS = [
    /^Runtime\.(?:evaluate|callFunctionOn|compileScript|runScript|addBinding)$/,
    /^Page\.(?:addScriptToEvaluateOnNewDocument|removeScriptToEvaluateOnNewDocument|setDownloadBehavior|navigate|reload|stopLoading)$/,
    /^DOM\.(?:set|remove|move|copyTo|setFileInputFiles|focus|performSearch|discardSearch)/,
    /^(?:Input|Emulation|Browser|Storage|Fetch)\./,
    /^Network\.(?:setCookie|setCookies|deleteCookies|clearBrowserCookies|getAllCookies|getCookies|getResponseBody|setExtraHTTPHeaders|emulateNetworkConditions)$/,
];
export class ChromeDebuggerTransport {
    api;
    protocolVersion;
    now;
    #target = null;
    #listeners = new Set();
    #boundEvent;
    constructor(api, protocolVersion = '1.3', now = Date.now) {
        this.api = api;
        this.protocolVersion = protocolVersion;
        this.now = now;
        this.#boundEvent = (source, method, params) => {
            if (!this.#target || source.tabId !== this.#target.tabId)
                return;
            const event = { method, params, at: this.now() };
            for (const listener of this.#listeners)
                listener(event);
        };
    }
    get attached() {
        return this.#target !== null;
    }
    get target() {
        return this.#target ? { ...this.#target } : null;
    }
    async attach(target) {
        validateTarget(target);
        if (this.#target) {
            if (this.#target.tabId === target.tabId && this.#target.origin === target.origin)
                return;
            throw new Error('CDP transport is already attached to another target');
        }
        await this.api.attach({ tabId: target.tabId }, this.protocolVersion);
        this.#target = { ...target, origin: normalizeOrigin(target.origin) };
        this.api.onEvent.addListener(this.#boundEvent);
    }
    async detach() {
        const target = this.#target;
        if (!target)
            return;
        this.#target = null;
        this.api.onEvent.removeListener(this.#boundEvent);
        await this.api.detach({ tabId: target.tabId });
    }
    async send(method, params) {
        if (!this.#target)
            throw new Error('CDP transport is not attached');
        return this.api.sendCommand({ tabId: this.#target.tabId }, method, params);
    }
    onEvent(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
}
export class RestrictedCdpClient {
    transport;
    allowedMethods;
    allowedEvents;
    allowedOrigins;
    timeoutMs;
    maxCommands;
    eventBufferSize;
    now;
    redact;
    #commandCount = 0;
    #nextCommandId = 1;
    #events = [];
    #history = [];
    #detachEvents = null;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.allowedMethods = new Set(options.allowedMethods ?? DEFAULT_ALLOWED_CDP_METHODS);
        this.allowedEvents = new Set(options.allowedEvents ?? DEFAULT_ALLOWED_CDP_EVENTS);
        this.allowedOrigins = Object.freeze([...(options.allowedOrigins ?? [])]);
        this.timeoutMs = positiveInteger(options.timeoutMs ?? 5_000, 'timeoutMs');
        this.maxCommands = positiveInteger(options.maxCommands ?? 250, 'maxCommands');
        this.eventBufferSize = positiveInteger(options.eventBufferSize ?? 200, 'eventBufferSize');
        this.now = options.now ?? Date.now;
        this.redact = options.redact ?? redactSensitiveData;
        for (const method of this.allowedMethods)
            assertMethodCanBeAllowed(method);
    }
    get attached() {
        return this.transport.attached;
    }
    get target() {
        return this.transport.target;
    }
    get commandCount() {
        return this.#commandCount;
    }
    get history() {
        return this.#history.map(record => ({ ...record, params: record.params ? clone(record.params) : undefined }));
    }
    async attach(target) {
        validateTarget(target);
        if (this.allowedOrigins.length > 0 && !this.allowedOrigins.some(pattern => matchesOriginPattern(target.origin, pattern))) {
            throw new Error(`CDP target origin is outside the allowed scope: ${normalizeOrigin(target.origin)}`);
        }
        await this.transport.attach({ ...target, origin: normalizeOrigin(target.origin) });
        this.#detachEvents ??= this.transport.onEvent(event => this.#recordEvent(event));
    }
    async detach() {
        this.#detachEvents?.();
        this.#detachEvents = null;
        await this.transport.detach();
    }
    async send(method, params, signal) {
        const startedAt = this.now();
        const id = this.#nextCommandId++;
        let outcome = 'success';
        let errorMessage;
        try {
            this.#assertCommandAllowed(method, params);
            if (signal?.aborted)
                throw signal.reason ?? new DOMException('Aborted', 'AbortError');
            if (this.#commandCount >= this.maxCommands)
                throw new Error(`CDP command budget exceeded (${this.maxCommands})`);
            this.#commandCount += 1;
            const result = await withTimeout(this.transport.send(method, params), this.timeoutMs, signal, method);
            return this.redact(result);
        }
        catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
            outcome = /not allowed|outside|budget|invalid|denied/i.test(errorMessage)
                ? 'denied'
                : /timed out/i.test(errorMessage)
                    ? 'timeout'
                    : 'error';
            throw error;
        }
        finally {
            this.#history.push({
                id,
                method,
                params: params ? this.redact(params) : undefined,
                startedAt,
                finishedAt: this.now(),
                outcome,
                error: errorMessage,
            });
        }
    }
    events(options = {}) {
        const methods = options.methods ? new Set(options.methods) : null;
        return this.#events
            .filter(event => (options.since === undefined || event.at >= options.since) && (!methods || methods.has(event.method)))
            .map(event => ({ ...event, params: clone(event.params) }));
    }
    clearEvents() {
        this.#events = [];
    }
    async captureElementSnapshot(nodeId, signal) {
        assertInteger(nodeId, 'nodeId', 1);
        const node = await this.send('DOM.describeNode', { nodeId, depth: 1, pierce: true }, signal);
        const [boxModel, matchedStyles, accessibility] = await Promise.all([
            this.#optional('DOM.getBoxModel', { nodeId }, signal),
            this.#optional('CSS.getMatchedStylesForNode', { nodeId }, signal),
            this.#optional('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false }, signal),
        ]);
        return { node, boxModel, matchedStyles, accessibility, capturedAt: this.now() };
    }
    async capturePerformanceSnapshot(signal) {
        const performance = await this.send('Performance.getMetrics', undefined, signal);
        const layoutMetrics = await this.#optional('Page.getLayoutMetrics', undefined, signal);
        const metrics = (performance.metrics ?? [])
            .filter(metric => typeof metric.name === 'string' && typeof metric.value === 'number' && Number.isFinite(metric.value))
            .map(metric => ({ name: metric.name, value: metric.value }))
            .sort((a, b) => a.name.localeCompare(b.name));
        return { metrics, layoutMetrics, capturedAt: this.now() };
    }
    async enableReadOnlyDomains(signal) {
        for (const method of ['DOM.enable', 'CSS.enable', 'Accessibility.enable', 'Performance.enable', 'Network.enable', 'Log.enable', 'Runtime.enable']) {
            if (this.allowedMethods.has(method))
                await this.send(method, undefined, signal);
        }
    }
    async #optional(method, params, signal) {
        if (!this.allowedMethods.has(method))
            return null;
        try {
            return await this.send(method, params, signal);
        }
        catch {
            return null;
        }
    }
    #assertCommandAllowed(method, params) {
        if (!this.transport.attached)
            throw new Error('CDP client is not attached');
        assertMethodCanBeAllowed(method);
        if (!this.allowedMethods.has(method))
            throw new Error(`CDP method is not allowed: ${method}`);
        validateCommandParams(method, params);
    }
    #recordEvent(event) {
        if (!this.allowedEvents.has(event.method))
            return;
        this.#events.push({ method: event.method, params: this.redact(event.params), at: event.at });
        if (this.#events.length > this.eventBufferSize)
            this.#events.splice(0, this.#events.length - this.eventBufferSize);
    }
}
export function validateCommandParams(method, params) {
    const value = params ?? {};
    assertPlainObject(value, 'CDP params');
    switch (method) {
        case 'DOM.enable':
        case 'CSS.enable':
        case 'Accessibility.enable':
        case 'Performance.enable':
        case 'Performance.getMetrics':
        case 'Page.getLayoutMetrics':
        case 'Network.disable':
        case 'Log.enable':
        case 'Runtime.enable':
            assertOnlyKeys(value, []);
            return;
        case 'DOM.getDocument':
            assertOnlyKeys(value, ['depth', 'pierce']);
            optionalInteger(value.depth, 'depth', -1, 100);
            optionalBoolean(value.pierce, 'pierce');
            return;
        case 'DOM.querySelector':
            assertOnlyKeys(value, ['nodeId', 'selector']);
            assertInteger(value.nodeId, 'nodeId', 1);
            assertSafeSelector(value.selector);
            return;
        case 'DOM.describeNode':
            assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId', 'depth', 'pierce']);
            assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId']);
            optionalInteger(value.nodeId, 'nodeId', 1);
            optionalInteger(value.backendNodeId, 'backendNodeId', 1);
            optionalSafeString(value.objectId, 'objectId', 512);
            optionalInteger(value.depth, 'depth', -1, 100);
            optionalBoolean(value.pierce, 'pierce');
            return;
        case 'DOM.getBoxModel':
            assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId']);
            assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId']);
            optionalInteger(value.nodeId, 'nodeId', 1);
            optionalInteger(value.backendNodeId, 'backendNodeId', 1);
            optionalSafeString(value.objectId, 'objectId', 512);
            return;
        case 'CSS.getMatchedStylesForNode':
            assertOnlyKeys(value, ['nodeId']);
            assertInteger(value.nodeId, 'nodeId', 1);
            return;
        case 'Accessibility.getPartialAXTree':
            assertOnlyKeys(value, ['nodeId', 'backendNodeId', 'objectId', 'fetchRelatives']);
            assertAtLeastOne(value, ['nodeId', 'backendNodeId', 'objectId']);
            optionalInteger(value.nodeId, 'nodeId', 1);
            optionalInteger(value.backendNodeId, 'backendNodeId', 1);
            optionalSafeString(value.objectId, 'objectId', 512);
            optionalBoolean(value.fetchRelatives, 'fetchRelatives');
            return;
        case 'Network.enable':
            assertOnlyKeys(value, ['maxTotalBufferSize', 'maxResourceBufferSize', 'maxPostDataSize', 'reportDirectSocketTraffic', 'enableDurableMessages']);
            for (const key of ['maxTotalBufferSize', 'maxResourceBufferSize', 'maxPostDataSize'])
                optionalInteger(value[key], key, 0, 100_000_000);
            optionalBoolean(value.reportDirectSocketTraffic, 'reportDirectSocketTraffic');
            optionalBoolean(value.enableDurableMessages, 'enableDurableMessages');
            return;
        default:
            // Additional caller-provided read-only commands still receive structural limits.
            if (JSON.stringify(value).length > 32_768)
                throw new Error(`CDP params are too large: ${method}`);
    }
}
export function matchesOriginPattern(origin, pattern) {
    const normalized = normalizeOrigin(origin);
    const trimmed = pattern.trim();
    if (!trimmed)
        return false;
    if (trimmed === '*')
        return true;
    if (!trimmed.includes('*'))
        return normalized === normalizeOrigin(trimmed);
    const escaped = trimmed
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^.\\/:]+');
    return new RegExp(`^${escaped}$`, 'i').test(normalized);
}
export function redactSensitiveData(value) {
    return redactInternal(value, new WeakSet(), 0);
}
function redactInternal(value, seen, depth) {
    if (depth > 12)
        return '[MaxDepth]';
    if (typeof value === 'string')
        return redactString(value);
    if (value === null || typeof value !== 'object')
        return value;
    if (seen.has(value))
        return '[Circular]';
    seen.add(value);
    if (Array.isArray(value))
        return value.slice(0, 500).map(item => redactInternal(item, seen, depth + 1));
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 500)) {
        output[key] = isSensitiveKey(key) ? '[REDACTED]' : redactInternal(item, seen, depth + 1);
    }
    return output;
}
function redactString(value) {
    if (value.length > 20_000)
        value = `${value.slice(0, 20_000)}…[truncated]`;
    return value
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
        .replace(/([?&](?:token|access_token|api_key|key|secret|password)=)[^&#\s]+/gi, '$1[REDACTED]');
}
function isSensitiveKey(key) {
    return /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|client_secret|access_token|refresh_token|api[_-]?key|private[_-]?key)$/i.test(key);
}
function assertMethodCanBeAllowed(method) {
    if (!/^[A-Z][A-Za-z]+\.[A-Za-z][A-Za-z0-9]+$/.test(method))
        throw new Error(`Invalid CDP method: ${method}`);
    if (ALWAYS_DENIED_METHOD_PATTERNS.some(pattern => pattern.test(method)))
        throw new Error(`CDP method is permanently denied: ${method}`);
}
function validateTarget(target) {
    assertInteger(target.tabId, 'tabId', 0);
    normalizeOrigin(target.origin);
    if (target.url !== undefined) {
        const url = new URL(target.url);
        if (url.origin !== normalizeOrigin(target.origin))
            throw new Error('CDP target URL and origin do not match');
    }
}
function normalizeOrigin(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Only HTTP(S) CDP targets are allowed');
    if (url.username || url.password)
        throw new Error('CDP target origin must not contain credentials');
    return url.origin;
}
function assertSafeSelector(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2_048 || /[\u0000\r\n]/.test(value)) {
        throw new Error('Invalid selector');
    }
}
function assertPlainObject(value, name) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${name} must be an object`);
}
function assertOnlyKeys(value, keys) {
    const allowed = new Set(keys);
    for (const key of Object.keys(value))
        if (!allowed.has(key))
            throw new Error(`Unsupported CDP parameter: ${key}`);
}
function assertAtLeastOne(value, keys) {
    if (!keys.some(key => value[key] !== undefined))
        throw new Error(`One of ${keys.join(', ')} is required`);
}
function optionalBoolean(value, name) {
    if (value !== undefined && typeof value !== 'boolean')
        throw new Error(`${name} must be a boolean`);
}
function optionalSafeString(value, name, max) {
    if (value !== undefined && (typeof value !== 'string' || !value || value.length > max || /[\u0000\r\n]/.test(value))) {
        throw new Error(`${name} must be a safe string`);
    }
}
function optionalInteger(value, name, min, max = Number.MAX_SAFE_INTEGER) {
    if (value !== undefined)
        assertInteger(value, name, min, max);
}
function assertInteger(value, name, min, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isInteger(value) || value < min || value > max)
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
}
function positiveInteger(value, name) {
    assertInteger(value, name, 1);
    return value;
}
async function withTimeout(promise, timeoutMs, signal, label) {
    let timer;
    let detach = () => { };
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`CDP command timed out after ${timeoutMs}ms: ${label}`)), timeoutMs);
    });
    const aborted = new Promise((_, reject) => {
        if (!signal)
            return;
        const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        if (signal.aborted)
            abort();
        else {
            signal.addEventListener('abort', abort, { once: true });
            detach = () => signal.removeEventListener('abort', abort);
        }
    });
    try {
        return await Promise.race([promise, timeout, aborted]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        detach();
    }
}
function clone(value) {
    return value === undefined ? value : structuredClone(value);
}
//# sourceMappingURL=index.js.map