<!--
  文件职责 / File responsibility
  保留原 AvatarCanvas 调用接口，同时通过 <yk-pet> 挂载正式渲染器并读取扩展保存的共享配方。
  Preserves the existing AvatarCanvas API while mounting production rendering through <yk-pet> and loading the shared extension recipe.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  createPetRecipeEnvelope,
  normalizePetRecipeEnvelope,
  YK_PET_RECIPE_STORAGE_KEY,
  type PetRecipeEnvelope,
} from '@yk-pets/pet-core'
import { YkPetElement } from '@yk-pets/pet-web-component'
import { registerExtensionCloudFoxPetElement } from '../../entrypoints/content/yk-pet-adapter'
import ProductionAvatarCanvas from './ProductionAvatarCanvas.vue'
import type { PetEmotion } from './types'

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

const mountHost = shallowRef<HTMLDivElement>()
const petElement = shallowRef<YkPetElement>()
const fallbackActive = ref(false)
const activeRecipe = shallowRef<PetRecipeEnvelope>(createPetRecipeEnvelope({
  speciesId: 'cloud-fox',
  rendererId: 'extension-cloud-fox',
  source: 'default',
  appearance: {},
}))
const effectiveRecipe = computed(() => props.recipe || activeRecipe.value)
const hostStyle = computed(() => ({
  position: 'relative' as const,
  display: 'block',
  width: '100%',
  height: `${props.compact ? 214 : 242}px`,
  minWidth: '0',
  minHeight: '0',
  overflow: 'visible',
}))

let readinessTimer: number | null = null

function hasExtensionStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function clearReadinessTimer() {
  if (readinessTimer === null) return
  window.clearTimeout(readinessTimer)
  readinessTimer = null
}

function activateFallback(reason: string) {
  if (fallbackActive.value) return
  clearReadinessTimer()
  console.warn('[YK-PETS yk-pet fallback]', reason)
  fallbackActive.value = true
  petElement.value?.remove()
  petElement.value = undefined
}

function probeRenderedCanvas() {
  readinessTimer = null
  if (fallbackActive.value) return
  const canvas = petElement.value?.shadowRoot?.querySelector('canvas')
  const rect = canvas?.getBoundingClientRect()
  if (!canvas || !rect || rect.width < 2 || rect.height < 2) {
    activateFallback('The Web Component renderer did not create a visible canvas in time.')
  }
}

function scheduleRendererProbe(delay = 900) {
  clearReadinessTimer()
  readinessTimer = window.setTimeout(probeRenderedCanvas, delay)
}

function onPetReady() {
  scheduleRendererProbe(700)
}

function onPetError(event: Event) {
  const message = (event as CustomEvent<{ message?: string }>).detail?.message || 'Unknown Web Component renderer error.'
  activateFallback(message)
}

function updatePetElement() {
  if (fallbackActive.value) return
  petElement.value?.setState({
    recipe: effectiveRecipe.value,
    speciesId: effectiveRecipe.value.speciesId,
    rendererId: effectiveRecipe.value.rendererId,
    behavior: props.behavior,
    renderProps: {
      emotion: props.emotion,
      speaking: props.speaking,
      score: props.score,
      compact: props.compact,
      transparent: props.transparent,
      pointer: props.pointer,
      motionKey: props.motionKey,
    },
  })
}

async function restoreRecipe() {
  if (props.recipe || !hasExtensionStorage()) return
  const stored = await chrome.storage.local.get(YK_PET_RECIPE_STORAGE_KEY)
  const normalized = normalizePetRecipeEnvelope(stored[YK_PET_RECIPE_STORAGE_KEY])
  if (normalized) activeRecipe.value = normalized
  updatePetElement()
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
  if (areaName !== 'local' || props.recipe || !changes[YK_PET_RECIPE_STORAGE_KEY]) return
  const normalized = normalizePetRecipeEnvelope(changes[YK_PET_RECIPE_STORAGE_KEY]?.newValue)
  if (!normalized) return
  activeRecipe.value = normalized
  updatePetElement()
}

watch(
  () => [
    props.behavior,
    props.emotion,
    props.speaking,
    props.score,
    props.compact,
    props.transparent,
    props.pointer.x,
    props.pointer.y,
    props.motionKey,
    props.recipe,
  ] as const,
  updatePetElement,
  { deep: true },
)

onMounted(() => {
  try {
    registerExtensionCloudFoxPetElement()
    const element = document.createElement('yk-pet') as YkPetElement
    element.style.display = 'block'
    element.style.width = '100%'
    element.style.height = '100%'
    element.style.minWidth = '0'
    element.style.minHeight = '0'
    element.addEventListener('yk-pet-ready', onPetReady)
    element.addEventListener('yk-pet-error', onPetError)
    petElement.value = element
    mountHost.value?.append(element)
    updatePetElement()
    scheduleRendererProbe(1200)
  }
  catch (error) {
    activateFallback(error instanceof Error ? error.message : String(error))
  }

  restoreRecipe().catch(error => console.warn('[YK-PETS recipe restore]', error))
  if (hasExtensionStorage()) chrome.storage.onChanged.addListener(onStorageChanged)
})

onBeforeUnmount(() => {
  clearReadinessTimer()
  if (hasExtensionStorage()) chrome.storage.onChanged.removeListener(onStorageChanged)
  if (petElement.value) {
    petElement.value.removeEventListener('yk-pet-ready', onPetReady)
    petElement.value.removeEventListener('yk-pet-error', onPetError)
    petElement.value.remove()
  }
  petElement.value = undefined
})
</script>

<template>
  <div class="avatar-web-component-shell" :style="hostStyle">
    <div
      v-if="!fallbackActive"
      ref="mountHost"
      class="avatar-web-component-host"
      style="display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:visible"
    />
    <ProductionAvatarCanvas
      v-else
      :behavior="behavior"
      :emotion="emotion"
      :speaking="speaking"
      :score="score"
      :compact="compact"
      :transparent="transparent"
      :pointer="pointer"
      :motion-key="motionKey"
      :recipe="effectiveRecipe"
    />
  </div>
</template>

<style scoped>
.avatar-web-component-shell,
.avatar-web-component-host {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}
</style>
