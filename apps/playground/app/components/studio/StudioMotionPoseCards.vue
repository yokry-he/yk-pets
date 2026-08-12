<!--
  文件职责 / File responsibility
  按当前语义部位与动作意图展示快速姿势，并把应用命令交给动作编辑 Store。
  Shows quick poses for the current semantic part and motion intent, delegating application to the motion editor store.
-->
<script setup lang="ts">
import {
  getDirectMotionPoseCards,
  getMotionControl,
  type MotionControlId,
  type SimpleMotionIntent,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const props = withDefaults(defineProps<{
  intent: SimpleMotionIntent
  disabled?: boolean
}>(), {
  disabled: false,
})

const editor = useStudioMotionEditorStore()
const cards = computed(() => getDirectMotionPoseCards(editor.selectedBodyPartId, props.intent))

function cardSummary(card: (typeof cards.value)[number]) {
  const labels = Object.keys(card.pose)
    .map(controlId => getMotionControl(controlId as MotionControlId).labelZh)
    .slice(0, 2)
  return labels.length ? `调整${labels.join('、')}` : `设置${card.labelZh}`
}
</script>

<template>
  <section class="pose-cards" aria-labelledby="quick-pose-title">
    <header class="pose-cards__heading">
      <div>
        <h3 id="quick-pose-title">快速姿势</h3>
        <p>应用后仍可拖动和微调</p>
      </div>
      <span>{{ cards.length }} 个</span>
    </header>

    <div v-if="cards.length" class="pose-card-grid">
      <button
        v-for="card in cards"
        :key="card.id"
        type="button"
        class="pose-card"
        :disabled="disabled"
        :aria-label="`应用快速姿势：${card.labelZh}，${cardSummary(card)}`"
        @click="editor.applyDirectPoseCard(card.id)"
      >
        <span class="pose-card__icon" aria-hidden="true">{{ card.icon }}</span>
        <span class="pose-card__copy">
          <strong>{{ card.labelZh }}</strong>
          <small>{{ cardSummary(card) }}</small>
        </span>
      </button>
    </div>
    <p v-else class="pose-cards__empty">当前部位暂无快速姿势，可直接拖动或调整参数。</p>
  </section>
</template>

<style scoped>
.pose-cards{display:grid;gap:9px}.pose-cards__heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.pose-cards__heading>div{display:grid;gap:2px}.pose-cards__heading h3,.pose-cards__heading p{margin:0}.pose-cards__heading h3{font-size:11px}.pose-cards__heading p{color:#7c87a5;font-size:8px}.pose-cards__heading>span{flex:none;color:#7d88a7;font:700 8px/1 ui-monospace,monospace}.pose-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.pose-card{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:center;gap:7px;min-height:48px;padding:6px 8px;border:1px solid #ffffff18;border-radius:11px;color:#dfe5f8;background:#090e1b;text-align:left;cursor:pointer}.pose-card:hover{border-color:#52e0d066;background:#52e0d00d}.pose-card:focus-visible{outline:2px solid #7ff3e5;outline-offset:2px}.pose-card:disabled{cursor:not-allowed;opacity:.42}.pose-card__icon{display:grid;width:28px;height:28px;place-items:center;border-radius:9px;color:#d9fff9;background:linear-gradient(145deg,#52e0d025,#7066ff25);font-size:14px}.pose-card__copy{display:grid;min-width:0;gap:2px}.pose-card__copy strong{font-size:9px}.pose-card__copy small{overflow:hidden;color:#76819f;font-size:7px;text-overflow:ellipsis;white-space:nowrap}.pose-cards__empty{margin:0;padding:9px;border:1px dashed #ffffff1b;border-radius:9px;color:#7c87a5;font-size:8px;line-height:1.5}
</style>
