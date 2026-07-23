<!--
  文件职责 / File responsibility
  用完整 Studio/导入配方替换默认云狐拓扑，渲染可配置身体、头部、脸部、四肢、触角、尾巴、轨道和标志。
  Replaces the default Cloud Fox topology for Studio/import recipes and renders configurable body, head, face, limbs, antennae, tail, orbit, and symbols.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import { CanvasTexture, Color, DoubleSide, Euler, Vector3 } from 'three'
import type { Group, MeshStandardMaterial } from 'three'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import type { PetEmotion } from './types'
import { resolveStudioRecipeCloudFoxAppearance } from './studio-recipe-appearance'

const props = defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  motionKey: number
  recipe?: PetRecipeEnvelope | null
}>()

const appearance = computed(() => resolveStudioRecipeCloudFoxAppearance(props.recipe))
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothStep = (start: number, end: number, value: number) => {
  const progress = clamp01((value - start) / Math.max(.0001, end - start))
  return progress * progress * (3 - 2 * progress)
}

const presentation = shallowRef<Group>()
const motion = shallowRef<Group>()
const head = shallowRef<Group>()
const leftPaw = shallowRef<Group>()
const rightPaw = shallowRef<Group>()
const leftEye = shallowRef<Group>()
const rightEye = shallowRef<Group>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const tail = shallowRef<Group>()
const orbit = shallowRef<Group>()
const glowMaterials = shallowRef<MeshStandardMaterial[]>([])
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()

const bodyScale = computed(() => vector(
  .92 * appearance.value.proportions.bodyWidth,
  1.08 * appearance.value.proportions.bodyHeight,
  .78 * appearance.value.proportions.bodyDepth,
))
const headScale = computed(() => vector(
  appearance.value.proportions.headScale,
  appearance.value.proportions.headScale,
  appearance.value.proportions.headScale,
))
const eyeX = computed(() => .34 * appearance.value.proportions.eyeSpacing)
const eyeScale = computed(() => {
  const scale = appearance.value.proportions.eyeScale
  if (appearance.value.parts.eyes === 'sleepy') return vector(.24 * scale, .08 * scale, .1)
  if (appearance.value.parts.eyes === 'oval') return vector(.23 * scale, .34 * scale, .12)
  if (appearance.value.parts.eyes === 'visor') return vector(.72 * scale, .16 * scale, .09)
  if (appearance.value.parts.eyes === 'diamond' || appearance.value.parts.eyes === 'spark') return vector(.22 * scale, .28 * scale, .12)
  return vector(.24 * scale, .31 * scale, .12)
})
const earX = computed(() => .58 * Math.max(.9, appearance.value.proportions.headScale))
const antennaX = computed(() => appearance.value.antennaDesign.spacing / 2)
const pawX = computed(() => .66 * appearance.value.proportions.bodyWidth * appearance.value.proportions.limbSpacing)
const pawY = computed(() => -.08 + appearance.value.frontPawDesign.rootHeight)
const pawScale = computed(() => vector(
  appearance.value.proportions.limbThickness * appearance.value.frontPawDesign.shoulderScale,
  appearance.value.proportions.limbLength,
  appearance.value.proportions.limbThickness,
))
const bellyScale = computed(() => vector(
  .48 * appearance.value.bellyPatchDesign.width * appearance.value.proportions.bodyWidth,
  .58 * appearance.value.bellyPatchDesign.height * appearance.value.proportions.bodyHeight,
  .1,
))
const showEnergyCore = computed(() => ['energy-core', 'hybrid'].includes(appearance.value.chestDisplay.mode))
const showChestSymbol = computed(() => appearance.value.symbols.chest.enabled && ['symbol', 'hybrid'].includes(appearance.value.chestDisplay.mode))
const showAntenna = computed(() => appearance.value.parts.antenna !== 'none')
const directionRotation = computed(() => {
  const direction = appearance.value.tailDesign.direction
  const map: Record<string, [number, number, number]> = {
    left: [0, .35, -.32], right: [0, -2.8, .32], up: [0, 0, 1.16], down: [0, 0, -1.06], back: [0, -1.08, 0], forward: [0, 1.08, 0],
  }
  const [x, y, z] = map[direction] || map.left!
  return rotation(x, y, z)
})
const tailSegments = computed(() => {
  const cursor = vector(0, 0, 0)
  let rx = 0
  let ry = 0
  let rz = 0
  return appearance.value.tailDesign.segments.map((segment, index) => {
    rx += segment.rotationX
    ry += segment.rotationY
    rz += segment.rotationZ
    const direction = vector(segment.offsetX, segment.length + segment.offsetY, segment.offsetZ).applyEuler(rotation(rx, ry, rz))
    const center = cursor.clone().addScaledVector(direction, .5)
    cursor.add(direction)
    return { ...segment, index, rx, ry, rz, center, joint: cursor.clone() }
  })
})
const orbitRings = computed(() => Array.from({ length: appearance.value.orbitDesign.ringCount }, (_, index) => index))

