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

const assertStrictSegmentLengths = (
  result: ReturnType<typeof solveAnalyticTwoBoneIk>,
  upperLength: number,
  lowerLength: number,
) => {
  assert.notEqual(result.status, 'blocked')
  assert.ok(Math.abs(distance(result.root, result.mid) - upperLength) / upperLength <= 1e-8)
  assert.ok(Math.abs(distance(result.mid, result.tip) - lowerLength) / lowerLength <= 1e-8)
}

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
})

test('解析式两段 IK 在有限非零链的约束区间为空时安全阻塞', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [100, 0, 0], tip: [101, 0, 0],
    target: [50, 0, 0], pole: [0, 0, 1], maxStretchRatio: 0.8,
  })

  assert.equal(result.status, 'blocked')
  assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
})

test('解析式两段 IK 对闭区间外的微小距离差也标记为 clamped', () => {
  const base = {
    root: [0, 0, 0] as const,
    mid: [1, 0, 0] as const,
    tip: [2, 0, 0] as const,
    pole: [0, 1, 0] as const,
    maxStretchRatio: 1,
  }
  const aboveMaximum = solveAnalyticTwoBoneIk({ ...base, target: [2 + 5e-13, 0, 0] })
  const belowMinimum = solveAnalyticTwoBoneIk({ ...base, target: [1e-6 - 5e-13, 0, 0] })

  assert.equal(aboveMaximum.status, 'clamped')
  assert.equal(belowMinimum.status, 'clamped')
  assert.ok(Math.abs(distance(aboveMaximum.root, aboveMaximum.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(aboveMaximum.mid, aboveMaximum.tip) - 1) < 1e-8)
  assert.ok(Math.abs(distance(belowMinimum.root, belowMinimum.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(belowMinimum.mid, belowMinimum.tip) - 1) < 1e-8)
})

test('解析式两段 IK 把上下边界视为可达闭区间', () => {
  const base = {
    root: [0, 0, 0] as const,
    mid: [1, 0, 0] as const,
    tip: [2, 0, 0] as const,
    pole: [0, 1, 0] as const,
    maxStretchRatio: 1,
  }

  assert.equal(solveAnalyticTwoBoneIk({ ...base, target: [2, 0, 0] }).status, 'solved')
  assert.equal(solveAnalyticTwoBoneIk({ ...base, target: [1e-6, 0, 0] }).status, 'solved')
})

test('解析式两段 IK 稳定接受非整数不等长链的闭区间边界', () => {
  const cases = [
    [382.2746907750368, 351.20629099367557],
    [17.375, 3.8125],
    [9.123456789, 7.987654321],
    [998.9374906214177, 998.1205882428437],
    [1500.123456789, 1499.987654321],
    [45.0000003, 44.9999991],
  ] as const

  for (const [upperLength, lowerLength] of cases) {
    const base = {
      root: [0, 0, 0] as const,
      mid: [upperLength, 0, 0] as const,
      tip: [upperLength + lowerLength, 0, 0] as const,
      pole: [0, 1, 0] as const,
      maxStretchRatio: 1,
    }
    const maximum = solveAnalyticTwoBoneIk({ ...base, target: [upperLength + lowerLength, 0, 0] })
    const minimum = solveAnalyticTwoBoneIk({ ...base, target: [Math.abs(upperLength - lowerLength) + 1e-6, 0, 0] })

    assert.equal(maximum.status, 'solved')
    assert.equal(minimum.status, 'solved')
    assertStrictSegmentLengths(maximum, upperLength, lowerLength)
    assertStrictSegmentLengths(minimum, upperLength, lowerLength)
  }
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

test('解析式两段 IK 对共线 Pole 的等比例缩放保持相同稳定弯曲面', () => {
  const base = {
    root: [0, 0, 0] as const,
    mid: [1, 0, 0] as const,
    tip: [2, 0, 0] as const,
    target: [1, 1, 1] as const,
    maxStretchRatio: 1,
  }
  const unitPole = solveAnalyticTwoBoneIk({ ...base, pole: [1, 1, 1] })
  const scaledPole = solveAnalyticTwoBoneIk({ ...base, pole: [1e6, 1e6, 1e6] })
  const maximumPole = solveAnalyticTwoBoneIk({ ...base, pole: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE] })

  assert.equal(unitPole.status, 'solved')
  assert.equal(scaledPole.status, 'solved')
  assert.equal(maximumPole.status, 'solved')
  assert.ok(distance(unitPole.mid, scaledPole.mid) < 1e-10)
  assert.ok(distance(unitPole.mid, maximumPole.mid) < 1e-10)
  for (const result of [unitPole, scaledPole, maximumPole]) {
    assert.ok(Math.abs(distance(result.root, result.mid) - 1) < 1e-8)
    assert.ok(Math.abs(distance(result.mid, result.tip) - 1) < 1e-8)
  }
})

test('解析式两段 IK 对非轴对齐共线 Pole 使用正交稳定后备', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [2, -3, 5], mid: [3, -3, 5], tip: [4, -3, 5],
    target: [3, -2, 6], pole: [7, 7, 7], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.ok(Math.abs(distance(result.root, result.mid) - 1) < 1e-8)
  assert.ok(Math.abs(distance(result.mid, result.tip) - 1) < 1e-8)
})

test('解析式两段 IK 在一亿比一的合法链上保持短段长度', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [0, 0, 0], mid: [1e8, 0, 0], tip: [1e8 + 1, 0, 0],
    target: [1e8, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.ok(Math.abs(distance(result.root, result.mid) - 1e8) < 1e-6)
  assert.ok(Math.abs(distance(result.mid, result.tip) - 1) < 1e-6)
})

test('解析式两段 IK 在大平移导致段长无法精确保持时阻塞', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [1e16, 0, 0], mid: [1e16, 5, 0], tip: [1e16, 10, 0],
    target: [1e16 + 6, 6, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'blocked')
  assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
})

test('解析式两段 IK 在仍可表达的普通大平移下保持严格段长', () => {
  const result = solveAnalyticTwoBoneIk({
    root: [1e12, 0, 0], mid: [1e12, 1e6, 0], tip: [1e12, 2e6, 0],
    target: [1e12 + 8e5, 1.2e6, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assertStrictSegmentLengths(result, 1e6, 1e6)
})

test('解析式两段 IK 对运行时畸形向量安全阻塞且返回有限 residual', () => {
  const base = {
    root: [0, 0, 0], mid: [0, -1, 0], tip: [0, -2, 0],
    target: [1, 0, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  }
  for (const malformed of [null, [], [0, 0], [0, 0, 0, 0], [0, 'bad', 0]]) {
    const result = solveAnalyticTwoBoneIk({ ...base, root: malformed } as never)
    assert.equal(result.status, 'blocked')
    assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
  }

  const unreachableFallback = solveAnalyticTwoBoneIk({ ...base, mid: [0, 0, 0], tip: [0, 0, 0] })
  const invalidTarget = solveAnalyticTwoBoneIk({ ...base, target: [NaN, 0, 0] })
  assert.equal(unreachableFallback.status, 'blocked')
  assert.equal(unreachableFallback.error, 1)
  assert.equal(invalidTarget.status, 'blocked')
  assert.equal(invalidTarget.error, Number.MAX_VALUE)
})

test('解析式两段 IK 在多种尺度上保持状态和归一化段长', () => {
  for (const scale of [1e-4, 1, 1e4]) {
    const result = solveAnalyticTwoBoneIk({
      root: [0, 0, 0], mid: [scale, 0, 0], tip: [2 * scale, 0, 0],
      target: [1.2 * scale, .4 * scale, .2 * scale], pole: [0, 0, 3 * scale], maxStretchRatio: 1,
    })
    assert.equal(result.status, 'solved')
    assert.ok(Math.abs(distance(result.root, result.mid) - scale) < Math.max(1e-12, scale * 1e-9))
    assert.ok(Math.abs(distance(result.mid, result.tip) - scale) < Math.max(1e-12, scale * 1e-9))
  }
})
