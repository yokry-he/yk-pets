<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import StudioEarEditor from '~/components/studio/StudioEarEditor.vue'
import StudioMotionToolbar from '~/components/studio/StudioMotionToolbar.vue'
import StudioTailEditor from '~/components/studio/StudioTailEditor.vue'
import { derivePetMonogram } from '~/domain/cloud-fox-appearance'
import { CLOUD_FOX_BODY_SHAPES, PET_STUDIO_PART_OPTIONS as PARTS, CLOUD_FOX_SPECIES_DEFINITION } from '~/domain/pet-studio-phase2'
import { getExtensionCloudFoxMotionDurationMs, type ExtensionCloudFoxMotionId } from '~/domain/chrome-extension-cloud-fox-motions'
import type { PetStudioAppearanceRecipe, SymbolChannelRecipe, CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase3'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'tail' | 'glow' | 'symbols' | 'audit'
type ProportionKey = keyof PetStudioAppearanceRecipe['proportions']
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges
const tab = ref<Tab>('body')
const behavior = ref<ExtensionCloudFoxMotionId>('idle')
const motionKey = ref(0)
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const notice = ref('')
let timer: number | undefined
let lastCheckpoint = 0

const tabs: Array<[Tab,string]> = [['identity','身份'],['face','头部'],['body','身体'],['tail','尾巴触角'],['glow','发光'],['symbols','标志'],['audit','检查']]
const views: Array<[CloudFoxStudioView,string]> = [['front','正面'],['left','左侧'],['back','背面'],['right','右侧']]
const backgrounds: Array<[CloudFoxStudioBackground,string]> = [['dark','深色'],['light','浅色'],['web','网页']]
const bodyControls: Array<[ProportionKey,string]> = [['bodyWidth','身体宽度'],['bodyHeight','身体高度'],['bodyDepth','身体厚度'],['limbLength','四肢长度'],['limbThickness','四肢粗细'],['limbSpacing','四肢间距'],['pawScale','爪子大小']]
const faceControls: Array<[ProportionKey,string]> = [['headScale','头部大小'],['earScale','耳朵大小'],['eyeScale','眼睛大小'],['eyeSpacing','眼睛间距']]
const symbolChannels = computed<Array<[string,SymbolChannelRecipe]>>(() => [['胸口',recipe.value.symbols.chest],['后背',recipe.value.symbols.back]])
const inputValue = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value
const inputNumber = (event: Event) => Number(inputValue(event))

function checkpoint() {
  const now = Date.now()
  if (now - lastCheckpoint > 180) { store.checkpoint(); lastCheckpoint = now }
}
function show(message: string) { notice.value = message; window.setTimeout(() => notice.value = '', 2200) }
function setProportion(key: ProportionKey, event: Event) { recipe.value.proportions[key] = inputNumber(event); store.markDirty() }
function setPart(key: 'eyes' | 'nose' | 'mouth' | 'bodyShape', event: Event) { store.patchParts({ [key]: inputValue(event) } as Partial<typeof recipe.value.parts>) }
function play(next: ExtensionCloudFoxMotionId) {
  if (timer) clearTimeout(timer)
  behavior.value = next
  motionKey.value += 1
  const duration = getExtensionCloudFoxMotionDurationMs(next)
  if (duration > 0) timer = window.setTimeout(() => { behavior.value = 'idle'; motionKey.value += 1 }, duration)
}
function syncName() { checkpoint(); const monogram = derivePetMonogram(recipe.value.identity.nameEn); recipe.value.identity.monogram = monogram; recipe.value.symbols.chest.text = monogram; store.markDirty() }
function save() { store.save(); show('外观配方已保存') }
function reset() { if (confirm('恢复扩展经典默认外观？')) { store.reset(); show('已恢复图 2 对应的扩展经典外观') } }
function exportRecipe() { const url=URL.createObjectURL(new Blob([store.exportJson()],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`${recipe.value.identity.petId}-appearance-v2.json`;anchor.click();URL.revokeObjectURL(url) }
async function importRecipe(event: Event) { const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';if(!file)return;try{store.replace(JSON.parse(await file.text()));show('配方已迁移并补齐局部外观字段')}catch{show('JSON 配方无效')} }
function refreshColors() { checkpoint(); store.refreshDerivedColors(); show('已重新生成高亮、暗部和光晕色') }
onMounted(() => store.hydrate())
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <main class="page">
    <header class="top">
      <div><NuxtLink to="/">← 返回 YK-PETS</NuxtLink><small>PET STUDIO / 宠物工坊</small><h1>创建属于你的宠物</h1><p>扩展经典外观是统一基线；调整哪个部位，就只改变哪个部位。</p></div>
      <div class="actions">
        <button :disabled="!store.canUndo" @click="store.undo">撤销</button><button :disabled="!store.canRedo" @click="store.redo">重做</button>
        <button @click="store.randomize();show('已随机生成')">随机生成</button><button @click="reset">恢复默认</button><button @click="fileInput?.click()">导入</button><button @click="exportRecipe">导出</button><button class="primary" @click="save">保存外观</button>
        <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe">
      </div>
    </header>

    <div class="layout">
      <nav><button v-for="[id,label] in tabs" :key="id" :class="{active:tab===id}" @click="tab=id">{{label}}<i v-if="id==='audit'&&store.findings.some(item=>item.severity==='warning')">!</i></button></nav>
      <section class="preview">
        <div class="toolbar"><span>视角</span><button v-for="[id,label] in views" :key="id" :class="{active:view===id}" @click="view=id">{{label}}</button><span>背景</span><button v-for="[id,label] in backgrounds" :key="id" :class="{active:background===id}" @click="background=id">{{label}}</button></div>
        <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :motion-key="motionKey" :view="view" :background="background"/><template #fallback><div class="loading">正在装配宠物…</div></template></ClientOnly>
        <StudioMotionToolbar :behavior="behavior" @play="play"/>
      </section>

      <aside>
        <header><strong>{{recipe.identity.nameZh}} / {{recipe.identity.nameEn}}</strong><b :class="{warn:store.dirty}">{{store.dirty?'未保存':'已保存'}}</b></header>
        <div class="controls">
          <template v-if="tab==='identity'">
            <h2>身份信息</h2><p>旧配方会自动迁移，默认图 2 样式不会因为局部编辑而丢失。</p>
            <label>中文名字<input v-model="recipe.identity.nameZh" @focus="checkpoint" @input="store.markDirty"></label>
            <label>英文名字<input v-model="recipe.identity.nameEn" @focus="checkpoint" @input="store.markDirty" @blur="syncName"></label>
            <label>宠物 ID<input v-model="recipe.identity.petId" @focus="checkpoint" @input="store.markDirty"></label>
          </template>

          <template v-else-if="tab==='face'">
            <h2>头部和表情</h2><StudioEarEditor/>
            <label>眼睛<select :value="recipe.parts.eyes" @focus="checkpoint" @change="setPart('eyes',$event)"><option v-for="item in PARTS.eyes" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label>鼻子<select :value="recipe.parts.nose" @focus="checkpoint" @change="setPart('nose',$event)"><option v-for="item in PARTS.noses" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label>嘴部<select :value="recipe.parts.mouth" @focus="checkpoint" @change="setPart('mouth',$event)"><option v-for="item in PARTS.mouths" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in faceControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input :value="recipe.proportions[key]" type="range" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @pointerdown="checkpoint" @input="setProportion(key,$event)"></label>
          </template>

          <template v-else-if="tab==='body'">
            <h2>扩展经典身体基线</h2>
            <label>身体形状<select :value="recipe.parts.bodyShape" @focus="checkpoint" @change="setPart('bodyShape',$event)"><option v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in bodyControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input :value="recipe.proportions[key]" type="range" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @pointerdown="checkpoint" @input="setProportion(key,$event)"></label>
            <button @click="refreshColors">根据主色生成光影色</button>
            <div class="swatches"><label>高亮<input v-model="recipe.palette.highlight" type="color" @focus="checkpoint" @input="store.markDirty"></label><label>暗部<input v-model="recipe.palette.shade" type="color" @focus="checkpoint" @input="store.markDirty"></label><label>光晕<input v-model="recipe.palette.halo" type="color" @focus="checkpoint" @input="store.markDirty"></label></div>
          </template>

          <StudioTailEditor v-else-if="tab==='tail'"/>

          <template v-else-if="tab==='glow'">
            <h2>全局发光</h2><label>模式<select v-model="recipe.glow.mode" @focus="checkpoint" @change="store.markDirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label>
            <label>强度 {{recipe.glow.intensity.toFixed(2)}}<input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @pointerdown="checkpoint" @input="store.markDirty"></label>
          </template>

          <template v-else-if="tab==='symbols'">
            <h2>独立胸背标志</h2><section v-for="[label,symbol] in symbolChannels" :key="label" class="card"><h3>{{label}}</h3><label class="check"><input v-model="symbol.enabled" type="checkbox" @focus="checkpoint" @change="store.markDirty">显示</label><label>文字<input v-model="symbol.text" maxlength="3" @focus="checkpoint" @input="store.markDirty"></label><label>颜色<input v-model="symbol.color" type="color" @focus="checkpoint" @input="store.markDirty"></label><label>缩放 {{symbol.scale.toFixed(2)}}<input v-model.number="symbol.scale" type="range" min=".45" max="1.8" step=".01" @pointerdown="checkpoint" @input="store.markDirty"></label><label>旋转 {{symbol.rotation.toFixed(2)}}<input v-model.number="symbol.rotation" type="range" min="-3.14" max="3.14" step=".02" @pointerdown="checkpoint" @input="store.markDirty"></label><label>发光 {{symbol.glowIntensity.toFixed(2)}}<input v-model.number="symbol.glowIntensity" type="range" min="0" max="4" step=".05" @pointerdown="checkpoint" @input="store.markDirty"></label></section>
          </template>

          <template v-else><h2>自动边界和穿模检查</h2><article v-for="finding in store.findings" :key="finding.id" :class="['finding',finding.severity]"><strong>{{finding.severity==='warning'?'需要注意':'检查结果'}}</strong><p>{{finding.message}}</p><code v-if="finding.path">{{finding.path}}</code></article></template>
        </div>
      </aside>
    </div>
    <p v-if="notice" class="notice">{{notice}}</p>
  </main>
</template>

<style scoped>
:global(body){margin:0;background:#070912}:global(*){box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}.page{min-height:100vh;padding:24px;color:#f3f5ff;background:radial-gradient(circle at 75% 4%,#7066ff33,transparent 28%),#070912;font-family:Inter,system-ui}.top{display:flex;justify-content:space-between;align-items:end;gap:20px;max-width:1680px;margin:auto auto 18px}.top a{color:#8fe9dd}.top small{display:block;margin-top:14px;color:#8d86ff}.top h1{margin:6px 0;font-size:clamp(34px,4vw,56px)}.top p{margin:0;color:#aeb7d8}.actions,.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.actions{justify-content:flex-end}.actions button,.toolbar button,.controls>button{border:1px solid #ffffff24;border-radius:9px;padding:7px 10px;color:#fff;background:#ffffff0d}.actions button:disabled{opacity:.4}.primary,button.active{border-color:#7066ff!important;background:#7066ff3d!important}.layout{display:grid;grid-template-columns:112px minmax(520px,1fr) 370px;gap:14px;max-width:1680px;margin:auto}nav,aside,.toolbar{border:1px solid #ffffff18;border-radius:16px;background:#0e111ecc;backdrop-filter:blur(16px)}nav{display:flex;flex-direction:column;align-self:start;padding:7px}nav button{position:relative;border:0;border-radius:10px;padding:12px;color:#aeb7d8;background:transparent}nav i{position:absolute;right:8px;color:#ffd36a}.toolbar{margin-bottom:9px;padding:9px}.loading{display:grid;place-items:center;min-height:620px}aside{align-self:start;overflow:hidden}aside>header{display:flex;justify-content:space-between;padding:15px;border-bottom:1px solid #ffffff18}aside b{color:#6fe9d7}.warn{color:#ffd36a!important}.controls{display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 95px);overflow:auto;padding:16px}.controls h2,.controls h3{margin:0}.controls>p{margin:0;color:#9da6c8;font-size:13px}.controls label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.controls input:not([type=range]):not([type=checkbox]):not([type=color]),.controls select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px;color:#fff;background:#111526}.controls input[type=range]{width:100%;accent-color:#7066ff}.controls input[type=color]{width:100%;height:36px;border:0;background:transparent}.check{flex-direction:row!important}.card,.finding{display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}.swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.finding p{margin:5px 0;color:#bbc2dc}.finding code{font-size:11px;color:#8fe9dd}.finding.warning{border-color:#ffd36a66;background:#ffd36a0d}.notice{position:fixed;right:22px;bottom:20px;padding:10px 13px;border:1px solid #52e0d055;border-radius:10px;background:#0c2327;color:#dffdfa}@media(max-width:1000px){.top{align-items:start;flex-direction:column}.layout{grid-template-columns:1fr}nav{flex-direction:row;overflow:auto}.controls{max-height:none}}
</style>
