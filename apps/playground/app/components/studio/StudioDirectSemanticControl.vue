<!--
  文件职责 / File responsibility
  用中文语义滑杆编辑单个阶段姿势控制，并将连续输入收敛为一次 Store 手势事务。
  Edits one stage pose control with a semantic slider and collapses continuous input into one Store gesture transaction.
-->
<script setup lang="ts">
import {
  clampMotionControlValue,
  getCloudFoxRigChannel,
  getMotionControl,
  toMotionControlDisplayValue,
  type DirectMotionParameter,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const props = defineProps<{
  parameter: DirectMotionParameter
  disabled?: boolean
}>()

const editor = useStudioMotionEditorStore()
const control = computed(() => getMotionControl(props.parameter.controlId))
const stage = computed(() => editor.selectedSimpleStage)
const value = computed(() => stage.value?.pose[props.parameter.controlId] ?? 0)
const range = computed(() => {
  const channels = control.value.channelIds.map(getCloudFoxRigChannel)
  return {
    minimum: Math.max(...channels.map(channel => channel.minimum)),
    maximum: Math.min(...channels.map(channel => channel.maximum)),
  }
})
const isDisabled = computed(() => props.disabled || !stage.value || editor.directManipulation.active)
const displayValue = computed(() => toMotionControlDisplayValue(value.value, control.value.displayUnit))
const unit = computed(() => control.value.displayUnit === 'degree' ? '°' : control.value.displayUnit === 'distance' ? '局部距离' : control.value.displayUnit === 'normalized' ? '0–1' : '倍率')
let gestureActive = false
let gestureBaseline = 0

function beginGesture() {
  if (gestureActive || isDisabled.value) return gestureActive
  gestureBaseline = value.value
  gestureActive = editor.beginControlGesture()
  return gestureActive
}

function previewValue(event: Event) {
  if (!beginGesture()) return
  const next = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(next)) return
  const safe = clampMotionControlValue(props.parameter.controlId, next)
  editor.previewControlGesture([{ controlId: props.parameter.controlId, delta: safe - gestureBaseline }])
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

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  cancelGesture()
  ;(event.currentTarget as HTMLInputElement).blur()
}

watch(() => [editor.selectedStageId, props.parameter.controlId], cancelGesture)
onMounted(() => window.addEventListener('blur', cancelGesture))
onBeforeUnmount(() => {
  window.removeEventListener('blur', cancelGesture)
  cancelGesture()
})
</script>

<template>
  <label class="semantic-control" :class="{ 'semantic-control--disabled': isDisabled }">
    <span class="semantic-control__heading">
      <span>
        <strong>{{ parameter.labelZh }}</strong>
        <small>{{ unit }}</small>
      </span>
      <output :for="`semantic-${parameter.controlId}`">{{ Number(displayValue.toFixed(control.displayUnit === 'degree' ? 1 : 3)) }}{{ control.displayUnit === 'degree' ? '°' : '' }}</output>
    </span>
    <input
      :id="`semantic-${parameter.controlId}`"
      :value="value"
      type="range"
      :min="range.minimum"
      :max="range.maximum"
      :step="control.fineStep"
      :disabled="isDisabled"
      :aria-label="parameter.labelZh"
      @focus="beginGesture"
      @pointerdown="beginGesture"
      @input="previewValue"
      @change="commitGesture"
      @pointerup="commitGesture"
      @pointercancel="cancelGesture"
      @blur="commitGesture"
      @keydown="onKeydown"
    >
  </label>
</template>

<style scoped>
.semantic-control{display:grid;gap:7px;padding:9px;border:1px solid #ffffff14;border-radius:10px;background:#080d18}.semantic-control__heading,.semantic-control__heading>span{display:flex;align-items:center;justify-content:space-between;gap:8px}.semantic-control__heading>span{min-width:0}.semantic-control strong{overflow:hidden;color:#dce3f8;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.semantic-control small{flex:none;color:#697592;font-size:7px}.semantic-control output{flex:none;color:#bffbf3;font:800 9px/1 ui-monospace,monospace}.semantic-control input{width:100%;margin:0;accent-color:#52e0d0;cursor:pointer}.semantic-control input:focus-visible{outline:2px solid #7ff3e5;outline-offset:3px}.semantic-control--disabled{opacity:.48}.semantic-control--disabled input{cursor:not-allowed}
</style>
