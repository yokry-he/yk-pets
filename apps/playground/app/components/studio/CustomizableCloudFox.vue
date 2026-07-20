
<!--
  文件职责 / File responsibility
  使用云狐外观配方渲染可替换耳朵、眼睛、鼻子、嘴、尾巴、触角、比例、发光与胸背标志。
  Renders replaceable ears, eyes, nose, mouth, tail, antennae, proportions, glow, and chest/back symbols from a Cloud Fox appearance recipe.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Euler, Vector3 } from 'three'
import type { Group, MeshStandardMaterial } from 'three'
import type {
  CloudFoxAppearanceRecipe,
  CloudFoxStudioBehavior,
  CloudFoxStudioView,
} from '~/domain/cloud-fox-appearance'

const props = defineProps<{
  appearance: CloudFoxAppearanceRecipe
  behavior: CloudFoxStudioBehavior
  view: CloudFoxStudioView
}>()

function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

function euler(x: number, y: number, z: number) {
  return new Euler(x, y, z)
}

const presentationGroup = shallowRef<Group>()
const motionGroup = shallowRef<Group>()
const headGroup = shallowRef<Group>()
const leftEar = shallowRef<Group>()
const rightEar = shallowRef<Group>()
const leftPaw = shallowRef<Group>()
const rightPaw = shallowRef<Group>()
const tailGroup = shallowRef<Group>()
const tailMidGroup = shallowRef<Group>()
const tailTipGroup = shallowRef<Group>()
const leftAntenna = shallowRef<Group>()
const rightAntenna = shallowRef<Group>()
const tailGlowMaterial = shallowRef<MeshStandardMaterial>()
const leftAntennaMaterial = shallowRef<MeshStandardMaterial>()
const rightAntennaMaterial = shallowRef<MeshStandardMaterial>()
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()

const viewRotation = computed(() => ({
  front: 0,
  left: Math.PI / 2,
  back: Math.PI,
  right: -Math.PI / 2,
}[props.view]))

const tailPreset = computed(() => ({
  cloud: { length: 1, width: 1, tip: 1, energy: false },
  plume: { length: 0.94, width: 1.34, tip: 1.48, energy: false },
  long: { length: 1.3, width: 0.88, tip: 0.94, energy: false },
  energy: { length: 1.12, width: 0.82, tip: 1.18, energy: true },
}[props.appearance.parts.tail]))

const tailLength = computed(() => props.appearance.proportions.tailLength * tailPreset.value.length)
const tailWidth = computed(() => props.appearance.proportions.tailWidth * tailPreset.value.width)
const pawBaseX = computed(() => 0.36 * props.appearance.proportions.limbSpacing)
const pawBaseY = computed(() => -0.82 - (props.appearance.proportions.limbLength - 1) * 0.16)
const eyeBaseX = computed(() => 0.31 * props.appearance.proportions.eyeSpacing)
const earBaseX = computed(() => 0.56 * Math.max(0.9, props.appearance.proportions.headScale))
const glowIntensity = computed(() => props.appearance.glow.intensity)

const emotionGlow = computed(() => {
  if (props.appearance.glow.mode === 'fixed') return props.appearance.palette.primaryGlow
  if (props.appearance.glow.mode === 'rainbow') return props.appearance.palette.primaryGlow
  return {
    idle: props.appearance.palette.primaryGlow,
    greeting: props.appearance.palette.secondaryGlow,
    jumping: '#ffd36a',
    stretching: props.appearance.palette.antennaGlow,
    spinning: '#ff78c8',
    resting: '#8190c9',
  }[props.behavior]
})

const tailGlow = computed(() => props.appearance.glow.mode === 'emotion'
  ? emotionGlow.value
  : props.appearance.palette.tailGlow)
const antennaGlow = computed(() => props.appearance.glow.mode === 'emotion'
  ? emotionGlow.value
  : props.appearance.palette.antennaGlow)

