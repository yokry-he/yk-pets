<!--
  文件职责 / File responsibility
  提供版本化道具实体的组件树、几何、材质、内部锚点、导入导出和唯一场景挂载预览。
  Provides versioned prop entity component-tree, geometry, material, internal-anchor, import/export, and sole-scene mount preview editing.
-->
<script setup lang="ts">
import { validateLocalGlb, type EvaluatedMotionPropInstance, type MotionPropMountId, type StudioPropAnchorId, type StudioPropComponent, type StudioPropKind, type StudioPropPrimitive } from '@yk-pets/pet-core'
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioPreviewToolbar from '~/components/studio/StudioPreviewToolbar.vue'
import { useStudioPreviewOrientation } from '~/composables/useStudioPreviewOrientation'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioSessionStore } from '~/stores/studio-session'

definePageMeta({ layout: 'studio' })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const session = useStudioSessionStore()
const selected = computed(() => assets.props.find(item => item.id === session.selectedPropId))
const selectedComponentId = ref('')
const selectedAnchorId = ref<StudioPropAnchorId>('grip')
const importInput = ref<HTMLInputElement | null>(null)
const glbInput = ref<HTMLInputElement | null>(null)
const glbStatus = ref('')
const {
  previewScale,
  previewRotation,
  previewRotationRadians,
  previewRotateSurface,
  previewDrag,
  updatePreviewRotation,
  updatePreviewScale,
  resetPreviewScale,
  wheelPreview,
  selectPreviewView,
  beginPreviewRotate,
  movePreviewRotate,
  endPreviewRotate,
  cancelPreviewRotate,
} = useStudioPreviewOrientation({ excludedSelector: '.anchor-badge' })
const selectedComponent = computed(() => selected.value?.components.find(item => item.id === selectedComponentId.value) || selected.value?.components[0])
const selectedAnchor = computed(() => selected.value?.anchors.find(item => item.id === selectedAnchorId.value))
const anchorOptions: readonly [MotionPropMountId, string][] = [
  ['world', '世界坐标'], ['pet-root', '宠物根节点'], ['head-top', '头顶'], ['muzzle', '口鼻部'],
  ['left-front-paw', '左前爪'], ['right-front-paw', '右前爪'], ['left-hind-paw', '左后爪'], ['right-hind-paw', '右后爪'], ['tail-tip', '尾巴尖'],
]
const componentTypes: readonly [StudioPropPrimitive, string][] = [
  ['sphere', '球体'], ['box', '方块'], ['cylinder', '圆柱'], ['cone', '圆锥'], ['torus', '圆环'], ['capsule', '胶囊'], ['crystal', '晶体'], ['text', '文字牌'], ['particles', '粒子组件'],
]
const previewInstances = computed<readonly EvaluatedMotionPropInstance[]>(() => selected.value ? [{
  instanceId: 'prop-studio-preview', propId: selected.value.id, exists: true, visible: true,
  mountId: selected.value.defaultAnchor, space: 'mount',
  transform: { position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] },
  style: { color: '#66e8ff', opacity: 1, glow: 0, particleRate: 0 },
}] : [])

watch(selected, prop => {
  if (prop && !prop.components.some(item => item.id === selectedComponentId.value)) selectedComponentId.value = prop.components[0]?.id || ''
}, { immediate: true })

