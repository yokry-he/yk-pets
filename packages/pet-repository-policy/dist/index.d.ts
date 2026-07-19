/** Fail-closed repository and pre-commit policy for controlled YK Pets changes. */
export declare const REPOSITORY_GATE_SCHEMA: "yk-pets.repository-gate/v1";
export type RepositoryChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked';
export type GateCheckStatus = 'passed' | 'failed' | 'warning';
export type ValidationStatus = 'passed' | 'failed' | 'skipped';
export type SecretSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface RepositoryChange {
    path: string;
    oldPath?: string;
    status: RepositoryChangeStatus;
    staged: boolean;
    bytesAdded?: number;
    bytesDeleted?: number;
}
export interface RepositorySnapshot {
    repositoryId: string;
    projectId: string;
    branch: string | null;
    headRevision: string;
    detached: boolean;
    clean: boolean;
    changes: RepositoryChange[];
}
export interface ValidationEvidence {
    id: string;
    status: ValidationStatus;
    summary: string;
    startedAt: number;
    completedAt: number;
    command?: string;
    artifactDigest?: string;
}
export interface SecretFinding {
    id: string;
    path: string;
    severity: SecretSeverity;
    rule: string;
    line?: number;
    redactedPreview?: string;
}
export interface CommitGatePolicy {
    allowedBranchPrefixes?: string[];
    protectedBranches?: string[];
    protectedPathPrefixes?: string[];
    allowedPathPrefixes?: string[];
    maxFiles?: number;
    maxChangedBytes?: number;
    maxCommitSubjectLength?: number;
    requireAllChangesStaged?: boolean;
    allowUntracked?: boolean;
    requireExactPathSet?: boolean;
    requiredValidationIds?: string[];
    failOnSecretSeverities?: SecretSeverity[];
    forbiddenCommitSubjectPatterns?: RegExp[];
}
export interface CommitGateInput {
    snapshot: RepositorySnapshot;
    expectedPaths: string[];
    expectedBaseRevision: string;
    commitSubject: string;
    validations?: ValidationEvidence[];
    secretFindings?: SecretFinding[];
    baselineClean?: boolean;
    policy?: CommitGatePolicy;
}
export interface CommitGateCheck {
    id: string;
    status: GateCheckStatus;
    message: string;
    paths?: string[];
}
export interface CommitGateDecision {
    schema: typeof REPOSITORY_GATE_SCHEMA;
    passed: boolean;
    repositoryId: string;
    projectId: string;
    branch: string | null;
    headRevision: string;
    expectedBaseRevision: string;
    commitSubject: string;
    changedPaths: string[];
    changedBytes: number;
    checks: CommitGateCheck[];
}
export declare function evaluateCommitGate(input: CommitGateInput): CommitGateDecision;
export declare function assertCommitGatePassed(decision: CommitGateDecision): void;
export declare function computeCommitGateDigest(decision: CommitGateDecision): Promise<string>;
export declare function createChangeBranchName(planId: string, summary: string, options?: {
    prefix?: string;
    maxLength?: number;
}): string;
export declare function validateBranchName(branch: string): string;
//# sourceMappingURL=index.d.ts.map