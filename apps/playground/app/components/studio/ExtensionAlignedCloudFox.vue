<!--
  文件职责 / File responsibility
  组合扩展经典云狐的身体、头部、连续尾巴、常驻轨道与动作特效，并按共享动作阶段驱动全身运动。
  Composes the Cloud Fox body, head, continuous tail, persistent orbit, and effects while driving full-body motion from shared phases.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxBody from './ExtensionCloudFoxBody.vue'
import ExtensionCloudFoxBellyPatch from './ExtensionCloudFoxBellyPatch.vue'
import ExtensionCloudFoxEnergyBall from './ExtensionCloudFoxEnergyBall.vue'
import ExtensionCloudFoxHead from './ExtensionCloudFoxHead.vue'
import ExtensionCloudFoxTail from './ExtensionCloudFoxTail.vue'
import ExtensionCloudFoxMotionEffects from './ExtensionCloudFoxMotionEffects.vue'
import ExtensionCloudFoxOrbit from './ExtensionCloudFoxOrbit.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from '~/domain/cloud-fox-prop-motion'
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
const TAU = Math.PI * 2

const presentation = shallowRef<Group>()
const motion = shallowRef<Group>()
const viewY = computed(() => ({ front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2 }[props.view]))

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
let spinStart = 0
let flipStart = 0

function normalizeFinishedRotation(group: Group, previous: ExtensionCloudFoxMotionId) {
  if (previous === 'spinning') {
    group.rotation.y -= Math.round(group.rotation.y / TAU) * TAU
  }
  if (previous === 'backflip') {
    group.rotation.x -= Math.round(group.rotation.x / TAU) * TAU
  }
}

