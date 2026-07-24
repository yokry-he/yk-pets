<!--
  文件职责 / File responsibility
  提供动作工坊的资产选择、当前宠物预览、版本化动作元数据和只读语义 Rig 轨道概览。
  Provides Motion Studio asset selection, current-pet preview, versioned motion metadata, and a read-only semantic Rig track overview.
-->
<script setup lang="ts">
import { CLOUD_FOX_RIG_TRACK_GROUPS } from '@yk-pets/pet-core'
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioSessionStore } from '~/stores/studio-session'
import type { StudioMotionLoopMode } from '~/domain/studio-workspace'

definePageMeta({ layout: 'studio' })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const session = useStudioSessionStore()
const selected = computed(() => assets.motions.find(item => item.id === session.selectedMotionId))
const availableProps = computed(() => assets.props.filter(item => selected.value?.propIds.includes(item.id)))
const tracks = CLOUD_FOX_RIG_TRACK_GROUPS

function selectMotion(id: string) {
  session.selectMotion(id)
  navigateTo({ path: '/studio/motion', query: { motion: id } }, { replace: true })
}
function createMotion() {
  const motion = assets.createMotion({ authoringAppearanceId: session.selectedAppearanceId })
  selectMotion(motion.id)
}
function patchName(field: 'nameZh' | 'nameEn', event: Event) {
  if (!selected.value) return
  assets.updateMotion(selected.value.id, { [field]: (event.target as HTMLInputElement).value })
}
function patchDuration(event: Event) {
  if (!selected.value) return
  assets.updateMotion(selected.value.id, { durationMs: Number((event.target as HTMLInputElement).value) })
}
function patchDisplayFps(event: Event) {
  if (!selected.value) return
  assets.updateMotion(selected.value.id, { displayFps: Number((event.target as HTMLInputElement).value) })
}
function patchLoop(event: Event) {
  if (!selected.value) return
  assets.updateMotion(selected.value.id, { loopMode: (event.target as HTMLSelectElement).value as StudioMotionLoopMode })
}
function setView(view: typeof session.previewView) {
  session.setPreview(view, session.previewBackground)
}
function setBackground(background: typeof session.previewBackground) {
  session.setPreview(session.previewView, background)
}

onMounted(() => {
  appearance.hydrate()
  assets.hydrate()
  session.hydrate()
  const requested = typeof route.query.motion === 'string' ? route.query.motion : ''
  if (requested && assets.motions.some(item => item.id === requested)) session.selectMotion(requested)
  else if (!session.selectedMotionId && assets.motions[0]) session.selectMotion(assets.motions[0].id)
})
</script>

<template>
  <section class="motion-workspace">
    <aside class="asset-panel">
      <header><div><small>MOTION ASSETS</small><h1>动作工坊</h1></div><button @click="createMotion">新建动作</button></header>
      <p>动作资产使用稳定语义 Rig 和相对姿态领域合同；关键帧写入与正式播放仍未开放。</p>
      <button
        v-for="motion in assets.motions"
        :key="motion.id"
        class="asset-item"
        :class="{ active: motion.id === session.selectedMotionId }"
        @click="selectMotion(motion.id)"
      >
        <strong>{{ motion.nameZh }}</strong><small>{{ motion.nameEn }} · {{ motion.durationMs }} ms · {{ motion.displayFps }} FPS</small>
      </button>
      <div v-if="!assets.motions.length" class="empty">尚无自定义动作。新建后会获得稳定资产 ID 和空的 v2 语义轨道集合。</div>
    </aside>

    <div class="editor-area">
      <header class="editor-header">
        <div><small>MOTION STUDIO</small><h2>{{ selected?.nameZh || '请选择或创建动作' }}</h2></div>
        <div class="preview-options">
          <button v-for="item in ['front','left','back','right'] as const" :key="item" :class="{active:session.previewView===item}" @click="setView(item)">{{ item }}</button>
          <select :value="session.previewBackground" @change="setBackground(($event.target as HTMLSelectElement).value as typeof session.previewBackground)"><option value="dark">深色</option><option value="light">浅色</option><option value="web">网页</option></select>
        </div>
      </header>
      <div class="preview-shell">
        <ClientOnly>
          <CloudFoxStudioCanvas :appearance="appearance.recipe" behavior="idle" :motion-key="0" :view="session.previewView" :background="session.previewBackground" focus="full" />
        </ClientOnly>
      </div>
      <section class="timeline" :data-ready="Boolean(selected)">
        <header><div><strong>语义 Rig 轨道概览</strong><small>时间轴基础已升级为领域合同概览；关键帧编辑、播放和道具事件将在后续阶段接入。</small></div><span>{{ selected?.durationMs || 0 }} ms · {{ selected?.displayFps || 30 }} FPS</span></header>
        <div class="timeline-body">
          <div class="track-labels"><span v-for="track in tracks" :key="track.id">{{ track.labelZh }}</span></div>
          <div class="track-lanes"><div class="ruler"><i v-for="tick in 11" :key="tick" :style="{left:`${(tick-1)*10}%`}"><small>{{ Math.round((selected?.durationMs || 0)*(tick-1)/10) }}</small></i></div><div v-for="track in tracks" :key="track.id" class="lane" /></div>
        </div>
      </section>
    </div>

    <aside class="property-panel">
      <header><small>PROPERTIES</small><h2>动作属性</h2></header>
      <template v-if="selected">
        <label>中文名称<input :value="selected.nameZh" @change="patchName('nameZh',$event)"></label>
        <label>英文名称<input :value="selected.nameEn" @change="patchName('nameEn',$event)"></label>
        <label>总时长（毫秒）<input :value="selected.durationMs" type="number" min="100" max="60000" step="50" @change="patchDuration"></label>
        <label>显示网格（FPS）<input :value="selected.displayFps" type="number" min="1" max="240" step="1" @change="patchDisplayFps"></label>
        <label>循环模式<select :value="selected.loopMode" @change="patchLoop"><option value="once">播放一次</option><option value="loop">循环</option><option value="ping-pong">往返循环</option></select></label>
        <section class="dependency-card"><h3>道具依赖</h3><p v-if="!availableProps.length">当前动作尚未引用道具；事件轨道尚未实现。</p><NuxtLink v-for="prop in availableProps" :key="prop.id" :to="`/studio/props?prop=${prop.id}`">{{ prop.nameZh }}</NuxtLink></section>
        <code>{{ selected.rigId }}</code>
        <code>{{ selected.id }}</code>
      </template>
      <div v-else class="empty">创建动作后可设置名称、总时长、FPS 显示网格和循环方式。</div>
    </aside>
  </section>
