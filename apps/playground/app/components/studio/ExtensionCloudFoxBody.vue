<!--
  文件职责 / File responsibility
  组合唯一身体表面、按身体 Profile 挂载的前后肢、能量核心和胸背标志，并保留完整动作驱动。
  Composes the sole torso surface, body-profile-mounted limbs, energy core, and chest/back symbols while retaining full motion driving.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { CanvasTexture, DoubleSide, Euler, Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxBodyShape from './ExtensionCloudFoxBodyShape.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { clamp01, createExtensionCloudFoxMotionFrame, mix, pulse, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { getCloudFoxBodyProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { SymbolChannelRecipe } from '~/domain/pet-studio-phase4'
import type { FrontPawStyle, MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const rotation = (value: readonly number[]) => new Euler(value[0] || 0, value[1] || 0, value[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const profile = computed(() => getCloudFoxBodyProfile(props.appearance.parts.bodyShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)

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

const bodyHalfWidth = computed(() => scheme.model.body.scale[0] * scheme.model.body.radius * props.appearance.proportions.bodyWidth * profile.value.scale[0])
const bodyHalfHeight = computed(() => scheme.model.body.scale[1] * scheme.model.body.radius * props.appearance.proportions.bodyHeight * profile.value.scale[1])
const bodyHalfDepth = computed(() => scheme.model.body.scale[2] * scheme.model.body.radius * props.appearance.proportions.bodyDepth * profile.value.scale[2])
const pawProfile = computed(() => PAW_STYLE_PROFILE[props.appearance.frontPawDesign.style])
const pawRootX = computed(() => bodyHalfWidth.value * profile.value.frontPawX * props.appearance.proportions.limbSpacing)
const pawRootY = computed(() => scheme.model.body.position[1] + bodyHalfHeight.value * profile.value.frontPawY + props.appearance.frontPawDesign.rootHeight)
const pawSurfaceDepth = computed(() => scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.frontPawDepth)
const pawRootZ = computed(() => pawSurfaceDepth.value
  - props.appearance.frontPawDesign.embedDepth * props.appearance.proportions.limbThickness
  + props.appearance.frontPawDesign.forwardOffset)
const rootRadius = computed(() => Math.max(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1])
  * props.appearance.proportions.limbThickness
  * pawProfile.value.rootRadius
  * props.appearance.frontPawDesign.shoulderScale)
const wristRadius = computed(() => Math.min(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1])
  * props.appearance.proportions.limbThickness
  * pawProfile.value.wristRadius
  * props.appearance.frontPawDesign.wristScale)
const shoulderRadius = computed(() => Math.max(.13 * props.appearance.proportions.limbThickness, rootRadius.value * 1.08))
const forearmHeight = computed(() => scheme.model.frontPaw.forearm[2] * props.appearance.proportions.limbLength * pawProfile.value.length)
const forearmCenterY = computed(() => shoulderRadius.value * .28 - forearmHeight.value * .5)
const forearmBottomY = computed(() => shoulderRadius.value * .28 - forearmHeight.value)
const tipScale = computed(() => vector([
  scheme.model.frontPaw.tipScale[0] * props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[0],
  scheme.model.frontPaw.tipScale[1] * props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[1],
  scheme.model.frontPaw.tipScale[2] * props.appearance.proportions.pawScale * props.appearance.frontPawDesign.palmScale * pawProfile.value.tipScale[2],
]))
const tipY = computed(() => forearmBottomY.value - scheme.model.frontPaw.tipRadius * tipScale.value.y * .18)
const pawPosition = (side: number) => vector([side * pawRootX.value, pawRootY.value, pawRootZ.value])
const hindPosition = (side: number) => vector([
  side * bodyHalfWidth.value * profile.value.hindPawX,
  scheme.model.body.position[1] + bodyHalfHeight.value * profile.value.hindPawY,
  scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.hindPawDepth,
])

const leftMotion = shallowRef<Group>()
const rightMotion = shallowRef<Group>()
const leftTip = shallowRef<Group>()
const rightTip = shallowRef<Group>()
const leftHind = shallowRef<Group>()
const rightHind = shallowRef<Group>()
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()
const chestMode = computed(() => props.appearance.chestDisplay.mode)
const showEnergyCore = computed(() => chestMode.value === 'energy-core' || chestMode.value === 'hybrid')
const showChestSymbol = computed(() => props.appearance.symbols.chest.enabled && (chestMode.value === 'symbol' || chestMode.value === 'hybrid'))
const chestCoreScale = computed(() => chestMode.value === 'hybrid' ? .68 : 1)
const chestSymbolPosition = computed(() => vector([
  props.appearance.symbols.chest.offsetX,
  scheme.model.body.position[1] - .06 + props.appearance.symbols.chest.offsetY,
  scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.chestDepth + .04 + props.appearance.symbols.chest.offsetZ,
]))
const backSymbolPosition = computed(() => vector([
  props.appearance.symbols.back.offsetX,
  scheme.model.body.position[1] - .12 + props.appearance.symbols.back.offsetY,
  scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.backDepth - .04 - props.appearance.symbols.back.offsetZ,
]))
const chestSymbolScale = computed(() => vector([.34 * props.appearance.symbols.chest.scale, .34 * props.appearance.symbols.chest.scale, .34]))
const backSymbolScale = computed(() => vector([.48 * props.appearance.symbols.back.scale, .48 * props.appearance.symbols.back.scale, .48]))
const chestSymbolRotation = computed(() => rotation([0, 0, props.appearance.symbols.chest.rotation]))
const backSymbolRotation = computed(() => rotation([0, Math.PI, -props.appearance.symbols.back.rotation]))
const energyCorePosition = computed(() => vector([
  scheme.model.chestCore.position[0],
  scheme.model.chestCore.position[1],
  scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.chestDepth + .08,
]))

function setPawMotionRef(node: unknown, side: number) {
  if (side < 0) leftMotion.value = node as Group | undefined
  else rightMotion.value = node as Group | undefined
}
function setPawTipRef(node: unknown, side: number) {
  if (side < 0) leftTip.value = node as Group | undefined
  else rightTip.value = node as Group | undefined
}
function setHindRef(node: unknown, side: number) {
  if (side < 0) leftHind.value = node as Group | undefined
  else rightHind.value = node as Group | undefined
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
  const ballPose = createBallMotionPose(frame.ballProgress)
  const catchPose = createCatchMotionPose(frame.catchProgress)
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
    else if (state === 'playing' || state === 'flapping') {
      const wave = Math.sin(elapsed * (state === 'flapping' ? 11.5 : 7.2) + (side < 0 ? 0 : Math.PI))
      targetZ += side * (.34 + wave * (state === 'flapping' ? .58 : .34))
      targetX = -.12 - Math.abs(wave) * .24
      tipZ = wave * .2
    }
    else if (state === 'jumping') {
      targetZ = side * (.28 + frame.jumpLanding * .35)
      targetX = -.22 - frame.jumpLanding * .2
      tipX = -.18 * frame.jumpLanding
    }
    else if (state === 'stretching') {
      targetZ = side * mix(design.outwardAngle, 2.28, frame.stretchStrength)
      targetX = mix(design.forwardAngle, -1.06, frame.stretchStrength)
      scaleY = 1 + frame.stretchStrength * .12
      tipZ = side * frame.stretchStrength * .14
    }
    else if (state === 'resting' || state === 'sleeping' || state === 'cloud-nap') {
      const pose = state === 'resting' ? frame.restingPose : state === 'cloud-nap' ? frame.cloudNapPose : 1
      targetX = mix(design.forwardAngle, state === 'cloud-nap' ? -.76 : -1.02, pose)
      targetZ = side * mix(design.outwardAngle, state === 'cloud-nap' ? .44 : .14, pose)
      tipX = -.24 * pose
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
      const activeBoost = side === ballPose.activeSide ? 1 : .7
      const reach = clamp01(1 - Math.abs(ballPose.position.x - side * .5) / 1.05) * (.42 + ballPose.height * .58) * activeBoost
      const tap = side < 0 ? pulse(frame.ballProgress, .12, .31) + pulse(frame.ballProgress, .62, .81) : pulse(frame.ballProgress, .37, .56) + pulse(frame.ballProgress, .78, .95)
      const intent = Math.max(reach, tap)
      targetX = -.2 - intent * .62 - ballPose.height * .06
      targetY = -ballPose.position.x * .12
      targetZ = side * (.1 + reach * .24) - ballPose.position.x * .14
      tipX = intent * .4
      tipZ = -ballPose.position.x * .12
    }
    else if (state === 'eating') {
      const eatPose = smoothStep(.04, .22, frame.eatProgress) * (1 - smoothStep(.88, .99, frame.eatProgress))
      targetX = -.72 * eatPose
      targetZ = side * mix(design.outwardAngle, .34, eatPose)
      tipX = -.28 * eatPose + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 12)) * .08
    }
    else if (state === 'backflip' || state === 'diving-catch') {
      const pose = state === 'backflip' ? frame.backflipTuck : frame.catchReach
      targetX = -.24 - pose * .82 + (state === 'backflip' ? frame.backflipLand : frame.catchLand) * .24
      targetZ = side * (-.12 - pose * .24)
      scaleY = 1 + (state === 'diving-catch' ? pose * .15 : -pose * .12)
      tipX = -pose * .48
      if (state === 'diving-catch') {
        targetY = -catchPose.pawTarget.x * .1 * pose
        tipZ = -catchPose.pawTarget.x * .06 * pose
      }
    }
    else if (state === 'energy-burst' || state === 'fireworks-show' || state === 'antenna-charge') {
      const charge = state === 'energy-burst' ? frame.energyCharge : state === 'antenna-charge' ? frame.antennaChargePose : frame.fireworksSalute
      targetX = -charge * .42
      targetZ = side * mix(.06, state === 'fireworks-show' ? 2.45 : -.82, charge)
      tipX = -charge * .32
      tipZ = side * charge * .18
    }
    else if (state === 'tail-tornado') {
      targetX = -.34 * frame.tornadoStrength
      targetZ = side * (-.2 - frame.tornadoStrength * .32)
      tipZ = side * -.18 * frame.tornadoStrength
    }
    else if (state === 'shy-peek') {
      targetX = -.22 * frame.shyPose
      targetZ = side < 0 ? mix(-.06, -1.46, frame.shyPose) : mix(.06, 1.3, frame.shyPose)
      tipZ = side < 0 ? -.18 * frame.shyPose : .22 * frame.shyPose
    }
    else if (state === 'star-juggle') {
      const active = side < 0 ? Math.max(0, frame.juggleWave) : Math.max(0, -frame.juggleWave)
      targetX = -.18 - active * .5
      targetZ = side * .34 + frame.juggleWave * .42
      scaleY = 1 + active * .08
      tipZ = side < 0 ? frame.juggleWave * .26 : -frame.juggleWave * .26
    }
    else if (state === 'sparkle-sneeze') {
      targetZ = side * mix(.06, 1.14, frame.sneezeCharge) + side * frame.sneezeRelease * .24
      tipZ = side * (.12 * frame.sneezeCharge - frame.sneezeRelease * .28)
    }
    else if (state === 'tail-glow') {
      targetZ += side * frame.tailGlowWave * .08
      tipZ = side * -frame.tailGlowWave * .07
    }
    else if (state === 'curious-scan' && side > 0) {
      targetZ = .06 + Math.sin(frame.curiousProgress * Math.PI * 3) * .14 * frame.curiousPose
      tipZ = Math.sin(frame.curiousProgress * Math.PI * 5) * .1 * frame.curiousPose
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
    const high = state === 'flapping' ? Math.sin(stateElapsed * 11.5 + (side < 0 ? 0 : Math.PI)) : 0
    let targetX = -.04 - frame.jumpLanding * .28 - Math.abs(dance) * .08
    let targetZ = side * dance * .18
    if (state === 'flapping') { targetX = -.22 - Math.abs(high) * .48; targetZ = side * high * .5 }
    else if (state === 'resting') { targetX = mix(-.04, .88, frame.restingPose); targetZ = side * .36 * frame.restingPose }
    else if (state === 'sleeping' || state === 'cloud-nap') { targetX = .48; targetZ = side * .28 }
    else if (state === 'backflip') { targetX = -.04 - frame.backflipTuck * .76 + frame.backflipLand * .3; targetZ = side * frame.backflipTuck * .34 }
    else if (state === 'diving-catch') { targetX = -.12 - frame.catchLaunch * .48 + frame.catchLand * .42; targetZ = side * frame.catchAir * .18 }
    else if (state === 'tail-tornado') { targetX = -.2 - frame.tornadoStrength * .18; targetZ = side * frame.tornadoStrength * .32 }
    group.rotation.x = damp(group.rotation.x, targetX, 8, delta)
    group.rotation.z = damp(group.rotation.z, targetZ, 8, delta)
  }
  updateHind(leftHind.value, -1)
  updateHind(rightHind.value, 1)
})
</script>

