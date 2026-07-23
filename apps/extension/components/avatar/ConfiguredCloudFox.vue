<!--
  文件职责 / File responsibility
  在不复制正式 CloudFox 动作实现的前提下，将共享配方映射到其材质、比例、肚皮和胸背标志。
  Maps shared recipes onto the production CloudFox materials, proportions, belly, and symbols without duplicating its motion implementation.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import { CanvasTexture, DoubleSide, Euler, Vector3 } from 'three'
import type { Group, Material, Mesh, MeshStandardMaterial } from 'three'
import type { PetRecipeEnvelope } from '@yk-pets/pet-core'
import CloudFox from './CloudFox.vue'
import {
  resolveExtensionCloudFoxAppearance,
  type ExtensionBellyPatchStyle,
  type ExtensionCloudFoxAppearance,
} from './appearance'
import type { PetEmotion } from './types'

const props = defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  motionKey: number
  theme: 'dark' | 'light'
  recipe?: PetRecipeEnvelope | null
}>()

type PaletteRole = keyof ExtensionCloudFoxAppearance['palette']
const root = shallowRef<Group>()
const legacyCore = shallowRef<Mesh>()
const legacyBelly = shallowRef<Mesh>()
const chestTexture = shallowRef<CanvasTexture>()
const backTexture = shallowRef<CanvasTexture>()
const bellyTexture = shallowRef<CanvasTexture>()
const materialRoles = new WeakMap<Material, PaletteRole>()
const visual = computed(() => resolveExtensionCloudFoxAppearance(props.recipe))
const vector = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotation = (x: number, y: number, z: number) => new Euler(x, y, z)
let appearanceDirty = true
let appearanceRetryFrames = 0

const rootScale = computed(() => vector(
  visual.value.proportions.bodyWidth,
  visual.value.proportions.bodyHeight,
  visual.value.proportions.bodyDepth,
))
const showCore = computed(() => ['energy-core', 'hybrid'].includes(visual.value.chestDisplay.mode))
const showChestSymbol = computed(() => ['symbol', 'hybrid'].includes(visual.value.chestDisplay.mode) && visual.value.symbols.chest.enabled)
const bellyPosition = computed(() => vector(0, -.26 + visual.value.bellyPatchDesign.offsetY, .78))
const bellyScale = computed(() => vector(
  .48 * visual.value.bellyPatchDesign.width,
  .56 * visual.value.bellyPatchDesign.height,
  .07,
))
const chestPosition = computed(() => vector(
  visual.value.symbols.chest.offsetX,
  -.26 + visual.value.symbols.chest.offsetY,
  .79 + visual.value.symbols.chest.offsetZ,
))
const chestScale = computed(() => vector(
  .34 * visual.value.symbols.chest.scale,
  .34 * visual.value.symbols.chest.scale,
  .34,
))
const backPosition = computed(() => vector(
  visual.value.symbols.back.offsetX,
  -.2 + visual.value.symbols.back.offsetY,
  -.86 - visual.value.symbols.back.offsetZ,
))
const backScale = computed(() => vector(
  .48 * visual.value.symbols.back.scale,
  .48 * visual.value.symbols.back.scale,
  .48,
))

function drawBelly(context: CanvasRenderingContext2D, style: ExtensionBellyPatchStyle) {
  context.beginPath()
  if (style === 'oval') context.ellipse(128, 132, 76, 103, 0, 0, Math.PI * 2)
  else if (style === 'bean') {
    context.moveTo(86, 45); context.bezierCurveTo(45, 70, 55, 193, 120, 220); context.bezierCurveTo(190, 218, 210, 95, 165, 52); context.bezierCurveTo(142, 31, 111, 32, 86, 45)
  }
  else if (style === 'teardrop') {
    context.moveTo(128, 30); context.bezierCurveTo(190, 86, 198, 150, 128, 225); context.bezierCurveTo(58, 150, 66, 86, 128, 30)
  }
  else if (style === 'heart') {
    context.moveTo(128, 220); context.bezierCurveTo(90, 181, 52, 145, 57, 91); context.bezierCurveTo(61, 46, 111, 37, 128, 72); context.bezierCurveTo(145, 37, 195, 46, 199, 91); context.bezierCurveTo(204, 145, 166, 181, 128, 220)
  }
  else {
    context.moveTo(68, 66); context.bezierCurveTo(68, 48, 84, 40, 104, 40); context.lineTo(152, 40); context.bezierCurveTo(172, 40, 188, 48, 188, 66); context.bezierCurveTo(188, 126, 168, 190, 128, 222); context.bezierCurveTo(88, 190, 68, 126, 68, 66)
  }
  context.closePath()
  context.fill()
}

