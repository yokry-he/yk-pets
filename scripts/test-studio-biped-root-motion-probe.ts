/**
 * 文件职责 / File responsibility
 * 以固定种子复现双足萌宠 Root Motion 的有状态、ULP、帧细分不变性、规范化成本与连续弹道热路径探针。
 */

import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import {
  BIPED_PET_ROOT_MOTION_REFERENCE_SPEED_BODY_HEIGHTS_PER_SECOND,
  deriveBipedPetMotionVfxSignals,
  normalizeBipedPetRootMotion,
  sampleBipedPetRootMotion,
  type BipedPetLandingAuthorization,
  type BipedPetRootMotionDefinition,
  type SampleBipedPetRootMotionInput,
  type SampledBipedPetRootMotion,
} from '../packages/pet-core/src/index.ts'
import {
  BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON,
  MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS,
  analyzeBipedPetBallisticTimeline,
  classifyBipedPetBallisticRequestedRange,
} from '../packages/pet-core/src/motion/biped-pet-root-motion-timeline.ts'

const STATEFUL_PROBE_CASES = 10_000
const ULP_PROBES_PER_DIRECTION = 21
const BENCHMARK_ITERATIONS = 100_000
const BALLISTIC_HOT_PATH_ITERATIONS = 2_000
const MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS = 192

function assertFiniteSample(sample: SampledBipedPetRootMotion) {
  const vectors = [
    sample.cumulativeLocal,
    sample.cumulativeWorld,
    sample.appliedLocal,
    sample.appliedWorld,
    sample.deltaLocal,
    sample.deltaWorld,
    sample.linearVelocity,
  ]
  const values = [
    sample.requestedTimeMs,
    sample.resolvedTimeMs,
    sample.iteration,
    ...vectors.flat(),
    sample.cumulativeTurnRadians,
    sample.appliedTurnRadians,
    sample.deltaTurnRadians,
    sample.angularVelocity,
    sample.motionIntensity,
    sample.landingImpulse,
    sample.brakeIntensity,
    ...(sample.landingAuthorization
      ? [sample.landingAuthorization.touchdownRequestedTimeMs, sample.landingAuthorization.impulse]
      : []),
  ]
  assert.ok(values.every(Number.isFinite), 'Root Motion 探针不得产生非有限输出')
}

function sampleDeterministically(input: SampleBipedPetRootMotionInput): SampledBipedPetRootMotion {
  const first = sampleBipedPetRootMotion(input)
  const repeated = sampleBipedPetRootMotion(input)
  assertFiniteSample(first)
  assert.deepEqual(repeated, first, '相同 Root Motion 输入必须产生确定性输出')
  return first
}