<template>
  <ExtensionCloudFoxBodyShape :appearance="appearance" />

  <TresGroup v-for="side in [-1, 1]" :key="`fp${side}`" :position="pawPosition(side)">
    <TresMesh :scale="vector([1.12, 1.02, .94])" cast-shadow>
      <TresSphereGeometry :args="[shoulderRadius, 28, 28]" />
      <TresMeshStandardMaterial :color="colors.body" :roughness=".3" />
    </TresMesh>
    <TresGroup :ref="node => setPawMotionRef(node, side)">
      <TresMesh :position="vector([0, forearmCenterY, 0])" cast-shadow>
        <TresCylinderGeometry :args="[rootRadius, wristRadius, forearmHeight, 24]" />
        <TresMeshStandardMaterial :color="colors.limbs" :roughness="appearance.frontPawDesign.style === 'mechanical' ? .18 : .26" :metalness="appearance.frontPawDesign.style === 'mechanical' ? .28 : .04" />
      </TresMesh>
      <TresMesh v-if="appearance.frontPawDesign.style === 'mechanical'" :position="vector([0, forearmBottomY + wristRadius * .35, 0])" cast-shadow>
        <TresSphereGeometry :args="[wristRadius * 1.3, 20, 20]" />
        <TresMeshStandardMaterial :color="colors.body" :roughness=".2" :metalness=".35" />
      </TresMesh>
      <TresGroup :ref="node => setPawTipRef(node, side)" :position="vector([0, tipY, scheme.model.frontPaw.tipPosition[2]])">
        <TresMesh :scale="tipScale" cast-shadow>
          <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 28, 28]" />
          <TresMeshStandardMaterial :color="colors.paws" :roughness=".26" />
        </TresMesh>
        <TresMesh v-if="appearance.frontPawDesign.style === 'mitten'" :position="vector([side * scheme.model.frontPaw.tipRadius * .72, .025, .015])" :scale="vector([.72, .58, .72])" cast-shadow>
          <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 20, 20]" />
          <TresMeshStandardMaterial :color="colors.paws" :roughness=".28" />
        </TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>

  <TresGroup v-for="side in [-1, 1]" :key="`hp${side}`" :ref="node => setHindRef(node, side)" :position="hindPosition(side)">
    <TresMesh :rotation="rotation([scheme.model.hindPaw.legRotation[0], 0, side * scheme.model.hindPaw.legRotation[2]])">
      <TresCylinderGeometry :args="scheme.model.hindPaw.leg" />
      <TresMeshStandardMaterial :color="colors.body" :roughness=".32" />
    </TresMesh>
    <TresMesh :position="vector(scheme.model.hindPaw.tipPosition)" :scale="vector([
      scheme.model.hindPaw.tipScale[0] * appearance.proportions.pawScale,
      scheme.model.hindPaw.tipScale[1] * appearance.proportions.pawScale,
      scheme.model.hindPaw.tipScale[2] * appearance.proportions.pawScale,
    ])">
      <TresSphereGeometry :args="[scheme.model.hindPaw.tipRadius, 24, 24]" />
      <TresMeshStandardMaterial :color="colors.paws" :roughness=".3" />
    </TresMesh>
  </TresGroup>

  <TresMesh v-if="showEnergyCore" :position="energyCorePosition" :scale="vector([chestCoreScale, chestCoreScale, chestCoreScale])">
    <TresSphereGeometry :args="[scheme.model.chestCore.radius, 32, 32]" />
    <TresMeshStandardMaterial :color="colors.energyCore" :emissive="colors.energyCore" :emissive-intensity="scheme.model.chestCore.emissiveIntensity" :metalness=".25" :roughness=".12" />
  </TresMesh>

  <TresGroup v-if="showChestSymbol && chestTexture" :position="chestSymbolPosition" :rotation="chestSymbolRotation" :scale="chestSymbolScale">
    <TresPointLight :color="appearance.symbols.chest.color" :intensity="appearance.symbols.chest.glowIntensity * .55" />
    <TresMesh :render-order="4"><TresPlaneGeometry /><TresMeshBasicMaterial :map="chestTexture" transparent :side="DoubleSide" :depth-test="true" /></TresMesh>
  </TresGroup>

  <TresGroup v-if="appearance.symbols.back.enabled && backTexture" :position="backSymbolPosition" :rotation="backSymbolRotation" :scale="backSymbolScale">
    <TresMesh :render-order="4"><TresPlaneGeometry /><TresMeshBasicMaterial :map="backTexture" transparent :side="DoubleSide" :depth-test="true" /></TresMesh>
  </TresGroup>
</template>