function createBellyTexture(style: ExtensionBellyPatchStyle) {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.fillStyle = '#fff'
  drawBelly(context, style)
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createSymbolTexture(text: string, color: string, glowIntensity: number) {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '900 142px system-ui'
  context.shadowColor = color
  context.shadowBlur = 18 + glowIntensity * 18
  context.fillStyle = color
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 132)
  context.shadowBlur = 6
  context.fillStyle = '#fff'
  context.globalAlpha = .55
  context.fillText(text.slice(0, 3).toUpperCase(), 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function replaceTexture(target: typeof chestTexture, next?: CanvasTexture) {
  target.value?.dispose()
  target.value = next
}

watch(
  () => [visual.value.bellyPatchDesign.mode, visual.value.bellyPatchDesign.style] as const,
  ([mode, style]) => replaceTexture(bellyTexture, mode === 'custom' ? createBellyTexture(style) : undefined),
  { immediate: true },
)
watch(
  () => visual.value.symbols.chest,
  symbol => replaceTexture(chestTexture, symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined),
  { immediate: true, deep: true },
)
watch(
  () => visual.value.symbols.back,
  symbol => replaceTexture(backTexture, symbol.enabled ? createSymbolTexture(symbol.text, symbol.color, symbol.glowIntensity) : undefined),
  { immediate: true, deep: true },
)
watch(visual, () => {
  appearanceRetryFrames = 0
  appearanceDirty = true
}, { deep: true, immediate: true })

function roleFor(material: MeshStandardMaterial): PaletteRole | undefined {
  const hex = `#${material.color.getHexString()}`
  const roles: Record<string, PaletteRole> = {
    '#e9ecff': 'coat', '#ffffff': 'coat', '#aeb6e8': 'coatShadow', '#c5cced': 'coatShadow',
    '#f9fbff': 'coatWarm', '#7066ff': 'primaryGlow', '#52e0d0': 'secondaryGlow', '#caffff': 'tailGlow',
    '#141629': 'eye', '#69708f': 'eye',
  }
  return roles[hex]
}

function applyAppearance() {
  const group = root.value
  if (!group) {
    appearanceDirty = appearanceRetryFrames < 12
    return
  }
  group.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const isClassicBelly = Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .73) < .02 && mesh.scale.z < .3
    const isEnergyCore = Math.abs(mesh.position.y + .26) < .01 && Math.abs(mesh.position.z - .74) < .02 && mesh.scale.z >= .3
    if (!legacyBelly.value && isClassicBelly) legacyBelly.value = mesh
    if (!legacyCore.value && isEnergyCore) legacyCore.value = mesh
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      const standard = material as MeshStandardMaterial
      if (!standard?.color) continue
      const role = materialRoles.get(material) || roleFor(standard)
      if (role) {
        materialRoles.set(material, role)
        standard.color.set(visual.value.palette[role])
        if (standard.emissive && ['primaryGlow', 'secondaryGlow', 'tailGlow', 'antennaGlow'].includes(role)) standard.emissive.set(visual.value.palette[role])
      }
    }
  })
  if (legacyBelly.value) legacyBelly.value.visible = visual.value.bellyPatchDesign.mode === 'model-default'
  if (legacyCore.value) {
    legacyCore.value.visible = showCore.value
    legacyCore.value.scale.setScalar(visual.value.chestDisplay.mode === 'hybrid' ? .72 : 1)
  }
  const resolved = Boolean(legacyCore.value && legacyBelly.value)
  appearanceDirty = !resolved && appearanceRetryFrames < 12
}

useLoop().onBeforeRender(() => {
  if (!appearanceDirty) return
  appearanceRetryFrames += 1
  applyAppearance()
})

onBeforeUnmount(() => {
  chestTexture.value?.dispose()
  backTexture.value?.dispose()
  bellyTexture.value?.dispose()
})
</script>

<template>
  <TresGroup ref="root" :scale="rootScale">
    <CloudFox :behavior="behavior" :emotion="emotion" :speaking="speaking" :pointer="pointer" :secret-mode="secretMode" :motion-key="motionKey" :theme="theme" />

    <TresMesh v-if="visual.bellyPatchDesign.mode === 'custom'" :position="bellyPosition" :scale="bellyScale" :render-order="3">
      <TresPlaneGeometry :args="[2, 2, 16, 20]" />
      <TresMeshStandardMaterial :color="visual.palette.coatWarm" :alpha-map="bellyTexture" transparent :alpha-test=".04" :depth-write="true" />
    </TresMesh>

    <TresGroup v-if="showChestSymbol && chestTexture" :position="chestPosition" :rotation="rotation(0, 0, visual.symbols.chest.rotation)" :scale="chestScale" :render-order="4">
      <TresPointLight :color="visual.symbols.chest.color" :intensity="visual.symbols.chest.glowIntensity * .55" />
      <TresMesh><TresPlaneGeometry /><TresMeshBasicMaterial :map="chestTexture" transparent :side="DoubleSide" :depth-write="false" /></TresMesh>
    </TresGroup>

    <TresGroup v-if="visual.symbols.back.enabled && backTexture" :position="backPosition" :rotation="rotation(0, Math.PI, visual.symbols.back.rotation)" :scale="backScale" :render-order="4">
      <TresMesh><TresPlaneGeometry /><TresMeshBasicMaterial :map="backTexture" transparent :side="DoubleSide" :depth-write="false" /></TresMesh>
    </TresGroup>
  </TresGroup>
</template>
