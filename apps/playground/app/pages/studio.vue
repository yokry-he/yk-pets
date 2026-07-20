
<!--
  文件职责 / File responsibility
  提供云狐工坊三栏编辑器、实时预览、部件与比例控制、发光标志、动作测试和配方管理。
  Provides the Cloud Fox Studio three-column editor, live preview, part and proportion controls, glowing symbols, motion tests, and recipe management.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import {
  CLOUD_FOX_PART_OPTIONS,
  CLOUD_FOX_SPECIES_DEFINITION,
  derivePetMonogram,
  type CloudFoxStudioBackground,
  type CloudFoxStudioBehavior,
  type CloudFoxStudioView,
} from '~/domain/cloud-fox-appearance'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

const store = usePetAppearanceStore()
const activeSection = ref<'identity' | 'face' | 'body' | 'tail' | 'glow' | 'symbols'>('identity')
const behavior = ref<CloudFoxStudioBehavior>('idle')
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const notice = ref('')
let behaviorTimer: number | undefined
let noticeTimer: number | undefined

const recipe = computed(() => store.recipe)
const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges

const sections = [
  { id: 'identity', label: '身份', icon: 'ID' },
  { id: 'face', label: '头部', icon: '◉' },
  { id: 'body', label: '身体', icon: '◇' },
  { id: 'tail', label: '尾巴与触角', icon: '≈' },
  { id: 'glow', label: '发光', icon: '✦' },
  { id: 'symbols', label: '标志', icon: 'YK' },
] as const

const views: Array<{ id: CloudFoxStudioView; label: string }> = [
  { id: 'front', label: '正面' },
  { id: 'left', label: '左侧' },
  { id: 'back', label: '背面' },
  { id: 'right', label: '右侧' },
]

const backgrounds: Array<{ id: CloudFoxStudioBackground; label: string }> = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
  { id: 'web', label: '网页' },
]

const behaviors: Array<{ id: CloudFoxStudioBehavior; label: string; duration: number }> = [
  { id: 'idle', label: '待机', duration: 0 },
  { id: 'greeting', label: '招手', duration: 2600 },
  { id: 'jumping', label: '跳跃', duration: 2100 },
  { id: 'stretching', label: '伸展', duration: 3200 },
  { id: 'spinning', label: '转圈', duration: 2600 },
  { id: 'resting', label: '趴下', duration: 4200 },
]

useHead({
  title: '云狐工坊 · YK-PETS',
  meta: [
    { name: 'description', content: '手动创建云狐外观，调整部件、比例、发光和身份标志。' },
  ],
})

onMounted(() => store.hydrate())
onBeforeUnmount(() => {
  if (behaviorTimer) window.clearTimeout(behaviorTimer)
  if (noticeTimer) window.clearTimeout(noticeTimer)
})

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, 2600)
}

function markDirty() {
  store.markDirty()
}

function syncMonogram() {
  const next = derivePetMonogram(recipe.value.identity.nameEn)
  recipe.value.identity.monogram = next
  recipe.value.symbols.chestText = next
  markDirty()
}

function playBehavior(next: CloudFoxStudioBehavior, duration: number) {
  if (behaviorTimer) window.clearTimeout(behaviorTimer)
  behavior.value = next
  if (duration > 0) {
    behaviorTimer = window.setTimeout(() => {
      behavior.value = 'idle'
    }, duration)
  }
}

function saveRecipe() {
  store.save()
  showNotice('外观配方已保存在当前浏览器。')
}

function resetRecipe() {
  if (!window.confirm('恢复云灵的默认外观？当前未保存修改会丢失。')) return
  store.reset()
  behavior.value = 'idle'
  view.value = 'front'
  showNotice('已恢复默认云狐外观。')
}

function randomizeRecipe() {
  store.randomize()
  showNotice('已生成一套新的云狐外观。')
}

