<!--
  文件职责 / File responsibility
  承载 Playground 页面，并在主 Studio 编辑页隐藏跨页入口和扩展网页宠物宿主，避免遮挡创作工作台。
  Hosts Playground pages and hides cross-page shortcuts plus the extension page-pet host in the main Studio editor to avoid covering the authoring workspace.
-->
<script setup lang="ts">
const route = useRoute()
const order = ['/studio', '/studio-presets', '/studio-scenes', '/studio-species']
const labels = ['预设与风格', '场景背景', '物种注册', '宠物工坊']
const index = computed(() => Math.max(0, order.indexOf(route.path)))
const nextRoute = computed(() => order[(index.value + 1) % order.length])
const nextLabel = computed(() => labels[index.value])
const showEntry = computed(() => route.path !== '/studio')
</script>

<template>
  <NuxtPage />
  <NuxtLink v-if="showEntry" class="studio-entry" :to="nextRoute"><span>✦</span>{{ nextLabel }}</NuxtLink>
</template>

<style scoped>
.studio-entry{position:fixed;z-index:90;right:22px;bottom:22px;display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid #8fe9dd57;border-radius:999px;color:#f4f7ff;background:#090e1cd1;box-shadow:0 14px 44px #00000057;text-decoration:none;backdrop-filter:blur(18px)}
.studio-entry span{color:#8fe9dd}.studio-entry:hover{border-color:#7066ffb8;background:#302b69db}
</style>

<style>
body.yk-pets-studio-page [data-nova-extension-root="overlay"],
body.yk-pets-studio-page [data-nova-extension-root="highlight"]{
  display:none!important;
}
</style>
