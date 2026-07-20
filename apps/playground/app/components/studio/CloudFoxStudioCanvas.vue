
<!--
  文件职责 / File responsibility
  装配云狐工坊的实时 3D 预览、相机、灯光、背景模式与受限视角切换。
  Assembles Cloud Fox Studio live 3D preview, camera, lighting, background modes, and constrained view switching.
-->
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import CustomizableCloudFox from './CustomizableCloudFox.vue'
import type {
  CloudFoxAppearanceRecipe,
  CloudFoxStudioBackground,
  CloudFoxStudioBehavior,
  CloudFoxStudioView,
} from '~/domain/cloud-fox-appearance'

const props = defineProps<{
  appearance: CloudFoxAppearanceRecipe
  behavior: CloudFoxStudioBehavior
  view: CloudFoxStudioView
  background: CloudFoxStudioBackground
}>()

function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

const clearColor = computed(() => ({
  dark: '#080a12',
  light: '#eef1ff',
  web: '#172035',
}[props.background]))

const canvasClass = computed(() => `studio-canvas studio-canvas--${props.background}`)
</script>

<template>
  <div :class="canvasClass" aria-label="云灵外观实时预览">
    <div v-if="background === 'web'" class="web-preview" aria-hidden="true">
      <div class="web-preview__nav" />
      <div class="web-preview__hero" />
      <div class="web-preview__cards"><i /><i /><i /></div>
    </div>
    <TresCanvas
      :clear-color="clearColor"
      :clear-alpha="background === 'web' ? 0.16 : 1"
      :dpr="[1, 1.55]"
      alpha
      antialias
      shadows
    >
      <TresPerspectiveCamera :position="vec3(0, 1.28, 6.35)" :fov="38" />
      <TresAmbientLight :intensity="background === 'light' ? 1.6 : 1.08" />
      <TresDirectionalLight :position="vec3(4, 6, 4)" :intensity="background === 'light' ? 2.8 : 3.9" cast-shadow />
      <TresPointLight :position="vec3(-4, 1, 2)" :intensity="4.2" :color="appearance.palette.primaryGlow" />
      <TresPointLight :position="vec3(3, -1, 2)" :intensity="3.4" :color="appearance.palette.secondaryGlow" />
      <CustomizableCloudFox :appearance="appearance" :behavior="behavior" :view="view" />
    </TresCanvas>
    <div class="studio-canvas__label">
      <strong>{{ appearance.identity.nameZh }} · {{ appearance.identity.nameEn }}</strong>
      <span>云狐 / Cloud Fox</span>
    </div>
  </div>
</template>

<style scoped>
.studio-canvas {
  position: relative;
  min-height: 620px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 28px;
  background: #080a12;
  box-shadow: 0 28px 80px rgba(0, 0, 0, .34);
}

.studio-canvas--light {
  background: #eef1ff;
}

.studio-canvas--web {
  background: linear-gradient(135deg, #111a2d, #293858);
}

.studio-canvas :deep(canvas) {
  position: absolute !important;
  inset: 0;
  z-index: 2;
  width: 100% !important;
  height: 100% !important;
}

.web-preview {
  position: absolute;
  inset: 0;
  opacity: .68;
  background:
    radial-gradient(circle at 78% 18%, rgba(112, 102, 255, .3), transparent 28%),
    linear-gradient(145deg, #17213a, #263956);
}

.web-preview__nav {
  height: 54px;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
  background: rgba(8, 11, 20, .52);
}

.web-preview__hero {
  width: 48%;
  height: 136px;
  margin: 58px 0 0 44px;
  border-radius: 20px;
  background: linear-gradient(120deg, rgba(255, 255, 255, .12), rgba(255, 255, 255, .035));
}

.web-preview__cards {
  display: flex;
  gap: 16px;
  margin: 28px 42px;
}

.web-preview__cards i {
  display: block;
  width: 29%;
  height: 110px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 18px;
  background: rgba(8, 12, 24, .44);
}

.studio-canvas__label {
  position: absolute;
  z-index: 3;
  left: 22px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 14px;
  color: #f5f7ff;
  background: rgba(8, 11, 20, .66);
  backdrop-filter: blur(16px);
}

.studio-canvas__label span {
  color: #aeb7d8;
  font-size: 12px;
}

@media (max-width: 980px) {
  .studio-canvas {
    min-height: 520px;
  }
}
</style>
