/** Pull request review comment governance. */
import { GitHubProvider, type GitHubReviewComment } from '@yk-pets/pet-github-provider';
import { type PullRequestLifecycleSnapshot } from '@yk-pets/pet-pr-lifecycle';
export declare const REVIEW_PLAN_SCHEMA: "yk-pets.review-plan/v1";
export type ReviewActionType = 'reply' | 'resolve' | 'reply-and-resolve';
export interface ReviewActionDecision {
    threadId: string;
    action: ReviewActionType;
    replyBody?: string;
    reason?: string;
}
export interface ReviewPlanAction {
    threadId: string;
    action: ReviewActionType;
    replyBody?: string;
    reason?: string;
    path?: string;
    line?: number;
    latestCommentId: string;
}
export interface ReviewActionPlan {
    schema: typeof REVIEW_PLAN_SCHEMA;
    planId: string;
    repository: string;
    number: number;
    headSha: string;
    snapshotDigest: string;
    createdAt: number;
    actions: ReviewPlanAction[];
    digest: string;
}
export interface ReviewPlanPolicy {
    allowResolveWithoutReply?: boolean;
    maxActions?: number;
    maxReplyLength?: number;
}
export interface ReviewBlockerSummary {
    activeThreadIds: string[];
    changesRequestedBy: string[];
    approvedBy: string[];
    outdatedUnresolvedThreadIds: string[];
    blockerCount: number;
}
export interface ReviewExecutionResult {
    status: 'complete' | 'partial';
    planId: string;
    planDigest: string;
    replies: Array<{
        threadId: string;
        comment: GitHubReviewComment;
    }>;
    resolutions: Array<{
        threadId: string;
        resolvedAt: number;
    }>;
    completedAt: number;
    errors: string[];
}
export declare function createReviewActionPlan(snapshot: PullRequestLifecycleSnapshot, planId: string, decisions: ReviewActionDecision[], options?: ReviewPlanPolicy & {
    now?: number;
}): Promise<ReviewActionPlan>;
export declare function reviewPlanDigest(plan: Omit<ReviewActionPlan, 'digest'>): Promise<string>;
export declare function summarizeReviewBlockers(snapshot: PullRequestLifecycleSnapshot): ReviewBlockerSummary;
export declare class ReviewPlanExecutor {
    readonly provider: GitHubProvider;
    readonly now: () => number;
    constructor(provider: GitHubProvider, now?: () => number);
    execute(plan: ReviewActionPlan, current: PullRequestLifecycleSnapshot, signal?: AbortSignal): Promise<ReviewExecutionResult>;
}
export declare function validateReviewActionPlan(plan: ReviewActionPlan): Promise<void>;
//# sourceMappingURL=index.d.ts.map