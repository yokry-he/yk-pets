<!--
  文件职责 / File responsibility
  在唯一正式场景中用轻量语义标记显示洋葱皮和运动轨迹，不复制云狐拓扑或创建第二个画布。
  Displays onion skins and motion paths as lightweight semantic guides in the sole production scene without copying Cloud Fox topology or creating another canvas.
-->
<script setup lang="ts">
import type { EvaluatedCloudFoxPose } from '@yk-pets/pet-core'
import { Vector3 } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
const props=defineProps<{appearance:MultiSpeciesAppearanceRecipe;onionPoses?:readonly EvaluatedCloudFoxPose[];motionPathPoints?:readonly (readonly [number,number,number])[]}>()
function vector(value:readonly [number,number,number]):Vector3{return new Vector3(...value)}
function markers(pose:EvaluatedCloudFoxPose){const w=props.appearance.proportions.bodyWidth;const h=props.appearance.proportions.bodyHeight;return[
  new Vector3(pose.values['root.position.x'],pose.values['root.position.y'],pose.values['root.position.z']),
  new Vector3(pose.values['root.position.x']+pose.values['head.position.x'],pose.values['root.position.y']+1.05*h+pose.values['head.position.y'],pose.values['root.position.z']+pose.values['head.position.z']),
  new Vector3(-.62*w+pose.values['frontPaw.left.rotation.z']*.18,-.05+pose.values['root.position.y'],.25),
  new Vector3(.62*w-pose.values['frontPaw.right.rotation.z']*.18,-.05+pose.values['root.position.y'],.25),
]}
</script>
<template>
  <TresGroup>
    <TresGroup v-for="(pose,poseIndex) in onionPoses || []" :key="`${pose.resolvedTimeMs}-${poseIndex}`">
      <TresMesh v-for="(point,index) in markers(pose)" :key="index" :position="point"><TresSphereGeometry :args="[index === 0 ? .07 : .045, 10, 10]"/><TresMeshBasicMaterial :color="poseIndex===0?'#52e0d0':'#ff6f9d'" transparent :opacity=".24" :depth-write="false"/></TresMesh>
    </TresGroup>
    <TresMesh v-for="(point,index) in motionPathPoints || []" :key="`path-${index}`" :position="vector(point)"><TresSphereGeometry :args="[.025,8,8]"/><TresMeshBasicMaterial color="#ffd166" transparent :opacity=".6" :depth-write="false"/></TresMesh>
  </TresGroup>
</template>
