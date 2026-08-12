<!--
  文件职责 / File responsibility
  用核心显示单位呈现单个精确控制，并复用 Store 的手势、步进与复位命令。
  Presents one exact control in core display units while reusing Store gesture, nudge, and reset commands.
-->
<script setup lang="ts">
import {
  clampMotionControlValue,
  fromMotionControlDisplayValue,
  getCloudFoxRigChannel,
  toMotionControlDisplayValue,
  type MotionControlDefinition,
  type MotionControlId,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const props = defineProps<{
  control: MotionControlDefinition
  disabled?: boolean
}>()

const editor = useStudioMotionEditorStore()
const controlId = computed(() => props.control.id as MotionControlId)
const stage = computed(() => editor.selectedSimpleStage)
const rawValue = computed(() => stage.value?.pose[controlId.value] ?? 0)
const displayValue = computed(() => toMotionControlDisplayValue(rawValue.value, props.control.displayUnit))
const range = computed(() => {
  const channels = props.control.channelIds.map(getCloudFoxRigChannel)
  const minimum = Math.max(...channels.map(channel => channel.minimum))
  const maximum = Math.min(...channels.map(channel => channel.maximum))
  return {
    minimum: toMotionControlDisplayValue(minimum, props.control.displayUnit),
    maximum: toMotionControlDisplayValue(maximum, props.control.displayUnit),
  }
})
const displayStep = computed(() => toMotionControlDisplayValue(props.control.fineStep, props.control.displayUnit))
const isDisabled = computed(() => props.disabled || !stage.value || editor.directManipulation.active)
const unit = computed(() => props.control.displayUnit === 'degree' ? '°' : props.control.displayUnit === 'distance' ? '局部距离' : props.control.displayUnit === 'normalized' ? '0–1' : '倍率')
const inputElement = ref<HTMLInputElement>()
let gestureActive = false
let gestureBaseline = 0

function beginGesture() {
  if (gestureActive || isDisabled.value) return gestureActive
  gestureBaseline = rawValue.value
  gestureActive = editor.beginControlGesture()
  return gestureActive
}

function previewValue(event: Event) {
  if (!beginGesture()) return
  const display = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(display)) return
  const safeDisplay = Math.max(range.value.minimum, Math.min(range.value.maximum, display))
  const next = clampMotionControlValue(
    controlId.value,
    fromMotionControlDisplayValue(safeDisplay, props.control.displayUnit),
  )
  editor.previewControlGesture([{ controlId: controlId.value, delta: next - gestureBaseline }])
}

function commitGesture() {
  if (!gestureActive) return
  editor.endControlGesture()
  gestureActive = false
}

function cancelGesture() {
  if (!gestureActive) return
  editor.cancelControlGesture()
  gestureActive = false
}

function nudge(direction: -1 | 1, event: MouseEvent) {
  if (isDisabled.value) return
  const delta = (event.shiftKey ? props.control.fineStep : props.control.step) * direction
  editor.nudgeControl(controlId.value, delta)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  cancelGesture()
  ;(event.currentTarget as HTMLInputElement).blur()
}

function onWindowPointerDown(event: PointerEvent) {
  if (!gestureActive || event.target === inputElement.value) return
  // 捕获阶段先提交数值输入，确保随后在 3D 热点开始的拖拽能取得新的手势基线。
  commitGesture()
}

watch(() => [editor.selectedStageId, props.control.id], cancelGesture)
onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown, true)
  window.addEventListener('blur', cancelGesture)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown, true)
  window.removeEventListener('blur', cancelGesture)
  cancelGesture()
})
</script>

<template>
  <div class="exact-control">
    <label :for="`exact-${control.id}`">
      <strong>{{ control.labelZh }}</strong>
      <small>{{ unit }}</small>
    </label>
    <button type="button" :disabled="isDisabled" title="减少；按住 Shift 使用精细步长" :aria-label="`减少${control.labelZh}`" @click="nudge(-1, $event)">−</button>
    <input
      ref="inputElement"
      :id="`exact-${control.id}`"
      :value="Number(displayValue.toFixed(control.displayUnit === 'degree' ? 1 : 3))"
      type="number"
      :min="range.minimum"
      :max="range.maximum"
      :step="displayStep"
      :disabled="isDisabled"
      @focus="beginGesture"
      @input="previewValue"
      @change="commitGesture"
      @blur="commitGesture"
      @keydown="onKeydown"
    >
    <button type="button" :disabled="isDisabled" title="增加；按住 Shift 使用精细步长" :aria-label="`增加${control.labelZh}`" @click="nudge(1, $event)">＋</button>
    <button type="button" class="exact-control__reset" :disabled="isDisabled" :aria-label="`恢复${control.labelZh}`" title="恢复此参数" @click="editor.resetControl(control.id as MotionControlId)">↺</button>
  </div>
</template>

<style scoped>
.exact-control{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(66px,82px) 28px 28px;align-items:center;gap:4px;padding:6px;border:1px solid #ffffff12;border-radius:9px;background:#080c16}.exact-control label{display:grid;min-width:0;gap:2px}.exact-control strong{overflow:hidden;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.exact-control small{color:#68738f;font-size:7px}.exact-control button,.exact-control input{box-sizing:border-box;height:29px;border:1px solid #ffffff1c;border-radius:7px;color:#e4e9fb;background:#060a13}.exact-control button{width:28px;padding:0;cursor:pointer}.exact-control button:disabled,.exact-control input:disabled{cursor:not-allowed;opacity:.38}.exact-control input{width:100%;padding:0 6px;font:700 9px/1 ui-monospace,monospace}.exact-control button:focus-visible,.exact-control input:focus-visible{outline:2px solid #7ff3e5;outline-offset:2px}.exact-control__reset{color:#8490ad!important}@media(max-width:420px){.exact-control{grid-template-columns:minmax(0,1fr) 28px minmax(62px,76px) 28px}.exact-control__reset{grid-column:4}}
</style>
