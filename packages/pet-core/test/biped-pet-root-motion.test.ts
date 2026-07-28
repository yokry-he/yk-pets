/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Root Motion 扩展的版本兼容规范化、Clip 编译与采样身份传播。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import * as petCore from '../src/index.ts'
import {
  BIPED_PET_RIG_PROFILE,
  compileBipedPetMotion,
  createStudioMotionAsset,
  normalizeMotionAsset,
  normalizeBipedPetRootMotion,
  normalizeMotionDurationMs,
  sampleBipedPetMotion,
} from '../src/index.ts'

type RootMotionSampler = (input: unknown) => {
  status: 'solved' | 'clamped' | 'reset' | 'blocked'
  requestedTimeMs: number
  resolvedTimeMs: number
  iteration: number
  cumulativeLocal: readonly [number, number, number]
  cumulativeWorld: readonly [number, number, number]
  appliedLocal: readonly [number, number, number]
  appliedWorld: readonly [number, number, number]
  deltaLocal: readonly [number, number, number]
  deltaWorld: readonly [number, number, number]
  cumulativeTurnRadians: number
  appliedTurnRadians: number
  deltaTurnRadians: number
  linearVelocity: readonly [number, number, number]
  angularVelocity: number
  phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  motionIntensity: number
  landingImpulse: number
  landingAuthorization?: {
    readonly touchdownRequestedTimeMs: number
    readonly impulse: number
  }
  brakeIntensity: number
}

function sampleRootMotion(input: unknown): ReturnType<RootMotionSampler> {
  const sampler = Reflect.get(petCore, 'sampleBipedPetRootMotion')
  assert.equal(typeof sampler, 'function', 'sampleBipedPetRootMotion 必须从 pet-core 入口导出')
  return (sampler as RootMotionSampler)(input)
}

function assertVectorClose(
  actual: readonly [number, number, number],
  expected: readonly [number, number, number],
  epsilon = 1e-12,
) {
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(Math.abs(actual[axis]! - expected[axis]!) <= epsilon, `轴 ${axis}：${actual[axis]} !== ${expected[axis]}`)
  }
}

function assertFiniteSample(sample: ReturnType<RootMotionSampler>) {
  const vectors = [
    sample.cumulativeLocal,
    sample.cumulativeWorld,
    sample.appliedLocal,
    sample.appliedWorld,
    sample.deltaLocal,
    sample.deltaWorld,
    sample.linearVelocity,
  ]
  for (const vector of vectors) assert.ok(Array.isArray(vector) && vector.length === 3, 'Root Motion 向量输出必须完整')
  for (const value of [
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
  ]) assert.ok(Number.isFinite(value), `Root Motion 输出必须有限，收到 ${String(value)}`)
}

const smoothstepForRootMotionTest = (progress: number) => progress * progress * (3 - 2 * progress)

const travelDefinition = {
  mode: 'travel' as const,
  distance: .42,
  turnRadians: .2,
  verticalMode: 'grounded' as const,
  jumpHeight: 0,
  windows: [{ id: 'walk', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
  vfxTags: [] as const,
}

const travelSampleInput = {
  definition: travelDefinition,
  requestedTimeMs: 600,
  previousRequestedTimeMs: 300,
  durationMs: 1200,
  loopMode: 'loop' as const,
  characterHeight: 4,
  facingRadians: 0,
  actionWeight: 1,
  footResidual: [0, 0, 0] as const,
}

const fixtureMotion = createStudioMotionAsset({
  id: 'root-motion-fixture',
  nameZh: '位移测试',
  nameEn: 'Root Motion Fixture',
  durationMs: 1200,
  displayFps: 30,
  loopMode: 'loop',
  tracks: [],
  propIds: [],
  propEventTracks: [],
  createdAt: 1,
  updatedAt: 1,
})

const canonicalInPlaceRootMotion = {
  mode: 'in-place',
  distance: 0,
  turnRadians: 0,
  verticalMode: 'grounded',
  jumpHeight: 0,
  windows: [],
  vfxTags: [],
}

test('合法 Root Motion 扩展会规范化、进入 Clip 哈希并传播到采样结果', () => {
  const input = {
    mode: 'travel',
    distance: .42,
    turnRadians: .2,
    verticalMode: 'grounded',
    windows: [{ id: 'walk', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['speed-trail'],
  }
  const normalized = normalizeBipedPetRootMotion(input, 1200)
  const clip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': { rootMotion: input } },
  })
  const legacyClip = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const sample = sampleBipedPetMotion(clip, 1300)

  assert.equal(normalized.value.mode, 'travel')
  assert.equal(normalized.value.distance, .42)
  assert.deepEqual(normalized.value.vfxTags, ['speed-trail'])
  assert.deepEqual(clip.rootMotion, normalized.value)
  assert.notEqual(clip.hash, legacyClip.hash)
  assert.equal(legacyClip.rootMotion.mode, 'in-place')
  assert.deepEqual(legacyClip.rootMotion.windows, [])
  assert.equal(sample.requestedTimeMs, 1300)
  assert.equal(sample.resolvedTimeMs, 100)
  assert.equal(sample.iteration, 1)
  assert.equal(sample.direction, 1)
  assert.deepEqual(sample.rootMotion, clip.rootMotion)
})

test('规范化会复制输入与深层结构且不与调用方共享引用', () => {
  const input = {
    mode: 'travel',
    distance: .5,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [{ id: 'walk', kind: 'travel', startMs: 10, endMs: 900, weight: .8 }],
    vfxTags: ['speed-trail', 'landing-ring'],
  }
  const snapshot = structuredClone(input)
  const normalized = normalizeBipedPetRootMotion(input, 1200)

  assert.deepEqual(input, snapshot)
  assert.notEqual(normalized.value.windows, input.windows)
  assert.notEqual(normalized.value.windows[0], input.windows[0])
  assert.notEqual(normalized.value.vfxTags, input.vfxTags)
  assert.deepEqual(normalized.value.windows[0], input.windows[0])
})

test('有限位移、转向、跳高和窗口权重会钳制到安全边界', () => {
  const normalized = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 9,
    turnRadians: Math.PI * 3,
    verticalMode: 'ballistic',
    jumpHeight: 2,
    windows: [{ id: 'clamped', kind: 'ballistic', startMs: -100, endMs: 1300, weight: 4 }],
  }, 1200)

  assert.equal(normalized.value.mode, 'travel')
  assert.equal(normalized.value.distance, 4)
  assert.equal(normalized.value.turnRadians, Math.PI * 2)
  assert.equal(normalized.value.jumpHeight, 1.5)
  assert.deepEqual(normalized.value.windows, [{ id: 'clamped', kind: 'ballistic', startMs: 0, endMs: 1200, weight: 1 }])
  assert.ok(normalized.diagnostics.every(item => item.severity === 'warning'))

  const inPlace = normalizeBipedPetRootMotion({
    mode: 'in-place', distance: 1, turnRadians: 1, verticalMode: 'ballistic', jumpHeight: 1,
  }, 1200)
  assert.deepEqual({
    distance: inPlace.value.distance,
    turnRadians: inPlace.value.turnRadians,
    jumpHeight: inPlace.value.jumpHeight,
  }, { distance: 0, turnRadians: 0, jumpHeight: 0 })
})

test('窗口会丢弃无效项并按范围与 Unicode code-point 身份稳定排序', () => {
  const input = {
    mode: 'travel',
    distance: .5,
    windows: [
      { id: '\u{10000}', kind: 'warp', startMs: 0, endMs: 400, weight: .7 },
      { id: '\uE000', kind: 'brake', startMs: 0, endMs: 400, weight: .8 },
      { id: 'later', kind: 'travel', startMs: 200, endMs: 600, weight: 1 },
      { id: 'longer', kind: 'travel', startMs: 0, endMs: 800, weight: 1 },
      { id: '', kind: 'travel', startMs: 0, endMs: 100, weight: 1 },
      { id: 'unknown-kind', kind: 'unknown', startMs: 0, endMs: 100, weight: 1 },
      { id: 'reverse', kind: 'travel', startMs: 400, endMs: 100, weight: 1 },
      { id: 'zero', kind: 'travel', startMs: 100, endMs: 100, weight: 1 },
      { id: 'bad-number', kind: 'travel', startMs: Number.NaN, endMs: 100, weight: 1 },
      { id: 'zero-weight', kind: 'travel', startMs: 0, endMs: 100, weight: 0 },
      { id: 'infinite-weight', kind: 'travel', startMs: 0, endMs: 100, weight: Number.POSITIVE_INFINITY },
      null,
    ],
  }
  const first = normalizeBipedPetRootMotion(input, 1200)
  const second = normalizeBipedPetRootMotion(structuredClone(input), 1200)

  assert.deepEqual(first.value.windows.map(item => item.id), ['\uE000', '\u{10000}', 'longer', 'later'])
  assert.deepEqual(first, second)
  assert.ok(first.diagnostics.length >= 8)
  assert.ok(first.diagnostics.every(item => item.severity === 'warning' && /[\u3400-\u9fff]/u.test(item.message)))
})

test('特效标签只保留受支持枚举、去重并按 code-point 排序', () => {
  const normalized = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: .2,
    vfxTags: [
      'speed-trail',
      'landing-ring',
      'brake-sparks',
      'landing-dust',
      'speed-trail',
      'unknown-tag',
      1,
    ],
  }, 1200)

  assert.deepEqual(normalized.value.vfxTags, ['brake-sparks', 'landing-dust', 'landing-ring', 'speed-trail'])
  assert.ok(normalized.diagnostics.some(item => item.id.includes('vfx-tag')))
})

test('非法核心字段与动作时长只产生稳定 warning 并安全回退原地', () => {
  const invalid = {
    mode: 'travel',
    distance: Number.POSITIVE_INFINITY,
    turnRadians: Number.NaN,
    verticalMode: 'flying',
    jumpHeight: 'high',
    windows: [{ id: '', kind: 'travel', startMs: 400, endMs: 100, weight: 5 }],
  }
  const first = normalizeBipedPetRootMotion(invalid, Number.NaN)
  const second = normalizeBipedPetRootMotion(invalid, Number.NaN)

  assert.equal(first.value.mode, 'in-place')
  assert.equal(first.value.distance, 0)
  assert.equal(first.value.turnRadians, 0)
  assert.equal(first.value.jumpHeight, 0)
  assert.deepEqual(first.diagnostics, second.diagnostics)
  assert.equal(first.diagnostics[0]?.id, 'root-motion-duration-invalid')
  assert.ok(first.diagnostics.every(item => item.severity === 'warning'))
})

test('未知枚举、畸形对象和 Proxy 访问异常不会逃逸为运行时异常', () => {
  const accessFailure = new Proxy({}, {
    get() {
      throw new Error('不应逃逸')
    },
  })
  const windowAccessFailure = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') throw new Error('不应逃逸')
      return Reflect.get(target, property, receiver)
    },
  })
  const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {})
  revoke()

  for (const input of [[], 'bad', accessFailure, revokedProxy, { mode: 'travel', distance: .1, windows: windowAccessFailure }]) {
    let result: ReturnType<typeof normalizeBipedPetRootMotion> | undefined
    assert.doesNotThrow(() => { result = normalizeBipedPetRootMotion(input, 1200) })
    assert.equal(result?.value.mode, 'in-place')
    assert.ok(result?.diagnostics.every(item => item.severity === 'warning'))
  }
})

test('blocked Clip 与 ping-pong 采样保留安全原地定义和统一时间身份', () => {
  const asset = createStudioMotionAsset({
    ...fixtureMotion,
    id: 'blocked-root-motion',
    loopMode: 'ping-pong',
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: { mode: 'travel', distance: 1, turnRadians: .5, verticalMode: 'grounded' },
      },
    },
  })
  const clip = compileBipedPetMotion(asset, { profile: { ...BIPED_PET_RIG_PROFILE, bones: [] } })
  const sample = sampleBipedPetMotion(clip, 1300)

  assert.equal(clip.status, 'blocked')
  assert.deepEqual(clip.rootMotion, {
    mode: 'in-place',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [],
    vfxTags: [],
  })
  assert.equal(sample.requestedTimeMs, 1300)
  assert.equal(sample.resolvedTimeMs, 1100)
  assert.equal(sample.iteration, 1)
  assert.equal(sample.direction, -1)
  assert.deepEqual(sample.rootMotion, clip.rootMotion)
})

test('动作扩展命名空间的 getter 全部异常时编译仍返回稳定可检查 Clip', () => {
  const namespace = new Proxy({}, {
    get() {
      throw new Error('外部扩展 getter 不应逃逸')
    },
  })
  const asset = {
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': namespace },
  }
  let first: ReturnType<typeof compileBipedPetMotion> | undefined
  let second: ReturnType<typeof compileBipedPetMotion> | undefined

  assert.doesNotThrow(() => { first = compileBipedPetMotion(asset) })
  assert.doesNotThrow(() => { second = compileBipedPetMotion(asset) })
  assert.equal(first?.status, 'ready')
  assert.equal(first?.rootMotion.mode, 'in-place')
  assert.deepEqual(first?.contacts, [])
  assert.deepEqual(first?.events, [])
  assert.deepEqual(first?.diagnostics, second?.diagnostics)
  assert.ok(first?.diagnostics.some(item => item.severity === 'warning' && item.id.includes('access-failed')))
})

test('补充平面的不同窗口 ID 会产生不同 Root Motion Clip 哈希', () => {
  const compile = (windowId: string) => compileBipedPetMotion({
    ...fixtureMotion,
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: {
          mode: 'travel',
          distance: .4,
          windows: [{ id: windowId, kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
        },
      },
    },
  })

  const first = compile('\u{10000}')
  const second = compile('\u{10001}')

  assert.notEqual(first.hash, second.hash)
})

test('无效 Profile 不会遮蔽 Root Motion 警告且 blocked 定义保持深层隔离', () => {
  const invalidRootMotion = {
    mode: 'travel',
    distance: Number.POSITIVE_INFINITY,
    windows: [{ id: 'reverse', kind: 'travel', startMs: 600, endMs: 100, weight: 1 }],
  }
  const asset = {
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': { rootMotion: invalidRootMotion } },
  }
  const invalidProfile = { ...BIPED_PET_RIG_PROFILE, bones: [] }
  const normalized = normalizeBipedPetRootMotion(invalidRootMotion, fixtureMotion.durationMs)
  const first = compileBipedPetMotion(asset, { profile: invalidProfile })
  const second = compileBipedPetMotion(asset, { profile: invalidProfile })

  assert.equal(first.status, 'blocked')
  assert.ok(first.diagnostics.some(item => item.severity === 'error' && item.id.startsWith('motion-profile-validation-')))
  assert.ok(first.diagnostics.some(item => item.severity === 'warning' && item.id.startsWith('root-motion-')))
  assert.deepEqual(first.diagnostics, second.diagnostics)
  assert.deepEqual(first.rootMotion, normalized.value)
  assert.equal(first.rootMotion.mode, 'in-place')
  assert.notEqual(first.rootMotion, normalized.value)
  assert.notEqual(first.rootMotion, second.rootMotion)
  assert.notEqual(first.rootMotion.windows, normalized.value.windows)
  assert.notEqual(first.rootMotion.windows, second.rootMotion.windows)
  assert.notEqual(first.rootMotion.vfxTags, normalized.value.vfxTags)
  assert.notEqual(first.rootMotion.vfxTags, second.rootMotion.vfxTags)
})

