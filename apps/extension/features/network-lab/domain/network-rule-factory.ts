/**
 * 文件职责 / File responsibility
 * 统一创建手动、请求生成和复制来源的网络规则。
 * Creates manual, captured-request, and duplicate network rules consistently.
 */
import type { NetworkEntry, NetworkHttpMethod, NetworkRule } from '@nova/shared/network'
import { cloneNetworkValue } from './network-value-clone'

export type NetworkRuleEditorMode = 'create' | 'from-request' | 'edit' | 'duplicate'

/**
 * Factory Pattern：所有规则创建入口统一由工厂生成，避免 UI 层拼装领域对象。
 * Factory Pattern: all rule creation flows are centralized here instead of assembled in the UI.
 */
export class NetworkRuleFactory {
  createManual(origin: string): NetworkRule {
    const now = new Date().toISOString()
    return {
      id: crypto.randomUUID(),
      name: '新的 Mock 规则',
      enabled: true,
      priority: 100,
      scopeOrigin: origin || '*',
      source: 'manual',
      match: {
        urlPattern: '/api/example',
        patternType: 'glob',
        methods: ['GET'],
        query: [],
      },
      action: {
        type: 'mock',
        delayMs: 0,
        mock: {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: { code: 0, message: 'success', data: {} },
          bodyType: 'json',
          delayMs: 0,
        },
      },
      createdAt: now,
      updatedAt: now,
    }
  }

  createFromEntry(entry: NetworkEntry, origin: string): NetworkRule {
    const rule = this.createManual(origin)
    const responseBody = entry.responseBody ?? entry.responsePreview ?? { code: 0, message: 'success', data: {} }
    return {
      ...rule,
      name: `Mock · ${displayPath(entry)}`,
      source: 'captured-request',
      match: {
        urlPattern: entry.pathname,
        patternType: 'glob',
        methods: [normalizeEntryMethod(entry.method)],
        query: [],
      },
      action: {
        type: 'mock',
        delayMs: 0,
        mock: {
          status: entry.status && entry.status >= 100 ? entry.status : 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: cloneNetworkValue(responseBody),
          bodyType: typeof responseBody === 'string' ? 'text' : 'json',
          delayMs: 0,
        },
      },
    }
  }

  duplicate(rule: NetworkRule): NetworkRule {
    const now = new Date().toISOString()
    return {
      ...cloneNetworkValue(rule),
      id: crypto.randomUUID(),
      name: `${rule.name} · 副本`,
      enabled: false,
      source: 'duplicate',
      createdAt: now,
      updatedAt: now,
    }
  }
}

function displayPath(entry: NetworkEntry) {
  return entry.pathname.split('/').filter(Boolean).at(-1) || new URL(entry.url).hostname
}

function normalizeEntryMethod(method: string): NetworkHttpMethod {
  const normalized = method.toUpperCase()
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(normalized)
    ? normalized as NetworkHttpMethod
    : '*'
}
