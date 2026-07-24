<!--
  文件职责 / File responsibility
  提供稳定三栏布局、Vue 原生高级交互、卡片式部件选择、聚焦预览、精确数值、全部位颜色和本地方案管理。
  Provides a stable three-column layout, native Vue advanced interactions, visual part cards, focused preview, precise values, all-part colors, and local scheme management.
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
interface SearchEntry {
  label: string
  tab: Tab
  keywords: string
}

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
const searchInput = ref<HTMLInputElement>()
const notice = ref('')
const searchQuery = ref('')
const searchFocused = ref(false)
const compareSnapshot = ref('')
const schemeName = ref('')
const advancedOpen = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let searchBlurTimer: ReturnType<typeof setTimeout> | undefined

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
const searchEntries: readonly SearchEntry[] = [
  { label: '鼻子形状与颜色', tab: 'face', keywords: '鼻子 nose 三角 感应器 纽扣 爱心 颜色' },
  { label: '嘴巴形状与舌头', tab: 'face', keywords: '嘴巴 mouth 经典 微笑 猫系 线条 张嘴 嘟嘴 舌头' },
  { label: '眼睛与耳朵', tab: 'face', keywords: '眼睛 eyes 星芒 水晶 菱形 耳朵 ears 高光 内耳 耳尖' },
  { label: '身体形状与比例', tab: 'body', keywords: '身体 body 球体 椭圆 胶囊 梨形 豆形 方糖 宽度 高度 厚度' },
  { label: '肚皮形状与位置', tab: 'body', keywords: '肚皮 belly 椭圆 蛋形 盾牌 水滴 豆形 爱心 云朵 胸毛' },
  { label: '所有部位颜色', tab: 'colors', keywords: '颜色 color palette 全部位 材质' },
  { label: '尾巴与触角', tab: 'tail', keywords: '尾巴 tail 触角 antenna 分段 尾尖' },
  { label: '发光与身体轨道', tab: 'glow', keywords: '发光 glow 轨道 orbit 粒子' },
  { label: '胸口与后背标志', tab: 'symbols', keywords: '标志 symbol 胸口 后背 字母' },
  { label: '外观检查', tab: 'audit', keywords: '检查 audit 穿模 边界 风险' },
]

