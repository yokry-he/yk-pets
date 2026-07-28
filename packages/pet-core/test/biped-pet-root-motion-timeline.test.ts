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
import { sampleBipedPetRootMotion } from '../src/motion/biped-pet-root-motion.ts'

interface TestBallisticWindow {
  readonly id: string
  readonly startMs: number
  readonly endMs: number
  readonly weight: number
}

const MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS = 192

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
  windows: readonly TestBallisticWindow[],
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

function referenceCompositePeakStrength(
  windows: readonly TestBallisticWindow[],
  jumpHeight: number,
  actionWeight: number,
): number {
  const totalWeight = windows.reduce((total, window) => total + window.weight, 0)
  const supportStartMs = Math.min(...windows.map(window => window.startMs))
  const supportEndMs = Math.max(...windows.map(window => window.endMs))
  const heightAt = (timeMs: number) => {
    const weightedHeight = windows.reduce((total, window) => {
      const linearProgress = Math.max(0, Math.min(1, (timeMs - window.startMs) / (window.endMs - window.startMs)))
      const progress = linearProgress * linearProgress * (3 - 2 * linearProgress)
      return total + window.weight * 4 * progress * (1 - progress)
    }, 0)
    return weightedHeight / totalWeight
  }
  const samples = 20_000
  const stepMs = (supportEndMs - supportStartMs) / samples
  let bestIndex = 0
  let bestHeight = 0
  for (let index = 0; index <= samples; index += 1) {
    const height = heightAt(supportStartMs + stepMs * index)
    if (height > bestHeight) {
      bestHeight = height
      bestIndex = index
    }
  }
  let leftMs = supportStartMs + stepMs * Math.max(0, bestIndex - 2)
  let rightMs = supportStartMs + stepMs * Math.min(samples, bestIndex + 2)
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const firstMs = leftMs + (rightMs - leftMs) / 3
    const secondMs = rightMs - (rightMs - leftMs) / 3
    if (heightAt(firstMs) < heightAt(secondMs)) leftMs = firstMs
    else rightMs = secondMs
  }
  bestHeight = Math.max(bestHeight, heightAt(leftMs), heightAt(rightMs), heightAt((leftMs + rightMs) * .5))
  return Math.max(0, Math.min(1, bestHeight * jumpHeight * actionWeight))
}

const representativeOffsetOverlapCases = Object.freeze([
  Object.freeze({
    name: '2-window-analytic',
    windows: Object.freeze([
      Object.freeze({ id: 'a', startMs: 0, endMs: 20, weight: 1 }),
      Object.freeze({ id: 'b', startMs: 10, endMs: 30, weight: 1 }),
    ]),
    expectedStrength: .3638671875,
  }),
  Object.freeze({
    name: '3-window-seeded',
    windows: Object.freeze([
      Object.freeze({ id: 'a', startMs: 4.610589128686115, endMs: 43.79479029099457, weight: .9148315281141549 }),
      Object.freeze({ id: 'b', startMs: 16.45487498724833, endMs: 55.0972313019447, weight: .48598238304257396 }),
      Object.freeze({ id: 'c', startMs: 30.838873620377854, endMs: 58.31329605472274, weight: .931716621434316 }),
    ]),
  }),
  Object.freeze({
    name: '4-window-seeded',
    windows: Object.freeze([
      Object.freeze({ id: 'a', startMs: 4.4333891870919615, endMs: 45.39904362545349, weight: .7202611952554434 }),
      Object.freeze({ id: 'b', startMs: 12.871700086941322, endMs: 39.063388455969594, weight: .8441144871525467 }),
      Object.freeze({ id: 'c', startMs: 21.708508548714843, endMs: 54.15464292598578, weight: .896370590897277 }),
      Object.freeze({ id: 'd', startMs: 31.99727036850527, endMs: 55.119538047816604, weight: .6199079547077417 }),
    ]),
  }),
  Object.freeze({
    name: '5-window-seeded',
    windows: Object.freeze([
      Object.freeze({ id: 'a', startMs: 2.3263431212399155, endMs: 44.273581713670865, weight: .4611827674787492 }),
      Object.freeze({ id: 'b', startMs: 11.93839174322784, endMs: 42.10239333007485, weight: .683881179150194 }),
      Object.freeze({ id: 'c', startMs: 18.306828801287338, endMs: 59.76460696826689, weight: .48774253283627333 }),
      Object.freeze({ id: 'd', startMs: 23.905550407711416, endMs: 52.576215501409024, weight: .8060933940112591 }),
      Object.freeze({ id: 'e', startMs: 32.74153687362559, endMs: 57.2267072473187, weight: .7881289293523879 }),
    ]),
  }),
  Object.freeze({
    name: '6-window-seeded',
    windows: Object.freeze([
      Object.freeze({ id: 'a', startMs: 4.78183579700999, endMs: 39.70331560703926, weight: .7270644527394325 }),
      Object.freeze({ id: 'b', startMs: 8.09918443756178, endMs: 41.326760709192605, weight: .5834468726068736 }),
      Object.freeze({ id: 'c', startMs: 13.436333699198439, endMs: 35.82874837522395, weight: .6627991245593876 }),
      Object.freeze({ id: 'd', startMs: 21.072239991463718, endMs: 56.27220711410045, weight: .999884991068393 }),
      Object.freeze({ id: 'e', startMs: 24.931994502758606, endMs: 65.98471576473676, weight: .8673986090812832 }),
      Object.freeze({ id: 'f', startMs: 31.05710903322324, endMs: 60.5353079312481, weight: .8122628284618258 }),
    ]),
  }),
] satisfies readonly {
  readonly name: string
  readonly windows: readonly TestBallisticWindow[]
  readonly expectedStrength?: number
}[])

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

