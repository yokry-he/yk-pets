<!--
  文件职责 / File responsibility
  先让 Tres 在普通父树中完整创建单个道具模型，再把完整 Group 重挂到复杂 runtime 的真实语义目标。
  不能使用 Tres custom attach：跨 Vue 组件子树时它会让 StudioPropModel 的 host children 丢失。
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, StudioPropAssetV2 } from '@yk-pets/pet-core'
import { Euler, Group, Vector3 } from 'three'
import type { ComplexBipedPetObject } from '~/three/create-complex-biped-pet-object'
import {
  resolveComplexBipedPropMount,
  type ComplexBipedPropRuntimeHandle,
  type ResolvedComplexBipedPropMount,
} from '~/three/complex-biped-prop-mounts'
import StudioPropModel from './StudioPropModel.vue'

const props = defineProps<{
  runtime: ComplexBipedPetObject
  instance: EvaluatedMotionPropInstance
  asset: StudioPropAssetV2
  preservePropMaterials?: boolean
}>()
const emit = defineEmits<{
  ready: [handle: ComplexBipedPropRuntimeHandle]
  released: [instanceId: string, object: Group]
}>()

const groupRef = shallowRef<Group>()
let mount: ResolvedComplexBipedPropMount | undefined
const position = computed(() => new Vector3(...props.instance.transform.position))
const rotation = computed(() => new Euler(...props.instance.transform.rotation))
const scale = computed(() => new Vector3(...props.instance.transform.scale))

function publishReadyHandle() {
  const group = groupRef.value
  if (!group || !mount || group.parent !== mount.object) return
  emit('ready', {
    instanceId: props.instance.instanceId,
    asset: props.asset,
    object: group,
    mount,
  })
}

onMounted(async () => {
  // nextTick 保证 StudioPropModel 的 Mesh 子树已进入普通 TresGroup，再整体移动，避免跨组件 attach 丢子节点。 / nextTick lets the mesh subtree enter its normal TresGroup before the whole group is reparented.
  await nextTick()
  const group = groupRef.value
  if (!group) return
  mount = resolveComplexBipedPropMount(props.runtime, props.instance)
  mount.object.add(group)
  publishReadyHandle()
})

watch(() => props.asset, async () => {
  await nextTick()
  publishReadyHandle()
}, { deep: true })

onBeforeUnmount(() => {
  const group = groupRef.value
  if (group) emit('released', props.instance.instanceId, group)
  if (group && mount && group.parent === mount.object) mount.object.remove(group)
  mount = undefined
})
</script>

<template>
  <TresGroup ref="groupRef" :visible="instance.exists && instance.visible" :position="position" :rotation="rotation" :scale="scale">
    <StudioPropModel :asset="asset" :style-override="preservePropMaterials ? undefined : instance.style" />
  </TresGroup>
</template>
