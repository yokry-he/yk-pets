import { readFileSync } from 'node:fs'
const phaseArg = process.argv.find(argument => argument.startsWith('--phase='))
const requestedPhase = phaseArg ? Number(phaseArg.split('=')[1]) : 6
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const files = {
  package: read('package.json'),
  base: read('apps/playground/app/domain/cloud-fox-appearance.ts'),
  phase2: read('apps/playground/app/domain/pet-studio-phase2.ts'),
  phase3: read('apps/playground/app/domain/pet-studio-phase3.ts'),
  phase4: read('apps/playground/app/domain/pet-studio-phase4.ts'),
  scene: read('apps/playground/app/domain/pet-scene.ts'),
  registry: read('apps/playground/app/domain/pet-species-registry.ts'),
  store: read('apps/playground/app/stores/pet-appearance.ts'),
  cloudRenderer: read('apps/playground/app/components/studio/CustomizableCloudFox.vue'),
  moonCat: read('apps/playground/app/components/studio/MoonCat.vue'),
  proceduralPet: read('apps/playground/app/components/studio/ProceduralPet.vue'),
  canvas: read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue'),
  sceneEffects: read('apps/playground/app/components/studio/PetSceneEffects.vue'),
  page: read('apps/playground/app/pages/studio.vue'),
  presetsPage: read('apps/playground/app/pages/studio-presets.vue'),
  scenePage: read('apps/playground/app/pages/studio-scenes.vue'),
  speciesPage: read('apps/playground/app/pages/studio-species.vue'),
  app: read('apps/playground/app/app.vue'),
}
const domain12 = files.base + files.phase2
const checks = [
  [1, 'automatic camera fitting', files.base.includes('calculatePetVisualBounds') && files.canvas.includes('cameraDistance')],
  [1, 'independent body dimensions', ['bodyWidth', 'bodyHeight', 'bodyDepth'].every(key => files.base.includes(`${key}: number`))],
  [1, 'six body shapes', ['sphere', 'ellipsoid', 'capsule', 'pear', 'bean', 'rounded-cube'].every(shape => files.base.includes(`'${shape}'`))],
  [1, 'relative mount points', files.base.includes('RelativeMountPoint') && files.cloudRenderer.includes('resolveRelativeMountPoint')],
  [1, 'short rounded limbs', files.base.includes('limbLength: [0.56, 1.08]') && files.cloudRenderer.includes('v-for="side in [-1,1]"')],
  [1, 'head attached antennae', files.cloudRenderer.includes('appearance.parts.antenna')],
  [2, 'extended head part library', domain12.includes("'floppy'") && domain12.includes("'sleepy'")],
  [2, 'composable antenna', files.phase2.includes('antennaRod') && files.phase2.includes('antennaTip')],
  [2, 'eight segment tail', files.phase2.includes('MAX_TAIL_SEGMENTS = 8') && files.cloudRenderer.includes('tailSegmentTransforms')],
  [2, 'additive motion offsets', files.cloudRenderer.includes('tailBaseRotation') && files.cloudRenderer.includes('motionOffset')],
  [3, 'appearance schema v2', files.phase3.includes('PET_STUDIO_SCHEMA_VERSION = 2')],
  [3, 'independent symbol controls', files.phase3.includes('chest: SymbolChannelRecipe') && files.phase3.includes('back: SymbolChannelRecipe')],
  [3, 'derived color channels', files.phase3.includes('deriveAppearanceColors') && ['highlight', 'shade', 'halo'].every(key => files.phase3.includes(key))],
  [3, 'undo redo', files.store.includes('undo()') && files.store.includes('redo()')],
  [3, 'boundary and collision inspection', files.phase3.includes('auditPetStudioAppearance') && files.page.includes('自动边界和穿模检查')],
  [4, 'six built in presets', ['云灵经典','糯米可爱','霓虹机械','极光水晶','森林精灵','暗夜星云'].every(name => files.phase4.includes(name))],
  [4, 'style rules and partial apply', files.phase4.includes('PET_STYLE_RULES') && files.phase4.includes('applyAppearanceScope')],
  [4, 'locked randomization', files.phase4.includes('AppearanceLocks') && files.store.includes('locks')],
  [4, 'user schemes', files.store.includes('customSchemes') && files.store.includes('saveCustomScheme')],
  [5, 'scene recipe and presets', files.scene.includes('PetSceneRecipe') && files.scene.includes('PET_SCENE_PRESETS')],
  [5, 'scene effects', files.sceneEffects.includes('scene.halo') && files.sceneEffects.includes('scene.particles') && files.sceneEffects.includes('scene.groundShadow')],
  [5, 'automatic contrast', files.scene.includes('resolveSceneContrast') && files.scenePage.includes('跟随网页')],
  [5, 'scene excluded from bounds', files.canvas.includes('Only petBounds is used for camera fitting')],
  [6, 'species registry', files.registry.includes('PET_SPECIES_REGISTRY')],
  [6, 'moon cat implementation', files.registry.includes("'moon-cat'") && files.moonCat.includes('foreheadMark') && files.moonCat.includes('whiskers')],
  [6, 'reserved slime and rabbit', files.registry.includes("'nebula-slime'") && files.registry.includes("'star-rabbit'")],
  [6, 'cross species style mapping', files.registry.includes('applyStyleAcrossSpecies')],
  [6, 'motion fallback', files.registry.includes('resolveSpeciesBehavior') && files.speciesPage.includes('实际动作')],
  [6, 'generic renderer', files.proceduralPet.includes('MoonCat') && files.proceduralPet.includes('CustomizableCloudFox') && !files.cloudRenderer.includes('moon-cat')],
  [6, 'global studio navigation', files.app.includes('/studio-species')],
  [6, 'package scripts', files.package.includes('check:cloud-fox-studio') && files.package.includes('check:pet-studio-evolution')],
]
const activeChecks = checks.filter(([phase]) => phase <= requestedPhase)
const failures = activeChecks.filter(([, , passed]) => !passed).map(([, name]) => name)
if (failures.length) {
  console.error(`宠物工坊 Phase ${requestedPhase} 契约检查失败 / Pet Studio contract check failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`宠物工坊 Phase ${requestedPhase} 契约检查通过，共 ${activeChecks.length} 项。`)
