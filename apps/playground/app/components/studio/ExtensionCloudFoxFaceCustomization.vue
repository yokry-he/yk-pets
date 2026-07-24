<!--
  文件职责 / File responsibility
  在唯一口鼻部表面坐标中渲染鼻子与五种嘴型；经典嘴、曲线嘴、张嘴和嘟嘴分别解释动作开合，不再整体膨胀或侧面悬浮。
  Renders noses and five mouth styles in the sole muzzle-surface coordinate space; each mouth interprets motion independently instead of inflating or floating in side views.
-->
<script setup lang="ts">
import { CatmullRomCurve3, Euler, Vector3 } from 'three'
import type { MeshBasicMaterial } from 'three'
import { useLoop } from '@tresjs/core'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { resolveCloudFoxMuzzleSurfaceAnchor } from '~/domain/cloud-fox-surface-model'
import { resolvePetCustomization, type CustomizableAppearanceRecipe } from '~/domain/pet-part-customization'

const props = defineProps<{ appearance: CustomizableAppearanceRecipe; behavior: ExtensionCloudFoxMotionId; motionKey: number }>()
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const customization = computed(() => resolvePetCustomization(props.appearance))
const colors = computed(() => customization.value.colors)
const design = computed(() => customization.value.mouth)
const headScale = computed(() => props.appearance.proportions.headScale)
const cheekMaterials = shallowRef<MeshBasicMaterial[]>([])
const animatedOpen = ref(0)
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

