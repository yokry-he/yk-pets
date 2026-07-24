/**
 * 文件职责 / File responsibility
 * 校验 Chrome 扩展和 Studio 共用完整三十动作组件，并锁定正式烟花和独立肢体姿态领域逻辑。
 * Verifies that Chrome extension and Studio share the complete thirty-motion component while locking production fireworks and independent limb-pose domain logic.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const fireworks = read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const limbMotion = read('apps/playground/app/domain/cloud-fox-limb-motion.ts')
const limbBridge = read('apps/extension/domain/cloud-fox-limb-motion.ts')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const gaze = read('apps/playground/app/components/studio/ExtensionCloudFoxGazeOverlay.vue')
const extensionRegistry = read('apps/extension/components/avatar/pet-motions.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const wxt = read('apps/extension/wxt.config.ts')
const catalog = read('apps/playground/app/domain/chrome-extension-cloud-fox-motions.ts')
const runtime = read('apps/playground/app/domain/chrome-extension-cloud-fox-motion-runtime.ts')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const effects = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue')
const page = read('apps/playground/app/pages/studio.vue')
const toolbar = read('apps/playground/app/components/studio/StudioMotionToolbar.vue')
const unifiedSource = configured.includes("from 'yk-pets-unified-cloud-fox'") && wxt.includes('../playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const motionIds = [
  'idle','sleeping','thinking','happy','talking','excited','confused','waking','listening','greeting','playing','spinning','jumping','flapping','resting','stretching',
  'playing-ball','eating','diving-catch','shy-peek','star-juggle','cloud-nap','sparkle-sneeze','curious-scan','backflip','tail-tornado','energy-burst','fireworks-show','antenna-charge','tail-glow',
]
const checks = [
  ['exactly thirty motions remain and paw tap stays removed', motionIds.length === 30 && motionIds.every(id => catalog.includes(`id: '${id}'`)) && !catalog.includes("id: 'paw-tap'")],
  ['Studio and extension use one motion component', unifiedSource && core.includes('ExtensionCloudFoxBody')],
  ['same-motion replay reaches every canonical consumer', page.includes('motionKey.value += 1') && (core.match(/:motion-key="effectiveMotionKey"/g)?.length || 0) >= 7],
  ['single grouped motion dropdown remains', toolbar.includes('<select') && toolbar.includes('<optgroup') && toolbar.includes('EXTENSION_CLOUD_FOX_MOTIONS.length')],
  ['shared frame drives body head tail effects and limb domain', [core, body, head, tail, effects].every(source => source.includes('createExtensionCloudFoxMotionFrame')) && runtime.includes('createExtensionCloudFoxMotionFrame') && limbMotion.includes('MotionFrame')],
  ['front and hind poses live outside the body renderer', body.includes('createCloudFoxFrontPawPose') && body.includes('createCloudFoxHindPawPose') && limbMotion.includes('createCloudFoxFrontPawPose') && limbMotion.includes('createCloudFoxHindPawPose') && limbBridge.includes('cloud-fox-limb-motion')],
  ['complete Studio prop and scene actions remain', core.includes('ExtensionCloudFoxEnergyBall') && core.includes('ExtensionCloudFoxMealOverlay') && effects.includes('starGroup') && effects.includes('cloud-nap') && effects.includes('sparkle-sneeze')],
  ['production fireworks retain 12 seconds three launches and 48 particles', catalog.includes("id: 'fireworks-show'") && catalog.includes('sourceDurationSeconds: 12') && fireworks.includes('fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48')],
  ['fireworks retain exact rocket stagger burst gravity and palettes', fireworks.includes('rocketTrail') && fireworks.includes('(particleIndex % 7) * .012') && fireworks.includes('* 2.65') && fireworks.includes('localBurst ** 2 * .42') && fireworksDomain.includes('#f7fbff') && fireworksDomain.includes('#ff91dc')],
  ['fireworks retain exact head eye and alternating-paw logic', headIntent.includes('targetX = -.42') && gaze.includes('gazeY = .052') && limbMotion.includes("state === 'fireworks-show'") && limbMotion.includes('Math.floor(Math.min(2.999, frame.fireworksProgress * 3))') && limbMotion.includes('2.58 * frame.fireworksSalute')],
  ['extension trigger and Studio source preserve duration', extensionRegistry.includes('duration: 12000') && catalog.includes('sourceDurationSeconds: 12')],
  ['four Studio views remain in canonical component', core.includes("front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Cloud Fox motion parity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Cloud Fox motion parity passed: ${checks.length} checks, ${motionIds.length} motions.`)
