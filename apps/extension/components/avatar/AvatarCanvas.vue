<!--
  文件职责 / File responsibility
  负责 TresJS 画布、相机、灯光和云狐模型装配，并把 pet-core 配方传入正式渲染器。
  Owns the TresJS canvas, camera, lighting, and Cloud Fox assembly while forwarding the pet-core recipe to production rendering.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import ConfiguredCloudFox from './ConfiguredCloudFox.vue'
import { resolveExtensionCloudFoxAppearance } from './appearance'
import type { PetEmotion } from './types'

function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

const props = withDefaults(defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking?: boolean
  score?: number
  compact?: boolean
  transparent?: boolean
  pointer?: { x: number; y: number }
  motionKey?: number
  recipe?: PetRecipeEnvelope | null
}>(), {
  speaking: false,
  score: 100,
  compact: false,
  transparent: false,
  pointer: () => ({ x: 0, y: 0 }),
  motionKey: 0,
  recipe: null,
})

const visual = computed(() => resolveExtensionCloudFoxAppearance(props.recipe))
const secretMode = computed(() => props.behavior === 'excited')
const wideScene = computed(() => props.behavior === 'fireworks-show')
const cameraPosition = computed(() => wideScene.value
  ? props.compact ? vec3(0, 0.62, 11.3) : vec3(0, 0.72, 10.8)
  : props.compact ? vec3(0, 0.08, 9.7) : vec3(0, 0.42, 8.8))
const pixelRatio = computed<[number, number]>(() => props.compact ? [1, 1.2] : [1, 1.4])
const foxScale = computed(() => props.compact ? 0.92 : 1)
const canvasClass = computed(() => ({
  'avatar-canvas--transparent': props.transparent,
  'avatar-canvas--compact': props.compact,
}))
</script>

<template>
  <!-- TresJS 场景、灯光和模型装配 / TresJS scene, lighting, and model assembly -->
  <div class="avatar-canvas" :class="canvasClass" aria-hidden="true">
    <div class="avatar-nebula" />
    <TresCanvas
      :clear-color="transparent ? '#000000' : '#0a0d18'"
      :clear-alpha="transparent ? 0 : 1"
      :dpr="pixelRatio"
      alpha
      antialias
    >
      <TresPerspectiveCamera :position="cameraPosition" :fov="wideScene ? 38 : compact ? 33 : 35" />
      <TresAmbientLight :intensity="1.35" />
      <TresDirectionalLight :position="vec3(4, 6, 4)" :intensity="3.8" />
      <TresPointLight :position="vec3(-3, 1, 2)" :intensity="secretMode ? 7 : 3.6" :color="visual.palette.primaryGlow" />
      <TresPointLight :position="vec3(3, -1, 2)" :intensity="secretMode ? 6 : 2.8" :color="visual.palette.secondaryGlow" />
      <TresGroup :scale="vec3(foxScale, foxScale, foxScale)">
        <ConfiguredCloudFox
          :behavior="behavior"
          :emotion="emotion"
          :speaking="speaking"
          :pointer="pointer"
          :secret-mode="secretMode"
          :motion-key="motionKey"
          :recipe="recipe"
          theme="dark"
        />
      </TresGroup>
    </TresCanvas>
    <div class="avatar-glow" :style="{ opacity: Math.max(.18, score / 130) }" />
  </div>
</template>

<style scoped>
.avatar-canvas {
  position: relative;
  width: 100%;
  height: 242px;
  overflow: visible;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 76%, rgba(82, 224, 208, .1), transparent 34%),
    radial-gradient(circle at 50% 8%, rgba(112, 102, 255, .18), transparent 42%),
    #0a0d18;
}
.avatar-canvas--compact { height: 214px; border-radius: 28px; }
.avatar-canvas--transparent { background: transparent; }
.avatar-canvas :deep(canvas) { display: block; width: 100%; height: 100%; background: transparent !important; }
.avatar-nebula {
  position: absolute;
  inset: 2% 4% 8%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 58%, rgba(255, 255, 255, .09) 0%, rgba(255, 255, 255, .04) 8%, rgba(111, 103, 255, .22) 26%, rgba(70, 52, 185, .16) 42%, rgba(82, 224, 208, .14) 55%, rgba(14, 18, 40, .06) 72%, rgba(14, 18, 40, 0) 84%),
    radial-gradient(circle at 58% 50%, rgba(82, 224, 208, .18), rgba(82, 224, 208, 0) 52%),
    radial-gradient(circle at 42% 48%, rgba(112, 102, 255, .22), rgba(112, 102, 255, 0) 50%);
  filter: blur(10px);
  pointer-events: none;
  opacity: .92;
}
.avatar-canvas--transparent .avatar-nebula { inset: 8% 6% 10%; opacity: .92; }
.avatar-glow {
  position: absolute;
  inset: auto 14% -32px;
  height: 78px;
  background: radial-gradient(ellipse, rgba(82,224,208,.32), rgba(112,102,255,.18) 38%, transparent 72%);
  filter: blur(16px);
  pointer-events: none;
}
.avatar-canvas--compact .avatar-glow { inset: auto 16% -22px; height: 58px; }
</style>
