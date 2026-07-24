<!--
  文件职责 / File responsibility
  为吃饭动作提供贴近嘴部的悬浮小桌、饭盆和食物，并保持桌沿低于嘴部。
  Provides a mouth-level floating table, bowl, and food while keeping the table edge below the mouth.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()

const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const meal = shallowRef<Group>()
const food = shallowRef<Group>()
const TABLE_HEIGHT = .84
const BOWL_Y = TABLE_HEIGHT + .13
const FLOATING_TABLE_Y = -.68
const TABLE_Z = .94

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
  const active = props.behavior === 'eating'
  const visibility = active
    ? smoothStep(.02, .14, frame.eatProgress) * (1 - smoothStep(.9, .99, frame.eatProgress))
    : 0

  if (meal.value) {
    meal.value.visible = visibility > .01
    meal.value.scale.setScalar(Math.max(.001, visibility))
    meal.value.position.set(0, FLOATING_TABLE_Y + Math.sin(elapsed * 1.4) * .008, TABLE_Z)
  }
  if (food.value) {
    const remaining = Math.max(.1, 1 - Math.max(0, (frame.eatProgress - .18) / .62) * .86)
    food.value.scale.y = remaining
    food.value.rotation.y += delta * .35
  }
})
</script>

<template>
  <TresGroup ref="meal" :visible="false" :position="vector(0, FLOATING_TABLE_Y, TABLE_Z)" :scale="vector(.001, .001, .001)">
    <TresMesh :position="vector(0, .1, 0)" :scale="vector(.9, .38, .9)">
      <TresCylinderGeometry :args="[.48, .58, .16, 40]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".34" :metalness=".06" />
    </TresMesh>
    <TresMesh :position="vector(0, TABLE_HEIGHT * .48, 0)">
      <TresCylinderGeometry :args="[.15, .19, TABLE_HEIGHT * .72, 32]" />
      <TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".16" :roughness=".3" :metalness=".1" />
    </TresMesh>
    <TresMesh :position="vector(0, TABLE_HEIGHT, 0)" :scale="vector(1.06, .38, 1)">
      <TresCylinderGeometry :args="[.58, .62, .16, 40]" />
      <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" :metalness=".06" />
    </TresMesh>

    <TresGroup :position="vector(0, BOWL_Y, -.015)">
      <TresMesh :scale="vector(1.12, .46, 1)">
        <TresCylinderGeometry :args="[.36, .46, .22, 40]" />
        <TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".24" :roughness=".28" :metalness=".12" />
      </TresMesh>
      <TresMesh :position="vector(0, .13, 0)" :scale="vector(.96, .28, .96)">
        <TresCylinderGeometry :args="[.3, .3, .1, 40]" />
        <TresMeshStandardMaterial color="#151b35" :roughness=".3" />
      </TresMesh>
      <TresGroup ref="food" :position="vector(0, .19, 0)">
        <TresMesh :position="vector(-.12, .02, .03)"><TresSphereGeometry :args="[.075, 18, 18]" /><TresMeshStandardMaterial :color="appearance.palette.secondaryGlow" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".75" /></TresMesh>
        <TresMesh :position="vector(.08, .035, -.07)"><TresSphereGeometry :args="[.068, 18, 18]" /><TresMeshStandardMaterial color="#ffd977" emissive="#ffd977" :emissive-intensity=".55" /></TresMesh>
        <TresMesh :position="vector(.13, .02, .08)"><TresSphereGeometry :args="[.058, 18, 18]" /><TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".5" /></TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
