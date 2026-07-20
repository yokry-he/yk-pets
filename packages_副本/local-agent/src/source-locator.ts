/**
 * 文件职责 / File responsibility
 * 根据审计问题和 DOM 线索搜索最可能的源码文件。
 * Finds likely source files from audit issues and DOM clues.
 */
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import fg from 'fast-glob'
import type { AuditIssue } from '@nova/shared/audit'
import type { SourceCandidate } from '@nova/shared/protocol'

const SOURCE_GLOBS = [
  '**/*.vue',
  '**/*.tsx',
  '**/*.jsx',
  '**/*.html',
  '**/*.svelte',
  '**/*.astro',
]

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
]

export async function findSourceCandidates(root: string, issue: AuditIssue, limit = 8): Promise<SourceCandidate[]> {
  const files = await fg(SOURCE_GLOBS, {
    cwd: root,
    ignore: IGNORE_GLOBS,
    onlyFiles: true,
    dot: false,
    unique: true,
  })

  const terms = collectSearchTerms(issue)
  const candidates: SourceCandidate[] = []

  for (const relativePath of files.slice(0, 3500)) {
    const absolutePath = path.join(root, relativePath)
    const metadata = await stat(absolutePath)
    if (metadata.size > 1_500_000) continue

    const content = await readFile(absolutePath, 'utf8')
    let score = 0
    const matchedTerms: string[] = []

    for (const term of terms) {
      if (!term || term.length < 2) continue
      const occurrences = countOccurrences(content.toLowerCase(), term.toLowerCase())
      if (occurrences > 0) {
        const weight = term.includes('/') || term.includes('.') ? 5 : term.length > 12 ? 4 : 2
        score += Math.min(occurrences, 4) * weight
        matchedTerms.push(term)
      }
    }

    if (issue.sourceHint?.preferredExtensions.some(extension => relativePath.endsWith(extension))) {
      score += 2
    }

    if (score > 0) {
      candidates.push({ filePath: relativePath, score, matchedTerms })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
    .slice(0, limit)
}

export function collectSearchTerms(issue: AuditIssue): string[] {
  const terms = new Set<string>(issue.sourceHint?.searchTerms || [])
  const evidenceKeys = ['src', 'id', 'name', 'placeholder', 'text', 'href', 'altSuggestion']

  for (const key of evidenceKeys) {
    const value = issue.evidence[key]
    if (typeof value === 'string' && value.trim()) {
      terms.add(value.trim())
      if (key === 'src') {
        const clean = value.split('?')[0]?.split('#')[0] || value
        terms.add(path.basename(clean))
      }
    }
  }

  if (issue.element?.text) terms.add(issue.element.text.trim())

  if (issue.selector) {
    for (const token of issue.selector.match(/[A-Za-z0-9_-]{3,}/g) || []) {
      if (!['nth', 'child', 'button', 'input', 'image'].includes(token.toLowerCase())) terms.add(token)
    }
  }

  return [...terms].filter(Boolean).slice(0, 20)
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let index = 0
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1
    index += needle.length
  }
  return count
}
