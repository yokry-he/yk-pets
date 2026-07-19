/** Deterministic pull request merge eligibility gate. */
import { sha256Hex, stableStringify } from '@yk-pets/pet-patch-plan';
import { latestReviewByAuthor } from '@yk-pets/pet-pr-lifecycle';
export const MERGE_GATE_SCHEMA = 'yk-pets.merge-gate/v1';
export async function evaluateMergeGate(snapshot, policy, now = Date.now()) {
    validatePolicy(policy);
    const reasons = [];
    const pr = snapshot.pullRequest;
    if (snapshot.repository !== pr.repository || snapshot.number !== pr.number)
        blocked(reasons, 'scope-mismatch', 'Lifecycle snapshot scope does not match the pull request');
    if (pr.headSha !== policy.expectedHeadSha.toLowerCase())
        blocked(reasons, 'head-moved', 'Pull request head no longer matches the approved commit', [pr.headSha]);
    if (policy.baseBranch !== undefined && pr.baseBranch !== policy.baseBranch)
        blocked(reasons, 'base-branch-changed', 'Pull request base branch changed', [pr.baseBranch]);
    if (pr.state !== 'open')
        blocked(reasons, 'not-open', `Pull request is ${pr.state}`);
    if (pr.draft)
        blocked(reasons, 'draft', 'Pull request is still a draft');
    if (pr.mergeability === 'conflicting')
        blocked(reasons, 'merge-conflict', 'Pull request has merge conflicts');
    if (pr.mergeability === 'unknown')
        waiting(reasons, 'mergeability-pending', 'Pull request mergeability is not known yet');
    const maxAge = policy.maxSnapshotAgeMs ?? 5 * 60_000;
    if (!Number.isFinite(snapshot.capturedAt) || now < snapshot.capturedAt || now - snapshot.capturedAt > maxAge)
        blocked(reasons, 'stale-snapshot', 'Pull request lifecycle snapshot is stale');
    const requiredNames = normalizeNames(policy.requiredCheckNames ?? []);
    const checksByName = new Map();
    for (const check of snapshot.checks)
        checksByName.set(check.name, [...(checksByName.get(check.name) ?? []), check]);
    for (const name of requiredNames) {
        const matches = checksByName.get(name) ?? [];
        if (matches.length === 0) {
            blocked(reasons, 'required-check-missing', `Required check is missing: ${name}`, [name]);
            continue;
        }
        if (matches.length > 1) {
            blocked(reasons, 'required-check-ambiguous', `Required check name is ambiguous: ${name}`, matches.map(check => check.id).sort());
            continue;
        }
        const check = matches[0];
        if (check.status !== 'completed') {
            waiting(reasons, 'required-check-pending', `Required check is still running: ${name}`, [check.id]);
            continue;
        }
        if (check.conclusion === 'success')
            continue;
        if (check.conclusion === 'skipped' && policy.allowSkippedRequiredChecks)
            continue;
        if (check.conclusion === 'neutral' && policy.allowNeutralRequiredChecks)
            continue;
        blocked(reasons, 'required-check-failed', `Required check did not pass: ${name}`, [check.id]);
    }
    for (const check of snapshot.checks.filter(check => check.required && !requiredNames.includes(check.name))) {
        if (check.status !== 'completed')
            waiting(reasons, 'required-check-pending', `Required check is still running: ${check.name}`, [check.id]);
        else if (check.conclusion !== 'success' && !(check.conclusion === 'skipped' && policy.allowSkippedRequiredChecks) && !(check.conclusion === 'neutral' && policy.allowNeutralRequiredChecks))
            blocked(reasons, 'required-check-failed', `Required check did not pass: ${check.name}`, [check.id]);
    }
    if (policy.requireNoUnresolvedThreads !== false) {
        const ids = snapshot.reviewThreads.filter(thread => !thread.resolved && !thread.outdated).map(thread => thread.id).sort();
        if (ids.length > 0)
            blocked(reasons, 'unresolved-review-threads', 'Pull request has unresolved review threads', ids);
    }
    const latestReviews = latestReviewByAuthor(snapshot.reviews, pr.headSha);
    const changesRequested = [...latestReviews.values()].filter(review => review.state === 'changes_requested').map(review => review.author).sort();
    if (changesRequested.length > 0)
        blocked(reasons, 'changes-requested', 'Current reviews still request changes', changesRequested);
    const trusted = policy.trustedApprovers ? new Set(normalizeNames(policy.trustedApprovers)) : null;
    const approvals = [...latestReviews.values()]
        .filter(review => review.state === 'approved')
        .map(review => review.author)
        .filter(author => !(policy.excludeAuthorApproval !== false && author === pr.author))
        .filter(author => !trusted || trusted.has(author))
        .sort();
    const minimumApprovals = nonNegativeInteger(policy.minimumApprovals ?? 1, 'minimumApprovals');
    if (approvals.length < minimumApprovals)
        blocked(reasons, 'insufficient-approvals', `Pull request requires ${minimumApprovals} approval(s), found ${approvals.length}`, approvals);
    const eligibleMethods = normalizeMergeMethods(policy.allowedMergeMethods ?? ['squash']);
    const status = reasons.some(reason => reason.severity === 'blocked') ? 'blocked' : reasons.length > 0 ? 'waiting' : 'eligible';
    const base = {
        schema: MERGE_GATE_SCHEMA,
        repository: snapshot.repository,
        number: snapshot.number,
        headSha: pr.headSha,
        evaluatedAt: now,
        snapshotDigest: snapshot.digest,
        status,
        eligibleMethods,
        approvals,
        reasons: reasons.sort((a, b) => a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message)),
    };
    return { ...base, digest: await mergeGateDigest(base) };
}
export async function mergeGateDigest(decision) {
    return sha256Hex(stableStringify({ ...decision, evaluatedAt: undefined }));
}
export function assertMergeEligible(decision, method) {
    if (decision.status !== 'eligible')
        throw new Error(`Merge gate is ${decision.status}: ${decision.reasons.map(reason => reason.code).join(', ')}`);
    if (!decision.eligibleMethods.includes(method))
        throw new Error(`Merge method is not eligible: ${method}`);
}
function validatePolicy(policy) {
    if (!isRecord(policy) || typeof policy.expectedHeadSha !== 'string' || !/^[a-f0-9]{40}$/i.test(policy.expectedHeadSha))
        throw new Error('Merge gate expectedHeadSha is invalid');
    if (policy.baseBranch !== undefined && (typeof policy.baseBranch !== 'string' || policy.baseBranch.length === 0))
        throw new Error('Merge gate baseBranch is invalid');
    normalizeNames(policy.requiredCheckNames ?? []);
    if (policy.trustedApprovers !== undefined)
        normalizeNames(policy.trustedApprovers);
    nonNegativeInteger(policy.minimumApprovals ?? 1, 'minimumApprovals');
    if (policy.maxSnapshotAgeMs !== undefined && (!Number.isSafeInteger(policy.maxSnapshotAgeMs) || policy.maxSnapshotAgeMs <= 0))
        throw new Error('maxSnapshotAgeMs must be a positive integer');
    normalizeMergeMethods(policy.allowedMergeMethods ?? ['squash']);
}
function normalizeNames(values) {
    if (!Array.isArray(values))
        throw new Error('Name list is invalid');
    const output = values.map(value => {
        if (typeof value !== 'string' || value.trim().length === 0 || value.length > 300)
            throw new Error('Name list contains an invalid value');
        return value;
    }).sort();
    if (new Set(output).size !== output.length)
        throw new Error('Name list contains duplicates');
    return output;
}
function normalizeMergeMethods(values) {
    if (!Array.isArray(values) || values.length === 0)
        throw new Error('At least one merge method is required');
    const output = values.map(value => {
        if (value !== 'merge' && value !== 'squash' && value !== 'rebase')
            throw new Error('Merge method is invalid');
        return value;
    }).sort();
    if (new Set(output).size !== output.length)
        throw new Error('Merge methods contain duplicates');
    return output;
}
function blocked(reasons, code, message, resourceIds) { reasons.push({ code, severity: 'blocked', message, ...(resourceIds ? { resourceIds } : {}) }); }
function waiting(reasons, code, message, resourceIds) { reasons.push({ code, severity: 'waiting', message, ...(resourceIds ? { resourceIds } : {}) }); }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative integer`); return value; }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
//# sourceMappingURL=index.js.map