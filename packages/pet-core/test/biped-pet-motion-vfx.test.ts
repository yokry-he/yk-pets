/**
 * 文件职责 / File responsibility
 * 验证双足萌宠运动特效信号的标签授权、严格阈值、时间去重与不可信输入边界。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import * as petCore from '../src/index.ts'
import { sampleBipedPetRootMotion } from '../src/index.ts'

interface MotionVfxSignal {
  readonly id: string
  readonly kind: 'landing-ring' | 'landing-dust' | 'speed-trail' | 'brake-sparks'
  readonly mode: 'burst' | 'sustain'
  readonly strength: number
  readonly timeMs: number
  readonly lifetimeMs: number
}

type MotionVfxDeriver = (input: unknown) => readonly MotionVfxSignal[]

function deriveSignals(input: unknown): readonly MotionVfxSignal[] {
  const deriver = Reflect.get(petCore, 'deriveBipedPetMotionVfxSignals')
  assert.equal(typeof deriver, 'function', 'deriveBipedPetMotionVfxSignals 必须从 pet-core 入口导出')
  return (deriver as MotionVfxDeriver)(input)
}

const rootSample = sampleBipedPetRootMotion({
  definition: {
    mode: 'in-place',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [],
    vfxTags: [],
  },
  requestedTimeMs: 1820,
  previousRequestedTimeMs: 1700,
  durationMs: 2400,
  loopMode: 'once',
  characterHeight: 4,
  facingRadians: 0,
  actionWeight: 1,
  previousAppliedWorld: [0, 0, 0],
  previousAppliedTurnRadians: 0,
  footResidual: [0, 0, 0],
})

function vfxInput(overrides: Record<string, unknown> = {}) {
  return {
    clipHash: 'clip-a',
    previousRequestedTimeMs: 1700,
    requestedTimeMs: 1820,
    tags: ['landing-ring', 'landing-dust'],
    rootMotion: { ...rootSample, phase: 'landing', landingImpulse: .8 },
    ...overrides,
  }
}

test('只有动作标签授权的落地特效会按 Unicode code-point 顺序生成唯一 burst', () => {
  const landing = deriveSignals(vfxInput())

  assert.deepEqual(landing.map(item => item.kind), ['landing-dust', 'landing-ring'])
  assert.deepEqual(landing.map(item => item.mode), ['burst', 'burst'])
  assert.deepEqual(landing.map(item => item.id), [
    'clip-a:landing-dust:1820',
    'clip-a:landing-ring:1820',
  ])
  assert.equal(new Set(landing.map(item => item.id)).size, landing.length)
  assert.ok(landing.every(item => item.strength === .8 && item.timeMs === 1820 && item.lifetimeMs > 0))
  assert.deepEqual(deriveSignals(vfxInput({ tags: [] })), [])
  assert.deepEqual(deriveSignals(vfxInput({ tags: ['speed-trail'] })), [])
})

test('四类信号使用严格大于阈值，等于阈值不触发', () => {
  const landingThresholds = [
    ['landing-ring', .25],
    ['landing-dust', .4],
  ] as const
  for (const [kind, threshold] of landingThresholds) {
    assert.deepEqual(deriveSignals(vfxInput({
      tags: [kind],
      rootMotion: { ...rootSample, phase: 'landing', landingImpulse: threshold },
    })), [], `${kind} 等于阈值时不得触发`)
    assert.deepEqual(deriveSignals(vfxInput({
      tags: [kind],
      rootMotion: { ...rootSample, phase: 'landing', landingImpulse: threshold + Number.EPSILON },
    })).map(item => item.kind), [kind], `${kind} 严格超过阈值时必须触发`)
  }

  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['speed-trail'],
    rootMotion: { ...rootSample, phase: 'grounded', motionIntensity: .55 },
  })), [])
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['speed-trail'],
    rootMotion: { ...rootSample, phase: 'grounded', motionIntensity: .55 + Number.EPSILON },
  })).map(item => item.kind), ['speed-trail'])

  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['brake-sparks'],
    rootMotion: { ...rootSample, phase: 'grounded', brakeIntensity: .45 },
  })), [])
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['brake-sparks'],
    rootMotion: { ...rootSample, phase: 'grounded', brakeIntensity: .45 + Number.EPSILON },
  })).map(item => item.kind), ['brake-sparks'])
})

test('速度拖尾持续复用 active 身份，急停火花只在接地时生成 burst', () => {
  const firstTrail = deriveSignals(vfxInput({
    requestedTimeMs: 1800,
    tags: ['speed-trail', 'speed-trail'],
    rootMotion: { ...rootSample, requestedTimeMs: 1800, phase: 'grounded', motionIntensity: .9 },
  }))
  const secondTrail = deriveSignals(vfxInput({
    previousRequestedTimeMs: 1800,
    requestedTimeMs: 1816,
    tags: ['speed-trail'],
    rootMotion: { ...rootSample, requestedTimeMs: 1816, phase: 'grounded', motionIntensity: .9 },
  }))
  assert.equal(firstTrail.length, 1)
  assert.equal(firstTrail[0]?.mode, 'sustain')
  assert.equal(firstTrail[0]?.id, 'clip-a:speed-trail:active')
  assert.equal(secondTrail[0]?.id, firstTrail[0]?.id)

  const groundedBrake = deriveSignals(vfxInput({
    tags: ['brake-sparks'],
    rootMotion: { ...rootSample, phase: 'grounded', brakeIntensity: .8 },
  }))
  assert.deepEqual(groundedBrake.map(item => [item.kind, item.mode, item.id]), [
    ['brake-sparks', 'burst', 'clip-a:brake-sparks:1820'],
  ])
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['brake-sparks'],
    rootMotion: { ...rootSample, phase: 'airborne', brakeIntensity: .8 },
  })), [])
})

test('同一时间、倒退、reset 与 blocked 都不会重复发出瞬时或持续信号', () => {
  const active = {
    tags: ['landing-ring', 'speed-trail', 'brake-sparks'],
    rootMotion: {
      ...rootSample,
      phase: 'grounded',
      landingImpulse: .8,
      motionIntensity: .8,
      brakeIntensity: .8,
    },
  }
  assert.deepEqual(deriveSignals(vfxInput({ ...active, previousRequestedTimeMs: 1820 })), [])
  assert.deepEqual(deriveSignals(vfxInput({ ...active, previousRequestedTimeMs: 1900, requestedTimeMs: 1820 })), [])
  for (const status of ['reset', 'blocked'] as const) {
    assert.deepEqual(deriveSignals(vfxInput({
      ...active,
      rootMotion: { ...active.rootMotion, status },
    })), [], `${status} 不得触发特效`)
  }
})

test('落地冲量兼容求解器真实 touchdown 的 grounded 相位并拒绝腾空相位', () => {
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['landing-ring'],
    rootMotion: { ...rootSample, phase: 'grounded', landingImpulse: .8 },
  })).map(item => item.kind), ['landing-ring'])
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['landing-ring'],
    rootMotion: { ...rootSample, phase: 'takeoff', landingImpulse: .8 },
  })), [])
  assert.deepEqual(deriveSignals(vfxInput({
    tags: ['speed-trail'],
    rootMotion: { ...rootSample, phase: 'takeoff', motionIntensity: .8 },
  })).map(item => item.kind), ['speed-trail'], '速度拖尾可在离地移动阶段保持')
  for (const field of ['landingImpulse', 'motionIntensity', 'brakeIntensity'] as const) {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.deepEqual(deriveSignals(vfxInput({
        tags: ['landing-ring', 'speed-trail', 'brake-sparks'],
        rootMotion: { ...rootSample, phase: 'landing', landingImpulse: .8, motionIntensity: .8, brakeIntensity: .8, [field]: value },
      })), [], `${field}=${String(value)} 必须安全返回空数组`)
    }
  }
})

test('真实 ballistic Root Motion touchdown 可直接生成落地特效', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .8,
    windows: [{ id: 'jump', kind: 'ballistic' as const, startMs: 200, endMs: 1000, weight: 1 }],
    vfxTags: ['landing-ring', 'landing-dust'] as const,
  }
  const beforeTouchdown = sampleBipedPetRootMotion({
    definition,
    requestedTimeMs: 999,
    previousRequestedTimeMs: 999,
    durationMs: 1200,
    loopMode: 'once',
    characterHeight: 4,
    facingRadians: 0,
    actionWeight: 1,
    footResidual: [0, 0, 0],
  })
  const touchdown = sampleBipedPetRootMotion({
    definition,
    requestedTimeMs: 1001,
    previousRequestedTimeMs: 999,
    durationMs: 1200,
    loopMode: 'once',
    characterHeight: 4,
    facingRadians: 0,
    actionWeight: 1,
    previousAppliedWorld: beforeTouchdown.appliedWorld,
    previousAppliedTurnRadians: beforeTouchdown.appliedTurnRadians,
    footResidual: [0, 0, 0],
  })

  assert.equal(touchdown.phase, 'grounded')
  assert.ok(touchdown.landingImpulse > .4)
  assert.deepEqual(deriveSignals({
    clipHash: 'clip-integration',
    previousRequestedTimeMs: 999,
    requestedTimeMs: 1001,
    tags: definition.vfxTags,
    rootMotion: touchdown,
  }).map(item => item.kind), ['landing-dust', 'landing-ring'])

  for (const [previousRequestedTimeMs, requestedTimeMs] of [[1001, 1017], [1017, 1033]] as const) {
    assert.deepEqual(deriveSignals({
      clipHash: 'clip-integration',
      previousRequestedTimeMs,
      requestedTimeMs,
      tags: definition.vfxTags,
      rootMotion: touchdown,
    }), [], '旧 touchdown 样本不得配合后续外层时间生成新 burst ID')
  }
})

test('纯转向、纯垂直弹道和零位移制动窗不生成移动特效，真实水平制动仍生成', () => {
  const continuous = (
    definition: Parameters<typeof sampleBipedPetRootMotion>[0]['definition'],
    previousRequestedTimeMs: number,
    requestedTimeMs: number,
  ) => {
    const base = {
      definition,
      durationMs: 100,
      loopMode: 'once' as const,
      characterHeight: 4,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: [0, 0, 0] as const,
    }
    const previous = sampleBipedPetRootMotion({ ...base, requestedTimeMs: previousRequestedTimeMs })
    return sampleBipedPetRootMotion({
      ...base,
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  const turning = continuous({
    mode: 'travel', distance: 0, turnRadians: Math.PI * 2, verticalMode: 'grounded', jumpHeight: 0,
    windows: [
      { id: 'turn', kind: 'travel', startMs: 0, endMs: 100, weight: 1 },
      { id: 'brake', kind: 'brake', startMs: 0, endMs: 100, weight: 1 },
    ],
    vfxTags: ['speed-trail', 'brake-sparks'],
  }, 24, 25)
  const jumping = continuous({
    mode: 'travel', distance: 0, turnRadians: 0, verticalMode: 'ballistic', jumpHeight: 1,
    windows: [{ id: 'jump', kind: 'ballistic', startMs: 0, endMs: 100, weight: 1 }],
    vfxTags: ['speed-trail'],
  }, 24, 25)
  for (const sample of [turning, jumping]) {
    assert.deepEqual(deriveSignals({
      clipHash: 'clip-non-horizontal',
      previousRequestedTimeMs: 24,
      requestedTimeMs: 25,
      tags: sample === turning ? ['speed-trail', 'brake-sparks'] : ['speed-trail'],
      rootMotion: sample,
    }), [])
  }

  const horizontalBrake = continuous({
    mode: 'travel', distance: 4, turnRadians: 0, verticalMode: 'grounded', jumpHeight: 0,
    windows: [
      { id: 'travel', kind: 'travel', startMs: 0, endMs: 100, weight: 1 },
      { id: 'brake', kind: 'brake', startMs: 0, endMs: 100, weight: 1 },
    ],
    vfxTags: ['speed-trail', 'brake-sparks'],
  }, 49, 50)
  assert.ok(horizontalBrake.motionIntensity > .55)
  assert.ok(horizontalBrake.brakeIntensity > .45)
  assert.deepEqual(deriveSignals({
    clipHash: 'clip-horizontal-brake',
    previousRequestedTimeMs: 49,
    requestedTimeMs: 50,
    tags: ['speed-trail', 'brake-sparks'],
    rootMotion: horizontalBrake,
  }).map(item => item.kind), ['brake-sparks', 'speed-trail'])
})

test('空白、全部 Cc、双向格式控制、超预算和非字符串 Clip 哈希安全返回空数组，同时保留合法 ZWJ 身份', () => {
  for (const clipHash of [
    '',
    '   ',
    'bad\u0000hash',
    'bad\u0085hash',
    'bad\u009fhash',
    'bad\u061chash',
    'bad\u200ehash',
    'bad\u200fhash',
    'bad\u202ahash',
    'bad\u202ehash',
    'bad\u2066hash',
    'bad\u2069hash',
    'x'.repeat(257),
    12,
    null,
    undefined,
  ]) {
    assert.deepEqual(deriveSignals(vfxInput({ clipHash })), [], `非法 Clip 哈希 ${String(clipHash)} 必须被拒绝`)
  }
  const unicode = deriveSignals(vfxInput({ clipHash: '家庭-👩‍👩‍👧‍👦', tags: ['landing-ring'] }))
  assert.equal(unicode[0]?.id, '家庭-👩‍👩‍👧‍👦:landing-ring:1820')
})

test('畸形对象、数组和 Proxy 访问异常不会向调用方抛出', () => {
  const throwingProxy = new Proxy({}, {
    get() {
      throw new Error('不得泄漏')
    },
  })
  const malformed = [
    null,
    undefined,
    1,
    'bad',
    [],
    throwingProxy,
    vfxInput({ tags: throwingProxy }),
    vfxInput({ rootMotion: throwingProxy }),
    vfxInput({ tags: ['unknown-tag'] }),
    vfxInput({ rootMotion: { ...rootSample, status: 'unknown' } }),
    vfxInput({ rootMotion: { ...rootSample, requestedTimeMs: Number.NaN } }),
    vfxInput({ rootMotion: { ...rootSample, requestedTimeMs: Number.POSITIVE_INFINITY } }),
    vfxInput({ rootMotion: Object.defineProperty({ ...rootSample }, 'requestedTimeMs', {
      get() {
        throw new Error('不得泄漏时间 getter')
      },
    }) }),
    vfxInput({ previousRequestedTimeMs: -10, requestedTimeMs: -5 }),
    vfxInput({ previousRequestedTimeMs: 0, requestedTimeMs: -1 }),
    vfxInput({ previousRequestedTimeMs: Number.NaN }),
    vfxInput({ requestedTimeMs: Number.POSITIVE_INFINITY }),
  ]
  for (const input of malformed) assert.doesNotThrow(() => assert.deepEqual(deriveSignals(input), []))
})

test('输入保持不变，结果递归冻结且相同调用不共享数组或信号对象', () => {
  const input = vfxInput({
    clipHash: '动作-🐾',
    tags: Object.freeze(['landing-ring', 'landing-dust']),
    rootMotion: Object.freeze({ ...rootSample, phase: 'landing', landingImpulse: .8 }),
  })
  const snapshot = structuredClone(input)
  const first = deriveSignals(input)
  const second = deriveSignals(input)

  assert.deepEqual(input, snapshot)
  assert.deepEqual(first, second)
  assert.notEqual(first, second)
  assert.notEqual(first[0], second[0])
  assert.ok(Object.isFrozen(first))
  assert.ok(first.every(Object.isFrozen))
  assert.equal(Reflect.set(first[0]!, 'strength', 0), false)
  assert.equal(first[0]?.strength, .8)

  const firstEmpty = deriveSignals(vfxInput({ tags: [] }))
  const secondEmpty = deriveSignals(vfxInput({ tags: [] }))
  assert.notEqual(firstEmpty, secondEmpty)
  assert.ok(Object.isFrozen(firstEmpty) && Object.isFrozen(secondEmpty))
})

test('全部标签无论输入顺序与重复项都按完整 code-point 身份稳定排序', () => {
  const first = deriveSignals(vfxInput({
    tags: ['speed-trail', 'landing-ring', 'brake-sparks', 'landing-dust', 'speed-trail'],
    rootMotion: {
      ...rootSample,
      phase: 'landing',
      landingImpulse: .9,
      motionIntensity: .9,
      brakeIntensity: .9,
    },
  }))
  const second = deriveSignals(vfxInput({
    tags: ['landing-dust', 'brake-sparks', 'landing-ring', 'speed-trail'],
    rootMotion: {
      ...rootSample,
      phase: 'landing',
      landingImpulse: .9,
      motionIntensity: .9,
      brakeIntensity: .9,
    },
  }))
  assert.deepEqual(first.map(item => item.kind), ['landing-dust', 'landing-ring', 'speed-trail'])
  assert.deepEqual(second, first)
})
