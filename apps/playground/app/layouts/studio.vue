<!--
  文件职责 / File responsibility
  为外观、动作、道具和资产库提供统一 Studio 顶层导航、共享上下文摘要与独立路由插槽。
  Provides the shared Studio navigation, context summary, and independent routed workspace slot for appearance, motion, props, and the asset library.
-->
<script setup lang="ts">
import { STUDIO_WORKSPACES, resolveStudioWorkspace } from '~/domain/studio-workspace'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioSessionStore } from '~/stores/studio-session'

useHead({ bodyAttrs: { class: 'yk-pets-studio-page' } })
const route = useRoute()
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const session = useStudioSessionStore()
appearance.hydrate()
assets.hydrate()
session.hydrate()

const workspace = computed(() => resolveStudioWorkspace(route.path))
const selectedMotion = computed(() => assets.motions.find(item => item.id === session.selectedMotionId))
const selectedProp = computed(() => assets.props.find(item => item.id === session.selectedPropId))
const motionPath = computed(() => session.selectedMotionId ? `/studio/motion?motion=${encodeURIComponent(session.selectedMotionId)}` : '/studio/motion')
const propPath = computed(() => session.selectedPropId ? `/studio/props?prop=${encodeURIComponent(session.selectedPropId)}` : '/studio/props')
watch(workspace, next => session.setWorkspace(next), { immediate: true })
</script>

<template>
  <div class="studio-shell">
    <header class="shell-bar">
      <div class="shell-brand"><NuxtLink to="/">YK-PETS</NuxtLink><span>STUDIO</span></div>
      <nav aria-label="Studio 工作区 / Studio workspaces">
        <NuxtLink v-for="item in STUDIO_WORKSPACES" :key="item.id" :to="item.path" :class="{ active: workspace === item.id }"><strong>{{ item.label }}</strong><small>{{ item.labelEn }}</small></NuxtLink>
      </nav>
      <div class="shell-context" aria-label="当前 Studio 上下文">
        <NuxtLink to="/studio/appearance" title="编辑当前外观"><small>宠物</small><strong>{{ appearance.recipe.identity.nameZh }} / {{ appearance.recipe.identity.nameEn }}</strong></NuxtLink>
        <NuxtLink :to="motionPath" title="编辑当前动作"><small>动作</small><strong>{{ selectedMotion?.nameZh || '未选择' }}</strong></NuxtLink>
        <NuxtLink :to="propPath" title="编辑当前道具"><small>道具</small><strong>{{ selectedProp?.nameZh || '未选择' }}</strong></NuxtLink>
      </div>
    </header>
    <main class="shell-content"><slot /></main>
  </div>
</template>

<style scoped>
.studio-shell{min-height:100dvh;background:#080b14;color:#eef1ff}.shell-bar{position:sticky;z-index:80;top:0;display:grid;grid-template-columns:auto minmax(420px,1fr) auto;align-items:center;gap:14px;padding:8px 18px;border-bottom:1px solid #ffffff17;background:#090d18f2;backdrop-filter:blur(18px)}.shell-brand{display:flex;align-items:center;gap:7px;white-space:nowrap}.shell-brand a{color:#75dfd1;text-decoration:none;font-weight:900;font-size:11px}.shell-brand span{padding:3px 6px;border:1px solid #ffffff1a;border-radius:6px;color:#8993b4;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.shell-bar nav{display:flex;justify-content:center;gap:5px;min-width:0}.shell-bar nav a{display:grid;min-width:104px;gap:2px;padding:7px 10px;border:1px solid transparent;border-radius:10px;color:#aeb7d2;text-decoration:none;text-align:center}.shell-bar nav a:hover{background:#ffffff07}.shell-bar nav a.active{border-color:#52e0d058;color:#fff;background:linear-gradient(135deg,#7066ff1d,#52e0d012)}.shell-bar nav strong{font-size:11px}.shell-bar nav small{color:#77819f;font-size:8px}.shell-context{display:flex;justify-content:flex-end;gap:5px;min-width:0}.shell-context a{display:grid;min-width:88px;max-width:150px;padding:5px 8px;border:1px solid #ffffff12;border-radius:8px;color:#dce2f8;text-decoration:none;background:#ffffff05}.shell-context small{color:#6e7897;font-size:7px}.shell-context strong{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.shell-content{min-height:calc(100dvh - 55px)}@media(max-width:1180px){.shell-bar{grid-template-columns:auto 1fr}.shell-context{grid-column:1/-1;justify-content:flex-start}.shell-bar nav{justify-content:flex-end}}@media(max-width:760px){.shell-bar{position:relative;grid-template-columns:1fr;padding:8px}.shell-bar nav{display:grid;grid-template-columns:repeat(2,1fr)}.shell-bar nav a{min-width:0}.shell-context{display:grid;grid-template-columns:repeat(3,1fr)}.shell-context a{min-width:0;max-width:none}}
</style>
