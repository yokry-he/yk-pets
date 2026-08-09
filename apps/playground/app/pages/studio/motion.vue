<!--
  文件职责 / File responsibility
  提供“动作意图→阶段调整→直接播放”的新手流程，并在高级编辑中保留原有专业能力。
  Provides an intent-to-stage beginner flow while preserving the existing professional tools in advanced editing.
-->
<script setup lang="ts">
import {
  deriveStudioPropRig,
  evaluateMotionPropEvents,
  evaluateNormalizedMotionAsset,
  normalizeBipedPetMotionAdaptation,
  normalizeBipedPetRootMotion,
  readSimpleMotionRecipe,
  type MotionInterpolation,
  type SimpleMotionIntent,
} from '@yk-pets/pet-core'
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioMotionAdvancedTools from '~/components/studio/StudioMotionAdvancedTools.vue'
import StudioMotionAdaptationSummary from '~/components/studio/StudioMotionAdaptationSummary.vue'
import StudioMotionDirectPad from '~/components/studio/StudioMotionDirectPad.vue'
import StudioMotionIntentPicker from '~/components/studio/StudioMotionIntentPicker.vue'
import StudioMotionPoseEditor from '~/components/studio/StudioMotionPoseEditor.vue'
import StudioMotionStageBar from '~/components/studio/StudioMotionStageBar.vue'
import StudioMotionStageInspector from '~/components/studio/StudioMotionStageInspector.vue'
import StudioMotionTransformEditor from '~/components/studio/StudioMotionTransformEditor.vue'
import StudioMotionTimeline from '~/components/studio/StudioMotionTimeline.vue'
import StudioMotionPropEvents from '~/components/studio/StudioMotionPropEvents.vue'
import StudioPreviewToolbar from '~/components/studio/StudioPreviewToolbar.vue'
import StudioRootMotionSettings from '~/components/studio/StudioRootMotionSettings.vue'
import { useStudioPreviewOrientation } from '~/composables/useStudioPreviewOrientation'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'
import { useStudioModelVariantsStore } from '~/stores/studio-model-variants'
import { useStudioSessionStore } from '~/stores/studio-session'
import type { StudioMotionLoopMode } from '~/domain/studio-workspace'
import { BUILT_IN_STUDIO_PROPS } from '~/domain/studio-built-in-props'
import { BASIC_BIPED_STUDIO_MOTIONS } from '~/domain/studio-basic-biped-motions'

type PropertyTab = 'basic' | 'pose' | 'advanced' | 'props'

