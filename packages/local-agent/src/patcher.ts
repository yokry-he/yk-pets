/**
 * 文件职责 / File responsibility
 * 生成、应用和回滚安全源码补丁，并进行哈希并发保护。
 * Generates, applies, and rolls back safe source patches with hash-based concurrency protection.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTwoFilesPatch } from 'diff'
import type { AuditIssue } from '@nova/shared/audit'
import type { PatchProposal, SourceCandidate } from '@nova/shared/protocol'
import { findSourceCandidates } from './source-locator'

interface StoredPatch extends PatchProposal {
  originalHash: string | null
  patchedHash: string | null
  originalContent: string | null
  patchedContent: string | null
}

/**
 * 补丁管理器只在内存中保存候选，写入前再次校验哈希并创建本地备份。
 * The patch manager keeps candidates in memory, rechecks hashes before writes, and creates local backups.
 */
export class PatchManager {
  private readonly patches = new Map<string, StoredPatch>()

  constructor(private readonly root: string) {}

  // 按候选可信度尝试最小确定性配方，首个安全结果即停止。 / Try minimal deterministic recipes by candidate confidence and stop at the first safe result.
  async generate(issue: AuditIssue): Promise<PatchProposal> {
    const candidates = await findSourceCandidates(this.root, issue)
    const base = createBaseProposal(issue, candidates)

    for (const candidate of candidates) {
      const absolutePath = this.safePath(candidate.filePath)
      const content = await readFile(absolutePath, 'utf8')
      const result = applyRecipe(content, issue)
      if (!result || result.content === content) continue

      const proposal: StoredPatch = {
        ...base,
        filePath: candidate.filePath,
        confidence: Math.min(0.96, result.confidence + Math.min(candidate.score / 100, 0.12)),
        reason: result.reason,
        canApply: true,
        before: result.before,
        after: result.after,
        diff: createTwoFilesPatch(candidate.filePath, candidate.filePath, content, result.content, 'current', 'proposed', { context: 4 }),
        originalHash: hash(content),
        patchedHash: hash(result.content),
        originalContent: content,
        patchedContent: result.content,
      }
      this.patches.set(proposal.id, proposal)
      return publicProposal(proposal)
    }

    const fallback: StoredPatch = {
      ...base,
      reason: candidates.length
        ? '找到了可能的源码文件，但当前规则无法安全地产生自动补丁。请根据候选文件手动处理。'
        : '没有在项目中找到足够可靠的源码映射。可在元素上增加稳定的 id、data-testid 或保留资源文件名后重试。',
      originalHash: null,
      patchedHash: null,
      originalContent: null,
      patchedContent: null,
    }
    this.patches.set(fallback.id, fallback)
    return publicProposal(fallback)
  }

  // 写入前校验原文件哈希，防止覆盖补丁生成后的并发修改。 / Verify the original hash before writing to avoid overwriting concurrent edits.
  async apply(patchId: string): Promise<PatchProposal> {
    const patch = this.requirePatch(patchId)
    if (!patch.canApply || !patch.filePath || !patch.originalContent || !patch.patchedContent || !patch.originalHash) {
      throw new Error('该建议没有可安全应用的自动补丁')
    }

    const absolutePath = this.safePath(patch.filePath)
    const current = await readFile(absolutePath, 'utf8')
    if (hash(current) !== patch.originalHash) {
      throw new Error('源码在补丁生成后已发生变化，请重新生成补丁')
    }

    const backupDir = path.join(this.root, '.nova', 'backups')
    await mkdir(backupDir, { recursive: true })
    await writeFile(
      path.join(backupDir, `${patch.id}.json`),
      `${JSON.stringify({
        filePath: patch.filePath,
        originalContent: patch.originalContent,
        patchedHash: patch.patchedHash,
        createdAt: new Date().toISOString(),
      }, null, 2)}\n`,
      { mode: 0o600 },
    )

    await writeFile(absolutePath, patch.patchedContent, 'utf8')
    patch.applied = true
    return publicProposal(patch)
  }

  // 回滚前校验已应用版本哈希，避免覆盖用户之后的手工修改。 / Verify the applied hash before rollback so later manual edits are never overwritten.
  async rollback(patchId: string): Promise<PatchProposal> {
    const patch = this.requirePatch(patchId)
    if (!patch.filePath) throw new Error('补丁没有关联源码文件')

    const backupPath = path.join(this.root, '.nova', 'backups', `${patch.id}.json`)
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
      filePath: string
      originalContent: string
      patchedHash: string
    }
    const absolutePath = this.safePath(backup.filePath)
    const current = await readFile(absolutePath, 'utf8')

    if (hash(current) !== backup.patchedHash) {
      throw new Error('应用补丁后的源码又被修改，为避免覆盖工作，已拒绝自动回滚')
    }

    await writeFile(absolutePath, backup.originalContent, 'utf8')
    patch.applied = false
    return publicProposal(patch)
  }

  private requirePatch(id: string): StoredPatch {
    const patch = this.patches.get(id)
    if (!patch) throw new Error('补丁不存在或本地 Agent 已重启')
    return patch
  }

  // 所有文件访问必须限制在项目根目录内，防止路径穿越。 / Constrain every file access to the project root to prevent path traversal.
  private safePath(relativePath: string): string {
    const absolute = path.resolve(this.root, relativePath)
    const rootWithSeparator = `${path.resolve(this.root)}${path.sep}`
    if (absolute !== path.resolve(this.root) && !absolute.startsWith(rootWithSeparator)) {
      throw new Error('拒绝访问项目根目录之外的文件')
    }
    return absolute
  }
}

