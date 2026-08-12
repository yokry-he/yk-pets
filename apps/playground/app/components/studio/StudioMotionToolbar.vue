<!--
  文件职责 / File responsibility
  使用一个分组下拉框展示正式 Chrome 扩展中的全部云狐动作，并可靠地触发当前选项与重复播放。
  Presents every production Chrome extension Cloud Fox motion in one grouped dropdown and reliably triggers the selected option and replay.
-->
<script setup lang="ts">
import {
  EXTENSION_CLOUD_FOX_MOTIONS,
  EXTENSION_CLOUD_FOX_MOTION_GROUPS,
  getExtensionCloudFoxMotion,
  isExtensionCloudFoxMotion,
  type ExtensionCloudFoxMotionId,
} from '~/domain/chrome-extension-cloud-fox-motions'

const props = defineProps<{ behavior: ExtensionCloudFoxMotionId }>()
const emit = defineEmits<{ play: [motion: ExtensionCloudFoxMotionId] }>()
const selected = ref<ExtensionCloudFoxMotionId>(props.behavior)

// 动作结束自动回到 idle 时保留用户最后选择，方便直接重播；外部切到其它动作时仍同步。
watch(() => props.behavior, (value) => {
  if (value !== 'idle' || selected.value === 'idle') selected.value = value
})

const groupedMotions = computed(() => EXTENSION_CLOUD_FOX_MOTION_GROUPS.map(group => ({
  ...group,
  motions: EXTENSION_CLOUD_FOX_MOTIONS.filter(motion => motion.group === group.id),
})))
const selectedMotion = computed(() => getExtensionCloudFoxMotion(selected.value))
const activeMotion = computed(() => getExtensionCloudFoxMotion(props.behavior))

function emitMotion(value: unknown) {
  if (!isExtensionCloudFoxMotion(value)) return
  selected.value = value
  emit('play', value)
}

function handleSelection(event: Event) {
  // 不依赖 v-model 与原生 change 监听器的执行顺序，始终读取用户刚刚选择的真实 option 值。
  emitMotion((event.currentTarget as HTMLSelectElement).value)
}

function replaySelected() {
  emitMotion(selected.value)
}
</script>

<template>
  <div class="motion-toolbar" :data-active-motion="behavior">
    <span class="title">动作测试</span>
    <select :value="selected" aria-label="Chrome 扩展动作" @change="handleSelection">
      <optgroup v-for="group in groupedMotions" :key="group.id" :label="group.label">
        <option v-for="motion in group.motions" :key="motion.id" :value="motion.id">
          {{ motion.label }} · {{ motion.labelEn }}
        </option>
      </optgroup>
    </select>
    <button type="button" @click="replaySelected">
      {{ selected === behavior && behavior !== 'idle' ? '重新开始' : '播放动作' }}
    </button>
    <small aria-live="polite">
      当前：{{ activeMotion.label }}
      · {{ selectedMotion.sourceDurationSeconds > 0 ? `原始时长 ${selectedMotion.sourceDurationSeconds.toFixed(2)} 秒` : '持续状态预览' }}
      · 共 {{ EXTENSION_CLOUD_FOX_MOTIONS.length }} 个动作
    </small>
  </div>
</template>

<style scoped>
.motion-toolbar{display:grid;grid-template-columns:auto minmax(260px,420px) auto 1fr;align-items:center;gap:9px;margin-top:9px;padding:9px;border:1px solid #ffffff18;border-radius:16px;background:#0e111ecc;backdrop-filter:blur(16px)}.title{color:#dce2ff;font-weight:700}.motion-toolbar select,.motion-toolbar button{min-height:38px;border:1px solid #ffffff24;border-radius:9px;padding:7px 10px;color:#fff;background:#111526}.motion-toolbar button{cursor:pointer;background:#7066ff35}.motion-toolbar small{color:#9fa9ca;font-size:12px}@media(max-width:820px){.motion-toolbar{grid-template-columns:1fr}.motion-toolbar select{width:100%}}
</style>
