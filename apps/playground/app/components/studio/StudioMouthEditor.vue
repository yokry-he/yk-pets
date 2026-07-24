<!--
  文件职责 / File responsibility
  配置鼻子与五种嘴型的独立颜色、共享表面位置、三轴尺寸、旋转以及样式专属开合、曲率、线宽和舌头参数。
  Configures independent nose and five-mouth colors, surface placement, three-axis size, rotation, and style-specific opening, curvature, thickness, and tongue controls.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import { PET_STUDIO_PART_OPTIONS } from '~/domain/pet-studio-phase2'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const nose = computed(() => recipe.value.customization.nose)
const mouth = computed(() => recipe.value.customization.mouth)
type NoseNumberKey = keyof typeof nose.value
type MouthNumberKey = Exclude<keyof typeof mouth.value, 'tongueVisible'>
const noseControls: Array<[StudioControlPath, NoseNumberKey]> = [
  ['customization.nose.offsetX', 'offsetX'], ['customization.nose.offsetY', 'offsetY'], ['customization.nose.surfaceOffset', 'surfaceOffset'],
  ['customization.nose.scaleX', 'scaleX'], ['customization.nose.scaleY', 'scaleY'], ['customization.nose.scaleZ', 'scaleZ'], ['customization.nose.rotation', 'rotation'],
]
const common: Array<[StudioControlPath, MouthNumberKey]> = [
  ['customization.mouth.offsetX','offsetX'], ['customization.mouth.offsetY','offsetY'], ['customization.mouth.surfaceOffset','surfaceOffset'],
  ['customization.mouth.width','width'], ['customization.mouth.height','height'], ['customization.mouth.rotation','rotation'],
]
const curves: Array<[StudioControlPath, MouthNumberKey]> = [['customization.mouth.curve','curve'], ['customization.mouth.thickness','thickness']]
const opening: Array<[StudioControlPath, MouthNumberKey]> = [['customization.mouth.defaultOpen','defaultOpen'], ['customization.mouth.maxOpen','maxOpen']]
const tongue: Array<[StudioControlPath, MouthNumberKey]> = [['customization.mouth.tongueScale','tongueScale'], ['customization.mouth.tongueOffsetY','tongueOffsetY']]
function setPart(id: string) { store.checkpoint(); store.patchParts({ mouth: id as typeof recipe.value.parts.mouth }) }
function setNoseNumber(key: NoseNumberKey, value: number) { nose.value[key] = value }
function setMouthNumber(key: MouthNumberKey, value: number) { mouth.value[key] = value }
function icon(id: string) { return id === 'open' ? 'O' : id === 'pout' ? '○' : id === 'cat' ? 'ω' : id === 'line' ? '—' : 'ᴗ' }
</script>

<template>
  <section class="editor">
    <section class="card">
      <h3>鼻子精细参数</h3>
      <label>鼻子颜色<input v-model="recipe.customization.colors.nose" type="color" @focus="store.checkpoint" @input="store.markDirty"></label>
      <StudioNumericControl v-for="[path,key] in noseControls" :key="path" :path="path" :model-value="nose[key]" @update:model-value="setNoseNumber(key,$event)" />
    </section>
    <section class="card"><h3>嘴巴样式</h3><div class="options"><button v-for="item in PET_STUDIO_PART_OPTIONS.mouths" :key="item.id" type="button" :class="{ active: recipe.parts.mouth === item.id }" @click="setPart(item.id)"><i>{{ icon(item.id) }}</i><span><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></span></button></div></section>
    <section class="card"><h3>口鼻部颜色</h3><div class="colors"><label>口鼻部<input v-model="recipe.customization.colors.muzzle" type="color" @focus="store.checkpoint" @input="store.markDirty"></label><label>嘴巴<input v-model="recipe.customization.colors.mouth" type="color" @focus="store.checkpoint" @input="store.markDirty"></label><label>舌头<input v-model="recipe.customization.colors.tongue" type="color" @focus="store.checkpoint" @input="store.markDirty"></label><label>脸颊<input v-model="recipe.customization.colors.cheeks" type="color" @focus="store.checkpoint" @input="store.markDirty"></label></div></section>
    <section class="card"><h3>嘴巴位置与尺寸</h3><StudioNumericControl v-for="[path,key] in common" :key="path" :path="path" :model-value="mouth[key]" @update:model-value="setMouthNumber(key,$event)" /></section>
    <section v-if="['cat','line','pout'].includes(recipe.parts.mouth)" class="card"><h3>线条与曲率</h3><StudioNumericControl v-for="[path,key] in curves" :key="path" :path="path" :model-value="mouth[key]" @update:model-value="setMouthNumber(key,$event)" /></section>
    <section v-if="recipe.parts.mouth === 'open'" class="card"><h3>张嘴范围</h3><StudioNumericControl v-for="[path,key] in opening" :key="path" :path="path" :model-value="mouth[key]" @update:model-value="setMouthNumber(key,$event)" /></section>
    <section v-if="['smile','open'].includes(recipe.parts.mouth)" class="card"><h3>舌头</h3><label class="check"><input v-model="mouth.tongueVisible" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">显示舌头</label><StudioNumericControl v-for="[path,key] in tongue" :key="path" :path="path" :model-value="mouth[key]" :disabled="!mouth.tongueVisible" @update:model-value="setMouthNumber(key,$event)" /></section>
  </section>
</template>

<style scoped>
.editor,.card{display:grid;gap:9px}.card{padding:11px;border:1px solid #ffffff15;border-radius:13px;background:#ffffff05}.card h3{margin:0;font-size:12px}.card label{display:grid;gap:4px;color:#aeb7d3;font-size:10px}.card input[type=color]{width:100%;height:34px;border:0;background:transparent}.options,.colors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.options button{display:flex;align-items:center;gap:7px;min-height:48px;padding:7px;border:1px solid #ffffff15;border-radius:9px;color:#c9d0e8;text-align:left;background:#080d18}.options button.active{border-color:#52e0d077;background:#52e0d014}.options i{display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:#7066ff24;font-style:normal}.options span{display:grid}.options strong{font-size:10px}.options small{color:#717a9d;font-size:8px}.check{display:flex!important;align-items:center!important;gap:7px}
</style>
