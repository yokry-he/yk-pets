<!--
  文件职责 / File responsibility
  在唯一头部局部坐标中按共享 Shape Profile 渲染可配置鼻子、经典/猫系/线条/张嘴/嘟嘴和动态脸颊，不再使用遮挡层。
  Renders configurable noses, classic/cat/line/open/pout mouths, and animated cheeks in the sole head-local space using the shared Shape Profile without cover meshes.
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { CatmullRomCurve3, Euler, Vector3 } from 'three'
import type { Group, MeshBasicMaterial } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { getCloudFoxShapeProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()

const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const customization = computed(() => resolvePetCustomization(props.appearance))
const colors = computed(() => customization.value.colors)
const profile = computed(() => getCloudFoxShapeProfile(props.appearance.parts.bodyShape))
const mouth = shallowRef<Group>()
const cheekMaterials = shallowRef<MeshBasicMaterial[]>([])
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

const nosePosition = computed(() => vector([
  scheme.model.head.nosePosition[0] + profile.value.muzzleOffset[0],
  scheme.model.head.nosePosition[1] + profile.value.muzzleOffset[1],
  scheme.model.head.nosePosition[2] + .012 + profile.value.faceDepthOffset,
]))
const mouthPosition = computed(() => vector([
  scheme.model.head.mouthPosition[0] + profile.value.muzzleOffset[0],
  scheme.model.head.mouthPosition[1] + profile.value.muzzleOffset[1],
  scheme.model.head.mouthPosition[2] + (props.appearance.parts.mouth === 'smile' ? 0 : .012) + profile.value.faceDepthOffset,
]))
const noseScale = computed(() => {
  if (props.appearance.parts.nose === 'sensor') return vector([.16, .085, .075])
  if (props.appearance.parts.nose === 'button') return vector([.135, .105, .068])
  if (props.appearance.parts.nose === 'heart') return vector([.115, .115, .07])
  if (props.appearance.parts.nose === 'triangle') return vector([.135, .12, .082])
  return vector(scheme.model.head.noseScale)
})
const smileLeft = new CatmullRomCurve3([vector([-.19, .025, .012]), vector([-.14, -.035, .018]), vector([-.075, -.07, .022]), vector([0, -.062, .024])])
const smileRight = new CatmullRomCurve3([vector([0, -.062, .024]), vector([.075, -.07, .022]), vector([.14, -.035, .018]), vector([.19, .025, .012])])
const catLeft = new CatmullRomCurve3([vector([-.18, .018, .012]), vector([-.12, -.07, .018]), vector([-.055, -.085, .022]), vector([0, -.025, .024])])
const catRight = new CatmullRomCurve3([vector([0, -.025, .024]), vector([.055, -.085, .022]), vector([.12, -.07, .018]), vector([.18, .018, .012])])
const poutCurve = new CatmullRomCurve3(Array.from({ length: 18 }, (_, index) => {
  const angle = index / 18 * Math.PI * 2
  return vector([Math.cos(angle) * .075, Math.sin(angle) * .065, .018])
}), true)

function registerCheek(reference: unknown) {
  const material = reference as MeshBasicMaterial | null
  if (material && !cheekMaterials.value.includes(material)) cheekMaterials.value.push(material)
}

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const state = props.behavior
  if (mouth.value) {
    const talking = state === 'talking' ? .78 + Math.max(0, Math.sin(elapsed * 10)) * .82 : 1
    const eating = state === 'eating' ? .82 + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 14)) * .92 : 1
    const excited = state === 'happy' || state === 'excited' ? 1.14 : 1
    const sneeze = state === 'sparkle-sneeze' ? 1 + frame.sneezeRelease * .84 : 1
    mouth.value.scale.y = damp(mouth.value.scale.y, talking * eating * sneeze, 12, delta)
    mouth.value.scale.x = damp(mouth.value.scale.x, excited, 10, delta)
  }
  const cheekOpacity = state === 'happy' || state === 'talking' || state === 'excited'
    ? .34
    : state === 'flapping'
      ? .56 + Math.sin(stateElapsed * 2.1) * .055
      : state === 'greeting' || state === 'jumping' || state === 'shy-peek'
        ? .28
        : 0
  for (const material of cheekMaterials.value) material.opacity = damp(material.opacity, cheekOpacity, 9, delta)
})
</script>

