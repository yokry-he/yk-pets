<!--
  文件职责 / File responsibility
  组合扩展经典云狐的身体、头部、连续尾巴与动作特效，并按正式 Chrome 扩展阶段曲线驱动全身运动。
  Composes the extension classic Cloud Fox body, head, continuous tail, and motion effects while driving the full body with production Chrome extension phase curves.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxBody from './ExtensionCloudFoxBody.vue'
import ExtensionCloudFoxHead from './ExtensionCloudFoxHead.vue'
import ExtensionCloudFoxTail from './ExtensionCloudFoxTail.vue'
import ExtensionCloudFoxMotionEffects from './ExtensionCloudFoxMotionEffects.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
  view: CloudFoxStudioView
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const presentation = shallowRef<Group>()
const motion = shallowRef<Group>()
const viewY = computed(() => ({ front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2 }[props.view]))

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
let spinStart = 0
let flipStart = 0
let tornadoStart = 0

useLoop().onBeforeRender(({ elapsed, delta }) => {
  const presentationGroup = presentation.value
  const motionGroup = motion.value
  if (!presentationGroup || !motionGroup) return

  presentationGroup.rotation.y = damp(presentationGroup.rotation.y, viewY.value, 7, delta)
  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
    spinStart = motionGroup.rotation.y
    flipStart = motionGroup.rotation.x
    tornadoStart = motionGroup.rotation.y
  }

  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const state = props.behavior
  const highEnergyScale = .96

  const sleeping = state === 'sleeping'
  const thinking = state === 'thinking'
  const happy = state === 'happy' || state === 'talking'
  const excited = state === 'excited'
  const playing = state === 'playing' || state === 'flapping'
  const resting = state === 'resting'
  const eating = state === 'eating'
  const cloudNap = state === 'cloud-nap'
  const fireworks = state === 'fireworks-show'

  const bobSpeed = sleeping ? 1.1 : thinking ? 3.2 : playing || frame.highEnergy ? 4.7 : eating || state === 'stretching' ? 1.35 : 1.9
  const bobAmount = sleeping ? .03 : happy ? .11 : playing || frame.highEnergy ? .12 : excited ? .15 : resting || eating || state === 'stretching' ? .018 : .07
  const baseY = resting
    ? -.28
    : cloudNap
      ? -.38 - frame.cloudNapPose * .2
      : state === 'stretching'
        ? scheme.model.rootPosition[1] + frame.stretchStrength * .12
        : eating
          ? .1
          : state === 'energy-burst'
            ? .12 - frame.energyCharge * .09
            : state === 'antenna-charge'
              ? .13 - frame.antennaChargePose * .04
              : fireworks
                ? .02
                : scheme.model.rootPosition[1]
  const happyHop = happy ? Math.max(0, Math.sin(elapsed * 8.5)) * .11 : 0
  const flapHop = state === 'flapping' ? Math.max(0, Math.sin(stateElapsed * 9)) * .12 : 0
  const ballHop = state === 'playing-ball' ? Math.max(0, Math.sin(stateElapsed * 5.4)) * .06 : 0
  const targetY = baseY
    + Math.sin(elapsed * bobSpeed) * bobAmount
    + happyHop
    + frame.jumpOffset
    + flapHop
    + ballHop
    + frame.backflipLift * highEnergyScale
    + (state === 'diving-catch' ? Math.sin(frame.catchProgress * Math.PI) * .32 : 0)
    + (state === 'star-juggle' ? Math.max(0, Math.sin(frame.juggleProgress * Math.PI * 4)) * .05 : 0)
    + frame.pawTapBeat * .035
  const targetX = state === 'playing'
    ? Math.sin(elapsed * 2.4) * .2
    : state === 'playing-ball'
      ? Math.sin(frame.ballProgress * Math.PI * 4) * .075
      : state === 'diving-catch'
        ? Math.sin(frame.catchProgress * Math.PI) * .22
        : cloudNap
          ? -.12 * frame.cloudNapPose
          : 0

  motionGroup.position.y = damp(motionGroup.position.y, targetY, state === 'jumping' ? 10 : 5.2, delta)
  motionGroup.position.x = damp(motionGroup.position.x, targetX, 4.8, delta)

  if (state === 'spinning') {
    const eased = 1 - Math.pow(1 - frame.spinProgress, 3)
    motionGroup.rotation.y = spinStart + eased * Math.PI * 2
  }
  else if (state === 'tail-tornado') {
    const eased = smoothStep(.12, .9, frame.tornadoProgress)
    motionGroup.rotation.y = tornadoStart + eased * Math.PI * 5
  }
  else {
    motionGroup.rotation.y = damp(motionGroup.rotation.y, 0, 5.4, delta)
  }

  if (state === 'backflip') {
    const rotationProgress = smoothStep(.12, .9, frame.backflipProgress)
    motionGroup.rotation.x = flipStart - rotationProgress * Math.PI * 2
  }
  else {
    const targetXRotation = resting
      ? .16
      : cloudNap
        ? .12 * frame.cloudNapPose
        : state === 'stretching'
          ? -.08 - frame.stretchStrength * .08
          : eating
            ? .08
            : state === 'sparkle-sneeze'
              ? frame.sneezeRelease * .18 - frame.sneezeCharge * .08
              : state === 'diving-catch'
                ? -.22 * frame.catchDive
                : 0
    motionGroup.rotation.x = damp(motionGroup.rotation.x, targetXRotation, 6, delta)
  }

  const targetZRotation = state === 'confused'
    ? Math.sin(elapsed * 2.2) * .09
    : state === 'listening'
      ? -.08
      : state === 'playing'
        ? Math.sin(elapsed * 4.8) * .06
        : state === 'shy-peek'
          ? -.06 * frame.shyPose
          : 0
  motionGroup.rotation.z = damp(motionGroup.rotation.z, targetZRotation, 6, delta)

  const squash = frame.jumpLanding * .08
    + frame.energyCharge * .035
    + frame.pawTapBeat * .018
  const stretchScale = frame.stretchStrength * .04
  motionGroup.scale.x = damp(motionGroup.scale.x, 1 + squash - stretchScale * .25, 7, delta)
  motionGroup.scale.y = damp(motionGroup.scale.y, 1 - squash + stretchScale, 7, delta)
  motionGroup.scale.z = damp(motionGroup.scale.z, 1 + squash * .4, 7, delta)
})
</script>

<template>
  <TresGroup ref="presentation">
    <ExtensionCloudFoxMotionEffects :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
    <TresGroup ref="motion" :position="vector(scheme.model.rootPosition)">
      <ExtensionCloudFoxTail :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxBody :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxHead :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
    </TresGroup>
  </TresGroup>
</template>
