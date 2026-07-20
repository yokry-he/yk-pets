/**
 * 文件职责 / File responsibility
 * 封装 Side Panel 与目标标签页之间的网络消息通道。
 * Encapsulates the network message channel between the Side Panel and target tab.
 */
import type { NetworkEntry, NetworkRule, NetworkSiteSettings } from '@nova/shared/network'

export const NOVA_NETWORK_CHANNEL = '__NOVA_NETWORK_LAB__'

export type PageNetworkCommand = {
  source: typeof NOVA_NETWORK_CHANNEL
  direction: 'extension-to-page'
  type: 'CONFIGURE'
  payload: {
    settings: NetworkSiteSettings
    rules: NetworkRule[]
  }
}

export type PageNetworkEvent =
  | {
      source: typeof NOVA_NETWORK_CHANNEL
      direction: 'page-to-extension'
      type: 'READY'
    }
  | {
      source: typeof NOVA_NETWORK_CHANNEL
      direction: 'page-to-extension'
      type: 'CONFIGURED'
      payload: {
        enabled: boolean
        ruleCount: number
      }
    }
  | {
      source: typeof NOVA_NETWORK_CHANNEL
      direction: 'page-to-extension'
      type: 'ENTRY'
      payload: NetworkEntry
    }

export function postNetworkConfiguration(settings: NetworkSiteSettings, rules: NetworkRule[]) {
  const message: PageNetworkCommand = {
    source: NOVA_NETWORK_CHANNEL,
    direction: 'extension-to-page',
    type: 'CONFIGURE',
    payload: { settings, rules },
  }
  window.postMessage(message, '*')
}

export function isPageNetworkEvent(value: unknown): value is PageNetworkEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<PageNetworkEvent>
  if (event.source !== NOVA_NETWORK_CHANNEL || event.direction !== 'page-to-extension') return false
  if (event.type === 'READY') return true
  if (event.type === 'CONFIGURED') {
    const payload = (event as Extract<PageNetworkEvent, { type: 'CONFIGURED' }>).payload
    return Boolean(payload && typeof payload.enabled === 'boolean' && typeof payload.ruleCount === 'number')
  }
  return event.type === 'ENTRY' && Boolean((event as Extract<PageNetworkEvent, { type: 'ENTRY' }>).payload)
}
