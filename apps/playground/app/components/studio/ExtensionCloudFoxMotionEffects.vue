<!--
  文件职责 / File responsibility
  渲染地面软影、思考泡泡、球、饭盆、睡云、喷嚏粒子、能量星空和随机烟花等动作道具与特效。
  Renders the soft ground shadow, thought bubbles, ball, meal, nap cloud, sneeze particles, energy starfield, and randomized fireworks.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Euler, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { clamp01, createExtensionCloudFoxMotionFrame, mix, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)

const ball = shallowRef<Group>()
const meal = shallowRef<Group>()
const energyRings = shallowRef<Group>()
const starGroup = shallowRef<Group>()
const starA = shallowRef<Group>()
const starB = shallowRef<Group>()
const starC = shallowRef<Group>()
const cloud = shallowRef<Group>()
const zzz = shallowRef<Group>()
const scanRing = shallowRef<Group>()
const thoughtBubbles = shallowRef<Group[]>([])
const sneezeParticles = shallowRef<Group[]>([])
const energyStars = shallowRef<Group[]>([])
const fireworkRockets = shallowRef<Group[]>([])
const fireworkBursts = shallowRef<Group[][]>([[], [], []])

const THINK_BUBBLE_COUNT = 5
const SNEEZE_PARTICLE_COUNT = 20
const ENERGY_STAR_COUNT = 46
const FIREWORK_BURST_COUNT = 3
const FIREWORK_PARTICLE_COUNT = 40
const thoughtIndexes = Array.from({ length: THINK_BUBBLE_COUNT }, (_, index) => index)
const sneezeIndexes = Array.from({ length: SNEEZE_PARTICLE_COUNT }, (_, index) => index)
const energyStarIndexes = Array.from({ length: ENERGY_STAR_COUNT }, (_, index) => index)
const fireworkParticleIndexes = Array.from({ length: FIREWORK_PARTICLE_COUNT }, (_, index) => index)
const fireworkBurstIndexes = Array.from({ length: FIREWORK_BURST_COUNT }, (_, index) => index)

const FIREWORK_PALETTES = [
  ['#ffffff', '#72f2ff', '#7a6fff', '#d788ff'],
  ['#fff9d8', '#ffd45e', '#ff7aac', '#ffffff'],
  ['#dffff4', '#52e0d0', '#65b9ff', '#a788ff'],
  ['#ffe9fb', '#ff72d0', '#a27cff', '#ffffff'],
] as const

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
let fireworkSeed = 1
let fireworkStyles = [0, 1, 2]

