<!--
  文件职责 / File responsibility
  作为 <yk-pet> 的扩展正式 TresJS 渲染实现，消费 pet-core 配方并按动作强度限制网页内帧率和 DPR。
  Serves as the extension production TresJS renderer behind <yk-pet>, consuming pet-core recipes while capping in-page FPS and DPR by motion intensity.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import ConfiguredCloudFox from './ConfiguredCloudFox.vue'
import { resolveExtensionCloudFoxAppearance } from './appearance'
import type { PetEmotion } from './types'

function vec3(x: number, y: number, z: number) { return new Vector3(x, y, z) }

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
const highMotion = computed(() => ['backflip', 'tail-tornado', 'diving-catch', 'energy-burst', 'fireworks-show'].includes(props.behavior))
const quietMotion = computed(() => ['idle', 'resting', 'sleeping', 'cloud-nap'].includes(props.behavior))
const cameraPosition = computed(() => wideScene.value
  ? props.compact ? vec3(0, .62, 11.3) : vec3(0, .72, 10.8)
  : props.compact ? vec3(0, .08, 9.7) : vec3(0, .42, 8.8))
const pixelRatio = computed<[number, number]>(() => props.compact ? [.6, .9] : [.8, 1.15])
const frameRateLimit = computed(() => {
  if (!props.compact) return highMotion.value ? 36 : quietMotion.value ? 20 : 30
  if (highMotion.value) return 24
  if (quietMotion.value) return 12
  return 20
})
const foxScale = computed(() => props.compact ? .92 : 1)
const canvasClass = computed(() => ({ 'avatar-canvas--transparent': props.transparent, 'avatar-canvas--compact': props.compact }))
const rootStyle = computed(() => ({
  position: 'relative' as const,
  display: 'block',
  width: '100%',
  height: '100%',
  minWidth: '0',
  minHeight: '0',
  overflow: 'visible',
  borderRadius: props.compact ? '28px' : '22px',
  background: props.transparent
    ? 'transparent'
    : 'radial-gradient(circle at 50% 76%,rgba(82,224,208,.1),transparent 34%),radial-gradient(circle at 50% 8%,rgba(112,102,255,.18),transparent 42%),#0a0d18',
}))
const tresStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  minWidth: '0',
  minHeight: '0',
  background: 'transparent',
}
</script>

<template>
  <div class="avatar-canvas" :class="canvasClass" :style="rootStyle" aria-hidden="true">
    <div class="avatar-nebula" />
    <TresCanvas
      :clear-color="transparent ? '#000000' : '#0a0d18'"
      :clear-alpha="transparent ? 0 : 1"
      :dpr="pixelRatio"
      :fps-limit="frameRateLimit"
      :style="tresStyle"
      :antialias="!compact"
      render-mode="always"
      power-preference="low-power"
      alpha
    >
      <TresPerspectiveCamera :position="cameraPosition" :fov="wideScene ? 38 : compact ? 33 : 35" />
      <TresAmbientLight :intensity="1.28" />
      <TresDirectionalLight :position="vec3(4, 6, 4)" :intensity="3.5" />
      <TresPointLight v-if="!compact || secretMode || highMotion" :position="vec3(-3, 1, 2)" :intensity="secretMode ? 6 : 2.8" :color="visual.palette.primaryGlow" />
      <TresGroup :scale="vec3(foxScale, foxScale, foxScale)">
        <ConfiguredCloudFox :behavior="behavior" :emotion="emotion" :speaking="speaking" :pointer="pointer" :secret-mode="secretMode" :motion-key="motionKey" :recipe="recipe" theme="dark" />
      </TresGroup>
    </TresCanvas>
    <div class="avatar-glow" :style="{ opacity: Math.max(.18, score / 130) }" />
  </div>
</template>

<style scoped>
.avatar-canvas{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:visible;border-radius:22px;background:radial-gradient(circle at 50% 76%,rgba(82,224,208,.1),transparent 34%),radial-gradient(circle at 50% 8%,rgba(112,102,255,.18),transparent 42%),#0a0d18}.avatar-canvas--compact{border-radius:28px}.avatar-canvas--transparent{background:transparent}.avatar-canvas :deep(canvas){display:block;width:100%!important;height:100%!important;background:transparent!important}.avatar-nebula{position:absolute;inset:2% 4% 8%;border-radius:50%;background:radial-gradient(circle at 50% 58%,rgba(255,255,255,.09) 0%,rgba(255,255,255,.04) 8%,rgba(111,103,255,.22) 26%,rgba(70,52,185,.16) 42%,rgba(82,224,208,.14) 55%,rgba(14,18,40,.06) 72%,rgba(14,18,40,0) 84%),radial-gradient(circle at 58% 50%,rgba(82,224,208,.18),rgba(82,224,208,0) 52%),radial-gradient(circle at 42% 48%,rgba(112,102,255,.22),rgba(112,102,255,0) 50%);filter:blur(8px);pointer-events:none;opacity:.84}.avatar-canvas--transparent .avatar-nebula{inset:8% 6% 10%;opacity:.82}.avatar-glow{position:absolute;inset:auto 14% -32px;height:78px;background:radial-gradient(ellipse,rgba(82,224,208,.26),rgba(112,102,255,.14) 38%,transparent 72%);filter:blur(13px);pointer-events:none}.avatar-canvas--compact .avatar-glow{inset:auto 16% -22px;height:58px}@media(prefers-reduced-motion:reduce){.avatar-nebula,.avatar-glow{filter:none}}
</style>
