/** Strict local Git/worktree host. No arbitrary shell or dynamic Git subcommand execution. */
import type { WorkspaceAdapter } from '@yk-pets/pet-file-transaction';
import { type GitCommitInput, type GitCommitResult, type GitPushInput, type GitPushResult, type GitWorktreeAdapter, type RepositoryInspection, type WorktreeCreateInput } from '@yk-pets/pet-git-worktree';
import { type RepositorySnapshot } from '@yk-pets/pet-repository-policy';
export declare const REPOSITORY_HOST_CHANNEL: "yk-pets.repository-host/v1";
export interface LocalRepositoryProject {
    repositoryId: string;
    projectId: string;
    repositoryRoot: string;
    worktreeRoot: string;
    defaultBranch: string;
    allowedRemotes?: string[];
    /** Exact normalized remote URLs or local paths allowed for push. Empty means push is disabled. */
    allowedRemoteUrls?: string[];
}
export interface LocalGitRepositoryAdapterOptions {
    gitPath?: string;
    timeoutMs?: number;
    maxOutputBytes?: number;
    now?: () => number;
}
export type RepositoryHostCommand = {
    type: 'repository:inspect';
} | {
    type: 'repository:resolve-revision';
    ref: string;
} | {
    type: 'repository:branch-exists';
    branch: string;
} | {
    type: 'repository:create-worktree';
    input: WorktreeCreateInput;
} | {
    type: 'repository:remove-worktree';
    worktreeId: string;
    force?: boolean;
} | {
    type: 'repository:get-snapshot';
    worktreeId: string;
} | {
    type: 'repository:stage-paths';
    worktreeId: string;
    paths: string[];
} | {
    type: 'repository:commit';
    worktreeId: string;
    input: GitCommitInput;
} | {
    type: 'repository:push';
    worktreeId: string;
    input: GitPushInput;
};
export interface RepositoryHostRequest {
    channel: typeof REPOSITORY_HOST_CHANNEL;
    requestId: string;
    repositoryId: string;
    projectId: string;
    command: RepositoryHostCommand;
}
export type RepositoryHostResponse = {
    channel: typeof REPOSITORY_HOST_CHANNEL;
    requestId: string;
    ok: true;
    result: unknown;
} | {
    channel: typeof REPOSITORY_HOST_CHANNEL;
    requestId: string;
    ok: false;
    error: string;
};
export interface RepositoryHostContext {
    subject?: string;
    origin?: string;
    transport?: 'extension-background' | 'local-agent' | 'ci' | 'custom';
}
export interface RepositoryHostAuthorizationInput {
    requestId: string;
    repositoryId: string;
    projectId: string;
    command: RepositoryHostCommand;
    context: RepositoryHostContext;
}
export interface RepositoryHostTransport {
    send(request: RepositoryHostRequest, signal?: AbortSignal): Promise<unknown>;
}
export declare class LocalGitRepositoryAdapter implements GitWorktreeAdapter {
    #private;
    readonly gitPath: string;
    readonly timeoutMs: number;
    readonly maxOutputBytes: number;
    readonly now: () => number;
    constructor(projects: LocalRepositoryProject[], options?: LocalGitRepositoryAdapterOptions);
    inspectRepository(repositoryId: string, signal?: AbortSignal): Promise<RepositoryInspection>;
    resolveRevision(repositoryId: string, ref: string, signal?: AbortSignal): Promise<string>;
    branchExists(repositoryId: string, branch: string, signal?: AbortSignal): Promise<boolean>;
    createWorktree(input: WorktreeCreateInput, signal?: AbortSignal): Promise<void>;
    removeWorktree(worktreeId: string, force?: boolean, signal?: AbortSignal): Promise<void>;
    getSnapshot(worktreeId: string, signal?: AbortSignal): Promise<RepositorySnapshot>;
    stagePaths(worktreeId: string, paths: string[], signal?: AbortSignal): Promise<void>;
    commit(worktreeId: string, input: GitCommitInput, signal?: AbortSignal): Promise<GitCommitResult>;
    push(worktreeId: string, input: GitPushInput, signal?: AbortSignal): Promise<GitPushResult>;
    createWorkspaceAdapter(worktreeId: string): WorkspaceAdapter;
    worktreePathForTesting(worktreeId: string): string;
}
export declare class RepositoryRpcAdapter implements GitWorktreeAdapter {
    #private;
    readonly repositoryId: string;
    readonly projectId: string;
    readonly transport: RepositoryHostTransport;
    readonly timeoutMs: number;
    constructor(repositoryId: string, projectId: string, transport: RepositoryHostTransport, options?: {
        timeoutMs?: number;
    });
    inspectRepository(_repositoryId: string, signal?: AbortSignal): Promise<RepositoryInspection>;
    resolveRevision(_repositoryId: string, ref: string, signal?: AbortSignal): Promise<string>;
    branchExists(_repositoryId: string, branch: string, signal?: AbortSignal): Promise<boolean>;
    createWorktree(input: WorktreeCreateInput, signal?: AbortSignal): Promise<void>;
    removeWorktree(worktreeId: string, force?: boolean, signal?: AbortSignal): Promise<void>;
    getSnapshot(worktreeId: string, signal?: AbortSignal): Promise<RepositorySnapshot>;
    stagePaths(worktreeId: string, paths: string[], signal?: AbortSignal): Promise<void>;
    commit(worktreeId: string, input: GitCommitInput, signal?: AbortSignal): Promise<GitCommitResult>;
    push(worktreeId: string, input: GitPushInput, signal?: AbortSignal): Promise<GitPushResult>;
}
export declare function createRepositoryHostMessageHandler(adapter: GitWorktreeAdapter, options: {
    repositoryId: string;
    projectId: string;
    authorize(input: RepositoryHostAuthorizationInput): boolean | Promise<boolean>;
}): (message: unknown, context?: RepositoryHostContext) => Promise<RepositoryHostResponse>;
export declare function createLocalRepositoryTransport(handler: (request: RepositoryHostRequest, context?: RepositoryHostContext) => Promise<RepositoryHostResponse>, context?: RepositoryHostContext): RepositoryHostTransport;
//# sourceMappingURL=index.d.ts.map