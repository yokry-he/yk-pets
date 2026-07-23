/**
 * 文件职责 / File responsibility
 * 校验 Chrome 扩展和 Studio 共用完整三十动作组件，并锁定 Chrome 正式高空烟花秀。
 * Verifies that the Chrome extension and Studio share the complete thirty-motion component while locking the production Chrome fireworks show.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const core = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const fireworks = read('apps/playground/app/components/studio/ProductionCloudFoxFireworks.vue')
const fireworksDomain = read('apps/playground/app/domain/production-cloud-fox-fireworks.ts')
const headIntent = read('apps/playground/app/components/studio/ProductionCloudFoxHeadIntent.vue')
const gaze = read('apps/playground/app/components/studio/ExtensionCloudFoxGazeOverlay.vue')
const extensionRegistry = read('apps/extension/components/avatar/pet-motions.ts')
const configured = read('apps/extension/components/avatar/ConfiguredCloudFox.vue')
const catalog = read('apps/playground/app/domain/chrome-extension-cloud-fox-motions.ts')
const runtime = read('apps/playground/app/domain/chrome-extension-cloud-fox-motion-runtime.ts')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const effects = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue')
const page = read('apps/playground/app/pages/studio.vue')
const toolbar = read('apps/playground/app/components/studio/StudioMotionToolbar.vue')
const motionIds = [
  'idle','sleeping','thinking','happy','talking','excited','confused','waking','listening','greeting','playing','spinning','jumping','flapping','resting','stretching',
  'playing-ball','eating','diving-catch','shy-peek','star-juggle','cloud-nap','sparkle-sneeze','curious-scan','backflip','tail-tornado','energy-burst','fireworks-show','antenna-charge','tail-glow',
]
const checks = [
  ['exactly thirty motions remain and paw tap stays removed', motionIds.length === 30 && motionIds.every(id => catalog.includes(`id: '${id}'`)) && !catalog.includes("id: 'paw-tap'")],
  ['Studio and extension use one motion component', configured.includes("../../../playground/app/components/studio/ExtensionAlignedCloudFox.vue") && core.includes('ExtensionCloudFoxBody')],
  ['same-motion replay reaches every canonical motion consumer', page.includes('motionKey.value += 1') && (core.match(/:motion-key="effectiveMotionKey"/g)?.length || 0) >= 7],
  ['single grouped motion dropdown remains', toolbar.includes('<select') && toolbar.includes('<optgroup') && toolbar.includes('EXTENSION_CLOUD_FOX_MOTIONS.length')],
  ['shared frame still drives body head tail and effects', [core, body, head, tail, effects].every(source => source.includes('createExtensionCloudFoxMotionFrame')) && runtime.includes('createExtensionCloudFoxMotionFrame')],
  ['complete Studio prop and scene actions remain', core.includes('ExtensionCloudFoxEnergyBall') && core.includes('ExtensionCloudFoxMealOverlay') && effects.includes('starGroup') && effects.includes('cloud-nap') && effects.includes('sparkle-sneeze')],
  ['production fireworks retain 12 seconds three launches and 48 particles', catalog.includes("id: 'fireworks-show'") && catalog.includes('sourceDurationSeconds: 12') && fireworks.includes('fireworksProgress * PRODUCTION_FIREWORK_BURST_COUNT') && fireworksDomain.includes('PRODUCTION_FIREWORK_PARTICLE_COUNT = 48')],
  ['fireworks retain exact rocket stagger burst gravity and palettes', fireworks.includes('rocketTrail') && fireworks.includes('(particleIndex % 7) * .012') && fireworks.includes('* 2.65') && fireworks.includes('localBurst ** 2 * .42') && fireworksDomain.includes('#f7fbff') && fireworksDomain.includes('#ff91dc')],
  ['fireworks retain exact extension head eye and alternating-paw logic', headIntent.includes('targetX = -.42') && gaze.includes('gazeY = .052') && body.includes("state === 'fireworks-show'") && body.includes('Math.floor(Math.min(2.999, frame.fireworksProgress * 3))') && body.includes('2.58 * frame.fireworksSalute')],
  ['extension menu and Studio catalog share the canonical manual durations', extensionRegistry.includes('duration: 12000') && catalog.includes('previewDurationMs: 12000')],
  ['four Studio views remain in the canonical component', core.includes("front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Cloud Fox motion parity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Cloud Fox motion parity passed: ${checks.length} checks, ${motionIds.length} motions.`)
