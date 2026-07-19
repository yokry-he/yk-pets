import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BrowserLifecycleMonitor,
  RuntimeLifecycleController,
  createAnimationActivityTarget,
  evaluateActivity,
  scheduleIdleTaskWithHost,
  type RuntimeActivityTarget,
} from '../src/index.ts'

function createTarget() {
  const calls: string[] = []
  const target: RuntimeActivityTarget = {
    activate: reason => { calls.push(`active:${reason}`) },
    pause: reason => { calls.push(`paused:${reason}`) },
    hide: reason => { calls.push(`hidden:${reason}`) },
    dispose: () => { calls.push('disposed') },
  }
  return { calls, target }
}

test('enabled visible in-viewport pages are active', async () => {
  const { calls, target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  const snapshot = await controller.update({ siteMode: 'enabled', pageVisible: true, inViewport: true })
  assert.equal(snapshot.activity, 'active')
  assert.equal(snapshot.reason, 'none')
  assert.deepEqual(calls, ['active:none'])
})

test('hidden site mode has precedence over all pause reasons', async () => {
  const { target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  const snapshot = await controller.update({ siteMode: 'hidden', pageVisible: false, inViewport: false, manualPaused: true })
  assert.equal(snapshot.activity, 'hidden')
  assert.equal(snapshot.reason, 'site-hidden')
})

test('page visibility and viewport each pause runtime work', async () => {
  const { target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  await controller.update({ pageVisible: false })
  assert.equal(controller.snapshot.reason, 'page-hidden')
  await controller.update({ pageVisible: true, inViewport: false })
  assert.equal(controller.snapshot.reason, 'offscreen')
})

test('lifecycle options can keep offscreen animation active', () => {
  const result = evaluateActivity(
    { siteMode: 'enabled', pageVisible: true, inViewport: false, frozen: false, pageActive: true, manualPaused: false },
    { pauseWhenPageHidden: true, pauseWhenOffscreen: false, pauseWhenFrozen: true, pauseWhenPageInactive: true },
  )
  assert.deepEqual(result, { activity: 'active', reason: 'none' })
})

test('animation target shows before start and stops before hide', async () => {
  const calls: string[] = []
  const target = createAnimationActivityTarget({
    start: () => { calls.push('start') },
    stop: () => { calls.push('stop') },
    show: () => { calls.push('show') },
    hide: () => { calls.push('hide') },
  })
  await target.activate('none')
  await target.hide('site-hidden')
  assert.deepEqual(calls, ['show', 'start', 'stop', 'hide'])
})

class FakeEvents {
  visibilityState = 'visible'
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) { this.listeners.get(type)?.delete(listener) }
  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener({ type } as Event)
      else listener.handleEvent({ type } as Event)
    }
  }
}

test('browser monitor follows visibility and page lifecycle events', async () => {
  const document = new FakeEvents()
  const window = new FakeEvents()
  const { target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  const monitor = new BrowserLifecycleMonitor(controller, { document, window })
  monitor.start()
  document.visibilityState = 'hidden'
  document.dispatch('visibilitychange')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(controller.snapshot.reason, 'page-hidden')
  window.dispatch('pagehide')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(controller.snapshot.reason, 'page-inactive')
  monitor.stop()
  assert.equal(document.listeners.get('visibilitychange')?.size, 0)
})

test('intersection observer pauses when the pet is offscreen', async () => {
  let callback: ((entries: { isIntersecting: boolean; intersectionRatio?: number }[]) => void) | undefined
  const { target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  const monitor = new BrowserLifecycleMonitor(controller, {
    target: {} as Element,
    intersectionObserverFactory: listener => {
      callback = listener
      return { observe() {}, disconnect() {} }
    },
  })
  monitor.start()
  callback?.([{ isIntersecting: false, intersectionRatio: 0 }])
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(controller.snapshot.reason, 'offscreen')
  monitor.stop()
})

test('idle task fallback executes once and can be cancelled', async () => {
  const timers = new Map<number, () => void>()
  let id = 0
  const host = {
    setTimeout(callback: () => void) { const next = ++id; timers.set(next, callback); return next as any },
    clearTimeout(handle: any) { timers.delete(Number(handle)) },
  }
  let runs = 0
  const cancel = scheduleIdleTaskWithHost(host, () => { runs += 1 }, { fallbackDelayMs: 1 })
  timers.values().next().value?.()
  assert.equal(runs, 1)
  cancel()
  assert.equal(runs, 1)

  const cancelSecond = scheduleIdleTaskWithHost(host, () => { runs += 1 })
  cancelSecond()
  for (const timer of timers.values()) timer()
  assert.equal(runs, 1)
})

test('dispose is terminal and optionally disposes the target', async () => {
  const { calls, target } = createTarget()
  const controller = new RuntimeLifecycleController(target)
  await controller.dispose(true)
  assert.equal(controller.snapshot.activity, 'disposed')
  assert.ok(calls.includes('disposed'))
  await assert.rejects(controller.update({ pageVisible: false }), /disposed/)
})
