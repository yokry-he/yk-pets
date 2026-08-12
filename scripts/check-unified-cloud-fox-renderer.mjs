/**
 * 文件职责 / File responsibility
 * 防止默认、导入和 Studio 宠物分裂，并锁定单一头身、共享表面采样、眼睛可见性、完整动作桥接和正式视觉质量。
 * Prevents default, imported, and Studio pets from diverging while locking sole head/body surfaces, shared surface sampling, eye visibility, complete motion bridges, and production visual quality.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const belly = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bodyShape = read('apps/playground/app/components/studio/ExtensionCloudFoxBodyShape.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const headShape = read('apps/playground/app/components/studio/ExtensionCloudFoxHeadShape.vue')
const eye = read('apps/playground/app/components/studio/ExtensionCloudFoxEyeShape.vue')
const surface = read('apps/playground/app/domain/cloud-fox-surface-model.ts')
const eyeMetrics = read('apps/playground/app/domain/cloud-fox-eye-metrics.ts')
const limbMotion = read('apps/playground/app/domain/cloud-fox-limb-motion.ts')
const fireworks = read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const gaze = read('apps/playground/app/components/studio/ExtensionCloudFoxGazeOverlay.vue')
const procedural = read('apps/playground/app/components/studio/ProceduralPet.vue')
const production = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const avatar = read('apps/extension/components/avatar/AvatarCanvas.vue')
const wxt = read('apps/extension/wxt.config.ts')
const tsconfig = read('apps/extension/tsconfig.json')
const unifiedType = read('apps/extension/types/unified-cloud-fox.d.ts')
const domainBridgeNames = [
  'extension-cloud-fox-default','pet-species-registry','pet-part-customization','cloud-fox-shape-profile','cloud-fox-surface-model','cloud-fox-eye-metrics','cloud-fox-limb-motion',
  'chrome-extension-cloud-fox-motions','chrome-extension-cloud-fox-profile','chrome-extension-cloud-fox-motion-runtime',
  'cloud-fox-prop-motion','pet-studio-phase4','production-cloud-fox-fireworks',
]
const domainBridges = domainBridgeNames.map(name => read(`apps/extension/domain/${name}.ts`))
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'") && wxt.includes("'yk-pets-unified-cloud-fox'") && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const reservedAliasSafe = !wxt.includes("'~': fileURLToPath") && !wxt.includes('find: /^~\\/domain\\//') && tsconfig.includes('"~/*"') && tsconfig.includes('"./*"') && !tsconfig.includes('"../playground/app/*"')
const domainBridgeSafe = domainBridges.every((source, index) => source.includes('文件职责 / File responsibility') && source.includes(`export * from '../../playground/app/domain/${domainBridgeNames[index]}'`))
const checks = [
  ['extension and Studio use the same canonical component', unifiedSource && procedural.includes('ExtensionAlignedCloudFox')],
  ['extension type boundary does not create a renderer copy', tsconfig.includes('types/unified-cloud-fox.d.ts') && unifiedType.includes('DefineComponent') && !unifiedType.includes('ExtensionAlignedCloudFox.vue')],
  ['extension has no legacy or second topology', configured.includes('<ExtensionAlignedCloudFox') && !configured.includes('<CloudFox') && !configured.includes('recipeDriven')],
  ['default recipe enters the same customizable component', avatar.includes("source: 'default'") && avatar.includes('appearance: {}') && configured.includes('normalizeCustomizableAppearance') && configured.includes('createExtensionClassicAppearance')],
  ['canonical component has one torso one head and one projected belly', core.includes('<ExtensionCloudFoxBody') && core.includes('<ExtensionCloudFoxBellyPatch') && body.includes('<ExtensionCloudFoxBodyShape') && head.includes('<ExtensionCloudFoxHeadShape') && belly.includes('createCloudFoxBellySurfaceMesh') && !belly.includes('ExtensionCloudFoxBodyShape')],
  ['body and head use one shared surface model', surface.includes('sampleCloudFoxBodyFrontSurface') && surface.includes('sampleCloudFoxHeadFrontSurfaceAtLocalXY') && head.includes('resolveCloudFoxEyeSurfaceAnchor') && belly.includes('createCloudFoxBellySurfaceMesh')],
  ['special eyes use shared visibility metrics and real geometry', eyeMetrics.includes('blinkFloor') && head.includes('getCloudFoxEyeBlinkFloor') && eye.includes('ExtrudeGeometry') && eye.includes('TresOctahedronGeometry') && eye.includes('TresTubeGeometry')],
  ['complete limb motion has one source and extension bridge', body.includes('createCloudFoxFrontPawPose') && limbMotion.includes('createCloudFoxFrontPawPose') && limbMotion.includes('createCloudFoxHindPawPose') && read('apps/extension/domain/cloud-fox-limb-motion.ts').includes("export * from '../../playground/app/domain/cloud-fox-limb-motion'")],
  ['old Studio fireworks are absent from generic effects', !read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue').includes('fireworkBurstIndexes') && core.includes('<ProductionCloudFoxFireworks')],
  ['production fireworks retain three launches and 48 particles', fireworks.includes('frame.fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48')],
  ['production fireworks retain curated palettes', ['#f7fbff','#72f2ff','#7a6fff','#d788ff','#fff7cf','#ffd36a','#ff8aae','#dffff4','#52e0d0','#7bd8ff','#9a8cff','#ffe9fb','#ff91dc','#a788ff'].every(color => fireworksDomain.includes(color))],
  ['production fireworks share head and eye targets', headIntent.includes('createProductionFireworkBurstPlan') && gaze.includes('createProductionFireworkBurstPlan') && core.includes(':firework-seed="fireworkSeed"')],
  ['hidden and offscreen optimization remains', core.includes('loop.stop()') && core.includes('loop.start()') && avatar.includes('new IntersectionObserver') && core.includes('resumeNonce')],
  ['cross-app aliases preserve WXT defaults through bridges', reservedAliasSafe && domainBridgeSafe && wxt.includes("'import.meta.client': 'true'") && unifiedSource],
  ['full visual quality remains locked', production.includes("props.compact ? [.75, 1] : [.9, 1.25]") && production.includes('props.compact ? 30 : 40') && (production.match(/<TresPointLight/g)?.length || 0) === 2 && production.includes('filter:blur(16px)')],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('unified Cloud Fox renderer check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`unified Cloud Fox renderer check passed: ${checks.length} checks.`)
