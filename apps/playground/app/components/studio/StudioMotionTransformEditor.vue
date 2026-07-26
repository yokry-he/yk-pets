<!--
  文件职责 / File responsibility
  以身体部件树、作用范围和外观式数值控件呈现动作位移、旋转、缩放与语义调整。
  Presents motion translation, rotation, scale, and semantic adjustments through a body-part tree, authoring scopes, and appearance-style numeric controls.
-->
<script setup lang="ts">
import {
  MOTION_BODY_PARTS,
  fromMotionControlDisplayValue,
  getMotionBodyPart,
  getMotionBodyPartControls,
  getMotionBodyPartModes,
  readMotionControlValue,
  toMotionControlDisplayValue,
  type MotionAuthoringScope,
  type MotionBodyPartDefinition,
  type MotionBodyPartId,
  type MotionControlDefinition,
  type MotionControlId,
  type MotionTransformMode,
} from '@yk-pets/pet-core'
import { useStudioMotionEditorStore } from '~/stores/studio-motion-editor'

const editor = useStudioMotionEditorStore()
const scopeOptions: readonly { id: MotionAuthoringScope; label: string; hint: string }[] = [
  { id: 'current-frame', label: '当前帧', hint: '在播放指针处写入或更新关键帧' },
  { id: 'selected-keyframes', label: '已选关键帧', hint: '对所选关键帧批量设置或增加偏移' },
  { id: 'entire-motion', label: '整段动作', hint: '写入非破坏性的动作修正层' },
]
const modeOptions: readonly { id: MotionTransformMode; label: string; shortcut: string }[] = [
  { id: 'translate', label: '移动', shortcut: 'W' },
  { id: 'rotate', label: '旋转', shortcut: 'E' },
  { id: 'scale', label: '缩放', shortcut: 'R' },
  { id: 'semantic', label: '语义', shortcut: 'S' },
]
const selectedPart = computed(() => getMotionBodyPart(editor.selectedBodyPartId))
const availableModes = computed(() => getMotionBodyPartModes(editor.selectedBodyPartId))
const controls = computed(() => getMotionBodyPartControls(editor.selectedBodyPartId, editor.transformMode))
const symmetryAvailable = computed(() => Boolean(selectedPart.value.symmetryPartnerId))

watch([() => editor.selectedBodyPartId, () => editor.transformMode], () => {
  if (editor.authoringScope === 'entire-motion' && editor.transformMode === 'semantic') editor.setAuthoringScope('current-frame')
  const first = controls.value[0]
  if (first && !controls.value.some(item => item.id === editor.selectedControlId)) editor.selectControl(first.id as MotionControlId)
})

function partDepth(part: MotionBodyPartDefinition) {
  let depth = 0
  let parent = part.parentId
  while (parent) {
    depth += 1
    parent = getMotionBodyPart(parent).parentId
  }
  return depth
}
function scopeDisabled(scope: MotionAuthoringScope) {
  return scope === 'entire-motion' && editor.transformMode === 'semantic'
}
function selectPart(id: MotionBodyPartId) {
  editor.selectBodyPart(id)
}
function selectedScopeHasTargets() {
  return editor.authoringScope !== 'selected-keyframes' || editor.selectedKeyframeIds.length > 0
}
function rawControlValue(control: MotionControlDefinition) {
  if (!editor.draft) return undefined
  return readMotionControlValue(editor.draft, control.id, editor.authoringScope, {
    playheadTimeMs: editor.playheadTimeMs,
    selectedKeyframeIds: editor.selectedKeyframeIds,
  })
}
function displayControlValue(control: MotionControlDefinition) {
  if (editor.authoringScope === 'selected-keyframes') return 0
  const value = rawControlValue(control)
  if (value === undefined) return ''
  const display = toMotionControlDisplayValue(value, control.displayUnit) + (control.displayUnit === 'ratio' ? 1 : 0)
  return Number(display.toFixed(control.displayUnit === 'degree' ? 1 : 3))
}
function inputStep(control: MotionControlDefinition) {
  return Number(toMotionControlDisplayValue(control.fineStep, control.displayUnit).toFixed(control.displayUnit === 'degree' ? 1 : 3))
}
function commitControl(control: MotionControlDefinition, event: Event) {
  const display = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(display) || !selectedScopeHasTargets()) return
  const normalizedDisplay = control.displayUnit === 'ratio' && editor.authoringScope !== 'selected-keyframes' ? display - 1 : display
  const value = fromMotionControlDisplayValue(normalizedDisplay, control.displayUnit)
  if (editor.authoringScope === 'selected-keyframes') editor.nudgeControl(control.id as MotionControlId, value)
  else editor.writeControlValue(control.id as MotionControlId, value)
}
function nudge(control: MotionControlDefinition, direction: -1 | 1, event: MouseEvent) {
  if (!selectedScopeHasTargets()) return
  const delta = (event.shiftKey ? control.fineStep : control.step) * direction
  editor.nudgeControl(control.id as MotionControlId, delta)
}
function unitLabel(control: MotionControlDefinition) {
  return control.displayUnit === 'degree' ? '°' : control.displayUnit === 'ratio' ? (editor.authoringScope === 'selected-keyframes' ? 'Δ倍率' : '倍率') : control.displayUnit === 'normalized' ? '0–1' : '局部距离'
}
</script>

