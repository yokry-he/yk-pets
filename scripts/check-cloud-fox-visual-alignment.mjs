/**
 * 文件职责 / File responsibility
 * 锁定扩展与 Studio 共用模型的经典参数、单位头身几何、真实表面挂点、完整部件栈、相机灯光和无损视觉质量。
 * Locks classic parameters, normalized head/body geometry, real surface anchors, the complete part stack, cameras, lighting, and lossless quality shared by extension and Studio.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const profile = read('apps/playground/app/domain/chrome-extension-cloud-fox-profile.ts')
const shapeProfiles = read('apps/playground/app/domain/cloud-fox-shape-profile.ts')
const surface = read('apps/playground/app/domain/cloud-fox-surface-model.ts')
const eyeMetrics = read('apps/playground/app/domain/cloud-fox-eye-metrics.ts')
const limbMotion = read('apps/playground/app/domain/cloud-fox-limb-motion.ts')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bodyShape = read('apps/playground/app/components/studio/ExtensionCloudFoxBodyShape.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headShape = read('apps/playground/app/components/studio/ExtensionCloudFoxHeadShape.vue')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const production = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const wxt = read('apps/extension/wxt.config.ts')
const studioCanvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const phase2 = read('apps/playground/app/domain/pet-studio-phase2.ts')
const registry = read('apps/playground/app/domain/pet-species-registry.ts')
const patchDomain = read('apps/playground/app/domain/pet-appearance-patch.ts')
const surfaceTest = read('scripts/test-cloud-fox-surface-model.ts')
const studioUi = [read('apps/playground/app/pages/studio.vue'), read('apps/playground/app/components/studio/StudioTailEditor.vue'), read('apps/playground/app/components/studio/StudioEarEditor.vue')].join('\n')
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'") && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const exactTokens = ['0.94, 1.12, 0.82','0, -0.32, 0','0, 0.92, 0.06','1.02, 0.88, 0.9','0.31, 0.08, 0.77','0.56, 0.65, -0.04','0.5, -0.04, 0.82','0.48, -1.08, 0.22','-0.58, -0.48, -0.34']
const checks = [
  ['production model profile retains exact values', exactTokens.every(token => profile.includes(token))],
  ['extension uses the exact Studio composition component', unifiedSource && core.includes('EXTENSION_CLASSIC_CLOUD_FOX_SCHEME')],
  ['complete normalized torso production head and continuous tail remain', headIntent.includes('ExtensionCloudFoxHead') && body.includes('<ExtensionCloudFoxBodyShape') && body.includes('frontPawDesign') && bodyShape.includes('normalized unit envelope') && bodyShape.includes('RoundedBoxGeometry(2, 2, 2') && head.includes('<ExtensionCloudFoxHeadShape') && headShape.includes('scheme.model.head.scale') && headShape.includes('RoundedBoxGeometry(2, 2, 2') && tail.includes('TresTubeGeometry') && tail.includes('tipGlow.enabled')],
  ['body and head profiles are independent but share one sampled coordinate system', shapeProfiles.includes('CloudFoxBodyProfile') && shapeProfiles.includes('CloudFoxHeadProfile') && surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('sampleCloudFoxHeadFrontSurfaceAtLocalXY') && head.includes('resolveCloudFoxEyeSurfaceAnchor') && belly.includes('createCloudFoxBellySurfaceMesh')],
  ['eye dimensions and blink floors preserve visible styles', eyeMetrics.includes("spark: Object.freeze({ width: .42") && eyeMetrics.includes('blinkFloor: .42') && head.includes('getCloudFoxEyeBlinkFloor') && eye.includes('ExtrudeGeometry') && eye.includes('sparkOutlineGeometry')],
  ['surface alignment is numerically tested across bodies and heads', surfaceTest.includes('maximumOffsetError') && surfaceTest.includes('eye separation remains visible') && surfaceTest.includes('CLOUD_FOX_BODY_SHAPES') && surfaceTest.includes('CLOUD_FOX_HEAD_SHAPES')],
  ['complete limb motion remains separated from body geometry', limbMotion.includes('createCloudFoxFrontPawPose') && limbMotion.includes('createCloudFoxHindPawPose') && body.includes('createCloudFoxFrontPawPose')],
  ['production camera values remain exact', production.includes('vec3(0, 0.42, 8.8)') && production.includes('vec3(0, 0.08, 9.7)') && production.includes('vec3(0, 0.72, 10.8)')],
  ['production light values remain exact', production.includes(':intensity="1.35"') && production.includes(':intensity="3.8"') && production.includes('secretMode ? 7 : 3.6') && production.includes('secretMode ? 6 : 2.8')],
  ['production visual quality remains fixed', production.includes("props.compact ? [.75, 1] : [.9, 1.25]") && production.includes('props.compact ? 30 : 40') && production.includes('filter:blur(16px)')],
  ['Studio camera and lights retain the same production scheme', studioCanvas.includes('scheme.scene.camera.normalPosition') && studioCanvas.includes('scheme.scene.lights.directionalIntensity') && studioCanvas.includes('getCloudFoxHeadProfile')],
  ['Studio starts from extension classic defaults', store.includes('createExtensionClassicAppearance()') && store.includes('createExtensionClassicScene()')],
  ['tail ear and paw recipe channels remain editable', phase2.includes('TailTipGlowRecipe') && phase2.includes('EarDesignRecipe') && registry.includes('FRONT_PAW_STYLES') && patchDomain.includes('frontPawDesign?:') && studioUi.includes('尾巴尖发光') && studioUi.includes('耳尖颜色')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Chrome extension / Studio visual alignment check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Chrome extension / Studio visual alignment passed: ${checks.length} checks.`)
