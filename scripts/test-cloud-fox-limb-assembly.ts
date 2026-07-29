/*
 * 文件职责 / File responsibility
 * 数值验证简单模型的肩部连接段与踝脚父子链，防止动作或比例变化再次造成肢体断层。
 * Numerically verifies the simple model shoulder bridge and ankle-foot chain so motion and proportion changes cannot detach limbs again.
 */
import assert from 'node:assert/strict'
import {
  createFrontPawConnectionAssembly,
  createHindPawChainAssembly,
} from '../apps/playground/app/domain/cloud-fox-limb-assembly'

type Vector3Tuple = readonly [number, number, number]

const distance = (a: Vector3Tuple, b: Vector3Tuple) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const addScaled = (origin: Vector3Tuple, direction: Vector3Tuple, scale: number): Vector3Tuple => [
  origin[0] + direction[0] * scale,
  origin[1] + direction[1] * scale,
  origin[2] + direction[2] * scale,
]
const ellipsoidRadius = (point: Vector3Tuple, center: Vector3Tuple, radii: Vector3Tuple) => Math.hypot(
  (point[0] - center[0]) / radii[0],
  (point[1] - center[1]) / radii[1],
  (point[2] - center[2]) / radii[2],
)

const bodyCenter: Vector3Tuple = [0, -.32, 0]
const bodyRadii: Vector3Tuple = [.94, 1.12, .82]
const rightShoulder: Vector3Tuple = [.5, -.04, .82]
const shoulderRadius = .13
const rightConnection = createFrontPawConnectionAssembly({
  bodyCenter,
  bodyRadii,
  shoulderCenter: rightShoulder,
  shoulderRadius,
})

assert.ok(ellipsoidRadius(rightConnection.bodyAnchor, bodyCenter, bodyRadii) < 1, '肩部连接段必须从身体内部起步')
assert.ok(distance(rightConnection.shoulderAnchor, rightShoulder) < shoulderRadius, '肩部连接段必须进入肩球内部')
assert.ok(rightConnection.length > rightConnection.radius, '默认肩部连接段必须具有稳定可见长度')
assert.ok(Math.abs(Math.hypot(...rightConnection.direction) - 1) < 1e-8, '肩部连接方向必须是单位向量')
assert.deepEqual(
  addScaled(rightConnection.center, rightConnection.direction, -rightConnection.length / 2).map(value => Number(value.toFixed(8))),
  rightConnection.bodyAnchor.map(value => Number(value.toFixed(8))),
  '连接段中心与方向必须准确还原身体锚点',
)
assert.deepEqual(
  addScaled(rightConnection.center, rightConnection.direction, rightConnection.length / 2).map(value => Number(value.toFixed(8))),
  rightConnection.shoulderAnchor.map(value => Number(value.toFixed(8))),
  '连接段中心与方向必须准确还原肩部锚点',
)

const leftConnection = createFrontPawConnectionAssembly({
  bodyCenter,
  bodyRadii,
  shoulderCenter: [-rightShoulder[0], rightShoulder[1], rightShoulder[2]],
  shoulderRadius,
})
assert.ok(Math.abs(leftConnection.center[0] + rightConnection.center[0]) < 1e-8, '左右肩部连接必须镜像')
assert.ok(Math.abs(leftConnection.center[1] - rightConnection.center[1]) < 1e-8, '左右肩部连接高度必须一致')
assert.ok(Math.abs(leftConnection.center[2] - rightConnection.center[2]) < 1e-8, '左右肩部连接纵深必须一致')

const shortLeg = createHindPawChainAssembly({
  legLength: .26,
  baseLegLength: .34,
  footBasePosition: [0, -.22, .06],
  heelDrop: .03,
})
const longLeg = createHindPawChainAssembly({
  legLength: .5,
  baseLegLength: .34,
  footBasePosition: [0, -.22, .06],
  heelDrop: .03,
})

for (const chain of [shortLeg, longLeg]) {
  assert.equal(chain.anklePosition[1], chain.legCenter[1] - chain.legLength / 2, '踝节点必须位于腿段末端')
  assert.deepEqual(
    chain.footCenter.map((value, axis) => Number((value - chain.anklePosition[axis]!).toFixed(8))),
    chain.footPositionFromAnkle.map(value => Number(value.toFixed(8))),
    '脚掌必须使用踝节点局部坐标',
  )
  assert.ok(chain.footPositionFromAnkle[1] < 0, '脚掌中心必须下沉并覆盖踝节点')
}
assert.deepEqual(shortLeg.footPositionFromAnkle, longLeg.footPositionFromAnkle, '改变腿长只能移动踝节点，不能破坏脚掌局部连接')
assert.equal(longLeg.anklePosition[1] - shortLeg.anklePosition[1], -.12, '腿长变化必须完整传递到踝脚链')

console.log('Cloud Fox limb assembly passed: mirrored shoulder bridges and ankle-attached feet.')
