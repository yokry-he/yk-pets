<!--
  文件职责 / File responsibility
  在不复制头部模型的前提下叠加网页追视、烟花追踪和可配置鼻嘴，并保持统一头部动作坐标。
  Adds page gaze, fireworks tracking, and configurable nose/mouth parts without duplicating the head model while preserving one animated head space.
-->
<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxFaceCustomization from './ExtensionCloudFoxFaceCustomization.vue'
import ExtensionCloudFoxGazeOverlay from './ExtensionCloudFoxGazeOverlay.vue'
import ExtensionCloudFoxHead from './ExtensionCloudFoxHead.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { createProductionFireworkBurstPlan, PRODUCTION_FIREWORK_BURST_COUNT } from '~/domain/production-cloud-fox-fireworks'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = withDefaults(defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  headBehavior?: ExtensionCloudFoxMotionId
  motionKey: number
  pointer?: { x: number; y: number }
  fireworkSeed?: number
}>(), {
  pointer: () => ({ x: 0, y: 0 }),
  fireworkSeed: 0,
})
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const inverseHeadPosition = vector(scheme.model.head.position).multiplyScalar(-1)
const headPivot = shallowRef<Group>()
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const pivot = headPivot.value
  if (!pivot) return
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  let targetX = 0
  let targetY = 0

  if (props.behavior === 'fireworks-show') {
    const burstIndex = Math.floor(Math.min(PRODUCTION_FIREWORK_BURST_COUNT - .001, frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT))
    const burst = createProductionFireworkBurstPlan(props.fireworkSeed, burstIndex)
    targetX = -.42 + Math.sin(frame.fireworksProgress * Math.PI * 6) * .035
    targetY = clamp(burst.originX * .18, -.24, .24)
  }
  else if (props.behavior === 'idle' || props.behavior === 'listening') {
    targetX = clamp(props.pointer.y, -1, 1) * .18
    targetY = clamp(props.pointer.x, -1, 1) * .34
  }

  pivot.rotation.x = damp(pivot.rotation.x, targetX, 5.5, delta)
  pivot.rotation.y = damp(pivot.rotation.y, targetY, 5.5, delta)
  pivot.rotation.z = damp(pivot.rotation.z, 0, 6, delta)
})
</script>

<template>
  <TresGroup ref="headPivot" :position="vector(scheme.model.head.position)">
    <TresGroup :position="inverseHeadPosition">
      <ExtensionCloudFoxHead :appearance="appearance" :behavior="headBehavior || behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxFaceCustomization :appearance="appearance" :behavior="headBehavior || behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxGazeOverlay
        :appearance="appearance"
        :behavior="behavior"
        :motion-key="motionKey"
        :pointer="pointer"
        :firework-seed="fireworkSeed"
      />
    </TresGroup>
  </TresGroup>
</template>
