/**
 * 文件职责 / File responsibility
 * 使用假时钟验证动作直接操控预览不会持久化，只有提交后才延迟保存，取消不会保存。
 * Uses a fake clock to verify direct previews never persist, commits save after the delay, and cancellations do not save.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createStudioMotionAutoSaveController } from '../apps/playground/app/utils/studio-motion-auto-save'

class FakeClock {
  private now = 0
  private sequence = 0
  private tasks = new Map<number, { at: number, callback: () => void }>()

  setTimeout = (callback: () => void, delayMs: number) => {
    const id = ++this.sequence
    this.tasks.set(id, { at: this.now + delayMs, callback })
    return id
  }

  clearTimeout = (id: number) => {
    this.tasks.delete(id)
  }

  advance(milliseconds: number) {
    this.now += milliseconds
    for (const [id, task] of [...this.tasks].sort((left, right) => left[1].at - right[1].at)) {
      if (task.at > this.now) continue
      this.tasks.delete(id)
      task.callback()
    }
  }
}

function setup() {
  const clock = new FakeClock()
  let dirty = true
  let gestureActive = false
  let saves = 0
  const states: string[] = []
  const controller = createStudioMotionAutoSaveController({
    delayMs: 500,
    clock,
    isDirty: () => dirty,
    isGestureActive: () => gestureActive,
    persist: () => { saves += 1; dirty = false; return true },
    setState: state => states.push(state),
  })
  return {
    clock,
    controller,
    get saves() { return saves },
    setDirty(value: boolean) { dirty = value },
    setGestureActive(value: boolean) { gestureActive = value },
    states,
  }
}

test('活动手势预览停顿超过 500ms 也不保存且 flush 不越过边界', () => {
  const fixture = setup()
  fixture.setGestureActive(true)
  fixture.controller.schedule()
  fixture.clock.advance(2_000)
  assert.equal(fixture.saves, 0)
  assert.equal(fixture.controller.flush(), true)
  assert.equal(fixture.saves, 0)
})

test('有效提交结束手势后显式调度并只保存一次', () => {
  const fixture = setup()
  fixture.setGestureActive(true)
  fixture.controller.schedule()
  fixture.setGestureActive(false)
  fixture.controller.settleGesture('committed')
  fixture.clock.advance(499)
  assert.equal(fixture.saves, 0)
  fixture.clock.advance(1)
  assert.equal(fixture.saves, 1)
  assert.deepEqual(fixture.states, ['saving', 'saved'])
})

test('取消手势清理候选任务并且不保存', () => {
  const fixture = setup()
  fixture.setDirty(false)
  fixture.setGestureActive(true)
  fixture.controller.schedule()
  fixture.setGestureActive(false)
  fixture.controller.settleGesture('cancelled')
  fixture.clock.advance(2_000)
  assert.equal(fixture.saves, 0)
  assert.deepEqual(fixture.states, [])
})

test('先有有效修改再进入手势，取消或零变化后仍保存既有脏草稿', () => {
  for (const outcome of ['cancelled', 'committed'] as const) {
    const fixture = setup()
    fixture.controller.schedule()
    fixture.clock.advance(300)
    fixture.setGestureActive(true)
    fixture.controller.schedule()
    fixture.clock.advance(2_000)
    assert.equal(fixture.saves, 0)
    fixture.setGestureActive(false)
    fixture.controller.settleGesture(outcome)
    fixture.clock.advance(500)
    assert.equal(fixture.saves, 1)
  }
})

test('卸载前取消手势后脏草稿可同步 flush，纯净草稿不保存', () => {
  const dirty = setup()
  dirty.setGestureActive(true)
  dirty.controller.schedule()
  dirty.setGestureActive(false)
  dirty.controller.settleGesture('cancelled')
  assert.equal(dirty.controller.flush(), true)
  assert.equal(dirty.saves, 1)

  const clean = setup()
  clean.setDirty(false)
  clean.controller.dispose()
  assert.equal(clean.saves, 0)
})
