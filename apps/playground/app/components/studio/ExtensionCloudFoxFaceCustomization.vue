<!--
  文件职责 / File responsibility
  在唯一口鼻部表面坐标中渲染可独立定位缩放的鼻子与五种嘴型；每种嘴型独立解释动作开合。
  Renders independently positioned and scaled noses plus five mouth styles in the sole muzzle-surface coordinate system, with style-specific motion opening.
-->
<script setup lang="ts">
import { CatmullRomCurve3, Euler, Vector3 } from 'three'
import type { MeshBasicMaterial } from 'three'
import { useLoop } from '@tresjs/core'
import type { EvaluatedCloudFoxPose } from '@yk-pets/pet-core'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { resolveCloudFoxMuzzleSurfaceAnchor } from '~/domain/cloud-fox-surface-model'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import { customPoseScale, customPoseValue, hasAuthoredPoseChannel } from '~/domain/custom-motion-pose'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe; behavior: ExtensionCloudFoxMotionId; motionKey: number; customPose?: EvaluatedCloudFoxPose | null }>()
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const customization = computed(() => resolvePetCustomization(props.appearance))
const colors = computed(() => customization.value.colors)
const nose = computed(() => customization.value.nose)
const mouth = computed(() => customization.value.mouth)
const headScale = computed(() => props.appearance.proportions.headScale)
const cheekMaterials = shallowRef<MeshBasicMaterial[]>([])
const animatedOpen = ref(0)
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

const noseAnchor = computed(() => resolveCloudFoxMuzzleSurfaceAnchor(
  { shape: props.appearance.parts.headShape, headScale: headScale.value },
  nose.value.offsetX * headScale.value,
  (-.02 + nose.value.offsetY + customPoseValue(props.customPose, 'nose.offset.y') * .16) * headScale.value,
  nose.value.surfaceOffset,
))
const mouthAnchor = computed(() => resolveCloudFoxMuzzleSurfaceAnchor(
  { shape: props.appearance.parts.headShape, headScale: headScale.value },
  mouth.value.offsetX * headScale.value,
  (-.17 + mouth.value.offsetY) * headScale.value,
  mouth.value.surfaceOffset,
))
const nosePosition = computed(() => vector(noseAnchor.value.position))
const noseRotation = computed(() => rotation([noseAnchor.value.rotation[0], noseAnchor.value.rotation[1], nose.value.rotation]))
const mouthPosition = computed(() => vector(mouthAnchor.value.position))
const mouthRotation = computed(() => rotation([mouthAnchor.value.rotation[0], mouthAnchor.value.rotation[1], mouth.value.rotation]))
const noseScale = computed(() => {
  let base: readonly [number, number, number] = [.11, .085, .07]
  if (props.appearance.parts.nose === 'sensor') base = [.16, .085, .075]
  else if (props.appearance.parts.nose === 'button') base = [.135, .105, .068]
  else if (props.appearance.parts.nose === 'heart') base = [.115, .115, .07]
  else if (props.appearance.parts.nose === 'triangle') base = [.135, .12, .082]
  else if (props.appearance.parts.nose === 'cat') base = [.13, .1, .075]
  else if (props.appearance.parts.nose === 'crystal') base = [.13, .13, .09]
  else if (props.appearance.parts.nose === 'starlight') base = [.14, .14, .08]
  const sniff = customPoseValue(props.customPose, 'nose.sniff')
  return vector([
    base[0] * headScale.value * nose.value.scaleX * customPoseScale(props.customPose, 'nose.scale.x') * (1 + sniff * .12),
    base[1] * headScale.value * nose.value.scaleY * customPoseScale(props.customPose, 'nose.scale.y') * (1 - sniff * .08),
    base[2] * headScale.value * nose.value.scaleZ * customPoseScale(props.customPose, 'nose.scale.z') * (1 + sniff * .16),
  ])
})
const noseGlow = computed(() => customPoseValue(props.customPose, 'nose.glow') * 2.4)
const mouthBaseScale = computed(() => vector([headScale.value * mouth.value.width, headScale.value * mouth.value.height, headScale.value]))
const openScale = computed(() => mouth.value.defaultOpen + animatedOpen.value * Math.max(0, mouth.value.maxOpen - mouth.value.defaultOpen))
const classicGap = computed(() => .046 + animatedOpen.value * .018)
const tongueScale = computed(() => mouth.value.tongueScale * (1 + animatedOpen.value * .12))
const lineThickness = computed(() => .014 * mouth.value.thickness)
const curveThickness = computed(() => .014 * mouth.value.thickness)
const curveScale = computed(() => vector([1, mouth.value.curve * (1 + animatedOpen.value * .1 + customPoseValue(props.customPose, 'mouth.curve') * .45), 1]))
const smileLeft = new CatmullRomCurve3([vector([-.17, .02, 0]), vector([-.12, -.035, .004]), vector([-.06, -.06, .006]), vector([0, -.052, .008])])
const smileRight = new CatmullRomCurve3([vector([0, -.052, .008]), vector([.06, -.06, .006]), vector([.12, -.035, .004]), vector([.17, .02, 0])])
const catLeft = new CatmullRomCurve3([vector([-.16, .015, 0]), vector([-.11, -.055, .004]), vector([-.05, -.07, .006]), vector([0, -.018, .008])])
const catRight = new CatmullRomCurve3([vector([0, -.018, .008]), vector([.05, -.07, .006]), vector([.11, -.055, .004]), vector([.16, .015, 0])])
function cheekPosition(side: number) {
  const anchor = resolveCloudFoxMuzzleSurfaceAnchor({ shape: props.appearance.parts.headShape, headScale: headScale.value }, side * .25 * headScale.value, -.1 * headScale.value, .008)
  return vector(anchor.position)
}
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
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, Math.max(0, elapsed - startedAt))
  let targetOpen = 0
  if (props.behavior === 'talking') targetOpen = .35 + Math.max(0, Math.sin(elapsed * 10)) * .55
  else if (props.behavior === 'eating') targetOpen = .25 + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 14)) * .7
  else if (props.behavior === 'sparkle-sneeze') targetOpen = frame.sneezeRelease
  else if (props.behavior === 'happy' || props.behavior === 'excited') targetOpen = .18
  const resolvedOpen = hasAuthoredPoseChannel(props.customPose, 'mouth.open') ? customPoseValue(props.customPose, 'mouth.open') : Math.min(1, targetOpen)
  animatedOpen.value = damp(animatedOpen.value, resolvedOpen, 12, delta)
  const cheekOpacity = props.behavior === 'happy' || props.behavior === 'talking' || props.behavior === 'excited'
    ? .34
    : props.behavior === 'flapping'
      ? .56 + Math.sin((elapsed - startedAt) * 2.1) * .055
      : props.behavior === 'greeting' || props.behavior === 'jumping' || props.behavior === 'shy-peek'
        ? .28
        : 0
  for (const material of cheekMaterials.value) material.opacity = damp(material.opacity, cheekOpacity, 9, delta)
})
</script>

