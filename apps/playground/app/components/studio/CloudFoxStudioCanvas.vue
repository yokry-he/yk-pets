<!--
  文件职责 / File responsibility
  装配 Studio 实时预览，并用独立身体/头型 Profile 计算稳定且不随编辑分区变化的相机边界。
  Assembles Studio live preview and uses independent body/head profiles for camera bounds that remain stable across editor sections.
-->
<script lang="ts">
/**
 * 唯一 3D 画布输出的轻量语义投影；坐标相对画布左上角，不携带任何 Three.js 实例。
 */
export interface StudioMotionPartAnchor {
  readonly bodyPartId: import('@yk-pets/pet-core').MotionBodyPartId
  readonly x: number
  readonly y: number
  readonly depth: number
  readonly visible: boolean
}
</script>

<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { Euler, Vector3 } from 'three'
import ComplexBipedPetRenderer from './ComplexBipedPetRenderer.vue'
import ProceduralPet from './ProceduralPet.vue'
import PetSceneEffects from './PetSceneEffects.vue'
import { EXTENSION_CLASSIC_CLOUD_FOX_SCHEME } from '~/domain/chrome-extension-cloud-fox-profile'
import { calculatePetStudioVisualBounds } from '~/domain/pet-studio-phase2'
import { getCloudFoxBodyProfile, getCloudFoxHeadProfile } from '~/domain/cloud-fox-shape-profile'
import { createExtensionClassicAppearance, createExtensionClassicScene, isExtensionClassicScene } from '~/domain/extension-cloud-fox-default'
import { createDefaultPetScene, getPetScenePreset, resolveSceneContrast, type PetSceneRecipe } from '~/domain/pet-scene'
import { normalizeBipedPetModelRecipe, type CharacterModelRecipeV1, type CompiledCharacterModel, type EvaluatedCloudFoxPose, type EvaluatedMotionPropInstance, type MotionBodyPartId, type StudioMotionAssetV2 } from '@yk-pets/pet-core'
import type { ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase4'
import type { MultiSpeciesAppearanceRecipe } from '~/domain/pet-species-registry'
import type { StudioModelMode } from '~/domain/studio-model-variants'

const props = withDefaults(defineProps<{
  appearance: MultiSpeciesAppearanceRecipe
  behavior: ExtensionCloudFoxMotionId
  motionKey?: number
  view: CloudFoxStudioView
  background: CloudFoxStudioBackground
  scene?: PetSceneRecipe
  focus?: 'full' | 'head' | 'body' | 'tail'
  customPose?: EvaluatedCloudFoxPose | null
  propInstances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly import('~/domain/studio-workspace').StudioPropAssetMetadata[]
  preservePropMaterials?: boolean
  onionPoses?: readonly EvaluatedCloudFoxPose[]
  motionPathPoints?: readonly (readonly [number, number, number])[]
  previewScale?: number
  previewRotation?: readonly [number, number, number]
  previewPosition?: readonly [number, number, number]
  modelMode?: StudioModelMode
  complexRecipe?: CharacterModelRecipeV1
  complexPetId?: string
  motionAsset?: StudioMotionAssetV2 | null
  motionTimeMs?: number
  motionWeight?: number
  editableParts?: readonly MotionBodyPartId[]
}>(), {
  motionKey: 0,
  focus: 'full',
  previewScale: 1,
  previewRotation: () => [0, 0, 0],
  previewPosition: () => [0, 0, 0],
  modelMode: 'simple',
  complexPetId: 'active-appearance',
  motionTimeMs: 0,
  motionWeight: 1,
})
type ComplexCompilationPayload = Pick<CompiledCharacterModel, 'hash' | 'status' | 'diagnostics'>
const emit = defineEmits<{
  'complex-compiled': [payload: ComplexCompilationPayload]
  'part-anchors': [anchors: readonly StudioMotionPartAnchor[]]
}>()
const scheme = EXTENSION_CLASSIC_CLOUD_FOX_SCHEME
const vec3 = (value: readonly number[]) => new Vector3(value[0] || 0, value[1] || 0, value[2] || 0)
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const CANONICAL_VIEW_YAW: Readonly<Record<CloudFoxStudioView, number>> = {
  front: 0,
  left: Math.PI / 2,
  back: Math.PI,
  right: -Math.PI / 2,
}
const legacyScene = computed(() => props.background === 'light'
  ? { ...createDefaultPetScene(), background: '#eef1ff', backgroundSecondary: '#ffffff', contrastMode: 'light' as const }
  : props.background === 'web'
    ? getPetScenePreset('neon-hangar')
    : createExtensionClassicScene())
const activeScene = computed(() => props.scene || legacyScene.value)
const prefersDark = ref(true)
onMounted(() => { prefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches })
const contrast = computed(() => resolveSceneContrast(activeScene.value, prefersDark.value))
const clearColor = computed(() => activeScene.value.transparent ? '#000000' : activeScene.value.background)
const extensionScene = computed(() => isExtensionClassicScene(activeScene.value))
const canvasDpr = computed<[number, number]>(() => [scheme.scene.camera.normalDpr[0], scheme.scene.camera.normalDpr[1]])
const complexCompilation = shallowRef<ComplexCompilationPayload>()
const complexPreviewBlocked = ref(false)
function complexRecipeSignature(recipe: CharacterModelRecipeV1 | undefined) {
  if (!recipe) return ''
  const normalized = normalizeBipedPetModelRecipe(recipe)
  const { updatedAt: _updatedAt, ...stableRecipe } = normalized
  return JSON.stringify(stableRecipe)
}
// 宠物身份与轻量配方签名共同决定预览状态；同配方摘要回写不会重置，新宠物或真实配方变化才会重置。 / Pet identity plus a lightweight recipe signature owns preview state; summary writes for the same recipe do not reset it, while a new pet or real recipe change does.
const complexPreviewKey = computed(() => `${props.complexPetId.trim() || 'active-appearance'}:${complexRecipeSignature(props.complexRecipe)}`)
// 固定视角提供绝对朝向；拖拽产生的自由旋转只作为该朝向上的偏移。 / Canonical views set the absolute yaw, while pointer drag contributes only an offset on that yaw.
const complexPreviewRotation = computed<readonly [number, number, number]>(() => [
  props.previewRotation[0],
  CANONICAL_VIEW_YAW[props.view] + props.previewRotation[1],
  props.previewRotation[2],
])
// TresGroup.rotation 是只读 Euler；传入 Euler 保留固定视角与自由旋转的既有组合，且避免以 Vector3 覆盖该对象。
const complexPreviewEuler = computed(() => new Euler(...complexPreviewRotation.value))
const showComplexRenderer = computed(() => props.modelMode === 'complex' && Boolean(props.complexRecipe) && !complexPreviewBlocked.value)
const complexPreviewStatus = computed(() => {
  if (props.modelMode !== 'complex' || !props.complexRecipe) return undefined
  if (complexPreviewBlocked.value) return { title: '复杂模型生成失败', detail: '生成失败，已回退简单模型', blocked: true }
  if (complexCompilation.value?.status === 'ready') return { title: '复杂模型已就绪', detail: '正在显示复杂双足萌宠', blocked: false }
  return { title: '正在生成复杂模型', detail: '正在编译站内双足萌宠配方', blocked: false }
})

function onComplexCompilation(payload: ComplexCompilationPayload) {
  complexCompilation.value = {
    hash: payload.hash,
    status: payload.status,
    diagnostics: payload.diagnostics.map(diagnostic => ({ ...diagnostic })),
  }
  if (payload.status === 'blocked') complexPreviewBlocked.value = true
  emit('complex-compiled', complexCompilation.value)
}

watch(() => [props.modelMode, complexPreviewKey.value] as const, () => {
  complexCompilation.value = undefined
  complexPreviewBlocked.value = false
})

function resolvedBounds(appearance: MultiSpeciesAppearanceRecipe) {
  const base = calculatePetStudioVisualBounds(appearance as never)
  const body = getCloudFoxBodyProfile(appearance.parts.bodyShape)
  const head = getCloudFoxHeadProfile(appearance.parts.headShape)
  const widthScale = Math.max(body.boundsScale[0], head.boundsScale[0])
  const heightScale = Math.max(body.boundsScale[1], head.boundsScale[1])
  const depthScale = Math.max(body.boundsScale[2], head.boundsScale[2])
  return {
    centerY: base.centerY + head.offset[1] * .35,
    width: base.width * widthScale,
    height: base.height * heightScale,
    depth: base.depth * depthScale,
  }
}
const petBounds = computed(() => resolvedBounds(props.appearance))
const referenceBounds = resolvedBounds(createExtensionClassicAppearance())
const fitRatio = computed(() => Math.max(
  petBounds.value.width / referenceBounds.width,
  petBounds.value.height / referenceBounds.height,
  petBounds.value.depth / referenceBounds.depth,
))
const cameraFactor = computed(() => clamp(fitRatio.value, .82, 1.5))
const cameraPosition = computed(() => {
  const base = scheme.scene.camera.normalPosition
  return vec3([
    base[0],
    base[1] + (petBounds.value.centerY - referenceBounds.centerY),
    base[2] * cameraFactor.value * .88,
  ])
})
const sceneStyle = computed(() => ({
  '--scene-a': activeScene.value.background,
  '--scene-b': activeScene.value.backgroundSecondary,
  '--extension-surface': scheme.scene.containerBackground,
  '--extension-nebula': scheme.scene.nebulaBackground,
  '--extension-glow': scheme.scene.glowBackground,
}))

const canvasRoot = ref<HTMLElement>()
let canvasResizeObserver: ResizeObserver | undefined

type SemanticWorldAnchor = readonly [number, number, number]
const SEMANTIC_WORLD_ANCHORS: Readonly<Partial<Record<MotionBodyPartId, SemanticWorldAnchor>>> = Object.freeze({
  root: [0, -.12, 0],
  body: [0, -.28, .44],
  head: [0, .98, .5],
  'front-paw-left': [-.58, -.42, .72],
  'front-paw-right': [.58, -.42, .72],
  'hind-paw-left': [-.42, -1.23, .34],
  'hind-paw-right': [.42, -1.23, .34],
  'ear-left': [-.56, 1.64, .34],
  'ear-right': [.56, 1.64, .34],
  'tail-root': [-.72, -.42, -.3],
  'tail-mid': [-1.14, -.1, -.34],
  'tail-tip': [-1.55, .36, -.28],
})

function poseValue(channelId: string) {
  const value = props.customPose?.values[channelId as keyof EvaluatedCloudFoxPose['values']]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 锚点与渲染器共享同一语义 Rig、固定视角和预览变换。这里用保守的语义关节中心投影，
 * 避免把 Three 节点或另一条渲染循环泄漏给 DOM 交互层。
 */
function semanticWorldAnchor(partId: MotionBodyPartId): SemanticWorldAnchor | undefined {
  const base = SEMANTIC_WORLD_ANCHORS[partId]
  if (!base) return undefined
  let [x, y, z] = base
  const rootX = poseValue('root.position.x') * .45
  const rootY = poseValue('root.position.y') * .45
  const rootZ = poseValue('root.position.z') * .45
  x += rootX
  y += rootY
  z += rootZ
  if (partId !== 'root') {
    x += poseValue('body.position.x') * .45
    y += poseValue('body.position.y') * .45
    z += poseValue('body.position.z') * .45
  }
  if (partId === 'head' || partId === 'ear-left' || partId === 'ear-right') {
    x += poseValue('head.position.x') * .45
    y += poseValue('head.position.y') * .45
    z += poseValue('head.position.z') * .45
  }
  const limbPrefix = partId === 'front-paw-left' ? 'frontPaw.left'
    : partId === 'front-paw-right' ? 'frontPaw.right'
      : partId === 'hind-paw-left' ? 'hindPaw.left'
        : partId === 'hind-paw-right' ? 'hindPaw.right'
          : undefined
  if (limbPrefix) {
    x += Math.sin(poseValue(`${limbPrefix}.rotation.z`)) * .34
    y -= Math.sin(poseValue(`${limbPrefix}.rotation.x`)) * .3
    z += Math.sin(poseValue(`${limbPrefix}.rotation.y`)) * .3
  }
  const tailPrefix = partId === 'tail-root' ? 'tail.root'
    : partId === 'tail-mid' ? 'tail.mid'
      : partId === 'tail-tip' ? 'tail.tip'
        : undefined
  if (tailPrefix) {
    x -= Math.sin(poseValue(`${tailPrefix}.rotation.z`)) * .38
    y += Math.sin(poseValue(`${tailPrefix}.rotation.x`)) * .3
  }
  return [x, y, z]
}

function projectSemanticAnchor(partId: MotionBodyPartId, width: number, height: number): StudioMotionPartAnchor | undefined {
  const world = semanticWorldAnchor(partId)
  if (!world) return undefined
  const yaw = CANONICAL_VIEW_YAW[props.view] + props.previewRotation[1]
  const pitch = props.previewRotation[0]
  const yawX = world[0] * Math.cos(yaw) + world[2] * Math.sin(yaw)
  const yawZ = -world[0] * Math.sin(yaw) + world[2] * Math.cos(yaw)
  const pitchedY = world[1] * Math.cos(pitch) - yawZ * Math.sin(pitch)
  const pitchedDepth = world[1] * Math.sin(pitch) + yawZ * Math.cos(pitch)
  const scale = clamp(props.previewScale, .25, 1.5)
  const x = width * .5 + yawX * Math.min(width, height) * .19 * scale + props.previewPosition[0] * width * .04
  const y = height * .51 - pitchedY * Math.min(width, height) * .19 * scale - props.previewPosition[1] * height * .04
  const edge = 12
  return Object.freeze({
    bodyPartId: partId,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    depth: Number(pitchedDepth.toFixed(4)),
    visible: x >= edge && x <= width - edge && y >= edge && y <= height - edge,
  })
}

function publishPartAnchors() {
  const element = canvasRoot.value
  if (!element || !props.editableParts?.length) {
    emit('part-anchors', Object.freeze([]))
    return
  }
  const bounds = element.getBoundingClientRect()
  if (!(bounds.width > 0 && bounds.height > 0)) return
  const anchors = props.editableParts
    .map(partId => projectSemanticAnchor(partId, bounds.width, bounds.height))
    .filter((anchor): anchor is StudioMotionPartAnchor => Boolean(anchor))
  emit('part-anchors', Object.freeze(anchors))
}

const anchorProjectionSignal = computed(() => JSON.stringify({
  editableParts: props.editableParts,
  view: props.view,
  previewScale: props.previewScale,
  previewRotation: props.previewRotation,
  previewPosition: props.previewPosition,
  pose: props.customPose?.values,
}))

watch(anchorProjectionSignal, () => nextTick(publishPartAnchors), { immediate: true })
onMounted(() => {
  canvasResizeObserver = new ResizeObserver(publishPartAnchors)
  if (canvasRoot.value) canvasResizeObserver.observe(canvasRoot.value)
  publishPartAnchors()
})
onBeforeUnmount(() => canvasResizeObserver?.disconnect())
</script>

<template>
  <div ref="canvasRoot" :class="['studio-canvas', `studio-canvas--${contrast}`, { 'studio-canvas--extension': extensionScene }]" :style="sceneStyle" :data-visual-scheme="scheme.id" :data-focus="focus" :data-model-mode="modelMode">
    <div v-if="!activeScene.transparent" class="scene-surface" />
    <div v-if="!activeScene.transparent" class="scene-gradient" />
    <div v-if="extensionScene" class="extension-nebula" />
    <TresCanvas :clear-color="clearColor" :clear-alpha="activeScene.transparent ? 0 : 1" :dpr="canvasDpr" alpha antialias shadows>
      <TresPerspectiveCamera :position="cameraPosition" :fov="scheme.scene.camera.normalFov" />
      <TresAmbientLight :intensity="contrast === 'light' ? 1.7 : scheme.scene.lights.ambientIntensity" />
      <TresDirectionalLight :position="vec3(scheme.scene.lights.directionalPosition)" :intensity="contrast === 'light' ? 2.7 : scheme.scene.lights.directionalIntensity" cast-shadow />
      <TresPointLight :position="vec3(scheme.scene.lights.primaryPosition)" :intensity="scheme.scene.lights.primaryIntensity" :color="appearance.palette.primaryGlow" />
      <TresPointLight :position="vec3(scheme.scene.lights.secondaryPosition)" :intensity="scheme.scene.lights.secondaryIntensity" :color="appearance.palette.secondaryGlow" />
      <PetSceneEffects :scene="activeScene" :behavior="behavior" />
      <TresGroup v-if="showComplexRenderer" :position="vec3(previewPosition)" :rotation="complexPreviewEuler" :scale="vec3([previewScale, previewScale, previewScale])">
        <ComplexBipedPetRenderer :key="complexPreviewKey" :recipe="complexRecipe!" :prop-instances="propInstances" :prop-assets="propAssets" :preserve-prop-materials="preservePropMaterials" :motion-asset="motionAsset" :motion-time-ms="motionTimeMs" :motion-weight="motionWeight" @compilation="onComplexCompilation" />
      </TresGroup>
      <ProceduralPet v-else :appearance="appearance" :behavior="behavior" :motion-key="motionKey" :view="view" :custom-pose="customPose" :prop-instances="propInstances" :prop-assets="propAssets" :preserve-prop-materials="preservePropMaterials" :onion-poses="onionPoses" :motion-path-points="motionPathPoints" :preview-scale="previewScale" :preview-rotation="previewRotation" :preview-position="previewPosition" />
    </TresCanvas>
    <div v-if="extensionScene" class="extension-glow" />
    <div v-if="complexPreviewStatus" class="model-preview-status" :class="{ 'model-preview-status--blocked': complexPreviewStatus.blocked }" aria-label="复杂模型预览状态">
      <strong class="model-preview-status-title">{{ complexPreviewStatus.title }}</strong>
      <span class="model-preview-status-detail">{{ complexPreviewStatus.detail }}</span>
    </div>
    <div class="label">
      <strong>{{ appearance.identity.nameZh }} · {{ appearance.identity.nameEn }}</strong>
      <span>{{ appearance.parts.headShape }} / {{ appearance.parts.bodyShape }} · {{ petBounds.width.toFixed(1) }} × {{ petBounds.height.toFixed(1) }}</span>
    </div>
  </div>
</template>

<style scoped>
.studio-canvas{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden;border:1px solid #ffffff1f;border-radius:22px;background:transparent;box-shadow:0 28px 80px #0006}.scene-surface{position:absolute;inset:0;background:linear-gradient(145deg,var(--scene-a),var(--scene-b))}.scene-gradient{position:absolute;inset:0;background:radial-gradient(circle at 70% 15%,color-mix(in srgb,var(--scene-b) 76%,transparent),transparent 38%)}.studio-canvas--extension .scene-surface{background:var(--extension-surface)}.studio-canvas--extension .scene-gradient{display:none}.extension-nebula{position:absolute;inset:2% 4% 8%;border-radius:50%;background:var(--extension-nebula);filter:blur(10px);opacity:.92;pointer-events:none}.extension-glow{position:absolute;z-index:3;inset:auto 14% -18px;height:78px;background:var(--extension-glow);filter:blur(16px);pointer-events:none}.studio-canvas :deep(canvas){position:absolute!important;inset:0;z-index:2;width:100%!important;height:100%!important;background:transparent!important}.model-preview-status{position:absolute;z-index:5;top:14px;left:14px;display:grid;gap:3px;max-width:calc(100% - 28px);padding:8px 10px;border:1px solid #e5c76248;border-radius:10px;background:#090d18d9;backdrop-filter:blur(14px);pointer-events:none}.model-preview-status--blocked{border-color:#ff7f9d62}.model-preview-status-title{color:#f0d78c;font-size:9px}.model-preview-status--blocked .model-preview-status-title{color:#ff9bb3}.model-preview-status-detail{color:#9ba6c1;font-size:8px}.label{position:absolute;z-index:4;left:18px;bottom:18px;display:flex;flex-direction:column;gap:4px;max-width:calc(100% - 36px);padding:9px 12px;border:1px solid #ffffff24;border-radius:12px;color:#f5f7ff;background:#080b14a8;backdrop-filter:blur(16px)}.studio-canvas--light .label{color:#17192b;background:#ffffffe0}.label span{overflow:hidden;color:#aeb7d8;font-size:11px;text-overflow:ellipsis;white-space:nowrap}@media(max-width:980px){.studio-canvas{min-height:460px}}
</style>
