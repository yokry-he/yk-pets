/** Conflict-safe file transactions and rollback journals for approved patch plans. */
import { type PatchPlan, type PatchPlanChange } from '@yk-pets/pet-patch-plan';
export type WorkspaceEntryKind = 'missing' | 'file' | 'directory' | 'symlink';
export type WorkspaceEntry = {
    path: string;
    kind: 'missing';
} | {
    path: string;
    kind: 'file';
    content: string;
    sha256: string;
    size: number;
} | {
    path: string;
    kind: 'directory' | 'symlink';
};
export type FileExpectation = {
    kind: 'missing';
} | {
    kind: 'file';
    sha256: string;
};
export interface WorkspaceAdapter {
    readonly projectId: string;
    read(path: string, signal?: AbortSignal): Promise<WorkspaceEntry>;
    write(path: string, content: string, expected: FileExpectation, signal?: AbortSignal): Promise<Extract<WorkspaceEntry, {
        kind: 'file';
    }>>;
    delete(path: string, expectedSha256: string, signal?: AbortSignal): Promise<void>;
    getRevision?(signal?: AbortSignal): Promise<string | undefined>;
}
export interface TransactionPreviewFile {
    changeId: string;
    operation: PatchPlanChange['operation'];
    path: string;
    role: 'primary' | 'move-source' | 'move-target';
    before: PublicWorkspaceEntry;
    after: PublicWorkspaceEntry;
}
export type PublicWorkspaceEntry = {
    kind: 'missing';
} | {
    kind: 'file';
    sha256: string;
    size: number;
} | {
    kind: 'directory' | 'symlink';
};
export interface FileTransactionPreview {
    planId: string;
    projectId: string;
    revisionBefore?: string;
    files: TransactionPreviewFile[];
    changedBytes: number;
}
export interface TransactionJournalEntry {
    sequence: number;
    changeId: string;
    path: string;
    primitive: 'write' | 'delete';
    before: WorkspaceEntry;
    after: WorkspaceEntry;
}
export type FileTransactionStatus = 'committed' | 'failed' | 'rolled-back' | 'rollback-failed';
export interface FileTransactionResult {
    transactionId: string;
    planId: string;
    projectId: string;
    status: FileTransactionStatus;
    startedAt: number;
    finishedAt: number;
    revisionBefore?: string;
    revisionAfter?: string;
    changedBytes: number;
    files: TransactionPreviewFile[];
    /** Sensitive: may contain complete source file contents needed for safe rollback. */
    journal: TransactionJournalEntry[];
    error?: string;
    rollbackErrors?: Array<{
        path: string;
        error: string;
    }>;
}
export interface PublicFileTransactionSummary extends Omit<FileTransactionResult, 'journal'> {
    journal: Array<{
        sequence: number;
        changeId: string;
        path: string;
        primitive: 'write' | 'delete';
        before: PublicWorkspaceEntry;
        after: PublicWorkspaceEntry;
    }>;
}
export declare class WorkspaceConflictError extends Error {
    readonly path: string;
    constructor(path: string, message: string);
}
export declare class FileTransactionExecutor {
    #private;
    readonly adapter: WorkspaceAdapter;
    readonly now: () => number;
    constructor(adapter: WorkspaceAdapter, now?: () => number);
    preview(plan: PatchPlan, signal?: AbortSignal): Promise<FileTransactionPreview>;
    apply(plan: PatchPlan, signal?: AbortSignal): Promise<FileTransactionResult>;
    rollback(receipt: FileTransactionResult, signal?: AbortSignal): Promise<FileTransactionResult>;
}
export declare class InMemoryWorkspaceAdapter implements WorkspaceAdapter {
    #private;
    readonly projectId: string;
    constructor(projectId: string, initial?: Record<string, string | {
        kind: 'directory' | 'symlink';
    }>, options?: {
        failure?: (input: {
            operation: 'write' | 'delete';
            path: string;
            count: number;
        }) => Error | undefined;
    });
    get mutationCount(): number;
    setFailure(failure: ((input: {
        operation: 'write' | 'delete';
        path: string;
        count: number;
    }) => Error | undefined) | undefined): void;
    simulateExternalWrite(path: string, content: string): void;
    read(path: string, signal?: AbortSignal): Promise<WorkspaceEntry>;
    write(path: string, content: string, expected: FileExpectation, signal?: AbortSignal): Promise<Extract<WorkspaceEntry, {
        kind: 'file';
    }>>;
    delete(path: string, expectedSha256: string, signal?: AbortSignal): Promise<void>;
    getRevision(signal?: AbortSignal): Promise<string>;
    files(): Promise<Record<string, string>>;
}
export declare function toPublicTransactionSummary(result: FileTransactionResult): PublicFileTransactionSummary;
//# sourceMappingURL=index.d.ts.map