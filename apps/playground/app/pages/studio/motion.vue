<!--
  文件职责 / File responsibility
  提供动作草稿、播放指针、关键帧编辑、语义姿态写入和唯一正式云狐渲染器的自定义动作预览。
  Provides motion drafts, playhead, keyframe editing, semantic pose authoring, and custom-motion preview through the sole production Cloud Fox renderer.
-->
<script setup lang="ts">
import { evaluateMotionPropEvents, evaluateNormalizedMotionAsset, type MotionInterpolation } from '@yk-pets/pet-core'
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioMotionPoseEditor from '~/components/studio/StudioMotionPoseEditor.vue'
import StudioMotionTimeline from '~/components/studio/StudioMotionTimeline.vue'
import StudioMotionPropEvents from '~/components/studio/StudioMotionPropEvents.vue'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'
import { useStudioSessionStore } from '~/stores/studio-session'
import type { StudioMotionLoopMode } from '~/domain/studio-workspace'

definePageMeta({ layout: 'studio' })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const editor = useStudioMotionEditorStore()
const session = useStudioSessionStore()
const saved = computed(() => assets.motions.find(item => item.id === session.selectedMotionId))
const draft = computed(() => editor.draft)
const availableProps = computed(() => assets.props.filter(item => draft.value?.propIds.includes(item.id)))
const evaluatedPose = computed(() => draft.value ? evaluateNormalizedMotionAsset(draft.value, editor.playheadTimeMs) : null)
const evaluatedProps = computed(() => draft.value ? evaluateMotionPropEvents(draft.value, editor.playheadTimeMs) : { instances: [], diagnostics: [] })
const status = ref('')
let raf = 0

function saveCurrent(message = '动作已保存') {
  if (!draft.value) return
  const savedAsset = assets.replaceMotion(draft.value)
  if (savedAsset) editor.markSaved(savedAsset)
  status.value = message
}
function selectMotion(id: string) {
  if (editor.isDirty) saveCurrent('已自动保存上一动作')
  session.selectMotion(id)
  const asset = assets.motions.find(item => item.id === id)
  if (asset) editor.open(asset)
  navigateTo({ path: '/studio/motion', query: { motion: id } }, { replace: true })
}
function createMotion() {
  if (editor.isDirty) saveCurrent('已自动保存上一动作')
  const motion = assets.createMotion({ authoringAppearanceId: session.selectedAppearanceId })
  selectMotion(motion.id)
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
function setView(view: typeof session.previewView) { session.setPreview(view, session.previewBackground) }
function setBackground(background: typeof session.previewBackground) { session.setPreview(session.previewView, background) }
function applyInterpolation(value: MotionInterpolation) { editor.setSelectedInterpolation(value) }
function frame(now: number) {
  editor.advancePlayback(now)
  raf = requestAnimationFrame(frame)
}
function keyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.matches('input,select,textarea')) return
  const modifier = event.metaKey || event.ctrlKey
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrent() }
  else if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? editor.redo() : editor.undo() }
  else if (modifier && event.key.toLowerCase() === 'c') editor.copySelected()
  else if (modifier && event.key.toLowerCase() === 'v') editor.pasteAtPlayhead()
  else if (event.key === 'Delete' || event.key === 'Backspace') editor.deleteSelected()
  else if (event.code === 'Space') { event.preventDefault(); editor.togglePlayback() }
  else if (event.key === 'ArrowLeft') editor.moveSelected(-(1000 / (draft.value?.displayFps || 30)))
  else if (event.key === 'ArrowRight') editor.moveSelected(1000 / (draft.value?.displayFps || 30))
}

watch(saved, asset => { if (asset) editor.open(asset); else editor.close() }, { immediate: true })
watch(() => route.query.prop, propId => {
  if (!draft.value || typeof propId !== 'string' || !assets.props.some(item => item.id === propId) || draft.value.propIds.includes(propId)) return
  editor.updateMetadata({ propIds: [...draft.value.propIds, propId] })
})
onMounted(() => {
  appearance.hydrate(); assets.hydrate(); session.hydrate()
  const requested = typeof route.query.motion === 'string' ? route.query.motion : ''
  if (requested && assets.motions.some(item => item.id === requested)) session.selectMotion(requested)
  else if (!session.selectedMotionId && assets.motions[0]) session.selectMotion(assets.motions[0].id)
  const asset = assets.motions.find(item => item.id === session.selectedMotionId)
  if (asset) editor.open(asset)
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', keyboard)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', keyboard)
  if (editor.isDirty) saveCurrent('离开前已自动保存')
})
</script>