function createSymbolTexture(text: string, color: string, glowIntensity: number) {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '900 142px system-ui'
  context.shadowColor = color
  context.shadowBlur = 18 + glowIntensity * 18
  context.fillStyle = color
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 132)
  context.shadowBlur = 5
  context.fillStyle = '#ffffff'
  context.globalAlpha = .62
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

watch(
  () => appearance.value.symbols.chest,
  (symbol) => {
    chestTexture.value?.dispose()
    chestTexture.value = symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined
  },
  { immediate: true, deep: true },
)
watch(
  () => appearance.value.symbols.back,
  (symbol) => {
    backTexture.value?.dispose()
    backTexture.value = symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined
  },
  { immediate: true, deep: true },
)

function setPawRef(value: unknown, side: number) {
  if (side < 0) leftPaw.value = value as Group
  else rightPaw.value = value as Group
}

function setEyeRef(value: unknown, side: number) {
  if (side < 0) leftEye.value = value as Group
  else rightEye.value = value as Group
}

function setAntennaRef(value: unknown, side: number) {
  if (side < 0) leftAntenna.value = value as Group
  else rightAntenna.value = value as Group
}

function collectGlowMaterial(value: unknown) {
  const material = value as MeshStandardMaterial | undefined
  if (material && !glowMaterials.value.includes(material)) glowMaterials.value.push(material)
}

