/*
 * 文件职责 / File responsibility
 * 分别定义云狐身体与头部的几何、经典挂点倍率、贴合面和边界；身体切换绝不隐式改变头型。
 * Separately defines Cloud Fox body/head geometry, classic-anchor multipliers, fitted surfaces, and bounds; body changes never alter the head implicitly.
 */
import type { CloudFoxBodyShape, CloudFoxHeadShape } from './cloud-fox-appearance'

export interface CloudFoxBodyProfile {
  id: CloudFoxBodyShape
  geometry: 'sphere' | 'ellipsoid' | 'capsule' | 'pear' | 'bean' | 'rounded-cube'
  scale: readonly [number, number, number]
  offset: readonly [number, number, number]
  /** Multiplier over the production front-paw X anchor. */
  frontPawX: number
  /** Additive Y offset over the production front-paw anchor. */
  frontPawY: number
  /** Multiplier over the production front-paw Z anchor. */
  frontPawDepth: number
  hindPawX: number
  hindPawY: number
  hindPawDepth: number
  bellyScale: readonly [number, number]
  bellyOffset: readonly [number, number]
  bellyDepth: number
  bellyCurvature: number
  chestDepth: number
  backDepth: number
  tailOffset: readonly [number, number, number]
  boundsScale: readonly [number, number, number]
}

export interface CloudFoxHeadProfile {
  id: CloudFoxHeadShape
  geometry: 'sphere' | 'oval' | 'capsule' | 'bean' | 'rounded-cube'
  scale: readonly [number, number, number]
  offset: readonly [number, number, number]
  rotationZ: number
  eyeX: number
  eyeY: number
  eyeZ: number
  earX: number
  earY: number
  antennaY: number
  muzzleScale: readonly [number, number, number]
  muzzleOffset: readonly [number, number, number]
  faceDepth: number
  boundsScale: readonly [number, number, number]
}

const BODY_PROFILES: Readonly<Record<CloudFoxBodyShape, CloudFoxBodyProfile>> = {
  sphere: {
    id: 'sphere', geometry: 'sphere', scale: [1.02, 1.02, 1.02], offset: [0, 0, 0],
    frontPawX: 1.02, frontPawY: .02, frontPawDepth: 1.02, hindPawX: .49, hindPawY: -.94, hindPawDepth: .12,
    bellyScale: [.88, .88], bellyOffset: [0, -.03], bellyDepth: .87, bellyCurvature: .22,
    chestDepth: .9, backDepth: -.9, tailOffset: [-.04, 0, -.02], boundsScale: [1.08, 1.06, 1.08],
  },
  ellipsoid: {
    id: 'ellipsoid', geometry: 'ellipsoid', scale: [1, 1, 1], offset: [0, 0, 0],
    frontPawX: 1, frontPawY: 0, frontPawDepth: 1, hindPawX: .49, hindPawY: -.94, hindPawDepth: .12,
    bellyScale: [1, 1], bellyOffset: [0, 0], bellyDepth: .83, bellyCurvature: .25,
    chestDepth: .88, backDepth: -.88, tailOffset: [0, 0, 0], boundsScale: [1, 1, 1],
  },
  capsule: {
    id: 'capsule', geometry: 'capsule', scale: [.88, 1.08, .94], offset: [0, -.01, 0],
    frontPawX: .9, frontPawY: .02, frontPawDepth: 1, hindPawX: .43, hindPawY: -.98, hindPawDepth: .11,
    bellyScale: [.8, 1.03], bellyOffset: [0, -.02], bellyDepth: .86, bellyCurvature: .17,
    chestDepth: .91, backDepth: -.91, tailOffset: [0, -.03, -.02], boundsScale: [1, 1.14, 1.05],
  },
  pear: {
    id: 'pear', geometry: 'pear', scale: [1.02, 1.06, 1], offset: [0, -.08, 0],
    frontPawX: 1.08, frontPawY: -.06, frontPawDepth: 1.02, hindPawX: .54, hindPawY: -.98, hindPawDepth: .12,
    bellyScale: [1.03, 1], bellyOffset: [0, -.1], bellyDepth: .87, bellyCurvature: .23,
    chestDepth: .92, backDepth: -.92, tailOffset: [0, -.08, -.03], boundsScale: [1.08, 1.08, 1.08],
  },
  bean: {
    id: 'bean', geometry: 'bean', scale: [1.02, 1.01, 1], offset: [-.02, -.02, 0],
    frontPawX: 1, frontPawY: -.02, frontPawDepth: 1.02, hindPawX: .5, hindPawY: -.94, hindPawDepth: .12,
    bellyScale: [.94, .94], bellyOffset: [-.04, -.04], bellyDepth: .87, bellyCurvature: .2,
    chestDepth: .91, backDepth: -.91, tailOffset: [-.06, -.02, -.02], boundsScale: [1.12, 1.05, 1.08],
  },
  'rounded-cube': {
    id: 'rounded-cube', geometry: 'rounded-cube', scale: [.98, .98, .96], offset: [0, -.02, 0],
    frontPawX: 1.06, frontPawY: .01, frontPawDepth: 1.05, hindPawX: .48, hindPawY: -.94, hindPawDepth: .14,
    bellyScale: [.88, .88], bellyOffset: [0, -.02], bellyDepth: .96, bellyCurvature: .06,
    chestDepth: .98, backDepth: -.98, tailOffset: [0, -.01, -.06], boundsScale: [1.08, 1.04, 1.08],
  },
}

