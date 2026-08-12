/**
 * 文件职责 / File responsibility
 * 验证直接动作操控能力和快速姿势卡只引用正式控制，并保持对称和不可变边界。
 * Verifies direct motion capabilities and quick pose cards only use registered controls with stable symmetric immutable boundaries.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIRECT_MOTION_POSE_CARDS,
  getDirectMotionCapability,
  getMotionBodyPartControls,
  getDirectMotionPoseCards,
  type MotionBodyPartId,
} from '../src/index.ts'

const formalPartIds: readonly MotionBodyPartId[] = [
  'root',
  'body',
  'head',
  'front-paw-left',
  'front-paw-right',
  'hind-paw-left',
  'hind-paw-right',
  'ear-left',
  'ear-right',
  'tail-root',
  'tail-mid',
  'tail-tip',
]

const expectedPoseCardIds = [
  'root-rise',
  'body-lean',
  'head-nod',
  'head-tilt',
  'front-paw-left-raise-hand',
  'front-paw-right-raise-hand',
  'hind-paw-left-kick-back',
  'hind-paw-right-kick-back',
  'ear-left-perk',
  'ear-right-perk',
  'tail-root-sway',
  'tail-mid-sway',
  'tail-tip-flick',
]

test('正式身体部位都有仅含位移或旋转的直接操控能力', () => {
  for (const partId of formalPartIds) {
    const capability = getDirectMotionCapability(partId)
    assert.ok(capability, `${partId} 应具有直接操控能力`)
    assert.ok(capability.modes.length > 0)
    assert.ok(capability.modes.every(mode => mode === 'translate' || mode === 'rotate'))
    assert.ok(capability.controlIds.length > 0)
    const registeredControlIds = [...new Set(
      capability.modes.flatMap(mode => getMotionBodyPartControls(partId, mode).map(control => control.id)),
    )]
    assert.deepEqual(capability.controlIds, registeredControlIds)
    assert.ok(capability.parameters.every(parameter => registeredControlIds.includes(parameter.controlId)))
  }
})

test('快速姿势卡覆盖六类部位且只引用所属能力的控制，功夫左前爪含抬手', () => {
  assert.ok(DIRECT_MOTION_POSE_CARDS.length > 0)
  for (const card of DIRECT_MOTION_POSE_CARDS) {
    const capability = getDirectMotionCapability(card.partId)
    assert.ok(capability, `${card.partId} 应具有直接操控能力`)
    for (const controlId of Object.keys(card.pose)) {
      assert.ok(capability.controlIds.includes(controlId as never), `${card.id} 不应引用 ${card.partId} 以外的控制`)
    }
  }
  assert.ok(getDirectMotionPoseCards('front-paw-left', 'martial-arts').some(card => card.labelZh === '抬手'))

  const requiredPartGroups: readonly (readonly MotionBodyPartId[])[] = [
    ['head'],
    ['body'],
    ['front-paw-left', 'front-paw-right'],
    ['hind-paw-left', 'hind-paw-right'],
    ['ear-left', 'ear-right'],
    ['tail-root', 'tail-mid', 'tail-tip'],
  ]
  for (const partIds of requiredPartGroups) {
    for (const partId of partIds) {
      const cards = DIRECT_MOTION_POSE_CARDS.filter(card => card.partId === partId)
      const capability = getDirectMotionCapability(partId)!
      assert.ok(cards.length > 0, `${partId} 应具有快速姿势卡`)
      assert.ok(cards.every(card => Object.keys(card.pose).every(controlId => capability.controlIds.includes(controlId as never))))
    }
  }
})

test('能力和姿势卡保持唯一、显式镜像、冻结边界和稳定顺序', () => {
  assert.equal(new Set(DIRECT_MOTION_POSE_CARDS.map(card => card.id)).size, DIRECT_MOTION_POSE_CARDS.length)
  assert.deepEqual(DIRECT_MOTION_POSE_CARDS.map(card => card.id), expectedPoseCardIds)
  assert.ok(Object.isFrozen(DIRECT_MOTION_POSE_CARDS))
  for (const card of DIRECT_MOTION_POSE_CARDS) {
    assert.ok(Object.isFrozen(card))
    assert.ok(Object.isFrozen(card.intents))
    assert.ok(Object.isFrozen(card.pose))
  }

  for (const partId of formalPartIds) {
    const capability = getDirectMotionCapability(partId)!
    assert.ok(Object.isFrozen(capability))
    assert.ok(Object.isFrozen(capability.modes))
    assert.ok(Object.isFrozen(capability.controlIds))
    assert.ok(Object.isFrozen(capability.parameters))
    assert.ok(capability.parameters.every(parameter => Object.isFrozen(parameter)))
  }

  const leftCards = getDirectMotionPoseCards('front-paw-left', 'martial-arts')
  const rightCards = getDirectMotionPoseCards('front-paw-right', 'martial-arts')
  assert.ok(leftCards.some(card => card.labelZh === '抬手' && Object.keys(card.pose).every(id => id.startsWith('front-paw-left.'))))
  assert.ok(rightCards.some(card => card.labelZh === '抬手' && Object.keys(card.pose).every(id => id.startsWith('front-paw-right.'))))

  const firstCapability = getDirectMotionCapability('head')!
  const secondCapability = getDirectMotionCapability('head')!
  assert.notEqual(firstCapability, secondCapability)
  assert.notEqual(firstCapability.controlIds, secondCapability.controlIds)
  assert.deepEqual(firstCapability, secondCapability)

  const firstCards = getDirectMotionPoseCards('head', 'daily')
  const secondCards = getDirectMotionPoseCards('head', 'daily')
  assert.notEqual(firstCards, secondCards)
  assert.notEqual(firstCards[0], secondCards[0])
  assert.notEqual(firstCards[0]?.pose, secondCards[0]?.pose)
  assert.ok(Object.isFrozen(firstCards))
  assert.deepEqual(firstCards, secondCards)
})
