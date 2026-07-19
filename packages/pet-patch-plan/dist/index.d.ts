/** Safe, deterministic source patch planning primitives. */
export declare const PATCH_PLAN_SCHEMA: "yk-pets.patch-plan/v1";
export type PatchOperation = 'create' | 'update' | 'delete' | 'move';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface PatchPlanBaseChange {
    id: string;
    operation: PatchOperation;
    rationale?: string;
}
export interface CreateFileChange extends PatchPlanBaseChange {
    operation: 'create';
    path: string;
    content: string;
}
export interface TextEdit {
    start: number;
    end: number;
    replacement: string;
    expectedText?: string;
}
export interface UpdateFileChange extends PatchPlanBaseChange {
    operation: 'update';
    path: string;
    expectedSha256: string;
    edits: TextEdit[];
}
export interface DeleteFileChange extends PatchPlanBaseChange {
    operation: 'delete';
    path: string;
    expectedSha256: string;
}
export interface MoveFileChange extends PatchPlanBaseChange {
    operation: 'move';
    fromPath: string;
    toPath: string;
    expectedSha256: string;
}
export type PatchPlanChange = CreateFileChange | UpdateFileChange | DeleteFileChange | MoveFileChange;
export interface PatchVerificationIntent {
    commands?: string[];
    scenarios?: string[];
    required?: boolean;
}
export interface PatchPlan {
    schema: typeof PATCH_PLAN_SCHEMA;
    id: string;
    projectId: string;
    baseRevision?: string;
    createdAt: number;
    summary: string;
    changes: PatchPlanChange[];
    verification?: PatchVerificationIntent;
    metadata?: Record<string, JsonValue>;
}
export interface PatchPlanValidationOptions {
    maxChanges?: number;
    maxFileBytes?: number;
    maxPlanBytes?: number;
    protectedPrefixes?: string[];
}
export interface PatchPlanSummary {
    planId: string;
    projectId: string;
    operations: Record<PatchOperation, number>;
    touchedPaths: string[];
    estimatedChangedBytes: number;
}
export declare function validatePatchPlan(plan: PatchPlan, options?: PatchPlanValidationOptions): void;
export declare function normalizeProjectPath(input: string, options?: {
    allowTrailingSlash?: boolean;
}): string;
export declare function validateTextEdits(edits: TextEdit[], changeId?: string, maxReplacementBytes?: number): void;
export declare function applyTextEdits(original: string, edits: TextEdit[]): string;
export declare function touchedPaths(plan: PatchPlan): string[];
export declare function summarizePatchPlan(plan: PatchPlan): PatchPlanSummary;
export declare function computePatchPlanDigest(plan: PatchPlan): Promise<string>;
export declare function sha256Hex(value: string | Uint8Array): Promise<string>;
export declare function stableStringify(value: unknown): string;
//# sourceMappingURL=index.d.ts.map