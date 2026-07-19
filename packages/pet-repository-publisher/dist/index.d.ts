/** Controlled staging, commit, push, draft pull request, and ledger orchestration. */
import { CommitLedger, type CommitLedgerEntry } from '@yk-pets/pet-commit-ledger';
import { GitWorktreeCoordinator, type GitCommitAuthor, type GitCommitResult, type GitPushResult } from '@yk-pets/pet-git-worktree';
import { type CommitGateDecision, type CommitGatePolicy, type SecretFinding, type ValidationEvidence } from '@yk-pets/pet-repository-policy';
import { type ApprovalReplayStore, type ApprovalTokenSigner } from '@yk-pets/pet-scope-approval';
export declare const PUBLISH_APPROVAL_SCHEMA: "yk-pets.publish-approval/v1";
export type PublishAction = 'commit' | 'push' | 'pr-draft';
export interface PublishApprovalClaims {
    schema: typeof PUBLISH_APPROVAL_SCHEMA;
    jti: string;
    subject: string;
    projectId: string;
    repositoryId: string;
    sessionId: string;
    planId: string;
    planDigest: string;
    baseRevision: string;
    branch: string;
    commitSubject: string;
    actions: PublishAction[];
    remote?: string;
    pullRequestRepository?: string;
    pullRequestBaseBranch?: string;
    issuedAt: number;
    expiresAt: number;
    reason?: string;
}
export interface PublishApprovalIssueRequest extends Omit<PublishApprovalClaims, 'schema' | 'jti' | 'issuedAt' | 'expiresAt'> {
    ttlMs?: number;
    now?: number;
    jti?: string;
}
export interface PublishAuthorizationRequest {
    token: string;
    subject: string;
    projectId: string;
    repositoryId: string;
    sessionId: string;
    planId: string;
    planDigest: string;
    baseRevision: string;
    branch: string;
    commitSubject: string;
    actions: PublishAction[];
    remote?: string;
    pullRequestRepository?: string;
    pullRequestBaseBranch?: string;
    now?: number;
}
export interface PullRequestDraftRequest {
    provider: string;
    repository: string;
    title: string;
    body: string;
    baseBranch: string;
    headBranch: string;
    expectedCommitSha: string;
    draft: true;
}
export interface PullRequestDraftResult {
    provider: string;
    repository: string;
    baseBranch: string;
    headBranch: string;
    title: string;
    createdAt: number;
    draft: true;
    number?: number;
    url?: string;
    externalId?: string;
}
export interface PullRequestDraftAdapter {
    createDraft(request: PullRequestDraftRequest, signal?: AbortSignal): Promise<PullRequestDraftResult>;
}
export interface GitHubDraftPullRequestInvoker {
    (input: {
        repositoryFullName: string;
        title: string;
        body: string;
        head: string;
        base: string;
        draft: true;
        expectedCommitSha: string;
    }, signal?: AbortSignal): Promise<{
        repositoryFullName?: string;
        number?: number;
        url?: string;
        externalId?: string;
        createdAt?: number;
        draft?: boolean;
        head?: string;
        base?: string;
        title?: string;
    }>;
}
export declare function createGitHubDraftPullRequestAdapter(invoke: GitHubDraftPullRequestInvoker, now?: () => number): PullRequestDraftAdapter;
export interface RepositoryPublishRequest {
    approvalToken: string;
    subject: string;
    sessionId: string;
    planId: string;
    planDigest: string;
    approvalId: string;
    expectedPaths: string[];
    commitSubject: string;
    commitBody?: string;
    author?: GitCommitAuthor;
    validations?: ValidationEvidence[];
    secretFindings?: SecretFinding[];
    gatePolicy?: CommitGatePolicy;
    push?: {
        remote: string;
        setUpstream?: boolean;
    };
    pullRequest?: {
        provider: string;
        repository: string;
        baseBranch: string;
        title?: string;
        body: string;
    };
    metadata?: Record<string, string | number | boolean | null>;
}
export interface RepositoryPublishResult {
    status: 'committed' | 'pushed' | 'draft-created' | 'partial';
    commit: GitCommitResult;
    push?: GitPushResult;
    pullRequest?: PullRequestDraftResult;
    gate: CommitGateDecision;
    ledger: CommitLedgerEntry;
    error?: string;
}
export declare class PublishApprovalAuthority {
    readonly signer: ApprovalTokenSigner;
    readonly now: () => number;
    constructor(signer: ApprovalTokenSigner, now?: () => number);
    issue(request: PublishApprovalIssueRequest): Promise<{
        token: string;
        claims: PublishApprovalClaims;
    }>;
}
export declare class PublishApprovalGate {
    readonly signer: ApprovalTokenSigner;
    readonly replay: ApprovalReplayStore;
    readonly now: () => number;
    readonly maxClockSkewMs: number;
    constructor(signer: ApprovalTokenSigner, options?: {
        replay?: ApprovalReplayStore;
        now?: () => number;
        maxClockSkewMs?: number;
    });
    authorize(request: PublishAuthorizationRequest): Promise<PublishApprovalClaims>;
}
export declare class RepositoryPublisher {
    readonly worktrees: GitWorktreeCoordinator;
    readonly approvals: PublishApprovalGate;
    readonly ledger: CommitLedger;
    readonly pullRequests?: PullRequestDraftAdapter;
    readonly idFactory: () => string;
    constructor(options: {
        worktrees: GitWorktreeCoordinator;
        approvals: PublishApprovalGate;
        ledger: CommitLedger;
        pullRequests?: PullRequestDraftAdapter;
        idFactory?: () => string;
    });
    publish(request: RepositoryPublishRequest, signal?: AbortSignal): Promise<RepositoryPublishResult>;
}
export declare function encodePublishApprovalToken(claims: PublishApprovalClaims, signer: ApprovalTokenSigner): Promise<string>;
export declare function decodeAndVerifyPublishApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<PublishApprovalClaims>;
export declare function validatePublishClaims(value: unknown): asserts value is PublishApprovalClaims;
//# sourceMappingURL=index.d.ts.map