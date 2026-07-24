<!--
  文件职责 / File responsibility
  提供完整可伸缩 Studio 工作台：独立身体/头型、稳定预览、分区检查器、精确参数、本地方案与明确保存流程。
  Provides a complete scalable Studio workspace with independent body/head shapes, stable preview, sectioned inspector, precise parameters, local schemes, and explicit saving.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioBellyPatchEditor from '~/components/studio/StudioBellyPatchEditor.vue'
import StudioEarEditor from '~/components/studio/StudioEarEditor.vue'
import StudioMotionToolbar from '~/components/studio/StudioMotionToolbar.vue'
import StudioPartColorEditor from '~/components/studio/StudioPartColorEditor.vue'
import StudioSymbolEditor from '~/components/studio/StudioSymbolEditor.vue'
import StudioTailEditor from '~/components/studio/StudioTailEditor.vue'
import { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_HEAD_SHAPES, derivePetMonogram } from '~/domain/cloud-fox-appearance'
import { PET_STUDIO_PART_OPTIONS as PARTS } from '~/domain/pet-studio-phase2'
import { getExtensionCloudFoxMotionDurationMs, type ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { PET_CUSTOMIZATION_RANGES, normalizeCustomizableAppearance } from '~/domain/pet-part-customization'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase3'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'colors' | 'tail' | 'glow' | 'symbols' | 'audit'
type ProportionKey = keyof typeof PET_CUSTOMIZATION_RANGES.proportions
type PartKey = 'headShape' | 'eyes' | 'nose' | 'mouth' | 'bodyShape'
interface SearchEntry { label: string; tab: Tab; keywords: string }

useHead({ bodyAttrs: { class: 'yk-pets-studio-page' } })
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const ranges = PET_CUSTOMIZATION_RANGES
const defaults = normalizeCustomizableAppearance(createExtensionClassicAppearance())
const tab = ref<Tab>('face')
const behavior = ref<ExtensionCloudFoxMotionId>('idle')
const motionKey = ref(0)
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const searchFocused = ref(false)
const compareSnapshot = ref('')
const schemeName = ref('')
const advancedOpen = ref(false)
const showHotspots = ref(false)
const notice = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let searchBlurTimer: ReturnType<typeof setTimeout> | undefined

const tabs: Array<{ id: Tab; label: string; icon: string; hint: string }> = [
  { id: 'identity', label: '身份', icon: 'ID', hint: '名字与方案' },
  { id: 'face', label: '头部', icon: '◉', hint: '头型、耳眼鼻嘴' },
  { id: 'body', label: '身体', icon: '⬭', hint: '身体、肚皮、四肢' },
  { id: 'colors', label: '颜色', icon: '◐', hint: '全部材质通道' },
  { id: 'tail', label: '尾巴触角', icon: '⌁', hint: '分段与连接' },
  { id: 'glow', label: '发光轨道', icon: '✦', hint: '光效与粒子' },
  { id: 'symbols', label: '标志', icon: 'Z', hint: '胸口与后背' },
  { id: 'audit', label: '检查', icon: '✓', hint: '边界与穿模' },
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
const searchEntries: readonly SearchEntry[] = [
  { label: '独立头型', tab: 'face', keywords: '头型 head shape 圆头 宽圆 椭圆 胶囊 豆形 方头' },
  { label: '鼻子与嘴巴', tab: 'face', keywords: '鼻子 nose 嘴巴 mouth 三角 感应器 纽扣 爱心 经典 猫系 线条 张嘴 嘟嘴' },
  { label: '眼睛与耳朵', tab: 'face', keywords: '眼睛 eyes 星芒 水晶 菱形 耳朵 ears 高光 内耳 耳尖' },
  { label: '身体形状', tab: 'body', keywords: '身体 body 球体 椭圆 胶囊 梨形 豆形 方糖' },
  { label: '肚皮形状与位置', tab: 'body', keywords: '肚皮 belly 椭圆 蛋形 盾牌 水滴 豆形 爱心 云朵 胸毛' },
  { label: '所有部位颜色', tab: 'colors', keywords: '颜色 color palette 全部位 材质' },
  { label: '尾巴与触角', tab: 'tail', keywords: '尾巴 tail 触角 antenna 分段 尾尖' },
  { label: '发光与轨道', tab: 'glow', keywords: '发光 glow 轨道 orbit 粒子' },
  { label: '标志', tab: 'symbols', keywords: '标志 symbol 胸口 后背 字母' },
  { label: '外观检查', tab: 'audit', keywords: '检查 audit 穿模 边界 风险' },
]

const compareActive = computed(() => Boolean(compareSnapshot.value))
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return query ? searchEntries.filter(entry => `${entry.label} ${entry.keywords}`.toLowerCase().includes(query)).slice(0, 8) : []
})
const showSearchResults = computed(() => searchFocused.value && Boolean(searchQuery.value.trim()))
const previewFocus = computed<'full' | 'head' | 'body' | 'tail'>(() => tab.value === 'face' ? 'head' : tab.value === 'body' ? 'body' : tab.value === 'tail' ? 'tail' : 'full')
const focusLabel = computed(() => ({
  identity: '全身与身份', face: '独立头型与表情', body: '身体、肚皮与四肢', colors: '全部材质',
  tail: '尾巴与触角', glow: '发光与轨道', symbols: '胸背标志', audit: '四视角检查',
})[tab.value])
const changedGroupLabels = computed(() => changedGroups(compareActive.value ? JSON.parse(compareSnapshot.value) : recipe.value))
const historyLabel = computed(() => `${store.draftSavedAt ? new Date(store.draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '尚无草稿'} · 撤销 ${store.undoStack.length} / 重做 ${store.redoStack.length}`)

