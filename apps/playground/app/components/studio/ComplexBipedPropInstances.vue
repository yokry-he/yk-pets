<!--
  文件职责 / File responsibility
  筛选复杂双足萌宠可渲染的道具事件，并为每个实例建立独立生命周期边界。
  具体模型子树与 reparent 由单实例组件负责，本组件不创建 Canvas 或 GPU 资源。
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, StudioPropAssetV2 } from '@yk-pets/pet-core'
import type { Group } from 'three'
import type { ComplexBipedPetObject } from '~/three/create-complex-biped-pet-object'
import type { ComplexBipedPropRuntimeHandle } from '~/three/complex-biped-prop-mounts'
import ComplexBipedPropInstance from './ComplexBipedPropInstance.vue'

const props = defineProps<{
  runtime: ComplexBipedPetObject
  instances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly StudioPropAssetV2[]
  preservePropMaterials?: boolean
}>()
const emit = defineEmits<{
  ready: [handle: ComplexBipedPropRuntimeHandle]
  released: [instanceId: string, object: Group]
}>()

const assetById = computed(() => new Map((props.propAssets || []).map(asset => [asset.id, asset])))
const renderableInstances = computed(() => (props.instances || []).flatMap(instance => {
  const asset = assetById.value.get(instance.propId)
  return asset ? [{ instance, asset }] : []
}))

function forwardReady(handle: ComplexBipedPropRuntimeHandle) {
  emit('ready', handle)
}

function forwardReleased(instanceId: string, object: Group) {
  emit('released', instanceId, object)
}
</script>

<template>
  <ComplexBipedPropInstance
    v-for="entry in renderableInstances"
    :key="`${runtime.object.uuid}:${entry.instance.instanceId}:${entry.instance.space}:${entry.instance.mountId}`"
    :runtime="runtime"
    :instance="entry.instance"
    :asset="entry.asset"
    :preserve-prop-materials="preservePropMaterials"
    @ready="forwardReady"
    @released="forwardReleased"
  />
</template>
