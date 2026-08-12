<!--
  文件职责 / File responsibility
  在唯一 TresCanvas 中递归渲染参数化道具组件树，并应用资产材质与可选事件样式覆盖。
  Recursively renders a parametric prop component tree in the sole TresCanvas with asset materials and optional event-style overrides.
-->
<script setup lang="ts">
import type { MotionPropStyle, StudioPropComponent } from '@yk-pets/pet-core'
import { Euler, Vector3 } from 'three'

defineOptions({ name: 'StudioPropComponentNode' })
const props = defineProps<{
  component: StudioPropComponent
  components: readonly StudioPropComponent[]
  styleOverride?: MotionPropStyle
}>()
const children = computed(() => props.components.filter(item => item.parentId === props.component.id))
const material = computed(() => ({
  color: props.styleOverride?.color || props.component.material.color,
  opacity: props.styleOverride?.opacity ?? props.component.material.opacity,
  metalness: props.component.material.metalness,
  roughness: props.component.material.roughness,
  glowColor: props.styleOverride?.color || props.component.material.glowColor,
  glow: props.styleOverride?.glow ?? props.component.material.glow,
}))
function vector(value: readonly [number, number, number]): Vector3 { return new Vector3(...value) }
function rotation(value: readonly [number, number, number]): Euler { return new Euler(...value) }
function crystalScale(): Vector3 { return new Vector3(props.component.geometry.width, props.component.geometry.height, props.component.geometry.depth) }
function textFrontPosition(): Vector3 { return new Vector3(0, 0, Math.min(props.component.geometry.depth, .06) * .55) }
const particleOffsets = computed(() => Array.from({ length: Math.min(48, props.component.geometry.particleCount) }, (_, index) => {
  const angle = index * 2.399963229728653
  const radius = .035 * Math.sqrt(index + 1)
  return [Math.cos(angle) * radius, (index % 7) * .035, Math.sin(angle) * radius] as const
}))
</script>

<template>
  <TresGroup :visible="component.visible" :position="vector(component.transform.position)" :rotation="rotation(component.transform.rotation)" :scale="vector(component.transform.scale)">
    <TresMesh v-if="component.primitive === 'sphere'" cast-shadow>
      <TresSphereGeometry :args="[component.geometry.radius,component.geometry.segments,component.geometry.segments]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresMesh v-else-if="component.primitive === 'cylinder'" cast-shadow>
      <TresCylinderGeometry :args="[component.geometry.radius,component.geometry.radius,component.geometry.height,component.geometry.segments]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresMesh v-else-if="component.primitive === 'cone'" cast-shadow>
      <TresConeGeometry :args="[component.geometry.radius,component.geometry.height,component.geometry.segments]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresMesh v-else-if="component.primitive === 'torus'" cast-shadow>
      <TresTorusGeometry :args="[component.geometry.radius,component.geometry.tube,Math.max(6,Math.floor(component.geometry.segments/2)),component.geometry.segments]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresMesh v-else-if="component.primitive === 'capsule'" cast-shadow>
      <TresCapsuleGeometry :args="[component.geometry.radius,Math.max(.01,component.geometry.height-component.geometry.radius*2),Math.max(4,Math.floor(component.geometry.segments/4)),component.geometry.segments]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresMesh v-else-if="component.primitive === 'crystal'" cast-shadow :scale="crystalScale()">
      <TresOctahedronGeometry :args="[.5,0]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <TresGroup v-else-if="component.primitive === 'particles'">
      <TresMesh v-for="(offset,index) in particleOffsets" :key="index" :position="vector(offset)">
        <TresSphereGeometry :args="[Math.max(.008,component.geometry.radius*.16),8,8]" />
        <TresMeshBasicMaterial :color="material.color" transparent :opacity="material.opacity*.72" />
      </TresMesh>
      <TresPointLight :color="material.glowColor" :intensity="material.glow*.45" :distance="2" />
    </TresGroup>
    <TresGroup v-else-if="component.primitive === 'text'">
      <TresMesh cast-shadow><TresBoxGeometry :args="[component.geometry.width,component.geometry.height,Math.min(component.geometry.depth,.06)]" /><TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" /></TresMesh>
      <TresMesh :position="textFrontPosition()"><TresBoxGeometry :args="[component.geometry.width*.72,component.geometry.height*.18,.012]" /><TresMeshBasicMaterial :color="material.glowColor" transparent :opacity="Math.min(1,material.opacity*.8)" /></TresMesh>
    </TresGroup>
    <TresMesh v-else cast-shadow>
      <TresBoxGeometry :args="[component.geometry.width,component.geometry.height,component.geometry.depth]" />
      <TresMeshStandardMaterial :color="material.color" :emissive="material.glowColor" :emissive-intensity="material.glow" :metalness="material.metalness" :roughness="material.roughness" transparent :opacity="material.opacity" />
    </TresMesh>
    <StudioPropComponentNode v-for="child in children" :key="child.id" :component="child" :components="components" :style-override="styleOverride" />
  </TresGroup>
</template>
