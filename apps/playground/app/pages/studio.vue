<!--
  文件职责 / File responsibility
  提供完整可滚动 Studio 工作台，将头部、身体、四肢、肚皮、尾巴、触角、颜色、发光和标志拆成可独立访问的原生 Vue 工作区。
  Provides a complete scrollable Studio workspace with native Vue sections for head, body, limbs, belly, tail, antennae, colors, glow, and symbols.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioAntennaEditor from '~/components/studio/StudioAntennaEditor.vue'
import StudioBellyPatchEditor from '~/components/studio/StudioBellyPatchEditor.vue'
import StudioEarEditor from '~/components/studio/StudioEarEditor.vue'
import StudioFrontPawEditor from '~/components/studio/StudioFrontPawEditor.vue'
import StudioGlowEditor from '~/components/studio/StudioGlowEditor.vue'
import StudioMouthEditor from '~/components/studio/StudioMouthEditor.vue'
import StudioMotionToolbar from '~/components/studio/StudioMotionToolbar.vue'
import StudioNumericControl from '~/components/studio/StudioNumericControl.vue'
import StudioPartColorEditor from '~/components/studio/StudioPartColorEditor.vue'
import StudioSymbolEditor from '~/components/studio/StudioSymbolEditor.vue'
import StudioTailEditor from '~/components/studio/StudioTailEditor.vue'
import { CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_HEAD_SHAPES, derivePetMonogram } from '~/domain/cloud-fox-appearance'
import { PET_STUDIO_PART_OPTIONS as PARTS } from '~/domain/pet-studio-phase2'
import { getExtensionCloudFoxMotionDurationMs, type ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import { normalizeCustomizableAppearance } from '~/domain/pet-part-customization'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase3'
import type { StudioControlPath } from '~/domain/studio-control-registry'
import { createExtensionClassicAppearance } from '~/domain/extension-cloud-fox-default'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'limbs' | 'belly' | 'tail' | 'antenna' | 'colors' | 'glow' | 'symbols' | 'audit'
type PartKey = 'headShape' | 'eyes' | 'nose' | 'bodyShape'
type ProportionKey = 'headScale' | 'earScale' | 'eyeScale' | 'eyeSpacing' | 'bodyWidth' | 'bodyHeight' | 'bodyDepth'
interface SearchEntry { label: string; tab: Tab; keywords: string }

useHead({ bodyAttrs: { class: 'yk-pets-studio-page' } })
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
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
  { id:'identity',label:'身份',icon:'ID',hint:'名字与方案' }, { id:'face',label:'头部',icon:'◉',hint:'头型、耳眼鼻嘴' },
  { id:'body',label:'身体',icon:'⬭',hint:'形状、宽高厚' }, { id:'limbs',label:'四肢',icon:'⌁',hint:'前爪与腿部' },
  { id:'belly',label:'肚皮',icon:'◒',hint:'形状与贴合' }, { id:'tail',label:'尾巴',icon:'≈',hint:'根部与分段' },
  { id:'antenna',label:'触角',icon:'⌃',hint:'结构与发光' }, { id:'colors',label:'颜色',icon:'◐',hint:'全部材质通道' },
  { id:'glow',label:'发光轨道',icon:'✦',hint:'光效与粒子' }, { id:'symbols',label:'标志',icon:'Z',hint:'胸口与后背' },
  { id:'audit',label:'检查',icon:'✓',hint:'边界与穿模' },
]
const views: Array<[CloudFoxStudioView,string]> = [['front','正面'],['left','左侧'],['back','背面'],['right','右侧']]
const backgrounds: Array<[CloudFoxStudioBackground,string]> = [['dark','深色'],['light','浅色'],['web','网页']]
const faceControls: Array<[StudioControlPath,ProportionKey]> = [['proportions.headScale','headScale'],['proportions.earScale','earScale'],['proportions.eyeScale','eyeScale'],['proportions.eyeSpacing','eyeSpacing']]
const bodyControls: Array<[StudioControlPath,ProportionKey]> = [['proportions.bodyWidth','bodyWidth'],['proportions.bodyHeight','bodyHeight'],['proportions.bodyDepth','bodyDepth']]
const searchEntries: readonly SearchEntry[] = [
  {label:'独立头型',tab:'face',keywords:'头型 head shape 圆头 宽圆 椭圆 胶囊 豆形 方头'},
  {label:'眼睛、耳朵与鼻子',tab:'face',keywords:'眼睛 eyes 星芒 水晶 月牙 耳朵 ears 鼻子 nose'},
  {label:'嘴巴与舌头',tab:'face',keywords:'嘴巴 mouth 经典 猫系 线条 张嘴 嘟嘴 舌头'},
  {label:'身体形状和比例',tab:'body',keywords:'身体 body 球体 椭圆 胶囊 梨形 豆形 方糖 宽高厚'},
  {label:'四肢与前爪',tab:'limbs',keywords:'四肢 limb 前爪 paw 位置 镜像 左右'},
  {label:'肚皮形状与位置',tab:'belly',keywords:'肚皮 belly 椭圆 蛋形 盾牌 水滴 豆形 爱心 云朵 胸毛'},
  {label:'尾巴分段',tab:'tail',keywords:'尾巴 tail 分段 根部 尾尖'},
  {label:'触角',tab:'antenna',keywords:'触角 antenna 杆体 末端 长度 间距'},
  {label:'所有部位颜色',tab:'colors',keywords:'颜色 color palette 全部位 材质'},
  {label:'发光与轨道',tab:'glow',keywords:'发光 glow 轨道 orbit 粒子'},
  {label:'胸背标志',tab:'symbols',keywords:'标志 symbol 胸口 后背 字母'},
  {label:'外观检查',tab:'audit',keywords:'检查 audit 穿模 边界 风险'},
]
const compareActive = computed(() => Boolean(compareSnapshot.value))
const searchResults = computed(() => { const query=searchQuery.value.trim().toLowerCase(); return query ? searchEntries.filter(entry=>`${entry.label} ${entry.keywords}`.toLowerCase().includes(query)).slice(0,8) : [] })
const showSearchResults = computed(() => searchFocused.value && Boolean(searchQuery.value.trim()))
const previewFocus = computed<'full'|'head'|'body'|'tail'>(() => ['face','antenna'].includes(tab.value) ? 'head' : ['body','limbs','belly'].includes(tab.value) ? 'body' : tab.value==='tail' ? 'tail' : 'full')
const focusLabel = computed(() => ({ identity:'全身与身份',face:'独立头型与表情',body:'身体轮廓',limbs:'四肢与前爪',belly:'肚皮贴合',tail:'尾巴分段',antenna:'触角结构',colors:'全部材质',glow:'发光与轨道',symbols:'胸背标志',audit:'四视角检查' })[tab.value])
const changedGroupLabels = computed(() => changedGroups(compareActive.value ? JSON.parse(compareSnapshot.value) : recipe.value))
const historyLabel = computed(() => `${store.draftSavedAt ? new Date(store.draftSavedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '尚无草稿'} · 撤销 ${store.undoStack.length} / 重做 ${store.redoStack.length}`)

