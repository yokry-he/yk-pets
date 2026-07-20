import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('apps/playground/app/domain/pet-studio-phase3.ts')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const renderer = read('apps/playground/app/components/studio/CustomizableCloudFox.vue')
const page = read('apps/playground/app/pages/studio.vue')
const phase4 = read('apps/playground/app/domain/pet-studio-phase4.ts')
const presetsPage = read('apps/playground/app/pages/studio-presets.vue')
const scene = read('apps/playground/app/domain/pet-scene.ts')
const sceneComponent = read('apps/playground/app/components/studio/PetSceneEffects.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const scenePage = read('apps/playground/app/pages/studio-scenes.vue')
const registry = read('apps/playground/app/domain/pet-species-registry.ts')
const moonCat = read('apps/playground/app/components/studio/MoonCat.vue')
const proceduralPet = read('apps/playground/app/components/studio/ProceduralPet.vue')
const speciesPage = read('apps/playground/app/pages/studio-species.vue')
const expectations = [
  ['schema v2', domain.includes('PET_STUDIO_SCHEMA_VERSION = 2')],
  ['legacy migration', domain.includes('legacySymbols') && domain.includes('normalizePetStudioAppearanceV2')],
  ['independent chest and back channels', domain.includes('chest: SymbolChannelRecipe') && domain.includes('back: SymbolChannelRecipe')],
  ['derived highlight shade halo', domain.includes('highlight') && domain.includes('shade') && domain.includes('halo')],
  ['undo redo', store.includes('undoStack') && store.includes('redoStack') && page.includes('撤销') && page.includes('重做')],
  ['geometry audit', domain.includes('auditPetStudioAppearance') && page.includes('自动边界和穿模检查')],
  ['visible symbol glow', renderer.includes('glowIntensity*.55') && renderer.includes('TresPointLight')],
  ['six built-in presets', ['云灵经典','糯米可爱','霓虹机械','极光水晶','森林精灵','暗夜星云'].every(name => phase4.includes(name))],
  ['four style rules', ['cute','mechanical','nebula','crystal'].every(name => phase4.includes(`${name}: recipe`))],
  ['scoped application', phase4.includes("AppearanceApplyScope = 'all' | 'shape' | 'proportions' | 'colors' | 'glow'")],
  ['locked random generation', phase4.includes('randomizeWithLocks') && presetsPage.includes('随机生成锁定')],
  ['user schemes', presetsPage.includes('我的方案') && store.includes('saveCustomScheme')],
  ['scene recipe', scene.includes('interface PetSceneRecipe')],
  ['four scene presets', ['极光云境','深空星云','霓虹机库','完全透明'].every(name => scene.includes(name))],
  ['halo particles ground shadow', ['halo','particles','groundShadow'].every(name => sceneComponent.includes(name))],
  ['automatic web contrast', scene.includes('resolveSceneContrast') && scenePage.includes('跟随网页')],
  ['action linked scene', scene.includes('sceneActionMultiplier') && sceneComponent.includes('behavior')],
  ['scene excluded from camera bounds', canvas.includes('Only pet bounds are used for camera fitting')],
  ['species registry', registry.includes('PET_SPECIES_REGISTRY')],
  ['Moon Cat active', registry.includes("'moon-cat':") && registry.includes("status: 'active'") && moonCat.includes('foreheadMark') && moonCat.includes('whiskers')],
  ['planned slime and rabbit', registry.includes("'nebula-slime'") && registry.includes("'star-rabbit'") && registry.match(/status: 'planned'/g)?.length === 2],
  ['species slot differences', registry.includes("'whiskers','forehead-mark'") && registry.includes("'antenna','tail'")],
  ['cross species style mapping', registry.includes('applyStyleAcrossSpecies') && ['cute','mechanical','nebula','crystal'].every(style => registry.includes(`style === '${style}'`))],
  ['motion fallback', registry.includes('resolveSpeciesBehavior') && speciesPage.includes('实际动作')],
  ['generic renderer dispatch', proceduralPet.includes('MoonCat') && proceduralPet.includes('CustomizableCloudFox')],
  ['no Moon Cat logic in Cloud Fox renderer', !renderer.includes('moon-cat') && !renderer.includes('whiskers')],
]
const failures = expectations.filter(([, ok]) => !ok).map(([name]) => name)
if (failures.length) { console.error('Pet Studio evolution check failed:', failures.join(', ')); process.exit(1) }
console.log(`Pet Studio evolution contract passed: ${expectations.length} checks.`)
