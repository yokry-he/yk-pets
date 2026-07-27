<!--
  文件职责 / File responsibility
  为复杂双足萌宠提供受控的新手参数面板。输入只在一次拖动或数值提交完成时向父层发出变更，
  由 Store 统一归一化、持久化并重新触发运行时编译，组件自身不持有配方真相来源。
-->
<script setup lang="ts">
import {
  BIPED_PET_MODEL_RECIPE_LIMITS,
  compileBipedPetCharacter,
  normalizeBipedPetModelRecipe,
  type BipedPetAppendages,
  type BipedPetBodyStyle,
  type BipedPetProportions,
  type CharacterCompilationDiagnostic,
  type CharacterModelRecipeV1,
} from '@yk-pets/pet-core'

type ProportionKey = keyof BipedPetProportions
type AppendageKey = keyof BipedPetAppendages

interface CompilationSummary {
  status: 'ready' | 'blocked'
  diagnostics: CharacterCompilationDiagnostic[]
}

const props = defineProps<{
  recipe: CharacterModelRecipeV1
  compilation?: CompilationSummary
  readonly?: boolean
}>()

const emit = defineEmits<{
  'apply-style': [style: BipedPetBodyStyle]
  'update-proportion': [key: ProportionKey, value: number]
  'update-appendage': [key: AppendageKey, enabled: boolean]
  'restore-safe-defaults': []
}>()

const bodyStyles: Array<{ bodyStyle: BipedPetBodyStyle; label: string; effect: string }> = [
  { bodyStyle: 'soft', label: '柔软', effect: '头身柔和，适合亲近感。' },
  { bodyStyle: 'athletic', label: '运动', effect: '肩背更开，四肢更利落。' },
  { bodyStyle: 'round', label: '圆润', effect: '头部更饱满，轮廓更可爱。' },
  { bodyStyle: 'slender', label: '纤细', effect: '身形更修长，线条更轻盈。' },
]

const proportions: Array<{ key: ProportionKey; label: string; effect: string; step: number }> = [
  { key: 'height', label: '身高', effect: '整体站立高度。', step: 0.01 },
  { key: 'headRatio', label: '头身比', effect: '头部相对身体的大小。', step: 0.01 },
  { key: 'shoulderWidth', label: '肩宽', effect: '上半身的展开程度。', step: 0.01 },
  { key: 'hipWidth', label: '腰/胯宽', effect: '下半身的稳定感。', step: 0.01 },
  { key: 'torsoLength', label: '躯干', effect: '身体中段的长度。', step: 0.01 },
  { key: 'armLength', label: '手臂', effect: '双臂的修长程度。', step: 0.01 },
  { key: 'legLength', label: '腿部', effect: '双腿的修长程度。', step: 0.01 },
  { key: 'handSize', label: '手掌', effect: '手部的相对大小。', step: 0.01 },
  { key: 'footSize', label: '脚掌', effect: '脚部的相对大小。', step: 0.01 },
]

const appendages: Array<{ key: AppendageKey; label: string; effect: string }> = [
  { key: 'ears', label: '耳朵', effect: '保留当前长度和分段。' },
  { key: 'tail', label: '尾巴', effect: '保留当前长度和分段。' },
  { key: 'antennae', label: '触角', effect: '保留当前长度和分段。' },
]

const localProportions = ref<BipedPetProportions>({ ...props.recipe.proportions })
const editingProportion = ref<ProportionKey | undefined>()

// 编译结果仅由配方依赖改变时重新计算；摘要状态回写不会导致重复编译。 / Recompile only when the recipe changes; summary commits never trigger another compilation.
const generatedGeometry = computed(() => {
  const compilation = compileBipedPetCharacter(normalizeBipedPetModelRecipe(props.recipe, props.recipe.updatedAt))
  return {
    boneCount: compilation.bones.length,
    vertexCount: compilation.mesh.vertexCount,
    diagnostics: compilation.diagnostics,
    status: compilation.status,
  }
})

const generatedInfo = computed(() => ({
  ...generatedGeometry.value,
  diagnostics: props.compilation?.diagnostics ?? generatedGeometry.value.diagnostics,
  status: props.compilation?.status ?? generatedGeometry.value.status,
}))

watch(() => props.recipe.proportions, next => {
  for (const { key } of proportions) {
    if (editingProportion.value !== key) localProportions.value[key] = next[key]
  }
}, { deep: true })

function updateLocalProportion(key: ProportionKey, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!input.value.trim()) return
  if (Number.isFinite(value)) localProportions.value[key] = value
}

function beginProportionEdit(key: ProportionKey) {
  editingProportion.value = key
}

function commitProportion(key: ProportionKey) {
  const value = localProportions.value[key]
  if (Number.isFinite(value)) emit('update-proportion', key, value)
  editingProportion.value = undefined
}

function cancelProportion(key: ProportionKey, event?: Event) {
  if (editingProportion.value !== key) return
  const restored = props.recipe.proportions[key]
  localProportions.value[key] = restored
  const input = event?.target as HTMLInputElement | undefined
  if (input) input.value = String(restored)
  editingProportion.value = undefined
}

