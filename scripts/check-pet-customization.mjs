#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定独立头身、真实表面采样、逐顶点肚皮投影、可见眼睛、稳定相机、可滚动工作台和本地编辑语义。
 * Locks independent head/body recipes, real surface sampling, vertex-projected belly decals, visible eyes, stable camera, scrollable workspace, and local editing semantics.
 */
import { existsSync, readFileSync } from 'node:fs'
const url = path => new URL(`../${path}`, import.meta.url)
const read = path => readFileSync(url(path), 'utf8')
const appearance = read('apps/playground/app/domain/cloud-fox-appearance.ts')
const customization = read('apps/playground/app/domain/pet-part-customization.ts')
const profiles = read('apps/playground/app/domain/cloud-fox-shape-profile.ts')
const surface = read('apps/playground/app/domain/cloud-fox-surface-model.ts')
const eyeMetrics = read('apps/playground/app/domain/cloud-fox-eye-metrics.ts')
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
  ['body and head are independent recipe channels', appearance.includes('CLOUD_FOX_HEAD_SHAPES') && appearance.includes('headShape: CloudFoxHeadShape') && appearance.includes("headShape: 'classic-round'") && studio.includes("setPart('headShape'") && studio.includes("setPart('bodyShape'")],
  ['legacy recipes migrate to the classic head without body coupling', appearance.includes('normalizePart(parts.headShape, optionIds.headShapes, fallback.parts.headShape)') && !profiles.includes('headShape:') && profiles.includes('getCloudFoxBodyProfile') && profiles.includes('getCloudFoxHeadProfile')],
  ['all body and head options have explicit profiles', bodyIds.every(id => profiles.includes(`id: '${id}'`)) && headIds.every(id => profiles.includes(`id: '${id}'`))],
  ['one normalized torso surface owns the production body', body.includes('<ExtensionCloudFoxBodyShape') && bodyShape.includes('normalized unit envelope') && bodyShape.includes('RoundedBoxGeometry(2, 2, 2') && !belly.includes('ExtensionCloudFoxBodyShape') && !bodyShape.includes('geometryCompensation')],
  ['one production-proportioned head owns one FaceRoot', head.includes('<ExtensionCloudFoxHeadShape') && head.includes('<ExtensionCloudFoxFaceCustomization') && headShape.includes('scheme.model.head.scale') && headShape.includes('RoundedBoxGeometry(2, 2, 2') && !face.includes('ref="head"')],
  ['surface model samples all body and head geometries', bodyIds.every(id => surface.includes(`shape === '${id}'`) || id === 'sphere' || id === 'ellipsoid') && headIds.every(id => surface.includes(`shape === '${id}'`) || id === 'classic-round' || id === 'wide-round' || id === 'oval') && surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('sampleCloudFoxHeadFrontSurfaceAtLocalXY')],
  ['belly vertices project onto the sampled body surface', bellyIds.every(id => customization.includes(`id: '${id}'`)) && belly.includes('createCloudFoxBellySurfaceMesh') && belly.includes("setAttribute('normal'") && belly.includes(':depth-write="true"') && !belly.includes('PlaneGeometry') && !belly.includes('createCurvedSurface') && bellyEditor.includes('恢复椭圆默认')],
  ['eyes use sampled head anchors and shared visibility floors', head.includes('resolveCloudFoxEyeSurfaceAnchor') && head.includes('getCloudFoxEyeBlinkFloor') && head.includes(':rotation="eyeRotation(side)"') && eyeMetrics.includes('blinkFloor') && eyeMetrics.includes("spark: Object.freeze({ width: .42")],
  ['spark eye is a real star solid with contrast outline', eye.includes('ExtrudeGeometry') && eye.includes('createStarGeometry') && eye.includes('sparkOutlineGeometry') && eye.includes('contrastColor') && !eye.includes("style === 'spark'\">\n      <TresMesh :scale")],
  ['crystal and sleepy eyes remain separately visible', eye.includes("style === 'diamond'") && eye.includes('TresOctahedronGeometry') && eye.includes("style === 'sleepy'") && eye.includes('TresTubeGeometry') && !eye.includes("['spark', 'diamond'].includes")],
  ['classic mouth and thin alternate mouths remain', face.includes("appearance.parts.mouth === 'smile'") && face.includes('scheme.model.head.mouthScale') && face.includes('scheme.model.head.tongueScale') && face.includes('CatmullRomCurve3') && face.includes('TresTubeGeometry')],
  ['numeric surface regression test is part of CI', packageJson.includes('test:cloud-fox-surface') && packageJson.includes('scripts/test-cloud-fox-surface-model.ts') && read('scripts/test-cloud-fox-surface-model.ts').includes('maximumOffsetError')],
  ['camera scale is independent of active editor section', canvas.includes('fitRatio') && canvas.includes('cameraFactor') && !canvas.includes('focusZoom') && !canvas.includes('focusLift')],
  ['Studio document and nested panels remain vertically scrollable', app.includes('overflow-y:auto!important') && app.includes('height:auto!important') && app.includes('margin:0 auto!important') && app.includes('scrollbar-gutter:stable') && studio.includes('.controls{display:flex;min-height:0')],
  ['Studio has opt-in hotspots without sticky vertical centering', studio.includes('v-if="showHotspots"') && !studio.includes('position:sticky') && app.includes('.studio-workspace')],
  ['Studio suppresses the extension overlay while authoring', studio.includes("class: 'yk-pets-studio-page'") && app.includes('body.yk-pets-studio-page [data-nova-extension-root="overlay"]')],
  ['advanced features are native Vue and local-only', !oldAdvancedPlugin && studio.includes('compareSnapshot') && studio.includes('saveCustomScheme') && studio.includes('undoStack.length') && !studio.includes('setInterval(') && !store.includes('fetch(')],
  ['all material channels and expanded ranges remain', colorKeys.every(key => customization.includes(`${key}: string`)) && colors.includes('所有部位颜色') && customization.includes('bodyWidth: [.55, 1.7]') && customization.includes('headScale: [.68, 1.48]')],
  ['Studio and extension share every geometry domain', configured.includes('normalizeCustomizableAppearance') && customizationBridge.includes('pet-part-customization') && shapeBridge.includes('cloud-fox-shape-profile') && surfaceBridge.includes('cloud-fox-surface-model') && eyeMetricsBridge.includes('cloud-fox-eye-metrics')],
  ['extension permissions remain unchanged', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && !manifest.includes("'unlimitedStorage'")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('pet customization architecture check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`pet customization architecture passed: ${checks.length} checks.`)
