#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定完整 Studio 架构：独立身体/头型、单一躯干与 FaceRoot、曲面肚皮、稳定布局、全部位颜色和本地编辑语义。
 * Locks the complete Studio architecture: independent body/head shapes, sole torso and FaceRoot, curved belly, stable layout, all-part colors, and local editing semantics.
 */
import { existsSync, readFileSync } from 'node:fs'
const url = path => new URL(`../${path}`, import.meta.url)
const read = path => readFileSync(url(path), 'utf8')
const appearance = read('apps/playground/app/domain/cloud-fox-appearance.ts')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const profiles = read('apps/playground/app/domain/cloud-fox-shape-profile.ts')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bodyShape = read('apps/playground/app/components/studio/ExtensionCloudFoxBodyShape.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headShape = read('apps/playground/app/components/studio/ExtensionCloudFoxHeadShape.vue')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const bellyEditor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const colors = read('apps/playground/app/components/studio/StudioPartColorEditor.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const studio = read('apps/playground/app/pages/studio.vue')
const app = read('apps/playground/app/app.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const customizationBridge = read('apps/extension/domain/pet-part-customization.ts')
const shapeBridge = read('apps/extension/domain/cloud-fox-shape-profile.ts')
const manifest = read('apps/extension/wxt.config.ts')
const oldAdvancedPlugin = existsSync(url('apps/playground/app/plugins/studio-advanced.client.ts'))

const bodyIds = ['sphere','ellipsoid','capsule','pear','bean','rounded-cube']
const headIds = ['classic-round','wide-round','oval','capsule','bean','rounded-cube']
const bellyIds = ['ellipse','egg','shield','teardrop','inverted-teardrop','bean','rounded-rectangle','heart','cloud','chest-fur']
const colorKeys = ['body','limbs','paws','muzzle','nose','mouth','tongue','cheeks','eyes','eyeHighlight','earOuter','earInner','earTip','antennaRod','antennaTip','belly','tailGlow','energyCore']
const checks = [
  ['body and head are independent recipe channels', appearance.includes('CLOUD_FOX_HEAD_SHAPES') && appearance.includes('headShape: CloudFoxHeadShape') && appearance.includes("headShape: 'classic-round'") && studio.includes("setPart('headShape'") && studio.includes("setPart('bodyShape'")],
  ['legacy recipes migrate to the classic head without body coupling', appearance.includes('normalizePart(parts.headShape, optionIds.headShapes, fallback.parts.headShape)') && !profiles.includes('headShape:') && profiles.includes('getCloudFoxBodyProfile') && profiles.includes('getCloudFoxHeadProfile')],
  ['all body and head options have explicit profiles', bodyIds.every(id => profiles.includes(`id: '${id}'`)) && headIds.every(id => profiles.includes(`id: '${id}'`))],
  ['one torso surface owns the production body', body.includes('<ExtensionCloudFoxBodyShape') && bodyShape.includes('sole production torso surface') && !belly.includes('ExtensionCloudFoxBodyShape') && !body.includes("appearance.parts.bodyShape === 'rounded-cube'")),
  ['six bodies use continuous geometry rather than stacked sphere groups', bodyShape.includes('LatheGeometry') && bodyShape.includes('CapsuleGeometry') && bodyShape.includes('RoundedBoxGeometry') && bodyShape.includes('createBeanGeometry') && !bodyShape.includes('v-for="side in [-1, 1]"')),
  ['one animated head owns one independent shell and one FaceRoot', head.includes('<ExtensionCloudFoxHeadShape') && head.includes('<ExtensionCloudFoxFaceCustomization') && headShape.includes('getCloudFoxHeadProfile') && !face.includes('ref="head"')],
  ['spark and crystal diamond eyes use separate components and geometry', head.includes('<ExtensionCloudFoxEyeShape') && eye.includes("style === 'spark'") && eye.includes("style === 'diamond'") && eye.includes('TresOctahedronGeometry') && !eye.includes("['spark', 'diamond'].includes")],
  ['classic mouth and thin alternate mouths remain', face.includes("appearance.parts.mouth === 'smile'") && face.includes('scheme.model.head.mouthScale') && face.includes('scheme.model.head.tongueScale') && face.includes('CatmullRomCurve3') && face.includes('TresTubeGeometry')],
  ['belly is a curved decal and never a body constructor', bellyIds.every(id => customization.includes(`id: '${id}'`)) && belly.includes('createCurvedSurface') && belly.includes('depth-write="false"') && !belly.includes('ExtensionCloudFoxBodyShape') && bellyEditor.includes('恢复椭圆默认')],
  ['body profile drives limb, belly, symbol and camera placement', body.includes('getCloudFoxBodyProfile') && belly.includes('getCloudFoxBodyProfile') && canvas.includes('getCloudFoxBodyProfile') && canvas.includes('getCloudFoxHeadProfile')],
  ['Studio has bounded workspace tracks and opt-in hotspots', studio.includes('height:100dvh') && studio.includes('grid-template-rows:auto minmax(0,1fr)') && studio.includes('.controls{display:flex;min-height:0') && studio.includes('v-if="showHotspots"') && !studio.includes('position:sticky')],
  ['Studio suppresses the extension overlay while authoring', studio.includes("class: 'yk-pets-studio-page'") && app.includes('body.yk-pets-studio-page [data-nova-extension-root="overlay"]')],
  ['advanced features are native Vue and local-only', !oldAdvancedPlugin && studio.includes('compareSnapshot') && studio.includes('saveCustomScheme') && studio.includes('undoStack.length') && !studio.includes('setInterval(') && !store.includes('fetch(')],
  ['all material channels and expanded ranges remain', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('所有部位颜色') && customization.includes('bodyWidth: [.55, 1.7]') && customization.includes('headScale: [.68, 1.48]')],
  ['Studio and extension share normalizers and domain bridges', configured.includes('normalizeCustomizableAppearance') && customizationBridge.includes('pet-part-customization') && shapeBridge.includes('cloud-fox-shape-profile')],
  ['extension permissions remain unchanged', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && !manifest.includes("'unlimitedStorage'")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet customization architecture check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet customization architecture passed: ${checks.length} checks.`)
