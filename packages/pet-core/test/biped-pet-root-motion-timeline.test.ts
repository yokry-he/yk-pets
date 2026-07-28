/**
 * 文件职责 / File responsibility
 * 验证内部复合弹道时间线以单帧固定预算证明 airborne 区间，且不会把未知区间伪造成事件。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS,
  analyzeBipedPetBallisticTimeline,
  bipedPetBallisticTransitionsInRequestedRange,
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

function analyze(
  windows: readonly { readonly id: string; readonly startMs: number; readonly endMs: number; readonly weight: number }[],
  loopMode: 'once' | 'loop' | 'ping-pong' = 'once',
) {
  return analyzeBipedPetBallisticTimeline({
    windows,
    durationMs: 100,
    loopMode,
    jumpHeight: 1,
    actionWeight: 1,
  })
}

test('canonical 组件与转换只由动作结构形成', () => {
  const windows = [
    { id: 'first', startMs: 0, endMs: 10, weight: 1 },
    { id: 'adjacent', startMs: 10, endMs: 20, weight: 1 },
  ]
  const exact = analyze(windows, 'once')

  assert.deepEqual(exact.boundaries, [0, 10, 20, 100])
  assert.equal(exact.components.length, 1, '两侧 proven airborne 且仅精确相邻时必须合并为一个组件')
  assert.ok(exact.components[0]!.startMs > 0 && exact.components[0]!.endMs < 20)
  assert.equal(
    exact.transitions.some(transition => transition.resolvedTimeMs === 10),
    false,
    '零宽接地点不是结构转换',
  )
})

test('低于阈值的重叠/相邻尾窗不改变主组件，touchdown 位于真实复合阈值交点', () => {
  const main = { id: 'main', startMs: 0, endMs: 10, weight: 1 }
  const overlap = analyze([main, { id: 'tail', startMs: 9.999999, endMs: 20, weight: 7.5e-13 }])
  const adjacent = analyze([main, { id: 'tail', startMs: 10, endMs: 20, weight: 7.5e-13 }])
  const earlyBoundary = analyze([main, { id: 'tail', startMs: 4, endMs: 20, weight: 7.5e-13 }])

  assert.deepEqual(overlap.components, adjacent.components)
  assert.deepEqual(overlap.transitions, adjacent.transitions)
  assert.equal(overlap.components.length, 1)
  assert.equal(overlap.components[0]!.strength, 1, '相对零尾窗不得稀释主组件完整强度')
  assert.equal(earlyBoundary.components.length, 1)
  assert.equal(earlyBoundary.components[0]!.strength, 1, '更早的无效结构提示也不得稀释主组件强度')
  const touchdown = overlap.transitions.find(transition => (
    transition.traversalDirection === 1 && transition.kind === 'touchdown'
  ))
  assert.ok(touchdown && touchdown.resolvedTimeMs < 10 && touchdown.resolvedTimeMs > 9.9999)
})

test('低于信号阈值的微窗提示不改变复合峰值强度与 VFX 阈值侧别', () => {
  const primaryWindows = [
    { id: 'primary-a', startMs: 0, endMs: 60, weight: 1 },
    { id: 'primary-b', startMs: 20, endMs: 80, weight: 1 },
  ] as const
  const jumpHeight = .69
  const expectedPeakStrength = jumpHeight * 560 / 729
  const baseline = analyzeBipedPetBallisticTimeline({
    windows: primaryWindows,
    durationMs: 100,
    loopMode: 'once',
    jumpHeight,
    actionWeight: 1,
  })
  const microWindowVariants = [
    [{ id: 'peak-before', startMs: 39.8, endMs: 40, weight: 7.5e-13 }],
    [{ id: 'peak-exact', startMs: 39.9, endMs: 40.1, weight: 7.5e-13 }],
    [{ id: 'peak-after', startMs: 40, endMs: 40.2, weight: 7.5e-13 }],
    [
      { id: 'multiple-before', startMs: 39.7, endMs: 39.9, weight: 2.5e-13 },
      { id: 'multiple-exact', startMs: 39.95, endMs: 40.05, weight: 2.5e-13 },
      { id: 'multiple-after', startMs: 40.1, endMs: 40.3, weight: 2.5e-13 },
    ],
  ] as const

  assert.equal(baseline.stats.exhausted, false)
  assert.equal(baseline.components.length, 1)
  assert.ok(
    Math.abs(baseline.components[0]!.strength - expectedPeakStrength) <= 1e-12,
    '基线强度必须来自真实复合峰值，不得取决于 proof witness 是否恰好落在峰心',
  )
  for (const microWindows of microWindowVariants) {
    const analysis = analyzeBipedPetBallisticTimeline({
      windows: [...primaryWindows, ...microWindows],
      durationMs: 100,
      loopMode: 'once',
      jumpHeight,
      actionWeight: 1,
    })
    const totalMicroWeight = microWindows.reduce((total, window) => total + window.weight, 0)

    assert.equal(analysis.stats.exhausted, false)
    assert.equal(analysis.components.length, baseline.components.length)
    assert.deepEqual(
      analysis.transitions.map(({ componentIndex, traversalDirection, kind }) => ({
        componentIndex,
        traversalDirection,
        kind,
      })),
      baseline.transitions.map(({ componentIndex, traversalDirection, kind }) => ({
        componentIndex,
        traversalDirection,
        kind,
      })),
      '微窗结构提示不得改变转换拓扑',
    )
    for (let index = 0; index < analysis.transitions.length; index += 1) {
      assert.ok(
        Math.abs(analysis.transitions[index]!.resolvedTimeMs - baseline.transitions[index]!.resolvedTimeMs) <= 1e-9,
        '微窗只能按其真实贡献微扰转换时间',
      )
    }
    assert.ok(
      Math.abs(analysis.components[0]!.strength - baseline.components[0]!.strength)
        <= jumpHeight * totalMicroWeight + 1e-12,
      '强度变化必须受微窗真实复合高度贡献约束',
    )
    for (const vfxThreshold of [.25, .4, .45]) {
      assert.equal(
        analysis.components[0]!.strength > vfxThreshold,
        baseline.components[0]!.strength > vfxThreshold,
        `${String(vfxThreshold)} VFX 阈值侧别不得被微窗提示改变`,
      )
    }
  }
})

test('真实复合峰值在 VFX 强度阈值两侧保持精确判定', () => {
  const windows = [
    { id: 'threshold-a', startMs: 0, endMs: 60, weight: 1 },
    { id: 'threshold-b', startMs: 20, endMs: 80, weight: 1 },
  ] as const
  const normalizedPeak = 560 / 729
  for (const threshold of [.25, .4, .45]) {
    for (const side of [-1, 1] as const) {
      const expectedStrength = threshold + side * 1e-6
      const analysis = analyzeBipedPetBallisticTimeline({
        windows,
        durationMs: 100,
        loopMode: 'once',
        jumpHeight: expectedStrength / normalizedPeak,
        actionWeight: 1,
      })

      assert.equal(analysis.stats.exhausted, false)
      assert.equal(analysis.components.length, 1)
      assert.ok(Math.abs(analysis.components[0]!.strength - expectedStrength) <= 1e-12)
      assert.equal(analysis.components[0]!.strength > threshold, side > 0)
    }
  }
})

test('任意正宽 proven grounded gap 都拆分组件，精确相邻不拆分', () => {
  const first = { id: 'first', startMs: 0, endMs: 10, weight: 1 }
  for (const gapMs of [.001, .1, nextUp(10) - 10]) {
    const analysis = analyze([
      first,
      { id: 'second', startMs: 10 + gapMs, endMs: 20, weight: 1 },
    ])
    assert.equal(analysis.components.length, 2, `${String(gapMs)}ms 正 gap 必须形成两个组件`)
    assert.equal(
      analysis.transitions.filter(transition => transition.traversalDirection === 1).length,
      4,
    )
  }
  assert.equal(analyze([first, { id: 'second', startMs: 10, endMs: 20, weight: 1 }]).components.length, 1)
})

test('同一结构 overlap 区间内部的正宽 composite grounded valley 也拆分组件', () => {
  const analysis = analyzeBipedPetBallisticTimeline({
    windows: [
      { id: 'first', startMs: 0, endMs: 100, weight: 1 },
      { id: 'second', startMs: 99.995, endMs: 199.995, weight: 1 },
    ],
    durationMs: 200,
    loopMode: 'once',
    jumpHeight: 1,
    actionWeight: 1e-4,
  })

  assert.equal(analysis.stats.exhausted, false)
  assert.equal(analysis.components.length, 2, 'overlap 内部的正宽 proven ground valley 不得被首个 airborne witness 吞并')
  const forward = analysis.transitions.filter(transition => transition.traversalDirection === 1)
  assert.deepEqual(forward.map(transition => transition.kind), ['takeoff', 'touchdown', 'takeoff', 'touchdown'])
  assert.ok(forward[1]!.resolvedTimeMs > 99.995 && forward[1]!.resolvedTimeMs < 99.9975)
  assert.ok(forward[2]!.resolvedTimeMs > 99.9975 && forward[2]!.resolvedTimeMs < 100)
})

test('midpoint airborne 的偏心 overlap grounded valley 仍由上下界证明并拆分', () => {
  const analysis = analyzeBipedPetBallisticTimeline({
    windows: [
      { id: 'first', startMs: 0, endMs: 100, weight: 1 },
      { id: 'second', startMs: 99.996, endMs: 150, weight: .8 },
    ],
    durationMs: 150,
    loopMode: 'once',
    jumpHeight: 1,
    actionWeight: .0001074085909395288,
  })

  assert.equal(analysis.stats.exhausted, false)
  assert.equal(analysis.components.length, 2, 'airborne midpoint 只是 witness，不得把偏心 grounded valley 当作整段 air')
  const forward = analysis.transitions.filter(transition => transition.traversalDirection === 1)
  assert.deepEqual(forward.map(transition => transition.kind), ['takeoff', 'touchdown', 'takeoff', 'touchdown'])
  assert.ok(forward[1]!.resolvedTimeMs > 99.996 && forward[1]!.resolvedTimeMs < 99.9969524)
  assert.ok(forward[2]!.resolvedTimeMs > 99.9969524 && forward[2]!.resolvedTimeMs < 99.998)
})

test('once/loop/ping-pong 只映射 canonical 转换且保留遍历方向', () => {
  const windows = [{ id: 'jump', startMs: 20, endMs: 80, weight: 1 }]
  const once = analyze(windows, 'once')
  const loop = analyze(windows, 'loop')
  const ping = analyze(windows, 'ping-pong')
  const forwardTouchdown = once.transitions.find(transition => (
    transition.traversalDirection === 1 && transition.kind === 'touchdown'
  ))!
  const reverseTouchdown = ping.transitions.find(transition => (
    transition.traversalDirection === -1 && transition.kind === 'touchdown'
  ))!

  assert.deepEqual(
    bipedPetBallisticTransitionsInRequestedRange(once, 50, 90).transitions.map(event => event.requestedTimeMs),
    [forwardTouchdown.resolvedTimeMs],
  )
  assert.deepEqual(
    bipedPetBallisticTransitionsInRequestedRange(loop, 150, 190).transitions.map(event => event.requestedTimeMs),
    [100 + forwardTouchdown.resolvedTimeMs],
  )
  const reverseEvents = bipedPetBallisticTransitionsInRequestedRange(ping, 150, 190).transitions
  assert.deepEqual(reverseEvents.map(event => event.requestedTimeMs), [200 - reverseTouchdown.resolvedTimeMs])
  assert.equal(reverseEvents[0]?.traversalDirection, -1)

  const huge = bipedPetBallisticTransitionsInRequestedRange(loop, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1000)
  assert.equal(huge.complete, false)
  assert.deepEqual(huge.transitions, [])
})

test('巨大绝对时间把相邻 canonical 转换舍入为同一时刻时仍保留遍历顺序', () => {
  const windows = [
    { id: 'first', startMs: 20, endMs: 30, weight: 1 },
    { id: 'second', startMs: 30.001, endMs: 40, weight: 1 },
  ]
  const loop = analyze(windows, 'loop')
  const forwardSegmentStartMs = 2 ** 40 * 100
  const forward = bipedPetBallisticTransitionsInRequestedRange(
    loop,
    forwardSegmentStartMs + 29,
    forwardSegmentStartMs + 31,
  ).transitions

  assert.equal(forward.length, 2)
  assert.equal(forward[0]!.requestedTimeMs, forward[1]!.requestedTimeMs, '两个绝对事件会舍入为同一 double')
  assert.deepEqual(forward.map(event => event.kind), ['touchdown', 'takeoff'])

  const ping = analyze(windows, 'ping-pong')
  const reverseSegmentStartMs = (2 ** 40 + 1) * 100
  const reverse = bipedPetBallisticTransitionsInRequestedRange(
    ping,
    reverseSegmentStartMs + 69,
    reverseSegmentStartMs + 71,
  ).transitions

  assert.equal(reverse.length, 2)
  assert.equal(reverse[0]!.requestedTimeMs, reverse[1]!.requestedTimeMs, '反向事件也会舍入为同一 double')
  assert.deepEqual(reverse.map(event => event.kind), ['touchdown', 'takeoff'])
  assert.deepEqual(reverse.map(event => event.traversalDirection), [-1, -1])
})

test('巨大绝对时间先按 canonical 局部区间判定事件，再生成舍入后的 requested 时间', () => {
  const analysis = analyze([
    { id: 'jump', startMs: 20, endMs: 29.001, weight: 1 },
  ], 'loop')
  const segmentStartMs = 2 ** 40 * 100
  const events = bipedPetBallisticTransitionsInRequestedRange(
    analysis,
    segmentStartMs + 29,
    segmentStartMs + 31,
  ).transitions

  assert.equal(events.length, 1, 'canonical touchdown 严格位于局部 (29, 31]，不得因绝对时间向下舍入而丢失')
  assert.equal(events[0]!.kind, 'touchdown')
  assert.equal(events[0]!.requestedTimeMs, segmentStartMs + 29)
})

test('超安全整数的 iteration 锚与 canonical 余数不一致时保守返回 incomplete', () => {
  const analysis = analyze([
    { id: 'unrepresentable-anchor', startMs: 1, endMs: 3, weight: 1 },
  ], 'loop')
  const previousRequestedTimeMs = 112589990684259900
  const requestedTimeMs = 112589990684259920
  const mapped = bipedPetBallisticTransitionsInRequestedRange(
    analysis,
    previousRequestedTimeMs,
    requestedTimeMs,
  )

  assert.equal(mapped.complete, false)
  assert.deepEqual(mapped.transitions, [])
  assert.equal(
    classifyBipedPetBallisticRequestedRange(analysis, previousRequestedTimeMs, requestedTimeMs),
    'unknown',
    '不可表示锚的 requested range 也不得伪称 proven airborne',
  )
})

test('普通 loop 端点使用 resolver canonical modulo 而不是容差内的 raw subtraction', () => {
  const windowStartMs = 1000.1234565003246
  const analysis = analyzeBipedPetBallisticTimeline({
    windows: [{ id: 'canonical-endpoint', startMs: windowStartMs, endMs: windowStartMs + 1, weight: 1 }],
    durationMs: 4093,
    loopMode: 'loop',
    jumpHeight: 1,
    actionWeight: 1,
  })
  const mapped = bipedPetBallisticTransitionsInRequestedRange(analysis, 999, 1000.123456789)

  assert.equal(mapped.complete, true)
  assert.deepEqual(mapped.transitions, [], 'takeoff 位于 resolver current 之后，不得被 raw subtraction 越界包含')
})

test('exact seam 的上一 segment 终点保持 canonical duration 侧别', () => {
  for (const loopMode of ['loop', 'ping-pong'] as const) {
    const analysis = analyze([
      { id: 'next', startMs: 0, endMs: 10, weight: 1 },
      { id: 'previous', startMs: 90, endMs: 100, weight: 1 },
    ], loopMode)

    assert.equal(
      classifyBipedPetBallisticRequestedRange(analysis, 99, 100),
      'airborne',
      `${loopMode} 的上一 segment localEnd 必须保留 duration 而不是 modulo 0`,
    )
    assert.deepEqual(
      bipedPetBallisticTransitionsInRequestedRange(analysis, 99, 100).transitions,
      [],
      `${loopMode} 的连续 seam 不产生转换`,
    )
  }
})

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
  })

  assert.equal(classifyBipedPetBallisticRequestedRange(analysis, 10, 84), 'grounded')
  assert.equal(analysis.stats.maximumWorkUnits, MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.ok(analysis.stats.workUnits > 0
    && analysis.stats.workUnits <= MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.boundaryCount, 129, '结构边界只覆盖动作窗口，不得混入 84ms 请求端点')
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
  })

  assert.equal(analysis.stats.workUnits, MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.exhausted, true)
  assert.deepEqual(analysis.components, [])
  assert.deepEqual(analysis.transitions, [], 'unknown 分析不得泄露部分转换')
  assert.equal(classifyBipedPetBallisticRequestedRange(analysis, 0, 100), 'unknown')
})