test('编译入口会局部隔离顶层和命名空间扩展访问异常', () => {
  const throwingTopLevelGetter = Object.defineProperty({ ...fixtureMotion }, 'extensions', {
    enumerable: true,
    get() {
      throw new Error('顶层 extensions getter 不应逃逸')
    },
  })
  const throwingNamespaceGetter = Object.defineProperty({}, 'yk-pets/biped-motion/v1', {
    enumerable: true,
    get() {
      throw new Error('命名空间 getter 不应逃逸')
    },
  })
  const throwingOwnKeys = new Proxy({}, {
    ownKeys() {
      throw new Error('extensions ownKeys 不应逃逸')
    },
  })
  const { proxy: revokedExtensions, revoke } = Proxy.revocable({}, {})
  revoke()
  const inputs = [
    throwingTopLevelGetter,
    { ...fixtureMotion, extensions: throwingNamespaceGetter },
    { ...fixtureMotion, extensions: throwingOwnKeys },
    { ...fixtureMotion, extensions: revokedExtensions },
  ]

  for (const input of inputs) {
    let first: ReturnType<typeof compileBipedPetMotion> | undefined
    let second: ReturnType<typeof compileBipedPetMotion> | undefined
    assert.doesNotThrow(() => { first = compileBipedPetMotion(input) })
    assert.doesNotThrow(() => { second = compileBipedPetMotion(input) })
    assert.equal(first?.status, 'ready')
    assert.deepEqual(first?.rootMotion, canonicalInPlaceRootMotion)
    assert.deepEqual(first?.diagnostics, second?.diagnostics)
    assert.ok(first?.diagnostics.some(item => item.severity === 'warning' && /[\u3400-\u9fff]/u.test(item.message)))
  }
})

test('JSON 危险扩展键不能注入正式命名空间且往返编译保持确定', () => {
  const input = JSON.parse(`{
    "id": "prototype-extension",
    "nameZh": "原型扩展",
    "nameEn": "Prototype Extension",
    "durationMs": 1200,
    "displayFps": 30,
    "loopMode": "loop",
    "tracks": [],
    "propIds": [],
    "propEventTracks": [],
    "createdAt": 1,
    "updatedAt": 1,
    "extensions": {
      "__proto__": {
        "yk-pets/biped-motion/v1": {
          "rootMotion": { "mode": "travel", "distance": 0.8 }
        }
      },
      "constructor": { "kept": true },
      "prototype": { "kept": true },
      "third-party/example": { "kept": true }
    }
  }`)
  const normalized = normalizeMotionAsset(input, { now: 1 }).asset
  const direct = compileBipedPetMotion(normalized)
  const serialized = JSON.stringify(normalized)
  const roundTrippedAsset = normalizeMotionAsset(JSON.parse(serialized), { now: 1 }).asset
  const roundTripped = compileBipedPetMotion(roundTrippedAsset)

  assert.ok(normalized.extensions)
  assert.equal(Object.getPrototypeOf(normalized.extensions), null)
  assert.ok(Object.hasOwn(normalized.extensions, '__proto__'))
  assert.ok(Object.hasOwn(normalized.extensions, 'constructor'))
  assert.ok(Object.hasOwn(normalized.extensions, 'prototype'))
  assert.ok(Object.hasOwn(normalized.extensions, 'third-party/example'))
  assert.equal(Object.hasOwn(normalized.extensions, 'yk-pets/biped-motion/v1'), false)
  assert.deepEqual(Reflect.get(normalized.extensions, 'third-party/example'), { kept: true })
  assert.ok(serialized.includes('"__proto__"'))
  assert.equal(direct.rootMotion.mode, 'in-place')
  assert.equal(roundTripped.rootMotion.mode, 'in-place')
  assert.equal(roundTripped.hash, direct.hash)
  assert.deepEqual(roundTripped.rootMotion, direct.rootMotion)
})

test('只有 undefined 是兼容缺失，显式 null 扩展会产生稳定 warning', () => {
  assert.deepEqual(normalizeBipedPetRootMotion(undefined, 1200).diagnostics, [])
  assert.deepEqual(normalizeBipedPetRootMotion(null, 1200).diagnostics.map(item => item.id), ['root-motion-input-invalid'])

  const nullExtensions = compileBipedPetMotion({ ...fixtureMotion, extensions: null })
  const nullNamespace = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': null },
  })
  const nullRootMotion = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': { rootMotion: null } },
  })

  assert.ok(nullExtensions.diagnostics.some(item => item.message.includes('extensions-invalid')))
  assert.deepEqual(nullNamespace.diagnostics.map(item => item.id), ['biped-motion-extension-invalid'])
  assert.deepEqual(nullRootMotion.diagnostics.map(item => item.id), ['root-motion-input-invalid'])
})

test('Root Motion 窗口与 VFX 标签按业务预算截断并聚合诊断', () => {
  let windowReads = 0
  let tagReads = 0
  const windows = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') return 10_000
      if (typeof property === 'string' && /^\d+$/u.test(property)) windowReads += 1
      return Reflect.get(target, property, receiver)
    },
  })
  const vfxTags = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') return 10_000
      if (typeof property === 'string' && /^\d+$/u.test(property)) tagReads += 1
      return Reflect.get(target, property, receiver)
    },
  })
  const result = normalizeBipedPetRootMotion({ mode: 'travel', distance: .2, windows, vfxTags }, 1200)

  assert.equal(windowReads, 64)
  assert.equal(tagReads, 16)
  assert.equal(result.diagnostics.filter(item => item.id === 'root-motion-windows-budget-exceeded').length, 1)
  assert.equal(result.diagnostics.filter(item => item.id === 'root-motion-vfxTags-budget-exceeded').length, 1)
  assert.ok(result.diagnostics.length <= 82)
})

test('接触候选与语义事件按业务预算截断并聚合诊断', () => {
  let contactReads = 0
  let eventReads = 0
  const contacts = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') return 10_000
      if (typeof property === 'string' && /^\d+$/u.test(property)) contactReads += 1
      return Reflect.get(target, property, receiver)
    },
  })
  const events = new Proxy([], {
    get(target, property, receiver) {
      if (property === 'length') return 10_000
      if (typeof property === 'string' && /^\d+$/u.test(property)) eventReads += 1
      return Reflect.get(target, property, receiver)
    },
  })
  const clip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: { 'yk-pets/biped-motion/v1': { contacts, events } },
  })

  assert.equal(contactReads, 64)
  assert.equal(eventReads, 64)
  assert.equal(clip.diagnostics.filter(item => item.id === 'biped-motion-contacts-budget-exceeded').length, 1)
  assert.equal(clip.diagnostics.filter(item => item.id === 'biped-motion-events-budget-exceeded').length, 1)
  assert.ok(clip.diagnostics.length <= 130)
})

test('采样复用递归冻结的 Root Motion 且无法污染 Clip 或哈希', () => {
  const clip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: {
          mode: 'travel',
          distance: .5,
          windows: [{ id: 'walk', kind: 'travel', startMs: 0, endMs: 1200, weight: .8 }],
          vfxTags: ['speed-trail'],
        },
      },
    },
  })
  const before = structuredClone(clip.rootMotion)
  const hash = clip.hash
  const sample = sampleBipedPetMotion(clip, 100)

  assert.equal(sample.rootMotion, clip.rootMotion)
  assert.ok(Object.isFrozen(sample.rootMotion))
  assert.ok(Object.isFrozen(sample.rootMotion.windows))
  assert.ok(Object.isFrozen(sample.rootMotion.windows[0]))
  assert.ok(Object.isFrozen(sample.rootMotion.vfxTags))
  assert.throws(() => { (sample.rootMotion as { distance: number }).distance = 3 }, TypeError)
  assert.throws(() => { (sample.rootMotion.windows[0] as { weight: number }).weight = .1 }, TypeError)
  assert.throws(() => { (sample.rootMotion.windows as unknown[]).push({}) }, TypeError)
  assert.deepEqual(clip.rootMotion, before)
  assert.equal(clip.hash, hash)
})

test('所有 blocked 路径无条件使用冻结的 canonical 原地 Root Motion', () => {
  const clip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: {
          mode: 'in-place',
          distance: Number.POSITIVE_INFINITY,
          verticalMode: 'ballistic',
          windows: [{ id: 'residual', kind: 'ballistic', startMs: 0, endMs: 1200, weight: 1 }],
          vfxTags: ['landing-ring'],
        },
      },
    },
  }, { profile: { ...BIPED_PET_RIG_PROFILE, bones: [] } })

  assert.equal(clip.status, 'blocked')
  assert.deepEqual(clip.rootMotion, canonicalInPlaceRootMotion)
  assert.ok(Object.isFrozen(clip.rootMotion))
  assert.ok(Object.isFrozen(clip.rootMotion.windows))
  assert.ok(Object.isFrozen(clip.rootMotion.vfxTags))
  assert.ok(clip.diagnostics.some(item => item.severity === 'warning' && item.id.startsWith('root-motion-')))
  assert.ok(clip.diagnostics.some(item => item.severity === 'error' && item.id.startsWith('motion-profile-validation-')))
})

test('历史 V1 Clip 缺失或损坏 Root Motion 时采样迁移为冻结 canonical 原地定义', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const { rootMotion: _readyRootMotion, ...legacyReady } = current
  const blocked = compileBipedPetMotion(fixtureMotion, { profile: { ...BIPED_PET_RIG_PROFILE, bones: [] } })
  const { rootMotion: _blockedRootMotion, ...legacyBlocked } = blocked
  const missing = sampleBipedPetMotion(legacyReady as typeof current, 100)
  const malformed = sampleBipedPetMotion({ ...legacyReady, rootMotion: null } as unknown as typeof current, 100)
  const blockedMissing = sampleBipedPetMotion(legacyBlocked as typeof blocked, 100)
  const blockedTravel = sampleBipedPetMotion({
    ...blocked,
    rootMotion: {
      mode: 'travel',
      distance: .8,
      turnRadians: .3,
      verticalMode: 'ballistic',
      jumpHeight: .6,
      windows: [{ id: 'legacy-travel', kind: 'ballistic', startMs: 0, endMs: 1200, weight: 1 }],
      vfxTags: ['landing-ring'],
    },
  }, 100)

  for (const sample of [missing, malformed, blockedMissing, blockedTravel]) {
    assert.deepEqual(sample.rootMotion, canonicalInPlaceRootMotion)
    assert.ok(Object.isFrozen(sample.rootMotion))
    assert.ok(Object.isFrozen(sample.rootMotion.windows))
    assert.ok(Object.isFrozen(sample.rootMotion.vfxTags))
  }
})

