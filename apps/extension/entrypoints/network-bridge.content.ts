/**
 * 文件职责 / File responsibility
 * 隔离世界网络桥接层，连接页面主世界拦截器、Chrome Runtime 和性能采集。
 * Isolated-world network bridge between the page interceptor, Chrome Runtime, and performance capture.
 */
import {
  DEFAULT_NETWORK_SITE_SETTINGS,
  type NetworkEntry,
  type NetworkInterceptorStatus,
  NetworkResourceKind,
  NetworkRule,
  NetworkSiteSettings,
  NetworkSnapshot,
} from '@nova/shared/network'
import type { NovaRuntimeMessage } from '@nova/shared/messages'
import { NetworkAnalysisService } from '../features/network-lab/application/network-analysis-service'
import { ChromeNetworkRepository } from '../features/network-lab/infrastructure/chrome-network-repository'
import {
  isPageNetworkEvent,
  postNetworkConfiguration,
} from '../features/network-lab/infrastructure/network-page-channel'

/**
 * 隔离世界负责权限边界：读取 Chrome Storage/Runtime，并只向主世界发送净化后的配置。
 * The isolated world owns the permission boundary, reading Chrome APIs and sending sanitized configuration to the page world.
 */
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main(ctx) {
    const repository = new ChromeNetworkRepository()
    const analyzer = new NetworkAnalysisService()
    const entries: NetworkEntry[] = []
    const seenResources = new Set<string>()
    let settings: NetworkSiteSettings = { ...DEFAULT_NETWORK_SITE_SETTINGS }
    let rules: NetworkRule[] = []
    let interceptor: NetworkInterceptorStatus = {
      ready: false,
      configured: false,
      enabled: false,
      ruleCount: 0,
    }
    let notifyTimer: number | null = null

    const initialize = async () => {
      settings = await repository.getSiteSettings(location.origin)
      rules = await repository.getRules()
      postNetworkConfiguration(settings, rules)
      setupResourceObserver()
    }

    const addEntry = (entry: NetworkEntry) => {
      entries.push(entry)
      const maxEntries = settings?.maxEntries || 300
      if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries)
      scheduleNotification()
    }

    const scheduleNotification = () => {
      if (notifyTimer !== null) return
      notifyTimer = window.setTimeout(() => {
        notifyTimer = null
        chrome.runtime.sendMessage({
          type: 'NOVA_NETWORK_UPDATED',
          pageUrl: location.href,
          entryCount: entries.length,
        } satisfies NovaRuntimeMessage).catch(() => undefined)
      }, 280)
    }

    const createSnapshot = (): NetworkSnapshot => ({
      pageUrl: location.href,
      origin: location.origin,
      settings,
      rules,
      entries: entries.slice().reverse(),
      summary: analyzer.summarize(entries, settings.slowThresholdMs),
      interceptor,
    })

    const reloadConfiguration = async () => {
      settings = await repository.getSiteSettings(location.origin)
      rules = await repository.getRules()
      postNetworkConfiguration(settings, rules)
      scheduleNotification()
    }

    const onWindowMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || !isPageNetworkEvent(event.data)) return
      if (event.data.type === 'READY') {
        interceptor = { ...interceptor, ready: true }
        postNetworkConfiguration(settings, rules)
        scheduleNotification()
        return
      }
      if (event.data.type === 'CONFIGURED') {
        interceptor = {
          ready: true,
          configured: true,
          enabled: event.data.payload.enabled,
          ruleCount: event.data.payload.ruleCount,
          updatedAt: new Date().toISOString(),
        }
        scheduleNotification()
        return
      }
      addEntry(event.data.payload)
    }

    const onRuntimeMessage = (
      message: NovaRuntimeMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (message.type === 'NOVA_NETWORK_GET_STATE') {
        sendResponse({ ok: true, snapshot: createSnapshot() })
        return false
      }

      if (message.type === 'NOVA_NETWORK_SET_ENABLED') {
        settings = { ...settings, enabled: message.enabled }
        repository.saveSiteSettings(location.origin, settings)
          .then(() => {
            postNetworkConfiguration(settings, rules)
            scheduleNotification()
            sendResponse({ ok: true, snapshot: createSnapshot() })
          })
          .catch(error => sendResponse({ ok: false, error: String(error) }))
        return true
      }

      if (message.type === 'NOVA_NETWORK_SET_SETTINGS') {
        settings = { ...settings, ...message.settings }
        repository.saveSiteSettings(location.origin, settings)
          .then(() => {
            postNetworkConfiguration(settings, rules)
            scheduleNotification()
            sendResponse({ ok: true, snapshot: createSnapshot() })
          })
          .catch(error => sendResponse({ ok: false, error: String(error) }))
        return true
      }

      if (message.type === 'NOVA_NETWORK_SYNC_RULES') {
        rules = message.rules.slice(0, 200)
        repository.saveRules(rules)
          .then(() => {
            postNetworkConfiguration(settings, rules)
            scheduleNotification()
            sendResponse({ ok: true, snapshot: createSnapshot() })
          })
          .catch(error => sendResponse({ ok: false, error: String(error) }))
        return true
      }

      if (message.type === 'NOVA_NETWORK_CLEAR') {
        entries.length = 0
        seenResources.clear()
        scheduleNotification()
        sendResponse({ ok: true, snapshot: createSnapshot() })
        return false
      }

      return false
    }

    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return
      if (changes['nova:network:rules'] || Object.keys(changes).some(key => key.startsWith('nova:network:site:'))) {
        reloadConfiguration().catch(() => undefined)
      }
    }

    // 静态资源只采集性能，不尝试修改正文。 / Static resources are observed for performance only; their bodies are never modified.
    const setupResourceObserver = () => {
      if (!('PerformanceObserver' in window)) return
      try {
        const captureNavigation = () => {
          if (!settings.captureEnabled) return
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming & { responseStatus?: number } | undefined
          if (!navigation) return
          const key = `navigation:${location.href}:${navigation.startTime}`
          if (seenResources.has(key)) return
          seenResources.add(key)
          addEntry(mapNavigationEntry(navigation))
        }
        if (document.readyState === 'complete') captureNavigation()
        else ctx.addEventListener(window, 'load', captureNavigation, { once: true })

        const observer = new PerformanceObserver((list) => {
          if (!settings.captureEnabled) return
          for (const rawEntry of list.getEntries()) {
            const entry = rawEntry as PerformanceResourceTiming & { responseStatus?: number; deliveryType?: string }
            const key = `${entry.name}:${entry.startTime}:${entry.duration}`
            if (seenResources.has(key)) continue
            seenResources.add(key)
            const mapped = mapResourceEntry(entry)
            if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
              const existing = [...entries].reverse().find(candidate =>
                candidate.url === mapped.url
                && (candidate.source === 'fetch' || candidate.source === 'xhr')
                && Math.abs(candidate.startedAt - mapped.startedAt) < 1500,
              )
              if (existing) {
                existing.duration = mapped.duration
                existing.timing = mapped.timing
                existing.transferSize = mapped.transferSize
                existing.encodedBodySize = mapped.encodedBodySize
                existing.decodedBodySize = mapped.decodedBodySize
                if (existing.status === null) existing.status = mapped.status
                scheduleNotification()
                continue
              }
            }
            addEntry(mapped)
          }
        })
        observer.observe({ type: 'resource', buffered: true })
        ctx.onInvalidated(() => observer.disconnect())
      }
      catch {
        // 当前浏览器不支持资源性能观察。 / Resource timing observation is unavailable.
      }
    }

    ctx.addEventListener(window, 'message', onWindowMessage)
    chrome.runtime.onMessage.addListener(onRuntimeMessage)
    chrome.storage.onChanged.addListener(onStorageChanged)
    ctx.onInvalidated(() => {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage)
      chrome.storage.onChanged.removeListener(onStorageChanged)
      if (notifyTimer !== null) window.clearTimeout(notifyTimer)
    })

    initialize().catch(() => undefined)
  },
})

