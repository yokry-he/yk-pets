/*
 * 文件职责 / File responsibility
 * 为身体、头部与口鼻部提供同一套可测试前表面采样、法线、眼睛/嘴鼻挂点和正面朝向的肚皮网格。
 * Provides one testable front-surface model for torso, head, and muzzle, including normals, eye/face anchors, and correctly wound belly meshes.
 */
import type { CloudFoxBodyShape, CloudFoxHeadShape } from './cloud-fox-appearance'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from './chrome-extension-cloud-fox-profile'
import { getCloudFoxBodyProfile, getCloudFoxHeadProfile } from './cloud-fox-shape-profile'

export type CloudFoxSurfaceVector3 = readonly [number, number, number]
export interface CloudFoxSurfaceSample { position: CloudFoxSurfaceVector3; normal: CloudFoxSurfaceVector3 }
export interface CloudFoxBodySurfaceInput { shape: CloudFoxBodyShape; bodyWidth: number; bodyHeight: number; bodyDepth: number }
export interface CloudFoxHeadSurfaceInput { shape: CloudFoxHeadShape; headScale: number }
export interface CloudFoxBellySurfaceDesign { width: number; height: number; offsetX: number; offsetY: number; rotation: number }
export interface CloudFoxSurfaceMeshData { positions: number[]; normals: number[]; uvs: number[]; indices: number[]; bodyCoordinates: number[] }

const BODY_CAPSULE_PROFILE = [[.06, -1], [.42, -.94], [.7, -.72], [.76, -.46], [.76, .46], [.7, .72], [.42, .94], [.06, 1]] as const
const BODY_PEAR_PROFILE = [[.18, -1], [.62, -.86], [.92, -.52], [1, -.12], [.9, .28], [.66, .68], [.3, .96], [.08, 1.03]] as const
const HEAD_CAPSULE_PROFILE = [[.08, -1], [.42, -.92], [.72, -.68], [.78, -.38], [.78, .38], [.72, .68], [.42, .92], [.08, 1]] as const
const EPSILON = .0025
const BELLY_SURFACE_OFFSET = .014
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
const add = (a: CloudFoxSurfaceVector3, b: CloudFoxSurfaceVector3): CloudFoxSurfaceVector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const subtract = (a: CloudFoxSurfaceVector3, b: CloudFoxSurfaceVector3): CloudFoxSurfaceVector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (value: CloudFoxSurfaceVector3, amount: number): CloudFoxSurfaceVector3 => [value[0] * amount, value[1] * amount, value[2] * amount]
const cross = (a: CloudFoxSurfaceVector3, b: CloudFoxSurfaceVector3): CloudFoxSurfaceVector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (value: CloudFoxSurfaceVector3): CloudFoxSurfaceVector3 => { const length = Math.hypot(...value) || 1; return [value[0] / length, value[1] / length, value[2] / length] }

