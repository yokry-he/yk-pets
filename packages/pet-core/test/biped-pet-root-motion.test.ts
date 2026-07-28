/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Root Motion 扩展的版本兼容规范化、Clip 编译与采样身份传播。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BIPED_PET_RIG_PROFILE,
  compileBipedPetMotion,
  createStudioMotionAsset,
  normalizeBipedPetRootMotion,
  sampleBipedPetMotion,
} from '../src/index.ts'

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
