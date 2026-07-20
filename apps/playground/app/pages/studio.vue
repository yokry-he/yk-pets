<script setup lang="ts">
import CloudFoxStudioCanvas from '~/components/studio/CloudFoxStudioCanvas.vue'
import { derivePetMonogram } from '~/domain/cloud-fox-appearance'
import {
  CLOUD_FOX_BODY_SHAPES,
  PET_STUDIO_PART_OPTIONS as PARTS,
  CLOUD_FOX_SPECIES_DEFINITION,
  MAX_TAIL_SEGMENTS,
  type PetStudioAppearanceRecipe,
  type CloudFoxStudioBackground,
  type CloudFoxStudioBehavior,
  type CloudFoxStudioView,
} from '~/domain/pet-studio-phase2'
import { usePetAppearanceStore } from '~/stores/pet-appearance'

type Tab = 'identity' | 'face' | 'body' | 'tail' | 'glow' | 'symbols'
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
const tabs: Array<[Tab,string]> = [['identity','身份'],['face','头部'],['body','身体'],['tail','尾巴触角'],['glow','发光'],['symbols','标志']]
const views: Array<[CloudFoxStudioView,string]> = [['front','正面'],['left','左侧'],['back','背面'],['right','右侧']]
const backgrounds: Array<[CloudFoxStudioBackground,string]> = [['dark','深色'],['light','浅色'],['web','网页']]
const motions: Array<[CloudFoxStudioBehavior,string]> = [['idle','待机'],['greeting','招手'],['jumping','跳跃'],['stretching','伸展'],['spinning','转圈'],['resting','趴下']]
const bodyControls: Array<[ProportionKey,string]> = [['bodyWidth','身体宽度'],['bodyHeight','身体高度'],['bodyDepth','身体厚度'],['limbLength','四肢长度'],['limbThickness','四肢粗细'],['limbSpacing','四肢间距'],['pawScale','爪子大小']]
const faceControls: Array<[ProportionKey,string]> = [['headScale','头部大小'],['earScale','耳朵大小'],['eyeScale','眼睛大小'],['eyeSpacing','眼睛间距']]
const show = (message:string) => { notice.value=message; window.setTimeout(()=>notice.value='',2200) }
const dirty = () => store.markDirty()
const setNumber = (target: Record<string,number>, key:string, event:Event) => { target[key]=Number((event.target as HTMLInputElement).value); dirty() }
onMounted(()=>store.hydrate())
onBeforeUnmount(()=>{ if(timer) clearTimeout(timer) })
function play(next:CloudFoxStudioBehavior){ if(timer)clearTimeout(timer); behavior.value=next; if(next!=='idle')timer=window.setTimeout(()=>behavior.value='idle',3200) }
function syncName(){ const value=derivePetMonogram(recipe.value.identity.nameEn); recipe.value.identity.monogram=value; recipe.value.symbols.chestText=value; dirty() }
function addSegment(){ if(recipe.value.tailDesign.segments.length>=MAX_TAIL_SEGMENTS)return; recipe.value.tailDesign.segments.push({length:.4,width:.15,rotationX:0,rotationY:0,rotationZ:0}); dirty() }
function removeSegment(index:number){ if(recipe.value.tailDesign.segments.length<=1)return; recipe.value.tailDesign.segments.splice(index,1); dirty() }
function save(){ store.save(); show('外观配方已保存') }
function reset(){ if(confirm('恢复默认外观？')){ store.reset(); show('已恢复默认外观') } }
function exportRecipe(){ const url=URL.createObjectURL(new Blob([store.exportJson()],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download=`${recipe.value.identity.petId}-appearance.json`; a.click(); URL.revokeObjectURL(url) }
async function importRecipe(event:Event){ const input=event.target as HTMLInputElement; const file=input.files?.[0]; input.value=''; if(!file)return; try{ store.replace(JSON.parse(await file.text())); show('配方已导入') }catch{ show('JSON 配方无效') } }
</script>

<template>
  <main class="page">
    <header class="top">
      <div><NuxtLink to="/">← 返回 YK-PETS</NuxtLink><small>PET STUDIO / 宠物工坊</small><h1>创建属于你的宠物</h1><p>完整显示、相对挂载、安全比例与动作叠加偏移。</p></div>
      <div class="actions"><button @click="store.randomize();show('已随机生成')">随机生成</button><button @click="reset">恢复默认</button><button @click="fileInput?.click()">导入</button><button @click="exportRecipe">导出</button><button class="primary" @click="save">保存外观</button><input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importRecipe"></div>
    </header>
    <div class="layout">
      <nav><button v-for="[id,label] in tabs" :key="id" :class="{active:tab===id}" @click="tab=id">{{ label }}</button></nav>
      <section class="preview">
        <div class="toolbar"><span>视角</span><button v-for="[id,label] in views" :key="id" :class="{active:view===id}" @click="view=id">{{label}}</button><span>背景</span><button v-for="[id,label] in backgrounds" :key="id" :class="{active:background===id}" @click="background=id">{{label}}</button></div>
        <ClientOnly><CloudFoxStudioCanvas :appearance="recipe" :behavior="behavior" :view="view" :background="background" /><template #fallback><div class="loading">正在装配宠物…</div></template></ClientOnly>
        <div class="toolbar"><span>动作测试</span><button v-for="[id,label] in motions" :key="id" :class="{active:behavior===id}" @click="play(id)">{{label}}</button></div>
      </section>
      <aside>
        <header><strong>{{recipe.identity.nameZh}} / {{recipe.identity.nameEn}}</strong><b :class="{warn:store.dirty}">{{store.dirty?'未保存':'已保存'}}</b></header>
        <div class="controls">
          <template v-if="tab==='identity'">
            <h2>身份信息</h2><label>中文名字<input v-model="recipe.identity.nameZh" @input="dirty"></label><label>英文名字<input v-model="recipe.identity.nameEn" @input="dirty" @blur="syncName"></label><label>宠物 ID<input v-model="recipe.identity.petId" @input="dirty"></label>
          </template>
          <template v-else-if="tab==='face'">
            <h2>头部和表情</h2><label v-for="[key,label,options] in [['ears','耳朵',PARTS.ears],['eyes','眼睛',PARTS.eyes],['nose','鼻子',PARTS.noses],['mouth','嘴部',PARTS.mouths]]" :key="key">{{label}}<select v-model="recipe.parts[key as 'ears']" @change="dirty"><option v-for="item in options" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in faceControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input type="range" :value="recipe.proportions[key]" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @input="setNumber(recipe.proportions,key,$event)"></label>
          </template>
          <template v-else-if="tab==='body'">
            <h2>模型和短圆润四肢</h2><label>身体形状<select v-model="recipe.parts.bodyShape" @change="dirty"><option v-for="item in CLOUD_FOX_BODY_SHAPES" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="[key,label] in bodyControls" :key="key">{{label}} {{recipe.proportions[key].toFixed(2)}}<input type="range" :value="recipe.proportions[key]" :min="ranges[key][0]" :max="ranges[key][1]" step=".01" @input="setNumber(recipe.proportions,key,$event)"></label>
          </template>
          <template v-else-if="tab==='tail'">
            <h2>分段尾巴与组合触角</h2><label>尾巴朝向<select v-model="recipe.tailDesign.direction" @change="dirty"><option value="left">向左</option><option value="right">向右</option><option value="up">向上</option><option value="down">向下</option><option value="back">向后</option><option value="forward">向前</option></select></label>
            <div class="row"><b>尾巴 {{recipe.tailDesign.segments.length}} / {{MAX_TAIL_SEGMENTS}} 段</b><button @click="addSegment">增加</button></div>
            <details v-for="(segment,index) in recipe.tailDesign.segments" :key="index"><summary>第 {{index+1}} 段 <button @click.prevent="removeSegment(index)">删除</button></summary><label v-for="key in ['length','width','rotationX','rotationY','rotationZ']" :key="key">{{key}} {{segment[key as 'length'].toFixed(2)}}<input v-model.number="segment[key as 'length']" type="range" :min="key==='length'?'.18':key==='width'?'.08':'-3.14'" :max="key==='length'?'.9':key==='width'?'.42':'3.14'" step=".02" @input="dirty"></label></details>
            <label>触角开关<select v-model="recipe.parts.antenna" @change="dirty"><option v-for="item in PARTS.antennas" :key="item.id" :value="item.id">{{item.label}}</option></select></label><label>杆体<select v-model="recipe.parts.antennaRod" @change="dirty"><option v-for="item in PARTS.antennaRods" :key="item.id" :value="item.id">{{item.label}}</option></select></label><label>末端<select v-model="recipe.parts.antennaTip" @change="dirty"><option v-for="item in PARTS.antennaTips" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <label v-for="key in ['spacing','length','thickness','tilt']" :key="key">触角 {{key}} {{recipe.antennaDesign[key as 'spacing'].toFixed(2)}}<input v-model.number="recipe.antennaDesign[key as 'spacing']" type="range" :min="key==='spacing'?'.18':key==='length'?'.24':key==='thickness'?'.018':'-.72'" :max="key==='spacing'?'.82':key==='length'?'1.2':key==='thickness'?'.1':'.72'" step=".01" @input="dirty"></label>
          </template>
          <template v-else-if="tab==='glow'"><h2>发光</h2><label>模式<select v-model="recipe.glow.mode" @change="dirty"><option value="fixed">固定</option><option value="emotion">动作联动</option><option value="rainbow">彩虹</option></select></label><label>强度 {{recipe.glow.intensity.toFixed(2)}}<input v-model.number="recipe.glow.intensity" type="range" :min="ranges.glowIntensity[0]" :max="ranges.glowIntensity[1]" step=".05" @input="dirty"></label></template>
          <template v-else><h2>胸口和后背标志</h2><label class="check"><input v-model="recipe.symbols.chestEnabled" type="checkbox" @change="dirty">显示胸口标志</label><label>胸口文字<input v-model="recipe.symbols.chestText" maxlength="3" @input="dirty"></label><label class="check"><input v-model="recipe.symbols.backEnabled" type="checkbox" @change="dirty">显示后背标志</label><label>后背文字<input v-model="recipe.symbols.backText" maxlength="3" @input="dirty"></label></template>
        </div>
      </aside>
    </div>
    <p v-if="notice" class="notice">{{notice}}</p>
  </main>
</template>

<style scoped>
:global(body){margin:0;background:#070912}:global(*){box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}.page{min-height:100vh;padding:24px;color:#f3f5ff;background:radial-gradient(circle at 75% 4%,#7066ff33,transparent 28%),#070912;font-family:Inter,system-ui}.top{display:flex;justify-content:space-between;align-items:end;gap:20px;max-width:1680px;margin:auto auto 18px}.top a{color:#8fe9dd}.top small{display:block;margin-top:14px;color:#8d86ff}.top h1{margin:6px 0;font-size:clamp(34px,4vw,56px)}.top p{margin:0;color:#aeb7d8}.actions,.toolbar,.row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.actions{justify-content:flex-end}.actions button,.toolbar button,.row button,summary button{border:1px solid #ffffff24;border-radius:9px;padding:7px 10px;color:#fff;background:#ffffff0d}.primary,button.active{border-color:#7066ff!important;background:#7066ff3d!important}.layout{display:grid;grid-template-columns:105px minmax(520px,1fr) 350px;gap:14px;max-width:1680px;margin:auto}nav,aside,.toolbar{border:1px solid #ffffff18;border-radius:16px;background:#0e111ecc;backdrop-filter:blur(16px)}nav{display:flex;flex-direction:column;align-self:start;padding:7px}nav button{border:0;border-radius:10px;padding:12px;color:#aeb7d8;background:transparent}.toolbar{margin-bottom:9px;padding:9px}.preview>.toolbar:last-child{margin:9px 0 0}.loading{display:grid;place-items:center;min-height:620px}aside{align-self:start;overflow:hidden}aside>header{display:flex;justify-content:space-between;padding:15px;border-bottom:1px solid #ffffff18}aside b{color:#6fe9d7}.warn{color:#ffd36a!important}.controls{display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 95px);overflow:auto;padding:16px}.controls h2{margin:0}.controls label{display:flex;flex-direction:column;gap:5px;color:#bbc2dc;font-size:13px}.controls input:not([type=range]):not([type=checkbox]),.controls select{min-height:38px;border:1px solid #ffffff22;border-radius:9px;padding:7px 9px;color:#fff;background:#111526}.controls input[type=range]{width:100%;accent-color:#7066ff}.check{flex-direction:row!important}.row{justify-content:space-between}details{padding:8px;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08}summary{display:flex;justify-content:space-between}.notice{position:fixed;right:22px;bottom:20px;padding:10px 13px;border:1px solid #52e0d066;border-radius:11px;background:#0c2327f2}@media(max-width:960px){.top{align-items:start;flex-direction:column}.layout{grid-template-columns:1fr}nav{flex-direction:row;overflow:auto}aside{position:static}.controls{max-height:none}}
</style>
