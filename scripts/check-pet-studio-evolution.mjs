/**
 * 文件职责 / File responsibility
 * 校验配方、场景、多物种、独立头身、真实表面采样、路径级局部编辑、完整动作与统一渲染能力持续存在。
 * Verifies recipes, scenes, multi-species support, independent head/body surfaces, real surface sampling, path-level local editing, complete motions, and unified rendering.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const appearance = read('apps/playground/app/domain/cloud-fox-appearance.ts')
const phase2 = read('apps/playground/app/domain/pet-studio-phase2.ts')
const domain = read('apps/playground/app/domain/pet-studio-phase3.ts')
const phase4 = read('apps/playground/app/domain/pet-studio-phase4.ts')
const registry = read('apps/playground/app/domain/pet-species-registry.ts')
const scene = read('apps/playground/app/domain/pet-scene.ts')
const profiles = read('apps/playground/app/domain/cloud-fox-shape-profile.ts')
const surface = read('apps/playground/app/domain/cloud-fox-surface-model.ts')
const eyeMetrics = read('apps/playground/app/domain/cloud-fox-eye-metrics.ts')
const limbMotion = read('apps/playground/app/domain/cloud-fox-limb-motion.ts')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const page = read('apps/playground/app/pages/studio.vue')
const presetsPage = read('apps/playground/app/pages/studio-presets.vue')
const scenePage = read('apps/playground/app/pages/studio-scenes.vue')
const speciesPage = read('apps/playground/app/pages/studio-species.vue')
const sceneComponent = read('apps/playground/app/components/studio/PetSceneEffects.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const moonCat = read('apps/playground/app/components/studio/MoonCat.vue')
const proceduralPet = read('apps/playground/app/components/studio/ProceduralPet.vue')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bodyShape = read('apps/playground/app/components/studio/ExtensionCloudFoxBodyShape.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headShape = read('apps/playground/app/components/studio/ExtensionCloudFoxHeadShape.vue')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const effects = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const wxt = read('apps/extension/wxt.config.ts')
const pawEditor = read('apps/playground/app/components/studio/StudioTailEditor.vue')
const patchDomain = read('apps/playground/app/domain/pet-appearance-patch.ts')
const patchTest = read('scripts/test-pet-studio-local-patches.ts')
const surfaceTest = read('scripts/test-cloud-fox-surface-model.ts')
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'") && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const expectations = [
  ['schema v2 and legacy migration', domain.includes('PET_STUDIO_SCHEMA_VERSION = 2') && domain.includes('normalizePetStudioAppearanceV2') && appearance.includes('normalizeCloudFoxAppearance')],
  ['independent body and head recipe choices', appearance.includes('headShape: CloudFoxHeadShape') && profiles.includes('getCloudFoxBodyProfile') && profiles.includes('getCloudFoxHeadProfile') && page.includes('切换身体不会修改这里的选择')],
  ['independent symbols and derived colors', domain.includes('chest: SymbolChannelRecipe') && domain.includes('back: SymbolChannelRecipe') && ['highlight','shade','halo'].every(key => domain.includes(key))],
  ['undo redo and geometry audit', store.includes('undoStack') && store.includes('redoStack') && page.includes('外观检查')],
  ['presets styles locks and user schemes', ['云灵经典','糯米可爱','霓虹机械','极光水晶','森林精灵','暗夜星云'].every(name => phase4.includes(name)) && presetsPage.includes('随机生成锁定') && store.includes('saveCustomScheme')],
  ['scene recipes effects and web contrast', scene.includes('interface PetSceneRecipe') && ['halo','particles','groundShadow'].every(name => sceneComponent.includes(name)) && scenePage.includes('跟随网页')],
  ['body head and tail all contribute to camera bounds', canvas.includes('calculatePetStudioVisualBounds') && canvas.includes('getCloudFoxBodyProfile') && canvas.includes('getCloudFoxHeadProfile')],
  ['species registry and active Moon Cat', registry.includes('PET_SPECIES_REGISTRY') && registry.includes("'moon-cat'") && moonCat.includes('foreheadMark') && moonCat.includes('whiskers')],
  ['planned species and motion fallback', registry.includes("'nebula-slime'") && registry.includes("'star-rabbit'") && registry.includes('resolveSpeciesBehavior') && speciesPage.includes('实际动作')],
  ['generic renderer dispatch remains', proceduralPet.includes('MoonCat') && proceduralPet.includes('ExtensionAlignedCloudFox') && !proceduralPet.includes('CustomizableCloudFox')],
  ['extension and Studio share the same composition', unifiedSource && core.includes('ExtensionCloudFoxBody')],
  ['sampled body and production head retain complete limbs and local face', body.includes('frontPawDesign') && body.includes('<ExtensionCloudFoxBodyShape') && bodyShape.includes('normalized unit envelope') && head.includes('<ExtensionCloudFoxHeadShape') && headShape.includes('scheme.model.head.scale') && surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('resolveCloudFoxEyeSurfaceAnchor') && belly.includes('createCloudFoxBellySurfaceMesh') && head.includes('getCloudFoxEyeBlinkFloor') && eye.includes('ExtrudeGeometry') && tail.includes('tipGlow.enabled')],
  ['surface geometry is numerically regression tested', surfaceTest.includes('maximumOffsetError') && surfaceTest.includes('eye separation remains visible') && surfaceTest.includes('spark eye is not allowed to collapse')],
  ['full action effects remain', effects.includes('thoughtBubbles') && effects.includes('starGroup') && effects.includes('cloud-nap') && effects.includes('sparkle-sneeze') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48') && headIntent.includes('createProductionFireworkBurstPlan') && limbMotion.includes('createCloudFoxFrontPawPose')],
  ['ear tail and front-paw local controls remain', phase2.includes('interface EarDesignRecipe') && phase2.includes('interface TailDesignRecipe') && registry.includes('FRONT_PAW_DESIGN_RANGES') && pawEditor.includes('连续前爪连接')],
  ['local patch isolation remains', patchDomain.includes('applyPetAppearanceLocalPatch') && patchDomain.includes('frontPawDesign') && patchTest.includes('assertOnlyChanged') && patchTest.includes("['tailDesign', 'customization.colors.tailGlow']") && patchTest.includes("['frontPawDesign']") && patchTest.includes("['customization.mouth']")],
]
const failures = expectations.filter(([, ok]) => !ok).map(([name]) => name)
if (failures.length) { console.error('Pet Studio evolution check failed:', failures.join(', ')); process.exit(1) }
console.log(`Pet Studio evolution contract passed: ${expectations.length} checks.`)
