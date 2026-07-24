<!--
  文件职责 / File responsibility
  将旧 `/studio` 入口兼容跳转到新的外观工坊路由，避免历史链接失效。
  Redirects the legacy `/studio` entry to the new appearance workspace so existing links remain valid.
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
