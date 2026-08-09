<!--
  文件职责 / File responsibility
  以姿势、节奏和效果三组新手语言编辑当前动作阶段，并把变化作为不可变补丁上报。
  Edits the selected stage through pose, rhythm, and effect groups and emits immutable patches.
-->
<script setup lang="ts">
import type {
  SimpleMotionEffect,
  SimpleMotionStage,
  SimpleMotionTransition,
} from '@yk-pets/pet-core'

const props = defineProps<{
  stage: SimpleMotionStage
}>()

const emit = defineEmits<{
  update: [patch: Partial<Omit<SimpleMotionStage, 'id'>>]
}>()

const durationOptions = [
  { label: '快一点', scale: .75 },
  { label: '保持自然', scale: 1 },
  { label: '慢一点', scale: 1.35 },
] as const
const transitionOptions: readonly { id: SimpleMotionTransition; label: string }[] = [
  { id: 'hold', label: '定格' },
  { id: 'steady', label: '稳定' },
  { id: 'soft', label: '柔和' },
  { id: 'snappy', label: '干脆' },
]
const effectOptions: readonly { id: SimpleMotionEffect; label: string; icon: string }[] = [
  { id: 'speed-trail', label: '速度拖尾', icon: '〰' },
  { id: 'landing-impact', label: '落地冲击', icon: '◎' },
  { id: 'swing-trail', label: '挥击轨迹', icon: '⌁' },
  { id: 'hit-sparks', label: '命中火花', icon: '✦' },
]

function updateLabel(event: Event) {
  emit('update', { labelZh: (event.target as HTMLInputElement).value })
}

function updateDuration(event: Event) {
  const durationMs = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(durationMs)) emit('update', { durationMs })
}

function scaleDuration(scale: number) {
  emit('update', { durationMs: Math.round(props.stage.durationMs * scale) })
}

function updateIntensity(event: Event) {
  const intensity = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(intensity)) emit('update', { intensity })
}

function toggleEffect(effect: SimpleMotionEffect) {
  const effects = props.stage.effects.includes(effect)
    ? props.stage.effects.filter(item => item !== effect)
    : [...props.stage.effects, effect]
  emit('update', { effects })
}
</script>

<template>
  <section class="stage-inspector" aria-labelledby="stage-inspector-title">
    <header class="inspector-heading">
      <div class="inspector-heading-copy">
        <small>第三步</small>
        <h2 id="stage-inspector-title">调整“{{ stage.labelZh }}”</h2>
      </div>
      <label class="stage-name">
        <span>阶段名称</span>
        <input :value="stage.labelZh" maxlength="40" @change="updateLabel">
      </label>
    </header>

    <section class="inspector-group pose-group" aria-labelledby="pose-group-title">
      <div class="group-heading">
        <span aria-hidden="true">◇</span>
        <div>
          <h3 id="pose-group-title">姿势</h3>
          <p>选择身体部位后，直接调整当前阶段的样子。</p>
        </div>
      </div>
      <StudioMotionTransformEditor guided />
    </section>

    <section class="inspector-group" aria-labelledby="rhythm-group-title">
      <div class="group-heading">
        <span aria-hidden="true">◷</span>
        <div>
          <h3 id="rhythm-group-title">节奏</h3>
          <p>控制这一阶段持续多久，以及进入下一阶段的感觉。</p>
        </div>
      </div>

      <div class="duration-control">
        <label>
          <span>持续时间</span>
          <span class="duration-input"><input :value="stage.durationMs" type="number" min="100" max="10000" step="50" @change="updateDuration"><b>ms</b></span>
        </label>
        <div class="duration-presets" aria-label="调整阶段速度">
          <button v-for="option in durationOptions" :key="option.label" type="button" class="duration-preset" @click="scaleDuration(option.scale)">{{ option.label }}</button>
        </div>
      </div>

      <fieldset class="transition-options">
        <legend>衔接感觉</legend>
        <button
          v-for="option in transitionOptions"
          :key="option.id"
          type="button"
          class="transition-option"
          :class="{ active: stage.transition === option.id }"
          :aria-pressed="stage.transition === option.id"
          @click="emit('update', { transition: option.id })"
        >{{ option.label }}</button>
      </fieldset>

      <label class="intensity-control">
        <span>动作力度 <b>{{ Math.round(stage.intensity * 100) }}%</b></span>
        <input :value="stage.intensity" type="range" min="0" max="1.5" step="0.05" @input="updateIntensity">
      </label>
    </section>

    <section class="inspector-group" aria-labelledby="effect-group-title">
      <div class="group-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <h3 id="effect-group-title">效果</h3>
          <p>选择语义效果，系统会自动判断出现时机和位置。</p>
        </div>
      </div>
      <div class="effect-grid">
        <button
          v-for="option in effectOptions"
          :key="option.id"
          type="button"
          class="effect-option"
          :class="{ active: stage.effects.includes(option.id) }"
          :aria-pressed="stage.effects.includes(option.id)"
          @click="toggleEffect(option.id)"
        ><span aria-hidden="true">{{ option.icon }}</span>{{ option.label }}</button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.stage-inspector{display:grid;gap:10px;min-width:0}