function runStatefulProbe() {
  const durationMs = 200
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: .4,
    turnRadians: 1,
    verticalMode: 'ballistic',
    jumpHeight: .8,
    windows: [
      { id: 'burst', kind: 'travel', startMs: 0, endMs: 12, weight: 1 },
      { id: 'warp', kind: 'warp', startMs: 8, endMs: 150, weight: .6 },
      { id: 'jump-main', kind: 'ballistic', startMs: 20, endMs: 100, weight: 1 },
      { id: 'jump-overlap', kind: 'ballistic', startMs: 40, endMs: 70, weight: .01 },
      { id: 'brake', kind: 'brake', startMs: 110, endMs: 190, weight: 1 },
    ],
    vfxTags: [],
  }, durationMs).value
  const counts = { solved: 0, clamped: 0, reset: 0, blocked: 0, seam: 0, landing: 0, brake: 0 }
  let randomState = 0x6d2b79f5
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 0x1_0000_0000
  }
  let requestedTimeMs = 0
  let previousRequestedTimeMs: number | undefined
  let previousAppliedWorld: readonly [number, number, number] | undefined
  let previousAppliedTurnRadians: number | undefined
  let previousLandingAuthorization: BipedPetLandingAuthorization | undefined
  let previousIteration = 0
  const startedAt = performance.now()
  for (let index = 0; index < STATEFUL_PROBE_CASES; index += 1) {
    if (index > 0) requestedTimeMs += 7 + Math.floor(random() * 34)
    const forceReset = index % 991 === 0
    const forceBlocked = index % 997 === 0
    const input: SampleBipedPetRootMotionInput = {
      definition,
      requestedTimeMs,
      ...(forceReset || previousRequestedTimeMs === undefined
        ? {}
        : {
            previousRequestedTimeMs,
            previousAppliedWorld,
            previousAppliedTurnRadians,
            previousLandingAuthorization,
          }),
      durationMs,
      loopMode: 'loop',
      characterHeight: 4,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: forceBlocked
        ? [Number.NaN, 0, 0]
        : [(random() - .5) * 10, 0, (random() - .5) * 10],
    }
    const sample = sampleDeterministically(input)
    counts[sample.status] += 1
    if (sample.iteration !== previousIteration) counts.seam += 1
    if (sample.landingImpulse > 0) counts.landing += 1
    if (sample.brakeIntensity > 0) counts.brake += 1
    previousIteration = sample.iteration
    previousRequestedTimeMs = requestedTimeMs
    previousAppliedWorld = sample.appliedWorld
    previousAppliedTurnRadians = sample.appliedTurnRadians
    previousLandingAuthorization = sample.landingAuthorization
  }
  const elapsedMs = performance.now() - startedAt
  assert.ok(counts.solved > 500, JSON.stringify(counts))
  assert.ok(counts.clamped > 100, JSON.stringify(counts))
  assert.ok(counts.reset >= 10, JSON.stringify(counts))
  assert.ok(counts.blocked >= 10, JSON.stringify(counts))
  assert.ok(counts.seam > 500, JSON.stringify(counts))
  assert.ok(counts.landing > 100, JSON.stringify(counts))
  assert.equal(counts.brake, 3_722, `制动信号必须只由时间窗调制实际水平速度：${JSON.stringify(counts)}`)
  return { logicalCases: STATEFUL_PROBE_CASES, counts, elapsedMs }
}

const floatBuffer = new ArrayBuffer(8)
const floatView = new DataView(floatBuffer)

function nextDown(value: number): number {
  assert.ok(Number.isFinite(value) && value > 0)
  floatView.setFloat64(0, value)
  floatView.setBigUint64(0, floatView.getBigUint64(0) - 1n)
  return floatView.getFloat64(0)
}

function nextUp(value: number): number {
  assert.ok(Number.isFinite(value) && value >= 0)
  floatView.setFloat64(0, value)
  floatView.setBigUint64(0, floatView.getBigUint64(0) + 1n)
  return floatView.getFloat64(0)
}

function addUlps(value: number, count: number): number {
  let result = value
  for (let index = 0; index < count; index += 1) result = nextUp(result)
  return result
}

function ulpWindow(endMs: number): { startMs: number; midpointMs: number } {
  let startMs = endMs
  for (let index = 0; index < 8; index += 1) startMs = nextDown(startMs)
  const midpointMs = startMs + (endMs - startMs) * .5
  assert.ok(startMs < midpointMs && midpointMs < endMs, 'ULP 探针必须拥有可表示的窗内中点')
  return { startMs, midpointMs }
}

function runUlpLandingProbe(
  direction: 'forward' | 'reverse',
  definition: BipedPetRootMotionDefinition,
  startMs: number,
  endMs: number,
  midpointMs: number,
): number {
  const durationMs = 1200
  const loopMode = direction === 'forward' ? 'once' : 'ping-pong'
  const initialRequestedTimeMs = direction === 'forward' ? midpointMs : durationMs * 2 - midpointMs
  const touchdownRequestedTimeMs = direction === 'forward' ? endMs : durationMs * 2 - startMs
  const base = {
    definition,
    durationMs,
    loopMode,
    characterHeight: 4,
    facingRadians: Math.PI / 7,
    actionWeight: 1,
    footResidual: [0, 0, 0] as const,
  }
  let previous = sampleDeterministically({ ...base, requestedTimeMs: initialRequestedTimeMs })
  assert.ok(previous.appliedWorld[1] > 0, `${direction} ULP 探针必须从真实空中态开始`)
  let previousRequestedTimeMs = initialRequestedTimeMs
  let impulseCount = 0
  for (let offset = 0; offset < 8; offset += 1) {
    const requestedTimeMs = touchdownRequestedTimeMs + offset
    previous = sampleDeterministically({
      ...base,
      requestedTimeMs,
      previousRequestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
    })
    if (previous.landingImpulse > 0) impulseCount += 1
    previousRequestedTimeMs = requestedTimeMs
  }
  assert.equal(previous.phase, 'grounded')
  assert.equal(impulseCount, 1, `${direction} ULP applied touchdown 必须且只能消费一次`)
  return impulseCount
}

