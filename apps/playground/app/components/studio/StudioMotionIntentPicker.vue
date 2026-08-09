<!--
  文件职责 / File responsibility
  以五类中文动作意图作为新手创建入口，只上报选择，不直接写入资产。
  Presents five beginner motion intents and emits selection without mutating assets.
-->
<script setup lang="ts">
import { SIMPLE_MOTION_INTENTS, type SimpleMotionIntent } from '@yk-pets/pet-core'

withDefaults(defineProps<{
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  select: [intent: SimpleMotionIntent]
}>()
</script>

<template>
  <section class="intent-picker" aria-labelledby="motion-intent-title">
    <header class="intent-heading">
      <div class="intent-heading-copy">
        <small>第一步</small>
        <h2 id="motion-intent-title" class="intent-title">想让宠物做什么？</h2>
      </div>
      <p class="intent-description">从日常、舞蹈、功夫、运动或自定义开始，系统会自动生成完整动作阶段。</p>
    </header>

    <div class="intent-grid">
      <button
        v-for="item in SIMPLE_MOTION_INTENTS"
        :key="item.id"
        type="button"
        class="intent-card"
        :disabled="disabled"
        :aria-label="`创建${item.labelZh}动作`"
        @click="emit('select', item.id)"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
        <strong>{{ item.labelZh }}</strong>
        <small>{{ item.descriptionZh }}</small>
      </button>
    </div>
  </section>
</template>

<style scoped>
.intent-picker{display:grid;gap:12px;padding:14px;border:1px solid #ffffff16;border-radius:16px;background:linear-gradient(145deg,#12172a,#0a0f1d)}
.intent-heading{display:flex;align-items:end;justify-content:space-between;gap:18px}
.intent-heading-copy{display:grid;gap:5px}
.intent-heading-copy small{color:#73e0d3;font:800 8px/1 ui-monospace,monospace;letter-spacing:.16em}
.intent-title{margin:0;color:#f1f4ff;font-size:17px}
.intent-description{max-width:430px;margin:0;color:#8791b0;font-size:10px;line-height:1.55}
.intent-grid{display:grid;grid-template-columns:repeat(5,minmax(116px,1fr));gap:8px}
.intent-card{display:grid;grid-template-columns:34px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;gap:2px 9px;min-height:78px;padding:11px;border:1px solid #ffffff18;border-radius:12px;color:#dfe5f8;text-align:left;background:#090e1b;cursor:pointer;transition:border-color .16s ease,transform .16s ease,background .16s ease}
.intent-card:hover{transform:translateY(-1px);border-color:#52e0d066;background:#52e0d00d}
.intent-card:focus-visible{outline:2px solid #77eadc;outline-offset:2px}
.intent-card:disabled{cursor:not-allowed;opacity:.45;transform:none}
.intent-card>span{grid-row:1/3;display:grid;width:34px;height:34px;place-items:center;border-radius:10px;color:#b9fff7;background:linear-gradient(135deg,#7066ff33,#52e0d024);font-size:17px}
.intent-card strong{font-size:11px}
.intent-card small{overflow:hidden;color:#7d87a6;font-size:8px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:1040px){.intent-grid{grid-template-columns:repeat(3,minmax(116px,1fr))}}
@media(max-width:780px){.intent-heading{align-items:start;flex-direction:column}.intent-grid{grid-template-columns:minmax(0,1fr)}.intent-card:last-child{grid-column:auto}}
@media(prefers-reduced-motion:reduce){.intent-card{transition:none}}
</style>
