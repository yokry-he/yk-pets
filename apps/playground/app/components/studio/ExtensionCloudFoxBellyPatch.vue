<!--
  文件职责 / File responsibility
  将十种肚皮轮廓逐顶点投影到当前身体真实前表面，并沿表面法线轻微外移；不再使用悬浮平面或近似曲率。
  Projects ten belly silhouettes vertex-by-vertex onto the active torso front surface and offsets them slightly along surface normals, replacing floating planes and approximate curvature.
-->
<script setup lang="ts">
import { BufferGeometry, CanvasTexture, Float32BufferAttribute } from 'three'
import { createCloudFoxBellySurfaceMesh } from '~/domain/cloud-fox-surface-model'
import { resolvePetCustomization, type PetBellyShape } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const customization = computed(() => resolvePetCustomization(props.appearance))
const design = computed(() => customization.value.belly)
const colors = computed(() => customization.value.colors)
const patchMask = shallowRef<CanvasTexture>()
const surfaceGeometry = shallowRef<BufferGeometry>()

function drawShield(context: CanvasRenderingContext2D) {
  context.moveTo(-58, -62); context.bezierCurveTo(-58, -82, -40, -92, -22, -92); context.lineTo(22, -92)
  context.bezierCurveTo(40, -92, 58, -82, 58, -62); context.bezierCurveTo(58, -8, 40, 60, 0, 91); context.bezierCurveTo(-40, 60, -58, -8, -58, -62)
}
function drawBean(context: CanvasRenderingContext2D) {
  context.moveTo(-44, -88); context.bezierCurveTo(24, -108, 72, -54, 58, 8); context.bezierCurveTo(50, 58, 16, 94, -24, 88)
  context.bezierCurveTo(-68, 82, -72, 34, -58, 4); context.bezierCurveTo(-44, -26, -74, -70, -44, -88)
}
function drawTeardrop(context: CanvasRenderingContext2D, inverted = false) {
  context.save(); if (inverted) context.rotate(Math.PI)
  context.moveTo(0, -96); context.bezierCurveTo(48, -70, 68, -22, 58, 24); context.bezierCurveTo(50, 62, 24, 84, 0, 98)
  context.bezierCurveTo(-24, 84, -50, 62, -58, 24); context.bezierCurveTo(-68, -22, -48, -70, 0, -96); context.restore()
}
function drawHeart(context: CanvasRenderingContext2D) {
  context.moveTo(0, 88); context.bezierCurveTo(-14, 64, -66, 28, -66, -28); context.bezierCurveTo(-66, -76, -16, -94, 0, -56)
  context.bezierCurveTo(16, -94, 66, -76, 66, -28); context.bezierCurveTo(66, 28, 14, 64, 0, 88)
}
function drawCloud(context: CanvasRenderingContext2D) {
  context.moveTo(-68, 34); context.bezierCurveTo(-88, 4, -68, -22, -38, -18); context.bezierCurveTo(-34, -58, 10, -68, 28, -38)
  context.bezierCurveTo(58, -48, 78, -18, 64, 8); context.bezierCurveTo(88, 30, 64, 62, 32, 54); context.lineTo(-36, 54); context.bezierCurveTo(-58, 60, -78, 50, -68, 34)
}
function drawChestFur(context: CanvasRenderingContext2D) {
  context.moveTo(-62, -80); context.bezierCurveTo(-22, -104, 22, -104, 62, -80); context.lineTo(52, 42)
  context.lineTo(26, 24); context.lineTo(12, 76); context.lineTo(0, 54); context.lineTo(-12, 76); context.lineTo(-26, 24); context.lineTo(-52, 42); context.closePath()
}
function drawRoundedRectangle(context: CanvasRenderingContext2D) {
  const radius = 28; const x = -62; const y = -86; const width = 124; const height = 172
  context.moveTo(x + radius, y); context.lineTo(x + width - radius, y); context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius); context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height); context.quadraticCurveTo(x, y + height, x, y + height - radius); context.lineTo(x, y + radius); context.quadraticCurveTo(x, y, x + radius, y)
}
function drawShape(context: CanvasRenderingContext2D, shape: PetBellyShape) {
  if (shape === 'ellipse') context.ellipse(0, 0, 68, 96, 0, 0, Math.PI * 2)
  else if (shape === 'egg') { context.moveTo(0, -96); context.bezierCurveTo(48, -76, 72, -20, 62, 34); context.bezierCurveTo(54, 80, 28, 98, 0, 100); context.bezierCurveTo(-28, 98, -54, 80, -62, 34); context.bezierCurveTo(-72, -20, -48, -76, 0, -96) }
  else if (shape === 'shield') drawShield(context)
  else if (shape === 'teardrop') drawTeardrop(context)
  else if (shape === 'inverted-teardrop') drawTeardrop(context, true)
  else if (shape === 'bean') drawBean(context)
  else if (shape === 'rounded-rectangle') drawRoundedRectangle(context)
  else if (shape === 'heart') drawHeart(context)
  else if (shape === 'cloud') drawCloud(context)
  else drawChestFur(context)
}
function createPatchMask(shape: PetBellyShape, softness: number) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, 256, 256)
  context.save(); context.translate(128, 128); context.fillStyle = '#fff'; context.shadowColor = '#fff'; context.shadowBlur = softness * 12
  context.beginPath(); drawShape(context, shape); context.closePath(); context.fill(); context.restore()
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}
function createSurfaceGeometry() {
  const data = createCloudFoxBellySurfaceMesh({
    shape: props.appearance.parts.bodyShape,
    bodyWidth: props.appearance.proportions.bodyWidth,
    bodyHeight: props.appearance.proportions.bodyHeight,
    bodyDepth: props.appearance.proportions.bodyDepth,
  }, design.value)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(data.uvs, 2))
  geometry.setIndex(data.indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const maskKey = computed(() => `${design.value.shape}:${design.value.softness}`)
const surfaceKey = computed(() => JSON.stringify([
  props.appearance.parts.bodyShape,
  props.appearance.proportions.bodyWidth,
  props.appearance.proportions.bodyHeight,
  props.appearance.proportions.bodyDepth,
  design.value.width,
  design.value.height,
  design.value.offsetX,
  design.value.offsetY,
  design.value.rotation,
]))
watch(maskKey, () => { patchMask.value?.dispose(); patchMask.value = createPatchMask(design.value.shape, design.value.softness) }, { immediate: true })
watch(surfaceKey, () => { surfaceGeometry.value?.dispose(); surfaceGeometry.value = createSurfaceGeometry() }, { immediate: true })
onBeforeUnmount(() => { patchMask.value?.dispose(); surfaceGeometry.value?.dispose() })
</script>

<template>
  <TresMesh v-if="design.visible && patchMask && surfaceGeometry" :geometry="surfaceGeometry" :render-order="2">
    <TresMeshStandardMaterial
      :color="colors.belly"
      :roughness=".42"
      :alpha-map="patchMask"
      transparent
      :alpha-test=".04"
      :depth-write="true"
      polygon-offset
      :polygon-offset-factor="-1"
      :polygon-offset-units="-1"
    />
  </TresMesh>
</template>
