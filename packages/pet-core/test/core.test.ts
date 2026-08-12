/**
 * 文件职责 / File responsibility
 * 验证配方信封、Studio 同步消息和渲染器注册表的框架无关行为。
 * Verifies framework-neutral recipe envelopes, Studio sync messages, and renderer-registry behavior.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PetRendererRegistry,
  createPetRecipeEnvelope,
  createPetRecipeSyncResult,
  isPetRecipeSyncRequest,
  isPetRecipeSyncResult,
  normalizePetRecipeEnvelope,
  YK_PET_STUDIO_SYNC_SOURCE,
  YK_PET_SYNC_REQUEST_TYPE,
} from '../src/index.ts'

test('normalizes versioned appearance recipes', () => {
  const recipe = createPetRecipeEnvelope({
    speciesId: 'cloud-fox',
    rendererId: 'extension-cloud-fox',
    source: 'studio',
    appearance: { palette: { coat: '#ffffff' } },
  })
  const normalized = normalizePetRecipeEnvelope(JSON.parse(JSON.stringify(recipe)))
  assert.equal(normalized?.speciesId, 'cloud-fox')
  assert.equal(normalized?.rendererId, 'extension-cloud-fox')
  assert.deepEqual(normalized?.appearance, recipe.appearance)
})

test('validates Studio sync requests and extension results', () => {
  const recipe = createPetRecipeEnvelope({ speciesId: 'cloud-fox', rendererId: 'extension-cloud-fox', appearance: {} })
  const request = { source: YK_PET_STUDIO_SYNC_SOURCE, type: YK_PET_SYNC_REQUEST_TYPE, requestId: 'request-1', recipe }
  assert.equal(isPetRecipeSyncRequest(request), true)
  assert.equal(isPetRecipeSyncResult(createPetRecipeSyncResult('request-1', true)), true)
})

test('resolves the requested renderer before species fallback', () => {
  const registry = new PetRendererRegistry()
  const fallback = { id: 'fallback', supports: (speciesId: string) => speciesId === 'cloud-fox', mount: () => ({ update() {}, destroy() {} }) }
  const preferred = { id: 'preferred', supports: (speciesId: string) => speciesId === 'cloud-fox', mount: () => ({ update() {}, destroy() {} }) }
  registry.register(fallback)
  registry.register(preferred)
  assert.equal(registry.resolve('preferred', 'cloud-fox')?.id, 'preferred')
  assert.equal(registry.resolve('missing', 'cloud-fox')?.id, 'fallback')
})
