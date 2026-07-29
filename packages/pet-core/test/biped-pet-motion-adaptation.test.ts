/**
 * 文件职责 / File responsibility
 * 验证双足萌宠动作适配扩展的有界规范化、稳定顺序、引用完整性与只读输出。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import * as petCore from '../src/index.ts'

type MotionAdaptationNormalizer = (input: unknown, durationMs: number) => {
  value: {
    phases: readonly {
      id: string
      role: string
      startMs: number
      endMs: number
      intensity: number
    }[]
    warpWindows: readonly {
      id: string
      phaseId: string
      target: string
      translation: boolean
      rotation: boolean
      maxDistance: number
      maxTurnRadians: number
    }[]
    constraints: readonly {
      id: string
      kind: string
      phaseId: string
      limbId: string
      propInstanceId: string
      pointId: string
      weight: number
    }[]
    effectCues: readonly {
      id: string
      kind: string
      phaseId: string
      propInstanceId: string
      pointIds: readonly string[]
      threshold: number
      lifetimeMs: number
    }[]
  }
  diagnostics: readonly { id: string; severity: 'warning'; message: string }[]
}

function normalizeMotionAdaptation(input: unknown, durationMs: number) {
  const normalizer = Reflect.get(petCore, 'normalizeBipedPetMotionAdaptation')
  assert.equal(typeof normalizer, 'function', 'normalizeBipedPetMotionAdaptation 应从 pet-core 公共入口导出')
  return (normalizer as MotionAdaptationNormalizer)(input, durationMs)
}

type NormalizedMotionAdaptationDefinition = ReturnType<MotionAdaptationNormalizer>['value']

type MotionAdaptationPlanCompiler = (input: {
  definition: NormalizedMotionAdaptationDefinition
  clipHash: string
  profileId: string
  characterHash: string
  characterHeight: number
  armReach: { left: number; right: number }
  propRigs: Readonly<Record<string, unknown>>
}) => {
  key: string
  phases: readonly { id: string; startMs: number; endMs: number; intensity: number; fadeMs: number }[]
  warpWindows: readonly { id: string; maxDistanceWorld: number; maxTurnRadians: number }[]
  constraints: readonly { id: string; armReachWorld: number; targetPoint: { position: readonly number[] } }[]
  effectCues: readonly { id: string; points: readonly { position: readonly number[] }[] }[]
  diagnostics: readonly { id: string; severity: 'warning'; message: string }[]
}

type MotionAdaptationSampler = (
  plan: ReturnType<MotionAdaptationPlanCompiler>,
  requestedTimeMs: number,
  resolvedTimeMs: number,
) => {
  requestedTimeMs: number
  resolvedTimeMs: number
  activePhaseIds: readonly string[]
  constraintWeights: Readonly<Record<string, number>>
  activeEffectCueIds: readonly string[]
}

function compileMotionAdaptationPlan(input: Parameters<MotionAdaptationPlanCompiler>[0]) {
  const compiler = Reflect.get(petCore, 'compileBipedPetMotionAdaptationPlan')
  assert.equal(typeof compiler, 'function', 'compileBipedPetMotionAdaptationPlan 应从 pet-core 公共入口导出')
  return (compiler as MotionAdaptationPlanCompiler)(input)
}

function sampleMotionAdaptation(
  plan: ReturnType<MotionAdaptationPlanCompiler>,
  requestedTimeMs: number,
  resolvedTimeMs: number,
) {
  const sampler = Reflect.get(petCore, 'sampleBipedPetMotionAdaptation')
  assert.equal(typeof sampler, 'function', 'sampleBipedPetMotionAdaptation 应从 pet-core 公共入口导出')
  return (sampler as MotionAdaptationSampler)(plan, requestedTimeMs, resolvedTimeMs)
}

function completeStaffRig(axisLength = 1.6) {
  const point = (position: readonly [number, number, number]) => ({ position, rotation: [0, 0, 0, 1] })
  return {
    primaryGrip: point([0, 0, 0]),
    secondaryGrip: point([-.45, 0, 0]),
    trailStart: point([-axisLength, 0, 0]),
    trailEnd: point([axisLength, 0, 0]),
    impactPoint: point([axisLength, 0, 0]),
  }
}

function samplePlanDefinition() {
  return normalizeMotionAdaptation({
    phases: [{ id: 'sweep', role: 'sweep', startMs: 100, endMs: 1000, intensity: 1 }],
    warpWindows: [{
      id: 'sweep-warp', phaseId: 'sweep', target: 'stage-forward', translation: true, rotation: true,
      maxDistance: .45, maxTurnRadians: 1.2,
    }],
    constraints: [{
      id: 'left-grip', kind: 'secondary-grip', phaseId: 'sweep', limbId: 'arm.left',
      propInstanceId: 'staff', pointId: 'secondaryGrip', weight: 1,
    }],
    effectCues: [{
      id: 'sweep-trail', kind: 'weapon-trail', phaseId: 'sweep', propInstanceId: 'staff',
      pointIds: ['trailStart', 'trailEnd'], threshold: .25, lifetimeMs: 240,
    }],
  }, 1200).value
}

test('动作适配扩展规范化并稳定冻结', () => {
  const result = normalizeMotionAdaptation({
    phases: [{ id: 'sweep', role: 'sweep', startMs: 4200, endMs: 6500, intensity: .9 }],
    warpWindows: [{
      id: 'sweep-warp',
      phaseId: 'sweep',
      target: 'stage-forward',
      translation: true,
      rotation: true,
      maxDistance: .45,
      maxTurnRadians: 1.2,
    }],
    constraints: [{
      id: 'left-grip',
      kind: 'secondary-grip',
      phaseId: 'sweep',
      limbId: 'arm.left',
      propInstanceId: 'nebula-staff-main',
      pointId: 'secondaryGrip',
      weight: 1,
    }],
    effectCues: [{
      id: 'sweep-trail',
      kind: 'weapon-trail',
      phaseId: 'sweep',
      propInstanceId: 'nebula-staff-main',
      pointIds: ['trailStart', 'trailEnd'],
      threshold: .25,
      lifetimeMs: 240,
    }],
  }, 12000)

  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.value.phases[0]?.role, 'sweep')
  assert.equal(result.value.constraints[0]?.limbId, 'arm.left')
  assert.equal(result.value.effectCues[0]?.pointIds[1], 'trailEnd')
  assert.ok(Object.isFrozen(result.value))
  assert.ok(Object.isFrozen(result.value.phases))
  assert.ok(Object.isFrozen(result.value.phases[0]))
  assert.ok(Object.isFrozen(result.value.effectCues[0]?.pointIds))
})

test('阶段会钳制边界、拒绝重复身份并按 Unicode code point 排序', () => {
  const source = {
    phases: [
      { id: '😀', role: 'recover', startMs: 11000, endMs: 13000, intensity: 2 },
      { id: '', role: 'prepare', startMs: -100, endMs: 800, intensity: .5 },
      { id: '😀', role: 'impact', startMs: 9000, endMs: 10000, intensity: .7 },
      { id: 'nan', role: 'spin', startMs: 900, endMs: 3200, intensity: Number.NaN },
      { id: 'x'.repeat(129), role: 'spin', startMs: 900, endMs: 3200, intensity: .8 },
    ],
    warpWindows: [],
    constraints: [],
    effectCues: [],
  }
  const result = normalizeMotionAdaptation(source, 12000)

  assert.deepEqual(result.value.phases.map(item => item.id), ['', '😀'])
  assert.deepEqual(result.value.phases.map(item => [item.startMs, item.endMs, item.intensity]), [
    [0, 800, .5],
    [11000, 12000, 1],
  ])
  assert.ok(result.diagnostics.some(item => item.id.includes('duplicate')))
  assert.ok(result.diagnostics.some(item => item.id.includes('time-clamped')))
  assert.ok(result.diagnostics.some(item => item.id.includes('intensity-invalid')))
  assert.ok(result.diagnostics.some(item => item.id.includes('id-too-long')))
  assert.equal(source.phases[0]?.endMs, 13000)
})

test('跨数组引用和特效语义点数量必须完整', () => {
  const result = normalizeMotionAdaptation({
    phases: [{ id: 'impact', role: 'impact', startMs: 9000, endMs: 10100, intensity: 1 }],
    warpWindows: [
      { id: 'valid-warp', phaseId: 'impact', target: 'stage-forward', translation: true, rotation: false, maxDistance: 99, maxTurnRadians: 99 },
      { id: 'missing-phase', phaseId: 'missing', target: 'stage-forward', translation: true, rotation: true, maxDistance: .4, maxTurnRadians: .5 },
    ],
    constraints: [
      { id: 'valid-grip', kind: 'secondary-grip', phaseId: 'impact', limbId: 'arm.left', propInstanceId: 'staff', pointId: 'secondaryGrip', weight: 2 },
      { id: 'missing-grip-phase', kind: 'secondary-grip', phaseId: 'missing', limbId: 'arm.left', propInstanceId: 'staff', pointId: 'secondaryGrip', weight: 1 },
    ],
    effectCues: [
      { id: 'valid-impact', kind: 'impact-ring', phaseId: 'impact', propInstanceId: 'staff', pointIds: ['impactPoint'], threshold: 3, lifetimeMs: 9000 },
      { id: 'bad-trail-points', kind: 'weapon-trail', phaseId: 'impact', propInstanceId: 'staff', pointIds: ['trailEnd'], threshold: .2, lifetimeMs: 240 },
      { id: 'missing-effect-phase', kind: 'impact-sparks', phaseId: 'missing', propInstanceId: 'staff', pointIds: ['impactPoint'], threshold: .3, lifetimeMs: 200 },
    ],
  }, 12000)

  assert.deepEqual(result.value.warpWindows.map(item => item.id), ['valid-warp'])
  assert.equal(result.value.warpWindows[0]?.maxDistance, 4)
  assert.equal(result.value.warpWindows[0]?.maxTurnRadians, Math.PI * 2)
  assert.deepEqual(result.value.constraints.map(item => item.id), ['valid-grip'])
  assert.equal(result.value.constraints[0]?.weight, 1)
  assert.deepEqual(result.value.effectCues.map(item => item.id), ['valid-impact'])
  assert.equal(result.value.effectCues[0]?.threshold, 1)
  assert.equal(result.value.effectCues[0]?.lifetimeMs, 2000)
  assert.ok(result.diagnostics.some(item => item.id.includes('phase-missing')))
  assert.ok(result.diagnostics.some(item => item.id.includes('point-count-invalid')))
})

test('畸形对象与异常 Proxy 只产生有界诊断', () => {
  const throwingRecord = new Proxy({}, {
    get() {
      throw new Error('blocked getter')
    },
  })
  const throwingArray = new Proxy([], {
    get() {
      throw new Error('blocked array')
    },
  })

  assert.doesNotThrow(() => normalizeMotionAdaptation(throwingRecord, Number.NaN))
  const result = normalizeMotionAdaptation({
    phases: [throwingRecord, null, []],
    warpWindows: throwingArray,
    constraints: 'invalid',
    effectCues: undefined,
  }, 12000)

  assert.deepEqual(result.value, {
    phases: [],
    warpWindows: [],
    constraints: [],
    effectCues: [],
  })
  assert.ok(result.diagnostics.length > 0)
  assert.ok(result.diagnostics.length <= 16)
  assert.ok(result.diagnostics.every(item => item.severity === 'warning' && item.message.length <= 160))
})

test('四类动作适配数组遵守固定输入预算', () => {
  const phases = Array.from({ length: 20 }, (_, index) => ({
    id: `phase-${String(index).padStart(2, '0')}`,
    role: 'spin',
    startMs: index * 10,
    endMs: index * 10 + 8,
    intensity: 1,
  }))
  const result = normalizeMotionAdaptation({
    phases,
    warpWindows: Array.from({ length: 40 }, (_, index) => ({
      id: `warp-${index}`,
      phaseId: phases[index % 16]!.id,
      target: 'stage-forward',
      translation: true,
      rotation: true,
      maxDistance: .5,
      maxTurnRadians: .5,
    })),
    constraints: Array.from({ length: 20 }, (_, index) => ({
      id: `constraint-${index}`,
      kind: 'secondary-grip',
      phaseId: phases[index % 16]!.id,
      limbId: 'arm.left',
      propInstanceId: 'staff',
      pointId: 'secondaryGrip',
      weight: 1,
    })),
    effectCues: Array.from({ length: 40 }, (_, index) => ({
      id: `effect-${index}`,
      kind: 'impact-ring',
      phaseId: phases[index % 16]!.id,
      propInstanceId: 'staff',
      pointIds: ['impactPoint'],
      threshold: .2,
      lifetimeMs: 200,
    })),
  }, 12000)

  assert.equal(result.value.phases.length, 16)
  assert.equal(result.value.warpWindows.length, 32)
  assert.equal(result.value.constraints.length, 16)
  assert.equal(result.value.effectCues.length, 32)
  assert.equal(result.diagnostics.filter(item => item.id.includes('budget-exceeded')).length, 4)
})

test('适配计划按角色尺寸编译并以完整角色与道具身份缓存', () => {
  const definition = samplePlanDefinition()
  const common = {
    definition,
    clipHash: 'clip-a',
    profileId: 'biped-pet/v1',
    propRigs: { staff: completeStaffRig() },
  }
  const athleticInput = {
    ...common,
    characterHash: 'athletic',
    characterHeight: 4.2,
    armReach: { left: 1.18, right: 1.18 },
  }
  const athletic = compileMotionAdaptationPlan(athleticInput)
  const sameAthletic = compileMotionAdaptationPlan(structuredClone(athleticInput))
  const round = compileMotionAdaptationPlan({
    ...common,
    characterHash: 'round',
    characterHeight: 3.4,
    armReach: { left: .86, right: .86 },
  })
  const longerStaff = compileMotionAdaptationPlan({
    ...athleticInput,
    propRigs: { staff: completeStaffRig(2.1) },
  })
  const changedClip = compileMotionAdaptationPlan({ ...athleticInput, clipHash: 'clip-b' })
  const changedProfile = compileMotionAdaptationPlan({ ...athleticInput, profileId: 'biped-pet/v2' })

  assert.strictEqual(athletic, sameAthletic)
  assert.ok(athletic.warpWindows[0]!.maxDistanceWorld > round.warpWindows[0]!.maxDistanceWorld)
  assert.equal(athletic.constraints[0]?.armReachWorld, 1.18)
  assert.notEqual(athletic.key, round.key)
  assert.notEqual(athletic.key, longerStaff.key)
  assert.notEqual(athletic.key, changedClip.key)
  assert.notEqual(athletic.key, changedProfile.key)
  assert.ok(Object.isFrozen(athletic))
  assert.ok(Object.isFrozen(athletic.constraints[0]?.targetPoint.position))
})

test('缺少道具语义点只关闭关联增强并保留基础阶段与 Warp', () => {
  const plan = compileMotionAdaptationPlan({
    definition: samplePlanDefinition(),
    clipHash: 'clip-missing-prop',
    profileId: 'biped-pet/v1',
    characterHash: 'round',
    characterHeight: 3.4,
    armReach: { left: .86, right: .86 },
    propRigs: { staff: { primaryGrip: completeStaffRig().primaryGrip } },
  })

  assert.deepEqual(plan.phases.map(item => item.id), ['sweep'])
  assert.deepEqual(plan.warpWindows.map(item => item.id), ['sweep-warp'])
  assert.deepEqual(plan.constraints, [])
  assert.deepEqual(plan.effectCues, [])
  assert.ok(plan.diagnostics.some(item => item.id.includes('point-missing')))
})

test('适配采样使用 120ms smoothstep 淡变且暂停、回拖和帧率无关', () => {
  const plan = compileMotionAdaptationPlan({
    definition: samplePlanDefinition(),
    clipHash: 'clip-sampling',
    profileId: 'biped-pet/v1',
    characterHash: 'athletic',
    characterHeight: 4.2,
    armReach: { left: 1.18, right: 1.18 },
    propRigs: { staff: completeStaffRig() },
  })

  assert.equal(plan.phases[0]?.fadeMs, 120)
  assert.deepEqual(sampleMotionAdaptation(plan, 100, 100), {
    requestedTimeMs: 100,
    resolvedTimeMs: 100,
    activePhaseIds: ['sweep'],
    constraintWeights: { 'left-grip': 0 },
    activeEffectCueIds: ['sweep-trail'],
  })
  assert.equal(sampleMotionAdaptation(plan, 160, 160).constraintWeights['left-grip'], .5)
  assert.equal(sampleMotionAdaptation(plan, 220, 220).constraintWeights['left-grip'], 1)
  assert.deepEqual(sampleMotionAdaptation(plan, 220, 220), sampleMotionAdaptation(plan, 220, 220))
  assert.deepEqual(sampleMotionAdaptation(plan, 1300, 300), {
    requestedTimeMs: 1300,
    resolvedTimeMs: 300,
    activePhaseIds: ['sweep'],
    constraintWeights: { 'left-grip': 1 },
    activeEffectCueIds: ['sweep-trail'],
  })

  const frameSamples = [24, 30, 60].map((fps) => {
    const halfSecondFrame = fps / 2
    return sampleMotionAdaptation(plan, halfSecondFrame * 1000 / fps, halfSecondFrame * 1000 / fps)
  })
  assert.deepEqual(frameSamples[0], frameSamples[1])
  assert.deepEqual(frameSamples[1], frameSamples[2])
  assert.deepEqual(sampleMotionAdaptation(plan, 90, 90).activePhaseIds, [])
})
