<!--
  文件职责 / File responsibility
  在唯一正式云狐场景中渲染道具事件实例，并复用版本化参数化道具模型、挂点与世界空间。
  Renders prop-event instances in the sole production Cloud Fox scene using versioned parametric models, mounts, and world space.
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, MotionPropMountId, StudioPropAssetV2 } from '@yk-pets/pet-core'
import { Euler, Vector3 } from 'three'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import StudioPropModel from './StudioPropModel.vue'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  instances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly StudioPropAssetV2[]
  preserveAssetMaterials?: boolean
}>()
const assetById = computed(() => new Map((props.propAssets || []).map(asset => [asset.id, asset])))
function mountPosition(id: MotionPropMountId): readonly [number, number, number] {
  const width = props.appearance.proportions.bodyWidth
  const height = props.appearance.proportions.bodyHeight
  const depth = props.appearance.proportions.bodyDepth
  const map: Record<MotionPropMountId, readonly [number, number, number]> = {
    world: [0, 0, 0], 'pet-root': [0, 0, 0], 'head-top': [0, 1.62 * height, .02], muzzle: [0, 1.04 * height, .72 * depth],
    'left-front-paw': [-.62 * width, .04, .5 * depth], 'right-front-paw': [.62 * width, .04, .5 * depth],
    'left-hind-paw': [-.55 * width, -.72 * height, .22 * depth], 'right-hind-paw': [.55 * width, -.72 * height, .22 * depth], 'tail-tip': [-1.5 * width, .18, -.35 * depth],
  }
  return map[id]
}
function position(instance: EvaluatedMotionPropInstance): Vector3 {
  const base = instance.space === 'mount' ? mountPosition(instance.mountId) : [0, 0, 0] as const
  return new Vector3(base[0] + instance.transform.position[0], base[1] + instance.transform.position[1], base[2] + instance.transform.position[2])
}
function rotation(instance: EvaluatedMotionPropInstance): Euler { return new Euler(...instance.transform.rotation) }
function scaleVector(instance: EvaluatedMotionPropInstance): Vector3 { return new Vector3(...instance.transform.scale) }
function asset(instance: EvaluatedMotionPropInstance) { return assetById.value.get(instance.propId) }
</script>

<template>
  <TresGroup v-for="instance in instances || []" :key="instance.instanceId" :visible="instance.visible" :position="position(instance)" :rotation="rotation(instance)" :scale="scaleVector(instance)">
    <StudioPropModel v-if="asset(instance)" :asset="asset(instance)!" :style-override="preserveAssetMaterials ? undefined : instance.style" />
  </TresGroup>
</template>