const noseAnchor = computed(() => resolveCloudFoxMuzzleSurfaceAnchor({ shape: props.appearance.parts.headShape, headScale: headScale.value }, 0, -.02 * headScale.value, .012))
const mouthAnchor = computed(() => resolveCloudFoxMuzzleSurfaceAnchor(
  { shape: props.appearance.parts.headShape, headScale: headScale.value },
  design.value.offsetX * headScale.value,
  (-.17 + design.value.offsetY) * headScale.value,
  design.value.surfaceOffset,
))
const nosePosition = computed(() => vector(noseAnchor.value.position))
const noseRotation = computed(() => rotation(noseAnchor.value.rotation))
const mouthPosition = computed(() => vector(mouthAnchor.value.position))
const mouthRotation = computed(() => rotation([mouthAnchor.value.rotation[0], mouthAnchor.value.rotation[1], design.value.rotation]))
const noseScale = computed(() => {
  const factor = headScale.value
  if (props.appearance.parts.nose === 'sensor') return vector([.16 * factor, .085 * factor, .075 * factor])
  if (props.appearance.parts.nose === 'button') return vector([.135 * factor, .105 * factor, .068 * factor])
  if (props.appearance.parts.nose === 'heart') return vector([.115 * factor, .115 * factor, .07 * factor])
  if (props.appearance.parts.nose === 'triangle') return vector([.135 * factor, .12 * factor, .082 * factor])
  return vector([.11 * factor, .085 * factor, .07 * factor])
})
const mouthBaseScale = computed(() => vector([headScale.value * design.value.width, headScale.value * design.value.height, headScale.value]))
const openScale = computed(() => design.value.defaultOpen + animatedOpen.value * Math.max(0, design.value.maxOpen - design.value.defaultOpen))
const classicGap = computed(() => .046 + animatedOpen.value * .018)
const tongueScale = computed(() => design.value.tongueScale * (1 + animatedOpen.value * .12))
const lineThickness = computed(() => .014 * design.value.thickness)
const curveThickness = computed(() => .014 * design.value.thickness)
const curveScale = computed(() => vector([1, design.value.curve * (1 + animatedOpen.value * .1), 1]))

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
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) { previousBehavior = props.behavior; previousMotionKey = props.motionKey; startedAt = elapsed }
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, Math.max(0, elapsed - startedAt))
  let targetOpen = 0
  if (props.behavior === 'talking') targetOpen = .35 + Math.max(0, Math.sin(elapsed * 10)) * .55
  else if (props.behavior === 'eating') targetOpen = .25 + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 14)) * .7
  else if (props.behavior === 'sparkle-sneeze') targetOpen = frame.sneezeRelease
  else if (props.behavior === 'happy' || props.behavior === 'excited') targetOpen = .18
  animatedOpen.value = damp(animatedOpen.value, Math.min(1, targetOpen), 12, delta)
  const cheekOpacity = props.behavior === 'happy' || props.behavior === 'talking' || props.behavior === 'excited' ? .34
    : props.behavior === 'flapping' ? .56 + Math.sin((elapsed - startedAt) * 2.1) * .055
      : props.behavior === 'greeting' || props.behavior === 'jumping' || props.behavior === 'shy-peek' ? .28 : 0
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
      <TresMesh v-else><TresSphereGeometry :args="[1, 32, 24]" /><TresMeshStandardMaterial :color="colors.nose" :roughness=".22" /></TresMesh>
    </TresGroup>

    <TresMesh v-for="side in [-1, 1]" :key="`face-cheek-${side}`" :position="cheekPosition(side)" :scale="vector([.13 * headScale, .07 * headScale, .018 * headScale])">
      <TresSphereGeometry /><TresMeshBasicMaterial :ref="registerCheek" :color="colors.cheeks" transparent :opacity="0" :depth-write="false" />
    </TresMesh>

    <TresGroup :position="mouthPosition" :rotation="mouthRotation" :scale="mouthBaseScale">
      <template v-if="appearance.parts.mouth === 'smile'">
        <TresMesh :position="vector([-classicGap, .008, 0])" :scale="vector([.07, .042, .014])"><TresSphereGeometry :args="[1, 28, 20]" /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".2" /></TresMesh>
        <TresMesh :position="vector([classicGap, .008, 0])" :scale="vector([.07, .042, .014])"><TresSphereGeometry :args="[1, 28, 20]" /><TresMeshStandardMaterial :color="colors.mouth" :roughness=".2" /></TresMesh>
        <TresMesh v-if="design.tongueVisible" :position="vector([0, -.034 + design.tongueOffsetY - animatedOpen * .01, .006])" :scale="vector([.052 * tongueScale, .02 * tongueScale, .006])"><TresSphereGeometry :args="[1, 24, 16]" /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <template v-else-if="appearance.parts.mouth === 'cat'">
        <TresGroup :scale="curveScale"><TresMesh><TresTubeGeometry :args="[catLeft, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh><TresMesh><TresTubeGeometry :args="[catRight, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh></TresGroup>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'line'" :position="vector([0, animatedOpen * -.008, 0])" :scale="vector([.18, lineThickness, .008])"><TresBoxGeometry /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else-if="appearance.parts.mouth === 'open'">
        <TresMesh :scale="vector([.13, .15 * openScale, 1])"><TresCircleGeometry :args="[1, 40]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
        <TresMesh v-if="design.tongueVisible" :position="vector([0, -.055 * openScale + design.tongueOffsetY, .002])" :scale="vector([.082 * tongueScale, .042 * tongueScale, 1])"><TresCircleGeometry :args="[1, 32]" /><TresMeshBasicMaterial :color="colors.tongue" /></TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'pout'" :scale="vector([1 + animatedOpen * .08, 1 + animatedOpen * .08, 1])"><TresTorusGeometry :args="[.052, .012 * design.thickness, 10, 36]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh>
      <template v-else>
        <TresGroup :scale="curveScale"><TresMesh><TresTubeGeometry :args="[smileLeft, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh><TresMesh><TresTubeGeometry :args="[smileRight, 24, curveThickness, 8, false]" /><TresMeshBasicMaterial :color="colors.mouth" /></TresMesh></TresGroup>
      </template>
    </TresGroup>
  </TresGroup>
</template>
