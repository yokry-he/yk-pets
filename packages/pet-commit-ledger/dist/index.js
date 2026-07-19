/** Tamper-evident append-only records for controlled repository publishing. */
import { normalizeProjectPath, sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan';
export const COMMIT_RECORD_SCHEMA = 'yk-pets.commit-record/v1';
export const GENESIS_DIGEST = '0'.repeat(64);
const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export class CommitLedger {
    store;
    now;
    constructor(store, options = {}) {
        this.store = store;
        this.now = options.now ?? Date.now;
    }
    async list(projectId) {
        const id = boundedText(projectId, 'projectId', 200);
        const entries = clone(await this.store.list(id));
        await verifyCommitLedger(entries, id);
        return entries;
    }
    async append(payload) {
        validatePayload(payload);
        const entries = await this.list(payload.projectId);
        const previousDigest = entries.at(-1)?.digest ?? GENESIS_DIGEST;
        const sequence = entries.length + 1;
        const recordedAt = this.now();
        if (!Number.isFinite(recordedAt) || recordedAt <= 0)
            throw new Error('Ledger clock returned an invalid timestamp');
        const withoutDigest = {
            schema: COMMIT_RECORD_SCHEMA,
            sequence,
            previousDigest,
            recordedAt,
            ...clone(payload),
        };
        const digest = await sha256Hex(stableStringify(withoutDigest));
        const entry = { ...withoutDigest, digest };
        validateCommitLedgerEntry(entry);
        await this.store.append(payload.projectId, clone(entry), previousDigest);
        const after = await this.list(payload.projectId);
        const persisted = after.at(-1);
        if (!persisted || persisted.digest !== digest)
            throw new Error('Commit ledger append was not persisted exactly');
        return clone(entry);
    }
}
export class MemoryCommitLedgerStore {
    #entries = new Map();
    list(projectId) {
        return clone(this.#entries.get(projectId) ?? []);
    }
    append(projectId, entry, expectedPreviousDigest) {
        const entries = this.#entries.get(projectId) ?? [];
        const actualPrevious = entries.at(-1)?.digest ?? GENESIS_DIGEST;
        if (actualPrevious !== expectedPreviousDigest)
            throw new Error('Commit ledger compare-and-swap conflict');
        if (entry.previousDigest !== actualPrevious || entry.sequence !== entries.length + 1)
            throw new Error('Commit ledger entry does not extend the current chain');
        entries.push(clone(entry));
        this.#entries.set(projectId, entries);
    }
    unsafeReplace(projectId, entries) {
        this.#entries.set(projectId, clone(entries));
    }
}
export async function verifyCommitLedger(entries, expectedProjectId) {
    if (!Array.isArray(entries))
        throw new Error('Commit ledger must be an array');
    let previousDigest = GENESIS_DIGEST;
    const ids = new Set();
    for (const [index, entry] of entries.entries()) {
        validateCommitLedgerEntry(entry);
        if (expectedProjectId !== undefined && entry.projectId !== expectedProjectId)
            throw new Error(`Commit ledger project mismatch at sequence ${entry.sequence}`);
        if (entry.sequence !== index + 1)
            throw new Error(`Commit ledger sequence is invalid at index ${index}`);
        if (entry.previousDigest !== previousDigest)
            throw new Error(`Commit ledger chain is broken at sequence ${entry.sequence}`);
        if (ids.has(entry.id))
            throw new Error(`Duplicate commit record id: ${entry.id}`);
        ids.add(entry.id);
        const { digest, ...withoutDigest } = entry;
        const expectedDigest = await sha256Hex(stableStringify(withoutDigest));
        if (digest !== expectedDigest)
            throw new Error(`Commit ledger digest mismatch at sequence ${entry.sequence}`);
        previousDigest = digest;
    }
}
export function validateCommitLedgerEntry(entry) {
    if (!isRecord(entry) || entry.schema !== COMMIT_RECORD_SCHEMA)
        throw new Error('Commit ledger entry schema is invalid');
    if (!Number.isInteger(entry.sequence) || entry.sequence <= 0)
        throw new Error('Commit ledger sequence is invalid');
    assertDigest(entry.previousDigest, 'previousDigest');
    assertDigest(entry.digest, 'digest');
    if (!Number.isFinite(entry.recordedAt) || entry.recordedAt <= 0)
        throw new Error('Commit ledger recordedAt is invalid');
    validatePayload(entry);
}
export async function computeCommitRecordPayloadDigest(payload) {
    validatePayload(payload);
    return sha256Hex(stableStringify(payload));
}
export function renderCommitLedgerMarkdown(entry) {
    validateCommitLedgerEntry(entry);
    const lines = [
        `# YK Pets Commit Record ${entry.id}`,
        '',
        `- Sequence: ${entry.sequence}`,
        `- Project: ${entry.projectId}`,
        `- Repository: ${entry.repositoryId}`,
        `- Branch: ${entry.branch}`,
        `- Base: ${entry.baseRevision}`,
        `- Commit: ${entry.commit.sha}`,
        `- Subject: ${entry.commit.subject}`,
        `- Plan: ${entry.planId} (${entry.planDigest})`,
        `- Gate: ${entry.gateDigest}`,
        `- Record digest: ${entry.digest}`,
        '',
        '## Changed paths',
        ...entry.changedPaths.map(path => `- \`${path}\``),
    ];
    if (entry.push)
        lines.push('', '## Push', `- ${entry.push.remote}/${entry.push.branch} @ ${entry.push.commitSha}`);
    if (entry.pullRequest)
        lines.push('', '## Draft pull request', `- ${entry.pullRequest.repository}: ${entry.pullRequest.title}`, `- ${entry.pullRequest.baseBranch} ← ${entry.pullRequest.headBranch}`);
    return `${lines.join('\n')}\n`;
}
function validatePayload(payload) {
    if (!isRecord(payload))
        throw new Error('Commit record payload is invalid');
    validateId(payload.id, 'record id');
    boundedText(payload.projectId, 'projectId', 200);
    boundedText(payload.repositoryId, 'repositoryId', 200);
    validateId(payload.sessionId, 'sessionId');
    validateId(payload.planId, 'planId');
    assertDigest(payload.planDigest, 'planDigest');
    validateId(payload.approvalId, 'approvalId');
    assertSha(payload.baseRevision, 'baseRevision');
    boundedText(payload.branch, 'branch', 200);
    validateCommit(payload.commit, payload.baseRevision);
    assertDigest(payload.gateDigest, 'gateDigest');
    if (!isRecord(payload.validationDigests))
        throw new Error('validationDigests is invalid');
    for (const [id, digest] of Object.entries(payload.validationDigests)) {
        boundedText(id, 'validation id', 100);
        assertDigest(digest, `validation digest ${id}`);
    }
    if (!Array.isArray(payload.changedPaths) || payload.changedPaths.length === 0)
        throw new Error('changedPaths must not be empty');
    const normalized = payload.changedPaths.map(path => normalizeProjectPath(path));
    if (new Set(normalized).size !== normalized.length || normalized.some((path, index) => path !== [...normalized].sort()[index]))
        throw new Error('changedPaths must be unique and sorted');
    if (payload.push)
        validatePush(payload.push, payload.branch, payload.commit.sha);
    if (payload.pullRequest)
        validatePullRequest(payload.pullRequest, payload.branch);
    if (payload.metadata !== undefined) {
        if (!isRecord(payload.metadata))
            throw new Error('Commit record metadata is invalid');
        for (const [key, value] of Object.entries(payload.metadata)) {
            boundedText(key, 'metadata key', 100);
            if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
                throw new Error(`Metadata value ${key} is invalid`);
            if (typeof value === 'string' && value.length > 1_000)
                throw new Error(`Metadata value ${key} is too long`);
            if (typeof value === 'number' && !Number.isFinite(value))
                throw new Error(`Metadata value ${key} is invalid`);
        }
    }
}
function validateCommit(commit, baseRevision) {
    if (!isRecord(commit))
        throw new Error('Commit identity is invalid');
    assertSha(commit.sha, 'commit SHA');
    assertSha(commit.treeSha, 'tree SHA');
    if (!Array.isArray(commit.parentShas) || commit.parentShas.length === 0)
        throw new Error('Commit parent SHAs are invalid');
    commit.parentShas.forEach((sha, index) => assertSha(sha, `commit parent ${index}`));
    if (commit.parentShas[0] !== baseRevision)
        throw new Error('Commit first parent does not match base revision');
    boundedText(commit.subject, 'commit subject', 200);
    if (!Number.isFinite(commit.committedAt) || commit.committedAt <= 0)
        throw new Error('Commit timestamp is invalid');
}
function validatePush(push, branch, commitSha) {
    if (!isRecord(push))
        throw new Error('Push record is invalid');
    boundedText(push.remote, 'push remote', 100);
    if (push.branch !== branch || push.commitSha !== commitSha)
        throw new Error('Push record does not match branch and commit');
    if (!Number.isFinite(push.pushedAt) || push.pushedAt <= 0)
        throw new Error('Push timestamp is invalid');
    if (push.remoteUrl !== undefined)
        safeUrl(push.remoteUrl, 'push remote URL');
}
function validatePullRequest(pr, branch) {
    if (!isRecord(pr))
        throw new Error('Draft pull request record is invalid');
    boundedText(pr.provider, 'PR provider', 100);
    boundedText(pr.repository, 'PR repository', 300);
    boundedText(pr.baseBranch, 'PR base branch', 200);
    if (pr.headBranch !== branch)
        throw new Error('PR head branch does not match commit branch');
    boundedText(pr.title, 'PR title', 300);
    if (!Number.isFinite(pr.createdAt) || pr.createdAt <= 0)
        throw new Error('PR timestamp is invalid');
    if (pr.number !== undefined && (!Number.isInteger(pr.number) || pr.number <= 0))
        throw new Error('PR number is invalid');
    if (pr.url !== undefined)
        safeUrl(pr.url, 'PR URL');
    if (pr.externalId !== undefined)
        boundedText(pr.externalId, 'PR externalId', 300);
}
function safeUrl(value, label) {
    if (typeof value !== 'string' || value.length > 2_000)
        throw new Error(`${label} is invalid`);
    const url = new URL(value);
    if (!['https:', 'ssh:'].includes(url.protocol) || url.username || url.password)
        throw new Error(`${label} is invalid`);
}
function validateId(value, label) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function assertSha(value, label) {
    if (typeof value !== 'string' || !SHA_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
}
function assertDigest(value, label) {
    if (typeof value !== 'string' || !DIGEST_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function clone(value) {
    if (typeof structuredClone === 'function')
        return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=index.js.map