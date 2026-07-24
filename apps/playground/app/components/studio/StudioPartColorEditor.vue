<!--
  文件职责 / File responsibility
  以分组色板编辑宠物所有可见材质通道，并通过统一 Store 动作同步兼容调色板与新增部位颜色。
  Edits every visible pet material channel in grouped palettes and synchronizes legacy palette fields with new part colors through one Store action.
-->
<script setup lang="ts">
import { createDefaultPetCustomization, type PetPartColorRecipe } from '~/domain/pet-part-customization'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const groups: Array<{
  title: string
  description: string
  items: Array<[keyof PetPartColorRecipe, string, string]>
}> = [
  {
    title: '身体与四肢',
    description: '现有统一模型中，身体材质同时延续到尾巴对应分段。',
    items: [
      ['body', '身体主体 / 尾根', 'Body / Tail Root'],
      ['limbs', '四肢 / 尾中段', 'Limbs / Mid Tail'],
      ['paws', '爪部 / 尾尖暖色', 'Paws / Warm Tail Tip'],
      ['belly', '肚皮', 'Belly Patch'],
    ],
  },
  {
    title: '脸部',
    description: '鼻子和嘴巴使用独立几何与独立颜色。',
    items: [
      ['muzzle', '口鼻部毛色', 'Muzzle'],
      ['nose', '鼻子', 'Nose'],
      ['mouth', '嘴部', 'Mouth'],
      ['tongue', '舌头', 'Tongue'],
      ['cheeks', '脸颊', 'Cheeks'],
      ['eyes', '眼睛', 'Eyes'],
      ['eyeHighlight', '眼睛高光 / 能量核心', 'Eye Highlight / Core'],
    ],
  },
  {
    title: '耳朵与触角',
    description: '外耳、内耳和耳尖保持独立；触角杆延续爪部暖色通道以兼容旧配方。',
    items: [
      ['earOuter', '外耳', 'Outer Ear'],
      ['earInner', '内耳', 'Inner Ear'],
      ['earTip', '耳尖', 'Ear Tip'],
      ['antennaRod', '触角杆 / 暖色通道', 'Antenna Rod'],
      ['antennaTip', '触角尖', 'Antenna Tip'],
    ],
  },
  {
    title: '能量与尾部',
    description: '尾尖发光和核心高光仍保留动作联动。',
    items: [
      ['tailGlow', '尾尖发光', 'Tail Glow'],
      ['energyCore', '能量核心 / 次级高光', 'Energy Core'],
    ],
  },
]

function updateColor(key: keyof PetPartColorRecipe, event: Event) {
  store.patchPartColor(key, (event.target as HTMLInputElement).value)
}

function resetColors() {
  store.checkpoint()
  const defaults = createDefaultPetCustomization(store.recipe).colors
  for (const [key, value] of Object.entries(defaults)) store.patchPartColor(key as keyof PetPartColorRecipe, value, false)
  store.markDirty()
}
</script>

<template>
  <section class="color-editor">
    <header>
      <div><small>PART COLORS</small><h2>所有部位颜色</h2><p>颜色立即反映到 Studio 和同步后的 Chrome 扩展。</p></div>
      <button type="button" @click="resetColors">恢复经典配色</button>
    </header>
    <section v-for="group in groups" :key="group.title" class="color-group">
      <div><h3>{{ group.title }}</h3><p>{{ group.description }}</p></div>
      <div class="color-grid">
        <label v-for="[key, label, labelEn] in group.items" :key="key">
          <input
            type="color"
            :value="store.recipe.customization.colors[key]"
            @focus="store.checkpoint"
            @input="updateColor(key, $event)"
          >
          <span><strong>{{ label }}</strong><small>{{ labelEn }} · {{ store.recipe.customization.colors[key] }}</small></span>
        </label>
      </div>
    </section>
    <section class="legacy-colors">
      <div><h3>轨道与标志</h3><p>这些通道原本已独立，继续保留精确控制。</p></div>
      <div class="color-grid">
        <label><input v-model="store.recipe.orbitDesign.primaryColor" type="color" @focus="store.checkpoint" @input="store.markDirty"><span><strong>主轨道</strong><small>{{ store.recipe.orbitDesign.primaryColor }}</small></span></label>
        <label><input v-model="store.recipe.orbitDesign.secondaryColor" type="color" @focus="store.checkpoint" @input="store.markDirty"><span><strong>副轨道</strong><small>{{ store.recipe.orbitDesign.secondaryColor }}</small></span></label>
        <label><input v-model="store.recipe.symbols.chest.color" type="color" @focus="store.checkpoint" @input="store.markDirty"><span><strong>胸口标志</strong><small>{{ store.recipe.symbols.chest.color }}</small></span></label>
        <label><input v-model="store.recipe.symbols.back.color" type="color" @focus="store.checkpoint" @input="store.markDirty"><span><strong>后背标志</strong><small>{{ store.recipe.symbols.back.color }}</small></span></label>
      </div>
    </section>
  </section>
</template>

<style scoped>
.color-editor{display:grid;gap:12px}.color-editor>header,.color-group,.legacy-colors{padding:14px;border:1px solid #ffffff18;border-radius:16px;background:linear-gradient(145deg,#12172a,#0d1222)}header{display:flex;align-items:start;justify-content:space-between;gap:12px}header small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}h2,h3,p{margin:0}h2{margin-top:5px;font-size:17px}h3{font-size:14px}p{margin-top:4px;color:#8f99b8;font-size:11px;line-height:1.5}button{min-height:34px;padding:0 10px;border:1px solid #ffffff20;border-radius:9px;color:#fff;background:#ffffff08;cursor:pointer}.color-group,.legacy-colors{display:grid;gap:11px}.color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.color-grid label{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:9px;padding:8px;border:1px solid #ffffff13;border-radius:11px;background:#080d1a99;cursor:pointer}.color-grid input{width:42px;height:36px;padding:0;border:0;border-radius:8px;background:transparent}.color-grid span{display:grid;gap:3px;min-width:0}.color-grid strong{font-size:11px}.color-grid small{overflow:hidden;color:#7f89a9;font-size:9px;text-overflow:ellipsis;white-space:nowrap}button:focus-visible,input:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}
</style>
