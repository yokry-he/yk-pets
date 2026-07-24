<!--
  文件职责 / File responsibility
  独立编辑后爪样式、经典挂点、腿部结构、脚掌姿态、镜像与左右微调，并提供一键恢复默认后爪。
  Independently edits hind-paw style, classic anchors, leg structure, foot pose, mirroring, and per-side tuning with one-click reset.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import {
  HIND_PAW_STYLES,
  createDefaultHindPawDesign,
  type HindPawDesignRecipe,
} from '~/domain/pet-part-customization'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
type HindNumberKey = Exclude<keyof HindPawDesignRecipe, 'style' | 'mirror'>
const anchorControls: Array<[StudioControlPath, HindNumberKey]> = [
  ['hindPawDesign.embedDepth', 'embedDepth'],
  ['hindPawDesign.rootHeight', 'rootHeight'],
  ['hindPawDesign.forwardOffset', 'forwardOffset'],
  ['hindPawDesign.lateralOffset', 'lateralOffset'],
  ['hindPawDesign.outwardAngle', 'outwardAngle'],
  ['hindPawDesign.forwardAngle', 'forwardAngle'],
]
const structureControls: Array<[StudioControlPath, HindNumberKey]> = [
  ['hindPawDesign.legLengthScale', 'legLengthScale'],
  ['hindPawDesign.legThicknessScale', 'legThicknessScale'],
  ['hindPawDesign.haunchScale', 'haunchScale'],
  ['hindPawDesign.ankleScale', 'ankleScale'],
]
const footControls: Array<[StudioControlPath, HindNumberKey]> = [
  ['hindPawDesign.pawScaleX', 'pawScaleX'],
  ['hindPawDesign.pawScaleY', 'pawScaleY'],
  ['hindPawDesign.pawScaleZ', 'pawScaleZ'],
  ['hindPawDesign.toeLift', 'toeLift'],
  ['hindPawDesign.toeOutwardAngle', 'toeOutwardAngle'],
  ['hindPawDesign.heelDrop', 'heelDrop'],
]
const leftControls: Array<[StudioControlPath, HindNumberKey]> = [
  ['hindPawDesign.leftOffsetX', 'leftOffsetX'],
  ['hindPawDesign.leftOffsetY', 'leftOffsetY'],
  ['hindPawDesign.leftOffsetZ', 'leftOffsetZ'],
]
const rightControls: Array<[StudioControlPath, HindNumberKey]> = [
  ['hindPawDesign.rightOffsetX', 'rightOffsetX'],
  ['hindPawDesign.rightOffsetY', 'rightOffsetY'],
  ['hindPawDesign.rightOffsetZ', 'rightOffsetZ'],
]
function setStyle(event: Event) {
  store.checkpoint()
  recipe.value.hindPawDesign.style = (event.target as HTMLSelectElement).value as HindPawDesignRecipe['style']
  store.markDirty()
}
function setNumber(key: HindNumberKey, value: number) {
  recipe.value.hindPawDesign[key] = value
}
function restoreHindPaws() {
  store.checkpoint()
  Object.assign(recipe.value.hindPawDesign, createDefaultHindPawDesign())
  store.markDirty()
}
</script>

<template>
  <section class="editor">
    <header class="section-heading"><small>HIND LEGS & PAWS</small><h2>后腿与后爪</h2><p>后爪使用独立配方；臀部、脚踝、脚掌和脚尖姿态不会改动前爪。</p></header>
    <section class="card accent">
      <div class="card-heading"><div><h3>后爪连接</h3><small>默认值保持当前经典后爪挂点和动作。</small></div><button type="button" @click="restoreHindPaws">恢复经典后爪</button></div>
      <label>后爪样式<select :value="recipe.hindPawDesign.style" @change="setStyle"><option v-for="item in HIND_PAW_STYLES" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <label class="check"><input v-model="recipe.hindPawDesign.mirror" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">左右镜像</label>
    </section>
    <section class="card"><h3>根部与站姿</h3><StudioNumericControl v-for="[path,key] in anchorControls" :key="path" :path="path" :model-value="recipe.hindPawDesign[key]" @update:model-value="setNumber(key,$event)" /></section>
    <section class="card"><h3>后腿结构</h3><StudioNumericControl v-for="[path,key] in structureControls" :key="path" :path="path" :model-value="recipe.hindPawDesign[key]" @update:model-value="setNumber(key,$event)" /></section>
    <section class="card"><h3>脚掌与脚尖</h3><StudioNumericControl v-for="[path,key] in footControls" :key="path" :path="path" :model-value="recipe.hindPawDesign[key]" @update:model-value="setNumber(key,$event)" /></section>
    <section v-if="!recipe.hindPawDesign.mirror" class="side-grid">
      <section class="card"><h3>左后爪独立微调</h3><StudioNumericControl v-for="[path,key] in leftControls" :key="path" :path="path" :model-value="recipe.hindPawDesign[key]" @update:model-value="setNumber(key,$event)" /></section>
      <section class="card"><h3>右后爪独立微调</h3><StudioNumericControl v-for="[path,key] in rightControls" :key="path" :path="path" :model-value="recipe.hindPawDesign[key]" @update:model-value="setNumber(key,$event)" /></section>
    </section>
  </section>
</template>

<style scoped>
.editor{display:grid;gap:11px;padding-top:4px;border-top:1px solid #ffffff12}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:5px 0 3px;font-size:17px}.section-heading p,.card small{margin:0;color:#8d96b6;font-size:10px;line-height:1.5}.card{display:grid;gap:9px;padding:11px;border:1px solid #ffffff16;border-radius:13px;background:#ffffff05}.card.accent{border-color:#52e0d055;background:linear-gradient(145deg,#52e0d012,#7066ff0b)}.card h3{margin:0;font-size:12px}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.card-heading h3{margin-bottom:3px}.card-heading button{min-height:30px;padding:0 8px;border:1px solid #52e0d044;border-radius:8px;color:#dcfffa;background:#52e0d00d;font-size:9px}.card label{display:grid;gap:5px;color:#bbc3dc;font-size:11px}.card select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 8px;color:#fff;background:#090e1b}.check{display:flex!important;align-items:center!important;grid-template-columns:auto 1fr!important}.side-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}@media(max-width:1250px){.side-grid{grid-template-columns:1fr}}
</style>