function runUlpProbes() {
  const startedAt = performance.now()
  let completed = 0
  let impulses = 0
  for (let index = 0; index < ULP_PROBES_PER_DIRECTION; index += 1) {
    // 选在与反向绝对请求时间 ULP 同量级的区间，确保 8 ULP 窗在 ping-pong 映射后仍有可表示内点。
    const endMs = 700 + index * 10
    const { startMs, midpointMs } = ulpWindow(endMs)
    const definition = normalizeBipedPetRootMotion({
      mode: 'travel',
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic',
      jumpHeight: .8,
      windows: [{ id: `ulp-${index}`, kind: 'ballistic', startMs, endMs, weight: 1 }],
      vfxTags: [],
    }, 1200).value
    impulses += runUlpLandingProbe('forward', definition, startMs, endMs, midpointMs)
    impulses += runUlpLandingProbe('reverse', definition, startMs, endMs, midpointMs)
    completed += 2
  }
  assert.equal(completed, 42)
  assert.equal(impulses, 42)
  return { probes: completed, impulses, elapsedMs: performance.now() - startedAt }
}

function runBallisticTimelineProbe() {
  const tails = []
  for (let index = 0; index < 31; index += 1) {
    const centerMs = 20 + index * 2
    const firstStartMs = addUlps(centerMs, 1)
    const firstEndMs = addUlps(firstStartMs, 8)
    const secondStartMs = addUlps(firstEndMs, 8)
    const secondEndMs = addUlps(secondStartMs, 8)
    tails.push(
      { id: `tail-a-${index}`, kind: 'ballistic' as const, startMs: firstStartMs, endMs: firstEndMs, weight: 7.5e-9 },
      { id: `tail-b-${index}`, kind: 'ballistic' as const, startMs: secondStartMs, endMs: secondEndMs, weight: 7.5e-9 },
    )
  }
  const lastStartMs = addUlps(83, 1)
  tails.push({
    id: 'tail-last',
    kind: 'ballistic' as const,
    startMs: lastStartMs,
    endMs: addUlps(lastStartMs, 8),
    weight: 7.5e-9,
  })
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows: [{ id: 'main', kind: 'ballistic', startMs: 0, endMs: 10, weight: 1 }, ...tails],
    vfxTags: [],
  }, 100).value
  assert.equal(definition.windows.length, 64, '共享时间线探针必须命中合法窗口上限')
  const analysis = analyzeBipedPetBallisticTimeline({
    windows: definition.windows,
    durationMs: 100,
    loopMode: 'once',
    jumpHeight: definition.jumpHeight,
    actionWeight: 1e-4,
  })
  assert.equal(classifyBipedPetBallisticRequestedRange(analysis, 10, 84), 'grounded')
  assert.ok(analysis.stats.workUnits > 0
    && analysis.stats.workUnits <= MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.maximumWorkUnits, MAX_BIPED_PET_BALLISTIC_TIMELINE_WORK_UNITS)
  assert.equal(analysis.stats.boundaryCount, 129, '请求端点不得进入 64 窗 canonical 结构边界')
  assert.equal(analysis.stats.supportComponentCount, 64)
  assert.equal(analysis.stats.exhausted, false)

  const base = {
    definition,
    durationMs: 100,
    loopMode: 'once' as const,
    characterHeight: 4,
    facingRadians: 0,
    footResidual: [0, 0, 0] as const,
  }
  let maximumTailHeight = 0
  for (const tail of tails) {
    const midpointMs = tail.startMs + (tail.endMs - tail.startMs) * .5
    maximumTailHeight = Math.max(maximumTailHeight, sampleDeterministically({
      ...base,
      actionWeight: 1e-4,
      requestedTimeMs: midpointMs,
    }).cumulativeWorld[1])
  }
  assert.ok(maximumTailHeight > 0 && maximumTailHeight < 4e-12)

  const startedAt = performance.now()
  let previous = sampleDeterministically({ ...base, actionWeight: 1, requestedTimeMs: 5 })
  let signedImpulse = 0
  let signedTouchdownRequestedTimeMs: number | undefined
  for (const requestedTimeMs of [10, 84, 85, 86]) {
    previous = sampleDeterministically({
      ...base,
      actionWeight: requestedTimeMs === 10 ? 1 : 1e-4,
      requestedTimeMs,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
    })
    if (requestedTimeMs === 10) {
      signedImpulse = previous.landingAuthorization?.impulse ?? 0
      signedTouchdownRequestedTimeMs = previous.landingAuthorization?.touchdownRequestedTimeMs
      assert.ok(signedTouchdownRequestedTimeMs !== undefined
        && signedTouchdownRequestedTimeMs < 10 && signedTouchdownRequestedTimeMs > 9.9999)
    }
    if (requestedTimeMs === 84 || requestedTimeMs === 85) {
      assert.equal(previous.landingAuthorization?.touchdownRequestedTimeMs, signedTouchdownRequestedTimeMs)
    }
  }
  assert.ok(signedImpulse > 0)
  assert.equal(previous.landingImpulse, signedImpulse)
  assert.equal(previous.landingAuthorization, undefined)

  const highDefinition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows: [
      { id: 'main', kind: 'ballistic', startMs: 0, endMs: 10, weight: 1 },
      { id: 'later-high', kind: 'ballistic', startMs: 80, endMs: 100, weight: 1 },
    ],
    vfxTags: [],
  }, 120).value
  const highBase = { ...base, definition: highDefinition, durationMs: 120 }
  let highPrevious = sampleDeterministically({ ...highBase, actionWeight: 1, requestedTimeMs: 5 })
  highPrevious = sampleDeterministically({
    ...highBase,
    actionWeight: 1,
    requestedTimeMs: 10,
    previousRequestedTimeMs: 5,
    previousAppliedWorld: highPrevious.appliedWorld,
    previousAppliedTurnRadians: highPrevious.appliedTurnRadians,
  })
  assert.ok(highPrevious.landingAuthorization)
  const laterAirborne = sampleDeterministically({
    ...highBase,
    actionWeight: 1,
    requestedTimeMs: 90,
    previousRequestedTimeMs: 10,
    previousAppliedWorld: highPrevious.appliedWorld,
    previousAppliedTurnRadians: highPrevious.appliedTurnRadians,
    previousLandingAuthorization: highPrevious.landingAuthorization,
  })
  assert.ok(laterAirborne.cumulativeWorld[1] > 0)
  assert.equal(laterAirborne.landingAuthorization, undefined, '后续可证明的真实腾空必须清除旧授权')
  assert.equal(laterAirborne.landingImpulse, 0)

  return {
    windows: definition.windows.length,
    maximumTailHeight,
    signedImpulse,
    analysis: analysis.stats,
    elapsedMs: performance.now() - startedAt,
  }
}

