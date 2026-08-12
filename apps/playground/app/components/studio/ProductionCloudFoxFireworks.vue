<!--
  文件职责 / File responsibility
  以 Chrome 扩展正式高空烟花秀为唯一标准，供 Studio 与扩展共享三段发射、48 粒子、花型和配色逻辑。
  Uses the production Chrome extension high-altitude fireworks show as the single source for the three launches, 48 particles, shapes, and palettes shared by Studio and the extension.
-->
<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { clamp01, createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import {
  createProductionFireworkBurstPlan,
  PRODUCTION_FIREWORK_BURST_COUNT,
  PRODUCTION_FIREWORK_PARTICLE_COUNT,
  writeProductionFireworkDirection,
} from '~/domain/production-cloud-fox-fireworks'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
  seed: number
}>()

const particleIndexes = Array.from({ length: PRODUCTION_FIREWORK_PARTICLE_COUNT }, (_, index) => index)
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rocket = shallowRef<Group>()
const rocketTrail = shallowRef<Mesh>()
const burst = shallowRef<Group>()
const particles = shallowRef<Mesh[]>([])
const directions = Array.from({ length: PRODUCTION_FIREWORK_PARTICLE_COUNT }, () => new Vector3())
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let previousSeed = props.seed
let startedAt = 0
let configuredBurst = -1
let originX = 0
let originY = 2.7

function setParticle(node: unknown, index: number) {
  if (node) particles.value[index] = node as Mesh
}

function configureBurst(index: number) {
  configuredBurst = index
  const plan = createProductionFireworkBurstPlan(props.seed, index)
  originX = plan.originX
  originY = plan.originY

  for (let particleIndex = 0; particleIndex < PRODUCTION_FIREWORK_PARTICLE_COUNT; particleIndex += 1) {
    writeProductionFireworkDirection(directions[particleIndex]!, plan.style, particleIndex)
    const particle = particles.value[particleIndex]
    if (!particle) continue
    const material = particle.material as MeshBasicMaterial
    material.color.set(plan.palette[particleIndex % plan.palette.length]!)
    material.opacity = 0
    particle.position.set(0, 0, 0)
    particle.scale.setScalar(.001)
  }
}

function resetParticles() {
  particles.value.forEach((particle) => {
    particle.visible = false
    particle.scale.setScalar(.001)
    ;(particle.material as MeshBasicMaterial).opacity = 0
  })
}

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey || props.seed !== previousSeed) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    previousSeed = props.seed
    startedAt = elapsed
    configuredBurst = -1
    resetParticles()
  }

  const active = props.behavior === 'fireworks-show'
  if (!active) {
    if (rocket.value) rocket.value.visible = false
    if (rocketTrail.value) rocketTrail.value.visible = false
    if (burst.value) burst.value.visible = false
    resetParticles()
    return
  }

  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const scaled = Math.min(PRODUCTION_FIREWORK_BURST_COUNT - .001, frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT)
  const burstIndex = Math.floor(scaled)
  if (configuredBurst !== burstIndex) configureBurst(burstIndex)

  const localProgress = scaled - burstIndex
  const launchProgress = smoothStep(.02, .38, localProgress)
  const burstProgress = clamp01((localProgress - .36) / .64)
  const burstEase = 1 - Math.pow(1 - burstProgress, 2.4)
  const fade = 1 - smoothStep(.72, .99, burstProgress)
  const launchStartX = burstIndex % 2 === 0 ? -.48 : .48
  const launchStartY = -.2

  if (rocket.value) {
    rocket.value.visible = localProgress < .43
    rocket.value.position.set(
      launchStartX + (originX - launchStartX) * launchProgress,
      launchStartY + (originY - launchStartY) * launchProgress + Math.sin(launchProgress * Math.PI) * .14,
      .48,
    )
    rocket.value.scale.setScalar(localProgress < .43 ? .9 + launchProgress * .22 : .001)
  }
  if (rocketTrail.value) {
    rocketTrail.value.visible = localProgress < .43
    rocketTrail.value.position.set(
      launchStartX + (originX - launchStartX) * launchProgress,
      launchStartY - .22 + (originY - .28 - (launchStartY - .22)) * launchProgress,
      .45,
    )
    rocketTrail.value.scale.set(.5 + launchProgress * .8, 1.2 + launchProgress * 1.4, .5)
    ;(rocketTrail.value.material as MeshBasicMaterial).opacity = (1 - smoothStep(.28, .43, localProgress)) * .5
  }

  if (burst.value) {
    burst.value.visible = true
    burst.value.position.set(originX, originY, .4)
    burst.value.rotation.z += delta * .14
  }
  particles.value.forEach((particle, particleIndex) => {
    const visible = burstProgress > .001 && fade > .001
    particle.visible = visible
    if (!visible) return
    const direction = directions[particleIndex]!
    const stagger = (particleIndex % 7) * .012
    const localBurst = clamp01((burstProgress - stagger) / Math.max(.1, 1 - stagger))
    const distance = burstEase * (.34 + (particleIndex % 5) * .045) * 2.65
    particle.position.set(
      direction.x * distance,
      direction.y * distance - localBurst ** 2 * .42,
      direction.z * distance,
    )
    particle.scale.setScalar(Math.max(.001, (.8 + (particleIndex % 4) * .11) * Math.sin(localBurst * Math.PI) * fade))
    ;(particle.material as MeshBasicMaterial).opacity = Math.max(0, Math.sin(localBurst * Math.PI) * fade * .94)
  })
})
</script>

<template>
  <TresGroup>
    <TresGroup ref="rocket" :scale="vector(.001, .001, .001)">
      <TresMesh :scale="vector(.075, .075, .075)">
        <TresSphereGeometry :args="[1, 20, 20]" />
        <TresMeshBasicMaterial :color="appearance.palette.coatWarm" :blending="AdditiveBlending" :tone-mapped="false" />
      </TresMesh>
    </TresGroup>
    <TresMesh ref="rocketTrail" :scale="vector(.001, .001, .001)">
      <TresCylinderGeometry :args="[.018, .055, .3, 12]" />
      <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" :tone-mapped="false" />
    </TresMesh>
    <TresGroup ref="burst" :visible="false">
      <TresMesh v-for="particleIndex in particleIndexes" :key="particleIndex" :ref="node => setParticle(node, particleIndex)" :scale="vector(.001, .001, .001)">
        <TresSphereGeometry :args="[.075, 12, 12]" />
        <TresMeshBasicMaterial color="#ffffff" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" :tone-mapped="false" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
