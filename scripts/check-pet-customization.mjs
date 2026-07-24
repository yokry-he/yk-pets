#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 防止鼻嘴层级、经典嘴、肚皮、颜色、扩展范围、Studio 原生高级交互、稳定布局和事务历史回退。
 * Prevents regressions in face hierarchy, classic mouth, belly, colors, ranges, native Studio interactions, stable layout, and transactional history.
 */
import { existsSync, readFileSync } from 'node:fs'
const url = path => new URL(`../${path}`, import.meta.url)
const read = path => readFileSync(url(path), 'utf8')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const bellyEditor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const colors = read('apps/playground/app/components/studio/StudioPartColorEditor.vue')
const studio = read('apps/playground/app/pages/studio.vue')
const app = read('apps/playground/app/app.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const bridge = read('apps/extension/domain/pet-part-customization.ts')
const manifest = read('apps/extension/wxt.config.ts')
const legacyAdvancedPluginExists = existsSync(url('apps/playground/app/plugins/studio-advanced.client.ts'))

const bellyShapes = ['ellipse','egg','shield','teardrop','inverted-teardrop','bean','rounded-rectangle','heart','cloud','chest-fur']
const colorKeys = ['body','limbs','paws','muzzle','nose','mouth','tongue','cheeks','eyes','eyeHighlight','earOuter','earInner','earTip','antennaRod','antennaTip','belly','tailGlow','energyCore']
const checks = [
  ['customization normalizer is shared by Studio and extension', store.includes('normalizeCustomizableAppearance') && configured.includes('normalizeCustomizableAppearance') && bridge.includes('pet-part-customization')],
  ['nose and mouth selections render distinct geometry', face.includes("appearance.parts.nose === 'triangle'") && face.includes("appearance.parts.nose === 'sensor'") && face.includes("appearance.parts.mouth === 'open'") && face.includes("appearance.parts.mouth === 'cat'") && face.includes('TresTubeGeometry')],
  ['one animated head owns the sole face hierarchy', head.includes('<ExtensionCloudFoxFaceCustomization') && !headIntent.includes('ExtensionCloudFoxFaceCustomization') && !head.includes('ref="mouth"') && !head.includes(':position="vector(scheme.model.head.nosePosition)"') && !face.includes('ref="head"') && !face.includes('render-order')],
  ['classic smile restores the production Cloud Fox mouth and tongue', face.includes("appearance.parts.mouth === 'smile'") && face.includes('scheme.model.head.mouthScale') && face.includes('scheme.model.head.tonguePosition') && face.includes('scheme.model.head.tongueScale')],
  ['thin curve mouths replace side-facing torus overlays', face.includes('CatmullRomCurve3') && face.includes('smileLeft') && face.includes('catLeft') && !face.includes('TresTorusGeometry :args="[.16')],
  ['belly exposes ten explicit shapes with ellipse default', bellyShapes.every(shape => customization.includes(`id: '${shape}'`)) && customization.includes("return 'ellipse'") && belly.includes('drawShape') && bellyEditor.includes('恢复椭圆默认')],
  ['all visible material channels are configurable', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('所有部位颜色') && store.includes('patchPartColor')],
  ['expanded ranges exceed the legacy safe range', customization.includes('bodyWidth: [.55, 1.7]') && customization.includes('headScale: [.68, 1.48]') && customization.includes('tailLength: [.5, 1.9]') && customization.includes('width: [.42, 1.72]')],
  ['Studio uses visual cards precise values and transactional sliders', studio.includes('option-grid') && studio.includes('type="number"') && studio.includes('store.beginTransaction') && studio.includes('store.endTransaction') && store.includes('transactionOpen')],
  ['advanced Studio interactions are native Vue instead of DOM injection', !legacyAdvancedPluginExists && studio.includes('searchEntries') && studio.includes('compareSnapshot') && studio.includes('part-hotspots') && studio.includes('saveCustomScheme')],
  ['Studio layout uses explicit grid tracks and independent inspector scrolling', studio.includes('.topbar{display:grid') && studio.includes('.inspector{display:grid;grid-template-rows:auto auto minmax(0,1fr)') && studio.includes('.controls{display:flex;min-height:0') && !studio.includes('.topbar{flex-wrap:wrap}')],
  ['Studio avoids fixed shortcuts and the page-pet overlay while editing', app.includes("route.path !== '/studio'") && studio.includes(':global([data-nova-extension-root]){display:none!important}') && studio.includes(':global(.studio-entry){display:none!important}')],
  ['Studio classic comparison restores the exact temporary snapshot', studio.includes('compareSnapshot') && studio.includes('restoreComparison') && studio.includes('createExtensionClassicAppearance') && studio.includes('compareActive')],
  ['Studio exposes local named schemes and recent history', studio.includes('saveCustomScheme') && studio.includes('applyCustomScheme') && studio.includes('undoStack.length') && studio.includes('redoStack.length')],
  ['Studio keyboard shortcuts remain scoped and cleaned up', studio.includes("event.key === '/'") && studio.includes("event.key === 'Escape'") && studio.includes("window.removeEventListener('keydown'") && !studio.includes('setInterval(')],
  ['Studio draft and formal save semantics remain local', store.includes('appearance-draft:v3') && store.includes('localStorage.setItem') && !store.includes('fetch(')],
  ['extension permissions remain unchanged', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && !manifest.includes("'unlimitedStorage'")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet customization check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet customization check passed: ${checks.length} checks.`)
