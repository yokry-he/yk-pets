<!--
  文件职责 / File responsibility
  提供道具工坊的资产选择、当前宠物挂载预览、道具元数据、层级和锚点基础结构。
  Provides prop asset selection, current-pet mounting preview, prop metadata, hierarchy, and anchor foundations.
-->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioSessionStore } from '~/stores/studio-session'
import type { StudioPropKind } from '~/domain/studio-workspace'

definePageMeta({ layout: 'studio' })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const session = useStudioSessionStore()
const selected = computed(() => assets.props.find(item => item.id === session.selectedPropId))
const anchorOptions = [
  ['world', '世界坐标'], ['pet-root', '宠物根节点'], ['head-top', '头顶'], ['muzzle', '口鼻部'],
  ['left-front-paw', '左前爪'], ['right-front-paw', '右前爪'], ['left-hind-paw', '左后爪'], ['right-hind-paw', '右后爪'], ['tail-tip', '尾巴尖'],
] as const
const componentTypes = ['球体', '方块', '圆柱', '圆锥', '圆环', '胶囊', '晶体', '文字', '粒子组件']

function selectProp(id: string) {
  session.selectProp(id)
  navigateTo({ path: '/studio/props', query: { prop: id } }, { replace: true })
}
function createProp(kind: StudioPropKind = 'composite') {
  const prop = assets.createProp({ kind })
  selectProp(prop.id)
}
function patchName(field: 'nameZh' | 'nameEn', event: Event) {
  if (!selected.value) return
  assets.updateProp(selected.value.id, { [field]: (event.target as HTMLInputElement).value })
}
function patchKind(event: Event) {
  if (!selected.value) return
  assets.updateProp(selected.value.id, { kind: (event.target as HTMLSelectElement).value as StudioPropKind })
}
function patchAnchor(event: Event) {
  if (!selected.value) return
  assets.updateProp(selected.value.id, { defaultAnchor: (event.target as HTMLSelectElement).value })
}
function setView(view: typeof session.previewView) {
  session.setPreview(view, session.previewBackground)
}

onMounted(() => {
  appearance.hydrate()
  assets.hydrate()
  session.hydrate()
  const requested = typeof route.query.prop === 'string' ? route.query.prop : ''
  if (requested && assets.props.some(item => item.id === requested)) session.selectProp(requested)
  else if (!session.selectedPropId && assets.props[0]) session.selectProp(assets.props[0].id)
})
</script>

<template>
  <section class="prop-workspace">
    <aside class="asset-panel">
      <header><div><small>PROP ASSETS</small><h1>道具工坊</h1></div><button @click="createProp('composite')">新建道具</button></header>
      <p>道具定义独立于动作；动作只保存实例变换、挂载和事件。</p>
      <button v-for="prop in assets.props" :key="prop.id" class="asset-item" :class="{active:prop.id===session.selectedPropId}" @click="selectProp(prop.id)"><strong>{{ prop.nameZh }}</strong><small>{{ prop.nameEn }} · {{ prop.kind }}</small></button>
      <div v-if="!assets.props.length" class="empty">尚无自定义道具。可以先创建组合道具或效果道具。</div>
    </aside>

    <div class="editor-area">
      <header class="editor-header"><div><small>PROP STUDIO</small><h2>{{ selected?.nameZh || '请选择或创建道具' }}</h2></div><div class="view-buttons"><button v-for="item in ['front','left','back','right'] as const" :key="item" :class="{active:session.previewView===item}" @click="setView(item)">{{ item }}</button></div></header>
      <div class="canvas-grid">
        <div class="pet-preview"><ClientOnly><CloudFoxStudioCanvas :appearance="appearance.recipe" behavior="idle" :motion-key="0" :view="session.previewView" :background="session.previewBackground" focus="full" /></ClientOnly><span class="anchor-badge">挂载预览：{{ selected?.defaultAnchor || '未选择' }}</span></div>
        <section class="composition-stage">
          <header><strong>道具组件层级</strong><small>后续几何编辑器将在这里操作真实组件树。</small></header>
          <div class="tree-root"><b>{{ selected?.nameZh || 'Prop Root' }}</b><span v-for="anchor in selected?.anchorIds || ['origin','grip','display','emitter']" :key="anchor">⌁ {{ anchor }}</span></div>
          <div class="component-palette"><button v-for="type in componentTypes" :key="type" disabled>{{ type }}</button></div>
        </section>
      </div>
    </div>

    <aside class="property-panel">
      <header><small>PROPERTIES</small><h2>道具属性</h2></header>
      <template v-if="selected">
        <label>中文名称<input :value="selected.nameZh" @change="patchName('nameZh',$event)"></label>
        <label>英文名称<input :value="selected.nameEn" @change="patchName('nameEn',$event)"></label>
        <label>道具类型<select :value="selected.kind" @change="patchKind"><option value="composite">参数化组合道具</option><option value="effect">效果道具</option></select></label>
        <label>默认挂载点<select :value="selected.defaultAnchor" @change="patchAnchor"><option v-for="[id,label] in anchorOptions" :key="id" :value="id">{{ label }}</option></select></label>
        <section class="anchor-card"><h3>道具内部锚点</h3><span v-for="anchor in selected.anchorIds" :key="anchor">{{ anchor }}</span></section>
        <NuxtLink :to="`/studio/motion?prop=${selected.id}`">在动作工坊中测试</NuxtLink>
        <code>{{ selected.id }}</code>
      </template>
      <div v-else class="empty">创建道具后可设置资产类型、默认挂载点和锚点名称。</div>
    </aside>
  </section>
