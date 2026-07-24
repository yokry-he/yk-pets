<!--
  文件职责 / File responsibility
  管理唯一头部动作根节点，并以真实头部表面采样挂载眼睛、独立头型、耳朵、触角与唯一 FaceRoot。
  Owns the sole animated head root and mounts eyes through real head-surface sampling alongside the independent shell, ears, antennae, and FaceRoot.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Color, Euler, Vector3 } from 'three'
import type { Group, MeshStandardMaterial } from 'three'
import ExtensionCloudFoxEyeShape from './ExtensionCloudFoxEyeShape.vue'
import ExtensionCloudFoxFaceCustomization from './ExtensionCloudFoxFaceCustomization.vue'
import ExtensionCloudFoxHeadShape from './ExtensionCloudFoxHeadShape.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, mix, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { getCloudFoxEyeBlinkFloor } from '~/domain/cloud-fox-eye-metrics'
import { getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
import { resolveCloudFoxEyeSurfaceAnchor, sampleCloudFoxHeadFrontSurfaceAtLocalXY } from '~/domain/cloud-fox-surface-model'
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
const profile = computed(() => getCloudFoxHeadProfile(props.appearance.parts.headShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)
const headScale = computed(() => props.appearance.proportions.headScale)
const eyeBlinkFloor = computed(() => getCloudFoxEyeBlinkFloor(props.appearance.parts.eyes))
const head = shallowRef<Group>()
const leftEye = shallowRef<Group>()
const rightEye = shallowRef<Group>()
const leftEar = shallowRef<Group>()
const rightEar = shallowRef<Group>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const glowMaterials = shallowRef<MeshStandardMaterial[]>([])

const headPosition = computed(() => vector([
  scheme.model.head.position[0] + profile.value.offset[0] * headScale.value,
  scheme.model.head.position[1] + profile.value.offset[1] * headScale.value,
  scheme.model.head.position[2] + profile.value.offset[2] * headScale.value,
]))
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing * profile.value.eyeX * headScale.value)
const eyeY = computed(() => (scheme.model.head.eyeOffset[1] + profile.value.eyeY) * headScale.value)
const earX = computed(() => scheme.model.head.earOffset[0] * props.appearance.proportions.earScale * profile.value.earX * headScale.value)
const earY = computed(() => (scheme.model.head.earOffset[1] + profile.value.earY) * headScale.value)
const earZ = computed(() => scheme.model.head.earOffset[2] * headScale.value)
const antennaX = computed(() => props.appearance.antennaDesign.spacing / 2 * headScale.value)
const antennaScaleY = computed(() => props.appearance.proportions.antennaScale * (props.appearance.antennaDesign.length / scheme.model.antenna.rod[2]))
const antennaRod = computed(() => [
  scheme.model.antenna.rod[0] * (props.appearance.antennaDesign.thickness / scheme.model.antenna.rod[1]),
  props.appearance.antennaDesign.thickness,
  scheme.model.antenna.rod[2],
  scheme.model.antenna.rod[3],
] as const)
const antennaRootY = computed(() => (scheme.model.antenna.offset[1] + profile.value.antennaY) * headScale.value)
const muzzlePosition = computed(() => vector([
  (scheme.model.head.muzzlePosition[0] + profile.value.muzzleOffset[0]) * headScale.value,
  (scheme.model.head.muzzlePosition[1] + profile.value.muzzleOffset[1]) * headScale.value,
  (scheme.model.head.muzzlePosition[2] + profile.value.muzzleOffset[2]) * headScale.value,
]))
const muzzleScale = computed(() => vector([
  scheme.model.head.muzzleScale[0] * profile.value.muzzleScale[0] * headScale.value,
  scheme.model.head.muzzleScale[1] * profile.value.muzzleScale[1] * headScale.value,
  scheme.model.head.muzzleScale[2] * profile.value.muzzleScale[2] * headScale.value,
]))
const visorScale = computed(() => vector([.72 * profile.value.eyeX * headScale.value, .16 * headScale.value, .08 * headScale.value]))
const visorSurface = computed(() => {
  const sample = sampleCloudFoxHeadFrontSurfaceAtLocalXY({ shape: props.appearance.parts.headShape, headScale: headScale.value }, 0, eyeY.value)
  return {
    position: vector([
      sample.position[0] + sample.normal[0] * .025 * headScale.value,
      sample.position[1] + sample.normal[1] * .025 * headScale.value,
      sample.position[2] + sample.normal[2] * .025 * headScale.value,
    ]),
    rotation: rotation([
      -Math.atan2(sample.normal[1], Math.hypot(sample.normal[0], sample.normal[2])),
      Math.atan2(sample.normal[0], sample.normal[2]),
      0,
    ]),
  }
})

function eyeSurface(side: number) {
  return resolveCloudFoxEyeSurfaceAnchor({
    shape: props.appearance.parts.headShape,
    headScale: headScale.value,
    eyeSpacing: props.appearance.proportions.eyeSpacing,
  }, side < 0 ? -1 : 1)
}
function eyePosition(side: number) { return vector(eyeSurface(side).position) }
function eyeRotation(side: number) { return rotation(eyeSurface(side).rotation) }
function setEyeRef(node: unknown, side: number) {
  if (side < 0) leftEye.value = node as Group | undefined
  else rightEye.value = node as Group | undefined
}
function setEarRef(node: unknown, side: number) {
  if (side < 0) leftEar.value = node as Group | undefined
  else rightEar.value = node as Group | undefined
}
function setAntennaRef(node: unknown, side: number) {
  if (side < 0) leftAntenna.value = node as Group | undefined
  else rightAntenna.value = node as Group | undefined
}
function registerGlow(reference: unknown) {
  const material = reference as MeshStandardMaterial | null
  if (material && !glowMaterials.value.includes(material)) glowMaterials.value.push(material)
}

const rainbow = new Color()
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const state = props.behavior
  const root = head.value
  if (root) {
    let targetX = 0
    let targetY = 0
    let targetZ = profile.value.rotationZ
    let targetPositionX = scheme.model.head.position[0] + profile.value.offset[0] * headScale.value
    let targetPositionY = scheme.model.head.position[1] + profile.value.offset[1] * headScale.value + frame.stretchBreath
    if (state === 'greeting') targetZ += Math.sin(stateElapsed * 5.8) * .13 * frame.greetingPose
    else if (state === 'resting') { targetX = .24 * frame.restingPose; targetPositionY -= .12 * frame.restingPose }
    else if (state === 'sleeping') targetX = .14
    else if (state === 'cloud-nap') { targetX = .18 * frame.cloudNapPose; targetZ += .34 * frame.cloudNapPose; targetPositionX -= .1 * frame.cloudNapPose; targetPositionY -= .08 * frame.cloudNapPose }
    else if (state === 'thinking') targetZ += -.14 + Math.sin(elapsed * 1.8) * .035
    else if (state === 'confused') targetZ += Math.sin(elapsed * 2.2) * .18
    else if (state === 'listening') targetZ -= .16
    else if (state === 'stretching') { targetX = -.5 * frame.stretchStrength; targetPositionY += .08 * frame.stretchStrength }
    else if (state === 'shy-peek') targetZ -= .16 * frame.shyPose
    else if (state === 'sparkle-sneeze') targetX = -.12 * frame.sneezeCharge + .34 * frame.sneezeRelease
    else if (state === 'curious-scan') { targetY = Math.sin(frame.curiousProgress * Math.PI * 3) * .24 * frame.curiousPose; targetZ += Math.cos(frame.curiousProgress * Math.PI * 2) * .12 * frame.curiousPose }
    else if (state === 'playing' || state === 'flapping') targetZ += Math.sin(elapsed * 4.6) * .08
    else if (state === 'eating') targetX = .3 * smoothStep(.04, .22, frame.eatProgress)
    else if (state === 'star-juggle') { targetY = Math.sin(frame.juggleProgress * Math.PI * 6) * .18 * frame.jugglePose; targetX = -.12 * frame.jugglePose }
    else if (state === 'backflip') targetX = -.16 * frame.backflipTuck
    else if (state === 'energy-burst') targetX = -.16 * frame.energyCharge + .12 * frame.energyRelease
    else if (state === 'waking') targetX = mix(.14, 0, smoothStep(.04, .72, frame.progress))
    root.rotation.x = damp(root.rotation.x, targetX, 7, delta)
    root.rotation.y = damp(root.rotation.y, targetY, 7, delta)
    root.rotation.z = damp(root.rotation.z, targetZ, 7, delta)
    root.position.x = damp(root.position.x, targetPositionX, 7, delta)
    root.position.y = damp(root.position.y, targetPositionY + (state === 'happy' ? Math.max(0, Math.sin(elapsed * 8)) * .035 : 0), 7, delta)
  }

  const asleep = state === 'sleeping' || state === 'cloud-nap'
  const resting = state === 'resting'
  const blinkPhase = (elapsed + .73) % 4.8
  const blinkDistance = Math.abs(blinkPhase - 4.64)
  const blink = blinkDistance < .13 ? .08 + blinkDistance / .13 * .92 : 1
  const wakeOpen = state === 'waking' ? smoothStep(.08, .72, frame.progress) : 1
  const sneezeSquint = state === 'sparkle-sneeze' ? 1 - frame.sneezeCharge * .72 : 1
  const shySquint = state === 'shy-peek' ? 1 - frame.shyPose * .45 : 1
  const stretchOpen = state === 'stretching' ? mix(1, .08, frame.stretchStrength) : 1
  const baseEyeY = asleep ? .08 : resting ? mix(1, .34, frame.restingPose) : blink * wakeOpen * sneezeSquint * shySquint * stretchOpen
  const scanOffset = state === 'curious-scan' ? Math.sin(frame.curiousProgress * Math.PI * 3) * .035 * frame.curiousPose : state === 'star-juggle' ? Math.sin(frame.juggleProgress * Math.PI * 6) * .028 : 0
  const updateEye = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const expressionScale = state === 'confused' && side < 0 ? baseEyeY * .72 : baseEyeY
    const visibleScale = props.appearance.parts.eyes === 'sleepy' ? 1 : Math.max(eyeBlinkFloor.value, expressionScale)
    group.scale.y = damp(group.scale.y, visibleScale, 12, delta)
    group.scale.x = damp(group.scale.x, state === 'excited' ? 1.14 : 1, 10, delta)
    group.position.x = damp(group.position.x, side * eyeX.value + scanOffset, 9, delta)
    group.position.y = damp(group.position.y, eyeY.value, 9, delta)
  }
  updateEye(leftEye.value, -1)
  updateEye(rightEye.value, 1)

  const earEnergy = state === 'energy-burst' ? frame.energyCharge * .16 + frame.energyRelease * .12 : state === 'antenna-charge' ? frame.antennaChargePose * .14 : state === 'excited' || state === 'playing' || state === 'flapping' ? Math.sin(elapsed * 8) * .08 : state === 'confused' ? Math.sin(elapsed * 3.2) * .1 : 0
  if (leftEar.value) leftEar.value.rotation.z = damp(leftEar.value.rotation.z, -scheme.model.head.earRotationZ + earEnergy, 8, delta)
  if (rightEar.value) rightEar.value.rotation.z = damp(rightEar.value.rotation.z, scheme.model.head.earRotationZ - earEnergy, 8, delta)

  const antennaCharge = state === 'antenna-charge' ? frame.antennaChargePose * 1.2 + frame.antennaRelease * .9 : state === 'energy-burst' ? frame.energyCharge + frame.energyRelease * .78 : state === 'fireworks-show' ? .7 + Math.sin(frame.fireworksProgress * Math.PI * 6) * .18 : state === 'sparkle-sneeze' ? frame.sneezeCharge + frame.sneezeRelease * .7 : state === 'star-juggle' ? .42 : state === 'excited' || state === 'thinking' ? .36 : frame.highEnergy ? .28 : .12
  const antennaSway = Math.sin(elapsed * (state === 'energy-burst' ? 9 : state === 'excited' ? 6.5 : 3.4)) * (state === 'energy-burst' ? .08 : .035)
  if (leftAntenna.value) {
    const converge = state === 'antenna-charge' ? frame.antennaChargePose * .42 : 0
    leftAntenna.value.rotation.z = damp(leftAntenna.value.rotation.z, -props.appearance.antennaDesign.tilt - antennaCharge * .1 + converge - antennaSway, 8, delta)
    leftAntenna.value.scale.y = damp(leftAntenna.value.scale.y, 1 + antennaCharge * .16, 7, delta)
  }
  if (rightAntenna.value) {
    const converge = state === 'antenna-charge' ? frame.antennaChargePose * .42 : 0
    rightAntenna.value.rotation.z = damp(rightAntenna.value.rotation.z, props.appearance.antennaDesign.tilt + antennaCharge * .1 - converge + antennaSway, 8, delta)
    rightAntenna.value.scale.y = damp(rightAntenna.value.scale.y, 1 + antennaCharge * .16, 7, delta)
  }
  const pulseValue = 1 + Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.5) * .12
  if (props.appearance.glow.mode === 'rainbow') rainbow.setHSL((elapsed * .11) % 1, .86, .64)
  for (const material of glowMaterials.value) {
    material.emissiveIntensity = props.appearance.glow.intensity * pulseValue + antennaCharge * 3.6
    if (props.appearance.glow.mode === 'rainbow') { material.color.copy(rainbow); material.emissive.copy(rainbow) }
  }
})
</script>

