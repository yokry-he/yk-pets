import { readFileSync } from 'node:fs'
const phaseArg = process.argv.find(argument => argument.startsWith('--phase='))
const requestedPhase = phaseArg ? Number(phaseArg.split('=')[1]) : 6
const files = {
  package: readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  domain: readFileSync(new URL('../apps/playground/app/domain/cloud-fox-appearance.ts', import.meta.url), 'utf8'),
  store: readFileSync(new URL('../apps/playground/app/stores/pet-appearance.ts', import.meta.url), 'utf8'),
  renderer: readFileSync(new URL('../apps/playground/app/components/studio/CustomizableCloudFox.vue', import.meta.url), 'utf8'),
  canvas: readFileSync(new URL('../apps/playground/app/components/studio/CloudFoxStudioCanvas.vue', import.meta.url), 'utf8'),
  page: readFileSync(new URL('../apps/playground/app/pages/studio.vue', import.meta.url), 'utf8'),
  app: readFileSync(new URL('../apps/playground/app/app.vue', import.meta.url), 'utf8'),
  docsZh: readFileSync(new URL('../docs/zh-CN/CLOUD-FOX-STUDIO.md', import.meta.url), 'utf8'),
  docsEn: readFileSync(new URL('../docs/en/CLOUD-FOX-STUDIO.md', import.meta.url), 'utf8'),
}
const checks = [
  [1, 'automatic camera fitting', files.domain.includes('calculatePetVisualBounds') && files.canvas.includes('cameraDistance')],
  [1, 'independent body dimensions', ['bodyWidth', 'bodyHeight', 'bodyDepth'].every(key => files.domain.includes(`${key}: number`))],
  [1, 'six body shapes', ['sphere', 'ellipsoid', 'capsule', 'pear', 'bean', 'rounded-cube'].every(shape => files.domain.includes(`'${shape}'`))],
  [1, 'relative mount points', files.domain.includes('RelativeMountPoint') && files.renderer.includes('resolveRelativeMountPoint')],
  [1, 'short rounded limbs', files.domain.includes('limbLength: [0.56, 1.08]') && files.renderer.includes('Short rounded front limbs')],
  [1, 'head attached antennae', files.renderer.includes('Antennae are children of the head group')],
  [2, 'extended head part library', files.domain.includes("id: 'floppy'") && files.domain.includes("id: 'sleepy'")],
  [2, 'composable antenna', files.domain.includes('antennaRod') && files.domain.includes('antennaTip')],
  [2, 'eight segment tail', files.domain.includes('MAX_TAIL_SEGMENTS = 8') && files.renderer.includes('tailSegmentTransforms')],
  [2, 'additive motion offsets', files.renderer.includes('tailBaseRotation') && files.renderer.includes('motionOffset')],
  [3, 'appearance schema v2', files.domain.includes('CLOUD_FOX_APPEARANCE_SCHEMA_VERSION = 2')],
  [3, 'independent symbol controls', files.domain.includes('chest: PetSymbolChannelRecipe') && files.domain.includes('back: PetSymbolChannelRecipe')],
  [3, 'derived color channels', files.domain.includes('derivePaletteChannels')],
  [3, 'undo redo', files.store.includes('undo()') && files.store.includes('redo()')],
  [3, 'boundary and collision inspection', files.domain.includes('inspectPetAppearance') && files.page.includes('外观检查')],
  [4, 'six built in presets', ['cloud-classic', 'mochi-cute', 'neon-mecha', 'aurora-crystal', 'forest-spirit', 'night-nebula'].every(id => files.domain.includes(`'${id}'`))],
  [4, 'style rules and partial apply', files.domain.includes('PET_STYLE_RULES') && files.domain.includes('applyAppearancePreset')],
  [4, 'locked randomization', files.domain.includes('RandomLockRecipe') && files.store.includes('randomLocks')],
  [4, 'user schemes', files.store.includes('userSchemes') && files.store.includes('saveUserScheme')],
  [5, 'scene recipe and presets', files.domain.includes('PetSceneRecipe') && files.domain.includes('PET_SCENE_PRESETS')],
  [5, 'scene effects', files.canvas.includes('scene.haloEnabled') && files.canvas.includes('scene.particleCount') && files.canvas.includes('scene.shadowEnabled')],
  [5, 'automatic contrast', files.canvas.includes('autoContrast')],
  [5, 'scene excluded from bounds', files.canvas.includes('pet-only bounds')],
  [6, 'species registry', files.domain.includes('PET_SPECIES_REGISTRY')],
  [6, 'moon cat implementation', files.domain.includes("id: 'moon-cat'") && files.page.includes('月猫')],
  [6, 'reserved slime and rabbit', files.domain.includes("id: 'nebula-slime'") && files.domain.includes("id: 'star-rabbit'")],
  [6, 'cross species style mapping', files.domain.includes('mapStyleAcrossSpecies')],
  [6, 'motion fallback', files.domain.includes('resolveSpeciesMotion')],
  [6, 'generic renderer', files.canvas.includes('ProceduralPet') && !files.renderer.includes("speciesId === 'cloud-fox'" )],
  [6, 'global studio entry', files.app.includes('to="/studio"')],
  [6, 'bilingual docs', files.docsZh.includes('月猫') && files.docsEn.includes('Moon Cat')],
  [6, 'package script', files.package.includes('check:cloud-fox-studio')],
]
const activeChecks = checks.filter(([phase]) => phase <= requestedPhase)
const failures = activeChecks.filter(([, , passed]) => !passed).map(([, name]) => name)
if (failures.length) {
  console.error(`宠物工坊 Phase ${requestedPhase} 契约检查失败 / Pet Studio contract check failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`宠物工坊 Phase ${requestedPhase} 契约检查通过，共 ${activeChecks.length} 项。`)
