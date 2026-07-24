/*
 * 文件职责 / File responsibility
 * 数值验证肚皮逐顶点贴合六种身体表面、眼睛位于六种头型外侧，并锁定特殊眼睛的最小可见尺寸。
 * Numerically verifies belly vertices against six body surfaces, eyes outside six head shells, and minimum visible sizes for special eye styles.
 */
import assert from 'node:assert/strict'
import { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_HEAD_SHAPES } from '../apps/playground/app/domain/cloud-fox-appearance'
import { CLOUD_FOX_BELLY_SURFACE_OFFSET, createCloudFoxBellySurfaceMesh, resolveCloudFoxEyeSurfaceAnchor, sampleCloudFoxBodyFrontSurface } from '../apps/playground/app/domain/cloud-fox-surface-model'
import { CLOUD_FOX_EYE_STYLE_METRICS } from '../apps/playground/app/domain/cloud-fox-eye-metrics'

const length = (vector: readonly number[]) => Math.hypot(vector[0] || 0, vector[1] || 0, vector[2] || 0)
const dot = (a: readonly number[], b: readonly number[]) => (a[0] || 0) * (b[0] || 0) + (a[1] || 0) * (b[1] || 0) + (a[2] || 0) * (b[2] || 0)

for (const option of CLOUD_FOX_BODY_SHAPES) {
  const input = { shape: option.id, bodyWidth: 1, bodyHeight: 1, bodyDepth: 1 }
  const mesh = createCloudFoxBellySurfaceMesh(input, { width: 1, height: 1, offsetX: 0, offsetY: 0, rotation: 0 }, 12, 16)
  const vertexCount = mesh.positions.length / 3
  assert.equal(mesh.normals.length / 3, vertexCount, `${option.id}: normal count`)
  assert.equal(mesh.bodyCoordinates.length / 2, vertexCount, `${option.id}: surface coordinate count`)
  assert.ok(vertexCount > 100, `${option.id}: sufficient surface tessellation`)

  let minimumZ = Number.POSITIVE_INFINITY
  let maximumOffsetError = 0
  for (let index = 0; index < vertexCount; index += 1) {
    const position = mesh.positions.slice(index * 3, index * 3 + 3)
    const normal = mesh.normals.slice(index * 3, index * 3 + 3)
    const u = mesh.bodyCoordinates[index * 2]!
    const v = mesh.bodyCoordinates[index * 2 + 1]!
    const surface = sampleCloudFoxBodyFrontSurface(input, u, v)
    const displacement = position.map((value, axis) => value - surface.position[axis]!)
    const offset = dot(displacement, surface.normal)
    maximumOffsetError = Math.max(maximumOffsetError, Math.abs(offset - CLOUD_FOX_BELLY_SURFACE_OFFSET))
    minimumZ = Math.min(minimumZ, position[2]!)
    assert.ok(Math.abs(length(normal) - 1) < .002, `${option.id}: unit surface normal`)
    assert.ok(surface.normal[2] > .25, `${option.id}: front-facing normal`)
  }
  assert.ok(maximumOffsetError < .0005, `${option.id}: decal follows the sampled surface`)
  assert.ok(minimumZ > .25, `${option.id}: belly remains on the front half of the torso`)
}

for (const option of CLOUD_FOX_HEAD_SHAPES) {
  const left = resolveCloudFoxEyeSurfaceAnchor({ shape: option.id, headScale: 1, eyeSpacing: 1 }, -1)
  const right = resolveCloudFoxEyeSurfaceAnchor({ shape: option.id, headScale: 1, eyeSpacing: 1 }, 1)
  assert.ok(left.position[2] > left.normal[2] * .02, `${option.id}: left eye is outside the head shell`)
  assert.ok(right.position[2] > right.normal[2] * .02, `${option.id}: right eye is outside the head shell`)
  assert.ok(left.normal[2] > .7 && right.normal[2] > .7, `${option.id}: eyes face the camera`)
  assert.ok(right.position[0] - left.position[0] > .38, `${option.id}: eye separation remains visible`)
}

const round = CLOUD_FOX_EYE_STYLE_METRICS.round!
const spark = CLOUD_FOX_EYE_STYLE_METRICS.spark!
const diamond = CLOUD_FOX_EYE_STYLE_METRICS.diamond!
const sleepy = CLOUD_FOX_EYE_STYLE_METRICS.sleepy!
assert.ok(spark.width >= round.width * 1.2 && spark.height >= round.height * 1.5, 'spark eye is not allowed to collapse into a tiny point')
assert.ok(diamond.height > round.height * 1.5, 'diamond eye remains vertically distinct')
assert.ok(sleepy.width >= round.width, 'sleepy eye keeps a readable curve length')
assert.ok(spark.blinkFloor >= .4 && diamond.blinkFloor >= .3 && sleepy.blinkFloor === 1, 'special eye blink floors preserve visibility')

console.log(`Cloud Fox surface model passed: ${CLOUD_FOX_BODY_SHAPES.length} bodies, ${CLOUD_FOX_HEAD_SHAPES.length} heads, visible special eyes.`)
