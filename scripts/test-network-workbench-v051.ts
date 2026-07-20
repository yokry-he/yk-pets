import assert from 'node:assert/strict'
import type { NetworkEntry, NetworkRule } from '../packages/shared/src/network.ts'
import { NetworkRuleFactory } from '../apps/extension/features/network-lab/domain/network-rule-factory.ts'
import { findMatchingRule, testRules } from '../apps/extension/features/network-lab/domain/network-rule-matcher.ts'

const factory = new NetworkRuleFactory()
const manual = factory.createManual('https://app.example.test')
assert.equal(manual.source, 'manual')
assert.equal(manual.scopeOrigin, 'https://app.example.test')
assert.equal(manual.action.type, 'mock')
assert.equal(manual.action.mock?.bodyType, 'json')

const entry: NetworkEntry = {
  id: 'request-1',
  url: 'https://app.example.test/api/users?page=2',
  pathname: '/api/users',
  method: 'POST',
  source: 'fetch',
  resourceType: 'fetch',
  initiatorType: 'fetch',
  status: 201,
  ok: true,
  startedAt: 1,
  timestamp: new Date().toISOString(),
  duration: 120,
  timing: { dns: 0, connect: 0, tls: 0, request: 0, ttfb: 90, download: 30 },
  transferSize: 80,
  encodedBodySize: 80,
  decodedBodySize: 80,
  mocked: false,
  modified: false,
  delayed: false,
  responsePreview: { data: [{ id: 1 }] },
}
const fromEntry = factory.createFromEntry(entry, 'https://app.example.test')
assert.equal(fromEntry.source, 'captured-request')
assert.deepEqual(fromEntry.match.methods, ['POST'])
assert.equal(fromEntry.action.mock?.status, 201)
assert.deepEqual(fromEntry.action.mock?.body, { data: [{ id: 1 }] })

const duplicate = factory.duplicate(fromEntry)
assert.notEqual(duplicate.id, fromEntry.id)
assert.equal(duplicate.enabled, false)
assert.equal(duplicate.source, 'duplicate')
assert.match(duplicate.name, /副本/)

const queryRule: NetworkRule = {
  ...manual,
  id: 'query-rule',
  enabled: true,
  match: {
    urlPattern: '/api/users*',
    patternType: 'glob',
    methods: ['GET'],
    query: [{ id: 'q1', key: 'page', operator: 'equals', value: '2' }],
  },
}
assert.equal(findMatchingRule([queryRule], { url: 'https://app.example.test/api/users?page=2', method: 'GET' })?.id, 'query-rule')
assert.equal(findMatchingRule([queryRule], { url: 'https://app.example.test/api/users?page=1', method: 'GET' }), null)
assert.equal(findMatchingRule([queryRule], { url: 'https://other.example.test/api/users?page=2', method: 'GET' }), null)

const broader: NetworkRule = {
  ...factory.createManual('https://app.example.test'),
  id: 'broader',
  name: 'broader',
  priority: 100,
  match: { urlPattern: '/api/*', patternType: 'glob', methods: ['GET'], query: [] },
}
const ranked = testRules([broader, queryRule], { url: 'https://app.example.test/api/users?page=2', method: 'GET' })
assert.equal(ranked.selectedRule?.id, 'query-rule')

const same: NetworkRule = { ...structuredClone(queryRule), id: 'same', name: 'same' }
const competing = testRules([same, queryRule], { url: 'https://app.example.test/api/users?page=2', method: 'GET' })
assert.equal(competing.matchingRules.length, 2)
assert.equal(competing.matchingRules.every(rule => rule.priority === queryRule.priority), true)

console.log('NOVA v0.5.1 network workbench tests: 18 assertions passed.')