</template>

<style scoped>
.prop-workspace{display:grid;grid-template-columns:230px minmax(560px,1fr) 290px;gap:12px;min-height:calc(100dvh - 55px);padding:12px}.asset-panel,.editor-area,.property-panel{min-height:0;border:1px solid #ffffff17;border-radius:16px;background:#0d1120}.asset-panel,.property-panel{display:flex;flex-direction:column;gap:9px;padding:12px;overflow:auto}.asset-panel header,.editor-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-panel small,.editor-header small,.property-panel small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}h1,h2,h3,p{margin:0}.asset-panel h1,.editor-header h2,.property-panel h2{margin-top:5px;font-size:18px}.asset-panel p{color:#8993b2;font-size:10px;line-height:1.55}.asset-panel button,.view-buttons button,.component-palette button{border:1px solid #ffffff1c;border-radius:8px;color:#dfe5ff;background:#ffffff07}.asset-panel header button{min-height:32px;padding:0 9px}.asset-item{display:grid;gap:3px;padding:9px;text-align:left}.asset-item.active{border-color:#52e0d066;background:#52e0d010}.asset-item small{font:400 8px/1.3 system-ui;color:#7883a3}.editor-area{display:grid;grid-template-rows:auto 1fr;overflow:hidden}.editor-header{padding:10px 12px;border-bottom:1px solid #ffffff13}.view-buttons{display:flex;gap:4px}.view-buttons button{min-height:30px;padding:0 8px}.view-buttons button.active{border-color:#52e0d066;background:#52e0d013}.canvas-grid{display:grid;grid-template-columns:minmax(360px,1fr) minmax(280px,.75fr);gap:10px;min-height:0;padding:10px}.pet-preview,.composition-stage{position:relative;min-height:0;border:1px solid #ffffff12;border-radius:12px;background:#080c17}.anchor-badge{position:absolute;right:10px;bottom:10px;padding:5px 8px;border:1px solid #52e0d044;border-radius:999px;color:#dffffa;background:#0b1720db;font-size:8px}.composition-stage{display:grid;grid-template-rows:auto 1fr auto;padding:11px}.composition-stage>header{display:grid;gap:3px}.composition-stage>header small{color:#77819f;font-size:9px}.tree-root{display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding:14px 0}.tree-root b{padding:7px 9px;border:1px solid #7066ff55;border-radius:8px;background:#7066ff12}.tree-root span{margin-left:18px;padding:5px 8px;border-left:1px solid #52e0d055;color:#aeb7d2;font-size:9px}.component-palette{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.component-palette button{min-height:32px;color:#727c9b}.property-panel label{display:grid;gap:5px;color:#b8c0da;font-size:10px}.property-panel input,.property-panel select{min-height:36px;padding:0 8px;border:1px solid #ffffff1d;border-radius:8px;color:#fff;background:#090e1b}.anchor-card{display:flex;flex-wrap:wrap;gap:5px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff04}.anchor-card h3{flex-basis:100%;font-size:11px}.anchor-card span{padding:4px 6px;border-radius:999px;color:#bfeee8;background:#52e0d012;font-size:8px}.property-panel a{color:#72dfd1;font-size:10px}.property-panel code{overflow-wrap:anywhere;color:#6e7898;font-size:8px}.empty{padding:12px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px;line-height:1.5}@media(max-width:1100px){.prop-workspace{grid-template-columns:190px 1fr}.property-panel{grid-column:1/-1}.canvas-grid{grid-template-columns:1fr}}@media(max-width:760px){.prop-workspace{grid-template-columns:1fr}.pet-preview{min-height:520px}}
</style>
