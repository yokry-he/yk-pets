/** Isolated Git worktree session orchestration without arbitrary Git command execution. */
import { normalizeProjectPath } from '@yk-pets/pet-patch-plan';
import { validateBranchName } from '@yk-pets/pet-repository-policy';
export const REPOSITORY_SESSION_SCHEMA = 'yk-pets.repository-session/v1';
const SHA_PATTERN = /^[a-f0-9]{7,64}$/i;
const REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export class GitWorktreeCoordinator {
    adapter;
    maxOpenSessions;
    defaultTtlMs;
    maxTtlMs;
    allowedBaseRefs;
    now;
    idFactory;
    #sessions = new Map();
    #disposed = false;
    constructor(adapter, options = {}) {
        this.adapter = adapter;
        this.maxOpenSessions = positiveInteger(options.maxOpenSessions ?? 4, 'maxOpenSessions');
        this.defaultTtlMs = positiveInteger(options.defaultTtlMs ?? 30 * 60_000, 'defaultTtlMs');
        this.maxTtlMs = positiveInteger(options.maxTtlMs ?? 4 * 60 * 60_000, 'maxTtlMs');
        if (this.defaultTtlMs > this.maxTtlMs)
            throw new Error('defaultTtlMs cannot exceed maxTtlMs');
        this.allowedBaseRefs = (options.allowedBaseRefs ?? ['main', 'master', 'trunk', 'develop']).map(validateRef);
        this.now = options.now ?? Date.now;
        this.idFactory = options.idFactory ?? randomId;
    }
    list() {
        this.#expireSessions();
        return [...this.#sessions.values()].map(clone).sort((a, b) => a.openedAt - b.openedAt || a.sessionId.localeCompare(b.sessionId));
    }
    get(sessionId) {
        this.#assertUsable();
        this.#expireSessions();
        const session = this.#sessions.get(validateId(sessionId, 'sessionId'));
        if (!session)
            throw new Error(`Unknown repository session: ${sessionId}`);
        return clone(session);
    }
    async open(input, signal) {
        this.#assertUsable();
        throwIfAborted(signal);
        this.#expireSessions();
        const sessionId = validateId(input.sessionId, 'sessionId');
        if (this.#sessions.has(sessionId))
            throw new Error(`Repository session already exists: ${sessionId}`);
        const openCount = [...this.#sessions.values()].filter(session => ['open', 'committed', 'pushed'].includes(session.state)).length;
        if (openCount >= this.maxOpenSessions)
            throw new Error(`Open repository session limit reached (${this.maxOpenSessions})`);
        const repositoryId = boundedText(input.repositoryId, 'repositoryId', 200);
        const projectId = boundedText(input.projectId, 'projectId', 200);
        const baseRef = validateRef(input.baseRef);
        if (this.allowedBaseRefs.length > 0 && !this.allowedBaseRefs.includes(baseRef))
            throw new Error(`Base ref is not allowed: ${baseRef}`);
        const expectedBaseRevision = validateSha(input.expectedBaseRevision, 'expectedBaseRevision');
        const branch = validateBranchName(input.branch);
        const ttlMs = positiveInteger(input.ttlMs ?? this.defaultTtlMs, 'ttlMs');
        if (ttlMs > this.maxTtlMs)
            throw new Error(`ttlMs exceeds maximum ${this.maxTtlMs}`);
        const inspection = await this.adapter.inspectRepository(repositoryId, signal);
        validateInspection(inspection, repositoryId, projectId);
        if (inspection.bare)
            throw new Error('Bare repositories are not supported');
        if (!inspection.worktreeSupported)
            throw new Error('Repository does not support isolated worktrees');
        const resolved = validateSha(await this.adapter.resolveRevision(repositoryId, baseRef, signal), 'resolved base revision');
        if (resolved !== expectedBaseRevision)
            throw new Error('Approved base revision no longer matches the repository ref');
        if (await this.adapter.branchExists(repositoryId, branch, signal))
            throw new Error(`Repository branch already exists: ${branch}`);
        const openedAt = this.now();
        const worktreeId = validateId(this.idFactory(), 'worktreeId');
        const session = {
            schema: REPOSITORY_SESSION_SCHEMA,
            sessionId,
            worktreeId,
            repositoryId,
            projectId,
            baseRef,
            baseRevision: resolved,
            branch,
            state: 'open',
            openedAt,
            expiresAt: openedAt + ttlMs,
        };
        this.#sessions.set(sessionId, session);
        let created = false;
        try {
            await this.adapter.createWorktree({ repositoryId, projectId, worktreeId, branch, baseRevision: resolved }, signal);
            created = true;
            const snapshot = await this.adapter.getSnapshot(worktreeId, signal);
            validateSnapshotForSession(snapshot, session);
            if (!snapshot.clean || snapshot.changes.length !== 0)
                throw new Error('New isolated worktree is not clean');
            return clone(session);
        }
        catch (error) {
            session.state = 'failed';
            session.error = errorMessage(error);
            if (created) {
                try {
                    await this.adapter.removeWorktree(worktreeId, true);
                }
                catch (cleanupError) {
                    session.error = `${session.error}; cleanup failed: ${errorMessage(cleanupError)}`;
                }
            }
            throw new Error(session.error);
        }
    }
    async snapshot(sessionId, signal) {
        const session = this.#activeSession(sessionId);
        const snapshot = await this.adapter.getSnapshot(session.worktreeId, signal);
        validateSnapshotForSession(snapshot, session, { allowHeadAdvance: session.state !== 'open' });
        return clone(snapshot);
    }
    async stage(sessionId, paths, signal) {
        const session = this.#activeSession(sessionId, ['open']);
        const normalized = normalizePaths(paths);
        await this.adapter.stagePaths(session.worktreeId, normalized, signal);
        return this.snapshot(sessionId, signal);
    }
    async commit(sessionId, input, signal) {
        const session = this.#activeSession(sessionId, ['open']);
        validateCommitInput(input);
        const before = await this.adapter.getSnapshot(session.worktreeId, signal);
        validateSnapshotForSession(before, session);
        const result = validateCommitResult(await this.adapter.commit(session.worktreeId, {
            ...clone(input),
            expectedParentRevision: session.baseRevision,
        }, signal), session.baseRevision);
        const after = await this.adapter.getSnapshot(session.worktreeId, signal);
        if (after.headRevision !== result.commitSha || after.branch !== session.branch || after.detached)
            throw new Error('Repository state does not match the created commit');
        session.commit = clone(result);
        session.state = 'committed';
        return clone(result);
    }
    async push(sessionId, input, signal) {
        const session = this.#activeSession(sessionId, ['committed']);
        if (!session.commit)
            throw new Error('Repository session has no commit to push');
        const remote = validateRemote(input.remote);
        const result = validatePushResult(await this.adapter.push(session.worktreeId, {
            remote,
            branch: session.branch,
            expectedCommitSha: session.commit.commitSha,
            setUpstream: input.setUpstream ?? true,
        }, signal), remote, session.branch, session.commit.commitSha);
        session.push = clone(result);
        session.state = 'pushed';
        return clone(result);
    }
    async close(sessionId, options = {}, signal) {
        this.#assertUsable();
        const id = validateId(sessionId, 'sessionId');
        const session = this.#sessions.get(id);
        if (!session)
            throw new Error(`Unknown repository session: ${id}`);
        if (session.state === 'closed')
            return clone(session);
        await this.adapter.removeWorktree(session.worktreeId, options.force ?? false, signal);
        session.state = 'closed';
        return clone(session);
    }
    async dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        for (const session of this.#sessions.values()) {
            if (!['closed', 'failed'].includes(session.state)) {
                try {
                    await this.adapter.removeWorktree(session.worktreeId, true);
                }
                catch (error) {
                    session.error = `dispose cleanup failed: ${errorMessage(error)}`;
                }
                session.state = 'closed';
            }
        }
    }
    #activeSession(sessionId, states = ['open', 'committed', 'pushed']) {
        this.#assertUsable();
        this.#expireSessions();
        const session = this.#sessions.get(validateId(sessionId, 'sessionId'));
        if (!session)
            throw new Error(`Unknown repository session: ${sessionId}`);
        if (!states.includes(session.state))
            throw new Error(`Repository session ${sessionId} is ${session.state}`);
        return session;
    }
    #expireSessions() {
        const now = this.now();
        for (const session of this.#sessions.values()) {
            if (['open', 'committed', 'pushed'].includes(session.state) && now >= session.expiresAt) {
                session.state = 'expired';
                void this.adapter.removeWorktree(session.worktreeId, true).catch(error => { session.error = `expiry cleanup failed: ${errorMessage(error)}`; });
            }
        }
    }
    #assertUsable() {
        if (this.#disposed)
            throw new Error('GitWorktreeCoordinator is disposed');
    }
}
export function validateRepositorySession(value) {
    if (!isRecord(value) || value.schema !== REPOSITORY_SESSION_SCHEMA)
        throw new Error('Repository session is invalid');
    validateId(value.sessionId, 'sessionId');
    validateId(value.worktreeId, 'worktreeId');
    boundedText(value.repositoryId, 'repositoryId', 200);
    boundedText(value.projectId, 'projectId', 200);
    validateRef(value.baseRef);
    validateSha(value.baseRevision, 'baseRevision');
    validateBranchName(value.branch);
    if (!['open', 'committed', 'pushed', 'closed', 'expired', 'failed'].includes(value.state))
        throw new Error('Repository session state is invalid');
    if (!Number.isFinite(value.openedAt) || !Number.isFinite(value.expiresAt) || value.openedAt <= 0 || value.expiresAt <= value.openedAt)
        throw new Error('Repository session timestamps are invalid');
}
function validateInspection(value, repositoryId, projectId) {
    if (!isRecord(value) || value.repositoryId !== repositoryId || value.projectId !== projectId)
        throw new Error('Repository inspection does not match requested project');
    validateBranchName(value.defaultBranch);
    if (value.currentBranch !== null)
        validateBranchName(value.currentBranch);
    validateSha(value.headRevision, 'repository head revision');
    if (typeof value.bare !== 'boolean' || typeof value.worktreeSupported !== 'boolean')
        throw new Error('Repository inspection flags are invalid');
}
function validateSnapshotForSession(snapshot, session, options = {}) {
    if (snapshot.repositoryId !== session.repositoryId || snapshot.projectId !== session.projectId)
        throw new Error('Worktree snapshot project mismatch');
    if (snapshot.branch !== session.branch || snapshot.detached)
        throw new Error('Worktree is not attached to the requested branch');
    if (!options.allowHeadAdvance && snapshot.headRevision !== session.baseRevision)
        throw new Error('Worktree base revision changed unexpectedly');
}
function validateCommitInput(input) {
    boundedText(input.subject, 'commit subject', 200);
    if (input.body !== undefined && (typeof input.body !== 'string' || input.body.length > 20_000 || input.body.includes('\u0000')))
        throw new Error('Commit body is invalid');
    if (input.author) {
        boundedText(input.author.name, 'author name', 200);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.author.email) || input.author.email.length > 320)
            throw new Error('Author email is invalid');
    }
}
function validateCommitResult(result, expectedParent) {
    if (!isRecord(result))
        throw new Error('Git commit result is invalid');
    validateSha(result.commitSha, 'commitSha');
    validateSha(result.treeSha, 'treeSha');
    if (!Array.isArray(result.parentShas) || result.parentShas.length === 0 || result.parentShas.some(sha => !SHA_PATTERN.test(sha)))
        throw new Error('Commit parent SHAs are invalid');
    if (result.parentShas[0] !== expectedParent)
        throw new Error('Created commit parent does not match approved base revision');
    if (!Number.isFinite(result.committedAt) || result.committedAt <= 0)
        throw new Error('Commit timestamp is invalid');
    return clone(result);
}
function validatePushResult(result, remote, branch, commitSha) {
    if (!isRecord(result) || result.remote !== remote || result.branch !== branch || result.commitSha !== commitSha)
        throw new Error('Git push result is invalid');
    if (!Number.isFinite(result.pushedAt) || result.pushedAt <= 0)
        throw new Error('Push timestamp is invalid');
    if (result.remoteUrl !== undefined && (typeof result.remoteUrl !== 'string' || result.remoteUrl.length > 2_000 || /[\u0000-\u001f\u007f]/.test(result.remoteUrl)))
        throw new Error('Push remote URL is invalid');
    return clone(result);
}
function normalizePaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0)
        throw new Error('At least one path must be staged');
    const normalized = paths.map(path => normalizeProjectPath(path));
    if (new Set(normalized).size !== normalized.length)
        throw new Error('Stage paths contain duplicates');
    return normalized.sort();
}
function validateRef(value) {
    if (typeof value !== 'string' || !REF_PATTERN.test(value) || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.lock'))
        throw new Error('Git ref is invalid');
    return value;
}
function validateRemote(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value) || value.startsWith('-'))
        throw new Error('Git remote is invalid');
    return value;
}
function validateSha(value, label) {
    if (typeof value !== 'string' || !SHA_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function validateId(value, label) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function positiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer`);
    return value;
}
function throwIfAborted(signal) {
    if (signal?.aborted)
        throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted');
}
function randomId() {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.randomUUID)
        throw new Error('Secure random UUID is unavailable');
    return `wt-${cryptoApi.randomUUID()}`;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
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