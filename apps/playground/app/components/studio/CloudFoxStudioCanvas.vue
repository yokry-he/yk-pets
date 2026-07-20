<!--
  文件职责 / File responsibility
  装配通用宠物预览、自动相机、灯光和独立场景特效。
  Assembles the generic pet preview, automatic camera, lighting, and independent scene effects.
-->
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import ProceduralPet from './ProceduralPet.vue'
import PetSceneEffects from './PetSceneEffects.vue'
import { calculatePetVisualBounds } from '~/domain/cloud-fox-appearance'
import { createDefaultPetScene, getPetScenePreset, resolveSceneContrast, type PetSceneRecipe } from '~/domain/pet-scene'
import type { CloudFoxStudioBackground, CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe; behavior: CloudFoxStudioBehavior; view: CloudFoxStudioView; background: CloudFoxStudioBackground; scene?: PetSceneRecipe }>()
const vec3=(x:number,y:number,z:number)=>new Vector3(x,y,z)
const legacyScene=computed(()=>props.background==='light'?{...createDefaultPetScene(),background:'#eef1ff',backgroundSecondary:'#ffffff',contrastMode:'light' as const}:props.background==='web'?getPetScenePreset('neon-hangar'):getPetScenePreset('deep-nebula'))
const activeScene=computed(()=>props.scene||legacyScene.value)
const prefersDark=ref(true)
onMounted(()=>{prefersDark.value=window.matchMedia('(prefers-color-scheme: dark)').matches})
const contrast=computed(()=>resolveSceneContrast(activeScene.value,prefersDark.value))
const clearColor=computed(()=>activeScene.value.transparent?'#000000':activeScene.value.background)
// 相机仅使用宠物包围盒进行适配，场景特效明确排除。 / Only pet bounds are used for camera fitting; scene effects are explicitly excluded.
const petBounds=computed(()=>calculatePetVisualBounds(props.appearance as never))
const cameraDistance=computed(()=>Math.max(4.6,petBounds.value.radius/Math.sin(38*Math.PI/360)*1.08))
const cameraPosition=computed(()=>vec3(0,petBounds.value.centerY+.18,cameraDistance.value))
</script>
<template>
<div :class="['studio-canvas',`studio-canvas--${contrast}`]" :style="{'--scene-a':activeScene.background,'--scene-b':activeScene.backgroundSecondary}">
  <div v-if="!activeScene.transparent" class="scene-gradient"/>
  <TresCanvas :clear-color="clearColor" :clear-alpha="activeScene.transparent?0:1" :dpr="[1,1.55]" alpha antialias shadows>
    <TresPerspectiveCamera :position="cameraPosition" :fov="38"/><TresAmbientLight :intensity="contrast==='light'?1.7:1.08"/><TresDirectionalLight :position="vec3(4,6,4)" :intensity="contrast==='light'?2.7:3.9" cast-shadow/><TresPointLight :position="vec3(-4,1,2)" :intensity="4.2" :color="appearance.palette.primaryGlow"/>
    <PetSceneEffects :scene="activeScene" :behavior="behavior"/><ProceduralPet :appearance="appearance" :behavior="behavior" :view="view"/>
  </TresCanvas>
  <div class="label"><strong>{{appearance.identity.nameZh}} · {{appearance.identity.nameEn}}</strong><span>{{activeScene.presetId}} · 宠物包围盒 {{petBounds.width.toFixed(1)}} × {{petBounds.height.toFixed(1)}}</span></div>
</div>
</template>
<style scoped>
.studio-canvas{position:relative;min-height:620px;overflow:hidden;border:1px solid #ffffff1f;border-radius:28px;background:transparent;box-shadow:0 28px 80px #0006}.scene-gradient{position:absolute;inset:0;background:radial-gradient(circle at 70% 15%,color-mix(in srgb,var(--scene-b) 76%,transparent),transparent 38%),linear-gradient(145deg,var(--scene-a),var(--scene-b));}.studio-canvas :deep(canvas){position:absolute!important;inset:0;z-index:2;width:100%!important;height:100%!important}.label{position:absolute;z-index:3;left:22px;bottom:20px;display:flex;flex-direction:column;gap:4px;padding:10px 14px;border:1px solid #ffffff24;border-radius:14px;color:#f5f7ff;background:#080b14a8;backdrop-filter:blur(16px)}.studio-canvas--light .label{color:#17192b;background:#ffffffe0}.label span{color:#aeb7d8;font-size:12px}@media(max-width:980px){.studio-canvas{min-height:520px}}
</style>
