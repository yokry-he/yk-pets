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

  for (const input of [null, [], 'bad', accessFailure, revokedProxy, { mode: 'travel', distance: .1, windows: windowAccessFailure }]) {
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