const compareActive = computed(() => Boolean(compareSnapshot.value))
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return searchEntries
    .filter(entry => `${entry.label} ${entry.keywords}`.toLowerCase().includes(query))
    .slice(0, 8)
})
const showSearchResults = computed(() => searchFocused.value && Boolean(searchQuery.value.trim()))
const focusLabel = computed(() => ({
  identity: '全身',
  face: '头部 · 正面检查鼻嘴，侧面检查贴合',
  body: '身体 · 轮廓、肚皮与比例',
  colors: '全身材质',
  tail: '尾巴与触角',
  glow: '发光与轨道',
  symbols: '胸口与后背标志',
  audit: '四视角检查',
})[tab.value])
const changedGroupLabels = computed(() => changedGroups(compareActive.value ? JSON.parse(compareSnapshot.value) : recipe.value))
const historyLabel = computed(() => {
  const draft = store.draftSavedAt
    ? new Date(store.draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '尚无自动草稿'
  return `${draft} · 撤销 ${store.undoStack.length} / 重做 ${store.redoStack.length}`
})

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
  show('已保存正式外观，可继续同步到 Chrome 扩展')
}
function reset() {
  if (compareActive.value || !confirm('恢复扩展经典默认外观？当前草稿会进入撤销历史。')) return
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
  if (compareActive.value) return
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
  if (compareActive.value) return
  store.checkpoint()
  store.refreshDerivedColors()
  recipe.value.orbitDesign.primaryColor = recipe.value.palette.primaryGlow
  recipe.value.orbitDesign.secondaryColor = recipe.value.palette.secondaryGlow
  show('已重新生成高光、暗部与轨道色')
}
function selectSearchResult(entry: SearchEntry) {
  tab.value = entry.tab
  searchQuery.value = ''
  searchFocused.value = false
}
function onSearchBlur() {
  if (searchBlurTimer) clearTimeout(searchBlurTimer)
  searchBlurTimer = setTimeout(() => { searchFocused.value = false }, 100)
}
function toggleComparison() {
  if (compareActive.value) {
    restoreComparison()
    return
  }
  compareSnapshot.value = JSON.stringify(recipe.value)
  store.recipe = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  show('正在只读预览扩展经典外观')
}
function restoreComparison() {
  if (!compareSnapshot.value) return
  store.recipe = normalizeCustomizableAppearance(JSON.parse(compareSnapshot.value))
  compareSnapshot.value = ''
}
function saveScheme() {
  const name = schemeName.value.trim()
  if (!name) {
    show('请输入本地方案名称')
    return
  }
  restoreComparison()
  store.saveCustomScheme(name)
  schemeName.value = ''
  show('当前外观已保存到本地方案库')
}
function applyScheme(id: string) {
  restoreComparison()
  store.applyCustomScheme(id)
  show('已应用本地方案')
}
function removeScheme(id: string) {
  store.deleteCustomScheme(id)
  show('本地方案已删除')
}
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const editing = target?.matches('input,textarea,select,[contenteditable=true]')
  if (event.key === '/' && !editing) {
    event.preventDefault()
    searchInput.value?.focus()
  }
  if (event.key === 'Escape') {
    searchQuery.value = ''
    searchFocused.value = false
    restoreComparison()
  }
}
function eyeIcon(id: string) {
  if (id === 'spark') return '✦'
  if (id === 'diamond') return '◆'
  if (id === 'visor') return '▰'
  if (id === 'sleepy') return '⌒'
  if (id === 'oval') return '⬭'
  return '●'
}
function noseIcon(id: string) {
  if (id === 'triangle') return '▲'
  if (id === 'sensor') return '▰'
  if (id === 'heart') return '♥'
  return '●'
}
function mouthIcon(id: string) {
  if (id === 'classic') return 'ᴗ'
  if (id === 'open') return 'O'
  if (id === 'pout') return '○'
  if (id === 'cat') return 'ω'
  if (id === 'line') return '—'
  return '⌣'
}
function bodyIcon(id: string) {
  if (id === 'sphere') return '●'
  if (id === 'capsule') return '▯'
  if (id === 'pear') return '♟'
  if (id === 'bean') return '◒'
  if (id === 'rounded-cube') return '▣'
  return '⬭'
}
function changedGroups(input: unknown) {
  const current = normalizeCustomizableAppearance(input)
  const classic = normalizeCustomizableAppearance(createExtensionClassicAppearance())
  const groups: Array<[string, boolean]> = [
    ['头部', JSON.stringify(current.parts) !== JSON.stringify(classic.parts) || current.proportions.headScale !== classic.proportions.headScale],
    ['身体', current.parts.bodyShape !== classic.parts.bodyShape || current.proportions.bodyWidth !== classic.proportions.bodyWidth || current.proportions.bodyHeight !== classic.proportions.bodyHeight],
    ['颜色', JSON.stringify(current.customization.colors) !== JSON.stringify(classic.customization.colors)],
    ['肚皮', JSON.stringify(current.customization.belly) !== JSON.stringify(classic.customization.belly)],
    ['尾巴触角', JSON.stringify(current.tailDesign) !== JSON.stringify(classic.tailDesign) || JSON.stringify(current.antennaDesign) !== JSON.stringify(classic.antennaDesign)],
    ['发光轨道', JSON.stringify(current.glow) !== JSON.stringify(classic.glow) || JSON.stringify(current.orbitDesign) !== JSON.stringify(classic.orbitDesign)],
    ['标志', JSON.stringify(current.symbols) !== JSON.stringify(classic.symbols)],
  ]
  return groups.filter(([, changed]) => changed).map(([label]) => label)
}

