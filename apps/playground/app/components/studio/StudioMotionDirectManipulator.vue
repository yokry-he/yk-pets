<!--
  文件职责 / File responsibility
  在唯一 3D 预览上提供语义部位热点、移动/旋转悬浮工具和可撤销的直接拖拽手势。
  Provides semantic part hotspots, a translate/rotate floating tool, and transactional direct dragging over the sole 3D preview.
-->
<script setup lang="ts">
import {
  getDirectMotionCapability,
  getMotionBodyPart,
  type DirectMotionMode,
  type MotionBodyPartId,
} from '@yk-pets/pet-core'
import type { StudioMotionPartAnchor } from './CloudFoxStudioCanvas.vue'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const props = withDefaults(defineProps<{
  anchors: readonly StudioMotionPartAnchor[]
  editableParts: readonly MotionBodyPartId[]
  disabled?: boolean
}>(), {
  disabled: false,
})

const editor = useStudioMotionEditorStore()
const overlay = ref<HTMLElement>()
const overlaySize = reactive({ width: 0, height: 0 })
const pointerGesture = reactive({
  active: false,
  pointerId: 0,
  startX: 0,
  startY: 0,
  target: undefined as HTMLElement | undefined,
  releasingPointerCapture: false,
})
let resizeObserver: ResizeObserver | undefined

const editablePartSet = computed(() => new Set(props.editableParts))
const anchorByPartId = computed(() => new Map(props.anchors.map(anchor => [anchor.bodyPartId, anchor])))
const visibleAnchors = computed(() => props.editableParts
  .map(partId => anchorByPartId.value.get(partId))
  .filter((anchor): anchor is StudioMotionPartAnchor => Boolean(anchor?.visible)))
const selectedAnchor = computed(() => visibleAnchors.value.find(anchor => anchor.bodyPartId === editor.selectedBodyPartId))
const selectedPart = computed(() => getMotionBodyPart(editor.selectedBodyPartId))
const selectedCapability = computed(() => getDirectMotionCapability(editor.selectedBodyPartId))

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

const floatingToolPosition = computed(() => {
  const anchor = selectedAnchor.value
  if (!anchor || !(overlaySize.width > 0 && overlaySize.height > 0)) return undefined
  const toolHalfWidth = 116
  const toolHeight = 42
  const placeLeft = anchor.x > overlaySize.width * .7
  const requestedX = anchor.x + (placeLeft ? -toolHalfWidth - 32 : toolHalfWidth + 32)
  const requestedY = anchor.y < 74 ? anchor.y + 52 : anchor.y - 52
  return {
    left: `${clamp(requestedX, toolHalfWidth + 8, overlaySize.width - toolHalfWidth - 8)}px`,
    top: `${clamp(requestedY, toolHeight / 2 + 8, overlaySize.height - toolHeight / 2 - 8)}px`,
  }
})

