#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定独立头身、统一控制注册表、前后爪、完整鼻嘴、独立颜色、真实表面肚皮、可见眼睛、稳定工作台和本地编辑语义。
 * Locks independent head/body, the control registry, front/hind paws, complete nose/mouth controls, independent colors, real-surface belly, visible eyes, and local editing semantics.
 */
import { existsSync, readFileSync } from 'node:fs'
const url = path => new URL(`../${path}`, import.meta.url)
const read = path => readFileSync(url(path), 'utf8')
const appearance = read('apps/playground/app/domain/cloud-fox-appearance.ts')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const controls = read('apps/playground/app/domain/studio-control-registry.ts')
const profiles = read('apps/playground/app/domain/cloud-fox-shape-profile.ts')
const surface = read('apps/playground/app/domain/cloud-fox-surface-model.ts')
const eyeMetrics = read('apps/playground/app/domain/cloud-fox-eye-metrics.ts')
const defaults = read('apps/playground/app/domain/extension-cloud-fox-default.ts')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bodyShape = read('apps/playground/app/components/studio/ExtensionCloudFoxBodyShape.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headShape = read('apps/playground/app/components/studio/ExtensionCloudFoxHeadShape.vue')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const face = read('apps/playground/app/components/studio/ExtensionCloudFoxFaceCustomization.vue')
const mouthEditor = read('apps/playground/app/components/studio/StudioMouthEditor.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const bellyEditor = read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue')
const hindEditor = read('apps/playground/app/components/studio/StudioHindPawEditor.vue')
const colors = read('apps/playground/app/components/studio/StudioPartColorEditor.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const studio = read('apps/playground/app/pages/studio.vue')
const app = read('apps/playground/app/app.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const customizationBridge = read('apps/extension/domain/pet-part-customization.ts')
const shapeBridge = read('apps/extension/domain/cloud-fox-shape-profile.ts')
const surfaceBridge = read('apps/extension/domain/cloud-fox-surface-model.ts')
const eyeMetricsBridge = read('apps/extension/domain/cloud-fox-eye-metrics.ts')
const patchTest = read('scripts/test-pet-studio-local-patches.ts')
const packageJson = read('package.json')
const manifest = read('apps/extension/wxt.config.ts')
const oldAdvancedPlugin = existsSync(url('apps/playground/app/plugins/studio-advanced.client.ts'))
const bodyIds = ['sphere','ellipsoid','capsule','pear','bean','rounded-cube']
const headIds = ['classic-round','wide-round','oval','capsule','bean','rounded-cube']
const bellyIds = ['ellipse','egg','shield','teardrop','inverted-teardrop','bean','rounded-rectangle','heart','cloud','chest-fur']
const colorKeys = ['body','limbs','paws','muzzle','nose','mouth','tongue','cheeks','eyes','eyeHighlight','earOuter','earInner','earTip','antennaRod','antennaTip','belly','tailGlow','energyCore']
const nosePaths = ['offsetX','offsetY','surfaceOffset','scaleX','scaleY','scaleZ','rotation']
const checks = [
  ['body and head are independent recipe channels', appearance.includes('CLOUD_FOX_HEAD_SHAPES') && appearance.includes('headShape: CloudFoxHeadShape') && studio.includes("setPart('headShape'") && studio.includes("setPart('bodyShape'")],
  ['legacy recipes migrate without body/head coupling', appearance.includes('normalizePart(parts.headShape, optionIds.headShapes, fallback.parts.headShape)') && !profiles.includes('headShape:')],
  ['all body and head options have explicit profiles', bodyIds.every(id => profiles.includes(`id: '${id}'`)) && headIds.every(id => profiles.includes(`id: '${id}'`))],
  ['one normalized torso surface owns the body', body.includes('<ExtensionCloudFoxBodyShape') && bodyShape.includes('normalized unit envelope') && !belly.includes('ExtensionCloudFoxBodyShape')],
  ['one production-proportioned head owns one FaceRoot', head.includes('<ExtensionCloudFoxHeadShape') && head.includes('<ExtensionCloudFoxFaceCustomization') && headShape.includes('scheme.model.head.scale') && !face.includes('ref="head"')],
  ['surface model samples bodies heads eyes and muzzle', surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('sampleCloudFoxHeadFrontSurfaceAtLocalXY') && surface.includes('resolveCloudFoxEyeSurfaceAnchor') && surface.includes('resolveCloudFoxMuzzleSurfaceAnchor')],
  ['belly projects with front-facing winding', bellyIds.every(id => customization.includes(`id: '${id}'`)) && belly.includes('createCloudFoxBellySurfaceMesh') && surface.includes('indices.push(topLeft, topRight, bottomLeft') && belly.includes(':depth-write="true"') && bellyEditor.includes('恢复椭圆默认')],
  ['eyes use sampled anchors and visibility floors', head.includes('resolveCloudFoxEyeSurfaceAnchor') && head.includes('getCloudFoxEyeBlinkFloor') && eyeMetrics.includes('blinkFloor') && eye.includes('ExtrudeGeometry') && eye.includes('TresOctahedronGeometry')],
  ['mouths share muzzle surface and style-specific shallow geometry', face.includes('resolveCloudFoxMuzzleSurfaceAnchor') && face.includes("appearance.parts.mouth === 'smile'") && face.includes("appearance.parts.mouth === 'open'") && face.includes('TresCircleGeometry') && face.includes('TresTubeGeometry') && face.includes('animatedOpen')],
  ['nose has one recipe registry UI and renderer contract', customization.includes('PetNoseCustomizationRecipe') && nosePaths.every(key => controls.includes(`'customization.nose.${key}'`) && customization.includes(`${key}:`) && mouthEditor.includes(`'customization.nose.${key}'`)) && face.includes('nose.value.scaleX') && face.includes('nose.value.surfaceOffset')],
  ['classic front and hind paw defaults remain', defaults.includes('embedDepth: .06') && body.includes('classicPawX') && customization.includes('createDefaultHindPawDesign') && hindEditor.includes('恢复经典后爪')],
  ['one control registry owns front hind and nose ranges', controls.includes('STUDIO_CONTROL_REGISTRY') && controls.includes("'frontPawDesign.rootHeight'") && controls.includes("'hindPawDesign.pawScaleZ'") && controls.includes("'customization.nose.scaleZ'")],
  ['colors remain independent through UI normalization and tests', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('每个可见材质通道独立保存并同步') && !colors.includes('patchPartColor') && !customization.includes('colors.antennaRod = colors.paws') && !customization.includes('colors.energyCore = colors.eyeHighlight') && patchTest.includes('assert.notEqual(independentColors.customization.colors.paws') && patchTest.includes('assert.notEqual(independentColors.customization.colors.eyeHighlight')],
  ['numeric surface regression test remains in CI', packageJson.includes('test:cloud-fox-surface') && read('scripts/test-cloud-fox-surface-model.ts').includes('maximumOffsetError')],
  ['camera scale is independent of editor section', canvas.includes('fitRatio') && canvas.includes('cameraFactor') && !canvas.includes('focusZoom')],
  ['Studio remains scrollable and overlay-free', app.includes('overflow-y:auto!important') && app.includes('scrollbar-gutter:stable') && studio.includes("class: 'yk-pets-studio-page'") && app.includes('body.yk-pets-studio-page [data-nova-extension-root="overlay"]')],
  ['advanced features remain native and local-only', !oldAdvancedPlugin && studio.includes('compareSnapshot') && studio.includes('saveCustomScheme') && !store.includes('fetch(')],
  ['Studio and extension share geometry domains', configured.includes('normalizeCustomizableAppearance') && customizationBridge.includes('pet-part-customization') && shapeBridge.includes('cloud-fox-shape-profile') && surfaceBridge.includes('cloud-fox-surface-model') && eyeMetricsBridge.includes('cloud-fox-eye-metrics')],
  ['extension permissions remain unchanged', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && !manifest.includes("'unlimitedStorage'")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) { console.error('pet customization architecture check failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1) }
console.log(`pet customization architecture passed: ${checks.length} checks.`)
