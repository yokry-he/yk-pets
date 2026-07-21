<!--
  文件职责 / File responsibility
  在玩球与正面飞扑动作中覆盖静态眼睛高光，并用共享球坐标驱动清晰可见的双眼追视。
  Covers the static eye highlights during ball play and front-facing catch, then drives clearly visible binocular gaze from the shared ball pose.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()

const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const root = shallowRef<Group>()
const leftHighlight = shallowRef<Group>()
const rightHighlight = shallowRef<Group>()
const headScale = computed(() => vector(
  scheme.model.head.scale[0] * props.appearance.proportions.headScale,
  scheme.model.head.scale[1] * props.appearance.proportions.headScale,
  scheme.model.head.scale[2] * props.appearance.proportions.headScale,
))
const eyeX = computed(() => scheme.model.head.eyeOffset[0] * props.appearance.proportions.eyeSpacing)
const baseHighlightX = Math.abs(scheme.model.head.eyeHighlightPosition[0])
const baseHighlightY = scheme.model.head.eyeOffset[1] + scheme.model.head.eyeHighlightPosition[1]
const highlightZ = scheme.model.head.eyeOffset[2] + scheme.model.head.eyeHighlightPosition[2] + .012

function setHighlight(node: unknown, side: -1 | 1) {
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
  const active = props.behavior === 'playing-ball' || props.behavior === 'diving-catch'
  if (root.value) root.value.visible = active
  if (!active) return

  const target = props.behavior === 'playing-ball'
    ? createBallMotionPose(frame.ballProgress).position
    : createCatchMotionPose(frame.catchProgress).ballPosition
  const gazeX = clamp(target.x * .125, -.095, .095)
  const gazeY = clamp((target.y + .08) * .055, -.052, .058)
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
  <TresGroup ref="root" :visible="false" :position="vector(...scheme.model.head.position)" :scale="headScale">
    <template v-for="side in [-1, 1] as const" :key="`gaze-${side}`">
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
