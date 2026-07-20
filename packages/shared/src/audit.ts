/**
 * 文件职责 / File responsibility
 * 定义页面审计问题、指标、报告和评分模型。
 * Defines page-audit issues, metrics, reports, and scoring models.
 */
export type AuditSeverity = 'high' | 'medium' | 'low'

export const AUDIT_CATEGORIES = [
  'performance',
  'accessibility',
  'seo',
  'best-practice',
  'dom',
] as const

export type AuditCategory = typeof AUDIT_CATEGORIES[number]

export type AuditIssueCode =
  | 'image-alt-missing'
  | 'image-dimensions-missing'
  | 'image-lazy-missing'
  | 'form-label-missing'
  | 'button-name-missing'
  | 'link-name-missing'
  | 'duplicate-id'
  | 'heading-order'
  | 'dom-size-large'
  | 'large-resource'
  | 'slow-navigation'
  | 'long-task'
  | 'document-title-missing'
  | 'meta-description-missing'
  | 'viewport-meta-missing'
  | 'mixed-content-resource'

export interface AuditRuleDefinition {
  code: AuditIssueCode
  category: AuditCategory
}

// 规则注册表是审计执行器与 Side Panel 的共同真源。 / The rule registry is the shared source of truth for the audit runner and Side Panel.
export const AUDIT_RULES: readonly AuditRuleDefinition[] = [
  { code: 'image-dimensions-missing', category: 'performance' },
  { code: 'image-lazy-missing', category: 'performance' },
  { code: 'slow-navigation', category: 'performance' },
  { code: 'long-task', category: 'performance' },
  { code: 'large-resource', category: 'performance' },
  { code: 'image-alt-missing', category: 'accessibility' },
  { code: 'form-label-missing', category: 'accessibility' },
  { code: 'button-name-missing', category: 'accessibility' },
  { code: 'link-name-missing', category: 'accessibility' },
  { code: 'heading-order', category: 'accessibility' },
  { code: 'document-title-missing', category: 'seo' },
  { code: 'meta-description-missing', category: 'seo' },
  { code: 'viewport-meta-missing', category: 'best-practice' },
  { code: 'mixed-content-resource', category: 'best-practice' },
  { code: 'duplicate-id', category: 'dom' },
  { code: 'dom-size-large', category: 'dom' },
]

export const AUDIT_RULE_CODES = AUDIT_RULES.map(rule => rule.code) as AuditIssueCode[]

export type PreviewMutation =
  | {
      kind: 'attributes'
      attributes: Record<string, string>
    }
  | {
      kind: 'style'
      styles: Record<string, string>
    }

export interface AuditIssue {
  id: string
  code: AuditIssueCode
  category: AuditCategory
  severity: AuditSeverity
  title: string
  description: string
  selector?: string
  element?: {
    tagName: string
    text?: string
    html?: string
  }
  evidence: Record<string, string | number | boolean | null | string[]>
  preview?: PreviewMutation
  sourceHint?: {
    searchTerms: string[]
    preferredExtensions: string[]
  }
}

export interface PageMetrics {
  domNodes: number
  images: number
  resources: number
  transferredBytes: number
  navigationDuration: number | null
  domContentLoaded: number | null
  loadEvent: number | null
  largestContentfulPaint: number | null
  cumulativeLayoutShift: number | null
  longTaskDuration: number
}

export interface AuditSummary {
  high: number
  medium: number
  low: number
  total: number
}

export interface AuditReport {
  id: string
  url: string
  title: string
  createdAt: string
  enabledCategories: AuditCategory[]
  enabledRuleCodes: AuditIssueCode[]
  score: number
  summary: AuditSummary
  metrics: PageMetrics
  issues: AuditIssue[]
}

const severityPenalty: Record<AuditSeverity, number> = {
  high: 12,
  medium: 6,
  low: 2,
}

export function createAuditSummary(issues: AuditIssue[]): AuditSummary {
  return issues.reduce<AuditSummary>(
    (summary, issue) => {
      summary[issue.severity] += 1
      summary.total += 1
      return summary
    },
    { high: 0, medium: 0, low: 0, total: 0 },
  )
}

export function calculateAuditScore(issues: AuditIssue[]): number {
  const penalty = issues.reduce((total, issue) => total + severityPenalty[issue.severity], 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}
