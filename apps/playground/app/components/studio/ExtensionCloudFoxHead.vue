<!--
  文件职责 / File responsibility
  使用统一扩展基线渲染云狐头部；耳朵外层、内层和尖端颜色均由独立配置控制。
  Renders the Cloud Fox head from the unified extension baseline with independently configurable outer, inner, and tip ear colors.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Color, Euler, Vector3 } from 'three'
import type { Group, MeshStandardMaterial } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type { CloudFoxStudioBehavior } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: CloudFoxStudioBehavior
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const scaled = (values: readonly number[], multiplier = 1) => new Vector3(
  (values[0] || 0) * multiplier,
  (values[1] || 0) * multiplier,
  (values[2] || 0) * multiplier,
)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)

const head = shallowRef<Group>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const glowMaterials = shallowRef<MeshStandardMaterial[]>([])
const headScale = computed(() => scaled(scheme.model.head.scale, props.appearance.proportions.headScale))
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing)
const earX = computed(() => scheme.model.head.earOffset[0] * props.appearance.proportions.earScale)
const antennaX = computed(() => props.appearance.antennaDesign.spacing / 2)
const antennaY = computed(() => props.appearance.proportions.antennaScale * (props.appearance.antennaDesign.length / scheme.model.antenna.rod[2]))
const antennaRod = computed(() => [
  scheme.model.antenna.rod[0] * (props.appearance.antennaDesign.thickness / scheme.model.antenna.rod[1]),
  props.appearance.antennaDesign.thickness,
  scheme.model.antenna.rod[2],
  scheme.model.antenna.rod[3],
] as const)
const cheekOpacity = computed(() => ['greeting', 'jumping'].includes(props.behavior) ? .32 : 0)

function registerGlow(reference: unknown) {
  const material = reference as MeshStandardMaterial | null
  if (material && !glowMaterials.value.includes(material)) glowMaterials.value.push(material)
}

const rainbow = new Color()
useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (head.value) {
    const target = props.behavior === 'greeting'
      ? Math.sin(elapsed * 5.8) * .13
      : props.behavior === 'resting' ? .08 : 0
    head.value.rotation.z += (target - head.value.rotation.z) * Math.min(1, delta * 7)
  }

  const antennaMotion = Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.2) * .05
  if (leftAntenna.value) leftAntenna.value.rotation.z = -props.appearance.antennaDesign.tilt + antennaMotion
  if (rightAntenna.value) rightAntenna.value.rotation.z = props.appearance.antennaDesign.tilt - antennaMotion

  const pulse = 1 + Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.5) * .12
  if (props.appearance.glow.mode === 'rainbow') rainbow.setHSL((elapsed * .11) % 1, .86, .64)
  for (const material of glowMaterials.value) {
    material.emissiveIntensity = props.appearance.glow.intensity * pulse
    if (props.appearance.glow.mode === 'rainbow') {
      material.color.copy(rainbow)
      material.emissive.copy(rainbow)
    }
  }
})
</script>

