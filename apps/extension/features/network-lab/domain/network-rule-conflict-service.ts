/**
 * 文件职责 / File responsibility
 * 检测规则重复、竞争和测试 URL 下的优先级冲突。
 * Detects duplicate rules, competition, and priority conflicts for test URLs.
 */
import type { NetworkHttpMethod, NetworkRule } from '@nova/shared/network'
import { matchesRule, normalizeMethod, testRules } from './network-rule-matcher'

export interface NetworkRuleConflict {
  ruleId: string
  ruleName: string
  severity: 'warning' | 'danger'
  reason: string
}

/**
 * Domain Service：检测静态重复规则和测试 URL 下的竞争规则。
 * Domain Service: detects duplicate definitions and competing rules for a concrete test URL.
 */
export class NetworkRuleConflictService {
  detect(candidate: NetworkRule, rules: NetworkRule[], testUrl?: string, testMethod?: string): NetworkRuleConflict[] {
    const others = rules.filter(rule => rule.id !== candidate.id && rule.enabled)
    const conflicts: NetworkRuleConflict[] = []

    for (const rule of others) {
      if (!scopeOverlaps(candidate, rule) || !methodOverlaps(candidate, rule)) continue
      if (samePattern(candidate, rule)) {
        conflicts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.priority === candidate.priority ? 'danger' : 'warning',
          reason: rule.priority === candidate.priority
            ? '匹配范围与优先级相同，结果可能依赖更新时间。'
            : `匹配范围相同，优先级 ${Math.max(rule.priority, candidate.priority)} 的规则会先执行。`,
        })
      }
    }

    if (testUrl) {
      const method = normalizeMethod(testMethod)
      const ranked = testRules([...others, { ...candidate, enabled: true }], {
        url: testUrl,
        method,
        pageOrigin: candidate.scopeOrigin === '*' ? undefined : candidate.scopeOrigin,
      })
      for (const rule of ranked.matchingRules) {
        if (rule.id === candidate.id || conflicts.some(item => item.ruleId === rule.id)) continue
        conflicts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: ranked.selectedRule?.id === candidate.id ? 'warning' : 'danger',
          reason: ranked.selectedRule?.id === candidate.id
            ? '该测试请求也会命中此规则，但当前规则排序更靠前。'
            : '该规则会先命中测试请求，当前规则可能不会执行。',
        })
      }
    }

    return conflicts.slice(0, 12)
  }

  matchesCandidate(candidate: NetworkRule, url: string, method: string) {
    return matchesRule(
      { ...candidate, enabled: true },
      url,
      normalizeMethod(method),
      candidate.scopeOrigin === '*' ? undefined : candidate.scopeOrigin,
    )
  }
}

function samePattern(left: NetworkRule, right: NetworkRule) {
  return left.match.patternType === right.match.patternType
    && left.match.urlPattern.trim() === right.match.urlPattern.trim()
    && JSON.stringify(left.match.query || []) === JSON.stringify(right.match.query || [])
}

function scopeOverlaps(left: NetworkRule, right: NetworkRule) {
  return left.scopeOrigin === '*' || right.scopeOrigin === '*' || left.scopeOrigin === right.scopeOrigin
}

function methodOverlaps(left: NetworkRule, right: NetworkRule) {
  const leftMethods = new Set<NetworkHttpMethod>(left.match.methods)
  const rightMethods = new Set<NetworkHttpMethod>(right.match.methods)
  return leftMethods.has('*') || rightMethods.has('*') || [...leftMethods].some(method => rightMethods.has(method))
}
