import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('apps/playground/app/domain/pet-studio-phase3.ts')
const store = read('apps/playground/app/stores/pet-appearance.ts')
const renderer = read('apps/playground/app/components/studio/CustomizableCloudFox.vue')
const page = read('apps/playground/app/pages/studio.vue')
const expectations = [
  ['schema v2', domain.includes('PET_STUDIO_SCHEMA_VERSION = 2')],
  ['legacy migration', domain.includes('legacySymbols') && domain.includes('normalizePetStudioAppearanceV2')],
  ['independent chest and back channels', domain.includes('chest: SymbolChannelRecipe') && domain.includes('back: SymbolChannelRecipe')],
  ['derived highlight shade halo', domain.includes('highlight') && domain.includes('shade') && domain.includes('halo')],
  ['undo redo', store.includes('undoStack') && store.includes('redoStack') && page.includes('撤销') && page.includes('重做')],
  ['geometry audit', domain.includes('auditPetStudioAppearance') && page.includes('自动边界和穿模检查')],
  ['visible symbol glow', renderer.includes('glowIntensity*.55') && renderer.includes('TresPointLight')],
]
const failures = expectations.filter(([, ok]) => !ok).map(([name]) => name)
if (failures.length) { console.error('Phase 3 check failed:', failures.join(', ')); process.exit(1) }
console.log(`Phase 3 contract passed: ${expectations.length} checks.`)