function runCompositePeakStabilityProbe() {
  const primaryWindows = [
    { id: 'primary-a', startMs: 0, endMs: 60, weight: 1 },
    { id: 'primary-b', startMs: 20, endMs: 80, weight: 1 },
  ] as const
  const jumpHeight = .69
  const expectedPeakStrength = jumpHeight * 560 / 729
  const analyze = (microWindows: readonly {
    readonly id: string
    readonly startMs: number
    readonly endMs: number
    readonly weight: number
  }[]) => analyzeBipedPetBallisticTimeline({
    windows: [...primaryWindows, ...microWindows],
    durationMs: 100,
    loopMode: 'once',
    jumpHeight,
    actionWeight: 1,
  })
  const baseline = analyze([])
  const variants = [
    [{ id: 'before', startMs: 39.8, endMs: 40, weight: 7.5e-13 }],
    [{ id: 'exact', startMs: 39.9, endMs: 40.1, weight: 7.5e-13 }],
    [{ id: 'after', startMs: 40, endMs: 40.2, weight: 7.5e-13 }],
    [
      { id: 'multiple-before', startMs: 39.7, endMs: 39.9, weight: 2.5e-13 },
      { id: 'multiple-exact', startMs: 39.95, endMs: 40.05, weight: 2.5e-13 },
      { id: 'multiple-after', startMs: 40.1, endMs: 40.3, weight: 2.5e-13 },
    ],
  ] as const
  const baselineStrength = baseline.components[0]?.strength
  assert.ok(baselineStrength !== undefined && Math.abs(baselineStrength - expectedPeakStrength) <= 1e-12)
  let maximumStrengthDelta = 0
  let maximumTransitionTimeDeltaMs = 0
  for (const microWindows of variants) {
    const totalMicroWeight = microWindows.reduce((total, window) => total + window.weight, 0)
    assert.ok(totalMicroWeight < BIPED_PET_ROOT_MOTION_SIGNAL_EPSILON)
    const analysis = analyze(microWindows)
    assert.equal(analysis.stats.exhausted, false)
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
    )
    const strength = analysis.components[0]?.strength
    assert.ok(strength !== undefined)
    maximumStrengthDelta = Math.max(maximumStrengthDelta, Math.abs(strength - baselineStrength))
    assert.ok(Math.abs(strength - baselineStrength) <= jumpHeight * totalMicroWeight + 1e-12)
    for (let index = 0; index < analysis.transitions.length; index += 1) {
      maximumTransitionTimeDeltaMs = Math.max(
        maximumTransitionTimeDeltaMs,
        Math.abs(analysis.transitions[index]!.resolvedTimeMs - baseline.transitions[index]!.resolvedTimeMs),
      )
    }
  }
  assert.ok(maximumTransitionTimeDeltaMs <= 1e-9)
  assert.ok([.25, .4, .45].every(threshold => baselineStrength > threshold))
  return {
    cases: variants.length,
    expectedPeakStrength,
    baselineStrength,
    maximumStrengthDelta,
    maximumTransitionTimeDeltaMs,
  }
}

