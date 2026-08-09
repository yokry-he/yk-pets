<!--
  文件职责 / File responsibility
  为外观、动作、道具和资产库提供统一 Studio 顶层导航、共享上下文摘要与独立路由插槽。
  Provides the shared Studio navigation, context summary, and independent routed workspace slot for appearance, motion, props, and the asset library.
-->
<script setup lang="ts">
import StudioModelModeSwitch from '~/components/studio/StudioModelModeSwitch.vue'
import { createStudioPetModelVariants, type StudioModelMode } from '~/domain/studio-model-variants'
import { STUDIO_WORKSPACES, resolveStudioWorkspace } from '~/domain/studio-workspace'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioModelVariantsStore } from '~/stores/studio-model-variants'
import { useStudioSessionStore } from '~/stores/studio-session'

useHead({ bodyAttrs: { class: 'yk-pets-studio-page' } })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const modelVariants = useStudioModelVariantsStore()
const session = useStudioSessionStore()

const workspace = computed(() => resolveStudioWorkspace(route.path))
const selectedMotion = computed(() => assets.motions.find(item => item.id === session.selectedMotionId))
const selectedProp = computed(() => assets.props.find(item => item.id === session.selectedPropId))
const motionPath = computed(() => session.selectedMotionId ? `/studio/motion?motion=${encodeURIComponent(session.selectedMotionId)}` : '/studio/motion')
const propPath = computed(() => session.selectedPropId ? `/studio/props?prop=${encodeURIComponent(session.selectedPropId)}` : '/studio/props')
const currentPetId = computed(() => appearance.recipe.identity.petId.trim() || session.selectedAppearanceId || 'active-appearance')
const currentModelVariants = computed(() => modelVariants.byPetId[currentPetId.value] || createStudioPetModelVariants(currentPetId.value))
const modelModeSwitchVisible = false
const showModelNotice = ref(true)
watch(workspace, next => { if (session.hydrated) session.setWorkspace(next) }, { immediate: true })
watch(() => session.modelMode, mode => { if (mode === 'complex') showModelNotice.value = true })

function selectModelMode(mode: StudioModelMode) {
  modelVariants.ensurePet(currentPetId.value)
  if (mode === 'complex') modelVariants.ensureComplexDraft(currentPetId.value)
  session.setModelMode(mode)
}

onMounted(() => {
  // 布局与子工作区都在挂载后才读取 localStorage，避免父级先改变 Pinia 状态而使子页面 hydration 输入不一致。
  appearance.hydrate()
  assets.hydrate()
  modelVariants.hydrate()
  session.hydrate()
  session.setWorkspace(workspace.value)
  modelVariants.ensurePet(currentPetId.value)
  if (session.modelMode === 'complex') modelVariants.ensureComplexDraft(currentPetId.value)
})
</script>

<template>
  <div class="studio-shell">
    <header class="shell-bar">
      <div class="shell-brand"><NuxtLink to="/">YK-PETS</NuxtLink><span>工坊</span></div>
      <nav aria-label="Studio 工作区 / Studio workspaces">
        <NuxtLink v-for="item in STUDIO_WORKSPACES" :key="item.id" :to="item.path" :class="{ active: workspace === item.id }"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></NuxtLink>
      </nav>
      <ClientOnly>
        <StudioModelModeSwitch v-if="modelModeSwitchVisible" class="shell-model-mode" :model-value="session.modelMode" :complex-status="currentModelVariants.complex.status" :complex-completion="currentModelVariants.complex.completion" @update:model-value="selectModelMode" />
      </ClientOnly>
      <div class="shell-context" aria-label="当前 Studio 上下文">
        <NuxtLink to="/studio/appearance" title="编辑当前外观"><small>宠物 · {{ session.selectedAppearanceId }}</small><strong>{{ appearance.recipe.identity.nameZh }} / {{ appearance.recipe.identity.nameEn }}</strong></NuxtLink>
        <NuxtLink :to="motionPath" title="编辑当前动作"><small>动作</small><strong>{{ selectedMotion?.nameZh || '未选择' }}</strong></NuxtLink>
        <NuxtLink :to="propPath" title="编辑当前道具"><small>道具</small><strong>{{ selectedProp?.nameZh || '未选择' }}</strong></NuxtLink>
      </div>
    </header>
    <ClientOnly>
      <section v-if="session.modelMode === 'complex' && currentModelVariants.complex.status === 'draft' && showModelNotice" class="complex-model-notice" aria-live="polite">
        <div class="complex-model-notice-copy"><strong class="complex-model-notice-title">复杂模型草稿已自动建立</strong><span class="complex-model-notice-detail">简单与复杂模式共享工坊，复杂模型由站内配方自动生成；现有简单模型数据不会被覆盖。</span></div>
        <button type="button" class="complex-model-notice-close" aria-label="关闭复杂模型草稿说明" @click="showModelNotice = false">×</button>
      </section>
    </ClientOnly>
    <main class="shell-content"><slot /></main>
  </div>
