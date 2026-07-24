<!--
  文件职责 / File responsibility
  独立编辑尾巴样式、整体长度粗细、背部根段、逐段变换和尾尖发光，不再混入前爪或触角配置。
  Independently edits tail style, overall length/width, back root, per-segment transforms, and tip glow without mixing paw or antenna controls.
-->
<script setup lang="ts">
import StudioNumericControl from './StudioNumericControl.vue'
import { MAX_TAIL_SEGMENTS, MIN_TAIL_SEGMENTS, PET_STUDIO_PART_OPTIONS, type TailDesignRecipe, type TailSegmentRecipe } from '~/domain/pet-studio-phase2'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const rootControls: Array<[keyof Omit<TailDesignRecipe,'segments'|'tipGlow'|'direction'>, string, number, number, number]> = [
  ['rootOffsetX','根部左右位置',-1.4,1.4,.01], ['rootOffsetY','根部上下位置',-1.4,1.4,.01], ['rootOffsetZ','根部前后位置',-1.4,1.4,.01],
  ['rootExtensionLength','背面伸出长度',.05,1.8,.01], ['rootExtensionWidth','背面根段宽度',.04,.8,.01], ['lateralOffset','整体侧向偏移',-2,2,.01],
]
const segmentControls: Array<[keyof TailSegmentRecipe, string, number, number, number]> = [
  ['length','长度',.08,1.6,.01], ['width','宽度',.04,.8,.01], ['offsetX','左右偏移',-1.2,1.2,.01], ['offsetY','上下偏移',-1.2,1.2,.01], ['offsetZ','前后偏移',-1.2,1.2,.01],
  ['rotationX','旋转 X',-Math.PI,Math.PI,.02], ['rotationY','旋转 Y',-Math.PI,Math.PI,.02], ['rotationZ','旋转 Z',-Math.PI,Math.PI,.02],
]
function setPart(event: Event) { store.checkpoint(); store.patchParts({ tail: (event.target as HTMLSelectElement).value as typeof recipe.value.parts.tail }) }
function setRoot(key: keyof Omit<TailDesignRecipe,'segments'|'tipGlow'|'direction'>, value: number) { recipe.value.tailDesign[key] = value; store.markDirty() }
function setSegment(index: number, key: keyof TailSegmentRecipe, value: number) { recipe.value.tailDesign.segments[index]![key] = value; store.markDirty() }
function addSegment() {
  if (recipe.value.tailDesign.segments.length >= MAX_TAIL_SEGMENTS) return
  store.checkpoint(); recipe.value.tailDesign.segments.push({ length:.4,width:.15,offsetX:0,offsetY:0,offsetZ:0,rotationX:0,rotationY:0,rotationZ:0 }); store.markDirty()
}
function removeSegment(index: number) {
  if (recipe.value.tailDesign.segments.length <= MIN_TAIL_SEGMENTS) return
  store.checkpoint(); recipe.value.tailDesign.segments.splice(index,1); store.markDirty()
}
</script>

