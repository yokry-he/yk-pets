/** Controlled remote collaboration and release lifecycle orchestration. */
import { GitHubProvider, type GitHubMergeResult, type GitHubRetryResult, type MergeMethod } from '@yk-pets/pet-github-provider';
import type { GitWorktreeCoordinator, RepositorySession } from '@yk-pets/pet-git-worktree';
import { type MergeGateDecision, type MergeGatePolicy } from '@yk-pets/pet-merge-gate';
import { PullRequestSynchronizer, type PullRequestSyncResult } from '@yk-pets/pet-pr-lifecycle';
import { ReviewPlanExecutor, type ReviewActionPlan, type ReviewExecutionResult } from '@yk-pets/pet-review-governance';
import { type ApprovalReplayStore, type ApprovalTokenSigner } from '@yk-pets/pet-scope-approval';
export declare const REMOTE_APPROVAL_SCHEMA: "yk-pets.remote-approval/v1";
export type RemoteAction = 'retry-failed-checks' | 'apply-review-plan' | 'merge' | 'cleanup-after-merge';
export interface RemoteApprovalClaims {
    schema: typeof REMOTE_APPROVAL_SCHEMA;
    jti: string;
    subject: string;
    repository: string;
    number: number;
    headSha: string;
    snapshotDigest: string;
    action: RemoteAction;
    resourceDigest: string;
    mergeMethod?: MergeMethod;
    sessionId?: string;
    issuedAt: number;
    expiresAt: number;
    reason?: string;
}
export interface RemoteApprovalIssueRequest extends Omit<RemoteApprovalClaims, 'schema' | 'jti' | 'issuedAt' | 'expiresAt'> {
    ttlMs?: number;
    now?: number;
    jti?: string;
}
export interface RemoteAuthorizationRequest {
    token: string;
    subject: string;
    repository: string;
    number: number;
    headSha: string;
    snapshotDigest: string;
    action: RemoteAction;
    resourceDigest: string;
    mergeMethod?: MergeMethod;
    sessionId?: string;
    now?: number;
}
export declare class RemoteApprovalAuthority {
    readonly signer: ApprovalTokenSigner;
    readonly now: () => number;
    constructor(signer: ApprovalTokenSigner, now?: () => number);
    issue(request: RemoteApprovalIssueRequest): Promise<{
        token: string;
        claims: RemoteApprovalClaims;
    }>;
}
export declare class RemoteApprovalGate {
    readonly signer: ApprovalTokenSigner;
    readonly replay: ApprovalReplayStore;
    readonly now: () => number;
    readonly maxClockSkewMs: number;
    constructor(signer: ApprovalTokenSigner, options?: {
        replay?: ApprovalReplayStore;
        now?: () => number;
        maxClockSkewMs?: number;
    });
    authorize(request: RemoteAuthorizationRequest): Promise<RemoteApprovalClaims>;
}
export interface RemoteReleaseCoordinatorOptions {
    provider: GitHubProvider;
    synchronizer: PullRequestSynchronizer;
    approvals: RemoteApprovalGate;
    reviews?: ReviewPlanExecutor;
    worktrees?: GitWorktreeCoordinator;
    now?: () => number;
}
export interface RetryFailedChecksRequest {
    approvalToken: string;
    subject: string;
    repository: string;
    number: number;
    expectedHeadSha: string;
}
export interface ApplyReviewPlanRequest {
    approvalToken: string;
    subject: string;
    plan: ReviewActionPlan;
}
export interface MergePullRequestRequest {
    approvalToken: string;
    subject: string;
    repository: string;
    number: number;
    expectedHeadSha: string;
    method: MergeMethod;
    policy: MergeGatePolicy;
}
export interface CleanupAfterMergeRequest {
    approvalToken: string;
    subject: string;
    repository: string;
    number: number;
    expectedHeadSha: string;
    deleteBranch?: boolean;
    sessionId?: string;
    forceLocalCleanup?: boolean;
}
export interface CleanupAfterMergeResult {
    status: 'complete' | 'partial';
    branchDeleted: boolean;
    session?: RepositorySession;
    completedAt: number;
    errors: string[];
}
export declare class RemoteReleaseCoordinator {
    readonly provider: GitHubProvider;
    readonly synchronizer: PullRequestSynchronizer;
    readonly approvals: RemoteApprovalGate;
    readonly reviews: ReviewPlanExecutor;
    readonly worktrees?: GitWorktreeCoordinator;
    readonly now: () => number;
    constructor(options: RemoteReleaseCoordinatorOptions);
    sync(repository: string, number: number, expectedHeadSha?: string, signal?: AbortSignal): Promise<PullRequestSyncResult>;
    retryFailedChecks(request: RetryFailedChecksRequest, signal?: AbortSignal): Promise<{
        lifecycle: PullRequestSyncResult;
        retry: GitHubRetryResult;
        resourceDigest: string;
    }>;
    applyReviewPlan(request: ApplyReviewPlanRequest, signal?: AbortSignal): Promise<{
        lifecycle: PullRequestSyncResult;
        execution: ReviewExecutionResult;
    }>;
    merge(request: MergePullRequestRequest, signal?: AbortSignal): Promise<{
        lifecycle: PullRequestSyncResult;
        gate: MergeGateDecision;
        merge: GitHubMergeResult;
    }>;
    cleanupAfterMerge(request: CleanupAfterMergeRequest, signal?: AbortSignal): Promise<CleanupAfterMergeResult>;
}
export declare function cleanupResourceDigest(value: {
    branch: string;
    headSha: string;
    deleteBranch: boolean;
    sessionId?: string;
    forceLocalCleanup?: boolean;
}): Promise<string>;
export declare function encodeRemoteApprovalToken(claims: RemoteApprovalClaims, signer: ApprovalTokenSigner): Promise<string>;
export declare function decodeAndVerifyRemoteApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<RemoteApprovalClaims>;
export declare function validateRemoteApprovalClaims(value: unknown): asserts value is RemoteApprovalClaims;
//# sourceMappingURL=index.d.ts.map