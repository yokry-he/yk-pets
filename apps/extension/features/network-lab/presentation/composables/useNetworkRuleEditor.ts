/**
 * 文件职责 / File responsibility
 * 管理规则编辑草稿、校验、测试、冲突检测和自动保存。
 * Manages rule drafts, validation, testing, conflict detection, and autosave.
 */
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type {
  NetworkHttpMethod,
  NetworkMockBodyType,
  NetworkQueryOperator,
  NetworkRule,
  NetworkRuleActionType,
} from '@nova/shared/network'
import { NetworkRuleConflictService } from '../../domain/network-rule-conflict-service'
import { testRules } from '../../domain/network-rule-matcher'
import type { NetworkRuleEditorMode } from '../../domain/network-rule-factory'
import { cloneNetworkValue } from '../../domain/network-value-clone'
import { ChromeRuleDraftRepository } from '../../infrastructure/chrome-rule-draft-repository'

export interface UseNetworkRuleEditorOptions {
  initialRule: NetworkRule
  mode: NetworkRuleEditorMode
  origin: string
  sourceRuleId?: string
  allRules: Ref<NetworkRule[]>
}

/**
 * 规则编辑器状态机：管理草稿恢复、输入变更、自动保存、测试、冲突和最终领域对象。
 * Rule-editor state machine for draft recovery, changes, autosave, testing, conflicts, and final domain objects.
 */
export function useNetworkRuleEditor(options: UseNetworkRuleEditorOptions) {
  const draftRepository = new ChromeRuleDraftRepository()
  const conflictService = new NetworkRuleConflictService()
  // 编辑态始终使用深拷贝，取消操作不会污染列表中的原规则。 / Editing always uses a deep clone so canceling cannot mutate the list rule.
  const draft = ref<NetworkRule>(clone(options.initialRule))
  const mockBodyText = ref(serializeBody(draft.value))
  const testUrl = ref(defaultTestUrl(draft.value, options.origin))
  const testMethod = ref<NetworkHttpMethod>(draft.value.match.methods[0] || 'GET')
  const error = ref('')
  const restoredDraft = ref(false)
  const savingDraft = ref(false)
  const focusedJson = ref(false)
  const initialFingerprint = ref(fingerprint())
  let draftTimer: number | null = null

  const testResult = computed(() => {
    const url = normalizeTestUrl(testUrl.value, options.origin)
    if (!url) return { matched: false, selectedRule: null, matchingRules: [] }
    return testRules(
      options.allRules.value.filter(rule => rule.id !== draft.value.id).concat({ ...draft.value, enabled: true }),
      { url, method: testMethod.value, pageOrigin: options.origin },
    )
  })
  const conflicts = computed(() => conflictService.detect(
    { ...draft.value, enabled: true },
    options.allRules.value,
    normalizeTestUrl(testUrl.value, options.origin),
    testMethod.value,
  ))
  const testMatchesCurrent = computed(() => testResult.value.selectedRule?.id === draft.value.id)
  const dirty = computed(() => fingerprint() !== initialFingerprint.value)
  const bodyPreview = computed(() => {
    try {
      return draft.value.action.mock?.bodyType === 'text'
        ? mockBodyText.value
        : JSON.stringify(JSON.parse(mockBodyText.value || 'null'), null, 2)
    }
    catch {
      return mockBodyText.value
    }
  })

  watch(() => draft.value.action.type, (type) => {
    error.value = ''
    if (type === 'mock') ensureMock()
    if (type === 'modify-response') ensureReplacementBody()
  })

  watch(
    [draft, mockBodyText, testUrl, testMethod],
    () => scheduleDraftSave(),
    { deep: true },
  )

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (draftTimer !== null) window.clearTimeout(draftTimer)
    })
  }

  function setActionType(type: NetworkRuleActionType) {
    draft.value.action.type = type
  }

  function updateMethod(method: NetworkHttpMethod) {
    draft.value.match.methods = [method]
    testMethod.value = method === '*' ? 'GET' : method
  }

  function setBodyType(type: NetworkMockBodyType) {
    const mock = ensureMock()
    mock.bodyType = type
    mock.headers = {
      ...mock.headers,
      'content-type': type === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    }
    if (type === 'json') {
      try { mockBodyText.value = JSON.stringify(JSON.parse(mockBodyText.value), null, 2) }
      catch { mockBodyText.value = JSON.stringify({ message: mockBodyText.value || 'success' }, null, 2) }
    }
  }

  function addQueryCondition() {
    const query = draft.value.match.query || (draft.value.match.query = [])
    query.push({ id: crypto.randomUUID(), key: '', operator: 'equals', value: '' })
  }

  function removeQueryCondition(id: string) {
    draft.value.match.query = (draft.value.match.query || []).filter(item => item.id !== id)
  }

  function updateQueryOperator(id: string, operator: NetworkQueryOperator) {
    const condition = draft.value.match.query?.find(item => item.id === id)
    if (condition) condition.operator = operator
  }

  function ensureMock() {
    if (!draft.value.action.mock) {
      const body = draft.value.action.replacementBody !== undefined
        ? clone(draft.value.action.replacementBody)
        : parseJsonOrDefault(mockBodyText.value)
      draft.value.action.mock = {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body,
        bodyType: 'json',
        delayMs: draft.value.action.delayMs || 0,
      }
      mockBodyText.value = serializeJson(body)
    }
    return draft.value.action.mock
  }

  function ensureReplacementBody() {
    if (draft.value.action.replacementBody === undefined) {
      const body = draft.value.action.mock?.body !== undefined
        ? clone(draft.value.action.mock.body)
        : parseJsonOrDefault(mockBodyText.value)
      draft.value.action.replacementBody = body
      mockBodyText.value = serializeJson(body)
    }
    return draft.value.action.replacementBody
  }

  function formatJson() {
    try {
      mockBodyText.value = JSON.stringify(JSON.parse(mockBodyText.value || 'null'), null, 2)
      error.value = ''
      return true
    }
    catch (reason) {
      error.value = reason instanceof Error ? `JSON 格式错误：${reason.message}` : 'JSON 格式错误。'
      return false
    }
  }

  // 最终构建前统一执行 JSON、URL、方法和动作配置校验。 / Final construction validates JSON, URL, method, and action configuration in one place.
  function buildRule(): NetworkRule | null {
    error.value = ''
    const result = clone(draft.value)
    result.name = result.name.trim()
    result.match.urlPattern = result.match.urlPattern.trim()
    result.scopeOrigin = result.scopeOrigin || options.origin || '*'
    result.priority = clampNumber(result.priority, 0, 10_000)
    result.action.delayMs = clampNumber(result.action.delayMs, 0, 60_000)
    result.match.query = (result.match.query || [])
      .map(item => ({ ...item, key: item.key.trim(), value: item.value?.trim() }))
      .filter(item => item.key)

    if (!result.name) return fail('请输入规则名称。')
    if (!result.match.urlPattern) return fail('请输入 URL 匹配规则。')
    if (result.match.patternType === 'regex') {
      try { new RegExp(result.match.urlPattern) }
      catch (reason) { return fail(reason instanceof Error ? `正则表达式无效：${reason.message}` : '正则表达式无效。') }
    }

    try {
      if (result.action.type === 'mock') {
        const mock = ensureMock()
        const bodyType = mock.bodyType || 'json'
        const body = bodyType === 'json' ? JSON.parse(mockBodyText.value || 'null') : mockBodyText.value
        result.action.mock = {
          ...clone(mock),
          status: clampNumber(mock.status, 100, 599),
          bodyType,
          body,
          delayMs: result.action.delayMs,
        }
        result.action.replacementBody = undefined
        result.action.transforms = undefined
      }
      else if (result.action.type === 'modify-response') {
        result.action.replacementBody = JSON.parse(mockBodyText.value || 'null')
        result.action.transforms = undefined
        result.action.mock = undefined
      }
      else {
        result.action.mock = undefined
        result.action.replacementBody = undefined
        result.action.transforms = undefined
      }
    }
    catch (reason) {
      return fail(reason instanceof Error ? reason.message : 'JSON 格式不正确。')
    }

    return result
  }

  async function clearStoredDraft() {
    await draftRepository.clear(options.origin)
  }

  function markSaved(rule: NetworkRule) {
    draft.value = clone(rule)
    initialFingerprint.value = fingerprint(rule)
    restoredDraft.value = false
  }

  function scheduleDraftSave() {
    if (draftTimer !== null) window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(async () => {
      savingDraft.value = true
      try {
        await draftRepository.save({
          origin: options.origin,
          mode: options.mode,
          sourceRuleId: options.sourceRuleId,
          rule: clone(draft.value),
          mockBodyText: mockBodyText.value,
          testUrl: testUrl.value,
          testMethod: testMethod.value,
          updatedAt: new Date().toISOString(),
        })
      }
      finally { savingDraft.value = false }
    }, 520)
  }

  function fail(message: string): null {
    error.value = message
    return null
  }

  function fingerprint(rule = draft.value) {
    return JSON.stringify({
      rule,
      mockBodyText: rule === draft.value ? mockBodyText.value : serializeBody(rule),
    })
  }

  return {
    draft,
    mockBodyText,
    testUrl,
    testMethod,
    error,
    restoredDraft,
    savingDraft,
    focusedJson,
    conflicts,
    testResult,
    testMatchesCurrent,
    dirty,
    bodyPreview,
    setActionType,
    updateMethod,
    setBodyType,
    addQueryCondition,
    removeQueryCondition,
    updateQueryOperator,
    ensureMock,
    ensureReplacementBody,
    formatJson,
    buildRule,
    clearStoredDraft,
    markSaved,
  }
}