<template>
  <TresGroup ref="head" :position="headPosition">
    <ExtensionCloudFoxHeadShape :appearance="appearance" />

    <TresGroup
      v-for="side in [-1, 1]"
      :key="`ear-${side}`"
      :ref="node => setEarRef(node, side)"
      :position="vector([side * earX, earY, earZ])"
      :rotation="rotation([0, 0, side * scheme.model.head.earRotationZ])"
      :scale="vector([appearance.proportions.earScale * headScale, appearance.proportions.earScale * headScale, appearance.proportions.earScale * headScale])"
    >
      <TresMesh cast-shadow>
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.34, 28, 28]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.54, .86, .42]" />
        <TresConeGeometry v-else :args="scheme.model.head.earOuter" />
        <TresMeshStandardMaterial :color="colors.earOuter" :roughness="appearance.parts.ears === 'mechanical' ? .22 : .3" :metalness="appearance.parts.ears === 'mechanical' ? .68 : .04" />
      </TresMesh>
      <TresMesh :position="vector(scheme.model.head.earInnerPosition)" :scale="vector(scheme.model.head.earInnerScale)">
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.28, 24, 24]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.42, .66, .2]" />
        <TresConeGeometry v-else :args="scheme.model.head.earInner" />
        <TresMeshStandardMaterial :color="colors.earInner" :emissive="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowColor : '#000000'" :emissive-intensity="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowIntensity : 0" :roughness=".24" />
      </TresMesh>
      <TresMesh v-if="appearance.parts.ears !== 'rounded' && appearance.parts.ears !== 'floppy'" :position="vector([0, .28, .055])" :scale="vector([.34, .34, .34])">
        <TresConeGeometry :args="[.22, .42, appearance.parts.ears === 'petal' ? 6 : 4]" />
        <TresMeshStandardMaterial :color="colors.earTip" :roughness=".2" />
      </TresMesh>
    </TresGroup>

    <template v-if="appearance.parts.antenna !== 'none'">
      <TresGroup
        v-for="side in [-1, 1]"
        :key="`antenna-${side}`"
        :ref="node => setAntennaRef(node, side)"
        :position="vector([side * antennaX, antennaRootY, scheme.model.antenna.offset[2] * headScale])"
        :rotation="rotation([scheme.model.antenna.rotation[0], side < 0 ? scheme.model.antenna.rotation[1] : -scheme.model.antenna.rotation[1], side * appearance.antennaDesign.tilt])"
        :scale="vector([appearance.proportions.antennaScale * headScale, antennaScaleY * headScale, appearance.proportions.antennaScale * headScale])"
      >
        <TresMesh :position="vector(scheme.model.antenna.rodPosition)"><TresCylinderGeometry :args="antennaRod" /><TresMeshStandardMaterial :color="colors.antennaRod" :roughness=".22" /></TresMesh>
        <TresMesh :position="vector([side * scheme.model.antenna.tipPosition[0], scheme.model.antenna.tipPosition[1], scheme.model.antenna.tipPosition[2]])">
          <TresTorusGeometry v-if="appearance.parts.antennaTip === 'ring'" :args="[.12, .035, 12, 28]" />
          <TresDodecahedronGeometry v-else-if="appearance.parts.antennaTip === 'crystal'" :args="[.11, 0]" />
          <TresSphereGeometry v-else :args="[scheme.model.antenna.tipRadius, 20, 20]" />
          <TresMeshStandardMaterial :ref="registerGlow" :color="colors.antennaTip" :emissive="colors.antennaTip" :emissive-intensity="1.6" transparent :opacity=".9" :roughness=".1" />
        </TresMesh>
      </TresGroup>
    </template>

    <TresMesh :position="muzzlePosition" :scale="muzzleScale">
      <TresSphereGeometry :args="[scheme.model.head.muzzleRadius, 48, 48]" />
      <TresMeshStandardMaterial :color="colors.muzzle" :roughness=".34" />
    </TresMesh>

    <template v-if="appearance.parts.eyes !== 'visor'">
      <TresGroup v-for="side in [-1, 1]" :key="`eye-${side}`" :ref="node => setEyeRef(node, side)" :position="eyePosition(side)" :rotation="eyeRotation(side)">
        <ExtensionCloudFoxEyeShape :style="appearance.parts.eyes" :color="colors.eyes" :highlight-color="colors.eyeHighlight" :side="side" :eye-scale="appearance.proportions.eyeScale * headScale" />
      </TresGroup>
    </template>
    <TresMesh v-else :position="visorSurface.position" :rotation="visorSurface.rotation" :scale="visorScale">
      <TresBoxGeometry /><TresMeshStandardMaterial :color="colors.eyes" :emissive="colors.eyeHighlight" :emissive-intensity=".42" :roughness=".16" />
    </TresMesh>

    <ExtensionCloudFoxFaceCustomization :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
  </TresGroup>
</template>
