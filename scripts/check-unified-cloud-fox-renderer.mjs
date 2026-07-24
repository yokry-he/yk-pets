/**
 * 文件职责 / File responsibility
 * 防止默认宠物、导入宠物和 Studio 再次分裂为不同模型或动作实现，并锁定唯一面部层级、扩展正式烟花、可配置配方与完整视觉参数。
 * Prevents default, imported, and Studio pets from diverging into separate model or motion implementations while locking the sole face hierarchy, production fireworks, customization, and full visual parameters.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const fireworks = read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const gaze = read('apps/playground/app/components/studio/ExtensionCloudFoxGazeOverlay.vue')
const procedural = read('apps/playground/app/components/studio/ProceduralPet.vue')
const production = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const avatar = read('apps/extension/components/avatar/AvatarCanvas.vue')
const wxt = read('apps/extension/wxt.config.ts')
const tsconfig = read('apps/extension/tsconfig.json')
const unifiedType = read('apps/extension/types/unified-cloud-fox.d.ts')
const domainBridgeNames = [
  'extension-cloud-fox-default',
  'pet-species-registry',
  'pet-part-customization',
  'chrome-extension-cloud-fox-motions',
  'chrome-extension-cloud-fox-profile',
  'chrome-extension-cloud-fox-motion-runtime',
  'cloud-fox-prop-motion',
  'pet-studio-phase4',
  'production-cloud-fox-fireworks',
]
const domainBridges = domainBridgeNames.map(name => read(`apps/extension/domain/${name}.ts`))
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'")
  && wxt.includes("'yk-pets-unified-cloud-fox'")
  && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const reservedAliasSafe = !wxt.includes("'~': fileURLToPath")
  && !wxt.includes('find: /^~\\/domain\\//')
  && tsconfig.includes('"~/*"')
  && tsconfig.includes('"./*"')
  && !tsconfig.includes('"../playground/app/*"')
const domainBridgeSafe = domainBridges.every((source, index) => (
  source.includes('文件职责 / File responsibility')
  && source.includes(`export * from '../../playground/app/domain/${domainBridgeNames[index]}'`)
))
const checks = [
  ['extension and Studio use the same canonical component', unifiedSource && procedural.includes('ExtensionAlignedCloudFox')],
  ['extension type boundary does not create a renderer copy', tsconfig.includes('types/unified-cloud-fox.d.ts') && unifiedType.includes('DefineComponent') && !unifiedType.includes('ExtensionAlignedCloudFox.vue')],
  ['extension no longer renders legacy CloudFox or a second recipe topology', configured.includes('<ExtensionAlignedCloudFox') && !configured.includes('<CloudFox') && !configured.includes('recipeDriven')],
  ['default recipe enters the same customizable component', avatar.includes("source: 'default'") && avatar.includes('appearance: {}') && configured.includes('normalizeCustomizableAppearance') && configured.includes('createExtensionClassicAppearance')],
  ['canonical component retains the complete Studio part stack', ['ExtensionCloudFoxBody','ExtensionCloudFoxTail','ExtensionCloudFoxEnergyBall','ExtensionCloudFoxMealOverlay','ExtensionCloudFoxMotionEffects','ProductionCloudFoxHeadIntent'].every(token => core.includes(token)) && headIntent.includes('ExtensionCloudFoxHead') && headIntent.includes('ExtensionCloudFoxGazeOverlay') && head.includes('ExtensionCloudFoxFaceCustomization') && !headIntent.includes('ExtensionCloudFoxFaceCustomization')],
  ['old Studio fireworks implementation is removed from the generic effects layer', !read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue').includes('fireworkBurstIndexes') && core.includes('<ProductionCloudFoxFireworks')],
  ['production fireworks retain three launches and 48 particles', fireworks.includes('frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48')],
  ['production fireworks retain exact curated palettes', ['#f7fbff','#72f2ff','#7a6fff','#d788ff','#fff7cf','#ffd36a','#ff8aae','#dffff4','#52e0d0','#7bd8ff','#9a8cff','#ffe9fb','#ff91dc','#a788ff'].every(color => fireworksDomain.includes(color))],
  ['production fireworks retain exact phase and gravity math', fireworks.includes("localProgress - .36") && fireworks.includes('2.4') && fireworks.includes('smoothStep(.72, .99') && fireworks.includes('(particleIndex % 7) * .012') && fireworks.includes('* 2.65') && fireworks.includes('localBurst ** 2 * .42')],
  ['production fireworks share head and eye targets from the same seed', headIntent.includes('createProductionFireworkBurstPlan') && gaze.includes('createProductionFireworkBurstPlan') && core.includes(':firework-seed="fireworkSeed"')],
  ['hidden and offscreen optimization pauses work without reducing quality', core.includes('loop.stop()') && core.includes('loop.start()') && avatar.includes('new IntersectionObserver') && core.includes('resumeNonce')],
  ['cross-app source aliases preserve WXT defaults through thin domain bridges', reservedAliasSafe && domainBridgeSafe && wxt.includes("'import.meta.client': 'true'") && unifiedSource],
  ['full visual quality remains locked', production.includes("props.compact ? [.75, 1] : [.9, 1.25]") && production.includes('props.compact ? 30 : 40') && (production.match(/<TresPointLight/g)?.length || 0) === 2 && production.includes('filter:blur(16px)')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('unified Cloud Fox renderer check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`unified Cloud Fox renderer check passed: ${checks.length} checks.`)
