/**
 * 文件职责 / File responsibility
 * 定义 Agent 工具能力、权限策略、确认令牌、执行包装器和审计记录。
 * Defines agent tool capabilities, permission policies, confirmation tokens, execution wrappers, and audit records.
 */
export type ToolRisk = 'low' | 'medium' | 'high' | 'critical';
export type ToolSideEffect = 'none' | 'read' | 'write' | 'network' | 'execute';
export type ToolExecutionLocation = 'browser' | 'local-agent' | 'server';
export type ToolConfirmationMode = 'never' | 'once' | 'every-time';
export interface JsonSchema {
    type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    enum?: unknown[];
    additionalProperties?: boolean;
}
export interface ToolCapabilityDeclaration {
    id: string;
    version: string;
    title: string;
    description: string;
    scopes: string[];
    risk: ToolRisk;
    sideEffects: ToolSideEffect[];
    execution: ToolExecutionLocation;
    confirmation: ToolConfirmationMode;
    inputSchema?: JsonSchema;
    outputSchema?: JsonSchema;
    allowedOrigins?: string[];
    allowedProjectPatterns?: string[];
    timeoutMs?: number;
    audit?: boolean;
}
export interface PermissionGrant {
    id: string;
    subject: string;
    toolPattern: string;
    scopes: string[];
    origins?: string[];
    projects?: string[];
    expiresAt?: number;
    maxUses?: number;
    uses?: number;
    confirmation: 'prompt' | 'preapproved';
}
export interface PolicyRule {
    id: string;
    effect: 'allow' | 'deny';
    toolPattern: string;
    subjectPattern?: string;
    scopes?: string[];
    origins?: string[];
    projects?: string[];
    reason?: string;
}
export interface PolicyContext {
    subject: string;
    toolId: string;
    requestedScopes: string[];
    origin?: string;
    projectRoot?: string;
    now?: number;
    interactive?: boolean;
    confirmationToken?: string;
}
export interface PolicyDecision {
    allow: boolean;
    reason: string;
    requiresConfirmation: boolean;
    matchedGrantIds: string[];
    matchedRuleIds: string[];
    effectiveScopes: string[];
}
export interface AuditRecord {
    id: string;
    at: number;
    subject: string;
    toolId: string;
    decision: 'allow' | 'deny' | 'confirm';
    reason: string;
    scopes: string[];
    origin?: string;
    projectRoot?: string;
    durationMs?: number;
    success?: boolean;
    error?: string;
}
export declare class ToolCatalog {
    #private;
    register(declaration: ToolCapabilityDeclaration): void;
    replace(declaration: ToolCapabilityDeclaration): void;
    get(id: string): ToolCapabilityDeclaration | undefined;
    has(id: string): boolean;
    list(): ToolCapabilityDeclaration[];
}
export declare class PermissionStore {
    #private;
    grant(grant: PermissionGrant): void;
    revoke(id: string): boolean;
    list(): PermissionGrant[];
    matching(context: PolicyContext): PermissionGrant[];
    consume(ids: string[]): void;
}
export declare class ConfirmationBroker {
    #private;
    issue(input: {
        subject: string;
        toolId: string;
        scopes: string[];
        ttlMs?: number;
        uses?: number;
        now?: number;
    }): string;
    consume(token: string | undefined, context: PolicyContext): boolean;
}
export declare class MemoryAuditSink {
    #private;
    write(record: AuditRecord): void;
    list(): AuditRecord[];
    clear(): void;
}
export interface PolicyEngineOptions {
    rules?: PolicyRule[];
    grants?: PermissionStore;
    confirmations?: ConfirmationBroker;
    audit?: MemoryAuditSink;
    allowLowRiskReadWithoutGrant?: boolean;
}
export declare class PolicyEngine {
    #private;
    readonly catalog: ToolCatalog;
    readonly grants: PermissionStore;
    readonly confirmations: ConfirmationBroker;
    readonly audit: MemoryAuditSink;
    readonly rules: PolicyRule[];
    readonly allowLowRiskReadWithoutGrant: boolean;
    constructor(catalog: ToolCatalog, options?: PolicyEngineOptions);
    evaluate(context: PolicyContext): PolicyDecision;
}
export interface ToolInvocation<I = unknown> {
    context: PolicyContext;
    input: I;
}
export type ToolHandler<I = unknown, O = unknown> = (input: I, context: PolicyContext, signal: AbortSignal) => O | Promise<O>;
export declare class GovernedToolExecutor {
    readonly policy: PolicyEngine;
    constructor(policy: PolicyEngine);
    execute<I, O>(invocation: ToolInvocation<I>, handler: ToolHandler<I, O>): Promise<O>;
}
export declare class PolicyDeniedError extends Error {
    readonly requiresConfirmation: boolean;
    constructor(message: string, requiresConfirmation?: boolean);
}
export declare function createLocalAgentToolDeclarations(): ToolCapabilityDeclaration[];
export declare function validateToolDeclaration(tool: ToolCapabilityDeclaration): void;
export declare function validateJsonSchema(schema: JsonSchema | undefined, value: unknown, path?: string): string[];
export declare function wildcardMatch(pattern: string, value: string): boolean;
//# sourceMappingURL=index.d.ts.map