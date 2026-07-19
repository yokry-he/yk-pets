import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VerificationRunner,
  compareVerificationSnapshots,
  normalizeLighthouseResult,
  validateScenario,
  type LighthouseResult,
  type PlaywrightScenarioResult,
  type VerificationSnapshot,
} from '../src/index.ts'

const lighthouse = (performance: number, lcp: number, auditScore = 1): LighthouseResult => ({
  categories: { performance: { score: performance } },
  metrics: { LCP: lcp },
  audits: { 'image-size-responsive': { score: auditScore } },
})

function snapshot(label: string, options: { performance?: number; lcp?: number; scenarioPassed?: boolean; consoleErrors?: string[]; pageErrors?: string[]; errors?: VerificationSnapshot['errors'] } = {}): VerificationSnapshot {
  return {
    target: { label, url: `https://${label}.example/` },
    capturedAt: 1,
    lighthouse: lighthouse(options.performance ?? 0.9, options.lcp ?? 2_000),
    scenarios: [{
      id: 'checkout', title: 'Checkout', passed: options.scenarioPassed ?? true, durationMs: 10,
      assertions: [{ id: 'visible', passed: options.scenarioPassed ?? true }],
      consoleErrors: options.consoleErrors ?? [], pageErrors: options.pageErrors ?? [],
    }],
    errors: options.errors ?? [],
  }
}

test('safe scenario rejects arbitrary actions and form input without opt-in', () => {
  assert.throws(() => validateScenario({ id: 'x', title: 'X', steps: [{ action: 'evaluate', code: '1+1' } as never] }), /not supported/)
  assert.throws(() => validateScenario({ id: 'x', title: 'X', steps: [{ action: 'fill', selector: '#x', value: 'secret' }] }), /allowFormInput/)
})

test('safe scenario permits scoped form input with explicit opt-in', () => {
  assert.doesNotThrow(() => validateScenario({ id: 'form', title: 'Form', allowFormInput: true, steps: [{ action: 'fill', selector: '#name', value: 'YK Pets' }] }))
})

test('scenario URL assertions cannot leave the target origin', () => {
  assert.throws(() => validateScenario({ id: 'url', title: 'URL', steps: [{ action: 'expect-url', url: 'https://evil.example/' }] }, 'https://app.example/'), /leaves/)
})

test('runner enforces target origin allowlist', async () => {
  const runner = new VerificationRunner({ allowedOrigins: ['https://*.example.com'] })
  await assert.rejects(runner.capture({ label: 'bad', url: 'https://evil.invalid/' }), /outside/)
})

test('capture normalizes adapters and deterministic scenario order', async () => {
  const calls: string[] = []
  const runner = new VerificationRunner({
    lighthouse: { async run() { return lighthouse(0.95, 1_500) } },
    playwright: {
      async run(_target, scenario): Promise<PlaywrightScenarioResult> {
        calls.push(scenario.id)
        return { id: scenario.id, title: 'adapter title ignored', passed: true, durationMs: 12, assertions: [] }
      },
    },
  })
  const result = await runner.capture({ label: 'candidate', url: 'https://app.example/' }, {
    scenarios: [
      { id: 'zeta', title: 'Zeta', steps: [{ action: 'expect-visible', selector: '#z' }] },
      { id: 'alpha', title: 'Alpha', steps: [{ action: 'expect-visible', selector: '#a' }] },
    ],
  })
  assert.deepEqual(calls, ['zeta', 'alpha'])
  assert.deepEqual(result.scenarios.map(item => item.id), ['alpha', 'zeta'])
  assert.equal(result.scenarios[0]!.title, 'Alpha')
})

test('capture timeout becomes a structured error and failed scenario', async () => {
  const runner = new VerificationRunner({
    timeoutMs: 10,
    playwright: { async run() { return new Promise(() => {}) } },
  })
  const result = await runner.capture({ label: 'candidate', url: 'https://app.example/' }, {
    scenarios: [{ id: 'slow', title: 'Slow', timeoutMs: 10, steps: [{ action: 'expect-visible', selector: '#x' }] }],
    lighthouse: false,
  })
  assert.equal(result.scenarios[0]!.passed, false)
  assert.match(result.errors[0]!.message, /timed out/)
})