const tailBaseCurve = computed(() => new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.28 * tailLength.value, 0.04, 0),
  vec3(-0.52 * tailLength.value, 0.2, 0),
  vec3(-0.68 * tailLength.value, 0.44, 0),
]))
const tailMidCurve = computed(() => new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(-0.08 * tailLength.value, 0.22, 0),
  vec3(-0.02 * tailLength.value, 0.45, 0),
  vec3(0.18 * tailLength.value, 0.64, 0),
]))
const tailTipCurve = computed(() => new CatmullRomCurve3([
  vec3(0, 0, 0),
  vec3(0.18 * tailLength.value, 0.14, 0),
  vec3(0.4 * tailLength.value, 0.15, 0),
  vec3(0.58 * tailLength.value, 0.05, 0),
]))

function createSymbolTexture(text: string, color: string) {
  if (!import.meta.client) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.clearRect(0, 0, 256, 256)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '900 142px ui-sans-serif, system-ui, sans-serif'
  context.shadowColor = color
  context.shadowBlur = 34
  context.fillStyle = color
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 134)
  context.shadowBlur = 10
  context.fillStyle = '#ffffff'
  context.globalAlpha = 0.62
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 130)
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

watch(
  () => [props.appearance.symbols.chestText, props.appearance.palette.symbolGlow] as const,
  ([text, color]) => {
    chestTexture.value?.dispose()
    chestTexture.value = createSymbolTexture(text, color)
  },
  { immediate: true },
)

watch(
  () => [props.appearance.symbols.backText, props.appearance.palette.symbolGlow] as const,
  ([text, color]) => {
    backTexture.value?.dispose()
    backTexture.value = createSymbolTexture(text, color)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  chestTexture.value?.dispose()
  backTexture.value?.dispose()
})

const { onBeforeRender } = useLoop()
const rainbow = new Color()
let previousBehavior = props.behavior
let behaviorStartedAt = 0

