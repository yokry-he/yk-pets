/**
 * 文件职责 / File responsibility
 * 使用 Chrome Storage 保存站点设置、规则和请求快照。
 * Persists site settings, rules, and request snapshots with Chrome Storage.
 */
import {
  DEFAULT_NETWORK_SITE_SETTINGS,
  type NetworkMockBodyType,
  type NetworkQueryCondition,
  type NetworkQueryOperator,
  type NetworkRule,
  type NetworkRuleSource,
  type NetworkSiteSettings,
} from '@nova/shared/network'
import { NetworkRuleFactory } from '../domain/network-rule-factory'

const RULES_KEY = 'nova:network:rules'
const SETTINGS_PREFIX = 'nova:network:site:'

export interface NetworkRuleRepository {
  getRules(): Promise<NetworkRule[]>
  saveRules(rules: NetworkRule[]): Promise<void>
  getSiteSettings(origin: string): Promise<NetworkSiteSettings>
  saveSiteSettings(origin: string, settings: NetworkSiteSettings): Promise<void>
}

export class ChromeNetworkRepository implements NetworkRuleRepository {
  async getRules(): Promise<NetworkRule[]> {
    const stored = await chrome.storage.local.get(RULES_KEY)
    return sanitizeRules(stored[RULES_KEY])
  }

  async saveRules(rules: NetworkRule[]): Promise<void> {
    await chrome.storage.local.set({ [RULES_KEY]: sanitizeRules(rules) })
  }

  async getSiteSettings(origin: string): Promise<NetworkSiteSettings> {
    const key = siteSettingsKey(origin)
    const stored = await chrome.storage.local.get(key)
    return sanitizeSettings(stored[key])
  }

  async saveSiteSettings(origin: string, settings: NetworkSiteSettings): Promise<void> {
    await chrome.storage.local.set({ [siteSettingsKey(origin)]: sanitizeSettings(settings) })
  }
}

/** Backward-compatible factory helper used by older integration points. */
export function createDefaultRule(origin = '*'): NetworkRule {
  return new NetworkRuleFactory().createManual(origin)
}

function siteSettingsKey(origin: string) {
  return `${SETTINGS_PREFIX}${encodeURIComponent(origin || 'unknown')}`
}

function sanitizeSettings(value: unknown): NetworkSiteSettings {
  const input = typeof value === 'object' && value ? value as Partial<NetworkSiteSettings> : {}
  return {
    enabled: Boolean(input.enabled),
    captureEnabled: input.captureEnabled !== false,
    slowThresholdMs: clampNumber(input.slowThresholdMs, 100, 30_000, DEFAULT_NETWORK_SITE_SETTINGS.slowThresholdMs),
    maxEntries: clampNumber(input.maxEntries, 50, 1000, DEFAULT_NETWORK_SITE_SETTINGS.maxEntries),
  }
}

function sanitizeRules(value: unknown): NetworkRule[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isNetworkRuleLike)
    .slice(0, 400)
    .map(sanitizeRule)
}

function sanitizeRule(value: unknown): NetworkRule {
  const rule = value as NetworkRule
  const actionType = ['mock', 'modify-response', 'delay'].includes(rule.action?.type || '')
    ? rule.action.type
    : 'mock'
  const now = new Date().toISOString()
  const mockBody = rule.action?.mock?.body ?? { code: 0, message: 'success', data: {} }
  const bodyType = sanitizeBodyType(rule.action?.mock?.bodyType, mockBody)
  const headers = sanitizeHeaders(rule.action?.mock?.headers)
  const hasReplacementBody = rule.action?.replacementBody !== undefined

  return {
    id: String(rule.id),
    name: String(rule.name || '未命名规则'),
    enabled: Boolean(rule.enabled),
    priority: clampNumber(rule.priority, 0, 10_000, 100),
    scopeOrigin: typeof rule.scopeOrigin === 'string' && rule.scopeOrigin ? rule.scopeOrigin : '*',
    source: sanitizeSource(rule.source),
    match: {
      urlPattern: String(rule.match?.urlPattern || '*'),
      patternType: rule.match?.patternType === 'regex' ? 'regex' : 'glob',
      methods: Array.isArray(rule.match?.methods) && rule.match.methods.length ? rule.match.methods : ['GET'],
      query: sanitizeQuery(rule.match?.query),
    },
    action: {
      type: actionType,
      delayMs: clampNumber(rule.action?.delayMs, 0, 60_000, 0),
      mock: actionType === 'mock'
        ? {
            status: clampNumber(rule.action?.mock?.status, 100, 599, 200),
            statusText: rule.action?.mock?.statusText ? String(rule.action.mock.statusText) : undefined,
            headers,
            body: mockBody,
            bodyType,
            delayMs: clampNumber(rule.action?.mock?.delayMs ?? rule.action?.delayMs, 0, 60_000, 0),
          }
        : undefined,
      replacementBody: actionType === 'modify-response' && hasReplacementBody
        ? rule.action.replacementBody
        : undefined,
      transforms: actionType === 'modify-response' && !hasReplacementBody && Array.isArray(rule.action?.transforms)
        ? rule.action.transforms.slice(0, 30).map(operation => ({
            id: String(operation.id || crypto.randomUUID()),
            type: operation.type === 'remove' ? 'remove' : 'set',
            path: String(operation.path || ''),
            value: operation.value,
          }))
        : undefined,
    },
    createdAt: typeof rule.createdAt === 'string' ? rule.createdAt : now,
    updatedAt: typeof rule.updatedAt === 'string' ? rule.updatedAt : now,
  }
}

function sanitizeQuery(value: unknown): NetworkQueryCondition[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((item) => {
    const condition = item as Partial<NetworkQueryCondition>
    return {
      id: String(condition.id || crypto.randomUUID()),
      key: String(condition.key || ''),
      operator: sanitizeQueryOperator(condition.operator),
      value: condition.value === undefined ? undefined : String(condition.value),
    }
  })
}

function sanitizeQueryOperator(value: unknown): NetworkQueryOperator {
  return value === 'contains' || value === 'exists' ? value : 'equals'
}

function sanitizeSource(value: unknown): NetworkRuleSource {
  return value === 'captured-request' || value === 'duplicate' ? value : 'manual'
}

function sanitizeBodyType(value: unknown, body: unknown): NetworkMockBodyType {
  if (value === 'text') return 'text'
  if (value === 'json') return 'json'
  return typeof body === 'string' ? 'text' : 'json'
}

function sanitizeHeaders(value: unknown) {
  if (!value || typeof value !== 'object') return { 'content-type': 'application/json; charset=utf-8' }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([name, item]) => [name, String(item)]))
}

function isNetworkRuleLike(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const rule = value as Partial<NetworkRule>
  return typeof rule.id === 'string'
    && typeof rule.name === 'string'
    && typeof rule.enabled === 'boolean'
    && typeof rule.priority === 'number'
    && Boolean(rule.match && typeof rule.match.urlPattern === 'string' && Array.isArray(rule.match.methods))
    && Boolean(rule.action && ['mock', 'modify-response', 'delay'].includes(rule.action.type || ''))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}
