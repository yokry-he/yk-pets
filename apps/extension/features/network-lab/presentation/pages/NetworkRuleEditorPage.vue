<!--
  文件职责 / File responsibility
  Side Panel 全页规则编辑器，支持 Mock、响应修改、延迟和 JSON 专注编辑。
  Full-page Side Panel rule editor for Mocking, whole-JSON response replacement, delay, and focused JSON editing.
-->
<script setup lang="ts">
import { computed, toRef } from 'vue'
import type {
  NetworkHttpMethod,
  NetworkMockBodyType,
  NetworkQueryOperator,
  NetworkRule,
  NetworkRuleActionType,
} from '@nova/shared/network'
import type { NetworkRuleEditorMode } from '../../domain/network-rule-factory'
import { useNetworkRuleEditor } from '../composables/useNetworkRuleEditor'

// 页面输入只接收领域规则和模式，所有可变编辑状态由 Composable 管理。 / Page props carry domain rules and mode; mutable editor state lives in the composable.
const props = defineProps<{
  rule: NetworkRule
  mode: NetworkRuleEditorMode
  origin: string
  sourceRuleId?: string
  rules: NetworkRule[]
  busy?: boolean
}>()

const emit = defineEmits<{
  save: [rule: NetworkRule]
  cancel: []
}>()

const methods: NetworkHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', '*']
const actionTypes: Array<{ value: NetworkRuleActionType; label: string; description: string }> = [
  { value: 'mock', label: '直接返回 Mock', description: '不发送真实请求，可模拟尚不存在的接口。' },
  { value: 'modify-response', label: '修改真实响应', description: '先请求真实接口，再用编辑后的完整 JSON 替换响应正文。' },
  { value: 'delay', label: '仅模拟延迟', description: '保持真实响应，只增加请求等待时间。' },
]

// 创建单一编辑器状态机，统一新增、请求生成、编辑和复制流程。 / One editor state machine unifies create, from-request, edit, and duplicate flows.
const editor = useNetworkRuleEditor({
  initialRule: props.rule,
  mode: props.mode,
  origin: props.origin,
  sourceRuleId: props.sourceRuleId,
  allRules: toRef(props, 'rules'),
})

const title = computed(() => {
  if (props.mode === 'from-request') return '从请求生成 Mock'
  if (props.mode === 'duplicate') return '复制 Mock 规则'
  if (props.mode === 'edit') return '编辑 Mock 规则'
  return '新增 Mock 规则'
})

const subtitle = computed(() => {
  if (props.mode === 'from-request') return '已自动带入捕获到的 URL、方法和响应数据。'
  if (props.mode === 'duplicate') return '副本默认停用，修改后可选择保存并启用。'
  if (props.mode === 'edit') return '修改会在保存后立即同步到当前页面。'
  return '可以直接填写一个服务端尚不存在的接口路径。'
})

const mock = computed(() => editor.draft.value.action.mock)
const focusedJsonTitle = computed(() => editor.draft.value.action.type === 'modify-response' ? '修改真实响应 JSON' : 'Mock 响应专注编辑')
const focusedJsonLabel = computed(() => editor.draft.value.action.type === 'modify-response' ? '真实响应 JSON 专注编辑器' : 'Mock JSON 专注编辑器')
const testStatus = computed(() => {
  if (!editor.testResult.value.matched) return { kind: 'empty', title: '未命中任何规则', detail: '检查 URL、方法、网站范围和 Query 条件。' }
  if (editor.testMatchesCurrent.value) {
    return {
      kind: 'success',
      title: '当前规则会命中',
      detail: editor.draft.value.action.type === 'mock'
        ? '请求将直接返回 Mock，不会访问真实服务器。'
        : '请求会按当前规则处理。',
    }
  }
  return {
    kind: 'danger',
    title: `会先命中“${editor.testResult.value.selectedRule?.name || '其他规则'}”`,
    detail: '请调整优先级或缩小匹配范围。',
  }
})

