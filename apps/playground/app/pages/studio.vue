<!-- Pet Studio editor with auto-fit preview and compact schema-driven controls. -->
<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import {
  CLOUD_FOX_BODY_SHAPES, CLOUD_FOX_PART_OPTIONS, CLOUD_FOX_SPECIES_DEFINITION, derivePetMonogram,
  type CloudFoxAppearanceRecipe, type CloudFoxStudioBackground, type CloudFoxStudioBehavior, type CloudFoxStudioView,
} from '~/domain/cloud-fox-appearance'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type SectionId = 'identity' | 'face' | 'body' | 'tail' | 'glow' | 'symbols'
type ProportionKey = keyof CloudFoxAppearanceRecipe['proportions']
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges
const activeSection = ref<SectionId>('body')
const behavior = ref<CloudFoxStudioBehavior>('idle')
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const notice = ref('')
let behaviorTimer: number | undefined
let noticeTimer: number | undefined

const sections = [
  ['identity', '身份', 'ID'], ['face', '头部', '◉'], ['body', '身体', '◇'], ['tail', '尾巴与触角', '≈'], ['glow', '发光', '✦'], ['symbols', '标志', 'YK'],
] as const
const views = [['front', '正面'], ['left', '左侧'], ['back', '背面'], ['right', '右侧']] as const
const backgrounds = [['dark', '深色'], ['light', '浅色'], ['web', '网页']] as const
const behaviors: Array<[CloudFoxStudioBehavior, string, number]> = [
  ['idle', '待机', 0], ['greeting', '招手', 2600], ['jumping', '跳跃', 2100], ['stretching', '伸展', 3200], ['spinning', '转圈', 2600], ['resting', '趴下', 4200],
]
const proportionLabels: Partial<Record<ProportionKey, string>> = {
  bodyWidth: '身体宽度', bodyHeight: '身体高度', bodyDepth: '身体厚度', headScale: '头部大小', limbLength: '四肢长度', limbThickness: '四肢粗细', limbSpacing: '四肢间距',
  pawScale: '爪子大小', earScale: '耳朵大小', eyeScale: '眼睛大小', eyeSpacing: '眼睛间距', tailLength: '尾巴长度', tailWidth: '尾巴宽度', antennaScale: '触角大小',
}
const sectionProportions: Record<'face' | 'body' | 'tail', ProportionKey[]> = {
  face: ['headScale', 'earScale', 'eyeScale', 'eyeSpacing'],
  body: ['bodyWidth', 'bodyHeight', 'bodyDepth', 'limbLength', 'limbThickness', 'limbSpacing', 'pawScale'],
  tail: ['tailLength', 'tailWidth', 'antennaScale'],
}
const currentProportions = computed(() => activeSection.value === 'face' || activeSection.value === 'body' || activeSection.value === 'tail' ? sectionProportions[activeSection.value] : [])