test('同一历史 V1 Clip 从 ready 切到 blocked 后不得复用 travel 缓存', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const firstRootMotion = {
    mode: 'travel' as const,
    distance: .4,
    turnRadians: .1,
    verticalMode: 'grounded' as const,
    jumpHeight: 0,
    windows: [{ id: 'first', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['speed-trail' as const],
  }
  const secondRootMotion = {
    ...firstRootMotion,
    distance: .9,
    windows: [{ id: 'second', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
  }
  const clip = { ...current, rootMotion: firstRootMotion }
  const mutableClip = clip as unknown as { status: 'ready' | 'blocked'; rootMotion: typeof firstRootMotion }

  assert.equal(sampleBipedPetMotion(clip, 100).rootMotion.distance, .4)
  mutableClip.rootMotion = secondRootMotion
  assert.equal(sampleBipedPetMotion(clip, 100).rootMotion.distance, .9)
  mutableClip.status = 'blocked'

  const blockedSample = sampleBipedPetMotion(clip, 100)
  assert.deepEqual(blockedSample.rootMotion, canonicalInPlaceRootMotion)
  assert.ok(Object.isFrozen(blockedSample.rootMotion))
})

test('历史 Clip 原地修改非 canonical Root Motion 后不得命中陈旧 identity 缓存', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const rootMotion = {
    mode: 'travel' as const,
    distance: .4,
    turnRadians: .1,
    verticalMode: 'grounded' as const,
    jumpHeight: 0,
    windows: [{ id: 'mutable', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['speed-trail' as const],
  }
  const clip = { ...current, rootMotion }
  const first = sampleBipedPetMotion(clip, 100).rootMotion

  rootMotion.distance = .9
  rootMotion.windows[0]!.weight = .25
  const second = sampleBipedPetMotion(clip, 100).rootMotion

  assert.notEqual(second, first)
  assert.equal(second.distance, .9)
  assert.equal(second.windows[0]?.weight, .25)
  assert.equal(first.distance, .4)
  assert.equal(first.windows[0]?.weight, 1)
})

test('同一历史 V1 Clip 从 blocked 切回 ready 后不得复用原地缓存', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const travelRootMotion = {
    mode: 'travel' as const,
    distance: .7,
    turnRadians: .2,
    verticalMode: 'ballistic' as const,
    jumpHeight: .5,
    windows: [{ id: 'resume', kind: 'ballistic' as const, startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['landing-ring' as const],
  }
  const clip = { ...current, status: 'blocked' as const, rootMotion: travelRootMotion }
  const mutableClip = clip as unknown as { status: 'ready' | 'blocked' }

  assert.deepEqual(sampleBipedPetMotion(clip, 100).rootMotion, canonicalInPlaceRootMotion)
  mutableClip.status = 'ready'

  const readySample = sampleBipedPetMotion(clip, 100)
  assert.equal(readySample.rootMotion.distance, .7)
  assert.equal(readySample.rootMotion.verticalMode, 'ballistic')
  assert.deepEqual(readySample.rootMotion.vfxTags, ['landing-ring'])
  assert.ok(Object.isFrozen(readySample.rootMotion))
})

test('同一历史 V1 Clip 修改动作时长后会重新钳制窗口并冻结新定义', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const rootMotion = {
    mode: 'travel' as const,
    distance: .6,
    turnRadians: .1,
    verticalMode: 'grounded' as const,
    jumpHeight: 0,
    windows: [{ id: 'duration-window', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
    vfxTags: ['speed-trail' as const],
  }
  const clip = { ...current, rootMotion }
  const mutableClip = clip as unknown as { durationMs: number }
  const first = sampleBipedPetMotion(clip, 100).rootMotion

  assert.equal(first.windows[0]?.endMs, 1200)
  mutableClip.durationMs = 600
  const shortened = sampleBipedPetMotion(clip, 100).rootMotion

  assert.notEqual(shortened, first)
  assert.equal(shortened.mode, 'travel')
  assert.equal(shortened.windows[0]?.endMs, 600)
  assert.ok(Object.isFrozen(shortened))
  assert.ok(Object.isFrozen(shortened.windows[0]))
})

test('历史 V1 Clip 的非有限或非正时长按 canonical duration 重建且不命中旧 ready 缓存', () => {
  const current = compileBipedPetMotion({ ...fixtureMotion, extensions: undefined })
  const clip = {
    ...current,
    rootMotion: {
      mode: 'travel' as const,
      distance: .5,
      turnRadians: 0,
      verticalMode: 'grounded' as const,
      jumpHeight: 0,
      windows: [{ id: 'invalid-duration', kind: 'travel' as const, startMs: 0, endMs: 1000, weight: 1 }],
      vfxTags: [] as const,
    },
  }
  const mutableClip = clip as unknown as { durationMs: number }

  assert.equal(sampleBipedPetMotion(clip, 100).rootMotion.mode, 'travel')
  mutableClip.durationMs = Number.NaN
  const nonFinite = sampleBipedPetMotion(clip, 100).rootMotion
  const repeatedNonFinite = sampleBipedPetMotion(clip, 100).rootMotion
  assert.equal(nonFinite.mode, 'travel')
  assert.equal(nonFinite.windows[0]?.endMs, 1000)
  assert.equal(repeatedNonFinite, nonFinite)

  mutableClip.durationMs = 0
  const nonPositive = sampleBipedPetMotion(clip, 100).rootMotion
  assert.equal(nonPositive.mode, 'travel')
  assert.equal(nonPositive.windows[0]?.endMs, 100)
  assert.notEqual(nonPositive, nonFinite)
})

test('当前编译 Clip 修改时长后不得复用旧时长 canonical Root Motion', () => {
  const clip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: {
          mode: 'travel',
          distance: .8,
          windows: [{ id: 'compiled-duration', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
        },
      },
    },
  })
  const original = clip.rootMotion
  const mutableClip = clip as unknown as { durationMs: number }

  assert.equal(sampleBipedPetMotion(clip, 100).rootMotion, original)
  mutableClip.durationMs = 600
  const shortened = sampleBipedPetMotion(clip, 100).rootMotion

  assert.notEqual(shortened, original)
  assert.equal(shortened.windows[0]?.endMs, 600)
  assert.equal(original.windows[0]?.endMs, 1200)
  assert.ok(Object.isFrozen(shortened))
  assert.ok(Object.isFrozen(shortened.windows[0]))
})

test('跨 Clip 复用不同规范化时长的 canonical Root Motion 时会重新钳制', () => {
  const sourceClip = compileBipedPetMotion({
    ...fixtureMotion,
    extensions: {
      'yk-pets/biped-motion/v1': {
        rootMotion: {
          mode: 'travel',
          distance: .5,
          windows: [{ id: 'shared-duration', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
          vfxTags: ['speed-trail'],
        },
      },
    },
  })
  const reusedClip = { ...sourceClip, durationMs: 600, rootMotion: sourceClip.rootMotion }
  const sample = sampleBipedPetMotion(reusedClip, 100)

  assert.notEqual(sample.rootMotion, sourceClip.rootMotion)
  assert.equal(sample.rootMotion.windows[0]?.endMs, 600)
  assert.equal(sourceClip.rootMotion.windows[0]?.endMs, 1200)
  assert.ok(Object.isFrozen(sample.rootMotion))
  assert.ok(Object.isFrozen(sample.rootMotion.windows[0]))
})

test('Root Motion 哈希保持 ASCII 路径并覆盖全部契约字段', () => {
  const base = {
    mode: 'travel',
    distance: .5,
    turnRadians: .1,
    verticalMode: 'ballistic',
    jumpHeight: .3,
    windows: [{ id: 'ascii-window', kind: 'travel', startMs: 0, endMs: 1000, weight: .5 }],
    vfxTags: ['speed-trail'],
  }
  const compileHash = (rootMotion: unknown) => compileBipedPetMotion(createStudioMotionAsset({
    id: 'hash-fixture',
    nameZh: '哈希',
    nameEn: 'Hash',
    durationMs: 1200,
    displayFps: 30,
    loopMode: 'loop',
    tracks: [],
    propIds: [],
    propEventTracks: [],
    createdAt: 1,
    updatedAt: 1,
    extensions: { 'yk-pets/biped-motion/v1': { rootMotion } },
  })).hash
  const baseHash = compileHash(base)
  const variants: readonly (readonly [string, unknown])[] = [
    ['mode', { ...base, mode: 'in-place' }],
    ['distance', { ...base, distance: .6 }],
    ['turnRadians', { ...base, turnRadians: .2 }],
    ['verticalMode', { ...base, verticalMode: 'grounded' }],
    ['jumpHeight', { ...base, jumpHeight: .4 }],
    ['window.id', { ...base, windows: [{ ...base.windows[0]!, id: 'ascii-window-b' }] }],
    ['window.kind', { ...base, windows: [{ ...base.windows[0]!, kind: 'warp' }] }],
    ['window.startMs', { ...base, windows: [{ ...base.windows[0]!, startMs: 100 }] }],
    ['window.endMs', { ...base, windows: [{ ...base.windows[0]!, endMs: 1100 }] }],
    ['window.weight', { ...base, windows: [{ ...base.windows[0]!, weight: .7 }] }],
    ['vfxTags', { ...base, vfxTags: ['landing-ring'] }],
  ]

  assert.equal(baseHash, 'bpm-de56d188')
  for (const [field, variant] of variants) assert.notEqual(compileHash(variant), baseHash, `${field} 未进入哈希`)
})

test('Root Motion 数值采样器从公共入口导出', () => {
  assert.equal(typeof Reflect.get(petCore, 'sampleBipedPetRootMotion'), 'function')
  assert.equal(Reflect.get(petCore, 'analyzeBipedPetBallisticTimeline'), undefined, '时间线分析器只供包内采样与直接路径测试使用')
})

test('累计位移与帧率无关并在 loop 接缝连续，回拖与大跳只重置瞬时量', () => {
  const half = sampleRootMotion(travelSampleInput)
  assert.equal(half.status, 'reset')
  assert.ok(Math.abs(half.cumulativeLocal[0] - .84) < 1e-9)

  const thirty = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 0, requestedTimeMs: 600 })
  const sixty = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 300, requestedTimeMs: 600 })
  assert.deepEqual(thirty.cumulativeLocal, sixty.cumulativeLocal)

  const beforeSeam = sampleRootMotion({ ...travelSampleInput, requestedTimeMs: 1190, previousRequestedTimeMs: undefined })
  const nextCycle = sampleRootMotion({
    ...travelSampleInput,
    previousRequestedTimeMs: 1190,
    previousAppliedWorld: beforeSeam.appliedWorld,
    previousAppliedTurnRadians: beforeSeam.appliedTurnRadians,
    requestedTimeMs: 1210,
  })
  assert.ok(nextCycle.deltaLocal[0] > 0)
  assert.equal(nextCycle.iteration, 1)

  const rewind = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 800, requestedTimeMs: 200 })
  assert.equal(rewind.status, 'reset')
  assert.deepEqual(rewind.deltaLocal, [0, 0, 0])
  assert.deepEqual(rewind.linearVelocity, [0, 0, 0])

  const first = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: undefined })
  assert.equal(first.status, 'reset')
  assert.deepEqual(first.deltaLocal, [0, 0, 0])

  const paused = sampleRootMotion({
    ...travelSampleInput,
    previousRequestedTimeMs: 600,
    previousAppliedWorld: half.appliedWorld,
    previousAppliedTurnRadians: half.appliedTurnRadians,
  })
  assert.equal(paused.status, 'solved')
  assert.deepEqual(paused.deltaLocal, [0, 0, 0])
  assert.deepEqual(paused.linearVelocity, [0, 0, 0])
  assert.equal(paused.landingImpulse, 0)
  assert.equal(paused.brakeIntensity, 0)

  // 连续阈值与足锁控制器一致：max(250ms, duration × 0.5)。超过后由调用方重新建立历史身份。
  const start = sampleRootMotion({ ...travelSampleInput, requestedTimeMs: 0, previousRequestedTimeMs: undefined })
  const largeJump = sampleRootMotion({
    ...travelSampleInput,
    previousRequestedTimeMs: 0,
    previousAppliedWorld: start.appliedWorld,
    previousAppliedTurnRadians: start.appliedTurnRadians,
    requestedTimeMs: 601,
  })
  assert.equal(largeJump.status, 'reset')
  assert.deepEqual(largeJump.deltaLocal, [0, 0, 0])
})

test('once 保持终点，ping-pong 使用明确的往返累计语义', () => {
  const onceEnd = sampleRootMotion({
    ...travelSampleInput,
    loopMode: 'once',
    previousRequestedTimeMs: 1190,
    requestedTimeMs: 1210,
  })
  const oncePaused = sampleRootMotion({
    ...travelSampleInput,
    loopMode: 'once',
    previousRequestedTimeMs: 1210,
    requestedTimeMs: 1220,
  })
  assert.equal(onceEnd.cumulativeLocal[0], .42 * 4)
  assert.deepEqual(oncePaused.deltaLocal, [0, 0, 0])

  const turnPoint = sampleRootMotion({ ...travelSampleInput, loopMode: 'ping-pong', requestedTimeMs: 1200, previousRequestedTimeMs: undefined })
  const returning = sampleRootMotion({
    ...travelSampleInput,
    loopMode: 'ping-pong',
    previousRequestedTimeMs: 1200,
    previousAppliedWorld: turnPoint.appliedWorld,
    previousAppliedTurnRadians: turnPoint.appliedTurnRadians,
    requestedTimeMs: 1210,
  })
  assert.equal(returning.iteration, 1)
  assert.ok(returning.deltaLocal[0] < 0)
  assert.ok(returning.linearVelocity[0] < 0)

  const noHorizontalDefinition = { ...travelDefinition, distance: 1, turnRadians: 1, windows: [] }
  const noHorizontalPrevious = sampleRootMotion({
    ...travelSampleInput,
    definition: noHorizontalDefinition,
    durationMs: 1000,
    requestedTimeMs: 999,
    previousRequestedTimeMs: undefined,
  })
  const noHorizontalWindows = sampleRootMotion({
    ...travelSampleInput,
    definition: noHorizontalDefinition,
    durationMs: 1000,
    previousRequestedTimeMs: 999,
    previousAppliedWorld: noHorizontalPrevious.appliedWorld,
    previousAppliedTurnRadians: noHorizontalPrevious.appliedTurnRadians,
    requestedTimeMs: 1000,
  })
  assert.equal(noHorizontalWindows.status, 'solved')
  assert.deepEqual(noHorizontalWindows.cumulativeLocal, [0, 0, 0])
  assert.deepEqual(noHorizontalWindows.deltaLocal, [0, 0, 0])
  assert.equal(noHorizontalWindows.cumulativeTurnRadians, 0)
  assert.equal(noHorizontalWindows.deltaTurnRadians, 0)
})

test('ballistic 窗口给出连续高度、确定阶段与单次落地冲量', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .5,
    windows: [{ id: 'jump', kind: 'ballistic' as const, startMs: 200, endMs: 1000, weight: 1 }],
    vfxTags: [] as const,
  }
  const sampleAt = (requestedTimeMs: number) => sampleRootMotion({
    ...travelSampleInput,
    definition,
    requestedTimeMs,
    previousRequestedTimeMs: requestedTimeMs,
  })

  assert.deepEqual([sampleAt(100).cumulativeLocal[1], sampleAt(1100).cumulativeLocal[1]], [0, 0])
  assert.deepEqual([sampleAt(100).phase, sampleAt(1100).phase], ['grounded', 'grounded'])
  assert.deepEqual([sampleAt(200).cumulativeLocal[1], sampleAt(1000).cumulativeLocal[1]], [0, 0])
  assert.equal(sampleAt(200).phase, 'grounded')
  assert.equal(sampleAt(400).phase, 'airborne')
  assert.equal(sampleAt(600).phase, 'airborne')
  assert.equal(sampleAt(800).phase, 'airborne')
  assert.equal(sampleAt(1000).phase, 'grounded')
  const quarterProgress = smoothstepForRootMotionTest(.25)
  assert.ok(Math.abs(sampleAt(400).cumulativeLocal[1] - 4 * 2 * quarterProgress * (1 - quarterProgress)) < 1e-12)
  assert.ok(Math.abs(sampleAt(600).cumulativeLocal[1] - 2) < 1e-12)
  assert.ok(Math.abs(sampleAt(800).cumulativeLocal[1] - 4 * 2 * quarterProgress * (1 - quarterProgress)) < 1e-12)

  const continuousPhase = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleAt(previousRequestedTimeMs)
    return sampleRootMotion({
      ...travelSampleInput,
      definition,
      previousRequestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      requestedTimeMs,
    })
  }
  assert.equal(continuousPhase(399, 400).phase, 'takeoff')
  assert.equal(continuousPhase(799, 800).phase, 'landing')
  assert.equal(continuousPhase(600, 600).phase, 'airborne')

  const beforeLandingPhase = sampleAt(799)
  const enteringLanding = sampleRootMotion({
    ...travelSampleInput,
    definition,
    previousRequestedTimeMs: 799,
    previousAppliedWorld: beforeLandingPhase.appliedWorld,
    previousAppliedTurnRadians: beforeLandingPhase.appliedTurnRadians,
    requestedTimeMs: 801,
  })
  const beforeLandingPoint = sampleAt(999)
  const landingPoint = sampleRootMotion({
    ...travelSampleInput,
    definition,
    previousRequestedTimeMs: 999,
    previousAppliedWorld: beforeLandingPoint.appliedWorld,
    previousAppliedTurnRadians: beforeLandingPoint.appliedTurnRadians,
    requestedTimeMs: 1001,
  })
  assert.equal(enteringLanding.landingImpulse, 0)
  assert.ok(landingPoint.landingImpulse > 0)
  assert.equal(sampleRootMotion({ ...travelSampleInput, definition, previousRequestedTimeMs: 801, requestedTimeMs: 801 }).landingImpulse, 0)
  assert.equal(sampleRootMotion({ ...travelSampleInput, definition, previousRequestedTimeMs: 900, requestedTimeMs: 700 }).landingImpulse, 0)

  const grounded = sampleAt(600)
  const groundedDefinition = { ...definition, verticalMode: 'grounded' as const }
  assert.equal(sampleRootMotion({ ...travelSampleInput, definition: groundedDefinition, requestedTimeMs: 600, previousRequestedTimeMs: 600 }).cumulativeLocal[1], 0)
  assertFiniteSample(grounded)
  assertFiniteSample(enteringLanding)

  const pingPongDefinition = {
    ...definition,
    windows: [{ id: 'returning-jump', kind: 'ballistic' as const, startMs: 0, endMs: 1000, weight: 1 }],
  }
  const pingPongInput = {
    ...travelSampleInput,
    definition: pingPongDefinition,
    durationMs: 1000,
    loopMode: 'ping-pong' as const,
  }
  const continuousPingPong = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({ ...pingPongInput, requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...pingPongInput,
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  const reverseTakeoff = continuousPingPong(1000, 1010)
  const reversePeak = continuousPingPong(1500, 1500)
  const reverseLanding = continuousPingPong(1980, 1990)
  const reverseTouchdown = continuousPingPong(1999, 2000)
  assert.equal(reverseTakeoff.phase, 'takeoff')
  assert.ok(reverseTakeoff.deltaLocal[1] > 0)
  assert.equal(reversePeak.phase, 'airborne')
  assert.equal(reverseLanding.phase, 'landing')
  assert.ok(reverseLanding.deltaLocal[1] < 0)
  assert.equal(reverseTouchdown.landingImpulse, 0, 'ping-pong 在 0ms 转折后沿同一窗继续腾空，不得伪造瞬时 touchdown')
  assert.equal(reverseTouchdown.landingAuthorization, undefined)
})

test('角色高度、权重、朝向和转向按绝对目标确定缩放', () => {
  const heightTwo = sampleRootMotion({ ...travelSampleInput, characterHeight: 2, previousRequestedTimeMs: 600 })
  const heightFour = sampleRootMotion({ ...travelSampleInput, characterHeight: 4, previousRequestedTimeMs: 600 })
  const halfWeight = sampleRootMotion({ ...travelSampleInput, actionWeight: .5, previousRequestedTimeMs: 600 })
  const zeroWeight = sampleRootMotion({ ...travelSampleInput, actionWeight: -1, previousRequestedTimeMs: 600 })
  const fullWeight = sampleRootMotion({ ...travelSampleInput, actionWeight: 2, previousRequestedTimeMs: 600 })
  assert.equal(heightFour.cumulativeLocal[0], heightTwo.cumulativeLocal[0] * 2)
  assert.equal(halfWeight.cumulativeLocal[0], heightFour.cumulativeLocal[0] / 2)
  assert.deepEqual(zeroWeight.cumulativeLocal, [0, 0, 0])
  assert.deepEqual(fullWeight.cumulativeLocal, heightFour.cumulativeLocal)
  assert.equal(heightFour.cumulativeTurnRadians, .1)
  assert.equal(halfWeight.cumulativeTurnRadians, .05)

  // 与 Three.js 的正 Y 旋转一致：局部 +X 在 +π/2 朝向下映射到世界 -Z。
  const facing = sampleRootMotion({ ...travelSampleInput, facingRadians: Math.PI / 2, previousRequestedTimeMs: 600 })
  assert.ok(Math.abs(facing.cumulativeWorld[0]) < 1e-12)
  assert.ok(Math.abs(facing.cumulativeWorld[2] + facing.cumulativeLocal[0]) < 1e-12)
  const facingPrevious = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    requestedTimeMs: 599,
    previousRequestedTimeMs: undefined,
  })
  const facingDelta = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    requestedTimeMs: 600,
    previousRequestedTimeMs: 599,
    previousAppliedWorld: facingPrevious.appliedWorld,
    previousAppliedTurnRadians: facingPrevious.appliedTurnRadians,
  })
  assert.ok(facingDelta.deltaLocal[0] > 0)
  assert.ok(Math.abs(facingDelta.deltaWorld[0]) < 1e-12)
  assert.ok(Math.abs(facingDelta.deltaWorld[2] + facingDelta.deltaLocal[0]) < 1e-12)

  const negativeDefinition = { ...travelDefinition, distance: -.42, turnRadians: -.2 }
  const negativeZeroWeight = sampleRootMotion({
    ...travelSampleInput,
    definition: negativeDefinition,
    actionWeight: 0,
    previousRequestedTimeMs: 600,
  })
  const negativeStart = sampleRootMotion({
    ...travelSampleInput,
    definition: negativeDefinition,
    requestedTimeMs: 0,
    previousRequestedTimeMs: 0,
  })
  for (const zero of [negativeZeroWeight, negativeStart]) {
    assert.deepEqual(zero.cumulativeLocal, [0, 0, 0])
    assert.deepEqual(zero.cumulativeWorld, [0, 0, 0])
    assert.equal(zero.cumulativeTurnRadians, 0)
  }
})

