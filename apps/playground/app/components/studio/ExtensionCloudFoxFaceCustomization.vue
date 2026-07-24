<!--
  文件职责 / File responsibility
  在统一头部动作坐标中覆盖旧鼻嘴并渲染具有明显轮廓差异、独立颜色和动作开合的鼻子与嘴巴。
  Covers the legacy nose and mouth in the unified animated head space and renders visibly distinct, independently colored, motion-aware face parts.
-->
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import { Euler, Vector3 } from 'three'
import type { Group } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, mix, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()

const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const customization = computed(() => resolvePetCustomization(props.appearance))
const colors = computed(() => customization.value.colors)
const head = shallowRef<Group>()
const mouth = shallowRef<Group>()
let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0

const nosePosition = computed(() => vector([
  scheme.model.head.nosePosition[0],
  scheme.model.head.nosePosition[1],
  scheme.model.head.nosePosition[2] + .09,
]))
const mouthPosition = computed(() => vector([
  scheme.model.head.mouthPosition[0],
  scheme.model.head.mouthPosition[1],
  scheme.model.head.mouthPosition[2] + .075,
]))
const noseScale = computed(() => {
  if (props.appearance.parts.nose === 'sensor') return vector([.19, .1, .1])
  if (props.appearance.parts.nose === 'button') return vector([.15, .12, .085])
  if (props.appearance.parts.nose === 'heart') return vector([.14, .14, .095])
  if (props.appearance.parts.nose === 'triangle') return vector([.16, .15, .11])
  return vector([.16, .115, .1])
})

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (props.behavior !== previousBehavior || props.motionKey !== previousMotionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const state = props.behavior
  const group = head.value

  if (group) {
    let targetX = 0
    let targetY = 0
    let targetZ = 0
    let targetPositionX = 0
    let targetPositionY = scheme.model.head.position[1] + frame.stretchBreath

    if (state === 'greeting') targetZ = Math.sin(stateElapsed * 5.8) * .13 * frame.greetingPose
    else if (state === 'resting') {
      targetX = .24 * frame.restingPose
      targetPositionY -= .12 * frame.restingPose
    }
    else if (state === 'sleeping') targetX = .14
    else if (state === 'cloud-nap') {
      targetX = .18 * frame.cloudNapPose
      targetZ = .34 * frame.cloudNapPose
      targetPositionX = -.1 * frame.cloudNapPose
      targetPositionY -= .08 * frame.cloudNapPose
    }
    else if (state === 'thinking') targetZ = -.14 + Math.sin(elapsed * 1.8) * .035
    else if (state === 'confused') targetZ = Math.sin(elapsed * 2.2) * .18
    else if (state === 'listening') targetZ = -.16
    else if (state === 'stretching') {
      targetX = -.5 * frame.stretchStrength
      targetPositionY += .08 * frame.stretchStrength
    }
    else if (state === 'shy-peek') targetZ = -.16 * frame.shyPose
    else if (state === 'sparkle-sneeze') targetX = -.12 * frame.sneezeCharge + .34 * frame.sneezeRelease
    else if (state === 'curious-scan') {
      targetY = Math.sin(frame.curiousProgress * Math.PI * 3) * .24 * frame.curiousPose
      targetZ = Math.cos(frame.curiousProgress * Math.PI * 2) * .12 * frame.curiousPose
    }
    else if (state === 'playing' || state === 'flapping') targetZ = Math.sin(elapsed * 4.6) * .08
    else if (state === 'eating') targetX = .3 * smoothStep(.04, .22, frame.eatProgress)
    else if (state === 'star-juggle') {
      targetY = Math.sin(frame.juggleProgress * Math.PI * 6) * .18 * frame.jugglePose
      targetX = -.12 * frame.jugglePose
    }
    else if (state === 'backflip') targetX = -.16 * frame.backflipTuck
    else if (state === 'energy-burst') targetX = -.16 * frame.energyCharge + .12 * frame.energyRelease
    else if (state === 'waking') targetX = mix(.14, 0, smoothStep(.08, .72, frame.progress))

    group.rotation.x = damp(group.rotation.x, targetX, 7, delta)
    group.rotation.y = damp(group.rotation.y, targetY, 7, delta)
    group.rotation.z = damp(group.rotation.z, targetZ, 7, delta)
    group.position.x = damp(group.position.x, targetPositionX, 7, delta)
    group.position.y = damp(group.position.y, targetPositionY + (state === 'happy' ? Math.max(0, Math.sin(elapsed * 8)) * .035 : 0), 7, delta)
  }

  if (mouth.value) {
    const talking = state === 'talking' ? .78 + Math.max(0, Math.sin(elapsed * 10)) * .82 : 1
    const eating = state === 'eating' ? .82 + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 14)) * .92 : 1
    const excited = state === 'happy' || state === 'excited' ? 1.14 : 1
    const sneeze = state === 'sparkle-sneeze' ? 1 + frame.sneezeRelease * .84 : 1
    mouth.value.scale.y = damp(mouth.value.scale.y, talking * eating * sneeze, 12, delta)
    mouth.value.scale.x = damp(mouth.value.scale.x, excited, 10, delta)
  }
})
</script>

