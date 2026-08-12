<!--
  文件职责 / File responsibility
  组合唯一身体表面、可恢复经典挂点且支持左右独立微调的前爪与后爪、核心和标志；动作姿态继续由独立领域函数驱动。
  Composes the sole torso surface, classic-anchor front/hind paws with per-side tuning, core, and symbols while motion poses remain domain-driven.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import type { EvaluatedCloudFoxPose } from '@yk-pets/pet-core'
import { CanvasTexture, DoubleSide, Euler, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxBodyShape from './ExtensionCloudFoxBodyShape.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { getCloudFoxBodyProfile } from '~/domain/cloud-fox-shape-profile'
import { createFrontPawConnectionAssembly, createHindPawChainAssembly } from '~/domain/cloud-fox-limb-assembly'
import { createCloudFoxFrontPawPose, createCloudFoxHindPawPose } from '~/domain/cloud-fox-limb-motion'
import {
  normalizeCustomizableAppearance,
  resolvePetCustomization,
  type HindPawStyle,
} from '~/domain/pet-part-customization'
import type { SymbolChannelRecipe } from '~/domain/pet-studio-phase4'
import type { FrontPawStyle, MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import { customPoseScale, customPoseValue } from '~/domain/custom-motion-pose'
import { useStudioMotionPartNodeRegistration } from '~/composables/useStudioMotionPartNodes'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe; behavior: ExtensionCloudFoxMotionId; motionKey: number; customPose?: EvaluatedCloudFoxPose | null }>()
const registerStudioMotionPartNode = useStudioMotionPartNodeRegistration()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const upAxis = new Vector3(0, 1, 0)
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const rotation = (value: readonly number[]) => new Euler(value[0] || 0, value[1] || 0, value[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const normalized = computed(() => normalizeCustomizableAppearance(props.appearance))
const profile = computed(() => getCloudFoxBodyProfile(props.appearance.parts.bodyShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)
const frontPaw = computed(() => normalized.value.frontPawDesign)
const hindPaw = computed(() => normalized.value.hindPawDesign)

const FRONT_STYLE_PROFILE: Record<FrontPawStyle, { length: number; rootRadius: number; wristRadius: number; tipScale: readonly [number, number, number] }> = {
  soft: { length: 1, rootRadius: 1.08, wristRadius: 1, tipScale: [1, 1, 1] },
  tapered: { length: 1.04, rootRadius: 1.28, wristRadius: .72, tipScale: [.94, .92, .96] },
  mitten: { length: .8, rootRadius: 1.12, wristRadius: .9, tipScale: [1.24, 1.08, 1.18] },
  mechanical: { length: 1, rootRadius: 1.08, wristRadius: .82, tipScale: [1.02, .82, 1.04] },
}
const HIND_STYLE_PROFILE: Record<HindPawStyle, { length: number; rootRadius: number; ankleRadius: number; haunch: number; pawScale: readonly [number, number, number] }> = {
  soft: { length: 1, rootRadius: 1, ankleRadius: 1, haunch: .92, pawScale: [1, 1, 1] },
  haunch: { length: .92, rootRadius: 1.16, ankleRadius: .92, haunch: 1.28, pawScale: [1.06, 1.02, 1.08] },
  boot: { length: .96, rootRadius: 1.02, ankleRadius: .82, haunch: .96, pawScale: [1.12, .84, 1.34] },
  mechanical: { length: 1, rootRadius: 1.08, ankleRadius: .78, haunch: 1.04, pawScale: [1.04, .84, 1.12] },
}

const bodyHalfWidth = computed(() => scheme.model.body.scale[0] * scheme.model.body.radius * props.appearance.proportions.bodyWidth * profile.value.scale[0])
const bodyHalfHeight = computed(() => scheme.model.body.scale[1] * scheme.model.body.radius * props.appearance.proportions.bodyHeight * profile.value.scale[1])
const bodyHalfDepth = computed(() => scheme.model.body.scale[2] * scheme.model.body.radius * props.appearance.proportions.bodyDepth * profile.value.scale[2])

const frontProfile = computed(() => FRONT_STYLE_PROFILE[frontPaw.value.style])
const classicPawX = computed(() => scheme.model.frontPaw.offset[0] * props.appearance.proportions.bodyWidth * profile.value.frontPawX * props.appearance.proportions.limbSpacing)
const classicPawY = computed(() => scheme.model.frontPaw.offset[1] + (bodyHalfHeight.value - scheme.model.body.scale[1] * scheme.model.body.radius) * .22 + profile.value.frontPawY)
const classicPawZ = computed(() => scheme.model.frontPaw.offset[2] * props.appearance.proportions.bodyDepth * profile.value.frontPawDepth)
const rootRadius = computed(() => Math.max(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1]) * props.appearance.proportions.limbThickness * frontProfile.value.rootRadius * frontPaw.value.shoulderScale)
const wristRadius = computed(() => Math.min(scheme.model.frontPaw.forearm[0], scheme.model.frontPaw.forearm[1]) * props.appearance.proportions.limbThickness * frontProfile.value.wristRadius * frontPaw.value.wristScale)
const shoulderRadius = computed(() => Math.max(.13 * props.appearance.proportions.limbThickness, rootRadius.value * 1.08))
const forearmHeight = computed(() => scheme.model.frontPaw.forearm[2] * props.appearance.proportions.limbLength * frontProfile.value.length)
const forearmCenterY = computed(() => shoulderRadius.value * .28 - forearmHeight.value * .5)
const forearmBottomY = computed(() => shoulderRadius.value * .28 - forearmHeight.value)
const tipScale = computed(() => vector([
  scheme.model.frontPaw.tipScale[0] * props.appearance.proportions.pawScale * frontPaw.value.palmScale * frontProfile.value.tipScale[0],
  scheme.model.frontPaw.tipScale[1] * props.appearance.proportions.pawScale * frontPaw.value.palmScale * frontProfile.value.tipScale[1],
  scheme.model.frontPaw.tipScale[2] * props.appearance.proportions.pawScale * frontPaw.value.palmScale * frontProfile.value.tipScale[2],
]))
const tipY = computed(() => forearmBottomY.value - scheme.model.frontPaw.tipRadius * tipScale.value.y * .18)
function frontIndependentOffset(side: number) {
  if (frontPaw.value.mirror) return [0, 0, 0] as const
  return side < 0
    ? [frontPaw.value.leftOffsetX, frontPaw.value.leftOffsetY, frontPaw.value.leftOffsetZ] as const
    : [frontPaw.value.rightOffsetX, frontPaw.value.rightOffsetY, frontPaw.value.rightOffsetZ] as const
}
function pawPosition(side: number) {
  const offset = frontIndependentOffset(side)
  return vector([
    side * (classicPawX.value + frontPaw.value.lateralOffset) + offset[0],
    classicPawY.value + frontPaw.value.rootHeight + offset[1],
    classicPawZ.value - frontPaw.value.embedDepth * props.appearance.proportions.limbThickness + frontPaw.value.forwardOffset + offset[2],
  ])
}
const frontConnections = computed(() => {
  const createConnection = (side: -1 | 1) => {
    const shoulderCenter = pawPosition(side)
    const assembly = createFrontPawConnectionAssembly({
      bodyCenter: scheme.model.body.position,
      bodyRadii: [bodyHalfWidth.value, bodyHalfHeight.value, bodyHalfDepth.value],
      shoulderCenter: [shoulderCenter.x, shoulderCenter.y, shoulderCenter.z],
      shoulderRadius: shoulderRadius.value,
    })
    return {
      ...assembly,
      position: vector(assembly.localCenter),
      quaternion: new Quaternion().setFromUnitVectors(upAxis, vector(assembly.direction)),
    }
  }
  return { left: createConnection(-1), right: createConnection(1) }
})
function frontConnection(side: number) {
  return side < 0 ? frontConnections.value.left : frontConnections.value.right
}

const hindProfile = computed(() => HIND_STYLE_PROFILE[hindPaw.value.style])
const hindLegHeight = computed(() => scheme.model.hindPaw.leg[2] * props.appearance.proportions.limbLength * hindPaw.value.legLengthScale * hindProfile.value.length)
const hindRootRadius = computed(() => scheme.model.hindPaw.leg[0] * props.appearance.proportions.limbThickness * hindPaw.value.legThicknessScale * hindProfile.value.rootRadius)
const hindAnkleRadius = computed(() => scheme.model.hindPaw.leg[1] * props.appearance.proportions.limbThickness * hindPaw.value.legThicknessScale * hindPaw.value.ankleScale * hindProfile.value.ankleRadius)
const hindHaunchRadius = computed(() => Math.max(hindRootRadius.value * 1.08, .14) * hindPaw.value.haunchScale * hindProfile.value.haunch)
const hindFootScale = computed(() => vector([
  scheme.model.hindPaw.tipScale[0] * props.appearance.proportions.pawScale * hindPaw.value.pawScaleX * hindProfile.value.pawScale[0],
  scheme.model.hindPaw.tipScale[1] * props.appearance.proportions.pawScale * hindPaw.value.pawScaleY * hindProfile.value.pawScale[1],
  scheme.model.hindPaw.tipScale[2] * props.appearance.proportions.pawScale * hindPaw.value.pawScaleZ * hindProfile.value.pawScale[2],
]))
const hindChain = computed(() => createHindPawChainAssembly({
  legLength: hindLegHeight.value,
  baseLegLength: scheme.model.hindPaw.leg[2],
  footBasePosition: scheme.model.hindPaw.tipPosition,
  heelDrop: hindPaw.value.heelDrop,
}))
const hindAnklePosition = computed(() => vector(hindChain.value.anklePosition))
const hindFootPositionFromAnkle = computed(() => vector(hindChain.value.footPositionFromAnkle))
function hindIndependentOffset(side: number) {
  if (hindPaw.value.mirror) return [0, 0, 0] as const
  return side < 0
    ? [hindPaw.value.leftOffsetX, hindPaw.value.leftOffsetY, hindPaw.value.leftOffsetZ] as const
    : [hindPaw.value.rightOffsetX, hindPaw.value.rightOffsetY, hindPaw.value.rightOffsetZ] as const
}
function hindPosition(side: number) {
  const offset = hindIndependentOffset(side)
  return vector([
    side * (bodyHalfWidth.value * profile.value.hindPawX + hindPaw.value.lateralOffset) + offset[0],
    scheme.model.body.position[1] + bodyHalfHeight.value * profile.value.hindPawY + hindPaw.value.rootHeight + offset[1],
    scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.hindPawDepth - hindPaw.value.embedDepth * props.appearance.proportions.limbThickness + hindPaw.value.forwardOffset + offset[2],
  ])
}
function hindLegRotation(side: number) {
  return rotation([
    scheme.model.hindPaw.legRotation[0] + hindPaw.value.forwardAngle,
    0,
    side * (scheme.model.hindPaw.legRotation[2] + hindPaw.value.outwardAngle),
  ])
}
function hindFootRotation(side: number) {
  return rotation([hindPaw.value.toeLift, side * hindPaw.value.toeOutwardAngle, 0])
}

const leftMotion = shallowRef<Group>(); const rightMotion = shallowRef<Group>(); const leftTip = shallowRef<Group>(); const rightTip = shallowRef<Group>()
const leftHind = shallowRef<Group>(); const rightHind = shallowRef<Group>()
const chestTexture = shallowRef<CanvasTexture>(); const backTexture = shallowRef<CanvasTexture>()
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
  scheme.model.chestCore.position[0], scheme.model.chestCore.position[1],
  scheme.model.body.position[2] + bodyHalfDepth.value * profile.value.chestDepth + .08,
]))
function setPawMotionRef(node: unknown, side: number) { if (side < 0) leftMotion.value = node as Group | undefined; else rightMotion.value = node as Group | undefined }
function setPawTipRef(node: unknown, side: number) {
  if (side < 0) leftTip.value = node as Group | undefined
  else rightTip.value = node as Group | undefined
  registerStudioMotionPartNode(side < 0 ? 'front-paw-left' : 'front-paw-right', node)
}
function setHindRef(node: unknown, side: number) { if (side < 0) leftHind.value = node as Group | undefined; else rightHind.value = node as Group | undefined }
function setHindTipRef(node: unknown, side: number) {
  registerStudioMotionPartNode(side < 0 ? 'hind-paw-left' : 'hind-paw-right', node)
}
function texture(channel: SymbolChannelRecipe) {
  if (!import.meta.client) return
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const context = canvas.getContext('2d'); if (!context) return
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '900 142px system-ui'; context.shadowColor = channel.color
  context.shadowBlur = 18 + channel.glowIntensity * 18; context.fillStyle = channel.color; context.fillText(channel.text.slice(0, 3).toUpperCase(), 128, 132)
  context.shadowBlur = 6; context.fillStyle = '#fff'; context.globalAlpha = .55; context.fillText(channel.text.slice(0, 3).toUpperCase(), 128, 128)
  const result = new CanvasTexture(canvas); result.needsUpdate = true; return result
}
watch(() => props.appearance.symbols.chest, channel => { chestTexture.value?.dispose(); chestTexture.value = texture(channel) }, { immediate: true, deep: true })
watch(() => props.appearance.symbols.back, channel => { backTexture.value?.dispose(); backTexture.value = texture(channel) }, { immediate: true, deep: true })
onBeforeUnmount(() => { chestTexture.value?.dispose(); backTexture.value?.dispose() })

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior; let previousMotionKey = props.motionKey; let startedAt = 0
useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) { previousBehavior = props.behavior; previousMotionKey = props.motionKey; startedAt = elapsed }
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, Math.max(0, elapsed - startedAt))
  const customPose = props.customPose
  const updateFront = (group: Group | undefined, tip: Group | undefined, side: -1 | 1) => {
    if (!group || !tip) return
    const pose = createCloudFoxFrontPawPose(props.behavior, side, elapsed, frame, frontPaw.value)
    const prefix = side < 0 ? 'frontPaw.left' : 'frontPaw.right'
    group.rotation.x = damp(group.rotation.x, pose.x + customPoseValue(customPose, `${prefix}.rotation.x` as never), 8, delta)
    group.rotation.y = damp(group.rotation.y, pose.y + customPoseValue(customPose, `${prefix}.rotation.y` as never), 8, delta)
    group.rotation.z = damp(group.rotation.z, pose.z + customPoseValue(customPose, `${prefix}.rotation.z` as never), 8, delta)
    group.scale.y = damp(group.scale.y, pose.scaleY * customPoseScale(customPose, `${prefix}.length` as never), 8, delta)
    tip.rotation.x = damp(tip.rotation.x, pose.tipX + customPoseValue(customPose, `${prefix}.tip.rotation.x` as never), 10, delta)
    tip.rotation.z = damp(tip.rotation.z, pose.tipZ + customPoseValue(customPose, `${prefix}.tip.rotation.z` as never), 10, delta)
  }
  updateFront(leftMotion.value, leftTip.value, -1); updateFront(rightMotion.value, rightTip.value, 1)
  const updateHind = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const pose = createCloudFoxHindPawPose(props.behavior, side, elapsed, frame)
    const prefix = side < 0 ? 'hindPaw.left' : 'hindPaw.right'
    group.rotation.x = damp(group.rotation.x, pose.x + customPoseValue(customPose, `${prefix}.rotation.x` as never), 8, delta)
    group.rotation.y = damp(group.rotation.y, customPoseValue(customPose, `${prefix}.rotation.y` as never), 8, delta)
    group.rotation.z = damp(group.rotation.z, pose.z + customPoseValue(customPose, `${prefix}.rotation.z` as never), 8, delta)
  }
  updateHind(leftHind.value, -1); updateHind(rightHind.value, 1)
})
</script>

