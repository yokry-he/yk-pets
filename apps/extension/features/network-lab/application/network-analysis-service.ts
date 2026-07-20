/**
 * 文件职责 / File responsibility
 * 将请求记录聚合为性能摘要、图表数据和诊断建议。
 * Aggregates request records into performance summaries, chart data, and diagnostics.
 */
import type {
  NetworkEntry,
  NetworkPerformanceSummary,
  NetworkResourceKind,
} from '@nova/shared/network'

export interface NetworkResourceAggregate {
  type: NetworkResourceKind
  count: number
  duration: number
  transferSize: number
}

export interface NetworkDiagnosis {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  suggestion: string
  entryId?: string
}

export class NetworkAnalysisService {
  summarize(entries: NetworkEntry[], slowThresholdMs: number): NetworkPerformanceSummary {
    const completed = entries.filter(entry => Number.isFinite(entry.duration))
    const durations = completed.map(entry => entry.duration).sort((a, b) => a - b)
    const averageDuration = durations.length
      ? durations.reduce((total, duration) => total + duration, 0) / durations.length
      : 0
    const p95Index = durations.length ? Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1) : 0
    const p95Duration = durations[p95Index] || 0
    const slowCount = completed.filter(entry => entry.duration >= slowThresholdMs).length
    const errorCount = completed.filter(entry => entry.status !== null && entry.status >= 400 || Boolean(entry.error)).length
    const mockedCount = completed.filter(entry => entry.mocked || entry.modified).length
    const totalTransferSize = completed.reduce((total, entry) => total + Math.max(0, entry.transferSize), 0)
    const score = Math.max(0, Math.round(100
      - Math.min(34, slowCount * 4)
      - Math.min(28, errorCount * 8)
      - Math.min(26, p95Duration / 100)
      - Math.min(12, totalTransferSize / 1024 / 1024 * 1.5)))

    return {
      requestCount: completed.length,
      slowCount,
      errorCount,
      mockedCount,
      totalTransferSize,
      averageDuration: round(averageDuration),
      p95Duration: round(p95Duration),
      score,
    }
  }

  topSlow(entries: NetworkEntry[], limit = 10): NetworkEntry[] {
    return entries
      .slice()
      .sort((left, right) => right.duration - left.duration)
      .slice(0, limit)
  }

  aggregateByType(entries: NetworkEntry[]): NetworkResourceAggregate[] {
    const aggregates = new Map<NetworkResourceKind, NetworkResourceAggregate>()
    for (const entry of entries) {
      const current = aggregates.get(entry.resourceType) || {
        type: entry.resourceType,
        count: 0,
        duration: 0,
        transferSize: 0,
      }
      current.count += 1
      current.duration += entry.duration
      current.transferSize += Math.max(0, entry.transferSize)
      aggregates.set(entry.resourceType, current)
    }
    return [...aggregates.values()].sort((left, right) => right.transferSize - left.transferSize || right.duration - left.duration)
  }

  diagnose(entries: NetworkEntry[], slowThresholdMs: number): NetworkDiagnosis[] {
    const result: NetworkDiagnosis[] = []
    for (const entry of this.topSlow(entries, 12)) {
      if (entry.error || (entry.status !== null && entry.status >= 500)) {
        result.push({
          id: `error:${entry.id}`,
          severity: 'high',
          title: `${displayName(entry)} 请求失败`,
          description: entry.error || `接口返回 ${entry.status}`,
          suggestion: '检查服务状态、请求参数和错误恢复逻辑，并为失败状态提供可用的前端降级。',
          entryId: entry.id,
        })
        continue
      }
      if (entry.duration < slowThresholdMs) continue
      const ttfbRatio = entry.duration > 0 ? entry.timing.ttfb / entry.duration : 0
      const downloadRatio = entry.duration > 0 ? entry.timing.download / entry.duration : 0
      if (ttfbRatio >= 0.6) {
        result.push({
          id: `ttfb:${entry.id}`,
          severity: entry.duration >= slowThresholdMs * 2 ? 'high' : 'medium',
          title: `${displayName(entry)} 服务端等待偏高`,
          description: `总耗时 ${Math.round(entry.duration)}ms，其中等待首字节约 ${Math.round(entry.timing.ttfb)}ms。`,
          suggestion: '优先检查服务端查询、缓存、下游依赖和接口聚合链路。',
          entryId: entry.id,
        })
      }
      else if (downloadRatio >= 0.5 || entry.transferSize >= 700 * 1024) {
        result.push({
          id: `size:${entry.id}`,
          severity: entry.transferSize >= 2 * 1024 * 1024 ? 'high' : 'medium',
          title: `${displayName(entry)} 下载成本偏高`,
          description: `传输 ${formatBytes(entry.transferSize)}，下载阶段约 ${Math.round(entry.timing.download)}ms。`,
          suggestion: '压缩响应、裁剪字段、拆分资源，并检查图片格式与缓存策略。',
          entryId: entry.id,
        })
      }
      else {
        result.push({
          id: `slow:${entry.id}`,
          severity: entry.duration >= slowThresholdMs * 2 ? 'high' : 'medium',
          title: `${displayName(entry)} 响应较慢`,
          description: `请求耗时 ${Math.round(entry.duration)}ms，超过当前 ${slowThresholdMs}ms 阈值。`,
          suggestion: '结合请求瀑布和 Timing 分解，确认连接、排队、服务端等待或下载阶段的主要占比。',
          entryId: entry.id,
        })
      }
    }
    return result.slice(0, 8)
  }
}

export function displayName(entry: NetworkEntry): string {
  try {
    const url = new URL(entry.url)
    return url.pathname.split('/').filter(Boolean).at(-1) || url.hostname
  }
  catch {
    return entry.pathname || entry.url
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
