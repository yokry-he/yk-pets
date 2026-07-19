/** Deterministic pull request merge eligibility gate. */
import type { MergeMethod } from '@yk-pets/pet-github-provider';
import { type PullRequestLifecycleSnapshot } from '@yk-pets/pet-pr-lifecycle';
export declare const MERGE_GATE_SCHEMA: "yk-pets.merge-gate/v1";
export type MergeGateStatus = 'eligible' | 'waiting' | 'blocked';
export type MergeGateSeverity = 'waiting' | 'blocked';
export interface MergeGateReason {
    code: string;
    severity: MergeGateSeverity;
    message: string;
    resourceIds?: string[];
}
export interface MergeGatePolicy {
    expectedHeadSha: string;
    baseBranch?: string;
    requiredCheckNames?: string[];
    minimumApprovals?: number;
    trustedApprovers?: string[];
    excludeAuthorApproval?: boolean;
    requireNoUnresolvedThreads?: boolean;
    allowSkippedRequiredChecks?: boolean;
    allowNeutralRequiredChecks?: boolean;
    allowedMergeMethods?: MergeMethod[];
    maxSnapshotAgeMs?: number;
}
export interface MergeGateDecision {
    schema: typeof MERGE_GATE_SCHEMA;
    repository: string;
    number: number;
    headSha: string;
    evaluatedAt: number;
    snapshotDigest: string;
    status: MergeGateStatus;
    eligibleMethods: MergeMethod[];
    approvals: string[];
    reasons: MergeGateReason[];
    digest: string;
}
export declare function evaluateMergeGate(snapshot: PullRequestLifecycleSnapshot, policy: MergeGatePolicy, now?: number): Promise<MergeGateDecision>;
export declare function mergeGateDigest(decision: Omit<MergeGateDecision, 'digest'>): Promise<string>;
export declare function assertMergeEligible(decision: MergeGateDecision, method: MergeMethod): void;
//# sourceMappingURL=index.d.ts.map