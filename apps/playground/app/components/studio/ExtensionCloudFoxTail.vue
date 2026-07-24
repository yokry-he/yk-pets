<!--
  文件职责 / File responsibility
  从身体内部建立连续尾巴根部，以重叠管段和圆润关节消除截断端面，并复用正式 Chrome 扩展的分级摆尾与流光动作。
  Builds a continuous tail from inside the torso, removes cut faces with overlapping tubes and rounded joints, and reuses the production Chrome extension layered wag and glow motions.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, CatmullRomCurve3, Color, Euler, Quaternion, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME, type VisualCurve } from '~/domain/chrome-extension-cloud-fox-profile'
import { createExtensionCloudFoxMotionFrame, smoothStep } from '~/domain/chrome-extension-cloud-fox-motion-runtime'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const scaledCurve = (points: VisualCurve, factor: number) => new CatmullRomCurve3(
  points.map(point => vector([point[0] * factor, point[1] * factor, point[2] * factor])),
)
const damp = (current: number, target: number, speed: number, delta: number) => current + (target - current) * Math.min(1, 1 - Math.exp(-speed * delta))
const UP = new Vector3(0, 1, 0)
const TAU = Math.PI * 2
const TAIL_TORNADO_TURNS = 7
const alignY = (direction: Vector3) => direction.lengthSq() < .000001
  ? new Quaternion()
  : new Quaternion().setFromUnitVectors(UP, direction.clone().normalize())

const tail = shallowRef<Group>()
const midTail = shallowRef<Group>()
const tipTail = shallowRef<Group>()
const tailEnergy = shallowRef<Mesh>()
const tailAura = shallowRef<Mesh>()
const tipMaterial = shallowRef<MeshStandardMaterial>()
function setTipMaterial(reference: unknown) { tipMaterial.value = reference as MeshStandardMaterial }

const segments = computed(() => props.appearance.tailDesign.segments)
const baseSegment = computed(() => segments.value[0] || {
  length: .58, width: .27, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: .03, rotationY: .08, rotationZ: -.08,
})
const midSegment = computed(() => segments.value[1] || {
  length: .58, width: .22, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .1,
})
const tipSegment = computed(() => segments.value[2] || {
  length: .52, width: .16, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: .16,
})
const tailWidth = computed(() => props.appearance.proportions.tailWidth)
const baseLengthFactor = computed(() => props.appearance.proportions.tailLength * (baseSegment.value.length / .58))
const midLengthFactor = computed(() => props.appearance.proportions.tailLength * (midSegment.value.length / .58))
const tipLengthFactor = computed(() => props.appearance.proportions.tailLength * (tipSegment.value.length / .52))
const baseCurve = computed(() => scaledCurve(scheme.model.tail.baseCurve, baseLengthFactor.value))
const midCurve = computed(() => scaledCurve(scheme.model.tail.midCurve, midLengthFactor.value))
const tipCurve = computed(() => scaledCurve(scheme.model.tail.tipCurve, tipLengthFactor.value))
const rootRadius = computed(() => props.appearance.tailDesign.rootExtensionWidth * tailWidth.value)
const socketRadius = computed(() => Math.max(rootRadius.value * 1.18, baseSegment.value.width * tailWidth.value * .86))

