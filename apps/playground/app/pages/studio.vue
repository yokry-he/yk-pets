<!--
  文件职责 / File responsibility
  提供卡片式部件选择、聚焦预览、精确数值、扩展范围、全部位颜色、事务撤销和明确保存语义的宠物工坊。
  Provides Pet Studio with visual part cards, focused preview, precise values, expanded ranges, all-part colors, transactional history, and clear save semantics.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioBellyPatchEditor from '~/components/studio/StudioBellyPatchEditor.vue'
import StudioEarEditor from '~/components/studio/StudioEarEditor.vue'
import StudioMotionToolbar from '~/components/studio/StudioMotionToolbar.vue'
import StudioPartColorEditor from '~/components/studio/StudioPartColorEditor.vue'
import StudioSymbolEditor from '~/components/studio/StudioSymbolEditor.vue'
import StudioTailEditor from '~/components/studio/StudioTailEditor.vue'
import { derivePetMonogram } from '~/domain/cloud-fox-appearance'
import { CLOUD_FOX_BODY_SHAPES, PET_STUDIO_PART_OPTIONS as PARTS } from '~/domain/pet-studio-phase2'
import { getExtensionCloudFoxMotionDurationMs, type ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import {
  PET_CUSTOMIZATION_RANGES,
  normalizeCustomizableAppearance,
} from '~/domain/pet-part-customization'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase3'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'colors' | 'tail' | 'glow' | 'symbols' | 'audit'
type ProportionKey = keyof typeof PET_CUSTOMIZATION_RANGES.proportions
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const ranges = PET_CUSTOMIZATION_RANGES
const defaults = normalizeCustomizableAppearance(createExtensionClassicAppearance())
const tab = ref<Tab>('body')
const behavior = ref<ExtensionCloudFoxMotionId>('idle')
const motionKey = ref(0)
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const notice = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const tabs: Array<{ id: Tab; label: string; icon: string; hint: string }> = [
  { id: 'identity', label: '身份', icon: 'ID', hint: '名字与方案信息' },
  { id: 'face', label: '头部', icon: '◉', hint: '耳眼鼻嘴' },
  { id: 'body', label: '身体', icon: '⬭', hint: '轮廓、肚皮、比例' },
  { id: 'colors', label: '颜色', icon: '◐', hint: '全部材质通道' },
  { id: 'tail', label: '尾巴触角', icon: '⌁', hint: '分段与连接' },
  { id: 'glow', label: '发光轨道', icon: '✦', hint: '光效与粒子' },
  { id: 'symbols', label: '标志', icon: 'Z', hint: '胸口与后背' },
  { id: 'audit', label: '检查', icon: '✓', hint: '穿模与边界' },
]
const views: Array<[CloudFoxStudioView, string]> = [['front', '正面'], ['left', '左侧'], ['back', '背面'], ['right', '右侧']]
const backgrounds: Array<[CloudFoxStudioBackground, string]> = [['dark', '深色'], ['light', '浅色'], ['web', '网页']]
const bodyControls: Array<[ProportionKey, string]> = [
  ['bodyWidth', '身体宽度'], ['bodyHeight', '身体高度'], ['bodyDepth', '身体厚度'],
  ['limbLength', '四肢长度'], ['limbThickness', '四肢粗细'], ['limbSpacing', '四肢间距'], ['pawScale', '爪子大小'],
]
const faceControls: Array<[ProportionKey, string]> = [
  ['headScale', '头部大小'], ['earScale', '耳朵大小'], ['eyeScale', '眼睛大小'], ['eyeSpacing', '眼睛间距'],
]
const focusLabel = computed(() => ({
  identity: '全身',
  face: '头部 · 鼻嘴差异会在正面清晰显示',
  body: '身体 · 肚皮与比例',
  colors: '全身材质',
  tail: '尾巴与触角',
  glow: '发光与轨道',
  symbols: '胸口与后背标志',
  audit: '四视角检查',
})[tab.value])

watch(tab, (next) => {
  if (next === 'face' || next === 'body' || next === 'colors') view.value = 'front'
  if (next === 'tail') view.value = 'left'
  if (next === 'symbols') view.value = 'back'
})

function show(message: string) {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}
function setPart(key: 'eyes' | 'nose' | 'mouth' | 'bodyShape', value: string) {
  store.checkpoint()
  store.patchParts({ [key]: value } as Partial<typeof recipe.value.parts>)
}
function setProportion(key: ProportionKey, value: number) {
  recipe.value.proportions[key] = value
  store.markDirty()
}
function resetProportion(key: ProportionKey) {
  store.checkpoint()
  recipe.value.proportions[key] = defaults.proportions[key]
  store.markDirty()
}
function play(next: ExtensionCloudFoxMotionId) {
  if (timer) clearTimeout(timer)
  behavior.value = next
  motionKey.value += 1
  const duration = getExtensionCloudFoxMotionDurationMs(next)
  if (duration > 0) timer = setTimeout(() => { behavior.value = 'idle'; motionKey.value += 1 }, duration)
}
function syncName() {
  store.checkpoint()
  const monogram = derivePetMonogram(recipe.value.identity.nameEn)
  recipe.value.identity.monogram = monogram
  recipe.value.symbols.chest.text = monogram
  store.markDirty()
}
function save() {
  store.save()
  show('已保存正式外观，可继续同步到 Chrome 扩展')
}
function reset() {
  if (!confirm('恢复扩展经典默认外观？当前草稿会进入撤销历史。')) return
  store.reset()
  show('已恢复扩展经典外观')
}
function exportRecipe() {
  const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${recipe.value.identity.petId}-appearance-v3.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
async function importRecipe(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    store.replace(JSON.parse(await file.text()))
    show('JSON 配方已导入，旧肚皮和颜色字段已自动迁移')
  }
  catch {
    show('JSON 配方无效')
  }
}
function refreshColors() {
  store.checkpoint()
  store.refreshDerivedColors()
  recipe.value.orbitDesign.primaryColor = recipe.value.palette.primaryGlow
  recipe.value.orbitDesign.secondaryColor = recipe.value.palette.secondaryGlow
  show('已重新生成高光、暗部与轨道色')
}

onMounted(() => store.hydrate())
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  if (noticeTimer) clearTimeout(noticeTimer)
  store.endTransaction()
})
</script>

