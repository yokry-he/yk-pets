/**
 * Deduplicated, dependency-aware, timeout-bounded lazy feature loading.
 * Intended for splitting 3D rendering, audit collection, and optional agent features.
 */
export class FeatureModuleLoader {
    now;
    #records = new Map();
    #listeners = new Set();
    #disposed = false;
    constructor(definitions = [], now = Date.now) {
        this.now = now;
        for (const definition of definitions)
            this.register(definition);
    }
    onChange(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    register(definition) {
        if (this.#disposed)
            throw new Error('FeatureModuleLoader is disposed');
        validateDefinition(definition);
        if (this.#records.has(definition.name))
            throw new Error(`Feature already registered: ${definition.name}`);
        this.#records.set(definition.name, {
            definition: { ...definition, dependencies: [...(definition.dependencies ?? [])] },
            state: 'idle',
            attempts: 0,
        });
    }
    has(name) {
        return this.#records.has(name);
    }
    get(name) {
        const record = this.#records.get(name);
        if (!record || (record.state !== 'ready' && record.state !== 'fallback'))
            return undefined;
        return record.value;
    }
    status(name) {
        const record = this.#require(name);
        return snapshot(record);
    }
    list() {
        return [...this.#records.values()].map(snapshot);
    }
    async load(name, options = {}) {
        if (this.#disposed)
            throw new Error('FeatureModuleLoader is disposed');
        return this.#loadInternal(name, options, []);
    }
    prefetch(name) {
        return this.load(name).catch(() => undefined);
    }
    schedulePrefetch(names, scheduler) {
        if (this.#disposed)
            return () => { };
        return scheduler(async () => {
            for (const name of names) {
                if (this.#disposed)
                    return;
                await this.prefetch(name);
            }
        });
    }
    async disable(name) {
        const record = this.#require(name);
        record.controller?.abort(new DOMException(`Feature disabled: ${name}`, 'AbortError'));
        if (record.value !== undefined)
            await record.definition.dispose?.(record.value);
        record.value = undefined;
        record.promise = undefined;
        record.controller = undefined;
        record.error = undefined;
        record.loadedAt = undefined;
        record.failedAt = undefined;
        this.#setState(record, 'disabled');
    }
    enable(name) {
        const record = this.#require(name);
        if (record.state !== 'disabled')
            return;
        record.error = undefined;
        record.promise = undefined;
        record.controller = undefined;
        this.#setState(record, 'idle');
    }
    async reset(name) {
        const record = this.#require(name);
        record.controller?.abort(new DOMException(`Feature reset: ${name}`, 'AbortError'));
        if (record.value !== undefined)
            await record.definition.dispose?.(record.value);
        record.value = undefined;
        record.error = undefined;
        record.promise = undefined;
        record.controller = undefined;
        record.loadedAt = undefined;
        record.failedAt = undefined;
        this.#setState(record, 'idle');
    }
    async dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        for (const record of this.#records.values())
            record.controller?.abort(new DOMException('Feature loader disposed', 'AbortError'));
        await Promise.all([...this.#records.values()].map(async (record) => {
            try {
                if (record.value !== undefined)
                    await record.definition.dispose?.(record.value);
            }
            finally {
                record.value = undefined;
                record.promise = undefined;
                record.controller = undefined;
                this.#setState(record, 'disposed');
            }
        }));
        this.#listeners.clear();
    }
    async #loadInternal(name, options, stack) {
        const record = this.#require(name);
        if (record.state === 'disabled')
            throw new Error(`Feature is disabled: ${name}`);
        if (record.state === 'disposed')
            throw new Error(`Feature is disposed: ${name}`);
        if (record.state === 'ready' || record.state === 'fallback')
            return record.value;
        if (record.state === 'loading' && record.promise)
            return record.promise;
        if (record.state === 'failed' && !options.retry)
            throw record.error;
        if (stack.includes(name))
            throw new Error(`Feature dependency cycle: ${[...stack, name].join(' -> ')}`);
        const dependencyValues = new Map();
        for (const dependency of record.definition.dependencies ?? []) {
            dependencyValues.set(dependency, await this.#loadInternal(dependency, options, [...stack, name]));
        }
        const controller = new AbortController();
        const detachSignal = pipeAbort(options.signal, controller);
        const context = { name, signal: controller.signal, dependencyValues };
        record.attempts += 1;
        record.error = undefined;
        record.controller = controller;
        this.#setState(record, 'loading');
        const promise = (async () => {
            try {
                const value = await withTimeout(Promise.resolve(record.definition.load(context)), record.definition.timeoutMs, controller, name);
                if (controller.signal.aborted)
                    throw controller.signal.reason ?? new DOMException('Aborted', 'AbortError');
                record.value = value;
                record.loadedAt = this.now();
                record.failedAt = undefined;
                this.#setState(record, 'ready');
                return value;
            }
            catch (error) {
                if (this.#disposed || record.state === 'disposed' || record.state === 'disabled')
                    throw error;
                if (record.definition.fallback && !isAbortError(error)) {
                    try {
                        const fallbackValue = await record.definition.fallback(error, context);
                        record.value = fallbackValue;
                        record.error = error;
                        record.loadedAt = this.now();
                        this.#setState(record, 'fallback', error);
                        return fallbackValue;
                    }
                    catch (fallbackError) {
                        error = new AggregateError([error, fallbackError], `Feature and fallback failed: ${name}`);
                    }
                }
                record.value = undefined;
                record.error = error;
                record.failedAt = this.now();
                this.#setState(record, 'failed', error);
                throw error;
            }
            finally {
                detachSignal();
                record.promise = undefined;
                record.controller = undefined;
            }
        })();
        record.promise = promise;
        return promise;
    }
    #require(name) {
        const record = this.#records.get(name);
        if (!record)
            throw new Error(`Unknown feature: ${name}`);
        return record;
    }
    #setState(record, state, error) {
        const previous = record.state;
        record.state = state;
        if (previous === state && error === undefined)
            return;
        const event = { name: record.definition.name, previous, current: state, at: this.now(), error };
        for (const listener of this.#listeners)
            listener(event);
    }
}
export function validateFeatureGraph(definitions) {
    const map = new Map(definitions.map(definition => [definition.name, definition]));
    if (map.size !== definitions.length)
        throw new Error('Feature graph contains duplicate names');
    const visited = new Set();
    const visiting = new Set();
    const order = [];
    const visit = (name, path) => {
        if (visited.has(name))
            return;
        if (visiting.has(name))
            throw new Error(`Feature dependency cycle: ${[...path, name].join(' -> ')}`);
        const definition = map.get(name);
        if (!definition)
            throw new Error(`Unknown feature dependency: ${name}`);
        visiting.add(name);
        for (const dependency of definition.dependencies ?? [])
            visit(dependency, [...path, name]);
        visiting.delete(name);
        visited.add(name);
        order.push(name);
    };
    for (const definition of definitions) {
        validateDefinition(definition);
        visit(definition.name, []);
    }
    return order;
}
function validateDefinition(definition) {
    if (!definition.name.trim())
        throw new Error('Feature name is required');
    if (typeof definition.load !== 'function')
        throw new Error(`Feature loader is required: ${definition.name}`);
    if (definition.timeoutMs !== undefined && (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)) {
        throw new Error(`Feature timeout must be positive: ${definition.name}`);
    }
    const dependencies = definition.dependencies ?? [];
    if (new Set(dependencies).size !== dependencies.length)
        throw new Error(`Feature dependencies contain duplicates: ${definition.name}`);
    if (dependencies.includes(definition.name))
        throw new Error(`Feature cannot depend on itself: ${definition.name}`);
}
function snapshot(record) {
    return {
        name: record.definition.name,
        state: record.state,
        attempts: record.attempts,
        loadedAt: record.loadedAt,
        failedAt: record.failedAt,
        error: record.error,
        dependencies: [...(record.definition.dependencies ?? [])],
    };
}
function pipeAbort(signal, controller) {
    if (!signal)
        return () => { };
    const abort = () => controller.abort(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal.aborted)
        abort();
    else
        signal.addEventListener('abort', abort, { once: true });
    return () => signal.removeEventListener('abort', abort);
}
async function withTimeout(promise, timeoutMs, controller, name) {
    if (timeoutMs === undefined)
        return promise;
    let handle;
    const timeout = new Promise((_, reject) => {
        handle = setTimeout(() => {
            const error = new Error(`Feature load timed out after ${timeoutMs}ms: ${name}`);
            controller.abort(error);
            reject(error);
        }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        if (handle !== undefined)
            clearTimeout(handle);
    }
}
function isAbortError(error) {
    return error instanceof DOMException && error.name === 'AbortError';
}
//# sourceMappingURL=index.js.map