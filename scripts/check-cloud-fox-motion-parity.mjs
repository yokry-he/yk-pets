import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const extension = read('apps/extension/components/avatar/CloudFox.vue')
const catalog = read('apps/playground/app/domain/chrome-extension-cloud-fox-motions.ts')
const runtime = read('apps/playground/app/domain/chrome-extension-cloud-fox-motion-runtime.ts')
const propMotion = read('apps/playground/app/domain/cloud-fox-prop-motion.ts')
const registry = read('apps/playground/app/domain/pet-species-registry.ts')
const page = read('apps/playground/app/pages/studio.vue')
const toolbar = read('apps/playground/app/components/studio/StudioMotionToolbar.vue')
const renderer = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const body = read('apps/playground/app/components/studio/ExtensionCloudFoxBody.vue')
const bellyPatch = read('apps/playground/app/components/studio/ExtensionCloudFoxBellyPatch.vue')
const energyBall = read('apps/playground/app/components/studio/ExtensionCloudFoxEnergyBall.vue')
const head = read('apps/playground/app/components/studio/ExtensionCloudFoxHead.vue')
const tail = read('apps/playground/app/components/studio/ExtensionCloudFoxTail.vue')
const orbit = read('apps/playground/app/components/studio/ExtensionCloudFoxOrbit.vue')
const effects = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionEffects.vue')

const motionIds = [
  'idle', 'sleeping', 'thinking', 'happy', 'talking', 'excited', 'confused', 'waking', 'listening',
  'greeting', 'playing', 'spinning', 'jumping', 'flapping', 'resting', 'stretching',
  'playing-ball', 'eating', 'diving-catch', 'shy-peek', 'star-juggle', 'cloud-nap', 'sparkle-sneeze', 'curious-scan',
  'backflip', 'tail-tornado', 'energy-burst', 'fireworks-show', 'antenna-charge', 'tail-glow',
]
const timedMotions = [
  ['WAVE_DURATION_SECONDS = 2.4', "id: 'greeting'", 'sourceDurationSeconds: 2.4'],
  ['STRETCH_DURATION_SECONDS = 7', "id: 'stretching'", 'sourceDurationSeconds: 7'],
  ['BALL_DURATION_SECONDS = 8.4', "id: 'playing-ball'", 'sourceDurationSeconds: 8.4'],
  ['EAT_DURATION_SECONDS = 8', "id: 'eating'", 'sourceDurationSeconds: 8'],
  ['BACKFLIP_DURATION_SECONDS = 4.3', "id: 'backflip'", 'sourceDurationSeconds: 4.3'],
  ['TAIL_TORNADO_DURATION_SECONDS = 5', "id: 'tail-tornado'", 'sourceDurationSeconds: 5'],
  ['DIVING_CATCH_DURATION_SECONDS = 7', "id: 'diving-catch'", 'sourceDurationSeconds: 7'],
  ['ENERGY_BURST_DURATION_SECONDS = 6.2', "id: 'energy-burst'", 'sourceDurationSeconds: 6.2'],
  ['SHY_PEEK_DURATION_SECONDS = 4.5', "id: 'shy-peek'", 'sourceDurationSeconds: 4.5'],
  ['STAR_JUGGLE_DURATION_SECONDS = 8.2', "id: 'star-juggle'", 'sourceDurationSeconds: 8.2'],
  ['CLOUD_NAP_DURATION_SECONDS = 18', "id: 'cloud-nap'", 'sourceDurationSeconds: 18'],
  ['SPARKLE_SNEEZE_DURATION_SECONDS = 3.9', "id: 'sparkle-sneeze'", 'sourceDurationSeconds: 3.9'],
  ['FIREWORKS_DURATION_SECONDS = 12', "id: 'fireworks-show'", 'sourceDurationSeconds: 12'],
  ['CURIOUS_SCAN_DURATION_SECONDS = 4', "id: 'curious-scan'", 'sourceDurationSeconds: 4'],
  ['ANTENNA_CHARGE_DURATION_SECONDS = 5.2', "id: 'antenna-charge'", 'sourceDurationSeconds: 5.2'],
  ['TAIL_GLOW_DURATION_SECONDS = 5.2', "id: 'tail-glow'", 'sourceDurationSeconds: 5.2'],
]
const catalogEntryHas = (idToken, durationToken) => {
  const start = catalog.indexOf(idToken)
  if (start < 0) return false
  return catalog.slice(start, start + 220).includes(durationToken)
}
const tailTornadoRotatesWholeBody = /state === 'tail-tornado'[\s\S]{0,220}motionGroup\.rotation\.y/.test(renderer)
const sharedBallConsumers = [renderer, body, head, effects]

