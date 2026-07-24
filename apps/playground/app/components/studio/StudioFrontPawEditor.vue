<!--
  文件职责 / File responsibility
  独立编辑四肢比例、前爪样式、经典挂点、镜像与左右微调，并提供一键恢复扩展最初前爪位置。
  Independently edits limb proportions, paw style, production anchors, mirroring, and per-side offsets with one-click restoration of the original extension pose.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import { normalizeCustomizableAppearance } from '~/domain/pet-part-customization'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { FRONT_PAW_STYLES } from '~/domain/pet-species-registry'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const classic = normalizeCustomizableAppearance(createExtensionClassicAppearance())
const proportionControls: Array<[StudioControlPath, keyof typeof recipe.value.proportions]> = [
  ['proportions.limbLength', 'limbLength'],
  ['proportions.limbThickness', 'limbThickness'],
  ['proportions.limbSpacing', 'limbSpacing'],
  ['proportions.pawScale', 'pawScale'],
]
const commonControls: Array<[StudioControlPath, keyof typeof recipe.value.frontPawDesign]> = [
  ['frontPawDesign.embedDepth', 'embedDepth'],
  ['frontPawDesign.rootHeight', 'rootHeight'],
  ['frontPawDesign.forwardOffset', 'forwardOffset'],
  ['frontPawDesign.lateralOffset', 'lateralOffset'],
  ['frontPawDesign.outwardAngle', 'outwardAngle'],
  ['frontPawDesign.forwardAngle', 'forwardAngle'],
  ['frontPawDesign.shoulderScale', 'shoulderScale'],
  ['frontPawDesign.wristScale', 'wristScale'],
  ['frontPawDesign.palmScale', 'palmScale'],
]
const leftControls: Array<[StudioControlPath, keyof typeof recipe.value.frontPawDesign]> = [
  ['frontPawDesign.leftOffsetX', 'leftOffsetX'], ['frontPawDesign.leftOffsetY', 'leftOffsetY'], ['frontPawDesign.leftOffsetZ', 'leftOffsetZ'],
]
const rightControls: Array<[StudioControlPath, keyof typeof recipe.value.frontPawDesign]> = [
  ['frontPawDesign.rightOffsetX', 'rightOffsetX'], ['frontPawDesign.rightOffsetY', 'rightOffsetY'], ['frontPawDesign.rightOffsetZ', 'rightOffsetZ'],
]
function setProportion(key: keyof typeof recipe.value.proportions, value: number) {
  recipe.value.proportions[key] = value
}
function setPaw(key: keyof typeof recipe.value.frontPawDesign, value: number) {
  if (typeof recipe.value.frontPawDesign[key] !== 'number') return
  ;(recipe.value.frontPawDesign[key] as number) = value
}
function setStyle(event: Event) {
  store.checkpoint()
  recipe.value.frontPawDesign.style = (event.target as HTMLSelectElement).value as typeof recipe.value.frontPawDesign.style
  store.markDirty()
}
function restoreClassicPaws() {
  store.checkpoint()
  Object.assign(recipe.value.frontPawDesign, classic.frontPawDesign)
  store.markDirty()
}
</script>

<template>
  <section class="editor">
    <header class="section-heading"><small>LIMBS & PAWS</small><h2>四肢与前爪</h2><p>恢复最初挂点后，可在推荐范围内微调；关闭镜像后可分别调整左右前爪。</p></header>
    <section class="card accent">
      <div class="card-heading"><div><h3>前爪连接</h3><small>经典挂点来自 Chrome 扩展正式模型。</small></div><button type="button" @click="restoreClassicPaws">恢复扩展最初位置</button></div>
      <label>前爪样式<select :value="recipe.frontPawDesign.style" @change="setStyle"><option v-for="item in FRONT_PAW_STYLES" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <label class="check"><input v-model="recipe.frontPawDesign.mirror" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">左右镜像</label>
    </section>
    <section class="card"><h3>整体四肢比例</h3><StudioNumericControl v-for="[path,key] in proportionControls" :key="path" :path="path" :model-value="recipe.proportions[key]" @update:model-value="setProportion(key,$event)" /></section>
    <section class="card"><h3>共同前爪参数</h3><StudioNumericControl v-for="[path,key] in commonControls" :key="path" :path="path" :model-value="recipe.frontPawDesign[key] as number" @update:model-value="setPaw(key,$event)" /></section>
    <section v-if="!recipe.frontPawDesign.mirror" class="side-grid">
      <section class="card"><h3>左前爪独立微调</h3><StudioNumericControl v-for="[path,key] in leftControls" :key="path" :path="path" :model-value="recipe.frontPawDesign[key] as number" @update:model-value="setPaw(key,$event)" /></section>
      <section class="card"><h3>右前爪独立微调</h3><StudioNumericControl v-for="[path,key] in rightControls" :key="path" :path="path" :model-value="recipe.frontPawDesign[key] as number" @update:model-value="setPaw(key,$event)" /></section>
    </section>
  </section>
</template>

<style scoped>
.editor{display:grid;gap:11px}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:5px 0 3px;font-size:17px}.section-heading p,.card small{margin:0;color:#8d96b6;font-size:10px;line-height:1.5}.card{display:grid;gap:9px;padding:11px;border:1px solid #ffffff16;border-radius:13px;background:#ffffff05}.card.accent{border-color:#7066ff55;background:linear-gradient(145deg,#7066ff16,#52e0d008)}.card h3{margin:0;font-size:12px}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.card-heading h3{margin-bottom:3px}.card-heading button{min-height:30px;padding:0 8px;border:1px solid #52e0d044;border-radius:8px;color:#dcfffa;background:#52e0d00d;font-size:9px}.card label{display:grid;gap:5px;color:#bbc3dc;font-size:11px}.card select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 8px;color:#fff;background:#090e1b}.check{display:flex!important;align-items:center!important;grid-template-columns:auto 1fr!important}.side-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}@media(max-width:1250px){.side-grid{grid-template-columns:1fr}}
</style>
