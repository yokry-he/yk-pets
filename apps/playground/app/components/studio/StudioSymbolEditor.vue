<!--
  文件职责 / File responsibility
  配置胸口能量核心与字母标志的显示模式，并独立编辑胸背标志的大小、位置、旋转和发光。
  Configures the chest core/symbol display mode and independently edits chest/back symbol size, position, rotation, and glow.
-->
<script setup lang="ts">
import { CHEST_DISPLAY_MODES, type ChestDisplayMode } from '~/domain/pet-species-registry'
import { SYMBOL_CHANNEL_RANGES } from '~/domain/pet-studio-phase3'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const chest = computed(() => recipe.value.symbols.chest)
const back = computed(() => recipe.value.symbols.back)
const chestSymbolActive = computed(() => ['symbol', 'hybrid'].includes(recipe.value.chestDisplay.mode))

function setChestMode(event: Event) {
  store.checkpoint()
  const mode = (event.target as HTMLSelectElement).value as ChestDisplayMode
  recipe.value.chestDisplay.mode = mode
  if (mode === 'symbol' || mode === 'hybrid') chest.value.enabled = true
  store.markDirty()
}
</script>

<template>
  <div class="editor">
    <h2>胸背标志与能量核心</h2>
    <section class="card">
      <h3>胸口显示</h3>
      <label>
        显示模式
        <select :value="recipe.chestDisplay.mode" @change="setChestMode">
          <option v-for="item in CHEST_DISPLAY_MODES" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>
      </label>
      <p>字母模式会隐藏能量核心；混合模式会缩小核心并把字母放在前层，避免互相遮挡。</p>
      <template v-if="chestSymbolActive">
        <label>
          文字
          <input v-model="chest.text" maxlength="3" @focus="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          颜色
          <input v-model="chest.color" type="color" @focus="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          大小 {{ chest.scale.toFixed(2) }}
          <input v-model.number="chest.scale" type="range" :min="SYMBOL_CHANNEL_RANGES.scale[0]" :max="SYMBOL_CHANNEL_RANGES.scale[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          左右位置 {{ chest.offsetX.toFixed(2) }}
          <input v-model.number="chest.offsetX" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetX[0]" :max="SYMBOL_CHANNEL_RANGES.offsetX[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          上下位置 {{ chest.offsetY.toFixed(2) }}
          <input v-model.number="chest.offsetY" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetY[0]" :max="SYMBOL_CHANNEL_RANGES.offsetY[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          前后位置 {{ chest.offsetZ.toFixed(2) }}
          <input v-model.number="chest.offsetZ" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetZ[0]" :max="SYMBOL_CHANNEL_RANGES.offsetZ[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          旋转 {{ chest.rotation.toFixed(2) }}
          <input v-model.number="chest.rotation" type="range" :min="SYMBOL_CHANNEL_RANGES.rotation[0]" :max="SYMBOL_CHANNEL_RANGES.rotation[1]" step=".02" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
        <label>
          发光 {{ chest.glowIntensity.toFixed(2) }}
          <input v-model.number="chest.glowIntensity" type="range" :min="SYMBOL_CHANNEL_RANGES.glowIntensity[0]" :max="SYMBOL_CHANNEL_RANGES.glowIntensity[1]" step=".05" @pointerdown="store.checkpoint" @input="store.markDirty">
        </label>
      </template>
    </section>

    <section class="card">
      <h3>后背标志</h3>
      <label class="check">
        <input v-model="back.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">
        显示
      </label>
      <label>
        文字
        <input v-model="back.text" maxlength="3" @focus="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        颜色
        <input v-model="back.color" type="color" @focus="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        大小 {{ back.scale.toFixed(2) }}
        <input v-model.number="back.scale" type="range" :min="SYMBOL_CHANNEL_RANGES.scale[0]" :max="SYMBOL_CHANNEL_RANGES.scale[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        左右位置 {{ back.offsetX.toFixed(2) }}
        <input v-model.number="back.offsetX" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetX[0]" :max="SYMBOL_CHANNEL_RANGES.offsetX[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        上下位置 {{ back.offsetY.toFixed(2) }}
        <input v-model.number="back.offsetY" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetY[0]" :max="SYMBOL_CHANNEL_RANGES.offsetY[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        前后位置（向外） {{ back.offsetZ.toFixed(2) }}
        <input v-model.number="back.offsetZ" type="range" :min="SYMBOL_CHANNEL_RANGES.offsetZ[0]" :max="SYMBOL_CHANNEL_RANGES.offsetZ[1]" step=".01" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        旋转 {{ back.rotation.toFixed(2) }}
        <input v-model.number="back.rotation" type="range" :min="SYMBOL_CHANNEL_RANGES.rotation[0]" :max="SYMBOL_CHANNEL_RANGES.rotation[1]" step=".02" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
      <label>
        发光 {{ back.glowIntensity.toFixed(2) }}
        <input v-model.number="back.glowIntensity" type="range" :min="SYMBOL_CHANNEL_RANGES.glowIntensity[0]" :max="SYMBOL_CHANNEL_RANGES.glowIntensity[1]" step=".05" @pointerdown="store.checkpoint" @input="store.markDirty">
      </label>
    </section>
  </div>
</template>

<style scoped>
.editor{display:flex;flex-direction:column;gap:12px}.editor h2,.editor h3{margin:0}.card{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.card p{margin:0;color:#9da6c8;font-size:12px;line-height:1.55}.card label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.card input:not([type=range]):not([type=checkbox]):not([type=color]),.card select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.card input[type=range]{width:100%;accent-color:#7066ff}.card input[type=color]{width:100%;height:36px;border:0;background:transparent}.check{flex-direction:row!important;align-items:center}
</style>
