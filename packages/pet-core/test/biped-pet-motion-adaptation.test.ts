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