let previousBehavior = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
const rainbow = new Color()
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed, delta }) => {
  const root = motion.value
  const face = head.value
  if (!root || !face) return
  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) {
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }

  const time = Math.max(0, elapsed - startedAt)
  const state = props.behavior
  const motionScale = reducedMotion ? .28 : 1
  const greeting = state === 'greeting'
  const jumping = state === 'jumping'
  const flapping = state === 'flapping'
  const resting = state === 'resting' || state === 'sleeping' || state === 'cloud-nap'
  const stretching = state === 'stretching'
  const spinning = state === 'spinning' || state === 'tail-tornado'
  const eating = state === 'eating'
  const highEnergy = ['backflip', 'tail-tornado', 'diving-catch', 'energy-burst', 'fireworks-show'].includes(state)
  const playful = state === 'playing' || state === 'playing-ball' || state === 'star-juggle'
  const greetingProgress = greeting ? Math.min(1, time / 2.4) : 0
  const greetingPose = greeting ? smoothStep(.02, .22, greetingProgress) * (1 - smoothStep(.78, .98, greetingProgress)) : 0
  const jumpProgress = jumping ? Math.min(1, time / 2.4) : 0
  const jump = jumping ? Math.sin(jumpProgress * Math.PI) * .78 * motionScale : 0
  const stretchProgress = stretching ? Math.min(1, time / 7) : 0
  const stretchPose = stretching ? smoothStep(.04, .28, stretchProgress) * (1 - smoothStep(.76, .98, stretchProgress)) : 0
  const highPulse = highEnergy ? Math.sin(Math.min(1, time / 5) * Math.PI) : 0
  const idleBob = Math.sin(elapsed * (resting ? 1.1 : 1.85)) * (resting ? .018 : .045)
  const targetY = -.08 + idleBob + jump + (highEnergy ? Math.max(0, highPulse) * .22 * motionScale : 0)
  root.position.y = damp(root.position.y, targetY, jumping ? 10 : 5.5, delta)
  root.position.x = damp(root.position.x, playful ? Math.sin(elapsed * 2.4) * .08 * motionScale : 0, 5, delta)
  root.rotation.x = damp(root.rotation.x, resting ? .28 : stretching ? -.1 * stretchPose : state === 'backflip' ? -Math.sin(Math.min(1, time / 4.3) * Math.PI) * .42 * motionScale : 0, 7, delta)
  if (spinning) root.rotation.y += delta * (state === 'tail-tornado' ? 7.2 : 4.8) * motionScale
  else root.rotation.y = damp(root.rotation.y, 0, 7, delta)
  root.rotation.z = damp(root.rotation.z, state === 'confused' ? Math.sin(elapsed * 2.3) * .08 : state === 'shy-peek' ? -.08 : 0, 7, delta)

  face.rotation.z = damp(face.rotation.z, greeting ? Math.sin(elapsed * 5.6) * .08 * greetingPose : state === 'confused' ? -.1 : state === 'shy-peek' ? -.12 : 0, 7, delta)
  face.rotation.x = damp(face.rotation.x, resting ? .08 : stretching ? -.12 * stretchPose : 0, 6, delta)

  const pawWave = greeting ? Math.sin(time * 10) * .24 * greetingPose : 0
  const flap = flapping ? Math.sin(time * 10) * .64 * motionScale : 0
  const pawLift = stretching ? stretchPose * 1.82 : highEnergy ? highPulse * .72 * motionScale : 0
  if (leftPaw.value) {
    leftPaw.value.rotation.z = damp(leftPaw.value.rotation.z, stretching ? -2.22 * stretchPose : flapping ? .82 + flap : playful ? -.28 + Math.sin(elapsed * 7) * .24 : eating ? -.28 : state === 'shy-peek' ? -1.08 : -appearance.value.frontPawDesign.outwardAngle, 8, delta)
    leftPaw.value.rotation.x = damp(leftPaw.value.rotation.x, appearance.value.frontPawDesign.forwardAngle - pawLift * .22, 8, delta)
  }
  if (rightPaw.value) {
    rightPaw.value.rotation.z = damp(rightPaw.value.rotation.z, greeting ? 2.16 * greetingPose + pawWave : stretching ? 2.22 * stretchPose : flapping ? -.82 - flap : playful ? .28 - Math.sin(elapsed * 7) * .24 : eating ? .28 : state === 'shy-peek' ? 1.08 : appearance.value.frontPawDesign.outwardAngle, 8, delta)
    rightPaw.value.rotation.x = damp(rightPaw.value.rotation.x, appearance.value.frontPawDesign.forwardAngle - pawLift * .22, 8, delta)
  }

  const pointerX = Math.max(-1, Math.min(1, props.pointer.x))
  const pointerY = Math.max(-1, Math.min(1, props.pointer.y))
  for (const [eye, side] of [[leftEye.value, -1], [rightEye.value, 1]] as const) {
    if (!eye) continue
    eye.position.x = damp(eye.position.x, side * eyeX.value + pointerX * .035, 10, delta)
    eye.position.y = damp(eye.position.y, .08 - pointerY * .03, 10, delta)
    const blink = resting ? .12 : Math.max(.14, 1 - Math.pow(Math.max(0, Math.sin(elapsed * .72)), 30) * .88)
    eye.scale.y = damp(eye.scale.y, blink, 18, delta)
  }

  if (tail.value) {
    const speed = highEnergy ? 8.4 : greeting || playful ? 5.8 : resting ? 1.1 : 2.4
    const amount = highEnergy ? .3 : greeting || playful ? .2 : resting ? .025 : .09
    tail.value.rotation.z = directionRotation.value.z + Math.sin(elapsed * speed) * amount * motionScale
    tail.value.rotation.x = directionRotation.value.x + Math.cos(elapsed * speed * .5) * amount * .16 * motionScale
  }
  if (leftAntenna.value && rightAntenna.value) {
    const antennaWave = Math.sin(elapsed * appearance.value.glow.pulseSpeed * 3.2) * .045
    const converge = state === 'antenna-charge' || state === 'energy-burst' ? Math.sin(Math.min(1, time / 5.2) * Math.PI) * .35 : 0
    leftAntenna.value.rotation.z = -appearance.value.antennaDesign.tilt + antennaWave + converge
    rightAntenna.value.rotation.z = appearance.value.antennaDesign.tilt - antennaWave - converge
  }
  if (orbit.value) orbit.value.rotation.y += delta * appearance.value.orbitDesign.speed

  const pulse = 1 + Math.sin(elapsed * appearance.value.glow.pulseSpeed * 3.5) * .12
  if (appearance.value.glow.mode === 'rainbow') rainbow.setHSL((elapsed * .11) % 1, .86, .64)
  for (const material of glowMaterials.value) {
    material.emissiveIntensity = appearance.value.glow.intensity * pulse
    if (appearance.value.glow.mode === 'rainbow') {
      material.color.copy(rainbow)
      material.emissive.copy(rainbow)
    }
  }
})