function runOffsetOverlapBudgetProbe() {
  const analytic = analyzeBipedPetBallisticTimeline({
    windows: [
      { id: 'analytic-a', startMs: 0, endMs: 20, weight: 1 },
      { id: 'analytic-b', startMs: 10, endMs: 30, weight: 1 },
    ],
    durationMs: 100,
    loopMode: 'once',
    jumpHeight: .69,
    actionWeight: 1,
  })
  assert.equal(analytic.stats.exhausted, false)
  assert.ok(analytic.stats.workUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
  assert.ok(Math.abs(analytic.components[0]!.strength - .3638671875) <= 1e-12)

  let randomState = 0x51a7c0de
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 0x1_0000_0000
  }
  const maximumWorkUnitsByWindowCount: Record<string, number> = {}
  let cases = 0
  let exhaustedCases = 0
  let maximumWorkUnits = analytic.stats.workUnits
  for (let windowCount = 2; windowCount <= 6; windowCount += 1) {
    let windowCountMaximum = 0
    for (let fixtureIndex = 0; fixtureIndex < 8; fixtureIndex += 1) {
      const windows = Array.from({ length: windowCount }, (_, index) => {
        const startMs = 2 + index * (24 / (windowCount - 1)) + random() * 2
        return {
          id: `probe-${windowCount}-${fixtureIndex}-${index}`,
          startMs,
          endMs: startMs + 32 + random() * 18,
          weight: .4 + random() * .6,
        }
      })
      const input = {
        windows,
        durationMs: 100,
        loopMode: 'once' as const,
        jumpHeight: .69,
        actionWeight: 1,
      }
      const analysis = analyzeBipedPetBallisticTimeline(input)
      assert.deepEqual(analyzeBipedPetBallisticTimeline(input), analysis, '错峰预算与结果必须确定')
      cases += 1
      if (analysis.stats.exhausted) exhaustedCases += 1
      maximumWorkUnits = Math.max(maximumWorkUnits, analysis.stats.workUnits)
      windowCountMaximum = Math.max(windowCountMaximum, analysis.stats.workUnits)
      assert.equal(analysis.stats.exhausted, false)
      assert.ok(analysis.stats.workUnits <= MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS)
      assert.equal(analysis.components.length, 1)
      assert.equal(analysis.transitions.filter(transition => (
        transition.traversalDirection === 1 && transition.kind === 'touchdown'
      )).length, 1)
    }
    maximumWorkUnitsByWindowCount[String(windowCount)] = windowCountMaximum
  }
  assert.equal(exhaustedCases, 0)
  return {
    cases,
    exhaustedCases,
    maximumWorkUnits,
    maximumWorkUnitsByWindowCount,
    deterministicWorkUnitLimit: MAX_REGULAR_OFFSET_OVERLAP_WORK_UNITS,
  }
}