const backAnchor = computed(() => {
  const bodyBack = scheme.model.body.scale[2] * props.appearance.proportions.bodyDepth
  return vector([
    props.appearance.tailDesign.rootOffsetX,
    scheme.model.tail.position[1] + props.appearance.tailDesign.rootOffsetY,
    -bodyBack + socketRadius.value * .38 + props.appearance.tailDesign.rootOffsetZ,
  ])
})
const rootExtensionEnd = computed(() => vector([0, 0, -props.appearance.tailDesign.rootExtensionLength]))
const lateralEnd = computed(() => vector([
  props.appearance.tailDesign.lateralOffset,
  0,
  -props.appearance.tailDesign.rootExtensionLength,
]))
const rootExtensionCurve = computed(() => {
  const length = props.appearance.tailDesign.rootExtensionLength
  return new CatmullRomCurve3([
    vector([0, 0, socketRadius.value * .34]),
    vector([0, 0, -length * .42]),
    vector([0, 0, -length]),
  ])
})
const lateralCurve = computed(() => {
  const length = props.appearance.tailDesign.rootExtensionLength
  const lateral = props.appearance.tailDesign.lateralOffset
  const overlap = Math.min(.06, length * .22)
  return new CatmullRomCurve3([
    vector([0, 0, -length + overlap]),
    vector([lateral * .46, 0, -length]),
    vector([lateral, 0, -length]),
  ])
})
const classicStart = computed(() => vector([
  props.appearance.tailDesign.lateralOffset + baseSegment.value.offsetX,
  baseSegment.value.offsetY,
  -props.appearance.tailDesign.rootExtensionLength + baseSegment.value.offsetZ,
]))
const baseEnd = computed(() => {
  const point = scheme.model.tail.baseCurve.at(-1) || [0, 0, 0]
  return vector([point[0] * baseLengthFactor.value, point[1] * baseLengthFactor.value, point[2] * baseLengthFactor.value])
})
const midPosition = computed(() => vector([
  scheme.model.tail.midPosition[0] * baseLengthFactor.value + midSegment.value.offsetX,
  scheme.model.tail.midPosition[1] * baseLengthFactor.value + midSegment.value.offsetY,
  scheme.model.tail.midPosition[2] * baseLengthFactor.value + midSegment.value.offsetZ,
]))
const midEnd = computed(() => {
  const point = scheme.model.tail.midCurve.at(-1) || [0, 0, 0]
  return vector([point[0] * midLengthFactor.value, point[1] * midLengthFactor.value, point[2] * midLengthFactor.value])
})
const tipPosition = computed(() => vector([
  scheme.model.tail.tipPosition[0] * midLengthFactor.value + tipSegment.value.offsetX,
  scheme.model.tail.tipPosition[1] * midLengthFactor.value + tipSegment.value.offsetY,
  scheme.model.tail.tipPosition[2] * midLengthFactor.value + tipSegment.value.offsetZ,
]))
const tipEnd = computed(() => {
  const point = scheme.model.tail.tipCurve.at(-1) || [0, 0, 0]
  return vector([point[0] * tipLengthFactor.value, point[1] * tipLengthFactor.value, point[2] * tipLengthFactor.value])
})

const directionRotation = computed(() => {
  const directions: Record<string, readonly [number, number, number]> = {
    left: [0, 0, 0],
    right: [0, Math.PI, 0],
    up: [0, 0, 1.05],
    down: [0, 0, -1.08],
    back: [0, -1.08, 0],
    forward: [0, 1.08, 0],
  }
  const direction = directions[props.appearance.tailDesign.direction] ?? ([0, 0, 0] as const)
  return rotation([
    direction[0] + baseSegment.value.rotationX,
    direction[1] + baseSegment.value.rotationY,
    direction[2] + baseSegment.value.rotationZ,
  ])
})
const midRotation = computed(() => rotation([midSegment.value.rotationX, midSegment.value.rotationY, midSegment.value.rotationZ]))
const tipRotation = computed(() => rotation([tipSegment.value.rotationX, tipSegment.value.rotationY, tipSegment.value.rotationZ]))
const tipGlow = computed(() => props.appearance.tailDesign.tipGlow)
const tipColor = computed(() => tipGlow.value.enabled ? tipGlow.value.color : props.appearance.palette.coatWarm)

const extraSegmentTransforms = computed(() => {
  const source = segments.value.slice(3)
  const cursor = tipEnd.value.clone()
  let rotationX = 0
  let rotationY = 0
  let rotationZ = 0
  return source.map((segment, index) => {
    const previousEnd = cursor.clone()
    const start = previousEnd.clone().add(vector([segment.offsetX, segment.offsetY, segment.offsetZ]))
    const connectorDirection = start.clone().sub(previousEnd)
    rotationX += segment.rotationX
    rotationY += segment.rotationY
    rotationZ += segment.rotationZ
    const direction = vector([0, segment.length * props.appearance.proportions.tailLength, 0])
      .applyEuler(rotation([rotationX, rotationY, rotationZ]))
    const end = start.clone().add(direction)
    cursor.copy(end)
    return {
      index: index + 3,
      start,
      end,
      center: start.clone().addScaledVector(direction, .5),
      quaternion: alignY(direction),
      length: direction.length(),
      width: segment.width * tailWidth.value,
      connectorCenter: previousEnd.clone().addScaledVector(connectorDirection, .5),
      connectorLength: connectorDirection.length(),
      connectorQuaternion: alignY(connectorDirection),
      connectorWidth: Math.max(.055, Math.min(segment.width * tailWidth.value, (index === 0 ? tipSegment.value.width : source[index - 1]?.width || segment.width) * tailWidth.value) * .82),
    }
  })
})

let previousBehavior: ExtensionCloudFoxMotionId = props.behavior
let previousMotionKey = props.motionKey
let startedAt = 0
const flashColor = new Color()

