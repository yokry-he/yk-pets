<script setup lang="ts">
const route=useRoute()
const nextRoute=computed(()=>route.path==='/studio'?'/studio-presets':route.path==='/studio-presets'?'/studio-scenes':'/studio')
const nextLabel=computed(()=>route.path==='/studio'?'预设与风格':route.path==='/studio-presets'?'场景背景':'宠物工坊')
</script>
<template><NuxtPage/><NuxtLink class="studio-entry" :to="nextRoute"><span>✦</span>{{nextLabel}}</NuxtLink></template>
<style scoped>.studio-entry{position:fixed;z-index:90;right:22px;bottom:22px;display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid #8fe9dd57;border-radius:999px;color:#f4f7ff;background:#090e1cd1;box-shadow:0 14px 44px #00000057;text-decoration:none;backdrop-filter:blur(18px)}.studio-entry span{color:#8fe9dd}.studio-entry:hover{border-color:#7066ffb8;background:#302b69db}</style>
