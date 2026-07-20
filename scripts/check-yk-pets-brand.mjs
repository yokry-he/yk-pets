import { readFileSync } from 'node:fs'

const files = {
  rootPackage: readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  manifest: readFileSync(new URL('../apps/extension/wxt.config.ts', import.meta.url), 'utf8'),
  brand: readFileSync(new URL('../packages/shared/src/brand.ts', import.meta.url), 'utf8'),
  messages: readFileSync(new URL('../packages/shared/src/messages.ts', import.meta.url), 'utf8'),
  extensionBrand: readFileSync(new URL('../apps/extension/brand.ts', import.meta.url), 'utf8'),
  playgroundConfig: readFileSync(new URL('../apps/playground/nuxt.config.ts', import.meta.url), 'utf8'),
  playgroundBrand: readFileSync(new URL('../apps/playground/app/plugins/yk-pets-brand.client.ts', import.meta.url), 'utf8'),
  playgroundReadmeZh: readFileSync(new URL('../apps/playground/README.zh-CN.md', import.meta.url), 'utf8'),
  playgroundReadmeEn: readFileSync(new URL('../apps/playground/README.en.md', import.meta.url), 'utf8'),
  agentProject: readFileSync(new URL('../packages/local-agent/src/project.ts', import.meta.url), 'utf8'),
  agentPackage: readFileSync(new URL('../packages/local-agent/package.json', import.meta.url), 'utf8'),
  readme: readFileSync(new URL('../README.md', import.meta.url), 'utf8'),
  readmeZh: readFileSync(new URL('../README.zh-CN.md', import.meta.url), 'utf8'),
  readmeEn: readFileSync(new URL('../README.en.md', import.meta.url), 'utf8'),
}

const expectations = [
  ['root package name', files.rootPackage.includes('"name": "yk-pets"')],
  ['extension product name', files.manifest.includes("name: 'YK-PETS Browser Agent'")],
  ['Chinese pet name', files.brand.includes("'zh-CN': '云灵'")],
  ['English pet name', files.brand.includes("en: 'Zeph'")],
  ['Chinese species', files.brand.includes("'zh-CN': '云狐'")],
  ['English species', files.brand.includes("en: 'Cloud Fox'")],
  ['identity separated from visual state', files.messages.includes('identity?: Readonly<PetIdentity>')],
  ['canonical runtime types', files.messages.includes('export type YkPetAction') && files.messages.includes('export interface YkPetVisualState')],
  ['legacy type compatibility', files.messages.includes('export type NovaPetAction = YkPetAction')],
  ['storage migration', files.extensionBrand.includes("const CURRENT_PREFIX = 'yk-pets:'") && files.extensionBrand.includes("const LEGACY_PREFIX = 'nova:'")],
  ['Zeph loader mark', files.extensionBrand.includes("element.textContent = 'Z'")],
  ['playground page title', files.playgroundConfig.includes("title: 'YK-PETS Playground · 云灵 Zeph'")],
  ['playground brand bridge', files.playgroundBrand.includes("['NOVA Browser Agent', 'YK-PETS Browser Agent']")],
  ['playground Chinese identity', files.playgroundReadmeZh.includes('云灵') && files.playgroundReadmeZh.includes('Zeph') && files.playgroundReadmeZh.includes('云狐')],
  ['playground English identity', files.playgroundReadmeEn.includes('Zeph') && files.playgroundReadmeEn.includes('Cloud Fox')],
  ['agent config migration', files.agentProject.includes("path.join(root, '.yk-pets')") && files.agentProject.includes("path.join(root, '.nova', 'agent.json')")],
  ['new agent command', files.agentPackage.includes('"yk-pets-agent"')],
  ['legacy agent command alias', files.agentPackage.includes('"nova-agent"')],
  ['root README brand', files.readme.startsWith('# YK-PETS')],
  ['Chinese README identity', files.readmeZh.includes('云灵') && files.readmeZh.includes('Zeph') && files.readmeZh.includes('云狐')],
  ['English README identity', files.readmeEn.includes('Zeph') && files.readmeEn.includes('Cloud Fox')],
]

const failures = expectations.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('YK-PETS 品牌与宠物身份检查失败 / YK-PETS brand and pet identity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`YK-PETS 品牌与宠物身份检查通过，共 ${expectations.length} 项。 / YK-PETS brand and pet identity check passed for ${expectations.length} expectations.`)