onBeforeRender(({ elapsed, delta }) => {
  const presentation = presentationGroup.value
  const motion = motionGroup.value
  const head = headGroup.value
  if (!presentation || !motion || !head) return

  presentation.rotation.y += (viewRotation.value - presentation.rotation.y) * Math.min(1, delta * 7)

  if (props.behavior !== previousBehavior) {
    previousBehavior = props.behavior
    behaviorStartedAt = elapsed
  }

  const stateElapsed = Math.max(0, elapsed - behaviorStartedAt)
  const jumping = props.behavior === 'jumping'
  const greeting = props.behavior === 'greeting'
  const stretching = props.behavior === 'stretching'
  const spinning = props.behavior === 'spinning'
  const resting = props.behavior === 'resting'
  const jumpProgress = Math.min(1, stateElapsed / 1.5)
  const jump = jumping ? Math.sin(jumpProgress * Math.PI) * 0.92 : 0
  const restY = resting ? -0.3 : 0.12
  const bob = Math.sin(elapsed * (resting ? 1.2 : 2.1)) * (resting ? 0.018 : 0.055)

  motion.position.y += (restY + jump + bob - motion.position.y) * Math.min(1, delta * 6.5)
  motion.rotation.x += ((resting ? 0.16 : stretching ? -0.08 : 0) - motion.rotation.x) * Math.min(1, delta * 5)
  if (spinning) motion.rotation.y += delta * 5.6
  else motion.rotation.y *= Math.max(0, 1 - delta * 6)

  const stretchScaleY = stretching ? 1.08 + Math.sin(stateElapsed * 2.6) * 0.025 : resting ? 0.82 : 1
  const stretchScaleX = stretching ? 0.95 : resting ? 1.08 : 1
  motion.scale.x += (stretchScaleX - motion.scale.x) * Math.min(1, delta * 5)
  motion.scale.y += (stretchScaleY - motion.scale.y) * Math.min(1, delta * 5)
  motion.scale.z += ((resting ? 1.06 : 1) - motion.scale.z) * Math.min(1, delta * 5)

  head.rotation.z += ((greeting ? Math.sin(elapsed * 5.8) * 0.13 : resting ? 0.08 : 0) - head.rotation.z) * Math.min(1, delta * 7)
  head.rotation.x += ((resting ? 0.24 : stretching ? -0.18 : 0) - head.rotation.x) * Math.min(1, delta * 6)

  const earWave = Math.sin(elapsed * (greeting ? 7 : 2.5)) * (greeting ? 0.075 : 0.025)
  if (leftEar.value && rightEar.value) {
    leftEar.value.rotation.z = -0.16 + earWave
    rightEar.value.rotation.z = 0.16 - earWave
  }

  const wagSpeed = spinning ? 8.4 : greeting || jumping ? 6.8 : resting ? 1.2 : 2.5
  const wagAmount = spinning ? 0.24 : greeting || jumping ? 0.18 : resting ? 0.025 : 0.075
  if (tailGroup.value) {
    tailGroup.value.rotation.z = -0.18 + Math.sin(elapsed * wagSpeed) * wagAmount
    tailGroup.value.rotation.x = 0.12 + Math.cos(elapsed * wagSpeed * 0.5) * wagAmount * 0.18
  }
  if (tailMidGroup.value) tailMidGroup.value.rotation.z = 0.06 + Math.sin(elapsed * wagSpeed - 0.62) * wagAmount * 0.72
  if (tailTipGroup.value) tailTipGroup.value.rotation.z = -0.08 + Math.sin(elapsed * wagSpeed - 1.18) * wagAmount

  const antennaWave = Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.2) * 0.05
  if (leftAntenna.value && rightAntenna.value) {
    leftAntenna.value.rotation.z = -0.2 + antennaWave
    rightAntenna.value.rotation.z = 0.2 - antennaWave
  }

  const pawY = pawBaseY.value
  const pawZ = resting ? 0.82 : 0.56
  if (leftPaw.value && rightPaw.value) {
    const raised = stretching ? 0.78 : 0
    const wave = greeting ? Math.max(0, Math.sin(stateElapsed * 9)) * 0.14 : 0
    leftPaw.value.position.y += (pawY + raised - leftPaw.value.position.y) * Math.min(1, delta * 8)
    rightPaw.value.position.y += (pawY + raised + wave - rightPaw.value.position.y) * Math.min(1, delta * 8)
    leftPaw.value.position.z += (pawZ - leftPaw.value.position.z) * Math.min(1, delta * 7)
    rightPaw.value.position.z += (pawZ - rightPaw.value.position.z) * Math.min(1, delta * 7)
    leftPaw.value.rotation.z += ((stretching ? -0.72 : 0) - leftPaw.value.rotation.z) * Math.min(1, delta * 8)
    rightPaw.value.rotation.z += ((greeting ? 0.78 + Math.sin(stateElapsed * 9) * 0.18 : stretching ? 0.72 : 0) - rightPaw.value.rotation.z) * Math.min(1, delta * 8)
  }

  const pulse = 1 + Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.5) * 0.12
  for (const material of [tailGlowMaterial.value, leftAntennaMaterial.value, rightAntennaMaterial.value]) {
    if (!material) continue
    material.emissiveIntensity = glowIntensity.value * pulse
  }

  if (props.appearance.glow.mode === 'rainbow') {
    rainbow.setHSL((elapsed * 0.11 * props.appearance.glow.pulseSpeed) % 1, 0.86, 0.64)
    for (const material of [tailGlowMaterial.value, leftAntennaMaterial.value, rightAntennaMaterial.value]) {
      if (!material) continue
      material.color.copy(rainbow)
      material.emissive.copy(rainbow)
    }
  }
})
</script>