<template>
  <TresGroup :ref="node => registerStudioMotionPartNode('body', node)" :position="vector(scheme.model.body.position)" />
  <ExtensionCloudFoxBodyShape :appearance="appearance" />

  <TresGroup v-for="side in [-1, 1]" :key="`fp${side}`" :position="pawPosition(side)">
    <TresMesh :position="frontConnection(side).position" :quaternion="frontConnection(side).quaternion" cast-shadow>
      <TresCylinderGeometry :args="[frontConnection(side).radius * .96, frontConnection(side).radius, frontConnection(side).length, 24]" />
      <TresMeshStandardMaterial :color="colors.body" :roughness=".3" />
    </TresMesh>
    <TresMesh :scale="vector([1.12, 1.02, .94])" cast-shadow><TresSphereGeometry :args="[shoulderRadius, 28, 28]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".3" /></TresMesh>
    <TresGroup :ref="node => setPawMotionRef(node, side)">
      <TresMesh :position="vector([0, forearmCenterY, 0])" cast-shadow><TresCylinderGeometry :args="[rootRadius, wristRadius, forearmHeight, 24]" /><TresMeshStandardMaterial :color="colors.limbs" :roughness="frontPaw.style === 'mechanical' ? .18 : .26" :metalness="frontPaw.style === 'mechanical' ? .28 : .04" /></TresMesh>
      <TresMesh v-if="frontPaw.style === 'mechanical'" :position="vector([0, forearmBottomY + wristRadius * .35, 0])" cast-shadow><TresSphereGeometry :args="[wristRadius * 1.3, 20, 20]" /><TresMeshStandardMaterial :color="colors.body" :roughness=".2" :metalness=".35" /></TresMesh>
      <TresGroup :ref="node => setPawTipRef(node, side)" :position="vector([0, tipY, scheme.model.frontPaw.tipPosition[2]])">
        <TresMesh :scale="tipScale" cast-shadow><TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 28, 28]" /><TresMeshStandardMaterial :color="colors.paws" :roughness=".26" /></TresMesh>
        <TresMesh v-if="frontPaw.style === 'mitten'" :position="vector([side * scheme.model.frontPaw.tipRadius * .72, .025, .015])" :scale="vector([.72, .58, .72])" cast-shadow><TresSphereGeometry :args="[scheme.model.frontPaw.tipRadius, 20, 20]" /><TresMeshStandardMaterial :color="colors.paws" :roughness=".28" /></TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>

  <TresGroup v-for="side in [-1, 1]" :key="`hp${side}`" :position="hindPosition(side)">
    <TresMesh :scale="vector([1.08, 1, .96])" cast-shadow>
      <TresSphereGeometry :args="[hindHaunchRadius, 24, 24]" />
      <TresMeshStandardMaterial :color="colors.body" :roughness="hindPaw.style === 'mechanical' ? .2 : .32" :metalness="hindPaw.style === 'mechanical' ? .32 : .03" />
    </TresMesh>
    <TresGroup :ref="node => setHindRef(node, side)">
      <TresGroup :rotation="hindLegRotation(side)">
        <TresMesh cast-shadow>
          <TresCylinderGeometry :args="[hindRootRadius, hindAnkleRadius, hindLegHeight, 24]" />
          <TresMeshStandardMaterial :color="colors.limbs" :roughness="hindPaw.style === 'mechanical' ? .18 : .3" :metalness="hindPaw.style === 'mechanical' ? .34 : .03" />
        </TresMesh>
        <TresGroup :position="hindAnklePosition">
          <TresMesh cast-shadow>
            <TresSphereGeometry :args="[hindAnkleRadius * (hindPaw.style === 'mechanical' ? 1.18 : 1.08), 20, 20]" />
            <TresMeshStandardMaterial :color="hindPaw.style === 'mechanical' ? colors.body : colors.limbs" :roughness="hindPaw.style === 'mechanical' ? .2 : .3" :metalness="hindPaw.style === 'mechanical' ? .38 : .03" />
          </TresMesh>
          <TresGroup :ref="node => setHindTipRef(node, side)" :position="hindFootPositionFromAnkle" :rotation="hindFootRotation(side)">
            <TresMesh :scale="hindFootScale" cast-shadow>
              <TresSphereGeometry :args="[scheme.model.hindPaw.tipRadius, 28, 28]" />
              <TresMeshStandardMaterial :color="colors.paws" :roughness="hindPaw.style === 'mechanical' ? .2 : .3" :metalness="hindPaw.style === 'mechanical' ? .28 : .02" />
            </TresMesh>
            <TresMesh v-if="hindPaw.style === 'boot'" :position="vector([0, -.025, scheme.model.hindPaw.tipRadius * .62])" :scale="vector([.82, .48, .72])" cast-shadow>
              <TresSphereGeometry :args="[scheme.model.hindPaw.tipRadius, 20, 20]" />
              <TresMeshStandardMaterial :color="colors.paws" :roughness=".28" />
            </TresMesh>
          </TresGroup>
        </TresGroup>
      </TresGroup>
    </TresGroup>
  </TresGroup>

  <TresMesh v-if="showEnergyCore" :position="energyCorePosition" :scale="vector([chestCoreScale, chestCoreScale, chestCoreScale])"><TresSphereGeometry :args="[scheme.model.chestCore.radius, 32, 32]" /><TresMeshStandardMaterial :color="colors.energyCore" :emissive="colors.energyCore" :emissive-intensity="scheme.model.chestCore.emissiveIntensity" :metalness=".25" :roughness=".12" /></TresMesh>
  <TresGroup v-if="showChestSymbol && chestTexture" :position="chestSymbolPosition" :rotation="chestSymbolRotation" :scale="chestSymbolScale"><TresPointLight :color="appearance.symbols.chest.color" :intensity="appearance.symbols.chest.glowIntensity * .55" /><TresMesh :render-order="4"><TresPlaneGeometry /><TresMeshBasicMaterial :map="chestTexture" transparent :side="DoubleSide" :depth-test="true" /></TresMesh></TresGroup>
  <TresGroup v-if="appearance.symbols.back.enabled && backTexture" :position="backSymbolPosition" :rotation="backSymbolRotation" :scale="backSymbolScale"><TresMesh :render-order="4"><TresPlaneGeometry /><TresMeshBasicMaterial :map="backTexture" transparent :side="DoubleSide" :depth-test="true" /></TresMesh></TresGroup>
</template>
