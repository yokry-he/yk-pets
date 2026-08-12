<!--
  文件职责 / File responsibility
  组合当前部位的快速姿势、直接模式、语义参数和精确参数，不维护独立姿势状态。
  Composes quick poses, direct modes, semantic parameters, and exact values for the current part without owning pose state.
-->
<script setup lang="ts">
import {
  getDirectMotionCapability,
  getMotionBodyPart,
  getMotionControl,
  type DirectMotionMode,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const props = defineProps<{
  compact?: boolean
  drawerOpen?: boolean
}>()
const emit = defineEmits<{
  open: []
}>()
const editor = useStudioMotionEditorStore()
const recipe = computed(() => editor.simpleRecipe)
const stage = computed(() => editor.selectedSimpleStage)
const part = computed(() => getMotionBodyPart(editor.selectedBodyPartId))
const capability = computed(() => getDirectMotionCapability(editor.selectedBodyPartId))
const visibleParameters = computed(() => capability.value?.parameters.filter(parameter => parameter.interactionMode === editor.directManipulationMode) || [])
const compactParameters = computed(() => visibleParameters.value.slice(0, 3))
const exactControls = computed(() => visibleParameters.value.map(parameter => getMotionControl(parameter.controlId)))
const unavailable = computed(() => !stage.value || !capability.value)
const editingDisabled = computed(() => unavailable.value || (stage.value?.intensity ?? 0) <= 0)
const compactOpenButton = ref<HTMLButtonElement>()

function setMode(mode: DirectMotionMode) {
  editor.setDirectManipulationMode(mode)
}

function syncExactParameters(event: Event) {
  editor.exactParametersExpanded = (event.currentTarget as HTMLDetailsElement).open
}

function focusOpenButton() {
  compactOpenButton.value?.focus({ preventScroll: true })
}

defineExpose({ focusOpenButton })
</script>

<template>
  <section
    class="part-inspector"
    :class="{ 'compact-part-inspector': props.compact }"
    :aria-labelledby="props.compact ? undefined : 'part-inspector-title'"
    :aria-label="props.compact ? '常用部位动作参数' : undefined"
  >
    <template v-if="props.compact">
      <header class="compact-part-inspector__header">
        <span><small>当前部位</small><strong>{{ part.labelZh }}</strong></span>
        <div v-if="capability" class="compact-part-inspector__modes" role="group" aria-label="部位操作方式">
          <button
            v-for="mode in capability.modes"
            :key="mode"
            type="button"
            :class="{ active: editor.directManipulationMode === mode }"
            :aria-pressed="editor.directManipulationMode === mode"
            :disabled="!stage"
            @click="setMode(mode)"
          >{{ mode === 'translate' ? '移动' : '旋转' }}</button>
        </div>
        <button
          ref="compactOpenButton"
          type="button"
          class="compact-part-inspector__more"
          :aria-expanded="props.drawerOpen"
          aria-controls="guided-part-inspector"
          @click="emit('open')"
        >更多参数</button>
      </header>
      <div v-if="compactParameters.length" class="compact-part-inspector__parameters">
        <StudioDirectSemanticControl
          v-for="parameter in compactParameters"
          :key="parameter.controlId"
          :parameter="parameter"
          :disabled="editingDisabled"
          id-prefix="compact"
        />
      </div>
      <p v-else class="part-inspector__empty" role="status">当前部位没有可用的{{ editor.directManipulationMode === 'translate' ? '移动' : '旋转' }}参数，可打开更多参数查看完整设置。</p>
    </template>

    <template v-else>
    <header class="part-inspector__header">
      <div>
        <small>当前部位</small>
        <h2 id="part-inspector-title">{{ part.labelZh }}</h2>
      </div>
      <label v-if="capability?.symmetryPartnerId" class="symmetry-toggle">
        <input v-model="editor.symmetryEnabled" type="checkbox" :disabled="!stage">
        <span>对称编辑</span>
      </label>
    </header>

    <p v-if="!stage" class="part-inspector__empty" role="status">请先选择一个动作阶段，再调整身体部位。</p>
    <p v-else-if="!capability" class="part-inspector__empty" role="status">当前部位暂不支持简单直接操控，可进入高级编辑继续调整。</p>

    <template v-else>
      <div class="mode-tabs" role="group" aria-label="部位操作方式">
        <button
          v-for="mode in capability.modes"
          :key="mode"
          type="button"
          :class="{ active: editor.directManipulationMode === mode }"
          :aria-pressed="editor.directManipulationMode === mode"
          :disabled="!stage"
          @click="setMode(mode)"
        >
          <span aria-hidden="true">{{ mode === 'translate' ? '↔' : '↻' }}</span>
          {{ mode === 'translate' ? '移动' : '旋转' }}
        </button>
      </div>

      <p v-if="stage.intensity <= 0" class="part-inspector__empty" role="status">当前阶段动作力度为 0，请先提高动作力度后再调整姿势。</p>

      <StudioMotionPoseCards v-if="recipe" :intent="recipe.intent" :disabled="editingDisabled" />

      <section class="parameter-section" aria-labelledby="semantic-parameter-title">
        <header>
          <div>
            <h3 id="semantic-parameter-title">直观参数</h3>
            <p>{{ editor.directManipulationMode === 'translate' ? '调整位置和高低' : '调整摆动、展开和扭转' }}</p>
          </div>
          <span>{{ visibleParameters.length }} 项</span>
        </header>
        <div v-if="visibleParameters.length" class="semantic-list">
          <StudioDirectSemanticControl
            v-for="parameter in visibleParameters"
            :key="parameter.controlId"
            :parameter="parameter"
            :disabled="editingDisabled"
          />
        </div>
        <p v-else class="part-inspector__empty">此部位没有可用的{{ editor.directManipulationMode === 'translate' ? '移动' : '旋转' }}参数。</p>
      </section>

      <details class="exact-parameters" :open="editor.exactParametersExpanded" @toggle="syncExactParameters">
        <summary>
          <span><strong>精确参数</strong><small>按 X / Y / Z 与核心单位调整</small></span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div class="exact-parameters__body">
          <StudioDirectExactControl
            v-for="control in exactControls"
            :key="control.id"
            :control="control"
            :disabled="editingDisabled"
          />
        </div>
      </details>

      <p v-if="editor.directManipulation.diagnostics.length" class="part-inspector__diagnostic" role="status">{{ editor.directManipulation.diagnostics.at(-1) }}</p>
      <p class="part-inspector__assist">自动保持连接与安全角度；拖到边界时系统会停止继续变形。</p>

      <div class="part-inspector__actions">
        <button type="button" :disabled="editingDisabled" @click="editor.resetSelectedDirectPart()">恢复{{ part.labelZh }}</button>
        <button type="button" class="advanced-entry" @click="editor.setAuthoringMode('advanced')">进入高级编辑</button>
      </div>
    </template>
    </template>
  </section>
</template>

<style scoped>
.part-inspector{box-sizing:border-box;display:grid;min-width:0;gap:12px}.part-inspector__header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px}.part-inspector__header>div{display:grid;gap:4px}.part-inspector__header small{color:#73e0d3;font:800 10px/1 ui-monospace,monospace;letter-spacing:.14em}.part-inspector__header h2{margin:0;color:#f1f4ff;font-size:17px}.symmetry-toggle{display:flex;align-items:center;gap:6px;color:#c0c8dc;font-size:11px}.symmetry-toggle input{accent-color:#52e0d0}.mode-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:4px;border:1px solid #ffffff12;border-radius:12px;background:#070b14}.mode-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:1px solid transparent;border-radius:9px;color:#99a4bf;background:transparent;cursor:pointer}.mode-tabs button.active{border-color:#52e0d06b;color:#e1fffb;background:#52e0d015;box-shadow:0 0 0 1px #52e0d00b inset}.mode-tabs button:focus-visible,.part-inspector__actions button:focus-visible,.exact-parameters summary:focus-visible{outline:2px solid #7ff3e5;outline-offset:2px}.mode-tabs button:disabled{cursor:not-allowed;opacity:.4}.parameter-section{display:grid;gap:8px}.parameter-section>header{display:flex;align-items:end;justify-content:space-between;gap:8px}.parameter-section>header>div{display:grid;gap:2px}.parameter-section h3,.parameter-section p{margin:0}.parameter-section h3{font-size:12px}.parameter-section p{color:#8c98b4;font-size:10px}.parameter-section>header>span{color:#8792ad;font:700 10px/1 ui-monospace,monospace}.semantic-list,.exact-parameters__body{display:grid;gap:6px}.exact-parameters{border:1px solid #ffffff14;border-radius:11px;background:#ffffff03}.exact-parameters summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:0 10px;list-style:none;cursor:pointer}.exact-parameters summary::-webkit-details-marker{display:none}.exact-parameters summary>span:first-child{display:grid;gap:2px}.exact-parameters summary strong{font-size:11px}.exact-parameters summary small{color:#8b96b1;font-size:10px}.exact-parameters[open] summary>span:last-child{transform:rotate(180deg)}.exact-parameters__body{padding:0 7px 7px}.part-inspector__empty{margin:0;padding:10px;border:1px dashed #ffffff1c;border-radius:9px;color:#98a3bd;font-size:11px;line-height:1.5}.part-inspector__diagnostic{margin:0;padding:8px;border:1px solid #ffcb6b35;border-radius:9px;color:#ffd58a;background:#ffcb6b09;font-size:11px;line-height:1.45}.part-inspector__assist{margin:0;color:#929db7;font-size:10px;line-height:1.55}.part-inspector__actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.part-inspector__actions button{min-height:34px;border:1px solid #52e0d044;border-radius:9px;color:#d9fff9;background:#52e0d00d;cursor:pointer}.part-inspector__actions button:disabled{cursor:not-allowed;opacity:.4}.part-inspector__actions .advanced-entry{border-color:#ffffff18;color:#bdc5da;background:#090e1b}@media(max-width:420px){.part-inspector__header{align-items:flex-start}.part-inspector__actions{grid-template-columns:1fr}}
.compact-part-inspector{gap:8px;padding:10px;border:1px solid #66ebdb55;border-radius:16px;color:#eafffc;background:#07131ef2;box-shadow:0 14px 34px #0009;backdrop-filter:blur(18px)}.compact-part-inspector__header{display:grid;grid-template-columns:minmax(86px,auto) minmax(150px,220px) auto;align-items:center;gap:10px}.compact-part-inspector__header>span{display:grid;gap:3px}.compact-part-inspector__header small{color:#72e4d7;font-size:8px}.compact-part-inspector__header strong{font-size:12px}.compact-part-inspector__modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.compact-part-inspector__modes button,.compact-part-inspector__more{min-height:32px;border:1px solid #ffffff18;border-radius:9px;color:#aeb9d1;background:#07101c;cursor:pointer}.compact-part-inspector__modes button.active{border-color:#52e0d066;color:#e1fffb;background:#52e0d014}.compact-part-inspector__more{padding:0 10px;border-color:#66ebdb55;color:#dffffa}.compact-part-inspector__modes button:focus-visible,.compact-part-inspector__more:focus-visible{outline:2px solid #7ff3e5;outline-offset:2px}.compact-part-inspector__parameters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.compact-part-inspector__parameters :deep(.semantic-control){gap:4px;padding:6px}.compact-part-inspector__parameters :deep(.semantic-control__heading){gap:4px}.compact-part-inspector__parameters :deep(.semantic-control small){display:none}@media(max-width:520px){.compact-part-inspector__header{grid-template-columns:minmax(0,1fr) minmax(140px,1.4fr)}.compact-part-inspector__more{grid-column:1/-1}.compact-part-inspector__parameters{grid-template-columns:minmax(0,1fr)}}
</style>
