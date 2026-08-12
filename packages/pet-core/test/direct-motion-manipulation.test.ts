/**
 * 文件职责 / File responsibility
 * 验证直接动作操控能力和快速姿势卡只引用正式控制，并保持对称和不可变边界。
 * Verifies direct motion capabilities and quick pose cards only use registered controls with stable symmetric immutable boundaries.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyDirectMotionPoseCard,
  DIRECT_MOTION_POSE_CARDS,
  getCloudFoxRigChannel,
  getDirectMotionCapability,
  getMotionBodyPartControls,
  getDirectMotionPoseCards,
  isMotionControlId,
  solveDirectMotionDrag,
  type MotionBodyPartId,
  type MotionControlId,
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

function isOwnedControlId(controlIds: readonly MotionControlId[], value: string): value is MotionControlId {
  return isMotionControlId(value) && controlIds.includes(value)
}

function parameterFor(partId: MotionBodyPartId, controlId: MotionControlId) {
  const parameter = getDirectMotionCapability(partId)?.parameters.find(item => item.controlId === controlId)
  assert.ok(parameter, `${partId} 应提供 ${controlId} 的直接操控参数`)
  return parameter
}

function assertFinitePose(pose: Readonly<Partial<Record<MotionControlId, number>>>) {
  assert.ok(Object.values(pose).every(value => Number.isFinite(value)), '姿势中的每个值都必须是有限数')
}

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
      assert.ok(isOwnedControlId(capability.controlIds, controlId), `${card.id} 不应引用 ${card.partId} 以外的控制`)
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
      assert.ok(cards.every(card => Object.keys(card.pose).every(controlId => isOwnedControlId(capability.controlIds, controlId))))
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

test('直接操控参数使用明确的新手语义，且同一部位同一模式不重名', () => {
  assert.deepEqual(parameterFor('body', 'body.rotate.z'), {
    semantic: 'lean',
    labelZh: '身体侧倾',
    controlId: 'body.rotate.z',
  })
  assert.deepEqual(parameterFor('head', 'head.rotate.z'), {
    semantic: 'head-tilt',
    labelZh: '头部歪斜',
    controlId: 'head.rotate.z',
  })
  assert.deepEqual(parameterFor('tail-root', 'tail-root.rotate.z'), {
    semantic: 'tail-sway',
    labelZh: '尾巴摆动',
    controlId: 'tail-root.rotate.z',
  })
  assert.deepEqual(parameterFor('front-paw-left', 'front-paw-left.rotate.tip-z'), {
    semantic: 'tip-direction',
    labelZh: '爪尖方向',
    controlId: 'front-paw-left.rotate.tip-z',
  })

  for (const partId of formalPartIds) {
    const capability = getDirectMotionCapability(partId)!
    for (const mode of capability.modes) {
      const controlIds = new Set(getMotionBodyPartControls(partId, mode).map(control => control.id))
      const semantics = capability.parameters
        .filter(parameter => controlIds.has(parameter.controlId))
        .map(parameter => parameter.semantic)
      assert.equal(new Set(semantics).size, semantics.length, `${partId} 的 ${mode} 参数语义必须唯一`)
    }
  }
})

test('关键左右姿势卡使用真实的镜像反号', () => {
  const leftFrontPaw = DIRECT_MOTION_POSE_CARDS.find(card => card.id === 'front-paw-left-raise-hand')!
  const rightFrontPaw = DIRECT_MOTION_POSE_CARDS.find(card => card.id === 'front-paw-right-raise-hand')!
  const leftEar = DIRECT_MOTION_POSE_CARDS.find(card => card.id === 'ear-left-perk')!
  const rightEar = DIRECT_MOTION_POSE_CARDS.find(card => card.id === 'ear-right-perk')!

  assert.equal(leftFrontPaw.pose['front-paw-left.rotate.z'], -.85)
  assert.equal(rightFrontPaw.pose['front-paw-right.rotate.z'], .85)
  assert.equal(leftFrontPaw.pose['front-paw-left.rotate.z'], -rightFrontPaw.pose['front-paw-right.rotate.z']!)
  assert.equal(leftEar.pose['ear-left.rotate.z'], .3)
  assert.equal(rightEar.pose['ear-right.rotate.z'], -.3)
  assert.equal(leftEar.pose['ear-left.rotate.z'], -rightEar.pose['ear-right.rotate.z']!)
})

test('直接拖拽求解稳定、无副作用且输出冻结的有限姿势', () => {
  const input = {
    partId: 'body' as const,
    mode: 'translate' as const,
    delta: { x: 40, y: -20, depth: 10 },
    viewport: { width: 900, height: 600 },
    pose: { 'head.rotate.x': .2, 'body.translate.x': .1 },
  }
  const before = structuredClone(input)

  const first = solveDirectMotionDrag(input)
  const second = solveDirectMotionDrag(input)

  assert.deepEqual(first, second)
  assert.notEqual(first.pose, second.pose)
  assert.notEqual(first.diagnostics, second.diagnostics)
  assert.deepEqual(input, before)
  assert.equal(first.status, 'ready')
  assertFinitePose(first.pose)
  assert.ok(Object.isFrozen(first.pose))
  assert.ok(Object.isFrozen(first.diagnostics))
})

test('旋转拖拽通过能力的显式语义映射前爪控制', () => {
  const result = solveDirectMotionDrag({
    partId: 'front-paw-left',
    mode: 'rotate',
    delta: { x: 12, y: -24, depth: 8 },
    viewport: { width: 1_000, height: 500 },
    pose: {},
  })

  assert.equal(result.status, 'ready')
  assert.ok(result.pose['front-paw-left.rotate.x']! > 0, 'swing 应使用 -dy')
  assert.ok(result.pose['front-paw-left.rotate.y']! > 0, 'twist 应使用 depth')
  assert.ok(result.pose['front-paw-left.rotate.z']! > 0, 'spread 应使用 dx')
  assert.ok(result.pose['front-paw-left.rotate.tip-x']! > 0, 'bend 应使用 -dy')
})

test('超大有限拖拽按真实 Rig 通道范围钳制，而非通用角度范围', () => {
  const result = solveDirectMotionDrag({
    partId: 'root',
    mode: 'translate',
    delta: { x: 1e12, y: 0, depth: 0 },
    viewport: { width: 1, height: 1 },
    pose: {},
  })

  assert.equal(result.status, 'clamped')
  assert.equal(result.pose['root.translate.x'], getCloudFoxRigChannel('root.position.x').maximum)
  assert.ok(result.pose['root.translate.x']! > Math.PI)
})

test('畸形拖拽输入安全阻断并返回独立的有限冻结姿势', () => {
  const throwingPose = new Proxy({}, {
    ownKeys() {
      throw new Error('不可枚举')
    },
  }) as Readonly<Partial<Record<MotionControlId, number>>>
  const inputs = [
    {
      partId: 'body' as MotionBodyPartId,
      mode: 'translate' as const,
      delta: { x: Number.NaN, y: 0, depth: 0 },
      viewport: { width: 800, height: 600 },
      pose: {},
    },
    {
      partId: 'body' as MotionBodyPartId,
      mode: 'translate' as const,
      delta: { x: 0, y: 0, depth: 0 },
      viewport: { width: 0, height: 600 },
      pose: {},
    },
    {
      partId: 'body' as MotionBodyPartId,
      mode: 'scale' as never,
      delta: { x: 0, y: 0, depth: 0 },
      viewport: { width: 800, height: 600 },
      pose: { 'body.rotate.x': Number.POSITIVE_INFINITY, unknown: 1 } as never,
    },
    {
      partId: 'body' as MotionBodyPartId,
      mode: 'translate' as const,
      delta: { x: 0, y: 0, depth: 0 },
      viewport: { width: 800, height: 600 },
      pose: throwingPose,
    },
  ]

  for (const input of inputs) {
    const result = solveDirectMotionDrag(input)
    assert.equal(result.status, 'blocked')
    assert.ok(result.diagnostics.length > 0 && result.diagnostics.length <= 4)
    assert.ok(result.diagnostics.every(item => /[\u4e00-\u9fff]/u.test(item)))
    assertFinitePose(result.pose)
    assert.ok(Object.isFrozen(result.pose))
    assert.ok(Object.isFrozen(result.diagnostics))
    assert.notEqual(result.pose, input.pose)
  }
})

test('撤销后的 Proxy 姿势不会让拖拽求解抛出', () => {
  const revocable = Proxy.revocable({ 'body.rotate.x': .1 }, {})
  revocable.revoke()

  const result = solveDirectMotionDrag({
    partId: 'body',
    mode: 'rotate',
    delta: { x: 0, y: 0, depth: 0 },
    viewport: { width: 800, height: 600 },
    pose: revocable.proxy as Readonly<Partial<Record<MotionControlId, number>>>,
  })

  assert.equal(result.status, 'blocked')
  assert.ok(result.diagnostics.length > 0 && result.diagnostics.length <= 4)
  assert.ok(result.diagnostics.every(item => /[\u4e00-\u9fff]/u.test(item)))
  assertFinitePose(result.pose)
  assert.ok(Object.isFrozen(result.pose))
  assert.ok(Object.isFrozen(result.diagnostics))
})

test('姿势卡精确合并、保留其余姿势并保持不可变边界', () => {
  const pose = { 'head.rotate.x': .18, 'front-paw-left.rotate.z': -.1 }
  const before = structuredClone(pose)
  const result = applyDirectMotionPoseCard(pose, 'front-paw-left-raise-hand')

  assert.equal(result.status, 'ready')
  assert.equal(result.pose['head.rotate.x'], .18)
  assert.equal(result.pose['front-paw-left.rotate.z'], -.85)
  assert.deepEqual(pose, before)
  assert.notEqual(result.pose, pose)
  assert.ok(Object.isFrozen(result.pose))
  assert.ok(Object.isFrozen(result.diagnostics))
})

test('未知姿势卡安全阻断，左右镜像卡分别写入正确的真实控制', () => {
  const source = { 'head.rotate.x': .1 }
  const unknown = applyDirectMotionPoseCard(source, 'missing-card')
  const left = applyDirectMotionPoseCard({}, 'front-paw-left-raise-hand')
  const right = applyDirectMotionPoseCard({}, 'front-paw-right-raise-hand')

  assert.equal(unknown.status, 'blocked')
  assert.deepEqual(unknown.pose, source)
  assert.notEqual(unknown.pose, source)
  assert.ok(unknown.diagnostics.length > 0 && unknown.diagnostics.length <= 4)
  assert.equal(left.pose['front-paw-left.rotate.z'], -.85)
  assert.equal(right.pose['front-paw-right.rotate.z'], .85)
  assert.equal(left.pose['front-paw-right.rotate.z'], undefined)
  assert.equal(right.pose['front-paw-left.rotate.z'], undefined)
})

test('撤销后的 Proxy 姿势不会让姿势卡应用抛出', () => {
  const revocable = Proxy.revocable({ 'head.rotate.x': .1 }, {})
  revocable.revoke()

  const result = applyDirectMotionPoseCard(
    revocable.proxy as Readonly<Partial<Record<MotionControlId, number>>>,
    'head-nod',
  )

  assert.equal(result.status, 'blocked')
  assert.ok(result.diagnostics.length > 0 && result.diagnostics.length <= 4)
  assert.ok(result.diagnostics.every(item => /[\u4e00-\u9fff]/u.test(item)))
  assertFinitePose(result.pose)
  assert.ok(Object.isFrozen(result.pose))
  assert.ok(Object.isFrozen(result.diagnostics))
})
