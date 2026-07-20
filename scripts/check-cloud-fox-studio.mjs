import { readFileSync } from 'node:fs'

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

const partSlots = ['ears', 'eyes', 'noses', 'mouths', 'tails', 'antennas']
const behaviors = ['idle', 'greeting', 'jumping', 'stretching', 'spinning', 'resting']

const expectations = [
  ['appearance schema', files.domain.includes('CLOUD_FOX_APPEARANCE_SCHEMA_VERSION = 1')],
  ['species identity', files.domain.includes("speciesId: 'cloud-fox'") && files.domain.includes("petId: 'zeph'")],
  ['separate pet name and species', files.domain.includes("nameZh: '云灵'") && files.domain.includes("label: '云狐'")],
  ['all part slots', partSlots.every(slot => files.domain.includes(`${slot}: [`))],
  ['safe proportion ranges', files.domain.includes('limbLength: [0.78, 1.22]') && files.domain.includes('tailLength: [0.78, 1.34]')],
  ['recipe normalization', files.domain.includes('normalizeCloudFoxAppearance') && files.domain.includes('normalizePart')],
  ['random appearance generation', files.domain.includes('randomizeCloudFoxAppearance')],
  ['studio storage', files.store.includes('CLOUD_FOX_STUDIO_STORAGE_KEY') && files.store.includes('window.localStorage')],
  ['import export support', files.store.includes('exportJson') && files.page.includes('importRecipe') && files.page.includes('exportRecipe')],
  ['replaceable renderer parts', files.renderer.includes("appearance.parts.ears === 'mechanical'") && files.renderer.includes("appearance.parts.eyes === 'visor'")],
  ['constrained limbs', files.renderer.includes('appearance.proportions.limbLength') && files.renderer.includes('appearance.proportions.limbSpacing')],
  ['tail and antenna glow', files.renderer.includes('tailGlowMaterial') && files.renderer.includes('leftAntennaMaterial')],
  ['chest and back symbols', files.renderer.includes('chestTexture') && files.renderer.includes('backTexture')],
  ['default marks', files.domain.includes("chestText: 'Z'") && files.domain.includes("backText: 'YK'")],
  ['four preview views', files.page.includes("id: 'front'") && files.page.includes("id: 'back'") && files.canvas.includes('view: CloudFoxStudioView')],
  ['background contrast previews', files.page.includes("id: 'dark'") && files.page.includes("id: 'light'") && files.page.includes("id: 'web'")],
  ['motion compatibility tests', behaviors.every(behavior => files.page.includes(`id: '${behavior}'`))],
  ['global studio entry', files.app.includes('to="/studio"') && files.app.includes('云狐工坊')],
  ['Chinese studio guide', files.docsZh.includes('外观配方') && files.docsZh.includes('动作测试')],
  ['English studio guide', files.docsEn.includes('Appearance recipe') && files.docsEn.includes('motion tests')],
  ['package script', files.package.includes('check:cloud-fox-studio')],
]

const failures = expectations.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('云狐工坊契约检查失败 / Cloud Fox Studio contract check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`云狐工坊契约检查通过，共 ${expectations.length} 项。 / Cloud Fox Studio contract check passed for ${expectations.length} expectations.`)
