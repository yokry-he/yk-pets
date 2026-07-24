<!--
  文件职责 / File responsibility
  在统一 Studio 壳中挂载完整外观工坊，不复制或删减现有外观编辑能力。
  Mounts the complete Appearance Studio inside the shared Studio shell without copying or removing existing appearance capabilities.
-->
<script setup lang="ts">
import StudioAppearanceWorkspace from '~/components/studio/StudioAppearanceWorkspace.vue'
definePageMeta({ layout: 'studio' })
</script>

<template>
  <StudioAppearanceWorkspace />
</template>