<template>
  <section class="transform-editor">
    <header class="section-header">
      <div><small>直接操控</small><h3>身体部件与变换</h3></div>
      <button class="key-button" :disabled="!editor.draft" title="在当前时间写入所选控制（K）" @click="editor.keySelectedControl">K 定格</button>
    </header>

    <div class="scope-tabs">
      <button
        v-for="scope in scopeOptions"
        :key="scope.id"
        :class="{ active: editor.authoringScope === scope.id }"
        :disabled="scopeDisabled(scope.id)"
        :title="scope.hint"
        @click="editor.setAuthoringScope(scope.id)"
      >{{ scope.label }}</button>
    </div>
    <p class="scope-hint">{{ scopeOptions.find(item => item.id === editor.authoringScope)?.hint }}</p>
    <p v-if="editor.authoringScope === 'selected-keyframes' && !editor.selectedKeyframeIds.length" class="warning">请先在时间轴选择一个或多个关键帧。</p>

    <div class="part-tree" aria-label="动作身体部件树">
      <button
        v-for="part in MOTION_BODY_PARTS"
        :key="part.id"
        :class="{ active: editor.selectedBodyPartId === part.id }"
        :style="{ '--depth': partDepth(part) }"
        @click="selectPart(part.id)"
      ><span>{{ part.icon }}</span><strong>{{ part.labelZh }}</strong></button>
    </div>

    <div class="mode-tabs">
      <button
        v-for="mode in modeOptions"
        :key="mode.id"
        :class="{ active: editor.transformMode === mode.id }"
        :disabled="!availableModes.includes(mode.id)"
        @click="editor.setTransformMode(mode.id)"
      ><kbd>{{ mode.shortcut }}</kbd>{{ mode.label }}</button>
    </div>

    <div class="selection-line">
      <div><strong>{{ selectedPart.labelZh }}</strong><small>动作偏移控制</small></div>
      <label v-if="symmetryAvailable"><input v-model="editor.symmetryEnabled" type="checkbox"> 对称编辑</label>
    </div>

    <div v-if="controls.length" class="control-list">
      <div v-for="control in controls" :key="control.id" class="control-row" :class="{ selected: editor.selectedControlId === control.id }" @click="editor.selectControl(control.id as MotionControlId)">
        <div class="control-label"><strong>{{ control.labelZh }}</strong><small>{{ unitLabel(control) }}</small></div>
        <button :disabled="!selectedScopeHasTargets()" title="按住 Shift 使用精细步长" @click.stop="nudge(control,-1,$event)">−</button>
        <div class="value-field">
          <input
            :value="displayControlValue(control)"
            type="number"
            :step="inputStep(control)"
            :placeholder="editor.authoringScope === 'selected-keyframes' ? 'Δ 0' : '—'"
            :disabled="!selectedScopeHasTargets()"
            @focus="editor.selectControl(control.id as MotionControlId)"
            @change="commitControl(control,$event)"
          >
          <span v-if="control.displayUnit === 'degree'">°</span>
        </div>
        <button :disabled="!selectedScopeHasTargets()" title="按住 Shift 使用精细步长" @click.stop="nudge(control,1,$event)">＋</button>
        <button class="reset" :disabled="!selectedScopeHasTargets()" title="恢复此控制" @click.stop="editor.resetControl(control.id as MotionControlId)">↺</button>
      </div>
    </div>
    <p v-else class="empty">当前部件没有此类控制。可切换移动、旋转、缩放或语义模式。</p>

    <div class="authoring-toggles">
      <label><input v-model="editor.autoKey" type="checkbox"> 自动关键帧</label>
      <label><input v-model="editor.snapToFrames" type="checkbox"> FPS 吸附</label>
    </div>
    <small class="footer-hint">数值始终是相对于外观配方的动作偏移；整段动作使用独立加成修正层。</small>
  </section>
