/**
 * Adapter-driven Lighthouse and Playwright verification for YK Pets.
 *
 * The package intentionally does not bundle or launch browsers. Hosts provide
 * audited adapters, while this layer validates declarative scenarios, enforces
 * origin scope and timeouts, normalizes results, and compares before/after runs.
 */
export class VerificationRunner {
    lighthouse;
    playwright;
    allowedOrigins;
    timeoutMs;
    now;
    constructor(options = {}) {
        this.lighthouse = options.lighthouse;
        this.playwright = options.playwright;
        this.allowedOrigins = Object.freeze([...(options.allowedOrigins ?? [])]);
        this.timeoutMs = positiveInteger(options.timeoutMs ?? 60_000, 'timeoutMs');
        this.now = options.now ?? Date.now;
    }
    async capture(target, plan = {}, signal) {
        validateTarget(target, this.allowedOrigins);
        const scenarios = plan.scenarios ?? [];
        for (const scenario of scenarios)
            validateScenario(scenario, target.url);
        const snapshot = {
            target: { ...target },
            capturedAt: this.now(),
            lighthouse: null,
            scenarios: [],
            errors: [],
        };
        if (plan.lighthouse !== false && this.lighthouse) {
            try {
                snapshot.lighthouse = normalizeLighthouseResult(await runWithTimeout(childSignal => this.lighthouse.run(target, childSignal), this.timeoutMs, signal, 'Lighthouse verification'));
            }
            catch (error) {
                snapshot.errors.push({ source: 'lighthouse', message: errorMessage(error) });
            }
        }
        if (scenarios.length > 0 && !this.playwright) {
            snapshot.errors.push({ source: 'playwright', message: 'Playwright adapter is not configured' });
        }
        else if (this.playwright) {
            for (const scenario of scenarios) {
                try {
                    const result = await runWithTimeout(childSignal => this.playwright.run(target, structuredClone(scenario), childSignal), scenario.timeoutMs ?? this.timeoutMs, signal, `Playwright scenario ${scenario.id}`);
                    snapshot.scenarios.push(normalizeScenarioResult(result, scenario));
                }
                catch (error) {
                    snapshot.errors.push({ source: 'playwright', id: scenario.id, message: errorMessage(error) });
                    snapshot.scenarios.push({
                        id: scenario.id,
                        title: scenario.title,
                        passed: false,
                        durationMs: 0,
                        assertions: [],
                        pageErrors: [errorMessage(error)],
                    });
                }
            }
        }
        snapshot.scenarios.sort((a, b) => a.id.localeCompare(b.id));
        snapshot.errors.sort((a, b) => `${a.source}:${a.id ?? ''}:${a.message}`.localeCompare(`${b.source}:${b.id ?? ''}:${b.message}`));
        return snapshot;
    }
    compare(before, after, policy = {}) {
        return compareVerificationSnapshots(before, after, policy);
    }
    async verify(beforeTarget, afterTarget, plan, policy = {}, signal) {
        const before = await this.capture(beforeTarget, plan, signal);
        const after = await this.capture(afterTarget, plan, signal);
        return this.compare(before, after, policy);
    }
}
export function compareVerificationSnapshots(before, after, policy = {}) {
    const findings = [];
    const improvements = [];
    compareScores(before.lighthouse, after.lighthouse, policy.scores ?? {}, findings, improvements);
    compareMetrics(before.lighthouse, after.lighthouse, policy.metrics ?? {}, findings, improvements);
    compareAudits(after.lighthouse, policy.requiredAudits ?? [], findings);
    compareScenarios(before.scenarios, after.scenarios, policy, findings, improvements);
    if (policy.failOnCaptureError !== false) {
        for (const capture of after.errors) {
            findings.push({
                id: `capture:${capture.source}:${capture.id ?? 'global'}`,
                kind: 'capture-error',
                severity: 'error',
                message: `${capture.source}${capture.id ? ` scenario ${capture.id}` : ''} capture failed: ${capture.message}`,
            });
        }
    }
    findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
    improvements.sort((a, b) => a.id.localeCompare(b.id));
    const errors = findings.filter(finding => finding.severity === 'error').length;
    const warnings = findings.length - errors;
    return {
        passed: errors === 0,
        before: structuredClone(before),
        after: structuredClone(after),
        findings,
        improvements,
        summary: {
            errors,
            warnings,
            improvements: improvements.length,
            scenariosBeforePassed: before.scenarios.filter(item => item.passed).length,
            scenariosAfterPassed: after.scenarios.filter(item => item.passed).length,
        },
    };
}
export function validateScenario(scenario, targetUrl) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(scenario.id))
        throw new Error('Scenario id is invalid');
    if (!scenario.title.trim() || scenario.title.length > 200)
        throw new Error(`Scenario title is invalid: ${scenario.id}`);
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0 || scenario.steps.length > 100)
        throw new Error(`Scenario steps are invalid: ${scenario.id}`);
    if (scenario.timeoutMs !== undefined)
        positiveInteger(scenario.timeoutMs, 'scenario.timeoutMs');
    const targetOrigin = targetUrl ? safeOrigin(targetUrl) : null;
    for (const [index, step] of scenario.steps.entries()) {
        const label = `${scenario.id} step ${index + 1}`;
        if (!step || typeof step !== 'object')
            throw new Error(`${label} is invalid`);
        switch (step.action) {
            case 'click':
            case 'hover':
            case 'expect-visible':
                assertSelector(step.selector, label);
                break;
            case 'fill':
                if (!scenario.allowFormInput)
                    throw new Error(`${label} requires allowFormInput`);
                assertSelector(step.selector, label);
                assertSafeText(step.value, `${label} value`, 10_000);
                break;
            case 'press':
                if (step.selector !== undefined)
                    assertSelector(step.selector, label);
                if (!/^[A-Za-z0-9+_-]{1,40}$/.test(step.key))
                    throw new Error(`${label} key is invalid`);
                break;
            case 'wait-for':
                assertSelector(step.selector, label);
                if (step.timeoutMs !== undefined)
                    positiveInteger(step.timeoutMs, `${label} timeoutMs`);
                break;
            case 'expect-text':
                assertSelector(step.selector, label);
                assertSafeText(step.text, `${label} text`, 5_000);
                break;
            case 'expect-url': {
                const expected = new URL(step.url, targetUrl);
                if (!['http:', 'https:'].includes(expected.protocol) || expected.username || expected.password)
                    throw new Error(`${label} URL is unsafe`);
                if (targetOrigin && expected.origin !== targetOrigin)
                    throw new Error(`${label} URL leaves the target origin`);
                break;
            }
            case 'screenshot':
                if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(step.name))
                    throw new Error(`${label} screenshot name is invalid`);
                if (step.selector !== undefined)
                    assertSelector(step.selector, label);
                break;
            default:
                throw new Error(`${label} action is not supported`);
        }
    }
}
export function normalizeLighthouseResult(input) {
    const categories = {};
    for (const [id, category] of Object.entries(input.categories ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        categories[id] = { score: nullableScore(category.score), title: optionalBoundedString(category.title, 200) };
    }
    const metrics = {};
    for (const [id, value] of Object.entries(input.metrics ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        if (typeof value === 'number' && Number.isFinite(value))
            metrics[id] = value;
    }
    const audits = {};
    for (const [id, audit] of Object.entries(input.audits ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        audits[id] = {
            score: nullableScore(audit.score),
            title: optionalBoundedString(audit.title, 200),
            displayValue: optionalBoundedString(audit.displayValue, 500),
        };
    }
    return { categories, metrics, audits, warnings: [...new Set((input.warnings ?? []).map(value => String(value).slice(0, 1_000)))] };
}
function compareScores(before, after, thresholds, findings, improvements) {
    for (const [id, threshold] of Object.entries(thresholds).sort(([a], [b]) => a.localeCompare(b))) {
        validateScoreThreshold(threshold, id);
        const beforeScore = before?.categories[id]?.score ?? null;
        const afterScore = after?.categories[id]?.score ?? null;
        if (afterScore === null) {
            findings.push({ id: `score:${id}:missing`, kind: 'score-below-minimum', severity: 'error', message: `Lighthouse category is missing: ${id}` });
            continue;
        }
        if (threshold.min !== undefined && afterScore < threshold.min) {
            findings.push({ id: `score:${id}:min`, kind: 'score-below-minimum', severity: 'error', message: `${id} score is below the minimum`, after: afterScore, limit: threshold.min });
        }
        if (beforeScore !== null) {
            const delta = afterScore - beforeScore;
            if (threshold.maxRegression !== undefined && -delta > threshold.maxRegression + Number.EPSILON) {
                findings.push({ id: `score:${id}:regression`, kind: 'score-regression', severity: 'error', message: `${id} score regressed`, before: beforeScore, after: afterScore, limit: threshold.maxRegression });
            }
            else if (delta > 0)
                improvements.push({ id: `score:${id}`, kind: 'score', message: `${id} score improved`, before: beforeScore, after: afterScore });
        }
    }
}
function compareMetrics(before, after, thresholds, findings, improvements) {
    for (const [id, threshold] of Object.entries(thresholds).sort(([a], [b]) => a.localeCompare(b))) {
        validateMetricThreshold(threshold, id);
        const beforeValue = before?.metrics[id];
        const afterValue = after?.metrics[id];
        if (beforeValue === undefined || afterValue === undefined)
            continue;
        const direction = threshold.direction ?? 'lower-is-better';
        const regression = direction === 'lower-is-better' ? afterValue - beforeValue : beforeValue - afterValue;
        const ratio = Math.abs(beforeValue) > Number.EPSILON ? regression / Math.abs(beforeValue) : (regression > 0 ? Number.POSITIVE_INFINITY : 0);
        const absoluteExceeded = threshold.maxRegressionAbsolute !== undefined && regression > threshold.maxRegressionAbsolute;
        const ratioExceeded = threshold.maxRegressionRatio !== undefined && ratio > threshold.maxRegressionRatio;
        if (regression > 0 && (absoluteExceeded || ratioExceeded)) {
            findings.push({
                id: `metric:${id}:regression`,
                kind: 'metric-regression',
                severity: 'error',
                message: `${id} regressed`,
                before: beforeValue,
                after: afterValue,
                limit: { absolute: threshold.maxRegressionAbsolute, ratio: threshold.maxRegressionRatio },
            });
        }
        else if (regression < 0)
            improvements.push({ id: `metric:${id}`, kind: 'metric', message: `${id} improved`, before: beforeValue, after: afterValue });
    }
}
function compareAudits(after, requiredAudits, findings) {
    for (const id of [...new Set(requiredAudits)].sort()) {
        const score = after?.audits[id]?.score ?? null;
        if (score !== 1) {
            findings.push({ id: `audit:${id}`, kind: 'required-audit-failed', severity: 'error', message: `Required Lighthouse audit did not pass: ${id}`, after: score, limit: 1 });
        }
    }
}
function compareScenarios(beforeScenarios, afterScenarios, policy, findings, improvements) {
    const before = new Map(beforeScenarios.map(item => [item.id, item]));
    const after = new Map(afterScenarios.map(item => [item.id, item]));
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
        const previous = before.get(id);
        const current = after.get(id);
        if (!current)
            continue;
        if (previous?.passed && !current.passed) {
            findings.push({ id: `scenario:${id}:regression`, kind: 'scenario-regression', severity: 'error', message: `Scenario regressed: ${current.title}`, before: true, after: false });
        }
        else if (!current.passed) {
            findings.push({ id: `scenario:${id}:failed`, kind: 'scenario-failed', severity: 'error', message: `Scenario failed: ${current.title}`, after: false });
        }
        else if (previous && !previous.passed) {
            improvements.push({ id: `scenario:${id}`, kind: 'scenario', message: `Scenario now passes: ${current.title}`, before: false, after: true });
        }
        const previousAssertions = new Map((previous?.assertions ?? []).map(item => [item.id, item]));
        for (const assertion of current.assertions) {
            const old = previousAssertions.get(assertion.id);
            if (old?.passed && !assertion.passed) {
                findings.push({ id: `assertion:${id}:${assertion.id}`, kind: 'assertion-regression', severity: 'error', message: `Assertion regressed in ${current.title}: ${assertion.id}`, before: true, after: false });
            }
            else if (old && !old.passed && assertion.passed) {
                improvements.push({ id: `assertion:${id}:${assertion.id}`, kind: 'assertion', message: `Assertion now passes in ${current.title}: ${assertion.id}`, before: false, after: true });
            }
        }
        compareErrorCounts(id, 'console', previous?.consoleErrors ?? [], current.consoleErrors ?? [], policy.maxNewConsoleErrors ?? 0, findings, improvements);
        compareErrorCounts(id, 'page', previous?.pageErrors ?? [], current.pageErrors ?? [], policy.maxNewPageErrors ?? 0, findings, improvements);
    }
}
function compareErrorCounts(scenarioId, type, before, after, limit, findings, improvements) {
    positiveOrZeroInteger(limit, `maxNew${type}Errors`);
    const delta = after.length - before.length;
    if (delta > limit) {
        findings.push({
            id: `${type}-errors:${scenarioId}`,
            kind: type === 'console' ? 'new-console-errors' : 'new-page-errors',
            severity: 'error',
            message: `Scenario ${scenarioId} introduced ${delta} new ${type} error(s)`,
            before: before.length,
            after: after.length,
            limit,
        });
    }
    else if (delta < 0) {
        improvements.push({ id: `${type}-errors:${scenarioId}`, kind: 'error-count', message: `Scenario ${scenarioId} reduced ${type} errors`, before: before.length, after: after.length });
    }
}
function normalizeScenarioResult(result, scenario) {
    if (result.id !== scenario.id)
        throw new Error(`Playwright adapter returned the wrong scenario id: ${result.id}`);
    if (!Number.isFinite(result.durationMs) || result.durationMs < 0)
        throw new Error(`Scenario duration is invalid: ${result.id}`);
    const assertions = (result.assertions ?? []).map(assertion => ({
        id: assertion.id.slice(0, 200),
        passed: Boolean(assertion.passed),
        message: optionalBoundedString(assertion.message, 2_000),
        selector: optionalBoundedString(assertion.selector, 2_048),
        actual: cloneBounded(assertion.actual),
        expected: cloneBounded(assertion.expected),
    })).sort((a, b) => a.id.localeCompare(b.id));
    const passed = Boolean(result.passed) && assertions.every(assertion => assertion.passed);
    return {
        id: scenario.id,
        title: scenario.title,
        passed,
        durationMs: result.durationMs,
        assertions,
        consoleErrors: uniqueStrings(result.consoleErrors, 200, 2_000),
        pageErrors: uniqueStrings(result.pageErrors, 200, 2_000),
        screenshotRefs: uniqueStrings(result.screenshotRefs, 50, 500),
    };
}
function validateTarget(target, allowedOrigins) {
    if (!target.label.trim() || target.label.length > 100)
        throw new Error('Verification target label is invalid');
    const origin = safeOrigin(target.url);
    if (allowedOrigins.length > 0 && !allowedOrigins.some(pattern => originMatches(origin, pattern))) {
        throw new Error(`Verification target origin is outside the allowed scope: ${origin}`);
    }
}
function safeOrigin(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('Verification target URL must be credential-free HTTP(S)');
    return url.origin;
}
function originMatches(origin, pattern) {
    const trimmed = pattern.trim();
    if (trimmed === '*')
        return true;
    if (!trimmed.includes('*'))
        return origin === safeOrigin(trimmed);
    const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.\\/:]+');
    return new RegExp(`^${escaped}$`, 'i').test(origin);
}
function assertSelector(value, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2_048 || /[\u0000\r\n]/.test(value))
        throw new Error(`${label} selector is invalid`);
}
function assertSafeText(value, label, max) {
    if (typeof value !== 'string' || value.length > max || /\u0000/.test(value))
        throw new Error(`${label} is invalid`);
}
function nullableScore(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
        throw new Error(`Lighthouse score must be between 0 and 1: ${value}`);
    return value;
}
function validateScoreThreshold(value, id) {
    if (value.min !== undefined && (!Number.isFinite(value.min) || value.min < 0 || value.min > 1))
        throw new Error(`Invalid minimum score: ${id}`);
    if (value.maxRegression !== undefined && (!Number.isFinite(value.maxRegression) || value.maxRegression < 0 || value.maxRegression > 1))
        throw new Error(`Invalid score regression limit: ${id}`);
}
function validateMetricThreshold(value, id) {
    if (value.maxRegressionAbsolute !== undefined && (!Number.isFinite(value.maxRegressionAbsolute) || value.maxRegressionAbsolute < 0))
        throw new Error(`Invalid absolute metric limit: ${id}`);
    if (value.maxRegressionRatio !== undefined && (!Number.isFinite(value.maxRegressionRatio) || value.maxRegressionRatio < 0))
        throw new Error(`Invalid ratio metric limit: ${id}`);
}
async function runWithTimeout(operation, timeoutMs, externalSignal, label) {
    positiveInteger(timeoutMs, 'timeoutMs');
    const controller = new AbortController();
    let timer;
    let detach = () => { };
    if (externalSignal) {
        const abort = () => controller.abort(externalSignal.reason ?? new DOMException('Aborted', 'AbortError'));
        if (externalSignal.aborted)
            abort();
        else {
            externalSignal.addEventListener('abort', abort, { once: true });
            detach = () => externalSignal.removeEventListener('abort', abort);
        }
    }
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(`${label} timed out after ${timeoutMs}ms`);
            controller.abort(error);
            reject(error);
        }, timeoutMs);
    });
    const aborted = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    });
    try {
        return await Promise.race([operation(controller.signal), timeout, aborted]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        detach();
    }
}
function positiveInteger(value, name) {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${name} must be a positive integer`);
    return value;
}
function positiveOrZeroInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error(`${name} must be a non-negative integer`);
    return value;
}
function optionalBoundedString(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : undefined;
}
function uniqueStrings(value, maxItems, maxLength) {
    if (!Array.isArray(value))
        return undefined;
    return [...new Set(value.map(item => String(item).slice(0, maxLength)))].slice(0, maxItems);
}
function cloneBounded(value) {
    if (value === undefined)
        return undefined;
    const json = JSON.stringify(value);
    if (json === undefined)
        return String(value);
    if (json.length > 10_000)
        return `${json.slice(0, 10_000)}…[truncated]`;
    return JSON.parse(json);
}
function errorMessage(error) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}
function severityRank(value) {
    return value === 'error' ? 0 : 1;
}
//# sourceMappingURL=index.js.map