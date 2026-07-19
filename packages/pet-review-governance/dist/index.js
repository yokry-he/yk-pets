/** Pull request review comment governance. */
import { GitHubProvider } from '@yk-pets/pet-github-provider';
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan';
import { latestReviewByAuthor } from '@yk-pets/pet-pr-lifecycle';
export const REVIEW_PLAN_SCHEMA = 'yk-pets.review-plan/v1';
export async function createReviewActionPlan(snapshot, planId, decisions, options = {}) {
    validateSnapshotScope(snapshot);
    const id = validateId(planId, 'planId');
    const maxActions = positiveInteger(options.maxActions ?? 50, 'maxActions');
    const maxReplyLength = positiveInteger(options.maxReplyLength ?? 20_000, 'maxReplyLength');
    if (!Array.isArray(decisions) || decisions.length === 0 || decisions.length > maxActions)
        throw new Error(`Review plan must contain 1-${maxActions} actions`);
    const threadMap = new Map(snapshot.reviewThreads.map(thread => [thread.id, thread]));
    const seen = new Set();
    const actions = [];
    for (const decision of decisions) {
        const threadId = validateId(decision.threadId, 'threadId');
        if (seen.has(threadId))
            throw new Error(`Duplicate review action for thread: ${threadId}`);
        seen.add(threadId);
        const thread = threadMap.get(threadId);
        if (!thread)
            throw new Error(`Unknown review thread: ${threadId}`);
        if (thread.resolved)
            throw new Error(`Review thread is already resolved: ${threadId}`);
        if (thread.outdated)
            throw new Error(`Outdated review thread cannot be modified: ${threadId}`);
        const action = validateAction(decision.action);
        const includesReply = action === 'reply' || action === 'reply-and-resolve';
        const includesResolve = action === 'resolve' || action === 'reply-and-resolve';
        const replyBody = decision.replyBody === undefined ? undefined : boundedText(decision.replyBody, 'replyBody', maxReplyLength);
        if (includesReply && !replyBody)
            throw new Error(`Review action ${action} requires replyBody`);
        if (!includesReply && replyBody !== undefined)
            throw new Error(`Review action ${action} cannot include replyBody`);
        if (includesResolve && !includesReply && options.allowResolveWithoutReply !== true)
            throw new Error('Resolving a review thread without a reply is disabled');
        const latest = latestComment(thread);
        actions.push({
            threadId,
            action,
            ...(replyBody !== undefined ? { replyBody } : {}),
            ...(decision.reason !== undefined ? { reason: boundedText(decision.reason, 'reason', 500) } : {}),
            ...(thread.path !== undefined ? { path: thread.path } : {}),
            ...(thread.line !== undefined ? { line: thread.line } : {}),
            latestCommentId: latest.id,
        });
    }
    actions.sort((a, b) => a.threadId.localeCompare(b.threadId));
    const base = {
        schema: REVIEW_PLAN_SCHEMA,
        planId: id,
        repository: snapshot.repository,
        number: snapshot.number,
        headSha: snapshot.pullRequest.headSha,
        snapshotDigest: snapshot.digest,
        createdAt: options.now ?? Date.now(),
        actions,
    };
    const digest = await reviewPlanDigest(base);
    return { ...base, digest };
}
export async function reviewPlanDigest(plan) {
    return sha256Hex(stableStringify({ ...plan, createdAt: undefined }));
}
export function summarizeReviewBlockers(snapshot) {
    validateSnapshotScope(snapshot);
    const reviews = latestReviewByAuthor(snapshot.reviews, snapshot.pullRequest.headSha);
    const activeThreadIds = snapshot.reviewThreads.filter(thread => !thread.resolved && !thread.outdated).map(thread => thread.id).sort();
    const outdatedUnresolvedThreadIds = snapshot.reviewThreads.filter(thread => !thread.resolved && thread.outdated).map(thread => thread.id).sort();
    const changesRequestedBy = [...reviews.values()].filter(review => review.state === 'changes_requested').map(review => review.author).sort();
    const approvedBy = [...reviews.values()].filter(review => review.state === 'approved').map(review => review.author).sort();
    return { activeThreadIds, changesRequestedBy, approvedBy, outdatedUnresolvedThreadIds, blockerCount: activeThreadIds.length + changesRequestedBy.length };
}
export class ReviewPlanExecutor {
    provider;
    now;
    constructor(provider, now = Date.now) {
        this.provider = provider;
        this.now = now;
    }
    async execute(plan, current, signal) {
        await validateReviewActionPlan(plan);
        if (current.repository !== plan.repository || current.number !== plan.number)
            throw new Error('Review plan pull request scope no longer matches');
        if (current.pullRequest.headSha !== plan.headSha)
            throw new Error('Review plan head SHA is stale');
        if (current.digest !== plan.snapshotDigest)
            throw new Error('Review plan snapshot digest is stale');
        const threads = new Map(current.reviewThreads.map(thread => [thread.id, thread]));
        const replies = [];
        const resolutions = [];
        const errors = [];
        for (const action of plan.actions) {
            const thread = threads.get(action.threadId);
            if (!thread || thread.resolved || thread.outdated || latestComment(thread).id !== action.latestCommentId)
                throw new Error(`Review thread precondition changed: ${action.threadId}`);
            try {
                if (action.action === 'reply' || action.action === 'reply-and-resolve') {
                    const comment = await this.provider.replyReviewThread(plan.repository, plan.number, action.threadId, action.replyBody, signal);
                    replies.push({ threadId: action.threadId, comment });
                }
                if (action.action === 'resolve' || action.action === 'reply-and-resolve') {
                    const resolution = await this.provider.resolveReviewThread(plan.repository, plan.number, action.threadId, signal);
                    resolutions.push({ threadId: action.threadId, resolvedAt: resolution.resolvedAt });
                }
            }
            catch (error) {
                errors.push(`${action.threadId}: ${errorMessage(error)}`);
                break;
            }
        }
        return { status: errors.length === 0 ? 'complete' : 'partial', planId: plan.planId, planDigest: plan.digest, replies, resolutions, completedAt: this.now(), errors };
    }
}
export async function validateReviewActionPlan(plan) {
    if (!isRecord(plan) || plan.schema !== REVIEW_PLAN_SCHEMA)
        throw new Error('Review action plan schema is invalid');
    validateId(plan.planId, 'planId');
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(plan.repository))
        throw new Error('Review plan repository is invalid');
    positiveInteger(plan.number, 'pull request number');
    if (!/^[a-f0-9]{40}$/.test(plan.headSha))
        throw new Error('Review plan head SHA is invalid');
    if (!/^[a-f0-9]{64}$/.test(plan.snapshotDigest) || !/^[a-f0-9]{64}$/.test(plan.digest))
        throw new Error('Review plan digest is invalid');
    if (!Number.isFinite(plan.createdAt) || plan.createdAt <= 0 || !Array.isArray(plan.actions) || plan.actions.length === 0)
        throw new Error('Review action plan is invalid');
    const computed = await reviewPlanDigest({ ...plan, digest: undefined });
    if (computed !== plan.digest)
        throw new Error('Review action plan digest does not match content');
}
function validateSnapshotScope(snapshot) {
    if (!isRecord(snapshot) || snapshot.pullRequest.state !== 'open')
        throw new Error('Review actions require an open pull request snapshot');
    if (snapshot.pullRequest.headSha.length !== 40 || snapshot.digest.length !== 64)
        throw new Error('Pull request lifecycle snapshot is invalid');
}
function latestComment(thread) {
    return thread.comments[thread.comments.length - 1];
}
function validateAction(value) {
    if (value !== 'reply' && value !== 'resolve' && value !== 'reply-and-resolve')
        throw new Error('Unsupported review action; dismiss and edit operations are not allowed');
    return value;
}
function validateId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$/.test(value))
        throw new Error(`${label} is invalid`);
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
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
//# sourceMappingURL=index.js.map