.inspector-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:2px}
.inspector-heading-copy{display:grid;gap:4px}
.inspector-heading-copy small{color:#73e0d3;font:800 8px/1 ui-monospace,monospace;letter-spacing:.15em}
.inspector-heading-copy h2{margin:0;color:#f0f3ff;font-size:15px}
.stage-name{display:grid;gap:4px;color:#7d87a6;font-size:8px}
.stage-name input{width:150px;min-height:30px;padding:0 8px;border:1px solid #ffffff1c;border-radius:8px;color:#fff;background:#080d18}
.inspector-group{display:grid;gap:9px;padding:10px;border:1px solid #ffffff14;border-radius:13px;background:#ffffff04}
.pose-group{padding:0;border:0;background:transparent}
.group-heading{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:7px}
.group-heading>span{display:grid;width:26px;height:26px;place-items:center;border-radius:8px;color:#c6fff8;background:#52e0d016}
.group-heading>div{display:grid;gap:2px}
.group-heading h3{margin:0;font-size:11px}
.group-heading p{margin:0;color:#7883a1;font-size:8px;line-height:1.4}
.duration-control{display:grid;grid-template-columns:minmax(150px,1fr) auto;align-items:end;gap:8px}
.duration-control>label{display:grid;gap:4px;color:#aeb7d0;font-size:8px}
.duration-input{position:relative;display:block}
.duration-input input{box-sizing:border-box;width:100%;min-height:31px;padding:0 30px 0 8px;border:1px solid #ffffff1c;border-radius:8px;color:#fff;background:#080d18}
.duration-input b{position:absolute;right:8px;top:9px;color:#6f7a98;font-size:8px}
.duration-presets{display:flex;gap:4px}
.duration-preset,.transition-option,.effect-option{min-height:30px;border:1px solid #ffffff18;border-radius:8px;color:#c9d1e8;background:#090e1b;cursor:pointer}
.duration-preset{padding:0 8px;font-size:8px}
.transition-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0;padding:0;border:0}
.transition-options legend{grid-column:1/-1;margin-bottom:4px;color:#aeb7d0;font-size:8px}
.transition-option.active,.effect-option.active{border-color:#52e0d077;color:#e3fffb;background:#52e0d014}
.intensity-control{display:grid;gap:6px;color:#aeb7d0;font-size:8px}
.intensity-control>span{display:flex;justify-content:space-between}
.intensity-control b{color:#75e3d5}
.intensity-control input{width:100%;accent-color:#52e0d0}
.effect-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.effect-option{display:flex;align-items:center;justify-content:flex-start;gap:7px;padding:0 9px;font-size:8px}
.effect-grid span{display:grid;width:20px;height:20px;place-items:center;border-radius:6px;background:#7066ff1c}
@media(max-width:680px){.inspector-heading{align-items:start;flex-direction:column}.stage-name,.stage-name input{width:100%}.duration-control{grid-template-columns:1fr}.duration-presets{display:grid;grid-template-columns:repeat(3,1fr)}.transition-options{grid-template-columns:repeat(2,1fr)}}
</style>
