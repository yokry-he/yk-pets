import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SourceLocator,
  SourceMapRegistry,
  createDomDescriptor,
  createStableSelector,
  decodeSourceMapMappings,
  inspectVueOwnership,
  normalizeSourcePath,
  parseVueInspectorMetadata,
  type DomNodeLike,
  type SourceMapV3,
} from '../src/index.ts'

function tree() {
  const root: DomNodeLike = { tagName: 'MAIN', children: [] }
  const first: DomNodeLike = { tagName: 'BUTTON', className: 'action primary', parentElement: root }
  const second: DomNodeLike = { tagName: 'BUTTON', className: 'action primary', parentElement: root, previousElementSibling: first }
  root.children = [first, second]
  return { root, first, second }
}

test('stable selector prefers test ids and stops at the unique anchor', () => {
  const parent: DomNodeLike = { tagName: 'SECTION', attributes: { 'data-testid': 'billing-card' } }
  const child: DomNodeLike = { tagName: 'BUTTON', className: 'save', parentElement: parent }
  assert.equal(createStableSelector(child), 'section[data-testid="billing-card"] > button.save')
})

test('stable selector uses nth-of-type for repeated siblings', () => {
  const { second } = tree()
  assert.equal(createStableSelector(second), 'main > button.action.primary:nth-of-type(2)')
})

test('unstable generated classes are omitted', () => {
  const node: DomNodeLike = { tagName: 'DIV', className: 'css-a18f90 stable' }
  assert.equal(createStableSelector(node), 'div.stable')
})

test('DOM descriptor bounds text and captures sanitized attributes', () => {
  const node: DomNodeLike = { tagName: 'P', textContent: '  Hello\n world  ', attributes: { title: 'demo', authorization: 'Bearer abc' } }
  assert.deepEqual(createDomDescriptor(node, { maxTextLength: 8 }), {
    selector: 'p', tagName: 'p', classes: [], attributes: { title: 'demo', authorization: '[REDACTED]' }, text: 'Hello wo',
  })
})

test('Vue inspector metadata supports Windows paths', () => {
  assert.deepEqual(parseVueInspectorMetadata('C:\\src\\Card.vue:12:8:Card'), {
    file: 'C:\\src\\Card.vue', line: 12, column: 8, componentName: 'Card',
  })
})

test('Vue 3 ownership reads component file and parent chain', () => {
  const element = {
    __vueParentComponent: {
      uid: 9,
      type: { name: 'CheckoutCard', __file: '/src/CheckoutCard.vue' },
      parent: { type: { name: 'CheckoutPage' }, parent: null },
    },
  }
  assert.deepEqual(inspectVueOwnership(element), {
    version: 3,
    componentName: 'CheckoutCard',
    file: '/src/CheckoutCard.vue',
    uid: 9,
    parentChain: ['CheckoutPage'],
    evidence: ['element.__vueParentComponent'],
  })
})

test('Vue 2 ownership reads options metadata', () => {
  const element = { __vue__: { _uid: 3, $options: { name: 'LegacyPanel', __file: 'src/LegacyPanel.vue' }, $parent: null } }
  assert.deepEqual(inspectVueOwnership(element), {
    version: 2, componentName: 'LegacyPanel', file: 'src/LegacyPanel.vue', uid: 3, parentChain: [], evidence: ['element.__vue__'],
  })
})

test('inspector attribute takes precedence over opaque runtime ownership', () => {
  const element = {
    attributes: { 'data-v-inspector': '/src/App.vue:7:4:div' },
    __vueParentComponent: { uid: 1, type: { name: 'App' } },
  }
  assert.deepEqual(inspectVueOwnership(element), {
    version: 'inspector', componentName: 'div', file: '/src/App.vue', line: 7, column: 4, parentChain: [],
    evidence: ['data-v-inspector=/src/App.vue:7:4:div'],
  })
})

test('Source Map VLQ mappings decode generated and original positions', () => {
  const map: SourceMapV3 = { version: 3, sources: ['src/App.vue'], names: [], mappings: 'AAAA;AACA' }
  assert.deepEqual(decodeSourceMapMappings(map), [
    { generatedLine: 0, generatedColumn: 0, sourceIndex: 0, originalLine: 0, originalColumn: 0 },
    { generatedLine: 1, generatedColumn: 0, sourceIndex: 0, originalLine: 1, originalColumn: 0 },
  ])
})

test('source map registry resolves the greatest lower-bound segment', () => {
  const registry = new SourceMapRegistry()
  registry.register('https://app.example/assets/app.js', {
    version: 3,
    sourceRoot: 'webpack:///src',
    sources: ['App.vue'],
    sourcesContent: ['<template />'],
    names: ['render'],
    mappings: 'AAAAA,UAAU',
  })
  const position = registry.resolve({ url: 'https://app.example/assets/app.js', lineNumber: 0, columnNumber: 12 })
  assert.equal(position?.source, 'src/App.vue')
  assert.equal(position?.line, 0)
  assert.equal(position?.column, 10)
})

test('indexed source maps resolve section offsets', () => {
  const registry = new SourceMapRegistry()
  registry.register('https://app.example/chunk.js', {
    version: 3,
    sections: [{ offset: { line: 2, column: 5 }, map: { version: 3, sources: ['src/Part.vue'], names: [], mappings: 'AAAA' } }],
  })
  const position = registry.resolve({ url: 'https://app.example/chunk.js', lineNumber: 2, columnNumber: 5 })
  assert.equal(position?.source, 'https://app.example/src/Part.vue')
  assert.equal(position?.line, 0)
})

test('source locator ranks explicit inspector metadata above runtime and maps', () => {
  const registry = new SourceMapRegistry()
  registry.register('https://app.example/app.js', { version: 3, sources: ['src/Generated.vue'], names: [], mappings: 'AAAA' })
  const locator = new SourceLocator({ sourceMaps: registry, componentSources: { Card: { source: '/src/CardFallback.vue' } } })
  const result = locator.locate({
    descriptor: {
      selector: '#card', tagName: 'div', classes: [], attributes: { 'data-v-inspector': '/src/Card.vue:20:7:Card' },
    },
    vue: { version: 3, componentName: 'Card', file: '/src/CardRuntime.vue', parentChain: [], evidence: [] },
    frames: [{ url: 'https://app.example/app.js', lineNumber: 0, columnNumber: 0 }],
  })
  assert.equal(result.primary?.source, '/src/Card.vue')
  assert.equal(result.primary?.confidence, 0.99)
  assert.equal(result.candidates.length, 4)
})

test('candidate deduplication merges evidence for the same source location', () => {
  const locator = new SourceLocator({ componentSources: { Card: { source: '/src/Card.vue', line: 2, column: 3 } } })
  const result = locator.locate({
    vue: { version: 3, componentName: 'Card', file: '/src/Card.vue', line: 2, column: 3, parentChain: [], evidence: [] },
  })
  assert.equal(result.candidates.length, 1)
  assert.deepEqual(result.primary?.evidenceKinds.sort(), ['component-registry', 'vue-runtime'])
})

test('source path normalization handles bundler schemes and Windows separators', () => {
  assert.equal(normalizeSourcePath('webpack:///C:\\src\\App.vue?vue&type=script'), 'C:/src/App.vue')
})

test('invalid source map segments are rejected', () => {
  assert.throws(() => decodeSourceMapMappings({ version: 3, sources: ['a.ts'], names: [], mappings: '!' }), /base64/)
})
