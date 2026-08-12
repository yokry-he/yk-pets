/**
 * 文件职责 / File responsibility
 * 回归验证动作直接操控手势只在有效提交时写入撤销历史，取消与无变化提交完整保留历史。
 * Regresses that direct-manipulation gestures write undo history only on changed commits while cancellation and unchanged commits preserve history.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from '../apps/playground/node_modules/pinia/dist/pinia.js'
import { useStudioMotionEditorStore } from '../apps/playground/app/stores/studio-motion-editor'
import {
  compileSimpleMotionRecipe,
  createSimpleMotionRecipe,
  createStudioMotionAsset,
} from '../packages/pet-core/src/index.ts'

function createEditor() {
  setActivePinia(createPinia())
  const editor = useStudioMotionEditorStore()
  const source = createStudioMotionAsset({
    id: 'direct-motion-history',
    nameZh: '直接操控历史测试',
    nameEn: 'Direct Manipulation History Test',
    createdAt: 1,
    updatedAt: 1,
  })
  editor.open(compileSimpleMotionRecipe(source, createSimpleMotionRecipe('custom'), { now: 2 }).asset)
  return editor
}

const viewport = Object.freeze({ width: 400, height: 300 })

test('已有 redo 时零位移提交完整保留 undo 与 redo', () => {
  const editor = createEditor()
  editor.undoStack = ['existing-undo']
  editor.redoStack = ['existing-redo']

  assert.equal(editor.beginDirectManipulation(1, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(1, 100, 100, viewport), false)
  assert.equal(editor.commitDirectManipulation(1), true)

  assert.deepEqual(editor.undoStack, ['existing-undo'])
  assert.deepEqual(editor.redoStack, ['existing-redo'])
})

test('取消有效预览后恢复草稿并完整保留历史', () => {
  const editor = createEditor()
  const baseline = JSON.stringify(editor.draft)
  editor.undoStack = ['existing-undo']
  editor.redoStack = ['existing-redo']

  assert.equal(editor.beginDirectManipulation(2, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(2, 160, 100, viewport), true)
  assert.equal(editor.cancelDirectManipulation(), true)

  assert.equal(JSON.stringify(editor.draft), baseline)
  assert.deepEqual(editor.undoStack, ['existing-undo'])
  assert.deepEqual(editor.redoStack, ['existing-redo'])
})

test('有效拖拽提交恰好写入一个 baseline undo 并清空 redo', () => {
  const editor = createEditor()
  const baseline = JSON.stringify(editor.draft)
  editor.undoStack = ['existing-undo']
  editor.redoStack = ['existing-redo']

  assert.equal(editor.beginDirectManipulation(3, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(3, 160, 100, viewport), true)
  assert.equal(editor.commitDirectManipulation(3), true)

  assert.deepEqual(editor.undoStack, ['existing-undo', baseline])
  assert.deepEqual(editor.redoStack, [])
})

test('100 条 undo 边界取消不会挤出或删除旧记录', () => {
  const editor = createEditor()
  const undoHistory = Array.from({ length: 100 }, (_, index) => `undo-${index}`)
  const redoHistory = ['existing-redo']
  editor.undoStack = [...undoHistory]
  editor.redoStack = [...redoHistory]

  assert.equal(editor.beginDirectManipulation(4, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(4, 160, 100, viewport), true)
  assert.equal(editor.cancelDirectManipulation(), true)

  assert.deepEqual(editor.undoStack, undoHistory)
  assert.deepEqual(editor.redoStack, redoHistory)
})