function exportRecipe() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${recipe.value.identity.petId || 'cloud-fox'}-appearance.json`
  anchor.click()
  URL.revokeObjectURL(url)
  showNotice('外观配方已导出。')
}

function openImport() {
  fileInput.value?.click()
}

async function importRecipe(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    store.replace(JSON.parse(await file.text()))
    showNotice('外观配方已导入并完成安全范围校正。')
  }
  catch {
    showNotice('无法读取该配方，请确认它是有效的 JSON 文件。')
  }
}

function formatValue(value: number) {
  return value.toFixed(2)
}
</script>

<template>
  <main class="studio-page">
    <header class="studio-header">
      <div>
        <NuxtLink to="/" class="back-link">← 返回 YK-PETS</NuxtLink>
        <p class="eyebrow">CLOUD FOX STUDIO / 云狐工坊</p>
        <h1>创建属于你的云狐</h1>
        <p>从云灵（Zeph）的物种模板出发，选择部件、调整安全比例，并为尾巴、触角和身份标志配置发光效果。</p>
      </div>
      <div class="header-actions">
        <button type="button" class="secondary" @click="randomizeRecipe">随机生成</button>
        <button type="button" class="secondary" @click="resetRecipe">恢复默认</button>
        <button type="button" class="secondary" @click="openImport">导入</button>
        <button type="button" class="secondary" @click="exportRecipe">导出</button>
        <button type="button" class="primary" @click="saveRecipe">保存外观</button>
        <input ref="fileInput" class="sr-only" type="file" accept="application/json,.json" @change="importRecipe">
      </div>
    </header>

    <div class="studio-layout">
      <aside class="section-nav" aria-label="外观编辑分类">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <span>{{ section.icon }}</span>
          {{ section.label }}
        </button>
      </aside>

      <section class="preview-column">
        <div class="preview-toolbar">
          <div>
            <span class="toolbar-label">视角</span>
            <button
              v-for="item in views"
              :key="item.id"
              type="button"
              :class="{ active: view === item.id }"
              @click="view = item.id"
            >{{ item.label }}</button>
          </div>
          <div>
            <span class="toolbar-label">背景</span>
            <button
              v-for="item in backgrounds"
              :key="item.id"
              type="button"
              :class="{ active: background === item.id }"
              @click="background = item.id"
            >{{ item.label }}</button>
          </div>
        </div>

        <ClientOnly>
          <CloudFoxStudioCanvas
            :appearance="recipe"
            :behavior="behavior"
            :view="view"
            :background="background"
          />
          <template #fallback>
            <div class="preview-fallback">正在装配云狐工坊…</div>
          </template>
        </ClientOnly>

        <div class="motion-tests">
          <span>动作兼容测试</span>
          <button
            v-for="item in behaviors"
            :key="item.id"
            type="button"
            :class="{ active: behavior === item.id }"
            @click="playBehavior(item.id, item.duration)"
          >{{ item.label }}</button>
        </div>
      </section>

      <aside class="control-panel">
        <div class="control-panel__heading">
          <div>
            <span>当前配方</span>
            <strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong>
          </div>
          <b :class="{ dirty: store.dirty }">{{ store.dirty ? '未保存' : '已保存' }}</b>
        </div>

        <!-- 身份设置 / Identity settings -->
        <section v-if="activeSection === 'identity'" class="control-section">
          <h2>身份信息</h2>
          <p>名字属于宠物个体，物种固定为云狐。胸口字母默认从英文名生成。</p>
          <label>
            <span>中文名字</span>
            <input v-model="recipe.identity.nameZh" maxlength="16" @input="markDirty">
          </label>
          <label>
            <span>英文名字</span>
            <input v-model="recipe.identity.nameEn" maxlength="24" @input="markDirty" @blur="syncMonogram">
          </label>
          <label>
            <span>稳定宠物 ID</span>
            <input v-model="recipe.identity.petId" maxlength="40" @input="markDirty">
          </label>
          <label>
            <span>名字缩写</span>
            <input v-model="recipe.identity.monogram" maxlength="3" @input="markDirty">
          </label>
          <div class="identity-card">
            <span>物种</span>
            <strong>云狐 / Cloud Fox</strong>
            <small>speciesId: cloud-fox</small>
          </div>
        </section>

        <!-- 头部部件 / Head parts -->
        <section v-else-if="activeSection === 'face'" class="control-section">
          <h2>头部与表情</h2>
          <p>所有部件都围绕固定挂载点变化，避免破坏动作骨架。</p>
          <label>
            <span>耳朵样式</span>
            <select v-model="recipe.parts.ears" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.ears" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label>
            <span>眼睛样式</span>
            <select v-model="recipe.parts.eyes" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.eyes" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label>
            <span>鼻子样式</span>
            <select v-model="recipe.parts.nose" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.noses" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label>
            <span>嘴部样式</span>
            <select v-model="recipe.parts.mouth" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.mouths" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label class="range-control">
            <span>耳朵大小 <b>{{ formatValue(recipe.proportions.earScale) }}</b></span>
            <input v-model.number="recipe.proportions.earScale" type="range" :min="ranges.earScale[0]" :max="ranges.earScale[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>眼睛大小 <b>{{ formatValue(recipe.proportions.eyeScale) }}</b></span>
            <input v-model.number="recipe.proportions.eyeScale" type="range" :min="ranges.eyeScale[0]" :max="ranges.eyeScale[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>眼睛间距 <b>{{ formatValue(recipe.proportions.eyeSpacing) }}</b></span>
            <input v-model.number="recipe.proportions.eyeSpacing" type="range" :min="ranges.eyeSpacing[0]" :max="ranges.eyeSpacing[1]" step="0.01" @input="markDirty">
          </label>
          <div class="color-grid">
            <label><span>眼睛</span><input v-model="recipe.palette.eye" type="color" @input="markDirty"></label>
            <label><span>耳内</span><input v-model="recipe.palette.innerEar" type="color" @input="markDirty"></label>
          </div>
        </section>

        <!-- 身体与四肢 / Body and limbs -->
        <section v-else-if="activeSection === 'body'" class="control-section">
          <h2>身体与四肢</h2>
          <p>比例被限制在物种安全范围内，动作测试可用于发现视觉穿插。</p>
          <label class="range-control">
            <span>身体大小 <b>{{ formatValue(recipe.proportions.bodyScale) }}</b></span>
            <input v-model.number="recipe.proportions.bodyScale" type="range" :min="ranges.bodyScale[0]" :max="ranges.bodyScale[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>头部大小 <b>{{ formatValue(recipe.proportions.headScale) }}</b></span>
            <input v-model.number="recipe.proportions.headScale" type="range" :min="ranges.headScale[0]" :max="ranges.headScale[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>前肢长度 <b>{{ formatValue(recipe.proportions.limbLength) }}</b></span>
            <input v-model.number="recipe.proportions.limbLength" type="range" :min="ranges.limbLength[0]" :max="ranges.limbLength[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>前肢间距 <b>{{ formatValue(recipe.proportions.limbSpacing) }}</b></span>
            <input v-model.number="recipe.proportions.limbSpacing" type="range" :min="ranges.limbSpacing[0]" :max="ranges.limbSpacing[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>爪子大小 <b>{{ formatValue(recipe.proportions.pawScale) }}</b></span>
            <input v-model.number="recipe.proportions.pawScale" type="range" :min="ranges.pawScale[0]" :max="ranges.pawScale[1]" step="0.01" @input="markDirty">
          </label>
          <div class="color-grid color-grid--three">
            <label><span>主毛色</span><input v-model="recipe.palette.coat" type="color" @input="markDirty"></label>
            <label><span>阴影毛色</span><input v-model="recipe.palette.coatShadow" type="color" @input="markDirty"></label>
            <label><span>腹部毛色</span><input v-model="recipe.palette.coatWarm" type="color" @input="markDirty"></label>
          </div>
        </section>

        <!-- 尾巴与触角 / Tail and antennae -->
        <section v-else-if="activeSection === 'tail'" class="control-section">
          <h2>尾巴与触角</h2>
          <p>云狐的能量器官拥有独立样式、长度、宽度和颜色通道。</p>
          <label>
            <span>尾巴样式</span>
            <select v-model="recipe.parts.tail" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.tails" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label>
            <span>触角样式</span>
            <select v-model="recipe.parts.antenna" @change="markDirty">
              <option v-for="item in CLOUD_FOX_PART_OPTIONS.antennas" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </label>
          <label class="range-control">
            <span>尾巴长度 <b>{{ formatValue(recipe.proportions.tailLength) }}</b></span>
            <input v-model.number="recipe.proportions.tailLength" type="range" :min="ranges.tailLength[0]" :max="ranges.tailLength[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>尾巴宽度 <b>{{ formatValue(recipe.proportions.tailWidth) }}</b></span>
            <input v-model.number="recipe.proportions.tailWidth" type="range" :min="ranges.tailWidth[0]" :max="ranges.tailWidth[1]" step="0.01" @input="markDirty">
          </label>
          <label class="range-control">
            <span>触角大小 <b>{{ formatValue(recipe.proportions.antennaScale) }}</b></span>
            <input v-model.number="recipe.proportions.antennaScale" type="range" :min="ranges.antennaScale[0]" :max="ranges.antennaScale[1]" step="0.01" @input="markDirty">
          </label>
          <div class="color-grid">
            <label><span>尾巴发光</span><input v-model="recipe.palette.tailGlow" type="color" @input="markDirty"></label>
            <label><span>触角发光</span><input v-model="recipe.palette.antennaGlow" type="color" @input="markDirty"></label>
          </div>
        </section>

        <!-- 发光通道 / Glow channels -->
        <section v-else-if="activeSection === 'glow'" class="control-section">
          <h2>统一发光通道</h2>
          <p>尾巴和触角共享发光模式，但仍可保留各自的固定颜色。</p>
          <label>
            <span>发光模式</span>
            <select v-model="recipe.glow.mode" @change="markDirty">
              <option value="fixed">固定颜色</option>
              <option value="emotion">跟随动作状态</option>
              <option value="rainbow">彩虹循环</option>
            </select>
          </label>
          <label class="check-control">
            <input v-model="recipe.glow.tailEnabled" type="checkbox" @change="markDirty">
            <span>启用尾巴发光</span>
          </label>
          <label class="check-control">
            <input v-model="recipe.glow.antennaEnabled" type="checkbox" @change="markDirty">
            <span>启用触角发光</span>
          </label>
          <label class="range-control">
            <span>发光强度 <b>{{ formatValue(recipe.glow.intensity) }}</b></span>
            <input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step="0.05" @input="markDirty">
          </label>
          <label class="range-control">
            <span>脉冲速度 <b>{{ formatValue(recipe.glow.pulseSpeed) }}</b></span>
            <input v-model.number="recipe.glow.pulseSpeed" type="range" :min="ranges.pulseSpeed[0]" :max="ranges.pulseSpeed[1]" step="0.05" @input="markDirty">
          </label>
          <div class="color-grid color-grid--three">
            <label><span>主发光</span><input v-model="recipe.palette.primaryGlow" type="color" @input="markDirty"></label>
            <label><span>辅助发光</span><input v-model="recipe.palette.secondaryGlow" type="color" @input="markDirty"></label>
            <label><span>标志发光</span><input v-model="recipe.palette.symbolGlow" type="color" @input="markDirty"></label>
          </div>
        </section>

        <!-- 胸背标志 / Chest and back symbols -->
        <section v-else class="control-section">
          <h2>身份标志</h2>
          <p>标志通过动态 Canvas 纹理生成，不需要为每个名字重新制作 3D 字体模型。</p>
          <label class="check-control">
            <input v-model="recipe.symbols.chestEnabled" type="checkbox" @change="markDirty">
            <span>显示胸口标志</span>
          </label>
          <label>
            <span>胸口文字</span>
            <input v-model="recipe.symbols.chestText" maxlength="3" @input="markDirty">
          </label>
          <label class="check-control">
            <input v-model="recipe.symbols.backEnabled" type="checkbox" @change="markDirty">
            <span>显示后背标志</span>
          </label>
          <label>
            <span>后背文字</span>
            <input v-model="recipe.symbols.backText" maxlength="3" @input="markDirty">
          </label>
          <label class="range-control">
            <span>标志大小 <b>{{ formatValue(recipe.symbols.symbolScale) }}</b></span>
            <input v-model.number="recipe.symbols.symbolScale" type="range" :min="ranges.symbolScale[0]" :max="ranges.symbolScale[1]" step="0.01" @input="markDirty">
          </label>
          <div class="symbol-preview">
            <div><span>胸口</span><strong>{{ recipe.symbols.chestText || '—' }}</strong></div>
            <div><span>后背</span><strong>{{ recipe.symbols.backText || '—' }}</strong></div>
          </div>
        </section>
      </aside>
    </div>

    <p v-if="notice" class="studio-notice" role="status">{{ notice }}</p>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #070912;
}

:global(*) {
  box-sizing: border-box;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.studio-page {
  min-height: 100vh;
  padding: 34px;
  color: #f2f4ff;
  background:
    radial-gradient(circle at 74% 8%, rgba(112, 102, 255, .18), transparent 27%),
    radial-gradient(circle at 14% 34%, rgba(82, 224, 208, .1), transparent 24%),
    #070912;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.studio-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  max-width: 1680px;
  margin: 0 auto 28px;
}

.studio-header h1 {
  margin: 8px 0 10px;
  font-size: clamp(34px, 4vw, 62px);
  line-height: .98;
}

.studio-header p {
  max-width: 780px;
  margin: 0;
  color: #aeb7d8;
  line-height: 1.7;
}

.back-link {
  color: #8fe9dd;
  text-decoration: none;
}

.eyebrow {
  margin-top: 24px !important;
  color: #8d86ff !important;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .14em;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
}

.header-actions button,
.preview-toolbar button,
.motion-tests button {
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 11px;
  padding: 9px 13px;
  color: #e9ecff;
  background: rgba(255, 255, 255, .055);
}

.header-actions .primary {
  border-color: rgba(112, 102, 255, .82);
  background: linear-gradient(135deg, #7066ff, #5649dd);
}

.header-actions button:hover,
.preview-toolbar button:hover,
.motion-tests button:hover,
.preview-toolbar button.active,
.motion-tests button.active {
  border-color: rgba(112, 102, 255, .78);
  background: rgba(112, 102, 255, .2);
}

.studio-layout {
  display: grid;
  grid-template-columns: 148px minmax(520px, 1fr) minmax(330px, 390px);
  gap: 18px;
  max-width: 1680px;
  margin: 0 auto;
}

.section-nav,
.control-panel,
.preview-toolbar,
.motion-tests {
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(14, 17, 30, .78);
  backdrop-filter: blur(18px);
}

.section-nav {
  display: flex;
  flex-direction: column;
  align-self: start;
  gap: 7px;
  padding: 12px;
  border-radius: 20px;
  position: sticky;
  top: 20px;
}

.section-nav button {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 47px;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 8px 10px;
  color: #aeb7d8;
  text-align: left;
  background: transparent;
}

.section-nav button span {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 9px;
  color: #d9dcff;
  background: rgba(255, 255, 255, .07);
  font-size: 10px;
  font-weight: 900;
}

.section-nav button.active {
  border-color: rgba(112, 102, 255, .42);
  color: #fff;
  background: rgba(112, 102, 255, .16);
}

.preview-column {
  min-width: 0;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 16px;
}

.preview-toolbar > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.toolbar-label {
  margin-right: 3px;
  color: #8791b7;
  font-size: 12px;
}

.motion-tests {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
}

.motion-tests > span {
  margin-right: 4px;
  color: #aeb7d8;
  font-size: 13px;
}

.control-panel {
  align-self: start;
  min-height: 620px;
  overflow: hidden;
  border-radius: 24px;
  position: sticky;
  top: 20px;
}

.control-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, .09);
}

.control-panel__heading > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-panel__heading span {
  color: #7f89ae;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .12em;
}

.control-panel__heading b {
  padding: 5px 8px;
  border-radius: 999px;
  color: #6fe9d7;
  background: rgba(82, 224, 208, .1);
  font-size: 11px;
}

.control-panel__heading b.dirty {
  color: #ffd36a;
  background: rgba(255, 211, 106, .1);
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: calc(100vh - 190px);
  overflow: auto;
  padding: 20px;
}

.control-section h2 {
  margin: 0;
  font-size: 21px;
}

.control-section > p {
  margin: -6px 0 4px;
  color: #8f99bd;
  font-size: 13px;
  line-height: 1.65;
}

.control-section label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: #b9c0dc;
  font-size: 13px;
}

.control-section input:not([type='range']):not([type='color']),
.control-section select {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 11px;
  padding: 9px 11px;
  color: #f4f6ff;
  outline: none;
  background: #111526;
}

.control-section input:focus,
.control-section select:focus {
  border-color: #7066ff;
  box-shadow: 0 0 0 3px rgba(112, 102, 255, .14);
}

.range-control span {
  display: flex;
  justify-content: space-between;
}

.range-control b {
  color: #8fe9dd;
  font-variant-numeric: tabular-nums;
}

.range-control input {
  width: 100%;
  accent-color: #7066ff;
}

.check-control {
  flex-direction: row !important;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: 12px;
  background: rgba(255, 255, 255, .035);
}

.check-control input {
  width: 17px;
  height: 17px;
  accent-color: #7066ff;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px;
}

.color-grid--three {
  grid-template-columns: repeat(3, 1fr);
}

.color-grid label {
  align-items: center;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: 12px;
  background: rgba(255, 255, 255, .035);
}

.color-grid input[type='color'] {
  width: 100%;
  height: 38px;
  border: 0;
  padding: 0;
  background: transparent;
}

.identity-card,
.symbol-preview {
  border: 1px solid rgba(112, 102, 255, .28);
  border-radius: 14px;
  padding: 14px;
  background: rgba(112, 102, 255, .08);
}

.identity-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.identity-card span,
.identity-card small,
.symbol-preview span {
  color: #8f99bd;
  font-size: 11px;
}

.symbol-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.symbol-preview > div {
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: center;
}

.symbol-preview strong {
  color: v-bind('recipe.palette.symbolGlow');
  font-size: 34px;
  text-shadow: 0 0 18px currentColor;
}

.preview-fallback {
  display: grid;
  place-items: center;
  min-height: 620px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 28px;
  color: #9da6ca;
  background: #0a0d18;
}

.studio-notice {
  position: fixed;
  z-index: 20;
  right: 28px;
  bottom: 26px;
  margin: 0;
  padding: 12px 16px;
  border: 1px solid rgba(82, 224, 208, .32);
  border-radius: 13px;
  color: #dffdfa;
  background: rgba(12, 35, 39, .94);
  box-shadow: 0 16px 50px rgba(0, 0, 0, .36);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 1260px) {
  .studio-layout {
    grid-template-columns: 116px minmax(460px, 1fr) 340px;
  }

  .section-nav button {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    font-size: 11px;
  }
}

@media (max-width: 980px) {
  .studio-page {
    padding: 20px;
  }

  .studio-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .studio-layout {
    grid-template-columns: 1fr;
  }

  .section-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }

  .section-nav button {
    flex: 0 0 100px;
  }

  .control-panel {
    position: static;
    min-height: auto;
  }

  .control-section {
    max-height: none;
  }
}

@media (max-width: 620px) {
  .studio-page {
    padding: 14px;
  }

  .preview-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .color-grid,
  .color-grid--three {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