function runFrameSubdivisionProbe() {
  const sequence = (
    loopMode: 'once' | 'loop' | 'ping-pong',
    continuationWeight: number,
    requestedTimes: readonly number[],
  ) => {
    const definition = normalizeBipedPetRootMotion({
      mode: 'travel',
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic',
      jumpHeight: 1,
      windows: [
        { id: 'main', kind: 'ballistic', startMs: 0, endMs: 10, weight: 1 },
        { id: 'adjacent', kind: 'ballistic', startMs: 10, endMs: 20, weight: continuationWeight },
      ],
      vfxTags: [],
    }, 100).value
    const base = {
      definition,
      durationMs: 100,
      loopMode,
      characterHeight: 4,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: [0, 0, 0] as const,
    }
    let previous = sampleDeterministically({ ...base, requestedTimeMs: 5 })
    let totalImpulse = 0
    const authorizationTimes = new Set<number>()
    for (const requestedTimeMs of requestedTimes) {
      previous = sampleDeterministically({
        ...base,
        requestedTimeMs,
        previousRequestedTimeMs: previous.requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        previousLandingAuthorization: previous.landingAuthorization,
      })
      totalImpulse += previous.landingImpulse
      if (previous.landingAuthorization) {
        authorizationTimes.add(previous.landingAuthorization.touchdownRequestedTimeMs)
      }
    }
    return { totalImpulse, authorizationTimes: [...authorizationTimes] }
  }

  let cases = 0
  for (const loopMode of ['once', 'loop', 'ping-pong'] as const) {
    const directLow = sequence(loopMode, 7.5e-13, [10.000001, 11, 12, 13, 14])
    const subdividedLow = sequence(loopMode, 7.5e-13, [10, 10.000001, 11, 12, 13, 14])
    assert.deepEqual(directLow, subdividedLow, `${loopMode} 低强度相邻窗不得受 10ms 请求帧细分影响`)
    assert.deepEqual(directLow, { totalImpulse: 1, authorizationTimes: directLow.authorizationTimes })
    assert.equal(directLow.authorizationTimes.length, 1)
    assert.ok(directLow.authorizationTimes[0]! < 10 && directLow.authorizationTimes[0]! > 9.9999)

    const directHigh = sequence(loopMode, 1, [10.000001, 11, 12, 13, 14])
    const subdividedHigh = sequence(loopMode, 1, [10, 10.000001, 11, 12, 13, 14])
    assert.deepEqual(directHigh, subdividedHigh, `${loopMode} 高强度精确相邻窗不得因跨边界帧签发伪授权`)
    assert.deepEqual(directHigh, { totalImpulse: 0, authorizationTimes: [] })
    cases += 2
  }
  return { cases, loopModes: 3 }
}

function benchmarkDefinition(windowCount: 1 | 64): BipedPetRootMotionDefinition {
  return {
    mode: 'travel',
    distance: .4,
    turnRadians: .2,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: Array.from({ length: windowCount }, (_, index) => ({
      id: `travel-${index}`,
      kind: 'travel' as const,
      startMs: index * 10,
      endMs: Math.min(1000, index * 10 + 370),
      weight: 1 - index / 128,
    })),
    vfxTags: [],
  }
}

function benchmarkSampler(definition: BipedPetRootMotionDefinition): { elapsedMs: number; checksum: number } {
  const startedAt = performance.now()
  let checksum = 0
  for (let index = 0; index < BENCHMARK_ITERATIONS; index += 1) {
    const sample = sampleBipedPetRootMotion({
      definition,
      requestedTimeMs: index % 1001,
      durationMs: 1000,
      loopMode: 'once',
      characterHeight: 4,
      facingRadians: .3,
      actionWeight: 1,
      footResidual: [0, 0, 0],
    })
    checksum += sample.appliedWorld[0] + sample.appliedWorld[2] + sample.appliedTurnRadians
  }
  assert.ok(Number.isFinite(checksum))
  return { elapsedMs: performance.now() - startedAt, checksum }
}

