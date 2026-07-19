/** Stable pull request lifecycle synchronization and change detection. */
import { GitHubProvider, } from '@yk-pets/pet-github-provider';
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan';
export const PR_LIFECYCLE_SCHEMA = 'yk-pets.pr-lifecycle/v1';
export class MemoryPullRequestLifecycleStore {
    #items = new Map();
    async get(repository, number) {
        const value = this.#items.get(key(repository, number));
        return value ? clone(value) : null;
    }
    async put(snapshot, expectedPreviousDigest) {
        const current = this.#items.get(key(snapshot.repository, snapshot.number));
        if (expectedPreviousDigest !== undefined && current?.digest !== expectedPreviousDigest)
            throw new Error('Pull request lifecycle compare-and-swap conflict');
        if (expectedPreviousDigest === undefined && current)
            throw new Error('Pull request lifecycle snapshot already exists');
        this.#items.set(key(snapshot.repository, snapshot.number), clone(snapshot));
    }
}
export class PullRequestSynchronizer {
    provider;
    store;
    now;
    constructor(provider, options = {}) {
        this.provider = provider;
        this.store = options.store ?? new MemoryPullRequestLifecycleStore();
        this.now = options.now ?? Date.now;
    }
    async sync(repository, number, options = {}) {
        const before = await this.provider.getPullRequest(repository, number, options.signal);
        if (options.expectedHeadSha !== undefined && before.headSha !== options.expectedHeadSha.toLowerCase())
            throw new Error('Pull request head no longer matches the expected commit');
        const [checks, reviewThreads, reviews] = await Promise.all([
            this.provider.listChecks(repository, number, before.headSha, options.signal),
            this.provider.listReviewThreads(repository, number, options.signal),
            this.provider.listReviews(repository, number, options.signal),
        ]);
        const after = await this.provider.getPullRequest(repository, number, options.signal);
        if (stablePullRequestIdentity(before) !== stablePullRequestIdentity(after))
            throw new Error('Pull request changed during lifecycle synchronization');
        const capturedAt = this.now();
        const summary = summarize(checks, reviewThreads, reviews, before.headSha);
        const digest = await lifecycleDigest({ pullRequest: after, checks, reviewThreads, reviews, summary });
        const snapshot = {
            schema: PR_LIFECYCLE_SCHEMA,
            repository: after.repository,
            number: after.number,
            capturedAt,
            pullRequest: clone(after),
            checks: clone(checks),
            reviewThreads: clone(reviewThreads),
            reviews: clone(reviews),
            summary,
            digest,
        };
        const previous = await this.store.get(after.repository, after.number);
        await this.store.put(snapshot, previous?.digest);
        const events = diffLifecycle(previous, snapshot);
        return { snapshot: clone(snapshot), previous, events, changed: previous?.digest !== snapshot.digest };
    }
}
export async function lifecycleDigest(value) {
    return sha256Hex(stableStringify(value));
}
export function summarize(checks, threads, reviews, headSha) {
    const current = latestReviewByAuthor(reviews, headSha);
    let successfulChecks = 0;
    let failedChecks = 0;
    let pendingChecks = 0;
    for (const check of checks) {
        if (check.status !== 'completed')
            pendingChecks += 1;
        else if (check.conclusion === 'success' || check.conclusion === 'skipped' || check.conclusion === 'neutral')
            successfulChecks += 1;
        else
            failedChecks += 1;
    }
    return {
        totalChecks: checks.length,
        requiredChecks: checks.filter(check => check.required).length,
        successfulChecks,
        failedChecks,
        pendingChecks,
        unresolvedThreads: threads.filter(thread => !thread.resolved && !thread.outdated).length,
        currentApprovals: [...current.values()].filter(review => review.state === 'approved').length,
        currentChangesRequested: [...current.values()].filter(review => review.state === 'changes_requested').length,
    };
}
export function latestReviewByAuthor(reviews, headSha) {
    const current = new Map();
    for (const review of reviews) {
        if (review.state === 'pending')
            continue;
        if (headSha && review.commitSha && review.commitSha !== headSha)
            continue;
        const prior = current.get(review.author);
        if (!prior || (review.submittedAt ?? 0) >= (prior.submittedAt ?? 0))
            current.set(review.author, clone(review));
    }
    return current;
}
export function diffLifecycle(previous, current) {
    const at = current.capturedAt;
    if (!previous)
        return [{ type: 'initial-snapshot', at }];
    const events = [];
    if (previous.pullRequest.headSha !== current.pullRequest.headSha)
        events.push({ type: 'head-changed', previous: previous.pullRequest.headSha, current: current.pullRequest.headSha, at });
    if (previous.pullRequest.state !== current.pullRequest.state)
        events.push({ type: 'state-changed', previous: previous.pullRequest.state, current: current.pullRequest.state, at });
    if (previous.pullRequest.draft !== current.pullRequest.draft)
        events.push({ type: 'draft-changed', previous: previous.pullRequest.draft, current: current.pullRequest.draft, at });
    diffMap(events, previous.checks, current.checks, item => item.id, item => `${item.status}:${item.conclusion}`, 'check-changed', at);
    diffMap(events, previous.reviewThreads, current.reviewThreads, item => item.id, item => `${item.resolved}:${item.outdated}:${item.comments.length}`, 'thread-changed', at);
    const previousReviews = [...latestReviewByAuthor(previous.reviews, previous.pullRequest.headSha).values()];
    const currentReviews = [...latestReviewByAuthor(current.reviews, current.pullRequest.headSha).values()];
    diffMap(events, previousReviews, currentReviews, item => item.author, item => item.state, 'review-changed', at);
    return events.sort((a, b) => a.type.localeCompare(b.type) || eventId(a).localeCompare(eventId(b)));
}
function diffMap(events, previous, current, id, status, type, at) {
    const before = new Map(previous.map(item => [id(item), status(item)]));
    const after = new Map(current.map(item => [id(item), status(item)]));
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        if (before.get(key) === after.get(key))
            continue;
        if (type === 'review-changed')
            events.push({ type, author: key, previous: before.get(key), current: after.get(key), at });
        else
            events.push({ type, id: key, previous: before.get(key), current: after.get(key), at });
    }
}
function stablePullRequestIdentity(value) {
    return stableStringify({ repository: value.repository, number: value.number, state: value.state, draft: value.draft, baseBranch: value.baseBranch, headBranch: value.headBranch, baseSha: value.baseSha, headSha: value.headSha, mergeability: value.mergeability, updatedAt: value.updatedAt });
}
function eventId(event) {
    return 'id' in event ? event.id : 'author' in event ? event.author : '';
}
function key(repository, number) { return `${repository}#${number}`; }
function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
//# sourceMappingURL=index.js.map