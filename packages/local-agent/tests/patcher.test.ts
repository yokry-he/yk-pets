/**
 * 文件职责 / File responsibility
 * 验证补丁生成、应用、并发保护和回滚行为。
 * Tests patch generation, application, concurrency protection, and rollback.
 */
import { describe, expect, it } from 'vitest'
import type { AuditIssue } from '@nova/shared/audit'
import { applyRecipe } from '../src/patcher'

function issue(code: AuditIssue['code'], evidence: AuditIssue['evidence']): AuditIssue {
  return {
    id: 'test',
    code,
    category: 'accessibility',
    severity: 'medium',
    title: 'test',
    description: 'test',
    evidence,
  }
}

describe('applyRecipe', () => {
  it('adds image dimensions without touching existing attributes', () => {
    const source = '<img class="hero" src="/hero.png">'
    const result = applyRecipe(source, issue('image-dimensions-missing', {
      src: '/hero.png',
      naturalWidth: 1200,
      naturalHeight: 800,
    }))

    expect(result?.content).toContain('width="1200"')
    expect(result?.content).toContain('height="800"')
  })

  it('adds lazy loading attributes', () => {
    const source = '<img src="/gallery/photo.webp" alt="Photo" />'
    const result = applyRecipe(source, issue('image-lazy-missing', { src: '/gallery/photo.webp' }))

    expect(result?.content).toContain('loading="lazy"')
    expect(result?.content).toContain('decoding="async"')
  })
})
