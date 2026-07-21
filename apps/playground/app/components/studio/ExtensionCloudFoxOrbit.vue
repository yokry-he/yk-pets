<!--
  文件职责 / File responsibility
  渲染可配置且常驻身体外侧的发光轨道；动作只增强速度、亮度和脉冲，不再从身体内部生成轨道。
  Renders configurable persistent body orbits outside the torso; motions only enhance speed, brightness, and pulse.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Euler, Vector3 } from 'three'
import type { Group, MeshBasicMaterial } from 'three'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
}>()

const root = shallowRef<Group>()
const ringA = shallowRef<Group>()
const ringB = shallowRef<Group>()
const ringC = shallowRef<Group>()
const particleGroup = shallowRef<Group>()
const materialA = shallowRef<MeshBasicMaterial>()
const materialB = shallowRef<MeshBasicMaterial>()
const materialC = shallowRef<MeshBasicMaterial>()

const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)
const particleIndexes = computed(() => Array.from({ length: props.appearance.orbitDesign.particleCount }, (_, index) => index))
const ringScale = computed(() => vector(
  props.appearance.orbitDesign.radius,
  props.appearance.orbitDesign.radius * props.appearance.orbitDesign.verticalScale,
  props.appearance.orbitDesign.radius,
))
const ringCount = computed(() => props.appearance.orbitDesign.ringCount)

useLoop().onBeforeRender(({ elapsed, delta }) => {
  const design = props.appearance.orbitDesign
  if (!root.value) return
  root.value.visible = design.enabled
  if (!design.enabled) return

  const energy = ['energy-burst', 'tail-tornado', 'fireworks-show', 'antenna-charge', 'tail-glow'].includes(props.behavior)
  const playful = ['happy', 'excited', 'playing', 'flapping', 'star-juggle'].includes(props.behavior)
  const speedBoost = energy ? 2.7 : playful ? 1.5 : 1
  const pulse = 1 + Math.sin(elapsed * (energy ? 6.2 : 2.2)) * (energy ? .08 : .025)
  root.value.scale.setScalar(pulse)

  if (ringA.value) ringA.value.rotation.z += delta * design.speed * 1.15 * speedBoost
  if (ringB.value) ringB.value.rotation.z -= delta * design.speed * .82 * speedBoost
  if (ringC.value) ringC.value.rotation.z += delta * design.speed * .58 * speedBoost
  if (particleGroup.value) particleGroup.value.rotation.y += delta * design.speed * .72 * speedBoost

  const intensity = Math.min(1, .18 + design.intensity * .18 + (energy ? .26 : playful ? .1 : 0))
  if (materialA.value) materialA.value.opacity = intensity
  if (materialB.value) materialB.value.opacity = intensity * .78
  if (materialC.value) materialC.value.opacity = intensity * .58
})
</script>

<template>
  <TresGroup
    ref="root"
    :visible="appearance.orbitDesign.enabled"
    :position="vector(0, -.18, 0)"
  >
    <TresGroup
      ref="ringA"
      :rotation="rotation(Math.PI / 2 + appearance.orbitDesign.tilt, 0, .18)"
      :scale="ringScale"
    >
      <TresMesh>
        <TresTorusGeometry :args="[1, .017, 12, 160]" />
        <TresMeshBasicMaterial
          ref="materialA"
          :color="appearance.orbitDesign.primaryColor"
          transparent
          :opacity=".36"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>
    </TresGroup>

    <TresGroup
      v-if="ringCount >= 2"
      ref="ringB"
      :rotation="rotation(Math.PI / 2 - appearance.orbitDesign.tilt * .7, .56, -.34)"
      :scale="vector(ringScale.x * .93, ringScale.y * 1.08, ringScale.z * .93)"
    >
      <TresMesh>
        <TresTorusGeometry :args="[1, .012, 12, 150]" />
        <TresMeshBasicMaterial
          ref="materialB"
          :color="appearance.orbitDesign.secondaryColor"
          transparent
          :opacity=".3"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>
    </TresGroup>

    <TresGroup
      v-if="ringCount >= 3"
      ref="ringC"
      :rotation="rotation(Math.PI / 2 + .2, -.52, appearance.orbitDesign.tilt * .55)"
      :scale="vector(ringScale.x * 1.06, ringScale.y * .86, ringScale.z * 1.06)"
    >
      <TresMesh>
        <TresTorusGeometry :args="[1, .009, 10, 140]" />
        <TresMeshBasicMaterial
          ref="materialC"
          :color="appearance.palette.halo"
          transparent
          :opacity=".22"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>
    </TresGroup>

    <TresGroup ref="particleGroup" :rotation="rotation(.2, 0, appearance.orbitDesign.tilt)">
      <TresMesh
        v-for="index in particleIndexes"
        :key="index"
        :position="vector(
          Math.cos(index / Math.max(1, particleIndexes.length) * Math.PI * 2) * appearance.orbitDesign.radius,
          Math.sin(index / Math.max(1, particleIndexes.length) * Math.PI * 2) * appearance.orbitDesign.radius * appearance.orbitDesign.verticalScale,
          Math.sin(index * 1.71) * .08,
        )"
        :scale="vector(.025 + index % 3 * .006, .025 + index % 3 * .006, .025 + index % 3 * .006)"
      >
        <TresSphereGeometry :args="[1, 10, 10]" />
        <TresMeshBasicMaterial
          :color="index % 2 ? appearance.orbitDesign.primaryColor : appearance.orbitDesign.secondaryColor"
          transparent
          :opacity=".68"
          :blending="AdditiveBlending"
          :depth-write="false"
        />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
