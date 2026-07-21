<!--
  文件职责 / File responsibility
  保留原 AvatarCanvas 调用接口，同时通过 <yk-pet> 挂载正式渲染器并读取扩展保存的共享配方。
  Preserves the existing AvatarCanvas API while mounting production rendering through <yk-pet> and loading the shared extension recipe.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import {
  createPetRecipeEnvelope,
  normalizePetRecipeEnvelope,
  YK_PET_RECIPE_STORAGE_KEY,
  type PetRecipeEnvelope,
} from '@yk-pets/pet-core'
import { YkPetElement } from '@yk-pets/pet-web-component'
import { registerExtensionCloudFoxPetElement } from '../../entrypoints/content/yk-pet-adapter'
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
const activeRecipe = shallowRef<PetRecipeEnvelope>(createPetRecipeEnvelope({
  speciesId: 'cloud-fox',
  rendererId: 'extension-cloud-fox',
  source: 'default',
  appearance: {},
}))
const hostStyle = computed(() => ({ height: `${props.compact ? 214 : 242}px` }))

function hasExtensionStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function updatePetElement() {
  petElement.value?.setState({
    recipe: props.recipe || activeRecipe.value,
    speciesId: (props.recipe || activeRecipe.value).speciesId,
    rendererId: (props.recipe || activeRecipe.value).rendererId,
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
  registerExtensionCloudFoxPetElement()
  const element = document.createElement('yk-pet') as YkPetElement
  element.style.display = 'block'
  element.style.width = '100%'
  element.style.height = '100%'
  petElement.value = element
  mountHost.value?.append(element)
  updatePetElement()
  restoreRecipe().catch(error => console.warn('[YK-PETS recipe restore]', error))
  if (hasExtensionStorage()) chrome.storage.onChanged.addListener(onStorageChanged)
})

onBeforeUnmount(() => {
  if (hasExtensionStorage()) chrome.storage.onChanged.removeListener(onStorageChanged)
  petElement.value?.remove()
  petElement.value = undefined
})
</script>

<template>
  <div ref="mountHost" class="avatar-web-component-host" :style="hostStyle" />
</template>

<style scoped>
.avatar-web-component-host {
  display: block;
  width: 100%;
  overflow: visible;
}
</style>