definePageMeta({ layout: 'studio' })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const editor = useStudioMotionEditorStore()
const session = useStudioSessionStore()
const modelVariants = useStudioModelVariantsStore()
const currentPetId = computed(() => appearance.recipe.identity.petId.trim() || session.selectedAppearanceId || 'active-appearance')
const complexRecipe = computed(() => modelVariants.byPetId[currentPetId.value]?.complex.recipe)
const saved = computed(() => assets.motions.find(item => item.id === session.selectedMotionId))
const draft = computed(() => editor.draft)
const simpleRecipe = computed(() => draft.value ? readSimpleMotionRecipe(draft.value) : undefined)
const guidedEditing = computed(() => !showIntentPicker.value && Boolean(simpleRecipe.value) && editor.authoringMode === 'guided')
const rootMotion = computed(() => {
  if (!draft.value) return null
  const namespace = draft.value.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion?: unknown } | undefined
  return normalizeBipedPetRootMotion(namespace?.rootMotion, draft.value.durationMs).value
})
const motionAdaptation = computed(() => {
  if (!draft.value) return null
  const extensions = draft.value.extensions
  if (!extensions || !Object.hasOwn(extensions, 'yk-pets/biped-motion-adaptation/v1')) return null
  return normalizeBipedPetMotionAdaptation(extensions['yk-pets/biped-motion-adaptation/v1'], draft.value.durationMs).value
})
const allPropAssets = computed(() => [...BUILT_IN_STUDIO_PROPS, ...assets.props])
const adaptationStatus = computed<'ready' | 'compatible' | 'limited' | 'inactive'>(() => {
  const adaptation = motionAdaptation.value
  if (!adaptation || adaptation.phases.length === 0) return 'inactive'
  if (session.modelMode !== 'complex') return 'compatible'
  if (!complexRecipe.value) return 'limited'
  const assetById = new Map(allPropAssets.value.map(item => [item.id, item]))
  const rigByInstanceId = new Map(draft.value?.propEventTracks.flatMap((track) => {
    const asset = assetById.get(track.propId)
    return asset ? [[track.instanceId, deriveStudioPropRig(asset).value] as const] : []
  }))
  const constraintsReady = adaptation.constraints.every(item => Boolean(rigByInstanceId.get(item.propInstanceId)?.[item.pointId as 'secondaryGrip']))
  const effectsReady = adaptation.effectCues.every(item => item.pointIds.every(pointId => (
    Boolean(rigByInstanceId.get(item.propInstanceId)?.[pointId as 'trailStart' | 'trailEnd' | 'impactPoint'])
  )))
  return constraintsReady && effectsReady ? 'ready' : 'limited'
})
const availableProps = computed(() => allPropAssets.value.filter(item => draft.value?.propIds.includes(item.id)))
const evaluatedPose = computed(() => {
  if (!draft.value) return null
  const pose = evaluateNormalizedMotionAsset(draft.value, editor.playheadTimeMs)
  if (editor.playbackWeight >= .999) return pose
  return { ...pose, values: Object.fromEntries(Object.entries(pose.values).map(([key,value]) => [key, value * editor.playbackWeight])) as typeof pose.values }
})
const onionPoses = computed(() => {
  if (!draft.value || !editor.onionSkin) return []
  const frame = 1000 / draft.value.displayFps
  return [Math.max(0, editor.playheadTimeMs - frame), Math.min(draft.value.durationMs, editor.playheadTimeMs + frame)].map(time => evaluateNormalizedMotionAsset(draft.value!, time))
})
const motionPathPoints = computed(() => {
  if (!draft.value || !editor.showMotionPath) return []
  return Array.from({ length: 40 }, (_, index) => {
    const pose = evaluateNormalizedMotionAsset(draft.value!, draft.value!.durationMs * index / 39)
    return [pose.values['root.position.x'] * .45, pose.values['root.position.y'] * .45, pose.values['root.position.z'] * .45] as const
  })
})
const evaluatedProps = computed(() => draft.value ? evaluateMotionPropEvents(draft.value, editor.playheadTimeMs) : { instances: [], diagnostics: [] })
const status = ref('')
const pendingMotionId = ref('')
const propertyTab = ref<PropertyTab>('pose')
const showIntentPicker = ref(false)
const previewPosition = [0, .32, 0] as const
const {
  previewScale,
  previewRotation,
  previewRotationRadians,
  previewRotateSurface,
  previewDrag,
  updatePreviewRotation,
  updatePreviewScale,
  resetPreviewScale,
  selectPreviewView,
  beginPreviewRotate,
  movePreviewRotate,
  endPreviewRotate,
  cancelPreviewRotate,
} = useStudioPreviewOrientation({ excludedSelector: '.direct-pad', defaultScale: .72 })
const propEventCount = computed(() => draft.value?.propEventTracks.reduce((sum, track) => sum + track.events.length, 0) || 0)
const propertyTabs = computed<Array<{ id: PropertyTab; label: string; badge?: number }>>(() => [
  { id: 'basic', label: '基础' },
  { id: 'pose', label: '姿态', badge: editor.selectedKeyframeCount },
  { id: 'advanced', label: '高级', badge: Math.max(0, (draft.value?.layers.length || 1) - 1) },
  { id: 'props', label: '道具', badge: propEventCount.value },
])
let raf = 0
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined

const saveStateLabel = computed(() => {
  if (editor.saveState === 'saving') return '正在保存…'
  if (editor.saveState === 'failed') return '保存失败 · 点击重试'
  return '已保存'
})

