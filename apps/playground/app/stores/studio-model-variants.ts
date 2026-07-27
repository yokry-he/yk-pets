/*
 * 文件职责 / File responsibility
 * 按宠物 ID 持久化简单/复杂模型容器，并自动建立不会覆盖人工结果的复杂模型草稿。
 * Persists simple/complex model containers by pet ID and creates non-destructive complex-model drafts automatically.
 */
import { defineStore } from 'pinia'
import {
  compileBipedPetCharacter,
  normalizeBipedPetModelRecipe,
  type BipedPetAppendages,
  type BipedPetBodyStyle,
  type BipedPetMaterialRecipe,
  type BipedPetProportions,
  type CharacterCompilationDiagnostic,
  type CompiledCharacterModel,
} from '@yk-pets/pet-core'
import {
  createComplexModelDraft,
  createStudioPetModelVariants,
  normalizeStudioPetModelVariantCollection,
  normalizeStudioPetModelVariants,
  type StudioComplexModelCompilation,
  type StudioModelVariantStatus,
  type StudioPetModelVariantsV1,
} from '../domain/studio-model-variants'
import { STUDIO_MODEL_VARIANTS_STORAGE_KEY } from '../domain/studio-workspace'

interface StudioModelVariantState {
  hydrated: boolean
  byPetId: Record<string, StudioPetModelVariantsV1>
}

/** 编辑器只允许提交配方的可编辑字段；身份和版本字段由领域层固定。 */
export interface StudioComplexRecipePatch {
  bodyStyle?: BipedPetBodyStyle
  proportions?: Partial<BipedPetProportions>
  appendages?: Partial<Record<keyof BipedPetAppendages, Partial<BipedPetAppendages[keyof BipedPetAppendages]>>>
  material?: Partial<BipedPetMaterialRecipe>
}

type CompilationResult = Pick<CompiledCharacterModel, 'hash' | 'status' | 'diagnostics'> & { compiledAt?: number }

const allPendingCapabilities = () => ['renderer', 'skeleton', 'skin', 'rig-mapping'] as const
const safeTimestamp = (input: unknown, fallback = Date.now()) => typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : fallback
const object = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}

function cloneDiagnostics(input: unknown): CharacterCompilationDiagnostic[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item): CharacterCompilationDiagnostic[] => {
    const source = object(item)
    const id = typeof source.id === 'string' ? source.id.trim() : ''
    const message = typeof source.message === 'string' ? source.message.trim() : ''
    const severity = source.severity
    if (!id || !message || (severity !== 'info' && severity !== 'warning' && severity !== 'error')) return []
    const affectedSemantic = typeof source.affectedSemantic === 'string' && source.affectedSemantic.trim()
      ? source.affectedSemantic.trim()
      : undefined
    return [{ id, message, severity, ...(affectedSemantic ? { affectedSemantic } : {}) }]
  })
}

function mergeRecipePatch(recipe: NonNullable<StudioPetModelVariantsV1['complex']['recipe']>, patch: StudioComplexRecipePatch, now: number) {
  const source = object(patch)
  const proportions = object(source.proportions)
  const appendages = object(source.appendages)
  const material = object(source.material)
  return normalizeBipedPetModelRecipe({
    ...recipe,
    ...(typeof source.bodyStyle === 'string' ? { bodyStyle: source.bodyStyle } : {}),
    proportions: { ...recipe.proportions, ...proportions },
    appendages: {
      ears: { ...recipe.appendages.ears, ...object(appendages.ears) },
      tail: { ...recipe.appendages.tail, ...object(appendages.tail) },
      antennae: { ...recipe.appendages.antennae, ...object(appendages.antennae) },
    },
    material: { ...recipe.material, ...material },
    updatedAt: now,
  }, now)
}

function createCompilation(result: CompilationResult, status: StudioComplexModelCompilation['status'], diagnostics: CharacterCompilationDiagnostic[], compiledAt: number): StudioComplexModelCompilation {
  return {
    hash: String(result.hash || '').trim() || 'unavailable',
    status,
    diagnostics: diagnostics.map(item => ({ ...item })),
    compiledAt,
  }
}

function draftForPet(existing: StudioPetModelVariantsV1 | undefined, requestedPetId: string, now: number) {
  const normalized = existing
    ? normalizeStudioPetModelVariants({ ...existing, petId: requestedPetId }, requestedPetId, now, false)
    : createStudioPetModelVariants(requestedPetId, now)
  return createComplexModelDraft(normalized, now)
}

