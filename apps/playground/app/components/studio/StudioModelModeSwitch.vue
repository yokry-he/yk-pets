<!--
  文件职责 / File responsibility
  在统一 Studio 顶部切换同一宠物的简单/复杂模型编辑上下文，并显示复杂变体的真实完成状态。
  Switches one pet's simple/complex editing context in the shared Studio header and reports the complex variant's real status.
-->
<script setup lang="ts">
import type { StudioModelMode, StudioModelVariantStatus } from '~/domain/studio-model-variants'

defineOptions({ name: 'StudioModelModeSwitch' })
const props = defineProps<{
  modelValue: StudioModelMode
  complexStatus: StudioModelVariantStatus
  complexCompletion: number
}>()
const emit = defineEmits<{ 'update:modelValue': [mode: StudioModelMode] }>()
const statusLabel = computed(() => {
  if (props.complexStatus === 'ready') return '就绪'
  if (props.complexStatus === 'blocked') return '需修复'
  if (props.complexStatus === 'draft') return `草稿 ${Math.max(0, Math.min(100, Math.round(props.complexCompletion)))}%`
  return '未创建'
})
</script>

<template>
  <section class="model-mode-control" aria-label="当前模型模式">
    <span class="model-mode-label">模型模式</span>
    <div class="model-mode-buttons" role="group" aria-label="模型模式">
      <button type="button" class="model-mode-button" :class="{ active: modelValue === 'simple' }" :aria-pressed="modelValue === 'simple'" @click="emit('update:modelValue', 'simple')">简单模型</button>
      <button type="button" class="model-mode-button" :class="{ active: modelValue === 'complex' }" :aria-pressed="modelValue === 'complex'" @click="emit('update:modelValue', 'complex')">复杂模型</button>
    </div>
    <span class="model-mode-status" :data-status="complexStatus">{{ statusLabel }}</span>
  </section>
</template>

<style scoped>
.model-mode-control{display:grid;grid-template-columns:auto auto;align-items:center;gap:4px 7px;min-width:204px;padding:5px 7px;border:1px solid #ffffff14;border-radius:10px;background:#05091499}
.model-mode-label{color:#6f7998;font:800 7px/1 ui-monospace,monospace;letter-spacing:.1em}
.model-mode-buttons{grid-row:2;grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;border:1px solid #ffffff12;border-radius:8px;background:#03060d}
.model-mode-button{min-height:28px;padding:0 9px;border:1px solid transparent;border-radius:6px;color:#8792b0;background:transparent;font-size:9px;cursor:pointer}
.model-mode-button:hover{color:#dfe6fa;background:#ffffff08}
.model-mode-button.active{border-color:#52e0d066;color:#dffffa;background:#52e0d018;box-shadow:inset 0 0 0 1px #52e0d012}
.model-mode-button:focus-visible{outline:2px solid #76eadf;outline-offset:2px}
.model-mode-status{justify-self:end;color:#8792b0;font:700 7px/1 ui-monospace,monospace}
.model-mode-status[data-status='ready']{color:#79e7db}.model-mode-status[data-status='blocked']{color:#ff8da9}.model-mode-status[data-status='draft']{color:#e9ca7a}
@media(max-width:760px){.model-mode-control{width:100%;min-width:0;box-sizing:border-box}.model-mode-button{min-height:34px}}
</style>
