<!--
  文件职责 / File responsibility
  在同一身体曲率薄壳上渲染可切换的经典椭圆与盾牌肚皮，并为圆角立方体身体提供贴面兼容。
  Renders switchable oval and shield belly patches on the same hairline torso shell, with a flush rounded-cube fallback.
-->
<script setup lang="ts">
import { CanvasTexture, Vector3 } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type { BellyPatchStyle, MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

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

function createPatchMask(style: BellyPatchStyle) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, 256, 256)
  context.fillStyle = '#fff'
  context.beginPath()
  if (style === 'oval') {
    context.ellipse(128, 132, 76, 103, 0, 0, Math.PI * 2)
  }
  else {
    context.moveTo(68, 66)
    context.bezierCurveTo(68, 48, 84, 40, 104, 40)
    context.lineTo(152, 40)
    context.bezierCurveTo(172, 40, 188, 48, 188, 66)
    context.bezierCurveTo(188, 126, 168, 190, 128, 222)
    context.bezierCurveTo(88, 190, 68, 126, 68, 66)
  }
  context.closePath()
  context.fill()
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

watch(
  () => props.appearance.bellyPatchDesign.style,
  (style) => {
    patchMask.value?.dispose()
    patchMask.value = createPatchMask(style)
  },
  { immediate: true },
)
onBeforeUnmount(() => patchMask.value?.dispose())
</script>

<template>
  <TresMesh
    v-if="appearance.parts.bodyShape !== 'rounded-cube'"
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

  <TresMesh v-else :position="cubePatchPosition" :scale="cubePatchScale" :render-order="2">
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
