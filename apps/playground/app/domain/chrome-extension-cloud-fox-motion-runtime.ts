/**
 * 文件职责 / File responsibility
 * 复用并扩展 Chrome 扩展 CloudFox.vue 的动作阶段、缓入缓出和关键脉冲曲线，供 Studio 全身共享。
 * Reuses and extends production Cloud Fox motion phases, easing, and pulses across the Studio renderer.
 */
import type { ExtensionCloudFoxMotionId } from './chrome-extension-cloud-fox-motions'

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const mix = (start: number, end: number, progress: number) => start + (end - start) * progress
export const smoothStep = (start: number, end: number, value: number) => {
  const progress = clamp01((value - start) / Math.max(.0001, end - start))
  return progress * progress * (3 - 2 * progress)
}
export const pulse = (progress: number, start: number, end: number) => {
  if (progress <= start || progress >= end) return 0
  return Math.sin(((progress - start) / (end - start)) * Math.PI)
}

const SOURCE_DURATION: Partial<Record<ExtensionCloudFoxMotionId, number>> = {
  greeting: 2.4,
  spinning: 1.9,
  jumping: 1.25,
  stretching: 7,
  'playing-ball': 8.4,
  eating: 8,
  backflip: 4.3,
  'tail-tornado': 5,
  'diving-catch': 7,
  'energy-burst': 6.2,
  'shy-peek': 4.5,
  'star-juggle': 8.2,
  'cloud-nap': 18,
  'sparkle-sneeze': 3.9,
  'fireworks-show': 12,
  'curious-scan': 4,
  'antenna-charge': 5.2,
  'tail-glow': 5.2,
}

export interface ExtensionCloudFoxMotionFrame {
  state: ExtensionCloudFoxMotionId
  elapsed: number
  progress: number
  greetingPose: number
  greetingWave: number
  jumpOffset: number
  jumpLanding: number
  stretchStrength: number
  stretchBreath: number
  spinProgress: number
  restingPose: number
  flapBeat: number
  ballProgress: number
  eatProgress: number
  backflipProgress: number
  backflipCrouch: number
  backflipTuck: number
  backflipRotation: number
  backflipLift: number
  backflipLand: number
  tornadoProgress: number
  tornadoStrength: number
  catchProgress: number
  catchLaunch: number
  catchAir: number
  catchReach: number
  catchLand: number
  catchDive: number
  energyProgress: number
  energyCharge: number
  energyRelease: number
  energyStarfield: number
  shyProgress: number
  shyPose: number
  juggleProgress: number
  jugglePose: number
  juggleWave: number
  cloudNapProgress: number
  cloudNapPose: number
  sneezeProgress: number
  sneezeCharge: number
  sneezeRelease: number
  fireworksProgress: number
  fireworksSalute: number
  curiousProgress: number
  curiousPose: number
  antennaProgress: number
  antennaChargePose: number
  antennaRelease: number
  tailGlowProgress: number
  tailGlowPose: number
  tailGlowWave: number
  highEnergy: boolean
}