<template>
  <TresGroup>
    <TresGroup :position="nosePosition" :scale="noseScale">
      <TresMesh v-if="appearance.parts.nose === 'triangle'" :rotation="rotation([Math.PI / 2, 0, 0])"><TresConeGeometry :args="[1, 1.25, 3, 1]" /><TresMeshStandardMaterial :color="colors.nose" :roughness=".18" /></TresMesh>
      <template v-else-if="appearance.parts.nose === 'sensor'">
        <TresMesh><TresBoxGeometry :args="[1.65, .78, .7, 3, 3, 3]" /><TresMeshStandardMaterial :color="colors.nose" :emissive="colors.antennaTip" :emissive-intensity=".35" :metalness=".68" :roughness=".18" /></TresMesh>
        <TresMesh :position="vector([0, 0, .42])"><TresTorusGeometry :args="[.38, .07, 10, 28]" /><TresMeshBasicMaterial :color="colors.antennaTip" /></TresMesh>
      </template>
      <template v-else-if="appearance.parts.nose === 'button'">
        <TresMesh :rotation="rotation([Math.PI / 2, 0, 0])"><TresCylinderGeometry :args="[.72, .72, .34, 28]" /><TresMeshStandardMaterial :color="colors.nose" :roughness=".28" /></TresMesh>
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .24, 0, .2])" :scale="vector([.09, .09, .06])"><TresSphereGeometry /><TresMeshBasicMaterial :color="colors.muzzle" /></TresMesh>
      </template>
      <template v-else-if="appearance.parts.nose === 'heart'">
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .32, .16, 0])" :scale="vector([.56, .56, .66])"><TresSphereGeometry /><TresMeshStandardMaterial :color="colors.nose" :roughness=".2" /></TresMesh>
        <TresMesh :position="vector([0, -.3, 0])" :rotation="rotation([0, 0, Math.PI])" :scale="vector([.68, .68, .7])"><TresConeGeometry :args="[.7, 1.05, 3]" /><TresMeshStandardMaterial :color="colors.nose" :roughness=".2" /></TresMesh>
      </template>
      <TresMesh v-else><TresSphereGeometry :args="[1, 32, 24]" /><TresMeshStandardMaterial :color="colors.nose" :roughness=".22" /></TresMesh>
    </TresGroup>

    <TresMesh v-for="side in [-1, 1]" :key="`face-cheek-${side}`" :position="vector([side * scheme.model.head.cheekOffset[0] + profile.muzzleOffset[0], scheme.model.head.cheekOffset[1] + profile.muzzleOffset[1], scheme.model.head.cheekOffset[2] + .015 + profile.faceDepthOffset])" :scale="vector(scheme.model.head.cheekScale)">
      <TresSphereGeometry /><TresMeshBasicMaterial :ref="registerCheek" :color="colors.cheeks" transparent :opacity="0" :depth-write="false" />
    </TresMesh>

    <TresGroup ref="mouth" :position="mouthPosition">
      <template v-if="appearance.parts.mouth === 'smile'">
        <TresMesh :scale="vector(scheme.model.head.mouthScale)"><TresSphereGeometry /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".2" /></TresMesh>
        <TresMesh :position="vector(scheme.model.head.tonguePosition)" :scale="vector(scheme.model.head.tongueScale)"><TresSphereGeometry /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <template v-else-if="appearance.parts.mouth === 'cat'">
        <TresMesh><TresTubeGeometry :args="[catLeft, 20, .018, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
        <TresMesh><TresTubeGeometry :args="[catRight, 20, .018, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'line'" :scale="vector([.3, .018, .018])"><TresBoxGeometry /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else-if="appearance.parts.mouth === 'open'">
        <TresMesh :scale="vector([.22, .28, .055])"><TresSphereGeometry :args="[1, 28, 24]" /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".25" /></TresMesh>
        <TresMesh :position="vector([0, -.09, .052])" :scale="vector([.14, .09, .025])"><TresSphereGeometry :args="[1, 24, 20]" /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'pout'"><TresTubeGeometry :args="[poutCurve, 24, .017, 8, true]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else>
        <TresMesh><TresTubeGeometry :args="[smileLeft, 20, .018, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
        <TresMesh><TresTubeGeometry :args="[smileRight, 20, .018, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      </template>
    </TresGroup>
  </TresGroup>
</template>
