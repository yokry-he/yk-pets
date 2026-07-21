<!--
  文件职责 / File responsibility
  使用扩展经典方案渲染云狐身体、连续内嵌前爪、后肢、阴影、能量核心和身份标志，并复用正式扩展四肢动作阶段。
  Renders the Cloud Fox body, continuously embedded front paws, hind limbs, shadows, energy core, and identity marks while reusing production extension limb phases.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { CanvasTexture, DoubleSide, Euler, Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, mix, pulse, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { SymbolChannelRecipe } from '~/domain/pet-studio-phase4'
import type { FrontPawStyle, MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const scale = (value: readonly number[], x = 1, y = x, z = x) => new Vector3((value[0] || 0) * x, (value[1] || 0) * y, (value[2] || 0) * z)
const rotation = (value: readonly number[]) => new Euler(value[0] || 0, value[1] || 0, value[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))

const PAW_STYLE_PROFILE: Record<FrontPawStyle, {
  length: number
  rootRadius: number
  wristRadius: number
  tipScale: readonly [number, number, number]
}> = {
  soft: { length: 1, rootRadius: 1.08, wristRadius: 1, tipScale: [1, 1, 1] },
  tapered: { length: 1.04, rootRadius: 1.28, wristRadius: .72, tipScale: [.94, .92, .96] },
  mitten: { length: .8, rootRadius: 1.12, wristRadius: .9, tipScale: [1.24, 1.08, 1.18] },
  mechanical: { length: 1, rootRadius: 1.08, wristRadius: .82, tipScale: [1.02, .82, 1.04] },
}

const bodyScale = computed(() => scale(
  scheme.model.body.scale,
  props.appearance.proportions.bodyWidth,
  props.appearance.proportions.bodyHeight,
  props.appearance.proportions.bodyDepth,
))
const pawProfile = computed(() => PAW_STYLE_PROFILE[props.appearance.frontPawDesign.style])
const pawRootX = computed(() => scheme.model.frontPaw.offset[0] * props.appearance.proportions.bodyWidth * props.appearance.proportions.limbSpacing)
const pawRootY = computed(() => scheme.model.frontPaw.offset[1] + props.appearance.frontPawDesign.rootHeight)
const pawSurfaceDepth = computed(() => {
  const body = bodyScale.value
  const radius = scheme.model.body.radius
  const normalizedX = pawRootX.value / Math.max(.001, body.x * radius)
  const normalizedY = (pawRootY.value - scheme.model.body.position[1]) / Math.max(.001, body.y * radius)
  const surfaceFactor = Math.sqrt(Math.max(.08, 1 - normalizedX ** 2 - normalizedY ** 2))
  return scheme.model.body.position[2] + body.z * radius * surfaceFactor
})
const requestedPawRootZ = computed(() => pawSurfaceDepth.value
  - props.appearance.frontPawDesign.embedDepth * props.appearance.proportions.limbThickness
  + props.appearance.frontPawDesign.forwardOffset)
const pawRootZ = computed(() => Math.min(
  requestedPawRootZ.value,
  pawSurfaceDepth.value - .05 * props.appearance.proportions.limbThickness,
))
const rootRadius = computed(() => Math.max(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1])
  * props.appearance.proportions.limbThickness
  * pawProfile.value.rootRadius
  * props.appearance.frontPawDesign.shoulderScale)
const wristRadius = computed(() => Math.min(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1])
  * props.appearance.proportions.limbThickness
  * pawProfile.value.wristRadius
  * props.appearance.frontPawDesign.wristScale)
const shoulderRadius = computed(() => Math.max(
  .13 * props.appearance.proportions.limbThickness * props.appearance.frontPawDesign.shoulderScale,
  rootRadius.value * 1.08,
))
const forearmHeight = computed(() => scheme.model.frontPaw.forearm[2] * props.appearance.proportions.limbLength * pawProfile.value.length)
const forearmTopY = computed(() => shoulderRadius.value * .28)
const forearmCenterY = computed(() => forearmTopY.value - forearmHeight.value * .5)
const forearmBottomY = computed(() => forearmTopY.value - forearmHeight.value)
const tipScale = computed(() => scale(
  scheme.model.frontPaw.tipScale,
  props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[0],
  props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[1],
  props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[2],
))
const tipY = computed(() => forearmBottomY.value - scheme.model.frontPaw.tipRadius * tipScale.value.y * .18)
const pawPosition = (side: number) => vector([side * pawRootX.value, pawRootY.value, pawRootZ.value])