<template>
  <main class="studio-page">
    <header class="topbar">
      <div class="title">
        <NuxtLink to="/">← YK-PETS</NuxtLink>
        <span>PET STUDIO</span>
        <h1>创建属于你的云灵</h1>
        <p>选择部件、调整形状和颜色；草稿自动保存在本机，正式保存后用于扩展同步。</p>
      </div>
      <div class="actions">
        <button :disabled="!store.canUndo" @click="store.undo">撤销</button>
        <button :disabled="!store.canRedo" @click="store.redo">重做</button>
        <button @click="store.randomize(); show('已随机生成')">随机</button>
        <button @click="reset">恢复默认</button>
        <button @click="fileInput?.click()">导入</button>
        <button @click="exportRecipe">导出</button>
        <button class="primary" @click="save">保存并用于同步</button>
        <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe">
      </div>
    </header>

    <section class="studio-layout">
      <nav class="part-nav" aria-label="宠物部位">
        <button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="tab = item.id">
          <i>{{ item.icon }}</i><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
          <b v-if="item.id === 'audit' && store.findings.some(finding => finding.severity === 'warning')">!</b>
        </button>
      </nav>

      <section class="preview-panel" :data-focus="tab">
        <div class="preview-toolbar">
          <div><span>视角</span><button v-for="[id, label] in views" :key="id" :class="{ active: view === id }" @click="view = id">{{ label }}</button></div>
          <div><span>背景</span><button v-for="[id, label] in backgrounds" :key="id" :class="{ active: background === id }" @click="background = id">{{ label }}</button></div>
        </div>
        <div class="focus-pill"><span>聚焦</span>{{ focusLabel }}</div>
        <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :motion-key="motionKey" :view="view" :background="background" /><template #fallback><div class="loading">正在装配 Cloud Fox…</div></template></ClientOnly>
        <StudioMotionToolbar :behavior="behavior" @play="play" />
      </section>

      <aside class="inspector">
        <header><div><strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong><small>{{ store.draftSavedAt ? '本地草稿已自动保存' : '正在编辑本地草稿' }}</small></div><b :class="{ warn: store.dirty }">{{ store.dirty ? '尚未正式保存' : '正式外观已保存' }}</b></header>
        <div class="controls">
          <template v-if="tab === 'identity'">
            <section class="section-heading"><small>IDENTITY</small><h2>身份信息</h2><p>旧配方会自动迁移为显式椭圆肚皮和全部位颜色结构。</p></section>
            <label>中文名字<input v-model="recipe.identity.nameZh" @focus="store.checkpoint" @input="store.markDirty"></label>
            <label>英文名字<input v-model="recipe.identity.nameEn" @focus="store.checkpoint" @input="store.markDirty" @blur="syncName"></label>
            <label>宠物 ID<input v-model="recipe.identity.petId" @focus="store.checkpoint" @input="store.markDirty"></label>
          </template>

          <template v-else-if="tab === 'face'">
            <section class="section-heading"><small>FACE PARTS</small><h2>头部和表情</h2><p>鼻子和嘴巴现在使用不同几何，不再只是无效下拉选项。</p></section>
            <StudioEarEditor />
            <section class="option-section"><h3>眼睛</h3><div class="option-grid"><button v-for="item in PARTS.eyes" :key="item.id" :class="{ active: recipe.parts.eyes === item.id }" @click="setPart('eyes', item.id)"><i>◉</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>鼻子</h3><div class="option-grid"><button v-for="item in PARTS.noses" :key="item.id" :class="{ active: recipe.parts.nose === item.id }" @click="setPart('nose', item.id)"><i>{{ item.id === 'triangle' ? '▲' : item.id === 'sensor' ? '▰' : item.id === 'heart' ? '♥' : '●' }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>嘴巴</h3><div class="option-grid"><button v-for="item in PARTS.mouths" :key="item.id" :class="{ active: recipe.parts.mouth === item.id }" @click="setPart('mouth', item.id)"><i>{{ item.id === 'open' ? 'O' : item.id === 'pout' ? '○' : item.id === 'cat' ? 'ω' : item.id === 'line' ? '—' : '⌣' }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <label v-for="[key, label] in faceControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <template v-else-if="tab === 'body'">
            <section class="section-heading"><small>BODY</small><h2>身体与肚皮</h2><p>扩展范围以推荐区为中心，超出后由检查页提示风险而不是直接禁止。</p></section>
            <section class="option-section"><h3>身体形状</h3><div class="option-grid"><button v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :class="{ active: recipe.parts.bodyShape === item.id }" @click="setPart('bodyShape', item.id)"><i>⬭</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <StudioBellyPatchEditor />
            <label v-for="[key, label] in bodyControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <StudioPartColorEditor v-else-if="tab === 'colors'" />
          <StudioTailEditor v-else-if="tab === 'tail'" />

          <template v-else-if="tab === 'glow'">
            <section class="section-heading"><small>GLOW</small><h2>发光与身体轨道</h2><p>高能动作不会自动降低视觉质量。</p></section>
            <label>发光模式<select v-model="recipe.glow.mode" @focus="store.checkpoint" @change="store.markDirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label>
            <label class="range-control"><span><strong>发光强度</strong></span><div><input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.glow.intensity" type="number" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @focus="store.checkpoint" @change="store.markDirty"></div></label>
            <section class="sub-card"><h3>身体周围轨道</h3><label class="check"><input v-model="recipe.orbitDesign.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">显示轨道</label><label>轨道数量<select v-model.number="recipe.orbitDesign.ringCount" @focus="store.checkpoint" @change="store.markDirty"><option :value="1">1 条</option><option :value="2">2 条</option><option :value="3">3 条</option></select></label><label v-for="[key, label, step] in [['radius', '半径', .01], ['verticalScale', '纵向比例', .01], ['tilt', '倾斜', .02], ['speed', '速度', .01], ['intensity', '亮度', .05], ['particleCount', '粒子数', 1]] as const" :key="key" class="range-control"><span><strong>{{ label }}</strong></span><div><input v-model.number="recipe.orbitDesign[key]" type="range" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.orbitDesign[key]" type="number" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @focus="store.checkpoint" @change="store.markDirty"></div></label><button @click="refreshColors">根据主色生成光影色</button></section>
          </template>

          <StudioSymbolEditor v-else-if="tab === 'symbols'" />
          <template v-else><section class="section-heading"><small>GEOMETRY AUDIT</small><h2>外观检查</h2><p>扩大参数范围后，自动边界和穿模检查用于提示风险，而不是静默截断创作。</p></section><article v-for="finding in store.findings" :key="finding.id" class="finding" :data-severity="finding.severity"><strong>{{ finding.severity === 'warning' ? '需要检查' : finding.severity === 'error' ? '错误' : '提示' }}</strong><p>{{ finding.message }}</p><code v-if="finding.path">{{ finding.path }}</code></article></template>
        </div>
      </aside>
    </section>
    <p v-if="notice" class="toast" role="status">{{ notice }}</p>
  </main>
</template>

<style scoped>
.studio-page{min-height:100vh;padding:18px;color:#eef1ff;background:radial-gradient(circle at 20% 0,#27224d55,transparent 34%),radial-gradient(circle at 90% 20%,#174c4650,transparent 30%),#080b14}.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;max-width:1540px;margin:0 auto 14px;padding:16px 18px;border:1px solid #ffffff18;border-radius:20px;background:#0d1120e8;box-shadow:0 18px 55px #0005}.title a{color:#76dfd1;text-decoration:none;font-size:12px}.title>span{display:block;margin-top:12px;color:#777f9f;font:800 9px/1 ui-monospace,monospace;letter-spacing:.18em}.title h1{margin:6px 0 4px;font-size:26px}.title p{margin:0;color:#9098b7;font-size:12px}.actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:620px}.actions button,.sub-card button{min-height:36px;padding:0 11px;border:1px solid #ffffff1e;border-radius:10px;color:#dfe5ff;background:#ffffff08;cursor:pointer}.actions button.primary{border-color:#52e0d066;background:linear-gradient(135deg,#7066ff,#43cbbd);font-weight:800}.actions button:disabled{opacity:.38;cursor:not-allowed}.studio-layout{display:grid;grid-template-columns:172px minmax(420px,1fr) minmax(340px,430px);gap:14px;max-width:1540px;margin:auto}.part-nav,.preview-panel,.inspector{min-height:calc(100vh - 150px);border:1px solid #ffffff16;border-radius:20px;background:#0c101de8;box-shadow:0 18px 48px #0004}.part-nav{display:flex;flex-direction:column;gap:6px;padding:10px}.part-nav button{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px;min-height:56px;padding:7px;border:1px solid transparent;border-radius:12px;color:#aeb6d0;text-align:left;background:transparent;cursor:pointer}.part-nav button.active{border-color:#7066ff66;color:#fff;background:linear-gradient(135deg,#7066ff22,#52e0d012)}.part-nav i{display:grid;width:31px;height:31px;place-items:center;border-radius:9px;background:#ffffff0a;font-style:normal;font-weight:800}.part-nav span{display:grid;gap:2px}.part-nav strong{font-size:12px}.part-nav small{color:#717a9d;font-size:9px}.part-nav b{position:absolute;right:7px;top:7px;color:#ff9ab0}.preview-panel{position:sticky;top:14px;display:grid;grid-template-rows:auto auto minmax(360px,1fr) auto;align-self:start;overflow:hidden;background:radial-gradient(circle at 50% 52%,#28225466,transparent 42%),#080c17}.preview-toolbar{position:relative;z-index:2;display:flex;justify-content:space-between;gap:10px;padding:10px;border-bottom:1px solid #ffffff12;background:#090d18cc;backdrop-filter:blur(16px)}.preview-toolbar>div{display:flex;align-items:center;gap:5px}.preview-toolbar span,.focus-pill span{color:#687191;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}.preview-toolbar button{min-height:29px;padding:0 8px;border:1px solid #ffffff15;border-radius:8px;color:#929bb9;background:#ffffff06;cursor:pointer}.preview-toolbar button.active{border-color:#52e0d066;color:#eafffb;background:#52e0d014}.focus-pill{position:relative;z-index:2;justify-self:center;margin:10px;padding:7px 11px;border:1px solid #7066ff44;border-radius:999px;color:#bbc4e6;background:#7066ff12;font-size:10px}.focus-pill span{margin-right:7px}.loading{display:grid;min-height:400px;place-items:center;color:#8891b0}.inspector{overflow:hidden}.inspector>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid #ffffff12;background:#0e1323}.inspector>header div{display:grid;gap:3px}.inspector>header small{color:#7d86a6;font-size:9px}.inspector>header b{padding:6px 8px;border-radius:8px;color:#74dfd1;background:#52e0d012;font-size:9px}.inspector>header b.warn{color:#ffd28b;background:#ffb55f12}.controls{display:flex;max-height:calc(100vh - 220px);flex-direction:column;gap:12px;overflow:auto;padding:14px}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:5px 0 3px;font-size:18px}.section-heading p{margin:0;color:#8c95b4;font-size:11px;line-height:1.5}.controls>label,.sub-card>label{display:grid;gap:5px;color:#b9c1dc;font-size:12px}.controls input:not([type=range]):not([type=color]),.controls select{min-height:38px;border:1px solid #ffffff20;border-radius:10px;padding:0 10px;color:#fff;background:#090e1b}.option-section,.sub-card{display:grid;gap:9px;padding:12px;border:1px solid #ffffff14;border-radius:14px;background:#ffffff05}.option-section h3,.sub-card h3{margin:0;font-size:13px}.option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.option-grid button{display:grid;grid-template-columns:32px minmax(0,1fr);grid-template-rows:auto auto;gap:1px 7px;min-height:52px;padding:7px;border:1px solid #ffffff15;border-radius:10px;color:#c9d0e8;text-align:left;background:#080d18;cursor:pointer}.option-grid button.active{border-color:#52e0d077;background:#52e0d014}.option-grid i{grid-row:1/3;display:grid;width:30px;height:30px;place-items:center;align-self:center;border-radius:9px;color:#fff;background:#7066ff24;font-style:normal;font-size:17px}.option-grid strong{font-size:10px}.option-grid small{color:#717a9d;font-size:8px}.range-control{display:grid;gap:5px}.range-control>span{display:flex;align-items:center;justify-content:space-between}.range-control>span button{padding:3px 6px;border:1px solid #ffffff18;border-radius:7px;color:#98a2c2;background:#ffffff07;font-size:9px;cursor:pointer}.range-control>div{display:grid;grid-template-columns:minmax(0,1fr) 68px;gap:8px}.range-control input[type=range]{width:100%;accent-color:#7066ff}.range-control input[type=number]{min-width:0;font-variant-numeric:tabular-nums}.check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center}.check input{width:17px;height:17px;accent-color:#52e0d0}.finding{padding:11px;border:1px solid #ffffff14;border-radius:12px;background:#ffffff05}.finding[data-severity=warning]{border-color:#ffbd6a44;background:#ffbd6a09}.finding p{margin:5px 0;color:#aab2cf;font-size:11px;line-height:1.5}.finding code{color:#78ded1;font-size:9px}.toast{position:fixed;right:22px;bottom:22px;z-index:20;margin:0;padding:11px 14px;border:1px solid #52e0d055;border-radius:12px;color:#eafffb;background:#10192bea;box-shadow:0 18px 50px #0008}@media(max-width:1120px){.studio-layout{grid-template-columns:136px minmax(380px,1fr) 340px}.part-nav small{display:none}}@media(max-width:880px){.topbar{flex-direction:column}.actions{justify-content:flex-start}.studio-layout{grid-template-columns:1fr}.part-nav{min-height:0;flex-direction:row;overflow:auto}.part-nav button{min-width:110px}.preview-panel{position:relative;top:0;min-height:620px}.inspector{min-height:0}.controls{max-height:none}}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