</template>

<style scoped>
.transform-editor{box-sizing:border-box;display:grid;min-width:0;max-width:100%;overflow:hidden;gap:9px;padding:10px;border:1px solid #52e0d022;border-radius:12px;background:linear-gradient(145deg,#52e0d008,#7066ff08)}.section-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.section-header>div{display:grid;gap:3px}.section-header small{color:#727d9c;font:800 8px/1 ui-monospace,monospace;letter-spacing:.14em}.section-header h3{margin:0;font-size:13px}.key-button,.scope-tabs button,.mode-tabs button,.control-row button,.part-tree button{border:1px solid #ffffff1c;color:#dfe5ff;background:#090e1b;cursor:pointer}.key-button{min-height:30px;padding:0 8px;border-radius:8px;border-color:#52e0d055}.scope-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.scope-tabs button,.mode-tabs button{min-height:31px;border-radius:7px;font-size:9px}.scope-tabs button.active,.mode-tabs button.active{border-color:#52e0d077;background:#52e0d018;color:#d7fff9}.scope-tabs button:disabled,.mode-tabs button:disabled,.control-row button:disabled{cursor:not-allowed;opacity:.3}.scope-hint,.footer-hint{margin:0;color:#77829f;font-size:8px;line-height:1.45}.warning{margin:0;padding:7px;border:1px solid #ffcb6b44;border-radius:8px;color:#ffcf79;background:#ffcb6b0b;font-size:8px}.part-tree{display:grid;max-width:100%;max-height:220px;overflow-x:hidden;overflow-y:auto;padding:4px;border:1px solid #ffffff12;border-radius:10px;background:#080c16}.part-tree button{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:5px;min-height:29px;padding:0 7px 0 calc(7px + var(--depth) * 13px);border:0;border-radius:6px;text-align:left}.part-tree button:hover{background:#ffffff08}.part-tree button.active{color:#d6fff9;background:#52e0d018;box-shadow:inset 2px 0 #52e0d0}.part-tree span{color:#7fe7dc;text-align:center}.part-tree strong{font-size:9px}.part-tree small{overflow:hidden;color:#66718e;font-size:7px;text-overflow:ellipsis;white-space:nowrap}.mode-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.mode-tabs button{display:flex;align-items:center;justify-content:center;gap:4px}.mode-tabs kbd{display:grid;place-items:center;min-width:17px;height:17px;border:1px solid #ffffff22;border-radius:4px;color:#8e98b6;background:#ffffff08;font:700 8px/1 ui-monospace,monospace}.selection-line{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 1px}.selection-line>div{display:grid;gap:2px}.selection-line strong{font-size:10px}.selection-line small{color:#6d7896;font-size:8px}.selection-line label,.authoring-toggles label{display:flex;align-items:center;gap:5px;color:#aeb7d0;font-size:8px}.control-list{display:grid;gap:5px;min-width:0;max-width:100%}.control-row{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(58px,72px) 26px 26px;align-items:center;gap:4px;padding:5px;border:1px solid #ffffff12;border-radius:9px;background:#090d17}.control-row.selected{border-color:#7066ff66;background:#7066ff0c}.control-label{display:grid;gap:2px;min-width:0}.control-label strong{overflow:hidden;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.control-label small{color:#66718f;font-size:7px}.control-row button{width:26px;height:28px;padding:0;border-radius:7px}.control-row .reset{color:#8590ae}.value-field{position:relative}.value-field input{box-sizing:border-box;width:100%;height:29px;padding:0 18px 0 6px;border:1px solid #ffffff1c;border-radius:7px;color:#fff;background:#060a13;font:700 9px/1 ui-monospace,monospace}.value-field span{position:absolute;right:6px;top:7px;color:#697491;font-size:8px}.authoring-toggles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding-top:4px;border-top:1px solid #ffffff12}.empty{margin:0;padding:9px;border:1px dashed #ffffff1b;border-radius:8px;color:#77829f;font-size:8px;line-height:1.45}@media(max-width:1180px){.part-tree{grid-template-columns:repeat(2,minmax(0,1fr));max-height:none}.part-tree button{padding-left:7px}.control-row{grid-template-columns:minmax(0,1fr) 28px minmax(70px,92px) 28px 28px}}
</style>