const HEAD_PROFILES: Readonly<Record<CloudFoxHeadShape, CloudFoxHeadProfile>> = {
  'classic-round': {
    id: 'classic-round', geometry: 'sphere', scale: [1, 1, 1], offset: [0, 0, 0], rotationZ: 0,
    eyeX: 1, eyeY: 0, eyeZ: 0, earX: 1, earY: 0, antennaY: 0,
    muzzleScale: [1, 1, 1], muzzleOffset: [0, 0, 0], faceDepth: 0, boundsScale: [1, 1, 1],
  },
  'wide-round': {
    id: 'wide-round', geometry: 'sphere', scale: [1.12, .94, .98], offset: [0, 0, 0], rotationZ: 0,
    eyeX: 1.08, eyeY: -.01, eyeZ: .015, earX: 1.08, earY: -.01, antennaY: -.01,
    muzzleScale: [1.08, .94, .98], muzzleOffset: [0, -.012, .015], faceDepth: .015, boundsScale: [1.12, .96, 1],
  },
  oval: {
    id: 'oval', geometry: 'oval', scale: [.94, 1.1, .98], offset: [0, .025, 0], rotationZ: 0,
    eyeX: .95, eyeY: .02, eyeZ: .012, earX: .96, earY: .025, antennaY: .04,
    muzzleScale: [.94, 1.02, 1], muzzleOffset: [0, -.008, .014], faceDepth: .014, boundsScale: [.98, 1.1, 1],
  },
  capsule: {
    id: 'capsule', geometry: 'capsule', scale: [.92, 1.08, .96], offset: [0, .03, 0], rotationZ: 0,
    eyeX: .94, eyeY: .025, eyeZ: .014, earX: .95, earY: .035, antennaY: .05,
    muzzleScale: [.94, 1.03, 1], muzzleOffset: [0, -.008, .016], faceDepth: .016, boundsScale: [.96, 1.1, 1],
  },
  bean: {
    id: 'bean', geometry: 'bean', scale: [1.02, .96, .98], offset: [-.035, .01, 0], rotationZ: -.06,
    eyeX: 1.02, eyeY: 0, eyeZ: .014, earX: 1.02, earY: .01, antennaY: .015,
    muzzleScale: [1, .96, 1], muzzleOffset: [.015, -.005, .016], faceDepth: .016, boundsScale: [1.08, 1, 1],
  },
  'rounded-cube': {
    id: 'rounded-cube', geometry: 'rounded-cube', scale: [1.03, .96, .96], offset: [0, .01, 0], rotationZ: 0,
    eyeX: 1.06, eyeY: -.01, eyeZ: .035, earX: 1.06, earY: .01, antennaY: .015,
    muzzleScale: [1, .9, .92], muzzleOffset: [0, -.018, .052], faceDepth: .052, boundsScale: [1.08, 1, 1.04],
  },
}

export function getCloudFoxBodyProfile(shape: CloudFoxBodyShape): CloudFoxBodyProfile { return BODY_PROFILES[shape] || BODY_PROFILES.ellipsoid }
export function getCloudFoxHeadProfile(shape: CloudFoxHeadShape): CloudFoxHeadProfile { return HEAD_PROFILES[shape] || HEAD_PROFILES['classic-round'] }
/** @deprecated compatibility alias for older gates; only returns the body profile. */
export function getCloudFoxShapeProfile(shape: CloudFoxBodyShape): CloudFoxBodyProfile { return getCloudFoxBodyProfile(shape) }
