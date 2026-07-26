<!--
  文件职责 / File responsibility
  根据物种注册信息将通用预览分发到对应宠物渲染器；云狐接收完整 Chrome 扩展动作，其他物种安全降级。
  Dispatches the generic preview by species; Cloud Fox receives the full Chrome extension motion set while other species safely fall back.
-->
<script setup lang="ts">
import type { EvaluatedCloudFoxPose, EvaluatedMotionPropInstance } from '@yk-pets/pet-core'
import { Euler, Vector3 } from 'three'
import ExtensionAlignedCloudFox from './ExtensionAlignedCloudFox.vue'
import MoonCat from './MoonCat.vue'
import { PET_SPECIES_REGISTRY, resolveSpeciesBehavior, type MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { CloudFoxStudioBehavior, CloudFoxStudioView } from '~/domain/pet-studio-phase4'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey: number
  view: CloudFoxStudioView
  customPose?: EvaluatedCloudFoxPose | null
  propInstances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly import('~/domain/studio-workspace').StudioPropAssetMetadata[]
  preservePropMaterials?: boolean
  onionPoses?: readonly EvaluatedCloudFoxPose[]
  motionPathPoints?: readonly (readonly [number, number, number])[]
  previewScale?: number
  previewRotation?: readonly [number, number, number]
}>()
const definition = computed(() => PET_SPECIES_REGISTRY[props.appearance.speciesId])
const previewScaleVector = computed(() => {
  const requested = typeof props.previewScale === 'number' && Number.isFinite(props.previewScale) ? props.previewScale : 1
  const value = Math.max(.25, Math.min(1.5, requested))
  return new Vector3(value, value, value)
})
const previewRotationEuler = computed(() => {
  const value = props.previewRotation || [0, 0, 0]
  return new Euler(value[0] || 0, value[1] || 0, value[2] || 0)
})
const moonCatBehavior = computed(() => {
  const supported: readonly CloudFoxStudioBehavior[] = ['idle', 'greeting', 'jumping', 'stretching', 'resting']
  const requested = supported.includes(props.behavior as CloudFoxStudioBehavior)
    ? props.behavior as CloudFoxStudioBehavior
    : 'idle'
  return resolveSpeciesBehavior(props.appearance.speciesId, requested)
})
</script>

<template>
  <TresGroup :scale="previewScaleVector" :rotation="previewRotationEuler">
    <ExtensionAlignedCloudFox
      v-if="appearance.speciesId === 'cloud-fox'"
      :appearance="appearance"
      :behavior="behavior"
      :motion-key="motionKey"
      :view="view"
      :custom-pose="customPose"
      :prop-instances="propInstances"
      :prop-assets="propAssets"
      :preserve-prop-materials="preservePropMaterials"
      :onion-poses="onionPoses"
      :motion-path-points="motionPathPoints"
    />
    <MoonCat
      v-else-if="appearance.speciesId === 'moon-cat'"
      :appearance="appearance"
      :behavior="moonCatBehavior"
      :view="view"
    />
    <TresGroup v-else>
      <TresMesh>
        <TresSphereGeometry :args="[.85, 32, 32]" />
        <TresMeshStandardMaterial :color="appearance.palette.coat" :emissive="appearance.palette.primaryGlow" :emissive-intensity=".35" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
  <slot name="species-meta" :definition="definition" />
</template>
