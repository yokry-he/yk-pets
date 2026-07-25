<!--
  文件职责 / File responsibility
  仅在精确 `/studio` 索引路由兼容跳转到外观工坊，避免父路由遮蔽 `/studio/*` 子页面。
  Redirects only the exact `/studio` index route so it cannot shadow the `/studio/*` workspace pages.
-->
<script setup lang="ts">
await navigateTo('/studio/appearance', { replace: true })
</script>

<template>
  <div class="studio-redirect">正在进入外观工坊… / Opening Appearance Studio…</div>
</template>

<style scoped>
.studio-redirect{display:grid;min-height:100dvh;place-items:center;color:#aeb7d2;background:#080b14}
</style>