watch(tab, next => {
  if (next === 'face' || next === 'body' || next === 'colors') view.value = 'front'
  if (next === 'tail') view.value = 'left'
  if (next === 'symbols') view.value = 'back'
  showHotspots.value = false
})

function show(message: string) {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}
function setPart(key: PartKey, value: string) {
  if (compareActive.value) return
  store.checkpoint()
  store.patchParts({ [key]: value } as Partial<typeof recipe.value.parts>)
}
function setProportion(key: ProportionKey, value: number) {
  if (compareActive.value) return
  recipe.value.proportions[key] = value
  store.markDirty()
}
function resetProportion(key: ProportionKey) {
  if (compareActive.value) return
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
  if (compareActive.value) return
  store.checkpoint()
  const monogram = derivePetMonogram(recipe.value.identity.nameEn)
  recipe.value.identity.monogram = monogram
  recipe.value.symbols.chest.text = monogram
  store.markDirty()
}
function save() {
  if (compareActive.value) return
  store.save()
  show('正式外观已保存，可继续同步到 Chrome 扩展')
}
function reset() {
  if (compareActive.value || !confirm('恢复经典默认外观？当前草稿会进入撤销历史。')) return
  store.reset()
  show('已恢复经典默认外观')
}
function exportRecipe() {
  const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${recipe.value.identity.petId}-appearance-v4.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
async function importRecipe(event: Event) {
  if (compareActive.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try { store.replace(JSON.parse(await file.text())); show('配方已导入并完成兼容迁移') }
  catch { show('JSON 配方无效') }
}
function refreshColors() {
  if (compareActive.value) return
  store.checkpoint()
  store.refreshDerivedColors()
  recipe.value.orbitDesign.primaryColor = recipe.value.palette.primaryGlow
  recipe.value.orbitDesign.secondaryColor = recipe.value.palette.secondaryGlow
  show('已重新生成光影与轨道色')
}
function selectSearchResult(entry: SearchEntry) { tab.value = entry.tab; searchQuery.value = ''; searchFocused.value = false }
function onSearchBlur() { if (searchBlurTimer) clearTimeout(searchBlurTimer); searchBlurTimer = setTimeout(() => { searchFocused.value = false }, 100) }
function toggleComparison() {
  if (compareActive.value) return restoreComparison()
  compareSnapshot.value = JSON.stringify(recipe.value)
  store.recipe = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  show('正在只读预览经典外观')
}
function restoreComparison() {
  if (!compareSnapshot.value) return
  store.recipe = normalizeCustomizableAppearance(JSON.parse(compareSnapshot.value))
  compareSnapshot.value = ''
}
function saveScheme() {
  const name = schemeName.value.trim()
  if (!name) return show('请输入本地方案名称')
  restoreComparison(); store.saveCustomScheme(name); schemeName.value = ''; show('外观已保存到本地方案库')
}
function applyScheme(id: string) { restoreComparison(); store.applyCustomScheme(id); show('已应用本地方案') }
function removeScheme(id: string) { store.deleteCustomScheme(id); show('本地方案已删除') }
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const editing = target?.matches('input,textarea,select,[contenteditable=true]')
  if (event.key === '/' && !editing) { event.preventDefault(); searchInput.value?.focus() }
  if (event.key === 'Escape') { searchQuery.value = ''; searchFocused.value = false; showHotspots.value = false; restoreComparison() }
}
function eyeIcon(id: string) { return id === 'spark' ? '✦' : id === 'diamond' ? '◆' : id === 'visor' ? '▰' : id === 'sleepy' ? '⌒' : id === 'oval' ? '⬭' : '●' }
function noseIcon(id: string) { return id === 'triangle' ? '▲' : id === 'sensor' ? '▰' : id === 'heart' ? '♥' : '●' }
function mouthIcon(id: string) { return id === 'open' ? 'O' : id === 'pout' ? '○' : id === 'cat' ? 'ω' : id === 'line' ? '—' : 'ᴗ' }
function shapeIcon(id: string) { return id.includes('cube') ? '▣' : id === 'capsule' ? '▯' : id === 'pear' ? '♟' : id === 'bean' ? '◒' : id.includes('oval') || id === 'ellipsoid' ? '⬭' : '●' }
function changedGroups(input: unknown) {
  const current = normalizeCustomizableAppearance(input)
  const classic = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  const groups: Array<[string, boolean]> = [
    ['头部', current.parts.headShape !== classic.parts.headShape || current.parts.eyes !== classic.parts.eyes || current.parts.nose !== classic.parts.nose || current.parts.mouth !== classic.parts.mouth || current.proportions.headScale !== classic.proportions.headScale],
    ['身体', current.parts.bodyShape !== classic.parts.bodyShape || current.proportions.bodyWidth !== classic.proportions.bodyWidth || current.proportions.bodyHeight !== classic.proportions.bodyHeight],
    ['颜色', JSON.stringify(current.customization.colors) !== JSON.stringify(classic.customization.colors)],
    ['肚皮', JSON.stringify(current.customization.belly) !== JSON.stringify(classic.customization.belly)],
    ['尾巴触角', JSON.stringify(current.tailDesign) !== JSON.stringify(classic.tailDesign) || JSON.stringify(current.antennaDesign) !== JSON.stringify(classic.antennaDesign)],
    ['发光轨道', JSON.stringify(current.glow) !== JSON.stringify(classic.glow) || JSON.stringify(current.orbitDesign) !== JSON.stringify(classic.orbitDesign)],
    ['标志', JSON.stringify(current.symbols) !== JSON.stringify(classic.symbols)],
  ]
  return groups.filter(([, changed]) => changed).map(([label]) => label)
}

onMounted(() => { store.hydrate(); window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => {
  restoreComparison()
  if (timer) clearTimeout(timer)
  if (noticeTimer) clearTimeout(noticeTimer)
  if (searchBlurTimer) clearTimeout(searchBlurTimer)
  store.endTransaction()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="studio-page" :data-compare="compareActive">
    <header class="studio-header">
      <div class="brand-block">
        <NuxtLink to="/">← YK-PETS</NuxtLink><span>PET STUDIO</span><h1>创建属于你的云灵</h1>
        <p>身体与头型独立配置；草稿仅保存在本机，正式保存后用于扩展同步。</p>
      </div>
      <div class="studio-search">
        <label><span>⌕</span><input ref="searchInput" v-model="searchQuery" type="search" placeholder="搜索部位或参数" aria-label="搜索 Studio 部位和参数" @focus="searchFocused = true" @blur="onSearchBlur"><kbd>/</kbd></label>
        <div v-if="showSearchResults" class="search-results">
          <button v-for="entry in searchResults" :key="entry.label" type="button" @mousedown.prevent="selectSearchResult(entry)"><strong>{{ entry.label }}</strong><small>{{ tabs.find(item => item.id === entry.tab)?.label }}</small></button>
          <p v-if="!searchResults.length">没有匹配项</p>
        </div>
      </div>
      <div class="save-block"><b :class="{ dirty: store.dirty }">{{ store.dirty ? '草稿未正式保存' : '正式外观已保存' }}</b><button class="primary" :disabled="compareActive" @click="save">保存并用于同步</button></div>
      <div class="header-actions">
        <div><button :disabled="compareActive || !store.canUndo" @click="store.undo">撤销</button><button :disabled="compareActive || !store.canRedo" @click="store.redo">重做</button></div>
        <div><button :disabled="compareActive" @click="store.randomize(); show('已随机生成')">随机</button><button :disabled="compareActive" @click="reset">恢复默认</button></div>
        <div><button :disabled="compareActive" @click="fileInput?.click()">导入</button><button @click="exportRecipe">导出</button></div>
        <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe">
      </div>
    </header>

    <section class="studio-workspace">
      <nav class="part-nav" aria-label="宠物部位">
        <button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="tab = item.id">
          <i>{{ item.icon }}</i><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span><b v-if="item.id === 'audit' && store.findings.some(f => f.severity === 'warning')">!</b>
        </button>
      </nav>

      <section class="preview-panel">
        <div class="preview-toolbar">
          <div class="toolbar-row"><span>视角</span><button v-for="[id,label] in views" :key="id" :class="{ active: view === id }" @click="view = id">{{ label }}</button></div>
          <div class="toolbar-row"><span>背景</span><button v-for="[id,label] in backgrounds" :key="id" :class="{ active: background === id }" @click="background = id">{{ label }}</button></div>
          <div class="toolbar-actions"><button :aria-pressed="showHotspots" @click="showHotspots = !showHotspots">部位定位</button><button class="compare" :aria-pressed="compareActive" @click="toggleComparison">{{ compareActive ? '返回当前' : '对比经典' }}</button></div>
        </div>
        <div class="stage-status"><span>{{ focusLabel }}</span><small>{{ compareActive ? `${changedGroupLabels.length} 组不同 · 只读经典预览` : `${recipe.parts.headShape} / ${recipe.parts.bodyShape}` }}</small></div>
        <div class="canvas-shell">
          <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :motion-key="motionKey" :view="view" :background="background" :focus="previewFocus" /><template #fallback><div class="loading">正在装配 Cloud Fox…</div></template></ClientOnly>
          <div v-if="showHotspots" class="part-hotspots" aria-label="选择宠物部位"><button class="face" @click="tab='face';showHotspots=false">头部</button><button class="body" @click="tab='body';showHotspots=false">身体</button><button class="tail" @click="tab='tail';showHotspots=false">尾巴</button><button class="symbol" @click="tab='symbols';showHotspots=false">标志</button></div>
        </div>
        <StudioMotionToolbar :behavior="behavior" @play="play" />
      </section>

      <aside class="inspector">
        <header><div><strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong><small>{{ store.draftSavedAt ? '本地草稿已自动保存' : '正在编辑本地草稿' }}</small></div><b>{{ tabs.find(item => item.id === tab)?.label }}</b></header>
        <div class="controls" :class="{ readonly: compareActive }" :aria-disabled="compareActive">
          <template v-if="tab === 'identity'">
            <section class="section-heading"><small>IDENTITY</small><h2>身份信息</h2><p>身份、方案名称与导出文件标识。</p></section>
            <label>中文名字<input v-model="recipe.identity.nameZh" @focus="store.checkpoint" @input="store.markDirty"></label>
            <label>英文名字<input v-model="recipe.identity.nameEn" @focus="store.checkpoint" @input="store.markDirty" @blur="syncName"></label>
            <label>宠物 ID<input v-model="recipe.identity.petId" @focus="store.checkpoint" @input="store.markDirty"></label>
          </template>

          <template v-else-if="tab === 'face'">
            <section class="section-heading"><small>HEAD & FACE</small><h2>头部和表情</h2><p>头型独立于身体；正面看轮廓，左右侧看鼻嘴贴合。</p></section>
            <section class="option-section"><h3>头部形状</h3><p>切换身体不会修改这里的选择。</p><div class="option-grid"><button v-for="item in CLOUD_FOX_HEAD_SHAPES" :key="item.id" :class="{ active: recipe.parts.headShape === item.id }" @click="setPart('headShape', item.id)"><i>{{ shapeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button></div></section>
            <StudioEarEditor />
            <section class="option-section"><h3>眼睛</h3><div class="option-grid"><button v-for="item in PARTS.eyes" :key="item.id" :class="{ active: recipe.parts.eyes === item.id }" @click="setPart('eyes', item.id)"><i>{{ eyeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>鼻子</h3><div class="option-grid"><button v-for="item in PARTS.noses" :key="item.id" :class="{ active: recipe.parts.nose === item.id }" @click="setPart('nose', item.id)"><i>{{ noseIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>嘴巴</h3><div class="option-grid"><button v-for="item in PARTS.mouths" :key="item.id" :class="{ active: recipe.parts.mouth === item.id }" @click="setPart('mouth', item.id)"><i>{{ mouthIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <label v-for="[key,label] in faceControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <template v-else-if="tab === 'body'">
            <section class="section-heading"><small>BODY</small><h2>身体与肚皮</h2><p>身体只改变躯干轮廓，不再联动头型。</p></section>
            <section class="option-section"><h3>身体形状</h3><div class="option-grid"><button v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :class="{ active: recipe.parts.bodyShape === item.id }" @click="setPart('bodyShape', item.id)"><i>{{ shapeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button></div></section>
            <StudioBellyPatchEditor />
            <label v-for="[key,label] in bodyControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <StudioPartColorEditor v-else-if="tab === 'colors'" />
          <StudioTailEditor v-else-if="tab === 'tail'" />
          <template v-else-if="tab === 'glow'">
            <section class="section-heading"><small>GLOW</small><h2>发光与轨道</h2><p>所有效果继续使用正式渲染质量。</p></section>
            <label>发光模式<select v-model="recipe.glow.mode" @focus="store.checkpoint" @change="store.markDirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label>
            <label class="range-control"><span><strong>发光强度</strong></span><div><input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.glow.intensity" type="number" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @focus="store.checkpoint" @change="store.markDirty"></div></label>
            <section class="sub-card"><h3>身体周围轨道</h3><label class="check"><input v-model="recipe.orbitDesign.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">显示轨道</label><label>轨道数量<select v-model.number="recipe.orbitDesign.ringCount" @focus="store.checkpoint" @change="store.markDirty"><option :value="1">1 条</option><option :value="2">2 条</option><option :value="3">3 条</option></select></label><label v-for="[key,label,step] in [['radius','半径',.01],['verticalScale','纵向比例',.01],['tilt','倾斜',.02],['speed','速度',.01],['intensity','亮度',.05],['particleCount','粒子数',1]] as const" :key="key" class="range-control"><span><strong>{{ label }}</strong></span><div><input v-model.number="recipe.orbitDesign[key]" type="range" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.orbitDesign[key]" type="number" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @focus="store.checkpoint" @change="store.markDirty"></div></label><button @click="refreshColors">根据主色生成光影色</button></section>
          </template>
          <StudioSymbolEditor v-else-if="tab === 'symbols'" />
          <template v-else><section class="section-heading"><small>GEOMETRY AUDIT</small><h2>外观检查</h2><p>在四个视角检查头身、肚皮、四肢和尾巴连接。</p></section><article v-for="finding in store.findings" :key="finding.id" class="finding" :data-severity="finding.severity"><strong>{{ finding.severity === 'warning' ? '需要检查' : finding.severity === 'error' ? '错误' : '提示' }}</strong><p>{{ finding.message }}</p><code v-if="finding.path">{{ finding.path }}</code></article></template>
        </div>

        <details class="advanced-panel" :open="advancedOpen" @toggle="advancedOpen = ($event.target as HTMLDetailsElement).open">
          <summary><span><small>LOCAL WORKSPACE</small><strong>方案与最近修改</strong></span><i>{{ advancedOpen ? '收起' : '展开' }}</i></summary>
          <div class="advanced-content"><p>{{ historyLabel }}</p><div class="scheme-form"><input v-model="schemeName" maxlength="32" placeholder="本地方案名称" @keydown.enter="saveScheme"><button @click="saveScheme">保存</button></div><div class="change-groups"><span v-for="group in changedGroupLabels" :key="group">{{ group }}</span><small v-if="!changedGroupLabels.length">当前与经典外观一致</small></div><div class="scheme-list"><article v-for="scheme in store.customSchemes" :key="scheme.id"><div><strong>{{ scheme.name }}</strong><small>{{ new Date(scheme.createdAt).toLocaleString() }}</small></div><span><button @click="applyScheme(scheme.id)">应用</button><button class="danger" @click="removeScheme(scheme.id)">删除</button></span></article><p v-if="!store.customSchemes.length">还没有本地方案。</p></div></div>
        </details>
      </aside>
    </section>
    <p v-if="notice" class="toast" role="status">{{ notice }}</p>
  </main>
</template>

<style scoped>
.studio-page{height:100dvh;min-height:720px;overflow:hidden;padding:14px;color:#eef1ff;background:radial-gradient(circle at 18% 0,#27224d55,transparent 34%),radial-gradient(circle at 92% 18%,#174c4650,transparent 28%),#080b14;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}.studio-header{display:grid;grid-template-columns:minmax(300px,1fr) minmax(240px,360px) auto;grid-template-areas:'brand search save' 'brand actions actions';align-items:center;gap:8px 16px;max-width:1680px;width:100%;margin:auto;padding:13px 16px;border:1px solid #ffffff18;border-radius:18px;background:#0d1120ef;box-shadow:0 16px 48px #0005}.brand-block{grid-area:brand;min-width:0}.brand-block a{color:#76dfd1;text-decoration:none;font-size:11px}.brand-block>span{display:block;margin-top:8px;color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.18em}.brand-block h1{margin:5px 0 3px;font-size:clamp(21px,1.8vw,27px)}.brand-block p{margin:0;color:#9098b7;font-size:11px;line-height:1.45}.studio-search{grid-area:search;position:relative;min-width:0}.studio-search label{display:grid;grid-template-columns:20px minmax(0,1fr) 20px;align-items:center;gap:5px;min-height:38px;padding:0 9px;border:1px solid #ffffff20;border-radius:10px;background:#080d18}.studio-search input{min-width:0;border:0;outline:0;color:#fff;background:transparent}.studio-search kbd{color:#77809f;font:700 9px/1 ui-monospace,monospace}.search-results{position:absolute;z-index:50;top:44px;left:0;right:0;display:grid;gap:4px;padding:7px;border:1px solid #ffffff20;border-radius:11px;background:#0b1020fa;box-shadow:0 18px 48px #0009}.search-results button{display:flex;justify-content:space-between;gap:8px;min-height:34px;padding:0 8px;border:1px solid transparent;border-radius:8px;color:#dfe5ff;background:transparent;text-align:left}.search-results button:hover{border-color:#52e0d055;background:#52e0d010}.search-results small,.search-results p{color:#77809f}.save-block{grid-area:save;display:flex;align-items:center;justify-content:flex-end;gap:8px}.save-block b{padding:5px 7px;border-radius:8px;color:#74dfd1;background:#52e0d012;font-size:9px;white-space:nowrap}.save-block b.dirty{color:#ffd28b;background:#ffb55f12}.primary{min-height:38px;padding:0 14px;border:1px solid #52e0d066;border-radius:10px;color:#fff;background:linear-gradient(135deg,#7066ff,#43cbbd);font-weight:800}.header-actions{grid-area:actions;display:flex;justify-content:flex-end;gap:8px}.header-actions>div{display:flex;gap:5px;padding-left:8px;border-left:1px solid #ffffff12}.header-actions button,.preview-toolbar button,.advanced-panel button,.sub-card button{min-height:30px;padding:0 9px;border:1px solid #ffffff1e;border-radius:8px;color:#dfe5ff;background:#ffffff08;cursor:pointer}.header-actions button:disabled,.primary:disabled{opacity:.38;cursor:not-allowed}.studio-workspace{min-height:0;display:grid;grid-template-columns:156px minmax(520px,1fr) minmax(380px,440px);gap:12px;max-width:1680px;width:100%;margin:auto}.part-nav,.preview-panel,.inspector{min-height:0;border:1px solid #ffffff16;border-radius:18px;background:#0c101def;box-shadow:0 18px 48px #0004}.part-nav{display:flex;flex-direction:column;gap:5px;padding:9px;overflow:auto}.part-nav button{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:7px;min-height:52px;padding:7px;border:1px solid transparent;border-radius:11px;color:#aeb6d0;text-align:left;background:transparent}.part-nav button.active{border-color:#7066ff66;color:#fff;background:linear-gradient(135deg,#7066ff22,#52e0d012)}.part-nav i{display:grid;width:29px;height:29px;place-items:center;border-radius:8px;background:#ffffff0a;font-style:normal;font-weight:800}.part-nav span{display:grid;gap:2px}.part-nav strong{font-size:11px}.part-nav small{color:#717a9d;font-size:8px}.part-nav b{position:absolute;right:6px;top:6px;color:#ff9ab0}.preview-panel{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;background:radial-gradient(circle at 50% 52%,#28225455,transparent 42%),#080c17}.preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-bottom:1px solid #ffffff12;background:#090d18d9}.toolbar-row,.toolbar-actions{display:flex;align-items:center;gap:4px}.preview-toolbar span{color:#687191;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}.preview-toolbar button.active,.toolbar-actions button[aria-pressed=true]{border-color:#52e0d066;color:#eafffb;background:#52e0d014}.toolbar-actions .compare{border-color:#52e0d044}.stage-status{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 12px;color:#bbc4e6;border-bottom:1px solid #ffffff0d;font-size:10px}.stage-status small{overflow:hidden;color:#77809f;text-overflow:ellipsis;white-space:nowrap}.canvas-shell{position:relative;min-height:0;padding:8px}.loading{display:grid;height:100%;place-items:center}.part-hotspots{position:absolute;z-index:8;inset:8px;pointer-events:none}.part-hotspots button{position:absolute;min-height:27px;padding:0 8px;border:1px solid #52e0d055;border-radius:999px;color:#dffff9;background:#0c1822df;font-size:9px;pointer-events:auto}.part-hotspots .face{left:48%;top:18%}.part-hotspots .body{left:47%;top:50%}.part-hotspots .tail{left:17%;top:58%}.part-hotspots .symbol{right:17%;top:48%}.inspector{display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.inspector>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border-bottom:1px solid #ffffff12;background:#0e1323}.inspector>header div{display:grid;gap:2px}.inspector>header small{color:#7d86a6;font-size:8px}.inspector>header b{padding:5px 7px;border-radius:8px;color:#74dfd1;background:#52e0d012;font-size:9px}.controls{display:flex;min-height:0;flex-direction:column;gap:11px;overflow:auto;padding:12px}.controls.readonly{opacity:.48;pointer-events:none}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:4px 0 3px;font-size:17px}.section-heading p,.option-section>p{margin:0;color:#8c95b4;font-size:10px;line-height:1.5}.controls>label,.sub-card>label{display:grid;gap:5px;color:#b9c1dc;font-size:11px}.controls input:not([type=range]):not([type=color]),.controls select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 9px;color:#fff;background:#090e1b}.option-section,.sub-card{display:grid;gap:8px;padding:11px;border:1px solid #ffffff14;border-radius:13px;background:#ffffff05}.option-section h3,.sub-card h3{margin:0;font-size:12px}.option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.option-grid button{display:grid;grid-template-columns:30px minmax(0,1fr);grid-template-rows:auto auto;gap:1px 6px;min-height:50px;padding:7px;border:1px solid #ffffff15;border-radius:9px;color:#c9d0e8;text-align:left;background:#080d18}.option-grid button.active{border-color:#52e0d077;background:#52e0d014}.option-grid i{grid-row:1/3;display:grid;width:28px;height:28px;place-items:center;align-self:center;border-radius:8px;color:#fff;background:#7066ff24;font-style:normal;font-size:16px}.option-grid strong{font-size:10px}.option-grid small{overflow:hidden;color:#717a9d;font-size:8px;line-height:1.3}.range-control{display:grid;gap:5px}.range-control>span{display:flex;align-items:center;justify-content:space-between}.range-control>span button{padding:3px 6px;border:1px solid #ffffff18;border-radius:7px;color:#98a2c2;background:#ffffff07;font-size:8px}.range-control>div{display:grid;grid-template-columns:minmax(0,1fr) 68px;gap:7px}.range-control input[type=range]{width:100%;accent-color:#7066ff}.range-control input[type=number]{min-width:0}.check{display:flex!important;align-items:center}.finding{padding:10px;border:1px solid #ffffff14;border-radius:11px;background:#ffffff05}.finding[data-severity=warning]{border-color:#ffbd6a44;background:#ffbd6a09}.finding p{margin:4px 0;color:#aab2cf;font-size:10px}.advanced-panel{border-top:1px solid #ffffff12;background:#0b1020}.advanced-panel summary{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:pointer;list-style:none}.advanced-panel summary::-webkit-details-marker{display:none}.advanced-panel summary span{display:grid;gap:2px}.advanced-panel summary small{color:#777f9f;font:800 7px/1 ui-monospace,monospace;letter-spacing:.14em}.advanced-panel summary strong{font-size:11px}.advanced-panel summary i{color:#7f89aa;font-style:normal;font-size:8px}.advanced-content{display:grid;gap:8px;max-height:260px;overflow:auto;padding:0 12px 11px}.advanced-content>p,.scheme-list>p{margin:0;color:#7f89aa;font-size:9px}.scheme-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}.scheme-form input{min-width:0;min-height:32px;border:1px solid #ffffff20;border-radius:8px;padding:0 8px;color:#fff;background:#080d18}.change-groups{display:flex;flex-wrap:wrap;gap:4px}.change-groups span{padding:4px 6px;border-radius:999px;background:#7066ff18;font-size:8px}.scheme-list{display:grid;gap:5px}.scheme-list article{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px;border:1px solid #ffffff12;border-radius:8px}.scheme-list article>div{display:grid}.scheme-list small{color:#77809f;font-size:7px}.scheme-list article>span{display:flex;gap:4px}.danger{color:#ffb0bf!important}.toast{position:fixed;z-index:100;right:20px;bottom:20px;margin:0;padding:10px 13px;border:1px solid #52e0d055;border-radius:11px;color:#eafffb;background:#10192bf2;box-shadow:0 18px 50px #0008}
@media(max-width:1280px){.studio-header{grid-template-columns:minmax(270px,1fr) minmax(220px,320px) auto}.studio-workspace{grid-template-columns:138px minmax(460px,1fr) 370px}.part-nav small{display:none}}
@media(max-width:1050px){.studio-page{height:auto;min-height:100vh;overflow:auto}.studio-header{grid-template-columns:1fr auto;grid-template-areas:'brand save' 'search search' 'actions actions'}.studio-workspace{grid-template-columns:120px minmax(0,1fr)}.inspector{grid-column:1/-1;min-height:720px}.preview-panel{min-height:650px}.header-actions{justify-content:flex-start}}
@media(max-width:760px){.studio-page{padding:8px}.studio-header{grid-template-columns:1fr;grid-template-areas:'brand' 'search' 'save' 'actions'}.save-block,.header-actions{justify-content:flex-start;flex-wrap:wrap}.studio-workspace{grid-template-columns:1fr}.part-nav{flex-direction:row;overflow:auto}.part-nav button{min-width:110px}.preview-panel{min-height:600px}.inspector{min-height:700px}.preview-toolbar{align-items:flex-start;flex-wrap:wrap}.option-grid{grid-template-columns:1fr}}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
