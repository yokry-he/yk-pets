<!--
  文件职责 / File responsibility
  将默认、Studio 和导入配方统一归一化为 Studio 配方，并交给 Studio 与扩展共用的唯一云狐模型和动作组合层。
  Normalizes default, Studio, and imported recipes into the Studio recipe and sends them to the single Cloud Fox model and motion composition shared by Studio and the extension.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import ExtensionAlignedCloudFox from '../../../playground/app/components/studio/ExtensionAlignedCloudFox.vue'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { normalizeMultiSpeciesAppearance } from '~/domain/pet-species-registry'
import type { PetEmotion } from './types'

type CloudFoxRendererView = 'front' | 'left' | 'back' | 'right'
const props = withDefaults(defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  motionKey: number
  theme: 'dark' | 'light'
  recipe?: PetRecipeEnvelope | null
  view?: CloudFoxRendererView
  active?: boolean
}>(), {
  recipe: null,
  view: 'front',
  active: true,
})

const appearance = computed(() => {
  const input = props.recipe?.appearance
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
    return createExtensionClassicAppearance()
  }
  return normalizeMultiSpeciesAppearance(input)
})
const behavior = computed(() => props.behavior as ExtensionCloudFoxMotionId)
</script>

<template>
  <ExtensionAlignedCloudFox
    :appearance="appearance"
    :behavior="behavior"
    :motion-key="motionKey"
    :view="view"
    :pointer="pointer"
    :speaking="speaking"
    :active="active"
  />
</template>
