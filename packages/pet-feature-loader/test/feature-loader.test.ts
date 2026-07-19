import assert from 'node:assert/strict'
import test from 'node:test'
import { FeatureModuleLoader, validateFeatureGraph } from '../src/index.ts'

test('concurrent feature requests share one load', async () => {
  let loads = 0
  let release!: (value: string) => void
  const loader = new FeatureModuleLoader([{ name: '3d', load: () => { loads += 1; return new Promise(resolve => { release = resolve }) } }])
  const first = loader.load<string>('3d')
  const second = loader.load<string>('3d')
  release('renderer')
  assert.equal(await first, 'renderer')
  assert.equal(await second, 'renderer')
  assert.equal(loads, 1)
})

test('dependencies load before the requested feature', async () => {
  const order: string[] = []
  const loader = new FeatureModuleLoader([
    { name: 'core', load: () => { order.push('core'); return 1 } },
    { name: 'audit', dependencies: ['core'], load: context => { order.push(`audit:${context.dependencyValues.get('core')}`); return 2 } },
  ])
  assert.equal(await loader.load('audit'), 2)
  assert.deepEqual(order, ['core', 'audit:1'])
})

test('feature graph validates cycles and unknown dependencies', () => {
  assert.throws(() => validateFeatureGraph([
    { name: 'a', dependencies: ['b'], load: () => 1 },
    { name: 'b', dependencies: ['a'], load: () => 2 },
  ]), /cycle/)
  assert.throws(() => validateFeatureGraph([{ name: 'a', dependencies: ['missing'], load: () => 1 }]), /Unknown feature dependency/)
})

test('safe fallback is returned and state records the original failure', async () => {
  const loader = new FeatureModuleLoader([{
    name: 'renderer-3d',
    load: () => { throw new Error('chunk unavailable') },
    fallback: error => `fallback:${(error as Error).message}`,
  }])
  assert.equal(await loader.load('renderer-3d'), 'fallback:chunk unavailable')
  assert.equal(loader.status('renderer-3d').state, 'fallback')
  assert.match(String(loader.status('renderer-3d').error), /chunk unavailable/)
})

test('timeout rejects even when a feature ignores the abort signal', async () => {
  const loader = new FeatureModuleLoader([{
    name: 'slow',
    timeoutMs: 10,
    load: () => new Promise(() => {}),
  }])
  await assert.rejects(loader.load('slow'), /timed out after 10ms/)
  assert.equal(loader.status('slow').state, 'failed')
})

test('failed feature can be retried explicitly', async () => {
  let attempts = 0
  const loader = new FeatureModuleLoader([{ name: 'flaky', load: () => { attempts += 1; if (attempts === 1) throw new Error('first'); return 'ok' } }])
  await assert.rejects(loader.load('flaky'), /first/)
  await assert.rejects(loader.load('flaky'), /first/)
  assert.equal(await loader.load('flaky', { retry: true }), 'ok')
  assert.equal(attempts, 2)
})

test('disabled feature cannot load until re-enabled', async () => {
  const loader = new FeatureModuleLoader([{ name: 'optional', load: () => 'ready' }])
  await loader.disable('optional')
  await assert.rejects(loader.load('optional'), /disabled/)
  loader.enable('optional')
  assert.equal(await loader.load('optional'), 'ready')
})

test('idle prefetch loads features in declared order', async () => {
  const order: string[] = []
  const loader = new FeatureModuleLoader([
    { name: '3d', load: () => { order.push('3d'); return {} } },
    { name: 'audit', load: () => { order.push('audit'); return {} } },
  ])
  let task: (() => void | Promise<void>) | undefined
  loader.schedulePrefetch(['3d', 'audit'], callback => { task = callback; return () => {} })
  await task?.()
  assert.deepEqual(order, ['3d', 'audit'])
})

test('external abort does not invoke a fallback', async () => {
  let fallbackRuns = 0
  const controller = new AbortController()
  const loader = new FeatureModuleLoader([{
    name: 'abortable',
    load: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    fallback: () => { fallbackRuns += 1; return 'fallback' },
  }])
  const loading = loader.load('abortable', { signal: controller.signal })
  controller.abort(new DOMException('cancelled', 'AbortError'))
  await assert.rejects(loading, /cancelled/)
  assert.equal(fallbackRuns, 0)
})

test('reset and dispose invoke feature cleanup', async () => {
  let disposals = 0
  const loader = new FeatureModuleLoader([{ name: 'module', load: () => ({ id: 1 }), dispose: () => { disposals += 1 } }])
  await loader.load('module')
  await loader.reset('module')
  assert.equal(disposals, 1)
  await loader.load('module')
  await loader.dispose()
  assert.equal(disposals, 2)
  assert.equal(loader.status('module').state, 'disposed')
  await assert.rejects(loader.load('module'), /disposed/)
})


test('disabling a loaded feature releases it before re-enable', async () => {
  let disposals = 0
  const loader = new FeatureModuleLoader([{ name: 'optional-cleanup', load: () => ({ ok: true }), dispose: () => { disposals += 1 } }])
  await loader.load('optional-cleanup')
  await loader.disable('optional-cleanup')
  assert.equal(disposals, 1)
  assert.equal(loader.status('optional-cleanup').state, 'disabled')
  loader.enable('optional-cleanup')
  await loader.load('optional-cleanup')
  assert.equal(loader.status('optional-cleanup').state, 'ready')
})
