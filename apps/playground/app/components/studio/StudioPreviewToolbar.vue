<!--
  文件职责 / File responsibility
  为外观、动作和道具工坊提供统一分组的固定视角、背景、缩放、三轴旋转、复位及可选时间控制。
  Provides one grouped canonical-view, background, scale, three-axis rotation, reset, and optional time toolbar for Appearance, Motion, and Prop Studio.
-->
<script setup lang="ts">
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase4'

defineOptions({ name: 'StudioPreviewToolbar' })

const props = withDefaults(defineProps<{
  view: CloudFoxStudioView
  background: CloudFoxStudioBackground
  scale: number
  rotation: Readonly<{ x: number; y: number; z: number }>
  showTime?: boolean
  timeMs?: number
  maxTimeMs?: number
}>(), {
  showTime: false,
  timeMs: 0,
  maxTimeMs: 0,
})

const emit = defineEmits<{
  view: [value: CloudFoxStudioView]
  background: [value: CloudFoxStudioBackground]
  scale: [value: number]
  rotation: [axis: 'x' | 'y' | 'z', value: number]
  time: [value: number]
  reset: []
}>()

const views = [['front', '正面'], ['left', '左侧'], ['back', '背面'], ['right', '右侧']] as const
const axisLabels = { x: '俯仰', y: '水平', z: '倾斜' } as const

function numberFrom(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="studio-preview-toolbar" aria-label="3D 预览控制">
    <div class="toolbar-row toolbar-row-primary">
      <div class="toolbar-section view-section">
        <span class="section-label">固定视角</span>
        <div class="segmented-control" role="group" aria-label="固定视角">
          <button v-for="[id, label] in views" :key="id" type="button" :class="{ active: view === id }" :aria-pressed="view === id" @click="emit('view', id)">{{ label }}</button>
        </div>
      </div>
      <label class="toolbar-section background-section">
        <span class="section-label">背景</span>
        <select :value="background" @change="emit('background', ($event.target as HTMLSelectElement).value as CloudFoxStudioBackground)">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
          <option value="web">网页</option>
        </select>
      </label>
      <div class="toolbar-actions">
        <slot name="actions" />
        <button type="button" class="reset-button" @click="emit('reset')"><span aria-hidden="true">↺</span> 复位</button>
      </div>
    </div>

    <div class="toolbar-row toolbar-row-transform">
      <span class="section-label transform-label">预览变换</span>
      <label class="scale-control">
        <span>大小</span>
        <input :value="scale" type="range" min=".4" max="1.2" step=".01" aria-label="预览大小" @input="emit('scale', numberFrom($event))">
        <output>{{ Math.round(scale * 100) }}%</output>
      </label>
      <div class="rotation-control" role="group" aria-label="自由旋转">
        <span>自由旋转</span>
        <label v-for="axis in ['x', 'y', 'z'] as const" :key="axis">
          <span>{{ axis.toUpperCase() }}<small>{{ axisLabels[axis] }}</small></span>
          <input :value="props.rotation[axis]" type="number" min="-180" max="180" step="1" :aria-label="`${axisLabels[axis]}角度`" @change="emit('rotation', axis, numberFrom($event))">
          <i>°</i>
        </label>
      </div>
      <label v-if="showTime" class="time-control">
        <span>预览时间</span>
        <input :value="Math.round(timeMs)" type="number" min="0" :max="maxTimeMs" step="1" @input="emit('time', numberFrom($event))">
        <i>ms</i>
      </label>
    </div>
  </section>
</template>

<style scoped>
.studio-preview-toolbar{display:grid;gap:7px;min-width:0;padding:7px;border:1px solid #ffffff1a;border-radius:12px;color:#dfe6fa;background:#080c17e8;box-shadow:0 14px 36px #0005;backdrop-filter:blur(16px)}
.toolbar-row{display:flex;align-items:center;gap:8px;min-width:0}.toolbar-row-primary{justify-content:space-between}.toolbar-row-transform{padding-top:7px;border-top:1px solid #ffffff10}
.toolbar-section,.scale-control,.rotation-control,.time-control{display:flex;align-items:center;gap:6px;min-width:0}.section-label{color:#737e9d;font:800 8px/1 ui-monospace,monospace;letter-spacing:.06em;white-space:nowrap}.transform-label{align-self:center}
.segmented-control{display:grid;grid-template-columns:repeat(4,minmax(42px,1fr));gap:3px;padding:3px;border:1px solid #ffffff12;border-radius:9px;background:#05091499}
button,select,input[type=number]{min-height:29px;border:1px solid #ffffff1d;border-radius:7px;color:#edf2ff;background:#0a0f1d}button{padding:0 9px;cursor:pointer}button:hover{border-color:#ffffff35;background:#ffffff0b}button.active{border-color:#52e0d077;color:#dffffa;background:#52e0d016;box-shadow:inset 0 0 0 1px #52e0d018}select{min-width:74px;padding:0 24px 0 8px}.toolbar-actions{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-left:auto}.reset-button{border-color:#52e0d044;color:#cffff8}.reset-button span{font-size:13px}
.scale-control{flex:1 1 220px}.scale-control>span,.rotation-control>span,.time-control>span{color:#9ea8c4;font-size:9px;white-space:nowrap}.scale-control input{min-width:90px;width:100%;accent-color:#52e0d0}.scale-control output{width:34px;color:#cffff8;font:700 8px/1 ui-monospace,monospace;text-align:right}
.rotation-control{flex:0 1 auto}.rotation-control label{display:grid;grid-template-columns:auto 54px auto;align-items:center;gap:3px}.rotation-control label>span{display:flex;align-items:baseline;gap:3px;color:#c6cee4;font:800 8px/1 ui-monospace,monospace}.rotation-control small{color:#66718f;font:500 7px/1 system-ui}.rotation-control input,.time-control input{width:54px;padding:0 6px}.rotation-control i,.time-control i{color:#687391;font:normal 8px/1 ui-monospace,monospace}.time-control{margin-left:auto}.time-control input{width:68px}
@media(max-width:820px){.toolbar-row{align-items:stretch;flex-wrap:wrap}.view-section{flex:1 1 100%}.segmented-control{flex:1}.background-section{flex:1}.toolbar-actions{margin-left:0}.transform-label{flex:1 1 100%}.scale-control{flex-basis:100%}.rotation-control{display:grid;grid-template-columns:1fr repeat(3,minmax(0,1fr));width:100%}.rotation-control label{grid-template-columns:auto minmax(46px,1fr) auto}.rotation-control input{width:100%}.time-control{margin-left:0}}
</style>
