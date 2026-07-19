/**
 * Structured change reports for YK Pets analysis and repair workflows.
 */
export class ChangeReportBuilder {
    project;
    runId;
    startedAt;
    #targetUrl;
    #baseRevision;
    #candidateRevision;
    #issues = [];
    #changes = [];
    #verification = null;
    #events = [];
    #notes = [];
    constructor(input) {
        validateIdentifier(input.runId, 'runId');
        if (!input.project.trim())
            throw new Error('project is required');
        validateTimestamp(input.startedAt, 'startedAt');
        this.project = sanitizeText(input.project, 200);
        this.runId = input.runId;
        this.startedAt = input.startedAt;
        this.#targetUrl = input.targetUrl ? validateTargetUrl(input.targetUrl) : undefined;
        this.#baseRevision = optionalHash(input.baseRevision);
        this.#candidateRevision = optionalHash(input.candidateRevision);
    }
    addIssue(issue) {
        this.#issues.push(structuredClone(issue));
        return this;
    }
    addChange(change) {
        this.#changes.push(structuredClone(change));
        return this;
    }
    setVerification(verification) {
        this.#verification = verification ? structuredClone(verification) : null;
        return this;
    }
    addEvent(event) {
        this.#events.push(structuredClone(event));
        return this;
    }
    addNote(note) {
        this.#notes.push(note);
        return this;
    }
    build(completedAt = Date.now(), generatedAt = completedAt) {
        return createChangeReport({
            project: this.project,
            runId: this.runId,
            targetUrl: this.#targetUrl,
            baseRevision: this.#baseRevision,
            candidateRevision: this.#candidateRevision,
            startedAt: this.startedAt,
            completedAt,
            generatedAt,
            issues: this.#issues,
            changes: this.#changes,
            verification: this.#verification,
            events: this.#events,
            notes: this.#notes,
        });
    }
}
export function createChangeReport(input) {
    validateIdentifier(input.runId, 'runId');
    if (!input.project.trim())
        throw new Error('project is required');
    validateTimestamp(input.startedAt, 'startedAt');
    const completedAt = input.completedAt ?? input.generatedAt ?? Date.now();
    const generatedAt = input.generatedAt ?? completedAt;
    validateTimestamp(completedAt, 'completedAt');
    validateTimestamp(generatedAt, 'generatedAt');
    if (completedAt < input.startedAt)
        throw new Error('completedAt must not be before startedAt');
    const issues = normalizeIssues(input.issues ?? []);
    const changes = normalizeChanges(input.changes ?? []);
    const verification = input.verification ? structuredClone(input.verification) : null;
    const events = normalizeEvents(input.events ?? []);
    const notes = [...new Set((input.notes ?? []).map(note => sanitizeText(note, 2_000)))].filter(Boolean);
    const active = issues.filter(issue => !issue.ignored);
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const issue of active)
        bySeverity[issue.severity] += 1;
    const status = determineStatus(active, verification);
    const reportWithoutFingerprint = {
        schema: 'yk-pets.change-report/v1',
        platformVersion: '0.7.8',
        project: sanitizeText(input.project, 200),
        runId: input.runId,
        targetUrl: input.targetUrl ? validateTargetUrl(input.targetUrl) : undefined,
        baseRevision: optionalHash(input.baseRevision),
        candidateRevision: optionalHash(input.candidateRevision),
        startedAt: input.startedAt,
        completedAt,
        generatedAt,
        durationMs: completedAt - input.startedAt,
        status,
        summary: {
            totalIssues: issues.length,
            activeIssues: active.length,
            ignoredIssues: issues.length - active.length,
            bySeverity,
            changedFiles: new Set(changes.map(change => change.file)).size,
            linesAdded: changes.reduce((sum, change) => sum + (change.linesAdded ?? 0), 0),
            linesRemoved: changes.reduce((sum, change) => sum + (change.linesRemoved ?? 0), 0),
            verificationPassed: verification?.passed ?? null,
        },
        issues,
        changes,
        verification,
        events,
        notes,
    };
    return { ...reportWithoutFingerprint, fingerprint: createReportFingerprint(reportWithoutFingerprint) };
}
export function renderChangeReportMarkdown(report, options = {}) {
    const lines = [];
    lines.push(`# YK Pets Change Report: ${escapeMarkdown(report.project)}`, '');
    lines.push(`- **Run:** \`${escapeCode(report.runId)}\``);
    lines.push(`- **Status:** ${statusLabel(report.status)}`);
    if (report.targetUrl)
        lines.push(`- **Target:** \`${escapeCode(report.targetUrl)}\``);
    if (report.baseRevision || report.candidateRevision)
        lines.push(`- **Revision:** \`${escapeCode(report.baseRevision ?? 'unknown')}\` → \`${escapeCode(report.candidateRevision ?? 'unknown')}\``);
    lines.push(`- **Duration:** ${formatDuration(report.durationMs)}`);
    lines.push(`- **Fingerprint:** \`${report.fingerprint}\``, '');
    lines.push('## Summary', '');
    lines.push('| Metric | Value |', '|---|---:|');
    lines.push(`| Active issues | ${report.summary.activeIssues} |`);
    lines.push(`| Ignored issues | ${report.summary.ignoredIssues} |`);
    lines.push(`| Critical / High | ${report.summary.bySeverity.critical} / ${report.summary.bySeverity.high} |`);
    lines.push(`| Changed files | ${report.summary.changedFiles} |`);
    lines.push(`| Lines + / - | +${report.summary.linesAdded} / -${report.summary.linesRemoved} |`);
    lines.push(`| Verification | ${report.summary.verificationPassed === null ? 'Not run' : report.summary.verificationPassed ? 'Passed' : 'Failed'} |`, '');
    const visibleIssues = report.issues.filter(issue => options.includeIgnored || !issue.ignored);
    lines.push('## Findings', '');
    if (visibleIssues.length === 0)
        lines.push('No active findings.', '');
    for (const issue of visibleIssues) {
        lines.push(`### ${severityIcon(issue.severity)} ${escapeMarkdown(issue.title)}`, '');
        lines.push(`- **ID:** \`${escapeCode(issue.id)}\``);
        lines.push(`- **Category:** ${escapeMarkdown(issue.category)}`);
        lines.push(`- **Severity:** ${issue.severity}`);
        if (issue.selector)
            lines.push(`- **Element:** \`${escapeCode(issue.selector)}\``);
        if (issue.source)
            lines.push(`- **Source:** \`${escapeCode(formatSource(issue.source))}\` (${Math.round(issue.source.confidence * 100)}% confidence)`);
        if (issue.ignored)
            lines.push(`- **Ignored:** ${escapeMarkdown(issue.ignoreReason ?? 'No reason provided')}`);
        if (issue.duplicateCount > 1)
            lines.push(`- **Occurrences:** ${issue.duplicateCount}`);
        lines.push('', escapeMarkdown(issue.description), '');
        if (issue.evidence?.length) {
            lines.push('**Evidence**', '');
            for (const evidence of issue.evidence)
                lines.push(`- ${escapeMarkdown(evidence)}`);
            lines.push('');
        }
        if (issue.recommendation)
            lines.push('**Recommendation**', '', escapeMarkdown(issue.recommendation), '');
    }
    lines.push('## Changes', '');
    if (report.changes.length === 0)
        lines.push('No source changes were recorded.', '');
    else {
        lines.push('| File | Kind | Lines | Summary |', '|---|---|---:|---|');
        for (const change of report.changes) {
            lines.push(`| \`${escapeCode(change.file)}\` | ${change.kind} | +${change.linesAdded ?? 0}/-${change.linesRemoved ?? 0} | ${escapeTable(change.summary)} |`);
        }
        lines.push('');
        const rollback = report.changes.filter(change => change.rollback);
        if (rollback.length) {
            lines.push('### Rollback', '');
            for (const change of rollback)
                lines.push(`- \`${escapeCode(change.file)}\`: ${escapeMarkdown(change.rollback)}`);
            lines.push('');
        }
    }
    lines.push('## Verification', '');
    if (!report.verification)
        lines.push('Verification was not run.', '');
    else {
        const verification = report.verification;
        lines.push(`**${verification.passed ? 'Passed' : 'Failed'}** — ${verification.summary.errors} errors, ${verification.summary.warnings} warnings, ${verification.summary.improvements} improvements.`, '');
        if (options.includeVerificationDetails !== false) {
            for (const finding of verification.findings)
                lines.push(`- ${finding.severity === 'error' ? '❌' : '⚠️'} ${escapeMarkdown(finding.message)}`);
            for (const improvement of verification.improvements)
                lines.push(`- ✅ ${escapeMarkdown(improvement.message)}`);
            if (verification.findings.length || verification.improvements.length)
                lines.push('');
        }
    }
    if (report.notes.length) {
        lines.push('## Notes', '');
        for (const note of report.notes)
            lines.push(`- ${escapeMarkdown(note)}`);
        lines.push('');
    }
    if (options.includeEvents && report.events.length) {
        lines.push('## Timeline', '');
        for (const event of report.events)
            lines.push(`- ${new Date(event.at).toISOString()} — **${event.type}**: ${escapeMarkdown(event.message)}`);
        lines.push('');
    }
    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
export function serializeChangeReportJson(report, space = 2) {
    if (!Number.isSafeInteger(space) || space < 0 || space > 10)
        throw new Error('JSON indentation must be between 0 and 10');
    return `${JSON.stringify(report, null, space)}\n`;
}
export function createReportFingerprint(value) {
    const canonical = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < canonical.length; index += 1) {
        hash ^= canonical.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a-${hash.toString(16).padStart(8, '0')}`;
}
function normalizeIssues(input) {
    const byFingerprint = new Map();
    for (const raw of input) {
        validateSeverity(raw.severity);
        if (!raw.category.trim() || !raw.title.trim() || !raw.description.trim())
            throw new Error('Issue category, title, and description are required');
        const source = raw.source ?? raw.sourceMapping?.primary ?? null;
        const normalized = {
            id: raw.id ?? '',
            fingerprint: '',
            category: sanitizeText(raw.category, 100),
            severity: raw.severity,
            title: sanitizeText(raw.title, 300),
            description: sanitizeText(raw.description, 5_000),
            selector: raw.selector ? sanitizeText(raw.selector, 2_048) : undefined,
            source: source ? normalizeSourceCandidate(source) : null,
            evidence: uniqueSanitized(raw.evidence, 50, 2_000),
            recommendation: raw.recommendation ? sanitizeText(raw.recommendation, 5_000) : undefined,
            ignored: Boolean(raw.ignored),
            ignoreReason: raw.ignoreReason ? sanitizeText(raw.ignoreReason, 1_000) : undefined,
            duplicateCount: 1,
        };
        normalized.fingerprint = createReportFingerprint({
            category: normalized.category.toLowerCase(),
            title: normalized.title.toLowerCase(),
            selector: normalized.selector,
            source: normalized.source ? [normalized.source.source, normalized.source.line, normalized.source.column] : null,
        });
        normalized.id = raw.id ? validateIdentifier(raw.id, 'issue id') : `issue-${normalized.fingerprint.slice(-8)}`;
        const existing = byFingerprint.get(normalized.fingerprint);
        if (!existing)
            byFingerprint.set(normalized.fingerprint, normalized);
        else {
            existing.duplicateCount += 1;
            existing.evidence = uniqueSanitized([...(existing.evidence ?? []), ...(normalized.evidence ?? [])], 50, 2_000);
            if (severityRank(normalized.severity) < severityRank(existing.severity))
                existing.severity = normalized.severity;
            if (!existing.recommendation && normalized.recommendation)
                existing.recommendation = normalized.recommendation;
            existing.ignored = existing.ignored && normalized.ignored;
            if (!existing.ignoreReason && normalized.ignoreReason)
                existing.ignoreReason = normalized.ignoreReason;
        }
    }
    return [...byFingerprint.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}
function normalizeChanges(input) {
    return input.map((raw, index) => {
        if (!raw.file.trim() || raw.file.includes('\u0000'))
            throw new Error('Change file is invalid');
        if (!['add', 'modify', 'delete', 'rename'].includes(raw.kind))
            throw new Error(`Change kind is invalid: ${raw.kind}`);
        if (!raw.summary.trim())
            throw new Error('Change summary is required');
        const file = sanitizePath(raw.file);
        const change = {
            id: `change-${String(index + 1).padStart(3, '0')}-${createReportFingerprint([file, raw.kind, raw.summary]).slice(-6)}`,
            file,
            kind: raw.kind,
            summary: sanitizeText(raw.summary, 1_000),
            linesAdded: optionalCount(raw.linesAdded, 'linesAdded'),
            linesRemoved: optionalCount(raw.linesRemoved, 'linesRemoved'),
            beforeHash: optionalHash(raw.beforeHash),
            afterHash: optionalHash(raw.afterHash),
            rollback: raw.rollback ? sanitizeText(raw.rollback, 2_000) : undefined,
            relatedIssueIds: raw.relatedIssueIds ? [...new Set(raw.relatedIssueIds.map(id => validateIdentifier(id, 'related issue id')))].sort() : undefined,
        };
        return change;
    }).sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id));
}
function normalizeEvents(events) {
    return events.map(event => {
        validateTimestamp(event.at, 'event.at');
        if (!['analysis', 'permission', 'change', 'verification', 'warning'].includes(event.type))
            throw new Error(`Invalid event type: ${event.type}`);
        return {
            at: event.at,
            type: event.type,
            message: sanitizeText(event.message, 2_000),
            metadata: event.metadata ? sanitizeMetadata(event.metadata) : undefined,
        };
    }).sort((a, b) => a.at - b.at || a.type.localeCompare(b.type) || a.message.localeCompare(b.message));
}
function determineStatus(issues, verification) {
    if (verification && !verification.passed)
        return 'blocked';
    if (issues.some(issue => issue.severity === 'critical'))
        return 'blocked';
    if (issues.some(issue => issue.severity === 'high' || issue.severity === 'medium'))
        return 'needs-attention';
    return 'passed';
}
function normalizeSourceCandidate(source) {
    return {
        source: sanitizePath(source.source),
        line: optionalCount(source.line, 'source.line'),
        column: optionalCount(source.column, 'source.column'),
        componentName: source.componentName ? sanitizeText(source.componentName, 200) : undefined,
        confidence: Math.min(1, Math.max(0, source.confidence)),
        evidenceKinds: [...new Set(source.evidenceKinds)].sort(),
        reasons: uniqueSanitized(source.reasons, 20, 1_000) ?? [],
    };
}
function sanitizeMetadata(value) {
    const json = JSON.stringify(value, (key, item) => sensitiveKey(key) ? '[REDACTED]' : item);
    if (json.length > 20_000)
        return { truncated: true, preview: sanitizeText(json, 20_000) };
    return JSON.parse(json);
}
function stableStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(sortValue(value, seen));
}
function sortValue(value, seen) {
    if (value === null || typeof value !== 'object')
        return value;
    if (seen.has(value))
        return '[Circular]';
    seen.add(value);
    if (Array.isArray(value))
        return value.map(item => sortValue(item, seen));
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortValue(item, seen)]));
}
function sanitizeText(value, max) {
    return value
        .replace(/\u0000/g, '')
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
        .replace(/((?:^|[?&\s;,])(?:token|access_token|api_key|key|secret|password)=)[^&#\s;,]+/gi, '$1[REDACTED]')
        .slice(0, max)
        .trim();
}
function sanitizePath(value) {
    return sanitizeText(value.replace(/\\/g, '/'), 1_000);
}
function uniqueSanitized(value, maxItems, maxLength) {
    if (!value)
        return undefined;
    return [...new Set(value.map(item => sanitizeText(String(item), maxLength)).filter(Boolean))].slice(0, maxItems);
}
function validateTargetUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('targetUrl must be credential-free HTTP(S)');
    return url.toString();
}
function optionalHash(value) {
    if (value === undefined)
        return undefined;
    const normalized = value.trim();
    if (!/^[A-Za-z0-9._:+/-]{1,200}$/.test(normalized))
        throw new Error('Revision/hash value is invalid');
    return normalized;
}
function validateIdentifier(value, name) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value))
        throw new Error(`${name} is invalid`);
    return value;
}
function validateTimestamp(value, name) {
    if (!Number.isFinite(value) || value < 0)
        throw new Error(`${name} is invalid`);
}
function optionalCount(value, name) {
    if (value === undefined)
        return undefined;
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error(`${name} must be a non-negative integer`);
    return value;
}
function validateSeverity(value) {
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(value))
        throw new Error(`Invalid issue severity: ${value}`);
}
function severityRank(value) {
    return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[value];
}
function sensitiveKey(key) {
    return /^(?:authorization|cookie|password|secret|access_token|refresh_token|api[_-]?key)$/i.test(key);
}
function statusLabel(status) {
    return status === 'passed' ? '✅ Passed' : status === 'needs-attention' ? '⚠️ Needs attention' : '❌ Blocked';
}
function severityIcon(severity) {
    return severity === 'critical' || severity === 'high' ? '❌' : severity === 'medium' ? '⚠️' : severity === 'low' ? '🔎' : 'ℹ️';
}
function formatDuration(ms) {
    if (ms < 1_000)
        return `${ms} ms`;
    if (ms < 60_000)
        return `${(ms / 1_000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
}
function formatSource(source) {
    return `${source.source}${source.line === undefined ? '' : `:${source.line}${source.column === undefined ? '' : `:${source.column}`}`}`;
}
function escapeMarkdown(value) {
    return value.replace(/([\\`*_{}[\]()#+.!|>-])/g, '\\$1');
}
function escapeTable(value) {
    return escapeMarkdown(value).replace(/\r?\n/g, ' ');
}
function escapeCode(value) {
    return value.replace(/`/g, '\\`').replace(/\r?\n/g, ' ');
}
//# sourceMappingURL=index.js.map