function createBaseProposal(issue: AuditIssue, candidates: SourceCandidate[]): StoredPatch {
  return {
    id: randomUUID(),
    issueId: issue.id,
    issueCode: issue.code,
    filePath: null,
    confidence: 0,
    reason: '',
    canApply: false,
    applied: false,
    before: null,
    after: null,
    diff: null,
    candidates,
    createdAt: new Date().toISOString(),
    originalHash: null,
    patchedHash: null,
    originalContent: null,
    patchedContent: null,
  }
}

function publicProposal(patch: StoredPatch): PatchProposal {
  const { originalHash: _originalHash, patchedHash: _patchedHash, originalContent: _originalContent, patchedContent: _patchedContent, ...publicPatch } = patch
  return publicPatch
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

interface RecipeResult {
  content: string
  before: string
  after: string
  reason: string
  confidence: number
}

export function applyRecipe(content: string, issue: AuditIssue): RecipeResult | null {
  switch (issue.code) {
    case 'image-alt-missing':
      return patchImageTag(content, issue, {
        alt: stringEvidence(issue, 'altSuggestion') || humanizeAssetName(stringEvidence(issue, 'src')) || '图片',
      }, '为图片补充替代文本。请在应用后确认文字准确描述图片用途。', 0.78)
    case 'image-dimensions-missing': {
      const width = numberEvidence(issue, 'naturalWidth')
      const height = numberEvidence(issue, 'naturalHeight')
      if (!width || !height) return null
      return patchImageTag(content, issue, { width: String(width), height: String(height) }, '补充图片固有尺寸，减少布局偏移。', 0.9)
    }
    case 'image-lazy-missing':
      return patchImageTag(content, issue, { loading: 'lazy', decoding: 'async' }, '为首屏以下图片启用延迟加载与异步解码。', 0.88)
    case 'form-label-missing':
      return patchFormControl(content, issue)
    case 'button-name-missing':
      return patchNamedElement(content, issue, 'button')
    case 'link-name-missing':
      return patchNamedElement(content, issue, 'a')
    default:
      return null
  }
}

function patchImageTag(
  content: string,
  issue: AuditIssue,
  attributes: Record<string, string>,
  reason: string,
  confidence: number,
): RecipeResult | null {
  const src = stringEvidence(issue, 'src')
  const basename = src ? path.basename(src.split('?')[0] || src) : ''
  if (!basename) return null

  const tagPattern = new RegExp(`<img\\b(?=[^>]*(?:src|:src)\\s*=\\s*["'][^"']*${escapeRegExp(basename)}[^"']*["'])[^>]*>`, 'i')
  const match = content.match(tagPattern)
  if (!match) return null

  const before = match[0]
  let after = before
  for (const [name, value] of Object.entries(attributes)) {
    const existing = new RegExp(`\\s(?:${escapeRegExp(name)}|:${escapeRegExp(name)})\\s*=`, 'i')
    if (!existing.test(after)) after = insertAttribute(after, name, value)
  }
  if (after === before) return null

  return {
    content: content.replace(before, after),
    before,
    after,
    reason,
    confidence,
  }
}

function patchFormControl(content: string, issue: AuditIssue): RecipeResult | null {
  const tagName = issue.element?.tagName.toLowerCase()
  if (!tagName || !['input', 'select', 'textarea'].includes(tagName)) return null

  const id = stringEvidence(issue, 'id')
  const name = stringEvidence(issue, 'name')
  const placeholder = stringEvidence(issue, 'placeholder')
  const identifier = id || name
  if (!identifier) return null

  const key = id ? 'id' : 'name'
  const pattern = new RegExp(`<${tagName}\\b(?=[^>]*\\b${key}\\s*=\\s*["']${escapeRegExp(identifier)}["'])[^>]*>`, 'i')
  const match = content.match(pattern)
  if (!match) return null

  const before = match[0]
  const label = placeholder || humanizeAssetName(identifier) || '输入字段'
  const after = insertAttribute(before, 'aria-label', label)
  return {
    content: content.replace(before, after),
    before,
    after,
    reason: '为表单控件补充可访问名称。更理想的长期方案是使用可见的 <label>。',
    confidence: 0.72,
  }
}

function patchNamedElement(content: string, issue: AuditIssue, tagName: 'button' | 'a'): RecipeResult | null {
  const id = stringEvidence(issue, 'id')
  if (!id) return null

  const pattern = new RegExp(`<${tagName}\\b(?=[^>]*\\bid\\s*=\\s*["']${escapeRegExp(id)}["'])[^>]*>`, 'i')
  const match = content.match(pattern)
  if (!match) return null

  const before = match[0]
  const label = humanizeAssetName(id) || (tagName === 'button' ? '操作按钮' : '链接')
  const after = insertAttribute(before, 'aria-label', label)
  return {
    content: content.replace(before, after),
    before,
    after,
    reason: '为没有可见文字的交互元素补充可访问名称。请确认名称与真实操作一致。',
    confidence: 0.68,
  }
}

function insertAttribute(tag: string, name: string, value: string): string {
  const escapedValue = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return tag.replace(/\s*\/?>$/, ending => ` ${name}="${escapedValue}"${ending}`)
}

function stringEvidence(issue: AuditIssue, key: string): string {
  const value = issue.evidence[key]
  return typeof value === 'string' ? value : ''
}

function numberEvidence(issue: AuditIssue, key: string): number {
  const value = issue.evidence[key]
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

function humanizeAssetName(input: string): string {
  if (!input) return ''
  const clean = path.basename(input.split('?')[0] || input).replace(/\.[a-z0-9]+$/i, '')
  return clean
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
