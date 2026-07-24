<!--
  文件职责 / File responsibility
  只负责渲染独立头型的单一连续外壳，不承载眼耳鼻嘴或动作逻辑。
  Renders one continuous independently selectable head shell and owns no eye, ear, face, or motion logic.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { BufferAttribute, SphereGeometry } from 'three'
import { CapsuleGeometry } from 'three/examples/jsm/geometries/CapsuleGeometry.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const profile = computed(() => getCloudFoxHeadProfile(props.appearance.parts.headShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)
const baseRadius = scheme.model.head.radius

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
const capsuleGeometry = new CapsuleGeometry(.78, .42, 10, 36)
const beanGeometry = createBeanGeometry()
const roundedGeometry = new RoundedBoxGeometry(1.78, 1.58, 1.52, 7, .3)
const geometry = computed(() => {
  if (profile.value.geometry === 'capsule') return capsuleGeometry
  if (profile.value.geometry === 'bean') return beanGeometry
  if (profile.value.geometry === 'rounded-cube') return roundedGeometry
  return sphereGeometry
})
const scale = computed(() => {
  const shape = profile.value.scale
  const headScale = props.appearance.proportions.headScale
  return [
    baseRadius * shape[0] * headScale,
    baseRadius * shape[1] * headScale,
    baseRadius * shape[2] * headScale,
  ] as const
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