function selectProp(id: string) {
  session.selectProp(id)
  navigateTo({ path: '/studio/props', query: { prop: id } }, { replace: true })
}
function createProp(kind: StudioPropKind = 'composite') {
  const prop = assets.createProp({ kind })
  selectProp(prop.id)
}
function duplicateAsset() {
  if (!selected.value) return
  const prop = assets.duplicateProp(selected.value.id)
  if (prop) selectProp(prop.id)
}
function deleteAsset() {
  if (!selected.value) return
  const id = selected.value.id
  assets.deleteProp(id)
  const next = assets.props[0]
  if (next) selectProp(next.id)
  else session.selectProp('')
}
function patchName(field: 'nameZh' | 'nameEn', event: Event) {
  if (selected.value) assets.updateProp(selected.value.id, { [field]: (event.target as HTMLInputElement).value })
}
function patchKind(event: Event) {
  if (selected.value) assets.updateProp(selected.value.id, { kind: (event.target as HTMLSelectElement).value as StudioPropKind })
}
function patchDefaultAnchor(event: Event) {
  if (selected.value) assets.updateProp(selected.value.id, { defaultAnchor: (event.target as HTMLSelectElement).value as MotionPropMountId })
}
function addComponent(primitive: StudioPropPrimitive) {
  if (!selected.value) return
  const next = assets.addPropComponent(selected.value.id, primitive, selectedComponent.value?.id)
  selectedComponentId.value = next?.components.at(-1)?.id || selectedComponentId.value
}
function duplicateComponent() {
  if (selected.value && selectedComponent.value) {
    const next = assets.duplicatePropComponent(selected.value.id, selectedComponent.value.id)
    selectedComponentId.value = next?.components.at(-1)?.id || selectedComponentId.value
  }
}
function deleteComponent() {
  if (selected.value && selectedComponent.value) {
    assets.removePropComponent(selected.value.id, selectedComponent.value.id)
    selectedComponentId.value = selected.value.components[0]?.id || ''
  }
}
function componentPatch(patch: Partial<StudioPropComponent>) {
  if (selected.value && selectedComponent.value) assets.updatePropComponent(selected.value.id, selectedComponent.value.id, patch)
}
function patchComponentField(field: 'name' | 'primitive' | 'parentId', event: Event) {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  componentPatch(field === 'parentId' ? { parentId: value || undefined } : { [field]: value } as Partial<StudioPropComponent>)
}
function patchVector(section: 'transform', field: 'position' | 'rotation' | 'scale', index: number, event: Event) {
  const component = selectedComponent.value
  if (!component) return
  const vector = [...component[section][field]] as [number, number, number]
  vector[index] = Number((event.target as HTMLInputElement).value)
  componentPatch({ [section]: { ...component[section], [field]: vector } })
}
function patchGeometry(field: keyof StudioPropComponent['geometry'], event: Event) {
  const component = selectedComponent.value
  if (!component) return
  const raw = (event.target as HTMLInputElement).value
  componentPatch({ geometry: { ...component.geometry, [field]: field === 'text' ? raw : Number(raw) } })
}
function patchMaterial(field: keyof StudioPropComponent['material'], event: Event) {
  const component = selectedComponent.value
  if (!component) return
  const raw = (event.target as HTMLInputElement).value
  componentPatch({ material: { ...component.material, [field]: field === 'color' || field === 'glowColor' ? raw : Number(raw) } })
}
function patchAnchorVector(field: 'position' | 'rotation' | 'scale', index: number, event: Event) {
  if (!selected.value || !selectedAnchor.value) return
  const vector = [...selectedAnchor.value.transform[field]] as [number, number, number]
  vector[index] = Number((event.target as HTMLInputElement).value)
  assets.updatePropAnchor(selected.value.id, selectedAnchor.value.id, { [field]: vector })
}
function exportProp() {
  if (!selected.value || !import.meta.client) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(selected.value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `${selected.value.nameEn.replace(/[^a-z0-9-_]+/gi,'-').toLowerCase() || 'prop'}.json`; link.click(); URL.revokeObjectURL(url)
}
async function importProp(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { const prop = assets.importProp(JSON.parse(await file.text())); selectProp(prop.id) }
  finally { (event.target as HTMLInputElement).value = '' }
}
async function importGlb(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selected.value) return
  const buffer = await file.arrayBuffer()
  const validation = validateLocalGlb(buffer)
  if (!validation.valid) { glbStatus.value = `GLB 被拒绝：${validation.diagnostics.join(' · ')}`; (event.target as HTMLInputElement).value = ''; return }
  const bytes = new Uint8Array(buffer); let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  assets.setPropLocalModel(selected.value.id, { format: 'glb', name: file.name, byteLength: bytes.byteLength, dataUrl: `data:model/gltf-binary;base64,${btoa(binary)}` })
  glbStatus.value = `已加载本地 GLB：${file.name} · ${bytes.byteLength} bytes`
  ;(event.target as HTMLInputElement).value = ''
}
function removeGlb() { if (selected.value) { assets.setPropLocalModel(selected.value.id); glbStatus.value = '已移除本地 GLB' } }
function setView(view: typeof session.previewView) {
  selectPreviewView(view, selectedView => session.setPreview(selectedView, session.previewBackground))
}
function setBackground(background: typeof session.previewBackground) { session.setPreview(session.previewView, background) }
function resetPreviewTransform() { resetPreviewScale(); setView('front') }