useLoop().onBeforeRender(({ elapsed, delta }) => {
  const presentationGroup = presentation.value
  const motionGroup = motion.value
  if (!presentationGroup || !motionGroup) return

  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) {
    normalizeFinishedRotation(motionGroup, previousBehavior)
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
    spinStart = motionGroup.rotation.y
    flipStart = motionGroup.rotation.x
  }

  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const ballPose = createBallMotionPose(frame.ballProgress)
  const catchPose = createCatchMotionPose(frame.catchProgress)
  const state = props.behavior
  const resting = state === 'resting'
  const sleeping = state === 'sleeping'
  const cloudNap = state === 'cloud-nap'
  const eating = state === 'eating'
  const stretching = state === 'stretching'
  const juggle = state === 'star-juggle'
  const diving = state === 'diving-catch'

  const catchYaw = diving ? catchPose.facingYaw : 0
  const napYaw = cloudNap ? -.16 * frame.cloudNapPose : 0
  presentationGroup.rotation.y = damp(presentationGroup.rotation.y, viewY.value + catchYaw + napYaw, 7, delta)

  const bobSpeed = sleeping ? 1.1 : state === 'thinking' ? 3.2 : state === 'playing' || state === 'flapping' || frame.highEnergy ? 4.7 : eating || stretching ? 1.35 : 1.9
  const bobAmount = sleeping ? .026 : state === 'happy' || state === 'talking' ? .1 : state === 'playing' || state === 'flapping' || frame.highEnergy ? .11 : state === 'excited' ? .14 : resting || eating || stretching || cloudNap ? .014 : .06
  const baseY = resting
    ? scheme.model.rootPosition[1] - .78 * frame.restingPose
    : cloudNap
      ? scheme.model.rootPosition[1] - .38 * frame.cloudNapPose
      : stretching
        ? scheme.model.rootPosition[1] + frame.stretchStrength * .15
        : eating
          ? scheme.model.rootPosition[1] - .1
          : state === 'energy-burst'
            ? scheme.model.rootPosition[1] - frame.energyCharge * .1
            : scheme.model.rootPosition[1]

  const happyHop = state === 'happy' || state === 'talking' ? Math.max(0, Math.sin(elapsed * 8.5)) * .1 : 0
  const flapHop = state === 'flapping' ? Math.max(0, Math.sin(stateElapsed * 9)) * .1 : 0
  const ballHop = state === 'playing-ball' ? ballPose.height * .055 : 0
  const juggleHop = juggle ? Math.max(0, Math.sin(frame.juggleProgress * Math.PI * 4)) * .055 * frame.jugglePose : 0
  const targetY = baseY
    + Math.sin(elapsed * bobSpeed) * bobAmount
    + happyHop
    + frame.jumpOffset
    + flapHop
    + ballHop
    + frame.backflipLift
    + (diving ? catchPose.bodyTarget.y : 0)
    + juggleHop
    - frame.backflipCrouch * .18
    - frame.backflipLand * .12

  const targetX = state === 'playing'
    ? Math.sin(elapsed * 2.4) * .2
    : state === 'playing-ball'
      ? ballPose.position.x * .125
      : diving
        ? catchPose.bodyTarget.x
        : juggle
          ? Math.sin(frame.juggleProgress * Math.PI * 6) * .09 * frame.jugglePose
          : cloudNap
            ? -.22 * frame.cloudNapPose
            : 0

  const targetZ = diving
    ? catchPose.bodyTarget.z
    : cloudNap
      ? .08 * frame.cloudNapPose
      : 0

  motionGroup.position.y = damp(motionGroup.position.y, targetY, state === 'jumping' || diving ? 10 : 5.4, delta)
  motionGroup.position.x = damp(motionGroup.position.x, targetX, diving ? 8.5 : 5, delta)
  motionGroup.position.z = damp(motionGroup.position.z, targetZ, diving ? 8.5 : 5, delta)

  if (state === 'spinning') {
    const eased = 1 - Math.pow(1 - frame.spinProgress, 3)
    motionGroup.rotation.y = spinStart + eased * TAU
  }
  else {
    motionGroup.rotation.y = damp(motionGroup.rotation.y, 0, 7, delta)
  }

  if (state === 'backflip') {
    motionGroup.rotation.x = flipStart - frame.backflipRotation * TAU
  }
  else {
    const targetXRotation = resting
      ? .66 * frame.restingPose
      : cloudNap
        ? .18 * frame.cloudNapPose
        : stretching
          ? -.16 - frame.stretchStrength * .1
          : eating
            ? .14
            : state === 'sparkle-sneeze'
              ? frame.sneezeRelease * .22 - frame.sneezeCharge * .1
              : diving
                ? -.28 * frame.catchAir + .18 * frame.catchLand
                : 0
    motionGroup.rotation.x = damp(motionGroup.rotation.x, targetXRotation, 7, delta)
  }

  const targetZRotation = cloudNap
    ? -1.16 * frame.cloudNapPose
    : state === 'tail-tornado'
      ? Math.sin(stateElapsed * 9) * .035 * frame.tornadoStrength
      : state === 'confused'
        ? Math.sin(elapsed * 2.2) * .09
        : state === 'listening'
          ? -.08
          : state === 'playing'
            ? Math.sin(elapsed * 4.8) * .06
            : state === 'shy-peek'
              ? -.08 * frame.shyPose
              : juggle
                ? Math.sin(frame.juggleProgress * Math.PI * 6) * .08 * frame.jugglePose
                : diving
                  ? -.18 * frame.catchAir
                  : 0
  motionGroup.rotation.z = damp(motionGroup.rotation.z, targetZRotation, 7, delta)

  const squash = frame.jumpLanding * .08 + frame.energyCharge * .035 + frame.backflipCrouch * .09 + frame.backflipLand * .07
  const stretchScale = frame.stretchStrength * .05
  const restFlatten = frame.restingPose * .08
  motionGroup.scale.x = damp(motionGroup.scale.x, 1 + squash + restFlatten - stretchScale * .2, 7, delta)
  motionGroup.scale.y = damp(motionGroup.scale.y, 1 - squash - restFlatten * .45 + stretchScale, 7, delta)
  motionGroup.scale.z = damp(motionGroup.scale.z, 1 + squash * .35 + restFlatten * .5, 7, delta)
})
</script>

<template>
  <TresGroup ref="presentation">
    <ExtensionCloudFoxMotionEffects :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
    <TresGroup ref="motion" :position="vector(scheme.model.rootPosition)">
      <ExtensionCloudFoxOrbit :appearance="appearance" :behavior="behavior" />
      <ExtensionCloudFoxEnergyBall :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxTail :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxBody :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
      <ExtensionCloudFoxBellyPatch :appearance="appearance" />
      <ExtensionCloudFoxHead :appearance="appearance" :behavior="behavior" :motion-key="motionKey" />
    </TresGroup>
  </TresGroup>
</template>
