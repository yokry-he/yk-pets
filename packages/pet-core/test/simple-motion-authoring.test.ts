/**
 * 文件职责 / File responsibility
 * 验证阶段式动作配方、意图蓝图、边界修复和确定性编译。
 * Verifies staged-motion recipes, intent blueprints, boundary repair, and deterministic compilation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SIMPLE_MOTION_AUTHORING_EXTENSION_KEY,
  SIMPLE_MOTION_CORRECTION_LAYER_ID,
  SIMPLE_MOTION_INTENTS,
  compileSimpleMotionRecipe,
  createStudioMotionAsset,
  createSimpleMotionRecipe,
  getCloudFoxRigChannel,
  normalizeSimpleMotionRecipe,
  readSimpleMotionRecipe,
} from '../src/index.ts'

test('五类意图都会生成可编译的阶段配方', () => {
  assert.deepEqual(SIMPLE_MOTION_INTENTS.map(item => item.id), ['daily', 'dance', 'martial-arts', 'sports', 'custom'])
  for (const intent of SIMPLE_MOTION_INTENTS.map(item => item.id)) {
    const recipe = createSimpleMotionRecipe(intent)
    assert.equal(recipe.schemaVersion, 1)
    assert.equal(recipe.compilerVersion, 1)
    assert.equal(recipe.intent, intent)
    assert.ok(recipe.stages.length >= 2 && recipe.stages.length <= 16)
    assert.equal(new Set(recipe.stages.map(stage => stage.id)).size, recipe.stages.length)
    assert.ok(recipe.stages.every(stage => stage.durationMs >= 100 && stage.durationMs <= 10000))
  }
})

test('损坏配方会被修复且不突变输入', () => {
  const input = {
    intent: 'dance',
    stages: [
      { id: 'same', durationMs: -1, pose: { 'head.rotate.x': Infinity, unknown: 2 } },
      { id: 'same', durationMs: Number.NaN },
    ],
  }
  const snapshot = structuredClone(input)
  const result = normalizeSimpleMotionRecipe(input)
  assert.deepEqual(input, snapshot)
  assert.ok(result.value.stages.every(stage => stage.durationMs >= 100 && stage.durationMs <= 10000))
  assert.equal(new Set(result.value.stages.map(stage => stage.id)).size, result.value.stages.length)
  assert.equal(Object.hasOwn(result.value.stages[0]?.pose || {}, 'unknown'), false)
  assert.equal(Object.hasOwn(result.value.stages[0]?.pose || {}, 'head.rotate.x'), false)
  assert.ok(result.diagnostics.length > 0)
})

test('阶段力度先规范化再收紧已有姿势且保持幂等稀疏', () => {
  const channel = getCloudFoxRigChannel('frontPaw.left.rotation.z')
  const input = createSimpleMotionRecipe('custom')
  input.stages[0] = {
    ...input.stages[0]!,
    intensity: 1.5,
    pose: {
      'front-paw-left.rotate.z': channel.minimum,
      'front-paw-right.rotate.z': channel.maximum,
    },
  }
  const strong = normalizeSimpleMotionRecipe(input).value
  const strongStage = strong.stages[0]!

  assert.equal(strongStage.pose['front-paw-left.rotate.z'], channel.minimum / 1.5)
  assert.equal(strongStage.pose['front-paw-right.rotate.z'], channel.maximum / 1.5)
  assert.equal(Object.hasOwn(strongStage.pose, 'head.rotate.x'), false, '不得把缺失控制物化为 0')
  assert.deepEqual(normalizeSimpleMotionRecipe(strong).value, strong, '重复规范化必须幂等')

  const soft = normalizeSimpleMotionRecipe({
    ...strong,
    stages: strong.stages.map((stage, index) => index === 0 ? { ...stage, intensity: .5 } : stage),
  }).value.stages[0]!
  assert.equal(soft.pose['front-paw-left.rotate.z'], channel.minimum / 1.5, '降低力度不能反向放大旧姿势')
})

test('零力度规范化保留安全姿势以支持恢复且不物化缺失控制', () => {
  const recipe = createSimpleMotionRecipe('custom')
  recipe.stages[0] = {
    ...recipe.stages[0]!,
    intensity: 0,
    pose: { 'head.rotate.x': Math.PI, 'front-paw-left.rotate.z': -Math.PI },
  }
  const disabled = normalizeSimpleMotionRecipe(recipe).value
  const stage = disabled.stages[0]!
  assert.equal(stage.pose['head.rotate.x'], Math.PI)
  assert.equal(stage.pose['front-paw-left.rotate.z'], -Math.PI)
  assert.equal(Object.hasOwn(stage.pose, 'body.rotate.x'), false)

  const restored = normalizeSimpleMotionRecipe({
    ...disabled,
    stages: disabled.stages.map((item, index) => index === 0 ? { ...item, intensity: 1 } : item),
  }).value
  assert.equal(restored.stages[0]?.pose['head.rotate.x'], Math.PI)
  assert.equal(restored.stages[0]?.pose['front-paw-left.rotate.z'], -Math.PI)
})

test('旧资产读取会按保存的阶段力度规范已有姿势', () => {
  const recipe = createSimpleMotionRecipe('custom')
  recipe.stages[0] = { ...recipe.stages[0]!, intensity: 1.5, pose: { 'head.rotate.x': Math.PI } }
  const asset = createStudioMotionAsset({
    id: 'legacy-intensity',
    nameZh: '旧动作',
    nameEn: 'Legacy motion',
    extensions: { [SIMPLE_MOTION_AUTHORING_EXTENSION_KEY]: recipe },
  })

  assert.equal(readSimpleMotionRecipe(asset)?.stages[0]?.pose['head.rotate.x'], Math.PI / 1.5)
})

test('超额阶段和总时长都会收敛到固定预算', () => {
  const stages = Array.from({ length: 24 }, (_, index) => ({ id: `stage-${index}`, durationMs: 10000 }))
  const result = normalizeSimpleMotionRecipe({ intent: 'sports', stages })
  assert.equal(result.value.stages.length, 16)
  assert.ok(result.value.stages.reduce((sum, stage) => sum + stage.durationMs, 0) <= 60000)
})

test('扩展命名空保持稳定', () => {
  assert.equal(SIMPLE_MOTION_AUTHORING_EXTENSION_KEY, 'yk-pets/simple-motion-authoring/v1')
})

test('阶段配方确定性编译为正式动作', () => {
  const recipe = createSimpleMotionRecipe('martial-arts')
  const asset = createStudioMotionAsset({ id: 'motion-1', nameZh: '功夫', nameEn: 'Martial Arts', createdAt: 1, updatedAt: 1 })
  const first = compileSimpleMotionRecipe(asset, recipe, { now: 2 })
  const second = compileSimpleMotionRecipe(asset, recipe, { now: 2 })
  assert.deepEqual(first, second)
  assert.ok(first.asset.tracks.some(track => track.layerId === 'base' && track.keyframes.length > 1))
  assert.equal(first.asset.extensions?.[SIMPLE_MOTION_AUTHORING_EXTENSION_KEY] !== undefined, true)
  assert.equal(first.stages.length, recipe.stages.length)
  assert.equal(first.stages.at(-1)?.endMs, first.asset.durationMs)
  assert.ok(first.asset.tracks.flatMap(track => track.keyframes).every(keyframe => keyframe.id.startsWith('simple-')))
})

test('重新编译保留用户修正层', () => {
  const source = createStudioMotionAsset({
    id: 'motion-2',
    nameZh: '舞蹈',
    nameEn: 'Dance',
    createdAt: 1,
    updatedAt: 1,
    layers: [
      { id: 'base', name: 'Base', mode: 'override', weight: 1, enabled: true, priority: 0 },
      { id: SIMPLE_MOTION_CORRECTION_LAYER_ID, name: '手动修正', mode: 'additive', weight: 1, enabled: true, priority: 1 },
    ],
    tracks: [{
      id: 'manual-head',
      channelId: 'head.rotation.z',
      layerId: SIMPLE_MOTION_CORRECTION_LAYER_ID,
      muted: false,
      keyframes: [{ id: 'manual-key', timeMs: 100, value: .2, interpolation: 'smooth' }],
    }],
  })
  const compiled = compileSimpleMotionRecipe(source, createSimpleMotionRecipe('dance'), { now: 2 }).asset
  assert.ok(compiled.tracks.some(track => track.keyframes.some(key => key.id === 'manual-key')))
  assert.ok(compiled.layers.some(layer => layer.id === SIMPLE_MOTION_CORRECTION_LAYER_ID && layer.mode === 'additive'))
})

test('运动意图会编译接触、落地特效和弹道 Root Motion', () => {
  const source = createStudioMotionAsset({ id: 'motion-3', nameZh: '运动', nameEn: 'Sports', createdAt: 1, updatedAt: 1 })
  const compiled = compileSimpleMotionRecipe(source, createSimpleMotionRecipe('sports'), { now: 2 }).asset
  const runtime = compiled.extensions?.['yk-pets/biped-motion/v1'] as { contacts?: unknown[]; rootMotion?: { verticalMode?: string; vfxTags?: string[] } }
  assert.ok((runtime.contacts?.length || 0) >= 2)
  assert.equal(runtime.rootMotion?.verticalMode, 'ballistic')
  assert.ok(runtime.rootMotion?.vfxTags?.includes('landing-ring'))
  assert.ok(runtime.rootMotion?.vfxTags?.includes('landing-dust'))
})
