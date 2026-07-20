/**
 * 文件职责 / File responsibility
 * 纯领域规则匹配、排序、Query 判断和 JSON 转换实现。
 * Pure domain implementation for matching, ranking, query checks, and JSON transforms.
 */
import type {
  JsonTransformOperation,
  NetworkHttpMethod,
  NetworkQueryCondition,
  NetworkRule,
} from '@nova/shared/network'
import { cloneNetworkValue } from './network-value-clone'

export interface NetworkMatchContext {
  url: string
  method: string
  pageOrigin?: string
}

export interface NetworkRuleTestResult {
  matched: boolean
  selectedRule: NetworkRule | null
  matchingRules: NetworkRule[]
}

/**
 * 规则匹配策略：优先级 > 匹配精确度 > 更新时间。
 * Rule matching strategy: priority > match specificity > last update time.
 */
export function findMatchingRule(rules: NetworkRule[], context: NetworkMatchContext): NetworkRule | null {
  return rankMatchingRules(rules, context)[0] || null
}

export function rankMatchingRules(rules: NetworkRule[], context: NetworkMatchContext): NetworkRule[] {
  const method = normalizeMethod(context.method)
  return rules
    .filter(rule => rule.enabled && matchesRule(rule, context.url, method, context.pageOrigin))
    .sort((left, right) => {
      return right.priority - left.priority
        || ruleSpecificity(right) - ruleSpecificity(left)
        || right.updatedAt.localeCompare(left.updatedAt)
    })
}

export function testRules(rules: NetworkRule[], context: NetworkMatchContext): NetworkRuleTestResult {
  const matchingRules = rankMatchingRules(rules, context)
  return {
    matched: matchingRules.length > 0,
    selectedRule: matchingRules[0] || null,
    matchingRules,
  }
}

export function matchesRule(rule: NetworkRule, url: string, method: NetworkHttpMethod, pageOrigin?: string): boolean {
  if (!rule.match.methods.includes('*') && !rule.match.methods.includes(method)) return false

  try {
    const parsed = new URL(url, pageOrigin ? `${pageOrigin}/` : 'http://localhost/')
    // scopeOrigin 表示规则被授权运行的页面，不是请求目标服务器。 / scopeOrigin identifies the authorized page, not the request target server.
    const activePageOrigin = pageOrigin || parsed.origin
    if (rule.scopeOrigin && rule.scopeOrigin !== '*' && activePageOrigin !== rule.scopeOrigin) return false

    const patternMatched = rule.match.patternType === 'regex'
      ? new RegExp(rule.match.urlPattern).test(url)
      : matchesGlob(rule.match.urlPattern, parsed)

    if (!patternMatched) return false
    return matchesQuery(parsed, rule.match.query || [])
  }
  catch {
    return false
  }
}

export function resolveNetworkUrl(value: string, pageUrl: string): string {
  try { return new URL(value, pageUrl).href }
  catch { return value }
}

export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped || '.*'}$`, 'i')
}

export function normalizeMethod(method?: string): NetworkHttpMethod {
  const normalized = String(method || 'GET').toUpperCase()
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(normalized)) {
    return normalized as NetworkHttpMethod
  }
  return '*'
}

export function ruleSpecificity(rule: NetworkRule): number {
  const pattern = rule.match.urlPattern.trim()
  const wildcardPenalty = (pattern.match(/[?*]/g) || []).length * 5
  const regexBonus = rule.match.patternType === 'regex' ? 4 : 0
  const methodBonus = rule.match.methods.includes('*') ? 0 : 12
  const queryBonus = (rule.match.query || []).filter(item => item.key.trim()).length * 8
  const scopeBonus = rule.scopeOrigin && rule.scopeOrigin !== '*' ? 10 : 0
  return Math.max(0, pattern.length - wildcardPenalty) + regexBonus + methodBonus + queryBonus + scopeBonus
}

export function applyJsonTransforms(input: unknown, operations: JsonTransformOperation[] = []): unknown {
  const output = cloneJson(input)
  for (const operation of operations) {
    const path = parsePath(operation.path)
    if (!path.length) continue
    if (operation.type === 'set') setAtPath(output, path, cloneJson(operation.value))
    if (operation.type === 'remove') removeAtPath(output, path)
  }
  return output
}

export function resolveResponseBody(input: unknown, action: NetworkRule['action']): unknown {
  if (action.replacementBody !== undefined) return cloneNetworkValue(action.replacementBody)
  return applyJsonTransforms(input, action.transforms)
}

function matchesGlob(patternText: string, parsed: URL) {
  const pattern = globToRegExp(patternText)
  const pathWithQuery = `${parsed.pathname}${parsed.search}`
  return pattern.test(parsed.href) || pattern.test(pathWithQuery) || pattern.test(parsed.pathname)
}

function matchesQuery(parsed: URL, conditions: NetworkQueryCondition[]) {
  return conditions.every((condition) => {
    const key = condition.key.trim()
    if (!key) return true
    const values = parsed.searchParams.getAll(key)
    if (condition.operator === 'exists') return values.length > 0
    if (!values.length) return false
    const expected = condition.value || ''
    if (condition.operator === 'contains') return values.some(value => value.includes(expected))
    return values.some(value => value === expected)
  })
}

function parsePath(path: string): Array<string | number> {
  return path
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => /^\d+$/.test(part) ? Number(part) : part)
}

function setAtPath(target: unknown, path: Array<string | number>, value: unknown) {
  if (!isContainer(target)) return
  let cursor: any = target
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]!
    const nextKey = path[index + 1]!
    if (!isContainer(cursor[key])) cursor[key] = typeof nextKey === 'number' ? [] : {}
    cursor = cursor[key]
  }
  cursor[path.at(-1)!] = value
}

function removeAtPath(target: unknown, path: Array<string | number>) {
  if (!isContainer(target)) return
  let cursor: any = target
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor?.[path[index]!]
    if (!isContainer(cursor)) return
  }
  const key = path.at(-1)!
  if (Array.isArray(cursor) && typeof key === 'number') cursor.splice(key, 1)
  else delete cursor[key]
}

function isContainer(value: unknown): value is Record<string | number, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value
  return cloneNetworkValue(value)
}