export function createExtensionCloudFoxMotionFrame(
  state: ExtensionCloudFoxMotionId,
  elapsed: number,
): ExtensionCloudFoxMotionFrame {
  const duration = SOURCE_DURATION[state] || 4.8
  const progress = clamp01(elapsed / duration)
  const is = (id: ExtensionCloudFoxMotionId) => state === id

  const greetingProgress = is('greeting') ? progress : 0
  const greetingPose = is('greeting')
    ? smoothStep(.02, .22, greetingProgress) * (1 - smoothStep(.78, .98, greetingProgress))
    : 0
  const greetingWave = is('greeting') && greetingProgress > .2 && greetingProgress < .82
    ? Math.sin(((greetingProgress - .2) / .62) * Math.PI * 6) * greetingPose
    : 0

  const jumpProgress = is('jumping') ? progress : 0
  const jumpOffset = is('jumping') ? Math.sin(jumpProgress * Math.PI) * .9 : 0
  const jumpLanding = is('jumping') ? Math.pow(Math.sin(jumpProgress * Math.PI), 2) : 0

  const stretchProgress = is('stretching') ? progress : 0
  const stretchStrength = is('stretching')
    ? smoothStep(.04, .24, stretchProgress) * (1 - smoothStep(.8, .98, stretchProgress))
    : 0
  const stretchBreath = is('stretching') && stretchProgress > .25 && stretchProgress < .8
    ? Math.sin(((stretchProgress - .25) / .55) * Math.PI * 2) * .022
    : 0

  const spinProgress = is('spinning') ? progress : 0
  const restingPose = is('resting') ? smoothStep(.02, .28, Math.min(1, elapsed / 2.2)) : 0
  const flapBeat = is('flapping') ? Math.sin(elapsed * 11.5) : 0
  const ballProgress = is('playing-ball') ? progress : 0
  const eatProgress = is('eating') ? progress : 0

  const backflipProgress = is('backflip') ? progress : 0
  const backflipCrouch = is('backflip')
    ? smoothStep(.02, .15, backflipProgress) * (1 - smoothStep(.18, .3, backflipProgress))
    : 0
  const backflipTuck = is('backflip')
    ? smoothStep(.18, .35, backflipProgress) * (1 - smoothStep(.68, .83, backflipProgress))
    : 0
  const backflipRotation = is('backflip') ? smoothStep(.22, .79, backflipProgress) : 0
  const backflipLift = is('backflip')
    ? Math.sin(clamp01((backflipProgress - .12) / .72) * Math.PI) * 1.28
    : 0
  const backflipLand = is('backflip')
    ? smoothStep(.78, .9, backflipProgress) * (1 - smoothStep(.92, 1, backflipProgress))
    : 0

  const tornadoProgress = is('tail-tornado') ? progress : 0
  const tornadoStrength = is('tail-tornado')
    ? smoothStep(.08, .23, tornadoProgress) * (1 - smoothStep(.8, .97, tornadoProgress))
    : 0

  const catchProgress = is('diving-catch') ? progress : 0
  const catchLaunch = is('diving-catch') ? smoothStep(.04, .18, catchProgress) * (1 - smoothStep(.28, .4, catchProgress)) : 0
  const catchAir = is('diving-catch') ? smoothStep(.12, .26, catchProgress) * (1 - smoothStep(.72, .9, catchProgress)) : 0
  const catchReach = is('diving-catch') ? smoothStep(.12, .34, catchProgress) * (1 - smoothStep(.72, .9, catchProgress)) : 0
  const catchLand = is('diving-catch') ? smoothStep(.72, .88, catchProgress) * (1 - smoothStep(.92, 1, catchProgress)) : 0
  const catchDive = catchAir

  const energyProgress = is('energy-burst') ? progress : 0
  const energyCharge = is('energy-burst')
    ? smoothStep(.04, .48, energyProgress) * (1 - smoothStep(.72, .88, energyProgress))
    : 0
  const energyRelease = is('energy-burst') ? pulse(energyProgress, .48, .78) : 0
  const energyStarfield = is('energy-burst')
    ? smoothStep(.58, .76, energyProgress) * (1 - smoothStep(.92, 1, energyProgress))
    : 0

  const shyProgress = is('shy-peek') ? progress : 0
  const shyPose = is('shy-peek')
    ? smoothStep(.04, .24, shyProgress) * (1 - smoothStep(.78, .98, shyProgress))
    : 0

  const juggleProgress = is('star-juggle') ? progress : 0
  const jugglePose = is('star-juggle')
    ? smoothStep(.04, .2, juggleProgress) * (1 - smoothStep(.84, .98, juggleProgress))
    : 0
  const juggleWave = is('star-juggle') ? Math.sin(juggleProgress * Math.PI * 6) : 0

  const cloudNapProgress = is('cloud-nap') ? progress : 0
  const cloudNapPose = is('cloud-nap')
    ? smoothStep(.04, .2, cloudNapProgress) * (1 - smoothStep(.86, .98, cloudNapProgress))
    : 0

  const sneezeProgress = is('sparkle-sneeze') ? progress : 0
  const sneezeCharge = is('sparkle-sneeze')
    ? smoothStep(.05, .42, sneezeProgress) * (1 - smoothStep(.56, .72, sneezeProgress))
    : 0
  const sneezeRelease = is('sparkle-sneeze') ? pulse(sneezeProgress, .38, .64) : 0

  const fireworksProgress = is('fireworks-show') ? progress : 0
  const fireworksSalute = is('fireworks-show')
    ? smoothStep(.02, .16, fireworksProgress) * (1 - smoothStep(.94, .99, fireworksProgress))
    : 0

  const curiousProgress = is('curious-scan') ? progress : 0
  const curiousPose = is('curious-scan')
    ? smoothStep(.03, .2, curiousProgress) * (1 - smoothStep(.78, .98, curiousProgress))
    : 0

  const antennaProgress = is('antenna-charge') ? progress : 0
  const antennaChargePose = is('antenna-charge')
    ? smoothStep(.04, .44, antennaProgress) * (1 - smoothStep(.86, .99, antennaProgress))
    : 0
  const antennaRelease = is('antenna-charge') ? pulse(antennaProgress, .42, .9) : 0

  const tailGlowProgress = is('tail-glow') ? progress : 0
  const tailGlowPose = is('tail-glow')
    ? smoothStep(.04, .22, tailGlowProgress) * (1 - smoothStep(.84, .99, tailGlowProgress))
    : 0
  const tailGlowWave = is('tail-glow')
    ? (.5 + Math.sin(tailGlowProgress * Math.PI * 10) * .5) * tailGlowPose
    : 0

  return {
    state,
    elapsed,
    progress,
    greetingPose,
    greetingWave,
    jumpOffset,
    jumpLanding,
    stretchStrength,
    stretchBreath,
    spinProgress,
    restingPose,
    flapBeat,
    ballProgress,
    eatProgress,
    backflipProgress,
    backflipCrouch,
    backflipTuck,
    backflipRotation,
    backflipLift,
    backflipLand,
    tornadoProgress,
    tornadoStrength,
    catchProgress,
    catchLaunch,
    catchAir,
    catchReach,
    catchLand,
    catchDive,
    energyProgress,
    energyCharge,
    energyRelease,
    energyStarfield,
    shyProgress,
    shyPose,
    juggleProgress,
    jugglePose,
    juggleWave,
    cloudNapProgress,
    cloudNapPose,
    sneezeProgress,
    sneezeCharge,
    sneezeRelease,
    fireworksProgress,
    fireworksSalute,
    curiousProgress,
    curiousPose,
    antennaProgress,
    antennaChargePose,
    antennaRelease,
    tailGlowProgress,
    tailGlowPose,
    tailGlowWave,
    highEnergy: ['backflip', 'tail-tornado', 'diving-catch', 'energy-burst', 'fireworks-show'].includes(state),
  }
}
