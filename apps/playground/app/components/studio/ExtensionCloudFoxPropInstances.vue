<!--
  文件职责 / File responsibility
  在唯一正式云狐场景中渲染道具事件求值后的本地实例，支持挂点和世界空间而不创建第二个 WebGL 场景。
  Renders locally evaluated prop-event instances inside the sole production Cloud Fox scene, supporting mount and world space without a second WebGL scene.
-->
<script setup lang="ts">
import type { EvaluatedMotionPropInstance, MotionPropMountId } from '@yk-pets/pet-core'
import { Euler, Vector3 } from 'three'
import type { StudioPropAssetMetadata } from '~/domain/studio-workspace'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  instances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly StudioPropAssetMetadata[]
}>()
const assetById = computed(() => new Map((props.propAssets || []).map(asset => [asset.id, asset])))
const particleOffsets = [[-.12,.06,0],[.11,.12,.03],[0,.2,-.04],[-.07,.27,.02],[.09,.32,0],[.02,.4,.04]] as const

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
function vector(value: readonly [number, number, number]): Vector3 { return new Vector3(...value) }
function asset(instance: EvaluatedMotionPropInstance) { return assetById.value.get(instance.propId) }
</script>

<template>
  <TresGroup v-for="instance in instances || []" :key="instance.instanceId" :visible="instance.visible" :position="position(instance)" :rotation="rotation(instance)" :scale="scaleVector(instance)">
    <template v-if="asset(instance)?.kind === 'effect'">
      <TresMesh><TresIcosahedronGeometry :args="[.2,2]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow" transparent :opacity="instance.style.opacity" /></TresMesh>
      <TresPointLight :color="instance.style.color" :intensity="instance.style.glow * .8" :distance="2" />
      <TresMesh v-for="(offset,index) in particleOffsets.slice(0, Math.ceil(instance.style.particleRate / 40))" :key="index" :position="vector(offset)"><TresSphereGeometry :args="[.035,10,10]" /><TresMeshBasicMaterial :color="instance.style.color" transparent :opacity="instance.style.opacity * .7" /></TresMesh>
    </template>
    <template v-else>
      <TresMesh cast-shadow><TresBoxGeometry :args="[.34,.2,.18]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow" :metalness=".2" :roughness=".28" transparent :opacity="instance.style.opacity" /></TresMesh>
      <TresMesh :rotation="[Math.PI/2,0,0]"><TresTorusGeometry :args="[.13,.025,12,24]" /><TresMeshStandardMaterial :color="instance.style.color" :emissive="instance.style.color" :emissive-intensity="instance.style.glow * .5" /></TresMesh>
    </template>
  </TresGroup>
</template>
