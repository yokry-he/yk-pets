/**
 * 文件职责 / File responsibility
 * 验证混合 IK 的框架无关数值求解器在正常与退化输入下保持稳定。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { solveAnalyticTwoBoneIk, solveConstrainedFabrik } from '../src/index.ts'

const distance = (left: readonly number[], right: readonly number[]) => Math.hypot(
  left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!,
)

test('FABRIK 多段链收敛并保持每段长度', () => {
  const input = [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0]] as const
  const result = solveConstrainedFabrik({
    positions: input,
    target: [1.2, -2.2, .3],
    pole: [0, 0, 1],
    maxIterations: 8,
    tolerance: 1e-4,
    maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.ok(result.error <= 1e-4)
  for (let index = 1; index < result.positions.length; index += 1) {
    assert.ok(Math.abs(distance(result.positions[index - 1]!, result.positions[index]!) - 1) < 1e-6)
  }
})

test('FABRIK 对不可达目标使用有限的最大伸展结果', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]],
    target: [20, 0, 0],
    pole: [0, 0, 1],
    maxIterations: 8,
    tolerance: 1e-4,
    maxStretchRatio: 1,
  })

  assert.equal(result.status, 'clamped')
  assert.ok(result.positions.flat().every(Number.isFinite))
})

test('FABRIK 按伸展比例钳制目标且不伪造段长', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0]],
    target: [10, 0, 0],
    pole: [0, 0, 1],
    maxStretchRatio: .8,
  })

  assert.equal(result.status, 'clamped')
  assert.ok(Math.abs(distance(result.positions[0]!, result.positions.at(-1)!) - 2.4) <= 1e-4)
  for (let index = 1; index < result.positions.length; index += 1) {
    assert.ok(Math.abs(distance(result.positions[index - 1]!, result.positions[index]!) - 1) < 1e-6)
  }
})

test('FABRIK 对接近一的配置伸展上限使用确定性保长解', () => {
  for (const maxStretchRatio of [.95, .99]) {
    const result = solveConstrainedFabrik({
      positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]],
      target: [100, 0, 0], pole: [0, 0, 1], maxStretchRatio,
    })

    assert.equal(result.status, 'clamped')
    assert.ok(Math.abs(distance(result.positions[0]!, result.positions.at(-1)!) - 2 * maxStretchRatio) <= 1e-4)
    assert.ok(Math.abs(distance(result.positions[0]!, result.positions[1]!) - 1) < 1e-8)
    assert.ok(Math.abs(distance(result.positions[1]!, result.positions[2]!) - 1) < 1e-8)
  }
})

test('FABRIK 为不同段长的配置上限构造确定性保长姿态', () => {
  const input = {
    positions: [[0, 0, 0], [0, -.7, 0], [0, -1.8, 0], [0, -2.7, 0], [0, -3.5, 0]] as const,
    target: [30, 4, -2] as const,
    pole: [0, 0, 5] as const,
    maxStretchRatio: .9,
  }
  const first = solveConstrainedFabrik(input)
  const second = solveConstrainedFabrik(input)

  assert.equal(first.status, 'clamped')
  assert.deepEqual(first, second)
  assert.ok(Math.abs(distance(first.positions[0]!, first.positions.at(-1)!) - 3.5 * .9) <= 1e-4)
  for (let index = 1; index < first.positions.length; index += 1) {
    const expected = distance(input.positions[index - 1]!, input.positions[index]!)
    assert.ok(Math.abs(distance(first.positions[index - 1]!, first.positions[index]!) - expected) <= expected * 1e-8)
  }
})

test('FABRIK 最终所有内部关节点位于 Pole 定义的统一弯曲半平面', () => {
  const target = [1, -2, .5] as const
  const pole = [0, 0, 1] as const
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0], [0, -4, 0]],
    target, pole, maxStretchRatio: 1,
  })
  const targetLength = Math.hypot(...target)
  const axis = target.map(value => value / targetLength)
  const poleAlongAxis = pole[0] * axis[0]! + pole[1] * axis[1]! + pole[2] * axis[2]!
  const projectedPole = pole.map((value, index) => value - axis[index]! * poleAlongAxis)
  const projectedPoleLength = Math.hypot(...projectedPole)
  const bend = projectedPole.map(value => value / projectedPoleLength)
  const planeNormal = [
    axis[1]! * bend[2]! - axis[2]! * bend[1]!,
    axis[2]! * bend[0]! - axis[0]! * bend[2]!,
    axis[0]! * bend[1]! - axis[1]! * bend[0]!,
  ]

  assert.equal(result.status, 'solved')
  assert.ok(result.error <= 1e-4)
  for (const position of result.positions.slice(1, -1)) {
    const signedDistance = position[0] * bend[0]! + position[1] * bend[1]! + position[2] * bend[2]!
    const planeDistance = position[0] * planeNormal[0]! + position[1] * planeNormal[1]! + position[2] * planeNormal[2]!
    assert.ok(Math.abs(planeDistance) <= 1e-8, `内部关节点脱离统一 Pole 平面：${planeDistance}`)
    assert.ok(signedDistance >= -1e-8, `内部关节点越过 Pole 半平面：${signedDistance}`)
  }
  for (let index = 1; index < result.positions.length; index += 1) {
    assert.ok(Math.abs(distance(result.positions[index - 1]!, result.positions[index]!) - 1) < 1e-8)
  }
})

test('FABRIK 对无连续聚合分割的链在迭代后使用一般构造', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [4, 0, 0], [7, 0, 0], [9, 0, 0]],
    target: [.5, 0, 0], pole: [0, 1, 0], maxIterations: 1, tolerance: 1e-12, maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.equal(result.iterations, 1)
  assert.ok(result.error <= 1e-12)
  for (const [index, expected] of [4, 3, 2].entries()) {
    assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - expected) <= expected * 1e-8)
  }
})

test('FABRIK 末端命中但脱离统一 Pole 平面时改用一般平面构造', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [0, 0, 4], [3, 0, 4], [3, 2, 4]],
    target: [.5, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.equal(result.iterations, 3)
  assert.ok(result.error <= 1e-4)
  for (const position of result.positions.slice(1, -1)) {
    assert.ok(Math.abs(position[2]) <= 1e-8)
    assert.ok(position[1] >= -1e-8)
  }
})

test('FABRIK 圆交回溯覆盖中点贪心会误阻塞的内部域', () => {
  const input = {
    positions: [[0, 0, 0], [1, 0, 0], [3, 0, 0], [4, 0, 0]] as const,
    target: [.18, 0, 0] as const,
    pole: [0, 1, 0] as const,
    maxStretchRatio: .9,
    tolerance: 1e-8,
  }
  const first = solveConstrainedFabrik(input)
  const second = solveConstrainedFabrik(input)

  assert.equal(first.status, 'solved')
  assert.deepEqual(first, second)
  assert.ok(first.error <= 1e-8)
  for (const [index, expected] of [1, 2, 1].entries()) {
    assert.ok(Math.abs(distance(first.positions[index]!, first.positions[index + 1]!) - expected) <= expected * 1e-8)
  }
})

test('FABRIK 非整数异长链在物理最小边界稳定构造', () => {
  const lengths = [.6811218742, 4.9246562266, 2.1426970179] as const
  const physicalMinimum = 2 * Math.max(...lengths) - lengths.reduce((sum, item) => sum + item, 0)
  let cursor = 0
  const positions: [number, number, number][] = [[0, 0, 0]]
  for (const segmentLength of lengths) {
    cursor += segmentLength
    positions.push([cursor, 0, 0])
  }
  const result = solveConstrainedFabrik({ positions, target: [.1, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1, tolerance: 1e-8 })

  assert.equal(result.status, 'clamped')
  assert.ok(Math.abs(distance(result.positions[0]!, result.positions.at(-1)!) - physicalMinimum) <= 1e-8)
  for (let index = 0; index < lengths.length; index += 1) {
    assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - lengths[index]!) <= lengths[index]! * 1e-8)
  }
})

test('FABRIK 两段单位链在目标等于根节点时由 Pole 决定折叠方向', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
    target: [0, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.ok(result.error <= 1e-4)
  assert.ok(result.positions[1]![1] > 0)
  assert.ok(Math.abs(result.positions[1]![2]) <= 1e-8)
  assert.ok(Math.abs(distance(result.positions[0]!, result.positions[1]!) - 1) <= 1e-8)
  assert.ok(Math.abs(distance(result.positions[1]!, result.positions[2]!) - 1) <= 1e-8)
})

test('FABRIK 使用 Pole 打破直链同轴收缩奇异', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
    target: [1.5, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.ok(result.error <= 1e-4)
  assert.ok(result.positions[1]![1] >= -1e-8)
  assert.ok(Math.abs(result.positions[1]![2]) <= 1e-8)
  assert.ok(Math.abs(distance(result.positions[0]!, result.positions[1]!) - 1) <= 1e-8)
  assert.ok(Math.abs(distance(result.positions[1]!, result.positions[2]!) - 1) <= 1e-8)
})

test('FABRIK 的一般平面构造覆盖无连续聚合分割的异长链', () => {
  const input = {
    positions: [[0, 0, 0], [.04, 0, 0], [.91, 0, 0], [1, 0, 0]] as const,
    target: [100, 0, 0] as const,
    pole: [0, 1, 0] as const,
    maxStretchRatio: .8,
  }
  const first = solveConstrainedFabrik(input)
  const second = solveConstrainedFabrik(input)

  assert.equal(first.status, 'clamped')
  assert.deepEqual(first, second)
  assert.ok(Math.abs(distance(first.positions[0]!, first.positions.at(-1)!) - .8) <= 1e-4)
  for (let index = 1; index < first.positions.length; index += 1) {
    assert.ok(Math.abs(distance(first.positions[index - 1]!, first.positions[index]!) - distance(input.positions[index - 1]!, input.positions[index]!)) <= 1e-8)
    assert.ok(Math.abs(first.positions[index]![2]) <= 1e-8)
    if (index < first.positions.length - 1) assert.ok(first.positions[index]![1] >= -1e-8)
  }
})

test('FABRIK 把过近目标钳制到链的物理最小可达距离', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [4, 0, 0], [5, 0, 0], [6, 0, 0]],
    target: [1, 0, 0], pole: [0, 1, 0], maxStretchRatio: 1,
  })

  assert.equal(result.status, 'clamped')
  assert.ok(Math.abs(distance(result.positions[0]!, result.positions.at(-1)!) - 2) <= 1e-4)
  assert.ok(Math.abs(result.error - 1) <= 1e-4)
  for (const [index, expected] of [4, 1, 1].entries()) {
    assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - expected) <= expected * 1e-8)
  }
})

test('FABRIK 对稀疏 positions 和显式 null 可选参数安全阻塞', () => {
  const sparse = new Array(3) as [number, number, number][]
  sparse[0] = [0, 0, 0]
  sparse[2] = [0, -2, 0]
  const base = { positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]], target: [1, -1, 0], pole: [0, 0, 1], maxStretchRatio: 1 }

  for (const input of [
    { ...base, positions: sparse },
    { ...base, positions: [[0, 0, 0], new Array(3), [0, -2, 0]] },
    { ...base, maxIterations: null },
    { ...base, tolerance: null },
  ]) {
    const result = solveConstrainedFabrik(input as never)
    assert.equal(result.status, 'blocked')
    assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
  }
})

test('FABRIK 固定种子异长链覆盖三段、四段和五段完整可达域', () => {
  const cases = [
    [.35, .8, .45],
    [.2, .65, .4, .55],
    [.15, .5, .3, .7, .25],
  ] as const
  for (const lengths of cases) {
    let cursor = 0
    const positions: [number, number, number][] = [[0, 0, 0]]
    for (const segmentLength of lengths) {
      cursor += segmentLength
      positions.push([cursor, 0, 0])
    }
    const result = solveConstrainedFabrik({ positions, target: [50, 4, -3], pole: [0, 1, 0], maxStretchRatio: .85 })
    const repeated = solveConstrainedFabrik({ positions, target: [50, 4, -3], pole: [0, 1, 0], maxStretchRatio: .85 })

    assert.equal(result.status, 'clamped')
    assert.deepEqual(result, repeated)
    assert.ok(result.iterations <= 8)
    const tip = result.positions.at(-1)!
    const tipLength = distance(result.positions[0]!, tip)
    const axis = tip.map(value => value / tipLength)
    const poleAlongAxis = axis[1]!
    const bendRaw = [-axis[0]! * poleAlongAxis, 1 - axis[1]! * poleAlongAxis, -axis[2]! * poleAlongAxis]
    const bendLength = Math.hypot(...bendRaw)
    const bend = bendRaw.map(value => value / bendLength)
    const normal = [
      axis[1]! * bend[2]! - axis[2]! * bend[1]!,
      axis[2]! * bend[0]! - axis[0]! * bend[2]!,
      axis[0]! * bend[1]! - axis[1]! * bend[0]!,
    ]
    for (let index = 0; index < lengths.length; index += 1) {
      assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - lengths[index]!) <= lengths[index]! * 1e-8)
      if (index > 0) {
        const position = result.positions[index]!
        assert.ok(Math.abs(position[0] * normal[0]! + position[1] * normal[1]! + position[2] * normal[2]!) <= 1e-8)
        assert.ok(position[0] * bend[0]! + position[1] * bend[1]! + position[2] * bend[2]! >= -1e-8)
      }
    }
  }
})

test('FABRIK 固定种子三至五段链覆盖过近侧内部域搜索', () => {
  const cases = [
    { lengths: [.4, 1.3, .6], distance: .7 },
    { lengths: [.25, 1.1, .45, .8], distance: .32 },
    { lengths: [.3, .9, .2, 1.4, .5], distance: .27 },
  ] as const
  for (const { lengths, distance: targetDistance } of cases) {
    let cursor = 0
    const positions: [number, number, number][] = [[0, 0, 0]]
    for (const segmentLength of lengths) {
      cursor += segmentLength
      positions.push([cursor, 0, 0])
    }
    const input = { positions, target: [targetDistance, 0, 0] as const, pole: [0, 1, 0] as const, maxIterations: 1, tolerance: 1e-10, maxStretchRatio: 1 }
    const result = solveConstrainedFabrik(input)

    assert.equal(result.status, 'solved')
    assert.deepEqual(result, solveConstrainedFabrik(input))
    assert.ok(result.error <= 1e-10)
    for (let index = 0; index < lengths.length; index += 1) {
      assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - lengths[index]!) <= lengths[index]! * 1e-8)
      if (index > 0) {
        assert.ok(Math.abs(result.positions[index]![2]) <= 1e-8)
        assert.ok(result.positions[index]![1] >= -1e-8)
      }
    }
  }
})

test('FABRIK 连续圆半径求解覆盖窄连续可行窗', () => {
  const cases = [
    { lengths: [1, 1, 2, 2], distance: .108, ratio: .9 },
    { lengths: [.7897603758960032, 2.6860888144467028, .5802674175356516, 1.169574050162919], distance: .9114898679977737, ratio: 1 },
    { lengths: [.6098006247193554, 1.1312615046976136, 1.4025073148659433, 2.2846777537371965, 2.0844399266061373], distance: 2.587812901531402, ratio: 1 },
  ] as const
  for (const { lengths, distance: targetDistance, ratio } of cases) {
    let cursor = 0
    const positions: [number, number, number][] = [[0, 0, 0]]
    for (const segmentLength of lengths) {
      cursor += segmentLength
      positions.push([cursor, 0, 0])
    }
    const input = { positions, target: [targetDistance, 0, 0] as const, pole: [0, 1, 0] as const, maxIterations: 1, tolerance: 1e-8, maxStretchRatio: ratio }
    const result = solveConstrainedFabrik(input)

    assert.equal(result.status, 'solved')
    assert.deepEqual(result, solveConstrainedFabrik(input))
    assert.ok(result.error <= 1e-8)
    for (let index = 0; index < lengths.length; index += 1) {
      assert.ok(Math.abs(distance(result.positions[index]!, result.positions[index + 1]!) - lengths[index]!) <= lengths[index]! * 1e-8)
      if (index > 0) {
        assert.ok(Math.abs(result.positions[index]![2]) <= 1e-8)
        assert.ok(result.positions[index]![1] >= -1e-8)
      }
    }
  }
})

test('FABRIK 不突变输入、不共享输出引用并保持确定性', () => {
  const input = {
    positions: [[0, 0, 0], [.2, -1, 0], [.1, -2, 0], [0, -3, 0]] as [number, number, number][],
    target: [1, -2.4, .4] as [number, number, number],
    pole: [0, 0, 1] as [number, number, number],
    maxStretchRatio: 1,
  }
  const snapshot = structuredClone(input)
  const first = solveConstrainedFabrik(input)
  const second = solveConstrainedFabrik(input)

  assert.deepEqual(input, snapshot)
  assert.deepEqual(first, second)
  assert.notEqual(first.positions, input.positions)
  for (let index = 0; index < first.positions.length; index += 1) assert.notEqual(first.positions[index], input.positions[index])
})

test('FABRIK 支持三点和更多段链并受八次迭代上限约束', () => {
  for (const positions of [
    [[0, 0, 0], [0, -1, 0], [0, -2, 0]],
    [[0, 0, 0], [0, -.6, 0], [0, -1.2, 0], [0, -1.8, 0], [0, -2.4, 0], [0, -3, 0]],
  ] as const) {
    const result = solveConstrainedFabrik({ positions, target: [.6, -1.5, .2], pole: [0, 0, 1], maxStretchRatio: 1 })
    assert.equal(result.status, 'solved')
    assert.ok(result.iterations >= 0 && result.iterations <= 8)
    assert.ok(result.error <= 1e-4)
  }
})

test('FABRIK 对 Pole 等比例缩放和共线输入保持有限确定弯曲面', () => {
  const base = {
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0]] as const,
    target: [1, -2.3, .2] as const,
    maxStretchRatio: 1,
  }
  const unit = solveConstrainedFabrik({ ...base, pole: [0, 0, 1] })
  const scaled = solveConstrainedFabrik({ ...base, pole: [0, 0, Number.MAX_VALUE] })
  const collinear = solveConstrainedFabrik({ ...base, pole: [10, -23, 2] })

  assert.equal(unit.status, 'solved')
  assert.equal(scaled.status, 'solved')
  assert.equal(collinear.status, 'solved')
  assert.deepEqual(unit, scaled)
  assert.ok(collinear.positions.flat().every(Number.isFinite))
})

test('FABRIK 安全阻塞零段长、畸形链和非法求解参数', () => {
  const base = {
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]],
    target: [1, -1, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  }
  const malformedPositions = [
    [],
    [[0, 0, 0], [0, -1, 0]],
    [[0, 0, 0], [0, 0, 0], [0, -1, 0]],
    [[0, 0, 0], null, [0, -1, 0]],
    [[0, 0, 0], [0, 'bad', 0], [0, -1, 0]],
  ]
  for (const positions of malformedPositions) {
    const result = solveConstrainedFabrik({ ...base, positions } as never)
    assert.equal(result.status, 'blocked')
    assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
  }
  for (const maxIterations of [0, -1, 9, 1.5, Number.NaN]) {
    assert.equal(solveConstrainedFabrik({ ...base, maxIterations }).status, 'blocked')
  }
  for (const tolerance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(solveConstrainedFabrik({ ...base, tolerance }).status, 'blocked')
  }
  for (const maxStretchRatio of [.79, 1.01, -1, Number.NaN]) {
    assert.equal(solveConstrainedFabrik({ ...base, maxStretchRatio }).status, 'blocked')
  }
})

test('FABRIK 对无效向量和会溢出的有限坐标安全阻塞', () => {
  const base = {
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0]],
    target: [1, -1, 0], pole: [0, 0, 1], maxStretchRatio: 1,
  }
  for (const patch of [
    { target: [NaN, 0, 0] },
    { pole: [0, Number.POSITIVE_INFINITY, 0] },
    { target: [0, 0] },
    { pole: null },
    { positions: [[Number.MAX_VALUE, 0, 0], [-Number.MAX_VALUE, 0, 0], [0, 0, 0]] },
  ]) {
    const result = solveConstrainedFabrik({ ...base, ...patch } as never)
    assert.equal(result.status, 'blocked')
    assert.ok([...result.positions.flat(), result.error].every(Number.isFinite))
  }
})

test('FABRIK 未在指定迭代内收敛时由一般构造补全且保留实际迭代数', () => {
  const result = solveConstrainedFabrik({
    positions: [[0, 0, 0], [0, -1, 0], [0, -2, 0], [0, -3, 0]],
    target: [1.2, -2.2, .3], pole: [0, 0, 1], maxIterations: 1, tolerance: 1e-12, maxStretchRatio: 1,
  })

  assert.equal(result.status, 'solved')
  assert.equal(result.iterations, 1)
  assert.ok(result.error <= 1e-12)
  assert.ok(result.positions.flat().every(Number.isFinite))
  for (let index = 1; index < result.positions.length; index += 1) {
    assert.ok(Math.abs(distance(result.positions[index - 1]!, result.positions[index]!) - 1) < 1e-8)
  }
})

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
