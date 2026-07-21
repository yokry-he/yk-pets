<!--
  文件职责 / File responsibility
  将肚皮渲染为贴合身体曲率的超薄表面壳，只露出少量外层，避免侧视时形成独立厚块。
  Renders the belly as a very thin shell following the torso curvature so it never forms a separate protruding slab in side view.
-->
<script setup lang="ts">
import { Vector3 } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const bodyScale = computed(() => vector([
  scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth,
  scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight,
  scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth,
]))

// 和身体使用同一椭球中心与曲率，只放大不到 1%，因此侧面最多露出一层非常薄的外壳。
// Share the torso center and curvature and enlarge by less than 1%, leaving only a hairline reveal in profile.
const shellScale = computed(() => vector([
  bodyScale.value.x * 1.004,
  bodyScale.value.y * 1.004,
  bodyScale.value.z * 1.008,
]))
const cubePatchPosition = computed(() => vector([
  0,
  scheme.model.body.position[1] - .08 * props.appearance.proportions.bodyHeight,
  bodyScale.value.z * 1.003,
]))
const cubePatchScale = computed(() => vector([
  .5 * props.appearance.proportions.bodyWidth,
  .66 * props.appearance.proportions.bodyHeight,
  1,
]))
</script>

<template>
  <TresMesh
    v-if="appearance.parts.bodyShape !== 'rounded-cube'"
    :position="vector(scheme.model.body.position)"
    :scale="shellScale"
    :render-order="2"
  >
    <TresSphereGeometry :args="[scheme.model.body.radius, 56, 40, 1.02, 1.1, 1.12, 1.24]" />
    <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".42" />
  </TresMesh>

  <TresMesh v-else :position="cubePatchPosition" :scale="cubePatchScale" :render-order="2">
    <TresPlaneGeometry :args="[1, 1, 12, 16]" />
    <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".42" />
  </TresMesh>
</template>
