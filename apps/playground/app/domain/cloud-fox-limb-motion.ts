/*
 * 文件职责 / File responsibility
 * 计算云狐前后肢在三十种动作中的姿态，独立于身体几何和 Vue 引用，确保改造轮廓时不丢失动作。
 * Computes Cloud Fox front/hind limb poses for all thirty motions independently of body geometry and Vue refs so silhouette work cannot drop motions.
 */
import { clamp01, mix, pulse, smoothStep, type createExtensionCloudFoxMotionFrame } from './chrome-extension-cloud-fox-motion-runtime'
import { createBallMotionPose, createCatchMotionPose } from './cloud-fox-prop-motion'
import type { ExtensionCloudFoxMotionId } from './chrome-extension-cloud-fox-motions'
import type { FrontPawDesignRecipe } from './pet-species-registry'

type MotionFrame = ReturnType<typeof createExtensionCloudFoxMotionFrame>

export interface CloudFoxFrontPawPose {
  x: number
  y: number
  z: number
  scaleY: number
  tipX: number
  tipZ: number
}
export interface CloudFoxHindPawPose { x: number; z: number }

export function createCloudFoxFrontPawPose(
  state: ExtensionCloudFoxMotionId,
  side: -1 | 1,
  elapsed: number,
  frame: MotionFrame,
  design: FrontPawDesignRecipe,
): CloudFoxFrontPawPose {
  const ballPose = createBallMotionPose(frame.ballProgress)
  const catchPose = createCatchMotionPose(frame.catchProgress)
  let x = design.forwardAngle
  let y = 0
  let z = side * design.outwardAngle
  let scaleY = 1
  let tipX = 0
  let tipZ = 0

  if (state === 'greeting' && side === 1) {
    z = mix(side * design.outwardAngle, 2.42, frame.greetingPose) + frame.greetingWave * .16
    x = -.08 * frame.greetingPose
    tipZ = frame.greetingWave * .22
  }
  else if (state === 'playing') {
    const dance = Math.sin(elapsed * 7.2 + (side < 0 ? 0 : Math.PI))
    z += side * (.34 + dance * .34)
    x = -.12 - Math.max(0, dance) * .18
    tipZ = dance * .2
  }
  else if (state === 'flapping') {
    const flap = frame.flapBeat
    z = side * (1.05 + flap * .58)
    x = -.12 - Math.abs(flap) * .24
    tipZ = side * flap * .26
  }
  else if (state === 'jumping') {
    z = side * (.28 + frame.jumpLanding * .35)
    x = -.22 - frame.jumpLanding * .2
    tipX = -.18 * frame.jumpLanding
  }
  else if (state === 'stretching') {
    z = side * mix(design.outwardAngle, 2.28, frame.stretchStrength)
    x = mix(design.forwardAngle, -1.06, frame.stretchStrength)
    scaleY = 1 + frame.stretchStrength * .12
    tipZ = side * frame.stretchStrength * .14
  }
  else if (state === 'resting') {
    x = mix(design.forwardAngle, -1.18, frame.restingPose)
    z = side * mix(design.outwardAngle, .2, frame.restingPose)
    scaleY = 1 + frame.restingPose * .08
    tipX = -.26 * frame.restingPose
  }
  else if (state === 'sleeping') {
    x = -.5
    z = side * -.04
    tipX = -.22
  }
  else if (state === 'thinking' && side < 0) {
    z = -1.12
    x = -.2
    tipZ = -.12
  }
  else if (state === 'listening' && side === 1) {
    z = 1.72
    x = -.16
    tipZ = .12
  }
  else if (state === 'confused') {
    z = side * (.72 + Math.sin(elapsed * 2.4) * .12)
    x = .08
  }
  else if (state === 'happy' || state === 'talking' || state === 'excited') {
    const bounce = Math.sin(elapsed * (state === 'excited' ? 9 : 6.5) + (side < 0 ? 0 : Math.PI))
    z += side * (.22 + bounce * .18)
    tipZ = bounce * .12
  }
  else if (state === 'waking') {
    const wake = smoothStep(.02, .7, frame.progress)
    z = side * mix(.1, 1.4, wake) * (1 - smoothStep(.76, .99, frame.progress))
    x = -.18 * wake
  }
  else if (state === 'playing-ball') {
    const activeBoost = side === ballPose.activeSide ? 1 : .7
    const reach = clamp01(1 - Math.abs(ballPose.position.x - side * .5) / 1.05) * (.42 + ballPose.height * .58) * activeBoost
    const tap = side < 0
      ? pulse(frame.ballProgress, .12, .31) + pulse(frame.ballProgress, .62, .81)
      : pulse(frame.ballProgress, .37, .56) + pulse(frame.ballProgress, .78, .95)
    const intent = Math.max(reach, tap)
    x = -.2 - intent * .62 - ballPose.height * .06
    y = -ballPose.position.x * .12
    z = side * (.1 + reach * .24) - ballPose.position.x * .14
    tipX = intent * .4
    tipZ = -ballPose.position.x * .12
  }
  else if (state === 'eating') {
    const eatPose = smoothStep(.04, .22, frame.eatProgress) * (1 - smoothStep(.88, .99, frame.eatProgress))
    x = -.72 * eatPose
    z = side * mix(design.outwardAngle, .34, eatPose)
    tipX = -.28 * eatPose + Math.max(0, Math.sin(frame.eatProgress * Math.PI * 12)) * .08
  }
  else if (state === 'backflip') {
    x = -.24 - frame.backflipTuck * .82 + frame.backflipLand * .2
    z = side * (-.12 - frame.backflipTuck * .5)
    scaleY = 1 - frame.backflipTuck * .16
    tipX = -frame.backflipTuck * .48
  }
  else if (state === 'tail-tornado') {
    x = -.34 * frame.tornadoStrength
    z = side * (-.2 - frame.tornadoStrength * .32)
    tipZ = side * -.18 * frame.tornadoStrength
  }
  else if (state === 'diving-catch') {
    const activeReach = side === catchPose.activeSide ? 1 : .74
    x = -.22 - frame.catchReach * (.72 + activeReach * .28) + frame.catchLand * .26
    y = -catchPose.pawTarget.x * .1 * frame.catchReach
    z = side * (.08 - frame.catchReach * .12) - catchPose.pawTarget.x * .1 * frame.catchReach
    scaleY = 1 + frame.catchReach * (.12 + activeReach * .06)
    tipX = -frame.catchReach * (.42 + activeReach * .14)
    tipZ = side * -.18 * frame.catchReach - catchPose.pawTarget.x * .06 * frame.catchReach
  }
  else if (state === 'energy-burst') {
    x = -frame.energyCharge * .48 + frame.energyRelease * .18
    z = side * mix(.06, -.98, frame.energyCharge) + side * frame.energyRelease * 1.38
    tipX = -frame.energyCharge * .36
    tipZ = side * -frame.energyRelease * .38
  }
  else if (state === 'fireworks-show') {
    const activeRight = Math.floor(Math.min(2.999, frame.fireworksProgress * 3)) % 2 === 0
    const active = side > 0 ? activeRight : !activeRight
    z = active ? side * 2.58 * frame.fireworksSalute : side * -.2 * frame.fireworksSalute
    scaleY = active ? 1 + frame.fireworksSalute * .12 : 1
    tipZ = active ? Math.sin(frame.fireworksProgress * Math.PI * 9) * .1 * frame.fireworksSalute : 0
  }
  else if (state === 'shy-peek') {
    x = -.22 * frame.shyPose
    z = side < 0 ? mix(-.06, -1.46, frame.shyPose) : mix(.06, 1.3, frame.shyPose)
    tipZ = side < 0 ? -.18 * frame.shyPose : .22 * frame.shyPose
  }
  else if (state === 'star-juggle') {
    const active = side < 0 ? Math.max(0, frame.juggleWave) : Math.max(0, -frame.juggleWave)
    x = -.18 - active * .5
    z = side * .34 + frame.juggleWave * .42
    scaleY = 1 + active * .08
    tipZ = side < 0 ? frame.juggleWave * .26 : -frame.juggleWave * .26
  }
  else if (state === 'cloud-nap') {
    x = side < 0 ? -.82 * frame.cloudNapPose : -.68 * frame.cloudNapPose
    z = side < 0 ? .62 * frame.cloudNapPose : -.5 * frame.cloudNapPose
    tipX = side < 0 ? -.4 * frame.cloudNapPose : -.36 * frame.cloudNapPose
    tipZ = side < 0 ? .16 * frame.cloudNapPose : -.2 * frame.cloudNapPose
  }
  else if (state === 'sparkle-sneeze') {
    z = side * mix(.06, 1.14, frame.sneezeCharge) + side * frame.sneezeRelease * .24
    tipZ = side * (.12 * frame.sneezeCharge - frame.sneezeRelease * .28)
  }
  else if (state === 'antenna-charge') {
    z = side * mix(.06, .74, frame.antennaChargePose) + side * frame.antennaRelease * .34
    tipZ = side * (.1 * frame.antennaChargePose - frame.antennaRelease * .22)
  }
  else if (state === 'tail-glow') {
    z += side * frame.tailGlowWave * .08
    tipZ = side * -frame.tailGlowWave * .07
  }
  else if (state === 'curious-scan' && side > 0) {
    z = .06 + Math.sin(frame.curiousProgress * Math.PI * 3) * .14 * frame.curiousPose
    tipZ = Math.sin(frame.curiousProgress * Math.PI * 5) * .1 * frame.curiousPose
  }
  return { x, y, z, scaleY, tipX, tipZ }
}