onMounted(() => {
  store.hydrate()
  window.addEventListener('keydown', onKeydown)
})
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
    <header class="topbar">
      <div class="title">
        <NuxtLink to="/">← YK-PETS</NuxtLink>
        <span>PET STUDIO</span>
        <h1>创建属于你的云灵</h1>
        <p>选择部件、调整形状和颜色；草稿自动保存在本机，正式保存后用于扩展同步。</p>
      </div>

      <div class="studio-search">
        <label>
          <span aria-hidden="true">⌕</span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            placeholder="搜索部位或参数"
            aria-label="搜索 Studio 部位和参数"
            @focus="searchFocused = true"
            @blur="onSearchBlur"
          >
          <kbd>/</kbd>
        </label>
        <div v-if="showSearchResults" class="search-results">
          <button v-for="entry in searchResults" :key="entry.label" type="button" @mousedown.prevent="selectSearchResult(entry)">
            <strong>{{ entry.label }}</strong><small>{{ tabs.find(item => item.id === entry.tab)?.label }}</small>
          </button>
          <p v-if="!searchResults.length">没有匹配的部位或参数</p>
        </div>
      </div>

      <div class="actions">
        <button :disabled="compareActive || !store.canUndo" @click="store.undo">撤销</button>
        <button :disabled="compareActive || !store.canRedo" @click="store.redo">重做</button>
        <button :disabled="compareActive" @click="store.randomize(); show('已随机生成')">随机</button>
        <button :disabled="compareActive" @click="reset">恢复默认</button>
        <button :disabled="compareActive" @click="fileInput?.click()">导入</button>
        <button @click="exportRecipe">导出</button>
        <button class="primary" :disabled="compareActive" @click="save">保存并用于同步</button>
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
          <div class="toolbar-group"><span>视角</span><button v-for="[id, label] in views" :key="id" :class="{ active: view === id }" @click="view = id">{{ label }}</button></div>
          <div class="toolbar-group"><span>背景</span><button v-for="[id, label] in backgrounds" :key="id" :class="{ active: background === id }" @click="background = id">{{ label }}</button></div>
          <div class="compare-control">
            <button type="button" :aria-pressed="compareActive" @click="toggleComparison">{{ compareActive ? '返回当前' : '对比经典' }}</button>
            <small>{{ compareActive ? `${changedGroupLabels.length} 组配置不同 · 只读` : '当前外观' }}</small>
          </div>
        </div>
        <div class="focus-pill"><span>聚焦</span>{{ focusLabel }}</div>
        <div class="canvas-shell">
          <ClientOnly>
            <CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :motion-key="motionKey" :view="view" :background="background" />
            <template #fallback><div class="loading">正在装配 Cloud Fox…</div></template>
          </ClientOnly>
          <div class="part-hotspots" aria-label="点击选择宠物部位">
            <button class="face" type="button" @click="tab = 'face'">头部</button>
            <button class="body" type="button" @click="tab = 'body'">身体</button>
            <button class="tail" type="button" @click="tab = 'tail'">尾巴</button>
            <button class="symbol" type="button" @click="tab = 'symbols'">标志</button>
          </div>
        </div>
        <StudioMotionToolbar :behavior="behavior" @play="play" />
      </section>

      <aside class="inspector">
        <header>
          <div><strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong><small>{{ store.draftSavedAt ? '本地草稿已自动保存' : '正在编辑本地草稿' }}</small></div>
          <b :class="{ warn: store.dirty }">{{ store.dirty ? '尚未正式保存' : '正式外观已保存' }}</b>
        </header>

        <details class="advanced-panel" :open="advancedOpen" @toggle="advancedOpen = ($event.target as HTMLDetailsElement).open">
          <summary>
            <span><small>ADVANCED STUDIO</small><strong>方案与最近修改</strong></span>
            <i>{{ advancedOpen ? '收起' : '展开' }}</i>
          </summary>
          <p>{{ historyLabel }}</p>
          <div class="scheme-form">
            <input v-model="schemeName" maxlength="32" placeholder="本地方案名称" @keydown.enter="saveScheme">
            <button type="button" @click="saveScheme">保存方案</button>
          </div>
          <strong class="changes-title">与经典外观的差异</strong>
          <div class="change-groups">
            <span v-for="group in changedGroupLabels" :key="group">{{ group }}</span>
            <small v-if="!changedGroupLabels.length">当前与经典外观一致</small>
          </div>
          <div class="scheme-list">
            <article v-for="scheme in store.customSchemes" :key="scheme.id">
              <div><strong>{{ scheme.name }}</strong><small>{{ new Date(scheme.createdAt).toLocaleString() }}</small></div>
              <span><button type="button" @click="applyScheme(scheme.id)">应用</button><button class="danger" type="button" @click="removeScheme(scheme.id)">删除</button></span>
            </article>
            <p v-if="!store.customSchemes.length">还没有本地方案。命名保存后可以快速切换。</p>
          </div>
        </details>

        <div class="controls" :class="{ readonly: compareActive }" :aria-disabled="compareActive">
          <template v-if="tab === 'identity'">
            <section class="section-heading"><small>IDENTITY</small><h2>身份信息</h2><p>旧配方会自动迁移为显式椭圆肚皮和全部位颜色结构。</p></section>
            <label>中文名字<input v-model="recipe.identity.nameZh" @focus="store.checkpoint" @input="store.markDirty"></label>
            <label>英文名字<input v-model="recipe.identity.nameEn" @focus="store.checkpoint" @input="store.markDirty" @blur="syncName"></label>
            <label>宠物 ID<input v-model="recipe.identity.petId" @focus="store.checkpoint" @input="store.markDirty"></label>
          </template>

          <template v-else-if="tab === 'face'">
            <section class="section-heading"><small>FACE PARTS</small><h2>头部和表情</h2><p>正面检查轮廓差异，左/右侧检查鼻嘴贴合和层级。</p></section>
            <StudioEarEditor />
            <section class="option-section"><h3>眼睛</h3><div class="option-grid"><button v-for="item in PARTS.eyes" :key="item.id" :class="{ active: recipe.parts.eyes === item.id }" @click="setPart('eyes', item.id)"><i>{{ eyeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>鼻子</h3><div class="option-grid"><button v-for="item in PARTS.noses" :key="item.id" :class="{ active: recipe.parts.nose === item.id }" @click="setPart('nose', item.id)"><i>{{ noseIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <section class="option-section"><h3>嘴巴</h3><div class="option-grid"><button v-for="item in PARTS.mouths" :key="item.id" :class="{ active: recipe.parts.mouth === item.id }" @click="setPart('mouth', item.id)"><i>{{ mouthIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <label v-for="[key, label] in faceControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <template v-else-if="tab === 'body'">
            <section class="section-heading"><small>BODY</small><h2>身体与肚皮</h2><p>每个身体选项应产生独立轮廓；侧面视角用于检查厚度与头身比例。</p></section>
            <section class="option-section"><h3>身体形状</h3><div class="option-grid"><button v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :class="{ active: recipe.parts.bodyShape === item.id }" @click="setPart('bodyShape', item.id)"><i>{{ bodyIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section>
            <StudioBellyPatchEditor />
            <label v-for="[key, label] in bodyControls" :key="key" class="range-control"><span><strong>{{ label }}</strong><button @click="resetProportion(key)">重置</button></span><div><input v-model.number="recipe.proportions[key]" type="range" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input :value="recipe.proportions[key]" type="number" :min="ranges.proportions[key][0]" :max="ranges.proportions[key][1]" step=".01" @focus="store.checkpoint" @change="setProportion(key, Number(($event.target as HTMLInputElement).value))"></div></label>
          </template>

          <StudioPartColorEditor v-else-if="tab === 'colors'" />
          <StudioTailEditor v-else-if="tab === 'tail'" />

          <template v-else-if="tab === 'glow'">
            <section class="section-heading"><small>GLOW</small><h2>发光与身体轨道</h2><p>高能动作不会自动降低视觉质量。</p></section>
            <label>发光模式<select v-model="recipe.glow.mode" @focus="store.checkpoint" @change="store.markDirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label>
            <label class="range-control"><span><strong>发光强度</strong></span><div><input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.glow.intensity" type="number" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @focus="store.checkpoint" @change="store.markDirty"></div></label>
            <section class="sub-card">
              <h3>身体周围轨道</h3>
              <label class="check"><input v-model="recipe.orbitDesign.enabled" type="checkbox" @focus="store.checkpoint" @change="store.markDirty">显示轨道</label>
              <label>轨道数量<select v-model.number="recipe.orbitDesign.ringCount" @focus="store.checkpoint" @change="store.markDirty"><option :value="1">1 条</option><option :value="2">2 条</option><option :value="3">3 条</option></select></label>
              <label v-for="[key, label, step] in [['radius', '半径', .01], ['verticalScale', '纵向比例', .01], ['tilt', '倾斜', .02], ['speed', '速度', .01], ['intensity', '亮度', .05], ['particleCount', '粒子数', 1]] as const" :key="key" class="range-control"><span><strong>{{ label }}</strong></span><div><input v-model.number="recipe.orbitDesign[key]" type="range" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @pointerdown="store.beginTransaction" @pointerup="store.endTransaction" @input="store.markDirty"><input v-model.number="recipe.orbitDesign[key]" type="number" :min="ranges.orbit[key][0]" :max="ranges.orbit[key][1]" :step="step" @focus="store.checkpoint" @change="store.markDirty"></div></label>
              <button @click="refreshColors">根据主色生成光影色</button>
            </section>
          </template>

          <StudioSymbolEditor v-else-if="tab === 'symbols'" />
          <template v-else>
            <section class="section-heading"><small>GEOMETRY AUDIT</small><h2>外观检查</h2><p>扩大参数范围后，自动边界和穿模检查用于提示风险，而不是静默截断创作。</p></section>
            <article v-for="finding in store.findings" :key="finding.id" class="finding" :data-severity="finding.severity"><strong>{{ finding.severity === 'warning' ? '需要检查' : finding.severity === 'error' ? '错误' : '提示' }}</strong><p>{{ finding.message }}</p><code v-if="finding.path">{{ finding.path }}</code></article>
          </template>
        </div>
      </aside>
    </section>
    <p v-if="notice" class="toast" role="status">{{ notice }}</p>
  </main>
</template>

<style scoped>
.studio-page{min-height:100vh;padding:16px;color:#eef1ff;background:radial-gradient(circle at 20% 0,#27224d55,transparent 34%),radial-gradient(circle at 90% 20%,#174c4650,transparent 30%),#080b14}
.topbar{display:grid;grid-template-columns:minmax(260px,1fr) minmax(230px,360px) minmax(420px,auto);align-items:center;gap:16px;max-width:1600px;margin:0 auto 14px;padding:16px 18px;border:1px solid #ffffff18;border-radius:20px;background:#0d1120e8;box-shadow:0 18px 55px #0005}
.title{min-width:0}.title a{color:#76dfd1;text-decoration:none;font-size:12px}.title>span{display:block;margin-top:10px;color:#777f9f;font:800 9px/1 ui-monospace,monospace;letter-spacing:.18em}.title h1{margin:6px 0 4px;font-size:clamp(22px,2vw,28px)}.title p{max-width:560px;margin:0;color:#9098b7;font-size:12px;line-height:1.5}
.studio-search{position:relative;min-width:0}.studio-search label{display:grid;grid-template-columns:22px minmax(0,1fr) 22px;align-items:center;gap:4px;min-height:40px;padding:0 9px;border:1px solid #ffffff20;border-radius:11px;background:#080d18}.studio-search input{min-width:0;border:0;outline:0;color:#fff;background:transparent}.studio-search kbd{color:#77809f;font:700 9px/1 ui-monospace,monospace}.search-results{position:absolute;z-index:40;left:0;right:0;top:46px;display:grid;gap:4px;padding:7px;border:1px solid #ffffff20;border-radius:12px;background:#0b1020f7;box-shadow:0 18px 48px #0009}.search-results button{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:36px;padding:0 9px;border:1px solid transparent;border-radius:8px;color:#dfe5ff;text-align:left;background:transparent;cursor:pointer}.search-results button:hover,.search-results button:focus-visible{border-color:#52e0d055;background:#52e0d010}.search-results small,.search-results p{color:#77809f}.search-results p{margin:6px;font-size:11px}
.actions{display:grid;grid-template-columns:repeat(4,max-content);justify-content:end;gap:7px}.actions button,.sub-card button{min-height:36px;padding:0 11px;border:1px solid #ffffff1e;border-radius:10px;color:#dfe5ff;background:#ffffff08;cursor:pointer}.actions button.primary{grid-column:span 2;border-color:#52e0d066;background:linear-gradient(135deg,#7066ff,#43cbbd);font-weight:800}.actions button:disabled{opacity:.38;cursor:not-allowed}
.studio-layout{display:grid;grid-template-columns:172px minmax(460px,1fr) minmax(360px,440px);gap:14px;max-width:1600px;margin:auto}
.part-nav,.preview-panel,.inspector{height:calc(100vh - 146px);min-height:620px;border:1px solid #ffffff16;border-radius:20px;background:#0c101de8;box-shadow:0 18px 48px #0004}
.part-nav{display:flex;flex-direction:column;gap:6px;padding:10px;overflow:auto}.part-nav button{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:8px;min-height:56px;padding:7px;border:1px solid transparent;border-radius:12px;color:#aeb6d0;text-align:left;background:transparent;cursor:pointer}.part-nav button.active{border-color:#7066ff66;color:#fff;background:linear-gradient(135deg,#7066ff22,#52e0d012)}.part-nav i{display:grid;width:31px;height:31px;place-items:center;border-radius:9px;background:#ffffff0a;font-style:normal;font-weight:800}.part-nav span{display:grid;gap:2px}.part-nav strong{font-size:12px}.part-nav small{color:#717a9d;font-size:9px}.part-nav b{position:absolute;right:7px;top:7px;color:#ff9ab0}
.preview-panel{position:sticky;top:12px;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;align-self:start;overflow:hidden;background:radial-gradient(circle at 50% 52%,#28225466,transparent 42%),#080c17}.preview-toolbar{position:relative;z-index:10;display:grid;grid-template-columns:auto auto minmax(130px,1fr);align-items:center;gap:10px;padding:10px;border-bottom:1px solid #ffffff12;background:#090d18cc;backdrop-filter:blur(16px)}.toolbar-group{display:flex;align-items:center;gap:5px}.preview-toolbar span,.focus-pill span{color:#687191;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}.preview-toolbar button{min-height:29px;padding:0 8px;border:1px solid #ffffff15;border-radius:8px;color:#929bb9;background:#ffffff06;cursor:pointer}.preview-toolbar button.active{border-color:#52e0d066;color:#eafffb;background:#52e0d014}.compare-control{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0}.compare-control button{border-color:#52e0d044;color:#eafffb;background:#52e0d012}.compare-control small{overflow:hidden;color:#77809f;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.focus-pill{position:relative;z-index:3;justify-self:center;margin:8px;padding:7px 11px;border:1px solid #7066ff44;border-radius:999px;color:#bbc4e6;background:#7066ff12;font-size:10px}.focus-pill span{margin-right:7px}
.canvas-shell{position:relative;min-height:0;overflow:hidden}.loading{display:grid;height:100%;min-height:400px;place-items:center;color:#8891b0}.part-hotspots{position:absolute;z-index:8;inset:0;pointer-events:none}.part-hotspots button{position:absolute;min-height:28px;padding:0 9px;border:1px solid #52e0d055;border-radius:999px;color:#dffff9;background:#0c1822cc;font-size:9px;opacity:.76;pointer-events:auto;cursor:pointer;backdrop-filter:blur(8px)}.part-hotspots button:hover,.part-hotspots button:focus-visible{opacity:1;transform:scale(1.04)}.part-hotspots .face{left:48%;top:18%}.part-hotspots .body{left:47%;top:50%}.part-hotspots .tail{left:18%;top:58%}.part-hotspots .symbol{right:18%;top:48%}
.inspector{display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}.inspector>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid #ffffff12;background:#0e1323}.inspector>header div{display:grid;gap:3px}.inspector>header small{color:#7d86a6;font-size:9px}.inspector>header b{padding:6px 8px;border-radius:8px;color:#74dfd1;background:#52e0d012;font-size:9px}.inspector>header b.warn{color:#ffd28b;background:#ffb55f12}
.advanced-panel{margin:10px 12px 0;border:1px solid #7066ff33;border-radius:13px;background:linear-gradient(145deg,#12172a,#0a0f1e)}.advanced-panel summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;cursor:pointer;list-style:none}.advanced-panel summary::-webkit-details-marker{display:none}.advanced-panel summary span{display:grid;gap:3px}.advanced-panel summary small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.advanced-panel summary strong{font-size:13px}.advanced-panel summary i{color:#7f89aa;font-style:normal;font-size:9px}.advanced-panel>p{margin:0;padding:0 10px 8px;color:#7f89aa;font-size:9px}.scheme-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:0 10px 9px}.scheme-form input{min-width:0;min-height:34px;border:1px solid #ffffff20;border-radius:9px;padding:0 9px;color:#fff;background:#080d18}.advanced-panel button{min-height:32px;padding:0 8px;border:1px solid #7066ff44;border-radius:8px;color:#fff;background:#7066ff12;cursor:pointer}.changes-title{display:block;padding:0 10px;color:#aeb6d0;font-size:10px}.change-groups{display:flex;flex-wrap:wrap;gap:5px;padding:7px 10px}.change-groups span{padding:5px 7px;border-radius:999px;color:#dfe5ff;background:#7066ff18;font-size:9px}.change-groups small{color:#77809f}.scheme-list{display:grid;max-height:132px;gap:6px;overflow:auto;padding:0 10px 10px}.scheme-list article{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #ffffff14;border-radius:9px;background:#ffffff05}.scheme-list article>div{display:grid;gap:2px}.scheme-list article small{color:#77809f;font-size:8px}.scheme-list article>span{display:flex;gap:4px}.scheme-list button.danger{border-color:#ff809544;color:#ffb0bf;background:#ff809510}.scheme-list>p{margin:0;color:#77809f;font-size:9px}
.controls{display:flex;min-height:0;flex-direction:column;gap:12px;overflow:auto;padding:14px}.controls.readonly{opacity:.45;pointer-events:none}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:5px 0 3px;font-size:18px}.section-heading p{margin:0;color:#8c95b4;font-size:11px;line-height:1.5}.controls>label,.sub-card>label{display:grid;gap:5px;color:#b9c1dc;font-size:12px}.controls input:not([type=range]):not([type=color]),.controls select{min-height:38px;border:1px solid #ffffff20;border-radius:10px;padding:0 10px;color:#fff;background:#090e1b}.option-section,.sub-card{display:grid;gap:9px;padding:12px;border:1px solid #ffffff14;border-radius:14px;background:#ffffff05}.option-section h3,.sub-card h3{margin:0;font-size:13px}.option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.option-grid button{display:grid;grid-template-columns:32px minmax(0,1fr);grid-template-rows:auto auto;gap:1px 7px;min-height:52px;padding:7px;border:1px solid #ffffff15;border-radius:10px;color:#c9d0e8;text-align:left;background:#080d18;cursor:pointer}.option-grid button.active{border-color:#52e0d077;background:#52e0d014}.option-grid i{grid-row:1/3;display:grid;width:30px;height:30px;place-items:center;align-self:center;border-radius:9px;color:#fff;background:#7066ff24;font-style:normal;font-size:17px}.option-grid strong{font-size:10px}.option-grid small{color:#717a9d;font-size:8px}.range-control{display:grid;gap:5px}.range-control>span{display:flex;align-items:center;justify-content:space-between}.range-control>span button{padding:3px 6px;border:1px solid #ffffff18;border-radius:7px;color:#98a2c2;background:#ffffff07;font-size:9px;cursor:pointer}.range-control>div{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:8px}.range-control input[type=range]{width:100%;accent-color:#7066ff}.range-control input[type=number]{min-width:0;font-variant-numeric:tabular-nums}.check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center}.check input{width:17px;height:17px;accent-color:#52e0d0}.finding{padding:11px;border:1px solid #ffffff14;border-radius:12px;background:#ffffff05}.finding[data-severity=warning]{border-color:#ffbd6a44;background:#ffbd6a09}.finding p{margin:5px 0;color:#aab2cf;font-size:11px;line-height:1.5}.finding code{color:#78ded1;font-size:9px}.toast{position:fixed;right:22px;bottom:22px;z-index:20;margin:0;padding:11px 14px;border:1px solid #52e0d055;border-radius:12px;color:#eafffb;background:#10192bea;box-shadow:0 18px 50px #0008}
:global([data-nova-extension-root]){display:none!important}:global(.studio-entry){display:none!important}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #52e0d0;outline-offset:2px}
@media(max-width:1320px){.topbar{grid-template-columns:minmax(260px,1fr) minmax(220px,320px)}.actions{grid-column:1/-1;grid-template-columns:repeat(7,max-content);justify-content:start}.actions button.primary{grid-column:auto}.studio-layout{grid-template-columns:148px minmax(420px,1fr) minmax(340px,390px)}.part-nav small{display:none}}
@media(max-width:980px){.topbar{grid-template-columns:1fr}.actions{grid-template-columns:repeat(4,max-content)}.studio-layout{grid-template-columns:1fr}.part-nav,.preview-panel,.inspector{height:auto;min-height:0}.part-nav{flex-direction:row;overflow:auto}.part-nav button{min-width:112px}.preview-panel{position:relative;top:0;min-height:680px}.inspector{min-height:620px}.preview-toolbar{grid-template-columns:1fr 1fr}.compare-control{grid-column:1/-1;justify-content:flex-start}}
@media(max-width:620px){.studio-page{padding:8px}.topbar{padding:13px}.actions{grid-template-columns:repeat(2,minmax(0,1fr))}.actions button{width:100%}.preview-toolbar{grid-template-columns:1fr}.toolbar-group{flex-wrap:wrap}.compare-control{grid-column:auto}.option-grid{grid-template-columns:1fr}.part-hotspots{display:none}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.part-hotspots button{transition:none!important}}
</style>