</template>

<style scoped>
.motion-workspace{display:grid;grid-template-columns:230px minmax(560px,1fr) 290px;gap:12px;min-height:calc(100dvh - 55px);padding:12px}.asset-panel,.editor-area,.property-panel{min-height:0;border:1px solid #ffffff17;border-radius:16px;background:#0d1120}.asset-panel,.property-panel{display:flex;flex-direction:column;gap:9px;padding:12px;overflow:auto}.asset-panel header,.editor-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-panel small,.editor-header small,.property-panel small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}h1,h2,h3,p{margin:0}.asset-panel h1,.editor-header h2,.property-panel h2{margin-top:5px;font-size:18px}.asset-panel p,.dependency-card p{color:#8993b2;font-size:10px;line-height:1.55}.asset-panel button,.preview-options button{border:1px solid #ffffff1c;border-radius:8px;color:#dfe5ff;background:#ffffff07}.asset-panel header button{min-height:32px;padding:0 9px}.asset-item{display:grid;gap:3px;padding:9px;text-align:left}.asset-item.active{border-color:#52e0d066;background:#52e0d010}.asset-item small{font:400 8px/1.3 system-ui;color:#7883a3}.editor-area{display:grid;grid-template-rows:auto minmax(360px,1fr) 270px;overflow:hidden}.editor-header{padding:10px 12px;border-bottom:1px solid #ffffff13}.preview-options{display:flex;gap:4px}.preview-options button,.preview-options select{min-height:30px;padding:0 8px}.preview-options button.active{border-color:#52e0d066;background:#52e0d013}.preview-options select,.property-panel input,.property-panel select{border:1px solid #ffffff1d;border-radius:8px;color:#fff;background:#090e1b}.preview-shell{min-height:0;padding:9px}.timeline{display:grid;grid-template-rows:auto 1fr;border-top:1px solid #ffffff14;background:#090d18}.timeline>header{display:flex;justify-content:space-between;padding:9px 12px}.timeline>header div{display:grid}.timeline>header small{color:#77819f;font-size:9px}.timeline>header span{font-variant-numeric:tabular-nums}.timeline-body{display:grid;grid-template-columns:150px 1fr;min-height:0}.track-labels{display:grid;grid-template-rows:repeat(9,1fr);border-right:1px solid #ffffff12}.track-labels span{display:flex;align-items:center;padding:0 9px;border-top:1px solid #ffffff0c;color:#aeb7d2;font-size:9px}.track-lanes{position:relative;display:grid;grid-template-rows:repeat(9,1fr);padding-top:24px}.lane{border-top:1px solid #ffffff0c;background:linear-gradient(90deg,transparent 9.8%,#ffffff08 10%,transparent 10.2%) 0 0/10% 100%}.ruler{position:absolute;inset:0 0 auto;height:24px;border-bottom:1px solid #ffffff12}.ruler i{position:absolute;top:0;height:100%;border-left:1px solid #ffffff28}.ruler small{position:absolute;top:4px;left:3px;color:#6f7898;font-style:normal;font-size:7px}.property-panel header{margin-bottom:2px}.property-panel label{display:grid;gap:5px;color:#b8c0da;font-size:10px}.property-panel input,.property-panel select{min-height:36px;padding:0 8px}.dependency-card{display:grid;gap:6px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff04}.dependency-card a{color:#72dfd1;font-size:10px}.property-panel code{overflow-wrap:anywhere;color:#6e7898;font-size:8px}.empty{padding:12px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px;line-height:1.5}@media(max-width:1100px){.motion-workspace{grid-template-columns:190px 1fr}.property-panel{grid-column:1/-1;max-height:none}}@media(max-width:760px){.motion-workspace{grid-template-columns:1fr}.editor-area{grid-template-rows:auto 520px 260px}.timeline-body{grid-template-columns:110px 1fr}}
</style>