useLoop().onBeforeRender(({ elapsed, delta }) => {
  if (previousBehavior !== props.behavior || previousMotionKey !== props.motionKey) {
    if (previousBehavior === 'tail-tornado' && tail.value) {
      tail.value.rotation.z -= Math.round((tail.value.rotation.z - directionRotation.value.z) / TAU) * TAU
    }
    previousBehavior = props.behavior
    previousMotionKey = props.motionKey
    startedAt = elapsed
  }
  const stateElapsed = Math.max(0, elapsed - startedAt)
  const frame = createExtensionCloudFoxMotionFrame(props.behavior, stateElapsed)
  const state = props.behavior

  const happy = state === 'happy' || state === 'talking'
  const energetic = ['greeting', 'jumping', 'playing', 'flapping', 'playing-ball', 'star-juggle', 'excited'].includes(state)
  const resting = state === 'resting' || state === 'sleeping' || state === 'cloud-nap'
  const tornado = state === 'tail-tornado'
  const amplitude = happy
    ? .18
    : tornado
      ? .06
      : state === 'tail-glow'
        ? .2 + frame.tailGlowWave * .14
        : frame.highEnergy
          ? state === 'fireworks-show' ? .18 : .32
          : energetic
            ? .26
            : state === 'stretching'
              ? .13
              : state === 'eating'
                ? .04
                : resting
                  ? .02
                  : .075
  const speed = happy
    ? 6.8
    : tornado
      ? 12
      : state === 'tail-glow'
        ? 5.4
        : frame.highEnergy
          ? state === 'fireworks-show' ? 4.6 : 9.4
          : energetic
            ? 8.4
            : state === 'stretching'
              ? 2.1
              : state === 'eating'
                ? 1.7
                : resting
                  ? .95
                  : 2.35
  const rootWave = Math.sin(elapsed * speed)
  const midWave = Math.sin(elapsed * speed - .62)
  const tipWave = Math.sin(elapsed * speed - 1.18)
  const restFold = resting ? -.1 : 0
  const stretchTailLift = state === 'stretching' ? frame.stretchStrength : 0
  const tailWindmillAngle = tornado
    ? smoothStep(.04, .96, frame.tornadoProgress) * TAU * TAIL_TORNADO_TURNS
    : 0

  if (tail.value) {
    const target = directionRotation.value
    tail.value.rotation.x = damp(tail.value.rotation.x, target.x + Math.cos(elapsed * speed * .45) * .018 - stretchTailLift * .06, 6, delta)
    tail.value.rotation.y = damp(tail.value.rotation.y, target.y + Math.sin(elapsed * speed * .32) * amplitude * .08, 6, delta)
    if (tornado) tail.value.rotation.z = target.z + tailWindmillAngle
    else tail.value.rotation.z = damp(tail.value.rotation.z, target.z + rootWave * amplitude * .24 + restFold * .45 - stretchTailLift * .05, 7, delta)
  }
  if (midTail.value) {
    const tornadoLag = tornado ? Math.sin(tailWindmillAngle - .62) * .16 * frame.tornadoStrength : 0
    midTail.value.rotation.x = damp(midTail.value.rotation.x, midRotation.value.x + tornadoLag * .32, 7, delta)
    midTail.value.rotation.y = damp(midTail.value.rotation.y, midRotation.value.y + Math.cos(elapsed * speed - .45) * amplitude * .1 + tornadoLag * .24, 7, delta)
    midTail.value.rotation.z = damp(midTail.value.rotation.z, midRotation.value.z + midWave * amplitude * .62 + restFold * .42 + stretchTailLift * .14 + tornadoLag, 8, delta)
  }
  if (tipTail.value) {
    const tornadoLag = tornado ? Math.sin(tailWindmillAngle - 1.18) * .28 * frame.tornadoStrength : 0
    tipTail.value.rotation.x = damp(tipTail.value.rotation.x, tipRotation.value.x + tornadoLag * .3, 8, delta)
    tipTail.value.rotation.y = damp(tipTail.value.rotation.y, tipRotation.value.y + Math.cos(elapsed * speed - .8) * amplitude * .18 + stretchTailLift * .04 + tornadoLag * .22, 8, delta)
    tipTail.value.rotation.z = damp(tipTail.value.rotation.z, tipRotation.value.z + tipWave * amplitude * 1.02 + restFold * .28 + stretchTailLift * .22 + tornadoLag, 9, delta)
  }

  const glowBoost = state === 'tail-glow'
    ? .22 + frame.tailGlowPose * .32 + frame.tailGlowWave * .22
    : state === 'antenna-charge'
      ? frame.antennaChargePose * .14 + frame.antennaRelease * .1
      : state === 'energy-burst'
        ? frame.energyCharge * .32 + frame.energyRelease * .18
        : frame.highEnergy
          ? .18
          : state === 'excited'
            ? .12
            : 0
  const glowPulse = 1 + Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.5) * .12 + glowBoost
  const flashTail = ['tail-glow', 'tail-tornado', 'energy-burst', 'star-juggle', 'fireworks-show'].includes(state)
  if (tipMaterial.value) {
    if (flashTail) {
      flashColor.setHSL((elapsed * .72 + .08) % 1, .94, .72)
      tipMaterial.value.color.copy(flashColor)
      tipMaterial.value.emissive.copy(flashColor)
    }
    else {
      tipMaterial.value.color.set(tipColor.value)
      tipMaterial.value.emissive.set(tipGlow.value.enabled ? tipGlow.value.color : '#000000')
    }
    tipMaterial.value.emissiveIntensity = tipGlow.value.enabled ? tipGlow.value.intensity * glowPulse + (flashTail ? 1.4 : 0) : 0
  }
  if (tailEnergy.value) {
    tailEnergy.value.scale.setScalar(1 + glowBoost + Math.sin(elapsed * 5) * .06)
    const material = tailEnergy.value.material as MeshBasicMaterial
    if (flashTail) material.color.copy(flashColor)
    else material.color.set(tipGlow.value.color)
  }
  if (tailAura.value) {
    tailAura.value.scale.setScalar(tipGlow.value.auraScale * (1 + glowBoost * .42))
    const material = tailAura.value.material as MeshBasicMaterial
    material.opacity = .28 + glowBoost * .22
  }
})
</script>