function interpolateRadius(points: readonly (readonly [number, number])[], y: number) {
  const clampedY = clamp(y, points[0]![1], points.at(-1)![1])
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!; const current = points[index]!
    if (clampedY <= current[1]) { const progress = (clampedY - previous[1]) / Math.max(.0001, current[1] - previous[1]); return previous[0] + (current[0] - previous[0]) * progress }
  }
  return points.at(-1)![0]
}
function ellipsoidPoint(u: number, v: number): CloudFoxSurfaceVector3 {
  const y = clamp(v, -.985, .985); const xLimit = Math.sqrt(Math.max(.0001, 1 - y * y)); const x = clamp(u, -xLimit * .995, xLimit * .995)
  return [x, y, Math.sqrt(Math.max(.0001, 1 - x * x - y * y))]
}
function radialPoint(u: number, v: number, points: readonly (readonly [number, number])[]): CloudFoxSurfaceVector3 {
  const y = clamp(v, points[0]![1] + .002, points.at(-1)![1] - .002); const radius = interpolateRadius(points, y); const x = clamp(u, -radius * .995, radius * .995)
  return [x, y, Math.sqrt(Math.max(.0001, radius * radius - x * x))]
}
function roundedPoint(u: number, v: number, exponent = 7): CloudFoxSurfaceVector3 {
  const y = clamp(v, -.985, .985); const xLimit = Math.pow(Math.max(.0001, 1 - Math.pow(Math.abs(y), exponent)), 1 / exponent); const x = clamp(u, -xLimit * .995, xLimit * .995)
  return [x, y, Math.pow(Math.max(.0001, 1 - Math.pow(Math.abs(x), exponent) - Math.pow(Math.abs(y), exponent)), 1 / exponent)]
}
function bodyBeanPoint(u: number, v: number): CloudFoxSurfaceVector3 {
  const y = clamp(v, -.985, .985); const bend = Math.sin((y + 1) * Math.PI * .7) * .13; const width = 1 - .09 * Math.exp(-Math.pow(y - .18, 2) / .1); const depth = 1 - .025 * Math.abs(y)
  const baseLimit = Math.sqrt(Math.max(.0001, 1 - y * y)); const baseX = clamp((u - bend) / width, -baseLimit * .995, baseLimit * .995)
  return [baseX * width + bend, y, Math.sqrt(Math.max(.0001, 1 - y * y - baseX * baseX)) * depth]
}
function headBeanPoint(u: number, v: number): CloudFoxSurfaceVector3 {
  const y = clamp(v, -.985, .985); const bend = Math.sin((y + 1) * Math.PI * .72) * .09; const width = 1 + .08 * Math.cos(y * Math.PI); const depth = 1 - .025 * Math.abs(y)
  const baseLimit = Math.sqrt(Math.max(.0001, 1 - y * y)); const baseX = clamp((u - bend) / width, -baseLimit * .995, baseLimit * .995)
  return [baseX * width + bend, y * .98, Math.sqrt(Math.max(.0001, 1 - y * y - baseX * baseX)) * depth]
}
function bodyNormalizedPoint(shape: CloudFoxBodyShape, u: number, v: number) {
  if (shape === 'capsule') return radialPoint(u, v, BODY_CAPSULE_PROFILE)
  if (shape === 'pear') return radialPoint(u, v, BODY_PEAR_PROFILE)
  if (shape === 'bean') return bodyBeanPoint(u, v)
  if (shape === 'rounded-cube') return roundedPoint(u, v, 7)
  return ellipsoidPoint(u, v)
}
function headNormalizedPoint(shape: CloudFoxHeadShape, u: number, v: number) {
  if (shape === 'capsule') return radialPoint(u, v, HEAD_CAPSULE_PROFILE)
  if (shape === 'bean') return headBeanPoint(u, v)
  if (shape === 'rounded-cube') return roundedPoint(u, v, 8)
  return ellipsoidPoint(u, v)
}
function sampleSurface(normalizedPoint: (u: number, v: number) => CloudFoxSurfaceVector3, center: CloudFoxSurfaceVector3, axes: CloudFoxSurfaceVector3, u: number, v: number): CloudFoxSurfaceSample {
  const positionAt = (sampleU: number, sampleV: number): CloudFoxSurfaceVector3 => { const point = normalizedPoint(sampleU, sampleV); return [center[0] + point[0] * axes[0], center[1] + point[1] * axes[1], center[2] + point[2] * axes[2]] }
  const position = positionAt(u, v); const tangentU = subtract(positionAt(u + EPSILON, v), positionAt(u - EPSILON, v)); const tangentV = subtract(positionAt(u, v + EPSILON), positionAt(u, v - EPSILON))
  let normal = normalize(cross(tangentU, tangentV)); if (normal[2] < 0) normal = scale(normal, -1)
  return { position, normal }
}

export function getCloudFoxBodySurfaceMetrics(input: CloudFoxBodySurfaceInput) {
  const profile = getCloudFoxBodyProfile(input.shape); const body = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.model.body
  return {
    center: [body.position[0] + profile.offset[0] * input.bodyWidth, body.position[1] + profile.offset[1] * input.bodyHeight, body.position[2] + profile.offset[2] * input.bodyDepth] as CloudFoxSurfaceVector3,
    axes: [body.scale[0] * body.radius * input.bodyWidth * profile.scale[0], body.scale[1] * body.radius * input.bodyHeight * profile.scale[1], body.scale[2] * body.radius * input.bodyDepth * profile.scale[2]] as CloudFoxSurfaceVector3,
  }
}
export function getCloudFoxHeadSurfaceMetrics(input: CloudFoxHeadSurfaceInput) {
  const profile = getCloudFoxHeadProfile(input.shape); const head = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.model.head
  return { axes: [head.scale[0] * head.radius * input.headScale * profile.scale[0], head.scale[1] * head.radius * input.headScale * profile.scale[1], head.scale[2] * head.radius * input.headScale * profile.scale[2]] as CloudFoxSurfaceVector3 }
}
export function sampleCloudFoxBodyFrontSurface(input: CloudFoxBodySurfaceInput, u: number, v: number) { const metrics = getCloudFoxBodySurfaceMetrics(input); return sampleSurface((x, y) => bodyNormalizedPoint(input.shape, x, y), metrics.center, metrics.axes, u, v) }
export function sampleCloudFoxHeadFrontSurface(input: CloudFoxHeadSurfaceInput, u: number, v: number) { const metrics = getCloudFoxHeadSurfaceMetrics(input); return sampleSurface((x, y) => headNormalizedPoint(input.shape, x, y), [0, 0, 0], metrics.axes, u, v) }
export function sampleCloudFoxHeadFrontSurfaceAtLocalXY(input: CloudFoxHeadSurfaceInput, x: number, y: number) { const axes = getCloudFoxHeadSurfaceMetrics(input).axes; return sampleCloudFoxHeadFrontSurface(input, x / Math.max(.0001, axes[0]), y / Math.max(.0001, axes[1])) }