function setThoughtBubble(node: unknown, index: number) {
  if (node) thoughtBubbles.value[index] = node as Group
}
function setSneezeParticle(node: unknown, index: number) {
  if (node) sneezeParticles.value[index] = node as Group
}
function setEnergyStar(node: unknown, index: number) {
  if (node) energyStars.value[index] = node as Group
}
function setFireworkParticle(node: unknown, burstIndex: number, particleIndex: number) {
  if (!node) return
  fireworkBursts.value[burstIndex] ||= []
  fireworkBursts.value[burstIndex]![particleIndex] = node as Group
}
function setRocket(node: unknown, index: number) {
  if (node) fireworkRockets.value[index] = node as Group
}
function materialOf(group: Group) {
  const mesh = group.children[0] as Mesh | undefined
  return mesh?.material as MeshBasicMaterial | undefined
}
function fireworkColor(burstIndex: number, particleIndex: number) {
  const palette = FIREWORK_PALETTES[(fireworkSeed + burstIndex) % FIREWORK_PALETTES.length]!
  return palette[(particleIndex + fireworkSeed + burstIndex * 2) % palette.length]!
}
function fireworkDirection(style: number, index: number) {
  const angle = index / FIREWORK_PARTICLE_COUNT * Math.PI * 2
  if (style === 0) {
    const y = 1 - ((index + .5) / FIREWORK_PARTICLE_COUNT) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = index * 2.399963
    return vector(Math.cos(theta) * radius, y * .92, Math.sin(theta) * radius * .52).normalize()
  }
  if (style === 1) return vector(Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * .16).normalize()
  if (style === 2) {
    const ray = index % 2 === 0 ? 1 : .42
    return vector(Math.cos(angle) * ray, Math.sin(angle) * ray, Math.sin(index * 1.71) * .14).normalize()
  }
  const x = Math.pow(Math.sin(angle), 3)
  const y = (13 * Math.cos(angle) - 5 * Math.cos(angle * 2) - 2 * Math.cos(angle * 3) - Math.cos(angle * 4)) / 16
  return vector(x, y, Math.sin(angle * 2) * .1).normalize()
}

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
    if (props.behavior === 'fireworks-show') {
      fireworkSeed = Math.floor(Math.random() * 1000)
      fireworkStyles = [0, 1, 2].map((_, index) => (fireworkSeed + index * 3) % 4)
    }
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)

  thoughtBubbles.value.forEach((bubble, index) => {
    const active = props.behavior === 'thinking'
    bubble.visible = active
    if (!active) return
    const phase = (stateElapsed * .34 + index / THINK_BUBBLE_COUNT) % 1
    bubble.position.set(.58 + Math.sin(stateElapsed * .8 + index) * .06, 1.15 + phase * 1.24, .7)
    const fade = Math.sin(phase * Math.PI)
    bubble.scale.setScalar(Math.max(.001, (.08 + index * .024) * (.45 + fade * .75)))
    const material = materialOf(bubble)
    if (material) material.opacity = Math.max(0, fade * .62)
  })

  if (ball.value) {
    const active = props.behavior === 'playing-ball' || props.behavior === 'diving-catch'
    ball.value.visible = active
    if (props.behavior === 'playing-ball') {
      const hop = Math.abs(Math.sin(frame.ballProgress * Math.PI * 4))
      ball.value.position.set(Math.sin(frame.ballProgress * Math.PI * 4) * .72, -.74 + hop * 1.38, .92)
      ball.value.rotation.x += delta * 4.2
      ball.value.rotation.z += delta * 3.4
      ball.value.scale.setScalar(.86 + hop * .12)
    }
    else if (props.behavior === 'diving-catch') {
      const travel = smoothStep(.02, .56, frame.catchProgress)
      ball.value.position.set(-1.45 + travel * 2.65, 1.72 - travel * 1.08 + Math.sin(travel * Math.PI) * .66, .98)
      ball.value.rotation.x += delta * 8
      ball.value.scale.setScalar(.92)
    }
  }

  if (meal.value) {
    meal.value.visible = props.behavior === 'eating'
    const enter = props.behavior === 'eating'
      ? smoothStep(.02, .14, frame.eatProgress) * (1 - smoothStep(.9, .99, frame.eatProgress))
      : 0
    meal.value.scale.setScalar(Math.max(.001, enter))
    meal.value.position.set(0, -.92 + Math.sin(elapsed * 1.4) * .008, 1.08)
  }

  if (energyRings.value) {
    const active = props.behavior === 'energy-burst' || props.behavior === 'antenna-charge'
    energyRings.value.visible = active
    const strength = props.behavior === 'energy-burst'
      ? frame.energyRelease + frame.energyCharge * .22
      : frame.antennaRelease + frame.antennaChargePose * .18
    energyRings.value.scale.setScalar(Math.max(.001, .18 + strength * 2.35))
    energyRings.value.rotation.z += delta * (2.4 + strength * 4.8)
    energyRings.value.position.y = props.behavior === 'antenna-charge' ? 1.5 : -.12
  }

  if (starGroup.value) {
    starGroup.value.visible = props.behavior === 'star-juggle'
    starGroup.value.scale.setScalar(Math.max(.001, frame.jugglePose))
    starGroup.value.rotation.y += delta * .55
    ;[starA.value, starB.value, starC.value].forEach((star, index) => {
      if (!star) return
      const phase = frame.juggleProgress * Math.PI * 6 + index * Math.PI * 2 / 3
      const arc = Math.max(0, Math.sin(phase))
      star.position.set(Math.cos(phase) * .78, .3 + arc * 1.35 + index * .025, .96 + Math.sin(phase * .5) * .16)
      star.rotation.z += delta * (2.2 + index * .45)
      star.scale.setScalar(.78 + arc * .28)
    })
  }

  if (cloud.value) {
    cloud.value.visible = props.behavior === 'cloud-nap'
    cloud.value.scale.setScalar(Math.max(.001, frame.cloudNapPose * (1 + Math.sin(elapsed * 1.4) * .025)))
    cloud.value.position.set(-.02, -1.16 + Math.sin(elapsed * 1.15) * .024, .02)
    cloud.value.rotation.z = Math.sin(elapsed * .7) * .018
  }
  if (zzz.value) {
    zzz.value.visible = props.behavior === 'cloud-nap' && frame.cloudNapPose > .2
    zzz.value.position.set(.92 + Math.sin(elapsed * .9) * .05, .48 + ((stateElapsed * .16) % .72), .48)
    zzz.value.scale.setScalar(Math.max(.001, frame.cloudNapPose * (.72 + Math.sin(elapsed * 1.7) * .08)))
  }

  sneezeParticles.value.forEach((particle, index) => {
    const localTime = stateElapsed - 1.32 - index * .018
    const active = props.behavior === 'sparkle-sneeze' && localTime > 0 && localTime < 2.15
    particle.visible = active
    if (!active) return
    const angle = -.48 + index / Math.max(1, SNEEZE_PARTICLE_COUNT - 1) * .96
    const speed = 1.18 + (index % 5) * .12
    particle.position.set(
      .04 + Math.cos(angle) * speed * localTime,
      .78 + Math.sin(angle) * .58 * localTime - .5 * localTime * localTime,
      1.35 + .32 * localTime + Math.sin(index * 1.7) * .1,
    )
    particle.rotation.z += delta * (2.8 + index % 4)
    const fade = 1 - smoothStep(.82, 2.12, localTime)
    particle.scale.setScalar(Math.max(.001, (.045 + index % 4 * .009) * fade))
    const material = materialOf(particle)
    if (material) material.opacity = Math.max(0, fade * .9)
  })

  if (scanRing.value) {
    scanRing.value.visible = props.behavior === 'curious-scan'
    scanRing.value.position.x = Math.sin(frame.curiousProgress * Math.PI * 3) * .62
    scanRing.value.position.y = .78 + Math.cos(frame.curiousProgress * Math.PI * 2) * .16
    scanRing.value.scale.setScalar(Math.max(.001, frame.curiousPose * (1 + Math.sin(elapsed * 5) * .08)))
    scanRing.value.rotation.z += delta * 1.8
  }

  energyStars.value.forEach((star, index) => {
    const active = props.behavior === 'energy-burst' && frame.energyStarfield > .01
    star.visible = active
    if (!active) return
    const angle = index * 2.399963
    const layer = .35 + (index % 7) * .1
    const spread = frame.energyStarfield * (1.2 + (index % 5) * .12)
    star.position.set(
      Math.cos(angle) * layer * spread,
      1.55 + (index % 9) * .16 * spread + Math.sin(elapsed * 1.6 + index) * .05,
      .25 + Math.sin(angle) * .42 * spread,
    )
    star.rotation.z += delta * (1.4 + index % 5 * .3)
    const twinkle = .6 + Math.sin(elapsed * 5 + index * 1.7) * .3
    star.scale.setScalar(Math.max(.001, (.035 + index % 4 * .01) * frame.energyStarfield * twinkle))
    const material = materialOf(star)
    if (material) material.opacity = Math.max(0, frame.energyStarfield * (.55 + twinkle * .4))
  })

  fireworkBurstIndexes.forEach((burstIndex) => {
    const local = clamp01(frame.fireworksProgress * FIREWORK_BURST_COUNT - burstIndex)
    const rocket = fireworkRockets.value[burstIndex]
    if (rocket) {
      const rocketActive = props.behavior === 'fireworks-show' && local > 0 && local < .38
      rocket.visible = rocketActive
      if (rocketActive) {
        const launch = smoothStep(.01, .36, local)
        const startX = burstIndex % 2 === 0 ? -.62 : .62
        const endX = burstIndex % 2 === 0 ? -.78 : .78
        rocket.position.set(mix(startX, endX, launch), -.72 + launch * 3.12, .32)
        rocket.scale.setScalar(.8 + launch * .22)
      }
    }

    const burstProgress = clamp01((local - .3) / .7)
    const ease = 1 - Math.pow(1 - burstProgress, 2.35)
    const fade = 1 - smoothStep(.68, .99, burstProgress)
    const originX = burstIndex % 2 === 0 ? -.78 : .78
    const originY = 2.38 + burstIndex * .22
    const style = fireworkStyles[burstIndex] || 0
    fireworkBursts.value[burstIndex]?.forEach((particle, particleIndex) => {
      const active = props.behavior === 'fireworks-show' && burstProgress > .01 && fade > .01
      particle.visible = active
      if (!active) return
      const direction = fireworkDirection(style, particleIndex)
      const distance = ease * (1.7 + (particleIndex % 5) * .18)
      particle.position.set(
        originX + direction.x * distance,
        originY + direction.y * distance - burstProgress * burstProgress * .58,
        .25 + direction.z * distance,
      )
      particle.rotation.z += delta * (2 + particleIndex % 4)
      const size = Math.max(.001, Math.sin(burstProgress * Math.PI) * fade * (.055 + particleIndex % 4 * .012))
      particle.scale.setScalar(size)
      const material = materialOf(particle)
      if (material) {
        material.color.set(fireworkColor(burstIndex, particleIndex))
        material.opacity = Math.max(0, Math.sin(burstProgress * Math.PI) * fade)
      }
    })
  })
})
</script>