function saveCurrent(message = '') {
  if (!draft.value) return
  const savedAsset = assets.replaceMotion(draft.value)
  if (!savedAsset) throw new Error('当前动作无法写回资产库。')
  editor.markSaved(savedAsset)
  status.value = message
}
function scheduleAutoSave() {
  if (!editor.isDirty) return
  editor.setSaveState('saving')
  clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    try {
      saveCurrent()
      editor.setSaveState('saved')
    }
    catch {
      editor.setSaveState('failed')
    }
  }, 500)
}
function flushAutoSave() {
  clearTimeout(autoSaveTimer)
  autoSaveTimer = undefined
  if (!editor.isDirty) return true
  try {
    saveCurrent()
    editor.setSaveState('saved')
    return true
  }
  catch {
    editor.setSaveState('failed')
    return false
  }
}
function retrySave() {
  if (editor.isDirty || editor.saveState === 'failed') scheduleAutoSave()
}
function switchMotionNow(id: string) {
  pendingMotionId.value = ''
  showIntentPicker.value = false
  session.selectMotion(id)
  const asset = assets.motions.find(item => item.id === id)
  if (asset) editor.open(asset)
  navigateTo({ path: '/studio/motion', query: { motion: id } }, { replace: true })
}
function selectMotion(id: string) {
  showIntentPicker.value = false
  if (id === editor.motionId) return
  if (!flushAutoSave()) {
    status.value = '保存失败，已留在当前动作，请重试'
    return
  }
  if (editor.requestPlaybackInterruption()) switchMotionNow(id)
  else {
    pendingMotionId.value = id
    status.value = editor.draft?.interruptionPolicy.mode === 'finish-loop' ? '将在当前循环边界切换动作' : '正在按中断策略淡出当前动作'
  }
}
function createMotion() {
  showIntentPicker.value = true
}
function createFromIntent(intent: SimpleMotionIntent) {
  if (!flushAutoSave()) {
    status.value = '保存失败，当前动作仍保留，请重试后再创建'
    return
  }
  editor.stopPlayback()
  const motion = assets.createMotionFromIntent(intent, session.selectedAppearanceId || 'active-appearance')
  switchMotionNow(motion.id)
  status.value = `已创建“${motion.nameZh}”，选择阶段即可调整`
}
function useBasicMotionTemplate(templateId: string) {
  if (!flushAutoSave()) {
    status.value = '保存失败，当前动作仍保留，请重试后再使用模板'
    return
  }
  const motion = assets.copyBuiltInMotion(templateId)
  if (!motion) return
  editor.stopPlayback()
  switchMotionNow(motion.id)
  status.value = `已创建“${motion.nameZh}”，可直接播放或继续调整`
}
function toggleAuthoringMode() {
  if (!simpleRecipe.value) return
  editor.setAuthoringMode(guidedEditing.value ? 'advanced' : 'guided')
  propertyTab.value = 'pose'
}
function patchName(field: 'nameZh' | 'nameEn', event: Event) {
  editor.updateMetadata({ [field]: (event.target as HTMLInputElement).value })
}
function patchDuration(event: Event) {
  editor.updateMetadata({ durationMs: Number((event.target as HTMLInputElement).value) })
}
function patchDisplayFps(event: Event) {
  editor.updateMetadata({ displayFps: Number((event.target as HTMLInputElement).value) })
}
function patchLoop(event: Event) {
  editor.updateMetadata({ loopMode: (event.target as HTMLSelectElement).value as StudioMotionLoopMode })
}
function setView(view: typeof session.previewView) {
  selectPreviewView(view, next => session.setPreview(next, session.previewBackground))
}
function setBackground(background: typeof session.previewBackground) { session.setPreview(session.previewView, background) }
function resetPreviewTransform() {
  resetPreviewScale()
  setView('front')
}
function applyInterpolation(value: MotionInterpolation) { editor.setSelectedInterpolation(value) }
function frame(now: number) {
  editor.advancePlayback(now)
  if (pendingMotionId.value && !editor.playing && !editor.interruptionPending) switchMotionNow(pendingMotionId.value)
  raf = requestAnimationFrame(frame)
}
function keyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.matches('input,select,textarea')) return
  const modifier = event.metaKey || event.ctrlKey
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); flushAutoSave() }
  else if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? editor.redo() : editor.undo() }
  else if (modifier && event.key.toLowerCase() === 'c') editor.copySelected()
  else if (modifier && event.key.toLowerCase() === 'v') editor.pasteAtPlayhead()
  else if (event.key === 'Delete' || event.key === 'Backspace') editor.deleteSelected()
  else if (event.code === 'Space') { event.preventDefault(); editor.togglePlayback() }
  else if (event.key.toLowerCase() === 'w') editor.setTransformMode('translate')
  else if (event.key.toLowerCase() === 'e') editor.setTransformMode('rotate')
  else if (event.key.toLowerCase() === 'r') editor.setTransformMode('scale')
  else if (event.key.toLowerCase() === 's') editor.setTransformMode('semantic')
  else if (event.key.toLowerCase() === 'q') {
    const scopes = ['current-frame', 'selected-keyframes', 'entire-motion'] as const
    const next = scopes[(scopes.indexOf(editor.authoringScope) + 1) % scopes.length] || 'current-frame'
    editor.setAuthoringScope(next === 'entire-motion' && editor.transformMode === 'semantic' ? 'current-frame' : next)
  }
  else if (event.key.toLowerCase() === 'k') editor.keySelectedControl()
  else if (event.key === 'ArrowLeft') editor.moveSelected(-(1000 / (draft.value?.displayFps || 30)))
  else if (event.key === 'ArrowRight') editor.moveSelected(1000 / (draft.value?.displayFps || 30))
}

