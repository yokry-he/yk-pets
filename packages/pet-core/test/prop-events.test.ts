/**
 * 文件职责 / File responsibility
 * 验证道具事件轨道的规范化、依赖诊断以及持物、抛出、接住和销毁的确定性实例求值。
 * Verifies deterministic prop-event normalization, dependency diagnostics, and hold, throw, catch, and destroy evaluation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateMotionPropEvents, insertMotionPropEvent, normalizePropEventTracks } from '../src/index.ts'

const base = { durationMs: 2000, loopMode: 'once' as const, propIds: ['prop-star'] }

test('prop events normalize duplicate kind/time with last input wins', () => {
  const diagnostics: never[] = []
  const tracks = normalizePropEventTracks([{ id: 'track', instanceId: 'star-1', propId: 'prop-star', events: [
    { id: 'a', timeMs: 100, kind: 'move', transform: { position: [1, 0, 0] } },
    { id: 'b', timeMs: 100, kind: 'move', transform: { position: [2, 0, 0] } },
  ] }], 1000, diagnostics)
  assert.equal(tracks[0]?.events.length, 1)
  assert.deepEqual(tracks[0]?.events[0]?.transform?.position, [2, 0, 0])
})

test('hold throw catch and destroy evaluate deterministically', () => {
  const propEventTracks = normalizePropEventTracks([{ id: 'track', instanceId: 'star-1', propId: 'prop-star', events: [
    { id: 'create', timeMs: 0, kind: 'create' },
    { id: 'hold', timeMs: 0, kind: 'attach', mountId: 'right-front-paw' },
    { id: 'throw', timeMs: 500, kind: 'detach', space: 'world', transform: { position: [0, 1, .5] } },
    { id: 'fly', timeMs: 800, kind: 'move', space: 'world', transform: { position: [1.5, 2, .25] }, style: { glow: 2 } },
    { id: 'catch', timeMs: 1200, kind: 'attach', mountId: 'left-front-paw', transform: { position: [0, 0, 0] } },
    { id: 'destroy', timeMs: 1800, kind: 'destroy' },
  ] }], 2000)
  const held = evaluateMotionPropEvents({ ...base, propEventTracks }, 250).instances[0]
  assert.equal(held?.mountId, 'right-front-paw')
  assert.equal(held?.space, 'mount')
  const flying = evaluateMotionPropEvents({ ...base, propEventTracks }, 900).instances[0]
  assert.deepEqual(flying?.transform.position, [1.5, 2, .25])
  assert.equal(flying?.style.glow, 2)
  const caught = evaluateMotionPropEvents({ ...base, propEventTracks }, 1300).instances[0]
  assert.equal(caught?.mountId, 'left-front-paw')
  assert.equal(evaluateMotionPropEvents({ ...base, propEventTracks }, 1900).instances.length, 0)
})

test('missing dependencies are diagnosed and insertion preserves stable instance tracks', () => {
  const inserted = insertMotionPropEvent([], { propId: 'prop-missing', instanceId: 'instance-1', event: { id: 'event-1', timeMs: 0, kind: 'create' } }, 1000)
  const result = evaluateMotionPropEvents({ durationMs: 1000, loopMode: 'once', propIds: [], propEventTracks: inserted.tracks }, 0)
  assert.equal(inserted.tracks[0]?.instanceId, 'instance-1')
  assert.ok(result.diagnostics.some(item => item.code === 'missing-prop-dependency'))
})
