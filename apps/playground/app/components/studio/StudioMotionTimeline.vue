<!--
  文件职责 / File responsibility
  渲染动作工坊的语义轨道、播放指针、可多选关键帧、拖动时间和框选交互。
  Renders Motion Studio semantic tracks, playhead, multi-selectable keyframes, time dragging, and marquee selection.
-->
<script setup lang="ts">
import { CLOUD_FOX_RIG_TRACK_GROUPS, type StudioMotionAssetV2 } from '@yk-pets/pet-core'

const props = defineProps<{
  asset: StudioMotionAssetV2
  playheadTimeMs: number
  selectedKeyframeIds: readonly string[]
}>()
const emit = defineEmits<{
  playhead: [timeMs: number]
  select: [id: string, additive: boolean]
  selectMany: [ids: string[]]
  moveSelected: [deltaMs: number]
}>()

const surface = ref<HTMLElement>()
const drag = reactive({ active: false, startX: 0, keyframeId: '', moved: false })
const marquee = reactive({ active: false, startX: 0, currentX: 0, rowId: '' })
const selected = computed(() => new Set(props.selectedKeyframeIds))
const rows = CLOUD_FOX_RIG_TRACK_GROUPS

function groupKeyframes(groupId: string) {
  const group = rows.find(item => item.id === groupId)
  if (!group) return []
  const channels = new Set(group.channelIds)
  return props.asset.tracks
    .filter(track => channels.has(track.channelId))
    .flatMap(track => track.keyframes.map(keyframe => ({ ...keyframe, channelId: track.channelId })))
    .sort((left, right) => left.timeMs - right.timeMs)
}
function timeFromPointer(event: PointerEvent | MouseEvent) {
  const rect = surface.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return 0
  return Math.max(0, Math.min(props.asset.durationMs, Math.round((event.clientX - rect.left) / rect.width * props.asset.durationMs)))
}
function setPlayhead(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('.keyframe')) return
  emit('playhead', timeFromPointer(event))
}
function beginKeyframeDrag(event: PointerEvent, id: string) {
  event.stopPropagation()
  const additive = event.metaKey || event.ctrlKey || event.shiftKey
  emit('select', id, additive)
  drag.active = true
  drag.startX = event.clientX
  drag.keyframeId = id
  drag.moved = false
  window.addEventListener('pointermove', moveKeyframeDrag)
  window.addEventListener('pointerup', endKeyframeDrag, { once: true })
}
function moveKeyframeDrag(event: PointerEvent) {
  if (!drag.active) return
  if (Math.abs(event.clientX - drag.startX) > 2) drag.moved = true
}
function endKeyframeDrag(event: PointerEvent) {
  window.removeEventListener('pointermove', moveKeyframeDrag)
  if (drag.active && drag.moved) {
    const rect = surface.value?.getBoundingClientRect()
    if (rect?.width) emit('moveSelected', Math.round((event.clientX - drag.startX) / rect.width * props.asset.durationMs))
  }
  drag.active = false
}
function beginMarquee(event: PointerEvent, rowId: string) {
  if ((event.target as HTMLElement).closest('.keyframe')) return
  marquee.active = true
  marquee.startX = event.clientX
  marquee.currentX = event.clientX
  marquee.rowId = rowId
  window.addEventListener('pointermove', moveMarquee)
  window.addEventListener('pointerup', endMarquee, { once: true })
}
function moveMarquee(event: PointerEvent) {
  if (marquee.active) marquee.currentX = event.clientX
}
function endMarquee() {
  window.removeEventListener('pointermove', moveMarquee)
  const rect = surface.value?.getBoundingClientRect()
  if (marquee.active && rect) {
    const left = Math.min(marquee.startX, marquee.currentX)
    const right = Math.max(marquee.startX, marquee.currentX)
    if (right - left > 3) {
      const start = Math.max(0, Math.min(props.asset.durationMs, (left - rect.left) / rect.width * props.asset.durationMs))
      const end = Math.max(0, Math.min(props.asset.durationMs, (right - rect.left) / rect.width * props.asset.durationMs))
      emit('selectMany', groupKeyframes(marquee.rowId).filter(item => item.timeMs >= start && item.timeMs <= end).map(item => item.id))
    }
  }
  marquee.active = false
}
const marqueeStyle = computed(() => {
  const rect = surface.value?.getBoundingClientRect()
  if (!marquee.active || !rect) return { display: 'none' }
  return {
    left: `${Math.min(marquee.startX, marquee.currentX) - rect.left}px`,
    width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
  }
})
</script>

