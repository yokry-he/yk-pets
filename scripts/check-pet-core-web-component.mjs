import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rootPackage = read('package.json')
const petCore = read('packages/pet-core/src/index.ts')
const petCorePackage = read('packages/pet-core/package.json')
const webComponent = read('packages/pet-web-component/src/index.ts')
const vueAdapter = read('packages/pet-vue-adapter/src/index.ts')
const extensionPackage = read('apps/extension/package.json')
const playgroundPackage = read('apps/playground/package.json')
const studioSync = read('apps/playground/app/domain/pet-extension-sync.ts')
const studioPlugin = read('apps/playground/app/plugins/pet-extension-sync.client.ts')
const extensionSync = read('apps/extension/entrypoints/pet-recipe-sync.content.ts')
const avatarHost = read('apps/extension/components/avatar/AvatarCanvas.vue')
const adapter = read('apps/extension/entrypoints/content/yk-pet-adapter.ts')
const productionCanvas = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const configuredFox = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const appearance = read('apps/extension/components/avatar/appearance.ts')
const productionFox = read('apps/extension/components/avatar/CloudFox.vue')

const checks = [
  ['pet-core package is a workspace library', petCorePackage.includes('"name": "@yk-pets/pet-core"') && petCorePackage.includes('"./src/index.ts"')],
  ['framework-neutral recipe species and renderer interfaces', ['PetRecipeEnvelope', 'PetSpeciesDefinition', 'PetRendererAdapter', 'PetRendererRegistry'].every(token => petCore.includes(token)) && !petCore.includes("from 'vue'") && !petCore.includes("from 'three'")],
  ['versioned recipe storage and sync protocol', petCore.includes('PET_RECIPE_PROTOCOL_VERSION') && petCore.includes('YK_PET_RECIPE_STORAGE_KEY') && petCore.includes('PetRecipeSyncRequest') && petCore.includes('PetRecipeSyncResult')],
  ['yk-pet custom element delegates to renderer registry', webComponent.includes("YK_PET_ELEMENT_NAME = 'yk-pet'") && webComponent.includes('petRendererRegistry.resolve') && webComponent.includes('rendererInstance.update') && webComponent.includes('rendererInstance?.destroy')],
  ['yk-pet shadow root gives renderer content and canvas explicit dimensions', webComponent.includes('.mount > *') && webComponent.includes('.mount canvas') && webComponent.includes('height: 100% !important')],
  ['Vue adapter is isolated from pet-core', vueAdapter.includes('createVuePetRendererAdapter') && vueAdapter.includes('createApp') && vueAdapter.includes('PetRendererAdapter')],
  ['workspace apps depend on pet-core packages', extensionPackage.includes('"@yk-pets/pet-core": "workspace:*"') && extensionPackage.includes('"@yk-pets/pet-web-component": "workspace:*"') && extensionPackage.includes('"@yk-pets/pet-vue-adapter": "workspace:*"') && playgroundPackage.includes('"@yk-pets/pet-core": "workspace:*"')],
  ['Studio save synchronizes a recipe envelope', studioPlugin.includes("name !== 'save'") && studioPlugin.includes('syncAppearanceToBrowserExtension(store.recipe)') && studioSync.includes('createStudioRecipeEnvelope') && studioSync.includes('window.postMessage(request, window.location.origin)')],
  ['extension bridge validates and stores Studio recipes', extensionSync.includes('isPetRecipeSyncRequest') && extensionSync.includes('normalizePetRecipeEnvelope') && extensionSync.includes('chrome.storage.local.set') && extensionSync.includes('createPetRecipeSyncResult')],
  ['extension bridge only accepts trusted Studio pages', extensionSync.includes('isTrustedStudioPage') && extensionSync.includes("hostname === 'localhost'") && extensionSync.includes("pathname === '/studio'") && extensionSync.includes('if (!isTrustedStudioPage(window.location)) return')],
  ['AvatarCanvas compatibility API mounts yk-pet', avatarHost.includes("document.createElement('yk-pet')") && avatarHost.includes('registerExtensionCloudFoxPetElement') && avatarHost.includes('YK_PET_RECIPE_STORAGE_KEY') && avatarHost.includes('chrome.storage.onChanged.addListener')],
  ['AvatarCanvas verifies setState before invoking the custom element', avatarHost.includes("typeof element?.setState === 'function'") && avatarHost.includes('hasPetStateApi(element)') && avatarHost.includes('globalThis.customElements?.upgrade(element)')],
  ['AvatarCanvas detects unavailable or foreign custom elements and falls back', avatarHost.includes('custom element is unavailable or was claimed by the host page') && avatarHost.includes('fallbackActive') && avatarHost.includes('ProductionAvatarCanvas') && avatarHost.includes('yk-pet-error')],
  ['AvatarCanvas catches setState failures instead of repeating watcher errors', avatarHost.includes('try {\n    element.setState') && avatarHost.includes('activateFallback(error instanceof Error')],
  ['extension adapter marks registration complete after renderer and element setup', adapter.indexOf('registered = true') > adapter.indexOf('defineYkPetElement()')],
  ['extension Vue adapter mounts production canvas without recursion', adapter.includes('ProductionAvatarCanvas') && !adapter.includes("import AvatarCanvas") && adapter.includes("id: 'extension-cloud-fox'")],
  ['production canvas consumes recipe behind web component', productionCanvas.includes('PetRecipeEnvelope') && productionCanvas.includes('ConfiguredCloudFox') && productionCanvas.includes(':recipe="recipe"')],
  ['production canvas has shadow-safe explicit dimensions', productionCanvas.includes('rootStyle') && productionCanvas.includes("height: '100%'") && productionCanvas.includes(':style="tresStyle"')],
  ['formal Cloud Fox remains the single motion implementation', configuredFox.includes("import CloudFox from './CloudFox.vue'") && productionFox.includes('WAVE_DURATION_SECONDS') && productionFox.includes('TAIL_GLOW_DURATION_SECONDS') && !configuredFox.includes('WAVE_DURATION_SECONDS')],
  ['formal Cloud Fox reads custom palette proportions belly modes and symbols', appearance.includes('resolveExtensionCloudFoxAppearance') && appearance.includes('ExtensionBellyPatchMode') && configuredFox.includes('materialRoles') && configuredFox.includes("bellyPatchDesign.mode === 'custom'") && configuredFox.includes("bellyPatchDesign.mode === 'model-default'") && configuredFox.includes('showChestSymbol') && configuredFox.includes('visual.symbols.back.enabled')],
  ['root exposes architecture check', rootPackage.includes('check:pet-core-web-component') && rootPackage.includes('check-pet-core-web-component.mjs')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet-core / <yk-pet> architecture check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet-core / <yk-pet> architecture check passed: ${checks.length} checks.`)