function hotspotStyle(anchor: StudioMotionPartAnchor) {
  const size = anchor.bodyPartId === 'root' ? 82
    : anchor.bodyPartId === 'body' ? 64
      : anchor.bodyPartId === 'head' ? 70
        : anchor.bodyPartId.startsWith('ear-') || anchor.bodyPartId.startsWith('tail-') ? 38
          : 44
  return {
    left: `${anchor.x}px`,
    top: `${anchor.y}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: String(20 + Math.round((1 - anchor.depth) * 10)),
  }
}

function partAriaLabel(partId: MotionBodyPartId) {
  const part = getMotionBodyPart(partId)
  const selected = editor.selectedBodyPartId === partId ? '，当前已选中' : ''
  return `选择并拖拽${part.labelZh}${selected}`
}

function selectPart(partId: MotionBodyPartId) {
  if (props.disabled || !editablePartSet.value.has(partId)) return false
  if (editor.selectedBodyPartId !== partId) editor.selectBodyPart(partId)
  return true
}

function setMode(mode: DirectMotionMode) {
  if (props.disabled) return
  if (pointerGesture.active) cancelPointerManipulation()
  editor.setDirectManipulationMode(mode)
}

function updateOverlaySize() {
  const bounds = overlay.value?.getBoundingClientRect()
  overlaySize.width = bounds?.width || 0
  overlaySize.height = bounds?.height || 0
}

function releasePointerCapture() {
  const { target, pointerId } = pointerGesture
  if (target?.hasPointerCapture(pointerId)) {
    pointerGesture.releasingPointerCapture = true
    target.releasePointerCapture(pointerId)
  }
  pointerGesture.active = false
  pointerGesture.target = undefined
}

function beginPointerManipulation(anchor: StudioMotionPartAnchor, event: PointerEvent) {
  if (event.button !== 0 || props.disabled || pointerGesture.active) return
  event.preventDefault()
  event.stopPropagation()
  if (!selectPart(anchor.bodyPartId)) return
  if (!editor.beginDirectManipulation(event.pointerId, event.clientX, event.clientY)) return
  pointerGesture.active = true
  pointerGesture.pointerId = event.pointerId
  pointerGesture.startX = event.clientX
  pointerGesture.startY = event.clientY
  pointerGesture.releasingPointerCapture = false
  pointerGesture.target = event.currentTarget as HTMLElement
  pointerGesture.target.focus({ preventScroll: true })
  pointerGesture.target.setPointerCapture(event.pointerId)
}

function movePointerManipulation(event: PointerEvent) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return
  event.preventDefault()
  event.stopPropagation()
  const useDepthAxis = event.shiftKey || event.altKey
  editor.previewDirectManipulation(
    event.pointerId,
    event.clientX,
    useDepthAxis ? pointerGesture.startY : event.clientY,
    { width: overlaySize.width, height: overlaySize.height },
    useDepthAxis ? pointerGesture.startY - event.clientY : 0,
  )
}

function endPointerManipulation(event: PointerEvent) {
  if (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId) return
  event.preventDefault()
  event.stopPropagation()
  editor.commitDirectManipulation(event.pointerId)
  releasePointerCapture()
}

function cancelPointerManipulation(event?: PointerEvent) {
  if (event && (!pointerGesture.active || event.pointerId !== pointerGesture.pointerId)) return
  event?.preventDefault()
  event?.stopPropagation()
  editor.cancelDirectManipulation()
  releasePointerCapture()
}

function onLostPointerCapture(event: PointerEvent) {
  if (event.pointerId !== pointerGesture.pointerId) return
  if (pointerGesture.releasingPointerCapture || !pointerGesture.active) {
    pointerGesture.releasingPointerCapture = false
    return
  }
  cancelPointerManipulation()
}

function nudgeWithKeyboard(partId: MotionBodyPartId, event: KeyboardEvent) {
  const amount = event.ctrlKey || event.metaKey ? 4 : 16
  let x = 0
  let y = 0
  let depth = 0
  if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) depth = event.key === 'ArrowUp' ? amount : -amount
  else if (event.key === 'ArrowLeft') x = -amount
  else if (event.key === 'ArrowRight') x = amount
  else if (event.key === 'ArrowUp') y = -amount
  else if (event.key === 'ArrowDown') y = amount
  else return
  if (!selectPart(partId)) return
  event.preventDefault()
  event.stopPropagation()
  const keyboardPointerId = -1
  if (!editor.beginDirectManipulation(keyboardPointerId, 0, 0)) return
  editor.previewDirectManipulation(
    keyboardPointerId,
    x,
    y,
    { width: overlaySize.width, height: overlaySize.height },
    depth,
  )
  editor.commitDirectManipulation(keyboardPointerId)
}

function onHotspotKeydown(anchor: StudioMotionPartAnchor, event: KeyboardEvent) {
  if (event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    selectPart(anchor.bodyPartId)
  }
  else if (event.key === 'm' || event.key === 'M') {
    event.preventDefault()
    event.stopPropagation()
    setMode('translate')
  }
  else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault()
    event.stopPropagation()
    setMode('rotate')
  }
  else if (event.key === 'Escape' && editor.directManipulation.active) {
    event.preventDefault()
    event.stopPropagation()
    cancelPointerManipulation()
  }
  else nudgeWithKeyboard(anchor.bodyPartId, event)
}

function onPartListKeydown(partId: MotionBodyPartId, event: KeyboardEvent) {
  if (event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    selectPart(partId)
  }
  else if (event.key === 'm' || event.key === 'M') {
    event.preventDefault()
    event.stopPropagation()
    setMode('translate')
  }
  else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault()
    event.stopPropagation()
    setMode('rotate')
  }
  else if (event.key === 'Escape' && editor.directManipulation.active) {
    event.preventDefault()
    event.stopPropagation()
    cancelPointerManipulation()
  }
  else nudgeWithKeyboard(partId, event)
}

function onFloatingToolKeydown(event: KeyboardEvent) {
  if (event.key === 'm' || event.key === 'M') {
    event.preventDefault()
    event.stopPropagation()
    setMode('translate')
  }
  else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault()
    event.stopPropagation()
    setMode('rotate')
  }
  else if (event.key === 'Escape' && editor.directManipulation.active) {
    event.preventDefault()
    event.stopPropagation()
    cancelPointerManipulation()
  }
  else nudgeWithKeyboard(editor.selectedBodyPartId, event)
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !editor.directManipulation.active) return
  event.preventDefault()
  event.stopImmediatePropagation()
  cancelPointerManipulation()
}

function onWindowBlur() {
  if (pointerGesture.active || editor.directManipulation.active) cancelPointerManipulation()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateOverlaySize)
  if (overlay.value) resizeObserver.observe(overlay.value)
  updateOverlaySize()
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('blur', onWindowBlur)
})
watch(() => props.disabled, disabled => {
  if (disabled && (pointerGesture.active || editor.directManipulation.active)) cancelPointerManipulation()
})
watch([
  () => editor.directManipulation.active,
  () => editor.selectedBodyPartId,
  () => props.editableParts,
  () => props.anchors,
], ([active]) => {
  if (!active) return
  const stillEditable = props.editableParts.includes(editor.selectedBodyPartId)
  const selectedAnchor = anchorByPartId.value.get(editor.selectedBodyPartId)
  if (!stillEditable || !selectedAnchor?.visible) cancelPointerManipulation()
}, { deep: true, flush: 'sync' })
onBeforeUnmount(() => {
  cancelPointerManipulation()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('blur', onWindowBlur)
})
</script>

<template>
  <div ref="overlay" class="studio-motion-direct-manipulator" aria-label="3D 宠物部位直接操控层">
    <button
      v-for="anchor in visibleAnchors"
      :key="anchor.bodyPartId"
      type="button"
      class="direct-part-hotspot"
      :class="{
        'direct-part-hotspot--selected': editor.selectedBodyPartId === anchor.bodyPartId,
        'direct-part-hotspot--dragging': editor.directManipulation.active && editor.selectedBodyPartId === anchor.bodyPartId,
      }"
      :style="hotspotStyle(anchor)"
      tabindex="0"
      :aria-label="partAriaLabel(anchor.bodyPartId)"
      :aria-pressed="editor.selectedBodyPartId === anchor.bodyPartId"
      :disabled="disabled"
      @click.stop="selectPart(anchor.bodyPartId)"
      @keydown="onHotspotKeydown(anchor, $event)"
      @pointerdown="beginPointerManipulation(anchor, $event)"
      @pointermove="movePointerManipulation"
      @pointerup="endPointerManipulation"
      @pointercancel="cancelPointerManipulation"
      @lostpointercapture="onLostPointerCapture"
    >
      <span class="direct-part-hotspot__dot" aria-hidden="true" />
      <span v-if="editor.selectedBodyPartId === anchor.bodyPartId" class="direct-part-hotspot__label">{{ getMotionBodyPart(anchor.bodyPartId).labelZh }}</span>
    </button>

    <div
      v-if="selectedAnchor && floatingToolPosition"
      class="direct-floating-tool"
      :style="floatingToolPosition"
      role="toolbar"
      :aria-label="`${selectedPart.labelZh}操控方式`"
      @pointerdown.stop
      @keydown="onFloatingToolKeydown"
    >
      <strong class="direct-floating-tool__part">{{ selectedPart.labelZh }}</strong>
      <div class="direct-floating-tool__modes">
        <button
          v-if="selectedCapability?.modes.includes('translate')"
          type="button"
          class="direct-mode-button"
          :class="{ 'direct-mode-button--active': editor.directManipulationMode === 'translate' }"
          :aria-pressed="editor.directManipulationMode === 'translate'"
          aria-label="切换为移动部位"
          @click.stop="setMode('translate')"
          @keydown.space.stop.prevent="setMode('translate')"
        ><span aria-hidden="true">↔</span>移动</button>
        <button
          v-if="selectedCapability?.modes.includes('rotate')"
          type="button"
          class="direct-mode-button"
          :class="{ 'direct-mode-button--active': editor.directManipulationMode === 'rotate' }"
          :aria-pressed="editor.directManipulationMode === 'rotate'"
          aria-label="切换为旋转部位"
          @click.stop="setMode('rotate')"
          @keydown.space.stop.prevent="setMode('rotate')"
        ><span aria-hidden="true">↻</span>旋转</button>
      </div>
      <button type="button" class="direct-reset-button" aria-label="恢复当前部位" @click.stop="editor.resetSelectedDirectPart()" @keydown.space.stop.prevent="editor.resetSelectedDirectPart()">重置</button>
      <span v-if="editor.directManipulation.status === 'clamped'" class="direct-floating-tool__status" role="status">已到安全范围</span>
      <span v-else-if="editor.directManipulation.active" class="direct-floating-tool__status" role="status">拖动中 · Shift 前后</span>
    </div>

    <details class="direct-part-fallback">
      <summary class="direct-part-fallback__summary" @keydown.space.stop>完整部位列表</summary>
      <div class="direct-part-fallback__list" role="list" aria-label="所有可编辑部位">
        <button
          v-for="partId in editableParts"
          :key="partId"
          type="button"
          class="direct-part-fallback__button"
          :class="{ 'direct-part-fallback__button--active': editor.selectedBodyPartId === partId }"
          :aria-current="editor.selectedBodyPartId === partId ? 'true' : undefined"
          :disabled="disabled"
          @click.stop="selectPart(partId)"
          @keydown="onPartListKeydown(partId, $event)"
        >{{ getMotionBodyPart(partId).labelZh }}</button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.studio-motion-direct-manipulator{position:absolute;z-index:8;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}.direct-part-hotspot{position:absolute;display:grid;place-items:center;min-width:36px;min-height:36px;padding:0;transform:translate(-50%,-50%);border:1px solid transparent;border-radius:50%;color:#effffc;background:transparent;cursor:grab;pointer-events:auto;touch-action:none;transition:border-color .16s ease,background-color .16s ease,box-shadow .16s ease}.direct-part-hotspot:hover,.direct-part-hotspot:focus-visible{border-color:#70efe0a8;background:#5ce9d51b;box-shadow:0 0 0 5px #52e9d313;outline:none}.direct-part-hotspot--selected{border-color:#72f5e5;background:#59e6d421;box-shadow:0 0 0 5px #52e9d318,0 0 22px #5de8d82f}.direct-part-hotspot--dragging{cursor:grabbing}.direct-part-hotspot:disabled{cursor:not-allowed;opacity:.42}.direct-part-hotspot__dot{width:10px;height:10px;border:2px solid #b9fff6;border-radius:50%;background:#09201f;box-shadow:0 0 12px #67f4e2}.direct-part-hotspot__label{position:absolute;top:calc(100% + 4px);left:50%;padding:3px 7px;transform:translateX(-50%);border:1px solid #70efe052;border-radius:999px;color:#dffffa;background:#07111de8;font-size:10px;font-weight:700;line-height:1;white-space:nowrap}.direct-floating-tool{position:absolute;display:flex;align-items:center;gap:6px;min-height:42px;padding:6px 7px 6px 10px;transform:translate(-50%,-50%);border:1px solid #78f3e34a;border-radius:14px;background:#07111eea;box-shadow:0 14px 36px #0008,0 0 0 1px #ffffff0b inset;backdrop-filter:blur(16px);pointer-events:auto}.direct-floating-tool__part{max-width:72px;overflow:hidden;color:#edfffc;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.direct-floating-tool__modes{display:flex;gap:3px;padding:3px;border-radius:10px;background:#020711b8}.direct-mode-button,.direct-reset-button{min-height:30px;border:1px solid transparent;border-radius:8px;color:#aebad1;background:transparent;font-size:10px;font-weight:750;cursor:pointer}.direct-mode-button{display:flex;align-items:center;gap:4px;padding:0 8px}.direct-mode-button--active{border-color:#66e9d965;color:#eafffb;background:#46d6c52c}.direct-mode-button:focus-visible,.direct-reset-button:focus-visible,.direct-part-fallback__summary:focus-visible,.direct-part-fallback__button:focus-visible{outline:2px solid #7ef8e8;outline-offset:2px}.direct-reset-button{padding:0 7px;border-color:#ffffff17}.direct-floating-tool__status{position:absolute;top:calc(100% + 5px);left:50%;padding:4px 8px;transform:translateX(-50%);border:1px solid #f3d4763b;border-radius:999px;color:#f6df99;background:#0a101de8;font-size:9px;white-space:nowrap}.direct-part-fallback{position:absolute;top:12px;right:12px;width:min(180px,calc(100% - 24px));border:1px solid #78f3e32e;border-radius:11px;color:#dffefa;background:#07111ed9;backdrop-filter:blur(14px);pointer-events:auto}.direct-part-fallback__summary{padding:8px 10px;font-size:10px;font-weight:750;cursor:pointer;list-style-position:inside}.direct-part-fallback__list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;max-height:210px;padding:0 7px 7px;overflow:auto}.direct-part-fallback__button{min-height:30px;padding:4px 6px;overflow:hidden;border:1px solid #ffffff14;border-radius:7px;color:#aebad1;background:#0207118f;font-size:9px;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.direct-part-fallback__button--active{border-color:#66e9d965;color:#eafffb;background:#46d6c52c}.direct-part-fallback__button:disabled{cursor:not-allowed;opacity:.42}@media(prefers-reduced-motion:reduce){.direct-part-hotspot{transition:none}}
</style>
