/**
 * Structured change reports for YK Pets analysis and repair workflows.
 */
import type { SourceCandidate, SourceMappingResult } from '@yk-pets/pet-source-mapper';
import type { VerificationComparison } from '@yk-pets/pet-verification-runner';
export type ChangeReportSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ChangeReportStatus = 'passed' | 'needs-attention' | 'blocked';
export interface ChangeReportIssueInput {
    id?: string;
    category: string;
    severity: ChangeReportSeverity;
    title: string;
    description: string;
    selector?: string;
    source?: SourceCandidate | null;
    sourceMapping?: SourceMappingResult | null;
    evidence?: string[];
    recommendation?: string;
    ignored?: boolean;
    ignoreReason?: string;
}
export interface ChangeReportIssue extends Omit<ChangeReportIssueInput, 'id' | 'sourceMapping'> {
    id: string;
    fingerprint: string;
    source?: SourceCandidate | null;
    duplicateCount: number;
}
export interface ChangeRecordInput {
    file: string;
    kind: 'add' | 'modify' | 'delete' | 'rename';
    summary: string;
    linesAdded?: number;
    linesRemoved?: number;
    beforeHash?: string;
    afterHash?: string;
    rollback?: string;
    relatedIssueIds?: string[];
}
export interface ChangeRecord extends ChangeRecordInput {
    id: string;
}
export interface ChangeReportEvent {
    at: number;
    type: 'analysis' | 'permission' | 'change' | 'verification' | 'warning';
    message: string;
    metadata?: Record<string, unknown>;
}
export interface ChangeReportInput {
    project: string;
    runId: string;
    targetUrl?: string;
    baseRevision?: string;
    candidateRevision?: string;
    startedAt: number;
    completedAt?: number;
    generatedAt?: number;
    issues?: ChangeReportIssueInput[];
    changes?: ChangeRecordInput[];
    verification?: VerificationComparison | null;
    events?: ChangeReportEvent[];
    notes?: string[];
}
export interface ChangeReport {
    schema: 'yk-pets.change-report/v1';
    platformVersion: '0.7.8';
    project: string;
    runId: string;
    targetUrl?: string;
    baseRevision?: string;
    candidateRevision?: string;
    startedAt: number;
    completedAt: number;
    generatedAt: number;
    durationMs: number;
    status: ChangeReportStatus;
    summary: {
        totalIssues: number;
        activeIssues: number;
        ignoredIssues: number;
        bySeverity: Record<ChangeReportSeverity, number>;
        changedFiles: number;
        linesAdded: number;
        linesRemoved: number;
        verificationPassed: boolean | null;
    };
    issues: ChangeReportIssue[];
    changes: ChangeRecord[];
    verification: VerificationComparison | null;
    events: ChangeReportEvent[];
    notes: string[];
    fingerprint: string;
}
export interface MarkdownRenderOptions {
    includeIgnored?: boolean;
    includeEvents?: boolean;
    includeVerificationDetails?: boolean;
}
export declare class ChangeReportBuilder {
    #private;
    readonly project: string;
    readonly runId: string;
    readonly startedAt: number;
    constructor(input: Pick<ChangeReportInput, 'project' | 'runId' | 'startedAt'> & Partial<Pick<ChangeReportInput, 'targetUrl' | 'baseRevision' | 'candidateRevision'>>);
    addIssue(issue: ChangeReportIssueInput): this;
    addChange(change: ChangeRecordInput): this;
    setVerification(verification: VerificationComparison | null): this;
    addEvent(event: ChangeReportEvent): this;
    addNote(note: string): this;
    build(completedAt?: number, generatedAt?: number): ChangeReport;
}
export declare function createChangeReport(input: ChangeReportInput): ChangeReport;
export declare function renderChangeReportMarkdown(report: ChangeReport, options?: MarkdownRenderOptions): string;
export declare function serializeChangeReportJson(report: ChangeReport, space?: number): string;
export declare function createReportFingerprint(value: unknown): string;
//# sourceMappingURL=index.d.ts.map