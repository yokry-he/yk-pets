/** Tamper-evident append-only records for controlled repository publishing. */
export declare const COMMIT_RECORD_SCHEMA: "yk-pets.commit-record/v1";
export declare const GENESIS_DIGEST: string;
export interface CommitIdentity {
    sha: string;
    treeSha: string;
    parentShas: string[];
    subject: string;
    committedAt: number;
}
export interface PushRecord {
    remote: string;
    branch: string;
    commitSha: string;
    pushedAt: number;
    remoteUrl?: string;
}
export interface DraftPullRequestRecord {
    provider: string;
    repository: string;
    baseBranch: string;
    headBranch: string;
    title: string;
    createdAt: number;
    number?: number;
    url?: string;
    externalId?: string;
}
export interface CommitRecordPayload {
    id: string;
    projectId: string;
    repositoryId: string;
    sessionId: string;
    planId: string;
    planDigest: string;
    approvalId: string;
    baseRevision: string;
    branch: string;
    commit: CommitIdentity;
    gateDigest: string;
    validationDigests: Record<string, string>;
    changedPaths: string[];
    push?: PushRecord;
    pullRequest?: DraftPullRequestRecord;
    metadata?: Record<string, string | number | boolean | null>;
}
export interface CommitLedgerEntry extends CommitRecordPayload {
    schema: typeof COMMIT_RECORD_SCHEMA;
    sequence: number;
    previousDigest: string;
    digest: string;
    recordedAt: number;
}
export interface CommitLedgerStore {
    list(projectId: string): Promise<CommitLedgerEntry[]> | CommitLedgerEntry[];
    append(projectId: string, entry: CommitLedgerEntry, expectedPreviousDigest: string): Promise<void> | void;
}
export interface CommitLedgerOptions {
    now?: () => number;
}
export declare class CommitLedger {
    readonly store: CommitLedgerStore;
    readonly now: () => number;
    constructor(store: CommitLedgerStore, options?: CommitLedgerOptions);
    list(projectId: string): Promise<CommitLedgerEntry[]>;
    append(payload: CommitRecordPayload): Promise<CommitLedgerEntry>;
}
export declare class MemoryCommitLedgerStore implements CommitLedgerStore {
    #private;
    list(projectId: string): CommitLedgerEntry[];
    append(projectId: string, entry: CommitLedgerEntry, expectedPreviousDigest: string): void;
    unsafeReplace(projectId: string, entries: CommitLedgerEntry[]): void;
}
export declare function verifyCommitLedger(entries: CommitLedgerEntry[], expectedProjectId?: string): Promise<void>;
export declare function validateCommitLedgerEntry(entry: CommitLedgerEntry): void;
export declare function computeCommitRecordPayloadDigest(payload: CommitRecordPayload): Promise<string>;
export declare function renderCommitLedgerMarkdown(entry: CommitLedgerEntry): string;
//# sourceMappingURL=index.d.ts.map