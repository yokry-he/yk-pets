<!--
  文件职责 / File responsibility
  提供语义 Rig 通道选择、当前姿态数值写入、插值选择和关键帧批量操作。
  Provides semantic Rig channel selection, current-pose value writing, interpolation selection, and batch keyframe actions.
-->
<script setup lang="ts">
import {
  CLOUD_FOX_RIG_CHANNELS,
  CLOUD_FOX_RIG_TRACK_GROUPS,
  evaluateNormalizedMotionAsset,
  getCloudFoxRigChannel,
  type CloudFoxRigChannelId,
  type MotionInterpolation,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'

const props = defineProps<{
  asset: StudioMotionAssetV2
  playheadTimeMs: number
  selectedChannelId: CloudFoxRigChannelId
  selectedKeyframeCount: number
  snapToFrames: boolean
  autoKey: boolean
}>()
const emit = defineEmits<{
  channel: [id: CloudFoxRigChannelId]
  write: [value: number, interpolation: MotionInterpolation]
  interpolation: [value: MotionInterpolation]
  copy: []
  paste: []
  delete: []
  snap: [enabled: boolean]
  autoKey: [enabled: boolean]
}>()

const interpolationLabels: Record<MotionInterpolation, string> = { step: '阶梯', linear: '线性', smooth: '平滑', bezier: '贝塞尔' }
const unitLabels: Record<string, string> = { normalized: '归一化', radians: '弧度', ratio: '比例', distance: '局部距离' }
const blendLabels: Record<string, string> = { additive: '叠加', override: '覆盖', 'relative-scale': '相对缩放' }
const interpolation = ref<MotionInterpolation>('linear')
const evaluated = computed(() => evaluateNormalizedMotionAsset(props.asset, props.playheadTimeMs))
const definition = computed(() => getCloudFoxRigChannel(props.selectedChannelId))
const value = ref(0)
watch([evaluated, () => props.selectedChannelId], () => { value.value = evaluated.value.values[props.selectedChannelId] }, { immediate: true })
function commit() { emit('write', Number(value.value), interpolation.value) }
</script>

<template>
  <section class="pose-editor">
    <header><small>逐通道编辑</small><h3>语义姿态</h3></header>
    <label>轨道通道
      <select :value="selectedChannelId" @change="emit('channel', ($event.target as HTMLSelectElement).value as CloudFoxRigChannelId)">
        <optgroup v-for="group in CLOUD_FOX_RIG_TRACK_GROUPS" :key="group.id" :label="group.labelZh">
          <option v-for="channelId in group.channelIds" :key="channelId" :value="channelId">{{ getCloudFoxRigChannel(channelId).labelZh }}</option>
        </optgroup>
      </select>
    </label>
    <div class="channel-meta"><code>{{ definition.id }}</code><span>{{ unitLabels[definition.unit] || definition.unit }} · {{ blendLabels[definition.blendMode] || definition.blendMode }}</span></div>
    <label>当前值
      <input v-model.number="value" type="number" :min="definition.minimum" :max="definition.maximum" step="0.01" @keydown.enter="commit">
    </label>
    <label>插值
      <select v-model="interpolation"><option value="linear">线性</option><option value="step">阶梯</option><option value="smooth">平滑</option><option value="bezier">贝塞尔</option></select>
    </label>
    <button class="primary" @click="commit">{{ autoKey ? '写入关键帧' : '写入当前通道' }}</button>
    <div class="toggles">
      <label><input type="checkbox" :checked="snapToFrames" @change="emit('snap', ($event.target as HTMLInputElement).checked)"> FPS 吸附</label>
      <label><input type="checkbox" :checked="autoKey" @change="emit('autoKey', ($event.target as HTMLInputElement).checked)"> 自动关键帧</label>
    </div>
    <section class="selection-card">
      <strong>已选 {{ selectedKeyframeCount }} 个关键帧</strong>
      <div><button :disabled="!selectedKeyframeCount" @click="emit('copy')">复制</button><button @click="emit('paste')">粘贴</button><button :disabled="!selectedKeyframeCount" @click="emit('delete')">删除</button></div>
      <div class="four"><button v-for="item in ['step','linear','smooth','bezier'] as MotionInterpolation[]" :key="item" :disabled="!selectedKeyframeCount" @click="emit('interpolation',item)">{{ interpolationLabels[item] }}</button></div>
    </section>
    <small class="catalog">Rig 共 {{ CLOUD_FOX_RIG_CHANNELS.length }} 个稳定通道。</small>
  </section>
</template>

<style scoped>
.pose-editor{display:grid;gap:9px;padding:10px;border:1px solid #ffffff12;border-radius:12px;background:#ffffff04}.pose-editor header{display:grid;gap:3px}.pose-editor header small{color:#727d9c;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.pose-editor h3{margin:0;font-size:13px}.pose-editor label{display:grid;gap:5px;color:#b8c0da;font-size:9px}.pose-editor select,.pose-editor input,.pose-editor button{min-height:33px;border:1px solid #ffffff1d;border-radius:8px;padding:0 8px;color:#fff;background:#090e1b}.pose-editor button{cursor:pointer}.pose-editor button:disabled{cursor:not-allowed;opacity:.35}.primary{border-color:#52e0d066!important;background:#52e0d018!important}.channel-meta{display:grid;gap:3px}.channel-meta code{overflow-wrap:anywhere;color:#7ae4d8;font-size:8px}.channel-meta span,.catalog{color:#6f7998;font-size:8px}.toggles{display:grid;grid-template-columns:1fr 1fr;gap:6px}.toggles label{display:flex;align-items:center;gap:5px}.toggles input{min-height:auto}.selection-card{display:grid;gap:7px;padding-top:8px;border-top:1px solid #ffffff12}.selection-card strong{font-size:9px}.selection-card div{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.selection-card div:last-child{grid-template-columns:1fr 1fr}.selection-card .four{grid-template-columns:repeat(4,1fr)}
</style>
