<!--
  文件职责 / File responsibility
  Playground 使用的云狐演示模型与动作。
  Cloud-fox demo model and motions used by the Playground.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { CatmullRomCurve3, Euler, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import type { PetEmotion } from '~/types/pet'

function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

function euler(x: number, y: number, z: number) {
  return new Euler(x, y, z)
}

const tailBaseCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.28, 0.04, 0),
  vec3(-0.52, 0.2, 0),
  vec3(-0.68, 0.44, 0),
])
const tailMidCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.08, 0.22, 0),
  vec3(-0.02, 0.45, 0),
  vec3(0.18, 0.64, 0),
])
const tailTipCurve = new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(0.18, 0.14, 0),
  vec3(0.4, 0.15, 0),
  vec3(0.58, 0.05, 0),
])

const props = defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  theme: 'dark' | 'light'
}>()

const petGroup = shallowRef<Group>()
const headGroup = shallowRef<Group>()
const eyeGroup = shallowRef<Group>()
const leftEye = shallowRef<Group>()
const rightEye = shallowRef<Group>()
const mouthGroup = shallowRef<Group>()
const cheeksGroup = shallowRef<Group>()
const leftEar = shallowRef<Group>()
const rightEar = shallowRef<Group>()
const tailGroup = shallowRef<Group>()
const tailMidGroup = shallowRef<Group>()
const tailTipGroup = shallowRef<Group>()
const tailEnergy = shallowRef<Mesh>()
const haloGroup = shallowRef<Group>()
const coreMesh = shallowRef<Mesh>()
const leftPaw = shallowRef<Group>()
const rightPaw = shallowRef<Group>()

const coat = computed(() => props.theme === 'dark' ? '#e9ecff' : '#ffffff')
const coatShadow = computed(() => props.theme === 'dark' ? '#aeb6e8' : '#c5cced')
const coatWarm = computed(() => props.theme === 'dark' ? '#f9fbff' : '#ffffff')
const accent = computed(() => props.secretMode ? '#ff69d4' : '#7066ff')
const secondary = computed(() => props.secretMode ? '#6cf4ff' : '#52e0d0')
const eyeColor = computed(() => props.behavior === 'sleeping' ? '#69708f' : '#141629')

const { onBeforeRender } = useLoop()
let previousBehavior = props.behavior
let behaviorStartedAt = 0