const leftMotion = shallowRef<Group>()
const rightMotion = shallowRef<Group>()
const leftTip = shallowRef<Group>()
const rightTip = shallowRef<Group>()
const leftHind = shallowRef<Group>()
const rightHind = shallowRef<Group>()
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()

function setPawMotionRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftMotion.value = group
  else rightMotion.value = group
}
function setPawTipRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftTip.value = group
  else rightTip.value = group
}
function setHindRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftHind.value = group
  else rightHind.value = group
}

function texture(channel: SymbolChannelRecipe) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '900 142px system-ui'
  context.shadowColor = channel.color
  context.shadowBlur = 18 + channel.glowIntensity * 18
  context.fillStyle = channel.color
  context.fillText(channel.text.slice(0, 3).toUpperCase(), 128, 132)
  context.shadowBlur = 6
  context.fillStyle = '#fff'
  context.globalAlpha = .55
  context.fillText(channel.text.slice(0, 3).toUpperCase(), 128, 128)
  const result = new CanvasTexture(canvas)
  result.needsUpdate = true
  return result
}
watch(() => props.appearance.symbols.chest, channel => { chestTexture.value?.dispose(); chestTexture.value = texture(channel) }, { immediate: true, deep: true })
watch(() => props.appearance.symbols.back, channel => { backTexture.value?.dispose(); backTexture.value = texture(channel) }, { immediate: true, deep: true })
onBeforeUnmount(() => { chestTexture.value?.dispose(); backTexture.value?.dispose() })

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
  const design = props.appearance.frontPawDesign

  const update = (group: Group | undefined, tip: Group | undefined, side: -1 | 1) => {
    if (!group || !tip) return
    let targetX = design.forwardAngle
    let targetY = 0
    let targetZ = side * design.outwardAngle
    let scaleY = 1
    let tipX = 0
    let tipZ = 0

    if (state === 'greeting' && side === 1) {
      targetZ = mix(side * design.outwardAngle, 2.42, frame.greetingPose) + frame.greetingWave * .16
      targetX = -.08 * frame.greetingPose
      tipZ = frame.greetingWave * .22
    }
    else if (state === 'playing') {
      const dance = Math.sin(elapsed * 7.2 + (side < 0 ? 0 : Math.PI))
      targetZ += side * (.34 + dance * .34)
      targetX = -.12 + Math.max(0, dance) * -.18
      tipZ = dance * .2
    }
    else if (state === 'flapping') {
      const flap = Math.sin(stateElapsed * 11.5)
      targetZ = side * (1.05 + flap * .55)
      targetX = -.1 - Math.abs(flap) * .22
      tipZ = side * flap * .24
    }
    else if (state === 'jumping') {
      targetZ = side * (.28 + frame.jumpLanding * .35)
      targetX = -.22 - frame.jumpLanding * .2
      tipX = -.18 * frame.jumpLanding
    }
    else if (state === 'stretching') {
      targetZ = side * mix(design.outwardAngle, 2.18, frame.stretchStrength)
      targetX = mix(design.forwardAngle, -.34, frame.stretchStrength)
      scaleY = 1 + frame.stretchStrength * .08
      tipZ = side * frame.stretchStrength * .12
    }
    else if (state === 'resting' || state === 'sleeping') {
      targetX = -.38
      targetZ = side * -.06
      tipX = -.18
    }
    else if (state === 'thinking' && side < 0) {
      targetZ = -1.12
      targetX = -.2
      tipZ = -.12
    }
    else if (state === 'listening' && side === 1) {
      targetZ = 1.72
      targetX = -.16
      tipZ = .12
    }
    else if (state === 'confused') {
      targetZ = side * (.72 + Math.sin(elapsed * 2.4) * .12)
      targetX = .08
    }
    else if (state === 'happy' || state === 'talking' || state === 'excited') {
      const bounce = Math.sin(elapsed * (state === 'excited' ? 9 : 6.5) + (side < 0 ? 0 : Math.PI))
      targetZ += side * (.22 + bounce * .18)
      tipZ = bounce * .12
    }
    else if (state === 'waking') {
      const wake = smoothStep(.02, .7, frame.progress)
      targetZ = side * mix(.1, 1.4, wake) * (1 - smoothStep(.76, .99, frame.progress))
      targetX = -.18 * wake
    }
    else if (state === 'playing-ball') {
      const leftTap = pulse(frame.ballProgress, .16, .31) + pulse(frame.ballProgress, .68, .8) * .45
      const rightTap = pulse(frame.ballProgress, .48, .63) + pulse(frame.ballProgress, .78, .9) * .35
      const tap = side < 0 ? leftTap : rightTap
      targetX = -.16 - tap * .5
      targetZ += side * (.08 + tap * .18)
      tipX = tap * .34
    }
    else if (state === 'eating') {
      const eatPose = smoothStep(.04, .24, frame.eatProgress) * (1 - smoothStep(.82, .99, frame.eatProgress))
      targetX = -.48 * eatPose
      targetZ = side * mix(design.outwardAngle, .52, eatPose)
      tipX = -.24 * eatPose + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 12)) * .08
    }
    else if (state === 'backflip') {
      const fold = Math.sin(frame.backflipProgress * Math.PI)
      targetX = -.25 - fold * .42
      targetZ = side * (-.12 - fold * .3)
      tipX = -fold * .32
    }
    else if (state === 'tail-tornado') {
      targetX = -.34 * frame.tornadoStrength
      targetZ = side * (-.2 - frame.tornadoStrength * .32)
      tipZ = side * -.18 * frame.tornadoStrength
    }
    else if (state === 'diving-catch') {
      const reach = smoothStep(.18, .54, frame.catchProgress) * (1 - smoothStep(.82, .98, frame.catchProgress))
      const hold = smoothStep(.54, .72, frame.catchProgress) * (1 - smoothStep(.9, .99, frame.catchProgress))
      targetX = -.18 - reach * .68
      targetZ = side * (.06 - hold * .36)
      scaleY = 1 + reach * .12
      tipX = -reach * .46
      tipZ = side * -.28 * hold
    }
    else if (state === 'energy-burst') {
      targetX = -frame.energyCharge * .42 + frame.energyRelease * .12
      targetZ = side * mix(.06, -.92, frame.energyCharge) + side * frame.energyRelease * 1.25
      tipX = -frame.energyCharge * .34
      tipZ = side * -frame.energyRelease * .34
    }
    else if (state === 'fireworks-show') {
      const activeRight = Math.floor(Math.min(2.999, frame.fireworksProgress * 3)) % 2 === 0
      const active = side > 0 ? activeRight : !activeRight
      targetZ = active ? side * 2.58 * frame.fireworksSalute : side * -.22 * frame.fireworksSalute
      scaleY = active ? 1 + frame.fireworksSalute * .12 : 1
      tipZ = active ? Math.sin(frame.fireworksProgress * Math.PI * 9) * .08 * frame.fireworksSalute : 0
    }
    else if (state === 'shy-peek') {
      targetX = -.18 * frame.shyPose
      targetZ = side < 0 ? mix(-.06, -1.34, frame.shyPose) : mix(.06, 1.18, frame.shyPose)
      tipZ = side < 0 ? -.16 * frame.shyPose : .2 * frame.shyPose
    }
    else if (state === 'star-juggle') {
      targetX = -.18 - Math.max(0, side < 0 ? frame.juggleWave : -frame.juggleWave) * .32
      targetZ = side * .3 + frame.juggleWave * .38
      tipZ = side < 0 ? frame.juggleWave * .22 : -frame.juggleWave * .22
    }
    else if (state === 'cloud-nap') {
      targetX = side < 0 ? -.52 * frame.cloudNapPose : -.58 * frame.cloudNapPose
      targetZ = side < 0 ? .48 * frame.cloudNapPose : -.38 * frame.cloudNapPose
      tipX = side < 0 ? -.32 * frame.cloudNapPose : -.34 * frame.cloudNapPose
      tipZ = side < 0 ? .12 * frame.cloudNapPose : -.16 * frame.cloudNapPose
    }
    else if (state === 'sparkle-sneeze') {
      targetZ = side * mix(.06, 1.1, frame.sneezeCharge) + side * frame.sneezeRelease * .22
      tipZ = side * (.12 * frame.sneezeCharge - frame.sneezeRelease * .24)
    }
    else if (state === 'paw-tap' && side > 0) {
      targetX = -.18 - frame.pawTapBeat * .38
      targetZ = .06 + frame.pawTapPose * .16
      tipX = frame.pawTapBeat * .42
      tipZ = -frame.pawTapBeat * .1
    }
    else if (state === 'antenna-charge') {
      targetZ = side * mix(.06, .7, frame.antennaChargePose) + side * frame.antennaRelease * .32
      tipZ = side * (.1 * frame.antennaChargePose - frame.antennaRelease * .2)
    }
    else if (state === 'tail-glow') {
      targetZ += side * frame.tailGlowWave * .08
      tipZ = side * -frame.tailGlowWave * .06
    }
    else if (state === 'curious-scan' && side > 0) {
      targetZ = .06 + Math.sin(frame.curiousProgress * Math.PI * 3) * .12 * frame.curiousPose
      tipZ = Math.sin(frame.curiousProgress * Math.PI * 5) * .08 * frame.curiousPose
    }

    group.rotation.x = damp(group.rotation.x, targetX, 8, delta)
    group.rotation.y = damp(group.rotation.y, targetY, 8, delta)
    group.rotation.z = damp(group.rotation.z, targetZ, 8, delta)
    group.scale.y = damp(group.scale.y, scaleY, 8, delta)
    tip.rotation.x = damp(tip.rotation.x, tipX, 10, delta)
    tip.rotation.z = damp(tip.rotation.z, tipZ, 10, delta)
  }
  update(leftMotion.value, leftTip.value, -1)
  update(rightMotion.value, rightTip.value, 1)

  const updateHind = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const dance = state === 'playing' ? Math.sin(elapsed * 7.2 + (side < 0 ? 0 : Math.PI)) : 0
    const flap = state === 'flapping' ? Math.sin(stateElapsed * 11.5 + (side < 0 ? 0 : Math.PI)) : 0
    const kick = state === 'jumping' ? frame.jumpLanding : state === 'backflip' ? Math.sin(frame.backflipProgress * Math.PI) : 0
    const tornado = state === 'tail-tornado' ? frame.tornadoStrength : 0
    const targetX = state === 'resting' || state === 'sleeping' || state === 'cloud-nap'
      ? -.28
      : -.04 - kick * .28 - Math.abs(dance) * .08 - Math.abs(flap) * .06
    const targetZ = side * (dance * .18 + flap * .12 + tornado * .22)
    group.rotation.x = damp(group.rotation.x, targetX, 8, delta)
    group.rotation.z = damp(group.rotation.z, targetZ, 8, delta)
  }
  updateHind(leftHind.value, -1)
  updateHind(rightHind.value, 1)
})
</script>