test('多窗口按权重归一化 smoothstep，重叠与空隙稳定且不同 kind 各司其职', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 1,
    turnRadians: .8,
    verticalMode: 'ballistic' as const,
    jumpHeight: .25,
    windows: [
      { id: 'travel', kind: 'travel' as const, startMs: 0, endMs: 400, weight: .25 },
      { id: 'warp', kind: 'warp' as const, startMs: 200, endMs: 600, weight: .75 },
      { id: 'ballistic', kind: 'ballistic' as const, startMs: 100, endMs: 500, weight: 1 },
      { id: 'brake', kind: 'brake' as const, startMs: 200, endMs: 600, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  const overlap = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 800,
    characterHeight: 1,
    previousRequestedTimeMs: 300,
    requestedTimeMs: 300,
  })
  const expected = .25 * .84375 + .75 * .15625
  assert.ok(Math.abs(overlap.cumulativeLocal[0] - expected) < 1e-12)
  assert.ok(Math.abs(overlap.cumulativeTurnRadians - .8 * expected) < 1e-12)

  const gap = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 800,
    characterHeight: 1,
    previousRequestedTimeMs: 700,
    requestedTimeMs: 700,
  })
  assert.equal(gap.cumulativeLocal[0], 1)
  assert.equal(gap.cumulativeTurnRadians, .8)

  const withoutBrake = {
    ...definition,
    windows: definition.windows.filter(window => window.kind !== 'brake'),
  }
  const sameMovement = sampleRootMotion({
    ...travelSampleInput,
    definition: withoutBrake,
    durationMs: 800,
    characterHeight: 1,
    previousRequestedTimeMs: 300,
    requestedTimeMs: 300,
  })
  assert.equal(sameMovement.cumulativeLocal[0], overlap.cumulativeLocal[0])

  const minimumWeight = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      ...travelDefinition,
      distance: 1,
      windows: [{ id: 'minimum-weight', kind: 'travel' as const, startMs: 0, endMs: 800, weight: Number.MIN_VALUE }],
    },
    durationMs: 800,
    characterHeight: 1,
    requestedTimeMs: 400,
    previousRequestedTimeMs: 400,
  })
  assert.equal(minimumWeight.cumulativeLocal[0], .5)
})

test('单帧位移与转向预算只钳制增量，不污染累计目标', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 4,
    turnRadians: Math.PI * 2,
    verticalMode: 'grounded' as const,
    jumpHeight: 0,
    windows: [{ id: 'burst', kind: 'warp' as const, startMs: 0, endMs: 10, weight: 1 }],
    vfxTags: [] as const,
  }
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 1000,
    previousRequestedTimeMs: 0,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 10,
  })
  assert.equal(sample.status, 'clamped')
  assert.equal(sample.cumulativeLocal[0], 16)
  assert.equal(sample.appliedLocal[0], 1)
  assert.equal(Math.hypot(...sample.deltaLocal), 1)
  assert.equal(sample.cumulativeTurnRadians, Math.PI * 2)
  assert.equal(sample.appliedTurnRadians, Math.PI / 4)
  assert.equal(Math.abs(sample.deltaTurnRadians), Math.PI / 4)
})

test('target 与 applied 分离后按安全预算追赶且速度来自实际应用轨迹', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 4,
    turnRadians: Math.PI * 2,
    verticalMode: 'grounded' as const,
    jumpHeight: 0,
    windows: [{ id: 'burst', kind: 'warp' as const, startMs: 0, endMs: 10, weight: 1 }],
    vfxTags: [] as const,
  }
  let previousTimeMs = 0
  let previousAppliedWorld = [0, 0, 0] as const
  let previousAppliedTurnRadians = 0
  for (let requestedTimeMs = 10; requestedTimeMs <= 260; requestedTimeMs += 10) {
    const sample = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 1000,
      loopMode: 'once',
      requestedTimeMs,
      previousRequestedTimeMs: previousTimeMs,
      previousAppliedWorld,
      previousAppliedTurnRadians,
    })
    assert.equal(sample.cumulativeLocal[0], 16)
    assert.ok(Math.hypot(...sample.deltaLocal) <= 1 + 1e-12)
    assert.ok(Math.abs(sample.deltaTurnRadians) <= Math.PI / 4 + 1e-12)
    assert.deepEqual(sample.appliedWorld, [
      previousAppliedWorld[0] + sample.deltaWorld[0],
      previousAppliedWorld[1] + sample.deltaWorld[1],
      previousAppliedWorld[2] + sample.deltaWorld[2],
    ])
    assert.ok(Math.abs(sample.linearVelocity[0] - sample.deltaWorld[0] / .01) < 1e-9)
    previousTimeMs = requestedTimeMs
    previousAppliedWorld = sample.appliedWorld
    previousAppliedTurnRadians = sample.appliedTurnRadians
  }
  assert.deepEqual(previousAppliedWorld, [16, 0, 0])
  assert.equal(previousAppliedTurnRadians, Math.PI * 2)

  const reset = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 1000,
    loopMode: 'once',
    requestedTimeMs: 10,
    previousRequestedTimeMs: 0,
  })
  assert.equal(reset.status, 'reset')
  assert.deepEqual(reset.appliedLocal, reset.cumulativeLocal)
  assert.equal(reset.appliedTurnRadians, reset.cumulativeTurnRadians)
  assert.deepEqual(reset.deltaLocal, [0, 0, 0])
  assert.deepEqual(reset.linearVelocity, [0, 0, 0])
})

test('应用态垂直轨迹决定 phase 且只在真实 applied touchdown 时消费一次合法冲量', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1.5,
    windows: [{ id: 'applied-jump', kind: 'ballistic' as const, startMs: 20, endMs: 100, weight: 1 }],
    vfxTags: [] as const,
  }
  const input = {
    ...travelSampleInput,
    definition,
    durationMs: 120,
    characterHeight: 4,
  }

  const rising = sampleRootMotion({
    ...input,
    loopMode: 'once',
    previousRequestedTimeMs: 20,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 60,
  })
  assert.equal(rising.appliedWorld[1], 1)
  assert.equal(rising.phase, 'takeoff')
  assert.equal(rising.landingImpulse, 0)

  for (const [loopMode, targetTouchdownTimeMs] of [
    ['once', 100],
    ['loop', 100],
    ['ping-pong', 220],
  ] as const) {
    let previousRequestedTimeMs = targetTouchdownTimeMs - 1
    let previousAppliedWorld = [0, 6, 0] as const
    let previousAppliedTurnRadians = 0
    let previousLandingAuthorization: ReturnType<RootMotionSampler>['landingAuthorization']
    let firstDescending: ReturnType<RootMotionSampler> | undefined
    for (let frame = 1; frame <= 6; frame += 1) {
      const requestedTimeMs = targetTouchdownTimeMs + frame
      const sample = sampleRootMotion({
        ...input,
        loopMode,
        previousRequestedTimeMs,
        previousAppliedWorld,
        previousAppliedTurnRadians,
        previousLandingAuthorization,
        requestedTimeMs,
      })
      firstDescending ??= sample
      assert.equal(sample.cumulativeWorld[1], 0, `${loopMode} target 已落地`)
      assert.equal(sample.appliedWorld[1], 6 - frame)
      assert.equal(sample.phase, frame < 6 ? 'landing' : 'grounded')
      assert.equal(sample.landingImpulse > 0, frame === 6, `${loopMode} 只在 applied 穿入 grounded 时消费冲量`)
      previousRequestedTimeMs = requestedTimeMs
      previousAppliedWorld = sample.appliedWorld
      previousAppliedTurnRadians = sample.appliedTurnRadians
      previousLandingAuthorization = sample.landingAuthorization
    }
    const repeated = sampleRootMotion({
      ...input,
      loopMode,
      previousRequestedTimeMs,
      previousAppliedWorld,
      previousAppliedTurnRadians,
      requestedTimeMs: previousRequestedTimeMs + 1,
    })
    assert.equal(repeated.phase, 'grounded')
    assert.equal(repeated.landingImpulse, 0)

    const paused = sampleRootMotion({
      ...input,
      loopMode,
      previousRequestedTimeMs: targetTouchdownTimeMs + 1,
      previousAppliedWorld: firstDescending!.appliedWorld,
      previousAppliedTurnRadians: firstDescending!.appliedTurnRadians,
      previousLandingAuthorization: firstDescending!.landingAuthorization,
      requestedTimeMs: targetTouchdownTimeMs + 1,
    })
    assert.equal(paused.appliedWorld[1], 5)
    assert.equal(paused.phase, 'airborne')
    assert.equal(paused.landingImpulse, 0)
  }

  for (const sample of [
    sampleRootMotion({ ...input, loopMode: 'once', previousRequestedTimeMs: 101, requestedTimeMs: 90, previousAppliedWorld: [0, 5, 0], previousAppliedTurnRadians: 0 }),
    sampleRootMotion({ ...input, loopMode: 'once', previousRequestedTimeMs: 0, requestedTimeMs: 700, previousAppliedWorld: [0, 5, 0], previousAppliedTurnRadians: 0 }),
    sampleRootMotion({ ...input, loopMode: 'once', requestedTimeMs: 101 }),
  ]) {
    assert.equal(sample.status, 'reset')
    assert.equal(sample.landingImpulse, 0)
  }

  const beforeTargetTouchdown = sampleRootMotion({
    ...input,
    loopMode: 'once',
    previousRequestedTimeMs: 9,
    previousAppliedWorld: [0, 1, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 10,
  })
  assert.equal(beforeTargetTouchdown.phase, 'grounded')
  assert.equal(beforeTargetTouchdown.landingImpulse, 0, 'target 尚未经历合法 touchdown 时不得用异常 applied 高度伪造冲量')
})

test('超大有限绝对时间的不可表示周期不伪造事件且已有授权仍由真实 applied 落地消费', () => {
  const durationMs = 100
  const requestedTimeMs = 2 ** 53 * durationMs
  const previousLandingAuthorization = Object.freeze({
    touchdownRequestedTimeMs: requestedTimeMs - 256,
    impulse: .5,
  })
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [{ id: 'huge-time-jump', kind: 'ballistic' as const, startMs: 20, endMs: 80, weight: 1 }],
      vfxTags: [] as const,
    },
    loopMode: 'loop',
    durationMs,
    requestedTimeMs,
    previousRequestedTimeMs: requestedTimeMs - 128,
    previousAppliedWorld: [0, .1, 0],
    previousAppliedTurnRadians: 0,
    previousLandingAuthorization,
  })
  assert.equal(sample.phase, 'grounded')
  assert.equal(sample.landingImpulse, previousLandingAuthorization.impulse)
  assert.equal(sample.landingAuthorization, undefined)
})

test('超大有限绝对时间的水平支撑扫描保持有界且不会整数停滞', () => {
  const durationMs = 100
  const segmentBoundaryMs = 2 ** 53 * durationMs
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 1,
      turnRadians: 0,
      verticalMode: 'grounded' as const,
      jumpHeight: 0,
      windows: [{ id: 'huge-time-travel', kind: 'travel' as const, startMs: 0, endMs: 100, weight: 1 }],
      vfxTags: [] as const,
    },
    loopMode: 'loop',
    durationMs,
    requestedTimeMs: segmentBoundaryMs + 128,
    previousRequestedTimeMs: segmentBoundaryMs,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    footResidual: [1, 0, 0],
  })
  assertFiniteSample(sample)
  assert.equal(sample.status, 'clamped')
})

test('target 在新窗口重新腾空会清除旧授权并只为自身 touchdown 重签', () => {
  const input = {
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: .8,
      windows: [
        { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
        { id: 'epsilon-tail', kind: 'ballistic' as const, startMs: 901, endMs: 1000, weight: 2e-12 },
      ],
      vfxTags: [] as const,
    },
    durationMs: 1200,
    loopMode: 'once' as const,
    characterHeight: 4,
  }
  let previous = sampleRootMotion({ ...input, requestedTimeMs: 500 })
  let tailAuthorizationImpulse = 0
  for (const requestedTimeMs of [900, 950, 1000, 1050]) {
    previous = sampleRootMotion({
      ...input,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
      requestedTimeMs,
    })
    if (requestedTimeMs === 900) {
      const touchdownRequestedTimeMs = previous.landingAuthorization?.touchdownRequestedTimeMs
      assert.ok(touchdownRequestedTimeMs !== undefined
        && touchdownRequestedTimeMs < 900 && touchdownRequestedTimeMs > 899,
      '正 gap 后主窗必须在真实复合阈值交点签发授权')
    }
    if (requestedTimeMs === 950) {
      assert.ok(previous.cumulativeWorld[1] > 4e-12, 'epsilon tail 应在窗内形成真实 target takeoff')
      assert.equal(previous.landingAuthorization, undefined, '真实 target takeoff 必须清除 900ms 的旧授权')
    }
    if (requestedTimeMs === 1000) {
      const touchdownRequestedTimeMs = previous.landingAuthorization?.touchdownRequestedTimeMs
      assert.ok(touchdownRequestedTimeMs !== undefined
        && touchdownRequestedTimeMs < 1000 && touchdownRequestedTimeMs > 950,
      '微窗只在自己的真实 proven airborne→grounded 转换重签')
      tailAuthorizationImpulse = previous.landingAuthorization?.impulse ?? 0
    }
  }
  assert.equal(previous.phase, 'grounded')
  assert.ok(tailAuthorizationImpulse > 0 && tailAuthorizationImpulse < 1e-10)
  assert.equal(previous.landingImpulse, tailAuthorizationImpulse, 'applied 落地只能消费微窗自身的新授权')
})

test('低强度微窗未越过实际世界接地阈值时不会误清 touchdown 授权', () => {
  const input = {
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: .5,
      windows: [
        { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
        { id: 'grounded-micro', kind: 'ballistic' as const, startMs: 400, endMs: 500, weight: 1.1e-12 },
      ],
      vfxTags: [] as const,
    },
    durationMs: 600,
    loopMode: 'once' as const,
    characterHeight: 4,
  }
  const airborne = sampleRootMotion({ ...input, requestedTimeMs: 200 })
  const chasing = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 200,
    previousAppliedWorld: airborne.appliedWorld,
    previousAppliedTurnRadians: airborne.appliedTurnRadians,
    requestedTimeMs: 300,
  })
  const touchdown = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 300,
    previousAppliedWorld: chasing.appliedWorld,
    previousAppliedTurnRadians: chasing.appliedTurnRadians,
    previousLandingAuthorization: chasing.landingAuthorization,
    requestedTimeMs: 450,
  })
  assert.ok(touchdown.cumulativeWorld[1] > 0 && touchdown.cumulativeWorld[1] < 4e-12)
  assert.equal(touchdown.phase, 'grounded')
  assert.ok(touchdown.landingImpulse > 0, '从未越过世界接地阈值的微窗不得清除主窗 touchdown 授权')
})

