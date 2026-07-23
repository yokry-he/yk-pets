/**
 * 文件职责 / File responsibility
 * 按阶段校验云狐工坊的配方、场景、物种、编辑器、统一模型、完整动作和扩展同步契约。
 * Validates Cloud Fox Studio recipe, scene, species, editor, unified-model, complete-motion, and extension-sync contracts by phase.
 */
import { readFileSync } from 'node:fs'
const phaseArg = process.argv.find(argument => argument.startsWith('--phase='))
const requestedPhase = phaseArg ? Number(phaseArg.split('=')[1]) : 13
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const files = {
  package: read('package.json'),
  base: read('apps/playground/app/domain/cloud-fox-appearance.ts'),
  phase2: read('apps/playground/app/domain/pet-studio-phase2.ts'),
  phase3: read('apps/playground/app/domain/pet-studio-phase3.ts'),
  phase4: read('apps/playground/app/domain/pet-studio-phase4.ts'),
  scene: read('apps/playground/app/domain/pet-scene.ts'),
  registry: read('apps/playground/app/domain/pet-species-registry.ts'),
  profile: read('apps/playground/app/domain/chrome-extension-cloud-fox-profile.ts'),
  motionCatalog: read('apps/playground/app/domain/chrome-extension-cloud-fox-motions.ts'),
  motionRuntime: read('apps/playground/app/domain/chrome-extension-cloud-fox-motion-runtime.ts'),
  store: read('apps/playground/app/stores/pet-appearance.ts'),
  page: read('apps/playground/app/pages/studio.vue'),
  presets: read('apps/playground/app/pages/studio-presets.vue'),
  scenes: read('apps/playground/app/pages/studio-scenes.vue'),
  species: read('apps/playground/app/pages/studio-species.vue'),
  procedural: read('apps/playground/app/components/studio/ProceduralPet.vue'),
  canvas: read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue'),
  core: read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue'),
  body: read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue'),
  head: read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue'),
  tail: read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue'),
  effects: read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue'),
  fireworks: read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue'),
  fireworksDomain: read('apps/playground/app/domain/production-cloud-fox-fireworks.ts'),
  headIntent: read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue'),
  configured: read('apps/extension/components/avatar/ConfiguredCloudFox.vue'),
  wxt: read('apps/extension/wxt.config.ts'),
  patchDomain: read('apps/playground/app/domain/pet-appearance-patch.ts'),
  patchTest: read('scripts/test-pet-studio-local-patches.ts'),
  toolbar: read('apps/playground/app/components/studio/StudioMotionToolbar.vue'),
  tailEditor: read('apps/playground/app/components/studio/StudioTailEditor.vue'),
  symbolEditor: read('apps/playground/app/components/studio/StudioSymbolEditor.vue'),
  bellyEditor: read('apps/playground/app/components/studio/StudioBellyPatchEditor.vue'),
}
const unifiedSource = files.configured.includes("from 'yk-pets-unified-cloud-fox'")
  && files.wxt.includes("../playground/app/components/studio/ExtensionAlignedCloudFox.vue")
const checks = [
  [1, 'automatic camera fitting and independent body dimensions', files.base.includes('calculatePetVisualBounds') && files.canvas.includes('cameraFactor') && ['bodyWidth','bodyHeight','bodyDepth'].every(key => files.base.includes(`${key}: number`))],
  [2, 'extended parts antennae and segmented tail', files.phase2.includes("'floppy'") && files.phase2.includes('antennaRod') && files.phase2.includes('MAX_TAIL_SEGMENTS = 8')],
  [3, 'schema v2 symbols colors undo and geometry audit', files.phase3.includes('PET_STUDIO_SCHEMA_VERSION = 2') && files.phase3.includes('chest: SymbolChannelRecipe') && files.store.includes('undo()') && files.page.includes('自动边界和穿模检查')],
  [4, 'presets styles locks and user schemes', ['云灵经典','糯米可爱','霓虹机械','极光水晶','森林精灵','暗夜星云'].every(name => files.phase4.includes(name)) && files.phase4.includes('AppearanceLocks') && files.store.includes('saveCustomScheme')],
  [5, 'scene recipes effects and web contrast', files.scene.includes('PetSceneRecipe') && files.scenes.includes('跟随网页') && files.canvas.includes('sceneStyle')],
  [6, 'species registry and generic dispatch', files.registry.includes('PET_SPECIES_REGISTRY') && files.registry.includes("'moon-cat'") && files.procedural.includes('ExtensionAlignedCloudFox')],
  [7, 'exact extension production profile remains', files.profile.includes('chrome-extension-production') && files.profile.includes('0.94, 1.12, 0.82') && files.profile.includes('normalPosition: [0, 0.42, 8.8]')],
  [8, 'local tail ear and patch controls remain', files.phase2.includes('rootExtensionLength') && files.phase2.includes('TailTipGlowRecipe') && files.phase2.includes('EarDesignRecipe') && files.patchDomain.includes('applyPetAppearanceLocalPatch')],
  [9, 'configurable continuous front paws and isolation tests', files.registry.includes('FRONT_PAW_STYLES') && files.registry.includes('FRONT_PAW_DESIGN_RANGES') && files.body.includes('pawSurfaceDepth') && files.tailEditor.includes('连续前爪连接') && files.patchTest.includes('nonPawSnapshot')],
  [10, 'thirty-motion registry and shared frame remain', files.motionCatalog.includes('EXTENSION_CLOUD_FOX_MOTIONS') && files.motionRuntime.includes('createExtensionCloudFoxMotionFrame') && files.core.includes('createExtensionCloudFoxMotionFrame') && files.toolbar.includes('<optgroup') && files.page.includes('motionKey.value += 1')],
  [11, 'complete prop effects and extension fireworks remain', files.core.includes('ExtensionCloudFoxEnergyBall') && files.core.includes('ExtensionCloudFoxMealOverlay') && files.effects.includes('starGroup') && files.effects.includes('cloud-nap') && files.fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48')],
  [12, 'Studio and extension use the same canonical composition source', unifiedSource && files.core.includes('ProductionCloudFoxFireworks') && files.headIntent.includes('createProductionFireworkBurstPlan')],
  [13, 'belly chest symbols and all major recipe channels remain configurable', ['oval','shield','bean','teardrop','heart'].every(style => files.registry.includes(`id: '${style}'`)) && files.bellyEditor.includes('宽度') && files.symbolEditor.includes('显示模式') && files.head.includes('earDesign.innerColor') && files.tail.includes('tipGlow.enabled')],
]
const activeChecks = checks.filter(([phase]) => phase <= requestedPhase)
const failures = activeChecks.filter(([, , passed]) => !passed).map(([, name]) => name)
if (failures.length) {
  console.error(`宠物工坊 Phase ${requestedPhase} 契约检查失败 / Pet Studio contract check failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`宠物工坊 Phase ${requestedPhase} 契约检查通过，共 ${activeChecks.length} 项。`)
