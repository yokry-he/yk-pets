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

test('正式身体部位都有仅含位移或旋转的直接操控能力', () => {
  for (const partId of formalPartIds) {
    const capability = getDirectMotionCapability(partId)
    assert.ok(capability, `${partId} 应具有直接操控能力`)
    assert.ok(capability.modes.length > 0)
    assert.ok(capability.modes.every(mode => mode === 'translate' || mode === 'rotate'))
    assert.ok(capability.controlIds.length > 0)
    assert.ok(capability.parameters.every(parameter => capability.controlIds.includes(parameter.controlId)))
  }
})

test('快速姿势卡只引用所属部位能力的控制，功夫左前爪含抬手', () => {
  assert.ok(DIRECT_MOTION_POSE_CARDS.length > 0)
  for (const card of DIRECT_MOTION_POSE_CARDS) {
    const capability = getDirectMotionCapability(card.partId)
    assert.ok(capability, `${card.partId} 应具有直接操控能力`)
    for (const controlId of Object.keys(card.pose)) {
      assert.ok(capability.controlIds.includes(controlId as never), `${card.id} 不应引用 ${card.partId} 以外的控制`)
    }
  }
  assert.ok(getDirectMotionPoseCards('front-paw-left', 'martial-arts').some(card => card.labelZh === '抬手'))
})

test('能力和姿势卡保持唯一、显式镜像且不泄露可变共享引用', () => {
  assert.equal(new Set(DIRECT_MOTION_POSE_CARDS.map(card => card.id)).size, DIRECT_MOTION_POSE_CARDS.length)

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
  assert.deepEqual(firstCards, secondCards)
})