<template>
  <section class="motion-workspace">
    <aside class="asset-panel">
      <header><div><small>MOTION ASSETS</small><h1>动作工坊</h1></div><button @click="createMotion">新建动作</button></header>
      <p>动作资产使用语义 Rig；时间轴只保存相对于外观的姿态偏移，不修改外观配方。</p>
      <button v-for="motion in assets.motions" :key="motion.id" class="asset-item" :class="{ active: motion.id === session.selectedMotionId }" @click="selectMotion(motion.id)">
        <strong>{{ motion.nameZh }}</strong><small>{{ motion.nameEn }} · {{ motion.durationMs }} ms · {{ motion.displayFps }} FPS</small>
      </button>
      <div v-if="!assets.motions.length" class="empty">尚无自定义动作。创建后即可写入语义关键帧。</div>
    </aside>

    <div class="editor-area">
      <header class="editor-header">
        <div><small>MOTION STUDIO</small><h2>{{ draft?.nameZh || '请选择或创建动作' }}</h2><span>{{ editor.isDirty ? '未保存草稿' : '已保存' }} · 撤销 {{ editor.undoStack.length }} / 重做 {{ editor.redoStack.length }}</span></div>
        <div class="header-actions">
          <button :disabled="!editor.canUndo" @click="editor.undo">撤销</button><button :disabled="!editor.canRedo" @click="editor.redo">重做</button>
          <button :class="{ active: editor.playing }" @click="editor.togglePlayback()">{{ editor.playing ? '暂停' : '播放' }}</button><button @click="editor.stopPlayback">停止</button>
          <button class="save" :disabled="!draft || !editor.isDirty" @click="saveCurrent()">保存</button>
        </div>
      </header>
      <div class="preview-shell">
        <ClientOnly>
          <CloudFoxStudioCanvas :appearance="appearance.recipe" behavior="idle" :motion-key="draft?.updatedAt || 0" :view="session.previewView" :background="session.previewBackground" focus="full" :custom-pose="evaluatedPose" :prop-instances="evaluatedProps.instances" :prop-assets="assets.props" />
        </ClientOnly>
        <div class="preview-options">
          <button v-for="item in ['front','left','back','right'] as const" :key="item" :class="{active:session.previewView===item}" @click="setView(item)">{{ item }}</button>
          <select :value="session.previewBackground" @change="setBackground(($event.target as HTMLSelectElement).value as typeof session.previewBackground)"><option value="dark">深色</option><option value="light">浅色</option><option value="web">网页</option></select>
          <label>时间 <input :value="Math.round(editor.playheadTimeMs)" type="number" min="0" :max="draft?.durationMs || 0" @change="editor.setPlayhead(Number(($event.target as HTMLInputElement).value), false)"> ms</label>
        </div>
      </div>
      <StudioMotionTimeline
        v-if="draft"
        :asset="draft"
        :playhead-time-ms="editor.playheadTimeMs"
        :selected-keyframe-ids="editor.selectedKeyframeIds"
        @playhead="editor.setPlayhead"
        @select="editor.selectKeyframe"
        @select-many="editor.selectKeyframes"
        @move-selected="editor.moveSelected"
      />
      <div v-else class="empty timeline-empty">创建动作后显示时间轴。</div>
    </div>

    <aside class="property-panel">
      <header><small>PROPERTIES</small><h2>动作属性</h2></header>
      <template v-if="draft">
        <label>中文名称<input :value="draft.nameZh" @change="patchName('nameZh',$event)"></label>
        <label>英文名称<input :value="draft.nameEn" @change="patchName('nameEn',$event)"></label>
        <div class="metadata-grid"><label>总时长（毫秒）<input :value="draft.durationMs" type="number" min="100" max="60000" step="50" @change="patchDuration"></label><label>显示网格（FPS）<input :value="draft.displayFps" type="number" min="1" max="240" step="1" @change="patchDisplayFps"></label></div>
        <label>循环模式<select :value="draft.loopMode" @change="patchLoop"><option value="once">播放一次</option><option value="loop">循环</option><option value="ping-pong">往返循环</option></select></label>
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
        <section class="dependency-card"><h3>道具依赖</h3><p v-if="!availableProps.length">当前动作尚未引用道具。</p><NuxtLink v-for="prop in availableProps" :key="prop.id" :to="`/studio/props?prop=${prop.id}`">{{ prop.nameZh }}</NuxtLink></section>
        <StudioMotionPropEvents
          :asset="draft"
          :playhead-time-ms="editor.playheadTimeMs"
          :prop-assets="assets.props"
          :selected-event-ids="editor.selectedPropEventIds"
          @add="editor.addPropEvent"
          @select="editor.selectPropEvent"
          @delete="editor.deletePropEvents"
        />
        <p v-if="evaluatedProps.diagnostics.length" class="diagnostics">道具事件：{{ evaluatedProps.diagnostics.slice(-2).map(item => item.code).join(' · ') }}</p>
        <p v-if="editor.lastDiagnostics.length" class="diagnostics">规范化：{{ editor.lastDiagnostics.slice(-3).join(' · ') }}</p>
        <code>{{ draft.rigId }}</code><code>{{ draft.id }}</code>
      </template>
      <div v-else class="empty">创建动作后可编辑完整时间轴和姿态。</div>
      <small v-if="status" class="status">{{ status }}</small>
    </aside>
  </section>