export function createCloudFoxHindPawPose(
  state: ExtensionCloudFoxMotionId,
  side: -1 | 1,
  elapsed: number,
  frame: MotionFrame,
): CloudFoxHindPawPose {
  const dance = state === 'playing' ? Math.sin(elapsed * 7.2 + (side < 0 ? 0 : Math.PI)) : 0
  const flap = state === 'flapping' ? Math.sin(elapsed * 11.5 + (side < 0 ? 0 : Math.PI)) : 0
  const ballKick = state === 'playing-ball' ? Math.sin(frame.ballProgress * Math.PI * 8 + (side < 0 ? 0 : Math.PI)) : 0
  let x = -.04 - frame.jumpLanding * .28 - Math.abs(dance) * .08
  let z = side * dance * .18
  if (state === 'flapping') { x = -.22 - Math.abs(flap) * .48; z = side * flap * .5 }
  else if (state === 'playing-ball') { x = -.1 - Math.abs(ballKick) * .18; z = side * ballKick * .22 }
  else if (state === 'resting') { x = mix(-.04, .88, frame.restingPose); z = side * .36 * frame.restingPose }
  else if (state === 'sleeping') { x = .42; z = side * .2 }
  else if (state === 'cloud-nap') { x = .62 * frame.cloudNapPose; z = side * .42 * frame.cloudNapPose }
  else if (state === 'backflip') { x = -.04 - frame.backflipTuck * .76 + frame.backflipLand * .3; z = side * frame.backflipTuck * .34 }
  else if (state === 'diving-catch') { x = -.12 - frame.catchLaunch * .48 + frame.catchLand * .42; z = side * frame.catchAir * .18 }
  else if (state === 'tail-tornado') { x = -.2 - frame.tornadoStrength * .18; z = side * frame.tornadoStrength * .32 }
  else if (state === 'star-juggle') { x = -.08 - Math.abs(frame.juggleWave) * .1; z = side * frame.juggleWave * .12 }
  return { x, z }
}