<template>
  <TresGroup ref="head" :position="vector(scheme.model.head.position)">
    <TresMesh :position="vector([scheme.model.head.nosePosition[0], scheme.model.head.nosePosition[1], scheme.model.head.nosePosition[2] + .035])" :scale="vector([.24, .17, .07])" :render-order="5">
      <TresSphereGeometry :args="[1, 28, 24]" />
      <TresMeshStandardMaterial :color="colors.muzzle" :roughness=".36" />
    </TresMesh>
    <TresMesh :position="vector([scheme.model.head.mouthPosition[0], scheme.model.head.mouthPosition[1], scheme.model.head.mouthPosition[2] + .025])" :scale="vector([.4, .25, .065])" :render-order="5">
      <TresSphereGeometry :args="[1, 32, 24]" />
      <TresMeshStandardMaterial :color="colors.muzzle" :roughness=".36" />
    </TresMesh>

    <TresGroup :position="nosePosition" :scale="noseScale" :render-order="6">
      <TresMesh v-if="appearance.parts.nose === 'triangle'" :rotation="rotation([Math.PI / 2, 0, 0])">
        <TresConeGeometry :args="[1, 1.35, 3, 1]" />
        <TresMeshStandardMaterial :color="colors.nose" :roughness=".18" />
      </TresMesh>
      <template v-else-if="appearance.parts.nose === 'sensor'">
        <TresMesh>
          <TresBoxGeometry :args="[1.7, .85, .78, 3, 3, 3]" />
          <TresMeshStandardMaterial :color="colors.nose" :emissive="colors.antennaTip" :emissive-intensity=".35" :metalness=".68" :roughness=".18" />
        </TresMesh>
        <TresMesh :position="vector([0, 0, .48])" :rotation="rotation([Math.PI / 2, 0, 0])">
          <TresTorusGeometry :args="[.42, .08, 10, 28]" />
          <TresMeshBasicMaterial :color="colors.antennaTip" />
        </TresMesh>
      </template>
      <template v-else-if="appearance.parts.nose === 'button'">
        <TresMesh :rotation="rotation([Math.PI / 2, 0, 0])">
          <TresCylinderGeometry :args="[.72, .72, .42, 28]" />
          <TresMeshStandardMaterial :color="colors.nose" :roughness=".28" />
        </TresMesh>
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .25, 0, .25])" :scale="vector([.1, .1, .08])">
          <TresSphereGeometry />
          <TresMeshBasicMaterial :color="colors.muzzle" />
        </TresMesh>
      </template>
      <template v-else-if="appearance.parts.nose === 'heart'">
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .34, .18, 0])" :scale="vector([.58, .58, .7])">
          <TresSphereGeometry />
          <TresMeshStandardMaterial :color="colors.nose" :roughness=".2" />
        </TresMesh>
        <TresMesh :position="vector([0, -.32, 0])" :rotation="rotation([0, 0, Math.PI])" :scale="vector([.72, .72, .76])">
          <TresConeGeometry :args="[.72, 1.1, 3]" />
          <TresMeshStandardMaterial :color="colors.nose" :roughness=".2" />
        </TresMesh>
      </template>
      <TresMesh v-else>
        <TresSphereGeometry :args="[1, 32, 24]" />
        <TresMeshStandardMaterial :color="colors.nose" :roughness=".22" />
      </TresMesh>
    </TresGroup>

    <TresMesh
      v-for="side in [-1, 1]"
      :key="`custom-cheek-${side}`"
      :position="vector([side * scheme.model.head.cheekOffset[0], scheme.model.head.cheekOffset[1], scheme.model.head.cheekOffset[2] + .04])"
      :scale="vector(scheme.model.head.cheekScale)"
      :render-order="6"
    >
      <TresSphereGeometry />
      <TresMeshBasicMaterial :color="colors.cheeks" transparent :opacity=".18" :depth-write="false" />
    </TresMesh>

    <TresGroup ref="mouth" :position="mouthPosition" :render-order="6">
      <template v-if="appearance.parts.mouth === 'smile'">
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .09, 0, 0])" :rotation="rotation([0, 0, side * .16])" :scale="vector([.72, .48, .45])">
          <TresTorusGeometry :args="[.16, .025, 10, 30, Math.PI]" />
          <TresMeshBasicMaterial :color="colors.mouth" />
        </TresMesh>
      </template>
      <template v-else-if="appearance.parts.mouth === 'cat'">
        <TresMesh v-for="side in [-1, 1]" :key="side" :position="vector([side * .1, -.005, 0])" :rotation="rotation([0, 0, side * .28])" :scale="vector([.72, .7, .45])">
          <TresTorusGeometry :args="[.15, .026, 10, 30, Math.PI]" />
          <TresMeshBasicMaterial :color="colors.mouth" />
        </TresMesh>
      </template>
      <TresMesh v-else-if="appearance.parts.mouth === 'line'" :scale="vector([.32, .025, .025])">
        <TresBoxGeometry />
        <TresMeshBasicMaterial :color="colors.mouth" />
      </TresMesh>
      <template v-else-if="appearance.parts.mouth === 'open'">
        <TresMesh :scale="vector([.24, .31, .08])">
          <TresSphereGeometry :args="[1, 28, 24]" />
          <TresMeshStandardMaterial :color="colors.mouth" :roughness=".25" />
        </TresMesh>
        <TresMesh :position="vector([0, -.1, .075])" :scale="vector([.15, .1, .035])">
          <TresSphereGeometry :args="[1, 24, 20]" />
          <TresMeshBasicMaterial :color="colors.tongue" />
        </TresMesh>
      </template>
      <TresMesh v-else :scale="vector([.13, .13, .05])">
        <TresTorusGeometry :args="[.62, .18, 10, 28]" />
        <TresMeshBasicMaterial :color="colors.mouth" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
