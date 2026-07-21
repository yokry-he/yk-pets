<!--
  文件职责 / File responsibility
  从身体背面中心建立尾巴根段，再应用整体侧偏、逐段偏移和独立尾尖发光配置。
  Builds the tail from the center back anchor, then applies lateral and per-segment offsets plus independent tip glow settings.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, CatmullRomCurve3, Euler, Vector3 } from 'three'
import type { Group, MeshStandardMaterial } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME, type VisualCurve } from '~/domain/chrome-extension-cloud-fox-profile'
import type { CloudFoxStudioBehavior } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: CloudFoxStudioBehavior
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const rotation = (values: readonly number[]) => new Euler(values[0] || 0, values[1] || 0, values[2] || 0)
const scaledCurve = (points: VisualCurve, factor: number) => new CatmullRomCurve3(
  points.map(point => vector([point[0] * factor, point[1] * factor, point[2] * factor])),
)

const tail = shallowRef<Group>()
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

const backAnchor = computed(() => vector([
  props.appearance.tailDesign.rootOffsetX,
  scheme.model.tail.position[1] + props.appearance.tailDesign.rootOffsetY,
  -scheme.model.body.scale[2] + .08 + props.appearance.tailDesign.rootOffsetZ,
]))
const rootExtensionCurve = computed(() => {
  const length = props.appearance.tailDesign.rootExtensionLength
  return new CatmullRomCurve3([
    vector([0, 0, 0]),
    vector([0, 0, -length * .5]),
    vector([0, 0, -length]),
  ])
})
const lateralCurve = computed(() => {
  const length = props.appearance.tailDesign.rootExtensionLength
  const lateral = props.appearance.tailDesign.lateralOffset
  return new CatmullRomCurve3([
    vector([0, 0, -length]),
    vector([lateral * .48, 0, -length]),
    vector([lateral, 0, -length]),
  ])
})
const classicStart = computed(() => vector([
  props.appearance.tailDesign.lateralOffset + baseSegment.value.offsetX,
  baseSegment.value.offsetY,
  -props.appearance.tailDesign.rootExtensionLength + baseSegment.value.offsetZ,
]))
const midPosition = computed(() => vector([
  scheme.model.tail.midPosition[0] * baseLengthFactor.value + midSegment.value.offsetX,
  scheme.model.tail.midPosition[1] * baseLengthFactor.value + midSegment.value.offsetY,
  scheme.model.tail.midPosition[2] * baseLengthFactor.value + midSegment.value.offsetZ,
]))
const tipPosition = computed(() => vector([
  scheme.model.tail.tipPosition[0] * midLengthFactor.value + tipSegment.value.offsetX,
  scheme.model.tail.tipPosition[1] * midLengthFactor.value + tipSegment.value.offsetY,
  scheme.model.tail.tipPosition[2] * midLengthFactor.value + tipSegment.value.offsetZ,
]))

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
  const end = scheme.model.tail.tipCurve.at(-1) || [0, 0, 0]
  const cursor = vector([end[0] * tipLengthFactor.value, end[1] * tipLengthFactor.value, end[2] * tipLengthFactor.value])
  let rotationX = 0
  let rotationY = 0
  let rotationZ = 0
  return source.map((segment, index) => {
    rotationX += segment.rotationX
    rotationY += segment.rotationY
    rotationZ += segment.rotationZ
    cursor.add(vector([segment.offsetX, segment.offsetY, segment.offsetZ]))
    const direction = vector([0, segment.length * props.appearance.proportions.tailLength, 0])
      .applyEuler(rotation([rotationX, rotationY, rotationZ]))
    const center = cursor.clone().addScaledVector(direction, .5)
    cursor.add(direction)
    return {
      index: index + 3,
      center,
      end: cursor.clone(),
      rotation: rotation([rotationX, rotationY, rotationZ]),
      length: segment.length * props.appearance.proportions.tailLength,
      width: segment.width * tailWidth.value,
    }
  })
})

useLoop().onBeforeRender(({ elapsed }) => {
  if (tail.value) {
    const spinning = props.behavior === 'spinning'
    const energetic = props.behavior === 'greeting' || props.behavior === 'jumping'
    const resting = props.behavior === 'resting'
    const amplitude = spinning ? .24 : energetic ? .18 : resting ? .025 : .075
    const speed = spinning ? 8.4 : energetic ? 6.8 : resting ? 1.2 : 2.5
    const target = directionRotation.value
    tail.value.rotation.set(
      target.x + Math.cos(elapsed * speed * .5) * amplitude * .18,
      target.y,
      target.z + Math.sin(elapsed * speed) * amplitude,
    )
  }
  if (tipMaterial.value) {
    const pulse = 1 + Math.sin(elapsed * props.appearance.glow.pulseSpeed * 3.5) * .12
    tipMaterial.value.emissiveIntensity = tipGlow.value.enabled ? tipGlow.value.intensity * pulse : 0
  }
})
</script>

