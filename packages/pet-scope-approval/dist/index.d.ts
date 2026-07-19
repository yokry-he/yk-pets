/** Signed, one-time approvals bound to an exact patch plan and narrow file scope. */
import { type PatchOperation, type PatchPlan } from '@yk-pets/pet-patch-plan';
export declare const SCOPE_APPROVAL_SCHEMA: "yk-pets.scope-approval/v1";
export type ApprovalPathScope = {
    kind: 'file';
    path: string;
    operations?: PatchOperation[];
} | {
    kind: 'directory';
    path: string;
    operations?: PatchOperation[];
};
export interface ScopeApprovalClaims {
    schema: typeof SCOPE_APPROVAL_SCHEMA;
    jti: string;
    subject: string;
    projectId: string;
    planId: string;
    planDigest: string;
    issuedAt: number;
    expiresAt: number;
    allowedOperations: PatchOperation[];
    pathScopes: ApprovalPathScope[];
    maxFiles: number;
    maxChangedBytes: number;
    origin?: string;
    baseRevision?: string;
    reason?: string;
}
export interface ScopeApprovalIssueRequest {
    subject: string;
    pathScopes: ApprovalPathScope[];
    allowedOperations?: PatchOperation[];
    ttlMs?: number;
    maxFiles?: number;
    maxChangedBytes?: number;
    origin?: string;
    baseRevision?: string;
    reason?: string;
    now?: number;
    jti?: string;
}
export interface ApprovalAuthorizationRequest {
    token: string;
    plan: PatchPlan;
    subject: string;
    projectId?: string;
    origin?: string;
    baseRevision?: string;
    actualChangedBytes?: number;
    now?: number;
}
export interface ApprovalTokenSigner {
    sign(data: Uint8Array): Promise<Uint8Array>;
    verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
}
export interface ApprovalReplayStore {
    consume(jti: string, expiresAt: number, now: number): Promise<boolean> | boolean;
    purge?(now: number): Promise<void> | void;
}
export declare class InMemoryApprovalReplayStore implements ApprovalReplayStore {
    #private;
    consume(jti: string, expiresAt: number, now: number): boolean;
    purge(now: number): void;
    get size(): number;
}
export declare class WebCryptoHmacApprovalSigner implements ApprovalTokenSigner {
    #private;
    constructor(secret: Uint8Array);
    sign(data: Uint8Array): Promise<Uint8Array>;
    verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
}
export declare class ScopeApprovalAuthority {
    readonly signer: ApprovalTokenSigner;
    readonly now: () => number;
    constructor(signer: ApprovalTokenSigner, now?: () => number);
    issue(plan: PatchPlan, request: ScopeApprovalIssueRequest): Promise<{
        token: string;
        claims: ScopeApprovalClaims;
    }>;
}
export declare class ScopeApprovalGate {
    readonly signer: ApprovalTokenSigner;
    readonly replay: ApprovalReplayStore;
    readonly now: () => number;
    readonly maxClockSkewMs: number;
    constructor(signer: ApprovalTokenSigner, options?: {
        replay?: ApprovalReplayStore;
        now?: () => number;
        maxClockSkewMs?: number;
    });
    authorize(request: ApprovalAuthorizationRequest): Promise<ScopeApprovalClaims>;
}
export declare function createExactPathScopes(plan: PatchPlan): ApprovalPathScope[];
export declare function encodeApprovalToken(claims: ScopeApprovalClaims, signer: ApprovalTokenSigner): Promise<string>;
export declare function decodeAndVerifyApprovalToken(token: string, signer: ApprovalTokenSigner): Promise<ScopeApprovalClaims>;
export declare function assertPlanWithinClaims(plan: PatchPlan, claims: ScopeApprovalClaims, actualChangedBytes?: number): void;
export declare function validateClaims(value: unknown): asserts value is ScopeApprovalClaims;
//# sourceMappingURL=index.d.ts.map