<template>
  <TresGroup>
    <TresMesh :position="vector(0, -1.72, 0)" :rotation="rotation(-Math.PI / 2, 0, 0)" :scale="vector(1.24, 1.24, 1.24)">
      <TresCircleGeometry :args="[1.12, 64]" />
      <TresMeshBasicMaterial color="#02040d" transparent :opacity=".12" :depth-write="false" />
    </TresMesh>
    <TresMesh :position="vector(0, -1.715, .02)" :rotation="rotation(-Math.PI / 2, 0, 0)" :scale="vector(.72, .72, .72)">
      <TresCircleGeometry :args="[1.05, 64]" />
      <TresMeshBasicMaterial color="#050817" transparent :opacity=".22" :depth-write="false" />
    </TresMesh>

    <TresGroup v-for="index in thoughtIndexes" :key="`thought-${index}`" :ref="node => setThoughtBubble(node, index)">
      <TresMesh><TresSphereGeometry :args="[1, 20, 20]" /><TresMeshBasicMaterial :color="index % 2 ? appearance.palette.secondaryGlow : appearance.palette.coatWarm" transparent :opacity="0" /></TresMesh>
    </TresGroup>

    <TresGroup ref="ball" :position="vector(0, -.7, .9)">
      <TresMesh cast-shadow><TresSphereGeometry :args="[.3, 28, 28]" /><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="1.4" :roughness=".18" /></TresMesh>
      <TresMesh :scale="vector(1.32, 1.32, 1.32)"><TresSphereGeometry :args="[.3, 20, 20]" /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".14" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>

    <TresGroup ref="meal">
      <TresMesh :position="vector(0, 0, 0)" :rotation="rotation(Math.PI / 2, 0, 0)"><TresCylinderGeometry :args="[.38, .48, .18, 42]" /><TresMeshStandardMaterial color="#817078" :roughness=".58" /></TresMesh>
      <TresMesh :position="vector(0, .08, .04)" :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.31, .07, 18, 42]" /><TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".34" /></TresMesh>
      <TresMesh :position="vector(0, .13, .04)" :scale="vector(.82, .34, .82)"><TresSphereGeometry :args="[.27, 24, 24]" /><TresMeshStandardMaterial color="#ffd27a" :roughness=".48" /></TresMesh>
    </TresGroup>

    <TresGroup ref="energyRings">
      <TresMesh :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.44, .035, 16, 64]" /><TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity=".78" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
      <TresMesh :rotation="rotation(Math.PI / 2, 0, Math.PI / 3)" :scale="vector(1.35, 1.35, 1.35)"><TresTorusGeometry :args="[.44, .025, 14, 64]" /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".58" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>

    <TresGroup ref="starGroup">
      <TresGroup ref="starA"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
      <TresGroup ref="starB"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
      <TresGroup ref="starC"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.tailGlow" :emissive="appearance.palette.tailGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
    </TresGroup>

    <TresGroup ref="cloud">
      <TresMesh v-for="(point, index) in [vector(-.56,0,0),vector(-.2,.12,.02),vector(.2,.08,0),vector(.58,-.02,.02)]" :key="index" :position="point" :scale="vector(index === 1 ? .72 : .56, index === 1 ? .5 : .42, .52)"><TresSphereGeometry :args="[1, 28, 28]" /><TresMeshStandardMaterial :color="appearance.palette.coatWarm" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".2" :roughness=".52" /></TresMesh>
    </TresGroup>
    <TresGroup ref="zzz">
      <TresMesh v-for="index in 3" :key="index" :position="vector((index - 2) * .16, (index - 1) * .15, 0)" :scale="vector(.12 + index * .025, .06, .04)"><TresBoxGeometry /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".65" /></TresMesh>
    </TresGroup>

    <TresGroup v-for="index in sneezeIndexes" :key="`sneeze-${index}`" :ref="node => setSneezeParticle(node, index)">
      <TresMesh><TresDodecahedronGeometry /><TresMeshBasicMaterial :color="index % 2 ? appearance.palette.primaryGlow : appearance.palette.secondaryGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>

    <TresGroup ref="scanRing">
      <TresMesh :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.38, .028, 14, 64]" /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".72" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>

    <TresGroup v-for="index in energyStarIndexes" :key="`energy-star-${index}`" :ref="node => setEnergyStar(node, index)">
      <TresMesh><TresDodecahedronGeometry /><TresMeshBasicMaterial :color="index % 3 === 0 ? appearance.palette.primaryGlow : index % 3 === 1 ? appearance.palette.secondaryGlow : appearance.palette.tailGlow" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
    </TresGroup>

    <template v-for="burstIndex in fireworkBurstIndexes" :key="`firework-${burstIndex}`">
      <TresGroup :ref="node => setRocket(node, burstIndex)">
        <TresMesh :scale="vector(.055, .14, .055)"><TresSphereGeometry :args="[1, 14, 14]" /><TresMeshBasicMaterial :color="fireworkColor(burstIndex, 0)" :blending="AdditiveBlending" :tone-mapped="false" /></TresMesh>
        <TresMesh :position="vector(0, -.18, 0)" :scale="vector(.025, .2, .025)"><TresCylinderGeometry :args="[1, 1, 1, 10]" /><TresMeshBasicMaterial :color="fireworkColor(burstIndex, 1)" transparent :opacity=".72" :blending="AdditiveBlending" :depth-write="false" /></TresMesh>
      </TresGroup>
      <TresGroup v-for="particleIndex in fireworkParticleIndexes" :key="`firework-${burstIndex}-${particleIndex}`" :ref="node => setFireworkParticle(node, burstIndex, particleIndex)">
        <TresMesh><TresSphereGeometry :args="[1, 10, 10]" /><TresMeshBasicMaterial :color="fireworkColor(burstIndex, particleIndex)" transparent :opacity="0" :blending="AdditiveBlending" :depth-write="false" :tone-mapped="false" /></TresMesh>
      </TresGroup>
    </template>
  </TresGroup>
</template>
