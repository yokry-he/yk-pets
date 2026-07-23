<!--
  文件职责 / File responsibility
  覆盖静态眼睛高光，并用共享球、网页指针和正式烟花发射原点驱动清晰可见的双眼追视。
  Covers static eye highlights and drives visible binocular gaze from shared ball poses, the page pointer, and production fireworks origins.
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { createProductionFireworkBurstPlan, PRODUCTION_FIREWORK_BURST_COUNT } from '~/domain/production-cloud-fox-fireworks'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = withDefaults(defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
  pointer?: { x: number; y: number }
  fireworkSeed?: number
}>(), {
  pointer: () => ({ x: 0, y: 0 }),
  fireworkSeed: 0,
})

const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const root = shallowRef<Group>()
const leftHighlight = shallowRef<Group>()
const rightHighlight = shallowRef<Group>()
const sides = [-1, 1]
const headScale = computed(() => vector(
  scheme.model.head.scale[0] * props.appearance.proportions.headScale,
  scheme.model.head.scale[1] * props.appearance.proportions.headScale,
  scheme.model.head.scale[2] * props.appearance.proportions.headScale,
))
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing)
const baseHighlightX = Math.abs(scheme.model.head.eyeHighlightPosition[0])
const baseHighlightY = scheme.model.head.eyeOffset[1] + scheme.model.head.eyeHighlightPosition[1]
const highlightZ = scheme.model.head.eyeOffset[2] + scheme.model.head.eyeHighlightPosition[2] + .012
const headPosition = vector(
  scheme.model.head.position[0],
  scheme.model.head.position[1],
  scheme.model.head.position[2],
)

function setHighlight(node: unknown, side: number) {
  if (side < 0) leftHighlight.value = node as Group | undefined
  else rightHighlight.value = node as Group | undefined
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
  const pointerActive = (props.behavior === 'idle' || props.behavior === 'listening')
    && (Math.abs(props.pointer.x) > .01 || Math.abs(props.pointer.y) > .01)
  const active = props.behavior === 'playing-ball'
    || props.behavior === 'diving-catch'
    || props.behavior === 'fireworks-show'
    || pointerActive
  if (root.value) root.value.visible = active
  if (!active) return

  let gazeX = 0
  let gazeY = 0
  if (props.behavior === 'playing-ball' || props.behavior === 'diving-catch') {
    const target = props.behavior === 'playing-ball'
      ? createBallMotionPose(frame.ballProgress).position
      : createCatchMotionPose(frame.catchProgress).ballPosition
    gazeX = clamp(target.x * .125, -.095, .095)
    gazeY = clamp((target.y + .08) * .055, -.052, .058)
  }
  else if (props.behavior === 'fireworks-show') {
    const burstIndex = Math.floor(Math.min(PRODUCTION_FIREWORK_BURST_COUNT - .001, frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT))
    const burst = createProductionFireworkBurstPlan(props.fireworkSeed, burstIndex)
    gazeX = clamp(burst.originX * .025, -.045, .045)
    gazeY = .052
  }
  else {
    gazeX = clamp(props.pointer.x * .038, -.052, .052)
    gazeY = clamp(-props.pointer.y * .036, -.052, .052)
  }

  const blinkPhase = (elapsed + .73) % 4.8
  const blinkDistance = Math.abs(blinkPhase - 4.64)
  const blinkScale = blinkDistance < .13 ? .12 + blinkDistance / .13 * .88 : 1
  const update = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const targetX = side * eyeX.value + side * baseHighlightX + gazeX
    group.position.x += (targetX - group.position.x) * Math.min(1, delta * 13)
    group.position.y += (baseHighlightY + gazeY - group.position.y) * Math.min(1, delta * 13)
    group.scale.y += (blinkScale - group.scale.y) * Math.min(1, delta * 15)
  }
  update(leftHighlight.value, -1)
  update(rightHighlight.value, 1)
})
</script>

<template>
  <TresGroup ref="root" :visible="false" :position="headPosition" :scale="headScale">
    <template v-for="side in sides" :key="`gaze-${side}`">
      <TresMesh :position="vector(side * eyeX + side * baseHighlightX, baseHighlightY, highlightZ - .006)" :scale="vector(.058, .078, .031)">
        <TresSphereGeometry :args="[1, 18, 18]" />
        <TresMeshBasicMaterial :color="appearance.palette.eye" />
      </TresMesh>
      <TresGroup :ref="node => setHighlight(node, side)" :position="vector(side * eyeX + side * baseHighlightX, baseHighlightY, highlightZ)">
        <TresMesh :scale="vector(.048, .068, .026)">
          <TresSphereGeometry :args="[1, 20, 20]" />
          <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" :tone-mapped="false" />
        </TresMesh>
      </TresGroup>
    </template>
  </TresGroup>
</template>
