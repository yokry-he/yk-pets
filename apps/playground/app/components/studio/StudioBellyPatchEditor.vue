<!--
  文件职责 / File responsibility
  编辑白色肚皮的显示状态、轮廓、宽高和上下位置。
  Edits belly-patch visibility, silhouette, width, height, and vertical placement.
-->
<script setup lang="ts">
import {
  BELLY_PATCH_DESIGN_RANGES,
  BELLY_PATCH_STYLES,
} from '~/domain/pet-species-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const design = computed(() => store.recipe.bellyPatchDesign)
</script>

<template>
  <section class="card">
    <h3>白色肚皮</h3>
    <label class="check">
      <input v-model="design.visible" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">
      显示肚皮
    </label>
    <label>
      样式
      <select v-model="design.style" @focus="store.checkpoint" @change="store.markDirty">
        <option v-for="item in BELLY_PATCH_STYLES" :key="item.id" :value="item.id">
          {{ item.label }}
        </option>
      </select>
    </label>
    <label>
      宽度 {{ design.width.toFixed(2) }}
      <input v-model.number="design.width" type="range" :min="BELLY_PATCH_DESIGN_RANGES.width[0]" :max="BELLY_PATCH_DESIGN_RANGES.width[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
    </label>
    <label>
      高度 {{ design.height.toFixed(2) }}
      <input v-model.number="design.height" type="range" :min="BELLY_PATCH_DESIGN_RANGES.height[0]" :max="BELLY_PATCH_DESIGN_RANGES.height[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
    </label>
    <label>
      上下位置 {{ design.offsetY.toFixed(2) }}
      <input v-model.number="design.offsetY" type="range" :min="BELLY_PATCH_DESIGN_RANGES.offsetY[0]" :max="BELLY_PATCH_DESIGN_RANGES.offsetY[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
    </label>
  </section>
</template>

<style scoped>
.card{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.card h3{margin:0}.card label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.card select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.card input[type=range]{width:100%;accent-color:#7066ff}.check{flex-direction:row!important;align-items:center}
</style>
