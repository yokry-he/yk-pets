<!--
  文件职责 / File responsibility
  承载 Playground 页面，并只在非主 Studio 编辑页显示跨页面快捷入口，避免遮挡编辑器和网页宠物。
  Hosts Playground pages and shows the cross-page shortcut only outside the main Studio editor to avoid covering the editor and page pet.
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
