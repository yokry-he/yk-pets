<!--
  文件职责 / File responsibility
  用新手语言概括动作自动适配结果，并提供单入口恢复；底层阶段与提示数量仅放入折叠技术信息。
  Summarizes automatic motion adaptation in beginner language and exposes one restore action, with low-level counts kept in collapsed technical details.
-->
<script setup lang="ts">
import {
  normalizeBipedPetMotionAdaptation,
  normalizeBipedPetRootMotion,
  type BipedPetMotionEffectCueKind,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'
import type { StudioModelMode } from '~/domain/studio-model-variants'

type AdaptationRuntimeStatus = 'ready' | 'compatible' | 'limited' | 'inactive'

const props = defineProps<{
  motion: StudioMotionAssetV2
  modelMode: StudioModelMode
  runtimeStatus: AdaptationRuntimeStatus
  canRestore: boolean
}>()
const emit = defineEmits<{ restore: [] }>()

const adaptation = computed(() => normalizeBipedPetMotionAdaptation(
  props.motion.extensions?.['yk-pets/biped-motion-adaptation/v1'],
  props.motion.durationMs,
).value)
const rootMotion = computed(() => {
  const namespace = props.motion.extensions?.['yk-pets/biped-motion/v1'] as { rootMotion?: unknown } | undefined
  return normalizeBipedPetRootMotion(namespace?.rootMotion, props.motion.durationMs).value
})
const statusCopy: Record<AdaptationRuntimeStatus, { label: string, guidance: string }> = {
  ready: { label: '自动适配就绪', guidance: '当前复杂模型会按体型、道具握点和动作阶段自动修正。' },
  compatible: { label: '已保存适配', guidance: '简单模型继续兼容播放；切换复杂模型后会自动应用完整修正。' },
  limited: { label: '部分适配', guidance: '基础动作仍可播放；补齐复杂模型或动作所需道具后会自动启用增强。' },
  inactive: { label: '尚未配置', guidance: '当前动作没有自动适配方案，可从带推荐数据的内置动作开始。' },
}
const status = computed(() => statusCopy[props.runtimeStatus])
const movementSummary = computed(() => `${formatNumber(rootMotion.value.distance, 2)} × 身高`)
const turnSummary = computed(() => `${formatNumber(rootMotion.value.turnRadians * 180 / Math.PI, 1)}°`)
const twoHandPhaseCount = computed(() => new Set(adaptation.value.constraints.map(item => item.phaseId)).size)
const effectLabels: Record<BipedPetMotionEffectCueKind, string> = {
  'weapon-trail': '武器轨迹',
  'impact-sparks': '命中火花',
  'impact-ring': '冲击波纹',
}
const effectSummary = computed(() => {
  const kinds = [...new Set(adaptation.value.effectCues.map(item => item.kind))]
  return kinds.length ? kinds.map(kind => effectLabels[kind]).join('、') : '无'
})
const restoreDescription = computed(() => props.canRestore
  ? '系统会使用打开动作时的可靠基线，或动作记录的明确内置来源重新计算。'
  : '当前动作没有可靠基线或明确内置来源，无法自动恢复。')

function formatNumber(value: number, digits: number) {
  const finite = Number.isFinite(value) ? value : 0
  if (Object.is(finite, -0) || Math.abs(finite) < 1e-9) return '0'
  return finite.toFixed(digits).replace(/\.0+$/u, '').replace(/(\.\d*?)0+$/u, '$1')
}
</script>

<template>
  <section class="adaptation-summary" aria-labelledby="adaptation-summary-title">
    <header class="adaptation-summary-header">
      <div class="adaptation-summary-heading">
        <small class="adaptation-summary-eyebrow">动作自动优化</small>
        <h3 id="adaptation-summary-title" class="adaptation-summary-title">体型与道具适配</h3>
      </div>
      <span class="adaptation-summary-status" :data-status="runtimeStatus">{{ status.label }}</span>
    </header>

    <p class="adaptation-summary-guidance">{{ status.guidance }}</p>

    <dl class="adaptation-summary-grid" aria-label="动作自动适配预计结果">
      <div class="adaptation-summary-item"><dt>预计移动</dt><dd>{{ movementSummary }}</dd></div>
      <div class="adaptation-summary-item"><dt>预计转向</dt><dd>{{ turnSummary }}</dd></div>
      <div class="adaptation-summary-item"><dt>双手阶段</dt><dd>{{ twoHandPhaseCount }} 段</dd></div>
      <div class="adaptation-summary-item"><dt>动作特效</dt><dd>{{ effectSummary }}</dd></div>
    </dl>

    <details class="adaptation-summary-details">
      <summary>技术信息</summary>
      <dl class="adaptation-summary-technical-grid">
        <div><dt>表演阶段</dt><dd>{{ adaptation.phases.length }}</dd></div>
        <div><dt>空间修正窗</dt><dd>{{ adaptation.warpWindows.length }}</dd></div>
        <div><dt>双手约束</dt><dd>{{ adaptation.constraints.length }}</dd></div>
        <div><dt>特效提示</dt><dd>{{ adaptation.effectCues.length }}</dd></div>
      </dl>
    </details>

    <button
      type="button"
      class="adaptation-summary-restore-button"
      :disabled="!canRestore"
      :aria-describedby="'adaptation-summary-restore-description'"
      @click="emit('restore')"
    >重新自动优化</button>
    <p id="adaptation-summary-restore-description" class="adaptation-summary-restore-description">{{ restoreDescription }}</p>
  </section>
</template>

<style scoped>
.adaptation-summary{display:grid;gap:10px;min-width:0;padding:11px;border:1px solid #8e78ff38;border-radius:12px;background:linear-gradient(145deg,#8e78ff0d,#52e0d008)}
.adaptation-summary-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.adaptation-summary-heading{display:grid;gap:4px;min-width:0}
.adaptation-summary-eyebrow{color:#aa9cff!important;font:700 10px/1 ui-monospace,monospace!important;letter-spacing:.06em!important}
.adaptation-summary-title{margin:0;color:#edf0ff;font-size:13px}
.adaptation-summary-status{flex:0 0 auto;padding:4px 7px;border:1px solid #ffffff17;border-radius:999px;color:#99a4c1;background:#ffffff05;font-size:10px}
.adaptation-summary-status[data-status="ready"]{border-color:#52e0d052;color:#9cf5ea;background:#52e0d012}
.adaptation-summary-status[data-status="limited"]{border-color:#ffca6a4f;color:#ffdc91;background:#ffca6a0d}
.adaptation-summary-guidance,.adaptation-summary-restore-description{margin:0;color:#929cba;font-size:11px;line-height:1.5}
.adaptation-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:0}
.adaptation-summary-item{display:grid;gap:4px;min-width:0;padding:8px;border:1px solid #ffffff10;border-radius:8px;background:#080c1778}
.adaptation-summary-item dt{color:#7d88a7;font-size:10px}
.adaptation-summary-item dd{margin:0;overflow-wrap:anywhere;color:#d8def3;font-size:11px;font-weight:700;line-height:1.4}
.adaptation-summary-details{overflow:hidden;border:1px solid #ffffff12;border-radius:9px;background:#080c174f}
.adaptation-summary-details>summary{padding:8px;color:#8a95b3;font-size:10px;cursor:pointer}
.adaptation-summary-details[open]>summary{border-bottom:1px solid #ffffff10;color:#cbd3eb}
.adaptation-summary-technical-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0;padding:8px}
.adaptation-summary-technical-grid>div{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.adaptation-summary-technical-grid dt{color:#7883a2;font-size:10px}.adaptation-summary-technical-grid dd{margin:0;color:#bdc6df;font:700 10px/1 ui-monospace,monospace}
.adaptation-summary-restore-button{min-height:38px;padding:0 9px;border:1px solid #8e78ff55;border-radius:8px;color:#ded8ff;background:#8e78ff12;font-size:11px;cursor:pointer}
.adaptation-summary-restore-button:hover:not(:disabled){border-color:#aa9cff;color:#fff;background:#8e78ff1c}
.adaptation-summary-restore-button:focus-visible{outline:2px solid #aa9cff;outline-offset:2px}
.adaptation-summary-restore-button:disabled{cursor:not-allowed;opacity:.42}
.adaptation-summary-restore-description{font-size:10px}
@media(max-width:780px){
  .adaptation-summary-grid{grid-template-columns:minmax(0,1fr)}
  .adaptation-summary-technical-grid{grid-template-columns:minmax(0,1fr)}
}
</style>
