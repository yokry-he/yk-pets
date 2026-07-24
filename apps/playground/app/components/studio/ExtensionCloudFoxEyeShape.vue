<!--
  文件职责 / File responsibility
  渲染单只眼睛的明确几何差异；眨眼、追视和动作缩放由外层 EyeRoot 统一驱动。
  Renders one eye with explicit geometric differences while the outer EyeRoot owns blinking, gaze, and motion scaling.
-->
<script setup lang="ts">
import { CatmullRomCurve3, Vector3 } from 'three'

const props = defineProps<{
  style: string
  color: string
  highlightColor: string
  side: number
  eyeScale: number
}>()
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const sleepyCurve = new CatmullRomCurve3([
  vector([-.14, -.01, 0]),
  vector([-.07, .045, .012]),
  vector([0, .06, .016]),
  vector([.07, .045, .012]),
  vector([.14, -.01, 0]),
])
</script>

<template>
  <TresGroup :scale="vector([eyeScale, eyeScale, eyeScale])">
    <template v-if="style === 'spark'">
      <TresMesh :scale="vector([.035, .18, .045])"><TresBoxGeometry /><TresMeshBasicMaterial :color="highlightColor" :tone-mapped="false" /></TresMesh>
      <TresMesh :scale="vector([.14, .035, .045])"><TresBoxGeometry /><TresMeshBasicMaterial :color="highlightColor" :tone-mapped="false" /></TresMesh>
      <TresMesh :rotation-z="Math.PI / 4" :scale="vector([.026, .1, .04])"><TresBoxGeometry /><TresMeshBasicMaterial :color="color" /></TresMesh>
      <TresMesh :rotation-z="-Math.PI / 4" :scale="vector([.026, .1, .04])"><TresBoxGeometry /><TresMeshBasicMaterial :color="color" /></TresMesh>
    </template>

    <template v-else-if="style === 'diamond'">
      <TresMesh :scale="vector([.13, .2, .09])">
        <TresOctahedronGeometry :args="[1, 0]" />
        <TresMeshStandardMaterial :color="color" :emissive="highlightColor" :emissive-intensity=".16" :roughness=".06" :metalness=".12" flat-shading />
      </TresMesh>
      <TresMesh :position="vector([side * -.025, .055, .075])" :scale="vector([.024, .05, .018])"><TresSphereGeometry /><TresMeshBasicMaterial :color="highlightColor" /></TresMesh>
    </template>

    <TresMesh v-else-if="style === 'sleepy'">
      <TresTubeGeometry :args="[sleepyCurve, 24, .02, 8, false]" />
      <TresMeshBasicMaterial :color="color" />
    </TresMesh>

    <template v-else>
      <TresMesh :scale="style === 'oval' ? vector([.12, .21, .085]) : vector([.16, .12, .09])">
        <TresSphereGeometry :args="[1, 32, 24]" />
        <TresMeshStandardMaterial :color="color" :roughness=".08" />
      </TresMesh>
      <TresMesh :position="vector([side * -.035, .035, .078])" :scale="vector([.035, .045, .018])">
        <TresSphereGeometry />
        <TresMeshBasicMaterial :color="highlightColor" :tone-mapped="false" />
      </TresMesh>
    </template>
  </TresGroup>
</template>
