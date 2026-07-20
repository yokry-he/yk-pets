/**
 * 文件职责 / File responsibility
 * 定义网络实验室跨层共享的规则、请求、快照和性能类型。
 * Defines cross-layer Network Lab rule, request, snapshot, and performance types.
 */
// 基础枚举与动作类型 / Base enums and action types
export type NetworkHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | '*'

export type NetworkRuleActionType = 'mock' | 'modify-response' | 'delay'
export type NetworkPatternType = 'glob' | 'regex'
export type NetworkResourceKind = 'fetch' | 'xhr' | 'script' | 'style' | 'image' | 'font' | 'media' | 'document' | 'manifest' | 'socket' | 'wasm' | 'other'
export type JsonTransformOperationType = 'set' | 'remove'
export type NetworkMockBodyType = 'json' | 'text'
export type NetworkRuleSource = 'manual' | 'captured-request' | 'duplicate'
export type NetworkQueryOperator = 'equals' | 'contains' | 'exists'

// 规则匹配与响应变换值对象 / Rule matching and response-transform value objects
export interface JsonTransformOperation {
  id: string
  type: JsonTransformOperationType
  path: string
  value?: unknown
}

export interface NetworkQueryCondition {
  id: string
  key: string
  operator: NetworkQueryOperator
  value?: string
}

export interface NetworkRuleMatch {
  urlPattern: string
  patternType: NetworkPatternType
  methods: NetworkHttpMethod[]
  query?: NetworkQueryCondition[]
}

export interface NetworkMockResponse {
  status: number
  statusText?: string
  headers: Record<string, string>
  body: unknown
  bodyType: NetworkMockBodyType
  delayMs: number
}

// 可持久化网络规则聚合 / Persisted network-rule aggregate
export interface NetworkRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  scopeOrigin: string
  source: NetworkRuleSource
  match: NetworkRuleMatch
  action: {
    type: NetworkRuleActionType
    delayMs: number
    mock?: NetworkMockResponse
    replacementBody?: unknown
    /** @deprecated 仅用于兼容 v0.6.5 及更早版本的字段级规则。 / Kept only for field-level rules created by v0.6.5 and earlier. */
    transforms?: JsonTransformOperation[]
  }
  createdAt: string
  updatedAt: string
}

export interface NetworkSiteSettings {
  enabled: boolean
  captureEnabled: boolean
  slowThresholdMs: number
  maxEntries: number
}

export interface NetworkTimingBreakdown {
  dns: number
  connect: number
  tls: number
  request: number
  ttfb: number
  download: number
}

// 页面请求记录与 Timing 快照 / Page request record and timing snapshot
export interface NetworkEntry {
  id: string
  url: string
  pathname: string
  method: string
  source: 'fetch' | 'xhr' | 'resource' | 'socket'
  resourceType: NetworkResourceKind
  initiatorType: string
  status: number | null
  ok: boolean | null
  startedAt: number
  timestamp: string
  duration: number
  timing: NetworkTimingBreakdown
  transferSize: number
  encodedBodySize: number
  decodedBodySize: number
  mocked: boolean
  modified: boolean
  delayed: boolean
  ruleId?: string
  ruleName?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBodyPreview?: unknown
  responsePreview?: unknown
  /** 可直接编辑的完整 JSON 响应，大小受页面拦截器限制。 / Complete editable JSON response, bounded by the page interceptor. */
  responseBody?: unknown
  error?: string
}

// UI 使用的性能汇总和完整站点快照 / Performance summary and full site snapshot for the UI
export interface NetworkPerformanceSummary {
  requestCount: number
  slowCount: number
  errorCount: number
  mockedCount: number
  totalTransferSize: number
  averageDuration: number
  p95Duration: number
  score: number
}

export interface NetworkInterceptorStatus {
  ready: boolean
  configured: boolean
  enabled: boolean
  ruleCount: number
  updatedAt?: string
}

export interface NetworkSnapshot {
  pageUrl: string
  origin: string
  settings: NetworkSiteSettings
  rules: NetworkRule[]
  entries: NetworkEntry[]
  summary: NetworkPerformanceSummary
  interceptor?: NetworkInterceptorStatus
}

// 默认关闭网络修改能力，仅保持安全的性能采集。 / Network modification defaults off while safe capture remains enabled.
export const DEFAULT_NETWORK_SITE_SETTINGS: NetworkSiteSettings = {
  enabled: false,
  captureEnabled: true,
  slowThresholdMs: 800,
  maxEntries: 300,
}