<template>
  <TresGroup ref="presentationGroup">
    <TresGroup ref="motionGroup" :position="vec3(0, 0.12, 0)">
      <!-- 浮空底座 / Floating platform -->
      <TresMesh :position="vec3(0, -1.92, 0)">
        <TresCylinderGeometry :args="[1.48, 1.66, 0.18, 64]" />
        <TresMeshStandardMaterial color="#15192a" :metalness="0.62" :roughness="0.24" />
      </TresMesh>
      <TresMesh :position="vec3(0, -1.79, 0)" :rotation="euler(-Math.PI / 2, 0, 0)">
        <TresRingGeometry :args="[0.72, 1.18, 64]" />
        <TresMeshBasicMaterial :color="appearance.palette.primaryGlow" transparent :opacity="0.68" />
      </TresMesh>

      <!-- 分段可缩放云尾 / Segmented scalable cloud tail -->
      <TresGroup
        ref="tailGroup"
        :position="vec3(-0.72 * appearance.proportions.bodyScale, -0.5, -0.42)"
        :rotation="euler(0.12, 0.42, -0.18)"
      >
        <TresMesh cast-shadow>
          <TresTubeGeometry :args="[tailBaseCurve, 24, 0.27 * tailWidth, 14, false]" />
          <TresMeshStandardMaterial
            :color="tailPreset.energy ? tailGlow : appearance.palette.coatShadow"
            :emissive="tailPreset.energy ? tailGlow : '#000000'"
            :emissive-intensity="tailPreset.energy ? glowIntensity : 0"
            :roughness="0.3"
          />
        </TresMesh>
        <TresGroup ref="tailMidGroup" :position="vec3(-0.68 * tailLength, 0.44, 0)" :rotation="euler(0, 0, 0.06)">
          <TresMesh cast-shadow>
            <TresTubeGeometry :args="[tailMidCurve, 22, 0.22 * tailWidth, 14, false]" />
            <TresMeshStandardMaterial
              :color="tailPreset.energy ? tailGlow : appearance.palette.coat"
              :emissive="tailPreset.energy ? tailGlow : '#000000'"
              :emissive-intensity="tailPreset.energy ? glowIntensity : 0"
              :roughness="0.27"
            />
          </TresMesh>
          <TresGroup ref="tailTipGroup" :position="vec3(0.18 * tailLength, 0.64, 0)" :rotation="euler(0, 0, -0.08)">
            <TresMesh cast-shadow :scale="vec3(tailPreset.tip, tailPreset.tip, tailPreset.tip)">
              <TresTubeGeometry :args="[tailTipCurve, 20, 0.16 * tailWidth, 14, false]" />
              <TresMeshStandardMaterial
                ref="tailGlowMaterial"
                :color="appearance.glow.tailEnabled ? tailGlow : appearance.palette.coatWarm"
                :emissive="appearance.glow.tailEnabled ? tailGlow : '#000000'"
                :emissive-intensity="appearance.glow.tailEnabled ? glowIntensity : 0"
                :roughness="0.2"
              />
            </TresMesh>
            <TresMesh
              v-if="appearance.glow.tailEnabled"
              :position="vec3(0.58 * tailLength, 0.05, 0)"
              :scale="vec3(0.85 * tailPreset.tip, 0.85 * tailPreset.tip, 0.85 * tailPreset.tip)"
            >
              <TresSphereGeometry :args="[0.19 * tailWidth, 28, 28]" />
              <TresMeshBasicMaterial :color="tailGlow" transparent :opacity="0.34" />
            </TresMesh>
          </TresGroup>
        </TresGroup>
      </TresGroup>

      <!-- 身体与毛色区域 / Body and coat regions -->
      <TresMesh
        :position="vec3(0, -0.32, 0)"
        :scale="vec3(0.94 * appearance.proportions.bodyScale, 1.12 * appearance.proportions.bodyScale, 0.82 * appearance.proportions.bodyScale)"
        cast-shadow
      >
        <TresSphereGeometry :args="[1, 64, 64]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness="0.34" :metalness="0.04" />
      </TresMesh>
      <TresMesh
        :position="vec3(0, -0.26, 0.73 * appearance.proportions.bodyScale)"
        :scale="vec3(0.48 * appearance.proportions.bodyScale, 0.56 * appearance.proportions.bodyScale, 0.2)"
      >
        <TresSphereGeometry :args="[1, 48, 48]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness="0.4" />
      </TresMesh>

      <!-- 四肢受限比例调整 / Constrained limb proportion adjustment -->
      <TresGroup
        ref="leftPaw"
        :position="vec3(-pawBaseX, pawBaseY, 0.56)"
        :scale="vec3(appearance.proportions.pawScale, appearance.proportions.limbLength, appearance.proportions.pawScale)"
      >
        <TresMesh :rotation="euler(0, 0, -0.08)">
          <TresCylinderGeometry :args="[0.09, 0.11, 0.42, 20]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.26" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.26, 0.02)" :scale="vec3(1.05, 0.85, 1.2)">
          <TresSphereGeometry :args="[0.12, 24, 24]" />
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness="0.26" />
        </TresMesh>
      </TresGroup>
      <TresGroup
        ref="rightPaw"
        :position="vec3(pawBaseX, pawBaseY, 0.56)"
        :scale="vec3(appearance.proportions.pawScale, appearance.proportions.limbLength, appearance.proportions.pawScale)"
      >
        <TresMesh :rotation="euler(0, 0, 0.08)">
          <TresCylinderGeometry :args="[0.09, 0.11, 0.42, 20]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.26" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.26, 0.02)" :scale="vec3(1.05, 0.85, 1.2)">
          <TresSphereGeometry :args="[0.12, 24, 24]" />
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness="0.26" />
        </TresMesh>
      </TresGroup>

      <!-- 胸口与后背发光标志 / Glowing chest and back symbols -->
      <TresMesh
        v-if="appearance.symbols.chestEnabled && chestTexture"
        :position="vec3(0, -0.27, 0.94 * appearance.proportions.bodyScale)"
        :scale="vec3(0.42 * appearance.symbols.symbolScale, 0.42 * appearance.symbols.symbolScale, 0.42)"
      >
        <TresPlaneGeometry :args="[1, 1]" />
        <TresMeshBasicMaterial :map="chestTexture" transparent :opacity="0.96" :side="DoubleSide" />
      </TresMesh>
      <TresMesh
        v-if="appearance.symbols.backEnabled && backTexture"
        :position="vec3(0, -0.25, -0.84 * appearance.proportions.bodyScale)"
        :rotation="euler(0, Math.PI, 0)"
        :scale="vec3(0.48 * appearance.symbols.symbolScale, 0.48 * appearance.symbols.symbolScale, 0.48)"
      >
        <TresPlaneGeometry :args="[1, 1]" />
        <TresMeshBasicMaterial :map="backTexture" transparent :opacity="0.96" :side="DoubleSide" />
      </TresMesh>

      <!-- 头部、耳朵、触角与面部 / Head, ears, antennae, and face -->
      <TresGroup
        ref="headGroup"
        :position="vec3(0, 0.92, 0.06)"
        :scale="vec3(appearance.proportions.headScale, appearance.proportions.headScale, appearance.proportions.headScale)"
      >
        <TresGroup
          ref="leftEar"
          :position="vec3(-earBaseX, 0.65, -0.04)"
          :rotation="euler(0, 0, -0.16)"
          :scale="vec3(appearance.proportions.earScale, appearance.proportions.earScale, appearance.proportions.earScale)"
        >
          <template v-if="appearance.parts.ears === 'rounded'">
            <TresMesh :scale="vec3(1, 1.18, 0.66)">
              <TresSphereGeometry :args="[0.34, 32, 32]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.3" />
            </TresMesh>
          </template>
          <template v-else-if="appearance.parts.ears === 'mechanical'">
            <TresMesh :scale="vec3(0.72, 1.14, 0.52)">
              <TresBoxGeometry :args="[0.54, 0.86, 0.42]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :metalness="0.72" :roughness="0.2" />
            </TresMesh>
            <TresMesh :position="vec3(0, 0.03, 0.24)" :scale="vec3(0.52, 0.72, 0.18)">
              <TresBoxGeometry :args="[0.54, 0.66, 0.2]" />
              <TresMeshStandardMaterial :color="appearance.palette.innerEar" :emissive="appearance.palette.innerEar" :emissive-intensity="0.7" />
            </TresMesh>
          </template>
          <template v-else>
            <TresMesh :scale="appearance.parts.ears === 'wing' ? vec3(1.3, 0.9, 0.62) : vec3(1, 1, 1)" cast-shadow>
              <TresConeGeometry :args="[0.35, 0.9, 4]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.3" />
            </TresMesh>
            <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
              <TresConeGeometry :args="[0.35, 0.78, 4]" />
              <TresMeshStandardMaterial :color="appearance.palette.innerEar" :emissive="appearance.palette.innerEar" :emissive-intensity="0.25" />
            </TresMesh>
          </template>
        </TresGroup>

        <TresGroup
          ref="rightEar"
          :position="vec3(earBaseX, 0.65, -0.04)"
          :rotation="euler(0, 0, 0.16)"
          :scale="vec3(appearance.proportions.earScale, appearance.proportions.earScale, appearance.proportions.earScale)"
        >
          <template v-if="appearance.parts.ears === 'rounded'">
            <TresMesh :scale="vec3(1, 1.18, 0.66)">
              <TresSphereGeometry :args="[0.34, 32, 32]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.3" />
            </TresMesh>
          </template>
          <template v-else-if="appearance.parts.ears === 'mechanical'">
            <TresMesh :scale="vec3(0.72, 1.14, 0.52)">
              <TresBoxGeometry :args="[0.54, 0.86, 0.42]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :metalness="0.72" :roughness="0.2" />
            </TresMesh>
            <TresMesh :position="vec3(0, 0.03, 0.24)" :scale="vec3(0.52, 0.72, 0.18)">
              <TresBoxGeometry :args="[0.54, 0.66, 0.2]" />
              <TresMeshStandardMaterial :color="appearance.palette.innerEar" :emissive="appearance.palette.innerEar" :emissive-intensity="0.7" />
            </TresMesh>
          </template>
          <template v-else>
            <TresMesh :scale="appearance.parts.ears === 'wing' ? vec3(1.3, 0.9, 0.62) : vec3(1, 1, 1)" cast-shadow>
              <TresConeGeometry :args="[0.35, 0.9, 4]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.3" />
            </TresMesh>
            <TresMesh :position="vec3(0, -0.03, 0.09)" :scale="vec3(0.55, 0.68, 0.5)">
              <TresConeGeometry :args="[0.35, 0.78, 4]" />
              <TresMeshStandardMaterial :color="appearance.palette.innerEar" :emissive="appearance.palette.innerEar" :emissive-intensity="0.25" />
            </TresMesh>
          </template>
        </TresGroup>

        <template v-if="appearance.parts.antenna !== 'none'">
          <TresGroup
            ref="leftAntenna"
            :position="vec3(-0.22, 0.78, -0.04)"
            :rotation="euler(0, 0, appearance.parts.antenna === 'arc' ? -0.44 : -0.2)"
            :scale="vec3(appearance.proportions.antennaScale, appearance.proportions.antennaScale, appearance.proportions.antennaScale)"
          >
            <TresMesh :position="vec3(0, 0.28, 0)" :rotation="euler(0, 0, appearance.parts.antenna === 'arc' ? 0.24 : 0)">
              <TresCylinderGeometry :args="[0.025, 0.04, 0.58, 16]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :metalness="0.3" />
            </TresMesh>
            <TresMesh :position="vec3(appearance.parts.antenna === 'arc' ? 0.08 : 0, 0.61, 0)">
              <TresDodecahedronGeometry :args="[appearance.parts.antenna === 'crystal' ? 0.14 : 0.11, 0]" />
              <TresMeshStandardMaterial
                ref="leftAntennaMaterial"
                :color="appearance.glow.antennaEnabled ? antennaGlow : appearance.palette.coatWarm"
                :emissive="appearance.glow.antennaEnabled ? antennaGlow : '#000000'"
                :emissive-intensity="appearance.glow.antennaEnabled ? glowIntensity : 0"
                :roughness="0.12"
              />
            </TresMesh>
          </TresGroup>
          <TresGroup
            ref="rightAntenna"
            :position="vec3(0.22, 0.78, -0.04)"
            :rotation="euler(0, 0, appearance.parts.antenna === 'arc' ? 0.44 : 0.2)"
            :scale="vec3(appearance.proportions.antennaScale, appearance.proportions.antennaScale, appearance.proportions.antennaScale)"
          >
            <TresMesh :position="vec3(0, 0.28, 0)" :rotation="euler(0, 0, appearance.parts.antenna === 'arc' ? -0.24 : 0)">
              <TresCylinderGeometry :args="[0.025, 0.04, 0.58, 16]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :metalness="0.3" />
            </TresMesh>
            <TresMesh :position="vec3(appearance.parts.antenna === 'arc' ? -0.08 : 0, 0.61, 0)">
              <TresDodecahedronGeometry :args="[appearance.parts.antenna === 'crystal' ? 0.14 : 0.11, 0]" />
              <TresMeshStandardMaterial
                ref="rightAntennaMaterial"
                :color="appearance.glow.antennaEnabled ? antennaGlow : appearance.palette.coatWarm"
                :emissive="appearance.glow.antennaEnabled ? antennaGlow : '#000000'"
                :emissive-intensity="appearance.glow.antennaEnabled ? glowIntensity : 0"
                :roughness="0.12"
              />
            </TresMesh>
          </TresGroup>
        </template>

        <TresMesh :scale="vec3(1.02, 0.88, 0.9)" cast-shadow>
          <TresSphereGeometry :args="[0.9, 64, 64]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness="0.28" :metalness="0.04" />
        </TresMesh>
        <TresMesh :position="vec3(0, -0.22, 0.79)" :scale="vec3(0.48, 0.34, 0.36)">
          <TresSphereGeometry :args="[0.65, 48, 48]" />
          <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness="0.34" />
        </TresMesh>

        <!-- 可替换眼睛 / Replaceable eyes -->
        <TresGroup v-if="appearance.parts.eyes === 'visor'" :position="vec3(0, 0.08, 0.78)" :scale="vec3(appearance.proportions.eyeScale, appearance.proportions.eyeScale, 1)">
          <TresMesh :scale="vec3(0.72, 0.16, 0.08)">
            <TresBoxGeometry :args="[1, 1, 1]" />
            <TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="appearance.palette.secondaryGlow" :emissive-intensity="0.42" :roughness="0.08" />
          </TresMesh>
        </TresGroup>
        <template v-else>
          <TresGroup :position="vec3(-eyeBaseX, 0.08, 0.77)" :scale="vec3(appearance.proportions.eyeScale, appearance.proportions.eyeScale, 1)">
            <TresMesh :scale="appearance.parts.eyes === 'oval' ? vec3(0.13, 0.25, 0.1) : appearance.parts.eyes === 'spark' ? vec3(0.17, 0.17, 0.08) : vec3(0.16, 0.22, 0.1)">
              <TresDodecahedronGeometry v-if="appearance.parts.eyes === 'spark'" :args="[1, 0]" />
              <TresSphereGeometry v-else :args="[1, 32, 32]" />
              <TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="appearance.parts.eyes === 'spark' ? appearance.palette.secondaryGlow : '#000000'" :emissive-intensity="0.5" :roughness="0.08" />
            </TresMesh>
            <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
              <TresSphereGeometry :args="[1, 20, 20]" />
              <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" />
            </TresMesh>
          </TresGroup>
          <TresGroup :position="vec3(eyeBaseX, 0.08, 0.77)" :scale="vec3(appearance.proportions.eyeScale, appearance.proportions.eyeScale, 1)">
            <TresMesh :scale="appearance.parts.eyes === 'oval' ? vec3(0.13, 0.25, 0.1) : appearance.parts.eyes === 'spark' ? vec3(0.17, 0.17, 0.08) : vec3(0.16, 0.22, 0.1)">
              <TresDodecahedronGeometry v-if="appearance.parts.eyes === 'spark'" :args="[1, 0]" />
              <TresSphereGeometry v-else :args="[1, 32, 32]" />
              <TresMeshStandardMaterial :color="appearance.palette.eye" :emissive="appearance.parts.eyes === 'spark' ? appearance.palette.secondaryGlow : '#000000'" :emissive-intensity="0.5" :roughness="0.08" />
            </TresMesh>
            <TresMesh :position="vec3(0.04, 0.05, 0.105)" :scale="vec3(0.045, 0.065, 0.025)">
              <TresSphereGeometry :args="[1, 20, 20]" />
              <TresMeshBasicMaterial :color="appearance.palette.secondaryGlow" />
            </TresMesh>
          </TresGroup>
        </template>

        <!-- 可替换鼻子 / Replaceable nose -->
        <TresMesh v-if="appearance.parts.nose === 'triangle'" :position="vec3(0, -0.24, 1.015)" :rotation="euler(Math.PI / 2, 0, 0)" :scale="vec3(0.12, 0.12, 0.1)">
          <TresConeGeometry :args="[1, 1, 3]" />
          <TresMeshStandardMaterial color="#25263b" :roughness="0.22" />
        </TresMesh>
        <TresMesh v-else-if="appearance.parts.nose === 'sensor'" :position="vec3(0, -0.24, 1.015)" :scale="vec3(0.1, 0.1, 0.08)">
          <TresDodecahedronGeometry :args="[1, 0]" />
          <TresMeshStandardMaterial :color="appearance.palette.primaryGlow" :emissive="appearance.palette.primaryGlow" :emissive-intensity="0.8" :metalness="0.5" />
        </TresMesh>
        <TresMesh v-else :position="vec3(0, -0.24, 1.015)" :scale="vec3(0.11, 0.085, 0.07)">
          <TresSphereGeometry :args="[1, 24, 24]" />
          <TresMeshStandardMaterial color="#25263b" :roughness="0.22" />
        </TresMesh>

        <!-- 可替换嘴部 / Replaceable mouth -->
        <TresGroup :position="vec3(0, -0.39, 0.985)">
          <template v-if="appearance.parts.mouth === 'cat'">
            <TresMesh :position="vec3(-0.07, 0, 0)" :rotation="euler(0, 0, 0.28)" :scale="vec3(0.09, 0.035, 0.035)">
              <TresSphereGeometry :args="[1, 20, 20]" />
              <TresMeshStandardMaterial color="#24263c" />
            </TresMesh>
            <TresMesh :position="vec3(0.07, 0, 0)" :rotation="euler(0, 0, -0.28)" :scale="vec3(0.09, 0.035, 0.035)">
              <TresSphereGeometry :args="[1, 20, 20]" />
              <TresMeshStandardMaterial color="#24263c" />
            </TresMesh>
          </template>
          <TresMesh v-else-if="appearance.parts.mouth === 'line'" :scale="vec3(0.16, 0.018, 0.03)">
            <TresBoxGeometry :args="[1, 1, 1]" />
            <TresMeshStandardMaterial color="#24263c" />
          </TresMesh>
          <template v-else>
            <TresMesh :scale="vec3(0.15, 0.075, 0.04)">
              <TresSphereGeometry :args="[1, 28, 28]" />
              <TresMeshStandardMaterial color="#24263c" :roughness="0.2" />
            </TresMesh>
            <TresMesh :position="vec3(0, -0.025, 0.035)" :scale="vec3(0.075, 0.026, 0.015)">
              <TresSphereGeometry :args="[1, 20, 20]" />
              <TresMeshBasicMaterial color="#ff87ad" />
            </TresMesh>
          </template>
        </TresGroup>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
