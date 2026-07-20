<!--
  文件职责 / File responsibility
  网络规则列表与新增、复制、启停、编辑和删除入口。
  Network-rule list with create, duplicate, enable, edit, and delete actions.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NetworkEntry, NetworkRule } from '@nova/shared/network'

// 列表页只发出意图事件，不直接写入仓储。 / The list page emits intent events and never writes the repository directly.
const props = defineProps<{
  rules: NetworkRule[]
  entries: NetworkEntry[]
  origin: string
  highlightedRuleId?: string
}>()

const emit = defineEmits<{
  create: []
  edit: [rule: NetworkRule]
  duplicate: [rule: NetworkRule]
  remove: [rule: NetworkRule]
  toggle: [ruleId: string, enabled: boolean]
}>()

const query = ref('')
const onlyCurrentSite = ref(true)

const visibleRules = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return props.rules
    .filter((rule) => {
      if (onlyCurrentSite.value && rule.scopeOrigin !== '*' && rule.scopeOrigin !== props.origin) return false
      if (!keyword) return true
      return `${rule.name} ${rule.match.methods.join(' ')} ${rule.match.urlPattern} ${actionLabel(rule)}`.toLowerCase().includes(keyword)
    })
    .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt))
})

const hitCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const entry of props.entries) {
    if (!entry.ruleId) continue
    counts.set(entry.ruleId, (counts.get(entry.ruleId) || 0) + 1)
  }
  return counts
})

function actionLabel(rule: NetworkRule) {
  if (rule.action.type === 'mock') return 'Mock'
  if (rule.action.type === 'modify-response') return '修改响应'
  return `延迟 ${rule.action.delayMs}ms`
}

function sourceLabel(rule: NetworkRule) {
  if (rule.source === 'captured-request') return '来自请求'
  if (rule.source === 'duplicate') return '复制规则'
  return '手动创建'
}
</script>

<template>
  <!-- 规则搜索、批量状态和单条操作 / Rule search, aggregate state, and row actions -->
  <section class="rule-list-page">
    <div class="rules-toolbar">
      <div>
        <span>MOCK RULE WORKBENCH</span>
        <strong>可直接创建尚不存在的接口</strong>
      </div>
      <button type="button" @click="emit('create')">＋ 新增规则</button>
    </div>

    <div class="rule-filter-bar">
      <input v-model="query" type="search" placeholder="搜索名称、URL、方法或类型" aria-label="搜索网络规则">
      <button type="button" :class="{ active: onlyCurrentSite }" @click="onlyCurrentSite = !onlyCurrentSite">
        {{ onlyCurrentSite ? '当前网站' : '全部网站' }}
      </button>
    </div>

    <div v-if="visibleRules.length" class="rules-list">
      <article
        v-for="rule in visibleRules"
        :key="rule.id"
        :class="{
          disabled: !rule.enabled,
          highlighted: highlightedRuleId === rule.id,
        }"
      >
        <label class="rule-switch" :title="rule.enabled ? '停用规则' : '启用规则'">
          <input :checked="rule.enabled" type="checkbox" @change="emit('toggle', rule.id, ($event.target as HTMLInputElement).checked)">
          <i />
        </label>

        <div class="rule-main">
          <header>
            <strong>{{ rule.name }}</strong>
            <span>{{ actionLabel(rule) }}</span>
          </header>
          <code>{{ rule.match.methods.join(', ') }} · {{ rule.match.urlPattern }}</code>
          <small>
            {{ rule.scopeOrigin === '*' ? '所有已开启网站' : rule.scopeOrigin }}
            · 优先级 {{ rule.priority }}
            · 命中 {{ hitCounts.get(rule.id) || 0 }} 次
            · {{ sourceLabel(rule) }}
          </small>
        </div>

        <div class="rule-actions">
          <button type="button" @click="emit('edit', rule)">编辑</button>
          <button type="button" @click="emit('duplicate', rule)">复制</button>
          <button type="button" class="danger" @click="emit('remove', rule)">删除</button>
        </div>
      </article>
    </div>

    <div v-else class="rules-empty">
      <strong>{{ rules.length ? '没有符合条件的规则' : '还没有网络规则' }}</strong>
      <p>无需等待真实请求，手动输入任意接口路径即可直接返回 Mock 数据。</p>
      <button type="button" @click="emit('create')">创建 Mock 规则</button>
    </div>
  </section>
