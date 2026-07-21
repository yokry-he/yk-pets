<!--
  文件职责 / File responsibility
  装配通用宠物预览，并以 Chrome 扩展正式参数作为默认相机、灯光和星云背景方案。
  Assembles the generic pet preview using the Chrome extension production parameters as the default camera, lighting, and nebula scene scheme.
-->
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Vector3 } from 'three'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import ProceduralPet from './ProceduralPet.vue'
import PetSceneEffects from './PetSceneEffects.vue'
import { calculatePetStudioVisualBounds } from '~/domain/pet-studio-phase2'
import { createExtensionClassicAppearance, createExtensionClassicScene, isExtensionClassicScene } from '~/domain/extension-cloud-fox-default'
import { createDefaultPetScene, getPetScenePreset, resolveSceneContrast, type PetSceneRecipe } from '~/domain/pet-scene'
import type { CloudFoxStudioBackground, CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: CloudFoxStudioBehavior
  view: CloudFoxStudioView
  background: CloudFoxStudioBackground
  scene?: PetSceneRecipe
}>()
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

// 相机始终读取当前局部尾巴和身体边界；默认配方仍精确落在扩展 normalPosition。 / Camera always reads current body and local tail bounds while the default recipe still lands exactly on the extension normalPosition.
const petBounds = computed(() => calculatePetStudioVisualBounds(props.appearance as never))
const referenceBounds = calculatePetStudioVisualBounds(createExtensionClassicAppearance() as never)
const cameraFactor = computed(() => Math.max(.82, petBounds.value.radius / referenceBounds.radius))
const cameraPosition = computed(() => {
  const base = scheme.scene.camera.normalPosition
  return vec3([
    base[0],
    base[1] + (petBounds.value.centerY - referenceBounds.centerY),
    base[2] * cameraFactor.value,
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
  <div
    :class="['studio-canvas', `studio-canvas--${contrast}`, { 'studio-canvas--extension': extensionScene }]"
    :style="sceneStyle"
    :data-visual-scheme="scheme.id"
  >
    <div v-if="!activeScene.transparent" class="scene-surface" />
    <div v-if="!activeScene.transparent" class="scene-gradient" />
    <div v-if="extensionScene" class="extension-nebula" />
    <TresCanvas
      :clear-color="clearColor"
      :clear-alpha="activeScene.transparent ? 0 : 1"
      :dpr="canvasDpr"
      alpha
      antialias
      shadows
    >
      <TresPerspectiveCamera :position="cameraPosition" :fov="scheme.scene.camera.normalFov" />
      <TresAmbientLight :intensity="contrast === 'light' ? 1.7 : scheme.scene.lights.ambientIntensity" />
      <TresDirectionalLight :position="vec3(scheme.scene.lights.directionalPosition)" :intensity="contrast === 'light' ? 2.7 : scheme.scene.lights.directionalIntensity" cast-shadow />
      <TresPointLight :position="vec3(scheme.scene.lights.primaryPosition)" :intensity="scheme.scene.lights.primaryIntensity" :color="appearance.palette.primaryGlow" />
      <TresPointLight :position="vec3(scheme.scene.lights.secondaryPosition)" :intensity="scheme.scene.lights.secondaryIntensity" :color="appearance.palette.secondaryGlow" />
      <PetSceneEffects :scene="activeScene" :behavior="behavior" />
      <ProceduralPet :appearance="appearance" :behavior="behavior" :view="view" />
    </TresCanvas>
    <div v-if="extensionScene" class="extension-glow" />
    <div class="label">
      <strong>{{ appearance.identity.nameZh }} · {{ appearance.identity.nameEn }}</strong>
      <span>{{ scheme.label }} · {{ activeScene.presetId }} · 宠物包围盒 {{ petBounds.width.toFixed(1) }} × {{ petBounds.height.toFixed(1) }}</span>
    </div>
  </div>
</template>

<style scoped>
.studio-canvas{position:relative;min-height:620px;overflow:hidden;border:1px solid #ffffff1f;border-radius:28px;background:transparent;box-shadow:0 28px 80px #0006}.scene-surface{position:absolute;inset:0;background:linear-gradient(145deg,var(--scene-a),var(--scene-b))}.scene-gradient{position:absolute;inset:0;background:radial-gradient(circle at 70% 15%,color-mix(in srgb,var(--scene-b) 76%,transparent),transparent 38%)}.studio-canvas--extension .scene-surface{background:var(--extension-surface)}.studio-canvas--extension .scene-gradient{display:none}.extension-nebula{position:absolute;inset:2% 4% 8%;border-radius:50%;background:var(--extension-nebula);filter:blur(10px);opacity:.92;pointer-events:none}.extension-glow{position:absolute;z-index:3;inset:auto 14% -18px;height:78px;background:var(--extension-glow);filter:blur(16px);pointer-events:none}.studio-canvas :deep(canvas){position:absolute!important;inset:0;z-index:2;width:100%!important;height:100%!important;background:transparent!important}.label{position:absolute;z-index:4;left:22px;bottom:20px;display:flex;flex-direction:column;gap:4px;padding:10px 14px;border:1px solid #ffffff24;border-radius:14px;color:#f5f7ff;background:#080b14a8;backdrop-filter:blur(16px)}.studio-canvas--light .label{color:#17192b;background:#ffffffe0}.label span{color:#aeb7d8;font-size:12px}@media(max-width:980px){.studio-canvas{min-height:520px}}
</style>
