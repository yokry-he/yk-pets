<!--
  文件职责 / File responsibility
  在动作预览上提供移动、旋转和缩放拖拽操控板，使身体部件调整可在画布旁直接完成。
  Provides a translate, rotate, and scale drag pad over the motion preview so body-part adjustments can be performed directly beside the canvas.
-->
<script setup lang="ts">
import {
  MOTION_BODY_PARTS,
  getMotionBodyPart,
  getMotionBodyPartControls,
  getMotionBodyPartModes,
  type MotionBodyPartId,
  type MotionControlDefinition,
  type MotionControlId,
  type MotionTransformMode,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const editor = useStudioMotionEditorStore()
const pad = ref<HTMLElement>()
const drag = reactive({ active: false, pointerId: 0, startX: 0, startY: 0 })
const selectedPart = computed(() => getMotionBodyPart(editor.selectedBodyPartId))
const controls = computed(() => getMotionBodyPartControls(editor.selectedBodyPartId, editor.transformMode))
const modes = computed(() => getMotionBodyPartModes(editor.selectedBodyPartId))
const modeLabels: Record<MotionTransformMode,string> = { translate: '移动', rotate: '旋转', scale: '缩放', semantic: '语义' }
const modeKeys: Record<MotionTransformMode,string> = { translate: 'W', rotate: 'E', scale: 'R', semantic: 'S' }

function control(axis: MotionControlDefinition['axis']) {
  return controls.value.find(item => item.axis === axis)
}
function selectPart(event: Event) {
  editor.selectBodyPart((event.target as HTMLSelectElement).value as MotionBodyPartId)
}
function begin(event: PointerEvent) {
  if (!editor.draft || (editor.authoringScope === 'selected-keyframes' && !editor.selectedKeyframeIds.length)) return
  drag.active = true
  drag.pointerId = event.pointerId
  drag.startX = event.clientX
  drag.startY = event.clientY
  pad.value?.setPointerCapture(event.pointerId)
  editor.beginControlGesture()
}
function move(event: PointerEvent) {
  if (!drag.active || event.pointerId !== drag.pointerId) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  const edits: { controlId: MotionControlId; delta: number }[] = []
  if (editor.transformMode === 'scale') {
    const item = control('uniform') || controls.value[0]
    if (item) edits.push({ controlId: item.id as MotionControlId, delta: -dy * .004 })
  }
  else {
    const factor = editor.transformMode === 'rotate' ? Math.PI / 360 : editor.transformMode === 'semantic' ? .005 : .004
    if (event.altKey) {
      const item = control('z') || control('value')
      if (item) edits.push({ controlId: item.id as MotionControlId, delta: -dy * factor })
    }
    else {
      const x = control('x') || controls.value[0]
      const y = control('y') || controls.value[1]
      if (x) edits.push({ controlId: x.id as MotionControlId, delta: dx * factor })
      if (y) edits.push({ controlId: y.id as MotionControlId, delta: -dy * factor })
    }
  }
  editor.previewControlGesture(edits)
}
function end(event: PointerEvent) {
  if (!drag.active || event.pointerId !== drag.pointerId) return
  drag.active = false
  pad.value?.releasePointerCapture(event.pointerId)
  editor.endControlGesture()
}
function cancel() {
  drag.active = false
  editor.cancelControlGesture()
}
onBeforeUnmount(cancel)
</script>

<template>
  <aside class="direct-pad" :class="{ dragging: drag.active }">
    <div class="pad-header">
      <select :value="editor.selectedBodyPartId" @change="selectPart">
        <option v-for="part in MOTION_BODY_PARTS" :key="part.id" :value="part.id">{{ part.labelZh }}</option>
      </select>
      <div class="mode-buttons">
        <button v-for="mode in (['translate','rotate','scale'] as MotionTransformMode[])" :key="mode" :disabled="!modes.includes(mode)" :class="{active:editor.transformMode===mode}" @click="editor.setTransformMode(mode)"><kbd>{{ modeKeys[mode] }}</kbd></button>
      </div>
    </div>
    <div ref="pad" class="pad-surface" @pointerdown="begin" @pointermove="move" @pointerup="end" @pointercancel="cancel">
      <span class="axis axis-x">X</span><span class="axis axis-y">Y</span>
      <i /><strong>{{ modeLabels[editor.transformMode] }}</strong>
      <small>{{ editor.transformMode === 'scale' ? '上下拖动等比缩放' : '拖动 X / Y · Alt 拖动 Z' }}</small>
    </div>
    <footer><span>{{ selectedPart.labelZh }}</span><button title="恢复当前控制" @click="editor.resetControl()">↺</button></footer>
  </aside>
</template>

<style scoped>
.direct-pad{position:absolute;z-index:7;left:18px;top:18px;width:184px;padding:7px;border:1px solid #ffffff20;border-radius:12px;color:#eef3ff;background:#080c17c7;box-shadow:0 12px 34px #0008;backdrop-filter:blur(16px)}.pad-header{display:grid;grid-template-columns:1fr auto;gap:5px}.pad-header select,.mode-buttons button,.direct-pad footer button{height:27px;border:1px solid #ffffff1d;border-radius:7px;color:#eaf0ff;background:#090e1b}.pad-header select{min-width:0;padding:0 6px;font-size:8px}.mode-buttons{display:flex;gap:3px}.mode-buttons button{width:27px;padding:0}.mode-buttons button.active{border-color:#52e0d077;color:#cffff8;background:#52e0d018}.mode-buttons button:disabled{opacity:.25}.mode-buttons kbd{font:700 8px/1 ui-monospace,monospace}.pad-surface{position:relative;display:grid;place-items:center;height:92px;margin-top:6px;overflow:hidden;border:1px solid #ffffff16;border-radius:9px;background:linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px),radial-gradient(circle,#52e0d010,transparent 62%);background-size:23px 23px;cursor:grab;touch-action:none;user-select:none}.dragging .pad-surface{cursor:grabbing;border-color:#52e0d066}.pad-surface::before,.pad-surface::after{content:"";position:absolute;background:#ffffff18}.pad-surface::before{left:50%;top:0;bottom:0;width:1px}.pad-surface::after{left:0;right:0;top:50%;height:1px}.pad-surface i{position:absolute;width:19px;height:19px;border:1px solid #b9fff7;border-radius:50%;background:#52e0d022;box-shadow:0 0 18px #52e0d044}.pad-surface strong{position:absolute;top:9px;font-size:9px}.pad-surface small{position:absolute;bottom:7px;color:#78839f;font-size:7px}.axis{position:absolute;color:#6c7793;font:700 7px/1 ui-monospace,monospace}.axis-x{right:6px;top:48%}.axis-y{left:48%;top:5px}.direct-pad footer{display:flex;align-items:center;justify-content:space-between;padding:5px 1px 0;color:#9ba6c3;font-size:8px}.direct-pad footer button{width:27px;padding:0}@media(max-width:780px){.direct-pad{left:13px;top:13px;width:164px}.pad-surface{height:76px}}
</style>
