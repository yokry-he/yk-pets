/** Strict repository-scoped GitHub collaboration provider. */
export declare const GITHUB_PROVIDER_SCHEMA: "yk-pets.github-provider/v1";
export type PullRequestState = 'open' | 'closed' | 'merged';
export type Mergeability = 'mergeable' | 'conflicting' | 'unknown';
export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion = 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped' | 'neutral' | 'action_required' | 'stale' | null;
export type ReviewState = 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending';
export type MergeMethod = 'merge' | 'squash' | 'rebase';
export interface GitHubPullRequest {
    repository: string;
    number: number;
    externalId: string;
    url: string;
    title: string;
    state: PullRequestState;
    draft: boolean;
    baseBranch: string;
    headBranch: string;
    baseSha: string;
    headSha: string;
    mergeability: Mergeability;
    author: string;
    createdAt: number;
    updatedAt: number;
    mergedAt?: number;
    closedAt?: number;
}
export interface GitHubCheckRun {
    id: string;
    name: string;
    status: CheckStatus;
    conclusion: CheckConclusion;
    required: boolean;
    app?: string;
    url?: string;
    startedAt?: number;
    completedAt?: number;
}
export interface GitHubReviewComment {
    id: string;
    author: string;
    body: string;
    createdAt: number;
    updatedAt?: number;
    url?: string;
}
export interface GitHubReviewThread {
    id: string;
    resolved: boolean;
    outdated: boolean;
    path?: string;
    line?: number;
    comments: GitHubReviewComment[];
}
export interface GitHubReview {
    id: string;
    author: string;
    state: ReviewState;
    submittedAt?: number;
    commitSha?: string;
}
export interface GitHubRetryResult {
    repository: string;
    number: number;
    headSha: string;
    checkIds: string[];
    acceptedAt: number;
}
export interface GitHubMergeResult {
    repository: string;
    number: number;
    headSha: string;
    mergeSha: string;
    method: MergeMethod;
    merged: true;
    mergedAt: number;
}
export interface GitHubCleanupResult {
    repository: string;
    resource: 'pull-request' | 'branch';
    identifier: string;
    completedAt: number;
}
export type GitHubProviderCommand = {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'pull-request:get';
    repository: string;
    number: number;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'checks:list';
    repository: string;
    number: number;
    headSha: string;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'review-threads:list';
    repository: string;
    number: number;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'reviews:list';
    repository: string;
    number: number;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'checks:rerun-failed';
    repository: string;
    number: number;
    expectedHeadSha: string;
    checkIds: string[];
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'review-thread:reply';
    repository: string;
    number: number;
    threadId: string;
    body: string;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'review-thread:resolve';
    repository: string;
    number: number;
    threadId: string;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'pull-request:merge';
    repository: string;
    number: number;
    expectedHeadSha: string;
    method: MergeMethod;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'pull-request:close';
    repository: string;
    number: number;
} | {
    schema: typeof GITHUB_PROVIDER_SCHEMA;
    type: 'branch:delete';
    repository: string;
    branch: string;
    expectedHeadSha: string;
};
export interface GitHubProviderInvoker {
    (command: GitHubProviderCommand, signal?: AbortSignal): Promise<unknown>;
}
export interface GitHubProviderOptions {
    allowedRepositories: string[];
    maxReviewBodyLength?: number;
    now?: () => number;
}
export declare class GitHubProvider {
    #private;
    readonly invoke: GitHubProviderInvoker;
    readonly allowedRepositories: Set<string>;
    readonly maxReviewBodyLength: number;
    readonly now: () => number;
    constructor(invoke: GitHubProviderInvoker, options: GitHubProviderOptions);
    getPullRequest(repository: string, number: number, signal?: AbortSignal): Promise<GitHubPullRequest>;
    listChecks(repository: string, number: number, headSha: string, signal?: AbortSignal): Promise<GitHubCheckRun[]>;
    listReviewThreads(repository: string, number: number, signal?: AbortSignal): Promise<GitHubReviewThread[]>;
    listReviews(repository: string, number: number, signal?: AbortSignal): Promise<GitHubReview[]>;
    rerunFailedChecks(repository: string, number: number, expectedHeadSha: string, checkIds: string[], signal?: AbortSignal): Promise<GitHubRetryResult>;
    replyReviewThread(repository: string, number: number, threadId: string, body: string, signal?: AbortSignal): Promise<GitHubReviewComment>;
    resolveReviewThread(repository: string, number: number, threadId: string, signal?: AbortSignal): Promise<{
        threadId: string;
        resolved: true;
        resolvedAt: number;
    }>;
    mergePullRequest(repository: string, number: number, expectedHeadSha: string, method: MergeMethod, signal?: AbortSignal): Promise<GitHubMergeResult>;
    closePullRequest(repository: string, number: number, signal?: AbortSignal): Promise<GitHubCleanupResult>;
    deleteBranch(repository: string, branch: string, expectedHeadSha: string, signal?: AbortSignal): Promise<GitHubCleanupResult>;
}
export declare function validateRepository(value: string): string;
export declare function validateBranch(value: string): string;
export declare function validateSha(value: string, label?: string): string;
//# sourceMappingURL=index.d.ts.map