onMounted(() => {
  appearance.hydrate(); assets.hydrate(); session.hydrate()
  const requested = typeof route.query.prop === 'string' ? route.query.prop : ''
  if (requested && assets.props.some(item => item.id === requested)) session.selectProp(requested)
  else if (!session.selectedPropId && assets.props[0]) session.selectProp(assets.props[0].id)
})
</script>

<template>
  <section class="prop-workspace">
    <aside class="asset-panel">
      <header><div><small>PROP ASSETS</small><h1>道具工坊</h1></div><button @click="createProp('composite')">新建道具</button></header>
      <p>道具实体独立于动作；动作只引用稳定道具 ID，并保存实例事件。</p>
      <button v-for="prop in assets.props" :key="prop.id" class="asset-item" :class="{active:prop.id===session.selectedPropId}" @click="selectProp(prop.id)"><strong>{{ prop.nameZh }}</strong><small>{{ prop.nameEn }} · {{ prop.kind }} · {{ prop.components.length }} components</small></button>
      <div v-if="!assets.props.length" class="empty">尚无自定义道具。可以创建组合道具或效果道具。</div>
      <div class="asset-actions"><button :disabled="!selected" @click="duplicateAsset">复制资产</button><button :disabled="!selected" @click="exportProp">导出 JSON</button><button @click="importInput?.click()">导入 JSON</button><button class="danger" :disabled="!selected" @click="deleteAsset">删除</button></div>
      <input ref="importInput" hidden type="file" accept="application/json,.json" @change="importProp"><input ref="glbInput" hidden type="file" accept="model/gltf-binary,.glb" @change="importGlb">
    </aside>

    <div class="editor-area">
      <header class="editor-header"><div><small>PROP STUDIO</small><h2>{{ selected?.nameZh || '请选择或创建道具' }}</h2><span v-if="selected">schema v{{ selected.schemaVersion }} · {{ selected.components.length }}/48 components</span></div></header>
      <StudioPreviewToolbar class="props-preview-toolbar" :view="session.previewView" :background="session.previewBackground" :scale="previewScale" :rotation="previewRotation" @view="setView" @background="setBackground" @scale="updatePreviewScale" @rotation="(axis, value) => updatePreviewRotation(axis, value)" @reset="resetPreviewTransform" />
      <div class="canvas-grid">
        <div class="pet-preview">
          <ClientOnly><CloudFoxStudioCanvas :appearance="appearance.recipe" behavior="idle" :motion-key="selected?.updatedAt || 0" :view="session.previewView" :background="session.previewBackground" focus="full" :prop-instances="previewInstances" :prop-assets="selected ? [selected] : []" :preview-scale="previewScale" :preview-rotation="previewRotationRadians" preserve-prop-materials /></ClientOnly>
          <div ref="previewRotateSurface" class="preview-rotate-surface" :class="{ dragging: previewDrag.active }" @pointerdown="beginPreviewRotate" @pointermove="movePreviewRotate" @pointerup="endPreviewRotate" @pointercancel="cancelPreviewRotate" @wheel.prevent="wheelPreview"><span>拖动画布自由旋转 · 滚轮调整预览大小</span></div>
          <span class="anchor-badge">挂载预览：{{ selected?.defaultAnchor || '未选择' }}</span>
        </div>
        <section class="composition-stage">
          <header><strong>道具组件层级</strong><small>点击组件后编辑局部变换、几何和材质；新组件默认成为当前组件的子项。</small></header>
          <div class="component-tree">
            <button v-for="component in selected?.components || []" :key="component.id" :class="{active:component.id===selectedComponent?.id}" :style="{paddingLeft:`${10 + (component.parentId ? 18 : 0)}px`}" @click="selectedComponentId=component.id"><span>{{ component.parentId ? '└' : '◆' }}</span><b>{{ component.name }}</b><small>{{ component.primitive }}</small></button>
          </div>
          <div class="component-palette"><button v-for="[id,label] in componentTypes" :key="id" :disabled="!selected || selected.components.length>=48" @click="addComponent(id)">+ {{ label }}</button></div>
        </section>
      </div>
    </div>

    <aside class="property-panel">
      <header><small>PROPERTIES</small><h2>道具属性</h2></header>
      <template v-if="selected">
        <div class="two"><label>中文名称<input :value="selected.nameZh" @change="patchName('nameZh',$event)"></label><label>英文名称<input :value="selected.nameEn" @change="patchName('nameEn',$event)"></label></div>
        <div class="two"><label>道具类型<select :value="selected.kind" @change="patchKind"><option value="composite">参数化组合</option><option value="effect">效果道具</option></select></label><label>默认挂载点<select :value="selected.defaultAnchor" @change="patchDefaultAnchor"><option v-for="[id,label] in anchorOptions" :key="id" :value="id">{{ label }}</option></select></label></div>
        <section v-if="selectedComponent" class="editor-card">
          <header><h3>组件</h3><div><button @click="duplicateComponent">复制</button><button class="danger" @click="deleteComponent">删除</button></div></header>
          <div class="two"><label>名称<input :value="selectedComponent.name" @change="patchComponentField('name',$event)"></label><label>形状<select :value="selectedComponent.primitive" @change="patchComponentField('primitive',$event)"><option v-for="[id,label] in componentTypes" :key="id" :value="id">{{ label }}</option></select></label></div>
          <label>父组件<select :value="selectedComponent.parentId || ''" @change="patchComponentField('parentId',$event)"><option value="">根组件</option><option v-for="item in selected.components.filter(item=>item.id!==selectedComponent?.id)" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <div v-for="field in ['position','rotation','scale'] as const" :key="field" class="vector-row"><b>{{ field }}</b><input v-for="axis in 3" :key="axis" :value="selectedComponent.transform[field][axis-1]" type="number" step=".05" @change="patchVector('transform',field,axis-1,$event)"></div>
          <div class="geometry-grid"><label v-for="field in ['width','height','depth','radius','tube','segments'] as const" :key="field">{{ field }}<input :value="selectedComponent.geometry[field]" type="number" step=".02" @change="patchGeometry(field,$event)"></label><label v-if="selectedComponent.primitive==='particles'">particleCount<input :value="selectedComponent.geometry.particleCount" type="number" min="0" max="240" @change="patchGeometry('particleCount',$event)"></label><label v-if="selectedComponent.primitive==='text'">text<input :value="selectedComponent.geometry.text" maxlength="48" @change="patchGeometry('text',$event)"></label></div>
          <div class="material-grid"><label>颜色<input :value="selectedComponent.material.color" type="color" @change="patchMaterial('color',$event)"></label><label>透明度<input :value="selectedComponent.material.opacity" type="number" min="0" max="1" step=".05" @change="patchMaterial('opacity',$event)"></label><label>金属度<input :value="selectedComponent.material.metalness" type="number" min="0" max="1" step=".05" @change="patchMaterial('metalness',$event)"></label><label>粗糙度<input :value="selectedComponent.material.roughness" type="number" min="0" max="1" step=".05" @change="patchMaterial('roughness',$event)"></label><label>发光色<input :value="selectedComponent.material.glowColor" type="color" @change="patchMaterial('glowColor',$event)"></label><label>发光<input :value="selectedComponent.material.glow" type="number" min="0" max="8" step=".1" @change="patchMaterial('glow',$event)"></label></div>
        </section>
        <section class="editor-card anchor-card">
          <header><h3>内部锚点</h3><div class="tabs"><button v-for="anchor in selected.anchors" :key="anchor.id" :class="{active:anchor.id===selectedAnchorId}" @click="selectedAnchorId=anchor.id">{{ anchor.id }}</button></div></header>
          <template v-if="selectedAnchor"><div v-for="field in ['position','rotation','scale'] as const" :key="field" class="vector-row"><b>{{ field }}</b><input v-for="axis in 3" :key="axis" :value="selectedAnchor.transform[field][axis-1]" type="number" step=".05" @change="patchAnchorVector(field,axis-1,$event)"></div></template>
        </section>
        <section class="editor-card"><header><h3>安全本地 GLB</h3><div><button @click="glbInput?.click()">导入 GLB</button><button v-if="selected.localModel" class="danger" @click="removeGlb">移除</button></div></header><p>仅接受 ≤2 MB、GLB v2、无外部 URI 的本地文件；不上传网络。</p><small v-if="selected.localModel">{{ selected.localModel.name }} · {{ selected.localModel.byteLength }} bytes</small><small v-if="glbStatus">{{ glbStatus }}</small></section><NuxtLink :to="`/studio/motion?prop=${selected.id}`">在动作工坊中测试</NuxtLink><code>{{ selected.id }}</code>
      </template>
      <div v-else class="empty">创建道具后可编辑组件树、几何、材质和内部锚点。</div>
    </aside>
  </section>