watch(saved, asset => { if (asset) editor.open(asset); else editor.close() }, { immediate: true })
watch(() => draft.value?.updatedAt, scheduleAutoSave)
watch(() => route.query.prop, propId => {
  if (!draft.value || typeof propId !== 'string' || !assets.props.some(item => item.id === propId) || draft.value.propIds.includes(propId)) return
  editor.updateMetadata({ propIds: [...draft.value.propIds, propId] })
})
onMounted(() => {
  appearance.hydrate(); assets.hydrate(); session.hydrate(); modelVariants.hydrate()
  showIntentPicker.value = assets.motions.length === 0
  const requested = typeof route.query.motion === 'string' ? route.query.motion : ''
  if (requested && assets.motions.some(item => item.id === requested)) session.selectMotion(requested)
  else if (session.selectedMotionId && !assets.motions.some(item => item.id === session.selectedMotionId)) session.selectMotion('')
  else if (!session.selectedMotionId && assets.motions[0]) session.selectMotion(assets.motions[0].id)
  const asset = assets.motions.find(item => item.id === session.selectedMotionId)
  if (asset) editor.open(asset)
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', keyboard)
})
onBeforeUnmount(() => {
  flushAutoSave()
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', keyboard)
})
</script>

<template>
  <section class="motion-workspace">
    <aside class="asset-panel">
      <header><div><small>动作资产</small><h1>动作工坊</h1></div><button type="button" @click="createMotion">新建动作</button></header>
      <p>动作资产使用语义 Rig；时间轴只保存相对于外观的姿态偏移，不修改外观配方。</p>
      <section class="basic-motion-templates" aria-labelledby="basic-motion-template-title">
        <header>
          <div><strong id="basic-motion-template-title">基础动作模板</strong><small>点击即自动创建，无需手动绑骨</small></div>
        </header>
        <div class="basic-motion-template-grid">
          <button
            v-for="template in BASIC_BIPED_STUDIO_MOTIONS"
            :key="template.id"
            type="button"
            class="basic-motion-template"
            :aria-label="`使用动作模板：${template.nameZh}`"
            @click="useBasicMotionTemplate(template.id)"
          >
            <strong>{{ template.nameZh }}</strong>
            <small>{{ (template.durationMs / 1000).toFixed(1) }} 秒 · {{ template.loopMode === 'loop' ? '循环' : '单次' }}</small>
          </button>
        </div>
      </section>
      <button v-for="motion in assets.motions" :key="motion.id" class="asset-item" :class="{ active: motion.id === session.selectedMotionId }" @click="selectMotion(motion.id)">
        <strong>{{ motion.nameZh }}</strong><small>{{ motion.durationMs }} 毫秒 · {{ motion.displayFps }} 帧/秒</small>
      </button>
      <div v-if="!assets.motions.length" class="empty">尚无动作。选择一个动作意图，系统会自动生成可播放的完整动作。</div>
    </aside>

    <div class="editor-area" :class="{ 'advanced-mode': !showIntentPicker && editor.authoringMode === 'advanced', 'guided-flow-mode': showIntentPicker || guidedEditing }">
      <header class="editor-header">
        <div><small>{{ guidedEditing ? '阶段动作编辑器' : '动作编辑器' }}</small><h2>{{ draft?.nameZh || '请选择或创建动作' }}</h2><span>{{ guidedEditing ? '选择阶段并调整姿势、节奏和效果' : `撤销 ${editor.undoStack.length} / 重做 ${editor.redoStack.length}` }}</span></div>
        <div class="header-actions">
          <button :disabled="!editor.canUndo" @click="editor.undo">撤销</button><button :disabled="!editor.canRedo" @click="editor.redo">重做</button>
          <button :class="{ active: editor.playing }" @click="editor.togglePlayback()">{{ editor.playing ? '暂停' : '播放' }}</button><button @click="editor.stopPlayback">停止</button>
          <button v-if="simpleRecipe && !showIntentPicker" class="mode-button" type="button" @click="toggleAuthoringMode">{{ guidedEditing ? '高级编辑' : '返回简易编辑' }}</button>
          <button class="save-state" :class="`state-${editor.saveState}`" :disabled="!draft || editor.saveState === 'saving' || (editor.saveState !== 'failed' && !editor.isDirty)" @click="retrySave">{{ saveStateLabel }}</button>
        </div>
      </header>
      <StudioMotionIntentPicker v-if="showIntentPicker" class="intent-flow" @select="createFromIntent" />
      <StudioMotionStageBar
        v-else-if="simpleRecipe && guidedEditing"
        class="stage-flow"
        :recipe="simpleRecipe"
        :selected-stage-id="editor.selectedStageId"
        :playhead-time-ms="editor.playheadTimeMs"
        @select="editor.selectSimpleStage"
        @duplicate="editor.duplicateSimpleStage"
        @move="editor.moveSimpleStage"
        @remove="editor.removeSimpleStage"
        @playhead="editor.setPlayhead($event, false)"
      />
      <div class="preview-shell">
        <StudioPreviewToolbar
          :view="session.previewView"
          :background="session.previewBackground"
          :scale="previewScale"
          :rotation="previewRotation"
          :show-time="editor.authoringMode === 'advanced'"
          :time-ms="editor.playheadTimeMs"
          :max-time-ms="draft?.durationMs || 0"
          @view="setView"
          @background="setBackground"
          @scale="updatePreviewScale"
          @rotation="(axis, value) => updatePreviewRotation(axis, value)"
          @time="editor.setPlayhead($event, false)"
          @reset="resetPreviewTransform"
        />
        <div class="preview-stage">
          <ClientOnly>
            <CloudFoxStudioCanvas :appearance="appearance.recipe" behavior="idle" :motion-key="draft?.updatedAt || 0" :view="session.previewView" :background="session.previewBackground" focus="full" :custom-pose="evaluatedPose" :motion-asset="draft" :motion-time-ms="editor.playbackRequestedTimeMs" :motion-weight="editor.playbackWeight" :prop-instances="evaluatedProps.instances" :prop-assets="allPropAssets" :onion-poses="onionPoses" :motion-path-points="motionPathPoints" :preview-scale="previewScale" :preview-rotation="previewRotationRadians" :preview-position="previewPosition" :model-mode="session.modelMode" :complex-pet-id="currentPetId" :complex-recipe="complexRecipe" />
          </ClientOnly>
          <!-- 按当前交互约定，画布暂不绑定 wheel；预览缩放仅由控制栏负责。 -->
          <div
            ref="previewRotateSurface"
            class="preview-rotate-surface"
            :class="{ dragging: previewDrag.active }"
            @pointerdown="beginPreviewRotate"
            @pointermove="movePreviewRotate"
            @pointerup="endPreviewRotate"
            @pointercancel="cancelPreviewRotate"
          ><span>拖动画布自由旋转</span></div>
          <StudioMotionDirectPad v-if="draft" />
        </div>
      </div>
      <StudioMotionTimeline
        v-if="draft && editor.authoringMode === 'advanced'"
        :asset="draft"
        :playhead-time-ms="editor.playheadTimeMs"
        :selected-keyframe-ids="editor.selectedKeyframeIds"
        @playhead="editor.setPlayhead"
        @select="editor.selectKeyframe"
        @select-many="editor.selectKeyframes"
        @move-selected="editor.moveSelected"
      />
      <div v-else-if="!draft && !showIntentPicker" class="empty timeline-empty">新建动作后即可开始编辑。</div>
    </div>

    <aside class="property-panel" :class="{ 'guided-panel': guidedEditing }">
      <header><small>{{ showIntentPicker ? '新建动作' : guidedEditing ? '当前阶段' : '属性面板' }}</small><h2>{{ showIntentPicker ? '选择动作意图' : guidedEditing ? '阶段属性' : '动作属性' }}</h2></header>
      <StudioMotionStageInspector
        v-if="guidedEditing && editor.selectedSimpleStage"
        class="guided-inspector"
        :stage="editor.selectedSimpleStage"
        @update="editor.updateSelectedSimpleStage"
      />
      <nav v-else-if="draft && !showIntentPicker" class="property-tabs" role="tablist" aria-label="动作属性分类">
        <button
          v-for="item in propertyTabs"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="propertyTab === item.id"
          :class="{ active: propertyTab === item.id }"
          @click="propertyTab = item.id"
        >
          {{ item.label }}<span v-if="item.badge">{{ item.badge }}</span>
        </button>
      </nav>
      <div v-if="draft && !guidedEditing && !showIntentPicker" class="property-tab-body">
        <section v-if="propertyTab === 'basic'" class="property-section">
          <label>中文名称<input :value="draft.nameZh" @change="patchName('nameZh',$event)"></label>
          <label>英文名称<input :value="draft.nameEn" @change="patchName('nameEn',$event)"></label>
          <div class="metadata-grid"><label>总时长（毫秒）<input :value="draft.durationMs" type="number" min="100" max="60000" step="50" @change="patchDuration"></label><label>显示网格（帧/秒）<input :value="draft.displayFps" type="number" min="1" max="240" step="1" @change="patchDisplayFps"></label></div>
          <label>循环模式<select :value="draft.loopMode" @change="patchLoop"><option value="once">播放一次</option><option value="loop">循环</option><option value="ping-pong">往返循环</option></select></label>
          <StudioRootMotionSettings
            v-if="rootMotion"
            :root-motion="rootMotion"
            :model-mode="session.modelMode"
            @update="editor.updateRootMotionSettings"
            @restore="editor.restoreRootMotionRecommendations"
          />
          <StudioMotionAdaptationSummary
            :motion="draft"
            :model-mode="session.modelMode"
            :runtime-status="adaptationStatus"
            :can-restore="editor.canRestoreMotionAdaptation"
            @restore="editor.restoreMotionAdaptationRecommendations"
          />
          <details class="technical-info"><summary>技术信息</summary><code>{{ draft.rigId }}</code><code>{{ draft.id }}</code></details>
        </section>

        <section v-else-if="propertyTab === 'pose'" class="property-section">
          <StudioMotionTransformEditor />
          <details class="advanced-channel-editor">
            <summary>高级：逐通道编辑</summary>
            <StudioMotionPoseEditor
              :asset="draft"
              :playhead-time-ms="editor.playheadTimeMs"
              :selected-channel-id="editor.selectedChannelId"
              :selected-keyframe-count="editor.selectedKeyframeCount"
              :snap-to-frames="editor.snapToFrames"
              :auto-key="editor.autoKey"
              @channel="editor.setSelectedChannel"
              @write="editor.writeChannelValue"
              @interpolation="applyInterpolation"
              @copy="editor.copySelected"
              @paste="editor.pasteAtPlayhead"
              @delete="editor.deleteSelected"
              @snap="editor.snapToFrames=$event"
              @auto-key="editor.autoKey=$event"
            />
          </details>
          <p v-if="editor.lastDiagnostics.length" class="diagnostics">规范化：{{ editor.lastDiagnostics.slice(-3).join(' · ') }}</p>
        </section>

        <section v-else-if="propertyTab === 'advanced'" class="property-section">
          <StudioMotionAdvancedTools />
        </section>

        <section v-else class="property-section">
          <section class="dependency-card"><h3>道具依赖</h3><p v-if="!availableProps.length">当前动作尚未引用道具。</p><template v-for="prop in availableProps" :key="prop.id"><span v-if="prop.id.startsWith('builtin-')">{{ prop.nameZh }}（内置）</span><NuxtLink v-else :to="`/studio/props?prop=${prop.id}`">{{ prop.nameZh }}</NuxtLink></template></section>
          <StudioMotionPropEvents
            :asset="draft"
            :playhead-time-ms="editor.playheadTimeMs"
            :prop-assets="allPropAssets"
            :selected-event-ids="editor.selectedPropEventIds"
            @add="editor.addPropEvent"
            @select="editor.selectPropEvent"
            @delete="editor.deletePropEvents"
          />
          <p v-if="evaluatedProps.diagnostics.length" class="diagnostics">道具事件：{{ evaluatedProps.diagnostics.slice(-2).map(item => item.code).join(' · ') }}</p>
        </section>
      </div>
      <div v-else-if="showIntentPicker" class="empty">先从中间选择动作类型。系统会自动创建阶段、过渡和基础特效。</div>
      <div v-else-if="!guidedEditing" class="empty">创建动作后可编辑阶段姿势；专业时间轴可从高级编辑进入。</div>
      <small v-if="status" class="status">{{ status }}</small>
    </aside>
  </section>
