<!--
  文件职责 / File responsibility
  以图形卡片、显式形状名称和精确数值控件编辑肚皮显示、轮廓、位置、旋转、柔和度与颜色。
  Edits belly visibility, silhouette, placement, rotation, softness, and color with visual cards, explicit names, and precise numeric controls.
-->
<script setup lang="ts">
import {
  PET_BELLY_SHAPES,
  PET_CUSTOMIZATION_RANGES,
  createDefaultPetCustomization,
} from '~/domain/pet-part-customization'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const design = computed(() => store.recipe.customization.belly)
const colors = computed(() => store.recipe.customization.colors)
const ranges = PET_CUSTOMIZATION_RANGES.belly

function chooseShape(shape: typeof PET_BELLY_SHAPES[number]['id']) {
  store.checkpoint()
  design.value.shape = shape
  design.value.visible = true
  store.markDirty()
}

function resetBelly() {
  store.checkpoint()
  const defaults = createDefaultPetCustomization(store.recipe)
  Object.assign(design.value, defaults.belly)
  colors.value.belly = defaults.colors.belly
  store.markDirty()
}
</script>

<template>
  <section class="belly-card">
    <header>
      <div><small>BELLY PATCH</small><h3>肚皮形状</h3></div>
      <button type="button" @click="resetBelly">恢复椭圆默认</button>
    </header>
    <label class="switch">
      <input v-model="design.visible" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">
      <span><strong>显示肚皮</strong><small>关闭只隐藏肚皮，不删除形状和颜色参数。</small></span>
    </label>
    <div class="shape-grid" :data-disabled="!design.visible">
      <button
        v-for="shape in PET_BELLY_SHAPES"
        :key="shape.id"
        type="button"
        :class="{ active: design.shape === shape.id }"
        :aria-pressed="design.shape === shape.id"
        :title="shape.description"
        :disabled="!design.visible"
        @click="chooseShape(shape.id)"
      >
        <span class="shape-preview" :data-shape="shape.id" aria-hidden="true" />
        <strong>{{ shape.label }}</strong>
        <small>{{ shape.description }}</small>
      </button>
    </div>
    <fieldset :disabled="!design.visible">
      <label class="color-row">
        <span><strong>肚皮颜色</strong><small>{{ colors.belly }}</small></span>
        <input v-model="colors.belly" type="color" @focus="store.checkpoint" @input="store.markDirty">
      </label>
      <label v-for="field in [
        ['width', '宽度', ranges.width, 1],
        ['height', '高度', ranges.height, 1],
        ['offsetX', '左右位置', ranges.offsetX, 0],
        ['offsetY', '上下位置', ranges.offsetY, 0],
        ['rotation', '旋转', ranges.rotation, 0],
        ['softness', '边缘柔和度', ranges.softness, .72],
      ] as const" :key="field[0]" class="range-field">
        <span><strong>{{ field[1] }}</strong><button type="button" @click="design[field[0]] = field[3]; store.markDirty()">重置</button></span>
        <div>
          <input
            v-model.number="design[field[0]]"
            type="range"
            :min="field[2][0]"
            :max="field[2][1]"
            :step="field[0] === 'rotation' ? .02 : .01"
            @pointerdown="store.beginTransaction"
            @pointerup="store.endTransaction"
            @input="store.markDirty"
          >
          <input
            v-model.number="design[field[0]]"
            type="number"
            :min="field[2][0]"
            :max="field[2][1]"
            :step="field[0] === 'rotation' ? .02 : .01"
            @focus="store.checkpoint"
            @change="store.markDirty"
          >
        </div>
      </label>
    </fieldset>
  </section>
</template>

<style scoped>
.belly-card{display:grid;gap:12px;padding:14px;border:1px solid #ffffff18;border-radius:16px;background:linear-gradient(145deg,#12172a,#0d1222)}header{display:flex;align-items:start;justify-content:space-between;gap:12px}header small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}h3{margin:5px 0 0;font-size:15px}button{border:1px solid #ffffff1f;border-radius:9px;color:#dfe5ff;background:#ffffff08;cursor:pointer}header button{min-height:32px;padding:0 9px;font-size:11px}.switch{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid #ffffff14;border-radius:11px;background:#080d1a99}.switch input{width:18px;height:18px;accent-color:#52e0d0}.switch span{display:grid;gap:3px}.switch small,.shape-grid small,.color-row small{color:#8d96b7;font-size:10px;line-height:1.4}.shape-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;transition:opacity .15s ease}.shape-grid[data-disabled=true]{opacity:.42}.shape-grid button{display:grid;grid-template-columns:42px minmax(0,1fr);grid-template-rows:auto auto;gap:2px 9px;min-height:62px;padding:8px;text-align:left}.shape-grid button.active{border-color:#52e0d0;background:#52e0d014;box-shadow:0 0 0 1px #52e0d033 inset}.shape-preview{grid-row:1/3;width:34px;height:42px;align-self:center;background:#f1f4ff;box-shadow:0 0 16px #8f83ff55}.shape-preview[data-shape=ellipse]{border-radius:50%}.shape-preview[data-shape=egg]{border-radius:46% 46% 52% 52%/38% 38% 62% 62%}.shape-preview[data-shape=shield]{clip-path:polygon(10% 5%,90% 5%,92% 52%,50% 100%,8% 52%);border-radius:8px}.shape-preview[data-shape=teardrop]{clip-path:polygon(50% 0,88% 45%,78% 78%,50% 100%,22% 78%,12% 45%);border-radius:50%}.shape-preview[data-shape=inverted-teardrop]{clip-path:polygon(50% 100%,88% 55%,78% 22%,50% 0,22% 22%,12% 55%);border-radius:50%}.shape-preview[data-shape=bean]{border-radius:58% 42% 52% 48%/38% 54% 46% 62%;transform:rotate(-12deg)}.shape-preview[data-shape=rounded-rectangle]{border-radius:11px}.shape-preview[data-shape=heart]{clip-path:polygon(50% 100%,8% 55%,5% 28%,22% 8%,50% 24%,78% 8%,95% 28%,92% 55%)}.shape-preview[data-shape=cloud]{border-radius:48% 52% 42% 58%/55% 46% 54% 45%;box-shadow:-8px 5px 0 -2px #f1f4ff,8px 6px 0 -2px #f1f4ff}.shape-preview[data-shape=chest-fur]{clip-path:polygon(7% 0,93% 0,86% 58%,68% 100%,50% 73%,32% 100%,14% 58%)}fieldset{display:grid;gap:10px;margin:0;padding:0;border:0}fieldset:disabled{opacity:.42}.color-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.color-row span{display:grid}.color-row input{width:46px;height:34px;border:0;border-radius:8px;background:transparent}.range-field{display:grid;gap:5px}.range-field>span{display:flex;align-items:center;justify-content:space-between;color:#bdc5df;font-size:12px}.range-field>span button{padding:3px 6px;font-size:9px}.range-field>div{display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:8px}.range-field input[type=range]{width:100%;accent-color:#7066ff}.range-field input[type=number]{min-width:0;border:1px solid #ffffff1f;border-radius:8px;padding:6px;color:#fff;background:#090e1b;font-variant-numeric:tabular-nums}button:focus-visible,input:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}@media(prefers-reduced-motion:reduce){.shape-grid{transition:none}}
</style>