function runNormalizationCostObservation() {
  const observations: Record<string, { elapsedMs: number; checksum: number }> = {}
  for (const windowCount of [1, 64] as const) {
    const raw = benchmarkDefinition(windowCount)
    const canonical = normalizeBipedPetRootMotion(raw, 1000).value
    const comparisonInput = {
      requestedTimeMs: 527,
      durationMs: 1000,
      loopMode: 'once' as const,
      characterHeight: 4,
      facingRadians: .3,
      actionWeight: 1,
      footResidual: [0, 0, 0] as const,
    }
    assert.deepEqual(
      sampleBipedPetRootMotion({ ...comparisonInput, definition: raw }),
      sampleBipedPetRootMotion({ ...comparisonInput, definition: canonical }),
    )
    const canonicalObservation = benchmarkSampler(canonical)
    const rawObservation = benchmarkSampler(raw)
    assert.equal(rawObservation.checksum, canonicalObservation.checksum)
    observations[`${windowCount}-window-canonical`] = canonicalObservation
    observations[`${windowCount}-window-raw`] = rawObservation
  }
  return {
    scope: 'reset 采样的 raw/canonical 防御规范化成本；不代表连续弹道时间线热路径',
    iterationsPerCase: BENCHMARK_ITERATIONS,
    observations,
  }
}

function continuousBallisticBenchmarkDefinition(windowCount: 1 | 64): BipedPetRootMotionDefinition {
  const windows = windowCount === 1
    ? [{ id: 'ballistic-0', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 }]
    : Array.from({ length: windowCount }, (_, index) => ({
        id: `ballistic-${index}`,
        kind: 'ballistic' as const,
        startMs: 100,
        endMs: 300,
        weight: 1,
      }))
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows,
    vfxTags: [],
  }, 1000).value
  assert.equal(definition.windows.length, windowCount, '连续弹道热路径必须保留请求的 canonical 窗口数量')
  return definition
}

function benchmarkContinuousBallisticSampler(definition: BipedPetRootMotionDefinition) {
  const base = {
    definition,
    durationMs: 1000,
    loopMode: 'loop' as const,
    characterHeight: 4,
    facingRadians: .3,
    actionWeight: 1,
    footResidual: [0, 0, 0] as const,
  }
  let previous = sampleBipedPetRootMotion({ ...base, requestedTimeMs: 0 })
  let checksum = 0
  let authorizationFrames = 0
  let landingImpulses = 0
  const startedAt = performance.now()
  for (let index = 1; index <= BALLISTIC_HOT_PATH_ITERATIONS; index += 1) {
    const sample = sampleBipedPetRootMotion({
      ...base,
      requestedTimeMs: index * 50,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
    })
    assertFiniteSample(sample)
    assert.notEqual(sample.status, 'blocked')
    if (sample.landingAuthorization) authorizationFrames += 1
    if (sample.landingImpulse > 0) landingImpulses += 1
    checksum += sample.appliedWorld[1]
      + sample.landingImpulse
      + (sample.landingAuthorization?.impulse ?? 0)
    previous = sample
  }
  assert.ok(authorizationFrames > 0, '连续弹道热路径必须实际推进 landingAuthorization')
  assert.ok(landingImpulses > 0, '连续弹道热路径必须实际消费 touchdown 授权')
  assert.ok(Number.isFinite(checksum))
  return {
    elapsedMs: performance.now() - startedAt,
    checksum,
    authorizationFrames,
    landingImpulses,
  }
}

function runContinuousBallisticPerformanceObservation() {
  return {
    scope: 'canonical 连续弹道采样；逐帧携带 previousAppliedWorld/previousAppliedTurnRadians/landingAuthorization 并构建一次共享时间线',
    iterationsPerCase: BALLISTIC_HOT_PATH_ITERATIONS,
    observations: {
      '1-window-canonical': benchmarkContinuousBallisticSampler(continuousBallisticBenchmarkDefinition(1)),
      '64-window-canonical': benchmarkContinuousBallisticSampler(continuousBallisticBenchmarkDefinition(64)),
    },
  }
}