test('score minimum and regression thresholds fail verification', () => {
  const result = compareVerificationSnapshots(snapshot('before', { performance: 0.95 }), snapshot('after', { performance: 0.8 }), {
    scores: { performance: { min: 0.9, maxRegression: 0.05 } },
  })
  assert.equal(result.passed, false)
  assert.deepEqual(result.findings.map(item => item.kind), ['score-below-minimum', 'score-regression'])
})

test('lower-is-better metric regression is detected by ratio', () => {
  const result = compareVerificationSnapshots(snapshot('before', { lcp: 2_000 }), snapshot('after', { lcp: 2_500 }), {
    metrics: { LCP: { maxRegressionRatio: 0.1 } },
  })
  assert.equal(result.findings[0]!.kind, 'metric-regression')
})

test('higher-is-better metric improvements are recorded', () => {
  const before = snapshot('before'); before.lighthouse!.metrics.Coverage = 0.4
  const after = snapshot('after'); after.lighthouse!.metrics.Coverage = 0.7
  const result = compareVerificationSnapshots(before, after, { metrics: { Coverage: { direction: 'higher-is-better', maxRegressionAbsolute: 0 } } })
  assert.equal(result.improvements[0]!.kind, 'metric')
  assert.equal(result.passed, true)
})

test('required Lighthouse audit must have a perfect pass score', () => {
  const result = compareVerificationSnapshots(snapshot('before'), { ...snapshot('after'), lighthouse: lighthouse(0.9, 2_000, 0.5) }, {
    requiredAudits: ['image-size-responsive'],
  })
  assert.equal(result.findings[0]!.kind, 'required-audit-failed')
})

test('scenario and assertion regressions are reported', () => {
  const result = compareVerificationSnapshots(snapshot('before', { scenarioPassed: true }), snapshot('after', { scenarioPassed: false }))
  assert.deepEqual(result.findings.map(item => item.kind), ['assertion-regression', 'scenario-regression'])
})

test('fixed scenarios and reduced errors are improvements', () => {
  const before = snapshot('before', { scenarioPassed: false, consoleErrors: ['a', 'b'] })
  const after = snapshot('after', { scenarioPassed: true, consoleErrors: [] })
  const result = compareVerificationSnapshots(before, after)
  assert.equal(result.passed, true)
  assert.deepEqual(result.improvements.map(item => item.kind).sort(), ['assertion', 'error-count', 'scenario'])
})

test('new console and page errors fail by default', () => {
  const result = compareVerificationSnapshots(snapshot('before'), snapshot('after', { consoleErrors: ['x'], pageErrors: ['y'] }))
  assert.deepEqual(result.findings.map(item => item.kind), ['new-console-errors', 'new-page-errors'])
})

test('candidate capture errors fail unless policy explicitly allows them', () => {
  const after = snapshot('after', { errors: [{ source: 'lighthouse', message: 'unavailable' }] })
  assert.equal(compareVerificationSnapshots(snapshot('before'), after).passed, false)
  assert.equal(compareVerificationSnapshots(snapshot('before'), after, { failOnCaptureError: false }).passed, true)
})

test('Lighthouse normalization rejects impossible scores and sorts keys', () => {
  assert.throws(() => normalizeLighthouseResult({ categories: { x: { score: 2 } }, metrics: {}, audits: {} }), /between 0 and 1/)
  const normalized = normalizeLighthouseResult({ categories: { z: { score: 1 }, a: { score: 0 } }, metrics: { Z: 1, A: 2 }, audits: {} })
  assert.deepEqual(Object.keys(normalized.categories), ['a', 'z'])
  assert.deepEqual(Object.keys(normalized.metrics), ['A', 'Z'])
})
