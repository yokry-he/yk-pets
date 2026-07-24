#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 防止鼻嘴几何、显式椭圆肚皮、全部位颜色、扩展范围和 Studio 事务交互回退。
 * Prevents regressions in nose/mouth geometry, explicit ellipse belly, all-part colors, expanded ranges, and transactional Studio interactions.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const bellyEditor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const colors = read('apps/playground/app/components/studio/StudioPartColorEditor.vue')
const studio = read('apps/playground/app/pages/studio.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const bridge = read('apps/extension/domain/pet-part-customization.ts')
const manifest = read('apps/extension/wxt.config.ts')

const bellyShapes = ['ellipse','egg','shield','teardrop','inverted-teardrop','bean','rounded-rectangle','heart','cloud','chest-fur']
const colorKeys = ['body','limbs','paws','muzzle','nose','mouth','tongue','cheeks','eyes','eyeHighlight','earOuter','earInner','earTip','antennaRod','antennaTip','belly','tailGlow','energyCore']
const checks = [
  ['customization normalizer is shared by Studio and extension', store.includes('normalizeCustomizableAppearance') && configured.includes('normalizeCustomizableAppearance') && bridge.includes('pet-part-customization')],
  ['nose and mouth selections render distinct geometry', face.includes("appearance.parts.nose === 'triangle'") && face.includes("appearance.parts.nose === 'sensor'") && face.includes("appearance.parts.mouth === 'open'") && face.includes("appearance.parts.mouth === 'cat'") && headIntent.includes('ExtensionCloudFoxFaceCustomization')],
  ['belly exposes ten explicit shapes with ellipse default', bellyShapes.every(shape => customization.includes(`id: '${shape}'`)) && customization.includes("shape: 'ellipse'") && belly.includes('drawShape') && bellyEditor.includes('恢复椭圆默认')],
  ['all visible material channels are configurable', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('所有部位颜色') && store.includes('patchPartColor')],
  ['expanded ranges exceed the legacy safe range', customization.includes('bodyWidth: [.55, 1.7]') && customization.includes('headScale: [.68, 1.48]') && customization.includes('tailLength: [.5, 1.9]') && customization.includes('width: [.42, 1.72]')],
  ['Studio uses visual cards precise values and transactional sliders', studio.includes('option-grid') && studio.includes('type="number"') && studio.includes('store.beginTransaction') && studio.includes('store.endTransaction') && store.includes('transactionOpen')],
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
