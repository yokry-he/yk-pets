/**
 * 文件职责 / File responsibility
 * 提供 3D/2D 渲染器自适应选择、健康度评估、状态迁移和浏览器运行时采样。
 * Provides adaptive 3D/2D renderer selection, health evaluation, state migration, and browser runtime sampling.
 */
const DEFAULTS = {
    initialRenderer: '3d',
    preference: 'auto',
    minimumFps: 38,
    maximumLongTaskRatio: 0.18,
    minimumDeviceMemoryGb: 3,
    minimumBatteryLevel: 0.18,
    degradeVotes: 3,
    recoverVotes: 6,
    switchCooldownMs: 30_000,
    prefer2DWhenReducedMotion: true,
    prefer2DWhenSaveData: true,
    prefer2DWhenLowBattery: true,
    prefer2DWhenLowMemory: true,
};
export class RuntimeHealthEvaluator {
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULTS, ...options };
    }
    evaluate(probe) {
        const preference = probe.preference ?? this.options.preference;
        const details = [];
        if (!probe.webglSupported) {
            return { target: '2d', reason: 'webgl-unsupported', hard: true, healthyFor3D: false, details: ['WebGL unavailable'] };
        }
        if (probe.webglContextLost) {
            return { target: '2d', reason: 'webgl-context-lost', hard: true, healthyFor3D: false, details: ['WebGL context lost'] };
        }
        if (preference === '2d') {
            return { target: '2d', reason: 'manual-2d', hard: true, healthyFor3D: false, details: ['User selected 2D'] };
        }
        if (preference === '3d') {
            return { target: '3d', reason: 'manual-3d', hard: true, healthyFor3D: true, details: ['User selected 3D'] };
        }
        if (this.options.prefer2DWhenReducedMotion && probe.reducedMotion) {
            details.push('Reduced motion requested');
            return { target: '2d', reason: 'reduced-motion', hard: false, healthyFor3D: false, details };
        }
        if (this.options.prefer2DWhenSaveData && probe.saveData) {
            details.push('Save-Data enabled');
            return { target: '2d', reason: 'save-data', hard: false, healthyFor3D: false, details };
        }
        if (this.options.prefer2DWhenLowBattery
            && typeof probe.batteryLevel === 'number'
            && !probe.charging
            && probe.batteryLevel <= this.options.minimumBatteryLevel) {
            details.push(`Battery ${(probe.batteryLevel * 100).toFixed(0)}%`);
            return { target: '2d', reason: 'low-battery', hard: false, healthyFor3D: false, details };
        }
        if (this.options.prefer2DWhenLowMemory
            && typeof probe.deviceMemoryGb === 'number'
            && probe.deviceMemoryGb < this.options.minimumDeviceMemoryGb) {
            details.push(`Device memory ${probe.deviceMemoryGb} GB`);
            return { target: '2d', reason: 'low-memory', hard: false, healthyFor3D: false, details };
        }
        if (typeof probe.averageFps === 'number' && probe.averageFps < this.options.minimumFps) {
            details.push(`Average FPS ${probe.averageFps.toFixed(1)}`);
            return { target: '2d', reason: 'low-fps', hard: false, healthyFor3D: false, details };
        }
        if (typeof probe.longTaskRatio === 'number' && probe.longTaskRatio > this.options.maximumLongTaskRatio) {
            details.push(`Long-task ratio ${(probe.longTaskRatio * 100).toFixed(1)}%`);
            return { target: '2d', reason: 'long-tasks', hard: false, healthyFor3D: false, details };
        }
        return { target: '3d', reason: 'recovered', hard: false, healthyFor3D: true, details: ['Runtime healthy'] };
    }
}
export class AdaptiveRendererController {
    evaluator;
    factories;
    #target = null;
    #renderer = null;
    #state = { behavior: 'idle' };
    #degradeVotes = 0;
    #recoverVotes = 0;
    #lastSwitchAt = Number.NEGATIVE_INFINITY;
    #switching = Promise.resolve();
    #suspended = false;
    #visible = true;
    #listeners = {};
    constructor(factories, options = {}) {
        if (factories['2d'].kind !== '2d' || factories['3d'].kind !== '3d') {
            throw new Error('Renderer factory kind mismatch');
        }
        this.factories = Object.freeze({ ...factories });
        this.evaluator = new RuntimeHealthEvaluator(options);
    }
    get currentKind() {
        return this.#renderer?.kind ?? null;
    }
    get currentState() {
        return this.#state;
    }
    on(type, listener) {
        const set = (this.#listeners[type] ??= new Set());
        set.add(listener);
        return () => set.delete(listener);
    }
    async mount(target, initialProbe) {
        this.#target = target;
        const evaluation = initialProbe
            ? this.evaluator.evaluate(initialProbe)
            : { target: this.evaluator.options.initialRenderer, reason: 'initial-selection', hard: true, healthyFor3D: true, details: [] };
        await this.#switchTo(evaluation.target, evaluation.reason, initialProbe?.now ?? Date.now(), true);
    }
    update(state) {
        this.#state = cloneState(state);
        try {
            this.#renderer?.update(this.#state);
        }
        catch (error) {
            this.#emit('error', { error, phase: 'update', at: Date.now() });
            void this.force('2d', 'renderer-error');
        }
    }
    resize(width, height, devicePixelRatio = 1) {
        this.#renderer?.resize?.(width, height, devicePixelRatio);
    }
    async pause() {
        this.#suspended = true;
        await this.#switching;
        try {
            await this.#renderer?.stop?.();
        }
        catch (error) {
            this.#emit('error', { error, phase: 'stop', at: Date.now() });
        }
    }
    async resume() {
        this.#suspended = false;
        await this.#switching;
        if (!this.#visible)
            return;
        try {
            await this.#renderer?.start?.();
        }
        catch (error) {
            this.#emit('error', { error, phase: 'start', at: Date.now() });
        }
    }
    async setVisible(visible) {
        this.#visible = visible;
        await this.#switching;
        try {
            await this.#renderer?.setVisible?.(visible);
        }
        catch (error) {
            this.#emit('error', { error, phase: 'visibility', at: Date.now() });
        }
        try {
            if (!visible)
                await this.#renderer?.stop?.();
            else if (!this.#suspended)
                await this.#renderer?.start?.();
        }
        catch (error) {
            this.#emit('error', { error, phase: visible ? 'start' : 'stop', at: Date.now() });
        }
    }
    async recordProbe(probe) {
        const evaluation = this.evaluator.evaluate(probe);
        this.#emit('probe', { probe, evaluation, at: probe.now });
        if (evaluation.hard) {
            this.#degradeVotes = 0;
            this.#recoverVotes = 0;
            await this.#switchTo(evaluation.target, evaluation.reason, probe.now);
            return evaluation;
        }
        if (evaluation.target === '2d') {
            this.#degradeVotes += 1;
            this.#recoverVotes = 0;
            if (this.#degradeVotes >= this.evaluator.options.degradeVotes) {
                await this.#switchTo('2d', evaluation.reason, probe.now);
                this.#degradeVotes = 0;
            }
        }
        else {
            this.#recoverVotes += 1;
            this.#degradeVotes = 0;
            if (this.#recoverVotes >= this.evaluator.options.recoverVotes) {
                await this.#switchTo('3d', 'recovered', probe.now);
                this.#recoverVotes = 0;
            }
        }
        return evaluation;
    }
    async force(kind, reason = kind === '2d' ? 'manual-2d' : 'manual-3d') {
        await this.#switchTo(kind, reason, Date.now(), true);
    }
    async dispose() {
        await this.#switching;
        if (!this.#renderer)
            return;
        try {
            this.#renderer.dispose();
        }
        catch (error) {
            this.#emit('error', { error, phase: 'dispose', at: Date.now() });
        }
        this.#renderer = null;
        this.#target = null;
    }
    async #switchTo(kind, reason, now, bypassCooldown = false) {
        this.#switching = this.#switching.then(async () => {
            if (!this.#target)
                throw new Error('AdaptiveRendererController must be mounted before switching renderers');
            if (this.#renderer?.kind === kind)
                return;
            if (!bypassCooldown && now - this.#lastSwitchAt < this.evaluator.options.switchCooldownMs)
                return;
            const previous = this.#renderer;
            const snapshot = previous?.snapshot?.() ?? { state: this.#state };
            let targetKind = kind;
            let switchReason = reason;
            for (;;) {
                // A failed 3D upgrade while 2D is already active should keep the healthy renderer.
                if (previous?.kind === targetKind)
                    return;
                let next;
                try {
                    next = await this.factories[targetKind].create();
                }
                catch (error) {
                    this.#emit('error', { error, phase: 'create', at: now });
                    if (targetKind === '3d') {
                        targetKind = '2d';
                        switchReason = 'renderer-error';
                        continue;
                    }
                    throw error;
                }
                try {
                    await next.mount(this.#target);
                    if (snapshot && next.restore)
                        next.restore(snapshot);
                    else
                        next.update(snapshot.state ?? this.#state);
                    await next.setVisible?.(this.#visible);
                    if (this.#suspended || !this.#visible)
                        await next.stop?.();
                }
                catch (error) {
                    try {
                        next.dispose();
                    }
                    catch { /* ignored */ }
                    this.#emit('error', { error, phase: 'mount', at: now });
                    if (targetKind === '3d') {
                        targetKind = '2d';
                        switchReason = 'renderer-error';
                        continue;
                    }
                    throw error;
                }
                if (previous) {
                    try {
                        previous.dispose();
                    }
                    catch (error) {
                        this.#emit('error', { error, phase: 'dispose', at: now });
                    }
                }
                const previousKind = previous?.kind ?? null;
                this.#renderer = next;
                this.#lastSwitchAt = now;
                this.#emit('switch', { previous: previousKind, current: targetKind, reason: switchReason, at: now });
                return;
            }
        });
        return this.#switching;
    }
    #emit(type, event) {
        const listeners = this.#listeners[type];
        listeners?.forEach(listener => listener(event));
    }
}
function cloneState(state) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(state);
        }
        catch { /* Fall through to shallow clone for proxy-backed or non-cloneable values. */ }
    }
    return { ...state, pointer: state.pointer ? { ...state.pointer } : undefined };
}
export class BrowserRuntimeMonitor {
    options;
    #frameTimes = [];
    #longTaskMs = 0;
    #windowStartedAt = 0;
    #raf = 0;
    #timer = null;
    #observer = null;
    #contextLost = false;
    #canvas = null;
    #listener = null;
    constructor(options = {}) {
        this.options = {
            sampleWindowMs: options.sampleWindowMs ?? 5_000,
            probeIntervalMs: options.probeIntervalMs ?? 2_500,
            webglCanvasFactory: options.webglCanvasFactory ?? (() => document.createElement('canvas')),
            now: options.now ?? (() => performance.now()),
        };
    }
    start(listener) {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return;
        this.stop();
        this.#listener = listener;
        this.#windowStartedAt = this.options.now();
        this.#canvas = this.options.webglCanvasFactory();
        this.#canvas.addEventListener('webglcontextlost', this.#onContextLost, { passive: false });
        this.#canvas.addEventListener('webglcontextrestored', this.#onContextRestored);
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                this.#observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries())
                        this.#longTaskMs += entry.duration;
                });
                this.#observer.observe({ type: 'longtask', buffered: true });
            }
            catch {
                this.#observer = null;
            }
        }
        const tick = (time) => {
            this.#frameTimes.push(time);
            const cutoff = time - this.options.sampleWindowMs;
            while (this.#frameTimes.length > 1 && this.#frameTimes[0] < cutoff)
                this.#frameTimes.shift();
            this.#raf = requestAnimationFrame(tick);
        };
        this.#raf = requestAnimationFrame(tick);
        this.#timer = setInterval(() => { void this.#emitProbe(); }, this.options.probeIntervalMs);
        void this.#emitProbe();
    }
    stop() {
        if (this.#raf && typeof cancelAnimationFrame === 'function')
            cancelAnimationFrame(this.#raf);
        if (this.#timer)
            clearInterval(this.#timer);
        this.#observer?.disconnect();
        this.#canvas?.removeEventListener('webglcontextlost', this.#onContextLost);
        this.#canvas?.removeEventListener('webglcontextrestored', this.#onContextRestored);
        this.#raf = 0;
        this.#timer = null;
        this.#observer = null;
        this.#canvas = null;
        this.#listener = null;
        this.#frameTimes = [];
        this.#longTaskMs = 0;
    }
    async #emitProbe() {
        if (!this.#listener || !this.#canvas)
            return;
        const now = this.options.now();
        const elapsed = Math.max(1, now - this.#windowStartedAt);
        const averageFps = this.#frameTimes.length > 1
            ? ((this.#frameTimes.length - 1) * 1_000) / Math.max(1, this.#frameTimes.at(-1) - this.#frameTimes[0])
            : undefined;
        const nav = navigator;
        let batteryLevel;
        let charging;
        try {
            const battery = await nav.getBattery?.();
            batteryLevel = battery?.level;
            charging = battery?.charging;
        }
        catch { /* Battery API is optional. */ }
        const webglSupported = Boolean(this.#canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
            || this.#canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }));
        this.#listener({
            now: Date.now(),
            webglSupported,
            webglContextLost: this.#contextLost,
            averageFps,
            longTaskRatio: Math.min(1, this.#longTaskMs / elapsed),
            deviceMemoryGb: nav.deviceMemory,
            saveData: nav.connection?.saveData,
            reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
            batteryLevel,
            charging,
        });
        if (elapsed >= this.options.sampleWindowMs) {
            this.#windowStartedAt = now;
            this.#longTaskMs = 0;
        }
    }
    #onContextLost = (event) => {
        event.preventDefault?.();
        this.#contextLost = true;
    };
    #onContextRestored = () => {
        this.#contextLost = false;
    };
}
//# sourceMappingURL=index.js.map