test('caller-owned 落地授权跨 actionWeight 淡出与不合格微尾窗保持并仅消费一次', () => {
  const input = {
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1.5,
      windows: [
        { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
        { id: 'grounded-tail', kind: 'ballistic' as const, startMs: 400, endMs: 500, weight: 1e-9 },
      ],
      vfxTags: [] as const,
    },
    durationMs: 600,
    loopMode: 'once' as const,
    characterHeight: 4,
  }
  let previous = sampleRootMotion({ ...input, requestedTimeMs: 200 })
  previous = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 200,
    previousAppliedWorld: previous.appliedWorld,
    previousAppliedTurnRadians: previous.appliedTurnRadians,
    requestedTimeMs: 300,
  })
  assert.ok(previous.landingAuthorization)
  assert.ok(Object.isFrozen(previous.landingAuthorization))
  assert.ok(previous.landingAuthorization!.touchdownRequestedTimeMs < 300
    && previous.landingAuthorization!.touchdownRequestedTimeMs > 299)
  const authorizedTouchdownRequestedTimeMs = previous.landingAuthorization!.touchdownRequestedTimeMs
  const authorizedImpulse = previous.landingAuthorization!.impulse
  assert.ok(authorizedImpulse > 0)

  for (const requestedTimeMs of [350, 400, 450, 500, 554]) {
    previous = sampleRootMotion({
      ...input,
      actionWeight: 1e-4,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
      requestedTimeMs,
    })
    if (requestedTimeMs < 554) {
      assert.deepEqual(previous.landingAuthorization, {
        touchdownRequestedTimeMs: authorizedTouchdownRequestedTimeMs,
        impulse: authorizedImpulse,
      })
      assert.equal(previous.landingImpulse, 0)
    }
  }
  assert.equal(previous.phase, 'grounded')
  assert.equal(previous.landingImpulse, authorizedImpulse)
  assert.equal(previous.landingAuthorization, undefined)

  const repeated = sampleRootMotion({
    ...input,
    actionWeight: 1e-4,
    previousRequestedTimeMs: 554,
    previousAppliedWorld: previous.appliedWorld,
    previousAppliedTurnRadians: previous.appliedTurnRadians,
    requestedTimeMs: 555,
  })
  assert.equal(repeated.landingImpulse, 0)
  assert.equal(repeated.landingAuthorization, undefined)
})

test('64 个互斥低强度 ULP 尾窗共享一次分析且不得清除主窗授权', () => {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  const nextUp = (value: number) => {
    view.setFloat64(0, value)
    view.setBigUint64(0, view.getBigUint64(0) + 1n)
    return view.getFloat64(0)
  }
  const addUlps = (value: number, count: number) => {
    let result = value
    for (let index = 0; index < count; index += 1) result = nextUp(result)
    return result
  }
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
  const base = {
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'once' as const,
    characterHeight: 4,
  }

  let maximumTailHeight = 0
  for (const tail of tails) {
    const midpointMs = tail.startMs + (tail.endMs - tail.startMs) * .5
    const sample = sampleRootMotion({ ...base, actionWeight: 1e-4, requestedTimeMs: midpointMs })
    maximumTailHeight = Math.max(maximumTailHeight, sample.cumulativeWorld[1])
  }
  assert.ok(maximumTailHeight > 0 && maximumTailHeight < 4e-12, '夹具中每个尾窗都必须严格低于世界接地阈值')

  let previous = sampleRootMotion({ ...base, actionWeight: 1, requestedTimeMs: 5 })
  let mainTouchdownRequestedTimeMs: number | undefined
  for (const requestedTimeMs of [10, 84, 85, 86]) {
    previous = sampleRootMotion({
      ...base,
      actionWeight: requestedTimeMs === 10 ? 1 : 1e-4,
      requestedTimeMs,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
    })
    if (requestedTimeMs === 10) {
      assert.ok(previous.landingAuthorization, '主窗 touchdown 必须签发授权')
      mainTouchdownRequestedTimeMs = previous.landingAuthorization?.touchdownRequestedTimeMs
      assert.ok(mainTouchdownRequestedTimeMs !== undefined
        && mainTouchdownRequestedTimeMs < 10 && mainTouchdownRequestedTimeMs > 9.9999)
    }
    if (requestedTimeMs === 84 || requestedTimeMs === 85) {
      assert.equal(previous.landingAuthorization?.touchdownRequestedTimeMs, mainTouchdownRequestedTimeMs, '低于接地阈值的尾窗不得清除旧授权')
      assert.equal(previous.landingImpulse, 0)
    }
  }
  assert.equal(previous.phase, 'grounded')
  assert.ok(previous.landingImpulse > 0, '86ms 的真实 applied touchdown 必须消费主窗授权')
  assert.equal(previous.landingAuthorization, undefined)
})

test('共享时间线预算耗尽时既不清除旧授权也不签发新授权', () => {
  const windows = []
  for (let index = 0; index < 32; index += 1) {
    const startMs = index * 3
    windows.push(
      { id: `overlap-a-${index}`, kind: 'ballistic' as const, startMs, endMs: startMs + 1.5, weight: 1 },
      { id: `overlap-b-${index}`, kind: 'ballistic' as const, startMs: startMs + .5, endMs: startMs + 2, weight: 1 },
    )
  }
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  const exactCompositePeak = 1120 / (729 * 64)
  view.setFloat64(0, exactCompositePeak)
  view.setBigUint64(0, view.getBigUint64(0) + 1n)
  const actionWeight = 1e-12 / view.getFloat64(0)
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows,
    vfxTags: [],
  }, 100).value
  const base = {
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'once' as const,
    actionWeight,
    previousRequestedTimeMs: 0,
    requestedTimeMs: 100,
    previousAppliedWorld: [0, .5, 0] as const,
    previousAppliedTurnRadians: 0,
  }
  const preserved = sampleRootMotion({
    ...base,
    previousLandingAuthorization: { touchdownRequestedTimeMs: 0, impulse: .75 },
  })
  assert.equal(preserved.phase, 'grounded')
  assert.equal(preserved.landingImpulse, .75, 'unknown 区间不得清除已签发授权')

  const unsigned = sampleRootMotion(base)
  assert.equal(unsigned.landingImpulse, 0)
  assert.equal(unsigned.landingAuthorization, undefined, 'unknown 区间不得凭上界签发新授权')
})

test('后续真实腾空清除旧授权，暂停保留而 reset 清除 caller-owned 令牌', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'first', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
      { id: 'second', kind: 'ballistic' as const, startMs: 400, endMs: 500, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  const input = {
    ...travelSampleInput,
    definition,
    durationMs: 600,
    loopMode: 'once' as const,
    characterHeight: 4,
  }
  const airborne = sampleRootMotion({ ...input, requestedTimeMs: 200 })
  const authorized = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 200,
    previousAppliedWorld: airborne.appliedWorld,
    previousAppliedTurnRadians: airborne.appliedTurnRadians,
    requestedTimeMs: 300,
  })
  assert.ok(authorized.landingAuthorization)

  const paused = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 300,
    previousAppliedWorld: authorized.appliedWorld,
    previousAppliedTurnRadians: authorized.appliedTurnRadians,
    previousLandingAuthorization: authorized.landingAuthorization,
    requestedTimeMs: 300,
  })
  assert.deepEqual(paused.landingAuthorization, authorized.landingAuthorization)
  assert.equal(paused.landingImpulse, 0)

  const secondAirborne = sampleRootMotion({
    ...input,
    previousRequestedTimeMs: 300,
    previousAppliedWorld: paused.appliedWorld,
    previousAppliedTurnRadians: paused.appliedTurnRadians,
    previousLandingAuthorization: paused.landingAuthorization,
    requestedTimeMs: 450,
  })
  assert.ok(secondAirborne.cumulativeWorld[1] > 0)
  assert.equal(secondAirborne.landingAuthorization, undefined)
  assert.equal(secondAirborne.landingImpulse, 0)

  const reset = sampleRootMotion({
    ...input,
    previousLandingAuthorization: authorized.landingAuthorization,
    requestedTimeMs: 301,
  })
  assert.equal(reset.status, 'reset')
  assert.equal(reset.landingAuthorization, undefined)
  assert.equal(reset.landingImpulse, 0)
})

test('高强度微窗仍被 target 相对零阈值归零时不会提前清除授权', () => {
  const input = {
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1.5,
      windows: [
        { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
        { id: 'relative-zero-micro', kind: 'ballistic' as const, startMs: 400, endMs: 500, weight: 1.1e-12 },
      ],
      vfxTags: [] as const,
    },
    durationMs: 600,
    loopMode: 'once' as const,
    characterHeight: 4,
  }
  let previous = sampleRootMotion({ ...input, requestedTimeMs: 200 })
  for (const requestedTimeMs of [300, 320, 340, 360, 380, 433]) {
    previous = sampleRootMotion({
      ...input,
      previousRequestedTimeMs: previous.requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
      requestedTimeMs,
    })
  }
  assert.equal(previous.cumulativeWorld[1], 0, 'micro 尚未超过 ballisticHeight 的相对稳定零阈值')
  assert.equal(previous.phase, 'grounded')
  assert.ok(previous.landingImpulse > 0, 'target 仍输出零高度时不得提前清除主窗 touchdown 授权')
})

test('连续世界 applied 所有权在朝向变化时保持真实位移不变量', () => {
  const previous = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: 0,
    requestedTimeMs: 599,
    previousRequestedTimeMs: undefined,
  })
  const turned = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    previousRequestedTimeMs: 599,
    previousAppliedWorld: previous.appliedWorld,
    previousAppliedTurnRadians: previous.appliedTurnRadians,
    requestedTimeMs: 600,
  })
  assert.notEqual(turned.status, 'reset')
  assertVectorClose(turned.deltaWorld, [
    turned.appliedWorld[0] - previous.appliedWorld[0],
    turned.appliedWorld[1] - previous.appliedWorld[1],
    turned.appliedWorld[2] - previous.appliedWorld[2],
  ])
  assert.ok(Math.hypot(...turned.deltaWorld) <= 1 + 1e-12)
  assertVectorClose(turned.linearVelocity, [
    turned.deltaWorld[0] / .001,
    turned.deltaWorld[1] / .001,
    turned.deltaWorld[2] / .001,
  ], 1e-9)

  const negativeTurn = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: -Math.PI / 3,
    previousRequestedTimeMs: 600,
    previousAppliedWorld: turned.appliedWorld,
    previousAppliedTurnRadians: turned.appliedTurnRadians,
    requestedTimeMs: 601,
  })
  assertVectorClose(negativeTurn.deltaWorld, [
    negativeTurn.appliedWorld[0] - turned.appliedWorld[0],
    negativeTurn.appliedWorld[1] - turned.appliedWorld[1],
    negativeTurn.appliedWorld[2] - turned.appliedWorld[2],
  ])
  assert.ok(Math.hypot(...negativeTurn.deltaWorld) <= 1 + 1e-12)

  const paused = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    previousRequestedTimeMs: 600,
    previousAppliedWorld: [1, 0, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 600,
  })
  assert.deepEqual(paused.appliedWorld, [1, 0, 0])
  assert.deepEqual(paused.deltaWorld, [0, 0, 0])
  assert.deepEqual(paused.linearVelocity, [0, 0, 0])
  assertVectorClose(paused.appliedLocal, [0, 0, 1])

  const reset = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    requestedTimeMs: 600,
    previousRequestedTimeMs: undefined,
  })
  assert.equal(reset.status, 'reset')
  assert.deepEqual(reset.appliedWorld, reset.cumulativeWorld)
})

test('极大有限 applied 按可表示新旧值重算实际位移与转向', () => {
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition: { ...travelDefinition, mode: 'in-place' as const, distance: 0, turnRadians: 0, windows: [] as const },
    loopMode: 'once',
    durationMs: 1000,
    previousRequestedTimeMs: 0,
    previousAppliedWorld: [Number.MAX_VALUE, 0, 0],
    previousAppliedTurnRadians: Number.MAX_VALUE,
    requestedTimeMs: 1,
  })
  assert.equal(sample.status, 'clamped')
  assert.deepEqual(sample.appliedWorld, [Number.MAX_VALUE, 0, 0])
  assert.deepEqual(sample.deltaWorld, [0, 0, 0])
  assert.deepEqual(sample.deltaLocal, [0, 0, 0])
  assert.deepEqual(sample.linearVelocity, [0, 0, 0])
  assert.equal(sample.appliedTurnRadians, Number.MAX_VALUE)
  assert.equal(sample.deltaTurnRadians, 0)
  assert.equal(sample.angularVelocity, 0)
})

test('任意有限 applied 输入在暂停、连续追赶与朝向变化时都不会输出非有限值', () => {
  const base = {
    ...travelSampleInput,
    definition: { ...travelDefinition, mode: 'in-place' as const, distance: 0, turnRadians: 0, windows: [] as const },
    loopMode: 'once' as const,
    durationMs: 1000,
    previousAppliedWorld: [Number.MAX_VALUE, 0, Number.MAX_VALUE] as const,
    previousAppliedTurnRadians: Number.MAX_VALUE,
    facingRadians: Math.PI / 4,
  }
  for (const sample of [
    sampleRootMotion({ ...base, previousRequestedTimeMs: 1, requestedTimeMs: 1 }),
    sampleRootMotion({ ...base, previousRequestedTimeMs: 1, requestedTimeMs: 2 }),
    sampleRootMotion({ ...base, facingRadians: -Math.PI / 4, previousRequestedTimeMs: 2, requestedTimeMs: 3 }),
  ]) {
    assert.equal(sample.status, 'blocked')
    assertFiniteSample(sample)
  }
})

test('reset 直接复用已验证 target，极端有限目标溢出时返回有限 blocked', () => {
  const regular = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 4,
    previousRequestedTimeMs: undefined,
    requestedTimeMs: 600,
  })
  assert.equal(regular.status, 'reset')
  assert.deepEqual(regular.appliedLocal, regular.cumulativeLocal)
  assert.deepEqual(regular.appliedWorld, regular.cumulativeWorld)
  assertFiniteSample(regular)

  const overflow = sampleRootMotion({
    ...travelSampleInput,
    definition: { ...travelDefinition, distance: 4 },
    characterHeight: Number.MAX_VALUE,
    facingRadians: Math.PI / 4,
    previousRequestedTimeMs: undefined,
    requestedTimeMs: 1200,
  })
  assert.equal(overflow.status, 'blocked')
  assertFiniteSample(overflow)
})

test('100/200ms 短动作在 24/30/60FPS 连续采样且正常轨迹最终一致', () => {
  const simulate = (durationMs: 100 | 200, fps: 24 | 30 | 60) => {
    const definition = {
      mode: 'travel' as const,
      distance: .1,
      turnRadians: .05,
      verticalMode: 'grounded' as const,
      jumpHeight: 0,
      windows: [{ id: 'short-loop', kind: 'travel' as const, startMs: 0, endMs: durationMs, weight: 1 }],
      vfxTags: [] as const,
    }
    const first = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs,
      requestedTimeMs: 0,
      previousRequestedTimeMs: undefined,
    })
    assert.equal(first.status, 'reset')
    let previousTimeMs = 0
    let previousAppliedWorld = first.appliedWorld
    let previousAppliedTurnRadians = first.appliedTurnRadians
    let continuousSamples = 0
    for (let frame = 1; frame <= fps; frame += 1) {
      const requestedTimeMs = frame * 1000 / fps
      const sample = sampleRootMotion({
        ...travelSampleInput,
        definition,
        durationMs,
        requestedTimeMs,
        previousRequestedTimeMs: previousTimeMs,
        previousAppliedWorld,
        previousAppliedTurnRadians,
      })
      assert.ok(sample.status === 'solved' || sample.status === 'clamped', `${durationMs}ms@${fps}FPS 不得永久 reset`)
      assert.deepEqual(sample.appliedWorld, [
        previousAppliedWorld[0] + sample.deltaWorld[0],
        previousAppliedWorld[1] + sample.deltaWorld[1],
        previousAppliedWorld[2] + sample.deltaWorld[2],
      ])
      previousTimeMs = requestedTimeMs
      previousAppliedWorld = sample.appliedWorld
      previousAppliedTurnRadians = sample.appliedTurnRadians
      continuousSamples += 1
    }
    return { continuousSamples, appliedWorld: previousAppliedWorld, appliedTurnRadians: previousAppliedTurnRadians }
  }

  for (const durationMs of [100, 200] as const) {
    const samples = ([24, 30, 60] as const).map(fps => simulate(durationMs, fps))
    assert.deepEqual(samples.map(sample => sample.continuousSamples), [24, 30, 60])
    for (const sample of samples.slice(1)) {
      assert.ok(Math.abs(sample.appliedWorld[0] - samples[0]!.appliedWorld[0]) < 1e-9)
      assert.ok(Math.abs(sample.appliedTurnRadians - samples[0]!.appliedTurnRadians) < 1e-9)
    }
  }
})