function serializeBody(rule: NetworkRule) {
  const body = rule.action.type === 'modify-response' && rule.action.replacementBody !== undefined
    ? rule.action.replacementBody
    : rule.action.mock?.body ?? { code: 0, message: 'success', data: {} }
  if (rule.action.mock?.bodyType === 'text') return String(body ?? '')
  return serializeJson(body)
}

function serializeJson(value: unknown) {
  try { return JSON.stringify(value, null, 2) }
  catch { return 'null' }
}

function parseJsonOrDefault(value: string) {
  try { return JSON.parse(value || 'null') }
  catch { return { code: 0, message: 'success', data: {} } }
}

function defaultTestUrl(rule: NetworkRule, origin: string) {
  const pattern = rule.match.urlPattern.trim()
  if (/^https?:\/\//i.test(pattern) && !/[?*]/.test(pattern)) return pattern
  const path = pattern.replace(/^\*+/, '').replace(/\*+$/, '') || '/api/example'
  try { return new URL(path.startsWith('/') ? path : `/${path}`, origin).href }
  catch { return origin || 'https://example.com/api/example' }
}

function normalizeTestUrl(value: string, origin: string) {
  try { return new URL(value, origin || 'https://example.com').href }
  catch { return '' }
}

function clampNumber(value: number, minimum: number, maximum: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : minimum
}

function clone<T>(value: T): T {
  // JSON 序列化会递归解除多层 Proxy，不依赖浏览器对 structuredClone Proxy 的支持。 / JSON serialization recursively unwraps nested proxies without relying on structuredClone proxy support.
  return cloneNetworkValue(value)
}
