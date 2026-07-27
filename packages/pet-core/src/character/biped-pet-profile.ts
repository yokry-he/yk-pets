/**
 * 文件职责 / File responsibility
 * 提供站内参数化双足萌宠的版本化基础骨架、关节限制、足底接触点和语义 Socket。
 */

import type { CharacterRigProfile, CharacterSide, RigVector3 } from './rig-profile'

const ZERO: RigVector3 = [0, 0, 0]
const IDENTITY = [0, 0, 0, 1] as const
const radians = (degrees: number) => degrees * Math.PI / 180

const bone = (id: string, parentId: string | undefined, semantic: string, side: CharacterSide, restPosition: RigVector3) => ({
  id,
  ...(parentId ? { parentId } : {}),
  semantic,
  side,
  restPosition,
  restRotation: IDENTITY,
})

const limit = (boneId: string, minimum: RigVector3, maximum: RigVector3, bendAxis?: RigVector3) => ({
  boneId,
  minimum,
  maximum,
  ...(bendAxis ? { bendAxis } : {}),
})

export const BIPED_PET_RIG_PROFILE: CharacterRigProfile = {
  id: 'biped-pet/v1',
  bones: [
    bone('root', undefined, 'root', 'center', ZERO),
    bone('pelvis', 'root', 'pelvis', 'center', [0, 1.05, 0]),
    bone('spine.lower', 'pelvis', 'spine.lower', 'center', [0, .24, 0]),
    bone('spine.middle', 'spine.lower', 'spine.middle', 'center', [0, .24, 0]),
    bone('spine.upper', 'spine.middle', 'spine.upper', 'center', [0, .24, 0]),
    bone('chest', 'spine.upper', 'chest', 'center', [0, .24, 0]),
    bone('neck', 'chest', 'neck', 'center', [0, .22, 0]),
    bone('head', 'neck', 'head', 'center', [0, .24, .03]),

    bone('clavicle.left', 'chest', 'clavicle.left', 'left', [-.2, .14, 0]),
    bone('upper-arm.left', 'clavicle.left', 'upperArm.left', 'left', [-.3, -.04, 0]),
    bone('elbow.left', 'upper-arm.left', 'elbow.left', 'left', [-.3, -.04, 0]),
    bone('forearm.left', 'elbow.left', 'forearm.left', 'left', [-.22, -.03, 0]),
    bone('wrist.left', 'forearm.left', 'wrist.left', 'left', [-.14, 0, 0]),
    bone('hand.left', 'wrist.left', 'hand.left', 'left', [-.12, 0, .02]),
    bone('clavicle.right', 'chest', 'clavicle.right', 'right', [.2, .14, 0]),
    bone('upper-arm.right', 'clavicle.right', 'upperArm.right', 'right', [.3, -.04, 0]),
    bone('elbow.right', 'upper-arm.right', 'elbow.right', 'right', [.3, -.04, 0]),
    bone('forearm.right', 'elbow.right', 'forearm.right', 'right', [.22, -.03, 0]),
    bone('wrist.right', 'forearm.right', 'wrist.right', 'right', [.14, 0, 0]),
    bone('hand.right', 'wrist.right', 'hand.right', 'right', [.12, 0, .02]),

    bone('hip.left', 'pelvis', 'hip.left', 'left', [-.18, -.1, 0]),
    bone('thigh.left', 'hip.left', 'thigh.left', 'left', [0, -.42, 0]),
    bone('knee.left', 'thigh.left', 'knee.left', 'left', [0, -.4, .02]),
    bone('calf.left', 'knee.left', 'calf.left', 'left', [0, -.38, -.02]),
    bone('ankle.left', 'calf.left', 'ankle.left', 'left', [0, -.18, 0]),
    bone('foot.left', 'ankle.left', 'foot.left', 'left', [0, -.08, .14]),
    bone('toe.left', 'foot.left', 'toe.left', 'left', [0, 0, .18]),
    bone('hip.right', 'pelvis', 'hip.right', 'right', [.18, -.1, 0]),
    bone('thigh.right', 'hip.right', 'thigh.right', 'right', [0, -.42, 0]),
    bone('knee.right', 'thigh.right', 'knee.right', 'right', [0, -.4, .02]),
    bone('calf.right', 'knee.right', 'calf.right', 'right', [0, -.38, -.02]),
    bone('ankle.right', 'calf.right', 'ankle.right', 'right', [0, -.18, 0]),
    bone('foot.right', 'ankle.right', 'foot.right', 'right', [0, -.08, .14]),
    bone('toe.right', 'foot.right', 'toe.right', 'right', [0, 0, .18]),
  ],
  semanticBones: {
    root: 'root', pelvis: 'pelvis', chest: 'chest', head: 'head',
    'hand.left': 'hand.left', 'hand.right': 'hand.right',
    'foot.left': 'foot.left', 'foot.right': 'foot.right',
  },
  optionalChains: [
    { id: 'ears', rootBoneId: 'head', defaultSegments: 2 },
    { id: 'tail', rootBoneId: 'pelvis', defaultSegments: 3 },
    { id: 'antennae', rootBoneId: 'head', defaultSegments: 2 },
  ],
  jointLimits: [
    limit('neck', [radians(-35), radians(-55), radians(-30)], [radians(45), radians(55), radians(30)]),
    limit('head', [radians(-40), radians(-70), radians(-35)], [radians(50), radians(70), radians(35)]),
    limit('upper-arm.left', [radians(-90), radians(-80), radians(-110)], [radians(120), radians(80), radians(110)]),
    limit('upper-arm.right', [radians(-90), radians(-80), radians(-110)], [radians(120), radians(80), radians(110)]),
    limit('elbow.left', [0, radians(-10), radians(-15)], [radians(145), radians(10), radians(15)], [1, 0, 0]),
    limit('elbow.right', [0, radians(-10), radians(-15)], [radians(145), radians(10), radians(15)], [1, 0, 0]),
    limit('wrist.left', [radians(-55), radians(-25), radians(-40)], [radians(55), radians(25), radians(40)]),
    limit('wrist.right', [radians(-55), radians(-25), radians(-40)], [radians(55), radians(25), radians(40)]),
    limit('thigh.left', [radians(-100), radians(-45), radians(-35)], [radians(110), radians(45), radians(35)]),
    limit('thigh.right', [radians(-100), radians(-45), radians(-35)], [radians(110), radians(45), radians(35)]),
    limit('knee.left', [0, radians(-8), radians(-8)], [radians(155), radians(8), radians(8)], [1, 0, 0]),
    limit('knee.right', [0, radians(-8), radians(-8)], [radians(155), radians(8), radians(8)], [1, 0, 0]),
    limit('ankle.left', [radians(-35), radians(-18), radians(-22)], [radians(45), radians(18), radians(22)]),
    limit('ankle.right', [radians(-35), radians(-18), radians(-22)], [radians(45), radians(18), radians(22)]),
  ],
  contacts: [
    { id: 'foot.left', boneId: 'foot.left', kind: 'foot', localPosition: [0, -.08, .08], localRotation: IDENTITY },
    { id: 'foot.right', boneId: 'foot.right', kind: 'foot', localPosition: [0, -.08, .08], localRotation: IDENTITY },
  ],
  sockets: [
    { id: 'hand.left', boneId: 'hand.left', localPosition: ZERO, localRotation: IDENTITY },
    { id: 'hand.right', boneId: 'hand.right', localPosition: ZERO, localRotation: IDENTITY },
    { id: 'foot.left', boneId: 'foot.left', localPosition: [0, -.06, .08], localRotation: IDENTITY },
    { id: 'foot.right', boneId: 'foot.right', localPosition: [0, -.06, .08], localRotation: IDENTITY },
    { id: 'head', boneId: 'head', localPosition: [0, .18, .03], localRotation: IDENTITY },
    { id: 'back', boneId: 'chest', localPosition: [0, .02, -.14], localRotation: IDENTITY },
    { id: 'tail.base', boneId: 'pelvis', localPosition: [0, .06, -.13], localRotation: IDENTITY },
  ],
}