function mapResourceEntry(entry: PerformanceResourceTiming & { responseStatus?: number }): NetworkEntry {
  const url = safeUrl(entry.name)
  const requestStart = entry.requestStart || entry.startTime
  const responseStart = entry.responseStart || requestStart
  const responseEnd = entry.responseEnd || entry.startTime + entry.duration
  const status = Number(entry.responseStatus)
  return {
    id: crypto.randomUUID(),
    url: url.href,
    pathname: url.pathname,
    method: 'GET',
    source: 'resource',
    resourceType: mapResourceType(entry.initiatorType, url.pathname),
    initiatorType: entry.initiatorType || 'other',
    status: Number.isFinite(status) && status > 0 ? status : null,
    ok: Number.isFinite(status) && status > 0 ? status < 400 : null,
    startedAt: performance.timeOrigin + entry.startTime,
    timestamp: new Date(performance.timeOrigin + entry.startTime).toISOString(),
    duration: round(entry.duration),
    timing: {
      dns: round(Math.max(0, entry.domainLookupEnd - entry.domainLookupStart)),
      connect: round(Math.max(0, entry.connectEnd - entry.connectStart)),
      tls: round(entry.secureConnectionStart > 0 ? Math.max(0, entry.connectEnd - entry.secureConnectionStart) : 0),
      request: round(Math.max(0, responseStart - requestStart)),
      ttfb: round(Math.max(0, responseStart - requestStart)),
      download: round(Math.max(0, responseEnd - responseStart)),
    },
    transferSize: entry.transferSize || 0,
    encodedBodySize: entry.encodedBodySize || 0,
    decodedBodySize: entry.decodedBodySize || 0,
    mocked: false,
    modified: false,
    delayed: false,
  }
}

