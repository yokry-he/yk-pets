import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const extension = read('apps/extension/components/avatar/CloudFox.vue')
const catalog = read('apps/playground/app/domain/chrome-extension-cloud-fox-motions.ts')
const runtime = read('apps/playground/app/domain/chrome-extension-cloud-fox-motion-runtime.ts')
const page = read('apps/playground/app/pages/studio.vue')
const toolbar = read('apps/playground/app/components/studio/StudioMotionToolbar.vue')
const renderer = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const effects = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue')

const motionIds = [
  'idle', 'sleeping', 'thinking', 'happy', 'talking', 'excited', 'confused', 'waking', 'listening',
  'greeting', 'playing', 'spinning', 'jumping', 'flapping', 'resting', 'stretching',
  'playing-ball', 'eating', 'diving-catch', 'shy-peek', 'star-juggle', 'cloud-nap', 'sparkle-sneeze', 'curious-scan', 'paw-tap',
  'backflip', 'tail-tornado', 'energy-burst', 'fireworks-show', 'antenna-charge', 'tail-glow',
]
const timedMotions = [
  ['WAVE_DURATION_SECONDS = 2.4', "greeting: 2.4"],
  ['STRETCH_DURATION_SECONDS = 7', "stretching: 7"],
  ['BALL_DURATION_SECONDS = 8.4', "'playing-ball': 8.4"],
  ['EAT_DURATION_SECONDS = 8', 'eating: 8'],
  ['BACKFLIP_DURATION_SECONDS = 4.3', 'backflip: 4.3'],
  ['TAIL_TORNADO_DURATION_SECONDS = 5', "'tail-tornado': 5"],
  ['DIVING_CATCH_DURATION_SECONDS = 7', "'diving-catch': 7"],
  ['ENERGY_BURST_DURATION_SECONDS = 6.2', "'energy-burst': 6.2"],
  ['SHY_PEEK_DURATION_SECONDS = 4.5', "'shy-peek': 4.5"],
  ['STAR_JUGGLE_DURATION_SECONDS = 8.2', "'star-juggle': 8.2"],
  ['CLOUD_NAP_DURATION_SECONDS = 18', "'cloud-nap': 18"],
  ['SPARKLE_SNEEZE_DURATION_SECONDS = 3.9', "'sparkle-sneeze': 3.9"],
  ['FIREWORKS_DURATION_SECONDS = 12', "'fireworks-show': 12"],
  ['CURIOUS_SCAN_DURATION_SECONDS = 4', "'curious-scan': 4"],
  ['PAW_TAP_DURATION_SECONDS = 2.5', "'paw-tap': 2.5"],
  ['ANTENNA_CHARGE_DURATION_SECONDS = 5.2', "'antenna-charge': 5.2"],
  ['TAIL_GLOW_DURATION_SECONDS = 5.2', "'tail-glow': 5.2"],
]

const checks = [
  ['all extension motion ids mirrored', motionIds.every(id => catalog.includes(`id: '${id}'`) && (id === 'idle' || extension.includes(`state === '${id}'`) || extension.includes(`props.behavior === '${id}'`)))],
  ['source durations mirrored', timedMotions.every(([source, target]) => extension.includes(source) && runtime.includes(target))],
  ['single grouped dropdown', toolbar.includes('<select') && toolbar.includes('<optgroup') && toolbar.includes('EXTENSION_CLOUD_FOX_MOTIONS.length') && !page.includes('v-for="[id,label] in motions"')],
  ['dropdown emits the actual selected option', toolbar.includes('event.currentTarget as HTMLSelectElement') && toolbar.includes('isExtensionCloudFoxMotion') && toolbar.includes(':value="selected"') && !toolbar.includes('v-model="selected"')],
  ['same-motion replay key', page.includes('motionKey.value += 1') && page.includes(':motion-key="motionKey"') && renderer.includes('previousMotionKey')],
  ['motion key reaches all cloud-fox rigs', (renderer.match(/:motion-key="motionKey"/g)?.length || 0) >= 4],
  ['body motion parity', ['playing-ball','backflip','tail-tornado','energy-burst','fireworks-show','shy-peek','star-juggle','cloud-nap','sparkle-sneeze','paw-tap'].every(id => body.includes(`state === '${id}'`))],
  ['head motion parity', ['sleeping','thinking','confused','listening','sparkle-sneeze','curious-scan','antenna-charge'].every(id => head.includes(`state === '${id}'`))],
  ['eye motion preserves left and right mount points', head.includes('-eyeX.value + scanOffset') && head.includes('eyeX.value + scanOffset') && head.includes('绝不能把左眼的基础挂点缓动回头部中心')],
  ['visible prop and effect parity', ['playing-ball','eating','energy-burst','star-juggle','cloud-nap','sparkle-sneeze','curious-scan','fireworks-show'].every(id => effects.includes(`'${id}'`))],
  ['tail layered extension motion', tail.includes('rootWave') && tail.includes('midWave') && tail.includes('tipWave') && tail.includes('frame.tailGlowWave')],
  ['tail embedded socket', tail.includes('socketRadius') && tail.includes('bodyBack') && tail.includes('socketRadius.value * .38')],
  ['tail rounded overlap joints', tail.includes('rootExtensionEnd') && tail.includes('lateralEnd') && tail.includes('baseEnd') && tail.includes('midEnd') && tail.includes('tipEnd') && (tail.match(/TresSphereGeometry/g)?.length || 0) >= 8],
  ['offset connectors prevent segment gaps', tail.includes('connectorDirection') && tail.includes('connectorQuaternion') && tail.includes('connectorLength + segment.connectorWidth')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Chrome extension motion parity / continuous tail check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Chrome extension motion parity and continuous tail passed: ${checks.length} checks, ${motionIds.length} motions.`)
