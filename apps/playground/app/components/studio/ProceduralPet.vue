<script setup lang="ts">
import CustomizableCloudFox from './CustomizableCloudFox.vue'
import MoonCat from './MoonCat.vue'
import { PET_SPECIES_REGISTRY, resolveSpeciesBehavior, type MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { CloudFoxStudioBehavior, CloudFoxStudioView, PetStudioAppearanceRecipe } from '~/domain/pet-studio-phase4'
const props=defineProps<{appearance:MultiSpeciesAppearanceRecipe;behavior:CloudFoxStudioBehavior;view:CloudFoxStudioView}>()
const definition=computed(()=>PET_SPECIES_REGISTRY[props.appearance.speciesId])
const behavior=computed(()=>resolveSpeciesBehavior(props.appearance.speciesId,props.behavior))
const cloudAppearance=computed(()=>props.appearance as unknown as PetStudioAppearanceRecipe)
</script>
<template><CustomizableCloudFox v-if="appearance.speciesId==='cloud-fox'" :appearance="cloudAppearance" :behavior="behavior" :view="view"/><MoonCat v-else-if="appearance.speciesId==='moon-cat'" :appearance="appearance" :behavior="behavior" :view="view"/><TresGroup v-else><TresMesh><TresSphereGeometry :args="[.85,32,32]"/><TresMeshStandardMaterial :color="appearance.palette.coat" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".35"/></TresMesh></TresGroup><slot name="species-meta" :definition="definition"/></template>
