<!--
  文件职责 / File responsibility
  将默认、Studio 和导入配方统一补齐颜色、肚皮和扩展参数，再交给 Studio 与扩展共用的唯一云狐组合层。
  Normalizes default, Studio, and imported recipes with colors, belly geometry, and expanded ranges before handing them to the sole shared Cloud Fox composition.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import ExtensionAlignedCloudFox from 'yk-pets-unified-cloud-fox'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { normalizeCustomizableAppearance } from '~/domain/pet-part-customization'
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
  return normalizeCustomizableAppearance(
    !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0
      ? createExtensionClassicAppearance()
      : input,
  )
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
