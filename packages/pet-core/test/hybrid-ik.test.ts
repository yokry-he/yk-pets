/**
 * 文件职责 / File responsibility
 * 验证混合 IK 的框架无关数值求解器在正常与退化输入下保持稳定。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { solveAnalyticTwoBoneIk } from '../src/index.ts'

const distance = (left: readonly number[], right: readonly number[]) => Math.hypot(
  left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!,
)

test('解析式两段 IK 到达目标并保持段长', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [.7, -1.4, .2], pole: [0, 0, 1], maxStretchRatio: 1,
  })
  assert.equal(result.status, 'solved')
  assert.ok(distance(result.tip, [.7, -1.4, .2]) < 1e-6)
  assert.ok(Math.abs(distance(result.root, result.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(result.mid, result.tip) - 1) < 1e-8)
})

test('解析式两段 IK 钳制不可达目标且不产生非有限值', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [50, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })
  assert.equal(result.status, 'clamped')
  assert.ok(result.positions.flat().every(Number.isFinite))
  assert.ok(distance(result.root, result.tip) <= 2 + 1e-8)
})

test('解析式两段 IK 对零长度或非有限输入安全阻塞', () => {
  const zeroLength = solveAnalyticTwoBoneIk({ root: [0, 0, 0], mid: [0, 0, 0], tip: [0, 0, 0], target: [1, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1 })
  const nonFinite = solveAnalyticTwoBoneIk({ root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0], target: [NaN, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1 })

  assert.equal(zeroLength.status, 'blocked')
  assert.equal(nonFinite.status, 'blocked')
  assert.ok([...zeroLength.positions.flat(), zeroLength.error].every(Number.isFinite))
  assert.ok([...nonFinite.positions.flat(), nonFinite.error].every(Number.isFinite))
})

test('解析式两段 IK 钳制过近目标并为共线或零 Pole 选择稳定弯曲面', () => {
  const input = {
    root: [0, 0, 0] as const,
    mid: [0, -2, 0] as const,
    tip: [0, -3, 0] as const,
    target: [0, 0, 0] as const,
    pole: [0, 0, 0] as const,
    maxStretchRatio: 1,
  }
  const first = solveAnalyticTwoBoneIk(input)
  const second = solveAnalyticTwoBoneIk(input)

  assert.equal(first.status, 'clamped')
  assert.deepEqual(first, second)
  assert.ok(first.positions.flat().every(Number.isFinite))
  assert.ok(Math.abs(distance(first.root, first.mid) - 2) < 1e-8)
  assert.ok(Math.abs(distance(first.mid, first.tip) - 1) < 1e-8)
  assert.ok(distance(first.root, first.tip) >= 1)

  const collinearPole = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [0, -1.5, 0], pole: [0, -4, 0], maxStretchRatio: 1,
  })
  assert.equal(collinearPole.status, 'solved')
  assert.ok(collinearPole.positions.flat().every(Number.isFinite))
  assert.ok(Math.abs(distance(collinearPole.root, collinearPole.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(collinearPole.mid, collinearPole.tip) - 1) < 1e-8)
})

test('解析式两段 IK 阻塞非法伸展比例和会溢出的有限输入', () => {
  const base = { root: [0, 0, 0] as const, mid: [0, -1, 0] as const, tip: [0, -2, 0] as const, target: [1, 0, 0] as const, pole: [0, 0, 1] as const }
  for (const maxStretchRatio of [0, -1, 1.01, Number.NaN]) {
    const result = solveAnalyticTwoBoneIk({ ...base, maxStretchRatio })
    assert.equal(result.status, 'blocked')
    assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
  }

  const overflow = solveAnalyticTwoBoneIk({
    root: [Number.MAX_VALUE, 0, 0], mid: [-Number.MAX_VALUE, 0, 0], tip: [0, 1, 0],
    target: [0, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })
  assert.equal(overflow.status, 'blocked')
  assert.ok([...overflow.positions.flat(), overflow.error].every(Number.isFinite))

  const poleOverflow = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [1, 1, 1], pole: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], maxStretchRatio: 1,
  })
  assert.equal(poleOverflow.status, 'blocked')
  assert.ok([...poleOverflow.positions.flat(), poleOverflow.error].every(Number.isFinite))
})

test('解析式两段 IK 在最小距离余量超过物理链长时安全阻塞', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [1, 0, 0], tip: [1.0000001, 0, 0],
    target: [0, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'blocked')
  assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
})

test('解析式两段 IK 不突变输入', () => {
  const input = {
    root: [0, 0, 0] as [number, number, number],
    mid: [0, -1, 0] as [number, number, number],
    tip: [0, -2, 0] as [number, number, number],
    target: [.2, -1.6, .3] as [number, number, number],
    pole: [0, 0, 1] as [number, number, number],
    maxStretchRatio: 1,
  }
  const snapshot = structuredClone(input)

  solveAnalyticTwoBoneIk(input)

  assert.deepEqual(input, snapshot)
})
