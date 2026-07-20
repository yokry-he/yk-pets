
<!--
  文件职责 / File responsibility
  Nuxt Playground 根组件，提供演示页面壳与云狐工坊全局入口。
  Nuxt Playground root component providing the demo shell and global Cloud Fox Studio entry.
-->
<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtPage />
  <NuxtLink v-if="route.path !== '/studio'" class="studio-entry" to="/studio">
    <span>✦</span>
    云狐工坊
  </NuxtLink>
</template>

<style scoped>
.studio-entry {
  position: fixed;
  z-index: 90;
  right: 22px;
  bottom: 22px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 15px;
  border: 1px solid rgba(143, 233, 221, .34);
  border-radius: 999px;
  color: #f4f7ff;
  background: rgba(9, 14, 28, .82);
  box-shadow: 0 14px 44px rgba(0, 0, 0, .34);
  text-decoration: none;
  backdrop-filter: blur(18px);
}

.studio-entry span {
  color: #8fe9dd;
}

.studio-entry:hover {
  border-color: rgba(112, 102, 255, .72);
  background: rgba(48, 43, 105, .86);
}
</style>
