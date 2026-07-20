<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import CustomizableCloudFox from './CustomizableCloudFox.vue'
import { calculatePetVisualBounds } from '~/domain/cloud-fox-appearance'
import type { PetStudioAppearanceRecipe, CloudFoxStudioBackground, CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase3'

const props = defineProps<{ appearance: PetStudioAppearanceRecipe; behavior: CloudFoxStudioBehavior; view: CloudFoxStudioView; background: CloudFoxStudioBackground }>()
const vec3 = (x: number, y: number, z: number) => new Vector3(x, y, z)
const clearColor = computed(() => ({ dark: '#080a12', light: '#eef1ff', web: '#172035' }[props.background]))
const petBounds = computed(() => calculatePetVisualBounds(props.appearance as never))
const cameraDistance = computed(() => Math.max(4.6, petBounds.value.radius / Math.sin(38 * Math.PI / 360) * 1.08))
const cameraPosition = computed(() => vec3(0, petBounds.value.centerY + .18, cameraDistance.value))
</script>

<template>
  <div :class="`studio-canvas studio-canvas--${background}`">
    <div v-if="background === 'web'" class="web-preview"><i /><i /><i /></div>
    <TresCanvas :clear-color="clearColor" :clear-alpha="background === 'web' ? .16 : 1" :dpr="[1, 1.55]" alpha antialias shadows>
      <TresPerspectiveCamera :position="cameraPosition" :fov="38" />
      <TresAmbientLight :intensity="background === 'light' ? 1.6 : 1.08" />
      <TresDirectionalLight :position="vec3(4, 6, 4)" :intensity="background === 'light' ? 2.8 : 3.9" cast-shadow />
      <TresPointLight :position="vec3(-4, 1, 2)" :intensity="4.2" :color="appearance.palette.primaryGlow" />
      <TresPointLight :position="vec3(3, -1, 1)" :intensity="2.4" :color="appearance.palette.halo" />
      <CustomizableCloudFox :appearance="appearance" :behavior="behavior" :view="view" />
    </TresCanvas>
    <div class="label"><strong>{{ appearance.identity.nameZh }} · {{ appearance.identity.nameEn }}</strong><span>schema v{{ appearance.schemaVersion }} · 自动镜头 {{ petBounds.width.toFixed(1) }} × {{ petBounds.height.toFixed(1) }}</span></div>
  </div>
</template>

<style scoped>
.studio-canvas{position:relative;min-height:620px;overflow:hidden;border:1px solid #ffffff1f;border-radius:28px;background:#080a12;box-shadow:0 28px 80px #0006}.studio-canvas--light{background:#eef1ff}.studio-canvas--web{background:linear-gradient(135deg,#111a2d,#293858)}.studio-canvas :deep(canvas){position:absolute!important;inset:0;z-index:2;width:100%!important;height:100%!important}.web-preview{position:absolute;inset:0;display:flex;gap:16px;align-items:center;padding:60px;opacity:.68;background:radial-gradient(circle at 78% 18%,#7066ff55,transparent 28%),linear-gradient(145deg,#17213a,#263956)}.web-preview i{width:29%;height:110px;border:1px solid #ffffff1a;border-radius:18px;background:#080c1870}.label{position:absolute;z-index:3;left:22px;bottom:20px;display:flex;flex-direction:column;gap:4px;padding:10px 14px;border:1px solid #ffffff24;border-radius:14px;color:#f5f7ff;background:#080b14a8;backdrop-filter:blur(16px)}.label span{color:#aeb7d8;font-size:12px}@media(max-width:980px){.studio-canvas{min-height:520px}}
</style>
