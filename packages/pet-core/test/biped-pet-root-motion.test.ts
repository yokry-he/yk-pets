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
  sampleBipedPetMotion,
} from '../src/index.ts'

type RootMotionSampler = (input: unknown) => {
  status: 'solved' | 'clamped' | 'reset' | 'blocked'
  requestedTimeMs: number
  resolvedTimeMs: number
  iteration: number
  cumulativeLocal: readonly [number, number, number]
  cumulativeWorld: readonly [number, number, number]
  deltaLocal: readonly [number, number, number]
  deltaWorld: readonly [number, number, number]
  cumulativeTurnRadians: number
  deltaTurnRadians: number
  linearVelocity: readonly [number, number, number]
  angularVelocity: number
  phase: 'grounded' | 'takeoff' | 'airborne' | 'landing'
  motionIntensity: number
  landingImpulse: number
  brakeIntensity: number
}

function sampleRootMotion(input: unknown): ReturnType<RootMotionSampler> {
  const sampler = Reflect.get(petCore, 'sampleBipedPetRootMotion')
  assert.equal(typeof sampler, 'function', 'sampleBipedPetRootMotion 必须从 pet-core 入口导出')
  return (sampler as RootMotionSampler)(input)
}

function assertFiniteSample(sample: ReturnType<RootMotionSampler>) {
  for (const value of [
    sample.requestedTimeMs,
    sample.resolvedTimeMs,
    sample.iteration,
    ...sample.cumulativeLocal,
    ...sample.cumulativeWorld,
    ...sample.deltaLocal,
    ...sample.deltaWorld,
    sample.cumulativeTurnRadians,
    sample.deltaTurnRadians,
    ...sample.linearVelocity,
    sample.angularVelocity,
    sample.motionIntensity,
    sample.landingImpulse,
    sample.brakeIntensity,
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

test('历史 V1 Clip 的非有限或非正时长不会命中旧 ready 缓存', () => {
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
  assert.deepEqual(nonFinite, canonicalInPlaceRootMotion)
  assert.equal(repeatedNonFinite, nonFinite)

  mutableClip.durationMs = 0
  const nonPositive = sampleBipedPetMotion(clip, 100).rootMotion
  assert.deepEqual(nonPositive, canonicalInPlaceRootMotion)
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
})

test('累计位移与帧率无关并在 loop 接缝连续，回拖与大跳只重置瞬时量', () => {
  const half = sampleRootMotion(travelSampleInput)
  assert.equal(half.status, 'reset')
  assert.ok(Math.abs(half.cumulativeLocal[0] - .84) < 1e-9)

  const thirty = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 0, requestedTimeMs: 600 })
  const sixty = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 300, requestedTimeMs: 600 })
  assert.deepEqual(thirty.cumulativeLocal, sixty.cumulativeLocal)

  const nextCycle = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 1190, requestedTimeMs: 1210 })
  assert.ok(nextCycle.deltaLocal[0] > 0)
  assert.equal(nextCycle.iteration, 1)

  const rewind = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 800, requestedTimeMs: 200 })
  assert.equal(rewind.status, 'reset')
  assert.deepEqual(rewind.deltaLocal, [0, 0, 0])
  assert.deepEqual(rewind.linearVelocity, [0, 0, 0])

  const first = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: undefined })
  assert.equal(first.status, 'reset')
  assert.deepEqual(first.deltaLocal, [0, 0, 0])

  const paused = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 600 })
  assert.equal(paused.status, 'solved')
  assert.deepEqual(paused.deltaLocal, [0, 0, 0])
  assert.deepEqual(paused.linearVelocity, [0, 0, 0])
  assert.equal(paused.landingImpulse, 0)
  assert.equal(paused.brakeIntensity, 0)

  // 连续阈值与足锁控制器一致：min(250ms, duration × 0.25)。超过后由调用方重新建立历史身份。
  const largeJump = sampleRootMotion({ ...travelSampleInput, previousRequestedTimeMs: 0, requestedTimeMs: 251 })
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

  const returning = sampleRootMotion({
    ...travelSampleInput,
    loopMode: 'ping-pong',
    previousRequestedTimeMs: 1200,
    requestedTimeMs: 1210,
  })
  assert.equal(returning.iteration, 1)
  assert.ok(returning.deltaLocal[0] < 0)
  assert.ok(returning.linearVelocity[0] < 0)

  const noHorizontalWindows = sampleRootMotion({
    ...travelSampleInput,
    definition: { ...travelDefinition, distance: 1, turnRadians: 1, windows: [] },
    durationMs: 1000,
    previousRequestedTimeMs: 999,
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
  assert.equal(sampleAt(200).phase, 'takeoff')
  assert.equal(sampleAt(400).phase, 'airborne')
  assert.equal(sampleAt(600).phase, 'airborne')
  assert.equal(sampleAt(800).phase, 'landing')
  assert.equal(sampleAt(1000).phase, 'landing')
  const quarterProgress = smoothstepForRootMotionTest(.25)
  assert.ok(Math.abs(sampleAt(400).cumulativeLocal[1] - 4 * 2 * quarterProgress * (1 - quarterProgress)) < 1e-12)
  assert.ok(Math.abs(sampleAt(600).cumulativeLocal[1] - 2) < 1e-12)
  assert.ok(Math.abs(sampleAt(800).cumulativeLocal[1] - 4 * 2 * quarterProgress * (1 - quarterProgress)) < 1e-12)

  const enteringLanding = sampleRootMotion({
    ...travelSampleInput,
    definition,
    previousRequestedTimeMs: 799,
    requestedTimeMs: 801,
  })
  const landingPoint = sampleRootMotion({
    ...travelSampleInput,
    definition,
    previousRequestedTimeMs: 999,
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
  const reverseTakeoff = sampleRootMotion({ ...pingPongInput, previousRequestedTimeMs: 1000, requestedTimeMs: 1010 })
  const reversePeak = sampleRootMotion({ ...pingPongInput, previousRequestedTimeMs: 1499, requestedTimeMs: 1500 })
  const reverseLanding = sampleRootMotion({ ...pingPongInput, previousRequestedTimeMs: 1980, requestedTimeMs: 1990 })
  const reverseTouchdown = sampleRootMotion({ ...pingPongInput, previousRequestedTimeMs: 1999, requestedTimeMs: 2000 })
  assert.equal(reverseTakeoff.phase, 'takeoff')
  assert.ok(reverseTakeoff.deltaLocal[1] > 0)
  assert.equal(reversePeak.phase, 'airborne')
  assert.equal(reverseLanding.phase, 'landing')
  assert.ok(reverseLanding.deltaLocal[1] < 0)
  assert.ok(reverseTouchdown.landingImpulse > 0)
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
  const facingDelta = sampleRootMotion({
    ...travelSampleInput,
    facingRadians: Math.PI / 2,
    requestedTimeMs: 600,
    previousRequestedTimeMs: 599,
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
    requestedTimeMs: 10,
  })
  assert.equal(sample.status, 'clamped')
  assert.equal(sample.cumulativeLocal[0], 16)
  assert.equal(Math.hypot(...sample.deltaLocal), 1)
  assert.equal(sample.cumulativeTurnRadians, Math.PI * 2)
  assert.equal(Math.abs(sample.deltaTurnRadians), Math.PI / 4)
})

test('足底残差仅提供角色高度 2% 内的局部修正且非法残差阻塞', () => {
  const inPlace = { ...travelDefinition, mode: 'in-place' as const, distance: 0, turnRadians: 0, windows: [] as const }
  const corrected = sampleRootMotion({
    ...travelSampleInput,
    definition: inPlace,
    previousRequestedTimeMs: 0,
    requestedTimeMs: 16,
    footResidual: [1e9, -1e9, 1e9] as const,
  })
  assert.ok(Math.hypot(...corrected.deltaLocal) <= .02 * 4 + 1e-12)
  assert.deepEqual(corrected.cumulativeLocal, [0, 0, 0])

  const extreme = sampleRootMotion({
    ...travelSampleInput,
    definition: inPlace,
    previousRequestedTimeMs: 0,
    requestedTimeMs: 16,
    footResidual: [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE] as const,
  })
  assert.notEqual(extreme.status, 'blocked')
  assert.ok(Math.hypot(...extreme.deltaLocal) <= .02 * 4 + 1e-12)

  const integrateResidual = (fps: number) => {
    let distance = 0
    let velocity = 0
    let intensity = 0
    for (let frame = 1; frame <= fps; frame += 1) {
      const currentTimeMs = frame * 1000 / fps
      const sample = sampleRootMotion({
        ...travelSampleInput,
        definition: inPlace,
        characterHeight: 4,
        previousRequestedTimeMs: (frame - 1) * 1000 / fps,
        requestedTimeMs: currentTimeMs,
        footResidual: [.01, 0, 0] as const,
      })
      distance += sample.deltaLocal[0]
      velocity = sample.linearVelocity[0]
      intensity = sample.motionIntensity
    }
    return { distance, velocity, intensity }
  }
  const thirtyFps = integrateResidual(30)
  const sixtyFps = integrateResidual(60)
  assert.ok(Math.abs(thirtyFps.distance - .01 * .25) < 1e-12)
  assert.ok(Math.abs(thirtyFps.distance - sixtyFps.distance) < 1e-12)
  assert.ok(Math.abs(thirtyFps.velocity - sixtyFps.velocity) < 1e-12)
  assert.ok(Math.abs(thirtyFps.intensity - sixtyFps.intensity) < 1e-12)

  const invalid = sampleRootMotion({ ...travelSampleInput, footResidual: [Number.NaN, 0, 0] })
  assert.equal(invalid.status, 'blocked')
  assertFiniteSample(invalid)
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
    { ...travelSampleInput, durationMs: 0 },
    { ...travelSampleInput, characterHeight: 0 },
    { ...travelSampleInput, facingRadians: Number.POSITIVE_INFINITY },
    { ...travelSampleInput, actionWeight: Number.NaN },
    { ...travelSampleInput, definition: { ...travelDefinition, windows: null } },
    { ...travelSampleInput, definition: { ...travelDefinition, distance: Number.POSITIVE_INFINITY } },
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
  const moving = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, previousRequestedTimeMs: 599, requestedTimeMs: 600 })
  const brakeStart = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, previousRequestedTimeMs: 399, requestedTimeMs: 400 })
  const brakeEnd = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, previousRequestedTimeMs: 799, requestedTimeMs: 800 })
  const paused = sampleRootMotion({ ...travelSampleInput, definition: brakeDefinition, previousRequestedTimeMs: 600, requestedTimeMs: 600 })
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

