/**
 * 文件职责 / File responsibility
 * 提供与框架无关的宠物物种、配方信封、渲染器注册和 Studio 到扩展同步协议。
 * Provides framework-neutral pet species, recipe envelopes, renderer registration, and Studio-to-extension sync contracts.
 */

export type PetRecord = Record<string, unknown>
export type PetRecipeSource = 'studio' | 'extension' | 'import' | 'default'

export const PET_RECIPE_PROTOCOL_VERSION = 1 as const
export const YK_PET_RECIPE_STORAGE_KEY = 'yk-pets:active-recipe:v1'
export const YK_PET_STUDIO_SYNC_SOURCE = 'yk-pets-studio'
export const YK_PET_EXTENSION_SYNC_SOURCE = 'yk-pets-extension'
export const YK_PET_SYNC_REQUEST_TYPE = 'YK_PET_RECIPE_SYNC_REQUEST'
export const YK_PET_SYNC_RESULT_TYPE = 'YK_PET_RECIPE_SYNC_RESULT'

export interface PetRecipeEnvelope<TAppearance = PetRecord> {
  protocolVersion: typeof PET_RECIPE_PROTOCOL_VERSION
  recipeId: string
  speciesId: string
  rendererId: string
  source: PetRecipeSource
  updatedAt: string
  appearance: TAppearance
}

export interface CreatePetRecipeEnvelopeInput<TAppearance> {
  recipeId?: string
  speciesId: string
  rendererId: string
  source?: PetRecipeSource
  updatedAt?: string
  appearance: TAppearance
}

export interface PetSpeciesDefinition<TAppearance = unknown> {
  id: string
  label: string
  labelEn: string
  rendererIds: readonly string[]
  createDefaultAppearance(): TAppearance
  normalizeAppearance(input: unknown): TAppearance
}

export interface PetRenderState<TAppearance = unknown, TRenderProps extends PetRecord = PetRecord> {
  recipe: PetRecipeEnvelope<TAppearance>
  behavior: string
  renderProps: TRenderProps
}

export interface PetRendererInstance<TAppearance = unknown, TRenderProps extends PetRecord = PetRecord> {
  update(state: PetRenderState<TAppearance, TRenderProps>): void
  destroy(): void
}

export interface PetRendererAdapter<TAppearance = unknown, TRenderProps extends PetRecord = PetRecord> {
  id: string
  supports(speciesId: string): boolean
  mount(host: HTMLElement, state: PetRenderState<TAppearance, TRenderProps>): PetRendererInstance<TAppearance, TRenderProps>
}

export class PetRendererRegistry {
  private readonly adapters = new Map<string, PetRendererAdapter>()

  register(adapter: PetRendererAdapter) {
    this.adapters.set(adapter.id, adapter)
    return () => this.unregister(adapter.id)
  }

  unregister(id: string) {
    this.adapters.delete(id)
  }

  get(id: string) {
    return this.adapters.get(id)
  }

  resolve(rendererId: string, speciesId: string) {
    const preferred = this.adapters.get(rendererId)
    if (preferred?.supports(speciesId)) return preferred
    return [...this.adapters.values()].find(adapter => adapter.supports(speciesId))
  }

  list() {
    return [...this.adapters.values()]
  }
}

export const petRendererRegistry = new PetRendererRegistry()

export interface PetRecipeSyncRequest<TAppearance = PetRecord> {
  source: typeof YK_PET_STUDIO_SYNC_SOURCE
  type: typeof YK_PET_SYNC_REQUEST_TYPE
  requestId: string
  recipe: PetRecipeEnvelope<TAppearance>
}

export interface PetRecipeSyncResult {
  source: typeof YK_PET_EXTENSION_SYNC_SOURCE
  type: typeof YK_PET_SYNC_RESULT_TYPE
  requestId: string
  ok: boolean
  error?: string
}

export function isRecord(value: unknown): value is PetRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function createPetRecipeEnvelope<TAppearance>(input: CreatePetRecipeEnvelopeInput<TAppearance>): PetRecipeEnvelope<TAppearance> {
  return {
    protocolVersion: PET_RECIPE_PROTOCOL_VERSION,
    recipeId: input.recipeId || `${input.speciesId}:active`,
    speciesId: input.speciesId,
    rendererId: input.rendererId,
    source: input.source || 'default',
    updatedAt: input.updatedAt || new Date().toISOString(),
    appearance: input.appearance,
  }
}

export function normalizePetRecipeEnvelope(input: unknown): PetRecipeEnvelope<PetRecord> | null {
  if (!isRecord(input) || !isRecord(input.appearance)) return null
  const protocolVersion = input.protocolVersion === PET_RECIPE_PROTOCOL_VERSION
    ? PET_RECIPE_PROTOCOL_VERSION
    : PET_RECIPE_PROTOCOL_VERSION
  return {
    protocolVersion,
    recipeId: text(input.recipeId, 'cloud-fox:active'),
    speciesId: text(input.speciesId, 'cloud-fox'),
    rendererId: text(input.rendererId, 'extension-cloud-fox'),
    source: ['studio', 'extension', 'import', 'default'].includes(String(input.source))
      ? input.source as PetRecipeSource
      : 'import',
    updatedAt: text(input.updatedAt, new Date().toISOString()),
    appearance: input.appearance,
  }
}

export function isPetRecipeSyncRequest(input: unknown): input is PetRecipeSyncRequest {
  if (!isRecord(input)) return false
  return input.source === YK_PET_STUDIO_SYNC_SOURCE
    && input.type === YK_PET_SYNC_REQUEST_TYPE
    && typeof input.requestId === 'string'
    && normalizePetRecipeEnvelope(input.recipe) !== null
}

export function createPetRecipeSyncResult(requestId: string, ok: boolean, error?: string): PetRecipeSyncResult {
  return {
    source: YK_PET_EXTENSION_SYNC_SOURCE,
    type: YK_PET_SYNC_RESULT_TYPE,
    requestId,
    ok,
    ...(error ? { error } : {}),
  }
}

export function isPetRecipeSyncResult(input: unknown): input is PetRecipeSyncResult {
  return isRecord(input)
    && input.source === YK_PET_EXTENSION_SYNC_SOURCE
    && input.type === YK_PET_SYNC_RESULT_TYPE
    && typeof input.requestId === 'string'
    && typeof input.ok === 'boolean'
}