</template>

<style scoped>
.prop-workspace{display:grid;grid-template-columns:230px minmax(560px,1fr) 390px;gap:12px;min-height:calc(100dvh - 55px);padding:12px}.asset-panel,.editor-area,.property-panel{min-height:0;border:1px solid #ffffff17;border-radius:16px;background:#0d1120}.asset-panel,.property-panel{display:flex;flex-direction:column;gap:9px;padding:12px;overflow:auto}.asset-panel header,.editor-header,.editor-card>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-panel small,.editor-header small,.property-panel>header small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}h1,h2,h3,p{margin:0}.asset-panel h1,.editor-header h2,.property-panel h2{margin-top:5px;font-size:18px}.editor-header span{color:#76809e;font-size:8px}.asset-panel p{color:#8993b2;font-size:10px;line-height:1.55}.asset-panel button,.component-palette button,.editor-card button{border:1px solid #ffffff1c;border-radius:8px;color:#dfe5ff;background:#ffffff07}.asset-panel header button{min-height:32px;padding:0 9px}.asset-item{display:grid;gap:3px;padding:9px;text-align:left}.asset-item.active,.component-tree button.active,.tabs button.active{border-color:#52e0d066;background:#52e0d010}.asset-item small{font:400 8px/1.3 system-ui;color:#7883a3}.asset-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:auto}.asset-actions button{min-height:31px}.danger{border-color:#ff5f8655!important;color:#ff9bb3!important}.editor-area{display:grid;grid-template-rows:auto auto 1fr;overflow:hidden}.editor-header{padding:10px 12px;border-bottom:1px solid #ffffff13}.props-preview-toolbar{margin:10px 10px 0}.canvas-grid{display:grid;grid-template-columns:minmax(360px,1fr) minmax(300px,.8fr);gap:10px;min-height:0;padding:10px}.pet-preview,.composition-stage{position:relative;min-height:0;border:1px solid #ffffff12;border-radius:12px;background:#080c17}.preview-rotate-surface{position:absolute;z-index:5;inset:0;cursor:grab;touch-action:none}.preview-rotate-surface.dragging{cursor:grabbing}.preview-rotate-surface span{position:absolute;left:12px;bottom:10px;padding:5px 8px;border:1px solid #ffffff1b;border-radius:999px;color:#7f8ba9;background:#090e1bcc;font-size:8px;pointer-events:none}.anchor-badge{position:absolute;z-index:8;right:10px;bottom:10px;padding:5px 8px;border:1px solid #52e0d044;border-radius:999px;color:#dffffa;background:#0b1720db;font-size:8px}.composition-stage{display:grid;grid-template-rows:auto 1fr auto;padding:11px;overflow:hidden}.composition-stage>header{display:grid;gap:3px}.composition-stage>header small{color:#77819f;font-size:9px;line-height:1.4}.component-tree{display:flex;flex-direction:column;gap:4px;padding:10px 0;overflow:auto}.component-tree button{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;min-height:32px;border:1px solid #ffffff12;border-radius:7px;color:#cbd3ed;background:#ffffff04;text-align:left}.component-tree small{color:#77819f}.component-palette{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.component-palette button{min-height:32px}.property-panel label{display:grid;gap:4px;color:#b8c0da;font-size:9px}.property-panel input,.property-panel select{min-height:32px;padding:0 7px;border:1px solid #ffffff1d;border-radius:7px;color:#fff;background:#090e1b}.two{display:grid;grid-template-columns:1fr 1fr;gap:6px}.editor-card{display:grid;gap:8px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#ffffff04}.editor-card h3{font-size:11px}.editor-card header>div{display:flex;gap:4px}.editor-card button{min-height:28px;padding:0 7px}.vector-row{display:grid;grid-template-columns:62px repeat(3,1fr);gap:4px;align-items:center}.vector-row b{font:600 8px/1 ui-monospace,monospace;color:#8791ad}.vector-row input{width:100%;min-width:0}.geometry-grid,.material-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.tabs{display:flex;flex-wrap:wrap!important}.tabs button.active{color:#9ff9ec}.property-panel a{color:#72dfd1;font-size:10px}.property-panel code{overflow-wrap:anywhere;color:#6e7898;font-size:8px}.empty{padding:12px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px;line-height:1.5}@media(max-width:1280px){.prop-workspace{grid-template-columns:190px 1fr}.property-panel{grid-column:1/-1}.canvas-grid{grid-template-columns:1fr 340px}}@media(max-width:820px){.prop-workspace{grid-template-columns:1fr}.canvas-grid{grid-template-columns:1fr}.pet-preview{min-height:520px}.property-panel{max-height:none}}
</style>
