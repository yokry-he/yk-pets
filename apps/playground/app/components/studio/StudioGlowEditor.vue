<!--
  文件职责 / File responsibility
  完整编辑发光模式、尾巴与触角开关、强度、脉冲速度以及轨道数量、形态、粒子和双色。
  Fully edits glow mode, tail/antenna toggles, intensity, pulse speed, and orbit count, shape, particles, and two colors.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const glowControls: Array<[StudioControlPath, 'intensity' | 'pulseSpeed']> = [['glow.intensity','intensity'], ['glow.pulseSpeed','pulseSpeed']]
const orbitControls: Array<[StudioControlPath, 'radius' | 'verticalScale' | 'tilt' | 'speed' | 'intensity' | 'particleCount']> = [
  ['orbitDesign.radius','radius'], ['orbitDesign.verticalScale','verticalScale'], ['orbitDesign.tilt','tilt'], ['orbitDesign.speed','speed'], ['orbitDesign.intensity','intensity'], ['orbitDesign.particleCount','particleCount'],
]
function updateGlow(key: 'intensity' | 'pulseSpeed', value: number) { recipe.value.glow[key] = value }
function updateOrbit(key: 'radius' | 'verticalScale' | 'tilt' | 'speed' | 'intensity' | 'particleCount', value: number) { recipe.value.orbitDesign[key] = key === 'particleCount' ? Math.round(value) : value }
function deriveColors() {
  store.checkpoint()
  recipe.value.orbitDesign.primaryColor = recipe.value.palette.primaryGlow
  recipe.value.orbitDesign.secondaryColor = recipe.value.palette.secondaryGlow
  store.markDirty()
}
</script>

<template>
  <section class="editor">
    <header><small>GLOW & ORBIT</small><h2>发光与轨道</h2><p>基础发光、尾尖、触角和身体轨道保持独立开关。</p></header>
    <section class="card"><h3>基础发光</h3><label>发光模式<select v-model="recipe.glow.mode" @focus="store.checkpoint" @change="store.markDirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label><div class="checks"><label><input v-model="recipe.glow.tailEnabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">尾巴发光</label><label><input v-model="recipe.glow.antennaEnabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">触角发光</label></div><StudioNumericControl v-for="[path,key] in glowControls" :key="path" :path="path" :model-value="recipe.glow[key]" @update:model-value="updateGlow(key,$event)" /></section>
    <section class="card"><div class="card-heading"><h3>身体周围轨道</h3><button type="button" @click="deriveColors">使用主发光色</button></div><label class="check"><input v-model="recipe.orbitDesign.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">显示轨道</label><label>轨道数量<select v-model.number="recipe.orbitDesign.ringCount" @focus="store.checkpoint" @change="store.markDirty"><option :value="1">1 条</option><option :value="2">2 条</option><option :value="3">3 条</option></select></label><StudioNumericControl v-for="[path,key] in orbitControls" :key="path" :path="path" :model-value="recipe.orbitDesign[key]" :disabled="!recipe.orbitDesign.enabled" @update:model-value="updateOrbit(key,$event)" /><div class="color-grid"><label>主轨道颜色<input v-model="recipe.orbitDesign.primaryColor" type="color" @focus="store.checkpoint" @input="store.markDirty"></label><label>副轨道颜色<input v-model="recipe.orbitDesign.secondaryColor" type="color" @focus="store.checkpoint" @input="store.markDirty"></label></div></section>
  </section>
</template>

<style scoped>
.editor,.card{display:grid;gap:9px}.editor>header small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.editor>header h2{margin:5px 0 3px;font-size:17px}.editor>header p{margin:0;color:#8d96b6;font-size:10px}.card{padding:11px;border:1px solid #ffffff15;border-radius:13px;background:#ffffff05}.card h3{margin:0;font-size:12px}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.card-heading button{min-height:29px;border:1px solid #52e0d044;border-radius:8px;color:#dcfffa;background:#52e0d00d;font-size:9px}.card label{display:grid;gap:5px;color:#bbc3dc;font-size:11px}.card select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 8px;color:#fff;background:#090e1b}.checks,.color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.checks label,.check{display:flex!important;align-items:center!important;gap:7px}.color-grid input{width:100%;height:34px;border:0;background:transparent}
</style>