</template>

<style scoped>
.motion-workspace{display:grid;grid-template-columns:220px minmax(620px,1fr) 310px;gap:12px;min-height:calc(100dvh - 55px);padding:12px}.asset-panel,.editor-area,.property-panel{min-height:0;border:1px solid #ffffff17;border-radius:16px;background:#0d1120}.asset-panel,.property-panel{display:flex;flex-direction:column;gap:9px;padding:12px;overflow:auto}.asset-panel header,.editor-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-panel small,.editor-header small,.property-panel small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}h1,h2,h3,p{margin:0}.asset-panel h1,.editor-header h2,.property-panel h2{margin-top:5px;font-size:18px}.asset-panel p,.dependency-card p{color:#8993b2;font-size:10px;line-height:1.55}.asset-panel button,.header-actions button,.preview-options button{border:1px solid #ffffff1c;border-radius:8px;color:#dfe5ff;background:#ffffff07}.asset-panel header button{min-height:32px;padding:0 9px}.asset-item{display:grid;gap:3px;padding:9px;text-align:left}.asset-item.active{border-color:#52e0d066;background:#52e0d010}.asset-item small{font:400 8px/1.3 system-ui;color:#7883a3}.editor-area{display:grid;grid-template-rows:auto minmax(380px,1fr) minmax(300px,.8fr);overflow:hidden}.editor-header{padding:10px 12px;border-bottom:1px solid #ffffff13}.editor-header>div:first-child{display:grid;gap:3px}.editor-header span{color:#76809e;font-size:8px}.header-actions{display:flex;gap:5px}.header-actions button{min-height:30px;padding:0 8px}.header-actions button.active{border-color:#ff5f8677;background:#ff5f8618}.header-actions .save{border-color:#52e0d066;background:#52e0d018}.header-actions button:disabled{opacity:.35}.preview-shell{position:relative;min-height:0;padding:9px}.preview-options{position:absolute;z-index:6;top:18px;right:18px;display:flex;align-items:center;gap:4px;padding:5px;border:1px solid #ffffff18;border-radius:10px;background:#080b14bd;backdrop-filter:blur(12px)}.preview-options button,.preview-options select,.preview-options input{min-height:28px;padding:0 7px;border:1px solid #ffffff1d;border-radius:7px;color:#fff;background:#090e1b}.preview-options button.active{border-color:#52e0d066;background:#52e0d013}.preview-options label{display:flex;align-items:center;gap:4px;color:#aeb7d2;font-size:8px}.preview-options input{width:72px}.property-panel header{margin-bottom:2px}.property-panel>label,.metadata-grid label{display:grid;gap:5px;color:#b8c0da;font-size:10px}.property-panel input,.property-panel select{min-height:36px;padding:0 8px;border:1px solid #ffffff1d;border-radius:8px;color:#fff;background:#090e1b}.metadata-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.dependency-card{display:grid;gap:6px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff04}.dependency-card a{color:#72dfd1;font-size:10px}.property-panel code{overflow-wrap:anywhere;color:#6e7898;font-size:8px}.diagnostics{color:#ffcb6b;font-size:8px;line-height:1.4}.status{position:sticky;bottom:0;padding:7px;border:1px solid #52e0d044;border-radius:8px;color:#cffff8!important;background:#0b1720}.empty{padding:12px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px;line-height:1.5}.timeline-empty{margin:12px}@media(max-width:1180px){.motion-workspace{grid-template-columns:190px 1fr}.property-panel{grid-column:1/-1;max-height:none}}@media(max-width:780px){.motion-workspace{grid-template-columns:1fr}.editor-area{grid-template-rows:auto 520px 350px}.header-actions{flex-wrap:wrap}.preview-options{position:static;margin-bottom:6px}.metadata-grid{grid-template-columns:1fr}}
</style>
