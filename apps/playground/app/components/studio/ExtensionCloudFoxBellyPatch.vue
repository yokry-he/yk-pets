<!--
  文件职责 / File responsibility
  使用显式椭圆默认值和十种清晰命名的轮廓渲染可着色、可旋转、可偏移的贴体肚皮。
  Renders a colorable, rotatable, offset belly patch with an explicit ellipse default and ten clearly named silhouettes.
-->
<script setup lang="ts">
import { CanvasTexture, Vector3 } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import {
  resolvePetCustomization,
  type PetBellyCustomizationRecipe,
  type PetBellyShape,
} from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const customization = computed(() => resolvePetCustomization(props.appearance))
const design = computed(() => customization.value.belly)
const patchColor = computed(() => customization.value.colors.belly)
const bodyScale = computed(() => vector([
  scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth,
  scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight,
  scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth,
]))
const shellScale = computed(() => vector([
  bodyScale.value.x * 1.004,
  bodyScale.value.y * 1.004,
  bodyScale.value.z * 1.008,
]))
const cubePatchPosition = computed(() => vector([
  0,
  scheme.model.body.position[1] - .08 * props.appearance.proportions.bodyHeight,
  scheme.model.body.position[2] + bodyScale.value.z * .866,
]))
const cubePatchScale = computed(() => vector([
  .9 * props.appearance.proportions.bodyWidth * design.value.width,
  1.02 * props.appearance.proportions.bodyHeight * design.value.height,
  1,
]))
const patchMask = shallowRef<CanvasTexture>()

function drawShield(context: CanvasRenderingContext2D) {
  context.moveTo(-58, -62)
  context.bezierCurveTo(-58, -82, -40, -92, -22, -92)
  context.lineTo(22, -92)
  context.bezierCurveTo(40, -92, 58, -82, 58, -62)
  context.bezierCurveTo(58, -8, 40, 60, 0, 91)
  context.bezierCurveTo(-40, 60, -58, -8, -58, -62)
}

function drawBean(context: CanvasRenderingContext2D) {
  context.moveTo(-44, -88)
  context.bezierCurveTo(24, -108, 72, -54, 58, 8)
  context.bezierCurveTo(50, 58, 16, 94, -24, 88)
  context.bezierCurveTo(-68, 82, -72, 34, -58, 4)
  context.bezierCurveTo(-44, -26, -74, -70, -44, -88)
}

function drawDrop(context: CanvasRenderingContext2D, inverted: boolean) {
  const direction = inverted ? -1 : 1
  context.moveTo(0, -96 * direction)
  context.bezierCurveTo(48, -70 * direction, 68, -22 * direction, 58, 24 * direction)
  context.bezierCurveTo(50, 62 * direction, 24, 84 * direction, 0, 98 * direction)
  context.bezierCurveTo(-24, 84 * direction, -50, 62 * direction, -58, 24 * direction)
  context.bezierCurveTo(-68, -22 * direction, -48, -70 * direction, 0, -96 * direction)
}

function drawHeart(context: CanvasRenderingContext2D) {
  context.moveTo(0, 88)
  context.bezierCurveTo(-14, 64, -66, 28, -66, -28)
  context.bezierCurveTo(-66, -76, -16, -94, 0, -56)
  context.bezierCurveTo(16, -94, 66, -76, 66, -28)
  context.bezierCurveTo(66, 28, 14, 64, 0, 88)
}

function drawRoundedRectangle(context: CanvasRenderingContext2D) {
  const left = -66
  const top = -88
  const right = 66
  const bottom = 88
  const radius = 28
  context.moveTo(left + radius, top)
  context.lineTo(right - radius, top)
  context.quadraticCurveTo(right, top, right, top + radius)
  context.lineTo(right, bottom - radius)
  context.quadraticCurveTo(right, bottom, right - radius, bottom)
  context.lineTo(left + radius, bottom)
  context.quadraticCurveTo(left, bottom, left, bottom - radius)
  context.lineTo(left, top + radius)
  context.quadraticCurveTo(left, top, left + radius, top)
}

function drawCloud(context: CanvasRenderingContext2D) {
  context.moveTo(-70, 38)
  context.bezierCurveTo(-88, 4, -62, -30, -32, -24)
  context.bezierCurveTo(-24, -70, 34, -82, 48, -38)
  context.bezierCurveTo(82, -38, 92, 10, 68, 34)
  context.bezierCurveTo(50, 72, -48, 76, -70, 38)
}

function drawChestFur(context: CanvasRenderingContext2D) {
  context.moveTo(-68, -76)
  context.bezierCurveTo(-42, -100, 42, -100, 68, -76)
  context.lineTo(56, 26)
  context.lineTo(26, 78)
  context.lineTo(0, 48)
  context.lineTo(-26, 78)
  context.lineTo(-56, 26)
  context.closePath()
}

function drawShape(context: CanvasRenderingContext2D, shape: PetBellyShape) {
  if (shape === 'ellipse') context.ellipse(0, 0, 70, 94, 0, 0, Math.PI * 2)
  else if (shape === 'egg') {
    context.moveTo(0, -92)
    context.bezierCurveTo(48, -82, 70, -20, 64, 30)
    context.bezierCurveTo(58, 84, 28, 104, 0, 104)
    context.bezierCurveTo(-28, 104, -58, 84, -64, 30)
    context.bezierCurveTo(-70, -20, -48, -82, 0, -92)
  }
  else if (shape === 'shield') drawShield(context)
  else if (shape === 'teardrop') drawDrop(context, false)
  else if (shape === 'inverted-teardrop') drawDrop(context, true)
  else if (shape === 'bean') drawBean(context)
  else if (shape === 'rounded-rectangle') drawRoundedRectangle(context)
  else if (shape === 'heart') drawHeart(context)
  else if (shape === 'cloud') drawCloud(context)
  else drawChestFur(context)
}

function createMask(input: PetBellyCustomizationRecipe) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, 256, 256)
  context.save()
  context.translate(128 + input.offsetX * 92, 132 - input.offsetY * 92)
  context.rotate(input.rotation)
  context.scale(input.width, input.height)
  context.fillStyle = '#fff'
  context.shadowColor = '#fff'
  context.shadowBlur = input.softness * 7
  context.beginPath()
  drawShape(context, input.shape)
  context.closePath()
  context.fill()
  context.restore()
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

watch(
  () => design.value,
  (next) => {
    patchMask.value?.dispose()
    patchMask.value = createMask(next)
  },
  { immediate: true, deep: true },
)
onBeforeUnmount(() => patchMask.value?.dispose())
</script>

<template>
  <TresMesh
    v-if="design.visible && appearance.parts.bodyShape !== 'rounded-cube'"
    :position="vector(scheme.model.body.position)"
    :scale="shellScale"
    :render-order="2"
  >
    <TresSphereGeometry :args="[scheme.model.body.radius, 64, 48, 1.02, 1.1, 1.12, 1.24]" />
    <TresMeshStandardMaterial
      :color="patchColor"
      :roughness=".42"
      :alpha-map="patchMask"
      transparent
      :alpha-test=".04"
      :depth-write="true"
    />
  </TresMesh>
  <TresMesh
    v-else-if="design.visible"
    :position="cubePatchPosition"
    :scale="cubePatchScale"
    :render-order="2"
  >
    <TresPlaneGeometry :args="[1, 1, 16, 20]" />
    <TresMeshStandardMaterial
      :color="patchColor"
      :roughness=".42"
      :alpha-map="patchMask"
      transparent
      :alpha-test=".04"
      :depth-write="true"
    />
  </TresMesh>
</template>