onBeforeRender(({ elapsed, delta }) => {
  const pet = petGroup.value
  const head = headGroup.value
  if (!pet || !head) return

  const state = props.behavior
  if (state !== previousBehavior) {
    previousBehavior = state
    behaviorStartedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - behaviorStartedAt)

  const isSleeping = state === 'sleeping'
  const isThinking = state === 'thinking'
  const isHappy = state === 'happy' || state === 'talking'
  const isExcited = state === 'excited' || props.secretMode
  const isConfused = state === 'confused'
  const isWaking = state === 'waking'
  const isGreeting = state === 'greeting'
  const isPlaying = state === 'playing'
  const isSpinning = state === 'spinning'
  const isListening = state === 'listening'
  const isJumping = state === 'jumping'
  const isFlapping = state === 'flapping'
  const isResting = state === 'resting'
  const isTalking = props.speaking || state === 'talking'

  const pointerNearCenter = Math.abs(props.pointer.x) < 0.12 && Math.abs(props.pointer.y) < 0.12
  const scanY = pointerNearCenter && !isSleeping && !isSpinning && !isResting
    ? Math.sin(elapsed * 0.85) * 0.12
    : 0

  const jumpProgress = Math.min(1, stateElapsed / 1.25)
  const jumpOffset = isJumping ? Math.sin(jumpProgress * Math.PI) * 0.9 : 0
  const jumpLanding = isJumping ? Math.pow(Math.sin(jumpProgress * Math.PI), 2) : 0

  const bobSpeed = isSleeping
    ? 1.1
    : isThinking
      ? 3.2
      : isPlaying || isFlapping
        ? 4.7
        : isExcited
          ? 3.2
          : 1.9
  const bobAmount = isSleeping
    ? 0.03
    : isHappy
      ? 0.11
      : isPlaying || isFlapping
        ? 0.13
        : isExcited
          ? 0.15
          : isResting
            ? 0.015
            : 0.07
  const baseY = isResting ? -0.28 : 0.18
  const hopBoost = isHappy ? Math.max(0, Math.sin(elapsed * 8.5)) * 0.11 : 0
  const flapHop = isFlapping ? Math.max(0, Math.sin(stateElapsed * 9)) * 0.12 : 0
  const targetY = baseY + Math.sin(elapsed * bobSpeed) * bobAmount + hopBoost + jumpOffset + flapHop
  const targetX = isPlaying ? Math.sin(elapsed * 2.4) * 0.2 : 0
  pet.position.y += (targetY - pet.position.y) * Math.min(1, delta * (isJumping ? 10 : 5.2))
  pet.position.x += (targetX - pet.position.x) * Math.min(1, delta * 4.8)

  if (isSpinning) {
    pet.rotation.y += delta * 5.6
  }
  else {
    const swayTargetY = isExcited
      ? Math.sin(elapsed * 2.2) * 0.42
      : props.pointer.x * 0.18 + (isPlaying ? Math.sin(elapsed * 2.4) * 0.08 : 0)
    pet.rotation.y += (swayTargetY - pet.rotation.y) * Math.min(1, delta * 3.8)
  }

  const targetPetRotX = isListening
    ? -0.14
    : isSleeping
      ? 0.16
      : isResting
        ? 0.22
        : isWaking
          ? -0.08
          : isJumping
            ? -Math.sin(jumpProgress * Math.PI) * 0.12
            : 0
  pet.rotation.x += (targetPetRotX - pet.rotation.x) * Math.min(1, delta * 4.5)

  if (isWaking) {
    pet.rotation.z = Math.sin(elapsed * 7) * 0.035
  }
  else if (isPlaying || isFlapping) {
    pet.rotation.z = Math.sin(elapsed * (isFlapping ? 8 : 5)) * (isFlapping ? 0.055 : 0.03)
  }
  else {
    pet.rotation.z *= 0.9
  }

  const jumpSquashX = isJumping ? 1 + Math.sin(jumpProgress * Math.PI) * 0.07 : 1
  const jumpSquashY = isJumping ? 1 - jumpLanding * 0.08 : 1
  const targetScaleX = (isSpinning ? 0.94 : isHappy ? 1.02 : isResting ? 1.1 : 1) * jumpSquashX
  const targetScaleY = (isSpinning
    ? 1.06
    : isHappy
      ? 0.98 + Math.sin(elapsed * 8.5) * 0.02
      : isResting
        ? 0.78
        : 1 + Math.sin(elapsed * 1.9) * 0.01) * jumpSquashY
  const targetScaleZ = isListening ? 0.98 : isResting ? 1.08 : 1
  pet.scale.x += (targetScaleX - pet.scale.x) * Math.min(1, delta * 6)
  pet.scale.y += (targetScaleY - pet.scale.y) * Math.min(1, delta * 6)
  pet.scale.z += (targetScaleZ - pet.scale.z) * Math.min(1, delta * 6)

  const headTargetYRotation = isSleeping || isResting
    ? 0
    : props.pointer.x * 0.34 + scanY + (isGreeting ? Math.sin(elapsed * 3) * 0.08 : 0)
  const headTargetXRotation = isSleeping
    ? 0.35
    : isResting
      ? 0.28
      : isListening
        ? -0.22 - props.pointer.y * 0.1
        : -props.pointer.y * 0.18 + (isHappy ? Math.sin(elapsed * 8.5) * 0.03 : 0)
  const headTargetZRotation = isConfused
    ? 0.28 + Math.sin(elapsed * 5.5) * 0.05
    : isGreeting
      ? Math.sin(elapsed * 6) * 0.12
      : isPlaying || isFlapping
        ? Math.sin(elapsed * 4.5) * 0.06
        : 0
  head.rotation.y += (headTargetYRotation - head.rotation.y) * Math.min(1, delta * 5.5)
  head.rotation.x += (headTargetXRotation - head.rotation.x) * Math.min(1, delta * 5.5)
  head.rotation.z += (headTargetZRotation - head.rotation.z) * Math.min(1, delta * 5.5)

  const headTargetPositionY = isResting ? 0.62 : isListening ? 0.82 : 0.92
  const headTargetPositionZ = isResting ? 0.3 : isListening ? 0.12 : 0.06
  head.position.y += (headTargetPositionY - head.position.y) * Math.min(1, delta * 5)
  head.position.z += (headTargetPositionZ - head.position.z) * Math.min(1, delta * 5)

  if (eyeGroup.value) {
    const blinkPulse = Math.pow(Math.max(0, Math.sin(elapsed * 0.68)), 28)
    const blinkSpeedUp = isPlaying || isExcited || isFlapping
      ? Math.pow(Math.max(0, Math.sin(elapsed * 1.4)), 36)
      : 0
    const happySquint = isHappy || isGreeting || isJumping || isFlapping ? 0.72 : 1
    const targetEyeY = isSleeping || isResting
      ? 0.1
      : happySquint - Math.max(blinkPulse, blinkSpeedUp) * 0.9
    const targetEyeX = isListening ? 1.06 : isThinking ? 0.96 : isExcited ? 1.08 : 1
    eyeGroup.value.scale.y += (Math.max(0.08, targetEyeY) - eyeGroup.value.scale.y) * Math.min(1, delta * 18)
    eyeGroup.value.scale.x += (targetEyeX - eyeGroup.value.scale.x) * Math.min(1, delta * 10)
    const eyeShiftY = isListening ? 0.03 : isConfused ? 0.015 : 0
    eyeGroup.value.position.y += (eyeShiftY - eyeGroup.value.position.y) * Math.min(1, delta * 6)
  }

  if (leftEye.value && rightEye.value) {
    const leftY = isConfused ? 1.12 : 1
    const rightY = isConfused ? 0.82 : 1
    leftEye.value.scale.y += (leftY - leftEye.value.scale.y) * Math.min(1, delta * 8)
    rightEye.value.scale.y += (rightY - rightEye.value.scale.y) * Math.min(1, delta * 8)
    leftEye.value.rotation.z += ((isConfused ? -0.06 : 0) - leftEye.value.rotation.z) * Math.min(1, delta * 8)
    rightEye.value.rotation.z += ((isConfused ? 0.08 : 0) - rightEye.value.rotation.z) * Math.min(1, delta * 8)
  }

  if (mouthGroup.value) {
    const talkOpen = isTalking ? 0.55 + Math.abs(Math.sin(elapsed * 10.8)) * 1.25 : 0.5
    const targetMouthY = isSleeping || isResting
      ? 0.16
      : isConfused
        ? 0.34
        : isHappy || isGreeting || isJumping || isFlapping
          ? 0.72
          : talkOpen
    const targetMouthX = isHappy || isGreeting || isJumping || isFlapping
      ? 1.3
      : isConfused
        ? 0.82
        : isSleeping || isResting
          ? 0.72
          : 1
    mouthGroup.value.scale.y += (targetMouthY - mouthGroup.value.scale.y) * Math.min(1, delta * 15)
    mouthGroup.value.scale.x += (targetMouthX - mouthGroup.value.scale.x) * Math.min(1, delta * 10)
    mouthGroup.value.rotation.z += ((isConfused ? -0.12 : 0) - mouthGroup.value.rotation.z) * Math.min(1, delta * 8)
  }

  if (cheeksGroup.value) {
    const showCheeks = isHappy || isGreeting || isPlaying || isJumping || isFlapping || isExcited
    const cheekScale = showCheeks ? 1 + Math.sin(elapsed * 4.2) * 0.05 : 0.001
    cheeksGroup.value.scale.x += (cheekScale - cheeksGroup.value.scale.x) * Math.min(1, delta * 7)
    cheeksGroup.value.scale.y += (cheekScale - cheeksGroup.value.scale.y) * Math.min(1, delta * 7)
    cheeksGroup.value.scale.z += (cheekScale - cheeksGroup.value.scale.z) * Math.min(1, delta * 7)
  }

  const earBase = isListening ? 0.1 : isResting ? -0.05 : 0
  const earEnergy = isThinking
    ? 0.18
    : isHappy
      ? -0.11
      : isConfused
        ? 0.22
        : isGreeting
          ? 0.04
          : isFlapping
            ? Math.sin(elapsed * 10) * 0.09
            : 0
  if (leftEar.value && rightEar.value) {
    leftEar.value.rotation.z = -0.16 + earBase + earEnergy + Math.sin(elapsed * (isPlaying ? 6 : 2.6)) * 0.028
    rightEar.value.rotation.z = 0.16 - earBase - earEnergy - Math.sin(elapsed * (isPlaying ? 6 : 2.6)) * 0.028
  }

  if (tailGroup.value) {
    const wagSpeed = isHappy
      ? 6.8
      : isPlaying || isFlapping
        ? 8.4
        : isExcited || isJumping
          ? 7.6
          : isResting
            ? 1.25
            : 2.35
    const wagAmount = isHappy
      ? 0.18
      : isPlaying || isFlapping
        ? 0.26
        : isExcited || isJumping
          ? 0.22
          : isResting
            ? 0.025
            : 0.075
    const rootWave = Math.sin(elapsed * wagSpeed)
    const midWave = Math.sin(elapsed * wagSpeed - 0.62)
    const tipWave = Math.sin(elapsed * wagSpeed - 1.18)
    const restFold = isResting || isSleeping ? -0.08 : 0

    const rootTargetZ = -0.18 + rootWave * wagAmount + restFold
    const rootTargetX = 0.12 + Math.cos(elapsed * wagSpeed * 0.45) * 0.035
    tailGroup.value.rotation.z += (rootTargetZ - tailGroup.value.rotation.z) * Math.min(1, delta * 6.5)
    tailGroup.value.rotation.x += (rootTargetX - tailGroup.value.rotation.x) * Math.min(1, delta * 5)

    if (tailMidGroup.value) {
      const midTargetZ = 0.06 + midWave * wagAmount * 0.72 + restFold * 0.55
      tailMidGroup.value.rotation.z += (midTargetZ - tailMidGroup.value.rotation.z) * Math.min(1, delta * 7.2)
    }

    if (tailTipGroup.value) {
      const tipTargetZ = -0.08 + tipWave * wagAmount * 1.08 + restFold * 0.35
      const tipTargetY = Math.cos(elapsed * wagSpeed - 0.8) * wagAmount * 0.22
      tailTipGroup.value.rotation.z += (tipTargetZ - tailTipGroup.value.rotation.z) * Math.min(1, delta * 8)
      tailTipGroup.value.rotation.y += (tipTargetY - tailTipGroup.value.rotation.y) * Math.min(1, delta * 6.5)
    }

    if (tailEnergy.value) {
      const tailPulse = 1 + Math.sin(elapsed * (isExcited ? 8 : isThinking ? 5 : 2.8)) * (isExcited ? 0.14 : 0.06)
      tailEnergy.value.scale.setScalar(tailPulse)
    }
  }

  if (haloGroup.value) {
    haloGroup.value.rotation.y += delta * (isThinking ? 1.8 : isExcited ? 3.3 : isSpinning ? 2.5 : 0.45)
    haloGroup.value.rotation.z += delta * (isExcited ? 1.1 : isPlaying || isFlapping ? 0.6 : 0.12)
    haloGroup.value.position.y = 0.08 + Math.sin(elapsed * 1.8) * 0.03
    const haloScale = props.secretMode
      ? 1.28 + Math.sin(elapsed * 3) * 0.05
      : isListening
        ? 1.04
        : isJumping
          ? 1 + jumpOffset * 0.12
          : isResting
            ? 0.9
            : 1
    haloGroup.value.scale.setScalar(haloScale)
  }

  if (coreMesh.value) {
    const pulse = 1 + Math.sin(elapsed * (isThinking ? 5 : isExcited || isFlapping ? 8 : 2.8)) * (isExcited || isFlapping ? 0.15 : 0.08)
    coreMesh.value.scale.setScalar(pulse)
  }

  if (leftPaw.value && rightPaw.value) {
    const basePawY = -0.82
    const basePawZ = 0.56
    const tap = Math.sin(elapsed * 5.5) * 0.05

    const leftTargetY = isResting
      ? -0.9
      : isFlapping
        ? basePawY + 0.48 + Math.sin(stateElapsed * 12) * 0.14
        : isPlaying
          ? basePawY + Math.sin(elapsed * 8) * 0.16
          : isJumping
            ? basePawY + jumpOffset * 0.18
            : isHappy
              ? basePawY + Math.max(0, Math.sin(elapsed * 8.5)) * 0.06
              : basePawY
    const rightTargetY = isResting
      ? -0.9
      : isGreeting
        ? -0.4 + Math.max(0, Math.sin(elapsed * 10)) * 0.08
        : isFlapping
          ? basePawY + 0.48 + Math.cos(stateElapsed * 12) * 0.14
          : isPlaying
            ? basePawY + Math.cos(elapsed * 8) * 0.16
            : isListening
              ? basePawY + 0.04
              : isJumping
                ? basePawY + jumpOffset * 0.18
                : isHappy
                  ? basePawY + Math.max(0, Math.sin(elapsed * 8.5 + 1.2)) * 0.06
                  : basePawY

    const leftTargetRotZ = isFlapping
      ? -0.9 + Math.sin(stateElapsed * 12) * 0.3
      : isListening
        ? -0.16
        : isPlaying
          ? Math.sin(elapsed * 8) * 0.12
          : tap
    const rightTargetRotZ = isGreeting
      ? 0.82 + Math.sin(elapsed * 10) * 0.2
      : isFlapping
        ? 0.9 + Math.cos(stateElapsed * 12) * 0.3
        : isListening
          ? 0.18
          : isPlaying
            ? Math.cos(elapsed * 8) * 0.12
            : -tap

    const targetPawZ = isResting ? 0.88 : isListening ? 0.64 : basePawZ
    const targetPawRotX = isResting ? -0.85 : isJumping ? -0.16 : 0

    leftPaw.value.position.y += (leftTargetY - leftPaw.value.position.y) * Math.min(1, delta * 8)
    rightPaw.value.position.y += (rightTargetY - rightPaw.value.position.y) * Math.min(1, delta * 8)
    leftPaw.value.position.z += (targetPawZ - leftPaw.value.position.z) * Math.min(1, delta * 7)
    rightPaw.value.position.z += (targetPawZ - rightPaw.value.position.z) * Math.min(1, delta * 7)
    leftPaw.value.rotation.z += (leftTargetRotZ - leftPaw.value.rotation.z) * Math.min(1, delta * 9)
    rightPaw.value.rotation.z += (rightTargetRotZ - rightPaw.value.rotation.z) * Math.min(1, delta * 9)
    leftPaw.value.rotation.x += (targetPawRotX - leftPaw.value.rotation.x) * Math.min(1, delta * 7)
    rightPaw.value.rotation.x += (targetPawRotX - rightPaw.value.rotation.x) * Math.min(1, delta * 7)
  }
})
</script>