export const useStudioModelVariantsStore = defineStore('studio-model-variants', {
  state: (): StudioModelVariantState => ({ hydrated: false, byPetId: {} }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      try {
        const stored = JSON.parse(localStorage.getItem(STUDIO_MODEL_VARIANTS_STORAGE_KEY) || '{}')
        this.byPetId = normalizeStudioPetModelVariantCollection(stored)
      }
      catch {
        this.byPetId = {}
      }
      this.hydrated = true
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STUDIO_MODEL_VARIANTS_STORAGE_KEY, JSON.stringify(this.byPetId))
    },
    ensurePet(petId: string, now = Date.now()) {
      const requestedPetId = petId.trim() || 'active-appearance'
      const existing = this.byPetId[requestedPetId]
      const normalized = existing
        ? normalizeStudioPetModelVariants({ ...existing, petId: requestedPetId }, requestedPetId, now, false)
        : createStudioPetModelVariants(requestedPetId, now)
      this.byPetId[requestedPetId] = normalized
      if (!existing) this.persist()
      return normalized
    },
    ensureComplexDraft(petId: string, now = Date.now()) {
      const current = this.ensurePet(petId, now)
      const next = createComplexModelDraft(current, now)
      if (next !== current) {
        this.byPetId[next.petId] = next
        this.persist()
      }
      return next
    },
    updateComplexRecipe(petId: string, patch: StudioComplexRecipePatch, now = Date.now()) {
      const safeNow = safeTimestamp(now)
      const requestedPetId = petId.trim() || 'active-appearance'
      const current = draftForPet(this.byPetId[requestedPetId], requestedPetId, safeNow)
      const recipe = current.complex.recipe ?? normalizeBipedPetModelRecipe({}, safeNow)
      const next: StudioPetModelVariantsV1 = {
        ...current,
        complex: {
          ...current.complex,
          status: 'draft',
          completion: 5,
          pendingCapabilities: [...allPendingCapabilities()],
          recipe: mergeRecipePatch(recipe, patch, safeNow),
          compilation: undefined,
          updatedAt: safeNow,
        },
      }
      this.byPetId[next.petId] = next
      this.persist()
      return next
    },
    commitComplexCompilation(petId: string, result: CompilationResult, now?: number) {
      const resultSource = object(result)
      const safeNow = safeTimestamp(now ?? resultSource.compiledAt)
      const requestedPetId = petId.trim() || 'active-appearance'
      const current = draftForPet(this.byPetId[requestedPetId], requestedPetId, safeNow)
      const recipe = current.complex.recipe ?? normalizeBipedPetModelRecipe({}, safeNow)
      const compiled = compileBipedPetCharacter(recipe)
      const submittedHash = typeof resultSource.hash === 'string' ? resultSource.hash.trim() : ''
      const submittedStatus = resultSource.status
      const submittedDiagnostics = cloneDiagnostics(resultSource.diagnostics)
      const isCurrentReady = compiled.status === 'ready'
      const isMatchingHash = Boolean(submittedHash) && submittedHash === compiled.hash
      const isMatchingReady = isMatchingHash && submittedStatus === 'ready' && isCurrentReady
      const isMatchingBlocked = isMatchingHash && submittedStatus === 'blocked'
      const diagnostics = isMatchingReady
        ? cloneDiagnostics(compiled.diagnostics)
        : isMatchingBlocked
          ? submittedDiagnostics
          : [{ id: 'stale-compilation', severity: 'warning' as const, message: '编译结果与当前模型配方不一致，已保留草稿等待重新编译。' }]
      const status: StudioModelVariantStatus = isMatchingReady ? 'ready' : isMatchingBlocked ? 'blocked' : 'draft'
      const compilationStatus: StudioComplexModelCompilation['status'] = isMatchingReady ? 'ready' : 'blocked'
      const next: StudioPetModelVariantsV1 = {
        ...current,
        complex: {
          ...current.complex,
          status,
          completion: isMatchingReady ? 100 : 5,
          pendingCapabilities: isMatchingReady ? [] : [...allPendingCapabilities()],
          recipe,
          compilation: createCompilation(result, compilationStatus, diagnostics, safeNow),
          updatedAt: safeNow,
        },
      }
      this.byPetId[next.petId] = next
      this.persist()
      return next
    },
  },
})