onBeforeUnmount(() => {
  chestTexture.value?.dispose()
  backTexture.value?.dispose()
  glowMaterials.value = []
})
</script>

<template>
  <TresGroup ref="presentation">
    <TresGroup ref="motion" :position="vector(0, -.08, 0)">
      <TresGroup
        v-if="appearance.orbitDesign.enabled"
        ref="orbit"
        :position="vector(0, -.1, 0)"
        :rotation="rotation(appearance.orbitDesign.tilt, 0, .24)"
      >
        <TresMesh
          v-for="ring in orbitRings"
          :key="ring"
          :rotation="rotation(Math.PI / 2 + ring * .28, ring * .34, 0)"
          :scale="vector(appearance.orbitDesign.radius + ring * .12, appearance.orbitDesign.radius * appearance.orbitDesign.verticalScale + ring * .08, 1)"
        >
          <TresTorusGeometry :args="[1, .012 + ring * .004, 8, 64]" />
          <TresMeshStandardMaterial
            :ref="collectGlowMaterial"
            :color="ring % 2 ? appearance.orbitDesign.secondaryColor : appearance.orbitDesign.primaryColor"
            :emissive="ring % 2 ? appearance.orbitDesign.secondaryColor : appearance.orbitDesign.primaryColor"
            :emissive-intensity="appearance.orbitDesign.intensity"
            transparent
            :opacity=".58"
          />
        </TresMesh>
      </TresGroup>

      <TresGroup
        ref="tail"
        :position="vector(-.68 + appearance.tailDesign.rootOffsetX + appearance.tailDesign.lateralOffset * .24, -.2 + appearance.tailDesign.rootOffsetY, -.18 + appearance.tailDesign.rootOffsetZ)"
        :rotation="directionRotation"
      >
        <TresMesh :position="vector(0, appearance.tailDesign.rootExtensionLength / 2, 0)" :scale="vector(appearance.tailDesign.rootExtensionWidth, appearance.tailDesign.rootExtensionLength, appearance.tailDesign.rootExtensionWidth)">
          <TresSphereGeometry :args="[.5, 16, 16]" />
          <TresMeshStandardMaterial :color="appearance.palette.coatShadow" />
        </TresMesh>
        <TresGroup v-for="segment in tailSegments" :key="segment.index">
          <TresMesh :position="segment.center" :rotation="rotation(segment.rx, segment.ry, segment.rz)" :scale="vector(segment.width, segment.length, segment.width)">
            <TresSphereGeometry :args="[.5, 16, 16]" />
            <TresMeshStandardMaterial
              :ref="collectGlowMaterial"
              :color="appearance.parts.tail === 'energy' ? appearance.palette.tailGlow : appearance.palette.coatShadow"
              :emissive="appearance.glow.tailEnabled ? appearance.tailDesign.tipGlow.color : '#000000'"
              :emissive-intensity="appearance.glow.tailEnabled ? appearance.tailDesign.tipGlow.intensity * .28 : 0"
            />
          </TresMesh>
          <TresMesh :position="segment.joint" :scale="vector(segment.width * .7, segment.width * .7, segment.width * .7)">
            <TresSphereGeometry :args="[1, 16, 16]" />
            <TresMeshStandardMaterial :color="appearance.palette.coat" />
          </TresMesh>
        </TresGroup>
      </TresGroup>

      <TresGroup :position="vector(0, -.46, 0)">
        <TresMesh v-if="appearance.parts.bodyShape === 'rounded-cube'" :scale="vector(bodyScale.x * .9, bodyScale.y * .9, bodyScale.z * .9)" cast-shadow>
          <TresBoxGeometry :args="[1.72, 1.72, 1.72, 6, 6, 6]" />
          <TresMeshStandardMaterial :color="appearance.palette.shade" />
        </TresMesh>
        <template v-else-if="['pear', 'bean', 'capsule'].includes(appearance.parts.bodyShape)">
          <TresMesh :position="appearance.parts.bodyShape === 'bean' ? vector(-.18, -.08, 0) : vector(0, -.18, 0)" :rotation="appearance.parts.bodyShape === 'bean' ? rotation(0, 0, -.18) : rotation(0, 0, 0)" :scale="vector(bodyScale.x, bodyScale.y * .8, bodyScale.z)" cast-shadow>
            <TresSphereGeometry :args="[1, 36, 36]" />
            <TresMeshStandardMaterial :color="appearance.palette.shade" />
          </TresMesh>
          <TresMesh :position="appearance.parts.bodyShape === 'bean' ? vector(.26, .16, 0) : vector(0, .42, 0)" :scale="vector(bodyScale.x * .66, bodyScale.y * .58, bodyScale.z * .78)">
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial :color="appearance.palette.coat" />
          </TresMesh>
        </template>
        <TresMesh v-else :scale="appearance.parts.bodyShape === 'sphere' ? vector(1.02, 1.02, 1.02) : bodyScale" cast-shadow>
          <TresSphereGeometry :args="[1, 40, 40]" />
          <TresMeshStandardMaterial :color="appearance.palette.shade" />
        </TresMesh>

        <TresMesh
          v-if="appearance.bellyPatchDesign.visible"
          :position="vector(0, .03 + appearance.bellyPatchDesign.offsetY, .79 * appearance.proportions.bodyDepth)"
          :scale="bellyScale"
        >
          <TresSphereGeometry :args="[1, 28, 28]" />
          <TresMeshStandardMaterial :color="appearance.palette.highlight" />
        </TresMesh>

        <TresMesh v-if="showEnergyCore" :position="vector(0, -.02, .94 * appearance.proportions.bodyDepth)" :scale="vector(.26, .34, .08)">
          <TresTorusGeometry :args="[.72, .12, 16, 48]" />
          <TresMeshStandardMaterial :ref="collectGlowMaterial" :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity="appearance.glow.intensity" />
        </TresMesh>

        <TresGroup v-if="showChestSymbol && chestTexture" :position="vector(appearance.symbols.chest.offsetX, -.02 + appearance.symbols.chest.offsetY, .99 + appearance.symbols.chest.offsetZ)" :rotation="rotation(0, 0, appearance.symbols.chest.rotation)" :scale="vector(.36 * appearance.symbols.chest.scale, .36 * appearance.symbols.chest.scale, .36)">
          <TresMesh><TresPlaneGeometry /><TresMeshBasicMaterial :map="chestTexture" transparent :side="DoubleSide" :depth-write="false" /></TresMesh>
        </TresGroup>
        <TresGroup v-if="appearance.symbols.back.enabled && backTexture" :position="vector(appearance.symbols.back.offsetX, -.04 + appearance.symbols.back.offsetY, -.91 - appearance.symbols.back.offsetZ)" :rotation="rotation(0, Math.PI, appearance.symbols.back.rotation)" :scale="vector(.44 * appearance.symbols.back.scale, .44 * appearance.symbols.back.scale, .44)">
          <TresMesh><TresPlaneGeometry /><TresMeshBasicMaterial :map="backTexture" transparent :side="DoubleSide" :depth-write="false" /></TresMesh>
        </TresGroup>
      </TresGroup>

      <TresGroup
        v-for="side in [-1, 1]"
        :key="`paw-${side}`"
        :ref="(node: unknown) => setPawRef(node, side)"
        :position="vector(side * pawX, pawY, .62 + appearance.frontPawDesign.forwardOffset - appearance.frontPawDesign.embedDepth)"
        :scale="pawScale"
      >
        <TresMesh :position="vector(0, -.18, 0)" :scale="appearance.frontPawDesign.style === 'mitten' ? vector(.18, .26, .16) : appearance.frontPawDesign.style === 'mechanical' ? vector(.16, .25, .15) : vector(.14, .3, .14)">
          <TresSphereGeometry v-if="appearance.frontPawDesign.style !== 'mechanical'" :args="[1, 22, 22]" />
          <TresBoxGeometry v-else :args="[1, 1, 1]" />
          <TresMeshStandardMaterial :color="appearance.frontPawDesign.style === 'mechanical' ? appearance.palette.coatShadow : appearance.palette.coat" :metalness="appearance.frontPawDesign.style === 'mechanical' ? .68 : 0" />
        </TresMesh>
        <TresMesh :position="vector(0, -.48, .025)" :scale="vector(.22 * appearance.proportions.pawScale * appearance.frontPawDesign.palmScale, .16 * appearance.proportions.pawScale * appearance.frontPawDesign.palmScale, .22 * appearance.proportions.pawScale * appearance.frontPawDesign.palmScale)">
          <TresSphereGeometry :args="[1, 22, 22]" />
          <TresMeshStandardMaterial :color="appearance.palette.highlight" />
        </TresMesh>
      </TresGroup>

      <TresMesh v-for="side in [-1, 1]" :key="`hind-${side}`" :position="vector(side * .48 * appearance.proportions.bodyWidth, -1.4 * appearance.proportions.bodyHeight, .25)" :scale="vector(.34 * appearance.proportions.pawScale, .2 * appearance.proportions.pawScale, .42 * appearance.proportions.pawScale)">
        <TresSphereGeometry :args="[1, 24, 24]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatWarm" />
      </TresMesh>

      <TresGroup ref="head" :position="vector(0, .92 * appearance.proportions.bodyHeight, .03)" :scale="headScale">
        <TresMesh :scale="vector(1.04, .88, .9)" cast-shadow>
          <TresSphereGeometry :args="[.9, 40, 40]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" />
        </TresMesh>

        <TresGroup v-for="side in [-1, 1]" :key="`ear-${side}`" :position="vector(side * earX, .65, -.04)" :rotation="rotation(0, 0, side * .16)" :scale="vector(appearance.proportions.earScale, appearance.proportions.earScale, appearance.proportions.earScale)">
          <TresMesh :scale="appearance.parts.ears === 'floppy' ? vector(.82, 1.2, .62) : appearance.parts.ears === 'rounded' ? vector(1, 1.08, .7) : appearance.parts.ears === 'wing' ? vector(1.3, .9, .62) : vector(1, 1, 1)">
            <TresSphereGeometry v-if="['rounded', 'floppy'].includes(appearance.parts.ears)" :args="[.34, 24, 24]" />
            <TresBoxGeometry v-else-if="appearance.parts.ears === 'mechanical'" :args="[.54, .86, .42]" />
            <TresConeGeometry v-else :args="[.35, .9, appearance.parts.ears === 'petal' ? 6 : 4]" />
            <TresMeshStandardMaterial :color="appearance.parts.ears === 'mechanical' ? appearance.palette.coatShadow : appearance.earDesign.outerColor" :metalness="appearance.parts.ears === 'mechanical' ? .7 : 0" />
          </TresMesh>
          <TresMesh v-if="!['rounded', 'floppy', 'mechanical'].includes(appearance.parts.ears)" :position="vector(0, -.04, .18)" :scale="vector(.52, .62, .08)">
            <TresConeGeometry :args="[.35, .75, appearance.parts.ears === 'petal' ? 6 : 4]" />
            <TresMeshStandardMaterial :ref="collectGlowMaterial" :color="appearance.earDesign.innerColor" :emissive="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowColor : '#000000'" :emissive-intensity="appearance.earDesign.innerGlowEnabled ? appearance.earDesign.innerGlowIntensity : 0" />
          </TresMesh>
        </TresGroup>

        <template v-if="showAntenna">
          <TresGroup v-for="side in [-1, 1]" :key="`antenna-${side}`" :ref="(node: unknown) => setAntennaRef(node, side)" :position="vector(side * antennaX, .72, -.04)" :rotation="rotation(0, 0, side * appearance.antennaDesign.tilt)">
            <TresMesh :position="vector(0, appearance.antennaDesign.length / 2, 0)" :rotation="rotation(0, 0, appearance.parts.antennaRod === 'arc' ? side * .18 : 0)">
              <TresCylinderGeometry :args="[appearance.parts.antennaRod === 'tapered' ? appearance.antennaDesign.thickness * .5 : appearance.antennaDesign.thickness, appearance.antennaDesign.thickness, appearance.antennaDesign.length, 12]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :metalness="appearance.parts.antennaRod === 'segmented' ? .75 : .2" />
            </TresMesh>
            <TresMesh :position="vector(appearance.parts.antennaRod === 'arc' ? side * .08 : 0, appearance.antennaDesign.length, 0)">
              <TresTorusGeometry v-if="appearance.parts.antennaTip === 'ring'" :args="[.12, .035, 10, 24]" />
              <TresDodecahedronGeometry v-else :args="[appearance.parts.antennaTip === 'crystal' ? .14 : .11, appearance.parts.antennaTip === 'star' ? 1 : 0]" />
              <TresMeshStandardMaterial :ref="collectGlowMaterial" :color="appearance.palette.antennaGlow" :emissive="appearance.glow.antennaEnabled ? appearance.palette.antennaGlow : '#000000'" :emissive-intensity="appearance.glow.antennaEnabled ? appearance.glow.intensity : 0" />
            </TresMesh>
          </TresGroup>
        </template>

        <TresGroup v-if="appearance.parts.eyes === 'visor'" :position="vector(0, .08, .78)">
          <TresMesh :scale="eyeScale"><TresBoxGeometry :args="[1, 1, 1]" /><TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="appearance.palette.secondaryGlow" :emissive-intensity=".42" /></TresMesh>
        </TresGroup>
        <template v-else>
          <TresGroup v-for="side in [-1, 1]" :key="`eye-${side}`" :ref="(node: unknown) => setEyeRef(node, side)" :position="vector(side * eyeX, .08, .77)">
            <TresMesh :scale="eyeScale">
              <TresDodecahedronGeometry v-if="['spark', 'diamond'].includes(appearance.parts.eyes)" :args="[1, 0]" />
              <TresSphereGeometry v-else :args="[1, 28, 28]" />
              <TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="['spark', 'diamond'].includes(appearance.parts.eyes) ? appearance.palette.secondaryGlow : '#000000'" :emissive-intensity=".5" />
            </TresMesh>
            <TresMesh :position="vector(side * -.035, .075, .105)" :scale="vector(.045, .065, .025)"><TresSphereGeometry :args="[1, 12, 12]" /><TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" /></TresMesh>
          </TresGroup>
        </template>

        <TresMesh :position="vector(0, -.23, .98)" :scale="appearance.parts.nose === 'heart' ? vector(.14, .12, .075) : vector(.12, .09, .075)">
          <TresDodecahedronGeometry v-if="['sensor', 'heart'].includes(appearance.parts.nose)" :args="[1, 0]" />
          <TresSphereGeometry v-else :args="[1, 20, 20]" />
          <TresMeshStandardMaterial :color="appearance.parts.nose === 'sensor' ? appearance.palette.primaryGlow : '#25263b'" :emissive="appearance.parts.nose === 'sensor' ? appearance.palette.primaryGlow : '#000000'" />
        </TresMesh>
        <TresMesh :position="vector(0, -.39, .965)" :scale="appearance.parts.mouth === 'open' || speaking ? vector(.16, .12, .05) : appearance.parts.mouth === 'pout' ? vector(.09, .05, .04) : vector(.15, .075, .04)">
          <TresSphereGeometry :args="[1, 20, 20]" />
          <TresMeshStandardMaterial color="#24263c" />
        </TresMesh>
        <TresMesh v-if="appearance.parts.mouth === 'open' || speaking" :position="vector(0, -.405, 1.015)" :scale="vector(.09, .035, .02)">
          <TresSphereGeometry :args="[1, 16, 16]" />
          <TresMeshBasicMaterial color="#ff9fbd" />
        </TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