function submit(forceEnabled?: boolean) {
  if (forceEnabled !== undefined) editor.draft.value.enabled = forceEnabled
  const rule = editor.buildRule()
  if (rule) emit('save', rule)
}

function cancel() {
  if (editor.dirty.value && !confirm('当前内容已自动保存为草稿。确认返回规则列表？')) return
  emit('cancel')
}

function updateMethod(event: Event) {
  editor.updateMethod((event.target as HTMLSelectElement).value as NetworkHttpMethod)
}

function updateActionType(event: Event) {
  editor.setActionType((event.target as HTMLInputElement).value as NetworkRuleActionType)
}

function updateBodyType(event: Event) {
  editor.setBodyType((event.target as HTMLSelectElement).value as NetworkMockBodyType)
}

function updateQueryOperator(id: string, event: Event) {
  editor.updateQueryOperator(id, (event.target as HTMLSelectElement).value as NetworkQueryOperator)
}
</script>

<template>
  <!-- 全页规则编辑器 / Full-page rule editor -->
  <section class="rule-editor-page" :class="{ 'json-focus': editor.focusedJson.value }">
    <!-- JSON 专注编辑：隐藏其他字段，减少窄 Side Panel 中的干扰。 / Focused JSON editing hides other fields in the narrow Side Panel. -->
    <template v-if="editor.focusedJson.value">
      <header class="focus-header">
        <button type="button" class="back-button" @click="editor.focusedJson.value = false">← 返回规则</button>
        <div><span>FOCUS JSON EDITOR</span><strong>{{ focusedJsonTitle }}</strong></div>
        <button type="button" class="secondary-button" @click="editor.formatJson">格式化</button>
      </header>
      <textarea
        v-model="editor.mockBodyText.value"
        class="focus-json-textarea"
        spellcheck="false"
        :aria-label="focusedJsonLabel"
      />
      <footer class="focus-footer">
        <span>{{ editor.savingDraft.value ? '正在保存草稿…' : '内容会自动保存为草稿' }}</span>
        <button type="button" class="primary-button" @click="editor.focusedJson.value = false">完成编辑</button>
      </footer>
    </template>

    <!-- 分步规则表单 / Progressive rule form -->
    <template v-else>
      <header class="editor-page-header">
        <button type="button" class="back-button" @click="cancel">← 规则列表</button>
        <div class="editor-heading">
          <span>MOCK RULE EDITOR</span>
          <h2>{{ title }}</h2>
          <p>{{ subtitle }}</p>
        </div>
        <div class="draft-status" :class="{ restored: editor.restoredDraft.value }">
          {{ editor.restoredDraft.value ? '已恢复草稿' : editor.savingDraft.value ? '保存草稿中' : editor.dirty.value ? '未保存修改' : '已同步' }}
        </div>
      </header>

      <section class="editor-section">
        <header><b>01</b><div><span>BASIC</span><strong>基本信息</strong></div></header>
        <div class="field-grid two-columns">
          <label>
            <span>规则名称</span>
            <input v-model="editor.draft.value.name" type="text" placeholder="例如：用户列表 Mock" autocomplete="off">
          </label>
          <label>
            <span>优先级</span>
            <input v-model.number="editor.draft.value.priority" type="number" min="0" max="10000">
          </label>
        </div>
        <div class="field-grid two-columns">
          <label>
            <span>生效网站</span>
            <select v-model="editor.draft.value.scopeOrigin">
              <option :value="origin">当前网站 · {{ origin }}</option>
              <option value="*">所有已开启网站</option>
            </select>
          </label>
          <label class="enabled-field">
            <span>保存后状态</span>
            <button type="button" class="state-toggle" :class="{ active: editor.draft.value.enabled }" @click="editor.draft.value.enabled = !editor.draft.value.enabled">
              <i />{{ editor.draft.value.enabled ? '立即启用' : '保存但停用' }}
            </button>
          </label>
        </div>
      </section>

      <section class="editor-section">
        <header><b>02</b><div><span>REQUEST MATCH</span><strong>请求匹配</strong></div></header>
        <div class="field-grid url-grid">
          <label>
            <span>接口 URL 或路径</span>
            <input v-model="editor.draft.value.match.urlPattern" type="text" placeholder="/api/users 或 */api/users*" spellcheck="false">
            <small>相对路径会在生效网站内匹配；完整 URL、通配符和正则均可使用。</small>
          </label>
          <label>
            <span>匹配方式</span>
            <select v-model="editor.draft.value.match.patternType">
              <option value="glob">通配符</option>
              <option value="regex">正则表达式</option>
            </select>
          </label>
        </div>
        <div class="field-grid two-columns">
          <label>
            <span>请求方法</span>
            <select :value="editor.draft.value.match.methods[0] || '*'" @change="updateMethod">
              <option v-for="method in methods" :key="method" :value="method">{{ method }}</option>
            </select>
          </label>
          <label>
            <span>来源</span>
            <input :value="editor.draft.value.source === 'captured-request' ? '已捕获请求' : editor.draft.value.source === 'duplicate' ? '复制规则' : '手动创建'" disabled>
          </label>
        </div>

        <div class="query-heading">
          <div><span>QUERY CONDITIONS</span><strong>Query 条件</strong></div>
          <button type="button" @click="editor.addQueryCondition">＋ 添加条件</button>
        </div>
        <div v-if="editor.draft.value.match.query?.length" class="query-list">
          <div v-for="condition in editor.draft.value.match.query" :key="condition.id" class="query-row">
            <input v-model="condition.key" type="text" placeholder="参数名">
            <select :value="condition.operator" @change="updateQueryOperator(condition.id, $event)">
              <option value="equals">等于</option>
              <option value="contains">包含</option>
              <option value="exists">存在</option>
            </select>
            <input v-if="condition.operator !== 'exists'" v-model="condition.value" type="text" placeholder="参数值">
            <span v-else class="query-placeholder">无需填写值</span>
            <button type="button" aria-label="删除 Query 条件" @click="editor.removeQueryCondition(condition.id)">×</button>
          </div>
        </div>
        <p v-else class="inline-empty">不配置 Query 条件时，仅根据 URL 和方法匹配。</p>
      </section>

      <section class="editor-section">
        <header><b>03</b><div><span>RESPONSE ACTION</span><strong>响应处理</strong></div></header>
        <fieldset class="action-options">
          <label v-for="option in actionTypes" :key="option.value" :class="{ active: editor.draft.value.action.type === option.value }">
            <input :checked="editor.draft.value.action.type === option.value" type="radio" name="action-type" :value="option.value" @change="updateActionType">
            <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
          </label>
        </fieldset>

        <label class="horizontal-field">
          <span>模拟延迟</span>
          <div><input v-model.number="editor.draft.value.action.delayMs" type="number" min="0" max="60000" step="100"><em>ms</em></div>
        </label>

        <template v-if="editor.draft.value.action.type === 'mock' && mock">
          <div class="field-grid two-columns">
            <label>
              <span>HTTP 状态码</span>
              <input v-model.number="mock.status" type="number" min="100" max="599">
            </label>
            <label>
              <span>响应格式</span>
              <select :value="mock.bodyType" @change="updateBodyType">
                <option value="json">JSON</option>
                <option value="text">文本</option>
              </select>
            </label>
          </div>
          <label class="response-editor-field">
            <span>
              <b>{{ mock.bodyType === 'json' ? 'Mock JSON' : 'Mock 文本' }}</b>
              <i>
                <button v-if="mock.bodyType === 'json'" type="button" @click="editor.formatJson">格式化</button>
                <button type="button" @click="editor.focusedJson.value = true">专注编辑</button>
              </i>
            </span>
            <textarea v-model="editor.mockBodyText.value" rows="12" spellcheck="false" placeholder="{ &quot;code&quot;: 0, &quot;data&quot;: {} }" />
          </label>
        </template>

        <template v-else-if="editor.draft.value.action.type === 'modify-response'">
          <div class="response-source-note">
            <strong>完整 JSON 替换</strong>
            <p>基于请求生成时，这里会带入已捕获的真实响应。可直接修改整份 JSON；保存后仍会请求真实接口，但网页最终收到的是编辑后的内容。</p>
          </div>
          <label class="response-editor-field">
            <span>
              <b>真实响应 JSON</b>
              <i>
                <button type="button" @click="editor.formatJson">格式化</button>
                <button type="button" @click="editor.focusedJson.value = true">专注编辑</button>
              </i>
            </span>
            <textarea v-model="editor.mockBodyText.value" rows="16" spellcheck="false" placeholder="请先从请求列表选择一个 JSON 请求生成规则" />
          </label>
        </template>
      </section>

      <section class="editor-section test-section">
        <header><b>04</b><div><span>TEST & CONFLICT</span><strong>测试与冲突</strong></div></header>
        <div class="field-grid test-grid">
          <label>
            <span>测试 URL</span>
            <input v-model="editor.testUrl.value" type="text" spellcheck="false">
          </label>
          <label>
            <span>方法</span>
            <select v-model="editor.testMethod.value">
              <option v-for="method in methods.filter(item => item !== '*')" :key="method" :value="method">{{ method }}</option>
            </select>
          </label>
        </div>

        <article class="test-result" :data-kind="testStatus.kind">
          <i />
          <div><strong>{{ testStatus.title }}</strong><p>{{ testStatus.detail }}</p></div>
        </article>

        <div v-if="editor.conflicts.value.length" class="conflict-list">
          <strong>发现 {{ editor.conflicts.value.length }} 个潜在冲突</strong>
          <article v-for="conflict in editor.conflicts.value" :key="conflict.ruleId" :data-severity="conflict.severity">
            <b>{{ conflict.ruleName }}</b><p>{{ conflict.reason }}</p>
          </article>
        </div>

        <details v-if="editor.draft.value.action.type !== 'delay'" class="response-preview">
          <summary>{{ editor.draft.value.action.type === 'modify-response' ? '预览替换后的完整 JSON' : '预览最终响应' }}</summary>
          <pre>{{ editor.bodyPreview.value }}</pre>
        </details>
      </section>

      <p v-if="editor.error.value" class="editor-error">{{ editor.error.value }}</p>

      <footer class="editor-actions">
        <button type="button" class="secondary-button" @click="cancel">返回</button>
        <button type="button" class="secondary-button" :disabled="busy" @click="submit(false)">保存并停用</button>
        <button type="button" class="primary-button" :disabled="busy" @click="submit(true)">{{ busy ? '保存中…' : '保存并启用' }}</button>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.rule-editor-page { display: grid; gap: 10px; min-height: calc(100vh - 30px); }
