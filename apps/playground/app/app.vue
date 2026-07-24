<!--
  文件职责 / File responsibility
  承载 Playground 页面，并在主 Studio 编辑页隐藏覆盖层、恢复文档滚动并固定工作台布局边界。
  Hosts Playground pages and, in the main Studio editor, hides overlays, restores document scrolling, and stabilizes workspace layout bounds.
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

html:has(body.yk-pets-studio-page),
body.yk-pets-studio-page{
  min-height:100%;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  scrollbar-gutter:stable;
}

body.yk-pets-studio-page .studio-page{
  box-sizing:border-box;
  display:flex!important;
  height:auto!important;
  min-height:100dvh!important;
  flex-direction:column!important;
  overflow:visible!important;
}

body.yk-pets-studio-page .studio-header{
  flex:0 0 auto;
  margin:0 auto!important;
}

body.yk-pets-studio-page .studio-workspace{
  width:100%;
  min-height:680px!important;
  height:calc(100dvh - 154px);
  flex:0 0 auto;
  margin:0 auto!important;
}

body.yk-pets-studio-page .controls,
body.yk-pets-studio-page .part-nav,
body.yk-pets-studio-page .advanced-content{
  scrollbar-gutter:stable;
  overscroll-behavior:contain;
}

@media(max-height:820px) and (min-width:1051px){
  body.yk-pets-studio-page .studio-workspace{
    height:680px;
  }
}

@media(max-width:1050px){
  body.yk-pets-studio-page .studio-workspace{
    height:auto!important;
    min-height:0!important;
  }
}
</style>
