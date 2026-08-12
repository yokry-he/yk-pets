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

function pose(editor: ReturnType<typeof createEditor>) {
  return editor.selectedSimpleStage?.pose || {}
}

test('已有 redo 时零位移提交完整保留 undo 与 redo', () => {
  const editor = createEditor()
  editor.selectBodyPart('front-paw-left')
  editor.symmetryEnabled = true
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

test('参数手势按显式正负规则写入对称部位且只提交一次撤销', () => {
  const editor = createEditor()
  const baseline = JSON.stringify(editor.draft)
  editor.selectBodyPart('front-paw-left')
  editor.symmetryEnabled = true

  assert.equal(editor.beginControlGesture(), true)
  editor.previewControlGesture([
    { controlId: 'front-paw-left.rotate.x', delta: .3 },
    { controlId: 'front-paw-left.rotate.z', delta: -.6 },
  ])
  assert.equal(pose(editor)['front-paw-left.rotate.x'], .3)
  assert.equal(pose(editor)['front-paw-right.rotate.x'], .3)
  assert.equal(pose(editor)['front-paw-left.rotate.z'], -.6)
  assert.equal(pose(editor)['front-paw-right.rotate.z'], .6)
  editor.endControlGesture()

  assert.deepEqual(editor.undoStack, [baseline])
})

test('参数手势关闭对称或选择无伙伴部位时只修改当前部位', () => {
  const disabled = createEditor()
  disabled.selectBodyPart('front-paw-left')
  disabled.symmetryEnabled = false
  assert.equal(disabled.beginControlGesture(), true)
  disabled.previewControlGesture([{ controlId: 'front-paw-left.rotate.z', delta: -.4 }])
  disabled.endControlGesture()
  assert.equal(pose(disabled)['front-paw-left.rotate.z'], -.4)
  assert.equal(pose(disabled)['front-paw-right.rotate.z'], undefined)

  const noPartner = createEditor()
  noPartner.selectBodyPart('body')
  noPartner.symmetryEnabled = true
  assert.equal(noPartner.beginControlGesture(), true)
  noPartner.previewControlGesture([{ controlId: 'body.rotate.x', delta: .2 }])
  noPartner.endControlGesture()
  assert.equal(pose(noPartner)['body.rotate.x'], .2)
  assert.deepEqual(Object.keys(pose(noPartner)).filter(id => id !== 'body.rotate.x'), [])
})

test('3D 拖拽开启对称后同步伙伴并维持单次撤销', () => {
  const editor = createEditor()
  const baseline = JSON.stringify(editor.draft)
  editor.selectBodyPart('front-paw-left')
  editor.symmetryEnabled = true

  assert.equal(editor.beginDirectManipulation(8, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(8, 160, 100, viewport), true)
  const left = pose(editor)['front-paw-left.rotate.z']
  const right = pose(editor)['front-paw-right.rotate.z']
  assert.ok(typeof left === 'number' && left > 0)
  assert.equal(right, -left)
  assert.equal(editor.commitDirectManipulation(8), true)
  assert.deepEqual(editor.undoStack, [baseline])
})

test('对称预览取消恢复双侧姿势且不改写历史', () => {
  const editor = createEditor()
  const baseline = JSON.stringify(editor.draft)
  editor.selectBodyPart('front-paw-left')
  editor.symmetryEnabled = true
  editor.undoStack = ['existing-undo']
  editor.redoStack = ['existing-redo']

  assert.equal(editor.beginDirectManipulation(9, 100, 100), true)
  assert.equal(editor.previewDirectManipulation(9, 160, 100, viewport), true)
  assert.notEqual(pose(editor)['front-paw-right.rotate.z'], undefined)
  assert.equal(editor.cancelDirectManipulation(), true)

  assert.equal(JSON.stringify(editor.draft), baseline)
  assert.deepEqual(editor.undoStack, ['existing-undo'])
  assert.deepEqual(editor.redoStack, ['existing-redo'])
})
