/**
 * 文件职责 / File responsibility
 * 验证阶段式动作配方、意图蓝图、边界修复和确定性编译。
 * Verifies staged-motion recipes, intent blueprints, boundary repair, and deterministic compilation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SIMPLE_MOTION_AUTHORING_EXTENSION_KEY,
  SIMPLE_MOTION_INTENTS,
  createSimpleMotionRecipe,
  normalizeSimpleMotionRecipe,
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

test('超额阶段和总时长都会收敛到固定预算', () => {
  const stages = Array.from({ length: 24 }, (_, index) => ({ id: `stage-${index}`, durationMs: 10000 }))
  const result = normalizeSimpleMotionRecipe({ intent: 'sports', stages })
  assert.equal(result.value.stages.length, 16)
  assert.ok(result.value.stages.reduce((sum, stage) => sum + stage.durationMs, 0) <= 60000)
})

test('扩展命名空保持稳定', () => {
  assert.equal(SIMPLE_MOTION_AUTHORING_EXTENSION_KEY, 'yk-pets/simple-motion-authoring/v1')
})
