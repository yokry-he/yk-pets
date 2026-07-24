<!--
  文件职责 / File responsibility
  组合六种正式身体外轮廓，并把十种肚皮轮廓按共享 Shape Profile 贴到各身体正面，避免旧椭球薄壳在非椭球身体上漂浮。
  Composes six production body silhouettes and places ten belly shapes on each front surface through the shared Shape Profile, avoiding floating ellipsoid shells on non-ellipsoid bodies.
-->
<script setup lang="ts">
import { CanvasTexture, Euler, Vector3 } from 'three'
import ExtensionCloudFoxBodyShape from './ExtensionCloudFoxBodyShape.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { getCloudFoxShapeProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization, type PetBellyShape } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)
const customization = computed(() => resolvePetCustomization(props.appearance))
const design = computed(() => customization.value.belly)
const colors = computed(() => customization.value.colors)
const profile = computed(() => getCloudFoxShapeProfile(props.appearance.parts.bodyShape))
const bodyWidth = computed(() => scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth)
const bodyHeight = computed(() => scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight)
const bodyDepth = computed(() => props.appearance.proportions.bodyDepth)
const patchPosition = computed(() => vector(
  design.value.offsetX * bodyWidth.value,
  scheme.model.body.position[1] + profile.value.bellyOffsetY * bodyHeight.value + design.value.offsetY * bodyHeight.value,
  scheme.model.body.position[2] + profile.value.bodyFrontDepth * bodyDepth.value + .035,
))
const patchScale = computed(() => vector(
  1.38 * bodyWidth.value * profile.value.bellyWidth * design.value.width,
  1.48 * bodyHeight.value * profile.value.bellyHeight * design.value.height,
  1,
))
const patchRotation = computed(() => rotation(0, 0, design.value.rotation))
const alphaTest = computed(() => Math.max(.015, .14 - design.value.softness * .11))
const patchMask = shallowRef<CanvasTexture>()

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
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const context = canvas.getContext('2d'); if (!context) return
  context.clearRect(0, 0, 256, 256); context.save(); context.translate(128, 128); context.fillStyle = '#fff'
  context.shadowColor = '#fff'; context.shadowBlur = softness * 18; context.beginPath(); drawShape(context, shape); context.closePath(); context.fill(); context.restore()
  const texture = new CanvasTexture(canvas); texture.needsUpdate = true; return texture
}
watch(() => [design.value.shape, design.value.softness] as const, ([shape, softness]) => {
  patchMask.value?.dispose(); patchMask.value = createPatchMask(shape, softness)
}, { immediate: true })
onBeforeUnmount(() => patchMask.value?.dispose())
</script>

<template>
  <ExtensionCloudFoxBodyShape :appearance="appearance" />
  <TresMesh v-if="design.visible && patchMask" :position="patchPosition" :rotation="patchRotation" :scale="patchScale" :render-order="4">
    <TresPlaneGeometry :args="[1, 1, 20, 20]" />
    <TresMeshStandardMaterial :color="colors.belly" :roughness=".42" :alpha-map="patchMask" transparent :alpha-test="alphaTest" :depth-write="true" />
  </TresMesh>
</template>
