<!--
  文件职责 / File responsibility
  按统一视觉规格渲染单只眼睛；星芒使用真实星形实体和对比轮廓，所有非圆形眼睛保留最小可见尺寸。
  Renders one eye from shared visual metrics; spark eyes use a real star solid with a contrast outline and every non-round eye preserves a minimum visible size.
-->
<script setup lang="ts">
import { CatmullRomCurve3, ExtrudeGeometry, Shape, Vector3 } from 'three'
import { getCloudFoxEyeStyleMetrics } from '~/domain/cloud-fox-eye-metrics'

const props = defineProps<{
  style: string
  color: string
  highlightColor: string
  side: number
  eyeScale: number
  pupilScale: number
}>()
const vector = (values: readonly number[]) => new Vector3(values[0] || 0, values[1] || 0, values[2] || 0)
const metric = computed(() => getCloudFoxEyeStyleMetrics(props.style))
const sleepyCurve = new CatmullRomCurve3([
  vector([-.18, -.015, 0]), vector([-.09, .052, .012]), vector([0, .07, .018]),
  vector([.09, .052, .012]), vector([.18, -.015, 0]),
])
const happyCurve = new CatmullRomCurve3([
  vector([-.19, -.02, 0]), vector([-.1, .065, .01]), vector([0, .085, .018]),
  vector([.1, .065, .01]), vector([.19, -.02, 0]),
])
const sharpCurve = computed(() => new CatmullRomCurve3(props.style === 'angry'
  ? [vector([-.19, -.055, 0]), vector([0, .035, .016]), vector([.19, .075, 0])]
  : [vector([-.19, .075, 0]), vector([0, .035, .016]), vector([.19, -.055, 0])]))
const spiralCurve = new CatmullRomCurve3(Array.from({ length: 34 }, (_, index) => {
  const progress = index / 33
  const angle = progress * Math.PI * 5
  const radius = .025 + progress * .16
  return vector([Math.cos(angle) * radius, Math.sin(angle) * radius, progress * .018])
}))

function createStarGeometry(outerRadius: number, innerRadius: number, depth: number) {
  const shape = new Shape()
  for (let index = 0; index < 16; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = -Math.PI / 2 + index * Math.PI / 8
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: .012,
    bevelThickness: .01,
  })
  geometry.center()
  return geometry
}

function createHeartGeometry() {
  const shape = new Shape()
  shape.moveTo(0, -.18)
  shape.bezierCurveTo(-.23, -.02, -.22, .18, -.08, .18)
  shape.bezierCurveTo(0, .18, 0, .1, 0, .08)
  shape.bezierCurveTo(0, .1, 0, .18, .08, .18)
  shape.bezierCurveTo(.22, .18, .23, -.02, 0, -.18)
  const geometry = new ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSegments: 2, bevelSize: .01, bevelThickness: .008 })
  geometry.center()
  return geometry
}

function contrastColor(hex: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '141629'
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  return red * .299 + green * .587 + blue * .114 > .58 ? '#15172b' : '#f7f9ff'
}

const sparkGeometry = createStarGeometry(.21, .085, .055)
const sparkOutlineGeometry = createStarGeometry(.235, .095, .048)
const heartGeometry = createHeartGeometry()
const outlineColor = computed(() => contrastColor(props.color))

onBeforeUnmount(() => {
  sparkGeometry.dispose()
  sparkOutlineGeometry.dispose()
  heartGeometry.dispose()
})
</script>

<template>
  <TresGroup :scale="vector([eyeScale, eyeScale, eyeScale])">
    <template v-if="style === 'spark'">
      <TresMesh :geometry="sparkOutlineGeometry" :position="vector([0, 0, -.012])">
        <TresMeshBasicMaterial :color="outlineColor" :tone-mapped="false" />
      </TresMesh>
      <TresMesh :geometry="sparkGeometry">
        <TresMeshStandardMaterial :color="color" :emissive="highlightColor" :emissive-intensity=".18" :roughness=".12" :metalness=".04" />
      </TresMesh>
      <TresMesh :position="vector([side * -.028, .052, .072])" :scale="vector([.034, .044, .018])">
        <TresSphereGeometry /><TresMeshBasicMaterial :color="highlightColor" :tone-mapped="false" />
      </TresMesh>
    </template>

    <template v-else-if="style === 'diamond'">
      <TresMesh :scale="vector([metric.width / 2, metric.height / 2, metric.depth / 2])">
        <TresOctahedronGeometry :args="[1, 0]" />
        <TresMeshStandardMaterial :color="color" :emissive="highlightColor" :emissive-intensity=".2" :roughness=".06" :metalness=".12" flat-shading />
      </TresMesh>
      <TresMesh :position="vector([side * -.028, .065, .095])" :scale="vector([.028, .055, .02])"><TresSphereGeometry /><TresMeshBasicMaterial :color="highlightColor" /></TresMesh>
    </template>

    <TresMesh v-else-if="style === 'sleepy' || style === 'happy-crescent'">
      <TresTubeGeometry :args="[style === 'happy-crescent' ? happyCurve : sleepyCurve, 28, .026, 10, false]" />
      <TresMeshBasicMaterial :color="color" />
    </TresMesh>

    <TresMesh v-else-if="style === 'angry' || style === 'sad'">
      <TresTubeGeometry :args="[sharpCurve, 24, .032, 10, false]" />
      <TresMeshBasicMaterial :color="color" />
    </TresMesh>

    <TresMesh v-else-if="style === 'heart'" :geometry="heartGeometry">
      <TresMeshStandardMaterial :color="color" :emissive="highlightColor" :emissive-intensity=".22" :roughness=".14" />
    </TresMesh>

    <TresMesh v-else-if="style === 'spiral'">
      <TresTubeGeometry :args="[spiralCurve, 48, .022, 10, false]" />
      <TresMeshStandardMaterial :color="color" :emissive="highlightColor" :emissive-intensity=".18" :roughness=".16" />
    </TresMesh>

    <template v-else-if="style === 'surprised' || style === 'round' || style === 'oval'">
      <TresMesh :scale="vector([metric.width / 2, metric.height / 2, metric.depth / 2])">
        <TresSphereGeometry :args="[1, 32, 24]" />
        <TresMeshStandardMaterial :color="color" :roughness=".08" />
      </TresMesh>
      <TresMesh :position="vector([side * -.035, .035, metric.depth * .44])" :scale="vector([.035 * pupilScale, .045 * pupilScale, .018])">
        <TresSphereGeometry /><TresMeshBasicMaterial :color="highlightColor" :tone-mapped="false" />
      </TresMesh>
    </template>
    <template v-else>
      <TresMesh :scale="vector([metric.width / 2, metric.height / 2, metric.depth / 2])"><TresSphereGeometry :args="[1, 32, 24]" /><TresMeshStandardMaterial :color="color" :roughness=".08" /></TresMesh>
    </template>
  </TresGroup>
</template>