function runNaturalMovementVfxProbe() {
  assert.equal(BIPED_PET_ROOT_MOTION_REFERENCE_SPEED_BODY_HEIGHTS_PER_SECOND, .4)
  const run = (
    definition: BipedPetRootMotionDefinition,
    durationMs: number,
    loopMode: 'once' | 'loop',
    stepMs: number,
  ) => {
    const base = {
      definition,
      durationMs,
      loopMode,
      characterHeight: 1,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: [0, 0, 0] as const,
    }
    let previous = sampleDeterministically({ ...base, requestedTimeMs: 0 })
    let speedTrailFrames = 0
    let brakeSparkFrames = 0
    let brakeAt7300 = false
    for (let requestedTimeMs = stepMs; requestedTimeMs <= durationMs; requestedTimeMs += stepMs) {
      const sample = sampleDeterministically({
        ...base,
        requestedTimeMs,
        previousRequestedTimeMs: previous.requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        previousLandingAuthorization: previous.landingAuthorization,
      })
      const signals = deriveBipedPetMotionVfxSignals({
        clipHash: 'natural-motion-vfx-probe',
        previousRequestedTimeMs: previous.requestedTimeMs,
        requestedTimeMs,
        tags: definition.vfxTags,
        rootMotion: sample,
      })
      assert.ok(signals.every(signal => signal.timeMs === requestedTimeMs))
      if (signals.some(signal => signal.kind === 'speed-trail')) speedTrailFrames += 1
      if (signals.some(signal => signal.kind === 'brake-sparks')) brakeSparkFrames += 1
      if (requestedTimeMs === 7300) brakeAt7300 = signals.some(signal => signal.kind === 'brake-sparks')
      previous = sample
    }
    return { speedTrailFrames, brakeSparkFrames, brakeAt7300 }
  }

  const walk = run(normalizeBipedPetRootMotion({
    mode: 'travel', distance: .42, turnRadians: 0, verticalMode: 'grounded', jumpHeight: 0,
    windows: [{ id: 'walk-travel', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['speed-trail'],
  }, 1200).value, 1200, 'loop', 20)
  const sprint = run(normalizeBipedPetRootMotion({
    mode: 'travel', distance: 2.4, turnRadians: 0, verticalMode: 'grounded', jumpHeight: 0,
    windows: [
      { id: 'sprint', kind: 'travel', startMs: 0, endMs: 8300, weight: 1 },
      { id: 'brake', kind: 'brake', startMs: 6300, endMs: 8300, weight: 1 },
    ],
    vfxTags: ['speed-trail', 'brake-sparks'],
  }, 9200).value, 9200, 'once', 10)
  assert.equal(walk.speedTrailFrames, 46, '自然行走速度拖尾帧数必须确定')
  assert.equal(sprint.speedTrailFrames, 582, '自然冲刺速度拖尾帧数必须确定')
  assert.equal(sprint.brakeSparkFrames, 36, '自然冲刺急停火花帧数必须确定')
  assert.ok(sprint.brakeAt7300, '冲刺制动段必须在约 7300ms 触发急停火花')
  return { referenceSpeedBodyHeightsPerSecond: .4, walk, sprint }
}

const result = {
  stateful: runStatefulProbe(),
  ulp: runUlpProbes(),
  ballisticTimeline: runBallisticTimelineProbe(),
  compositePeakStability: runCompositePeakStabilityProbe(),
  offsetOverlapBudget: runOffsetOverlapBudgetProbe(),
  frameSubdivision: runFrameSubdivisionProbe(),
  normalizationCostObservation: runNormalizationCostObservation(),
  continuousBallisticObservation: runContinuousBallisticPerformanceObservation(),
  naturalMovementVfx: runNaturalMovementVfxProbe(),
}

console.log('Root Motion 可复现探针通过；耗时仅作本机观测，不设置脆弱阈值。')
console.log(JSON.stringify(result, (_key, value) => (
  typeof value === 'number' && !Number.isInteger(value)
    ? Math.abs(value) > 0 && Math.abs(value) < .001
      ? Number(value.toPrecision(8))
      : Number(value.toFixed(3))
    : value
), 2))
