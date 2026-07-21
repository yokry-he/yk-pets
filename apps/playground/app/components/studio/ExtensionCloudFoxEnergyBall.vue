<!--
  文件职责 / File responsibility
  在触角尖端中点或双前爪中点生成能量球，并让充能粒子向内汇聚、爆发粒子只向外扩散淡出。
  Creates an energy ball at the antenna-tip midpoint or front-paw midpoint, with inward charge particles and strictly outward burst particles.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))

const energyBall = shallowRef<Group>()
const core = shallowRef<Mesh>()
const aura = shallowRef<Mesh>()
const shockwave = shallowRef<Mesh>()
const chargeParticles = shallowRef<Group[]>([])
const burstParticles = shallowRef<Group[]>([])
const PARTICLE_COUNT = 20
const particleIndexes = Array.from({ length: PARTICLE_COUNT }, (_, index) => index)
const antennaTipMidpointAnchor = new Vector3()
const frontPawMidpointAnchor = new Vector3()

function setChargeParticle(node: unknown, index: number) {
  if (node) chargeParticles.value[index] = node as Group
}
function setBurstParticle(node: unknown, index: number) {
  if (node) burstParticles.value[index] = node as Group
}
function materialOf(group: Group) {
  return (group.children[0] as Mesh | undefined)?.material as MeshBasicMaterial | undefined
}
function updateAnchors() {
  const headScale = props.appearance.proportions.headScale
  const antennaScale = props.appearance.proportions.antennaScale
  const antennaLengthScale = props.appearance.antennaDesign.length / scheme.model.antenna.rod[2]
  antennaTipMidpointAnchor.set(
    0,
    scheme.model.head.position[1]
      + scheme.model.head.scale[1] * headScale * (scheme.model.antenna.offset[1] + scheme.model.antenna.tipPosition[1] * antennaScale * antennaLengthScale + .16),
    scheme.model.head.position[2]
      + scheme.model.head.scale[2] * headScale * (scheme.model.antenna.offset[2] + scheme.model.antenna.tipPosition[2] + .12),
  )

  const pawOffset = scheme.model.frontPaw.offset
  frontPawMidpointAnchor.set(
    0,
    pawOffset[1] + scheme.model.frontPaw.forearmPosition[1] + scheme.model.frontPaw.tipPosition[1] * .34,
    pawOffset[2] + scheme.model.frontPaw.tipPosition[2] + .2,
  )
}

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const isAntennaCharge = props.behavior === 'antenna-charge'
  const isEnergyBurst = props.behavior === 'energy-burst'
  const active = isAntennaCharge || isEnergyBurst
  updateAnchors()

  const group = energyBall.value
  if (!group) return
  group.visible = active
  if (!active) {
    group.scale.setScalar(.001)
    return
  }

  const charge = isAntennaCharge ? frame.antennaChargePose : frame.energyCharge
  const release = isAntennaCharge ? frame.antennaRelease : frame.energyRelease
  const progress = isAntennaCharge ? frame.antennaProgress : frame.energyProgress
  const anchor = isAntennaCharge ? antennaTipMidpointAnchor : frontPawMidpointAnchor
  group.position.x = damp(group.position.x, anchor.x, 12, delta)
  group.position.y = damp(group.position.y, anchor.y + charge * .05, 12, delta)
  group.position.z = damp(group.position.z, anchor.z, 12, delta)
  group.rotation.y += delta * (1.8 + charge * 4.2)
  group.rotation.z += delta * (1.2 + charge * 3.4)

  const ballVisibility = smoothStep(.02, .16, progress) * (1 - smoothStep(.88, .99, progress))
  const ballSize = Math.max(.001, (.12 + charge * .72 + release * .24) * ballVisibility)
  group.scale.setScalar(damp(group.scale.x, ballSize, 13, delta))

  if (core.value) {
    const material = core.value.material as MeshBasicMaterial
    material.opacity = Math.min(1, .7 + charge * .26 + release * .2)
    core.value.scale.setScalar(1 + Math.sin(elapsed * 12) * .08 * Math.max(.2, charge))
  }
  if (aura.value) {
    const material = aura.value.material as MeshBasicMaterial
    material.opacity = .12 + charge * .28 + release * .22
    aura.value.scale.setScalar(1.65 + charge * .4 + Math.sin(elapsed * 7) * .08)
  }

  const releaseStart = isAntennaCharge ? .42 : .48
  const releaseTravel = smoothStep(releaseStart, .92, progress)
  if (shockwave.value) {
    shockwave.value.visible = releaseTravel > .005
    shockwave.value.scale.setScalar(.22 + releaseTravel * 3.4)
    const material = shockwave.value.material as MeshBasicMaterial
    material.opacity = Math.max(0, (1 - smoothStep(.58, 1, releaseTravel)) * .72)
  }

  chargeParticles.value.forEach((particle, index) => {
    const activeCharge = charge > .01 && releaseTravel < .22
    particle.visible = activeCharge
    if (!activeCharge) return
    const angle = index * 2.399963 + elapsed * .7
    const shell = .72 + (index % 5) * .11
    const inward = 1 - smoothStep(0, .94, charge)
    const radius = .1 + shell * inward
    particle.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 1.37) * radius * .72,
      Math.sin(angle) * radius * .55,
    )
    particle.scale.setScalar(.035 + (index % 4) * .008)
    const material = materialOf(particle)
    if (material) material.opacity = Math.min(.88, .18 + charge * .7)
  })

  burstParticles.value.forEach((particle, index) => {
    const activeBurst = releaseTravel > .01
    particle.visible = activeBurst
    if (!activeBurst) return
    const angle = index * 2.399963
    const vertical = 1 - ((index + .5) / PARTICLE_COUNT) * 2
    const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical))
    const distance = releaseTravel * (1.1 + (index % 5) * .17)
    particle.position.set(
      Math.cos(angle) * radial * distance,
      vertical * distance - releaseTravel * releaseTravel * .24,
      Math.sin(angle) * radial * distance * .72,
    )
    particle.scale.setScalar(.045 + (index % 4) * .009)
    const material = materialOf(particle)
    if (material) material.opacity = Math.max(0, (1 - smoothStep(.66, 1, releaseTravel)) * .92)
  })
})
</script>

