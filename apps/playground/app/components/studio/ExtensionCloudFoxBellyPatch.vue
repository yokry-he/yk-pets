<!--
  文件职责 / File responsibility
  在同一身体曲率薄壳上渲染五种可缩放肚皮轮廓，并为圆角立方体身体提供贴面兼容。
  Renders five scalable belly silhouettes on one hairline torso shell, with a flush rounded-cube fallback.
-->
<script setup lang="ts">
import { CanvasTexture, Vector3 } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type {
  BellyPatchDesignRecipe,
  BellyPatchStyle,
  MultiSpeciesAppearanceRecipe,
} from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const bodyScale = computed(() => vector([
  scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth,
  scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight,
  scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth,
]))

/*
 * 和身体使用同一椭球中心与曲率，只放大不到 1%，因此侧面最多露出一层非常薄的外壳。
 * Share the torso center and curvature and enlarge by less than 1%, leaving only a hairline reveal in profile.
 */
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
  .9 * props.appearance.proportions.bodyWidth,
  1.02 * props.appearance.proportions.bodyHeight,
  1,
]))

const patchMask = shallowRef<CanvasTexture>()

function drawShieldMask(context: CanvasRenderingContext2D) {
  context.moveTo(-58, -62)
  context.bezierCurveTo(-58, -82, -40, -92, -22, -92)
  context.lineTo(22, -92)
  context.bezierCurveTo(40, -92, 58, -82, 58, -62)
  context.bezierCurveTo(58, -8, 40, 60, 0, 91)
  context.bezierCurveTo(-40, 60, -58, -8, -58, -62)
}

function drawBeanMask(context: CanvasRenderingContext2D) {
  context.moveTo(-44, -88)
  context.bezierCurveTo(24, -108, 72, -54, 58, 8)
  context.bezierCurveTo(50, 58, 16, 94, -24, 88)
  context.bezierCurveTo(-68, 82, -72, 34, -58, 4)
  context.bezierCurveTo(-44, -26, -74, -70, -44, -88)
}

function drawTeardropMask(context: CanvasRenderingContext2D) {
  context.moveTo(0, -96)
  context.bezierCurveTo(48, -70, 68, -22, 58, 24)
  context.bezierCurveTo(50, 62, 24, 84, 0, 98)
  context.bezierCurveTo(-24, 84, -50, 62, -58, 24)
  context.bezierCurveTo(-68, -22, -48, -70, 0, -96)
}

function drawHeartMask(context: CanvasRenderingContext2D) {
  context.moveTo(0, 88)
  context.bezierCurveTo(-14, 64, -66, 28, -66, -28)
  context.bezierCurveTo(-66, -76, -16, -94, 0, -56)
  context.bezierCurveTo(16, -94, 66, -76, 66, -28)
  context.bezierCurveTo(66, 28, 14, 64, 0, 88)
}

function drawPatchShape(context: CanvasRenderingContext2D, style: BellyPatchStyle) {
  if (style === 'oval') context.ellipse(0, 0, 70, 94, 0, 0, Math.PI * 2)
  else if (style === 'shield') drawShieldMask(context)
  else if (style === 'bean') drawBeanMask(context)
  else if (style === 'teardrop') drawTeardropMask(context)
  else if (style === 'heart') drawHeartMask(context)
  else drawShieldMask(context)
}

function createPatchMask(design: BellyPatchDesignRecipe) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, 256, 256)
  context.save()
  context.translate(128, 132 - design.offsetY * 92)
  context.scale(design.width, design.height)
  context.fillStyle = '#fff'
  context.beginPath()
  drawPatchShape(context, design.style)
  context.closePath()
  context.fill()
  context.restore()
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

watch(
  () => props.appearance.bellyPatchDesign,
  (design) => {
    patchMask.value?.dispose()
    patchMask.value = createPatchMask(design)
  },
  { immediate: true, deep: true },
)
onBeforeUnmount(() => patchMask.value?.dispose())
</script>

<template>
  <TresMesh
    v-if="appearance.bellyPatchDesign.visible && appearance.parts.bodyShape !== 'rounded-cube'"
    :position="vector(scheme.model.body.position)"
    :scale="shellScale"
    :render-order="2"
  >
    <TresSphereGeometry :args="[scheme.model.body.radius, 64, 48, 1.02, 1.1, 1.12, 1.24]" />
    <TresMeshStandardMaterial
      :color="appearance.palette.coatWarm"
      :roughness=".42"
      :alpha-map="patchMask"
      transparent
      :alpha-test=".04"
      :depth-write="true"
    />
  </TresMesh>

  <TresMesh
    v-else-if="appearance.bellyPatchDesign.visible"
    :position="cubePatchPosition"
    :scale="cubePatchScale"
    :render-order="2"
  >
    <TresPlaneGeometry :args="[1, 1, 16, 20]" />
    <TresMeshStandardMaterial
      :color="appearance.palette.coatWarm"
      :roughness=".42"
      :alpha-map="patchMask"
      transparent
      :alpha-test=".04"
      :depth-write="true"
    />
  </TresMesh>
</template>
