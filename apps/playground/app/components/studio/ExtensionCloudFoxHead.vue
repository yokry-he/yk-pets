<!--
  文件职责 / File responsibility
  渲染共享 Shape Profile 驱动的唯一云狐头部、六种匹配头型、不同眼睛、耳朵、触角与唯一鼻嘴层级，并保留完整头部动作。
  Renders the sole Shape-Profile-driven Cloud Fox head with six matching head forms, distinct eyes, ears, antennae, and one face hierarchy while retaining full head motion.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Color, Euler, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Group, MeshStandardMaterial } from 'three'
import ExtensionCloudFoxFaceCustomization from './ExtensionCloudFoxFaceCustomization.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, mix, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
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
const scaled = (values: readonly number[], multiplier = 1) => new Vector3(
  (values[0] || 0) * multiplier,
  (values[1] || 0) * multiplier,
  (values[2] || 0) * multiplier,
)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

const head = shallowRef<Group>()
const leftEye = shallowRef<Group>()
const rightEye = shallowRef<Group>()
const leftEar = shallowRef<Group>()
const rightEar = shallowRef<Group>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const glowMaterials = shallowRef<MeshStandardMaterial[]>([])
const profile = computed(() => getCloudFoxShapeProfile(props.appearance.parts.bodyShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)
const headScale = computed(() => vector([
  scheme.model.head.scale[0] * props.appearance.proportions.headScale * profile.value.headScale[0],
  scheme.model.head.scale[1] * props.appearance.proportions.headScale * profile.value.headScale[1],
  scheme.model.head.scale[2] * props.appearance.proportions.headScale * profile.value.headScale[2],
]))
const headPosition = computed(() => vector([
  scheme.model.head.position[0] + profile.value.headOffset[0],
  scheme.model.head.position[1] + profile.value.headOffset[1],
  scheme.model.head.position[2] + profile.value.headOffset[2],
]))
const headRotation = computed(() => rotation([0, 0, profile.value.headRotationZ]))
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing * profile.value.eyeXScale)
const eyeY = computed(() => scheme.model.head.eyeOffset[1] + profile.value.eyeY)
const eyeZ = computed(() => scheme.model.head.eyeOffset[2] + profile.value.eyeZ)
const earX = computed(() => scheme.model.head.earOffset[0] * props.appearance.proportions.earScale * profile.value.earXScale)
const antennaX = computed(() => props.appearance.antennaDesign.spacing / 2)
const antennaY = computed(() => props.appearance.proportions.antennaScale * (props.appearance.antennaDesign.length / scheme.model.antenna.rod[2]))
const antennaRod = computed(() => [
  scheme.model.antenna.rod[0] * (props.appearance.antennaDesign.thickness / scheme.model.antenna.rod[1]),
  props.appearance.antennaDesign.thickness,
  scheme.model.antenna.rod[2],
  scheme.model.antenna.rod[3],
] as const)
const muzzlePosition = computed(() => vector([
  scheme.model.head.muzzlePosition[0] + profile.value.muzzleOffset[0],
  scheme.model.head.muzzlePosition[1] + profile.value.muzzleOffset[1],
  scheme.model.head.muzzlePosition[2] + profile.value.muzzleOffset[2],
]))
const muzzleScale = computed(() => vector([
  scheme.model.head.muzzleScale[0] * profile.value.muzzleScale[0],
  scheme.model.head.muzzleScale[1] * profile.value.muzzleScale[1],
  scheme.model.head.muzzleScale[2] * profile.value.muzzleScale[2],
]))
const highlightX = Math.abs(scheme.model.head.eyeHighlightPosition[0])
const roundedHeadGeometry = new RoundedBoxGeometry(1.72, 1.56, 1.46, 6, .28)
onBeforeUnmount(() => roundedHeadGeometry.dispose())

function setEyeRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftEye.value = group
  else rightEye.value = group
}
function setEarRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftEar.value = group
  else rightEar.value = group
}
function setAntennaRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftAntenna.value = group
  else rightAntenna.value = group
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
  const ballPose = createBallMotionPose(frame.ballProgress)
  const catchPose = createCatchMotionPose(frame.catchProgress)
  const state = props.behavior
  const trackedPropPosition = state === 'playing-ball'
    ? ballPose.position
    : state === 'diving-catch'
      ? catchPose.ballPosition
      : undefined

  if (head.value) {
    let targetX = 0
    let targetY = 0
    let targetZ = profile.value.headRotationZ
    let targetPositionX = profile.value.headOffset[0]
    let targetPositionY = scheme.model.head.position[1] + profile.value.headOffset[1] + frame.stretchBreath

    if (state === 'greeting') targetZ += Math.sin(stateElapsed * 5.8) * .13 * frame.greetingPose
    else if (state === 'resting') {
      targetX = .24 * frame.restingPose
      targetPositionY -= .12 * frame.restingPose
    }
    else if (state === 'sleeping') targetX = .14
    else if (state === 'cloud-nap') {
      targetX = .18 * frame.cloudNapPose
      targetZ += .34 * frame.cloudNapPose
      targetPositionX -= .1 * frame.cloudNapPose
      targetPositionY -= .08 * frame.cloudNapPose
    }
    else if (state === 'thinking') targetZ += -.14 + Math.sin(elapsed * 1.8) * .035
    else if (state === 'confused') targetZ += Math.sin(elapsed * 2.2) * .18
    else if (state === 'listening') targetZ += -.16
    else if (state === 'stretching') {
      targetX = -.5 * frame.stretchStrength
      targetPositionY += .08 * frame.stretchStrength
    }
    else if (state === 'shy-peek') targetZ += -.16 * frame.shyPose
    else if (state === 'sparkle-sneeze') targetX = -.12 * frame.sneezeCharge + .34 * frame.sneezeRelease
    else if (state === 'curious-scan') {
      targetY = Math.sin(frame.curiousProgress * Math.PI * 3) * .24 * frame.curiousPose
      targetZ += Math.cos(frame.curiousProgress * Math.PI * 2) * .12 * frame.curiousPose
    }
    else if (state === 'playing' || state === 'flapping') targetZ += Math.sin(elapsed * 4.6) * .08
    else if (state === 'playing-ball') {
      targetY = clamp(-Math.atan2(ballPose.position.x, Math.max(.2, ballPose.position.z)) * .34, -.26, .26)
      targetX = -.04 - ballPose.height * .14
    }
    else if (state === 'eating') targetX = .3 * smoothStep(.04, .22, frame.eatProgress)
    else if (state === 'star-juggle') {
      targetY = Math.sin(frame.juggleProgress * Math.PI * 6) * .18 * frame.jugglePose
      targetX = -.12 * frame.jugglePose
    }
    else if (state === 'diving-catch') {
      targetY = clamp(-Math.atan2(catchPose.pawTarget.x, Math.max(.2, catchPose.pawTarget.z)) * .24, -.2, .2)
      targetX = -.18 * frame.catchAir + .16 * frame.catchLand
    }
    else if (state === 'backflip') targetX = -.16 * frame.backflipTuck
    else if (state === 'energy-burst') targetX = -.16 * frame.energyCharge + .12 * frame.energyRelease
    else if (state === 'waking') targetX = mix(.14, 0, smoothStep(.04, .72, frame.progress))

    head.value.rotation.x = damp(head.value.rotation.x, targetX, 7, delta)
    head.value.rotation.y = damp(head.value.rotation.y, targetY, 7, delta)
    head.value.rotation.z = damp(head.value.rotation.z, targetZ, 7, delta)
    head.value.position.x = damp(head.value.position.x, targetPositionX, 7, delta)
    head.value.position.y = damp(head.value.position.y, targetPositionY + (state === 'happy' ? Math.max(0, Math.sin(elapsed * 8)) * .035 : 0), 7, delta)
  }

  let gazeOffsetX = 0
  let gazeOffsetY = 0
  if (trackedPropPosition && head.value) {
    const presentationGroup = head.value.parent?.parent as Group | undefined
    presentationGroup?.updateWorldMatrix(true, false)
    head.value.updateWorldMatrix(true, false)
    const ballWorld = presentationGroup
      ? presentationGroup.localToWorld(trackedPropPosition.clone())
      : trackedPropPosition.clone()
    const localBall = head.value.worldToLocal(ballWorld)
    gazeOffsetX = clamp(localBall.x * .075, -.06, .06)
    gazeOffsetY = clamp((localBall.y - eyeY.value) * .025, -.035, .035)
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
  const scanOffset = state === 'curious-scan'
    ? Math.sin(frame.curiousProgress * Math.PI * 3) * .035 * frame.curiousPose
    : state === 'star-juggle'
      ? Math.sin(frame.juggleProgress * Math.PI * 6) * .028
      : 0
  const eyeOffsetX = scanOffset + gazeOffsetX
  const targetEyeY = eyeY.value + gazeOffsetY

  if (leftEye.value) {
    leftEye.value.scale.y = damp(leftEye.value.scale.y, state === 'confused' ? baseEyeY * .72 : baseEyeY, 12, delta)
    leftEye.value.scale.x = damp(leftEye.value.scale.x, state === 'excited' ? 1.14 : 1, 10, delta)
    leftEye.value.position.x = damp(leftEye.value.position.x, -eyeX.value + eyeOffsetX, 9, delta)
    leftEye.value.position.y = damp(leftEye.value.position.y, targetEyeY, 9, delta)
  }
  if (rightEye.value) {
    rightEye.value.scale.y = damp(rightEye.value.scale.y, state === 'confused' ? Math.min(1.15, baseEyeY * 1.12) : baseEyeY, 12, delta)
    rightEye.value.scale.x = damp(rightEye.value.scale.x, state === 'excited' ? 1.14 : 1, 10, delta)
    rightEye.value.position.x = damp(rightEye.value.position.x, eyeX.value + eyeOffsetX, 9, delta)
    rightEye.value.position.y = damp(rightEye.value.position.y, targetEyeY, 9, delta)
  }

  const earEnergy = state === 'energy-burst'
    ? frame.energyCharge * .16 + frame.energyRelease * .12
    : state === 'antenna-charge'
      ? frame.antennaChargePose * .14
      : state === 'excited' || state === 'playing' || state === 'flapping'
        ? Math.sin(elapsed * 8) * .08
        : state === 'confused'
          ? Math.sin(elapsed * 3.2) * .1
          : 0
  if (leftEar.value) leftEar.value.rotation.z = damp(leftEar.value.rotation.z, -scheme.model.head.earRotationZ + earEnergy, 8, delta)
  if (rightEar.value) rightEar.value.rotation.z = damp(rightEar.value.rotation.z, scheme.model.head.earRotationZ - earEnergy, 8, delta)

  const antennaCharge = state === 'antenna-charge'
    ? frame.antennaChargePose * 1.2 + frame.antennaRelease * .9
    : state === 'energy-burst'
      ? frame.energyCharge + frame.energyRelease * .78
      : state === 'fireworks-show'
        ? .7 + Math.sin(frame.fireworksProgress * Math.PI * 6) * .18
        : state === 'sparkle-sneeze'
          ? frame.sneezeCharge + frame.sneezeRelease * .7
          : state === 'star-juggle'
            ? .42
            : state === 'excited' || state === 'thinking'
              ? .36
              : frame.highEnergy
                ? .28
                : .12
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
    if (props.appearance.glow.mode === 'rainbow') {
      material.color.copy(rainbow)
      material.emissive.copy(rainbow)
    }
  }
})
</script>