test('足底残差是仅限有效移动窗的局部水平反馈并随权重与追赶误差连续缩放', () => {
  const inPlace = { ...travelDefinition, mode: 'in-place' as const, distance: 0, turnRadians: 0, windows: [] as const }
  const inPlaceSample = sampleRootMotion({
    ...travelSampleInput,
    definition: inPlace,
    previousRequestedTimeMs: 0,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 16,
    footResidual: [1e9, -1e9, 1e9] as const,
  })
  assert.deepEqual(inPlaceSample.deltaLocal, [0, 0, 0])
  assert.deepEqual(inPlaceSample.appliedLocal, [0, 0, 0])

  const ballisticOnly = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      ...travelDefinition,
      distance: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: .5,
      windows: [{ id: 'jump', kind: 'ballistic' as const, startMs: 0, endMs: 1200, weight: 1 }],
    },
    previousRequestedTimeMs: 0,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    requestedTimeMs: 16,
    footResidual: [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE] as const,
  })
  assert.equal(ballisticOnly.deltaLocal[0], 0)
  assert.equal(ballisticOnly.deltaLocal[2], 0)

  const gapDefinition = {
    ...travelDefinition,
    distance: 1,
    windows: [{ id: 'early', kind: 'travel' as const, startMs: 0, endMs: 100, weight: 1 }],
  }
  const gapTarget = sampleRootMotion({ ...travelSampleInput, definition: gapDefinition, requestedTimeMs: 200, previousRequestedTimeMs: undefined })
  const gap = sampleRootMotion({
    ...travelSampleInput,
    definition: gapDefinition,
    requestedTimeMs: 216,
    previousRequestedTimeMs: 200,
    previousAppliedWorld: gapTarget.appliedWorld,
    previousAppliedTurnRadians: gapTarget.appliedTurnRadians,
    footResidual: [1e9, 1e9, 1e9] as const,
  })
  assert.deepEqual(gap.deltaLocal, [0, 0, 0])

  const activeDefinition = {
    ...travelDefinition,
    distance: 1,
    windows: [{ id: 'active', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 }],
  }
  const correctionAtWeight = (actionWeight: number, residual: readonly [number, number, number]) => {
    const previous = sampleRootMotion({
      ...travelSampleInput,
      definition: activeDefinition,
      actionWeight,
      requestedTimeMs: 400,
      previousRequestedTimeMs: undefined,
    })
    const baseline = sampleRootMotion({
      ...travelSampleInput,
      definition: activeDefinition,
      actionWeight,
      requestedTimeMs: 416,
      previousRequestedTimeMs: 400,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      footResidual: [0, 0, 0],
    })
    const corrected = sampleRootMotion({
      ...travelSampleInput,
      definition: activeDefinition,
      actionWeight,
      requestedTimeMs: 416,
      previousRequestedTimeMs: 400,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      footResidual: residual,
    })
    return {
      correction: corrected.deltaLocal.map((value, index) => value - baseline.deltaLocal[index]!) as unknown as readonly [number, number, number],
      corrected,
    }
  }
  const full = correctionAtWeight(1, [1, 0, 1])
  const withVerticalResidual = correctionAtWeight(1, [1, 1e9, 1])
  const withNonFiniteVerticalResidual = correctionAtWeight(1, [1, Number.NaN, 1])
  const throwingVerticalResidual = new Proxy([1, 0, 1], {
    get(target, property, receiver) {
      if (property === '1') throw new Error('Y 分量不应被读取')
      return Reflect.get(target, property, receiver)
    },
  }) as unknown as readonly [number, number, number]
  const withThrowingVerticalResidual = correctionAtWeight(1, throwingVerticalResidual)
  const low = correctionAtWeight(.01, [1, 0, 1])
  const zero = correctionAtWeight(0, [1, 0, 1])
  assert.ok(Math.hypot(full.correction[0], full.correction[2]) > 0)
  assert.deepEqual(withVerticalResidual.correction, full.correction)
  assert.deepEqual(withNonFiniteVerticalResidual.correction, full.correction)
  assert.deepEqual(withThrowingVerticalResidual.correction, full.correction)
  assert.ok(Math.hypot(low.correction[0], low.correction[2]) < Math.hypot(full.correction[0], full.correction[2]) * .02)
  assert.deepEqual(zero.correction, [0, 0, 0])
  assert.equal(full.correction[1], 0)
  assert.deepEqual(full.corrected.cumulativeLocal, sampleRootMotion({
    ...travelSampleInput,
    definition: activeDefinition,
    requestedTimeMs: 416,
    previousRequestedTimeMs: 416,
  }).cumulativeLocal)

  const paused = sampleRootMotion({
    ...travelSampleInput,
    definition: activeDefinition,
    requestedTimeMs: 400,
    previousRequestedTimeMs: 400,
    previousAppliedWorld: [1, 0, 0],
    previousAppliedTurnRadians: 0,
    footResidual: [1e9, 1e9, 1e9],
  })
  assert.deepEqual(paused.deltaLocal, [0, 0, 0])

  const boundaryDefinition = {
    ...activeDefinition,
    windows: [{ id: 'bounded-active', kind: 'travel' as const, startMs: 100, endMs: 500, weight: 1 }],
  }
  const intervalSample = (previousRequestedTimeMs: number, requestedTimeMs: number, footResidual: readonly [number, number, number]) => {
    const previous = sampleRootMotion({
      ...travelSampleInput,
      definition: boundaryDefinition,
      loopMode: 'once',
      requestedTimeMs: previousRequestedTimeMs,
      previousRequestedTimeMs: undefined,
    })
    return sampleRootMotion({
      ...travelSampleInput,
      definition: boundaryDefinition,
      loopMode: 'once',
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      footResidual,
    })
  }
  for (const [previousRequestedTimeMs, requestedTimeMs] of [[99, 101], [499, 501]] as const) {
    const baseline = intervalSample(previousRequestedTimeMs, requestedTimeMs, [0, 0, 0])
    const crossingBoundary = intervalSample(previousRequestedTimeMs, requestedTimeMs, [1e9, 0, 1e9])
    assert.deepEqual(crossingBoundary.deltaLocal, baseline.deltaLocal, '跨入或跨出移动窗的整帧不得消费残差')
  }

  const invalid = sampleRootMotion({ ...travelSampleInput, footResidual: [Number.NaN, 0, 0] })
  assert.equal(invalid.status, 'blocked')
  assertFiniteSample(invalid)
})

test('合成弹道只在加权支撑区间真实结束时聚合一次启发式落地强度', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .8,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
      { id: 'tiny-overlap', kind: 'ballistic' as const, startMs: 200, endMs: 400, weight: .001 },
    ],
    vfxTags: [] as const,
  }
  const continuous = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({
      ...travelSampleInput,
      definition,
      loopMode: 'once',
      requestedTimeMs: previousRequestedTimeMs,
      previousRequestedTimeMs: undefined,
    })
    return sampleRootMotion({
      ...travelSampleInput,
      definition,
      loopMode: 'once',
      requestedTimeMs,
      previousRequestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }

  const childEnd = continuous(399, 401)
  assert.ok(childEnd.cumulativeLocal[1] > 0)
  assert.notEqual(childEnd.phase, 'grounded')
  assert.equal(childEnd.landingImpulse, 0)
  const touchdown = continuous(850, 950)
  assert.equal(touchdown.phase, 'grounded')
  assert.ok(touchdown.landingImpulse > 0 && touchdown.landingImpulse <= 1)
  assert.equal(continuous(950, 950).landingImpulse, 0)
  assert.equal(sampleRootMotion({
    ...travelSampleInput,
    definition,
    loopMode: 'once',
    requestedTimeMs: 950,
    previousRequestedTimeMs: undefined,
  }).landingImpulse, 0)
  assert.equal(continuous(950, 850).landingImpulse, 0)

  const adjacentAndRepeated = {
    ...definition,
    windows: [
      { id: 'first', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
      { id: 'first-copy', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: .5 },
      { id: 'adjacent', kind: 'ballistic' as const, startMs: 300, endMs: 500, weight: 1 },
    ],
  }
  const around = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({ ...travelSampleInput, definition: adjacentAndRepeated, loopMode: 'once', requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition: adjacentAndRepeated,
      loopMode: 'once',
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  assert.equal(around(299, 301).landingImpulse, 0, '相邻窗口之间没有支撑区间，不得制造伪落地')
  assert.ok(around(499, 501).landingImpulse > 0)
  assert.equal(around(500, 501).landingImpulse, 0)

  const negligibleTail = {
    ...definition,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
      { id: 'negligible-tail', kind: 'ballistic' as const, startMs: 899, endMs: 1000, weight: 1e-13 },
    ],
  }
  const tailCrossing = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({ ...travelSampleInput, definition: negligibleTail, loopMode: 'once', requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition: negligibleTail,
      loopMode: 'once',
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  assert.ok(tailCrossing(899, 901).landingImpulse > 0, '有效主弹道结束时应触发真实落地')
  assert.equal(tailCrossing(950, 1001).phase, 'grounded')
  assert.equal(tailCrossing(950, 1001).landingImpulse, 0, '已接地后极小尾窗不得放大为伪落地')

  const thresholdTail = {
    ...definition,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
      { id: 'threshold-tail', kind: 'ballistic' as const, startMs: 899, endMs: 1000, weight: 2e-12 },
    ],
  }
  const thresholdCrossing = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({ ...travelSampleInput, definition: thresholdTail, loopMode: 'once', requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition: thresholdTail,
      loopMode: 'once',
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  assert.equal(thresholdCrossing(909, 910).phase, 'grounded')
  assert.equal(thresholdCrossing(949, 950).phase, 'takeoff')
  assert.ok(thresholdCrossing(899, 901).landingImpulse > 0, '主弹道与尾窗之间的真实 grounded 转换应保留')
  assert.equal(thresholdCrossing(999, 1001).landingImpulse, 0, '尾窗原始端点前已低于 grounded epsilon 时不得触发')

  const unrelatedMicroscopicWindow = {
    ...definition,
    windows: [
      { id: 'micro', kind: 'ballistic' as const, startMs: 0, endMs: 1e-6, weight: 1 },
      { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
    ],
  }
  const beforeMainEnd = sampleRootMotion({ ...travelSampleInput, definition: unrelatedMicroscopicWindow, loopMode: 'once', requestedTimeMs: 899, previousRequestedTimeMs: undefined })
  const mainEnd = sampleRootMotion({
    ...travelSampleInput,
    definition: unrelatedMicroscopicWindow,
    loopMode: 'once',
    previousRequestedTimeMs: 899,
    requestedTimeMs: 901,
    previousAppliedWorld: beforeMainEnd.appliedWorld,
    previousAppliedTurnRadians: beforeMainEnd.appliedTurnRadians,
  })
  assert.ok(mainEnd.landingImpulse > 0, '时间上无关的微型窗不得缩小主落地边界探针')

  const sharedEndMicroscopicWindow = {
    ...definition,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 100, endMs: 900, weight: 1 },
      { id: 'shared-end-micro', kind: 'ballistic' as const, startMs: 899.999, endMs: 900, weight: 2e-12 },
    ],
  }
  const beforeSharedEnd = sampleRootMotion({ ...travelSampleInput, definition: sharedEndMicroscopicWindow, loopMode: 'once', requestedTimeMs: 899, previousRequestedTimeMs: undefined })
  const sharedEnd = sampleRootMotion({
    ...travelSampleInput,
    definition: sharedEndMicroscopicWindow,
    loopMode: 'once',
    previousRequestedTimeMs: 899,
    requestedTimeMs: 901,
    previousAppliedWorld: beforeSharedEnd.appliedWorld,
    previousAppliedTurnRadians: beforeSharedEnd.appliedTurnRadians,
  })
  assert.ok(sharedEnd.landingImpulse > 0, '同终点阈值微型窗不得吞掉长主窗的真实落地')
})

test('短循环可有界跨越多个真实 touchdown 且 loop/ping-pong 每区间只聚合一次', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .5,
    windows: [{ id: 'short-jump', kind: 'ballistic' as const, startMs: 20, endMs: 80, weight: 1 }],
    vfxTags: [] as const,
  }
  for (const loopMode of ['loop', 'ping-pong'] as const) {
    const previous = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 50,
      previousRequestedTimeMs: undefined,
    })
    const crossed = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 300,
      previousRequestedTimeMs: 50,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
    assert.ok(crossed.status === 'solved' || crossed.status === 'clamped')
    assert.equal(crossed.phase, 'landing')
    assert.equal(crossed.landingImpulse, 0)
    const appliedTouchdown = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 301,
      previousRequestedTimeMs: 300,
      previousAppliedWorld: crossed.appliedWorld,
      previousAppliedTurnRadians: crossed.appliedTurnRadians,
      previousLandingAuthorization: crossed.landingAuthorization,
    })
    assert.equal(appliedTouchdown.phase, 'grounded')
    assert.ok(appliedTouchdown.landingImpulse > 0 && appliedTouchdown.landingImpulse <= 1)
    const paused = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 301,
      previousRequestedTimeMs: 301,
      previousAppliedWorld: appliedTouchdown.appliedWorld,
      previousAppliedTurnRadians: appliedTouchdown.appliedTurnRadians,
      previousLandingAuthorization: appliedTouchdown.landingAuthorization,
    })
    assert.equal(paused.landingImpulse, 0)
  }
})

test('loop 与 ping-pong 十进制事件边界复用 canonical resolved 锚点清除旧授权', () => {
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows: [
      { id: 'first', kind: 'ballistic', startMs: 20.3, endMs: 40.4, weight: 1 },
      { id: 'second', kind: 'ballistic', startMs: 60.1, endMs: 80.2, weight: 1 },
    ],
    vfxTags: [],
  }, 100).value
  for (const loopMode of ['loop', 'ping-pong'] as const) {
    const previous = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 130,
      previousRequestedTimeMs: undefined,
    })
    const crossed = sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      requestedTimeMs: 170,
      previousRequestedTimeMs: 130,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
    assert.ok(crossed.cumulativeWorld[1] > 4e-12, `${loopMode} 当前 target 必须在第二段真实腾空`)
    assert.equal(crossed.landingAuthorization, undefined, `${loopMode} 后续真实腾空必须清除同帧早先 touchdown 授权`)
    assert.equal(crossed.landingImpulse, 0)
  }
})

test('loop 周期缝与 ping-pong 转折点使用各自分段侧别', () => {
  const definition = normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic',
    jumpHeight: 1,
    windows: [{ id: 'to-seam', kind: 'ballistic', startMs: 20, endMs: 100, weight: 1 }],
    vfxTags: [],
  }, 100).value
  const previous = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'loop',
    requestedTimeMs: 60,
    previousRequestedTimeMs: undefined,
  })
  const crossed = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'loop',
    requestedTimeMs: 110,
    previousRequestedTimeMs: 60,
    previousAppliedWorld: previous.appliedWorld,
    previousAppliedTurnRadians: previous.appliedTurnRadians,
  })
  assert.equal(crossed.cumulativeWorld[1], 0)
  assert.equal(crossed.landingImpulse, 0)
  assert.ok(crossed.landingAuthorization?.touchdownRequestedTimeMs !== undefined
    && crossed.landingAuthorization.touchdownRequestedTimeMs < 100
    && crossed.landingAuthorization.touchdownRequestedTimeMs > 99,
  '下一周期 0→10ms grounded 不得清除真实阈值转换签发的周期缝授权')

  const pingPrevious = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'ping-pong',
    requestedTimeMs: 60,
    previousRequestedTimeMs: undefined,
  })
  const pingTurnaround = sampleRootMotion({
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'ping-pong',
    requestedTimeMs: 110,
    previousRequestedTimeMs: 60,
    previousAppliedWorld: pingPrevious.appliedWorld,
    previousAppliedTurnRadians: pingPrevious.appliedTurnRadians,
  })
  assert.ok(pingTurnaround.cumulativeWorld[1] > 4e-12)
  assert.equal(pingTurnaround.landingAuthorization, undefined, 'ping-pong 转折后同一窗口真实腾空必须清除瞬时 touchdown 授权')
})

