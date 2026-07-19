/** Strict local Git/worktree host. No arbitrary shell or dynamic Git subcommand execution. */
import { spawn } from 'node:child_process';
import { access, lstat, mkdir, open, readFile, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {} from '@yk-pets/pet-git-worktree';
import { normalizeProjectPath, sha256Hex } from '@yk-pets/pet-patch-plan';
import { validateBranchName } from '@yk-pets/pet-repository-policy';
export const REPOSITORY_HOST_CHANNEL = 'yk-pets.repository-host/v1';
const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;
const REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
export class LocalGitRepositoryAdapter {
    gitPath;
    timeoutMs;
    maxOutputBytes;
    now;
    #projects = new Map();
    #resolvedProjects = new Map();
    #safeProjects = new Map();
    #worktrees = new Map();
    constructor(projects, options = {}) {
        if (!Array.isArray(projects) || projects.length === 0)
            throw new Error('At least one local repository project is required');
        this.gitPath = validateExecutable(options.gitPath ?? 'git');
        this.timeoutMs = positiveInteger(options.timeoutMs ?? 30_000, 'timeoutMs');
        this.maxOutputBytes = positiveInteger(options.maxOutputBytes ?? 2_000_000, 'maxOutputBytes');
        this.now = options.now ?? Date.now;
        for (const project of projects) {
            validateProjectConfig(project);
            if (this.#projects.has(project.repositoryId))
                throw new Error(`Duplicate repositoryId: ${project.repositoryId}`);
            this.#projects.set(project.repositoryId, clone(project));
        }
    }
    async inspectRepository(repositoryId, signal) {
        const project = await this.#project(repositoryId);
        const root = (await this.#git(project.repositoryRoot, ['rev-parse', '--show-toplevel'], signal)).stdout.trim();
        if (await realpath(root) !== project.repositoryRoot)
            throw new Error('Configured repository root does not match Git top-level');
        const bare = (await this.#git(project.repositoryRoot, ['rev-parse', '--is-bare-repository'], signal)).stdout.trim() === 'true';
        const headRevision = validateSha((await this.#git(project.repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).stdout.trim(), 'HEAD');
        const branchResult = await this.#git(project.repositoryRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal, [0, 1]);
        const currentBranch = branchResult.code === 0 ? validateBranchName(branchResult.stdout.trim()) : null;
        return {
            repositoryId: project.repositoryId,
            projectId: project.projectId,
            defaultBranch: project.defaultBranch,
            currentBranch,
            headRevision,
            bare,
            worktreeSupported: !bare,
        };
    }
    async resolveRevision(repositoryId, ref, signal) {
        const project = await this.#project(repositoryId);
        const validRef = validateRef(ref);
        return validateSha((await this.#git(project.repositoryRoot, ['rev-parse', '--verify', `${validRef}^{commit}`], signal)).stdout.trim(), 'resolved revision');
    }
    async branchExists(repositoryId, branch, signal) {
        const project = await this.#project(repositoryId);
        const validBranch = validateBranchName(branch);
        const result = await this.#git(project.repositoryRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${validBranch}`], signal, [0, 1]);
        return result.code === 0;
    }
    async createWorktree(input, signal) {
        validateWorktreeInput(input);
        if (this.#worktrees.has(input.worktreeId))
            throw new Error(`Worktree already registered: ${input.worktreeId}`);
        const project = await this.#project(input.repositoryId);
        if (project.projectId !== input.projectId)
            throw new Error('Worktree projectId does not match repository configuration');
        const target = containedPath(project.worktreeRoot, input.worktreeId);
        if (await pathExists(target))
            throw new Error(`Worktree target already exists: ${input.worktreeId}`);
        const resolved = await this.resolveRevision(input.repositoryId, input.baseRevision, signal);
        if (resolved !== input.baseRevision)
            throw new Error('Worktree base revision is not exact');
        if (await this.branchExists(input.repositoryId, input.branch, signal))
            throw new Error(`Branch already exists: ${input.branch}`);
        await this.#git(project.repositoryRoot, ['worktree', 'add', '--no-track', '-b', input.branch, target, input.baseRevision], signal);
        const actualRoot = await realpath(target);
        assertContained(project.worktreeRoot, actualRoot);
        this.#worktrees.set(input.worktreeId, { worktreeId: input.worktreeId, project, path: actualRoot, branch: input.branch });
    }
    async removeWorktree(worktreeId, force = false, signal) {
        const id = validateId(worktreeId, 'worktreeId');
        const registration = this.#worktrees.get(id);
        if (!registration)
            return;
        const args = ['worktree', 'remove'];
        if (force)
            args.push('--force');
        args.push(registration.path);
        const result = await this.#git(registration.project.repositoryRoot, args, signal, force ? [0, 128] : [0]);
        if (result.code !== 0 && !/is not a working tree|does not exist/i.test(result.stderr))
            throw new Error(`Git worktree removal failed: ${redact(result.stderr)}`);
        if (force)
            await rm(registration.path, { recursive: true, force: true });
        await this.#git(registration.project.repositoryRoot, ['worktree', 'prune'], signal);
        this.#worktrees.delete(id);
    }
    async getSnapshot(worktreeId, signal) {
        const registration = this.#registration(worktreeId);
        const branchResult = await this.#git(registration.path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal, [0, 1]);
        const branch = branchResult.code === 0 ? validateBranchName(branchResult.stdout.trim()) : null;
        const headRevision = validateSha((await this.#git(registration.path, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).stdout.trim(), 'worktree HEAD');
        const statusRaw = (await this.#git(registration.path, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], signal)).stdout;
        const changes = parsePorcelainStatus(statusRaw);
        await this.#populateChangeSizes(registration, changes, signal);
        return {
            repositoryId: registration.project.repositoryId,
            projectId: registration.project.projectId,
            branch,
            headRevision,
            detached: branch === null,
            clean: changes.length === 0,
            changes,
        };
    }
    async stagePaths(worktreeId, paths, signal) {
        const registration = this.#registration(worktreeId);
        const normalized = normalizeUniquePaths(paths);
        await this.#git(registration.path, ['add', '-A', '--', ...normalized], signal);
    }
    async commit(worktreeId, input, signal) {
        const registration = this.#registration(worktreeId);
        validateCommitInput(input);
        const headBefore = validateSha((await this.#git(registration.path, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).stdout.trim(), 'commit parent');
        if (headBefore !== input.expectedParentRevision)
            throw new Error('Commit parent revision changed before commit');
        const branch = (await this.#git(registration.path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal)).stdout.trim();
        if (branch !== registration.branch)
            throw new Error('Worktree branch changed before commit');
        const staged = await this.#git(registration.path, ['diff', '--cached', '--quiet', '--exit-code'], signal, [0, 1]);
        if (staged.code === 0)
            throw new Error('No staged changes are available to commit');
        const args = ['commit', '--no-gpg-sign', '--no-verify', '-m', input.subject];
        if (input.body)
            args.push('-m', input.body);
        if (input.author)
            args.push(`--author=${input.author.name} <${input.author.email}>`);
        await this.#git(registration.path, args, signal);
        const commitSha = validateSha((await this.#git(registration.path, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).stdout.trim(), 'created commit');
        const treeSha = validateSha((await this.#git(registration.path, ['rev-parse', '--verify', 'HEAD^{tree}'], signal)).stdout.trim(), 'created tree');
        const revisionLine = (await this.#git(registration.path, ['rev-list', '--parents', '-n', '1', 'HEAD'], signal)).stdout.trim().split(/\s+/);
        const parentShas = revisionLine.slice(1).map((sha, index) => validateSha(sha, `parent ${index}`));
        if (parentShas[0] !== input.expectedParentRevision)
            throw new Error('Created commit does not descend from expected parent');
        const timestamp = (await this.#git(registration.path, ['show', '-s', '--format=%cI', 'HEAD'], signal)).stdout.trim();
        const committedAt = Date.parse(timestamp);
        if (!Number.isFinite(committedAt) || committedAt <= 0)
            throw new Error('Git returned an invalid commit timestamp');
        return { commitSha, treeSha, parentShas, committedAt };
    }
    async push(worktreeId, input, signal) {
        const registration = this.#registration(worktreeId);
        validatePushInput(input);
        if (!registration.project.allowedRemotes.includes(input.remote))
            throw new Error(`Remote is not allowed: ${input.remote}`);
        if (input.branch !== registration.branch)
            throw new Error('Push branch does not match the worktree branch');
        const head = validateSha((await this.#git(registration.path, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).stdout.trim(), 'push HEAD');
        if (head !== input.expectedCommitSha)
            throw new Error('Push commit no longer matches worktree HEAD');
        const rawUrl = (await this.#git(registration.path, ['remote', 'get-url', input.remote], signal)).stdout.trim();
        const normalizedUrl = await normalizeRemoteUrl(rawUrl, registration.project.repositoryRoot);
        if (registration.project.allowedRemoteUrls.length === 0 || !registration.project.allowedRemoteUrls.includes(normalizedUrl)) {
            throw new Error('Remote URL is not explicitly allowlisted');
        }
        const args = ['push', '--porcelain'];
        if (input.setUpstream)
            args.push('--set-upstream');
        args.push(input.remote, `HEAD:refs/heads/${input.branch}`);
        await this.#git(registration.path, args, signal);
        return { remote: input.remote, branch: input.branch, commitSha: head, pushedAt: this.now(), remoteUrl: redactUrl(normalizedUrl) };
    }
    createWorkspaceAdapter(worktreeId) {
        return new LocalWorktreeWorkspaceAdapter(this.#registration(worktreeId), () => this.getSnapshot(worktreeId));
    }
    worktreePathForTesting(worktreeId) {
        return this.#registration(worktreeId).path;
    }
    #registration(worktreeId) {
        const id = validateId(worktreeId, 'worktreeId');
        const registration = this.#worktrees.get(id);
        if (!registration)
            throw new Error(`Unknown local worktree: ${id}`);
        return registration;
    }
    async #project(repositoryId) {
        const id = boundedText(repositoryId, 'repositoryId', 200);
        const config = this.#projects.get(id);
        if (!config)
            throw new Error(`Unknown local repository: ${id}`);
        let promise = this.#resolvedProjects.get(id);
        if (!promise) {
            promise = resolveProject(config);
            this.#resolvedProjects.set(id, promise);
        }
        const project = await promise;
        let safety = this.#safeProjects.get(id);
        if (!safety) {
            safety = this.#assertSafeRepositoryConfig(project);
            this.#safeProjects.set(id, safety);
        }
        await safety;
        return project;
    }
    async #assertSafeRepositoryConfig(project, signal) {
        const pattern = '^(alias\.|include\.|includeIf\.|filter\..*\.(clean|smudge|process|required)$|core\.(hookspath|fsmonitor|sshcommand|gitproxy)$|diff\.external$|diff\..*\.command$|merge\..*\.driver$|credential\.helper$|http\..*\.extraheader$|url\..*\.(insteadof|pushinsteadof)$)';
        const result = await this.#git(project.repositoryRoot, ['config', '--local', '--name-only', '--get-regexp', pattern], signal, [0, 1]);
        const unsafe = result.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (unsafe.length)
            throw new Error(`Repository contains executable or redirecting Git config: ${unsafe.join(', ')}`);
    }
    async #populateChangeSizes(registration, changes, signal) {
        for (const change of changes) {
            throwIfAborted(signal);
            if (change.status !== 'deleted') {
                try {
                    const target = containedPath(registration.path, change.path);
                    const stat = await lstat(target);
                    change.bytesAdded = Number.isFinite(stat.size) && stat.size >= 0 ? stat.size : 0;
                }
                catch (error) {
                    if (!isNotFound(error))
                        throw error;
                    change.bytesAdded = 0;
                }
            }
            const oldPath = change.oldPath ?? change.path;
            if (change.status !== 'added' && change.status !== 'untracked') {
                const size = await this.#git(registration.path, ['cat-file', '-s', `HEAD:${oldPath}`], signal, [0, 128]);
                change.bytesDeleted = size.code === 0 ? Number.parseInt(size.stdout.trim(), 10) : 0;
                if (!Number.isFinite(change.bytesDeleted) || change.bytesDeleted < 0)
                    change.bytesDeleted = 0;
            }
        }
    }
    async #git(cwd, args, signal, allowedExitCodes = [0]) {
        if (!Array.isArray(args) || args.length === 0 || args.some(arg => typeof arg !== 'string' || arg.includes('\u0000')))
            throw new Error('Git argument vector is invalid');
        throwIfAborted(signal);
        const result = await runProcess(this.gitPath, args, cwd, { timeoutMs: this.timeoutMs, maxOutputBytes: this.maxOutputBytes, signal });
        if (!allowedExitCodes.includes(result.code)) {
            throw new Error(`Git command failed (${args[0]}): ${redact(result.stderr || result.stdout || `exit ${result.code}`)}`);
        }
        return result;
    }
}
class LocalWorktreeWorkspaceAdapter {
    projectId;
    registration;
    getSnapshot;
    constructor(registration, getSnapshot) {
        this.registration = registration;
        this.projectId = registration.project.projectId;
        this.getSnapshot = getSnapshot;
    }
    async read(path, signal) {
        throwIfAborted(signal);
        const normalized = normalizeProjectPath(path);
        const target = await secureTarget(this.registration.path, normalized, { allowMissingLeaf: true });
        try {
            const stat = await lstat(target);
            if (stat.isSymbolicLink())
                return { path: normalized, kind: 'symlink' };
            if (stat.isDirectory())
                return { path: normalized, kind: 'directory' };
            if (!stat.isFile())
                throw new Error(`${normalized}: unsupported filesystem entry`);
            const content = await readFile(target, 'utf8');
            return { path: normalized, kind: 'file', content, sha256: await sha256Hex(content), size: new TextEncoder().encode(content).byteLength };
        }
        catch (error) {
            if (isNotFound(error))
                return { path: normalized, kind: 'missing' };
            throw error;
        }
    }
    async write(path, content, expected, signal) {
        throwIfAborted(signal);
        if (typeof content !== 'string')
            throw new Error('Workspace content must be a string');
        const normalized = normalizeProjectPath(path);
        const before = await this.read(normalized, signal);
        assertExpectation(normalized, before, expected);
        const target = await secureTarget(this.registration.path, normalized, { allowMissingLeaf: true, createParents: true });
        const temporary = `${target}.yk-pets-tmp-${crypto.randomUUID()}`;
        await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        try {
            const current = await this.read(normalized, signal);
            assertExpectation(normalized, current, expected);
            if (current.kind === 'directory' || current.kind === 'symlink')
                throw new Error(`${normalized}: expected regular file or missing path`);
            await rename(temporary, target);
        }
        catch (error) {
            await rm(temporary, { force: true });
            throw error;
        }
        const after = await this.read(normalized, signal);
        if (after.kind !== 'file')
            throw new Error(`${normalized}: write did not create a regular file`);
        return after;
    }
    async delete(path, expectedSha256, signal) {
        throwIfAborted(signal);
        validateSha256(expectedSha256, 'expectedSha256');
        const normalized = normalizeProjectPath(path);
        const before = await this.read(normalized, signal);
        if (before.kind !== 'file')
            throw new Error(`${normalized}: expected regular file for delete`);
        if (before.sha256 !== expectedSha256)
            throw new Error(`${normalized}: SHA-256 mismatch`);
        const target = await secureTarget(this.registration.path, normalized);
        const current = await this.read(normalized, signal);
        if (current.kind !== 'file' || current.sha256 !== expectedSha256)
            throw new Error(`${normalized}: changed before delete`);
        await unlink(target);
    }
    async getRevision(signal) {
        throwIfAborted(signal);
        return (await this.getSnapshot()).headRevision;
    }
}
export class RepositoryRpcAdapter {
    repositoryId;
    projectId;
    transport;
    timeoutMs;
    constructor(repositoryId, projectId, transport, options = {}) {
        this.repositoryId = boundedText(repositoryId, 'repositoryId', 200);
        this.projectId = boundedText(projectId, 'projectId', 200);
        this.transport = transport;
        this.timeoutMs = positiveInteger(options.timeoutMs ?? 30_000, 'timeoutMs');
    }
    async inspectRepository(_repositoryId, signal) { return validateInspection(await this.#request({ type: 'repository:inspect' }, signal), this.repositoryId, this.projectId); }
    async resolveRevision(_repositoryId, ref, signal) { return validateSha(await this.#request({ type: 'repository:resolve-revision', ref: validateRef(ref) }, signal), 'resolved revision'); }
    async branchExists(_repositoryId, branch, signal) { const value = await this.#request({ type: 'repository:branch-exists', branch: validateBranchName(branch) }, signal); if (typeof value !== 'boolean')
        throw new Error('Repository host branch response is invalid'); return value; }
    async createWorktree(input, signal) { validateWorktreeInput(input); await this.#request({ type: 'repository:create-worktree', input: clone(input) }, signal); }
    async removeWorktree(worktreeId, force, signal) { await this.#request({ type: 'repository:remove-worktree', worktreeId: validateId(worktreeId, 'worktreeId'), force }, signal); }
    async getSnapshot(worktreeId, signal) { return validateSnapshot(await this.#request({ type: 'repository:get-snapshot', worktreeId: validateId(worktreeId, 'worktreeId') }, signal)); }
    async stagePaths(worktreeId, paths, signal) { await this.#request({ type: 'repository:stage-paths', worktreeId: validateId(worktreeId, 'worktreeId'), paths: normalizeUniquePaths(paths) }, signal); }
    async commit(worktreeId, input, signal) { validateCommitInput(input); return validateCommitResult(await this.#request({ type: 'repository:commit', worktreeId: validateId(worktreeId, 'worktreeId'), input: clone(input) }, signal)); }
    async push(worktreeId, input, signal) { validatePushInput(input); return validatePushResult(await this.#request({ type: 'repository:push', worktreeId: validateId(worktreeId, 'worktreeId'), input: clone(input) }, signal)); }
    async #request(command, signal) {
        const request = { channel: REPOSITORY_HOST_CHANNEL, requestId: randomId(), repositoryId: this.repositoryId, projectId: this.projectId, command };
        const raw = await withTimeout(child => this.transport.send(clone(request), child), this.timeoutMs, signal);
        const response = validateResponse(raw, request.requestId);
        if (!response.ok)
            throw new Error(`Repository host denied request: ${response.error}`);
        return response.result;
    }
}
export function createRepositoryHostMessageHandler(adapter, options) {
    const repositoryId = boundedText(options.repositoryId, 'repositoryId', 200);
    const projectId = boundedText(options.projectId, 'projectId', 200);
    return async (message, context = {}) => {
        let requestId = 'invalid';
        try {
            const request = validateRequest(message);
            requestId = request.requestId;
            if (request.repositoryId !== repositoryId || request.projectId !== projectId)
                throw new Error('Repository host project mismatch');
            if (!await options.authorize({ requestId, repositoryId, projectId, command: clone(request.command), context: clone(context) }))
                throw new Error('Repository host authorization denied');
            const result = await executeHostCommand(adapter, repositoryId, request.command);
            return { channel: REPOSITORY_HOST_CHANNEL, requestId, ok: true, result: clone(result) };
        }
        catch (error) {
            return { channel: REPOSITORY_HOST_CHANNEL, requestId, ok: false, error: boundedError(error) };
        }
    };
}
export function createLocalRepositoryTransport(handler, context = { transport: 'local-agent' }) {
    return { send: request => handler(clone(request), clone(context)) };
}
async function executeHostCommand(adapter, repositoryId, command) {
    switch (command.type) {
        case 'repository:inspect': return adapter.inspectRepository(repositoryId);
        case 'repository:resolve-revision': return adapter.resolveRevision(repositoryId, command.ref);
        case 'repository:branch-exists': return adapter.branchExists(repositoryId, command.branch);
        case 'repository:create-worktree':
            await adapter.createWorktree(command.input);
            return { created: true };
        case 'repository:remove-worktree':
            await adapter.removeWorktree(command.worktreeId, command.force);
            return { removed: true };
        case 'repository:get-snapshot': return adapter.getSnapshot(command.worktreeId);
        case 'repository:stage-paths':
            await adapter.stagePaths(command.worktreeId, command.paths);
            return { staged: true };
        case 'repository:commit': return adapter.commit(command.worktreeId, command.input);
        case 'repository:push': return adapter.push(command.worktreeId, command.input);
    }
}
function validateRequest(value) {
    if (!isRecord(value) || value.channel !== REPOSITORY_HOST_CHANNEL)
        throw new Error('Repository host channel is invalid');
    const requestId = validateId(value.requestId, 'requestId');
    const repositoryId = boundedText(value.repositoryId, 'repositoryId', 200);
    const projectId = boundedText(value.projectId, 'projectId', 200);
    if (!isRecord(value.command) || typeof value.command.type !== 'string')
        throw new Error('Repository host command is invalid');
    let command;
    switch (value.command.type) {
        case 'repository:inspect':
            command = { type: value.command.type };
            break;
        case 'repository:resolve-revision':
            command = { type: value.command.type, ref: validateRef(value.command.ref) };
            break;
        case 'repository:branch-exists':
            command = { type: value.command.type, branch: validateBranchName(value.command.branch) };
            break;
        case 'repository:create-worktree':
            validateWorktreeInput(value.command.input);
            command = { type: value.command.type, input: clone(value.command.input) };
            break;
        case 'repository:remove-worktree':
            command = { type: value.command.type, worktreeId: validateId(value.command.worktreeId, 'worktreeId'), force: value.command.force === true };
            break;
        case 'repository:get-snapshot':
            command = { type: value.command.type, worktreeId: validateId(value.command.worktreeId, 'worktreeId') };
            break;
        case 'repository:stage-paths':
            command = { type: value.command.type, worktreeId: validateId(value.command.worktreeId, 'worktreeId'), paths: normalizeUniquePaths(value.command.paths) };
            break;
        case 'repository:commit':
            validateCommitInput(value.command.input);
            command = { type: value.command.type, worktreeId: validateId(value.command.worktreeId, 'worktreeId'), input: clone(value.command.input) };
            break;
        case 'repository:push':
            validatePushInput(value.command.input);
            command = { type: value.command.type, worktreeId: validateId(value.command.worktreeId, 'worktreeId'), input: clone(value.command.input) };
            break;
        default: throw new Error(`Unsupported repository host command: ${value.command.type}`);
    }
    return { channel: REPOSITORY_HOST_CHANNEL, requestId, repositoryId, projectId, command };
}
function validateResponse(value, requestId) {
    if (!isRecord(value) || value.channel !== REPOSITORY_HOST_CHANNEL || value.requestId !== requestId || typeof value.ok !== 'boolean')
        throw new Error('Repository host response envelope is invalid');
    if (value.ok)
        return { channel: REPOSITORY_HOST_CHANNEL, requestId, ok: true, result: value.result };
    if (typeof value.error !== 'string' || value.error.length === 0 || value.error.length > 2_000)
        throw new Error('Repository host error response is invalid');
    return { channel: REPOSITORY_HOST_CHANNEL, requestId, ok: false, error: value.error };
}
async function resolveProject(config) {
    const repositoryRoot = await realpath(resolve(config.repositoryRoot));
    await mkdir(resolve(config.worktreeRoot), { recursive: true });
    const worktreeRoot = await realpath(resolve(config.worktreeRoot));
    if (repositoryRoot === worktreeRoot)
        throw new Error('worktreeRoot must differ from repositoryRoot');
    const allowedRemoteUrls = await Promise.all((config.allowedRemoteUrls ?? []).map(value => normalizeRemoteUrl(value, repositoryRoot)));
    return {
        ...clone(config),
        repositoryRoot,
        worktreeRoot,
        allowedRemotes: [...new Set(config.allowedRemotes ?? ['origin'])].map(validateRemote),
        allowedRemoteUrls: [...new Set(allowedRemoteUrls)],
    };
}
async function secureTarget(root, path, options = {}) {
    const target = containedPath(root, path);
    const relativePath = relative(root, target);
    const parts = relativePath.split(sep).filter(Boolean);
    let current = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
        current = join(current, parts[index]);
        try {
            const stat = await lstat(current);
            if (stat.isSymbolicLink())
                throw new Error(`${path}: symbolic-link ancestor is not allowed`);
            if (!stat.isDirectory())
                throw new Error(`${path}: parent is not a directory`);
        }
        catch (error) {
            if (!isNotFound(error))
                throw error;
            if (!options.createParents)
                throw error;
            await mkdir(current);
        }
    }
    if (!options.allowMissingLeaf) {
        const stat = await lstat(target);
        if (stat.isSymbolicLink())
            throw new Error(`${path}: symbolic links are not allowed`);
    }
    return target;
}
function containedPath(root, child) {
    const target = resolve(root, child);
    assertContained(root, target);
    return target;
}
function assertContained(root, target) {
    const rel = relative(root, target);
    if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep)))
        return;
    throw new Error('Resolved path escapes configured root');
}
function assertExpectation(path, entry, expected) {
    if (!isRecord(expected) || !['missing', 'file'].includes(expected.kind))
        throw new Error(`${path}: file expectation is invalid`);
    if (expected.kind === 'missing') {
        if (entry.kind !== 'missing')
            throw new Error(`${path}: expected missing path`);
        return;
    }
    validateSha256(expected.sha256, 'expected SHA-256');
    if (entry.kind !== 'file')
        throw new Error(`${path}: expected regular file`);
    if (entry.sha256 !== expected.sha256)
        throw new Error(`${path}: SHA-256 mismatch`);
}
function parsePorcelainStatus(raw) {
    if (!raw)
        return [];
    const tokens = raw.split('\0');
    const changes = [];
    for (let index = 0; index < tokens.length;) {
        const token = tokens[index++];
        if (!token)
            continue;
        if (token.length < 4)
            throw new Error('Git porcelain status is malformed');
        const x = token[0];
        const y = token[1];
        const path = normalizeProjectPath(token.slice(3));
        let oldPath;
        if (x === 'R' || x === 'C') {
            const oldToken = tokens[index++];
            if (!oldToken)
                throw new Error('Git rename status is malformed');
            oldPath = normalizeProjectPath(oldToken);
        }
        const status = mapStatus(x, y);
        changes.push({ path, ...(oldPath ? { oldPath } : {}), status, staged: x !== ' ' && x !== '?' && y === ' ' });
    }
    return changes.sort((a, b) => a.path.localeCompare(b.path));
}
function mapStatus(x, y) {
    if (x === '?' && y === '?')
        return 'untracked';
    const code = x !== ' ' ? x : y;
    if (code === 'A')
        return 'added';
    if (code === 'D')
        return 'deleted';
    if (code === 'R')
        return 'renamed';
    if (code === 'C')
        return 'copied';
    return 'modified';
}
async function runProcess(command, args, cwd, options) {
    throwIfAborted(options.signal);
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: safeGitEnvironment(),
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finishError = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
            child.kill('SIGKILL');
            reject(error);
        };
        const append = (kind, chunk) => {
            const text = String(chunk);
            if (new TextEncoder().encode(stdout + stderr + text).byteLength > options.maxOutputBytes)
                return finishError(new Error('Git command output exceeded configured limit'));
            if (kind === 'stdout')
                stdout += text;
            else
                stderr += text;
        };
        child.stdout?.on('data', (chunk) => append('stdout', chunk));
        child.stderr?.on('data', (chunk) => append('stderr', chunk));
        child.on('error', (error) => finishError(error));
        child.on('close', (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
            resolvePromise({ code: code ?? 1, stdout, stderr });
        });
        const abort = () => finishError(options.signal?.reason instanceof Error ? options.signal.reason : new Error('Git command aborted'));
        options.signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => finishError(new Error(`Git command timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
    });
}
async function withTimeout(operation, timeoutMs, parent) {
    throwIfAborted(parent);
    const controller = new AbortController();
    const abort = () => controller.abort(parent?.reason ?? new Error('Operation aborted'));
    parent?.addEventListener('abort', abort, { once: true });
    let timer;
    try {
        return await Promise.race([
            operation(controller.signal),
            new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(`Repository host request timed out after ${timeoutMs}ms`); controller.abort(error); reject(error); }, timeoutMs); }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        parent?.removeEventListener('abort', abort);
    }
}
async function normalizeRemoteUrl(value, repositoryRoot) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2_000 || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error('Remote URL is invalid');
    if (/^(ext|fd|helper)::/i.test(value) || value.startsWith('-'))
        throw new Error('External Git remote helpers are not allowed');
    if (/^https?:\/\//i.test(value) || /^ssh:\/\//i.test(value)) {
        const url = new URL(value);
        if (!['https:', 'ssh:'].includes(url.protocol) || url.username && url.password)
            throw new Error('Remote URL credentials are not allowed');
        if (url.protocol === 'https:' && (url.username || url.password))
            throw new Error('Remote URL credentials are not allowed');
        return url.toString();
    }
    if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[a-zA-Z0-9._~/-]+$/.test(value))
        return value;
    if (value.startsWith('file://')) {
        const url = new URL(value);
        return `file://${await realpath(url.pathname)}`;
    }
    const local = resolve(repositoryRoot, value);
    return await realpath(local);
}
function safeGitEnvironment() {
    const output = {
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        LC_ALL: 'C',
        LANG: 'C',
    };
    for (const key of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TMPDIR', 'TEMP', 'TMP']) {
        const value = process.env[key];
        if (value)
            output[key] = value;
    }
    return output;
}
function validateProjectConfig(project) {
    if (!isRecord(project))
        throw new Error('Local repository project is invalid');
    boundedText(project.repositoryId, 'repositoryId', 200);
    boundedText(project.projectId, 'projectId', 200);
    if (typeof project.repositoryRoot !== 'string' || project.repositoryRoot.length === 0 || project.repositoryRoot.includes('\u0000'))
        throw new Error('repositoryRoot is invalid');
    if (typeof project.worktreeRoot !== 'string' || project.worktreeRoot.length === 0 || project.worktreeRoot.includes('\u0000'))
        throw new Error('worktreeRoot is invalid');
    validateBranchName(project.defaultBranch);
    project.allowedRemotes?.forEach(validateRemote);
    if (project.allowedRemoteUrls !== undefined && (!Array.isArray(project.allowedRemoteUrls) || project.allowedRemoteUrls.some(value => typeof value !== 'string' || value.length === 0 || value.length > 2_000 || value.includes('\u0000'))))
        throw new Error('allowedRemoteUrls is invalid');
}
function validateWorktreeInput(input) {
    if (!isRecord(input))
        throw new Error('Worktree input is invalid');
    boundedText(input.repositoryId, 'repositoryId', 200);
    boundedText(input.projectId, 'projectId', 200);
    validateId(input.worktreeId, 'worktreeId');
    validateBranchName(input.branch);
    validateSha(input.baseRevision, 'baseRevision');
}
function validateCommitInput(input) {
    if (!isRecord(input))
        throw new Error('Commit input is invalid');
    boundedText(input.subject, 'commit subject', 200);
    if (/\r|\n/.test(input.subject) || input.subject.startsWith('-'))
        throw new Error('Commit subject is invalid');
    if (input.body !== undefined && (typeof input.body !== 'string' || input.body.length > 20_000 || input.body.includes('\u0000')))
        throw new Error('Commit body is invalid');
    validateSha(input.expectedParentRevision, 'expectedParentRevision');
    if (input.author) {
        boundedText(input.author.name, 'author name', 200);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.author.email) || input.author.email.length > 320)
            throw new Error('Author email is invalid');
    }
}
function validatePushInput(input) {
    if (!isRecord(input))
        throw new Error('Push input is invalid');
    validateRemote(input.remote);
    validateBranchName(input.branch);
    validateSha(input.expectedCommitSha, 'expectedCommitSha');
    if (input.setUpstream !== undefined && typeof input.setUpstream !== 'boolean')
        throw new Error('setUpstream is invalid');
}
function validateInspection(value, repositoryId, projectId) {
    if (!isRecord(value) || value.repositoryId !== repositoryId || value.projectId !== projectId)
        throw new Error('Repository inspection response is invalid');
    validateBranchName(value.defaultBranch);
    if (value.currentBranch !== null)
        validateBranchName(value.currentBranch);
    validateSha(value.headRevision, 'headRevision');
    if (typeof value.bare !== 'boolean' || typeof value.worktreeSupported !== 'boolean')
        throw new Error('Repository inspection flags are invalid');
    return clone(value);
}
function validateSnapshot(value) {
    if (!isRecord(value))
        throw new Error('Repository snapshot response is invalid');
    boundedText(value.repositoryId, 'repositoryId', 200);
    boundedText(value.projectId, 'projectId', 200);
    if (value.branch !== null)
        validateBranchName(value.branch);
    validateSha(value.headRevision, 'headRevision');
    if (typeof value.detached !== 'boolean' || typeof value.clean !== 'boolean' || !Array.isArray(value.changes))
        throw new Error('Repository snapshot response is invalid');
    return clone(value);
}
function validateCommitResult(value) {
    if (!isRecord(value))
        throw new Error('Commit result response is invalid');
    validateSha(value.commitSha, 'commitSha');
    validateSha(value.treeSha, 'treeSha');
    if (!Array.isArray(value.parentShas) || value.parentShas.some(sha => typeof sha !== 'string' || !SHA_PATTERN.test(sha)))
        throw new Error('Commit parents are invalid');
    if (typeof value.committedAt !== 'number' || !Number.isFinite(value.committedAt))
        throw new Error('Commit timestamp is invalid');
    return clone(value);
}
function validatePushResult(value) {
    if (!isRecord(value))
        throw new Error('Push result response is invalid');
    validateRemote(value.remote);
    validateBranchName(value.branch);
    validateSha(value.commitSha, 'commitSha');
    if (typeof value.pushedAt !== 'number' || !Number.isFinite(value.pushedAt))
        throw new Error('Push timestamp is invalid');
    if (value.remoteUrl !== undefined && typeof value.remoteUrl !== 'string')
        throw new Error('Push URL is invalid');
    return clone(value);
}
function normalizeUniquePaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 500)
        throw new Error('Stage paths are invalid');
    const normalized = paths.map(path => normalizeProjectPath(path));
    if (new Set(normalized).size !== normalized.length)
        throw new Error('Stage paths contain duplicates');
    return normalized.sort();
}
function validateRef(value) {
    if (typeof value !== 'string' || !REF_PATTERN.test(value) || value.startsWith('-') || value.includes('..') || value.includes('@{') || value.endsWith('/') || value.endsWith('.lock'))
        throw new Error('Git ref is invalid');
    return value;
}
function validateRemote(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value) || value.startsWith('-'))
        throw new Error('Git remote is invalid');
    return value;
}
function validateExecutable(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 500 || value.includes('\u0000') || /\r|\n/.test(value))
        throw new Error('gitPath is invalid');
    return value;
}
function validateSha(value, label) {
    if (typeof value !== 'string' || !SHA_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function validateSha256(value, label) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function validateId(value, label) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error(`${label} is invalid`);
    return value;
}
function positiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer`);
    return value;
}
function randomId() { return `req-${crypto.randomUUID()}`; }
function throwIfAborted(signal) { if (signal?.aborted)
    throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted'); }
function pathExists(path) { return access(path).then(() => true, () => false); }
function isNotFound(error) { return isRecord(error) && error.code === 'ENOENT'; }
function boundedError(error) { return redact(error instanceof Error ? error.message : String(error)).slice(0, 2_000) || 'Repository host error'; }
function redact(value) { return value.replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, 'https://***:***@').replace(/(authorization|token|password|secret)\s*[:=]\s*[^\s]+/gi, '$1=***').trim().slice(0, 2_000); }
function redactUrl(value) { try {
    const url = new URL(value);
    if (url.username || url.password) {
        url.username = '';
        url.password = '';
    }
    ;
    return url.toString();
}
catch {
    return value.replace(/\/\/[^@/]+@/, '//');
} }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function clone(value) { if (typeof structuredClone === 'function')
    return structuredClone(value); return JSON.parse(JSON.stringify(value)); }
//# sourceMappingURL=index.js.map