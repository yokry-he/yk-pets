<!--
  文件职责 / File responsibility
  用新手语义展示并更新动作的移动方式、自动特效和只读运动摘要，不暴露底层求解参数。
  Presents and updates beginner-friendly movement, automatic VFX, and read-only motion summaries without exposing solver internals.
-->
<script setup lang="ts">
import type { BipedPetRootMotionDefinition, BipedPetRootMotionMode } from '@yk-pets/pet-core'
import type { StudioModelMode } from '~/domain/studio-model-variants'

const props = defineProps<{
  rootMotion: BipedPetRootMotionDefinition
  modelMode: StudioModelMode
}>()
const emit = defineEmits<{
  update: [patch: { mode?: BipedPetRootMotionMode, autoVfx?: boolean }]
  restore: []
}>()

const autoVfx = computed(() => props.rootMotion.vfxTags.length > 0)
const guidance = computed(() => props.modelMode === 'complex'
  ? '系统将根据体型、脚步接触和动作速度自动修正'
  : '简单模型会继续使用兼容播放；这些动作设置仍会保存，切换复杂模型后自动生效')
const distanceSummary = computed(() => `${formatRatio(props.rootMotion.distance)} × 身高`)
const turnSummary = computed(() => `${formatNumber(props.rootMotion.turnRadians * 180 / Math.PI, 1)}°`)
const jumpSummary = computed(() => `${formatRatio(props.rootMotion.jumpHeight)} × 身高`)

function formatNumber(value: number, digits: number): string {
  const finite = Number.isFinite(value) ? value : 0
  return Object.is(finite, -0) || Math.abs(finite) < 1e-9 ? '0' : finite.toFixed(digits).replace(/\.0$/u, '')
}

function formatRatio(value: number): string {
  return formatNumber(value, 2)
}
</script>

<template>
  <section class="root-motion-settings" aria-labelledby="root-motion-settings-title">
    <header class="root-motion-settings-header">
      <div class="root-motion-settings-heading">
        <small class="root-motion-settings-eyebrow">移动与反馈</small>
        <h3 id="root-motion-settings-title" class="root-motion-settings-title">动作移动</h3>
      </div>
      <span class="root-motion-settings-status">{{ modelMode === 'complex' ? '复杂模型' : '简单模型兼容' }}</span>
    </header>

    <p class="root-motion-settings-guidance">{{ guidance }}</p>

    <div class="root-motion-mode-group" role="group" aria-label="移动方式">
      <button
        type="button"
        class="root-motion-mode-button"
        :class="{ 'root-motion-mode-button--active': rootMotion.mode === 'in-place' }"
        :aria-pressed="rootMotion.mode === 'in-place'"
        @click="emit('update', { mode: 'in-place' })"
      >
        原地播放
      </button>
      <button
        type="button"
        class="root-motion-mode-button"
        :class="{ 'root-motion-mode-button--active': rootMotion.mode === 'travel' }"
        :aria-pressed="rootMotion.mode === 'travel'"
        @click="emit('update', { mode: 'travel' })"
      >
        实际移动
      </button>
    </div>

    <button
      type="button"
      class="root-motion-vfx-switch"
      role="switch"
      :aria-checked="autoVfx"
      aria-label="自动特效"
      @click="emit('update', { autoVfx: !autoVfx })"
    >
      <span class="root-motion-vfx-copy">
        <strong class="root-motion-vfx-title">自动特效</strong>
        <small class="root-motion-vfx-detail">根据脚步、速度和落地强度自动匹配</small>
      </span>
      <span class="root-motion-switch-track" aria-hidden="true"><span class="root-motion-switch-thumb" /></span>
    </button>

    <dl class="root-motion-summary" aria-label="动作移动预计结果">
      <div class="root-motion-summary-item">
        <dt class="root-motion-summary-label">预计移动距离</dt>
        <dd class="root-motion-summary-value">{{ distanceSummary }}</dd>
      </div>
      <div class="root-motion-summary-item">
        <dt class="root-motion-summary-label">预计转向</dt>
        <dd class="root-motion-summary-value">{{ turnSummary }}</dd>
      </div>
      <div class="root-motion-summary-item">
        <dt class="root-motion-summary-label">预计跳跃高度</dt>
        <dd class="root-motion-summary-value">{{ jumpSummary }}</dd>
      </div>
    </dl>

    <button type="button" class="root-motion-restore-button" @click="emit('restore')">恢复动作推荐值</button>
  </section>
