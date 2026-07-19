import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PluginCompatibilityError,
  PluginRegistry,
  checkPluginCompatibility,
  compareVersions,
  parseVersion,
  satisfiesVersion,
  validatePluginManifest,
  type YkPetsPluginManifest,
} from '../src/index.ts'

const base: YkPetsPluginManifest = {
  schema: 'yk-pets.plugin/v1',
  id: 'com.example.pet-tools',
  name: 'Pet Tools',
  version: '1.2.0',
  engines: { ykPets: '^0.7.3', petCore: '^0.7.2', api: '^1.0.0' },
  entrypoints: { browser: './browser.js' },
}
const env = { ykPetsVersion: '0.7.3', petCoreVersion: '0.7.2', apiVersion: '1.0.0', allowedTools: ['patch.*'], allowedScopes: ['project:*'], allowedOrigins: ['https://*.example.com'] }

test('semantic version parser accepts prereleases', () => {
  assert.deepEqual(parseVersion('1.2.3-beta.1'), { major: 1, minor: 2, patch: 3, prerelease: 'beta.1' })
})

test('version comparison orders releases after prereleases', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0-beta.1'), 1)
})

test('caret ranges work for pre-1.0 versions', () => {
  assert.equal(satisfiesVersion('0.7.9', '^0.7.2'), true)
  assert.equal(satisfiesVersion('0.8.0', '^0.7.2'), false)
})

test('tilde and comparator ranges work', () => {
  assert.equal(satisfiesVersion('1.2.9', '~1.2.0'), true)
  assert.equal(satisfiesVersion('1.3.0', '~1.2.0'), false)
  assert.equal(satisfiesVersion('1.5.0', '>=1.2.0 <2.0.0'), true)
})

test('manifest validation rejects invalid ids', () => {
  const issues = validatePluginManifest({ ...base, id: 'Bad ID' })
  assert.ok(issues.some(issue => issue.code === 'id'))
})

test('environment compatibility validates engines', () => {
  const report = checkPluginCompatibility({ ...base, engines: { ...base.engines, ykPets: '^0.8.0' } }, env)
  assert.equal(report.compatible, false)
  assert.ok(report.issues.some(issue => issue.code === 'engine-yk-pets'))
})

test('permissions must be within host allowlists', () => {
  const report = checkPluginCompatibility({ ...base, permissions: { tools: ['shell.exec'] } }, env)
  assert.equal(report.compatible, false)
  assert.ok(report.issues.some(issue => issue.code === 'permission-tool'))
})

test('registry rejects incompatible plugins', () => {
  const registry = new PluginRegistry(env)
  assert.throws(() => registry.register({ ...base, engines: { ykPets: '^2.0.0' } }, {}), PluginCompatibilityError)
})

test('dependencies activate before dependents', async () => {
  const registry = new PluginRegistry(env)
  const order: string[] = []
  registry.register({ ...base, id: 'com.example.base', name: 'Base', version: '1.0.0', engines: { ykPets: '^0.7.3' } }, { activate: () => { order.push('base') } })
  registry.register({ ...base, id: 'com.example.child', name: 'Child', dependencies: { 'com.example.base': '^1.0.0' }, engines: { ykPets: '^0.7.3' } }, { activate: () => { order.push('child') } })
  await registry.activate(['com.example.child'])
  assert.deepEqual(order, ['base', 'child'])
})

test('dependency cycles are detected', () => {
  const registry = new PluginRegistry(env)
  registry.register({ ...base, id: 'com.example.a', name: 'A', engines: { ykPets: '^0.7.3' }, dependencies: { 'com.example.b': '*' } }, {})
  registry.register({ ...base, id: 'com.example.b', name: 'B', engines: { ykPets: '^0.7.3' }, dependencies: { 'com.example.a': '*' } }, {})
  assert.throws(() => registry.activationOrder(), /cycle/)
})

test('exclusive capability conflicts are rejected', () => {
  const registry = new PluginRegistry(env)
  registry.register({ ...base, id: 'com.example.one', name: 'One', engines: { ykPets: '^0.7.3' }, capabilities: { provides: [{ id: 'renderer.special', version: '1.0.0', exclusive: true }] } }, {})
  assert.throws(() => registry.register({ ...base, id: 'com.example.two', name: 'Two', engines: { ykPets: '^0.7.3' }, capabilities: { provides: [{ id: 'renderer.special', version: '1.0.0', exclusive: true }] } }, {}), /conflict/)
})

test('required capabilities are version checked before activation', async () => {
  const registry = new PluginRegistry(env)
  registry.register({ ...base, id: 'com.example.provider', name: 'Provider', engines: { ykPets: '^0.7.3' }, capabilities: { provides: [{ id: 'audit.extra', version: '1.0.0' }] } }, {})
  registry.register({ ...base, id: 'com.example.consumer', name: 'Consumer', engines: { ykPets: '^0.7.3' }, capabilities: { requires: [{ id: 'audit.extra', version: '^2.0.0' }] } }, {})
  await assert.rejects(registry.activate(['com.example.consumer']), /does not satisfy/)
})

test('narrow host permissions reject plugin wildcard escalation', () => {
  const report = checkPluginCompatibility({ ...base, permissions: { tools: ['patch.*'] } }, { ...env, allowedTools: ['patch.apply'] })
  assert.equal(report.compatible, false)
  assert.ok(report.issues.some(issue => issue.code === 'permission-tool'))
})

test('capability providers activate before consumers', async () => {
  const registry = new PluginRegistry(env)
  const order: string[] = []
  registry.register({
    ...base, id: 'com.example.cap-provider', name: 'Provider', engines: { ykPets: '^0.7.3' },
    capabilities: { provides: [{ id: 'audit.extra', version: '1.0.0' }] },
  }, { activate: () => { order.push('provider') } })
  registry.register({
    ...base, id: 'com.example.cap-consumer', name: 'Consumer', engines: { ykPets: '^0.7.3' },
    capabilities: { requires: [{ id: 'audit.extra', version: '^1.0.0' }] },
  }, { activate: () => { order.push('consumer') } })
  await registry.activate(['com.example.cap-consumer'])
  assert.deepEqual(order, ['provider', 'consumer'])
})

test('existing exclusive capability blocks later nonexclusive provider', () => {
  const registry = new PluginRegistry(env)
  registry.register({ ...base, id: 'com.example.exclusive', name: 'Exclusive', engines: { ykPets: '^0.7.3' }, capabilities: { provides: [{ id: 'renderer.special', exclusive: true }] } }, {})
  assert.throws(() => registry.register({ ...base, id: 'com.example.shared', name: 'Shared', engines: { ykPets: '^0.7.3' }, capabilities: { provides: [{ id: 'renderer.special', exclusive: false }] } }, {}), /conflict/)
})
