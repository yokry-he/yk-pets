<!--
  文件职责 / File responsibility
  复现正式 Chrome 扩展动作中的球、餐具、能量环、星星、睡云、喷嚏闪光、扫描环和烟花等可见道具与特效。
  Recreates visible production Chrome extension motion props and effects: ball, meal, energy rings, stars, nap cloud, sneeze sparkles, scan rings, and fireworks.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Euler, Vector3 } from 'three'
import type { Group } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { clamp01, createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'

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
const sneeze = shallowRef<Group>()
const shyCloud = shallowRef<Group>()
const scanRing = shallowRef<Group>()
const fireworkBursts = shallowRef<Group[]>([])

function setFireworkBurst(node: unknown, index: number) {
  if (node) fireworkBursts.value[index] = node as Group
}

const fireworkPoints = Array.from({ length: 20 }, (_, index) => {
  const angle = index / 20 * Math.PI * 2
  const ray = index % 2 === 0 ? 1 : .56
  return { index, position: vector(Math.cos(angle) * ray, Math.sin(angle) * ray, Math.sin(angle * 3) * .12) }
})

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

  if (ball.value) {
    const active = props.behavior === 'playing-ball' || props.behavior === 'diving-catch'
    ball.value.visible = active
    if (props.behavior === 'playing-ball') {
      const hop = Math.abs(Math.sin(frame.ballProgress * Math.PI * 4))
      ball.value.position.set(Math.sin(frame.ballProgress * Math.PI * 4) * .72, -.74 + hop * 1.38, .9)
      ball.value.rotation.x += delta * 4.2
      ball.value.rotation.z += delta * 3.4
      ball.value.scale.setScalar(.86 + hop * .12)
    }
    else if (props.behavior === 'diving-catch') {
      const travel = smoothStep(.04, .66, frame.catchProgress)
      ball.value.position.set(-1.2 + travel * 2.25, 1.62 - travel * 1.02 + Math.sin(travel * Math.PI) * .5, .94)
      ball.value.rotation.x += delta * 7
      ball.value.scale.setScalar(.9)
    }
  }

  if (meal.value) {
    meal.value.visible = props.behavior === 'eating'
    const enter = props.behavior === 'eating'
      ? smoothStep(.02, .17, frame.eatProgress) * (1 - smoothStep(.88, .99, frame.eatProgress))
      : 0
    meal.value.scale.setScalar(Math.max(.001, enter))
    meal.value.position.y = -1.3 + Math.sin(elapsed * 1.4) * .012
  }

  if (energyRings.value) {
    const active = props.behavior === 'energy-burst' || props.behavior === 'antenna-charge'
    energyRings.value.visible = active
    const strength = props.behavior === 'energy-burst'
      ? frame.energyRelease + frame.energyCharge * .22
      : frame.antennaRelease + frame.antennaChargePose * .18
    energyRings.value.scale.setScalar(Math.max(.001, .18 + strength * 2.25))
    energyRings.value.rotation.z += delta * (2.4 + strength * 4)
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
    cloud.value.position.set(-.12, -1.18 + Math.sin(elapsed * 1.15) * .028, .02)
    cloud.value.rotation.z = Math.sin(elapsed * .7) * .018
  }
  if (zzz.value) {
    zzz.value.visible = props.behavior === 'cloud-nap' && frame.cloudNapPose > .2
    zzz.value.position.set(.9 + Math.sin(elapsed * .9) * .05, .42 + ((stateElapsed * .16) % .72), .42)
    zzz.value.scale.setScalar(Math.max(.001, frame.cloudNapPose * (.72 + Math.sin(elapsed * 1.7) * .08)))
  }

  if (sneeze.value) {
    sneeze.value.visible = props.behavior === 'sparkle-sneeze' && frame.sneezeRelease > .01
    sneeze.value.position.set(.08 + frame.sneezeRelease * .54, .83, 1.38)
    sneeze.value.scale.setScalar(Math.max(.001, frame.sneezeRelease * 1.2))
    sneeze.value.rotation.z += delta * 3.5
  }

  if (shyCloud.value) {
    shyCloud.value.visible = props.behavior === 'shy-peek'
    shyCloud.value.position.set(.36 - frame.shyPose * .16, .58, 1.05)
    shyCloud.value.scale.setScalar(Math.max(.001, frame.shyPose * .88))
  }

  if (scanRing.value) {
    scanRing.value.visible = props.behavior === 'curious-scan'
    scanRing.value.position.x = Math.sin(frame.curiousProgress * Math.PI * 3) * .62
    scanRing.value.position.y = .78 + Math.cos(frame.curiousProgress * Math.PI * 2) * .16
    scanRing.value.scale.setScalar(Math.max(.001, frame.curiousPose * (1 + Math.sin(elapsed * 5) * .08)))
    scanRing.value.rotation.z += delta * 1.8
  }

  fireworkBursts.value.forEach((burst, index) => {
    const active = props.behavior === 'fireworks-show'
    const scaled = frame.fireworksProgress * 3
    const local = clamp01(scaled - index)
    const burstProgress = clamp01((local - .28) / .72)
    const visible = active && local > .26 && local < 1
    burst.visible = visible
    if (!visible) return
    const fade = 1 - smoothStep(.72, .99, burstProgress)
    const size = Math.max(.001, Math.sin(burstProgress * Math.PI) * fade * 1.55)
    burst.position.set(index % 2 === 0 ? -.78 : .78, 2.3 + index * .26, .25)
    burst.scale.setScalar(size)
    burst.rotation.z += delta * (.28 + index * .08)
  })
})
</script>

