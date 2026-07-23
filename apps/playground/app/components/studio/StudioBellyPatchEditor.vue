<!--
  文件职责 / File responsibility
  编辑模型默认、自定义和隐藏三种肚皮模式，以及自定义轮廓参数。
  Edits model-default, custom, and hidden belly modes plus custom silhouette parameters.
-->
<script setup lang="ts">
import {
  BELLY_PATCH_DESIGN_RANGES,
  BELLY_PATCH_MODES,
  BELLY_PATCH_STYLES,
} from '~/domain/pet-species-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const design = computed(() => store.recipe.bellyPatchDesign)
const customEnabled = computed(() => design.value.mode === 'custom')
function updateMode() {
  design.value.visible = design.value.mode !== 'none'
  store.markDirty()
}
</script>

<template>
  <section class="card">
    <h3>白色肚皮</h3>
    <label>
      显示模式
      <select v-model="design.mode" @focus="store.checkpoint" @change="updateMode">
        <option v-for="item in BELLY_PATCH_MODES" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <p class="hint">
      {{ design.mode === 'model-default' ? '使用正式 Cloud Fox 模型自带的经典肚皮，不再叠加第二层。' : design.mode === 'custom' ? '隐藏模型默认肚皮，仅显示下方自定义轮廓。' : '模型默认肚皮与自定义肚皮都不显示。' }}
    </p>
    <fieldset :disabled="!customEnabled">
      <label>
        自定义样式
        <select v-model="design.style" @focus="store.checkpoint" @change="store.markDirty">
          <option v-for="item in BELLY_PATCH_STYLES" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <label>宽度 {{ design.width.toFixed(2) }}<input v-model.number="design.width" type="range" :min="BELLY_PATCH_DESIGN_RANGES.width[0]" :max="BELLY_PATCH_DESIGN_RANGES.width[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
      <label>高度 {{ design.height.toFixed(2) }}<input v-model.number="design.height" type="range" :min="BELLY_PATCH_DESIGN_RANGES.height[0]" :max="BELLY_PATCH_DESIGN_RANGES.height[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
      <label>上下位置 {{ design.offsetY.toFixed(2) }}<input v-model.number="design.offsetY" type="range" :min="BELLY_PATCH_DESIGN_RANGES.offsetY[0]" :max="BELLY_PATCH_DESIGN_RANGES.offsetY[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty"></label>
    </fieldset>
  </section>
</template>

<style scoped>
.card{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.card h3,.card p{margin:0}.card label,.card fieldset{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.card fieldset{margin:0;padding:0;border:0;gap:9px}.card fieldset:disabled{opacity:.42}.card select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.card input[type=range]{width:100%;accent-color:#7066ff}.hint{color:#8f99b8;font-size:12px;line-height:1.55}
</style>