test('ballistic touchdown 边界探针区分重叠、精确相邻与极窄正 gap', () => {
  const definitionAtGap = (gapMs: number) => ({
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .8,
    windows: [
      { id: 'first', kind: 'ballistic' as const, startMs: 100, endMs: 300, weight: 1 },
      { id: 'second', kind: 'ballistic' as const, startMs: 300 + gapMs, endMs: 500, weight: 1 },
    ],
    vfxTags: [] as const,
  })
  const forwardImpulse = (loopMode: 'once' | 'loop' | 'ping-pong', gapMs: number) => {
    const definition = definitionAtGap(gapMs)
    const previous = sampleRootMotion({ ...travelSampleInput, definition, durationMs: 600, loopMode, requestedTimeMs: 299, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 600,
      loopMode,
      requestedTimeMs: 300,
      previousRequestedTimeMs: 299,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    }).landingImpulse
  }
  const reversePingPongImpulse = (gapMs: number) => {
    const definition = definitionAtGap(gapMs)
    const touchdownRequestMs = 1200 - (300 + gapMs)
    const previousRequestedTimeMs = touchdownRequestMs - 1
    const requestedTimeMs = touchdownRequestMs
    const previous = sampleRootMotion({ ...travelSampleInput, definition, durationMs: 600, loopMode: 'ping-pong', requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition,
      durationMs: 600,
      loopMode: 'ping-pong',
      requestedTimeMs,
      previousRequestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    }).landingImpulse
  }

  for (const loopMode of ['once', 'loop', 'ping-pong'] as const) {
    assert.equal(forwardImpulse(loopMode, -.001), 0, `${loopMode} 重叠支撑不得在内部边界触发`)
    assert.equal(forwardImpulse(loopMode, 0), 0, `${loopMode} 精确相邻支撑按连续语义合并`)
    assert.ok(forwardImpulse(loopMode, .001) > 0, `${loopMode} 任意正 gap 都必须保留真实 touchdown`)
  }
  assert.equal(reversePingPongImpulse(-.001), 0)
  assert.equal(reversePingPongImpulse(0), 0)
  assert.ok(reversePingPongImpulse(.001) > 0, 'ping-pong 反向也不得跨过极窄正 gap')

  const ultraShortEndMs = 900
  const ultraShortStartMs = ultraShortEndMs - 1e-12
  const ultraShortMidpointMs = ultraShortStartMs + (ultraShortEndMs - ultraShortStartMs) * .5
  assert.ok(ultraShortMidpointMs > ultraShortStartMs && ultraShortMidpointMs < ultraShortEndMs, '夹具必须存在可表示的窗内样本')
  const ultraShortDefinition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: .8,
    windows: [{ id: 'ulp-window', kind: 'ballistic' as const, startMs: ultraShortStartMs, endMs: ultraShortEndMs, weight: 1 }],
    vfxTags: [] as const,
  }
  for (const progress of [1 / 9, 2 / 9, 7 / 9, 8 / 9] as const) {
    const requestedTimeMs = ultraShortStartMs + (ultraShortEndMs - ultraShortStartMs) * progress
    assert.ok(requestedTimeMs > ultraShortStartMs && requestedTimeMs < ultraShortEndMs)
    const sample = sampleRootMotion({
      ...travelSampleInput,
      definition: ultraShortDefinition,
      loopMode: 'once',
      requestedTimeMs,
      previousRequestedTimeMs: undefined,
    })
    assert.ok(sample.appliedWorld[1] > 0, `ULP 级极短弹道 ${String(progress)} 进度仍有可表示高度`)
    assert.equal(sample.phase, 'airborne', 'reset 帧没有实际 applied 速度，正高度应为空中态')
  }
  const ultraPrevious = sampleRootMotion({ ...travelSampleInput, definition: ultraShortDefinition, loopMode: 'once', requestedTimeMs: ultraShortMidpointMs, previousRequestedTimeMs: undefined })
  let ultraLanding = ultraPrevious
  let ultraPreviousTimeMs = ultraShortMidpointMs
  for (const requestedTimeMs of [ultraShortEndMs, ultraShortEndMs + 1, ultraShortEndMs + 2, ultraShortEndMs + 3]) {
    ultraLanding = sampleRootMotion({
      ...travelSampleInput,
      definition: ultraShortDefinition,
      loopMode: 'once',
      previousRequestedTimeMs: ultraPreviousTimeMs,
      requestedTimeMs,
      previousAppliedWorld: ultraLanding.appliedWorld,
      previousAppliedTurnRadians: ultraLanding.appliedTurnRadians,
      previousLandingAuthorization: ultraLanding.landingAuthorization,
    })
    ultraPreviousTimeMs = requestedTimeMs
  }
  assert.ok(ultraLanding.landingImpulse > 0, '存在可表示窗内中点的 ULP 级极短弹道仍应落地')

  const reverseTouchdownRequestMs = 2400 - ultraShortStartMs
  const reversePreviousTimeMs = 2400 - ultraShortMidpointMs
  const reverseCurrentTimeMs = reverseTouchdownRequestMs
  const reversePrevious = sampleRootMotion({ ...travelSampleInput, definition: ultraShortDefinition, durationMs: 1200, loopMode: 'ping-pong', requestedTimeMs: reversePreviousTimeMs, previousRequestedTimeMs: undefined })
  let reverseLanding = reversePrevious
  let reverseChasePreviousTimeMs = reversePreviousTimeMs
  for (const requestedTimeMs of [reverseCurrentTimeMs, reverseCurrentTimeMs + 1, reverseCurrentTimeMs + 2, reverseCurrentTimeMs + 3]) {
    reverseLanding = sampleRootMotion({
      ...travelSampleInput,
      definition: ultraShortDefinition,
      durationMs: 1200,
      loopMode: 'ping-pong',
      previousRequestedTimeMs: reverseChasePreviousTimeMs,
      requestedTimeMs,
      previousAppliedWorld: reverseLanding.appliedWorld,
      previousAppliedTurnRadians: reverseLanding.appliedTurnRadians,
      previousLandingAuthorization: reverseLanding.landingAuthorization,
    })
    reverseChasePreviousTimeMs = requestedTimeMs
  }
  assert.ok(reverseLanding.landingImpulse > 0, 'ping-pong 反向 ULP 级落地使用同一可表示内点语义')
})

test('action-aware 时间线按相邻与重叠窗的真实强度判定正向 touchdown', () => {
  const landingAtMainEnd = (
    loopMode: 'once' | 'loop' | 'ping-pong',
    continuationStartMs: number,
    continuationWeight: number,
  ) => {
    const definition = {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [
        { id: 'main', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: 1 },
        { id: 'continuation', kind: 'ballistic' as const, startMs: continuationStartMs, endMs: 20, weight: continuationWeight },
      ],
      vfxTags: [] as const,
    }
    const base = {
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      characterHeight: 4,
      actionWeight: 1e-4,
    }
    const previous = sampleRootMotion({ ...base, requestedTimeMs: 5, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...base,
      requestedTimeMs: 10,
      previousRequestedTimeMs: 5,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }

  for (const loopMode of ['once', 'loop', 'ping-pong'] as const) {
    for (const continuationStartMs of [10, 9] as const) {
      const low = landingAtMainEnd(loopMode, continuationStartMs, 7.5e-9)
      assert.equal(low.phase, 'grounded')
      assert.ok(low.landingImpulse > 0, `${loopMode} 的低强度 ${continuationStartMs === 10 ? '相邻' : '重叠'}窗不得遮蔽主窗落地`)

      const high = landingAtMainEnd(loopMode, continuationStartMs, 1)
      assert.equal(high.landingImpulse, 0, `${loopMode} 的高强度 ${continuationStartMs === 10 ? '相邻' : '重叠'}窗仍是连续腾空`)
      assert.equal(high.landingAuthorization, undefined)
    }
  }

  const sameEndDefinition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: 1 },
      { id: 'same-end', kind: 'ballistic' as const, startMs: 5, endMs: 10, weight: 7.5e-9 },
    ],
    vfxTags: [] as const,
  }
  const sameEndPrevious = sampleRootMotion({
    ...travelSampleInput,
    definition: sameEndDefinition,
    durationMs: 100,
    loopMode: 'once',
    characterHeight: 4,
    actionWeight: 1e-4,
    requestedTimeMs: 5,
    previousRequestedTimeMs: undefined,
  })
  const sameEndLanding = sampleRootMotion({
    ...travelSampleInput,
    definition: sameEndDefinition,
    durationMs: 100,
    loopMode: 'once',
    characterHeight: 4,
    actionWeight: 1e-4,
    requestedTimeMs: 10,
    previousRequestedTimeMs: 5,
    previousAppliedWorld: sameEndPrevious.appliedWorld,
    previousAppliedTurnRadians: sameEndPrevious.appliedTurnRadians,
  })
  assert.ok(sameEndLanding.landingImpulse > 0, '同终点贡献窗必须保留一个聚合 touchdown')
})

test('Root Motion touchdown 授权不受请求帧细分与低强度相邻边界影响', () => {
  const definitionAtTailStart = (tailStartMs: number) => ({
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'main', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: 1 },
      { id: 'relative-zero-tail', kind: 'ballistic' as const, startMs: tailStartMs, endMs: 20, weight: 7.5e-13 },
    ],
    vfxTags: [] as const,
  })
  const run = (tailStartMs: number) => {
    const base = {
      ...travelSampleInput,
      definition: definitionAtTailStart(tailStartMs),
      durationMs: 100,
      loopMode: 'once' as const,
      characterHeight: 4,
      actionWeight: 1,
    }
    let previous = sampleRootMotion({ ...base, requestedTimeMs: 5, previousRequestedTimeMs: undefined })
    let totalImpulse = 0
    for (const requestedTimeMs of [10, 11, 12, 13]) {
      previous = sampleRootMotion({
        ...base,
        previousRequestedTimeMs: previous.requestedTimeMs,
        requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        previousLandingAuthorization: previous.landingAuthorization,
      })
      totalImpulse += previous.landingImpulse
    }
    return totalImpulse
  }

  assert.equal(run(9.999999), 1, '低强度重叠尾窗不得因请求端点切分而吞掉主弹道完整冲量')
  assert.equal(run(10), 1, '精确相邻的相对零尾窗应得到相同转换与冲量')
})

test('高强度精确相邻弹道在越过边界的不同帧细分下都不签发伪 touchdown', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'first', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: 1 },
      { id: 'adjacent', kind: 'ballistic' as const, startMs: 10, endMs: 20, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  const base = {
    ...travelSampleInput,
    definition,
    durationMs: 100,
    loopMode: 'once' as const,
    characterHeight: 4,
    actionWeight: 1,
  }
  const run = (times: readonly number[]) => {
    let previous = sampleRootMotion({ ...base, requestedTimeMs: 5, previousRequestedTimeMs: undefined })
    let totalImpulse = 0
    for (const requestedTimeMs of times) {
      previous = sampleRootMotion({
        ...base,
        previousRequestedTimeMs: previous.requestedTimeMs,
        requestedTimeMs,
        previousAppliedWorld: previous.appliedWorld,
        previousAppliedTurnRadians: previous.appliedTurnRadians,
        previousLandingAuthorization: previous.landingAuthorization,
      })
      assert.equal(previous.landingAuthorization, undefined, `${String(requestedTimeMs)}ms 不得出现内部伪 touchdown 授权`)
      totalImpulse += previous.landingImpulse
    }
    return totalImpulse
  }

  assert.equal(run([10.000001, 11, 12, 13]), 0)
  assert.equal(run([10, 10.000001, 11, 12, 13]), 0)
})

test('overlap 内部的正宽 composite grounded valley 会真实落地并重新腾空', () => {
  const base = {
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [
        { id: 'first', kind: 'ballistic' as const, startMs: 0, endMs: 100, weight: 1 },
        { id: 'second', kind: 'ballistic' as const, startMs: 99.995, endMs: 199.995, weight: 1 },
      ],
      vfxTags: [] as const,
    },
    durationMs: 200,
    loopMode: 'once' as const,
    characterHeight: 4,
    actionWeight: 1e-4,
  }
  const airborne = sampleRootMotion({ ...base, requestedTimeMs: 99.995, previousRequestedTimeMs: undefined })
  const grounded = sampleRootMotion({
    ...base,
    previousRequestedTimeMs: airborne.requestedTimeMs,
    requestedTimeMs: 99.9975,
    previousAppliedWorld: airborne.appliedWorld,
    previousAppliedTurnRadians: airborne.appliedTurnRadians,
    previousLandingAuthorization: airborne.landingAuthorization,
  })
  const airborneAgain = sampleRootMotion({
    ...base,
    previousRequestedTimeMs: grounded.requestedTimeMs,
    requestedTimeMs: 100,
    previousAppliedWorld: grounded.appliedWorld,
    previousAppliedTurnRadians: grounded.appliedTurnRadians,
    previousLandingAuthorization: grounded.landingAuthorization,
  })

  assert.ok(airborne.cumulativeWorld[1] > 4e-12)
  assert.equal(grounded.phase, 'grounded')
  assert.ok(grounded.landingImpulse > 0, 'valley 的真实 touchdown 必须消费第一组件自己的冲量')
  assert.ok(airborneAgain.cumulativeWorld[1] > 4e-12)
  assert.equal(airborneAgain.landingAuthorization, undefined, '第二组件 takeoff 不得继承第一组件授权')
})

test('巨大绝对时间仍按 canonical 局部事件驱动 touchdown 与 takeoff', () => {
  const base = {
    ...travelSampleInput,
    durationMs: 100,
    characterHeight: 4,
    actionWeight: 1,
  }
  const adjacentDefinition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'first', kind: 'ballistic' as const, startMs: 20, endMs: 30, weight: 1 },
      { id: 'second', kind: 'ballistic' as const, startMs: 30.001, endMs: 40, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  const cross = (loopMode: 'loop' | 'ping-pong', segmentStartMs: number, startOffsetMs: number) => {
    const previous = sampleRootMotion({
      ...base,
      definition: adjacentDefinition,
      loopMode,
      requestedTimeMs: segmentStartMs + startOffsetMs,
      previousRequestedTimeMs: undefined,
    })
    return sampleRootMotion({
      ...base,
      definition: adjacentDefinition,
      loopMode,
      previousRequestedTimeMs: previous.requestedTimeMs,
      requestedTimeMs: segmentStartMs + startOffsetMs + 2,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: previous.landingAuthorization,
    })
  }
  const forward = cross('loop', 2 ** 40 * 100, 29)
  const reverse = cross('ping-pong', (2 ** 40 + 1) * 100, 69)
  for (const sample of [forward, reverse]) {
    assert.ok(sample.cumulativeWorld[1] > 4e-12)
    assert.equal(sample.landingImpulse, 0)
    assert.equal(sample.landingAuthorization, undefined, '同一绝对 double 的 touchdown→takeoff 不得被反序为旧授权')
  }

  const roundedTouchdownDefinition = {
    ...adjacentDefinition,
    windows: [{ id: 'rounded-touchdown', kind: 'ballistic' as const, startMs: 20, endMs: 29.001, weight: 1 }],
  }
  const segmentStartMs = 2 ** 40 * 100
  const previous = sampleRootMotion({
    ...base,
    definition: roundedTouchdownDefinition,
    loopMode: 'loop',
    requestedTimeMs: segmentStartMs + 29,
    previousRequestedTimeMs: undefined,
  })
  const landed = sampleRootMotion({
    ...base,
    definition: roundedTouchdownDefinition,
    loopMode: 'loop',
    previousRequestedTimeMs: previous.requestedTimeMs,
    requestedTimeMs: segmentStartMs + 31,
    previousAppliedWorld: previous.appliedWorld,
    previousAppliedTurnRadians: previous.appliedTurnRadians,
    previousLandingAuthorization: previous.landingAuthorization,
  })
  assert.equal(landed.phase, 'grounded')
  assert.ok(landed.landingImpulse > 0, '舍入为 previous 的绝对时间不得丢失局部区间内的 canonical touchdown')
})