<template>
  <section class="editor">
    <header><small>TAIL</small><h2>尾巴</h2><p>整体比例、根部、每一段和尾尖发光均可独立调整。</p></header>
    <section class="card"><h3>整体尾巴</h3><label>基础样式<select :value="recipe.parts.tail" @change="setPart"><option v-for="item in PET_STUDIO_PART_OPTIONS.tails" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><StudioNumericControl path="proportions.tailLength" :model-value="recipe.proportions.tailLength" @update:model-value="recipe.proportions.tailLength=$event" /><StudioNumericControl path="proportions.tailWidth" :model-value="recipe.proportions.tailWidth" @update:model-value="recipe.proportions.tailWidth=$event" /></section>
    <section class="card"><h3>背部根段</h3><label>尾巴朝向<select v-model="recipe.tailDesign.direction" @focus="store.checkpoint" @change="store.markDirty"><option value="left">向左</option><option value="right">向右</option><option value="up">向上</option><option value="down">向下</option><option value="back">向后</option><option value="forward">向前</option></select></label><label v-for="[key,label,min,max,step] in rootControls" :key="key" class="range"><span><strong>{{ label }}</strong><small>{{ recipe.tailDesign[key].toFixed(2) }}</small></span><div><input :value="recipe.tailDesign[key]" type="range" :min="min" :max="max" :step="step" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="setRoot(key,Number(($event.target as HTMLInputElement).value))"><input :value="recipe.tailDesign[key]" type="number" :min="min" :max="max" :step="step" @focus="store.checkpoint" @change="setRoot(key,Number(($event.target as HTMLInputElement).value))"></div></label></section>
    <section class="card"><h3>尾巴尖发光</h3><label class="check"><input v-model="recipe.tailDesign.tipGlow.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">启用</label><label>颜色<input v-model="recipe.customization.colors.tailGlow" type="color" @focus="store.checkpoint" @input="recipe.tailDesign.tipGlow.color=recipe.customization.colors.tailGlow;store.markDirty()"></label><label class="range"><span><strong>强度</strong><small>{{ recipe.tailDesign.tipGlow.intensity.toFixed(2) }}</small></span><div><input v-model.number="recipe.tailDesign.tipGlow.intensity" type="range" min="0" max="6" step=".05" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.tailDesign.tipGlow.intensity" type="number" min="0" max="6" step=".05" @focus="store.checkpoint" @change="store.markDirty"></div></label><label class="range"><span><strong>光晕大小</strong><small>{{ recipe.tailDesign.tipGlow.auraScale.toFixed(2) }}</small></span><div><input v-model.number="recipe.tailDesign.tipGlow.auraScale" type="range" min=".2" max="5" step=".05" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.tailDesign.tipGlow.auraScale" type="number" min=".2" max="5" step=".05" @focus="store.checkpoint" @change="store.markDirty"></div></label></section>
    <section class="segments"><div class="segments-heading"><div><h3>分段尾巴</h3><small>{{ recipe.tailDesign.segments.length }} / {{ MAX_TAIL_SEGMENTS }} 段</small></div><button type="button" :disabled="recipe.tailDesign.segments.length>=MAX_TAIL_SEGMENTS" @click="addSegment">增加一段</button></div><details v-for="(segment,index) in recipe.tailDesign.segments" :key="index"><summary><span>第 {{ index+1 }} 段</span><button type="button" :disabled="recipe.tailDesign.segments.length<=MIN_TAIL_SEGMENTS" @click.prevent="removeSegment(index)">删除</button></summary><label v-for="[key,label,min,max,step] in segmentControls" :key="key" class="range"><span><strong>{{ label }}</strong><small>{{ segment[key].toFixed(2) }}</small></span><div><input :value="segment[key]" type="range" :min="min" :max="max" :step="step" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="setSegment(index,key,Number(($event.target as HTMLInputElement).value))"><input :value="segment[key]" type="number" :min="min" :max="max" :step="step" @focus="store.checkpoint" @change="setSegment(index,key,Number(($event.target as HTMLInputElement).value))"></div></label></details></section>
  </section>
</template>

<style scoped>
.editor,.card,.segments{display:grid;gap:9px}.editor>header small,.segments-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.editor>header h2{margin:5px 0 3px;font-size:17px}.editor>header p{margin:0;color:#8d96b6;font-size:10px}.card,.segments,details{padding:11px;border:1px solid #ffffff15;border-radius:13px;background:#ffffff05}.card h3,.segments h3{margin:0;font-size:12px}.card>label{display:grid;gap:5px;color:#bbc3dc;font-size:11px}.card select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 8px;color:#fff;background:#090e1b}.card input[type=color]{width:100%;height:34px;border:0;background:transparent}.check{display:flex!important;align-items:center!important;gap:7px}.range{display:grid;gap:5px}.range>span{display:flex;justify-content:space-between}.range>span small{color:#7e88a8}.range>div{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:7px}.range input[type=range]{width:100%;accent-color:#7066ff}.range input[type=number]{min-width:0;min-height:32px;border:1px solid #ffffff20;border-radius:8px;padding:0 6px;color:#fff;background:#090e1b}.segments-heading,summary{display:flex;align-items:center;justify-content:space-between;gap:8px}.segments-heading button,summary button{min-height:28px;border:1px solid #ffffff20;border-radius:8px;color:#dbe1f8;background:#ffffff08;font-size:9px}details{display:grid;gap:8px}summary{cursor:pointer;color:#dce2f8;font-size:11px}
</style>
