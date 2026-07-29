/**
 * 文件职责 / File responsibility
 * 验证道具动作 Rig 显式语义点和参数化几何安全推导，不依赖 Three 或外部模型格式。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import * as petCore from '../src/index.ts'
import { createDefaultPropAnchors, createDefaultPropComponent, createStudioPropAsset } from '../src/index.ts'

type RigPoint = {
  readonly position: readonly [number, number, number]
  readonly rotation: readonly [number, number, number, number]
}

type RigResult = {
  readonly status: 'ready' | 'derived' | 'primary-only'
  readonly value: {
    readonly primaryGrip: RigPoint
    readonly secondaryGrip?: RigPoint
    readonly trailStart?: RigPoint
    readonly trailEnd?: RigPoint
    readonly impactPoint?: RigPoint
  }
  readonly diagnostics: readonly { id: string; severity: 'warning'; message: string }[]
}

function point(position: readonly [number, number, number], rotation: readonly [number, number, number, number] = [0, 0, 0, 1]) {
  return { position, rotation }
}

function normalizeRig(input: unknown): RigResult {
  const normalizer = Reflect.get(petCore, 'normalizeStudioPropRig')
  assert.equal(typeof normalizer, 'function', 'normalizeStudioPropRig 应从 pet-core 公共入口导出')
  return normalizer(input) as RigResult
}

function deriveRig(asset: unknown): RigResult {
  const derive = Reflect.get(petCore, 'deriveStudioPropRig')
  assert.equal(typeof derive, 'function', 'deriveStudioPropRig 应从 pet-core 公共入口导出')
  return derive(asset) as RigResult
}

test('星云长棍显式语义点保持单位四元数', () => {
  const result = normalizeRig({
    primaryGrip: point([.32, 0, 0]),
    secondaryGrip: point([-.58, 0, 0], [0, 0, 0, 2]),
    trailStart: point([-1.65, 0, 0]),
    trailEnd: point([1.65, 0, 0]),
    impactPoint: point([1.65, 0, 0]),
  })

  assert.equal(result.status, 'ready')
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual(result.value.secondaryGrip?.position, [-.58, 0, 0])
  assert.deepEqual(result.value.secondaryGrip?.rotation, [0, 0, 0, 1])
  assert.ok(Object.isFrozen(result.value))
  assert.ok(Object.isFrozen(result.value.secondaryGrip?.position))
})

test('缺少扩展的长条道具按最长轴推导安全语义点', () => {
  const body = createDefaultPropComponent('long-body', 'box', '长条主体')
  body.transform.scale = [4, 1, 1]
  body.geometry = { ...body.geometry, width: 1, height: 1, depth: 1 }
  const asset = createStudioPropAsset({
    id: 'long-box',
    nameZh: '长条道具',
    nameEn: 'Long Box',
    kind: 'composite',
    defaultAnchor: 'right-front-paw',
    components: [body],
    anchors: createDefaultPropAnchors(),
    createdAt: 1,
    updatedAt: 1,
  })

  const result = deriveRig(asset)
  assert.equal(result.status, 'derived')
  assert.ok(result.value.trailStart!.position[0] < result.value.secondaryGrip!.position[0])
  assert.ok(result.value.secondaryGrip!.position[0] < result.value.trailEnd!.position[0])
  assert.deepEqual(result.value.impactPoint, result.value.trailEnd)
})

test('显式 Rig 扩展优先且损坏扩展安全回退参数化几何', () => {
  const body = createDefaultPropComponent('body', 'box')
  body.transform.scale = [4, 1, 1]
  const explicitRig = {
    primaryGrip: point([0, 0, .2]),
    secondaryGrip: point([0, 0, -.4]),
    trailStart: point([0, 0, -1.2]),
    trailEnd: point([0, 0, 1.2]),
    impactPoint: point([0, 0, 1.2]),
  }
  const asset = createStudioPropAsset({
    id: 'explicit-rig',
    nameZh: '显式 Rig',
    nameEn: 'Explicit Rig',
    kind: 'composite',
    defaultAnchor: 'right-front-paw',
    components: [body],
    anchors: createDefaultPropAnchors(),
    extensions: { 'yk-pets/prop-rig/v1': explicitRig },
    createdAt: 1,
    updatedAt: 1,
  })

  const explicit = deriveRig(asset)
  assert.equal(explicit.status, 'ready')
  assert.deepEqual(explicit.value.trailStart?.position, [0, 0, -1.2])
  assert.deepEqual(explicit.value.trailEnd?.position, [0, 0, 1.2])

  const throwingExtensions = new Proxy({}, {
    get() {
      throw new Error('扩展不可读')
    },
  })
  const damaged = { ...asset, extensions: throwingExtensions }
  assert.doesNotThrow(() => deriveRig(damaged))
  const fallback = deriveRig(damaged)
  assert.equal(fallback.status, 'derived')
  assert.ok(fallback.value.trailStart!.position[0] < fallback.value.trailEnd!.position[0])
  assert.ok(fallback.diagnostics.some(item => item.id.includes('extension-access-failed')))
})

test('旋转后的参数化圆柱按资产局部真实主轴推导', () => {
  const cylinder = createDefaultPropComponent('shaft', 'cylinder')
  cylinder.transform.rotation = [0, 0, Math.PI / 2]
  cylinder.transform.scale = [.12, 2.2, .12]
  cylinder.geometry = { ...cylinder.geometry, radius: .12, height: 1.2 }
  const asset = createStudioPropAsset({
    id: 'rotated-staff',
    nameZh: '旋转长棍',
    nameEn: 'Rotated Staff',
    components: [cylinder],
    createdAt: 1,
    updatedAt: 1,
  })

  const result = deriveRig(asset)
  assert.equal(result.status, 'derived')
  const start = result.value.trailStart!.position
  const end = result.value.trailEnd!.position
  assert.ok(Math.abs(end[0] - start[0]) > Math.abs(end[1] - start[1]) * 10)
})

test('球体、隐藏长轴和 localModel 不会伪造可用副握点', () => {
  const sphere = createDefaultPropComponent('sphere', 'sphere')
  sphere.geometry = { ...sphere.geometry, radius: 1 }
  const hidden = createDefaultPropComponent('hidden-long', 'box')
  hidden.visible = false
  hidden.transform.scale = [20, 1, 1]
  const asset = createStudioPropAsset({
    id: 'round-prop',
    nameZh: '圆形道具',
    nameEn: 'Round Prop',
    components: [sphere, hidden],
    createdAt: 1,
    updatedAt: 1,
  })
  Object.defineProperty(asset, 'localModel', {
    configurable: true,
    get() {
      throw new Error('不应读取外部模型')
    },
  })

  assert.doesNotThrow(() => deriveRig(asset))
  const result = deriveRig(asset)
  assert.equal(result.status, 'primary-only')
  assert.equal(result.value.secondaryGrip, undefined)
  assert.equal(result.value.trailStart, undefined)
})

test('零 Quaternion、非有限变换与异常 Proxy 只会安全降级', () => {
  const zeroQuaternion = normalizeRig({
    primaryGrip: point([0, 0, 0], [0, 0, 0, 0]),
    secondaryGrip: point([-.4, 0, 0]),
    trailStart: point([-1, 0, 0]),
    trailEnd: point([1, 0, 0]),
    impactPoint: point([1, 0, 0]),
  })
  assert.equal(zeroQuaternion.status, 'ready')
  assert.deepEqual(zeroQuaternion.value.primaryGrip.rotation, [0, 0, 0, 1])
  assert.ok(zeroQuaternion.diagnostics.some(item => item.id.includes('rotation-degenerate')))

  const nonFinite = normalizeRig({ primaryGrip: point([Number.NaN, 0, 0]) })
  assert.equal(nonFinite.status, 'primary-only')
  assert.deepEqual(nonFinite.value.primaryGrip.position, [0, 0, 0])

  const throwing = new Proxy({}, {
    get() {
      throw new Error('Rig getter 不可读')
    },
  })
  assert.doesNotThrow(() => normalizeRig(throwing))
  assert.equal(normalizeRig(throwing).status, 'primary-only')
})

test('损坏显式主握点回退资产 grip 而不是覆盖为原点', () => {
  const body = createDefaultPropComponent('body', 'box')
  body.transform.scale = [4, 1, 1]
  const anchors = createDefaultPropAnchors()
  anchors.find(anchor => anchor.id === 'grip')!.transform.position = [.36, .12, 0]
  const asset = createStudioPropAsset({
    id: 'damaged-primary-grip',
    nameZh: '损坏主握点',
    nameEn: 'Damaged Primary Grip',
    components: [body],
    anchors,
    extensions: {
      'yk-pets/prop-rig/v1': {
        primaryGrip: point([Number.NaN, 0, 0]),
        secondaryGrip: point([-.4, 0, 0]),
        trailStart: point([-1, 0, 0]),
        trailEnd: point([1, 0, 0]),
        impactPoint: point([1, 0, 0]),
      },
    },
    createdAt: 1,
    updatedAt: 1,
  })

  const result = deriveRig(asset)
  assert.equal(result.status, 'derived')
  assert.deepEqual(result.value.primaryGrip.position, [.36, .12, 0])
})