<template>
  <TresGroup ref="tail" :position="backAnchor" :rotation="directionRotation">
    <TresMesh cast-shadow>
      <TresTubeGeometry :args="[rootExtensionCurve, 14, appearance.tailDesign.rootExtensionWidth * tailWidth, 14, false]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".32" :metalness=".02" />
    </TresMesh>
    <TresMesh cast-shadow>
      <TresTubeGeometry :args="[lateralCurve, 18, appearance.tailDesign.rootExtensionWidth * .92 * tailWidth, 14, false]" />
      <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".3" :metalness=".02" />
    </TresMesh>

    <TresGroup :position="classicStart">
      <TresMesh cast-shadow>
        <TresTubeGeometry :args="[baseCurve, 24, baseSegment.width * tailWidth, 14, false]" />
        <TresMeshStandardMaterial :color="appearance.palette.coatShadow" :roughness=".32" :metalness=".02" />
      </TresMesh>

      <TresGroup :position="midPosition" :rotation="midRotation">
        <TresMesh cast-shadow>
          <TresTubeGeometry :args="[midCurve, 22, midSegment.width * tailWidth, 14, false]" />
          <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".27" :metalness=".02" />
        </TresMesh>

        <TresGroup :position="tipPosition" :rotation="tipRotation">
          <TresMesh cast-shadow>
            <TresTubeGeometry :args="[tipCurve, 20, tipSegment.width * tailWidth, 14, false]" />
            <TresMeshStandardMaterial
              :ref="setTipMaterial"
              :color="tipColor"
              :emissive="tipGlow.enabled ? tipGlow.color : '#000000'"
              :emissive-intensity="tipGlow.enabled ? tipGlow.intensity : 0"
              :roughness=".14"
              :metalness=".04"
            />
          </TresMesh>

          <TresMesh
            v-for="segment in extraSegmentTransforms"
            :key="`extra-tail-${segment.index}`"
            :position="segment.center"
            :rotation="segment.rotation"
            cast-shadow
          >
            <TresCylinderGeometry :args="[segment.width * .78, segment.width, segment.length, 18]" />
            <TresMeshStandardMaterial :color="appearance.palette.coat" :roughness=".24" />
          </TresMesh>
          <TresMesh
            v-for="segment in extraSegmentTransforms"
            :key="`extra-joint-${segment.index}`"
            :position="segment.end"
            :scale="vector([segment.width, segment.width, segment.width])"
          >
            <TresSphereGeometry :args="[1, 18, 18]" />
            <TresMeshStandardMaterial :color="appearance.palette.coatWarm" :roughness=".22" />
          </TresMesh>

          <TresMesh v-if="tipGlow.enabled" :position="vector([
            scheme.model.tail.energyPosition[0] * tipLengthFactor,
            scheme.model.tail.energyPosition[1] * tipLengthFactor,
            scheme.model.tail.energyPosition[2] * tipLengthFactor,
          ])">
            <TresSphereGeometry :args="[scheme.model.tail.energyRadius * tipSegment.width * tailWidth / .16, 28, 28]" />
            <TresMeshBasicMaterial :color="tipGlow.color" :tone-mapped="false" />
          </TresMesh>
          <TresMesh
            v-if="tipGlow.enabled"
            :position="vector([
              scheme.model.tail.auraPosition[0] * tipLengthFactor,
              scheme.model.tail.auraPosition[1] * tipLengthFactor,
              scheme.model.tail.auraPosition[2] * tipLengthFactor,
            ])"
            :scale="vector([tipGlow.auraScale, tipGlow.auraScale, tipGlow.auraScale])"
          >
            <TresSphereGeometry :args="[scheme.model.tail.auraRadius * tipSegment.width * tailWidth / .16, 24, 24]" />
            <TresMeshBasicMaterial
              :color="tipGlow.color"
              transparent
              :opacity=".34"
              :blending="AdditiveBlending"
              :depth-write="false"
            />
          </TresMesh>
        </TresGroup>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