export function resolveCloudFoxEyeSurfaceAnchor(input: CloudFoxHeadSurfaceInput & { eyeSpacing: number }, side: -1 | 1) {
  const profile = getCloudFoxHeadProfile(input.shape); const head = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.model.head
  const x = side * head.eyeOffset[0] * input.eyeSpacing * profile.eyeX * input.headScale; const y = (head.eyeOffset[1] + profile.eyeY) * input.headScale
  const sample = sampleCloudFoxHeadFrontSurfaceAtLocalXY(input, x, y); const position = add(sample.position, scale(sample.normal, .032 * input.headScale))
  return { ...sample, position, rotation: [-Math.atan2(sample.normal[1], Math.hypot(sample.normal[0], sample.normal[2])), Math.atan2(sample.normal[0], sample.normal[2]), 0] as CloudFoxSurfaceVector3 }
}

export function sampleCloudFoxMuzzleFrontSurfaceAtLocalXY(input: CloudFoxHeadSurfaceInput, x: number, y: number): CloudFoxSurfaceSample {
  const profile = getCloudFoxHeadProfile(input.shape); const head = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME.model.head
  const center: CloudFoxSurfaceVector3 = [(head.muzzlePosition[0] + profile.muzzleOffset[0]) * input.headScale, (head.muzzlePosition[1] + profile.muzzleOffset[1]) * input.headScale, (head.muzzlePosition[2] + profile.muzzleOffset[2]) * input.headScale]
  const axes: CloudFoxSurfaceVector3 = [head.muzzleScale[0] * profile.muzzleScale[0] * head.muzzleRadius * input.headScale, head.muzzleScale[1] * profile.muzzleScale[1] * head.muzzleRadius * input.headScale, head.muzzleScale[2] * profile.muzzleScale[2] * head.muzzleRadius * input.headScale]
  return sampleSurface(ellipsoidPoint, center, axes, x / Math.max(.0001, axes[0]), y / Math.max(.0001, axes[1]))
}
export function resolveCloudFoxMuzzleSurfaceAnchor(input: CloudFoxHeadSurfaceInput, x: number, y: number, surfaceOffset: number) {
  const sample = sampleCloudFoxMuzzleFrontSurfaceAtLocalXY(input, x, y); const position = add(sample.position, scale(sample.normal, surfaceOffset * input.headScale))
  return { ...sample, position, rotation: [-Math.atan2(sample.normal[1], Math.hypot(sample.normal[0], sample.normal[2])), Math.atan2(sample.normal[0], sample.normal[2]), 0] as CloudFoxSurfaceVector3 }
}

export function createCloudFoxBellySurfaceMesh(input: CloudFoxBodySurfaceInput, design: CloudFoxBellySurfaceDesign, columns = 28, rows = 36): CloudFoxSurfaceMeshData {
  const profile = getCloudFoxBodyProfile(input.shape); const frameCenterX = profile.bellyOffset[0] + design.offsetX * .55; const frameCenterY = profile.bellyOffset[1] + design.offsetY * .55
  const frameWidth = 1.02 * profile.bellyScale[0] * design.width; const frameHeight = 1.18 * profile.bellyScale[1] * design.height; const cosine = Math.cos(design.rotation); const sine = Math.sin(design.rotation)
  const positions: number[] = []; const normals: number[] = []; const uvs: number[] = []; const indices: number[] = []; const bodyCoordinates: number[] = []
  for (let row = 0; row <= rows; row += 1) {
    const gridY = row / rows - .5
    for (let column = 0; column <= columns; column += 1) {
      const gridX = column / columns - .5; const localX = gridX * frameWidth; const localY = gridY * frameHeight
      const u = frameCenterX + localX * cosine - localY * sine; const v = frameCenterY + localX * sine + localY * cosine
      const sample = sampleCloudFoxBodyFrontSurface(input, u, v); const position = add(sample.position, scale(sample.normal, BELLY_SURFACE_OFFSET))
      positions.push(...position); normals.push(...sample.normal); uvs.push(column / columns, row / rows); bodyCoordinates.push(u, v)
    }
  }
  const stride = columns + 1
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const topLeft = row * stride + column; const topRight = topLeft + 1; const bottomLeft = topLeft + stride; const bottomRight = bottomLeft + 1
    indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft)
  }
  return { positions, normals, uvs, indices, bodyCoordinates }
}
export const CLOUD_FOX_BELLY_SURFACE_OFFSET = BELLY_SURFACE_OFFSET
