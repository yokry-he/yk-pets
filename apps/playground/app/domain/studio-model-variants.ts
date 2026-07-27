/*
 * 文件职责 / File responsibility
 * 定义同一宠物的简单/复杂模型容器，并提供不依赖 UI 或存储的安全归一化与复杂草稿创建规则。
 * Defines one pet's simple/complex model container with UI- and storage-independent normalization and draft creation rules.
 */
import {
  compileBipedPetCharacter,
  createBipedPetModelRecipe,
  normalizeBipedPetModelRecipe,
  type CharacterCompilationDiagnostic,
  type CharacterModelRecipeV1,
} from '@yk-pets/pet-core'

export type StudioModelMode = 'simple' | 'complex'
export type StudioModelVariantStatus = 'missing' | 'draft' | 'ready' | 'blocked'
export type ComplexModelCapability = 'renderer' | 'skeleton' | 'skin' | 'rig-mapping'

/** 仅保存运行时可复核的编译摘要，网格与骨骼数据由当前配方按需重新生成。 */
export interface StudioComplexModelCompilation {
  hash: string
  status: 'ready' | 'blocked'
  diagnostics: CharacterCompilationDiagnostic[]
  compiledAt: number
}

export interface StudioPetModelVariantsV1 {
  schemaVersion: 1
  petId: string
  simple: {
    kind: 'procedural'
    status: 'ready'
    updatedAt: number
  }
  complex: {
    kind: 'skinned'
    status: StudioModelVariantStatus
    completion: number
    pendingCapabilities: ComplexModelCapability[]
    recipe?: CharacterModelRecipeV1
    compilation?: StudioComplexModelCompilation
    createdAt?: number
    updatedAt: number
  }
}

const COMPLEX_CAPABILITIES: readonly ComplexModelCapability[] = ['renderer', 'skeleton', 'skin', 'rig-mapping']
const COMPLEX_STATUSES: readonly StudioModelVariantStatus[] = ['missing', 'draft', 'ready', 'blocked']

