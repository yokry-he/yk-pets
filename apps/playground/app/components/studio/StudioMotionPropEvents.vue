<!--
  文件职责 / File responsibility
  在当前播放指针创建、查看和删除道具实例事件，用稳定道具 ID 编排持物、抛出、接住和效果序列。
  Creates, inspects, and deletes prop-instance events at the playhead, authoring hold, throw, catch, and effect sequences by stable prop ID.
-->
<script setup lang="ts">
import type { MotionPropEvent, MotionPropMountId, StudioMotionAssetV2 } from '@yk-pets/pet-core'
import type { StudioPropAssetMetadata } from '~/domain/studio-workspace'

const props = defineProps<{
  asset: StudioMotionAssetV2
  playheadTimeMs: number
  propAssets: StudioPropAssetMetadata[]
  selectedEventIds: string[]
}>()
const emit = defineEmits<{
  add: [value: { propId: string; instanceId: string; kind: MotionPropEvent['kind']; mountId?: MotionPropMountId; transform?: MotionPropEvent['transform']; style?: MotionPropEvent['style'] }]
  select: [id: string, additive: boolean]
  delete: [ids: string[]]
}>()
const propId = ref('')
const instanceId = ref('prop-instance-1')
const kind = ref<MotionPropEvent['kind']>('create')
const mountId = ref<MotionPropMountId>('right-front-paw')
const position = reactive({ x: 0, y: 0, z: 0 })
const scale = ref(1)
const color = ref('#66e8ff')
const glow = ref(.35)
const particleRate = ref(0)
const events = computed(() => props.asset.propEventTracks.flatMap(track => track.events.map(event => ({ ...event, propId: track.propId, instanceId: track.instanceId }))).sort((a, b) => a.timeMs - b.timeMs))
const eventLabels: Record<MotionPropEvent['kind'], string> = { create: '创建', show: '显示', attach: '挂载', detach: '脱离', move: '移动', hide: '隐藏', style: '样式', destroy: '销毁' }
const mountOptions: readonly [MotionPropMountId, string][] = [
  ['world', '世界'], ['pet-root', '宠物根'], ['head-top', '头顶'], ['muzzle', '口鼻'], ['left-front-paw', '左前爪'], ['right-front-paw', '右前爪'], ['left-hind-paw', '左后爪'], ['right-hind-paw', '右后爪'], ['tail-tip', '尾巴尖'],
]
watch(() => props.propAssets, list => { if (!propId.value && list[0]) propId.value = list[0].id }, { immediate: true })

function add() {
  if (!propId.value || !instanceId.value.trim()) return
  emit('add', {
    propId: propId.value,
    instanceId: instanceId.value.trim(),
    kind: kind.value,
    ...(['attach', 'move'].includes(kind.value) ? { mountId: mountId.value } : {}),
    ...(['create', 'attach', 'detach', 'move'].includes(kind.value) ? { transform: { position: [position.x, position.y, position.z], scale: [scale.value, scale.value, scale.value] } } : {}),
    ...(['create', 'show', 'style'].includes(kind.value) ? { style: { color: color.value, glow: glow.value, particleRate: particleRate.value } } : {}),
  })
}
</script>

<template>
  <section class="prop-events">
    <header><div><small>道具事件</small><h3>道具事件轨道</h3></div><span>{{ Math.round(playheadTimeMs) }} 毫秒</span></header>
    <div v-if="propAssets.length" class="event-form">
      <select v-model="propId"><option v-for="prop in propAssets" :key="prop.id" :value="prop.id">{{ prop.nameZh }}</option></select>
      <input v-model="instanceId" aria-label="实例 ID" placeholder="实例 ID">
      <select v-model="kind"><option v-for="item in ['create','show','attach','detach','move','hide','style','destroy'] as MotionPropEvent['kind'][]" :key="item" :value="item">{{ eventLabels[item] }}</option></select>
      <select v-model="mountId"><option v-for="[id,label] in mountOptions" :key="id" :value="id">{{ label }}</option></select>
      <div class="vector"><input v-model.number="position.x" type="number" step=".1" aria-label="X"><input v-model.number="position.y" type="number" step=".1" aria-label="Y"><input v-model.number="position.z" type="number" step=".1" aria-label="Z"></div>
      <div class="style-row"><input v-model="color" type="color" aria-label="颜色"><input v-model.number="scale" type="number" min=".05" max="8" step=".05" aria-label="缩放"><input v-model.number="glow" type="number" min="0" max="8" step=".1" aria-label="发光"><input v-model.number="particleRate" type="number" min="0" max="240" step="1" aria-label="粒子速率"></div>
      <button @click="add">在播放指针添加事件</button>
    </div>
    <p v-else>先在道具工坊创建道具，再从动作工坊路由引用。</p>
    <div class="event-list">
      <button v-for="event in events" :key="event.id" :class="{ selected: selectedEventIds.includes(event.id) }" @click="emit('select', event.id, $event.ctrlKey || $event.metaKey)">
        <b>{{ event.timeMs }}</b><span>{{ eventLabels[event.kind] }}</span><small>{{ event.instanceId }} · {{ event.propId }}</small>
      </button>
    </div>
    <button class="delete" :disabled="!selectedEventIds.length" @click="emit('delete', selectedEventIds)">删除所选事件</button>
  </section>
</template>

<style scoped>
.prop-events{box-sizing:border-box;display:grid;gap:7px;min-width:0;max-width:100%;overflow:hidden;padding:9px;border:1px solid #ffffff12;border-radius:11px;background:#070b15}
.prop-events header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.prop-events header div{display:grid;gap:3px;min-width:0}.prop-events small{color:#727d9d;font-size:8px}.prop-events h3,.prop-events p{margin:0}.prop-events header span{font:700 9px/1 ui-monospace,monospace;color:#66e8ff;white-space:nowrap}.event-form{display:grid;grid-template-columns:minmax(0,1fr);gap:5px;min-width:0}.event-form input,.event-form select,.event-form button,.delete{box-sizing:border-box;width:100%;min-width:0;min-height:30px;border:1px solid #ffffff1b;border-radius:7px;color:#eef2ff;background:#0a1020}.vector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;min-width:0}.style-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;min-width:0}.style-row input[type=color]{width:100%;padding:3px}.event-list{display:grid;gap:4px;max-width:100%;max-height:140px;overflow-x:hidden;overflow-y:auto}.event-list button{box-sizing:border-box;display:grid;grid-template-columns:38px 46px minmax(0,1fr);align-items:center;gap:5px;width:100%;min-width:0;min-height:29px;border:1px solid #ffffff12;border-radius:7px;color:#b8c1dc;background:#ffffff04;text-align:left}.event-list button.selected{border-color:#ffcb6b77;background:#ffcb6b12}.event-list b{color:#ffcb6b;font:700 8px/1 ui-monospace,monospace}.event-list span,.event-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.delete:disabled{opacity:.35}
</style>
