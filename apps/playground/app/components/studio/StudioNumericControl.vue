<!--
  文件职责 / File responsibility
  从唯一 Studio 控制注册表渲染滑杆、精确数值、重置和推荐范围提示，避免每个编辑器重复定义范围。
  Renders slider, precise number input, reset, and recommended-range feedback from the sole Studio control registry.
-->
<script setup lang="ts">
import { getStudioControl, isStudioValueOutsideRecommended, type StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const props = withDefaults(defineProps<{
  path: StudioControlPath
  modelValue: number
  label?: string
  disabled?: boolean
}>(), { label: '', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const store = usePetAppearanceStore()
const definition = computed(() => getStudioControl(props.path))
const outsideRecommended = computed(() => isStudioValueOutsideRecommended(props.path, props.modelValue))

function update(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('update:modelValue', value)
  store.markDirty()
}
function reset() {
  store.checkpoint()
  emit('update:modelValue', definition.value.defaultValue)
  store.markDirty()
}
</script>

<template>
  <label class="numeric-control" :data-experimental="outsideRecommended">
    <span class="control-heading">
      <span><strong>{{ label || definition.label }}</strong><small v-if="outsideRecommended">扩展范围</small></span>
      <button type="button" :disabled="disabled" @click.prevent="reset">重置</button>
    </span>
    <span class="control-inputs">
      <input
        :value="modelValue"
        :disabled="disabled"
        type="range"
        :min="definition.hardRange[0]"
        :max="definition.hardRange[1]"
        :step="definition.step"
        @pointerdown="store.beginTransaction"
        @pointerup="store.endTransaction"
        @pointercancel="store.endTransaction"
        @input="update"
      >
      <input
        :value="modelValue"
        :disabled="disabled"
        type="number"
        :min="definition.hardRange[0]"
        :max="definition.hardRange[1]"
        :step="definition.step"
        @focus="store.checkpoint"
        @change="update"
      >
    </span>
    <small class="range-note">推荐 {{ definition.recommendedRange[0] }}–{{ definition.recommendedRange[1] }} · 可调 {{ definition.hardRange[0] }}–{{ definition.hardRange[1] }}</small>
  </label>
</template>

<style scoped>
.numeric-control{display:grid;gap:6px;padding:8px 9px;border:1px solid transparent;border-radius:10px;color:#bec6df;background:#080d1890}.numeric-control[data-experimental=true]{border-color:#ffbd6a55;background:#ffbd6a0a}.control-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.control-heading>span{display:flex;align-items:center;gap:6px}.control-heading strong{font-size:11px}.control-heading small{padding:2px 5px;border-radius:999px;color:#ffd28b;background:#ffbd6a18;font-size:8px}.control-heading button{padding:3px 7px;border:1px solid #ffffff1b;border-radius:7px;color:#9da7c7;background:#ffffff08;font-size:8px;cursor:pointer}.control-inputs{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:8px;align-items:center}.control-inputs input[type=range]{width:100%;accent-color:#7066ff}.control-inputs input[type=number]{min-width:0;min-height:32px;border:1px solid #ffffff20;border-radius:8px;padding:0 7px;color:#fff;background:#090e1b;font-variant-numeric:tabular-nums}.range-note{color:#697391;font-size:8px}.numeric-control:focus-within{border-color:#52e0d055}
</style>
