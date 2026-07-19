/** Safe, deterministic source patch planning primitives. */
export const PATCH_PLAN_SCHEMA = 'yk-pets.patch-plan/v1';
const DEFAULT_PROTECTED_PREFIXES = ['.git/', '.yk-pets/approvals/', 'node_modules/'];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export function validatePatchPlan(plan, options = {}) {
    if (!isRecord(plan))
        throw new Error('Patch plan must be an object');
    if (plan.schema !== PATCH_PLAN_SCHEMA)
        throw new Error(`Unsupported patch plan schema: ${String(plan.schema)}`);
    assertIdentifier(plan.id, 'plan id');
    assertBoundedText(plan.projectId, 'projectId', 200);
    if (!Number.isFinite(plan.createdAt) || plan.createdAt <= 0)
        throw new Error('createdAt must be a positive timestamp');
    assertBoundedText(plan.summary, 'summary', 500);
    if (plan.baseRevision !== undefined)
        assertBoundedText(plan.baseRevision, 'baseRevision', 256);
    if (!Array.isArray(plan.changes) || plan.changes.length === 0)
        throw new Error('Patch plan must contain at least one change');
    const maxChanges = positiveInteger(options.maxChanges ?? 200, 'maxChanges');
    if (plan.changes.length > maxChanges)
        throw new Error(`Patch plan exceeds ${maxChanges} changes`);
    const maxFileBytes = positiveInteger(options.maxFileBytes ?? 2_000_000, 'maxFileBytes');
    const maxPlanBytes = positiveInteger(options.maxPlanBytes ?? 10_000_000, 'maxPlanBytes');
    const protectedPrefixes = (options.protectedPrefixes ?? DEFAULT_PROTECTED_PREFIXES).map(prefix => normalizeProjectPath(prefix, { allowTrailingSlash: true }));
    const ids = new Set();
    const touched = new Map();
    let changedBytes = 0;
    for (const change of plan.changes) {
        if (!isRecord(change))
            throw new Error('Patch plan change must be an object');
        assertIdentifier(change.id, 'change id');
        if (ids.has(change.id))
            throw new Error(`Duplicate change id: ${change.id}`);
        ids.add(change.id);
        if (change.rationale !== undefined)
            assertBoundedText(change.rationale, `rationale for ${change.id}`, 1_000);
        switch (change.operation) {
            case 'create': {
                const path = validateWritablePath(change.path, protectedPrefixes);
                claimPath(touched, path, change.id);
                assertString(change.content, `content for ${change.id}`);
                const bytes = utf8Bytes(change.content);
                if (bytes > maxFileBytes)
                    throw new Error(`${path} exceeds maxFileBytes`);
                changedBytes += bytes;
                break;
            }
            case 'update': {
                const path = validateWritablePath(change.path, protectedPrefixes);
                claimPath(touched, path, change.id);
                assertSha256(change.expectedSha256, `${change.id}.expectedSha256`);
                validateTextEdits(change.edits, change.id, maxFileBytes);
                changedBytes += change.edits.reduce((sum, edit) => sum + utf8Bytes(edit.replacement), 0);
                break;
            }
            case 'delete': {
                const path = validateWritablePath(change.path, protectedPrefixes);
                claimPath(touched, path, change.id);
                assertSha256(change.expectedSha256, `${change.id}.expectedSha256`);
                break;
            }
            case 'move': {
                const from = validateWritablePath(change.fromPath, protectedPrefixes);
                const to = validateWritablePath(change.toPath, protectedPrefixes);
                if (from === to)
                    throw new Error(`${change.id} move source and destination are identical`);
                claimPath(touched, from, change.id);
                claimPath(touched, to, change.id);
                assertSha256(change.expectedSha256, `${change.id}.expectedSha256`);
                break;
            }
            default:
                throw new Error(`Unsupported patch operation: ${String(change.operation)}`);
        }
    }
    if (changedBytes > maxPlanBytes)
        throw new Error(`Patch plan exceeds maxPlanBytes (${maxPlanBytes})`);
    validateVerification(plan.verification);
    if (plan.metadata !== undefined)
        validateJsonValue(plan.metadata, 'metadata');
}
export function normalizeProjectPath(input, options = {}) {
    assertString(input, 'path');
    if (input.length === 0 || input.length > 500)
        throw new Error('Project path length is invalid');
    if (input.includes('\u0000') || /[\u0000-\u001f\u007f]/.test(input))
        throw new Error('Project path contains control characters');
    if (input.includes('\\'))
        throw new Error('Project path must use forward slashes');
    if (/^[a-zA-Z]:\//.test(input) || input.startsWith('/') || input.startsWith('~/'))
        throw new Error('Project path must be relative');
    const trailing = input.endsWith('/');
    const parts = input.split('/').filter(part => part.length > 0);
    if (parts.length === 0)
        throw new Error('Project path cannot resolve to project root');
    for (const part of parts) {
        if (part === '.' || part === '..')
            throw new Error('Project path traversal is not allowed');
        if (part.length > 255)
            throw new Error('Project path segment is too long');
    }
    const normalized = parts.join('/');
    return options.allowTrailingSlash && trailing ? `${normalized}/` : normalized;
}
export function validateTextEdits(edits, changeId = 'update', maxReplacementBytes = 2_000_000) {
    if (!Array.isArray(edits) || edits.length === 0)
        throw new Error(`${changeId} must contain at least one text edit`);
    if (edits.length > 1_000)
        throw new Error(`${changeId} contains too many text edits`);
    let previousEnd = -1;
    for (const [index, edit] of edits.entries()) {
        if (!isRecord(edit))
            throw new Error(`${changeId} edit ${index} is invalid`);
        if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.end < edit.start) {
            throw new Error(`${changeId} edit ${index} range is invalid`);
        }
        if (edit.start < previousEnd)
            throw new Error(`${changeId} text edits overlap or are not sorted`);
        previousEnd = edit.end;
        assertString(edit.replacement, `${changeId} edit ${index} replacement`);
        if (utf8Bytes(edit.replacement) > maxReplacementBytes)
            throw new Error(`${changeId} edit ${index} replacement is too large`);
        if (edit.expectedText !== undefined) {
            assertString(edit.expectedText, `${changeId} edit ${index} expectedText`);
            if (edit.expectedText.length !== edit.end - edit.start)
                throw new Error(`${changeId} edit ${index} expectedText length does not match range`);
        }
    }
}
export function applyTextEdits(original, edits) {
    assertString(original, 'original content');
    validateTextEdits(edits);
    for (const [index, edit] of edits.entries()) {
        if (edit.end > original.length)
            throw new Error(`Text edit ${index} exceeds file length`);
        if (edit.expectedText !== undefined && original.slice(edit.start, edit.end) !== edit.expectedText) {
            throw new Error(`Text edit ${index} precondition did not match`);
        }
    }
    let output = original;
    for (let index = edits.length - 1; index >= 0; index -= 1) {
        const edit = edits[index];
        output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
    }
    return output;
}
export function touchedPaths(plan) {
    validatePatchPlan(plan);
    const paths = new Set();
    for (const change of plan.changes) {
        if (change.operation === 'move') {
            paths.add(normalizeProjectPath(change.fromPath));
            paths.add(normalizeProjectPath(change.toPath));
        }
        else
            paths.add(normalizeProjectPath(change.path));
    }
    return [...paths].sort();
}
export function summarizePatchPlan(plan) {
    validatePatchPlan(plan);
    const operations = { create: 0, update: 0, delete: 0, move: 0 };
    let estimatedChangedBytes = 0;
    for (const change of plan.changes) {
        operations[change.operation] += 1;
        if (change.operation === 'create')
            estimatedChangedBytes += utf8Bytes(change.content);
        if (change.operation === 'update')
            estimatedChangedBytes += change.edits.reduce((sum, edit) => sum + utf8Bytes(edit.replacement), 0);
    }
    return { planId: plan.id, projectId: plan.projectId, operations, touchedPaths: touchedPaths(plan), estimatedChangedBytes };
}
export async function computePatchPlanDigest(plan) {
    validatePatchPlan(plan);
    return sha256Hex(stableStringify(plan));
}
export async function sha256Hex(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle)
        throw new Error('Web Crypto SHA-256 is unavailable');
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function stableStringify(value) {
    return JSON.stringify(sortJson(value));
}
function sortJson(value) {
    if (Array.isArray(value))
        return value.map(sortJson);
    if (isRecord(value)) {
        const output = {};
        for (const key of Object.keys(value).sort())
            output[key] = sortJson(value[key]);
        return output;
    }
    return value;
}
function validateWritablePath(path, protectedPrefixes) {
    const normalized = normalizeProjectPath(path);
    for (const prefix of protectedPrefixes) {
        const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
        if (normalized === normalizedPrefix.slice(0, -1) || normalized.startsWith(normalizedPrefix)) {
            throw new Error(`Protected project path cannot be modified: ${normalized}`);
        }
    }
    return normalized;
}
function claimPath(paths, path, changeId) {
    const existing = paths.get(path);
    if (existing)
        throw new Error(`Path ${path} is modified by both ${existing} and ${changeId}`);
    paths.set(path, changeId);
}
function validateVerification(verification) {
    if (verification === undefined)
        return;
    if (!isRecord(verification))
        throw new Error('verification must be an object');
    for (const [name, list] of [['commands', verification.commands], ['scenarios', verification.scenarios]]) {
        if (list === undefined)
            continue;
        if (!Array.isArray(list) || list.length > 100)
            throw new Error(`verification.${name} is invalid`);
        for (const value of list)
            assertBoundedText(value, `verification.${name}`, 500);
    }
    if (verification.required !== undefined && typeof verification.required !== 'boolean')
        throw new Error('verification.required must be boolean');
}
function validateJsonValue(value, path) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return;
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new Error(`${path} contains a non-finite number`);
        return;
    }
    if (Array.isArray(value)) {
        if (value.length > 1_000)
            throw new Error(`${path} array is too large`);
        value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`));
        return;
    }
    if (isRecord(value)) {
        const keys = Object.keys(value);
        if (keys.length > 1_000)
            throw new Error(`${path} object is too large`);
        for (const key of keys) {
            assertBoundedText(key, `${path} key`, 200);
            validateJsonValue(value[key], `${path}.${key}`);
        }
        return;
    }
    throw new Error(`${path} contains a non-JSON value`);
}
function assertSha256(value, label) {
    if (typeof value !== 'string' || !SHA256_PATTERN.test(value))
        throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
}
function assertIdentifier(value, label) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
}
function assertBoundedText(value, label, maxLength) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
        throw new Error(`${label} is invalid`);
    }
}
function assertString(value, label) {
    if (typeof value !== 'string')
        throw new Error(`${label} must be a string`);
}
function positiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer`);
    return value;
}
function utf8Bytes(value) {
    return new TextEncoder().encode(value).byteLength;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=index.js.map