<template>
  <TresGroup>
    <TresGroup ref="ball" :position="vector(0, -.7, .9)">
      <TresMesh cast-shadow><TresSphereGeometry :args="[.3, 28, 28]"/><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="1.4" :roughness=".18"/></TresMesh>
      <TresMesh :scale="vector(1.32, 1.32, 1.32)"><TresSphereGeometry :args="[.3, 20, 20]"/><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".14" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
    </TresGroup>

    <TresGroup ref="meal">
      <TresMesh :position="vector(0, -1.32, .72)" :rotation="rotation(-Math.PI / 2, 0, 0)"><TresCylinderGeometry :args="[.62, .7, .12, 36]"/><TresMeshStandardMaterial color="#8b6f71" :roughness=".62"/></TresMesh>
      <TresMesh :position="vector(0, -1.14, .78)" :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.28, .09, 16, 36]"/><TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".34"/></TresMesh>
      <TresMesh :position="vector(0, -1.12, .78)"><TresSphereGeometry :args="[.2, 22, 22]"/><TresMeshStandardMaterial color="#ffd27a" :roughness=".48"/></TresMesh>
    </TresGroup>

    <TresGroup ref="energyRings">
      <TresMesh :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.44, .035, 16, 64]"/><TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity=".72" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
      <TresMesh :rotation="rotation(Math.PI / 2, 0, Math.PI / 3)" :scale="vector(1.35, 1.35, 1.35)"><TresTorusGeometry :args="[.44, .025, 14, 64]"/><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".48" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
    </TresGroup>

    <TresGroup ref="starGroup">
      <TresGroup ref="starA"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]"/><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity="3"/></TresMesh></TresGroup>
      <TresGroup ref="starB"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]"/><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="3"/></TresMesh></TresGroup>
      <TresGroup ref="starC"><TresMesh><TresDodecahedronGeometry :args="[.16, 0]"/><TresMeshStandardMaterial :color="appearance.palette.tailGlow" :emissive="appearance.palette.tailGlow" :emissive-intensity="3"/></TresMesh></TresGroup>
    </TresGroup>

    <TresGroup ref="cloud">
      <TresMesh v-for="(point, index) in [vector(-.46,0,0),vector(-.14,.1,.02),vector(.18,.06,0),vector(.48,-.02,.02)]" :key="index" :position="point" :scale="vector(index === 1 ? .62 : .48, index === 1 ? .46 : .38, .45)"><TresSphereGeometry :args="[1, 24, 24]"/><TresMeshStandardMaterial :color="appearance.palette.coatWarm" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".18" :roughness=".5"/></TresMesh>
    </TresGroup>
    <TresGroup ref="zzz">
      <TresMesh v-for="index in 3" :key="index" :position="vector((index - 2) * .16, (index - 1) * .15, 0)" :scale="vector(.12 + index * .025, .06, .04)"><TresBoxGeometry/><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".65"/></TresMesh>
    </TresGroup>

    <TresGroup ref="sneeze">
      <TresMesh v-for="index in 7" :key="index" :position="vector(Math.cos(index * .9) * (.18 + index * .025), Math.sin(index * .9) * (.16 + index * .02), 0)" :scale="vector(.04, .04, .04)"><TresDodecahedronGeometry/><TresMeshBasicMaterial :color="index % 2 ? appearance.palette.primaryGlow : appearance.palette.secondaryGlow" transparent :opacity=".82" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
    </TresGroup>

    <TresGroup ref="shyCloud">
      <TresMesh :scale="vector(.78,.58,.24)"><TresSphereGeometry :args="[.55,28,28]"/><TresMeshStandardMaterial :color="appearance.palette.coatWarm" transparent :opacity=".78" :roughness=".42"/></TresMesh>
    </TresGroup>

    <TresGroup ref="scanRing">
      <TresMesh :rotation="rotation(Math.PI / 2, 0, 0)"><TresTorusGeometry :args="[.32,.024,14,48]"/><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" transparent :opacity=".72" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
      <TresMesh :scale="vector(.06,.06,.06)"><TresSphereGeometry/><TresMeshBasicMaterial :color="appearance.palette.primaryGlow"/></TresMesh>
    </TresGroup>

    <TresGroup v-for="burstIndex in 3" :key="`firework-${burstIndex}`" :ref="node => setFireworkBurst(node, burstIndex - 1)">
      <TresMesh v-for="point in fireworkPoints" :key="point.index" :position="point.position" :scale="vector(.045,.045,.045)"><TresSphereGeometry :args="[1,10,10]"/><TresMeshBasicMaterial :color="point.index % 3 === 0 ? appearance.palette.primaryGlow : point.index % 3 === 1 ? appearance.palette.secondaryGlow : appearance.palette.tailGlow" transparent :opacity=".86" :blending="AdditiveBlending" :depth-write="false"/></TresMesh>
    </TresGroup>
  </TresGroup>
</template>
