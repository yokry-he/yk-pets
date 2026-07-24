<!--
  文件职责 / File responsibility
  装配 Studio 实时预览，并用独立身体/头型 Profile 计算稳定镜头边界和聚焦距离。
  Assembles Studio live preview and uses independent body/head profiles for stable camera bounds and focus distance.
-->
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import ProceduralPet from './ProceduralPet.vue'
import PetSceneEffects from './PetSceneEffects.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { calculatePetStudioVisualBounds } from '~/domain/pet-studio-phase2'
import { getCloudFoxBodyProfile, getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
import { createExtensionClassicAppearance, createExtensionClassicScene, isExtensionClassicScene } from '~/domain/extension-cloud-fox-default'
import { createDefaultPetScene, getPetScenePreset, resolveSceneContrast, type PetSceneRecipe } from '~/domain/pet-scene'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = withDefaults(defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey?: number
  view: CloudFoxStudioView
  background: CloudFoxStudioBackground
  scene?: PetSceneRecipe
  focus?: 'full' | 'head' | 'body' | 'tail'
}>(), {
  motionKey: 0,
  focus: 'full',
})
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vec3 = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const legacyScene = computed(() => props.background === 'light'
  ? { ...createDefaultPetScene(), background: '#eef1ff', backgroundSecondary: '#ffffff', contrastMode: 'light' as const }
  : props.background === 'web'
    ? getPetScenePreset('neon-hangar')
    : createExtensionClassicScene())
const activeScene = computed(() => props.scene || legacyScene.value)
const prefersDark = ref(true)
onMounted(() => { prefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches })
const contrast = computed(() => resolveSceneContrast(activeScene.value, prefersDark.value))
const clearColor = computed(() => activeScene.value.transparent ? '#000000' : activeScene.value.background)
const extensionScene = computed(() => isExtensionClassicScene(activeScene.value))
const canvasDpr = computed<[number, number]>(() => [scheme.scene.camera.normalDpr[0], scheme.scene.camera.normalDpr[1]])

function resolvedBounds(appearance: MultiSpeciesAppearanceRecipe) {
  const base = calculatePetStudioVisualBounds(appearance as never)
  const body = getCloudFoxBodyProfile(appearance.parts.bodyShape)
  const head = getCloudFoxHeadProfile(appearance.parts.headShape)
  const widthScale = Math.max(body.boundsScale[0], head.boundsScale[0])
  const heightScale = Math.max(body.boundsScale[1], head.boundsScale[1])
  const depthScale = Math.max(body.boundsScale[2], head.boundsScale[2])
  return {
    centerY: base.centerY + head.offset[1] * .35,
    width: base.width * widthScale,
    height: base.height * heightScale,
    depth: base.depth * depthScale,
    radius: base.radius * Math.max(widthScale, heightScale, depthScale),
  }
}
const petBounds = computed(() => resolvedBounds(props.appearance))
const referenceBounds = resolvedBounds(createExtensionClassicAppearance())
const focusZoom = computed(() => ({ full: 1, head: .7, body: .82, tail: .9 }[props.focus]))
const cameraFactor = computed(() => Math.max(.78, Math.min(1.5, petBounds.value.radius / referenceBounds.radius)) * focusZoom.value)
const cameraPosition = computed(() => {
  const base = scheme.scene.camera.normalPosition
  const focusLift = props.focus === 'head' ? .55 : props.focus === 'body' ? -.1 : 0
  return vec3([
    base[0],
    base[1] + (petBounds.value.centerY - referenceBounds.centerY) + focusLift,
    base[2] * cameraFactor.value * .9,
  ])
})
const sceneStyle = computed(() => ({
  '--scene-a': activeScene.value.background,
  '--scene-b': activeScene.value.backgroundSecondary,
  '--extension-surface': scheme.scene.containerBackground,
  '--extension-nebula': scheme.scene.nebulaBackground,
  '--extension-glow': scheme.scene.glowBackground,
}))
</script>

<template>
  <div :class="['studio-canvas', `studio-canvas--${contrast}`, { 'studio-canvas--extension': extensionScene }]" :style="sceneStyle" :data-visual-scheme="scheme.id">
    <div v-if="!activeScene.transparent" class="scene-surface" />
    <div v-if="!activeScene.transparent" class="scene-gradient" />
    <div v-if="extensionScene" class="extension-nebula" />
    <TresCanvas :clear-color="clearColor" :clear-alpha="activeScene.transparent ? 0 : 1" :dpr="canvasDpr" alpha antialias shadows>
      <TresPerspectiveCamera :position="cameraPosition" :fov="scheme.scene.camera.normalFov" />
      <TresAmbientLight :intensity="contrast === 'light' ? 1.7 : scheme.scene.lights.ambientIntensity" />
      <TresDirectionalLight :position="vec3(scheme.scene.lights.directionalPosition)" :intensity="contrast === 'light' ? 2.7 : scheme.scene.lights.directionalIntensity" cast-shadow />
      <TresPointLight :position="vec3(scheme.scene.lights.primaryPosition)" :intensity="scheme.scene.lights.primaryIntensity" :color="appearance.palette.primaryGlow" />
      <TresPointLight :position="vec3(scheme.scene.lights.secondaryPosition)" :intensity="scheme.scene.lights.secondaryIntensity" :color="appearance.palette.secondaryGlow" />
      <PetSceneEffects :scene="activeScene" :behavior="behavior" />
      <ProceduralPet :appearance="appearance" :behavior="behavior" :motion-key="motionKey" :view="view" />
    </TresCanvas>
    <div v-if="extensionScene" class="extension-glow" />
    <div class="label">
      <strong>{{ appearance.identity.nameZh }} · {{ appearance.identity.nameEn }}</strong>
      <span>{{ appearance.parts.headShape }} / {{ appearance.parts.bodyShape }} · {{ petBounds.width.toFixed(1) }} × {{ petBounds.height.toFixed(1) }}</span>
    </div>
  </div>
</template>

<style scoped>
.studio-canvas{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden;border:1px solid #ffffff1f;border-radius:22px;background:transparent;box-shadow:0 28px 80px #0006}.scene-surface{position:absolute;inset:0;background:linear-gradient(145deg,var(--scene-a),var(--scene-b))}.scene-gradient{position:absolute;inset:0;background:radial-gradient(circle at 70% 15%,color-mix(in srgb,var(--scene-b) 76%,transparent),transparent 38%)}.studio-canvas--extension .scene-surface{background:var(--extension-surface)}.studio-canvas--extension .scene-gradient{display:none}.extension-nebula{position:absolute;inset:2% 4% 8%;border-radius:50%;background:var(--extension-nebula);filter:blur(10px);opacity:.92;pointer-events:none}.extension-glow{position:absolute;z-index:3;inset:auto 14% -18px;height:78px;background:var(--extension-glow);filter:blur(16px);pointer-events:none}.studio-canvas :deep(canvas){position:absolute!important;inset:0;z-index:2;width:100%!important;height:100%!important;background:transparent!important}.label{position:absolute;z-index:4;left:18px;bottom:18px;display:flex;flex-direction:column;gap:4px;max-width:calc(100% - 36px);padding:9px 12px;border:1px solid #ffffff24;border-radius:12px;color:#f5f7ff;background:#080b14a8;backdrop-filter:blur(16px)}.studio-canvas--light .label{color:#17192b;background:#ffffffe0}.label span{overflow:hidden;color:#aeb7d8;font-size:11px;text-overflow:ellipsis;white-space:nowrap}@media(max-width:980px){.studio-canvas{min-height:460px}}
</style>
