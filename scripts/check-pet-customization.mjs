#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定独立头身、统一控制注册表、经典前爪挂点、真实表面肚皮、口鼻表面嘴型、可见眼睛、稳定工作台和本地编辑语义。
 * Locks independent head/body recipes, the unified control registry, classic paw anchors, real-surface belly and mouth geometry, visible eyes, stable workspace, and local editing semantics.
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
const surfaceBridge = read('apps/extension/domain/cloud-fox-surface-model.ts')
const eyeMetricsBridge = read('apps/extension/domain/cloud-fox-eye-metrics.ts')
const packageJson = read('package.json')
const manifest = read('apps/extension/wxt.config.ts')
const oldAdvancedPlugin = existsSync(url('apps/playground/app/plugins/studio-advanced.client.ts'))

const bodyIds = ['sphere','ellipsoid','capsule','pear','bean','rounded-cube']
const headIds = ['classic-round','wide-round','oval','capsule','bean','rounded-cube']
const bellyIds = ['ellipse','egg','shield','teardrop','inverted-teardrop','bean','rounded-rectangle','heart','cloud','chest-fur']
const colorKeys = ['body','limbs','paws','muzzle','nose','mouth','tongue','cheeks','eyes','eyeHighlight','earOuter','earInner','earTip','antennaRod','antennaTip','belly','tailGlow','energyCore']
const checks = [
  ['body and head are independent recipe channels', appearance.includes('CLOUD_FOX_HEAD_SHAPES') && appearance.includes('headShape: CloudFoxHeadShape') && studio.includes("setPart('headShape'") && studio.includes("setPart('bodyShape'")],
  ['legacy recipes migrate without body/head coupling', appearance.includes('normalizePart(parts.headShape, optionIds.headShapes, fallback.parts.headShape)') && !profiles.includes('headShape:')],
  ['all body and head options have explicit profiles', bodyIds.every(id => profiles.includes(`id: '${id}'`)) && headIds.every(id => profiles.includes(`id: '${id}'`))],
  ['one normalized torso surface owns the body', body.includes('<ExtensionCloudFoxBodyShape') && bodyShape.includes('normalized unit envelope') && !belly.includes('ExtensionCloudFoxBodyShape')],
  ['one production-proportioned head owns one FaceRoot', head.includes('<ExtensionCloudFoxHeadShape') && head.includes('<ExtensionCloudFoxFaceCustomization') && headShape.includes('scheme.model.head.scale') && !face.includes('ref="head"')],
  ['surface model samples bodies heads eyes and muzzle', surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('sampleCloudFoxHeadFrontSurfaceAtLocalXY') && surface.includes('resolveCloudFoxEyeSurfaceAnchor') && surface.includes('resolveCloudFoxMuzzleSurfaceAnchor')],
  ['belly projects with front-facing winding', bellyIds.every(id => customization.includes(`id: '${id}'`)) && belly.includes('createCloudFoxBellySurfaceMesh') && surface.includes('indices.push(topLeft, topRight, bottomLeft') && belly.includes(':depth-write="true"') && !belly.includes('PlaneGeometry') && bellyEditor.includes('恢复椭圆默认')],
  ['eyes use sampled anchors and visibility floors', head.includes('resolveCloudFoxEyeSurfaceAnchor') && head.includes('getCloudFoxEyeBlinkFloor') && eyeMetrics.includes('blinkFloor') && eye.includes('ExtrudeGeometry') && eye.includes('TresOctahedronGeometry')],
  ['mouths share muzzle surface and style-specific shallow geometry', face.includes('resolveCloudFoxMuzzleSurfaceAnchor') && face.includes("appearance.parts.mouth === 'smile'") && face.includes("appearance.parts.mouth === 'open'") && face.includes('TresCircleGeometry') && face.includes('TresTubeGeometry') && face.includes('animatedOpen') && !face.includes('mouth.value.scale.y')],
  ['classic defaults restore ellipse belly and production paw anchor', defaults.includes("style: 'oval'") && defaults.includes('embedDepth: .06') && defaults.includes('forwardOffset: .06') && body.includes('classicPawX') && body.includes('scheme.model.frontPaw.offset')],
  ['one control registry owns hard and recommended ranges', controls.includes('STUDIO_CONTROL_REGISTRY') && controls.includes('recommendedRange') && controls.includes('hardRange') && customization.includes("hard('proportions.bodyWidth')") && customization.includes("hard('frontPawDesign.rootHeight')")],
  ['numeric surface regression test remains in CI', packageJson.includes('test:cloud-fox-surface') && read('scripts/test-cloud-fox-surface-model.ts').includes('maximumOffsetError')],
  ['camera scale is independent of editor section', canvas.includes('fitRatio') && canvas.includes('cameraFactor') && !canvas.includes('focusZoom')],
  ['Studio remains scrollable and overlay-free', app.includes('overflow-y:auto!important') && app.includes('scrollbar-gutter:stable') && studio.includes("class: 'yk-pets-studio-page'") && app.includes('body.yk-pets-studio-page [data-nova-extension-root="overlay"]')],
  ['advanced features remain native and local-only', !oldAdvancedPlugin && studio.includes('compareSnapshot') && studio.includes('saveCustomScheme') && !store.includes('fetch(')],
  ['all material channels remain configurable', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('所有部位颜色')],
  ['Studio and extension share geometry domains', configured.includes('normalizeCustomizableAppearance') && customizationBridge.includes('pet-part-customization') && shapeBridge.includes('cloud-fox-shape-profile') && surfaceBridge.includes('cloud-fox-surface-model') && eyeMetricsBridge.includes('cloud-fox-eye-metrics')],
  ['extension permissions remain unchanged', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && !manifest.includes("'unlimitedStorage'")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) { console.error('pet customization architecture check failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1) }
console.log(`pet customization architecture passed: ${checks.length} checks.`)
