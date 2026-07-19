import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MemoryKeyValueStore,
  SitePolicyManager,
  createChromeStorageAdapter,
  getSiteKey,
  matchesSitePattern,
  validateSitePolicySnapshot,
} from '../src/index.ts'

test('default policy enables the pet and all user-facing capabilities', async () => {
  const manager = new SitePolicyManager()
  const policy = await manager.resolve('https://example.com/docs')
  assert.equal(policy.mode, 'enabled')
  assert.equal(policy.renderer, 'auto')
  assert.equal(policy.audioEnabled, true)
  assert.equal(policy.auditEnabled, true)
})

test('wildcard site rule applies to subdomains', async () => {
  const manager = new SitePolicyManager()
  await manager.addRule({ id: 'docs', pattern: 'https://*.example.com/*', policy: { renderer: '2d', audioEnabled: false } })
  const policy = await manager.resolve('https://api.example.com/reference')
  assert.equal(policy.renderer, '2d')
  assert.equal(policy.audioEnabled, false)
  assert.deepEqual(policy.matchedRuleIds, ['docs'])
})

test('more specific origin rule overrides a broad wildcard rule', async () => {
  let now = 1
  const manager = new SitePolicyManager(undefined, { now: () => now++ })
  await manager.addRule({ id: 'all-example', pattern: '*.example.com', policy: { mode: 'paused', renderer: '2d' } })
  await manager.addRule({ id: 'app', pattern: 'https://app.example.com/*', policy: { mode: 'enabled', renderer: '3d' } })
  const policy = await manager.resolve('https://app.example.com/dashboard')
  assert.equal(policy.mode, 'enabled')
  assert.equal(policy.renderer, '3d')
  assert.deepEqual(policy.matchedRuleIds, ['all-example', 'app'])
})

test('priority resolves rules with equal specificity', async () => {
  const manager = new SitePolicyManager()
  await manager.addRule({ id: 'low', pattern: 'https://example.com/*', policy: { mode: 'paused' }, priority: 1 })
  await manager.addRule({ id: 'high', pattern: 'https://example.com/*', policy: { mode: 'hidden' }, priority: 5 })
  assert.equal((await manager.resolve('https://example.com/')).mode, 'hidden')
})

test('session override applies last and expires without touching persistent rules', async () => {
  let now = 100
  const manager = new SitePolicyManager(undefined, { now: () => now })
  await manager.addRule({ id: 'persistent', pattern: 'https://example.com/*', policy: { mode: 'paused' } })
  manager.setSessionOverride('https://example.com/a', { mode: 'enabled', renderer: '2d' }, 50)
  let policy = await manager.resolve('https://example.com/b')
  assert.equal(policy.mode, 'enabled')
  assert.equal(policy.sessionOverride, true)
  now = 151
  policy = await manager.resolve('https://example.com/b')
  assert.equal(policy.mode, 'paused')
  assert.equal(policy.sessionOverride, false)
})

test('snapshot persists and reloads from storage', async () => {
  const storage = new MemoryKeyValueStore()
  const first = new SitePolicyManager(storage)
  await first.setDefaultPolicy({ renderer: '2d' })
  await first.addRule({ id: 'private', pattern: 'https://private.example/*', policy: { auditEnabled: false } })
  const second = new SitePolicyManager(storage)
  const policy = await second.resolve('https://private.example/page')
  assert.equal(policy.renderer, '2d')
  assert.equal(policy.auditEnabled, false)
})

test('origin with a non-default port is matched and gets a distinct site key', async () => {
  const manager = new SitePolicyManager()
  await manager.addRule({ id: 'dev', pattern: 'http://localhost:4173/*', policy: { mode: 'paused' } })
  assert.equal((await manager.resolve('http://localhost:4173/app')).mode, 'paused')
  assert.equal((await manager.resolve('http://localhost:5173/app')).mode, 'enabled')
  assert.equal(getSiteKey('http://localhost:4173/app'), 'http://localhost:4173')
})

test('chrome storage adapter reads and writes a single namespaced value', async () => {
  const values: Record<string, unknown> = {}
  const adapter = createChromeStorageAdapter({
    async get(key) { return { [String(key)]: values[String(key)] } },
    async set(items) { Object.assign(values, items) },
    async remove(key) { delete values[String(key)] },
  })
  await adapter.set('yk-pets', { mode: 'hidden' })
  assert.deepEqual(await adapter.get('yk-pets'), { mode: 'hidden' })
  await adapter.remove?.('yk-pets')
  assert.equal(await adapter.get('yk-pets'), undefined)
})

test('export and import retain rule metadata', async () => {
  const first = new SitePolicyManager()
  await first.addRule({ id: 'rule', pattern: '<all_urls>', policy: { interactionsEnabled: false }, createdAt: 10, updatedAt: 20 })
  const exported = await first.exportSnapshot()
  const second = new SitePolicyManager()
  const snapshot = await second.importSnapshot(exported)
  assert.equal(snapshot.rules[0]?.createdAt, 10)
  assert.equal((await second.resolve('https://anywhere.test/')).interactionsEnabled, false)
})

test('invalid policies and duplicate rule ids are rejected', async () => {
  const manager = new SitePolicyManager()
  await assert.rejects(manager.addRule({ id: 'a', pattern: 'https://example.com/*', policy: { mode: 'enabled' } }).then(() => manager.addRule({ id: 'a', pattern: '*', policy: {} })), /already exists/)
  assert.throws(() => validateSitePolicySnapshot({ schema: 'wrong', defaultPolicy: {}, rules: [] }), /schema/)
  assert.equal(matchesSitePattern('https://*.example.com/docs/*', 'https://sub.example.com/docs/a'), true)
  assert.throws(() => matchesSitePattern('https://**.example.com/*', 'https://example.com/'), /wildcard/)
})
