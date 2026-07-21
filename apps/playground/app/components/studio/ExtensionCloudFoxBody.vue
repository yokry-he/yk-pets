<!--
  文件职责 / File responsibility
  使用扩展经典方案渲染云狐身体、连续内嵌前爪、后肢、阴影、能量核心和身份标志。
  Renders the Cloud Fox body, continuously embedded front paws, hind limbs, shadows, energy core, and identity marks from the extension classic scheme.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { CanvasTexture, DoubleSide, Euler, Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type { CloudFoxStudioBehavior, SymbolChannelRecipe } from '~/domain/pet-studio-phase4'
import type { FrontPawStyle, MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe; behavior: CloudFoxStudioBehavior }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const scale = (value: readonly number[], x = 1, y = x, z = x) => new Vector3((value[0] || 0) * x, (value[1] || 0) * y, (value[2] || 0) * z)
const rotation = (value: readonly number[]) => new Euler(value[0] || 0, value[1] || 0, value[2] || 0)

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
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()

function setPawMotionRef(node: unknown, side: number) {
  const group = node as Group | undefined
  if (side < 0) leftMotion.value = group
  else rightMotion.value = group
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
watch(() => props.appearance.symbols.chest, (channel) => { chestTexture.value?.dispose(); chestTexture.value = texture(channel) }, { immediate: true, deep: true })
watch(() => props.appearance.symbols.back, (channel) => { backTexture.value?.dispose(); backTexture.value = texture(channel) }, { immediate: true, deep: true })
onBeforeUnmount(() => { chestTexture.value?.dispose(); backTexture.value?.dispose() })

useLoop().onBeforeRender(({ elapsed, delta }) => {
  const design = props.appearance.frontPawDesign
  const stretching = props.behavior === 'stretching'
  const resting = props.behavior === 'resting'
  const update = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const greeting = props.behavior === 'greeting' && side === 1
    const wave = greeting ? .76 + Math.sin(elapsed * 9) * .13 : 0
    const targetZ = side * (design.outwardAngle + (stretching ? .5 : 0)) + wave
    const targetX = design.forwardAngle + (stretching ? -.16 : resting ? .12 : 0)
    group.rotation.z += (targetZ - group.rotation.z) * Math.min(1, delta * 8)
    group.rotation.x += (targetX - group.rotation.x) * Math.min(1, delta * 8)
  }
  update(leftMotion.value, -1)
  update(rightMotion.value, 1)
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
      <TresMesh :position="vector([0, tipY, scheme.model.frontPaw.tipPosition[2]])" :scale="tipScale" cast-shadow>
        <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 28, 28]"/>
        <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".26"/>
      </TresMesh>
      <TresMesh v-if="appearance.frontPawDesign.style === 'mitten'" :position="vector([side * scheme.model.frontPaw.tipRadius * .72, tipY + .025, scheme.model.frontPaw.tipPosition[2] + .015])" :scale="vector([.72, .58, .72])" cast-shadow>
        <TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 20, 20]"/>
        <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".28"/>
      </TresMesh>
    </TresGroup>
  </TresGroup>

  <TresGroup v-for="side in [-1, 1]" :key="`hp${side}`" :position="vector([side * scheme.model.hindPaw.offset[0], scheme.model.hindPaw.offset[1], scheme.model.hindPaw.offset[2]])">
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