function mapResourceType(initiatorType: string, pathname: string): NetworkResourceKind {
  const type = initiatorType.toLowerCase()
  if (/\.(?:wasm)(?:$|\?)/i.test(pathname)) return 'wasm'
  if (/\.(?:webmanifest)(?:$|\?)/i.test(pathname)) return 'manifest'
  if (type === 'fetch') return 'fetch'
  if (type === 'xmlhttprequest') return 'xhr'
  if (type === 'script') return 'script'
  if (type === 'css' || type === 'link') return /\.css(?:$|\?)/i.test(pathname) ? 'style' : 'other'
  if (type === 'img' || type === 'image') return 'image'
  if (type === 'video' || type === 'audio') return 'media'
  if (/\.(?:woff2?|ttf|otf)(?:$|\?)/i.test(pathname)) return 'font'
  if (type === 'navigation') return 'document'
  return 'other'
}

function mapNavigationEntry(entry: PerformanceNavigationTiming & { responseStatus?: number }): NetworkEntry {
  const status = Number(entry.responseStatus)
  const responseStart = entry.responseStart || entry.requestStart
  return {
    id: crypto.randomUUID(),
    url: location.href,
    pathname: location.pathname,
    method: 'GET',
    source: 'resource',
    resourceType: 'document',
    initiatorType: 'navigation',
    status: Number.isFinite(status) && status > 0 ? status : null,
    ok: Number.isFinite(status) && status > 0 ? status < 400 : null,
    startedAt: performance.timeOrigin,
    timestamp: new Date(performance.timeOrigin).toISOString(),
    duration: round(entry.duration),
    timing: {
      dns: round(Math.max(0, entry.domainLookupEnd - entry.domainLookupStart)),
      connect: round(Math.max(0, entry.connectEnd - entry.connectStart)),
      tls: round(entry.secureConnectionStart > 0 ? Math.max(0, entry.connectEnd - entry.secureConnectionStart) : 0),
      request: round(Math.max(0, responseStart - entry.requestStart)),
      ttfb: round(Math.max(0, responseStart - entry.requestStart)),
      download: round(Math.max(0, entry.responseEnd - responseStart)),
    },
    transferSize: entry.transferSize || 0,
    encodedBodySize: entry.encodedBodySize || 0,
    decodedBodySize: entry.decodedBodySize || 0,
    mocked: false,
    modified: false,
    delayed: false,
  }
}

function safeUrl(value: string) {
  try { return new URL(value, location.href) }
  catch { return new URL(location.href) }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
