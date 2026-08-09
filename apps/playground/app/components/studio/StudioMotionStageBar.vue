<!--
  文件职责 / File responsibility
  将阶段配方呈现为可滚动的语义阶段条，并上报选择、复制、排序、删除和时间定位意图。
  Presents a scrollable semantic stage bar and emits selection, duplication, ordering, removal, and time navigation intents.
-->
<script setup lang="ts">
import type { SimpleMotionRecipeV1 } from '@yk-pets/pet-core'

const props = defineProps<{
  recipe: SimpleMotionRecipeV1
  selectedStageId: string
  playheadTimeMs: number
}>()

const emit = defineEmits<{
  select: [stageId: string]
  duplicate: [stageId: string]
  move: [stageId: string, offset: -1 | 1]
  remove: [stageId: string]
  playhead: [timeMs: number]
}>()

const totalDuration = computed(() => props.recipe.stages.reduce((sum, stage) => sum + stage.durationMs, 0))
const stages = computed(() => {
  let startMs = 0
  return props.recipe.stages.map((stage, index) => {
    const item = {
      stage,
      index,
      startMs,
      width: totalDuration.value ? stage.durationMs / totalDuration.value * 100 : 100 / props.recipe.stages.length,
    }
    startMs += stage.durationMs
    return item
  })
})

function selectStage(stageId: string, startMs: number) {
  emit('select', stageId)
  emit('playhead', startMs)
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(durationMs % 1000 ? 1 : 0)} 秒`
}
</script>

<template>
  <section class="stage-bar" aria-labelledby="motion-stage-title">
    <header class="stage-heading">
      <div class="stage-heading-copy">
        <small>第二步</small>
        <h2 id="motion-stage-title">按阶段调整动作</h2>
      </div>
      <p class="stage-time">{{ Math.round(playheadTimeMs) }} / {{ totalDuration }} ms</p>
    </header>

    <div class="stage-scroll" role="list" aria-label="动作阶段">
      <article
        v-for="item in stages"
        :key="item.stage.id"
        class="stage-item"
        :class="{ selected: item.stage.id === selectedStageId }"
        :style="{ flexBasis: `max(72px, ${item.width}%)` }"
        role="listitem"
      >
        <button
          type="button"
          class="stage-select"
          :aria-current="item.stage.id === selectedStageId ? 'step' : undefined"
          :aria-label="`选择${item.stage.labelZh}阶段`"
          @click="selectStage(item.stage.id, item.startMs)"
        >
          <span class="stage-index">{{ item.index + 1 }}</span>
          <span class="stage-copy">
            <strong>{{ item.stage.labelZh }}</strong>
            <small>{{ formatDuration(item.stage.durationMs) }}</small>
          </span>
        </button>

        <div v-if="item.stage.id === selectedStageId" class="stage-actions" aria-label="当前阶段操作">
          <button type="button" class="stage-action" :disabled="item.index === 0" aria-label="前移阶段" title="前移阶段" @click="emit('move', item.stage.id, -1)">←</button>
          <button type="button" class="stage-action" :disabled="item.index === stages.length - 1" aria-label="后移阶段" title="后移阶段" @click="emit('move', item.stage.id, 1)">→</button>
          <button type="button" class="stage-action" aria-label="复制阶段" title="复制阶段" @click="emit('duplicate', item.stage.id)">⧉</button>
          <button type="button" class="stage-action danger" :disabled="stages.length <= 2" aria-label="删除阶段" title="删除阶段" @click="emit('remove', item.stage.id)">×</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.stage-bar{display:grid;gap:9px;min-width:0;padding:10px;border:1px solid #ffffff14;border-radius:14px;background:#090e1a}
.stage-heading{display:flex;align-items:end;justify-content:space-between;gap:12px}
.stage-heading-copy{display:grid;gap:4px}
.stage-heading-copy small{color:#73e0d3;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}
.stage-heading-copy h2{margin:0;color:#edf1ff;font-size:14px}
.stage-time{margin:0;color:#77819f;font:700 8px/1 ui-monospace,monospace}
.stage-scroll{position:relative;display:flex;gap:5px;min-width:0;overflow-x:auto;padding:2px 2px 6px;scrollbar-gutter:stable}
.stage-item{display:grid;min-width:72px;flex:0 0 auto;border:1px solid #ffffff13;border-radius:10px;background:#070b15;overflow:hidden}
.stage-item.selected{border-color:#52e0d077;background:linear-gradient(145deg,#52e0d015,#7066ff12);box-shadow:inset 0 0 0 1px #52e0d012}
.stage-select{display:grid;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:6px;min-height:50px;padding:7px;border:0;color:#cdd4ea;text-align:left;background:transparent;cursor:pointer}
.stage-select:focus-visible{outline:2px solid #77eadc;outline-offset:-2px}
.stage-index{display:grid;width:22px;height:22px;place-items:center;border-radius:7px;color:#a7b0cc;background:#ffffff0c;font:800 8px/1 ui-monospace,monospace}
.selected .stage-index{color:#dffffa;background:#52e0d022}
.stage-copy{display:grid;gap:3px;min-width:0}
.stage-copy strong{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.stage-copy small{color:#747e9d;font-size:7px}
.stage-actions{display:grid;grid-template-columns:repeat(4,minmax(25px,1fr));gap:3px;padding:4px;border-top:1px solid #ffffff10}
.stage-action{min-height:25px;border:1px solid #ffffff16;border-radius:6px;color:#b9c2dc;background:#ffffff06;cursor:pointer}
.stage-action:hover:not(:disabled){border-color:#52e0d055;color:#eafffc;background:#52e0d010}
.stage-action:disabled{cursor:not-allowed;opacity:.28}
.stage-actions .danger{color:#ff9bad}
@media(max-width:680px){.stage-heading{align-items:start;flex-direction:column}.stage-time{align-self:end}}
</style>
