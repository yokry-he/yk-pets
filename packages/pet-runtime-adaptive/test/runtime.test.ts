import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AdaptiveRendererController,
  RuntimeHealthEvaluator,
  type PetRenderer,
  type PetRendererFactory,
  type PetVisualState,
  type RendererKind,
} from '../src/index.ts'

class FakeRenderer implements PetRenderer {
  mounted = false
  disposed = false
  updates: PetVisualState[] = []
  restored: unknown
  starts = 0
  stops = 0
  visible = true
  readonly kind: RendererKind
  constructor(kind: RendererKind) { this.kind = kind }
  mount(): void { this.mounted = true }
  update(state: PetVisualState): void { this.updates.push(state) }
  snapshot() { return { state: this.updates.at(-1), payload: { from: this.kind } } }
  restore(snapshot: unknown): void { this.restored = snapshot }
  start(): void { this.starts += 1 }
  stop(): void { this.stops += 1 }
  setVisible(visible: boolean): void { this.visible = visible }
  dispose(): void { this.disposed = true }
}

function factory(kind: RendererKind, created: FakeRenderer[]): PetRendererFactory {
  return { kind, create: () => { const renderer = new FakeRenderer(kind); created.push(renderer); return renderer } }
}

test('hard fallback when WebGL is unavailable', () => {
  const result = new RuntimeHealthEvaluator().evaluate({ now: 0, webglSupported: false })
  assert.equal(result.target, '2d')
  assert.equal(result.hard, true)
  assert.equal(result.reason, 'webgl-unsupported')
})

test('manual 3D cannot override a lost WebGL context', () => {
  const result = new RuntimeHealthEvaluator().evaluate({ now: 0, webglSupported: true, webglContextLost: true, preference: '3d' })
  assert.equal(result.target, '2d')
  assert.equal(result.reason, 'webgl-context-lost')
})

test('reduced motion selects 2D in auto mode', () => {
  const result = new RuntimeHealthEvaluator().evaluate({ now: 0, webglSupported: true, reducedMotion: true })
  assert.equal(result.target, '2d')
  assert.equal(result.reason, 'reduced-motion')
})

test('low FPS selects 2D', () => {
  const result = new RuntimeHealthEvaluator({ minimumFps: 40 }).evaluate({ now: 0, webglSupported: true, averageFps: 22 })
  assert.equal(result.target, '2d')
  assert.equal(result.reason, 'low-fps')
})

test('healthy runtime selects 3D', () => {
  const result = new RuntimeHealthEvaluator().evaluate({ now: 0, webglSupported: true, averageFps: 58, longTaskRatio: 0.01, deviceMemoryGb: 8 })
  assert.equal(result.target, '3d')
  assert.equal(result.healthyFor3D, true)
})

test('controller waits for degradation votes', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) }, { degradeVotes: 3, switchCooldownMs: 0 })
  await controller.mount({} as Element, { now: 0, webglSupported: true, averageFps: 60 })
  await controller.recordProbe({ now: 1, webglSupported: true, averageFps: 20 })
  await controller.recordProbe({ now: 2, webglSupported: true, averageFps: 20 })
  assert.equal(controller.currentKind, '3d')
  await controller.recordProbe({ now: 3, webglSupported: true, averageFps: 20 })
  assert.equal(controller.currentKind, '2d')
})

test('hard fallback switches immediately', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) }, { degradeVotes: 99, switchCooldownMs: 0 })
  await controller.mount({} as Element, { now: 0, webglSupported: true })
  await controller.recordProbe({ now: 1, webglSupported: false })
  assert.equal(controller.currentKind, '2d')
})

test('state is preserved across renderer switches', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) }, { switchCooldownMs: 0 })
  await controller.mount({} as Element, { now: 0, webglSupported: true })
  controller.update({ behavior: 'thinking', emotion: 'curious' })
  await controller.force('2d')
  assert.deepEqual((created.at(-1)!.restored as { state: PetVisualState }).state, { behavior: 'thinking', emotion: 'curious' })
})

test('switch event records previous and current renderer', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) }, { switchCooldownMs: 0 })
  const events: unknown[] = []
  controller.on('switch', event => events.push(event))
  await controller.mount({} as Element, { now: 0, webglSupported: true })
  await controller.force('2d')
  assert.equal(events.length, 2)
  assert.deepEqual(events[1], { previous: '3d', current: '2d', reason: 'manual-2d', at: events[1] && (events[1] as any).at })
})

test('dispose releases active renderer', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) })
  await controller.mount({} as Element, { now: 0, webglSupported: true })
  await controller.dispose()
  assert.equal(created[0]!.disposed, true)
  assert.equal(controller.currentKind, null)
})

test('3D creation failure falls back to 2D without deadlocking', async () => {
  const created: FakeRenderer[] = []
  const failing3D: PetRendererFactory = {
    kind: '3d',
    create: () => { throw new Error('WebGL initialization failed') },
  }
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': failing3D }, { switchCooldownMs: 0 })
  const errors: unknown[] = []
  controller.on('error', event => errors.push(event))
  await controller.mount({} as Element, { now: 0, webglSupported: true })
  assert.equal(controller.currentKind, '2d')
  assert.equal(created.length, 1)
  assert.equal(errors.length, 1)
})

test('failed 3D recovery keeps an existing 2D renderer', async () => {
  const created: FakeRenderer[] = []
  const failing3D: PetRendererFactory = {
    kind: '3d',
    create: () => { throw new Error('WebGL recovery failed') },
  }
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': failing3D }, { switchCooldownMs: 0 })
  await controller.mount({} as Element, { now: 0, webglSupported: false })
  const original = created[0]
  await controller.force('3d')
  assert.equal(controller.currentKind, '2d')
  assert.equal(created.length, 1)
  assert.equal(original?.disposed, false)
})


test('controller pause, resume, and visibility reach the active renderer', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) })
  await controller.mount({} as Element, { now: 0, webglSupported: false })
  const renderer = created[0]!
  await controller.pause()
  await controller.setVisible(false)
  assert.ok(renderer.stops >= 2)
  assert.equal(renderer.visible, false)
  await controller.setVisible(true)
  assert.equal(renderer.visible, true)
  assert.equal(renderer.starts, 0)
  await controller.resume()
  assert.equal(renderer.starts, 1)
})

test('renderer switched while suspended remains stopped', async () => {
  const created: FakeRenderer[] = []
  const controller = new AdaptiveRendererController({ '2d': factory('2d', created), '3d': factory('3d', created) }, { switchCooldownMs: 0 })
  await controller.mount({} as Element, { now: 0, webglSupported: false })
  await controller.pause()
  await controller.force('3d')
  assert.equal(controller.currentKind, '3d')
  assert.ok(created.at(-1)!.stops >= 1)
  assert.equal(created.at(-1)!.starts, 0)
})