<template>
  <TresGroup ref="energyBall" :visible="false" :scale="vector(.001, .001, .001)">
    <TresMesh ref="core">
      <TresSphereGeometry :args="[.34, 36, 36]" />
      <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".8" :blending="AdditiveBlending" :depth-write="false" :tone-mapped="false" />
    </TresMesh>
    <TresMesh ref="aura">
      <TresSphereGeometry :args="[.34, 28, 28]" />
      <TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity=".18" :blending="AdditiveBlending" :depth-write="false" :tone-mapped="false" />
    </TresMesh>
    <TresMesh ref="shockwave" :visible="false" :rotation="vector(Math.PI / 2, 0, 0)">
      <TresTorusGeometry :args="[.4, .035, 16, 72]" />
      <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" />
    </TresMesh>
    <TresGroup v-for="index in particleIndexes" :key="`energy-charge-${index}`" :ref="node => setChargeParticle(node, index)">
      <TresMesh><TresSphereGeometry :args="[1, 10, 10]" /><TresMeshBasicMaterial :color="index % 2 ? appearance.palette.primaryGlow : appearance.palette.secondaryGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>
    <TresGroup v-for="index in particleIndexes" :key="`energy-burst-${index}`" :ref="node => setBurstParticle(node, index)">
      <TresMesh><TresDodecahedronGeometry :args="[1, 0]" /><TresMeshBasicMaterial :color="index % 3 === 0 ? appearance.palette.primaryGlow : index % 3 === 1 ? appearance.palette.secondaryGlow : appearance.palette.tailGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>
  </TresGroup>
</template>