<template>
  <TresMesh :position="vector(scheme.model.shadow.softPosition)" :rotation="rotation([-Math.PI / 2, 0, 0])">
    <TresCircleGeometry :args="[scheme.model.shadow.softRadius, 48]"/>
    <TresMeshBasicMaterial :color="scheme.model.shadow.softColor" transparent :opacity="scheme.model.shadow.softOpacity"/>
  </TresMesh>
  <TresMesh :position="vector(scheme.model.shadow.corePosition)" :rotation="rotation([-Math.PI / 2, 0, 0])">
    <TresCircleGeometry :args="[scheme.model.shadow.coreRadius, 48]"/>
    <TresMeshBasicMaterial :color="scheme.model.shadow.coreColor" transparent :opacity="scheme.model.shadow.coreOpacity"/>
  </TresMesh>

  <TresMesh :position="vector(scheme.model.body.position)" :scale="bodyScale" cast-shadow>
    <TresBoxGeometry v-if="appearance.parts.bodyShape === 'rounded-cube'" :args="[1.72, 1.72, 1.72, 8, 8, 8]"/>
    <TresSphereGeometry v-else :args="[scheme.model.body.radius, 64, 64]"/>
    <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".34" :metalness=".04"/>
  </TresMesh>
  <TresMesh :position="vector(scheme.model.body.warmPatchPosition)" :scale="scale(scheme.model.body.warmPatchScale, appearance.proportions.bodyWidth, appearance.proportions.bodyHeight, 1)">
    <TresSphereGeometry :args="[1, 48, 48]"/>
    <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".4"/>
  </TresMesh>

  <TresGroup v-for="side in [-1, 1]" :key="`fp${side}`" :position="pawPosition(side)">
    <TresMesh :scale="vector([1.12, 1.02, .94])" cast-shadow>
      <TresSphereGeometry :args="[shoulderRadius, 28, 28]"/>
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3"/>
    </TresMesh>
    <TresGroup :ref="node => setPawMotionRef(node, side)">
      <TresMesh :position="vector([0, forearmCenterY, 0])" cast-shadow>
        <TresCylinderGeometry :args="[rootRadius, wristRadius, forearmHeight, 24]"/>
        <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="appearance.frontPawDesign.style === 'mechanical' ? .18 : .26" :metalness="appearance.frontPawDesign.style === 'mechanical' ? .28 : .04"/>
      </TresMesh>
      <TresMesh v-if="appearance.frontPawDesign.style === 'mechanical'" :position="vector([0, forearmBottomY + wristRadius * .35, 0])" cast-shadow>
        <TresSphereGeometry :args="[wristRadius * 1.3, 20, 20]"/>
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".2" :metalness=".35"/>
      </TresMesh>
      <TresGroup :ref="node => setPawTipRef(node, side)" :position="vector([0, tipY, scheme.model.frontPaw.tipPosition[2]])">
        <TresMesh :scale="tipScale" cast-shadow>
          <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 28, 28]"/>
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".26"/>
        </TresMesh>
        <TresMesh v-if="appearance.frontPawDesign.style === 'mitten'" :position="vector([side * scheme.model.frontPaw.tipRadius * .72, .025, .015])" :scale="vector([.72, .58, .72])" cast-shadow>
          <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 20, 20]"/>
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".28"/>
        </TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>

  <TresGroup v-for="side in [-1, 1]" :key="`hp${side}`" :ref="node => setHindRef(node, side)" :position="vector([side * scheme.model.hindPaw.offset[0], scheme.model.hindPaw.offset[1], scheme.model.hindPaw.offset[2]])">
    <TresMesh :rotation="rotation([scheme.model.hindPaw.legRotation[0], 0, side * scheme.model.hindPaw.legRotation[2]])">
      <TresCylinderGeometry :args="scheme.model.hindPaw.leg"/>
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".32"/>
    </TresMesh>
    <TresMesh :position="vector(scheme.model.hindPaw.tipPosition)" :scale="scale(scheme.model.hindPaw.tipScale, appearance.proportions.pawScale)">
      <TresSphereGeometry :args="[scheme.model.hindPaw.tipRadius, 24, 24]"/>
      <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".3"/>
    </TresMesh>
  </TresGroup>

  <TresMesh :position="vector(scheme.model.chestCore.position)">
    <TresSphereGeometry :args="[scheme.model.chestCore.radius, 32, 32]"/>
    <TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="scheme.model.chestCore.emissiveIntensity" :metalness=".25" :roughness=".12"/>
  </TresMesh>
  <TresGroup v-if="appearance.symbols.chest.enabled && chestTexture" :position="vector([0, -.26, .765])" :scale="vector([.34 * appearance.symbols.chest.scale, .34 * appearance.symbols.chest.scale, .34])">
    <TresPointLight :color="appearance.symbols.chest.color" :intensity="appearance.symbols.chest.glowIntensity * .55"/>
    <TresMesh><TresPlaneGeometry/><TresMeshBasicMaterial :map="chestTexture" transparent :side="DoubleSide"/></TresMesh>
  </TresGroup>
  <TresGroup v-if="appearance.symbols.back.enabled && backTexture" :position="vector([0, -.2, -.84])" :rotation="rotation([0, Math.PI, 0])" :scale="vector([.48 * appearance.symbols.back.scale, .48 * appearance.symbols.back.scale, .48])">
    <TresMesh><TresPlaneGeometry/><TresMeshBasicMaterial :map="backTexture" transparent :side="DoubleSide"/></TresMesh>
  </TresGroup>
</template>
