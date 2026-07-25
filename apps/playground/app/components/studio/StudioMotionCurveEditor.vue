<!--
  文件职责 / File responsibility
  为当前语义通道显示关键帧曲线、插值模式和贝塞尔切线数值编辑。
  Displays the selected semantic channel keyframe curve, interpolation modes, and numeric Bézier tangent editing.
-->
<script setup lang="ts">
import { evaluateTrack, getCloudFoxRigChannel, type CloudFoxRigChannelId, type MotionInterpolation, type StudioMotionAssetV2 } from '@yk-pets/pet-core'
const props = defineProps<{ asset: StudioMotionAssetV2; channelId: CloudFoxRigChannelId; layerId: string; selectedKeyframeIds: string[] }>()
const emit = defineEmits<{ interpolation:[value:MotionInterpolation]; tangents:[inValue:number,outValue:number] }>()
const track = computed(() => props.asset.tracks.find(item => item.channelId === props.channelId && item.layerId === props.layerId))
const definition = computed(() => getCloudFoxRigChannel(props.channelId))
const samples = computed(() => track.value ? Array.from({length:65},(_,index)=>({x:index/64*100,y:evaluateTrack(track.value!,index/64*props.asset.durationMs)})) : [])
const range = computed(() => Math.max(.0001, definition.value.maximum-definition.value.minimum))
const path = computed(() => samples.value.map((point,index)=>`${index?'L':'M'} ${point.x.toFixed(2)} ${(92-(point.y-definition.value.minimum)/range.value*84).toFixed(2)}`).join(' '))
const points = computed(() => (track.value?.keyframes || []).map(keyframe=>({ ...keyframe, x:keyframe.timeMs/props.asset.durationMs*100, y:92-(keyframe.value-definition.value.minimum)/range.value*84 })))
const selected = computed(() => track.value?.keyframes.find(item=>props.selectedKeyframeIds.includes(item.id)))
const inTangent = ref(0); const outTangent = ref(0)
watch(selected, value=>{inTangent.value=value?.inTangent||0;outTangent.value=value?.outTangent||0},{immediate:true})
</script>
<template>
  <section class="curve-editor">
    <header><div><small>CURVE EDITOR</small><h3>曲线编辑器</h3></div><code>{{ channelId }} · {{ layerId }}</code></header>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="grid" d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100"/><path class="curve" :d="path"/><circle v-for="point in points" :key="point.id" :class="{selected:selectedKeyframeIds.includes(point.id)}" :cx="point.x" :cy="point.y" r="2.4"/></svg>
    <div class="interpolations"><button v-for="item in ['step','linear','smooth','bezier'] as MotionInterpolation[]" :key="item" :disabled="!selectedKeyframeIds.length" @click="emit('interpolation',item)">{{ item }}</button></div>
    <div class="tangents"><label>In tangent<input v-model.number="inTangent" type="number" min="-8" max="8" step=".05"></label><label>Out tangent<input v-model.number="outTangent" type="number" min="-8" max="8" step=".05"></label><button :disabled="!selectedKeyframeIds.length" @click="emit('tangents',inTangent,outTangent)">应用切线</button></div>
  </section>
</template>
<style scoped>.curve-editor{display:grid;gap:8px;padding:9px;border:1px solid #ffffff12;border-radius:10px;background:#080d18}.curve-editor header{display:flex;justify-content:space-between;gap:8px}.curve-editor small{color:#75809e;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}.curve-editor h3{margin:3px 0 0;font-size:12px}.curve-editor code{max-width:160px;overflow-wrap:anywhere;color:#6fded2;font-size:7px}svg{width:100%;height:128px;border:1px solid #ffffff12;border-radius:8px;background:#050812}.grid{fill:none;stroke:#ffffff0d;stroke-width:.5}.curve{fill:none;stroke:#6ff0df;stroke-width:1.4;vector-effect:non-scaling-stroke}circle{fill:#8792b2;stroke:#11182a;stroke-width:1;vector-effect:non-scaling-stroke}circle.selected{fill:#ff6f9d}.interpolations{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.tangents{display:grid;grid-template-columns:1fr 1fr auto;gap:5px;align-items:end}.curve-editor label{display:grid;gap:3px;color:#aeb8d2;font-size:8px}.curve-editor input,.curve-editor button{min-height:29px;padding:0 6px;border:1px solid #ffffff1d;border-radius:7px;color:#fff;background:#0b1020}.curve-editor button:disabled{opacity:.35}</style>
