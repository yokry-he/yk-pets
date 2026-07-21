<!--
  文件职责 / File responsibility
  使用一个分组下拉框展示正式 Chrome 扩展中的全部云狐动作，并支持重复播放当前动作。
  Presents every production Chrome extension Cloud Fox motion in one grouped dropdown and supports replaying the current selection.
-->
<script setup lang="ts">
import {
  EXTENSION_CLOUD_FOX_MOTIONS,
  EXTENSION_CLOUD_FOX_MOTION_GROUPS,
  getExtensionCloudFoxMotion,
  type ExtensionCloudFoxMotionId,
} from '~/domain/chrome-extension-cloud-fox-motions'

const props = defineProps<{ behavior: ExtensionCloudFoxMotionId }>()
const emit = defineEmits<{ play: [motion: ExtensionCloudFoxMotionId] }>()
const selected = ref<ExtensionCloudFoxMotionId>(props.behavior)
watch(() => props.behavior, value => { selected.value = value })

const groupedMotions = computed(() => EXTENSION_CLOUD_FOX_MOTION_GROUPS.map(group => ({
  ...group,
  motions: EXTENSION_CLOUD_FOX_MOTIONS.filter(motion => motion.group === group.id),
})))
const selectedMotion = computed(() => getExtensionCloudFoxMotion(selected.value))
const play = () => emit('play', selected.value)
</script>

<template>
  <div class="motion-toolbar">
    <span class="title">动作测试</span>
    <select v-model="selected" aria-label="Chrome 扩展动作" @change="play">
      <optgroup v-for="group in groupedMotions" :key="group.id" :label="group.label">
        <option v-for="motion in group.motions" :key="motion.id" :value="motion.id">
          {{ motion.label }} · {{ motion.labelEn }}
        </option>
      </optgroup>
    </select>
    <button type="button" @click="play">{{ selected === behavior ? '重新播放' : '播放动作' }}</button>
    <small>
      {{ selectedMotion.sourceDurationSeconds > 0 ? `扩展原始时长 ${selectedMotion.sourceDurationSeconds.toFixed(2)} 秒` : '持续状态预览' }}
      · 共 {{ EXTENSION_CLOUD_FOX_MOTIONS.length }} 个动作
    </small>
  </div>
</template>

<style scoped>
.motion-toolbar{display:grid;grid-template-columns:auto minmax(260px,420px) auto 1fr;align-items:center;gap:9px;margin-top:9px;padding:9px;border:1px solid #ffffff18;border-radius:16px;background:#0e111ecc;backdrop-filter:blur(16px)}.title{color:#dce2ff;font-weight:700}.motion-toolbar select,.motion-toolbar button{min-height:38px;border:1px solid #ffffff24;border-radius:9px;padding:7px 10px;color:#fff;background:#111526}.motion-toolbar button{cursor:pointer;background:#7066ff35}.motion-toolbar small{color:#9fa9ca;font-size:12px}@media(max-width:820px){.motion-toolbar{grid-template-columns:1fr}.motion-toolbar select{width:100%}}
</style>
