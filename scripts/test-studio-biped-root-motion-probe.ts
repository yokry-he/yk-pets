/**
 * 文件职责 / File responsibility
 * 以固定种子复现双足萌宠 Root Motion 的有状态、ULP 边界与 raw/canonical 性能探针。
 */

import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import {
  normalizeBipedPetRootMotion,
  sampleBipedPetRootMotion,
  type BipedPetLandingAuthorization,
  type BipedPetRootMotionDefinition,
  type SampleBipedPetRootMotionInput,
  type SampledBipedPetRootMotion,
} from '../packages/pet-core/src/index.ts'

const STATEFUL_PROBE_CASES = 10_000
const ULP_PROBES_PER_DIRECTION = 21
const BENCHMARK_ITERATIONS = 100_000

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
  assert.ok(counts.brake > 1_000, JSON.stringify(counts))
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

function runPerformanceObservation() {
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
  return { iterationsPerCase: BENCHMARK_ITERATIONS, observations }
}

const result = {
  stateful: runStatefulProbe(),
  ulp: runUlpProbes(),
  performanceObservation: runPerformanceObservation(),
}

console.log('Root Motion 可复现探针通过；耗时仅作本机观测，不设置脆弱阈值。')
console.log(JSON.stringify(result, (_key, value) => (
  typeof value === 'number' && !Number.isInteger(value) ? Number(value.toFixed(3)) : value
), 2))
