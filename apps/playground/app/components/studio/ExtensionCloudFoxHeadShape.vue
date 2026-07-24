<!--
  文件职责 / File responsibility
  只负责渲染独立头型的单一连续外壳，并恢复正式生产头部三轴比例以匹配共享表面采样。
  Renders one continuous independently selectable head shell and restores the production three-axis head proportions used by shared surface sampling.
-->
<script setup lang="ts">
import { BufferAttribute, LatheGeometry, SphereGeometry, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const profile = computed(() => getCloudFoxHeadProfile(props.appearance.parts.headShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)

function createBeanGeometry() {
  const geometry = new SphereGeometry(1, 64, 48)
  const position = geometry.getAttribute('position') as BufferAttribute
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const bend = Math.sin((y + 1) * Math.PI * .72)
    const width = 1 + .08 * Math.cos(y * Math.PI)
    position.setXYZ(index, x * width + bend * .09, y * .98, z * (1 - Math.abs(y) * .025))
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

const sphereGeometry = new SphereGeometry(1, 64, 48)
const capsuleGeometry = new LatheGeometry([
  new Vector2(.08, -1), new Vector2(.42, -.92), new Vector2(.72, -.68), new Vector2(.78, -.38),
  new Vector2(.78, .38), new Vector2(.72, .68), new Vector2(.42, .92), new Vector2(.08, 1),
], 64)
const beanGeometry = createBeanGeometry()
const roundedGeometry = new RoundedBoxGeometry(2, 2, 2, 7, .32)
const geometry = computed(() => {
  if (profile.value.geometry === 'capsule') return capsuleGeometry
  if (profile.value.geometry === 'bean') return beanGeometry
  if (profile.value.geometry === 'rounded-cube') return roundedGeometry
  return sphereGeometry
})
const scale = computed(() => {
  const base = scheme.model.head.scale
  const shape = profile.value.scale
  const radius = scheme.model.head.radius
  const headScale = props.appearance.proportions.headScale
  return new Vector3(
    base[0] * radius * shape[0] * headScale,
    base[1] * radius * shape[1] * headScale,
    base[2] * radius * shape[2] * headScale,
  )
})

onBeforeUnmount(() => {
  sphereGeometry.dispose()
  capsuleGeometry.dispose()
  beanGeometry.dispose()
  roundedGeometry.dispose()
})
</script>

<template>
  <TresMesh :geometry="geometry" :scale="scale" cast-shadow receive-shadow>
    <TresMeshStandardMaterial :color="colors.limbs" :roughness=".3" :metalness=".035" />
  </TresMesh>
</template>
