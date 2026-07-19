/** Strict workspace RPC for extension Background and CI hosts. */
import { normalizeProjectPath } from '@yk-pets/pet-patch-plan';
import {} from '@yk-pets/pet-file-transaction';
export const WORKSPACE_HOST_CHANNEL = 'yk-pets.workspace-host/v1';
export class WorkspaceRpcAdapter {
    projectId;
    transport;
    timeoutMs;
    maxContentBytes;
    constructor(projectId, transport, options = {}) {
        this.projectId = boundedText(projectId, 'projectId', 200);
        this.transport = transport;
        this.timeoutMs = positiveInteger(options.timeoutMs ?? 10_000, 'timeoutMs');
        this.maxContentBytes = positiveInteger(options.maxContentBytes ?? 2_000_000, 'maxContentBytes');
    }
    async read(path, signal) {
        const normalized = normalizeProjectPath(path);
        return validateWorkspaceEntry(await this.#request({ type: 'workspace:read', path: normalized }, signal), normalized, this.maxContentBytes);
    }
    async write(path, content, expected, signal) {
        const normalized = normalizeProjectPath(path);
        if (typeof content !== 'string')
            throw new Error('Workspace write content must be a string');
        if (new TextEncoder().encode(content).byteLength > this.maxContentBytes)
            throw new Error('Workspace write content exceeds client limit');
        validateExpectation(expected);
        const entry = validateWorkspaceEntry(await this.#request({ type: 'workspace:write', path: normalized, content, expected }, signal), normalized, this.maxContentBytes);
        if (entry.kind !== 'file')
            throw new Error('Workspace host write did not return a file');
        return entry;
    }
    async delete(path, expectedSha256, signal) {
        const normalized = normalizeProjectPath(path);
        assertSha256(expectedSha256, 'expectedSha256');
        const result = await this.#request({ type: 'workspace:delete', path: normalized, expectedSha256 }, signal);
        if (!isRecord(result) || result.deleted !== true)
            throw new Error('Workspace host delete response is invalid');
    }
    async getRevision(signal) {
        const result = await this.#request({ type: 'workspace:get-revision' }, signal);
        if (!isRecord(result) || (result.revision !== undefined && typeof result.revision !== 'string'))
            throw new Error('Workspace host revision response is invalid');
        return result.revision;
    }
    async #request(command, signal) {
        throwIfAborted(signal);
        const request = {
            channel: WORKSPACE_HOST_CHANNEL,
            requestId: randomId(),
            projectId: this.projectId,
            command,
        };
        const raw = await runWithTimeout(childSignal => this.transport.send(request, childSignal), this.timeoutMs, signal);
        const response = validateResponse(raw, request.requestId);
        if (!response.ok)
            throw new Error(`Workspace host denied request: ${response.error}`);
        return response.result;
    }
}
export function createWorkspaceHostMessageHandler(adapter, options) {
    const maxContentBytes = positiveInteger(options.maxContentBytes ?? 2_000_000, 'maxContentBytes');
    return async (message, context = {}) => {
        let requestId = 'invalid';
        try {
            const request = validateRequest(message, maxContentBytes);
            requestId = request.requestId;
            if (request.projectId !== adapter.projectId)
                throw new Error('Project does not match workspace host');
            if (!await options.authorize({ requestId, projectId: request.projectId, command: clone(request.command), context: clone(context) })) {
                throw new Error('Workspace host authorization denied');
            }
            const result = await executeCommand(adapter, request.command);
            if (request.command.type === 'workspace:read' || request.command.type === 'workspace:write') {
                validateWorkspaceEntry(result, request.command.path, maxContentBytes);
            }
            return { channel: WORKSPACE_HOST_CHANNEL, requestId, ok: true, result };
        }
        catch (error) {
            return { channel: WORKSPACE_HOST_CHANNEL, requestId, ok: false, error: errorMessage(error) };
        }
    };
}
export function createChromeBackgroundWorkspaceTransport(sendMessage) {
    if (typeof sendMessage !== 'function')
        throw new Error('sendMessage must be a function');
    return { send: async (request) => sendMessage(clone(request)) };
}
export function createCiWorkspaceTransport(invoke) {
    if (typeof invoke !== 'function')
        throw new Error('CI invoke must be a function');
    return { send: async (request, signal) => invoke(clone(request), signal) };
}
export function validateWorkspaceHostRequest(value, maxContentBytes = 2_000_000) {
    return validateRequest(value, maxContentBytes);
}
async function executeCommand(adapter, command) {
    switch (command.type) {
        case 'workspace:get-revision': return { revision: await adapter.getRevision?.() };
        case 'workspace:read': return adapter.read(command.path);
        case 'workspace:write': return adapter.write(command.path, command.content, command.expected);
        case 'workspace:delete':
            await adapter.delete(command.path, command.expectedSha256);
            return { deleted: true };
    }
}
function validateRequest(value, maxContentBytes) {
    if (!isRecord(value) || value.channel !== WORKSPACE_HOST_CHANNEL)
        throw new Error('Workspace host channel is invalid');
    const requestId = boundedText(value.requestId, 'requestId', 200);
    const projectId = boundedText(value.projectId, 'projectId', 200);
    if (!isRecord(value.command) || typeof value.command.type !== 'string')
        throw new Error('Workspace host command is invalid');
    let command;
    switch (value.command.type) {
        case 'workspace:get-revision':
            command = { type: value.command.type };
            break;
        case 'workspace:read':
            command = { type: value.command.type, path: normalizeProjectPath(value.command.path) };
            break;
        case 'workspace:write': {
            const path = normalizeProjectPath(value.command.path);
            if (typeof value.command.content !== 'string')
                throw new Error('Workspace write content must be a string');
            if (new TextEncoder().encode(value.command.content).byteLength > maxContentBytes)
                throw new Error('Workspace write content exceeds host limit');
            validateExpectation(value.command.expected);
            command = { type: value.command.type, path, content: value.command.content, expected: clone(value.command.expected) };
            break;
        }
        case 'workspace:delete':
            assertSha256(value.command.expectedSha256, 'expectedSha256');
            command = { type: value.command.type, path: normalizeProjectPath(value.command.path), expectedSha256: value.command.expectedSha256 };
            break;
        default: throw new Error(`Unsupported workspace host command: ${value.command.type}`);
    }
    return { channel: WORKSPACE_HOST_CHANNEL, requestId, projectId, command };
}
function validateResponse(value, requestId) {
    if (!isRecord(value) || value.channel !== WORKSPACE_HOST_CHANNEL || value.requestId !== requestId || typeof value.ok !== 'boolean') {
        throw new Error('Workspace host response envelope is invalid');
    }
    if (value.ok)
        return { channel: WORKSPACE_HOST_CHANNEL, requestId, ok: true, result: value.result };
    if (typeof value.error !== 'string' || value.error.length === 0 || value.error.length > 2_000)
        throw new Error('Workspace host error response is invalid');
    return { channel: WORKSPACE_HOST_CHANNEL, requestId, ok: false, error: value.error };
}
function validateWorkspaceEntry(value, path, maxContentBytes) {
    if (!isRecord(value) || value.path !== path || !['missing', 'file', 'directory', 'symlink'].includes(value.kind))
        throw new Error('Workspace host file entry is invalid');
    if (value.kind === 'file') {
        if (typeof value.content !== 'string')
            throw new Error('Workspace host file content is invalid');
        if (new TextEncoder().encode(value.content).byteLength > maxContentBytes)
            throw new Error('Workspace host file content exceeds limit');
        assertSha256(value.sha256, 'file.sha256');
        if (!Number.isInteger(value.size) || value.size < 0)
            throw new Error('Workspace host file size is invalid');
        return { path, kind: 'file', content: value.content, sha256: value.sha256, size: value.size };
    }
    return { path, kind: value.kind };
}
function validateExpectation(value) {
    if (!isRecord(value) || (value.kind !== 'missing' && value.kind !== 'file'))
        throw new Error('File expectation is invalid');
    if (value.kind === 'file')
        assertSha256(value.sha256, 'expected.sha256');
}
async function runWithTimeout(operation, timeoutMs, signal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(`Workspace host request timed out after ${timeoutMs}ms`);
            controller.abort(error);
            reject(error);
        }, timeoutMs);
    });
    const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Workspace host request aborted')), { once: true }));
    try {
        return await Promise.race([operation(controller.signal), timeout, aborted]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }
}
function throwIfAborted(signal) {
    if (signal?.aborted)
        throw signal.reason instanceof Error ? signal.reason : new Error('Workspace host request aborted');
}
function randomId() {
    if (typeof globalThis.crypto?.randomUUID === 'function')
        return globalThis.crypto.randomUUID();
    return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function assertSha256(value, label) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
        throw new Error(`${label} is invalid`);
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function positiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer`);
    return value;
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
//# sourceMappingURL=index.js.map