/** Approval-gated remediation execution with automatic rollback after verification failure. */
import { type FileTransactionPreview, type FileTransactionResult, type PublicFileTransactionSummary, FileTransactionExecutor } from '@yk-pets/pet-file-transaction';
import { type PatchPlan } from '@yk-pets/pet-patch-plan';
import { ScopeApprovalGate, type ScopeApprovalClaims } from '@yk-pets/pet-scope-approval';
export type RemediationStatus = 'previewed' | 'applied' | 'failed' | 'rolled-back' | 'rollback-failed';
export interface RemediationVerificationResult {
    passed: boolean;
    summary?: string;
    details?: unknown;
}
export interface RemediationVerificationContext {
    plan: PatchPlan;
    transaction: FileTransactionResult;
    signal: AbortSignal;
}
export interface RemediationRunRequest {
    plan: PatchPlan;
    subject: string;
    approvalToken?: string;
    origin?: string;
    dryRun?: boolean;
    signal?: AbortSignal;
}
export type RemediationStage = 'plan-validated' | 'preview-complete' | 'approval-authorized' | 'transaction-started' | 'transaction-committed' | 'transaction-failed' | 'verification-started' | 'verification-passed' | 'verification-failed' | 'rollback-started' | 'rollback-complete' | 'rollback-failed' | 'completed' | 'failed';
export interface RemediationAuditEvent {
    id: string;
    runId: string;
    at: number;
    stage: RemediationStage;
    planId: string;
    projectId: string;
    message: string;
}
export interface RemediationAuditSink {
    write(event: RemediationAuditEvent): void | Promise<void>;
}
export declare class MemoryRemediationAuditSink implements RemediationAuditSink {
    #private;
    write(event: RemediationAuditEvent): void;
    list(): RemediationAuditEvent[];
    clear(): void;
}
export interface RemediationRunnerOptions {
    approvals: ScopeApprovalGate;
    transactions: FileTransactionExecutor;
    verify?: (context: RemediationVerificationContext) => Promise<RemediationVerificationResult> | RemediationVerificationResult;
    verificationTimeoutMs?: number;
    audit?: RemediationAuditSink;
    now?: () => number;
}
export interface RemediationRunResult {
    runId: string;
    planId: string;
    projectId: string;
    planDigest?: string;
    status: RemediationStatus;
    startedAt: number;
    finishedAt: number;
    preview?: FileTransactionPreview;
    approval?: ScopeApprovalClaims;
    transaction?: FileTransactionResult;
    verification?: RemediationVerificationResult;
    error?: string;
    audit: RemediationAuditEvent[];
}
export interface PublicRemediationRunResult extends Omit<RemediationRunResult, 'transaction' | 'approval'> {
    approval?: Omit<ScopeApprovalClaims, 'jti'> & {
        jti: '[redacted]';
    };
    transaction?: PublicFileTransactionSummary;
}
export declare class RemediationRunner {
    readonly approvals: ScopeApprovalGate;
    readonly transactions: FileTransactionExecutor;
    readonly verify?: RemediationRunnerOptions['verify'];
    readonly verificationTimeoutMs: number;
    readonly audit: RemediationAuditSink;
    readonly now: () => number;
    constructor(options: RemediationRunnerOptions);
    execute(request: RemediationRunRequest): Promise<RemediationRunResult>;
}
export declare function toPublicRemediationResult(result: RemediationRunResult): PublicRemediationRunResult;
//# sourceMappingURL=index.d.ts.map