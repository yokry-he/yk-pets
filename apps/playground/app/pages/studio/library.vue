<!--
  文件职责 / File responsibility
  提供统一 Studio 资产库，集中展示当前外观、内置动作、自定义动作、道具及其上下文跳转。
  Provides the shared Studio asset library for the current appearance, built-in motions, custom motions, props, and contextual navigation.
-->
<script setup lang="ts">
import { EXTENSION_CLOUD_FOX_MOTIONS } from '~/domain/chrome-extension-cloud-fox-motions'
import { usePetAppearanceStore } from '~/stores/pet-appearance'
import { useStudioAssetStore } from '~/stores/studio-assets'
import { useStudioSessionStore } from '~/stores/studio-session'

definePageMeta({ layout: 'studio' })
const appearance = usePetAppearanceStore()
const assets = useStudioAssetStore()
const session = useStudioSessionStore()

function editMotion(id: string) {
  session.selectMotion(id)
  navigateTo({ path: '/studio/motion', query: { motion: id } })
}
function editProp(id: string) {
  session.selectProp(id)
  navigateTo({ path: '/studio/props', query: { prop: id } })
}
function removeMotion(id: string) {
  if (!confirm('删除这个自定义动作？')) return
  assets.deleteMotion(id)
  if (session.selectedMotionId === id) session.selectMotion('')
}
function removeProp(id: string) {
  if (!confirm('删除这个自定义道具？引用它的动作会移除该依赖。')) return
  assets.deleteProp(id)
  if (session.selectedPropId === id) session.selectProp('')
}
function formatTime(value: number) {
  return new Date(value).toLocaleString()
}

onMounted(() => {
  appearance.hydrate()
  assets.hydrate()
  session.hydrate()
})
</script>

<template>
  <section class="library-page">
    <header class="library-header">
      <div><small>STUDIO ASSET LIBRARY</small><h1>共享资产库</h1><p>外观、动作与道具使用独立资产 ID，通过上下文跳转相互引用。</p></div>
      <div class="summary"><span><strong>1</strong> 当前外观</span><span><strong>{{ EXTENSION_CLOUD_FOX_MOTIONS.length }}</strong> 内置动作</span><span><strong>{{ assets.motionCount }}</strong> 自定义动作</span><span><strong>{{ assets.propCount }}</strong> 自定义道具</span></div>
    </header>

    <section class="asset-section appearance-card">
      <header><div><small>APPEARANCE</small><h2>当前宠物外观</h2></div><NuxtLink to="/studio/appearance">编辑外观</NuxtLink></header>
      <div class="appearance-info"><strong>{{ appearance.recipe.identity.nameZh }} / {{ appearance.recipe.identity.nameEn }}</strong><span>{{ appearance.recipe.parts.headShape }} · {{ appearance.recipe.parts.bodyShape }}</span><code>{{ session.selectedAppearanceId }}</code></div>
    </section>

    <section class="asset-section">
      <header><div><small>CUSTOM MOTIONS</small><h2>自定义动作</h2></div><NuxtLink to="/studio/motion">进入动作工坊</NuxtLink></header>
      <div class="asset-grid">
        <article v-for="motion in assets.motions" :key="motion.id">
          <div class="asset-icon">M</div>
          <div class="asset-copy"><strong>{{ motion.nameZh }}</strong><small>{{ motion.nameEn }}</small><span>{{ motion.durationMs }} ms · {{ motion.loopMode }} · {{ motion.propIds.length }} 个道具依赖</span><time>{{ formatTime(motion.updatedAt) }}</time></div>
          <div class="asset-actions"><button @click="editMotion(motion.id)">编辑</button><button class="danger" @click="removeMotion(motion.id)">删除</button></div>
        </article>
        <div v-if="!assets.motions.length" class="empty">尚无自定义动作。动作工坊会在创建时生成稳定资产 ID。</div>
      </div>
    </section>

    <section class="asset-section">
      <header><div><small>CUSTOM PROPS</small><h2>自定义道具</h2></div><NuxtLink to="/studio/props">进入道具工坊</NuxtLink></header>
      <div class="asset-grid">
        <article v-for="prop in assets.props" :key="prop.id">
          <div class="asset-icon">P</div>
          <div class="asset-copy"><strong>{{ prop.nameZh }}</strong><small>{{ prop.nameEn }}</small><span>{{ prop.kind }} · 默认挂载 {{ prop.defaultAnchor }}</span><time>{{ formatTime(prop.updatedAt) }}</time></div>
          <div class="asset-actions"><button @click="editProp(prop.id)">编辑</button><button class="danger" @click="removeProp(prop.id)">删除</button></div>
        </article>
        <div v-if="!assets.props.length" class="empty">尚无自定义道具。道具工坊会管理结构、材质和锚点。</div>
      </div>
    </section>

    <section class="asset-section built-in-section">
      <header><div><small>BUILT-IN MOTIONS</small><h2>内置动作</h2></div><span>只读，可在后续动作工坊中创建可编辑副本</span></header>
      <div class="motion-tags"><span v-for="motion in EXTENSION_CLOUD_FOX_MOTIONS" :key="motion.id">{{ motion.label }}</span></div>
    </section>
  </section>
