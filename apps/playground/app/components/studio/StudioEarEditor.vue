<!--
  文件职责 / File responsibility
  独立编辑云狐耳朵形状、外层色、内层色、尖端色与内耳发光，不触碰其它外观字段。
  Edits Cloud Fox ear shape, outer/inner/tip colors, and inner glow without touching other appearance fields.
-->
<script setup lang="ts">
import { PET_STUDIO_PART_OPTIONS, type RichEarStyle } from '~/domain/pet-studio-phase2'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const value = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const number = (event: Event) => Number(value(event))
function changeEarStyle(event: Event) { store.patchParts({ ears: value(event) as RichEarStyle }) }
</script>

<template>
  <section class="editor-card">
    <h3>耳朵多色方案</h3>
    <p>外耳、内耳和耳尖独立着色；修改耳朵不会改变眼睛、身体或尾巴。</p>
    <label>
      耳朵形状
      <select :value="recipe.parts.ears" @focus="store.checkpoint" @change="changeEarStyle">
        <option v-for="item in PET_STUDIO_PART_OPTIONS.ears" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <div class="color-grid">
      <label>外耳颜色<input :value="recipe.earDesign.outerColor" type="color" @focus="store.checkpoint" @input="store.patchEarDesign({ outerColor: value($event) })"></label>
      <label>内耳颜色<input :value="recipe.earDesign.innerColor" type="color" @focus="store.checkpoint" @input="store.patchEarDesign({ innerColor: value($event) })"></label>
      <label>耳尖颜色<input :value="recipe.earDesign.tipColor" type="color" @focus="store.checkpoint" @input="store.patchEarDesign({ tipColor: value($event) })"></label>
      <label>内耳光色<input :value="recipe.earDesign.innerGlowColor" type="color" @focus="store.checkpoint" @input="store.patchEarDesign({ innerGlowColor: value($event) })"></label>
    </div>
    <label class="check"><input :checked="recipe.earDesign.innerGlowEnabled" type="checkbox" @focus="store.checkpoint" @change="store.patchEarDesign({ innerGlowEnabled: checked($event) })">启用内耳发光</label>
    <label>
      内耳发光强度 {{ recipe.earDesign.innerGlowIntensity.toFixed(2) }}
      <input :value="recipe.earDesign.innerGlowIntensity" type="range" min="0" max="4" step=".05" @pointerdown="store.checkpoint" @input="store.patchEarDesign({ innerGlowIntensity: number($event) })">
    </label>
  </section>
</template>

<style scoped>
.editor-card{display:flex;flex-direction:column;gap:10px;padding:11px;border:1px solid #ffffff18;border-radius:11px;background:#ffffff08}.editor-card h3,.editor-card p{margin:0}.editor-card p{color:#9da6c8;font-size:12px}.editor-card label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.editor-card select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.editor-card input[type=color]{width:100%;height:36px;border:0;background:transparent}.editor-card input[type=range]{width:100%;accent-color:#7066ff}.color-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.check{flex-direction:row!important;align-items:center}
</style>