<template>
  <section class="motion-timeline" @pointerdown="setPlayhead">
    <header>
      <div><strong>时间轴编辑</strong><small>点击移动播放指针；Ctrl/Command 多选；拖动关键帧；空白处框选。</small></div>
      <span>{{ Math.round(playheadTimeMs) }} / {{ asset.durationMs }} ms</span>
    </header>
    <div class="timeline-grid">
      <div class="labels">
        <span class="ruler-label">TRACKS</span>
        <span v-for="group in rows" :key="group.id">{{ group.labelZh }}<small>{{ group.channelIds.length }}</small></span>
      </div>
      <div ref="surface" class="surface">
        <div class="ruler">
          <i v-for="tick in 11" :key="tick" :style="{ left: `${(tick - 1) * 10}%` }"><small>{{ Math.round(asset.durationMs * (tick - 1) / 10) }}</small></i>
        </div>
        <div
          v-for="group in rows"
          :key="group.id"
          class="lane"
          :data-row="group.id"
          @pointerdown.stop="beginMarquee($event, group.id)"
        >
          <button
            v-for="keyframe in groupKeyframes(group.id)"
            :key="keyframe.id"
            class="keyframe"
            :class="{ selected: selected.has(keyframe.id), step: keyframe.interpolation === 'step' }"
            :style="{ left: `${keyframe.timeMs / asset.durationMs * 100}%` }"
            :title="`${keyframe.channelId} · ${keyframe.timeMs} ms · ${keyframe.value}`"
            @pointerdown="beginKeyframeDrag($event, keyframe.id)"
          />
        </div>
        <div class="playhead" :style="{ left: `${playheadTimeMs / asset.durationMs * 100}%` }"><i /></div>
        <div class="marquee" :style="marqueeStyle" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.motion-timeline{display:grid;grid-template-rows:auto minmax(210px,1fr);min-height:0;border-top:1px solid #ffffff14;background:#090d18;user-select:none}.motion-timeline>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px}.motion-timeline>header div{display:grid;gap:2px}.motion-timeline>header small{color:#78829f;font-size:9px}.motion-timeline>header span{font:700 10px/1 ui-monospace,monospace;color:#b9c3df}.timeline-grid{display:grid;grid-template-columns:148px 1fr;min-height:0}.labels{display:grid;grid-template-rows:26px repeat(9,minmax(26px,1fr));border-right:1px solid #ffffff12}.labels>span{display:flex;align-items:center;justify-content:space-between;padding:0 9px;border-top:1px solid #ffffff0c;color:#aeb7d2;font-size:9px}.labels small{color:#65708f}.ruler-label{color:#68728f!important;font:800 7px/1 ui-monospace,monospace!important;letter-spacing:.14em}.surface{position:relative;display:grid;grid-template-rows:26px repeat(9,minmax(26px,1fr));min-width:0;overflow:hidden}.ruler{position:relative;border-bottom:1px solid #ffffff16}.ruler i{position:absolute;inset:0 auto 0;border-left:1px solid #ffffff26}.ruler small{position:absolute;top:5px;left:3px;color:#65708f;font-style:normal;font-size:7px}.lane{position:relative;border-top:1px solid #ffffff0c;background:linear-gradient(90deg,transparent 9.8%,#ffffff07 10%,transparent 10.2%) 0 0/10% 100%}.lane:hover{background-color:#ffffff03}.keyframe{position:absolute;z-index:4;top:50%;width:10px;height:10px;padding:0;border:1px solid #b9fff7;border-radius:2px;background:#52e0d0;transform:translate(-50%,-50%) rotate(45deg);cursor:ew-resize;box-shadow:0 0 0 2px #0a0e18}.keyframe.step{background:#ffcb6b}.keyframe.selected{width:13px;height:13px;border-color:#fff;box-shadow:0 0 0 2px #7066ff,0 0 12px #7066ffaa}.playhead{position:absolute;z-index:5;top:0;bottom:0;width:1px;background:#ff5f86;pointer-events:none}.playhead i{position:absolute;top:0;left:-4px;width:9px;height:9px;border-radius:0 0 6px 6px;background:#ff5f86}.marquee{position:absolute;z-index:3;top:26px;bottom:0;border:1px solid #7066ff99;background:#7066ff18;pointer-events:none}
</style>
