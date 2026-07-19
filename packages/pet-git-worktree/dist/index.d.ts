/** Isolated Git worktree session orchestration without arbitrary Git command execution. */
import { type RepositorySnapshot } from '@yk-pets/pet-repository-policy';
export declare const REPOSITORY_SESSION_SCHEMA: "yk-pets.repository-session/v1";
export type RepositorySessionState = 'open' | 'committed' | 'pushed' | 'closed' | 'expired' | 'failed';
export interface RepositoryInspection {
    repositoryId: string;
    projectId: string;
    defaultBranch: string;
    currentBranch: string | null;
    headRevision: string;
    bare: boolean;
    worktreeSupported: boolean;
}
export interface WorktreeCreateInput {
    repositoryId: string;
    projectId: string;
    worktreeId: string;
    branch: string;
    baseRevision: string;
}
export interface GitCommitAuthor {
    name: string;
    email: string;
}
export interface GitCommitInput {
    subject: string;
    body?: string;
    author?: GitCommitAuthor;
    expectedParentRevision: string;
}
export interface GitCommitResult {
    commitSha: string;
    treeSha: string;
    parentShas: string[];
    committedAt: number;
}
export interface GitPushInput {
    remote: string;
    branch: string;
    expectedCommitSha: string;
    setUpstream?: boolean;
}
export interface GitPushResult {
    remote: string;
    branch: string;
    commitSha: string;
    pushedAt: number;
    remoteUrl?: string;
}
export interface GitWorktreeAdapter {
    inspectRepository(repositoryId: string, signal?: AbortSignal): Promise<RepositoryInspection>;
    resolveRevision(repositoryId: string, ref: string, signal?: AbortSignal): Promise<string>;
    branchExists(repositoryId: string, branch: string, signal?: AbortSignal): Promise<boolean>;
    createWorktree(input: WorktreeCreateInput, signal?: AbortSignal): Promise<void>;
    removeWorktree(worktreeId: string, force?: boolean, signal?: AbortSignal): Promise<void>;
    getSnapshot(worktreeId: string, signal?: AbortSignal): Promise<RepositorySnapshot>;
    stagePaths(worktreeId: string, paths: string[], signal?: AbortSignal): Promise<void>;
    commit(worktreeId: string, input: GitCommitInput, signal?: AbortSignal): Promise<GitCommitResult>;
    push(worktreeId: string, input: GitPushInput, signal?: AbortSignal): Promise<GitPushResult>;
}
export interface OpenRepositorySessionInput {
    sessionId: string;
    repositoryId: string;
    projectId: string;
    baseRef: string;
    expectedBaseRevision: string;
    branch: string;
    ttlMs?: number;
}
export interface RepositorySession {
    schema: typeof REPOSITORY_SESSION_SCHEMA;
    sessionId: string;
    worktreeId: string;
    repositoryId: string;
    projectId: string;
    baseRef: string;
    baseRevision: string;
    branch: string;
    state: RepositorySessionState;
    openedAt: number;
    expiresAt: number;
    commit?: GitCommitResult;
    push?: GitPushResult;
    error?: string;
}
export interface GitWorktreeCoordinatorOptions {
    maxOpenSessions?: number;
    defaultTtlMs?: number;
    maxTtlMs?: number;
    allowedBaseRefs?: string[];
    now?: () => number;
    idFactory?: () => string;
}
export declare class GitWorktreeCoordinator {
    #private;
    readonly adapter: GitWorktreeAdapter;
    readonly maxOpenSessions: number;
    readonly defaultTtlMs: number;
    readonly maxTtlMs: number;
    readonly allowedBaseRefs: string[];
    readonly now: () => number;
    readonly idFactory: () => string;
    constructor(adapter: GitWorktreeAdapter, options?: GitWorktreeCoordinatorOptions);
    list(): RepositorySession[];
    get(sessionId: string): RepositorySession;
    open(input: OpenRepositorySessionInput, signal?: AbortSignal): Promise<RepositorySession>;
    snapshot(sessionId: string, signal?: AbortSignal): Promise<RepositorySnapshot>;
    stage(sessionId: string, paths: string[], signal?: AbortSignal): Promise<RepositorySnapshot>;
    commit(sessionId: string, input: Omit<GitCommitInput, 'expectedParentRevision'>, signal?: AbortSignal): Promise<GitCommitResult>;
    push(sessionId: string, input: Omit<GitPushInput, 'branch' | 'expectedCommitSha'>, signal?: AbortSignal): Promise<GitPushResult>;
    close(sessionId: string, options?: {
        force?: boolean;
    }, signal?: AbortSignal): Promise<RepositorySession>;
    dispose(): Promise<void>;
}
export declare function validateRepositorySession(value: RepositorySession): void;
//# sourceMappingURL=index.d.ts.map