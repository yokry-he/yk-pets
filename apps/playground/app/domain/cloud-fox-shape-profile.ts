/**
 * 文件职责 / File responsibility
 * 为六种云狐身体提供共享头部比例、面部挂点、肚皮贴合、边界倍率和形状标识，供 Studio 与扩展唯一渲染器共同消费。
 * Provides shared head proportions, face anchors, belly placement, bounds multipliers, and shape identities for six Cloud Fox bodies used by the sole Studio/extension renderer.
 */
import type { CloudFoxBodyShape } from './cloud-fox-appearance'

export type CloudFoxHeadShape = 'round' | 'ellipsoid' | 'capsule' | 'compact-round' | 'tilted-oval' | 'rounded-cube'

export interface CloudFoxShapeProfile {
  id: CloudFoxBodyShape
  headShape: CloudFoxHeadShape
  headScale: readonly [number, number, number]
  headOffset: readonly [number, number, number]
  headRotationZ: number
  eyeXScale: number
  eyeY: number
  eyeZ: number
  earXScale: number
  muzzleScale: readonly [number, number, number]
  muzzleOffset: readonly [number, number, number]
  faceDepthOffset: number
  bellyWidth: number
  bellyHeight: number
  bellyOffsetY: number
  bodyFrontDepth: number
  boundsScale: readonly [number, number, number]
}

const PROFILES: Readonly<Record<CloudFoxBodyShape, CloudFoxShapeProfile>> = {
  sphere: {
    id: 'sphere', headShape: 'round', headScale: [1.03, 1.03, 1.03], headOffset: [0, .02, 0], headRotationZ: 0,
    eyeXScale: 1.02, eyeY: 0, eyeZ: .015, earXScale: 1.03, muzzleScale: [1, 1, 1.02], muzzleOffset: [0, 0, .012], faceDepthOffset: .012,
    bellyWidth: .92, bellyHeight: .92, bellyOffsetY: -.02, bodyFrontDepth: 1.02, boundsScale: [1.14, 1.05, 1.18],
  },
  ellipsoid: {
    id: 'ellipsoid', headShape: 'ellipsoid', headScale: [1, 1, 1], headOffset: [0, 0, 0], headRotationZ: 0,
    eyeXScale: 1, eyeY: 0, eyeZ: 0, earXScale: 1, muzzleScale: [1, 1, 1], muzzleOffset: [0, 0, 0], faceDepthOffset: 0,
    bellyWidth: 1, bellyHeight: 1, bellyOffsetY: 0, bodyFrontDepth: .86, boundsScale: [1, 1, 1],
  },
  capsule: {
    id: 'capsule', headShape: 'capsule', headScale: [.93, 1.1, .98], headOffset: [0, .06, 0], headRotationZ: 0,
    eyeXScale: .93, eyeY: .025, eyeZ: .012, earXScale: .94, muzzleScale: [.94, 1.04, 1.02], muzzleOffset: [0, -.015, .016], faceDepthOffset: .016,
    bellyWidth: .86, bellyHeight: 1.08, bellyOffsetY: -.04, bodyFrontDepth: .94, boundsScale: [1.02, 1.2, 1.12],
  },
  pear: {
    id: 'pear', headShape: 'compact-round', headScale: [.91, .94, .96], headOffset: [0, .04, 0], headRotationZ: 0,
    eyeXScale: .94, eyeY: .008, eyeZ: .012, earXScale: .94, muzzleScale: [.94, .94, 1], muzzleOffset: [0, -.008, .014], faceDepthOffset: .014,
    bellyWidth: 1.06, bellyHeight: 1.08, bellyOffsetY: -.13, bodyFrontDepth: .98, boundsScale: [1.12, 1.1, 1.14],
  },
  bean: {
    id: 'bean', headShape: 'tilted-oval', headScale: [1.01, .95, .99], headOffset: [-.05, .035, 0], headRotationZ: -.07,
    eyeXScale: 1.02, eyeY: .005, eyeZ: .012, earXScale: 1.02, muzzleScale: [1, .94, 1], muzzleOffset: [.018, -.005, .014], faceDepthOffset: .014,
    bellyWidth: 1.02, bellyHeight: .96, bellyOffsetY: -.06, bodyFrontDepth: .97, boundsScale: [1.2, 1.08, 1.16],
  },
  'rounded-cube': {
    id: 'rounded-cube', headShape: 'rounded-cube', headScale: [1.05, .94, .96], headOffset: [0, .025, -.005], headRotationZ: 0,
    eyeXScale: 1.08, eyeY: -.005, eyeZ: .035, earXScale: 1.08, muzzleScale: [1.02, .9, .9], muzzleOffset: [0, -.015, .055], faceDepthOffset: .055,
    bellyWidth: 1.02, bellyHeight: .94, bellyOffsetY: -.04, bodyFrontDepth: .94, boundsScale: [1.14, 1.08, 1.14],
  },
}

export function getCloudFoxShapeProfile(shape: CloudFoxBodyShape): CloudFoxShapeProfile {
  return PROFILES[shape] || PROFILES.ellipsoid
}
