/** Strict repository-scoped GitHub collaboration provider. */
export const GITHUB_PROVIDER_SCHEMA = 'yk-pets.github-provider/v1';
export class GitHubProvider {
    invoke;
    allowedRepositories;
    maxReviewBodyLength;
    now;
    constructor(invoke, options) {
        if (typeof invoke !== 'function')
            throw new Error('GitHub provider invoker must be a function');
        if (!Array.isArray(options.allowedRepositories) || options.allowedRepositories.length === 0)
            throw new Error('At least one GitHub repository must be allowlisted');
        this.invoke = invoke;
        this.allowedRepositories = new Set(options.allowedRepositories.map(validateRepository));
        this.maxReviewBodyLength = positiveInteger(options.maxReviewBodyLength ?? 20_000, 'maxReviewBodyLength');
        this.now = options.now ?? Date.now;
    }
    async getPullRequest(repository, number, signal) {
        const scope = this.#scope(repository, number);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:get', ...scope }, signal);
        return validatePullRequest(result, scope.repository, scope.number);
    }
    async listChecks(repository, number, headSha, signal) {
        const scope = this.#scope(repository, number);
        const sha = validateSha(headSha, 'headSha');
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'checks:list', ...scope, headSha: sha }, signal);
        if (!Array.isArray(result))
            throw new Error('GitHub checks response must be an array');
        const checks = result.map(validateCheckRun);
        const ids = new Set();
        for (const check of checks) {
            if (ids.has(check.id))
                throw new Error(`Duplicate GitHub check id: ${check.id}`);
            ids.add(check.id);
        }
        return checks.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    }
    async listReviewThreads(repository, number, signal) {
        const scope = this.#scope(repository, number);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-threads:list', ...scope }, signal);
        if (!Array.isArray(result))
            throw new Error('GitHub review threads response must be an array');
        const threads = result.map(value => validateReviewThread(value, this.maxReviewBodyLength));
        uniqueIds(threads, 'GitHub review thread');
        return threads.sort((a, b) => a.id.localeCompare(b.id));
    }
    async listReviews(repository, number, signal) {
        const scope = this.#scope(repository, number);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'reviews:list', ...scope }, signal);
        if (!Array.isArray(result))
            throw new Error('GitHub reviews response must be an array');
        const reviews = result.map(validateReview);
        uniqueIds(reviews, 'GitHub review');
        return reviews.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0) || a.id.localeCompare(b.id));
    }
    async rerunFailedChecks(repository, number, expectedHeadSha, checkIds, signal) {
        const scope = this.#scope(repository, number);
        const headSha = validateSha(expectedHeadSha, 'expectedHeadSha');
        const ids = normalizeIds(checkIds, 'checkIds');
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'checks:rerun-failed', ...scope, expectedHeadSha: headSha, checkIds: ids }, signal);
        if (!isRecord(result) || result.repository !== scope.repository || result.number !== scope.number || result.headSha !== headSha)
            throw new Error('GitHub retry response does not match request');
        const returnedIds = normalizeIds(result.checkIds, 'retry checkIds');
        if (JSON.stringify(returnedIds) !== JSON.stringify(ids))
            throw new Error('GitHub retry response check ids do not match request');
        return { repository: scope.repository, number: scope.number, headSha, checkIds: ids, acceptedAt: positiveTimestamp(result.acceptedAt, 'acceptedAt') };
    }
    async replyReviewThread(repository, number, threadId, body, signal) {
        const scope = this.#scope(repository, number);
        const id = boundedText(threadId, 'threadId', 300);
        const message = boundedText(body, 'review reply body', this.maxReviewBodyLength);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-thread:reply', ...scope, threadId: id, body: message }, signal);
        return validateReviewComment(result, this.maxReviewBodyLength);
    }
    async resolveReviewThread(repository, number, threadId, signal) {
        const scope = this.#scope(repository, number);
        const id = boundedText(threadId, 'threadId', 300);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'review-thread:resolve', ...scope, threadId: id }, signal);
        if (!isRecord(result) || result.threadId !== id || result.resolved !== true)
            throw new Error('GitHub review thread resolution response does not match request');
        return { threadId: id, resolved: true, resolvedAt: positiveTimestamp(result.resolvedAt, 'resolvedAt') };
    }
    async mergePullRequest(repository, number, expectedHeadSha, method, signal) {
        const scope = this.#scope(repository, number);
        const headSha = validateSha(expectedHeadSha, 'expectedHeadSha');
        const mergeMethod = validateMergeMethod(method);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:merge', ...scope, expectedHeadSha: headSha, method: mergeMethod }, signal);
        if (!isRecord(result) || result.repository !== scope.repository || result.number !== scope.number || result.headSha !== headSha || result.method !== mergeMethod || result.merged !== true)
            throw new Error('GitHub merge response does not match request');
        return { repository: scope.repository, number: scope.number, headSha, method: mergeMethod, merged: true, mergeSha: validateSha(result.mergeSha, 'mergeSha'), mergedAt: positiveTimestamp(result.mergedAt, 'mergedAt') };
    }
    async closePullRequest(repository, number, signal) {
        const scope = this.#scope(repository, number);
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'pull-request:close', ...scope }, signal);
        return validateCleanupResult(result, scope.repository, 'pull-request', String(scope.number));
    }
    async deleteBranch(repository, branch, expectedHeadSha, signal) {
        const repo = this.#repository(repository);
        const branchName = validateBranch(branch);
        const headSha = validateSha(expectedHeadSha, 'expectedHeadSha');
        const result = await this.invoke({ schema: GITHUB_PROVIDER_SCHEMA, type: 'branch:delete', repository: repo, branch: branchName, expectedHeadSha: headSha }, signal);
        return validateCleanupResult(result, repo, 'branch', branchName);
    }
    #scope(repository, number) {
        return { repository: this.#repository(repository), number: positiveInteger(number, 'pull request number') };
    }
    #repository(repository) {
        const normalized = validateRepository(repository);
        if (!this.allowedRepositories.has(normalized))
            throw new Error(`GitHub repository is not allowlisted: ${normalized}`);
        return normalized;
    }
}
export function validateRepository(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.length > 200 || value.includes('..'))
        throw new Error('GitHub repository must use safe owner/name form');
    return value;
}
export function validateBranch(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 240 || /[\u0000-\u0020~^:?*\\[\]]/.test(value) || value.startsWith('/') || value.endsWith('/') || value.endsWith('.') || value.includes('..') || value.includes('@{') || value.includes('//'))
        throw new Error('GitHub branch is invalid');
    return value;
}
export function validateSha(value, label = 'sha') {
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value))
        throw new Error(`${label} must be a 40-character Git SHA`);
    return value.toLowerCase();
}
function validatePullRequest(value, repository, number) {
    if (!isRecord(value) || value.repository !== repository || value.number !== number)
        throw new Error('GitHub pull request response does not match request');
    const state = value.state;
    if (state !== 'open' && state !== 'closed' && state !== 'merged')
        throw new Error('GitHub pull request state is invalid');
    const mergeability = value.mergeability;
    if (mergeability !== 'mergeable' && mergeability !== 'conflicting' && mergeability !== 'unknown')
        throw new Error('GitHub mergeability is invalid');
    const createdAt = positiveTimestamp(value.createdAt, 'createdAt');
    const updatedAt = positiveTimestamp(value.updatedAt, 'updatedAt');
    if (updatedAt < createdAt)
        throw new Error('GitHub pull request timestamps are invalid');
    return {
        repository,
        number,
        externalId: boundedText(value.externalId, 'externalId', 300),
        url: safeUrl(value.url, 'pull request url'),
        title: boundedText(value.title, 'title', 500),
        state,
        draft: boolean(value.draft, 'draft'),
        baseBranch: validateBranch(value.baseBranch),
        headBranch: validateBranch(value.headBranch),
        baseSha: validateSha(value.baseSha, 'baseSha'),
        headSha: validateSha(value.headSha, 'headSha'),
        mergeability,
        author: boundedText(value.author, 'author', 200),
        createdAt,
        updatedAt,
        ...(value.mergedAt !== undefined ? { mergedAt: positiveTimestamp(value.mergedAt, 'mergedAt') } : {}),
        ...(value.closedAt !== undefined ? { closedAt: positiveTimestamp(value.closedAt, 'closedAt') } : {}),
    };
}
function validateCheckRun(value) {
    if (!isRecord(value))
        throw new Error('GitHub check run is invalid');
    const status = value.status;
    if (status !== 'queued' && status !== 'in_progress' && status !== 'completed')
        throw new Error('GitHub check status is invalid');
    const conclusion = value.conclusion;
    if (![null, 'success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale'].includes(conclusion))
        throw new Error('GitHub check conclusion is invalid');
    if (status !== 'completed' && conclusion !== null)
        throw new Error('Incomplete GitHub check cannot have a conclusion');
    if (status === 'completed' && conclusion === null)
        throw new Error('Completed GitHub check requires a conclusion');
    return {
        id: boundedText(value.id, 'check id', 300),
        name: boundedText(value.name, 'check name', 300),
        status,
        conclusion: conclusion,
        required: boolean(value.required, 'required'),
        ...(value.app !== undefined ? { app: boundedText(value.app, 'check app', 200) } : {}),
        ...(value.url !== undefined ? { url: safeUrl(value.url, 'check url') } : {}),
        ...(value.startedAt !== undefined ? { startedAt: positiveTimestamp(value.startedAt, 'startedAt') } : {}),
        ...(value.completedAt !== undefined ? { completedAt: positiveTimestamp(value.completedAt, 'completedAt') } : {}),
    };
}
function validateReviewThread(value, maxBody) {
    if (!isRecord(value) || !Array.isArray(value.comments) || value.comments.length === 0)
        throw new Error('GitHub review thread is invalid');
    const comments = value.comments.map(comment => validateReviewComment(comment, maxBody));
    uniqueIds(comments, 'GitHub review comment');
    return {
        id: boundedText(value.id, 'thread id', 300),
        resolved: boolean(value.resolved, 'resolved'),
        outdated: boolean(value.outdated, 'outdated'),
        ...(value.path !== undefined ? { path: safePath(value.path) } : {}),
        ...(value.line !== undefined ? { line: positiveInteger(value.line, 'review line') } : {}),
        comments: comments.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    };
}
function validateReviewComment(value, maxBody) {
    if (!isRecord(value))
        throw new Error('GitHub review comment is invalid');
    return {
        id: boundedText(value.id, 'comment id', 300),
        author: boundedText(value.author, 'comment author', 200),
        body: boundedText(value.body, 'comment body', maxBody),
        createdAt: positiveTimestamp(value.createdAt, 'comment createdAt'),
        ...(value.updatedAt !== undefined ? { updatedAt: positiveTimestamp(value.updatedAt, 'comment updatedAt') } : {}),
        ...(value.url !== undefined ? { url: safeUrl(value.url, 'comment url') } : {}),
    };
}
function validateReview(value) {
    if (!isRecord(value))
        throw new Error('GitHub review is invalid');
    const state = value.state;
    if (!['approved', 'changes_requested', 'commented', 'dismissed', 'pending'].includes(state))
        throw new Error('GitHub review state is invalid');
    return {
        id: boundedText(value.id, 'review id', 300),
        author: boundedText(value.author, 'review author', 200),
        state: state,
        ...(value.submittedAt !== undefined ? { submittedAt: positiveTimestamp(value.submittedAt, 'submittedAt') } : {}),
        ...(value.commitSha !== undefined ? { commitSha: validateSha(value.commitSha, 'review commitSha') } : {}),
    };
}
function validateCleanupResult(value, repository, resource, identifier) {
    if (!isRecord(value) || value.repository !== repository || value.resource !== resource || value.identifier !== identifier)
        throw new Error('GitHub cleanup response does not match request');
    return { repository, resource, identifier, completedAt: positiveTimestamp(value.completedAt, 'completedAt') };
}
function normalizeIds(value, label) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100)
        throw new Error(`${label} must contain 1-100 ids`);
    const ids = value.map(id => boundedText(id, label, 300)).sort();
    if (new Set(ids).size !== ids.length)
        throw new Error(`${label} contains duplicates`);
    return ids;
}
function uniqueIds(values, label) {
    const ids = new Set();
    for (const value of values) {
        if (ids.has(value.id))
            throw new Error(`Duplicate ${label} id: ${value.id}`);
        ids.add(value.id);
    }
}
function safePath(value) {
    const text = boundedText(value, 'review path', 1_000);
    if (text.startsWith('/') || text.includes('\\') || text.split('/').some(part => !part || part === '.' || part === '..'))
        throw new Error('Review path is invalid');
    return text;
}
function safeUrl(value, label) {
    const text = boundedText(value, label, 2_000);
    let url;
    try {
        url = new URL(text);
    }
    catch {
        throw new Error(`${label} is invalid`);
    }
    if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error(`${label} must be credential-free HTTPS`);
    return url.toString();
}
function validateMergeMethod(value) {
    if (value !== 'merge' && value !== 'squash' && value !== 'rebase')
        throw new Error('Merge method is invalid');
    return value;
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function positiveInteger(value, label) {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer`);
    return value;
}
function positiveTimestamp(value, label) {
    if (!Number.isFinite(value) || value <= 0)
        throw new Error(`${label} must be a positive timestamp`);
    return value;
}
function boolean(value, label) {
    if (typeof value !== 'boolean')
        throw new Error(`${label} must be boolean`);
    return value;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=index.js.map