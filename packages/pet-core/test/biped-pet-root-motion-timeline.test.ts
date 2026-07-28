/**
 * 文件职责 / File responsibility
 * 验证内部复合弹道时间线以单帧固定预算证明 airborne 区间，且不会把未知区间伪造成事件。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS,
  analyzeBipedPetBallisticTimeline,
  classifyBipedPetBallisticRequestedRange,
} from '../src/motion/biped-pet-root-motion-timeline.ts'

const floatBuffer = new ArrayBuffer(8)
const floatView = new DataView(floatBuffer)

function nextUp(value: number): number {
  floatView.setFloat64(0, value)
  floatView.setBigUint64(0, floatView.getBigUint64(0) + 1n)
  return floatView.getFloat64(0)
}

function addUlps(value: number, count: number): number {
  let result = value
  for (let index = 0; index < count; index += 1) result = nextUp(result)
  return result
}

function lowUlpTailWindows() {
  const tails = []
  for (let index = 0; index < 31; index += 1) {
    const centerMs = 20 + index * 2
    const firstStartMs = addUlps(centerMs, 1)
    const firstEndMs = addUlps(firstStartMs, 8)
    const secondStartMs = addUlps(firstEndMs, 8)
    const secondEndMs = addUlps(secondStartMs, 8)
    tails.push(
      { id: `tail-a-${index}`, startMs: firstStartMs, endMs: firstEndMs, weight: 7.5e-9 },
      { id: `tail-b-${index}`, startMs: secondStartMs, endMs: secondEndMs, weight: 7.5e-9 },
    )
  }
  const lastStartMs = addUlps(83, 1)
  tails.push({ id: 'tail-last', startMs: lastStartMs, endMs: addUlps(lastStartMs, 8), weight: 7.5e-9 })
  return tails
}

test('共享时间线在一个固定工作预算内证明 63 个低强度 ULP 尾窗均未腾空', () => {
  const analysis = analyzeBipedPetBallisticTimeline({
    windows: [
      { id: 'main', startMs: 0, endMs: 10, weight: 1 },
      ...lowUlpTailWindows(),
    ],
    durationMs: 100,
    loopMode: 'once',
    jumpHeight: 1,
    actionWeight: 1e-4,
    previousRequestedTimeMs: 10,
    requestedTimeMs: 84,
  })

  assert.equal(classifyBipedPetBallisticRequestedRange(analysis, 10, 84), 'grounded')
  assert.equal(analysis.stats.maximumWorkUnits, MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.ok(analysis.stats.workUnits > 0
    && analysis.stats.workUnits <= MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.boundaryCount, 130, '反例必须实际覆盖全部唯一 ULP 边界')
  assert.equal(analysis.stats.supportComponentCount, 64)
  assert.equal(analysis.stats.exhausted, false)
  assert.ok(Object.isFrozen(analysis) && Object.isFrozen(analysis.stats))
})

test('共享时间线在 once、loop 与 ping-pong 中复用同一已证明区间', () => {
  for (const item of [
    { loopMode: 'once' as const, previousRequestedTimeMs: 20, requestedTimeMs: 50, groundedStartMs: 0, groundedEndMs: 20 },
    { loopMode: 'loop' as const, previousRequestedTimeMs: 120, requestedTimeMs: 150, groundedStartMs: 100, groundedEndMs: 120 },
    { loopMode: 'ping-pong' as const, previousRequestedTimeMs: 120, requestedTimeMs: 150, groundedStartMs: 100, groundedEndMs: 120 },
  ]) {
    const analysis = analyzeBipedPetBallisticTimeline({
      windows: [{ id: 'jump', startMs: 20, endMs: 80, weight: 1 }],
      durationMs: 100,
      loopMode: item.loopMode,
      jumpHeight: 1,
      actionWeight: 1,
      previousRequestedTimeMs: item.previousRequestedTimeMs,
      requestedTimeMs: item.requestedTimeMs,
    })
    assert.equal(
      classifyBipedPetBallisticRequestedRange(analysis, item.previousRequestedTimeMs, item.requestedTimeMs),
      'airborne',
    )
    assert.equal(
      classifyBipedPetBallisticRequestedRange(analysis, item.groundedStartMs, item.groundedEndMs),
      'grounded',
    )
    assert.ok(analysis.stats.workUnits <= MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  }
})

test('全局预算耗尽时区间保持 unknown 且不会伪造 airborne 证明', () => {
  const windows = []
  for (let index = 0; index < 32; index += 1) {
    const startMs = index * 3
    windows.push(
      { id: `overlap-a-${index}`, startMs, endMs: startMs + 1.5, weight: 1 },
      { id: `overlap-b-${index}`, startMs: startMs + .5, endMs: startMs + 2, weight: 1 },
    )
  }
  const exactCompositePeak = 1120 / (729 * 64)
  const thresholdImmediatelyAbovePeak = nextUp(exactCompositePeak)
  const analysis = analyzeBipedPetBallisticTimeline({
    windows,
    durationMs: 100,
    loopMode: 'once',
    jumpHeight: 1,
    actionWeight: 1e-12 / thresholdImmediatelyAbovePeak,
    previousRequestedTimeMs: 0,
    requestedTimeMs: 100,
  })

  assert.equal(analysis.stats.workUnits, MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.exhausted, true)
  assert.equal(classifyBipedPetBallisticRequestedRange(analysis, 0, 100), 'unknown')
})