function record(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

function timestamp(input: unknown, fallback: number) {
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : fallback
}

function petId(input: unknown, fallback: string) {
  const value = typeof input === 'string' ? input.trim() : ''
  return value || fallback.trim() || 'active-appearance'
}

function completion(input: unknown) {
  const value = typeof input === 'number' && Number.isFinite(input) ? input : 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function diagnostics(input: unknown): CharacterCompilationDiagnostic[] | undefined {
  if (!Array.isArray(input)) return undefined
  const normalized: CharacterCompilationDiagnostic[] = []
  for (const item of input) {
    const source = record(item)
    const id = typeof source.id === 'string' ? source.id.trim() : ''
    const message = typeof source.message === 'string' ? source.message.trim() : ''
    const severity = source.severity
    if (!id || !message || (severity !== 'info' && severity !== 'warning' && severity !== 'error')) return undefined
    const affectedSemantic = typeof source.affectedSemantic === 'string' && source.affectedSemantic.trim()
      ? source.affectedSemantic.trim()
      : undefined
    normalized.push({ id, severity, message, ...(affectedSemantic ? { affectedSemantic } : {}) })
  }
  return normalized
}

function compilation(input: unknown, fallback: number): StudioComplexModelCompilation | undefined {
  const source = record(input)
  const hash = typeof source.hash === 'string' ? source.hash.trim() : ''
  const status = source.status
  const normalizedDiagnostics = diagnostics(source.diagnostics)
  if (!hash || (status !== 'ready' && status !== 'blocked') || !normalizedDiagnostics) return undefined
  const compiledAt = timestamp(source.compiledAt, -1)
  if (compiledAt < 0) return undefined
  return { hash, status, diagnostics: normalizedDiagnostics, compiledAt: timestamp(compiledAt, fallback) }
}

function draftCapabilities() {
  return [...COMPLEX_CAPABILITIES]
}

export function createStudioPetModelVariants(requestedPetId: string, now = Date.now()): StudioPetModelVariantsV1 {
  const safeNow = timestamp(now, Date.now())
  return {
    schemaVersion: 1,
    petId: petId(requestedPetId, 'active-appearance'),
    simple: { kind: 'procedural', status: 'ready', updatedAt: safeNow },
    complex: {
      kind: 'skinned',
      status: 'missing',
      completion: 0,
      pendingCapabilities: [...COMPLEX_CAPABILITIES],
      updatedAt: safeNow,
    },
  }
}

export function normalizeStudioPetModelVariants(input: unknown, fallbackPetId: string, now = Date.now(), verifyCompilation = true): StudioPetModelVariantsV1 {
  const safeNow = timestamp(now, Date.now())
  const source = record(input)
  const simpleSource = record(source.simple)
  const complexSource = record(source.complex)
  const requestedStatus = complexSource.status
  const status = typeof requestedStatus === 'string' && COMPLEX_STATUSES.includes(requestedStatus as StudioModelVariantStatus)
    ? requestedStatus as StudioModelVariantStatus
    : 'missing'
  const createdAt = complexSource.createdAt === undefined ? undefined : timestamp(complexSource.createdAt, safeNow)
  const hasStoredRecipe = complexSource.recipe !== undefined

  // 只有旧容器确实没有复杂配方时才保持 missing；未知状态不能吞掉已经可恢复的用户配方。 / Preserve missing only for legacy containers with no recipe; unknown status must not discard a recoverable user recipe.
  if (status === 'missing' && !hasStoredRecipe) {
    // 复杂模型尚未创建时也必须保留简单模型的更新时间；迁移复杂容器不能碰现有正式预览。 / Keep the simple-model timestamp when complex is missing; migration must not alter the active preview.
    return {
      schemaVersion: 1,
      petId: petId(source.petId, fallbackPetId),
      simple: { kind: 'procedural', status: 'ready', updatedAt: timestamp(simpleSource.updatedAt, safeNow) },
      complex: {
        kind: 'skinned',
        status: 'missing',
        completion: 0,
        pendingCapabilities: draftCapabilities(),
        updatedAt: timestamp(complexSource.updatedAt, safeNow),
      },
    }
  }

  // 老版本草稿没有 recipe 时自动补齐默认配方；已有配方始终经过 core 的确定性归一化。 / Legacy drafts receive a default recipe, while stored recipes always use core's deterministic normalization.
  const recipe = normalizeBipedPetModelRecipe(complexSource.recipe ?? createBipedPetModelRecipe(safeNow), safeNow)
  const normalizedCompilation = compilation(complexSource.compilation, safeNow)
  // 持久化摘要不携带网格，水合边界必须用当前规范化配方重新编译后再信任它；内存内已规范化数据可跳过这项昂贵复核。 / At hydration, recompile before trusting a summary; already-normalized in-memory state may skip this expensive verification.
  const currentCompilation = normalizedCompilation && verifyCompilation ? compileBipedPetCharacter(recipe) : undefined
  const verifiedCompilation = normalizedCompilation
    && (!verifyCompilation || (
      currentCompilation
      && normalizedCompilation.hash === currentCompilation.hash
      && (normalizedCompilation.status === 'blocked' || currentCompilation.status === 'ready')
    ))
    ? normalizedCompilation
    : undefined
  // ready 的诊断必须来自本次 core 编译，不能让持久化摘要伪造“已就绪但含错误”的矛盾状态。 / Ready diagnostics must come from this core compilation, never from a persisted contradictory summary.
  const trustedCompilation = verifiedCompilation?.status === 'ready' && currentCompilation
    ? { ...verifiedCompilation, diagnostics: currentCompilation.diagnostics.map(item => ({ ...item })) }
    : verifiedCompilation
  const normalizedStatus: Exclude<StudioModelVariantStatus, 'missing'> = trustedCompilation?.status === 'ready'
    ? 'ready'
    : trustedCompilation?.status === 'blocked'
      ? 'blocked'
      : 'draft'
  return {
    schemaVersion: 1,
    petId: petId(source.petId, fallbackPetId),
    simple: { kind: 'procedural', status: 'ready', updatedAt: timestamp(simpleSource.updatedAt, safeNow) },
    complex: {
      kind: 'skinned',
      status: normalizedStatus,
      completion: normalizedStatus === 'ready' ? 100 : Math.min(95, completion(complexSource.completion) || 5),
      pendingCapabilities: normalizedStatus === 'ready' ? [] : draftCapabilities(),
      recipe,
      ...(trustedCompilation ? { compilation: trustedCompilation } : {}),
      ...(createdAt === undefined ? {} : { createdAt }),
      updatedAt: timestamp(complexSource.updatedAt, safeNow),
    },
  }
}

export function createComplexModelDraft(input: StudioPetModelVariantsV1, now = Date.now()): StudioPetModelVariantsV1 {
  if (input.complex.status !== 'missing') return input
  const safeNow = timestamp(now, Date.now())
  return {
    ...input,
    complex: {
      kind: 'skinned',
      status: 'draft',
      completion: 5,
      pendingCapabilities: draftCapabilities(),
      recipe: createBipedPetModelRecipe(safeNow),
      createdAt: safeNow,
      updatedAt: safeNow,
    },
  }
}

export function normalizeStudioModelMode(input: unknown): StudioModelMode {
  return input === 'complex' ? 'complex' : 'simple'
}

export function normalizeStudioPetModelVariantCollection(input: unknown, now = Date.now()) {
  const source = record(input)
  const result: Record<string, StudioPetModelVariantsV1> = {}
  for (const [requestedPetId, value] of Object.entries(source)) {
    const normalizedPetId = requestedPetId.trim()
    if (!normalizedPetId) continue
    const normalized = normalizeStudioPetModelVariants({ ...record(value), petId: normalizedPetId }, normalizedPetId, now)
    result[normalizedPetId] = normalized
  }
  return result
}
