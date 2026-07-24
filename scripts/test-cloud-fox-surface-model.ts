/*
 * 文件职责 / File responsibility
 * 数值验证肚皮逐顶点贴合六种身体表面、眼睛位于六种头型外侧，并锁定固定生产相机下的最小屏幕可见尺寸。
 * Numerically verifies belly vertices against six body surfaces, eyes outside six head shells, and minimum screen-visible sizes under the fixed production camera.
 */
import assert from 'node:assert/strict'
import { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_HEAD_SHAPES } from '../apps/playground/app/domain/cloud-fox-appearance'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '../apps/playground/app/domain/chrome-extension-cloud-fox-profile'
import { CLOUD_FOX_EYE_STYLE_METRICS } from '../apps/playground/app/domain/cloud-fox-eye-metrics'
import { getCloudFoxHeadProfile } from '../apps/playground/app/domain/cloud-fox-shape-profile'
import {
  CLOUD_FOX_BELLY_SURFACE_OFFSET,
  createCloudFoxBellySurfaceMesh,
  resolveCloudFoxEyeSurfaceAnchor,
  sampleCloudFoxBodyFrontSurface,
  sampleCloudFoxHeadFrontSurfaceAtLocalXY,
} from '../apps/playground/app/domain/cloud-fox-surface-model'

const length = (vector: readonly number[]) => Math.hypot(vector[0] || 0, vector[1] || 0, vector[2] || 0)
const dot = (a: readonly number[], b: readonly number[]) => (a[0] || 0) * (b[0] || 0) + (a[1] || 0) * (b[1] || 0) + (a[2] || 0) * (b[2] || 0)
const camera = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.scene.camera
const headModel = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.model.head
const viewportHeight = 720
const viewportWidth = 960
const focalPixels = viewportHeight / (2 * Math.tan(camera.normalFov * Math.PI / 360))
const projectedPixels = (worldSize: number, worldZ: number) => worldSize * focalPixels / Math.max(.1, camera.normalPosition[2] - worldZ)

for (const option of CLOUD_FOX_BODY_SHAPES) {
  const input = { shape: option.id, bodyWidth: 1, bodyHeight: 1, bodyDepth: 1 }
  const mesh = createCloudFoxBellySurfaceMesh(input, { width: 1, height: 1, offsetX: 0, offsetY: 0, rotation: 0 }, 12, 16)
  const vertexCount = mesh.positions.length / 3
  assert.equal(mesh.normals.length / 3, vertexCount, `${option.id}: normal count`)
  assert.equal(mesh.bodyCoordinates.length / 2, vertexCount, `${option.id}: surface coordinate count`)
  assert.ok(vertexCount > 100, `${option.id}: sufficient surface tessellation`)

  let minimumX = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  let minimumZ = Number.POSITIVE_INFINITY
  let maximumZ = Number.NEGATIVE_INFINITY
  let minimumNormalZ = Number.POSITIVE_INFINITY
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
    minimumX = Math.min(minimumX, position[0]!)
    maximumX = Math.max(maximumX, position[0]!)
    minimumY = Math.min(minimumY, position[1]!)
    maximumY = Math.max(maximumY, position[1]!)
    minimumZ = Math.min(minimumZ, position[2]!)
    maximumZ = Math.max(maximumZ, position[2]!)
    minimumNormalZ = Math.min(minimumNormalZ, surface.normal[2])
    assert.ok(Math.abs(length(normal) - 1) < .002, `${option.id}: unit surface normal`)
    assert.ok(surface.normal[2] > .25, `${option.id}: front-facing normal`)
  }
  const averageZ = (minimumZ + maximumZ) / 2
  const projectedWidth = projectedPixels(maximumX - minimumX, averageZ)
  const projectedHeight = projectedPixels(maximumY - minimumY, averageZ)
  const depthVariation = maximumZ - minimumZ
  assert.ok(maximumOffsetError < .0005, `${option.id}: decal follows the sampled surface`)
  assert.ok(minimumZ > .25, `${option.id}: belly remains on the front half of the torso`)
  assert.ok(projectedWidth > 70 && projectedWidth < viewportWidth * .46, `${option.id}: belly width remains visible without covering the torso`)
  assert.ok(projectedHeight > 105 && projectedHeight < viewportHeight * .56, `${option.id}: belly height remains visible without reaching neck and feet`)
  if (option.id === 'rounded-cube') {
    assert.ok(depthVariation < .02 && minimumNormalZ > .94, 'rounded-cube: belly stays flush with the intentionally flat front panel')
  }
  else {
    assert.ok(depthVariation > .035, `${option.id}: side view is curved rather than a floating flat panel`)
  }
}

for (const option of CLOUD_FOX_HEAD_SHAPES) {
  const profile = getCloudFoxHeadProfile(option.id)
  for (const side of [-1, 1] as const) {
    const localX = side * headModel.eyeOffset[0] * profile.eyeX
    const localY = headModel.eyeOffset[1] + profile.eyeY
    const surface = sampleCloudFoxHeadFrontSurfaceAtLocalXY({ shape: option.id, headScale: 1 }, localX, localY)
    const anchor = resolveCloudFoxEyeSurfaceAnchor({ shape: option.id, headScale: 1, eyeSpacing: 1 }, side)
    const displacement = anchor.position.map((value, axis) => value - surface.position[axis]!)
    const offset = dot(displacement, surface.normal)
    assert.ok(Math.abs(offset - .032) < .0005, `${option.id}: eye keeps the shared surface offset`)
    assert.ok(anchor.position[2] - surface.position[2] > .02, `${option.id}: eye stays outside its own head surface`)
    assert.ok(surface.normal[2] > .7, `${option.id}: eye faces the camera`)
  }
  const left = resolveCloudFoxEyeSurfaceAnchor({ shape: option.id, headScale: 1, eyeSpacing: 1 }, -1)
  const right = resolveCloudFoxEyeSurfaceAnchor({ shape: option.id, headScale: 1, eyeSpacing: 1 }, 1)
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

for (const [style, metric] of Object.entries(CLOUD_FOX_EYE_STYLE_METRICS)) {
  const widthPixels = projectedPixels(metric.width, 1)
  const heightPixels = projectedPixels(metric.height, 1)
  assert.ok(widthPixels >= 18, `${style}: projected width remains visible at production camera distance`)
  assert.ok(heightPixels >= (style === 'sleepy' ? 8 : 14), `${style}: projected height remains visible at production camera distance`)
}

console.log(`Cloud Fox surface projection passed: ${CLOUD_FOX_BODY_SHAPES.length} bodies, ${CLOUD_FOX_HEAD_SHAPES.length} heads, ${Object.keys(CLOUD_FOX_EYE_STYLE_METRICS).length} eye styles.`)
