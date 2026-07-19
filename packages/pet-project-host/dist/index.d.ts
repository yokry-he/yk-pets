/** Strict workspace RPC for extension Background and CI hosts. */
import { type FileExpectation, type WorkspaceAdapter, type WorkspaceEntry } from '@yk-pets/pet-file-transaction';
export declare const WORKSPACE_HOST_CHANNEL: "yk-pets.workspace-host/v1";
export type WorkspaceHostCommand = {
    type: 'workspace:get-revision';
} | {
    type: 'workspace:read';
    path: string;
} | {
    type: 'workspace:write';
    path: string;
    content: string;
    expected: FileExpectation;
} | {
    type: 'workspace:delete';
    path: string;
    expectedSha256: string;
};
export interface WorkspaceHostRequest {
    channel: typeof WORKSPACE_HOST_CHANNEL;
    requestId: string;
    projectId: string;
    command: WorkspaceHostCommand;
}
export type WorkspaceHostResponse = {
    channel: typeof WORKSPACE_HOST_CHANNEL;
    requestId: string;
    ok: true;
    result: unknown;
} | {
    channel: typeof WORKSPACE_HOST_CHANNEL;
    requestId: string;
    ok: false;
    error: string;
};
export interface WorkspaceHostRequestContext {
    subject?: string;
    origin?: string;
    transport?: 'extension-background' | 'ci' | 'custom';
}
export interface WorkspaceHostAuthorizationInput {
    requestId: string;
    projectId: string;
    command: WorkspaceHostCommand;
    context: WorkspaceHostRequestContext;
}
export interface WorkspaceHostHandlerOptions {
    authorize(input: WorkspaceHostAuthorizationInput): boolean | Promise<boolean>;
    maxContentBytes?: number;
}
export interface WorkspaceHostTransport {
    send(request: WorkspaceHostRequest, signal?: AbortSignal): Promise<unknown>;
}
export declare class WorkspaceRpcAdapter implements WorkspaceAdapter {
    #private;
    readonly projectId: string;
    readonly transport: WorkspaceHostTransport;
    readonly timeoutMs: number;
    readonly maxContentBytes: number;
    constructor(projectId: string, transport: WorkspaceHostTransport, options?: {
        timeoutMs?: number;
        maxContentBytes?: number;
    });
    read(path: string, signal?: AbortSignal): Promise<WorkspaceEntry>;
    write(path: string, content: string, expected: FileExpectation, signal?: AbortSignal): Promise<Extract<WorkspaceEntry, {
        kind: 'file';
    }>>;
    delete(path: string, expectedSha256: string, signal?: AbortSignal): Promise<void>;
    getRevision(signal?: AbortSignal): Promise<string | undefined>;
}
export declare function createWorkspaceHostMessageHandler(adapter: WorkspaceAdapter, options: WorkspaceHostHandlerOptions): (message: unknown, context?: WorkspaceHostRequestContext) => Promise<WorkspaceHostResponse>;
export declare function createChromeBackgroundWorkspaceTransport(sendMessage: (message: WorkspaceHostRequest) => Promise<unknown> | unknown): WorkspaceHostTransport;
export declare function createCiWorkspaceTransport(invoke: (request: WorkspaceHostRequest, signal?: AbortSignal) => Promise<unknown> | unknown): WorkspaceHostTransport;
export declare function validateWorkspaceHostRequest(value: unknown, maxContentBytes?: number): WorkspaceHostRequest;
//# sourceMappingURL=index.d.ts.map