</template>

<style scoped>
.studio-shell{min-height:100dvh;background:#080b14;color:#eef1ff}.shell-bar{position:sticky;z-index:80;top:0;display:grid;grid-template-columns:auto minmax(420px,1fr) auto auto;align-items:center;gap:12px;padding:8px 18px;border-bottom:1px solid #ffffff17;background:#090d18f2;backdrop-filter:blur(18px)}.shell-brand{display:flex;align-items:center;gap:7px;white-space:nowrap}.shell-brand a{color:#75dfd1;text-decoration:none;font-weight:900;font-size:11px}.shell-brand span{padding:3px 6px;border:1px solid #ffffff1a;border-radius:6px;color:#8993b4;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.shell-bar nav{display:flex;justify-content:center;gap:5px;min-width:0}.shell-bar nav a{display:grid;min-width:104px;gap:2px;padding:7px 10px;border:1px solid transparent;border-radius:10px;color:#aeb7d2;text-decoration:none;text-align:center}.shell-bar nav a:hover{background:#ffffff07}.shell-bar nav a.active{border-color:#52e0d058;color:#fff;background:linear-gradient(135deg,#7066ff1d,#52e0d012)}.shell-bar nav strong{font-size:11px}.shell-bar nav small{overflow:hidden;color:#77819f;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.shell-context{display:flex;justify-content:flex-end;gap:5px;min-width:0}.shell-context a{display:grid;min-width:88px;max-width:170px;padding:5px 8px;border:1px solid #ffffff12;border-radius:8px;color:#dce2f8;text-decoration:none;background:#ffffff05}.shell-context small{overflow:hidden;color:#6e7897;font-size:7px;text-overflow:ellipsis;white-space:nowrap}.shell-context strong{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.complex-model-notice{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 18px;border-bottom:1px solid #e7c8672e;color:#dfe6fa;background:#e7c8670c}.complex-model-notice-copy{display:flex;align-items:baseline;gap:9px;min-width:0}.complex-model-notice-title{color:#f0d78c;font-size:10px;white-space:nowrap}.complex-model-notice-detail{color:#919cb9;font-size:9px}.complex-model-notice-close{flex:0 0 30px;width:30px;height:30px;border:1px solid #ffffff18;border-radius:7px;color:#aeb8d2;background:#ffffff05;cursor:pointer}.complex-model-notice-close:focus-visible{outline:2px solid #76eadf;outline-offset:2px}.shell-content{min-height:calc(100dvh - 55px)}@media(max-width:1320px){.shell-bar{grid-template-columns:auto minmax(420px,1fr) auto}.shell-model-mode{grid-row:2;grid-column:1/3;justify-self:start}.shell-context{grid-row:2;grid-column:3;justify-self:end}}@media(max-width:960px){.shell-bar{grid-template-columns:auto 1fr}.shell-bar nav{justify-content:flex-end}.shell-model-mode{grid-row:2;grid-column:1/-1;justify-self:stretch}.shell-context{grid-row:3;grid-column:1/-1;justify-self:stretch;justify-content:flex-start}}@media(max-width:760px){.shell-bar{position:relative;grid-template-columns:1fr;padding:8px}.shell-bar nav{display:grid;grid-template-columns:repeat(2,1fr)}.shell-bar nav a{min-width:0}.shell-model-mode{grid-row:auto;grid-column:auto}.shell-context{grid-row:auto;grid-column:auto;display:grid;grid-template-columns:repeat(3,1fr)}.shell-context a{min-width:0;max-width:none}.complex-model-notice{align-items:flex-start;padding:8px}.complex-model-notice-copy{align-items:flex-start;flex-direction:column;gap:3px}.complex-model-notice-title{white-space:normal}}

/*
 * 动作工坊桌面布局修复：三栏共享同一视口高度，右侧标题与页签保持可见，
 * 仅当前页签内容滚动，并为右下悬浮入口预留安全空间。
 */
@media(min-width:1181px){
  :global(.motion-workspace){
    height:calc(100dvh - 55px)!important;
    min-height:680px!important;
    align-items:stretch!important;
    overflow:hidden!important;
  }
  :global(.motion-workspace .property-panel){
    position:relative!important;
    top:auto!important;
    align-self:stretch!important;
    height:100%!important;
    max-height:100%!important;
    overflow:hidden!important;
  }
  :global(.motion-workspace .property-tab-body){
    width:100%;
    height:100%!important;
    min-height:0!important;
    max-height:100%!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    padding:0 6px 76px 0!important;
    overscroll-behavior:contain;
    scrollbar-gutter:stable;
    scrollbar-width:thin;
    touch-action:pan-y;
    -webkit-overflow-scrolling:touch;
  }
}
</style>