useHead({ title: '宠物工坊 · YK-PETS', meta: [{ name: 'description', content: '创建宠物外观并验证动作、相机与安全比例。' }] })
onMounted(() => store.hydrate())
onBeforeUnmount(() => { if (behaviorTimer) clearTimeout(behaviorTimer); if (noticeTimer) clearTimeout(noticeTimer) })
function showNotice(message: string) { notice.value = message; if (noticeTimer) clearTimeout(noticeTimer); noticeTimer = window.setTimeout(() => notice.value = '', 2500) }
function markDirty() { store.markDirty() }
function setProportion(key: ProportionKey, event: Event) { recipe.value.proportions[key] = Number((event.target as HTMLInputElement).value); markDirty() }
function syncMonogram() { const monogram = derivePetMonogram(recipe.value.identity.nameEn); recipe.value.identity.monogram = monogram; recipe.value.symbols.chestText = monogram; markDirty() }
function playBehavior(next: CloudFoxStudioBehavior, duration: number) { if (behaviorTimer) clearTimeout(behaviorTimer); behavior.value = next; if (duration) behaviorTimer = window.setTimeout(() => behavior.value = 'idle', duration) }
function saveRecipe() { store.save(); showNotice('外观配方已保存。') }
function resetRecipe() { if (!confirm('恢复默认外观？')) return; store.reset(); behavior.value = 'idle'; view.value = 'front'; showNotice('已恢复默认外观。') }
function randomizeRecipe() { store.randomize(); showNotice('已生成新外观。') }
function openImport() { fileInput.value?.click() }
async function importRecipe(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; try { store.replace(JSON.parse(await file.text())); showNotice('配方已导入。') } catch { showNotice('JSON 配方无效。') } }
function exportRecipe() { const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${recipe.value.identity.petId || 'pet'}-appearance.json`; anchor.click(); URL.revokeObjectURL(url) }
</script>

<template>
  <main class="studio-page">
    <header class="studio-header">
      <div><NuxtLink to="/">← 返回 YK-PETS</NuxtLink><p class="eyebrow">PET STUDIO / 宠物工坊</p><h1>创建属于你的宠物</h1><p>相对挂载点、安全比例和自动镜头保证模型始终完整可见。</p></div>
      <div class="actions"><button @click="randomizeRecipe">随机生成</button><button @click="resetRecipe">恢复默认</button><button @click="openImport">导入</button><button @click="exportRecipe">导出</button><button class="primary" @click="saveRecipe">保存外观</button><input ref="fileInput" class="sr-only" type="file" accept="application/json,.json" @change="importRecipe"></div>
    </header>
    <div class="studio-layout">
      <aside class="section-nav"><button v-for="[id,label,icon] in sections" :key="id" :class="{active:activeSection===id}" @click="activeSection=id"><span>{{ icon }}</span>{{ label }}</button></aside>
      <section>
        <div class="preview-toolbar"><div>视角 <button v-for="[id,label] in views" :key="id" :class="{active:view===id}" @click="view=id as CloudFoxStudioView">{{ label }}</button></div><div>背景 <button v-for="[id,label] in backgrounds" :key="id" :class="{active:background===id}" @click="background=id as CloudFoxStudioBackground">{{ label }}</button></div></div>
        <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :view="view" :background="background" /><template #fallback><div class="fallback">正在装配宠物工坊…</div></template></ClientOnly>
        <div class="motion-tests"><span>动作兼容测试</span><button v-for="[id,label,duration] in behaviors" :key="id" :class="{active:behavior===id}" @click="playBehavior(id,duration)">{{ label }}</button></div>
      </section>
      <aside class="control-panel">
        <header><div><small>当前配方</small><strong>{{ recipe.identity.nameZh }} / {{ recipe.identity.nameEn }}</strong></div><b :class="{dirty:store.dirty}">{{ store.dirty ? '未保存' : '已保存' }}</b></header>
        <section class="controls">
          <template v-if="activeSection==='identity'">
            <h2>身份信息</h2><label>中文名字<input v-model="recipe.identity.nameZh" @input="markDirty"></label><label>英文名字<input v-model="recipe.identity.nameEn" @input="markDirty" @blur="syncMonogram"></label><label>稳定宠物 ID<input v-model="recipe.identity.petId" @input="markDirty"></label><label>名字缩写<input v-model="recipe.identity.monogram" maxlength="3" @input="markDirty"></label>
          </template>
          <template v-else-if="activeSection==='face'">
            <h2>头部与表情</h2><label>耳朵样式<select v-model="recipe.parts.ears" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.ears" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>眼睛样式<select v-model="recipe.parts.eyes" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.eyes" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>鼻子样式<select v-model="recipe.parts.nose" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.noses" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>嘴部样式<select v-model="recipe.parts.mouth" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.mouths" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
          </template>
          <template v-else-if="activeSection==='body'">
            <h2>身体与短圆润四肢</h2><p>宽度、高度、厚度可独立调整。</p><label>身体形状<select v-model="recipe.parts.bodyShape" @change="markDirty"><option v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
          </template>
          <template v-else-if="activeSection==='tail'">
            <h2>尾巴与头部触角</h2><label>尾巴样式<select v-model="recipe.parts.tail" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.tails" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><label>触角样式<select v-model="recipe.parts.antenna" @change="markDirty"><option v-for="item in CLOUD_FOX_PART_OPTIONS.antennas" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
          </template>
          <template v-else-if="activeSection==='glow'">
            <h2>统一发光通道</h2><label>模式<select v-model="recipe.glow.mode" @change="markDirty"><option value="fixed">固定颜色</option><option value="emotion">跟随动作</option><option value="rainbow">彩虹循环</option></select></label><label class="check"><input v-model="recipe.glow.tailEnabled" type="checkbox" @change="markDirty">尾巴发光</label><label class="check"><input v-model="recipe.glow.antennaEnabled" type="checkbox" @change="markDirty">触角发光</label><label>发光强度 {{ recipe.glow.intensity.toFixed(2) }}<input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @input="markDirty"></label>
          </template>
          <template v-else>
            <h2>身份标志</h2><label class="check"><input v-model="recipe.symbols.chestEnabled" type="checkbox" @change="markDirty">显示胸口标志</label><label>胸口文字<input v-model="recipe.symbols.chestText" maxlength="3" @input="markDirty"></label><label class="check"><input v-model="recipe.symbols.backEnabled" type="checkbox" @change="markDirty">显示后背标志</label><label>后背文字<input v-model="recipe.symbols.backText" maxlength="3" @input="markDirty"></label>
          </template>
          <label v-for="key in currentProportions" :key="key" class="range"><span>{{ proportionLabels[key] }} <b>{{ recipe.proportions[key].toFixed(2) }}</b></span><input type="range" :value="recipe.proportions[key]" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @input="setProportion(key,$event)"></label>
        </section>
      </aside>
    </div>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </main>
</template>

<style scoped>
:global(body){margin:0;background:#070912}:global(*){box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}.studio-page{min-height:100vh;padding:28px;color:#f2f4ff;background:radial-gradient(circle at 75% 5%,#7066ff30,transparent 28%),#070912;font-family:Inter,system-ui,sans-serif}.studio-header{display:flex;align-items:end;justify-content:space-between;gap:24px;max-width:1680px;margin:0 auto 22px}.studio-header a{color:#8fe9dd;text-decoration:none}.studio-header h1{margin:8px 0;font-size:clamp(34px,4vw,58px)}.studio-header p{margin:0;color:#aeb7d8}.eyebrow{margin-top:18px!important;color:#8d86ff!important;font-size:12px;font-weight:800;letter-spacing:.14em}.actions,.preview-toolbar,.motion-tests{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.actions{justify-content:flex-end}.actions button,.preview-toolbar button,.motion-tests button{border:1px solid #ffffff22;border-radius:10px;padding:8px 11px;color:#eef0ff;background:#ffffff0d}.primary,button.active{border-color:#7066ffcc!important;background:#7066ff33!important}.studio-layout{display:grid;grid-template-columns:140px minmax(500px,1fr) minmax(320px,390px);gap:16px;max-width:1680px;margin:auto}.section-nav,.control-panel,.preview-toolbar,.motion-tests{border:1px solid #ffffff18;background:#0e111ec7;backdrop-filter:blur(18px)}.section-nav{display:flex;flex-direction:column;align-self:start;position:sticky;top:18px;padding:8px;border-radius:18px}.section-nav button{display:flex;align-items:center;gap:8px;min-height:46px;border:0;border-radius:11px;padding:8px;color:#9da6c8;text-align:left;background:transparent}.section-nav span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#ffffff0d}.preview-toolbar{justify-content:space-between;margin-bottom:10px;padding:10px;border-radius:14px}.preview-toolbar>div{display:flex;align-items:center;gap:6px}.motion-tests{margin-top:10px;padding:10px;border-radius:14px}.motion-tests span{color:#9da6c8}.fallback{display:grid;place-items:center;min-height:620px;border-radius:28px;background:#0a0d18}.control-panel{align-self:start;position:sticky;top:18px;overflow:hidden;border-radius:22px}.control-panel>header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #ffffff16}.control-panel>header div{display:flex;flex-direction:column;gap:3px}.control-panel small{color:#7f89ae}.control-panel b{color:#6fe9d7}.control-panel b.dirty{color:#ffd36a}.controls{display:flex;flex-direction:column;gap:13px;max-height:calc(100vh - 120px);overflow:auto;padding:18px}.controls h2{margin:0}.controls p{margin:-5px 0 0;color:#8f99bd}.controls label{display:flex;flex-direction:column;gap:6px;color:#b9c0dc;font-size:13px}.controls input:not([type=range]):not([type=checkbox]),.controls select{min-height:40px;border:1px solid #ffffff1f;border-radius:10px;padding:8px 10px;color:#fff;background:#111526}.check{flex-direction:row!important;align-items:center;padding:9px;border:1px solid #ffffff16;border-radius:10px;background:#ffffff08}.range span{display:flex;justify-content:space-between}.range b{color:#8fe9dd}.range input{width:100%;accent-color:#7066ff}.notice{position:fixed;right:24px;bottom:22px;padding:11px 14px;border:1px solid #52e0d055;border-radius:12px;background:#0c2327f0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
@media(max-width:1050px){.studio-layout{grid-template-columns:100px 1fr 330px}.section-nav button{flex-direction:column;justify-content:center;font-size:11px}}@media(max-width:900px){.studio-page{padding:16px}.studio-header{align-items:start;flex-direction:column}.studio-layout{grid-template-columns:1fr}.section-nav{position:static;flex-direction:row;overflow:auto}.section-nav button{flex:0 0 90px}.control-panel{position:static}.controls{max-height:none}}
</style>