<template>
  <TresGroup ref="petGroup" :position="vec3(0, 0.18, 0)">
    <!-- 浮空底座 / Floating platform -->
    <TresMesh :position="vec3(0, -1.9, 0)" receive-shadow>
      <TresCylinderGeometry :args="[1.46, 1.65, 0.18, 64]" />
      <TresMeshStandardMaterial
        :color="theme === 'dark' ? '#15192a' : '#dfe4ff'"
        :metalness="0.62"
        :roughness="0.24"
      />
    </TresMesh>

    <TresMesh :position="vec3(0, -1.77, 0)" :rotation="euler(-Math.PI / 2, 0, 0)">
      <TresRingGeometry :args="[0.72, 1.18, 64]" />
      <TresMeshBasicMaterial :color="accent" transparent :opacity="0.72" />
    </TresMesh>

    <!-- 分段柔性云尾 / Segmented flexible cloud tail -->
    <TresGroup ref="tailGroup" :position="vec3(-0.72, -0.5, -0.42)" :rotation="euler(0.12, 0.42, -0.18)">
      <TresMesh cast-shadow>
        <TresTubeGeometry :args="[tailBaseCurve, 24, 0.27, 14, false]" />
        <TresMeshStandardMaterial :color="coatShadow" :roughness="0.32" :metalness="0.02" />
      </TresMesh>

      <TresGroup ref="tailMidGroup" :position="vec3(-0.68, 0.44, 0)" :rotation="euler(0, 0, 0.06)">
        <TresMesh cast-shadow>
          <TresTubeGeometry :args="[tailMidCurve, 22, 0.22, 14, false]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.27" :metalness="0.02" />
        </TresMesh>

        <TresGroup ref="tailTipGroup" :position="vec3(0.18, 0.64, 0)" :rotation="euler(0, 0, -0.08)">
          <TresMesh cast-shadow>
            <TresTubeGeometry :args="[tailTipCurve, 20, 0.16, 14, false]" />
            <TresMeshStandardMaterial
              :color="secondary"
              :emissive="secondary"
              :emissive-intensity="secretMode ? 1.8 : 0.55"
              :roughness="0.2"
              :metalness="0.04"
              transparent
              :opacity="0.92"
            />
          </TresMesh>
          <TresMesh ref="tailEnergy" :position="vec3(0.58, 0.05, 0)" :scale="vec3(1, 1, 1)">
            <TresSphereGeometry :args="[0.19, 28, 28]" />
            <TresMeshStandardMaterial
              :color="secondary"
              :emissive="secondary"
              :emissive-intensity="secretMode ? 3.5 : 1.15"
              transparent
              :opacity="0.72"
              :roughness="0.12"
            />
          </TresMesh>
          <TresMesh :position="vec3(0.58, 0.05, -0.01)" :scale="vec3(1.32, 1.32, 1.32)">
            <TresSphereGeometry :args="[0.19, 24, 24]" />
            <TresMeshBasicMaterial :color="accent" transparent :opacity="secretMode ? 0.18 : 0.08" />
          </TresMesh>
        </TresGroup>
      </TresGroup>
    </TresGroup>

    <!-- 身体 / Body -->
    <TresMesh :position="vec3(0, -0.32, 0)" :scale="vec3(0.94, 1.12, 0.82)" cast-shadow>
      <TresSphereGeometry :args="[1, 64, 64]" />
      <TresMeshStandardMaterial :color="coatShadow" :roughness="0.34" :metalness="0.04" />
    </TresMesh>

    <TresMesh :position="vec3(0, -0.26, 0.73)" :scale="vec3(0.48, 0.56, 0.2)">
      <TresSphereGeometry :args="[1, 48, 48]" />
      <TresMeshStandardMaterial :color="coatWarm" :roughness="0.4" />
    </TresMesh>

    <!-- 前爪 / Front paws -->
    <TresGroup ref="leftPaw" :position="vec3(-0.36, -0.82, 0.56)">
      <TresMesh :rotation="euler(0, 0, -0.08)">
        <TresCylinderGeometry :args="[0.09, 0.11, 0.42, 20]" />
        <TresMeshStandardMaterial :color="coat" :roughness="0.26" />
      </TresMesh>
      <TresMesh :position="vec3(0, -0.26, 0.02)" :scale="vec3(1.05, 0.85, 1.2)">
        <TresSphereGeometry :args="[0.12, 24, 24]" />
        <TresMeshStandardMaterial :color="coatWarm" :roughness="0.26" />
      </TresMesh>
    </TresGroup>

    <TresGroup ref="rightPaw" :position="vec3(0.36, -0.82, 0.56)">
      <TresMesh :rotation="euler(0, 0, 0.08)">
        <TresCylinderGeometry :args="[0.09, 0.11, 0.42, 20]" />
        <TresMeshStandardMaterial :color="coat" :roughness="0.26" />
      </TresMesh>
      <TresMesh :position="vec3(0, -0.26, 0.02)" :scale="vec3(1.05, 0.85, 1.2)">
        <TresSphereGeometry :args="[0.12, 24, 24]" />
        <TresMeshStandardMaterial :color="coatWarm" :roughness="0.26" />
      </TresMesh>
    </TresGroup>

    <!-- 胸口能量核心 / Chest energy core -->
    <TresMesh ref="coreMesh" :position="vec3(0, -0.26, 0.74)">
      <TresSphereGeometry :args="[0.19, 32, 32]" />
      <TresMeshStandardMaterial
        :color="secondary"
        :emissive="secondary"
        :emissive-intensity="secretMode ? 4 : 1.8"
        :metalness="0.25"
        :roughness="0.12"
      />
    </TresMesh>

    <!-- 头部 / Head -->
    <TresGroup ref="headGroup" :position="vec3(0, 0.92, 0.06)">
      <TresGroup ref="leftEar" :position="vec3(-0.56, 0.65, -0.04)" :rotation="euler(0, 0, -0.16)">
        <TresMesh cast-shadow>
          <TresConeGeometry :args="[0.35, 0.9, 4]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
          <TresConeGeometry :args="[0.35, 0.78, 4]" />
          <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.25" />
        </TresMesh>
      </TresGroup>

      <TresGroup ref="rightEar" :position="vec3(0.56, 0.65, -0.04)" :rotation="euler(0, 0, 0.16)">
        <TresMesh cast-shadow>
          <TresConeGeometry :args="[0.35, 0.9, 4]" />
          <TresMeshStandardMaterial :color="coat" :roughness="0.3" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
          <TresConeGeometry :args="[0.35, 0.78, 4]" />
          <TresMeshStandardMaterial :color="accent" :emissive="accent" :emissive-intensity="0.25" />
        </TresMesh>
      </TresGroup>

      <TresMesh :scale="vec3(1.02, 0.88, 0.9)" cast-shadow>
        <TresSphereGeometry :args="[0.9, 64, 64]" />
        <TresMeshStandardMaterial :color="coat" :roughness="0.28" :metalness="0.04" />
      </TresMesh>

      <TresMesh :position="vec3(0, -0.22, 0.79)" :scale="vec3(0.48, 0.34, 0.36)">
        <TresSphereGeometry :args="[0.65, 48, 48]" />
        <TresMeshStandardMaterial color="#f7f8ff" :roughness="0.34" />
      </TresMesh>

      <!-- 眼睛与表情 / Eyes and facial expressions -->
      <TresGroup ref="eyeGroup">
        <TresGroup ref="leftEye" :position="vec3(-0.31, 0.08, 0.77)">
          <TresMesh :scale="vec3(0.16, 0.22, 0.1)">
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial :color="eyeColor" :roughness="0.08" />
          </TresMesh>
          <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
            <TresSphereGeometry :args="[1, 20, 20]" />
            <TresMeshBasicMaterial :color="secondary" />
          </TresMesh>
        </TresGroup>

        <TresGroup ref="rightEye" :position="vec3(0.31, 0.08, 0.77)">
          <TresMesh :scale="vec3(0.16, 0.22, 0.1)">
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial :color="eyeColor" :roughness="0.08" />
          </TresMesh>
          <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
            <TresSphereGeometry :args="[1, 20, 20]" />
            <TresMeshBasicMaterial :color="secondary" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <TresGroup ref="cheeksGroup" :scale="vec3(0.001, 0.001, 0.001)">
        <TresMesh :position="vec3(-0.52, -0.16, 0.79)" :scale="vec3(0.13, 0.07, 0.03)">
          <TresSphereGeometry :args="[1, 24, 24]" />
          <TresMeshBasicMaterial color="#ff91b7" transparent :opacity="0.32" />
        </TresMesh>
        <TresMesh :position="vec3(0.52, -0.16, 0.79)" :scale="vec3(0.13, 0.07, 0.03)">
          <TresSphereGeometry :args="[1, 24, 24]" />
          <TresMeshBasicMaterial color="#ff91b7" transparent :opacity="0.32" />
        </TresMesh>
      </TresGroup>

      <TresMesh :position="vec3(0, -0.24, 1.015)" :scale="vec3(0.11, 0.085, 0.07)">
        <TresSphereGeometry :args="[1, 24, 24]" />
        <TresMeshStandardMaterial color="#25263b" :roughness="0.22" />
      </TresMesh>

      <TresGroup ref="mouthGroup" :position="vec3(0, -0.39, 0.985)">
        <TresMesh :scale="vec3(0.15, 0.075, 0.04)">
          <TresSphereGeometry :args="[1, 28, 28]" />
          <TresMeshStandardMaterial color="#24263c" :roughness="0.2" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.025, 0.035)" :scale="vec3(0.075, 0.026, 0.015)">
          <TresSphereGeometry :args="[1, 20, 20]" />
          <TresMeshBasicMaterial color="#ff87ad" />
        </TresMesh>
      </TresGroup>
    </TresGroup>

    <!-- 数据光环 / Data orbits -->
    <TresGroup ref="haloGroup" :position="vec3(0, 0.08, -0.18)" :rotation="euler(0.85, 0.2, 0)">
      <TresMesh>
        <TresTorusGeometry :args="[1.85, 0.018, 12, 120]" />
        <TresMeshBasicMaterial :color="accent" transparent :opacity="secretMode ? 0.92 : 0.32" />
      </TresMesh>
      <TresMesh :rotation="euler(1.1, 0.35, 0.6)">
        <TresTorusGeometry :args="[1.48, 0.012, 12, 120]" />
        <TresMeshBasicMaterial :color="secondary" transparent :opacity="secretMode ? 0.86 : 0.22" />
      </TresMesh>
      <TresMesh v-if="secretMode" :rotation="euler(0.3, 1.1, 0.2)">
        <TresTorusGeometry :args="[2.1, 0.025, 16, 140]" />
        <TresMeshBasicMaterial color="#ffdc79" transparent :opacity="0.72" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
