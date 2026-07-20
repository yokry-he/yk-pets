<!--
  文件职责 / File responsibility
  组合扩展经典云狐的身体、头部和尾巴渲染模块，并维持预览动作与视角。
  Composes the extension classic Cloud Fox body, head, and tail render modules while preserving preview motion and view controls.
-->
<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Vector3 } from 'three'
import type { Group } from 'three'
import ExtensionCloudFoxBody from './ExtensionCloudFoxBody.vue'
import ExtensionCloudFoxHead from './ExtensionCloudFoxHead.vue'
import ExtensionCloudFoxTail from './ExtensionCloudFoxTail.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import type { CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
const props=defineProps<{appearance:MultiSpeciesAppearanceRecipe;behavior:CloudFoxStudioBehavior;view:CloudFoxStudioView}>(),s=EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const v=(a:readonly number[])=>new Vector3(a[0]||0,a[1]||0,a[2]||0), presentation=shallowRef<Group>(),motion=shallowRef<Group>()
const viewY=computed(()=>({front:0,left:Math.PI/2,back:Math.PI,right:-Math.PI/2}[props.view]));let previous=props.behavior,started=0
useLoop().onBeforeRender(({elapsed,delta})=>{if(!presentation.value||!motion.value)return;presentation.value.rotation.y+=(viewY.value-presentation.value.rotation.y)*Math.min(1,delta*7);if(previous!==props.behavior){previous=props.behavior;started=elapsed}const t=elapsed-started,j=props.behavior==='jumping',st=props.behavior==='stretching',sp=props.behavior==='spinning',re=props.behavior==='resting',jump=j?Math.sin(Math.min(1,t/1.5)*Math.PI)*.92:0,target=(re?-.3:s.model.rootPosition[1])+jump+Math.sin(elapsed*2.1)*.04;motion.value.position.y+=(target-motion.value.position.y)*Math.min(1,delta*6);motion.value.rotation.x+=((re?.16:st?-.08:0)-motion.value.rotation.x)*Math.min(1,delta*5);if(sp)motion.value.rotation.y+=delta*5.6;else motion.value.rotation.y*=Math.max(0,1-delta*6)})
</script>
<template><TresGroup ref="presentation"><TresGroup ref="motion" :position="v(s.model.rootPosition)"><ExtensionCloudFoxTail :appearance="appearance" :behavior="behavior"/><ExtensionCloudFoxBody :appearance="appearance" :behavior="behavior"/><ExtensionCloudFoxHead :appearance="appearance" :behavior="behavior"/></TresGroup></TresGroup></template>