</template>

<style scoped>
.rule-list-page { display: grid; gap: 10px; }
.rules-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px; border: 1px solid #242b45; border-radius: 13px; background: #0a0e1a; }
.rules-toolbar span { color: #757e9f; font: 700 8px/1 ui-monospace, monospace; letter-spacing: .14em; }
.rules-toolbar strong { display: block; margin-top: 5px; color: #aab1cd; font-size: 9px; }
.rules-toolbar button, .rules-empty button { min-height: 34px; padding: 0 10px; border: 0; border-radius: 9px; background: linear-gradient(100deg,#7066ff,#5795ff); color: white; font-size: 9px; font-weight: 700; cursor: pointer; }
.rule-filter-bar { display: grid; grid-template-columns: minmax(0,1fr) 84px; gap: 6px; }
.rule-filter-bar input, .rule-filter-bar button { min-height: 34px; border: 1px solid #2a3150; border-radius: 9px; background: #101526; color: #aeb5d0; font-size: 9px; }
.rule-filter-bar input { min-width: 0; padding: 0 9px; outline: 0; }
.rule-filter-bar input:focus { border-color: #7066ff; box-shadow: 0 0 0 3px rgba(112,102,255,.12); }
.rule-filter-bar button { cursor: pointer; }
.rule-filter-bar button.active { border-color: rgba(112,102,255,.55); color: #eeeaff; background: rgba(112,102,255,.14); }
.rules-list { display: grid; gap: 7px; }
.rules-list article { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 10px; border: 1px solid #252c47; border-radius: 12px; background: #0a0e1a; transition: border-color .18s ease, background .18s ease, opacity .18s ease; }
.rules-list article.disabled { opacity: .58; }
.rules-list article.highlighted { border-color: rgba(112,102,255,.82); background: rgba(112,102,255,.09); box-shadow: 0 0 0 3px rgba(112,102,255,.08); }
.rule-switch { position: relative; width: 34px; height: 20px; }
.rule-switch input { position: absolute; opacity: 0; }
.rule-switch i { position: absolute; inset: 0; border-radius: 999px; background: #242b42; cursor: pointer; transition: .16s ease; }
.rule-switch i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #777f9e; transition: .16s ease; }
.rule-switch input:checked + i { background: rgba(112,102,255,.32); }
.rule-switch input:checked + i::after { left: 17px; background: #8d86ff; box-shadow: 0 0 8px rgba(112,102,255,.5); }
.rule-main { min-width: 0; }
.rule-main header { display: flex; gap: 6px; align-items: center; }
.rule-main header strong { min-width: 0; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.rule-main header span { flex: 0 0 auto; padding: 3px 5px; border-radius: 5px; background: rgba(112,102,255,.12); color: #a59eff; font-size: 7px; }
.rule-main code, .rule-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-main code { margin-top: 5px; color: #7982a3; font: 8px ui-monospace, monospace; }
.rule-main small { margin-top: 4px; color: #555f7e; font-size: 7px; }
.rule-actions { display: grid; gap: 4px; }
.rule-actions button { min-height: 25px; padding: 0 7px; border: 1px solid #2d3552; border-radius: 7px; background: #111629; color: #9fa7c5; font-size: 8px; cursor: pointer; }
.rule-actions button.danger { color: #d98da0; }
.rules-empty { padding: 24px 12px; border: 1px dashed #2a3150; border-radius: 13px; color: #68718f; text-align: center; }
.rules-empty strong { color: #cbd0e7; font-size: 12px; }
.rules-empty p { margin: 7px 0 12px; font-size: 9px; line-height: 1.5; }
@media (max-width: 360px) {
  .rules-list article { grid-template-columns: 34px minmax(0,1fr); }
  .rule-actions { grid-column: 1 / -1; grid-template-columns: repeat(3,1fr); }
}
</style>