test('2/3/4/5/6 个常规错峰窗口在固定预算内求得真峰且帧细分不改变单次落地', () => {
  for (const fixture of representativeOffsetOverlapCases) {
    const analysis = analyzeBipedPetBallisticTimeline({
      windows: fixture.windows,
      durationMs: 100,
      loopMode: 'once',
      jumpHeight: .69,
      actionWeight: 1,
    })
    const expectedStrength = fixture.expectedStrength
      ?? referenceCompositePeakStrength(fixture.windows, .69, 1)

    assert.equal(analysis.stats.exhausted, false, `${fixture.name} 不得耗尽正常输入预算`)
    assert.ok(analysis.stats.workUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
    assert.equal(analysis.components.length, 1)
    assert.ok(Math.abs(analysis.components[0]!.strength - expectedStrength) <= 2e-12, `${fixture.name} 必须返回复合真峰`)
    const forwardTransitions = analysis.transitions.filter(transition => transition.traversalDirection === 1)
    assert.deepEqual(forwardTransitions.map(transition => transition.kind), ['takeoff', 'touchdown'])
    assert.equal(forwardTransitions.filter(transition => transition.kind === 'touchdown').length, 1)

    const direct = bipedPetBallisticTransitionsInRequestedRange(analysis, 0, 100)
    const subdivided = [[0, 17], [17, 34], [34, 51], [51, 68], [68, 85], [85, 100]]
      .flatMap(([startMs, endMs]) => (
        bipedPetBallisticTransitionsInRequestedRange(analysis, startMs!, endMs!).transitions
      ))
    assert.equal(direct.complete, true)
    assert.deepEqual(subdivided, direct.transitions, `${fixture.name} 的转换信号不得依赖请求帧细分`)
  }
})

test('Bernstein 局部限制与全局权重归一化复原错峰复合曲线峰值', () => {
  const windows = [
    { id: 'long', startMs: 0, endMs: 41, weight: 1 },
    { id: 'short', startMs: 7, endMs: 32, weight: .37 },
    { id: 'late', startMs: 19, endMs: 58, weight: .63 },
  ] as const
  const jumpHeight = .83
  const actionWeight = .71
  const expectedStrength = referenceCompositePeakStrength(windows, jumpHeight, actionWeight)
  const analyzeWeighted = (weightScale: number) => analyzeBipedPetBallisticTimeline({
    windows: windows.map(window => ({ ...window, weight: window.weight * weightScale })),
    durationMs: 100,
    loopMode: 'once',
    jumpHeight,
    actionWeight,
  })
  const baseline = analyzeWeighted(1)
  const uniformlyScaled = analyzeWeighted(.125)

  assert.equal(baseline.stats.exhausted, false)
  assert.ok(baseline.stats.workUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
  assert.ok(Math.abs(baseline.components[0]!.strength - expectedStrength) <= 2e-12)
  assert.equal(uniformlyScaled.stats.exhausted, false)
  assert.ok(Math.abs(uniformlyScaled.components[0]!.strength - expectedStrength) <= 2e-12)
  assert.equal(uniformlyScaled.components[0]!.strength, baseline.components[0]!.strength)
})

test('固定种子 2–6 窗常规错峰代表集具有确定性非耗尽预算上界', () => {
  let randomState = 0x51a7c0de
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 0x1_0000_0000
  }
  let maximumObservedWorkUnits = 0
  for (let windowCount = 2; windowCount <= 6; windowCount += 1) {
    for (let fixtureIndex = 0; fixtureIndex < 8; fixtureIndex += 1) {
      const windows = Array.from({ length: windowCount }, (_, index) => {
        const startMs = 2 + index * (24 / (windowCount - 1)) + random() * 2
        return Object.freeze({
          id: `seeded-${windowCount}-${fixtureIndex}-${index}`,
          startMs,
          endMs: startMs + 32 + random() * 18,
          weight: .4 + random() * .6,
        })
      })
      const input = {
        windows,
        durationMs: 100,
        loopMode: 'once' as const,
        jumpHeight: .69,
        actionWeight: 1,
      }
      const first = analyzeBipedPetBallisticTimeline(input)
      const repeated = analyzeBipedPetBallisticTimeline(input)

      assert.deepEqual(repeated, first, '同一固定种子输入必须保持确定预算与结果')
      assert.equal(first.stats.exhausted, false, `${windowCount} 窗固定种子案例 ${fixtureIndex} 不得耗尽`)
      assert.ok(first.stats.workUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
      assert.equal(first.components.length, 1)
      assert.equal(first.transitions.filter(transition => (
        transition.traversalDirection === 1 && transition.kind === 'touchdown'
      )).length, 1)
      maximumObservedWorkUnits = Math.max(maximumObservedWorkUnits, first.stats.workUnits)
    }
  }
  assert.ok(maximumObservedWorkUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
})

test('2/3/4/5/6 个常规错峰窗口的授权与冲量在独立帧和细分帧中一致', () => {
  const run = (fixture: typeof representativeOffsetOverlapCases[number], stepMs: number) => {
    const definition = {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: .69,
      windows: fixture.windows.map(window => ({ ...window, kind: 'ballistic' as const })),
      vfxTags: [] as const,
    }
    const base = {
      definition,
      durationMs: 100,
      loopMode: 'once' as const,
      characterHeight: 4,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: [0, 0, 0] as const,
    }
    let previous = sampleBipedPetRootMotion({ ...base, requestedTimeMs: 0 })
    const impulses: number[] = []
    const authorizationImpulses = new Set<number>()
    for (let requestedTimeMs = stepMs; requestedTimeMs <= 100; requestedTimeMs += stepMs) {
      previous = sampleBipedPetRootMotion({
        ...base,
        requestedTimeMs,
        previousRequestedTimeMs: previous.requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        previousLandingAuthorization: previous.landingAuthorization,
      })
      if (previous.landingAuthorization) authorizationImpulses.add(previous.landingAuthorization.impulse)
      if (previous.landingImpulse > 0) impulses.push(previous.landingImpulse)
    }
    return Object.freeze({ impulses, authorizationImpulses: [...authorizationImpulses] })
  }

  for (const fixture of representativeOffsetOverlapCases) {
    const expectedStrength = fixture.expectedStrength
      ?? referenceCompositePeakStrength(fixture.windows, .69, 1)
    const independentFrames = run(fixture, 20)
    const subdividedFrames = run(fixture, 5)

    assert.equal(independentFrames.impulses.length, 1, `${fixture.name} 的独立帧必须消费一次落地冲量`)
    assert.equal(subdividedFrames.impulses.length, 1, `${fixture.name} 的细分帧必须消费一次落地冲量`)
    assert.ok(Math.abs(independentFrames.impulses[0]! - expectedStrength) <= 2e-12)
    assert.deepEqual(subdividedFrames.impulses, independentFrames.impulses, `${fixture.name} 的落地冲量不得依赖帧细分`)
    assert.ok(
      [...independentFrames.authorizationImpulses, ...subdividedFrames.authorizationImpulses]
        .every(impulse => Math.abs(impulse - expectedStrength) <= 2e-12),
      `${fixture.name} 若跨帧保留授权，其强度必须与最终冲量一致`,
    )
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