</template>

<style scoped>
.library-page{display:grid;gap:12px;max-width:1500px;margin:0 auto;padding:18px}.library-header,.asset-section{padding:16px;border:1px solid #ffffff17;border-radius:16px;background:#0d1120}.library-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.library-header small,.asset-section header small{color:#747f9f;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}h1,h2,p{margin:0}.library-header h1{margin-top:6px;font-size:26px}.library-header p{margin-top:5px;color:#8c96b5;font-size:11px}.summary{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.summary span{display:grid;min-width:86px;padding:8px;border:1px solid #ffffff12;border-radius:9px;color:#8e98b6;font-size:8px;text-align:center;background:#ffffff04}.summary strong{color:#fff;font-size:17px}.asset-section{display:grid;gap:12px}.asset-section>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.asset-section h2{margin-top:4px;font-size:17px}.asset-section>header a{padding:7px 9px;border:1px solid #52e0d044;border-radius:8px;color:#dffffa;text-decoration:none;font-size:9px}.asset-section>header>span{color:#77819f;font-size:9px}.appearance-card{background:linear-gradient(135deg,#7066ff13,#52e0d009)}.appearance-info{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding:12px;border:1px solid #ffffff12;border-radius:11px;background:#080d18}.appearance-info span{color:#9ba5c3;font-size:10px}.appearance-info code{color:#6f7998;font-size:8px}.asset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.asset-grid article{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid #ffffff12;border-radius:11px;background:#080d18}.asset-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:10px;color:#fff;background:linear-gradient(135deg,#7066ff55,#52e0d033);font-weight:900}.asset-copy{display:grid;gap:2px;min-width:0}.asset-copy strong{font-size:11px}.asset-copy small,.asset-copy span,.asset-copy time{overflow:hidden;color:#7d87a6;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.asset-actions{display:flex;gap:4px}.asset-actions button{min-height:29px;padding:0 7px;border:1px solid #ffffff1c;border-radius:7px;color:#dfe5ff;background:#ffffff07;font-size:8px}.asset-actions button.danger{color:#ff9aad}.empty{grid-column:1/-1;padding:14px;border:1px dashed #ffffff1d;border-radius:10px;color:#7f89a8;font-size:10px}.motion-tags{display:flex;flex-wrap:wrap;gap:5px}.motion-tags span{padding:5px 8px;border:1px solid #ffffff12;border-radius:999px;color:#aeb7d2;background:#ffffff04;font-size:8px}@media(max-width:900px){.library-header{align-items:flex-start;flex-direction:column}.summary{justify-content:flex-start}.asset-grid{grid-template-columns:1fr}.appearance-info{grid-template-columns:1fr}.asset-section>header{align-items:flex-start;flex-direction:column}}
</style>