</template>

<style scoped>
.root-motion-settings{
  container-name:root-motion-panel;
  container-type:inline-size;
  display:grid;
  gap:10px;
  min-width:0;
  padding:11px;
  border:1px solid #52e0d02b;
  border-radius:12px;
  background:linear-gradient(145deg,#52e0d009,#77a8ff07);
}
.root-motion-settings-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.root-motion-settings-heading{display:grid;gap:4px;min-width:0}
.root-motion-settings-eyebrow{color:#72dfd1!important;font:700 10px/1 ui-monospace,monospace!important;letter-spacing:.06em!important}
.root-motion-settings-title{margin:0;color:#e8edff;font-size:13px}
.root-motion-settings-status{flex:0 0 auto;padding:4px 7px;border:1px solid #ffffff17;border-radius:999px;color:#8e99b7;background:#ffffff05;font-size:10px}
.root-motion-settings-guidance{margin:0;color:#8e99b7;font-size:11px;line-height:1.55}
.root-motion-mode-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:4px;border:1px solid #ffffff12;border-radius:10px;background:#080c17}
.root-motion-mode-button{min-width:0;min-height:38px;padding:0 8px;border:1px solid transparent;border-radius:7px;color:#929dbb;background:transparent;font-size:12px;cursor:pointer}
.root-motion-mode-button--active{border-color:#52e0d055;color:#dcfffa;background:#52e0d014}
.root-motion-vfx-switch{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;min-height:47px;padding:8px 9px;border:1px solid #ffffff14;border-radius:10px;color:#dfe5fb;background:#ffffff04;text-align:left;cursor:pointer}
.root-motion-vfx-copy{display:grid;gap:3px;min-width:0}
.root-motion-vfx-title{font-size:12px}
.root-motion-vfx-detail{color:#7e89a8!important;font-size:10px!important;line-height:1.4!important;letter-spacing:0!important}
.root-motion-switch-track{position:relative;flex:0 0 auto;width:31px;height:18px;border:1px solid #ffffff20;border-radius:999px;background:#111827;transition:border-color .16s ease,background .16s ease}
.root-motion-switch-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#8994b1;transition:transform .16s ease,background .16s ease}
.root-motion-vfx-switch[aria-checked="true"] .root-motion-switch-track{border-color:#52e0d077;background:#52e0d02b}
.root-motion-vfx-switch[aria-checked="true"] .root-motion-switch-thumb{transform:translateX(13px);background:#8ff5e9}
.root-motion-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:0}
.root-motion-summary-item{display:grid;gap:4px;min-width:0;padding:7px;border:1px solid #ffffff10;border-radius:8px;background:#080c176e}
.root-motion-summary-label{color:#737f9f;font-size:10px;line-height:1.4}
.root-motion-summary-value{margin:0;overflow:hidden;color:#ced6ef;font:700 11px/1.35 ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap}
.root-motion-restore-button{min-height:38px;padding:0 9px;border:1px solid #ffffff1b;border-radius:8px;color:#aeb9d5;background:#ffffff04;font-size:11px;cursor:pointer}
.root-motion-mode-button:hover,.root-motion-vfx-switch:hover,.root-motion-restore-button:hover{border-color:#52e0d04a;color:#e7fffb}
.root-motion-mode-button:focus-visible,.root-motion-vfx-switch:focus-visible,.root-motion-restore-button:focus-visible{outline:2px solid #72dfd1;outline-offset:2px}
@container root-motion-panel (max-width:360px){
  .root-motion-mode-group,.root-motion-summary{grid-template-columns:minmax(0,1fr)}
}
@media(max-width:780px){
  .root-motion-mode-group,.root-motion-summary{grid-template-columns:minmax(0,1fr)}
}
@media(prefers-reduced-motion:reduce){
  .root-motion-switch-track,.root-motion-switch-thumb{transition:none}
}
</style>
