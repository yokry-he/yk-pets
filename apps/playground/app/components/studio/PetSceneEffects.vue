<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Euler, Vector3 } from 'three'
import type { Group } from 'three'
import { sceneActionMultiplier, type PetSceneRecipe } from '~/domain/pet-scene'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
const props = defineProps<{ scene: PetSceneRecipe; behavior: ExtensionCloudFoxMotionId }>()
const v3=(x:number,y:number,z:number)=>new Vector3(x,y,z), rot=(x:number,y:number,z:number)=>new Euler(x,y,z)
const particles=shallowRef<Group>(), halo=shallowRef<Group>()
const points=computed(()=>Array.from({length:props.scene.particles.count},(_,index)=>{const angle=index*2.399963;const radius=1.7+(index%9)*.21;return {index,x:Math.cos(angle)*radius,y:-1.1+(index%13)*.29,z:-1.8+((index*7)%17)*.23,scale:.7+(index%5)*.16}}))
useLoop().onBeforeRender(({elapsed,delta})=>{const multiplier=sceneActionMultiplier(props.scene,props.behavior as never);if(particles.value){particles.value.rotation.y+=delta*props.scene.particles.speed*.18*multiplier;particles.value.position.y=Math.sin(elapsed*.45)*.08}if(halo.value){const pulse=1+Math.sin(elapsed*1.6*multiplier)*.06;halo.value.scale.setScalar(pulse)}})
</script>
<template>
<TresGroup>
  <TresGroup v-if="scene.halo.enabled" ref="halo" :position="v3(0,.1,-.8)"><TresMesh :rotation="rot(0,0,0)" :scale="v3(scene.halo.scale*2.2,scene.halo.scale*2.2,.2)"><TresSphereGeometry :args="[1,32,32]"/><TresMeshBasicMaterial :color="scene.halo.color" transparent :opacity=".075*scene.halo.intensity" :blending="AdditiveBlending" :depth-write="false"/></TresMesh></TresGroup>
  <TresGroup v-if="scene.particles.enabled" ref="particles"><TresMesh v-for="point in points" :key="point.index" :position="v3(point.x,point.y,point.z)" :scale="v3(scene.particles.size*point.scale,scene.particles.size*point.scale,scene.particles.size*point.scale)"><TresSphereGeometry :args="[1,10,10]"/><TresMeshBasicMaterial :color="scene.particles.color" transparent :opacity=".62" :blending="AdditiveBlending" :depth-write="false"/></TresMesh></TresGroup>
  <TresMesh v-if="scene.groundShadow.enabled" :position="v3(0,-1.78,0)" :rotation="rot(-Math.PI/2,0,0)" :scale="v3(scene.groundShadow.scale,scene.groundShadow.scale,scene.groundShadow.scale)"><TresCircleGeometry :args="[1.15,64]"/><TresMeshBasicMaterial color="#000000" transparent :opacity="scene.groundShadow.opacity*(1-scene.groundShadow.softness*.35)" :depth-write="false"/></TresMesh>
</TresGroup>
</template>
