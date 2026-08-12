/**
 * 文件职责 / File responsibility
 * 验证道具实体迁移、组件预算、层级清理、材质范围、锚点和编辑命令的确定性。
 * Verifies deterministic prop-entity migration, component budgets, hierarchy cleanup, material ranges, anchors, and editing commands.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addPropComponent,
  createStudioPropAsset,
  duplicatePropComponent,
  normalizePropAsset,
  removePropComponent,
  STUDIO_PROP_COMPONENT_LIMIT,
  updatePropAnchor,
  updatePropComponent,
} from '../src/index.ts'

test('legacy prop metadata migrates into a versioned entity with four anchors', () => {
  const result = normalizePropAsset({ id: 'legacy', nameZh: '旧道具', nameEn: 'Legacy', kind: 'effect', defaultAnchor: 'head-top', anchorIds: ['origin', 'grip'], createdAt: 1, updatedAt: 2 })
  assert.equal(result.asset.schemaVersion, 2)
  assert.equal(result.asset.kind, 'effect')
  assert.equal(result.asset.defaultAnchor, 'head-top')
  assert.deepEqual(result.asset.anchors.map(anchor => anchor.id), ['origin', 'grip', 'display', 'emitter'])
  assert.equal(result.asset.components[0]?.primitive, 'crystal')
  assert.ok(result.diagnostics.some(item => item.code === 'legacy-prop-migrated'))
})

test('components normalize ranges, ids, parents, cycles, and budgets', () => {
  const components = Array.from({ length: STUDIO_PROP_COMPONENT_LIMIT + 4 }, (_, index) => ({
    id: index < 2 ? 'duplicate' : `part-${index}`,
    parentId: index === 2 ? 'missing' : index === 3 ? 'part-4' : index === 4 ? 'part-3' : undefined,
    primitive: index === 5 ? 'particles' : 'box',
    geometry: { width: 99, particleCount: 999 },
    material: { opacity: 4, metalness: -1, roughness: 3, glow: 99 },
  }))
  const result = normalizePropAsset({ id: 'budget', nameZh: '预算', nameEn: 'Budget', components })
  assert.equal(result.asset.components.length, STUDIO_PROP_COMPONENT_LIMIT - 1)
  assert.equal(result.asset.components.find(item => item.id === 'part-5')?.geometry.particleCount, 240)
  assert.equal(result.asset.components[0]?.material.opacity, 1)
  assert.equal(result.asset.components.find(item => item.id === 'part-2')?.parentId, undefined)
  assert.equal(result.asset.components.find(item => item.id === 'part-3')?.parentId, undefined)
  assert.ok(result.diagnostics.some(item => item.code === 'component-limit-truncated'))
  assert.ok(result.diagnostics.some(item => item.code === 'duplicate-component-id-replaced'))
  assert.ok(result.diagnostics.some(item => item.code === 'component-cycle-cleared'))
})

test('component and anchor editing preserves stable asset identity', () => {
  let asset = createStudioPropAsset({ id: 'prop-edit', nameZh: '编辑', nameEn: 'Edit', createdAt: 10, updatedAt: 10 })
  const originalId = asset.id
  asset = addPropComponent(asset, 'sphere', 'sphere-a', asset.components[0]?.id)
  asset = updatePropComponent(asset, 'sphere-a', { material: { ...asset.components[1]!.material, color: '#ff0000' } })
  asset = duplicatePropComponent(asset, 'sphere-a', 'sphere-b')
  asset = updatePropAnchor(asset, 'grip', { position: [1, 2, 3] })
  assert.equal(asset.id, originalId)
  assert.equal(asset.components.find(item => item.id === 'sphere-a')?.material.color, '#ff0000')
  assert.equal(asset.components.find(item => item.id === 'sphere-b')?.transform.position[0], .12)
  assert.deepEqual(asset.anchors.find(anchor => anchor.id === 'grip')?.transform.position, [1, 2, 3])
  asset = removePropComponent(asset, asset.components[0]!.id)
  assert.ok(asset.components.length >= 1)
})
