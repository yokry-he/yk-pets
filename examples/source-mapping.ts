import { SourceLocator, SourceMapRegistry } from '@yk-pets/pet-source-mapper'

const registry = new SourceMapRegistry()
registry.register('https://app.example/assets/app.js', {
  version: 3,
  sources: ['src/App.vue'],
  names: [],
  mappings: 'AAAA',
})

const locator = new SourceLocator({ sourceMaps: registry })
console.log(locator.locate({
  descriptor: {
    selector: '#app',
    tagName: 'main',
    classes: [],
    attributes: { 'data-v-inspector': '/src/App.vue:1:1:App' },
  },
  frames: [{ url: 'https://app.example/assets/app.js', lineNumber: 0, columnNumber: 0 }],
}))
