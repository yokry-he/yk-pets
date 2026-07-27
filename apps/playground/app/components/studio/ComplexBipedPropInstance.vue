<!--
  文件职责 / File responsibility
  先让 Tres 在普通父树中完整创建单个道具模型，再把完整 Group 重挂到复杂 runtime 的真实语义目标。
  不能使用 Tres custom attach：跨 Vue 组件子树时它会让 StudioPropModel 的 host children 丢失。
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, StudioPropAssetV2 } from '@yk-pets/pet-core'
import { Euler, Group, Vector3, type Object3D } from 'three'
import type { ComplexBipedPetObject } from '~/three/create-complex-biped-pet-object'
import { resolveComplexBipedPropMount } from '~/three/complex-biped-prop-mounts'
import StudioPropModel from './StudioPropModel.vue'

const props = defineProps<{
  runtime: ComplexBipedPetObject
  instance: EvaluatedMotionPropInstance
  asset: StudioPropAssetV2
  preservePropMaterials?: boolean
}>()

const groupRef = shallowRef<Group>()
let target: Object3D | undefined
const position = computed(() => new Vector3(...props.instance.transform.position))
const rotation = computed(() => new Euler(...props.instance.transform.rotation))
const scale = computed(() => new Vector3(...props.instance.transform.scale))

onMounted(async () => {
  // nextTick 保证 StudioPropModel 的 Mesh 子树已进入普通 TresGroup，再整体移动，避免跨组件 attach 丢子节点。
  await nextTick()
  const group = groupRef.value
  if (!group) return
  target = resolveComplexBipedPropMount(props.runtime, props.instance).object
  target.add(group)
})

onBeforeUnmount(() => {
  const group = groupRef.value
  if (group && target && group.parent === target) target.remove(group)
  target = undefined
})
</script>

<template>
  <TresGroup ref="groupRef" :visible="instance.exists && instance.visible" :position="position" :rotation="rotation" :scale="scale">
    <StudioPropModel :asset="asset" :style-override="preservePropMaterials ? undefined : instance.style" />
  </TresGroup>
</template>
