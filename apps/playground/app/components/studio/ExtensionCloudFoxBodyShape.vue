<!--
  文件职责 / File responsibility
  以单一连续网格渲染六种身体轮廓；所有几何均使用统一单位包围盒，供共享表面采样精确匹配。
  Renders six body silhouettes as one continuous mesh; every geometry uses a normalized unit envelope so shared surface sampling matches it exactly.
-->
<script setup lang="ts">
import { BufferAttribute, LatheGeometry, SphereGeometry, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { getCloudFoxBodyProfile } from '~/domain/cloud-fox-shape-profile'
import { resolvePetCustomization } from '~/domain/pet-part-customization'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'

const props = defineProps<{ appearance: MultiSpeciesAppearanceRecipe }>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const profile = computed(() => getCloudFoxBodyProfile(props.appearance.parts.bodyShape))
const colors = computed(() => resolvePetCustomization(props.appearance).colors)

function createBeanGeometry() {
  const geometry = new SphereGeometry(1, 72, 52)
  const position = geometry.getAttribute('position') as BufferAttribute
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const bend = Math.sin((y + 1) * Math.PI * .7) * .13
    const waist = 1 - .09 * Math.exp(-Math.pow(y - .18, 2) / .1)
    position.setXYZ(index, x * waist + bend, y, z * (1 - .025 * Math.abs(y)))
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

const sphereGeometry = new SphereGeometry(1, 72, 52)
const capsuleGeometry = new LatheGeometry([
  new Vector2(.06, -1), new Vector2(.42, -.94), new Vector2(.7, -.72), new Vector2(.76, -.46),
  new Vector2(.76, .46), new Vector2(.7, .72), new Vector2(.42, .94), new Vector2(.06, 1),
], 72)
const pearGeometry = new LatheGeometry([
  new Vector2(.18, -1), new Vector2(.62, -.86), new Vector2(.92, -.52), new Vector2(1, -.12),
  new Vector2(.9, .28), new Vector2(.66, .68), new Vector2(.3, .96), new Vector2(.08, 1.03),
], 72)
const beanGeometry = createBeanGeometry()
const roundedGeometry = new RoundedBoxGeometry(2, 2, 2, 8, .34)
const geometry = computed(() => {
  if (profile.value.geometry === 'capsule') return capsuleGeometry
  if (profile.value.geometry === 'pear') return pearGeometry
  if (profile.value.geometry === 'bean') return beanGeometry
  if (profile.value.geometry === 'rounded-cube') return roundedGeometry
  return sphereGeometry
})
const position = computed(() => {
  const offset = profile.value.offset
  return new Vector3(
    scheme.model.body.position[0] + offset[0] * props.appearance.proportions.bodyWidth,
    scheme.model.body.position[1] + offset[1] * props.appearance.proportions.bodyHeight,
    scheme.model.body.position[2] + offset[2] * props.appearance.proportions.bodyDepth,
  )
})
const scale = computed(() => {
  const body = scheme.model.body.scale
  const shape = profile.value.scale
  const radius = scheme.model.body.radius
  return new Vector3(
    body[0] * radius * props.appearance.proportions.bodyWidth * shape[0],
    body[1] * radius * props.appearance.proportions.bodyHeight * shape[1],
    body[2] * radius * props.appearance.proportions.bodyDepth * shape[2],
  )
})

onBeforeUnmount(() => {
  sphereGeometry.dispose()
  capsuleGeometry.dispose()
  pearGeometry.dispose()
  beanGeometry.dispose()
  roundedGeometry.dispose()
})
</script>

<template>
  <TresMesh :geometry="geometry" :position="position" :scale="scale" cast-shadow receive-shadow>
    <TresMeshStandardMaterial :color="colors.body" :roughness=".34" :metalness=".035" />
  </TresMesh>
</template>