function commitNumberProportion(key: ProportionKey, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!input.value.trim() || !Number.isFinite(value)) {
    cancelProportion(key, event)
    return
  }
  localProportions.value[key] = value
  commitProportion(key)
}

function toggleAppendage(key: AppendageKey, event: Event) {
  emit('update-appendage', key, (event.target as HTMLInputElement).checked)
}

function limitFor(key: ProportionKey) {
  return BIPED_PET_MODEL_RECIPE_LIMITS.proportions[key]
}
</script>

<template>
  <section class="complex-model-editor" aria-label="复杂模型新手编辑器">
    <header class="complex-model-heading">
      <small class="complex-model-eyebrow">复杂模型</small>
      <h2 class="complex-model-heading-title">调整外形</h2>
      <p class="complex-model-heading-description">从模板开始，再按需要微调比例；每次调整都会安全生成新的预览。</p>
    </header>

    <section class="complex-model-section" aria-labelledby="complex-model-style-title">
      <h3 id="complex-model-style-title" class="complex-model-section-title">体型模板</h3>
      <div class="complex-model-style-grid">
        <button
          v-for="style in bodyStyles"
          :key="style.bodyStyle"
          type="button"
          class="complex-model-style-option"
          :class="{ 'complex-model-style-option--active': recipe.bodyStyle === style.bodyStyle }"
          :aria-pressed="recipe.bodyStyle === style.bodyStyle"
          :disabled="readonly"
          @click="emit('apply-style', style.bodyStyle)"
        >
          <strong class="complex-model-style-label">{{ style.label }}</strong>
          <small class="complex-model-style-effect">{{ style.effect }}</small>
        </button>
      </div>
    </section>

    <section class="complex-model-section" aria-labelledby="complex-model-proportion-title">
      <h3 id="complex-model-proportion-title" class="complex-model-section-title">比例微调</h3>
      <p class="complex-model-hint">拖动滑块后松开才会保存一次；输入数值后确认即可应用。</p>
      <div class="complex-model-proportion-list">
        <article v-for="item in proportions" :key="item.key" class="complex-model-proportion-row">
          <label class="complex-model-proportion-label" :for="`complex-model-range-${item.key}`">
            <strong class="complex-model-proportion-name">{{ item.label }}</strong>
            <small class="complex-model-proportion-effect">{{ item.effect }}</small>
          </label>
          <div class="complex-model-proportion-controls">
            <input
              :id="`complex-model-range-${item.key}`"
              class="complex-model-range"
              type="range"
              :min="limitFor(item.key)[0]"
              :max="limitFor(item.key)[1]"
              :step="item.step"
              :value="localProportions[item.key]"
              :aria-label="`${item.label}，范围 ${limitFor(item.key)[0]} 到 ${limitFor(item.key)[1]}`"
              :disabled="readonly"
              @pointerdown="beginProportionEdit(item.key)"
              @input="updateLocalProportion(item.key, $event)"
              @change="commitProportion(item.key)"
              @pointercancel="cancelProportion(item.key, $event)"
            >
            <input
              class="complex-model-number"
              type="number"
              :min="limitFor(item.key)[0]"
              :max="limitFor(item.key)[1]"
              :step="item.step"
              :value="localProportions[item.key]"
              :aria-label="`${item.label}数值`"
              :disabled="readonly"
              @focus="beginProportionEdit(item.key)"
              @input="updateLocalProportion(item.key, $event)"
              @change="commitNumberProportion(item.key, $event)"
              @blur="cancelProportion(item.key, $event)"
            >
          </div>
        </article>
      </div>
    </section>

    <section class="complex-model-section" aria-labelledby="complex-model-appendage-title">
      <h3 id="complex-model-appendage-title" class="complex-model-section-title">附属特征</h3>
      <div class="complex-model-appendage-list">
        <label v-for="item in appendages" :key="item.key" class="complex-model-appendage-toggle" :for="`complex-model-appendage-${item.key}`">
          <span class="complex-model-appendage-copy"><strong class="complex-model-appendage-label">{{ item.label }}</strong><small class="complex-model-appendage-effect">{{ item.effect }}</small></span>
          <input
            :id="`complex-model-appendage-${item.key}`"
            class="complex-model-toggle-input"
            type="checkbox"
            :checked="recipe.appendages[item.key].enabled"
            :aria-label="`启用${item.label}`"
            :disabled="readonly"
            @change="toggleAppendage(item.key, $event)"
          >
        </label>
      </div>
    </section>

    <button type="button" class="complex-model-restore" :disabled="readonly" @click="emit('restore-safe-defaults')">恢复安全默认值</button>

    <details class="complex-model-advanced">
      <summary class="complex-model-advanced-summary">高级信息（只读）</summary>
      <dl class="complex-model-facts">
        <div class="complex-model-fact"><dt class="complex-model-fact-label">Profile</dt><dd class="complex-model-fact-value">{{ recipe.rigProfileId }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">generator</dt><dd class="complex-model-fact-value">{{ recipe.generatorVersion }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">骨骼数</dt><dd class="complex-model-fact-value">{{ generatedInfo.boneCount }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">顶点数</dt><dd class="complex-model-fact-value">{{ generatedInfo.vertexCount }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">状态</dt><dd class="complex-model-fact-value">{{ generatedInfo.status === 'ready' ? '已生成' : '等待修复' }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">诊断</dt><dd class="complex-model-fact-value">{{ generatedInfo.diagnostics.length ? `${generatedInfo.diagnostics.length} 条提示` : '暂无提示' }}</dd></div>
        <div class="complex-model-fact"><dt class="complex-model-fact-label">安全范围</dt><dd class="complex-model-fact-value">所有比例均限制在可生成范围内。</dd></div>
      </dl>
      <p v-if="generatedInfo.diagnostics.length" class="complex-model-diagnostic">{{ generatedInfo.diagnostics[0]?.message }}</p>
    </details>
  </section>
</template>

<style scoped>
.complex-model-editor{display:grid;min-height:0;gap:14px;padding:14px;overflow-y:auto}.complex-model-eyebrow{color:#76dfd1;font:800 9px/1 ui-monospace,monospace;letter-spacing:.15em}.complex-model-heading-title{margin:5px 0 4px;font-size:20px}.complex-model-heading-description,.complex-model-hint{margin:0;color:#939dbb;font-size:11px;line-height:1.55}.complex-model-section{display:grid;gap:9px;padding-top:13px;border-top:1px solid #ffffff12}.complex-model-section-title{margin:0;font-size:13px}.complex-model-style-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.complex-model-style-option{display:grid;gap:3px;min-height:70px;padding:9px;border:1px solid #ffffff20;border-radius:10px;color:#dce4ff;text-align:left;background:#ffffff08}.complex-model-style-option--active{border-color:#54ddcfaa;color:#fff;background:#3ee0c61a}.complex-model-style-effect{color:#8e98b7;font-size:10px;line-height:1.35}.complex-model-proportion-list{display:grid;gap:7px}.complex-model-proportion-row{display:grid;grid-template-columns:minmax(82px,.72fr) minmax(0,1fr);gap:8px;align-items:center}.complex-model-proportion-label{display:grid;gap:2px}.complex-model-proportion-name{font-size:11px}.complex-model-proportion-effect{color:#8993b1;font-size:9px;line-height:1.35}.complex-model-proportion-controls{display:grid;grid-template-columns:minmax(0,1fr) 66px;gap:7px;align-items:center}.complex-model-range{width:100%;accent-color:#61dfd2}.complex-model-number{min-width:0;min-height:29px;padding:0 6px;border:1px solid #ffffff25;border-radius:7px;color:#eff4ff;background:#090e1b}.complex-model-appendage-list{display:grid;gap:6px}.complex-model-appendage-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:43px;padding:7px 9px;border:1px solid #ffffff18;border-radius:9px;background:#ffffff06}.complex-model-appendage-copy{display:grid;gap:2px}.complex-model-appendage-label{font-size:11px}.complex-model-appendage-effect{color:#8f99b6;font-size:9px}.complex-model-toggle-input{width:18px;height:18px;flex:none;accent-color:#58ded0}.complex-model-restore{justify-self:start;min-height:32px;padding:0 10px;border:1px solid #ffd28b66;border-radius:8px;color:#ffe1ad;background:#ffcf8612;font-size:11px}.complex-model-advanced{padding-top:12px;border-top:1px solid #ffffff12}.complex-model-advanced-summary{cursor:pointer;color:#dfe6ff;font-size:11px}.complex-model-facts{display:grid;gap:6px;margin:10px 0 0}.complex-model-fact{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;margin:0;font-size:10px}.complex-model-fact-label{color:#8d97b5}.complex-model-fact-value{min-width:0;margin:0;color:#e5ebff;overflow-wrap:anywhere}.complex-model-diagnostic{margin:9px 0 0;padding:7px;border-left:2px solid #f0c674;color:#f5dca7;background:#f0c67412;font-size:10px;line-height:1.45}.complex-model-style-option:focus-visible,.complex-model-number:focus-visible,.complex-model-range:focus-visible,.complex-model-appendage-toggle:focus-within,.complex-model-restore:focus-visible,.complex-model-advanced-summary:focus-visible{outline:2px solid #76dfd1;outline-offset:2px}.complex-model-style-option:disabled,.complex-model-number:disabled,.complex-model-range:disabled,.complex-model-toggle-input:disabled,.complex-model-restore:disabled{cursor:not-allowed;opacity:.5}@media (max-width:760px){.complex-model-editor{padding:12px}.complex-model-proportion-row{grid-template-columns:1fr}.complex-model-proportion-controls{grid-template-columns:minmax(0,1fr) 72px}.complex-model-style-grid{grid-template-columns:1fr}.complex-model-fact{grid-template-columns:68px minmax(0,1fr)}}
</style>