const checks = [
  ['all retained extension motion ids mirrored', motionIds.every(id => catalog.includes(`id: '${id}'`) && (id === 'idle' || extension.includes(`state === '${id}'`) || extension.includes(`props.behavior === '${id}'`)))],
  ['exactly thirty motions and paw tap removed', motionIds.length === 30 && (catalog.match(/\{ id: '/g)?.length || 0) === 30 && !catalog.includes("id: 'paw-tap'") && !runtime.includes("is('paw-tap')") && !body.includes("state === 'paw-tap'")],
  ['source durations mirrored separately from previews', timedMotions.every(([source, idToken, durationToken]) => extension.includes(source) && catalogEntryHas(idToken, durationToken)) && catalogEntryHas("id: 'jumping'", 'sourceDurationSeconds: 1.25') && catalogEntryHas("id: 'jumping'", 'previewDurationMs: 3200')],
  ['studio runtime reads preview duration', runtime.includes('getExtensionCloudFoxMotion(state).previewDurationMs')],
  ['single grouped dropdown', toolbar.includes('<select') && toolbar.includes('<optgroup') && toolbar.includes('EXTENSION_CLOUD_FOX_MOTIONS.length') && !page.includes('v-for="[id,label] in motions"')],
  ['dropdown emits the actual selected option', toolbar.includes('event.currentTarget as HTMLSelectElement') && toolbar.includes('isExtensionCloudFoxMotion') && toolbar.includes(':value="selected"') && !toolbar.includes('v-model="selected"')],
  ['same-motion replay key', page.includes('motionKey.value += 1') && page.includes(':motion-key="motionKey"') && renderer.includes('previousMotionKey')],
  ['motion key reaches all cloud-fox rigs', (renderer.match(/:motion-key="motionKey"/g)?.length || 0) >= 5],
  ['rotation finish normalizes without reverse unwind', renderer.includes('normalizeFinishedRotation') && renderer.includes('Math.round(group.rotation.y / TAU)') && renderer.includes('frame.backflipRotation * TAU')],
  ['tail tornado leaves whole body yaw stable and spins tail locally', !tailTornadoRotatesWholeBody && renderer.includes("state === 'tail-tornado'") && tail.includes('TAIL_TORNADO_TURNS') && tail.includes('tailWindmillAngle') && tail.includes('Math.round((tail.value.rotation.z - directionRotation.value.z) / TAU)')],
  ['belly supports thin oval and shield shells', renderer.includes('ExtensionCloudFoxBellyPatch') && bellyPatch.includes("style === 'oval'") && bellyPatch.includes('bodyScale.value.z * 1.008') && bellyPatch.includes('TresSphereGeometry') && !body.includes('bellyPosition') && effects.includes('TresCircleGeometry')],
  ['flapping includes hind legs and sustained blush', body.includes("state === 'flapping'") && body.includes('targetZ = side * flap * .5') && head.includes("state === 'flapping'") && head.includes('.56 + Math.sin(stateElapsed * 2.1)')],
  ['stretching closes eyes at the raised-head phase', head.includes('const stretchOpen') && head.includes('frame.stretchStrength') && head.includes('targetX = -.5 * frame.stretchStrength')],
  ['resting and cloud nap have full body phases', runtime.includes('restingPose') && renderer.includes('.66 * frame.restingPose') && renderer.includes('-1.16 * frame.cloudNapPose') && effects.includes("cloud.value.position.set(-.02, -.88")],
  ['ball and catch use one shared pose source', propMotion.includes('interface BallMotionPose') && propMotion.includes('interface CatchMotionPose') && sharedBallConsumers.every(source => source.includes('createBallMotionPose') && source.includes('createCatchMotionPose'))],
  ['playing ball drives all four limbs and head-local gaze', body.includes('ballPose.activeSide') && body.includes('ballKick') && head.includes('head.value.worldToLocal(ballWorld)') && head.includes('-eyeX.value + eyeOffsetX') && head.includes('eyeX.value + eyeOffsetX')],
  ['diving catch shares body paw and prop targets', propMotion.includes('pawTarget = ballPosition.clone().sub(bodyTarget)') && renderer.includes('catchPose.bodyTarget') && body.includes('catchPose.pawTarget') && effects.includes('catchPose.ballPosition')],
  ['backflip uses crouch tuck rotation and landing phases', runtime.includes('backflipCrouch') && runtime.includes('backflipTuck') && runtime.includes('backflipLand') && renderer.includes('frame.backflipRotation * TAU')],
  ['head highlights remain mirrored', head.includes('side * highlightX')],
  ['thought bubbles and ballistic sneeze particles', effects.includes('thoughtBubbles') && effects.includes('localTime * localTime') && effects.includes("props.behavior === 'thinking'")],
  ['meal includes extension-style table and bowl', effects.includes('MEAL_TABLE_HEIGHT = .84') && effects.includes('MEAL_BOWL_LOCAL_Y = MEAL_TABLE_HEIGHT + .13') && effects.includes('ref="meal"') && effects.includes('ref="food"')],
  ['energy balls use explicit antenna and paw anchors', renderer.includes('ExtensionCloudFoxEnergyBall') && energyBall.includes('antennaTipMidpointAnchor') && energyBall.includes('frontPawMidpointAnchor') && energyBall.includes('releaseTravel')],
  ['burst particles only travel outward and fade', energyBall.includes('const distance = releaseTravel *') && energyBall.includes('1 - smoothStep(.66, 1, releaseTravel)') && !energyBall.includes('scale from large')],
  ['energy starfield expands and fades outward', runtime.includes('energyStarfield') && effects.includes('energyStars') && effects.includes('const spread = travel *') && effects.includes('1 - smoothStep(.66, 1, travel)')],
  ['curious scan remains outside the closed head mesh', effects.includes('scanRing.value.position.z = 1.34') && !head.includes('scanRing')],
  ['random fireworks have launch and varied burst patterns', effects.includes('fireworkSeed = Math.floor(Math.random()') && effects.includes('fireworkDirection') && effects.includes('fireworkRockets') && effects.includes('FIREWORK_PALETTES')],
  ['body orbit is persistent and configurable', registry.includes('BodyOrbitDesignRecipe') && orbit.includes('appearance.orbitDesign.enabled') && page.includes('显示轨道') && renderer.includes('ExtensionCloudFoxOrbit')],
  ['tail layered extension motion', tail.includes('rootWave') && tail.includes('midWave') && tail.includes('tipWave') && tail.includes('frame.tailGlowWave')],
  ['tail multicolor tip motion', tail.includes('flashColor.setHSL') && tail.includes("'tail-glow'")],
  ['tail embedded socket and rounded overlap joints', tail.includes('socketRadius') && tail.includes('rootExtensionEnd') && tail.includes('lateralEnd') && tail.includes('baseEnd') && tail.includes('midEnd') && tail.includes('tipEnd')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Chrome extension motion / Phase 12 visual check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Chrome extension Phase 12 motion and visual checks passed: ${checks.length} checks, ${motionIds.length} motions.`)
