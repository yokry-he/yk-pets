<!--
  文件职责 / File responsibility
  独立编辑尾巴背部根段、整体侧偏、逐段位置旋转和尾尖发光，不修改其它宠物外观。
  Edits the tail back root, lateral offset, per-segment transforms, and tip glow without modifying other pet appearance.
-->
<script setup lang="ts">
import {
  MAX_TAIL_SEGMENTS,
  MIN_TAIL_SEGMENTS,
  PET_STUDIO_PART_OPTIONS,
  type TailDesignRecipe,
  type TailSegmentRecipe,
} from '~/domain/pet-studio-phase2'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const value = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const number = (event: Event) => Number(value(event))

type RootKey = 'rootOffsetX' | 'rootOffsetY' | 'rootOffsetZ' | 'rootExtensionLength' | 'rootExtensionWidth' | 'lateralOffset'
type SegmentKey = keyof TailSegmentRecipe
const rootControls: Array<[RootKey, string, number, number, number]> = [
  ['rootOffsetX', '根部左右位置', -.8, .8, .01],
  ['rootOffsetY', '根部上下位置', -.8, .8, .01],
  ['rootOffsetZ', '根部前后位置', -.8, .8, .01],
  ['rootExtensionLength', '背面伸出长度', .12, .9, .01],
  ['rootExtensionWidth', '背面根段宽度', .08, .42, .01],
  ['lateralOffset', '整体侧向偏移', -1.2, 1.2, .01],
]
const segmentControls: Array<[SegmentKey, string, number, number, number]> = [
  ['length', '长度', .18, .9, .01],
  ['width', '宽度', .08, .42, .01],
  ['offsetX', '左右偏移', -.6, .6, .01],
  ['offsetY', '上下偏移', -.6, .6, .01],
  ['offsetZ', '前后偏移', -.6, .6, .01],
  ['rotationX', '旋转 X', -3.14, 3.14, .02],
  ['rotationY', '旋转 Y', -3.14, 3.14, .02],
  ['rotationZ', '旋转 Z', -3.14, 3.14, .02],
]

function patchRoot(key: RootKey, event: Event) {
  store.patchTailDesign({ [key]: number(event) } as Partial<TailDesignRecipe>)
}
function patchDirection(event: Event) {
  store.patchTailDesign({ direction: value(event) as TailDesignRecipe['direction'] })
}
function patchSegment(index: number, key: SegmentKey, event: Event) {
  store.patchTailSegment(index, { [key]: number(event) } as Partial<TailSegmentRecipe>)
}
function addSegment() {
  if (recipe.value.tailDesign.segments.length >= MAX_TAIL_SEGMENTS) return
  store.checkpoint()
  store.replaceTailSegments([
    ...recipe.value.tailDesign.segments,
    { length: .4, width: .15, offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
  ])
}
function removeSegment(index: number) {
  if (recipe.value.tailDesign.segments.length <= MIN_TAIL_SEGMENTS) return
  store.checkpoint()
  store.replaceTailSegments(recipe.value.tailDesign.segments.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <section class="tail-editor">
    <h2>背部根段与分段尾巴</h2>
    <p>尾巴始终从身体背面中轴伸出。修改任意尾段只更新 <code>tailDesign</code>，不会重置头部、身体和耳朵。</p>
    <label>
      尾巴朝向
      <select :value="recipe.tailDesign.direction" @focus="store.checkpoint" @change="patchDirection">
        <option value="left">向左</option><option value="right">向右</option><option value="up">向上</option>
        <option value="down">向下</option><option value="back">向后</option><option value="forward">向前</option>
      </select>
    </label>
    <label v-for="[key,label,min,max,step] in rootControls" :key="key">
      {{ label }} {{ recipe.tailDesign[key].toFixed(2) }}
      <input :value="recipe.tailDesign[key]" type="range" :min="min" :max="max" :step="step" @pointerdown="store.checkpoint" @input="patchRoot(key,$event)">
    </label>

    <section class="card">
      <h3>尾巴尖发光</h3>
      <label class="check"><input :checked="recipe.tailDesign.tipGlow.enabled" type="checkbox" @focus="store.checkpoint" @change="store.patchTailDesign({ tipGlow: { enabled: checked($event) } })">启用</label>
      <label>颜色<input :value="recipe.tailDesign.tipGlow.color" type="color" @focus="store.checkpoint" @input="store.patchTailDesign({ tipGlow: { color: value($event) } })"></label>
      <label>强度 {{ recipe.tailDesign.tipGlow.intensity.toFixed(2) }}<input :value="recipe.tailDesign.tipGlow.intensity" type="range" min="0" max="5" step=".05" @pointerdown="store.checkpoint" @input="store.patchTailDesign({ tipGlow: { intensity: number($event) } })"></label>
      <label>光晕大小 {{ recipe.tailDesign.tipGlow.auraScale.toFixed(2) }}<input :value="recipe.tailDesign.tipGlow.auraScale" type="range" min=".5" max="3" step=".05" @pointerdown="store.checkpoint" @input="store.patchTailDesign({ tipGlow: { auraScale: number($event) } })"></label>
    </section>

    <div class="row"><b>尾巴 {{ recipe.tailDesign.segments.length }} / {{ MAX_TAIL_SEGMENTS }} 段</b><button type="button" @click="addSegment">增加</button></div>
    <small>至少保留 {{ MIN_TAIL_SEGMENTS }} 段，以维持扩展经典尾巴的连续轮廓。</small>
    <details v-for="(segment,index) in recipe.tailDesign.segments" :key="index">
      <summary>第 {{ index + 1 }} 段 <button type="button" :disabled="recipe.tailDesign.segments.length <= MIN_TAIL_SEGMENTS" @click.prevent="removeSegment(index)">删除</button></summary>
      <label v-for="[key,label,min,max,step] in segmentControls" :key="key">
        {{ label }} {{ segment[key].toFixed(2) }}
        <input :value="segment[key]" type="range" :min="min" :max="max" :step="step" @pointerdown="store.checkpoint" @input="patchSegment(index,key,$event)">
      </label>
    </details>

    <h3>组合触角</h3>
    <label>触角开关<select v-model="recipe.parts.antenna" @focus="store.checkpoint" @change="store.markDirty"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennas" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
    <label>杆体<select v-model="recipe.parts.antennaRod" @focus="store.checkpoint" @change="store.markDirty"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennaRods" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
    <label>末端<select v-model="recipe.parts.antennaTip" @focus="store.checkpoint" @change="store.markDirty"><option v-for="item in PET_STUDIO_PART_OPTIONS.antennaTips" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
  </section>
</template>

<style scoped>
.tail-editor{display:flex;flex-direction:column;gap:11px}.tail-editor h2,.tail-editor h3,.tail-editor p{margin:0}.tail-editor p,.tail-editor small{color:#9da6c8;font-size:12px}.tail-editor label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.tail-editor select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.tail-editor input[type=range]{width:100%;accent-color:#7066ff}.tail-editor input[type=color]{width:100%;height:36px;border:0;background:transparent}.card,details{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.check{flex-direction:row!important;align-items:center}.row,summary{display:flex;align-items:center;justify-content:space-between;gap:8px}.row button,summary button{border:1px solid #ffffff24;border-radius:8px;padding:6px 9px;color:#fff;background:#ffffff0d}.row button:disabled,summary button:disabled{opacity:.4}
</style>
