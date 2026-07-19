/** Approval-gated remediation execution with automatic rollback after verification failure. */
import { FileTransactionExecutor, toPublicTransactionSummary, } from '@yk-pets/pet-file-transaction';
import { computePatchPlanDigest, validatePatchPlan } from '@yk-pets/pet-patch-plan';
import { ScopeApprovalGate } from '@yk-pets/pet-scope-approval';
export class MemoryRemediationAuditSink {
    #events = [];
    write(event) { this.#events.push(clone(event)); }
    list() { return clone(this.#events); }
    clear() { this.#events = []; }
}
export class RemediationRunner {
    approvals;
    transactions;
    verify;
    verificationTimeoutMs;
    audit;
    now;
    constructor(options) {
        this.approvals = options.approvals;
        this.transactions = options.transactions;
        this.verify = options.verify;
        this.verificationTimeoutMs = positiveInteger(options.verificationTimeoutMs ?? 120_000, 'verificationTimeoutMs');
        this.audit = options.audit ?? new MemoryRemediationAuditSink();
        this.now = options.now ?? Date.now;
    }
    async execute(request) {
        const runId = randomId();
        const now = this.now;
        const startedAt = now();
        const events = [];
        let preview;
        let approval;
        let transaction;
        let verification;
        let digest;
        const emit = async (stage, message) => {
            const event = {
                id: `${runId}:${events.length + 1}`,
                runId,
                at: this.now(),
                stage,
                planId: request.plan?.id ?? 'unknown',
                projectId: request.plan?.projectId ?? 'unknown',
                message: boundedText(message, 'audit message', 2_000),
            };
            events.push(event);
            try {
                await this.audit.write(clone(event));
            }
            catch { /* Audit sink failures must never strand or bypass a file transaction. */ }
        };
        try {
            throwIfAborted(request.signal);
            validatePatchPlan(request.plan);
            digest = await computePatchPlanDigest(request.plan);
            await emit('plan-validated', 'Patch plan schema, paths, edits, and hashes are valid.');
            preview = await this.transactions.preview(request.plan, request.signal);
            await emit('preview-complete', `Preflight completed for ${preview.files.length} file entries and ${preview.changedBytes} write bytes.`);
            if (request.dryRun) {
                await emit('completed', 'Dry-run preview completed without consuming approval or writing files.');
                return finish('previewed');
            }
            if (!request.approvalToken)
                throw new Error('An explicit scope approval token is required');
            approval = await this.approvals.authorize({
                token: request.approvalToken,
                plan: request.plan,
                subject: request.subject,
                projectId: request.plan.projectId,
                origin: request.origin,
                baseRevision: preview.revisionBefore,
                actualChangedBytes: preview.changedBytes,
            });
            await emit('approval-authorized', 'One-time plan-bound modification approval was verified and consumed.');
            throwIfAborted(request.signal);
            await emit('transaction-started', 'Starting compare-and-swap file transaction.');
            transaction = await this.transactions.apply(request.plan, request.signal);
            if (transaction.status !== 'committed') {
                await emit('transaction-failed', transaction.error ?? `File transaction ended with ${transaction.status}.`);
                if (transaction.status === 'rolled-back')
                    await emit('rollback-complete', 'Partial file transaction was automatically rolled back.');
                if (transaction.status === 'rollback-failed')
                    await emit('rollback-failed', 'Partial transaction rollback requires manual recovery.');
                return finish(mapTransactionStatus(transaction.status), transaction.error);
            }
            await emit('transaction-committed', 'File transaction committed; rollback journal retained until verification completes.');
            const verificationRequired = request.plan.verification?.required === true;
            if (!this.verify && !verificationRequired) {
                await emit('completed', 'Modification completed; verification was not required by the plan.');
                return finish('applied');
            }
            await emit('verification-started', 'Running post-change verification.');
            try {
                if (!this.verify)
                    throw new Error('Patch plan requires verification but no verification adapter is configured');
                verification = await runWithTimeout(signal => Promise.resolve(this.verify({ plan: clone(request.plan), transaction: clone(transaction), signal })), this.verificationTimeoutMs, request.signal);
                validateVerificationResult(verification);
                if (!verification.passed)
                    throw new VerificationRejectedError(verification.summary ?? 'Post-change verification did not pass');
                await emit('verification-passed', verification.summary ?? 'Post-change verification passed.');
                await emit('completed', 'Modification and verification completed successfully.');
                return finish('applied');
            }
            catch (error) {
                if (error instanceof VerificationRejectedError && verification) {
                    await emit('verification-failed', verification.summary ?? error.message);
                }
                else
                    await emit('verification-failed', errorMessage(error));
                await emit('rollback-started', 'Verification failed; starting automatic rollback.');
                // Recovery deliberately ignores the caller's aborted signal so cancellation cannot strand approved writes.
                transaction = await this.transactions.rollback(transaction);
                if (transaction.status === 'rolled-back') {
                    await emit('rollback-complete', 'Automatic rollback restored the pre-change files.');
                    return finish('rolled-back', errorMessage(error));
                }
                await emit('rollback-failed', 'Automatic rollback could not restore every file; manual recovery journal is required.');
                return finish('rollback-failed', errorMessage(error));
            }
        }
        catch (error) {
            await emit('failed', errorMessage(error));
            return finish('failed', errorMessage(error));
        }
        function finish(status, error) {
            return {
                runId,
                planId: request.plan?.id ?? 'unknown',
                projectId: request.plan?.projectId ?? 'unknown',
                planDigest: digest,
                status,
                startedAt,
                finishedAt: now(),
                preview: preview ? clone(preview) : undefined,
                approval: approval ? clone(approval) : undefined,
                transaction: transaction ? clone(transaction) : undefined,
                verification: verification ? clone(verification) : undefined,
                error,
                audit: clone(events),
            };
        }
    }
}
export function toPublicRemediationResult(result) {
    return {
        ...clone(result),
        approval: result.approval ? { ...clone(result.approval), jti: '[redacted]' } : undefined,
        transaction: result.transaction ? toPublicTransactionSummary(result.transaction) : undefined,
    };
}
class VerificationRejectedError extends Error {
}
function mapTransactionStatus(status) {
    if (status === 'committed')
        return 'applied';
    return status;
}
function validateVerificationResult(value) {
    if (!isRecord(value) || typeof value.passed !== 'boolean')
        throw new Error('Verification adapter returned an invalid result');
    if (value.summary !== undefined)
        boundedText(value.summary, 'verification summary', 2_000);
}
async function runWithTimeout(operation, timeoutMs, parent) {
    const controller = new AbortController();
    const abort = () => controller.abort(parent?.reason);
    parent?.addEventListener('abort', abort, { once: true });
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(`Post-change verification timed out after ${timeoutMs}ms`);
            controller.abort(error);
            reject(error);
        }, timeoutMs);
    });
    const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Verification aborted')), { once: true }));
    try {
        return await Promise.race([operation(controller.signal), timeout, aborted]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
        parent?.removeEventListener('abort', abort);
    }
}
function throwIfAborted(signal) {
    if (signal?.aborted)
        throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted');
}
function randomId() {
    if (typeof globalThis.crypto?.randomUUID === 'function')
        return globalThis.crypto.randomUUID();
    return `remediation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function boundedText(value, label, max) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
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