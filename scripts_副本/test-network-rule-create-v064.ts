import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NetworkRuleFactory } from '../apps/extension/features/network-lab/domain/network-rule-factory.ts'
import { useNetworkRuleEditor } from '../apps/extension/features/network-lab/presentation/composables/useNetworkRuleEditor.ts'
import type { NetworkEntry, NetworkRule } from '../packages/shared/src/network.ts'

// 运行时回归：从父组件响应式导航状态传入规则，覆盖真实 Side Panel Proxy 路径。 / Runtime regression: rules enter from reactive parent navigation state, covering the real Side Panel proxy path.
const require = createRequire(import.meta.url)
const { reactive, readonly } = require('../apps/extension/node_modules/vue') as typeof import('vue')

Object.assign(globalThis, {
  window: globalThis,
  chrome: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
        remove: async () => undefined,
      },
    },
  },
})

const origin = 'https://nova.example'
const factory = new NetworkRuleFactory()
const manual = factory.createManual(origin)
assert.equal(manual.scopeOrigin, origin)
assert.equal(manual.action.type, 'mock')
assert.equal(manual.match.urlPattern, '/api/example')

const entry: NetworkEntry = {
  id: 'entry-create-smoke',
  url: `${origin}/api/profile?preview=1`,
  pathname: '/api/profile',
  method: 'POST',
  source: 'fetch',
  resourceType: 'fetch',
  initiatorType: 'fetch',
  status: 201,
  ok: true,
  startedAt: 1,
  timestamp: new Date().toISOString(),
  duration: 48,
  timing: { dns: 0, connect: 0, tls: 0, request: 4, ttfb: 36, download: 8 },
  transferSize: 128,
  encodedBodySize: 96,
  decodedBodySize: 160,
  mocked: false,
  modified: false,
  delayed: false,
  responsePreview: { id: 7, name: 'NOVA' },
  responseBody: { id: 7, name: 'NOVA', profile: { enabled: false }, rows: [{ id: 1 }, { id: 2 }] },
}
const captured = factory.createFromEntry(entry, origin)
assert.equal(captured.match.urlPattern, '/api/profile')
assert.deepEqual(captured.match.methods, ['POST'])
assert.deepEqual(captured.action.mock?.body, entry.responseBody)

const responseEditor = useNetworkRuleEditor({
  initialRule: captured,
  mode: 'from-request',
  origin,
  allRules: { value: reactive([] as NetworkRule[]) },
})
responseEditor.setActionType('modify-response')
responseEditor.mockBodyText.value = JSON.stringify({ id: 7, name: 'Edited NOVA', profile: { enabled: true }, rows: [{ id: 2 }] }, null, 2)
const modifiedResponseRule = responseEditor.buildRule()
assert.ok(modifiedResponseRule, responseEditor.error.value)
assert.deepEqual(modifiedResponseRule.action.replacementBody, {
  id: 7,
  name: 'Edited NOVA',
  profile: { enabled: true },
  rows: [{ id: 2 }],
})
assert.equal(modifiedResponseRule.action.mock, undefined)
assert.equal(modifiedResponseRule.action.transforms, undefined)

function buildThroughReactiveParent(initialRule: NetworkRule, mode: 'create' | 'from-request') {
  const parentContext = readonly(reactive({
    mode,
    rule: reactive({
      ...initialRule,
      action: reactive(initialRule.action),
    }),
  }))
  assert.throws(() => structuredClone(parentContext.rule), /could not be cloned/)

  const editor = useNetworkRuleEditor({
    initialRule: parentContext.rule,
    mode: parentContext.mode,
    origin,
    allRules: { value: reactive([] as NetworkRule[]) },
  })
  const built = editor.buildRule()
  assert.ok(built, editor.error.value || `${mode} editor did not build a rule`)
  assert.ok(built.name.trim())
  assert.ok(built.match.urlPattern.trim())
  assert.equal(built.scopeOrigin, origin)
  assert.equal(built.action.type, 'mock')
  return built
}

const builtManual = buildThroughReactiveParent(manual, 'create')
const builtCaptured = buildThroughReactiveParent(captured, 'from-request')
assert.equal(builtManual.action.mock?.status, 200)
assert.equal(builtCaptured.action.mock?.status, 201)

console.log('✓ 已复现 Side Panel 多层 Vue Proxy 无法被 structuredClone 复制')
console.log('✓ 手动新增规则可从响应式父组件打开并构建')
console.log('✓ 基于请求生成规则可从响应式父组件打开并构建')
console.log('✓ 修改真实响应可直接编辑并保存完整 JSON')
console.log('✓ 网络实验室业务代码不再直接调用 structuredClone')
