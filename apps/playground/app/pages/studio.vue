<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import { derivePetMonogram } from '~/domain/cloud-fox-appearance'
import {
  CLOUD_FOX_BODY_SHAPES,
  PET_STUDIO_PART_OPTIONS as PARTS,
  CLOUD_FOX_SPECIES_DEFINITION,
  MAX_TAIL_SEGMENTS,
} from '~/domain/pet-studio-phase2'
import type {
  PetStudioAppearanceRecipe,
  SymbolChannelRecipe,
  CloudFoxStudioBackground,
  CloudFoxStudioBehavior,
  CloudFoxStudioView,
} from '~/domain/pet-studio-phase3'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'tail' | 'glow' | 'symbols' | 'audit'
type ProportionKey = keyof PetStudioAppearanceRecipe['proportions']
const store = usePetAppearanceStore()
const recipe = computed(() => store.recipe)
const ranges = CLOUD_FOX_SPECIES_DEFINITION.safeRanges
const tab = ref<Tab>('body')
const behavior = ref<CloudFoxStudioBehavior>('idle')
const view = ref<CloudFoxStudioView>('front')
const background = ref<CloudFoxStudioBackground>('dark')
const fileInput = ref<HTMLInputElement>()
const notice = ref('')
let timer: number | undefined
let lastCheckpoint = 0
const tabs: Array<[Tab, string]> = [['identity','身份'],['face','头部'],['body','身体'],['tail','尾巴触角'],['glow','发光'],['symbols','标志'],['audit','检查']]
const views: Array<[CloudFoxStudioView,string]> = [['front','正面'],['left','左侧'],['back','背面'],['right','右侧']]
const backgrounds: Array<[CloudFoxStudioBackground,string]> = [['dark','深色'],['light','浅色'],['web','网页']]
const motions: Array<[CloudFoxStudioBehavior,string]> = [['idle','待机'],['greeting','招手'],['jumping','跳跃'],['stretching','伸展'],['spinning','转圈'],['resting','趴下']]
const bodyControls: Array<[ProportionKey,string]> = [['bodyWidth','身体宽度'],['bodyHeight','身体高度'],['bodyDepth','身体厚度'],['limbLength','四肢长度'],['limbThickness','四肢粗细'],['limbSpacing','四肢间距'],['pawScale','爪子大小']]
const faceControls: Array<[ProportionKey,string]> = [['headScale','头部大小'],['earScale','耳朵大小'],['eyeScale','眼睛大小'],['eyeSpacing','眼睛间距']]
const symbolChannels = computed<Array<[string, SymbolChannelRecipe]>>(() => [['胸口', recipe.value.symbols.chest], ['后背', recipe.value.symbols.back]])
const show = (message: string) => { notice.value = message; window.setTimeout(() => notice.value = '', 2200) }
const dirty = () => store.markDirty()
function checkpoint() {
  const now = Date.now()
  if (now - lastCheckpoint > 180) { store.checkpoint(); lastCheckpoint = now }
}
const setNumber = (target: Record<string, number>, key: string, event: Event) => { target[key] = Number((event.target as HTMLInputElement).value); dirty() }
onMounted(() => store.hydrate())
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
function play(next: CloudFoxStudioBehavior) { if (timer) clearTimeout(timer); behavior.value = next; if (next !== 'idle') timer = window.setTimeout(() => behavior.value = 'idle', 3200) }
function syncName() { checkpoint(); const value = derivePetMonogram(recipe.value.identity.nameEn); recipe.value.identity.monogram = value; recipe.value.symbols.chest.text = value; dirty() }
function addSegment() { if (recipe.value.tailDesign.segments.length >= MAX_TAIL_SEGMENTS) return; checkpoint(); recipe.value.tailDesign.segments.push({ length: .4, width: .15, rotationX: 0, rotationY: 0, rotationZ: 0 }); dirty() }
function removeSegment(index: number) { if (recipe.value.tailDesign.segments.length <= 1) return; checkpoint(); recipe.value.tailDesign.segments.splice(index, 1); dirty() }
function save() { store.save(); show('外观配方已保存') }
function reset() { if (confirm('恢复默认外观？')) { store.reset(); show('已恢复默认外观') } }
function exportRecipe() { const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${recipe.value.identity.petId}-appearance-v2.json`; anchor.click(); URL.revokeObjectURL(url) }
async function importRecipe(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; try { store.replace(JSON.parse(await file.text())); show('配方已迁移到 schema v2') } catch { show('JSON 配方无效') } }
function refreshColors() { checkpoint(); store.refreshDerivedColors(); show('已重新生成高亮、暗部和光晕色') }
</script>

<template>
  <main class="page">
    <header class="top">
      <div><NuxtLink to="/">← 返回 YK-PETS</NuxtLink><small>PET STUDIO / 宠物工坊</small><h1>创建属于你的宠物</h1><p>schema v2、独立标志、撤销重做和自动穿模检查。</p></div>
      <div class="actions">
        <button :disabled="!store.canUndo" @click="store.undo">撤销</button><button :disabled="!store.canRedo" @click="store.redo">重做</button>
        <button @click="store.randomize();show('已随机生成')">随机生成</button><button @click="reset">恢复默认</button><button @click="fileInput?.click()">导入</button><button @click="exportRecipe">导出</button><button class="primary" @click="save">保存外观</button>
        <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe">
      </div>
    </header>
    <div class="layout">
      <nav><button v-for="[id,label] in tabs" :key="id" :class="{active:tab===id}" @click="tab=id">{{ label }}<i v-if="id==='audit' && store.findings.some(item=>item.severity==='warning')">!</i></button></nav>
      <section class="preview">
        <div class="toolbar"><span>视角</span><button v-for="[id,label] in views" :key="id" :class="{active:view===id}" @click="view=id">{{label}}</button><span>背景</span><button v-for="[id,label] in backgrounds" :key="id" :class="{active:background===id}" @click="background=id">{{label}}</button></div>
        <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :view="view" :background="background" /><template #fallback><div class="loading">正在装配宠物…</div></template></ClientOnly>
        <div class="toolbar"><span>动作测试</span><button v-for="[id,label] in motions" :key="id" :class="{active:behavior===id}" @click="play(id)">{{label}}</button></div>
      </section>
      <aside>
        <header><strong>{{recipe.identity.nameZh}} / {{recipe.identity.nameEn}}</strong><b :class="{warn:store.dirty}">{{store.dirty?'未保存':'已保存'}}</b></header>
        <div class="controls">
          <template v-if="tab==='identity'">
            <h2>身份信息</h2><p>旧版配方导入后会自动迁移为 schemaVersion 2。</p>
            <label>中文名字<input v-model="recipe.identity.nameZh" @focus="checkpoint" @input="dirty"></label><label>英文名字<input v-model="recipe.identity.nameEn" @focus="checkpoint" @input="dirty" @blur="syncName"></label><label>宠物 ID<input v-model="recipe.identity.petId" @focus="checkpoint" @input="dirty"></label>
          </template>
          <template v-else-if="tab==='face'">
            <h2>头部和表情</h2><label v-for="[key,label,options] in [['ears','耳朵',PARTS.ears],['eyes','眼睛',PARTS.eyes],['nose','鼻子',PARTS.noses],['mouth','嘴部',PARTS.mouths]]" :key="key">{{label}}<select v-model="recipe.parts[key as 'ears']" @focus="checkpoint" @change="dirty"><option v-for="item in options" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in faceControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input type="range" :value="recipe.proportions[key]" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @pointerdown="checkpoint" @input="setNumber(recipe.proportions,key,$event)"></label>
          </template>
          <template v-else-if="tab==='body'">
            <h2>模型和短圆润四肢</h2><label>身体形状<select v-model="recipe.parts.bodyShape" @focus="checkpoint" @change="dirty"><option v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in bodyControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input type="range" :value="recipe.proportions[key]" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @pointerdown="checkpoint" @input="setNumber(recipe.proportions,key,$event)"></label>
            <button @click="refreshColors">根据主色自动生成光影色</button><div class="swatches"><label>高亮<input v-model="recipe.palette.highlight" type="color" @focus="checkpoint" @input="dirty"></label><label>暗部<input v-model="recipe.palette.shade" type="color" @focus="checkpoint" @input="dirty"></label><label>光晕<input v-model="recipe.palette.halo" type="color" @focus="checkpoint" @input="dirty"></label></div>
          </template>
          <template v-else-if="tab==='tail'">
            <h2>分段尾巴与组合触角</h2><label>尾巴朝向<select v-model="recipe.tailDesign.direction" @focus="checkpoint" @change="dirty"><option value="left">向左</option><option value="right">向右</option><option value="up">向上</option><option value="down">向下</option><option value="back">向后</option><option value="forward">向前</option></select></label>
            <div class="row"><b>尾巴 {{recipe.tailDesign.segments.length}} / {{MAX_TAIL_SEGMENTS}} 段</b><button @click="addSegment">增加</button></div>
            <details v-for="(segment,index) in recipe.tailDesign.segments" :key="index"><summary>第 {{index+1}} 段 <button @click.prevent="removeSegment(index)">删除</button></summary><label v-for="key in ['length','width','rotationX','rotationY','rotationZ']" :key="key">{{key}} {{segment[key as 'length'].toFixed(2)}}<input v-model.number="segment[key as 'length']" type="range" :min="key==='length'?'.18':key==='width'?'.08':'-3.14'" :max="key==='length'?'.9':key==='width'?'.42':'3.14'" step=".02" @pointerdown="checkpoint" @input="dirty"></label></details>
            <label>触角开关<select v-model="recipe.parts.antenna" @focus="checkpoint" @change="dirty"><option v-for="item in PARTS.antennas" :key="item.id" :value="item.id">{{item.label}}</option></select></label><label>杆体<select v-model="recipe.parts.antennaRod" @focus="checkpoint" @change="dirty"><option v-for="item in PARTS.antennaRods" :key="item.id" :value="item.id">{{item.label}}</option></select></label><label>末端<select v-model="recipe.parts.antennaTip" @focus="checkpoint" @change="dirty"><option v-for="item in PARTS.antennaTips" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="key in ['spacing','length','thickness','tilt']" :key="key">触角 {{key}} {{recipe.antennaDesign[key as 'spacing'].toFixed(2)}}<input v-model.number="recipe.antennaDesign[key as 'spacing']" type="range" :min="key==='spacing'?'.18':key==='length'?'.24':key==='thickness'?'.018':'-.72'" :max="key==='spacing'?'.82':key==='length'?'1.2':key==='thickness'?'.1':'.72'" step=".01" @pointerdown="checkpoint" @input="dirty"></label>
          </template>
          <template v-else-if="tab==='glow'"><h2>发光</h2><label>模式<select v-model="recipe.glow.mode" @focus="checkpoint" @change="dirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label><label>强度 {{recipe.glow.intensity.toFixed(2)}}<input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @pointerdown="checkpoint" @input="dirty"></label></template>
          <template v-else-if="tab==='symbols'">
            <h2>独立胸背标志</h2><section v-for="[label,symbol] in symbolChannels" :key="label" class="symbol-card"><h3>{{label}}</h3><label class="check"><input v-model="symbol.enabled" type="checkbox" @focus="checkpoint" @change="dirty">显示</label><label>文字<input v-model="symbol.text" maxlength="3" @focus="checkpoint" @input="dirty"></label><label>颜色<input v-model="symbol.color" type="color" @focus="checkpoint" @input="dirty"></label><label>缩放 {{symbol.scale.toFixed(2)}}<input v-model.number="symbol.scale" type="range" min=".45" max="1.8" step=".01" @pointerdown="checkpoint" @input="dirty"></label><label>旋转 {{symbol.rotation.toFixed(2)}}<input v-model.number="symbol.rotation" type="range" min="-3.14" max="3.14" step=".02" @pointerdown="checkpoint" @input="dirty"></label><label>发光 {{symbol.glowIntensity.toFixed(2)}}<input v-model.number="symbol.glowIntensity" type="range" min="0" max="4" step=".05" @pointerdown="checkpoint" @input="dirty"></label></section>
          </template>
          <template v-else><h2>自动边界和穿模检查</h2><article v-for="finding in store.findings" :key="finding.id" :class="['finding',finding.severity]"><strong>{{finding.severity==='warning'?'需要注意':'检查结果'}}</strong><p>{{finding.message}}</p><code v-if="finding.path">{{finding.path}}</code></article></template>
        </div>
      </aside>
    </div>
    <p v-if="notice" class="notice">{{notice}}</p>
  </main>
</template>

<style scoped>
:global(body){margin:0;background:#070912}:global(*){box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}.page{min-height:100vh;padding:24px;color:#f3f5ff;background:radial-gradient(circle at 75% 4%,#7066ff33,transparent 28%),#070912;font-family:Inter,system-ui}.top{display:flex;justify-content:space-between;align-items:end;gap:20px;max-width:1680px;margin:auto auto 18px}.top a{color:#8fe9dd}.top small{display:block;margin-top:14px;color:#8d86ff}.top h1{margin:6px 0;font-size:clamp(34px,4vw,56px)}.top p{margin:0;color:#aeb7d8}.actions,.toolbar,.row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.actions{justify-content:flex-end}.actions button,.toolbar button,.row button,summary button,.controls>button{border:1px solid #ffffff24;border-radius:9px;padding:7px 10px;color:#fff;background:#ffffff0d}.actions button:disabled{opacity:.4;cursor:not-allowed}.primary,button.active{border-color:#7066ff!important;background:#7066ff3d!important}.layout{display:grid;grid-template-columns:112px minmax(520px,1fr) 370px;gap:14px;max-width:1680px;margin:auto}nav,aside,.toolbar{border:1px solid #ffffff18;border-radius:16px;background:#0e111ecc;backdrop-filter:blur(16px)}nav{display:flex;flex-direction:column;align-self:start;padding:7px}nav button{position:relative;border:0;border-radius:10px;padding:12px;color:#aeb7d8;background:transparent}nav i{position:absolute;right:8px;color:#ffd36a}.toolbar{margin-bottom:9px;padding:9px}.preview>.toolbar:last-child{margin:9px 0 0}.loading{display:grid;place-items:center;min-height:620px}aside{align-self:start;overflow:hidden}aside>header{display:flex;justify-content:space-between;padding:15px;border-bottom:1px solid #ffffff18}aside b{color:#6fe9d7}.warn{color:#ffd36a!important}.controls{display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 95px);overflow:auto;padding:16px}.controls h2,.controls h3{margin:0}.controls>p{margin:0;color:#9da6c8;font-size:13px}.controls label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.controls input:not([type=range]):not([type=checkbox]):not([type=color]),.controls select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px 9px;color:#fff;background:#111526}.controls input[type=range]{width:100%;accent-color:#7066ff}.controls input[type=color]{width:100%;height:36px;border:0;background:transparent}.check{flex-direction:row!important}.row{justify-content:space-between}details,.symbol-card,.finding{padding:10px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}summary{display:flex;justify-content:space-between}.swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.symbol-card{display:flex;flex-direction:column;gap:9px}.finding p{margin:5px 0;color:#bbc2dc}.finding code{font-size:11px;color:#8fe9dd}.finding.warning{border-color:#ffd36a66;background:#ffd36a0d}.notice{position:fixed;right:22px;bottom:20px;padding:10px 13px;border:1px solid #52e0d055;border-radius:10px;background:#0c2327;color:#dffdfa}@media(max-width:1000px){.top{align-items:start;flex-direction:column}.layout{grid-template-columns:1fr}nav{flex-direction:row;overflow:auto}.controls{max-height:none}}
</style>
