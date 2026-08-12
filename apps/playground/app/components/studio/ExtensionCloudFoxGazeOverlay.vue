<!--
  文件职责 / File responsibility
  只为圆润/椭圆眼提供网页指针、球和烟花追视高光，并按独立头型 Profile 对齐。
  Provides pointer, ball, and fireworks gaze highlights only for round/oval eyes and aligns them through the independent head profile.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
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
const profile = computed(() => getCloudFoxHeadProfile(props.appearance.parts.headShape))
const headScale = computed(() => props.appearance.proportions.headScale)
const supportsGaze = computed(() => props.appearance.parts.eyes === 'round' || props.appearance.parts.eyes === 'oval')
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing * profile.value.eyeX * headScale.value)
const baseHighlightX = computed(() => Math.abs(scheme.model.head.eyeHighlightPosition[0]) * headScale.value)
const baseHighlightY = computed(() => (scheme.model.head.eyeOffset[1] + profile.value.eyeY + scheme.model.head.eyeHighlightPosition[1]) * headScale.value)
const highlightZ = computed(() => (scheme.model.head.eyeOffset[2] + profile.value.eyeZ + scheme.model.head.eyeHighlightPosition[2] + .012) * headScale.value)
const headPosition = computed(() => vector(
  scheme.model.head.position[0] + profile.value.offset[0] * headScale.value,
  scheme.model.head.position[1] + profile.value.offset[1] * headScale.value,
  scheme.model.head.position[2] + profile.value.offset[2] * headScale.value,
))
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
  const pointerActive = (props.behavior === 'idle' || props.behavior === 'listening') && (Math.abs(props.pointer.x) > .01 || Math.abs(props.pointer.y) > .01)
  const active = supportsGaze.value && (props.behavior === 'playing-ball' || props.behavior === 'diving-catch' || props.behavior === 'fireworks-show' || pointerActive)
  if (root.value) root.value.visible = active
  if (!active) return
  let gazeX = 0
  let gazeY = 0
  if (props.behavior === 'playing-ball' || props.behavior === 'diving-catch') {
    const target = props.behavior === 'playing-ball' ? createBallMotionPose(frame.ballProgress).position : createCatchMotionPose(frame.catchProgress).ballPosition
    gazeX = clamp(target.x * .125, -.095, .095) * headScale.value
    gazeY = clamp((target.y + .08) * .055, -.052, .058) * headScale.value
  }
  else if (props.behavior === 'fireworks-show') {
    const burstIndex = Math.floor(Math.min(PRODUCTION_FIREWORK_BURST_COUNT - .001, frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT))
    const burst = createProductionFireworkBurstPlan(props.fireworkSeed, burstIndex)
    gazeX = clamp(burst.originX * .025, -.045, .045) * headScale.value
    gazeY = .052 * headScale.value
  }
  else {
    gazeX = clamp(props.pointer.x * .038, -.052, .052) * headScale.value
    gazeY = clamp(-props.pointer.y * .036, -.052, .052) * headScale.value
  }
  const update = (group: Group | undefined, side: -1 | 1) => {
    if (!group) return
    const targetX = side * eyeX.value + side * baseHighlightX.value + gazeX
    group.position.x += (targetX - group.position.x) * Math.min(1, delta * 13)
    group.position.y += (baseHighlightY.value + gazeY - group.position.y) * Math.min(1, delta * 13)
  }
  update(leftHighlight.value, -1)
  update(rightHighlight.value, 1)
})
</script>

<template>
  <TresGroup ref="root" :visible="false" :position="headPosition">
    <template v-for="side in [-1, 1]" :key="`gaze-${side}`">
      <TresMesh :position="vector(side * eyeX + side * baseHighlightX, baseHighlightY, highlightZ - .006 * headScale)" :scale="vector(.058 * headScale, .078 * headScale, .031 * headScale)">
        <TresSphereGeometry :args="[1, 18, 18]" /><TresMeshBasicMaterial :color="appearance.palette.eye" />
      </TresMesh>
      <TresGroup :ref="node => setHighlight(node, side)" :position="vector(side * eyeX + side * baseHighlightX, baseHighlightY, highlightZ)">
        <TresMesh :scale="vector(.048 * headScale, .068 * headScale, .026 * headScale)"><TresSphereGeometry :args="[1, 20, 20]" /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" :tone-mapped="false" /></TresMesh>
      </TresGroup>
    </template>
  </TresGroup>
</template>