<template>
  <TresGroup ref="head" :position="vector(scheme.model.head.position)" :scale="headScale">
    <TresGroup
      v-for="side in [-1, 1]"
      :key="`ear-${side}`"
      :position="vector([side * earX, scheme.model.head.earOffset[1], scheme.model.head.earOffset[2]])"
      :rotation="rotation([0, 0, side * scheme.model.head.earRotationZ])"
      :scale="vector([appearance.proportions.earScale, appearance.proportions.earScale, appearance.proportions.earScale])"
    >
      <TresMesh cast-shadow>
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.34, 28, 28]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.54, .86, .42]" />
        <TresConeGeometry v-else :args="scheme.model.head.earOuter" />
        <TresMeshStandardMaterial
          :color="appearance.earDesign.outerColor"
          :roughness="appearance.parts.ears === 'mechanical' ? .22 : .3"
          :metalness="appearance.parts.ears === 'mechanical' ? .68 : .04"
        />
      </TresMesh>

      <TresMesh
        :position="vector(scheme.model.head.earInnerPosition)"
        :scale="vector(scheme.model.head.earInnerScale)"
      >
        <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.28, 24, 24]" />
        <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.42, .66, .2]" />
        <TresConeGeometry v-else :args="scheme.model.head.earInner" />
        <TresMeshStandardMaterial
          :color="appearance.earDesign.innerColor"
          :emissive="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowColor : '#000000'"
          :emissive-intensity="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowIntensity : 0"
          :roughness=".24"
        />
      </TresMesh>

      <TresMesh
        v-if="appearance.parts.ears !== 'rounded' && appearance.parts.ears !== 'floppy'"
        :position="vector([0, .28, .055])"
        :scale="vector([.34, .34, .34])"
      >
        <TresConeGeometry :args="[.22, .42, appearance.parts.ears === 'petal' ? 6 : 4]" />
        <TresMeshStandardMaterial :color="appearance.earDesign.tipColor" :roughness=".2" />
      </TresMesh>
    </TresGroup>

    <template v-if="appearance.parts.antenna !== 'none'">
      <TresGroup
        v-for="side in [-1, 1]"
        :key="`antenna-${side}`"
        :ref="side < 0 ? (node: any) => leftAntenna = node : (node: any) => rightAntenna = node"
        :position="vector([side * antennaX, scheme.model.antenna.offset[1], scheme.model.antenna.offset[2]])"
        :rotation="rotation([
          scheme.model.antenna.rotation[0],
          side < 0 ? scheme.model.antenna.rotation[1] : -scheme.model.antenna.rotation[1],
          side * appearance.antennaDesign.tilt,
        ])"
        :scale="vector([appearance.proportions.antennaScale, antennaY, appearance.proportions.antennaScale])"
      >
        <TresMesh :position="vector(scheme.model.antenna.rodPosition)">
          <TresCylinderGeometry :args="antennaRod" />
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".22" :metalness=".04" />
        </TresMesh>
        <TresMesh :position="vector([side * scheme.model.antenna.tipPosition[0], scheme.model.antenna.tipPosition[1], scheme.model.antenna.tipPosition[2]])">
          <TresTorusGeometry v-if="appearance.parts.antennaTip === 'ring'" :args="[.12, .035, 12, 28]" />
          <TresDodecahedronGeometry v-else-if="appearance.parts.antennaTip === 'crystal'" :args="[.11, 0]" />
          <TresSphereGeometry v-else :args="[scheme.model.antenna.tipRadius, 20, 20]" />
          <TresMeshStandardMaterial
            :ref="registerGlow"
            :color="appearance.palette.antennaGlow"
            :emissive="appearance.palette.antennaGlow"
            :emissive-intensity="1.6"
            transparent
            :opacity=".9"
            :roughness=".1"
          />
        </TresMesh>
        <TresMesh
          :position="vector([side * scheme.model.antenna.tipPosition[0], scheme.model.antenna.tipPosition[1], scheme.model.antenna.tipPosition[2]])"
          :scale="vector([scheme.model.antenna.auraScale, scheme.model.antenna.auraScale, scheme.model.antenna.auraScale])"
        >
          <TresSphereGeometry :args="[scheme.model.antenna.tipRadius, 16, 16]" />
          <TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity=".14" :depth-write="false" />
        </TresMesh>
      </TresGroup>
    </template>

    <TresMesh>
      <TresSphereGeometry :args="[scheme.model.head.radius, 64, 64]" />
      <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" :metalness=".04" />
    </TresMesh>
    <TresMesh :position="vector(scheme.model.head.muzzlePosition)" :scale="vector(scheme.model.head.muzzleScale)">
      <TresSphereGeometry :args="[scheme.model.head.muzzleRadius, 48, 48]" />
      <TresMeshStandardMaterial :color="scheme.palette.muzzle" :roughness=".34" />
    </TresMesh>

    <template v-if="appearance.parts.eyes !== 'visor'">
      <TresGroup
        v-for="side in [-1, 1]"
        :key="`eye-${side}`"
        :position="vector([side * eyeX, scheme.model.head.eyeOffset[1], scheme.model.head.eyeOffset[2]])"
      >
        <TresMesh
          :scale="appearance.parts.eyes === 'sleepy'
            ? vector([.19, .07, .08])
            : appearance.parts.eyes === 'oval'
              ? vector([.13, .25, .1])
              : scaled(scheme.model.head.eyeScale, appearance.proportions.eyeScale)"
        >
          <TresDodecahedronGeometry v-if="['spark', 'diamond'].includes(appearance.parts.eyes)" />
          <TresSphereGeometry v-else :args="[1, 32, 32]" />
          <TresMeshStandardMaterial :color="appearance.palette.eye" :roughness=".08" />
        </TresMesh>
        <TresMesh
          v-if="appearance.parts.eyes === 'round'"
          :position="vector(scheme.model.head.eyeHighlightPosition)"
          :scale="vector(scheme.model.head.eyeHighlightScale)"
        >
          <TresSphereGeometry />
          <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" />
        </TresMesh>
      </TresGroup>
    </template>
    <TresMesh
      v-else
      :position="vector([0, scheme.model.head.eyeOffset[1], scheme.model.head.eyeOffset[2]])"
      :scale="vector([.72, .16, .08])"
    >
      <TresBoxGeometry />
      <TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".42" />
    </TresMesh>

    <TresMesh
      v-for="side in [-1, 1]"
      :key="`cheek-${side}`"
      :position="vector([side * scheme.model.head.cheekOffset[0], scheme.model.head.cheekOffset[1], scheme.model.head.cheekOffset[2]])"
      :scale="vector(scheme.model.head.cheekScale)"
    >
      <TresSphereGeometry />
      <TresMeshBasicMaterial :color="scheme.palette.cheek" transparent :opacity="cheekOpacity" />
    </TresMesh>
    <TresMesh :position="vector(scheme.model.head.nosePosition)" :scale="vector(scheme.model.head.noseScale)">
      <TresSphereGeometry />
      <TresMeshStandardMaterial :color="scheme.palette.nose" :roughness=".22" />
    </TresMesh>
    <TresGroup :position="vector(scheme.model.head.mouthPosition)">
      <TresMesh :scale="vector(scheme.model.head.mouthScale)">
        <TresSphereGeometry />
        <TresMeshStandardMaterial :color="scheme.palette.mouth" :roughness=".2" />
      </TresMesh>
      <TresMesh :position="vector(scheme.model.head.tonguePosition)" :scale="vector(scheme.model.head.tongueScale)">
        <TresSphereGeometry />
        <TresMeshBasicMaterial :color="scheme.palette.tongue" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