watch(tab,next=>{
  if (['face','body','limbs','belly','antenna','colors'].includes(next)) view.value='front'
  if (next==='tail') view.value='left'
  if (next==='symbols') view.value='back'
  showHotspots.value=false
})
function show(message:string){notice.value=message;if(noticeTimer)clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.value=''},2600)}
function setPart(key:PartKey,value:string){if(compareActive.value)return;store.checkpoint();store.patchParts({[key]:value} as Partial<typeof recipe.value.parts>)}
function setProportion(key:ProportionKey,value:number){if(compareActive.value)return;recipe.value.proportions[key]=value}
function play(next:ExtensionCloudFoxMotionId){if(timer)clearTimeout(timer);behavior.value=next;motionKey.value+=1;const duration=getExtensionCloudFoxMotionDurationMs(next);if(duration>0)timer=setTimeout(()=>{behavior.value='idle';motionKey.value+=1},duration)}
function syncName(){if(compareActive.value)return;store.checkpoint();const monogram=derivePetMonogram(recipe.value.identity.nameEn);recipe.value.identity.monogram=monogram;recipe.value.symbols.chest.text=monogram;store.markDirty()}
function save(){if(compareActive.value)return;store.save();show('正式外观已保存，可继续同步到 Chrome 扩展')}
function reset(){if(compareActive.value||!confirm('恢复经典默认外观？当前草稿会进入撤销历史。'))return;store.reset();show('已恢复经典默认外观')}
function exportRecipe(){const url=URL.createObjectURL(new Blob([store.exportJson()],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`${recipe.value.identity.petId}-appearance-v4.json`;anchor.click();URL.revokeObjectURL(url)}
async function importRecipe(event:Event){if(compareActive.value)return;const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';if(!file)return;try{store.replace(JSON.parse(await file.text()));show('配方已导入并完成兼容迁移')}catch{show('JSON 配方无效')}}
function selectSearchResult(entry:SearchEntry){tab.value=entry.tab;searchQuery.value='';searchFocused.value=false}
function onSearchBlur(){if(searchBlurTimer)clearTimeout(searchBlurTimer);searchBlurTimer=setTimeout(()=>{searchFocused.value=false},100)}
function toggleComparison(){if(compareActive.value)return restoreComparison();compareSnapshot.value=JSON.stringify(recipe.value);store.recipe=normalizeCustomizableAppearance(createExtensionClassicAppearance());show('正在只读预览经典外观')}
function restoreComparison(){if(!compareSnapshot.value)return;store.recipe=normalizeCustomizableAppearance(JSON.parse(compareSnapshot.value));compareSnapshot.value=''}
function saveScheme(){const name=schemeName.value.trim();if(!name)return show('请输入本地方案名称');restoreComparison();store.saveCustomScheme(name);schemeName.value='';show('外观已保存到本地方案库')}
function applyScheme(id:string){restoreComparison();store.applyCustomScheme(id);show('已应用本地方案')}
function removeScheme(id:string){store.deleteCustomScheme(id);show('本地方案已删除')}
function onKeydown(event:KeyboardEvent){const target=event.target as HTMLElement|null;const editing=target?.matches('input,textarea,select,[contenteditable=true]');if(event.key==='/'&&!editing){event.preventDefault();searchInput.value?.focus()}if(event.key==='Escape'){searchQuery.value='';searchFocused.value=false;showHotspots.value=false;restoreComparison()}}
function eyeIcon(id:string){return id==='spark'?'✦':id==='diamond'?'◆':id==='visor'?'▰':id==='sleepy'?'⌒':id==='oval'?'⬭':'●'}
function noseIcon(id:string){return id==='triangle'?'▲':id==='sensor'?'▰':id==='heart'?'♥':'●'}
function shapeIcon(id:string){return id.includes('cube')?'▣':id==='capsule'?'▯':id==='pear'?'♟':id==='bean'?'◒':id.includes('oval')||id==='ellipsoid'?'⬭':'●'}
function changedGroups(input:unknown){const current=normalizeCustomizableAppearance(input);const classic=normalizeCustomizableAppearance(createExtensionClassicAppearance());const groups:Array<[string,boolean]>=[['头部',JSON.stringify(current.parts)!==JSON.stringify(classic.parts)||JSON.stringify(current.customization.mouth)!==JSON.stringify(classic.customization.mouth)],['身体',current.parts.bodyShape!==classic.parts.bodyShape||current.proportions.bodyWidth!==classic.proportions.bodyWidth||current.proportions.bodyHeight!==classic.proportions.bodyHeight||current.proportions.bodyDepth!==classic.proportions.bodyDepth],['四肢',JSON.stringify(current.frontPawDesign)!==JSON.stringify(classic.frontPawDesign)],['颜色',JSON.stringify(current.customization.colors)!==JSON.stringify(classic.customization.colors)],['肚皮',JSON.stringify(current.customization.belly)!==JSON.stringify(classic.customization.belly)],['尾巴',JSON.stringify(current.tailDesign)!==JSON.stringify(classic.tailDesign)],['触角',JSON.stringify(current.antennaDesign)!==JSON.stringify(classic.antennaDesign)],['发光轨道',JSON.stringify(current.glow)!==JSON.stringify(classic.glow)||JSON.stringify(current.orbitDesign)!==JSON.stringify(classic.orbitDesign)],['标志',JSON.stringify(current.symbols)!==JSON.stringify(classic.symbols)]];return groups.filter(([,changed])=>changed).map(([label])=>label)}
onMounted(()=>{store.hydrate();window.addEventListener('keydown',onKeydown)})
onBeforeUnmount(()=>{restoreComparison();if(timer)clearTimeout(timer);if(noticeTimer)clearTimeout(noticeTimer);if(searchBlurTimer)clearTimeout(searchBlurTimer);store.endTransaction();window.removeEventListener('keydown',onKeydown)})
</script>

<template>
  <main class="studio-page" :data-compare="compareActive">
    <header class="studio-header">
      <div class="brand-block"><NuxtLink to="/">← YK-PETS</NuxtLink><span>PET STUDIO</span><h1>创建属于你的云灵</h1><p>所有可配置部位均拥有独立工作区；草稿仅保存在本机。</p></div>
      <div class="studio-search"><label><span>⌕</span><input ref="searchInput" v-model="searchQuery" type="search" placeholder="搜索部位或参数" @focus="searchFocused=true" @blur="onSearchBlur"><kbd>/</kbd></label><div v-if="showSearchResults" class="search-results"><button v-for="entry in searchResults" :key="entry.label" @mousedown.prevent="selectSearchResult(entry)"><strong>{{ entry.label }}</strong><small>{{ tabs.find(item=>item.id===entry.tab)?.label }}</small></button><p v-if="!searchResults.length">没有匹配项</p></div></div>
      <div class="save-block"><b :class="{dirty:store.dirty}">{{ store.dirty?'草稿未正式保存':'正式外观已保存' }}</b><button class="primary" :disabled="compareActive" @click="save">保存并用于同步</button></div>
      <div class="header-actions"><button :disabled="compareActive||!store.canUndo" @click="store.undo">撤销</button><button :disabled="compareActive||!store.canRedo" @click="store.redo">重做</button><button :disabled="compareActive" @click="store.randomize();show('已随机生成')">随机</button><button :disabled="compareActive" @click="reset">恢复默认</button><button :disabled="compareActive" @click="fileInput?.click()">导入</button><button @click="exportRecipe">导出</button><input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe"></div>
    </header>
    <section class="studio-workspace">
      <nav class="part-nav" aria-label="宠物部位"><button v-for="item in tabs" :key="item.id" :class="{active:tab===item.id}" @click="tab=item.id"><i>{{ item.icon }}</i><span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span><b v-if="item.id==='audit'&&store.findings.some(f=>f.severity==='warning')">!</b></button></nav>
      <section class="preview-panel">
        <div class="preview-toolbar"><div class="toolbar-row"><span>视角</span><button v-for="[id,label] in views" :key="id" :class="{active:view===id}" @click="view=id">{{ label }}</button></div><div class="toolbar-row"><span>背景</span><button v-for="[id,label] in backgrounds" :key="id" :class="{active:background===id}" @click="background=id">{{ label }}</button></div><div class="toolbar-actions"><button :aria-pressed="showHotspots" @click="showHotspots=!showHotspots">部位定位</button><button :aria-pressed="compareActive" @click="toggleComparison">{{ compareActive?'返回当前':'对比经典' }}</button></div></div>
        <div class="stage-status"><span>{{ focusLabel }}</span><small>{{ compareActive?`${changedGroupLabels.length} 组不同 · 只读经典预览`:`${recipe.parts.headShape} / ${recipe.parts.bodyShape}` }}</small></div>
        <div class="canvas-shell"><ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :motion-key="motionKey" :view="view" :background="background" :focus="previewFocus" /><template #fallback><div class="loading">正在装配 Cloud Fox…</div></template></ClientOnly><div v-if="showHotspots" class="part-hotspots"><button class="face" @click="tab='face';showHotspots=false">头部</button><button class="body" @click="tab='body';showHotspots=false">身体</button><button class="limbs" @click="tab='limbs';showHotspots=false">四肢</button><button class="tail" @click="tab='tail';showHotspots=false">尾巴</button></div></div>
        <StudioMotionToolbar :behavior="behavior" @play="play" />
      </section>
      <aside class="inspector"><header><div><strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong><small>{{ store.draftSavedAt?'本地草稿已自动保存':'正在编辑本地草稿' }}</small></div><b>{{ tabs.find(item=>item.id===tab)?.label }}</b></header>
        <div class="controls" :class="{readonly:compareActive}">
          <template v-if="tab==='identity'"><section class="section-heading"><small>IDENTITY</small><h2>身份信息</h2><p>身份、方案名称与导出文件标识。</p></section><label>中文名字<input v-model="recipe.identity.nameZh" @focus="store.checkpoint" @input="store.markDirty"></label><label>英文名字<input v-model="recipe.identity.nameEn" @focus="store.checkpoint" @input="store.markDirty" @blur="syncName"></label><label>宠物 ID<input v-model="recipe.identity.petId" @focus="store.checkpoint" @input="store.markDirty"></label></template>
          <template v-else-if="tab==='face'"><section class="section-heading"><small>HEAD & FACE</small><h2>头部和表情</h2><p>头型独立于身体；左右侧视检查鼻嘴贴合。</p></section><section class="option-section"><h3>头部形状</h3><p>切换身体不会修改这里的选择。</p><div class="option-grid"><button v-for="item in CLOUD_FOX_HEAD_SHAPES" :key="item.id" :class="{active:recipe.parts.headShape===item.id}" @click="setPart('headShape',item.id)"><i>{{ shapeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button></div></section><StudioEarEditor /><section class="option-section"><h3>眼睛</h3><div class="option-grid"><button v-for="item in PARTS.eyes" :key="item.id" :class="{active:recipe.parts.eyes===item.id}" @click="setPart('eyes',item.id)"><i>{{ eyeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section><section class="option-section"><h3>鼻子</h3><div class="option-grid"><button v-for="item in PARTS.noses" :key="item.id" :class="{active:recipe.parts.nose===item.id}" @click="setPart('nose',item.id)"><i>{{ noseIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></button></div></section><StudioMouthEditor /><section class="sub-card"><h3>头部比例</h3><StudioNumericControl v-for="[path,key] in faceControls" :key="path" :path="path" :model-value="recipe.proportions[key]" @update:model-value="setProportion(key,$event)" /></section></template>
          <template v-else-if="tab==='body'"><section class="section-heading"><small>BODY</small><h2>身体</h2><p>身体只改变躯干轮廓，不再联动头型。</p></section><section class="option-section"><h3>身体形状</h3><div class="option-grid"><button v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :class="{active:recipe.parts.bodyShape===item.id}" @click="setPart('bodyShape',item.id)"><i>{{ shapeIcon(item.id) }}</i><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button></div></section><section class="sub-card"><h3>身体比例</h3><StudioNumericControl v-for="[path,key] in bodyControls" :key="path" :path="path" :model-value="recipe.proportions[key]" @update:model-value="setProportion(key,$event)" /></section></template>
          <StudioFrontPawEditor v-else-if="tab==='limbs'" />
          <StudioBellyPatchEditor v-else-if="tab==='belly'" />
          <StudioTailEditor v-else-if="tab==='tail'" />
          <StudioAntennaEditor v-else-if="tab==='antenna'" />
          <StudioPartColorEditor v-else-if="tab==='colors'" />
          <StudioGlowEditor v-else-if="tab==='glow'" />
          <StudioSymbolEditor v-else-if="tab==='symbols'" />
          <template v-else><section class="section-heading"><small>GEOMETRY AUDIT</small><h2>外观检查</h2><p>在四个视角检查头身、肚皮、四肢、尾巴和嘴巴连接。</p></section><article v-for="finding in store.findings" :key="finding.id" class="finding" :data-severity="finding.severity"><strong>{{ finding.severity==='warning'?'需要检查':finding.severity==='error'?'错误':'提示' }}</strong><p>{{ finding.message }}</p><code v-if="finding.path">{{ finding.path }}</code></article></template>
        </div>
        <details class="advanced-panel" :open="advancedOpen" @toggle="advancedOpen=($event.target as HTMLDetailsElement).open"><summary><span><small>LOCAL WORKSPACE</small><strong>方案与最近修改</strong></span><i>{{ advancedOpen?'收起':'展开' }}</i></summary><div class="advanced-content"><p>{{ historyLabel }}</p><div class="scheme-form"><input v-model="schemeName" maxlength="32" placeholder="本地方案名称" @keydown.enter="saveScheme"><button @click="saveScheme">保存</button></div><div class="change-groups"><span v-for="group in changedGroupLabels" :key="group">{{ group }}</span><small v-if="!changedGroupLabels.length">当前与经典外观一致</small></div><div class="scheme-list"><article v-for="scheme in store.customSchemes" :key="scheme.id"><div><strong>{{ scheme.name }}</strong><small>{{ new Date(scheme.createdAt).toLocaleString() }}</small></div><span><button @click="applyScheme(scheme.id)">应用</button><button class="danger" @click="removeScheme(scheme.id)">删除</button></span></article><p v-if="!store.customSchemes.length">还没有本地方案。</p></div></div></details>
      </aside>
    </section><p v-if="notice" class="toast" role="status">{{ notice }}</p>
  </main>
</template>

<style scoped>
.studio-page{min-height:100dvh;padding:14px;color:#eef1ff;background:radial-gradient(circle at 18% 0,#27224d55,transparent 34%),radial-gradient(circle at 92% 18%,#174c4650,transparent 28%),#080b14}.studio-header{display:grid;grid-template-columns:minmax(300px,1fr) minmax(240px,360px) auto;grid-template-areas:'brand search save' 'brand actions actions';align-items:center;gap:8px 16px;max-width:1680px;margin:0 auto 12px;padding:13px 16px;border:1px solid #ffffff18;border-radius:18px;background:#0d1120ef}.brand-block{grid-area:brand}.brand-block a{color:#76dfd1;text-decoration:none;font-size:11px}.brand-block>span{display:block;margin-top:8px;color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.18em}.brand-block h1{margin:5px 0 3px;font-size:clamp(21px,1.8vw,27px)}.brand-block p{margin:0;color:#9098b7;font-size:11px}.studio-search{grid-area:search;position:relative}.studio-search label{display:grid;grid-template-columns:20px 1fr 20px;align-items:center;min-height:38px;padding:0 9px;border:1px solid #ffffff20;border-radius:10px;background:#080d18}.studio-search input{min-width:0;border:0;outline:0;color:#fff;background:transparent}.studio-search kbd{color:#77809f;font-size:9px}.search-results{position:absolute;z-index:50;top:44px;left:0;right:0;display:grid;gap:4px;padding:7px;border:1px solid #ffffff20;border-radius:11px;background:#0b1020fa}.search-results button{display:flex;justify-content:space-between;min-height:34px;border:0;border-radius:8px;color:#dfe5ff;background:transparent}.save-block{grid-area:save;display:flex;align-items:center;gap:8px}.save-block b{padding:5px 7px;border-radius:8px;color:#74dfd1;background:#52e0d012;font-size:9px}.save-block b.dirty{color:#ffd28b}.primary{min-height:38px;padding:0 14px;border:1px solid #52e0d066;border-radius:10px;color:#fff;background:linear-gradient(135deg,#7066ff,#43cbbd);font-weight:800}.header-actions{grid-area:actions;display:flex;justify-content:flex-end;gap:5px}.header-actions button,.preview-toolbar button,.advanced-panel button{min-height:30px;padding:0 9px;border:1px solid #ffffff1e;border-radius:8px;color:#dfe5ff;background:#ffffff08}.studio-workspace{display:grid;grid-template-columns:156px minmax(500px,1fr) minmax(380px,440px);gap:12px;max-width:1680px;height:max(720px,calc(100dvh - 158px));margin:0 auto}.part-nav,.preview-panel,.inspector{min-height:0;border:1px solid #ffffff16;border-radius:18px;background:#0c101def;box-shadow:0 18px 48px #0004}.part-nav{display:flex;flex-direction:column;gap:5px;padding:9px;overflow-y:auto;scrollbar-gutter:stable}.part-nav button{position:relative;display:grid;grid-template-columns:32px 1fr;align-items:center;gap:7px;min-height:50px;padding:7px;border:1px solid transparent;border-radius:11px;color:#aeb6d0;text-align:left;background:transparent}.part-nav button.active{border-color:#7066ff66;color:#fff;background:linear-gradient(135deg,#7066ff22,#52e0d012)}.part-nav i{display:grid;width:29px;height:29px;place-items:center;border-radius:8px;background:#ffffff0a;font-style:normal;font-weight:800}.part-nav span{display:grid}.part-nav strong{font-size:11px}.part-nav small{color:#717a9d;font-size:8px}.part-nav b{position:absolute;right:5px;top:4px;color:#ff9ab0}.preview-panel{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;background:#080c17}.preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:8px 9px;border-bottom:1px solid #ffffff12}.toolbar-row,.toolbar-actions{display:flex;align-items:center;gap:4px}.preview-toolbar span{color:#687191;font-size:8px}.preview-toolbar button.active,.toolbar-actions button[aria-pressed=true]{border-color:#52e0d066;background:#52e0d014}.stage-status{display:flex;justify-content:space-between;padding:7px 12px;border-bottom:1px solid #ffffff0d;font-size:10px}.stage-status small{color:#77809f}.canvas-shell{position:relative;min-height:0;padding:8px}.loading{display:grid;height:100%;place-items:center}.part-hotspots{position:absolute;z-index:8;inset:8px;pointer-events:none}.part-hotspots button{position:absolute;pointer-events:auto;border:1px solid #52e0d055;border-radius:999px;color:#dffff9;background:#0c1822df}.part-hotspots .face{left:48%;top:18%}.part-hotspots .body{left:47%;top:50%}.part-hotspots .limbs{left:60%;top:55%}.part-hotspots .tail{left:17%;top:58%}.inspector{display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.inspector>header{display:flex;justify-content:space-between;padding:11px 13px;border-bottom:1px solid #ffffff12}.inspector>header div{display:grid}.inspector>header small{color:#7d86a6;font-size:8px}.inspector>header b{color:#74dfd1;font-size:9px}.controls{display:flex;min-height:0;flex-direction:column;gap:11px;overflow-y:auto;padding:12px;scrollbar-gutter:stable}.controls.readonly{opacity:.48;pointer-events:none}.section-heading small{color:#777f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}.section-heading h2{margin:4px 0 3px;font-size:17px}.section-heading p,.option-section>p{margin:0;color:#8c95b4;font-size:10px}.controls>label{display:grid;gap:5px;color:#b9c1dc;font-size:11px}.controls input:not([type=range]):not([type=color]),.controls select{min-height:36px;border:1px solid #ffffff20;border-radius:9px;padding:0 9px;color:#fff;background:#090e1b}.option-section,.sub-card{display:grid;gap:8px;padding:11px;border:1px solid #ffffff14;border-radius:13px;background:#ffffff05}.option-section h3,.sub-card h3{margin:0;font-size:12px}.option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.option-grid button{display:grid;grid-template-columns:30px 1fr;grid-template-rows:auto auto;gap:1px 6px;min-height:50px;padding:7px;border:1px solid #ffffff15;border-radius:9px;color:#c9d0e8;text-align:left;background:#080d18}.option-grid button.active{border-color:#52e0d077;background:#52e0d014}.option-grid i{grid-row:1/3;display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:#7066ff24;font-style:normal}.option-grid strong{font-size:10px}.option-grid small{color:#717a9d;font-size:8px}.finding{padding:10px;border:1px solid #ffffff14;border-radius:11px;background:#ffffff05}.finding[data-severity=warning]{border-color:#ffbd6a44}.finding p{margin:4px 0;color:#aab2cf;font-size:10px}.advanced-panel{border-top:1px solid #ffffff12}.advanced-panel summary{display:flex;justify-content:space-between;padding:9px 12px;cursor:pointer}.advanced-panel summary span{display:grid}.advanced-panel summary small{color:#777f9f;font-size:7px}.advanced-content{display:grid;gap:8px;max-height:260px;overflow:auto;padding:0 12px 11px}.scheme-form{display:grid;grid-template-columns:1fr auto;gap:6px}.scheme-form input{min-width:0;min-height:32px;border:1px solid #ffffff20;border-radius:8px;color:#fff;background:#090e1b}.change-groups{display:flex;flex-wrap:wrap;gap:4px}.change-groups span{padding:3px 6px;border-radius:999px;color:#dffff9;background:#52e0d014;font-size:8px}.scheme-list{display:grid;gap:6px}.scheme-list article{display:flex;justify-content:space-between;padding:7px;border:1px solid #ffffff12;border-radius:8px}.scheme-list article div{display:grid}.scheme-list small{color:#77809f;font-size:8px}.toast{position:fixed;z-index:100;left:50%;bottom:20px;transform:translateX(-50%);padding:9px 13px;border:1px solid #52e0d055;border-radius:999px;color:#eafffb;background:#0c1822f2}@media(max-width:1180px){.studio-workspace{grid-template-columns:130px minmax(440px,1fr) 360px}.studio-header{grid-template-columns:1fr 320px;grid-template-areas:'brand save' 'search actions'}}@media(max-width:920px){.studio-workspace{height:auto;grid-template-columns:1fr}.part-nav{display:grid;grid-template-columns:repeat(3,1fr);max-height:none}.preview-panel{min-height:650px}.inspector{min-height:720px}.studio-header{grid-template-columns:1fr;grid-template-areas:'brand' 'search' 'save' 'actions'}.header-actions{justify-content:flex-start;flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
