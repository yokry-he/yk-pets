<!--
  文件职责 / File responsibility
  渲染地面软影、思考泡泡、共享球轨迹、扩展风格餐桌、睡云、扫描环、喷嚏粒子和能量星空；正式烟花由独立共享组件负责。
  Renders the soft shadow, thought bubbles, shared ball trajectory, extension-style meal table, nap cloud, scan ring, sneeze particles, and energy starfield; production fireworks live in the dedicated shared component.
-->
<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Euler, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)

const ball = shallowRef<Group>()
const meal = shallowRef<Group>()
const food = shallowRef<Group>()
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

const THINK_BUBBLE_COUNT = 5
const SNEEZE_PARTICLE_COUNT = 20
const ENERGY_STAR_COUNT = 46
const MEAL_TABLE_HEIGHT = .84
const MEAL_BOWL_LOCAL_Y = MEAL_TABLE_HEIGHT + .13
const thoughtIndexes = Array.from({ length: THINK_BUBBLE_COUNT }, (_, index) => index)
const sneezeIndexes = Array.from({ length: SNEEZE_PARTICLE_COUNT }, (_, index) => index)
const energyStarIndexes = Array.from({ length: ENERGY_STAR_COUNT }, (_, index) => index)

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

function setThoughtBubble(node: unknown, index: number) {
  if (node) thoughtBubbles.value[index] = node as Group
}
function setSneezeParticle(node: unknown, index: number) {
  if (node) sneezeParticles.value[index] = node as Group
}
function setEnergyStar(node: unknown, index: number) {
  if (node) energyStars.value[index] = node as Group
}
function materialOf(group: Group) {
  const mesh = group.children[0] as Mesh | undefined
  return mesh?.material as MeshBasicMaterial | undefined
}

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const ballPose = createBallMotionPose(frame.ballProgress)
  const catchPose = createCatchMotionPose(frame.catchProgress)

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
      ball.value.position.copy(ballPose.position)
      ball.value.rotation.x += delta * 4.2
      ball.value.rotation.z += delta * 3.4
      ball.value.scale.setScalar(.86 + ballPose.height * .12)
    }
    else if (props.behavior === 'diving-catch') {
      ball.value.position.copy(catchPose.ballPosition)
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
    meal.value.position.set(0, -1.42 + Math.sin(elapsed * 1.4) * .006, 1.08)
    if (food.value) {
      const foodRemaining = Math.max(.1, 1 - Math.max(0, (frame.eatProgress - .18) / .62) * .86)
      food.value.scale.y = foodRemaining
      food.value.rotation.y += delta * .35
    }
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
    cloud.value.position.set(-.02, -.88 + Math.sin(elapsed * 1.15) * .024, .08)
    cloud.value.rotation.z = Math.sin(elapsed * .7) * .018
  }
  if (zzz.value) {
    zzz.value.visible = props.behavior === 'cloud-nap' && frame.cloudNapPose > .2
    zzz.value.position.set(.92 + Math.sin(elapsed * .9) * .05, .78 + ((stateElapsed * .16) % .72), .48)
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
    scanRing.value.position.y = 1.1 + Math.cos(frame.curiousProgress * Math.PI * 2) * .16
    scanRing.value.position.z = 1.34
    scanRing.value.scale.setScalar(Math.max(.001, frame.curiousPose * (1 + Math.sin(elapsed * 5) * .08)))
    scanRing.value.rotation.z += delta * 1.8
  }

  energyStars.value.forEach((star, index) => {
    const travel = smoothStep(.56, .94, frame.energyProgress)
    const fade = 1 - smoothStep(.66, 1, travel)
    const active = props.behavior === 'energy-burst' && travel > .01 && fade > .01
    star.visible = active
    if (!active) return
    const angle = index * 2.399963
    const layer = .35 + (index % 7) * .1
    const spread = travel * (1.2 + (index % 5) * .12)
    star.position.set(
      Math.cos(angle) * layer * spread,
      .2 + (index % 9) * .16 * spread + Math.sin(elapsed * 1.6 + index) * .05,
      .45 + Math.sin(angle) * .42 * spread,
    )
    star.rotation.z += delta * (1.4 + index % 5 * .3)
    star.scale.setScalar(.035 + index % 4 * .01)
    const material = materialOf(star)
    if (material) material.opacity = Math.max(0, fade * (.55 + Math.sin(elapsed * 5 + index * 1.7) * .18))
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
      <TresMesh :position="vector(0, .1, 0)" :scale="vector(1, .42, 1)"><TresCylinderGeometry :args="[.48, .62, .16, 40]" /><TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".34" :metalness=".06" /></TresMesh>
      <TresMesh :position="vector(0, MEAL_TABLE_HEIGHT * .48, 0)"><TresCylinderGeometry :args="[.16, .2, MEAL_TABLE_HEIGHT * .72, 32]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".16" :roughness=".3" :metalness=".1" /></TresMesh>
      <TresMesh :position="vector(0, MEAL_TABLE_HEIGHT, 0)" :scale="vector(1.16, .42, 1)"><TresCylinderGeometry :args="[.62, .67, .16, 40]" /><TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" :metalness=".06" /></TresMesh>
      <TresGroup :position="vector(0, MEAL_BOWL_LOCAL_Y, 0)">
        <TresMesh :scale="vector(1.18, .48, 1)"><TresCylinderGeometry :args="[.38, .48, .22, 40]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".24" :roughness=".28" :metalness=".12" /></TresMesh>
        <TresMesh :position="vector(0, .13, 0)" :scale="vector(1, .28, 1)"><TresCylinderGeometry :args="[.31, .31, .1, 40]" /><TresMeshStandardMaterial color="#151b35" :roughness=".3" /></TresMesh>
        <TresGroup ref="food" :position="vector(0, .19, 0)">
          <TresMesh :position="vector(-.12, .02, .03)"><TresSphereGeometry :args="[.075, 18, 18]" /><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".75" /></TresMesh>
          <TresMesh :position="vector(.08, .035, -.07)"><TresSphereGeometry :args="[.068, 18, 18]" /><TresMeshStandardMaterial color="#ffd977" emissive="#ffd977" :emissive-intensity=".55" /></TresMesh>
          <TresMesh :position="vector(.13, .02, .08)"><TresSphereGeometry :args="[.058, 18, 18]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".5" /></TresMesh>
        </TresGroup>
      </TresGroup>
    </TresGroup>

    <TresGroup ref="starGroup">
      <TresGroup ref="starA"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
      <TresGroup ref="starB"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
      <TresGroup ref="starC"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]" /><TresMeshStandardMaterial :color="appearance.palette.tailGlow" :emissive="appearance.palette.tailGlow" :emissive-intensity="3" /></TresMesh></TresGroup>
    </TresGroup>

    <TresGroup ref="cloud">
      <TresMesh v-for="(point, index) in [vector(-.7,0,0),vector(-.28,.12,.02),vector(.2,.1,0),vector(.68,-.02,.02)]" :key="index" :position="point" :scale="vector(index === 1 ? .82 : .64, index === 1 ? .56 : .46, .58)"><TresSphereGeometry :args="[1, 28, 28]" /><TresMeshStandardMaterial :color="appearance.palette.coatWarm" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".2" :roughness=".52" /></TresMesh>
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
  </TresGroup>
</template>