.editor-page-header, .focus-header { position: sticky; top: 0; z-index: 5; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 10px; border: 1px solid #282f4b; border-radius: 14px; background: rgba(8,12,24,.96); box-shadow: 0 10px 26px rgba(0,0,0,.22); backdrop-filter: blur(16px); }
.editor-heading { min-width: 0; }
.editor-heading > span, .focus-header span, .editor-section header span, .query-heading span { color: #747d9d; font: 700 7px ui-monospace, monospace; letter-spacing: .14em; }
.editor-heading h2 { margin: 3px 0; font-size: 13px; }
.editor-heading p { margin: 0; overflow: hidden; color: #646d8c; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.back-button, .secondary-button, .primary-button { min-height: 32px; padding: 0 9px; border: 1px solid #303752; border-radius: 9px; background: #111629; color: #aeb5d0; font-size: 8px; cursor: pointer; }
.primary-button { border-color: transparent; background: linear-gradient(100deg,#7066ff,#5795ff); color: white; font-weight: 750; }
.draft-status { padding: 5px 7px; border-radius: 7px; background: rgba(255,211,106,.08); color: #b5a675; font-size: 7px; white-space: nowrap; }
.draft-status.restored { background: rgba(82,224,208,.08); color: #72cfc3; }
.editor-section { display: grid; gap: 11px; padding: 12px; border: 1px solid #242b45; border-radius: 14px; background: #0a0e1a; }
.editor-section > header { display: flex; align-items: center; gap: 8px; }
.editor-section > header > b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; background: rgba(112,102,255,.13); color: #9f98ff; font: 750 8px ui-monospace, monospace; }
.editor-section > header strong, .query-heading strong { display: block; margin-top: 3px; font-size: 11px; }
.field-grid { display: grid; gap: 8px; }
.two-columns { grid-template-columns: minmax(0,1fr) 112px; }
.url-grid { grid-template-columns: minmax(0,1fr) 96px; }
.test-grid { grid-template-columns: minmax(0,1fr) 88px; }
label { min-width: 0; display: grid; gap: 5px; }
label > span, .horizontal-field > span { color: #7c84a4; font-size: 8px; font-weight: 700; }
input, select, textarea { width: 100%; min-width: 0; border: 1px solid #29304b; border-radius: 9px; outline: 0; background: #070b15; color: #eef0ff; font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
input, select { min-height: 36px; padding: 0 9px; }
textarea { resize: vertical; padding: 10px; }
input:focus, select:focus, textarea:focus { border-color: #7066ff; box-shadow: 0 0 0 3px rgba(112,102,255,.11); }
input:disabled { color: #616a89; }
small { color: #5d6686; font-size: 7px; line-height: 1.45; }
.enabled-field { align-content: end; }
.state-toggle { min-height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid #2b3250; border-radius: 9px; background: #101526; color: #8f98b7; font-size: 8px; cursor: pointer; }
.state-toggle i { width: 8px; height: 8px; border-radius: 50%; background: #68718e; }
.state-toggle.active { border-color: rgba(112,102,255,.5); color: #e8e6ff; background: rgba(112,102,255,.12); }
.state-toggle.active i { background: #8e87ff; box-shadow: 0 0 8px rgba(112,102,255,.7); }
.query-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 2px; }
.query-heading button, .response-editor-field span button { min-height: 27px; padding: 0 7px; border: 1px solid #2d3552; border-radius: 7px; background: #111629; color: #a0a8c5; font-size: 7px; cursor: pointer; }
.query-list { display: grid; gap: 6px; }
.query-row { display: grid; grid-template-columns: minmax(0,.8fr) 76px minmax(0,1fr) 28px; gap: 5px; }
.query-row input, .query-row select { min-height: 32px; }
.query-row > button { border: 1px solid #343b58; border-radius: 8px; background: #111629; color: #d28b9e; cursor: pointer; }
.query-placeholder { display: grid; place-items: center; border: 1px dashed #2a3150; border-radius: 8px; color: #5d6686; font-size: 7px; }
.inline-empty { margin: 0; padding: 8px; border-radius: 8px; background: #0e1322; color: #5e6786; font-size: 8px; }
.action-options { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; }
.action-options label { grid-template-columns: 16px minmax(0,1fr); align-items: start; padding: 9px; border: 1px solid transparent; border-radius: 10px; background: #0d1221; cursor: pointer; }
.action-options label.active { border-color: rgba(112,102,255,.48); background: rgba(112,102,255,.11); }
.action-options input { width: 14px; min-height: auto; margin-top: 2px; padding: 0; }
.action-options strong, .action-options small { display: block; }
.action-options strong { color: #dfe3fa; font-size: 9px; }
.action-options small { margin-top: 3px; }
.horizontal-field { grid-template-columns: minmax(0,1fr) 132px; align-items: center; }
.horizontal-field > div { display: grid; grid-template-columns: minmax(0,1fr) 28px; align-items: center; }
.horizontal-field input { border-radius: 9px 0 0 9px; }
.horizontal-field em { height: 36px; display: grid; place-items: center; border: 1px solid #29304b; border-left: 0; border-radius: 0 9px 9px 0; background: #0d1221; color: #656e8d; font: 7px ui-monospace, monospace; }
.response-editor-field > span { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.response-editor-field > span i { display: flex; gap: 5px; font-style: normal; }
.response-editor-field textarea { min-height: 230px; }
.response-source-note { padding: 9px; border: 1px solid rgba(82,224,208,.18); border-radius: 9px; background: rgba(82,224,208,.05); }
.response-source-note strong { color: #83ded3; font-size: 8px; }
.response-source-note p { margin: 4px 0 0; color: #697493; font-size: 7px; line-height: 1.55; }
.test-result { display: grid; grid-template-columns: 8px minmax(0,1fr); gap: 8px; padding: 9px; border-radius: 10px; background: #0d1221; }
.test-result > i { width: 8px; height: 8px; margin-top: 2px; border-radius: 50%; background: #68718f; }
.test-result[data-kind="success"] > i { background: #52e0d0; box-shadow: 0 0 8px rgba(82,224,208,.55); }
.test-result[data-kind="danger"] > i { background: #ff6f8f; }
.test-result strong { font-size: 9px; }
.test-result p { margin: 3px 0 0; color: #737c9c; font-size: 8px; line-height: 1.45; }
.conflict-list { display: grid; gap: 6px; }
.conflict-list > strong { color: #d8b969; font-size: 8px; }
.conflict-list article { padding: 8px; border-left: 3px solid #ffd36a; border-radius: 8px; background: rgba(255,211,106,.05); }
.conflict-list article[data-severity="danger"] { border-left-color: #ff6f8f; background: rgba(255,111,143,.05); }
.conflict-list b { font-size: 8px; }
.conflict-list p { margin: 3px 0 0; color: #747d9d; font-size: 7px; line-height: 1.4; }
.response-preview { border: 1px solid #242b45; border-radius: 9px; overflow: hidden; }
.response-preview summary { padding: 8px; color: #8e96b5; font-size: 8px; cursor: pointer; }
.response-preview pre { max-height: 220px; margin: 0; padding: 9px; overflow: auto; background: #060a13; color: #abb2cf; font: 8px/1.5 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
.editor-error { position: sticky; bottom: 56px; z-index: 4; margin: 0; padding: 9px; border: 1px solid rgba(255,111,143,.28); border-radius: 9px; background: rgba(43,13,25,.96); color: #ff9bb0; font-size: 8px; }
.editor-actions { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: auto 1fr 1fr; gap: 6px; padding: 9px; border: 1px solid #282f4b; border-radius: 13px; background: rgba(8,12,24,.96); box-shadow: 0 -12px 24px rgba(0,0,0,.22); backdrop-filter: blur(16px); }
.focus-header strong { display: block; margin-top: 3px; font-size: 10px; }
.focus-json-textarea { min-height: calc(100vh - 150px); resize: none; border-radius: 13px; font-size: 10px; line-height: 1.6; }
.focus-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.focus-footer span { color: #68718f; font-size: 8px; }
button:disabled { opacity: .48; cursor: not-allowed; }
@media (max-width: 360px) {
  .editor-page-header { grid-template-columns: auto minmax(0,1fr); }
  .draft-status { grid-column: 1 / -1; text-align: center; }
  .two-columns, .url-grid, .test-grid { grid-template-columns: 1fr; }
  .query-row { grid-template-columns: 1fr 80px 28px; }
  .query-row > :nth-child(3) { grid-column: 1 / 3; }
  .editor-actions { grid-template-columns: 1fr 1fr; }
  .editor-actions .primary-button { grid-column: 1 / -1; }
}
</style>