test('固定种子边界与极值探针保持有限且确定', () => {
  let state = 0x6d2b79f5
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
  for (let index = 0; index < 512; index += 1) {
    const durationMs = 100 + Math.floor(random() * 59901)
    const requestedTimeMs = (random() - .5) * 2e7
    const split = Math.max(1, Math.floor(durationMs * random()))
    const input = {
      definition: {
        mode: 'travel' as const,
        distance: (random() - .5) * 8,
        turnRadians: (random() - .5) * Math.PI * 4,
        verticalMode: random() > .5 ? 'ballistic' as const : 'grounded' as const,
        jumpHeight: random() * 1.5,
        windows: [
          { id: 'a', kind: 'travel' as const, startMs: 0, endMs: split, weight: Math.max(Number.EPSILON, random()) },
          { id: 'b', kind: 'warp' as const, startMs: split, endMs: durationMs, weight: Math.max(Number.EPSILON, random()) },
          { id: 'c', kind: 'ballistic' as const, startMs: 0, endMs: durationMs, weight: Math.max(Number.EPSILON, random()) },
        ],
        vfxTags: [] as const,
      },
      requestedTimeMs,
      previousRequestedTimeMs: requestedTimeMs,
      durationMs,
      loopMode: (['once', 'loop', 'ping-pong'] as const)[index % 3]!,
      characterHeight: Number.MIN_VALUE + random() * 100,
      facingRadians: (random() - .5) * 1e6,
      actionWeight: (random() - .5) * 4,
      footResidual: [(random() - .5) * 1e100, (random() - .5) * 1e100, (random() - .5) * 1e100] as const,
    }
    const first = sampleRootMotion(input)
    const second = sampleRootMotion(input)
    assertFiniteSample(first)
    assert.deepEqual(first, second)
  }
})