<template>
  <TresGroup ref="tail" :position="backAnchor" :rotation="directionRotation">
    <TresMesh :position="vector([0, 0, socketRadius * .08])" :scale="vector([socketRadius * 1.18, socketRadius * 1.08, socketRadius * 1.26])" cast-shadow>
      <TresSphereGeometry :args="[1, 28, 28]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".34" :metalness=".02" />
    </TresMesh>
    <TresMesh cast-shadow>
      <TresTubeGeometry :args="[rootExtensionCurve, 22, rootRadius, 20, false]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".32" :metalness=".02" />
    </TresMesh>
    <TresMesh :position="rootExtensionEnd" :scale="vector([rootRadius * 1.12, rootRadius * 1.12, rootRadius * 1.12])" cast-shadow>
      <TresSphereGeometry :args="[1, 24, 24]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".31" />
    </TresMesh>
    <TresMesh cast-shadow>
      <TresTubeGeometry :args="[lateralCurve, 24, rootRadius * .96, 20, false]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3" :metalness=".02" />
    </TresMesh>
    <TresMesh :position="lateralEnd" :scale="vector([Math.max(rootRadius, baseSegment.width * tailWidth) * 1.08, Math.max(rootRadius, baseSegment.width * tailWidth) * 1.08, Math.max(rootRadius, baseSegment.width * tailWidth) * 1.08])" cast-shadow>
      <TresSphereGeometry :args="[1, 26, 26]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3" />
    </TresMesh>

    <TresGroup :position="classicStart">
      <TresMesh :scale="vector([baseSegment.width * tailWidth * 1.08, baseSegment.width * tailWidth * 1.08, baseSegment.width * tailWidth * 1.08])" cast-shadow>
        <TresSphereGeometry :args="[1, 26, 26]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3" />
      </TresMesh>
      <TresMesh cast-shadow>
        <TresTubeGeometry :args="[baseCurve, 30, baseSegment.width * tailWidth, 20, false]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".32" :metalness=".02" />
      </TresMesh>
      <TresMesh :position="baseEnd" :scale="vector([Math.max(baseSegment.width, midSegment.width) * tailWidth * 1.08, Math.max(baseSegment.width, midSegment.width) * tailWidth * 1.08, Math.max(baseSegment.width, midSegment.width) * tailWidth * 1.08])" cast-shadow>
        <TresSphereGeometry :args="[1, 26, 26]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3" />
      </TresMesh>

      <TresGroup ref="midTail" :position="midPosition" :rotation="midRotation">
        <TresMesh :scale="vector([midSegment.width * tailWidth * 1.08, midSegment.width * tailWidth * 1.08, midSegment.width * tailWidth * 1.08])" cast-shadow>
          <TresSphereGeometry :args="[1, 26, 26]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".28" />
        </TresMesh>
        <TresMesh cast-shadow>
          <TresTubeGeometry :args="[midCurve, 28, midSegment.width * tailWidth, 20, false]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".27" :metalness=".02" />
        </TresMesh>
        <TresMesh :position="midEnd" :scale="vector([Math.max(midSegment.width, tipSegment.width) * tailWidth * 1.08, Math.max(midSegment.width, tipSegment.width) * tailWidth * 1.08, Math.max(midSegment.width, tipSegment.width) * tailWidth * 1.08])" cast-shadow>
          <TresSphereGeometry :args="[1, 26, 26]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".26" />
        </TresMesh>

        <TresGroup ref="tipTail" :position="tipPosition" :rotation="tipRotation">
          <TresMesh :scale="vector([tipSegment.width * tailWidth * 1.1, tipSegment.width * tailWidth * 1.1, tipSegment.width * tailWidth * 1.1])" cast-shadow>
            <TresSphereGeometry :args="[1, 26, 26]" />
            <TresMeshStandardMaterial :color="tipColor" :emissive="tipGlow.enabled ? tipGlow.color : '#000000'" :emissive-intensity="tipGlow.enabled ? tipGlow.intensity * .25 : 0" :roughness=".2" />
          </TresMesh>
          <TresMesh cast-shadow>
            <TresTubeGeometry :args="[tipCurve, 26, tipSegment.width * tailWidth, 20, false]" />
            <TresMeshStandardMaterial :ref="setTipMaterial" :color="tipColor" :emissive="tipGlow.enabled ? tipGlow.color : '#000000'" :emissive-intensity="tipGlow.enabled ? tipGlow.intensity : 0" :roughness=".14" :metalness=".04" />
          </TresMesh>
          <TresMesh :position="tipEnd" :scale="vector([tipSegment.width * tailWidth * 1.08, tipSegment.width * tailWidth * 1.08, tipSegment.width * tailWidth * 1.08])" cast-shadow>
            <TresSphereGeometry :args="[1, 26, 26]" />
            <TresMeshStandardMaterial :color="tipColor" :emissive="tipGlow.enabled ? tipGlow.color : '#000000'" :emissive-intensity="tipGlow.enabled ? tipGlow.intensity * .55 : 0" :roughness=".16" />
          </TresMesh>

          <template v-for="segment in extraSegmentTransforms" :key="`extra-tail-${segment.index}`">
            <TresMesh v-if="segment.connectorLength > .002" :position="segment.connectorCenter" :quaternion="segment.connectorQuaternion" cast-shadow>
              <TresCylinderGeometry :args="[segment.connectorWidth, segment.connectorWidth, segment.connectorLength + segment.connectorWidth * .9, 20]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".25" />
            </TresMesh>
            <TresMesh :position="segment.start" :scale="vector([segment.width * 1.08, segment.width * 1.08, segment.width * 1.08])" cast-shadow>
              <TresSphereGeometry :args="[1, 22, 22]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".24" />
            </TresMesh>
            <TresMesh :position="segment.center" :quaternion="segment.quaternion" cast-shadow>
              <TresCylinderGeometry :args="[segment.width * .82, segment.width, segment.length + segment.width * .9, 20]" />
              <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".24" />
            </TresMesh>
            <TresMesh :position="segment.end" :scale="vector([segment.width * 1.08, segment.width * 1.08, segment.width * 1.08])" cast-shadow>
              <TresSphereGeometry :args="[1, 22, 22]" />
              <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".22" />
            </TresMesh>
          </template>

          <TresMesh v-if="tipGlow.enabled" ref="tailEnergy" :position="vector([scheme.model.tail.energyPosition[0] * tipLengthFactor, scheme.model.tail.energyPosition[1] * tipLengthFactor, scheme.model.tail.energyPosition[2] * tipLengthFactor])">
            <TresSphereGeometry :args="[scheme.model.tail.energyRadius * tipSegment.width * tailWidth / .16, 28, 28]" />
            <TresMeshBasicMaterial :color="tipGlow.color" :tone-mapped="false" />
          </TresMesh>
          <TresMesh v-if="tipGlow.enabled" ref="tailAura" :position="vector([scheme.model.tail.auraPosition[0] * tipLengthFactor, scheme.model.tail.auraPosition[1] * tipLengthFactor, scheme.model.tail.auraPosition[2] * tipLengthFactor])" :scale="vector([tipGlow.auraScale, tipGlow.auraScale, tipGlow.auraScale])">
            <TresSphereGeometry :args="[scheme.model.tail.auraRadius * tipSegment.width * tailWidth / .16, 24, 24]" />
            <TresMeshBasicMaterial :color="tipGlow.color" transparent :opacity=".34" :blending="AdditiveBlending" :depth-write="false" />
          </TresMesh>
        </TresGroup>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
