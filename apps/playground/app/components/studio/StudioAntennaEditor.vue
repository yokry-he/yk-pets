<!--
  文件职责 / File responsibility
  独立配置触角开关、杆体、末端、整体比例、间距、长度、粗细、倾斜、颜色与发光。
  Independently configures antenna visibility, rod, tip, overall scale, spacing, length, thickness, tilt, colors, and glow.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import { PET_STUDIO_PART_OPTIONS } from '~/domain/pet-studio-phase2'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const controls: Array<[StudioControlPath, 'scale' | keyof typeof recipe.value.antennaDesign]> = [
  ['proportions.antennaScale','scale'], ['antennaDesign.spacing','spacing'], ['antennaDesign.length','length'], ['antennaDesign.thickness','thickness'], ['antennaDesign.tilt','tilt'],
]
function setPart(key: 'antenna' | 'antennaRod' | 'antennaTip', event: Event) {
  store.checkpoint()
  store.patchParts({ [key]: (event.target as HTMLSelectElement).value } as Partial<typeof recipe.value.parts>)
}
function value(key: 'scale' | keyof typeof recipe.value.antennaDesign) {
  return key === 'scale' ? recipe.value.proportions.antennaScale : recipe.value.antennaDesign[key]
}
function update(key: 'scale' | keyof typeof recipe.value.antennaDesign, next: number) {
  if (key === 'scale') recipe.value.proportions.antennaScale = next
  else recipe.value.antennaDesign[key] = next
}
</script>

<template>
  <section class="editor">
    <header><small>ANTENNA</small><h2>触角</h2><p>样式、尺寸、间距、倾斜与颜色均独立配置。</p></header>
    <section class="card"><h3>组合结构</h3><label>触角开关<select :value="recipe.parts.antenna" @change="setPart('antenna',$event)"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennas" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>杆体<select :value="recipe.parts.antennaRod" @change="setPart('antennaRod',$event)"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennaRods" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>末端<select :value="recipe.parts.antennaTip" @change="setPart('antennaTip',$event)"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennaTips" :key="item.id" :value="item.id">{{ item.label }}</option></select></label></section>
    <section class="card" :data-disabled="recipe.parts.antenna === 'none'"><h3>尺寸与位置</h3><StudioNumericControl v-for="[path,key] in controls" :key="path" :path="path" :model-value="value(key)" :disabled="recipe.parts.antenna === 'none'" @update:model-value="update(key,$event)" /></section>
    <section class="card"><h3>颜色与发光</h3><div class="color-grid"><label>杆体颜色<input v-model="recipe.customization.colors.antennaRod" type="color" @focus="store.checkpoint" @input="store.markDirty"></label><label>末端颜色<input v-model="recipe.customization.colors.antennaTip" type="color" @focus="store.checkpoint" @input="store.markDirty"></label></div><label class="check"><input v-model="recipe.glow.antennaEnabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">启用触角发光</label></section>
  </section>
</template>

<style scoped>
.editor,.card{display:grid;gap:9px}.editor>header small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.editor>header h2{margin:5px 0 3px;font-size:17px}.editor>header p{margin:0;color:#8d96b6;font-size:10px}.card{padding:11px;border:1px solid #ffffff15;border-radius:13px;background:#ffffff05}.card[data-disabled=true]{opacity:.48}.card h3{margin:0;font-size:12px}.card label{display:grid;gap:5px;color:#bbc3dc;font-size:11px}.card select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 8px;color:#fff;background:#090e1b}.color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.color-grid input{width:100%;height:34px;border:0;background:transparent}.check{display:flex!important;align-items:center!important;gap:7px}
</style>
