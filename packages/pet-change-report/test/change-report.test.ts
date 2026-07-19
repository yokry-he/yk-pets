import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ChangeReportBuilder,
  createChangeReport,
  createReportFingerprint,
  renderChangeReportMarkdown,
  serializeChangeReportJson,
} from '../src/index.ts'
import type { VerificationComparison } from '@yk-pets/pet-verification-runner'

function verification(passed: boolean): VerificationComparison {
  const empty = { target: { label: 'x', url: 'https://app.example/' }, capturedAt: 1, lighthouse: null, scenarios: [], errors: [] }
  return {
    passed,
    before: empty,
    after: empty,
    findings: passed ? [] : [{ id: 'score:x', kind: 'score-regression', severity: 'error', message: 'Performance regressed' }],
    improvements: [],
    summary: { errors: passed ? 0 : 1, warnings: 0, improvements: 0, scenariosBeforePassed: 0, scenariosAfterPassed: 0 },
  }
}

test('duplicate issues merge by fingerprint and retain the highest severity', () => {
  const report = createChangeReport({
    project: 'YK Pets', runId: 'run-1', startedAt: 1, completedAt: 2,
    issues: [
      { category: 'a11y', severity: 'medium', title: 'Missing label', description: 'First', selector: '#x', evidence: ['one'] },
      { category: 'a11y', severity: 'high', title: 'Missing label', description: 'Second', selector: '#x', evidence: ['two'] },
    ],
  })
  assert.equal(report.issues.length, 1)
  assert.equal(report.issues[0]!.duplicateCount, 2)
  assert.equal(report.issues[0]!.severity, 'high')
  assert.deepEqual(report.issues[0]!.evidence, ['one', 'two'])
})

test('ignored duplicate does not hide an active occurrence', () => {
  const report = createChangeReport({
    project: 'YK Pets', runId: 'run-2', startedAt: 1, completedAt: 2,
    issues: [
      { category: 'images', severity: 'low', title: 'Intrinsic size', description: 'A', selector: 'img', ignored: true },
      { category: 'images', severity: 'low', title: 'Intrinsic size', description: 'B', selector: 'img' },
    ],
  })
  assert.equal(report.issues[0]!.ignored, false)
  assert.equal(report.summary.activeIssues, 1)
})

test('critical issue or failed verification blocks the report', () => {
  const critical = createChangeReport({ project: 'YK Pets', runId: 'run-3', startedAt: 1, completedAt: 2, issues: [{ category: 'security', severity: 'critical', title: 'XSS', description: 'Unsafe' }] })
  assert.equal(critical.status, 'blocked')
  const failed = createChangeReport({ project: 'YK Pets', runId: 'run-4', startedAt: 1, completedAt: 2, verification: verification(false) })
  assert.equal(failed.status, 'blocked')
})

test('medium active issues require attention while low issues can pass', () => {
  const medium = createChangeReport({ project: 'YK Pets', runId: 'run-5', startedAt: 1, completedAt: 2, issues: [{ category: 'perf', severity: 'medium', title: 'Large image', description: 'Large' }] })
  assert.equal(medium.status, 'needs-attention')
  const low = createChangeReport({ project: 'YK Pets', runId: 'run-6', startedAt: 1, completedAt: 2, issues: [{ category: 'style', severity: 'low', title: 'Spacing', description: 'Small' }], verification: verification(true) })
  assert.equal(low.status, 'passed')
})

test('change summary counts unique files and line deltas', () => {
  const report = createChangeReport({
    project: 'YK Pets', runId: 'run-7', startedAt: 1, completedAt: 2,
    changes: [
      { file: 'src/App.vue', kind: 'modify', summary: 'Fix', linesAdded: 3, linesRemoved: 1 },
      { file: 'src/App.vue', kind: 'modify', summary: 'Test', linesAdded: 2 },
      { file: 'src/a.ts', kind: 'add', summary: 'Add', linesAdded: 5 },
    ],
  })
  assert.deepEqual(report.summary, {
    totalIssues: 0, activeIssues: 0, ignoredIssues: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    changedFiles: 2, linesAdded: 10, linesRemoved: 1, verificationPassed: null,
  })
})

test('source mapping primary candidate is embedded and normalized', () => {
  const report = createChangeReport({
    project: 'YK Pets', runId: 'run-8', startedAt: 1, completedAt: 2,
    issues: [{
      category: 'a11y', severity: 'high', title: 'Button name', description: 'Missing',
      sourceMapping: {
        descriptor: null, vue: null,
        primary: { source: 'src\\Button.vue', line: 12, column: 3, confidence: 0.9, evidenceKinds: ['vue-runtime'], reasons: ['owner'] },
        candidates: [],
      },
    }],
  })
  assert.equal(report.issues[0]!.source?.source, 'src/Button.vue')
})

test('builder creates timeline and redacts sensitive metadata', () => {
  const report = new ChangeReportBuilder({ project: 'YK Pets', runId: 'builder-1', startedAt: 100 })
    .addEvent({ at: 110, type: 'permission', message: 'Granted', metadata: { authorization: 'Bearer abc', scope: 'dom:read' } })
    .addNote('token=secret')
    .build(200, 200)
  assert.deepEqual(report.events[0]!.metadata, { authorization: '[REDACTED]', scope: 'dom:read' })
  assert.equal(report.notes[0], 'token=[REDACTED]')
})

test('Markdown includes findings, source, changes, rollback, and verification', () => {
  const report = createChangeReport({
    project: 'YK Pets', runId: 'run-md', targetUrl: 'https://app.example/', startedAt: 1, completedAt: 2,
    issues: [{ category: 'a11y', severity: 'high', title: 'Missing label', description: 'Button has no name', selector: '#save', source: { source: 'src/Button.vue', line: 5, confidence: 0.9, evidenceKinds: ['vue-runtime'], reasons: ['owner'] } }],
    changes: [{ file: 'src/Button.vue', kind: 'modify', summary: 'Add aria-label', rollback: 'Revert the commit.' }],
    verification: verification(false),
  })
  const markdown = renderChangeReportMarkdown(report)
  assert.match(markdown, /Missing label/)
  assert.match(markdown, /src\/Button\.vue:5/)
  assert.match(markdown, /Rollback/)
  assert.match(markdown, /Performance regressed/)
})

test('JSON serialization ends with a newline and validates indentation', () => {
  const report = createChangeReport({ project: 'YK Pets', runId: 'run-json', startedAt: 1, completedAt: 2 })
  assert.equal(serializeChangeReportJson(report).endsWith('\n'), true)
  assert.throws(() => serializeChangeReportJson(report, 11), /indentation/)
})

test('fingerprints are stable across object key ordering', () => {
  assert.equal(createReportFingerprint({ b: 2, a: 1 }), createReportFingerprint({ a: 1, b: 2 }))
})

test('target URL credentials and invalid timelines are rejected', () => {
  assert.throws(() => createChangeReport({ project: 'YK Pets', runId: 'bad', targetUrl: 'https://user:pass@app.example/', startedAt: 1, completedAt: 2 }), /credential-free/)
  assert.throws(() => createChangeReport({ project: 'YK Pets', runId: 'bad', startedAt: 3, completedAt: 2 }), /before/)
})
