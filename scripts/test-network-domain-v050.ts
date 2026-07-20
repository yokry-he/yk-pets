import assert from 'node:assert/strict'
import type { NetworkEntry, NetworkRule } from '../packages/shared/src/network.ts'
import { applyJsonTransforms, findMatchingRule, globToRegExp, resolveNetworkUrl, resolveResponseBody } from '../apps/extension/features/network-lab/domain/network-rule-matcher.ts'
import { NetworkAnalysisService } from '../apps/extension/features/network-lab/application/network-analysis-service.ts'

const now = new Date().toISOString()
const rule = (id: string, priority: number, pattern: string): NetworkRule => ({
  id,
  name: id,
  enabled: true,
  priority,
  scopeOrigin: 'https://example.test',
  source: 'manual',
  match: { urlPattern: pattern, patternType: 'glob', methods: ['GET'], query: [] },
  action: { type: 'delay', delayMs: priority },
  createdAt: now,
  updatedAt: now,
})

assert.equal(globToRegExp('*/api/users*').test('https://example.test/api/users?page=1'), true)
assert.equal(globToRegExp('*/api/users*').test('https://example.test/api/orders'), false)
assert.equal(findMatchingRule([rule('low', 10, '*/api/*'), rule('high', 50, '*/api/users*')], { url: 'https://example.test/api/users', method: 'GET' })?.id, 'high')
assert.equal(findMatchingRule([rule('get-only', 10, '*/api/*')], { url: 'https://example.test/api/users', method: 'POST' }), null)

const localRule: NetworkRule = {
  ...rule('local-profile', 100, '/api/auth/profile'),
  scopeOrigin: 'http://localhost:5188',
  action: {
    type: 'mock',
    delayMs: 0,
    mock: { status: 200, headers: {}, body: { mocked: true }, bodyType: 'json', delayMs: 0 },
  },
}
const resolvedProfileUrl = resolveNetworkUrl('/api/auth/profile', 'http://localhost:5188/account')
assert.equal(resolvedProfileUrl, 'http://localhost:5188/api/auth/profile')
assert.equal(findMatchingRule([localRule], { url: '/api/auth/profile', method: 'GET', pageOrigin: 'http://localhost:5188' })?.id, 'local-profile')
assert.equal(findMatchingRule([localRule], { url: 'http://localhost:3000/api/auth/profile', method: 'GET', pageOrigin: 'http://localhost:5188' })?.id, 'local-profile')
assert.equal(findMatchingRule([localRule], { url: '/api/auth/profile', method: 'GET', pageOrigin: 'http://localhost:4173' }), null)

const transformed = applyJsonTransforms({ data: { user: { vip: false, secret: 'remove-me' }, rows: [{ id: 1 }, { id: 2 }] } }, [
  { id: 'set', type: 'set', path: 'data.user.vip', value: true },
  { id: 'nested', type: 'set', path: 'data.rows[1].name', value: 'NOVA' },
  { id: 'remove', type: 'remove', path: 'data.user.secret' },
]) as any
assert.equal(transformed.data.user.vip, true)
assert.equal(transformed.data.user.secret, undefined)
assert.equal(transformed.data.rows[1].name, 'NOVA')

const replacementTemplate = { data: { enabled: true }, rows: [2] }
const replaced = resolveResponseBody(
  { data: { enabled: false, legacy: true }, untouched: true },
  { type: 'modify-response', delayMs: 0, replacementBody: replacementTemplate },
)
assert.deepEqual(replaced, { data: { enabled: true }, rows: [2] })
assert.equal('untouched' in (replaced as Record<string, unknown>), false)
assert.notEqual(replaced, replacementTemplate)

const makeEntry = (id: string, duration: number, status: number, size: number): NetworkEntry => ({
  id,
  url: `https://example.test/api/${id}`,
  pathname: `/api/${id}`,
  method: 'GET',
  source: 'fetch',
  resourceType: 'fetch',
  initiatorType: 'fetch',
  status,
  ok: status < 400,
  startedAt: Date.now(),
  timestamp: now,
  duration,
  timing: { dns: 0, connect: 0, tls: 0, request: 0, ttfb: duration * 0.8, download: duration * 0.2 },
  transferSize: size,
  encodedBodySize: size,
  decodedBodySize: size,
  mocked: false,
  modified: false,
  delayed: false,
})
const analyzer = new NetworkAnalysisService()
const entries = [makeEntry('fast', 120, 200, 1024), makeEntry('slow', 1200, 200, 2048), makeEntry('error', 2200, 500, 512)]
const summary = analyzer.summarize(entries, 800)
assert.equal(summary.requestCount, 3)
assert.equal(summary.slowCount, 2)
assert.equal(summary.errorCount, 1)
assert.equal(summary.p95Duration, 2200)
assert.equal(analyzer.topSlow(entries, 1)[0]?.id, 'error')
assert.equal(analyzer.diagnose(entries, 800).some(item => item.severity === 'high'), true)

console.log('NOVA network domain tests: 22 assertions passed.')