<template>
  <TresGroup ref="head" :position="headPosition" :rotation="headRotation" :scale="headScale">
    <TresGroup
      v-for="side in [-1, 1]"
      :key="`ear-${side}`"
      :ref="node => setEarRef(node, side)"
      :position="vector([side * earX, scheme.model.head.earOffset[1], scheme.model.head.earOffset[2]])"
      :rotation="rotation([0, 0, side * scheme.model.head.earRotationZ])"
      :scale="vector([appearance.proportions.earScale, appearance.proportions.earScale, appearance.proportions.earScale])"
    >
      <TresMesh cast-shadow>
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.34, 28, 28]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.54, .86, .42]" />
        <TresConeGeometry v-else :args="scheme.model.head.earOuter" />
        <TresMeshStandardMaterial :color="appearance.earDesign.outerColor" :roughness="appearance.parts.ears === 'mechanical' ? .22 : .3" :metalness="appearance.parts.ears === 'mechanical' ? .68 : .04" />
      </TresMesh>
      <TresMesh :position="vector(scheme.model.head.earInnerPosition)" :scale="vector(scheme.model.head.earInnerScale)">
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.28, 24, 24]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.42, .66, .2]" />
        <TresConeGeometry v-else :args="scheme.model.head.earInner" />
        <TresMeshStandardMaterial :color="appearance.earDesign.innerColor" :emissive="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowColor : '#000000'" :emissive-intensity="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowIntensity : 0" :roughness=".24" />
      </TresMesh>
      <TresMesh v-if="appearance.parts.ears !== 'rounded' && appearance.parts.ears !== 'floppy'" :position="vector([0, .28, .055])" :scale="vector([.34, .34, .34])">
        <TresConeGeometry :args="[.22, .42, appearance.parts.ears === 'petal' ? 6 : 4]" />
        <TresMeshStandardMaterial :color="appearance.earDesign.tipColor" :roughness=".2" />
      </TresMesh>
    </TresGroup>

    <template v-if="appearance.parts.antenna !== 'none'">
      <TresGroup
        v-for="side in [-1, 1]"
        :key="`antenna-${side}`"
        :ref="node => setAntennaRef(node, side)"
        :position="vector([side * antennaX, scheme.model.antenna.offset[1], scheme.model.antenna.offset[2]])"
        :rotation="rotation([scheme.model.antenna.rotation[0], side < 0 ? scheme.model.antenna.rotation[1] : -scheme.model.antenna.rotation[1], side * appearance.antennaDesign.tilt])"
        :scale="vector([appearance.proportions.antennaScale, antennaY, appearance.proportions.antennaScale])"
      >
        <TresMesh :position="vector(scheme.model.antenna.rodPosition)"><TresCylinderGeometry :args="antennaRod" /><TresMeshStandardMaterial :color="colors.antennaRod" :roughness=".22" :metalness=".04" /></TresMesh>
        <TresMesh :position="vector([side * scheme.model.antenna.tipPosition[0], scheme.model.antenna.tipPosition[1], scheme.model.antenna.tipPosition[2]])">
          <TresTorusGeometry v-if="appearance.parts.antennaTip === 'ring'" :args="[.12, .035, 12, 28]" />
          <TresDodecahedronGeometry v-else-if="appearance.parts.antennaTip === 'crystal'" :args="[.11, 0]" />
          <TresSphereGeometry v-else :args="[scheme.model.antenna.tipRadius, 20, 20]" />
          <TresMeshStandardMaterial :ref="registerGlow" :color="colors.antennaTip" :emissive="colors.antennaTip" :emissive-intensity="1.6" transparent :opacity=".9" :roughness=".1" />
        </TresMesh>
        <TresMesh :position="vector([side * scheme.model.antenna.tipPosition[0], scheme.model.antenna.tipPosition[1], scheme.model.antenna.tipPosition[2]])" :scale="vector([scheme.model.antenna.auraScale, scheme.model.antenna.auraScale, scheme.model.antenna.auraScale])"><TresSphereGeometry :args="[scheme.model.antenna.tipRadius, 16, 16]" /><TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity=".14" :depth-write="false" /></TresMesh>
      </TresGroup>
    </template>

    <TresMesh v-if="profile.headShape === 'rounded-cube'" :geometry="roundedHeadGeometry" cast-shadow><TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" :metalness=".04" /></TresMesh>
    <TresMesh v-else cast-shadow><TresSphereGeometry :args="[scheme.model.head.radius, 64, 64]" /><TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" :metalness=".04" /></TresMesh>
    <TresMesh :position="muzzlePosition" :scale="muzzleScale"><TresSphereGeometry :args="[scheme.model.head.muzzleRadius, 48, 48]" /><TresMeshStandardMaterial :color="colors.muzzle" :roughness=".34" /></TresMesh>

    <template v-if="appearance.parts.eyes !== 'visor'">
      <TresGroup v-for="side in [-1, 1]" :key="`eye-${side}`" :ref="node => setEyeRef(node, side)" :position="vector([side * eyeX, eyeY, eyeZ])">
        <template v-if="appearance.parts.eyes === 'spark'">
          <TresMesh :rotation="rotation([0, 0, Math.PI / 4])" :scale="vector([.16 * appearance.proportions.eyeScale, .042 * appearance.proportions.eyeScale, .065])"><TresBoxGeometry /><TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="colors.eyeHighlight" :emissive-intensity=".26" :roughness=".12" /></TresMesh>
          <TresMesh :rotation="rotation([0, 0, -Math.PI / 4])" :scale="vector([.16 * appearance.proportions.eyeScale, .042 * appearance.proportions.eyeScale, .065])"><TresBoxGeometry /><TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="colors.eyeHighlight" :emissive-intensity=".26" :roughness=".12" /></TresMesh>
        </template>
        <TresMesh v-else-if="appearance.parts.eyes === 'diamond'" :scale="vector([.14 * appearance.proportions.eyeScale, .22 * appearance.proportions.eyeScale, .085])"><TresOctahedronGeometry :args="[1, 0]" /><TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="colors.eyeHighlight" :emissive-intensity=".16" :roughness=".04" :metalness=".22" /></TresMesh>
        <TresMesh v-else :scale="appearance.parts.eyes === 'sleepy' ? vector([.19 * appearance.proportions.eyeScale, .07 * appearance.proportions.eyeScale, .08]) : appearance.parts.eyes === 'oval' ? vector([.13 * appearance.proportions.eyeScale, .25 * appearance.proportions.eyeScale, .1]) : scaled(scheme.model.head.eyeScale, appearance.proportions.eyeScale)"><TresSphereGeometry :args="[1, 32, 32]" /><TresMeshStandardMaterial :color="appearance.palette.eye" :roughness=".08" /></TresMesh>
        <TresMesh v-if="appearance.parts.eyes === 'round'" :position="vector([side * highlightX, scheme.model.head.eyeHighlightPosition[1], scheme.model.head.eyeHighlightPosition[2]])" :scale="vector(scheme.model.head.eyeHighlightScale)"><TresSphereGeometry /><TresMeshBasicMaterial :color="colors.eyeHighlight" /></TresMesh>
      </TresGroup>
    </template>
    <TresMesh v-else :position="vector([0, eyeY, eyeZ])" :scale="vector([.72, .16, .08])"><TresBoxGeometry /><TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="colors.eyeHighlight" :emissive-intensity=".42" /></TresMesh>

    <ExtensionCloudFoxFaceCustomization :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
  </TresGroup>
</template>