</template>

<style scoped>
.motion-workspace{
  box-sizing:border-box;
  display:grid;
  grid-template-columns:220px minmax(620px,1fr) 310px;
  gap:12px;
  width:100%;
  max-width:100%;
  min-width:0;
  min-height:calc(100dvh - 55px);
  padding:12px;
  overflow-x:hidden;
}
.asset-panel,.editor-area,.property-panel{
  box-sizing:border-box;
  min-width:0;
  min-height:0;
  border:1px solid #ffffff17;
  border-radius:16px;
  background:#0d1120;
}
.asset-panel{
  display:flex;
  flex-direction:column;
  gap:9px;
  padding:12px;
  overflow-x:hidden;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
}
.property-panel{
  position:sticky;
  top:67px;
  display:grid;
  grid-template-rows:auto auto minmax(0,1fr) auto;
  gap:9px;
  height:calc(100dvh - 79px);
  max-height:calc(100dvh - 79px);
  padding:12px;
  overflow:hidden;
}
.property-panel>*{box-sizing:border-box;min-width:0;max-width:100%}
.property-panel :deep(*){box-sizing:border-box;min-width:0}
.property-panel :deep(input),.property-panel :deep(select),.property-panel :deep(button),.property-panel :deep(textarea){max-width:100%}
.asset-panel header,.editor-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.asset-panel small,.editor-header small,.property-panel small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.08em}
h1,h2,h3,p{margin:0}
.asset-panel h1,.editor-header h2,.property-panel h2{margin-top:5px;font-size:18px}
.asset-panel p,.dependency-card p{color:#8993b2;font-size:10px;line-height:1.55}
.asset-panel button,.header-actions button{border:1px solid #ffffff1c;border-radius:8px;color:#dfe5ff;background:#ffffff07}
.asset-panel header button{min-height:32px;padding:0 9px}
.asset-item{display:grid;gap:3px;padding:9px;text-align:left}
.asset-item.active{border-color:#52e0d066;background:#52e0d010}
.asset-item small{font:400 8px/1.3 system-ui;color:#7883a3}
.basic-motion-templates{display:grid;gap:7px;padding:8px;border:1px solid #52e0d02b;border-radius:11px;background:#52e0d008}.basic-motion-templates>header{display:block}.basic-motion-templates>header>div{display:grid;gap:3px}.basic-motion-templates>header strong{color:#dffffa;font-size:10px}.basic-motion-templates>header small{font:400 8px/1.35 system-ui;color:#7f8fa7;letter-spacing:0}.basic-motion-template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.basic-motion-template{display:grid;gap:3px;min-width:0;padding:7px;text-align:left}.basic-motion-template strong{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.basic-motion-template small{font:400 7px/1.3 system-ui;color:#7883a3}.basic-motion-template:focus-visible{outline:2px solid #72dfd1;outline-offset:2px}
.editor-area{display:grid;grid-template-rows:auto minmax(380px,1fr);overflow:hidden}
.editor-area.guided-flow-mode{grid-template-rows:auto auto minmax(380px,1fr)}
.editor-area.advanced-mode{grid-template-rows:auto minmax(380px,1fr) minmax(300px,.8fr)}
.editor-header{padding:10px 12px;border-bottom:1px solid #ffffff13}
.editor-header>div:first-child{display:grid;gap:3px;min-width:0}
.editor-header span{color:#76809e;font-size:8px}
.header-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
.header-actions button{min-height:30px;padding:0 8px}
.header-actions button.active{border-color:#ff5f8677;background:#ff5f8618}
.header-actions .mode-button{border-color:#7066ff66;color:#e5e1ff;background:#7066ff16}
.header-actions .save-state{border-color:#52e0d044;color:#bffbf3;background:#52e0d00d}
.header-actions .save-state.state-saving{color:#ffe0a3;border-color:#ffcb6b44;background:#ffcb6b0d}
.header-actions .save-state.state-failed{color:#ff9eb1;border-color:#ff6f8f55;background:#ff6f8f0d}
.header-actions button:disabled{opacity:.35}
.intent-flow,.stage-flow{margin:8px 9px 0}
.preview-shell{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-width:0;min-height:0;padding:9px;overflow:hidden}.preview-stage{position:relative;min-width:0;min-height:0}.preview-stage :deep(.studio-canvas){min-height:100%}
.preview-rotate-surface{
  position:absolute;
  z-index:5;
  inset:0;
  border-radius:22px;
  cursor:grab;
  touch-action:none;
  user-select:none;
}
.preview-rotate-surface.dragging{cursor:grabbing}
.preview-rotate-surface span{
  position:absolute;
  left:50%;
  bottom:20px;
  transform:translateX(-50%);
  padding:6px 9px;
  border:1px solid #ffffff18;
  border-radius:999px;
  color:#7f89a8;
  background:#080b14a3;
  font-size:8px;
  white-space:nowrap;
  opacity:.72;
  pointer-events:none;
  backdrop-filter:blur(12px);
}
.property-panel header{margin-bottom:2px}
.property-panel.guided-panel{grid-template-rows:auto minmax(0,1fr) auto}
.guided-inspector{min-height:0;overflow-x:hidden;overflow-y:auto;padding-right:2px;overscroll-behavior:contain;scrollbar-gutter:stable}
.property-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border:1px solid #ffffff12;border-radius:10px;background:#090d18}
.property-tabs button{display:flex;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:31px;padding:0 5px;border:1px solid transparent;border-radius:7px;color:#8993b2;background:transparent;font-size:9px;cursor:pointer}
.property-tabs button:hover{color:#dbe2f8;background:#ffffff06}.property-tabs button.active{border-color:#52e0d055;color:#dffffa;background:#52e0d012}.property-tabs span{display:inline-grid;place-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:999px;color:#cffff8;background:#52e0d01f;font:700 7px/1 ui-monospace,monospace}
.property-tab-body{display:grid;align-content:start;gap:9px;min-height:0;overflow-x:hidden;overflow-y:auto;padding-right:2px;overscroll-behavior:contain;scrollbar-gutter:stable}
.property-section{display:grid;align-content:start;gap:9px;min-width:0}
.property-section>label,.metadata-grid label{display:grid;gap:5px;color:#b8c0da;font-size:10px}
.property-panel input,.property-panel select{width:100%;min-height:36px;padding:0 8px;border:1px solid #ffffff1d;border-radius:8px;color:#fff;background:#090e1b}
.metadata-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.dependency-card{display:grid;gap:6px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff04;overflow:hidden}
.dependency-card a{overflow:hidden;color:#72dfd1;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.property-panel code{display:block;max-width:100%;overflow-wrap:anywhere;color:#6e7898;font-size:8px}.technical-info{max-width:100%;overflow:hidden;border:1px solid #ffffff10;border-radius:8px}.technical-info summary{padding:7px;color:#77819e;font-size:8px;cursor:pointer}.technical-info code{padding:4px 7px}.technical-info code:last-child{padding-bottom:7px}
.advanced-channel-editor{display:grid;gap:7px;max-width:100%;overflow:hidden;border:1px solid #ffffff12;border-radius:10px;background:#ffffff03}
.advanced-channel-editor>summary{padding:9px;color:#8c96b4;font-size:9px;cursor:pointer}
.advanced-channel-editor[open]>summary{border-bottom:1px solid #ffffff10;color:#c8d0e8}
.advanced-channel-editor :deep(.pose-editor){border:0;border-radius:0;background:transparent}
.diagnostics{overflow-wrap:anywhere;color:#ffcb6b;font-size:8px;line-height:1.4}
.status{display:block;padding:7px;border:1px solid #52e0d044;border-radius:8px;color:#cffff8!important;background:#0b1720}
.empty{padding:12px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px;line-height:1.5}
.timeline-empty{margin:12px}
@media(max-width:1480px){
}
@media(max-width:1180px){
  .motion-workspace{grid-template-columns:190px minmax(0,1fr)}
  .property-panel{position:static;grid-column:1/-1;height:min(620px,calc(100dvh - 24px));max-height:620px}
}
@media(max-width:780px){
  .motion-workspace{grid-template-columns:minmax(0,1fr)}
  .editor-area{grid-template-rows:auto 620px}
  .editor-area.guided-flow-mode{grid-template-rows:auto auto 620px}
  .editor-area.advanced-mode{grid-template-rows:auto 620px 350px}
  .metadata-grid{grid-template-columns:minmax(0,1fr)}
  .property-panel{height:620px;max-height:620px}
  .preview-rotate-surface span{display:none}
}
</style>
