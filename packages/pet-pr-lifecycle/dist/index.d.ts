/** Stable pull request lifecycle synchronization and change detection. */
import { GitHubProvider, type GitHubCheckRun, type GitHubPullRequest, type GitHubReview, type GitHubReviewThread } from '@yk-pets/pet-github-provider';
export declare const PR_LIFECYCLE_SCHEMA: "yk-pets.pr-lifecycle/v1";
export interface PullRequestLifecycleSummary {
    totalChecks: number;
    requiredChecks: number;
    successfulChecks: number;
    failedChecks: number;
    pendingChecks: number;
    unresolvedThreads: number;
    currentApprovals: number;
    currentChangesRequested: number;
}
export interface PullRequestLifecycleSnapshot {
    schema: typeof PR_LIFECYCLE_SCHEMA;
    repository: string;
    number: number;
    capturedAt: number;
    pullRequest: GitHubPullRequest;
    checks: GitHubCheckRun[];
    reviewThreads: GitHubReviewThread[];
    reviews: GitHubReview[];
    summary: PullRequestLifecycleSummary;
    digest: string;
}
export type PullRequestLifecycleEvent = {
    type: 'initial-snapshot';
    at: number;
} | {
    type: 'head-changed';
    previous: string;
    current: string;
    at: number;
} | {
    type: 'state-changed';
    previous: string;
    current: string;
    at: number;
} | {
    type: 'draft-changed';
    previous: boolean;
    current: boolean;
    at: number;
} | {
    type: 'check-changed';
    id: string;
    previous?: string;
    current?: string;
    at: number;
} | {
    type: 'thread-changed';
    id: string;
    previous?: string;
    current?: string;
    at: number;
} | {
    type: 'review-changed';
    author: string;
    previous?: string;
    current?: string;
    at: number;
};
export interface PullRequestSyncResult {
    snapshot: PullRequestLifecycleSnapshot;
    previous: PullRequestLifecycleSnapshot | null;
    events: PullRequestLifecycleEvent[];
    changed: boolean;
}
export interface PullRequestLifecycleStore {
    get(repository: string, number: number): Promise<PullRequestLifecycleSnapshot | null>;
    put(snapshot: PullRequestLifecycleSnapshot, expectedPreviousDigest?: string): Promise<void>;
}
export declare class MemoryPullRequestLifecycleStore implements PullRequestLifecycleStore {
    #private;
    get(repository: string, number: number): Promise<PullRequestLifecycleSnapshot | null>;
    put(snapshot: PullRequestLifecycleSnapshot, expectedPreviousDigest?: string): Promise<void>;
}
export interface PullRequestSynchronizerOptions {
    store?: PullRequestLifecycleStore;
    now?: () => number;
}
export declare class PullRequestSynchronizer {
    readonly provider: GitHubProvider;
    readonly store: PullRequestLifecycleStore;
    readonly now: () => number;
    constructor(provider: GitHubProvider, options?: PullRequestSynchronizerOptions);
    sync(repository: string, number: number, options?: {
        expectedHeadSha?: string;
        signal?: AbortSignal;
    }): Promise<PullRequestSyncResult>;
}
export declare function lifecycleDigest(value: Omit<PullRequestLifecycleSnapshot, 'schema' | 'repository' | 'number' | 'capturedAt' | 'digest'>): Promise<string>;
export declare function summarize(checks: GitHubCheckRun[], threads: GitHubReviewThread[], reviews: GitHubReview[], headSha: string): PullRequestLifecycleSummary;
export declare function latestReviewByAuthor(reviews: GitHubReview[], headSha?: string): Map<string, GitHubReview>;
export declare function diffLifecycle(previous: PullRequestLifecycleSnapshot | null, current: PullRequestLifecycleSnapshot): PullRequestLifecycleEvent[];
//# sourceMappingURL=index.d.ts.map