test('超安全整数的不可表示 iteration 锚不伪造事件且保留 caller-owned 授权', () => {
  const previousRequestedTimeMs = 112589990684259900
  const requestedTimeMs = 112589990684259920
  const previousLandingAuthorization = Object.freeze({
    touchdownRequestedTimeMs: previousRequestedTimeMs - 100,
    impulse: .75,
  })
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [{ id: 'unrepresentable-anchor', kind: 'ballistic' as const, startMs: 1, endMs: 3, weight: 1 }],
      vfxTags: [] as const,
    },
    durationMs: 100,
    loopMode: 'loop',
    previousRequestedTimeMs,
    requestedTimeMs,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    previousLandingAuthorization,
  })

  assert.equal(sample.resolvedTimeMs, 20)
  assert.equal(sample.cumulativeWorld[1], 0)
  assert.equal(sample.landingImpulse, 0)
  assert.deepEqual(sample.landingAuthorization, previousLandingAuthorization)
})

test('普通 loop 的 canonical modulo 端点不越过 target 之后的 takeoff', () => {
  const previousLandingAuthorization = Object.freeze({ touchdownRequestedTimeMs: 900, impulse: .6 })
  const windowStartMs = 1000.1234565003246
  const sample = sampleRootMotion({
    ...travelSampleInput,
    definition: {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [{ id: 'canonical-endpoint', kind: 'ballistic' as const, startMs: windowStartMs, endMs: windowStartMs + 1, weight: 1 }],
      vfxTags: [] as const,
    },
    durationMs: 4093,
    loopMode: 'loop',
    previousRequestedTimeMs: 999,
    requestedTimeMs: 1000.123456789,
    previousAppliedWorld: [0, 0, 0],
    previousAppliedTurnRadians: 0,
    previousLandingAuthorization,
  })

  assert.equal(sample.cumulativeWorld[1], 0)
  assert.equal(sample.phase, 'grounded')
  assert.equal(sample.landingImpulse, 0)
  assert.deepEqual(sample.landingAuthorization, previousLandingAuthorization)
})

test('loop 与 ping-pong 的 exact seam proven airborne 会清除 stale 授权', () => {
  const definition = {
    mode: 'travel' as const,
    distance: 0,
    turnRadians: 0,
    verticalMode: 'ballistic' as const,
    jumpHeight: 1,
    windows: [
      { id: 'next', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: 1 },
      { id: 'previous', kind: 'ballistic' as const, startMs: 90, endMs: 100, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  for (const loopMode of ['loop', 'ping-pong'] as const) {
    const base = {
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode,
      characterHeight: 4,
      actionWeight: 1,
    }
    const previous = sampleRootMotion({ ...base, requestedTimeMs: 99, previousRequestedTimeMs: undefined })
    const seam = sampleRootMotion({
      ...base,
      previousRequestedTimeMs: previous.requestedTimeMs,
      requestedTimeMs: 100,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
      previousLandingAuthorization: Object.freeze({ touchdownRequestedTimeMs: 80, impulse: .6 }),
    })

    assert.ok(previous.cumulativeWorld[1] > 4e-12)
    assert.equal(seam.phase, 'grounded')
    assert.equal(seam.landingImpulse, 0, `${loopMode} seam 的旧授权必须在 applied touchdown 前清除`)
    assert.equal(seam.landingAuthorization, undefined)
  }
})

test('action-aware 时间线在 ping-pong 反向按相邻与重叠窗强度判定 touchdown', () => {
  const reverseLandingAtMainStart = (continuationEndMs: number, continuationWeight: number) => {
    const definition = {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [
        { id: 'continuation', kind: 'ballistic' as const, startMs: 0, endMs: continuationEndMs, weight: continuationWeight },
        { id: 'main', kind: 'ballistic' as const, startMs: 10, endMs: 20, weight: 1 },
      ],
      vfxTags: [] as const,
    }
    const base = {
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode: 'ping-pong' as const,
      characterHeight: 4,
      actionWeight: 1e-4,
    }
    const previous = sampleRootMotion({ ...base, requestedTimeMs: 185, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...base,
      requestedTimeMs: 190,
      previousRequestedTimeMs: 185,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }

  for (const continuationEndMs of [10, 11] as const) {
    const low = reverseLandingAtMainStart(continuationEndMs, 7.5e-9)
    assert.equal(low.phase, 'grounded')
    assert.ok(low.landingImpulse > 0, `反向低强度 ${continuationEndMs === 10 ? '相邻' : '重叠'}窗不得遮蔽主窗落地`)

    const high = reverseLandingAtMainStart(continuationEndMs, 1)
    assert.equal(high.landingImpulse, 0, `反向高强度 ${continuationEndMs === 10 ? '相邻' : '重叠'}窗仍是连续腾空`)
    assert.equal(high.landingAuthorization, undefined)
  }
})

test('loop 周期缝由下一周期 action-aware 证据决定是否 touchdown', () => {
  const landingAtLoopSeam = (continuationWeight: number) => {
    const definition = {
      mode: 'travel' as const,
      distance: 0,
      turnRadians: 0,
      verticalMode: 'ballistic' as const,
      jumpHeight: 1,
      windows: [
        { id: 'next-cycle', kind: 'ballistic' as const, startMs: 0, endMs: 10, weight: continuationWeight },
        { id: 'main', kind: 'ballistic' as const, startMs: 20, endMs: 100, weight: 1 },
      ],
      vfxTags: [] as const,
    }
    const base = {
      ...travelSampleInput,
      definition,
      durationMs: 100,
      loopMode: 'loop' as const,
      characterHeight: 4,
      actionWeight: 1e-4,
    }
    const previous = sampleRootMotion({ ...base, requestedTimeMs: 95, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...base,
      requestedTimeMs: 100,
      previousRequestedTimeMs: 95,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }

  const low = landingAtLoopSeam(7.5e-9)
  assert.equal(low.phase, 'grounded')
  assert.ok(low.landingImpulse > 0, '下一周期低强度窗低于世界阈值时应保留 seam touchdown')

  const high = landingAtLoopSeam(1)
  assert.equal(high.landingImpulse, 0, '下一周期高强度窗证明持续腾空时不得在 seam touchdown')
  assert.equal(high.landingAuthorization, undefined)
})

test('Root Motion 规范化、采样和时间解析共用 canonical duration', () => {
  const cases = [
    { input: 1200.4, expected: 1200 },
    { input: 50, expected: 100 },
    { input: 70000, expected: 60000 },
    { input: Number.NaN, expected: 1200 },
    { input: Number.POSITIVE_INFINITY, expected: 1200 },
  ] as const
  for (const item of cases) {
    assert.equal(normalizeMotionDurationMs(item.input), item.expected)
    const normalized = normalizeBipedPetRootMotion({
      mode: 'travel',
      distance: 1,
      turnRadians: 0,
      verticalMode: 'grounded',
      jumpHeight: 0,
      windows: [{ id: 'canonical', kind: 'travel', startMs: 0, endMs: 100000, weight: 1 }],
      vfxTags: [],
    }, item.input)
    assert.equal(normalized.value.windows[0]?.endMs, item.expected)
    const sample = sampleRootMotion({
      ...travelSampleInput,
      definition: normalized.value,
      durationMs: item.input,
      loopMode: 'once',
      requestedTimeMs: item.expected,
      previousRequestedTimeMs: undefined,
    })
    assert.notEqual(sample.status, 'blocked')
    assert.equal(sample.resolvedTimeMs, item.expected)
    assert.deepEqual(sample.appliedLocal, sample.cumulativeLocal)
  }
})

test('畸形输入安全 blocked，输入不突变且输出不共享可变引用', () => {
  const throwingDefinition = new Proxy({}, {
    get() {
      throw new Error('定义 getter 不应逃逸')
    },
  })
  const invalidInputs = [
    { ...travelSampleInput, requestedTimeMs: Number.NaN },
    { ...travelSampleInput, previousRequestedTimeMs: Number.POSITIVE_INFINITY },
    { ...travelSampleInput, characterHeight: 0 },
    { ...travelSampleInput, facingRadians: Number.POSITIVE_INFINITY },
    { ...travelSampleInput, actionWeight: Number.NaN },
    { ...travelSampleInput, definition: { ...travelDefinition, windows: null } },
    { ...travelSampleInput, definition: { ...travelDefinition, distance: Number.POSITIVE_INFINITY } },
    { ...travelSampleInput, previousAppliedWorld: [0, 0, 0] },
    { ...travelSampleInput, previousAppliedLocal: [0, 0, 0], previousAppliedTurnRadians: 0 },
    { ...travelSampleInput, previousLandingAuthorization: { touchdownRequestedTimeMs: 0, impulse: Number.NaN } },
    { ...travelSampleInput, previousLandingAuthorization: { touchdownRequestedTimeMs: 301, impulse: .5 } },
    { ...travelSampleInput, previousLandingAuthorization: new Proxy({}, { get() { throw new Error('授权 getter 不应逃逸') } }) },
    { ...travelSampleInput, definition: throwingDefinition },
  ]
  for (const input of invalidInputs) {
    const sample = sampleRootMotion(input)
    assert.equal(sample.status, 'blocked')
    assertFiniteSample(sample)
  }

  const { proxy, revoke } = Proxy.revocable({}, {})
  revoke()
  let revokedSample: ReturnType<RootMotionSampler> | undefined
  assert.doesNotThrow(() => { revokedSample = sampleRootMotion(proxy) })
  assert.equal(revokedSample?.status, 'blocked')

  const mutableInput = structuredClone(travelSampleInput)
  const snapshot = structuredClone(mutableInput)
  const first = sampleRootMotion(mutableInput)
  const second = sampleRootMotion(mutableInput)
  assert.deepEqual(mutableInput, snapshot)
  assert.notEqual(first, second)
  assert.notEqual(first.cumulativeLocal, second.cumulativeLocal)
  assert.notEqual(first.deltaWorld, second.deltaWorld)
  assert.ok(Object.isFrozen(first))
  assert.ok(Object.isFrozen(first.cumulativeLocal))
  assert.ok(Object.isFrozen(first.deltaWorld))
})

test('运动、落地与制动强度在边界稳定且暂停或 reset 不重复触发', () => {
  const brakeDefinition = {
    ...travelDefinition,
    distance: 1,
    windows: [
      { id: 'travel', kind: 'travel' as const, startMs: 0, endMs: 1200, weight: 1 },
      { id: 'brake', kind: 'brake' as const, startMs: 400, endMs: 800, weight: 1 },
    ],
  }
  const continuous = (previousRequestedTimeMs: number, requestedTimeMs: number) => {
    const previous = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, requestedTimeMs: previousRequestedTimeMs, previousRequestedTimeMs: undefined })
    return sampleRootMotion({
      ...travelSampleInput,
      definition: brakeDefinition,
      previousRequestedTimeMs,
      requestedTimeMs,
      previousAppliedWorld: previous.appliedWorld,
      previousAppliedTurnRadians: previous.appliedTurnRadians,
    })
  }
  const moving = continuous(599, 600)
  const brakeStart = continuous(399, 400)
  const brakeEnd = continuous(799, 800)
  const paused = continuous(600, 600)
  const reset = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, previousRequestedTimeMs: 0, requestedTimeMs: 600 })
  assert.ok(moving.motionIntensity > 0 && moving.motionIntensity <= 1)
  assert.ok(moving.brakeIntensity > 0 && moving.brakeIntensity <= 1)
  assert.equal(brakeStart.brakeIntensity, 0)
  assert.equal(brakeEnd.brakeIntensity, 0)
  assert.equal(paused.motionIntensity, 0)
  assert.equal(paused.brakeIntensity, 0)
  assert.equal(reset.motionIntensity, 0)
  assert.equal(reset.brakeIntensity, 0)
})

test('固定种子有状态序列真实命中求解、钳制、重置、阻塞、接缝和运动信号', () => {
  let state = 0x6d2b79f5
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
  const durationMs = 200
  const definition = {
    mode: 'travel' as const,
    distance: .4,
    turnRadians: 1,
    verticalMode: 'ballistic' as const,
    jumpHeight: .8,
    windows: [
      { id: 'burst', kind: 'travel' as const, startMs: 0, endMs: 12, weight: 1 },
      { id: 'warp', kind: 'warp' as const, startMs: 8, endMs: 150, weight: .6 },
      { id: 'jump-main', kind: 'ballistic' as const, startMs: 20, endMs: 100, weight: 1 },
      { id: 'jump-overlap', kind: 'ballistic' as const, startMs: 40, endMs: 70, weight: .01 },
      { id: 'brake', kind: 'brake' as const, startMs: 110, endMs: 190, weight: 1 },
    ],
    vfxTags: [] as const,
  }
  const counts = { solved: 0, clamped: 0, reset: 0, blocked: 0, seam: 0, landing: 0, brake: 0 }
  let requestedTimeMs = 0
  let previousRequestedTimeMs: number | undefined
  let previousAppliedWorld: readonly [number, number, number] | undefined
  let previousAppliedTurnRadians: number | undefined
  let previousLandingAuthorization: ReturnType<RootMotionSampler>['landingAuthorization']
  let previousIteration = 0
  for (let index = 0; index < 1024; index += 1) {
    if (index > 0) requestedTimeMs += 7 + Math.floor(random() * 34)
    const forceReset = index % 251 === 0
    const input = {
      definition,
      requestedTimeMs,
      ...(forceReset || previousRequestedTimeMs === undefined
        ? {}
        : { previousRequestedTimeMs, previousAppliedWorld, previousAppliedTurnRadians, previousLandingAuthorization }),
      durationMs,
      loopMode: 'loop' as const,
      characterHeight: 4,
      facingRadians: 0,
      actionWeight: 1,
      footResidual: [(random() - .5) * 10, (random() - .5) * 1e100, (random() - .5) * 10] as const,
    }
    const first = sampleRootMotion(input)
    const second = sampleRootMotion(input)
    assertFiniteSample(first)
    assert.deepEqual(first, second)
    counts[first.status] += 1
    if (first.iteration !== previousIteration) counts.seam += 1
    if (first.landingImpulse > 0) counts.landing += 1
    if (first.brakeIntensity > 0) counts.brake += 1
    previousIteration = first.iteration
    previousRequestedTimeMs = requestedTimeMs
    previousAppliedWorld = first.appliedWorld
    previousAppliedTurnRadians = first.appliedTurnRadians
    previousLandingAuthorization = first.landingAuthorization

    if (index % 211 === 0) {
      const blocked = sampleRootMotion({ ...input, footResidual: [Number.NaN, 0, 0] })
      assert.equal(blocked.status, 'blocked')
      assertFiniteSample(blocked)
      counts.blocked += 1
    }
  }
  assert.ok(counts.solved > 100, JSON.stringify(counts))
  assert.ok(counts.clamped > 10, JSON.stringify(counts))
  assert.ok(counts.reset >= 5, JSON.stringify(counts))
  assert.ok(counts.blocked >= 5, JSON.stringify(counts))
  assert.ok(counts.seam > 50, JSON.stringify(counts))
  assert.ok(counts.landing > 20, JSON.stringify(counts))
  assert.ok(counts.brake > 100, JSON.stringify(counts))
})