<template>
  <TresGroup>
    <TresGroup :position="nosePosition" :rotation="noseRotation" :scale="noseScale">
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
      <template v-else-if="appearance.parts.nose === 'cat'">
        <TresMesh :rotation="rotation([Math.PI / 2, 0, 0])"><TresConeGeometry :args="[1, 1.05, 3]" /><TresMeshStandardMaterial :color="colors.nose" :emissive="colors.antennaTip" :emissive-intensity="noseGlow" :roughness=".18" /></TresMesh>
        <TresMesh :position="vector([0, -.18, .25])" :scale="vector([.36, .22, .2])"><TresSphereGeometry /><TresMeshStandardMaterial :color="colors.nose" :roughness=".2" /></TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.nose === 'crystal'"><TresOctahedronGeometry :args="[1, 0]" /><TresMeshStandardMaterial :color="colors.nose" :emissive="colors.antennaTip" :emissive-intensity=".35 + noseGlow" :metalness=".45" :roughness=".08" /></TresMesh>
      <TresMesh v-else-if="appearance.parts.nose === 'starlight'"><TresDodecahedronGeometry :args="[1, 0]" /><TresMeshStandardMaterial :color="colors.antennaTip" :emissive="colors.antennaTip" :emissive-intensity=".7 + noseGlow" :metalness=".2" :roughness=".1" /></TresMesh>
      <TresMesh v-else><TresSphereGeometry :args="[1, 32, 24]" /><TresMeshStandardMaterial :color="colors.nose" :emissive="colors.antennaTip" :emissive-intensity="noseGlow" :roughness=".22" /></TresMesh>
    </TresGroup>
    <TresMesh v-for="side in [-1, 1]" :key="`face-cheek-${side}`" :position="cheekPosition(side)" :scale="vector([.13 * headScale, .07 * headScale, .018 * headScale])"><TresSphereGeometry /><TresMeshBasicMaterial :ref="registerCheek" :color="colors.cheeks" transparent :opacity="0" :depth-write="false" /></TresMesh>
    <TresGroup :position="mouthPosition" :rotation="mouthRotation" :scale="mouthBaseScale">
      <template v-if="appearance.parts.mouth === 'smile'">
        <TresMesh :position="vector([-classicGap, .008, 0])" :scale="vector([.07, .042, .014])"><TresSphereGeometry :args="[1, 28, 20]" /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".2" /></TresMesh>
        <TresMesh :position="vector([classicGap, .008, 0])" :scale="vector([.07, .042, .014])"><TresSphereGeometry :args="[1, 28, 20]" /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".2" /></TresMesh>
        <TresMesh v-if="mouth.tongueVisible" :position="vector([0, -.034 + mouth.tongueOffsetY - animatedOpen * .01, .006])" :scale="vector([.052 * tongueScale, .02 * tongueScale, .006])"><TresSphereGeometry :args="[1, 24, 16]" /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <template v-else-if="appearance.parts.mouth === 'cat'"><TresGroup :scale="curveScale"><TresMesh><TresTubeGeometry :args="[catLeft, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh><TresMesh><TresTubeGeometry :args="[catRight, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh></TresGroup></template>
      <TresMesh v-else-if="appearance.parts.mouth === 'line'" :position="vector([0, animatedOpen * -.008, 0])" :scale="vector([.18, lineThickness, .008])"><TresBoxGeometry /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else-if="appearance.parts.mouth === 'open'">
        <TresMesh :scale="vector([.13, .15 * openScale, 1])"><TresCircleGeometry :args="[1, 40]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
        <TresMesh v-if="mouth.tongueVisible" :position="vector([0, -.055 * openScale + mouth.tongueOffsetY, .002])" :scale="vector([.082 * tongueScale, .042 * tongueScale, 1])"><TresCircleGeometry :args="[1, 32]" /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'pout'" :scale="vector([1 + animatedOpen * .08, 1 + animatedOpen * .08, 1])"><TresTorusGeometry :args="[.052, .012 * mouth.thickness, 10, 36]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else><TresGroup :scale="curveScale"><TresMesh><TresTubeGeometry :args="[smileLeft, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh><TresMesh><TresTubeGeometry :args="[smileRight, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh></TresGroup></template>
    </TresGroup>
  </TresGroup>
</template>
