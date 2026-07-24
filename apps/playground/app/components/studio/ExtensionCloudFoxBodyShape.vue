<!--
  文件职责 / File responsibility
  在正式云狐身体基线上渲染六种不重复的连续外轮廓，并以略大的外壳保留既有四肢、尾巴和完整动作实现。
  Renders six distinct continuous outer silhouettes over the production Cloud Fox body baseline while preserving existing limbs, tail, and full motion behavior.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { Euler, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)
const colors = computed(() => resolvePetCustomization(props.appearance).colors)
const bodyPosition = computed(() => vector(scheme.model.body.position[0], scheme.model.body.position[1], scheme.model.body.position[2]))
const bodyWidth = computed(() => scheme.model.body.scale[0] * props.appearance.proportions.bodyWidth)
const bodyHeight = computed(() => scheme.model.body.scale[1] * props.appearance.proportions.bodyHeight)
const bodyDepth = computed(() => scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth)
const ellipsoidScale = computed(() => vector(bodyWidth.value * 1.025, bodyHeight.value * 1.025, bodyDepth.value * 1.035))
const sphereRadius = computed(() => Math.max(bodyWidth.value, bodyHeight.value, bodyDepth.value) * 1.025)
const capsuleRadius = computed(() => Math.max(bodyWidth.value * .92, bodyDepth.value * 1.08))
const capsuleHeight = computed(() => Math.max(.18, bodyHeight.value * 2.08 - capsuleRadius.value * 2))
const capsuleEndY = computed(() => capsuleHeight.value * .5)
const roundedBodyGeometry = new RoundedBoxGeometry(2.08, 2.28, 1.92, 6, .3)
onBeforeUnmount(() => roundedBodyGeometry.dispose())
</script>

<template>
  <TresGroup :position="bodyPosition">
    <TresMesh v-if="appearance.parts.bodyShape === 'sphere'" :scale="vector(sphereRadius, sphereRadius, sphereRadius)" cast-shadow>
      <TresSphereGeometry :args="[scheme.model.body.radius, 64, 64]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".34" :metalness=".04" />
    </TresMesh>
    <TresMesh v-else-if="appearance.parts.bodyShape === 'ellipsoid'" :scale="ellipsoidScale" cast-shadow>
      <TresSphereGeometry :args="[scheme.model.body.radius, 64, 64]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".34" :metalness=".04" />
    </TresMesh>
    <TresGroup v-else-if="appearance.parts.bodyShape === 'capsule'">
      <TresMesh cast-shadow><TresCylinderGeometry :args="[capsuleRadius, capsuleRadius, capsuleHeight, 48]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".33" :metalness=".04" /></TresMesh>
      <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector(0, side * capsuleEndY, 0)" :scale="vector(capsuleRadius, capsuleRadius, capsuleRadius)" cast-shadow><TresSphereGeometry :args="[1, 48, 48]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".33" :metalness=".04" /></TresMesh>
    </TresGroup>
    <TresGroup v-else-if="appearance.parts.bodyShape === 'pear'">
      <TresMesh :position="vector(0, -bodyHeight * .19, 0)" :scale="vector(bodyWidth * 1.13, bodyHeight * .9, bodyDepth * 1.13)" cast-shadow><TresSphereGeometry :args="[1, 56, 56]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".34" :metalness=".04" /></TresMesh>
      <TresMesh :position="vector(0, bodyHeight * .54, 0)" :scale="vector(bodyWidth * .84, bodyHeight * .69, bodyDepth * .94)" cast-shadow><TresSphereGeometry :args="[1, 52, 52]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".33" :metalness=".04" /></TresMesh>
    </TresGroup>
    <TresGroup v-else-if="appearance.parts.bodyShape === 'bean'" :rotation="rotation(0, 0, -.12)">
      <TresMesh :position="vector(-bodyWidth * .13, -.04, 0)" :scale="vector(bodyWidth * 1.08, bodyHeight * 1.03, bodyDepth * 1.13)" cast-shadow><TresSphereGeometry :args="[1, 56, 56]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".34" :metalness=".04" /></TresMesh>
      <TresMesh :position="vector(bodyWidth * .52, bodyHeight * .2, 0)" :scale="vector(bodyWidth * .84, bodyHeight * .76, bodyDepth * .98)" cast-shadow><TresSphereGeometry :args="[1, 52, 52]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".33" :metalness=".04" /></TresMesh>
    </TresGroup>
    <TresMesh v-else :geometry="roundedBodyGeometry" :scale="vector(appearance.proportions.bodyWidth, appearance.proportions.bodyHeight, appearance.proportions.bodyDepth)" cast-shadow><TresMeshStandardMaterial :color="colors.body" :roughness=".3" :metalness=".06" /></TresMesh>
  </TresGroup>
</template>
