<!--
  文件职责 / File responsibility
  将版本化道具实体的显示锚点和根组件树组合成可复用的正式场景模型。
  Composes a versioned prop entity display anchor and root component tree into a reusable production-scene model.
-->
<script setup lang="ts">
import { Euler, Vector3 } from 'three'
import type { MotionPropStyle, StudioPropAssetV2 } from '@yk-pets/pet-core'
import StudioPropComponentNode from './StudioPropComponentNode.vue'

const props = defineProps<{ asset: StudioPropAssetV2; styleOverride?: MotionPropStyle }>()
const roots = computed(() => props.asset.components.filter(component => !component.parentId))
const display = computed(() => props.asset.anchors.find(anchor => anchor.id === 'display')?.transform || { position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] })
const modelPosition = computed(() => new Vector3(-display.value.position[0], -display.value.position[1], -display.value.position[2]))
const modelRotation = computed(() => new Euler(-display.value.rotation[0], -display.value.rotation[1], -display.value.rotation[2]))
const modelScale = computed(() => new Vector3(...display.value.scale.map(value => 1 / Math.max(.01, value)) as [number, number, number]))
</script>

<template>
  <TresGroup :position="modelPosition" :rotation="modelRotation" :scale="modelScale">
    <StudioPropComponentNode v-for="component in roots" :key="component.id" :component="component" :components="asset.components" :style-override="styleOverride" />
  </TresGroup>
</template>
