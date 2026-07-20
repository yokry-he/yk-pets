<!--
  文件职责 / File responsibility
  根据物种注册信息将通用预览分发到对应宠物渲染器。
  Dispatches the generic preview to the appropriate pet renderer using species registration.
-->
<script setup lang="ts">
import CustomizableCloudFox from './CustomizableCloudFox.vue'
import ExtensionAlignedCloudFox from './ExtensionAlignedCloudFox.vue'
import MoonCat from './MoonCat.vue'
import { PET_SPECIES_REGISTRY, resolveSpeciesBehavior, type MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import { usesExtensionClassicTopology } from '~/domain/extension-cloud-fox-default'
import type { CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase4'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: CloudFoxStudioBehavior
  view: CloudFoxStudioView
}>()
const definition = computed(() => PET_SPECIES_REGISTRY[props.appearance.speciesId])
const behavior = computed(() => resolveSpeciesBehavior(props.appearance.speciesId, props.behavior))
const useExtensionRenderer = computed(() => usesExtensionClassicTopology(props.appearance))
</script>

<template>
  <ExtensionAlignedCloudFox
    v-if="appearance.speciesId === 'cloud-fox' && useExtensionRenderer"
    :appearance="appearance"
    :behavior="behavior"
    :view="view"
  />
  <CustomizableCloudFox
    v-else-if="appearance.speciesId === 'cloud-fox'"
    :appearance="appearance"
    :behavior="behavior"
    :view="view"
  />
  <MoonCat
    v-else-if="appearance.speciesId === 'moon-cat'"
    :appearance="appearance"
    :behavior="behavior"
    :view="view"
  />
  <TresGroup v-else>
    <TresMesh>
      <TresSphereGeometry :args="[.85, 32, 32]" />
      <TresMeshStandardMaterial :color="appearance.palette.coat" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".35" />
    </TresMesh>
  </TresGroup>
  <slot name="species-meta" :definition="definition" />
</template>
