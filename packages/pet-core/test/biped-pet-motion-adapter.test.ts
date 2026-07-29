/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Quaternion 动作契约、语义映射、Clip 编译与确定性采样。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adaptCloudFoxPoseToBipedPet,
  BIPED_PET_MOTION_ADAPTATION_NAMESPACE,
  BIPED_PET_MOTION_ADAPTER_ID,
  BIPED_PET_RIG_PROFILE,
  CLOUD_FOX_SEMANTIC_RIG_ID,
  compileBipedPetMotion,
  compileBipedPetMotionAdaptationPlan,
  createStudioMotionAsset,
  createNeutralCloudFoxPoseValues,
  motionEulerToQuaternion,
  normalizeMotionQuaternion,
  sampleBipedPetMotion,
  slerpMotionQuaternion,
  type CloudFoxRigChannelId,
  type EvaluatedCloudFoxPose,
  type MotionTrack,
} from '../src/index.ts'

function createPose(values: Partial<Record<CloudFoxRigChannelId, number>>): EvaluatedCloudFoxPose {
  const authoredChannels = Object.keys(values) as CloudFoxRigChannelId[]
  return {
    rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
    requestedTimeMs: 0,
    resolvedTimeMs: 0,
    direction: 1,
    iteration: 0,
    values: { ...createNeutralCloudFoxPoseValues(), ...values },
    authoredChannels,
  }
}

function quaternionDot(left: readonly number[], right: readonly number[]) {
  return Math.abs(left.reduce((sum, value, index) => sum + value * right[index]!, 0))
}

function track(channelId: CloudFoxRigChannelId, points: readonly (readonly [number, number])[]): MotionTrack {
  return {
    id: `track-${channelId}`,
    layerId: 'base',
    channelId,
    muted: false,
    keyframes: points.map(([timeMs, value], index) => ({
      id: `key-${channelId}-${index}`,
      timeMs,
      value,
      interpolation: 'linear',
    })),
  }
}

test('Quaternion 规范化会把零长度和非有限输入恢复为单位旋转', () => {
  assert.deepEqual(normalizeMotionQuaternion([0, 0, 0, 0]), [0, 0, 0, 1])
  assert.deepEqual(normalizeMotionQuaternion([Number.NaN, 0, 0, 1]), [0, 0, 0, 1])

  const normalized = normalizeMotionQuaternion([1, 2, 3, 4])
  assert.ok(Math.abs(Math.hypot(...normalized) - 1) < 1e-12)
})

test('Quaternion 插值使用同半球最短路径并保持有限单位长度', () => {
  const halfway = slerpMotionQuaternion([0, 0, 0, 1], [0, 0, 0, -1], .5)

  assert.ok(halfway.every(Number.isFinite))
  assert.ok(Math.abs(Math.hypot(...halfway) - 1) < 1e-12)
  assert.ok(Math.abs(halfway[3] - 1) < 1e-12)
})

test('Euler 转换和动作适配器身份保持稳定', () => {
  const rotation = motionEulerToQuaternion([Math.PI / 3, -Math.PI / 4, Math.PI / 5])

  assert.equal(BIPED_PET_MOTION_ADAPTER_ID, 'biped-pet-motion-adapter/v1')
  assert.ok(rotation.every(Number.isFinite))
  assert.ok(Math.abs(Math.hypot(...rotation) - 1) < 1e-12)
})

test('语义姿态沿身体与四肢动力链分配到真实骨骼', () => {
  const pose = createPose({
    'body.rotation.y': 1,
    'frontPaw.right.rotation.z': 1.4,
    'hindPaw.left.rotation.x': 9,
  })
  const adapted = adaptCloudFoxPoseToBipedPet(pose, {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })
  const boneIds = adapted.bones.map(item => item.boneId)

  assert.equal(adapted.diagnostics.some(item => item.severity === 'error'), false)
  for (const boneId of ['pelvis', 'chest', 'upper-arm.right', 'forearm.right', 'thigh.left', 'calf.left']) {
    assert.ok(boneIds.includes(boneId), `缺少动力链骨骼 ${boneId}`)
  }
  assert.ok(adapted.bones.every(item => Math.abs(Math.hypot(...item.rotation) - 1) < 1e-8))
})

test('语义映射在生成 Quaternion 前遵守 Profile 关节限制', () => {
  const adapted = adaptCloudFoxPoseToBipedPet(createPose({ 'hindPaw.left.rotation.x': 9 }), {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })
  const thigh = adapted.bones.find(item => item.boneId === 'thigh.left')
  const limit = BIPED_PET_RIG_PROFILE.jointLimits.find(item => item.boneId === 'thigh.left')

  assert.ok(thigh && limit)
  const expected = motionEulerToQuaternion([limit.maximum[0], 0, 0])
  assert.ok(quaternionDot(thigh.rotation, expected) > 1 - 1e-8)
})

test('不存在的可选骨骼链会跳过而不会产生坏引用', () => {
  const adapted = adaptCloudFoxPoseToBipedPet(createPose({
    'tail.root.rotation.z': .4,
    'tail.mid.rotation.z': .8,
    'tail.tip.rotation.z': 1.2,
  }), {
    profile: BIPED_PET_RIG_PROFILE,
    boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id),
  })

  assert.equal(adapted.bones.some(item => item.boneId.startsWith('tail.')), false)
  assert.equal(adapted.diagnostics.some(item => item.severity === 'error'), false)
})

test('动作资产会确定性编译为真实骨骼 Quaternion Clip', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-turn',
    nameZh: '转体测试',
    nameEn: 'Turn fixture',
    durationMs: 1000,
    loopMode: 'once',
    tracks: [
      track('body.rotation.y', [[0, 0], [1000, Math.PI]]),
      track('root.position.x', [[0, 0], [1000, 1]]),
    ],
    createdAt: 1,
    updatedAt: 1,
  })
  const target = { profile: BIPED_PET_RIG_PROFILE, boneIds: BIPED_PET_RIG_PROFILE.bones.map(item => item.id) }
  const first = compileBipedPetMotion(asset, target)
  const second = compileBipedPetMotion(structuredClone(asset), target)

  assert.equal(first.status, 'ready')
  assert.equal(first.hash, second.hash)
  assert.deepEqual(first, second)
  assert.ok(first.boneTracks.some(item => item.boneId === 'pelvis'))
  assert.ok(first.boneTracks.some(item => item.boneId === 'chest'))
  assert.deepEqual(first.rootPositionTrack.map(item => item.timeMs), [0, 1000])
})

test('动作适配扩展会编入 Clip、参与哈希且旧采样调用保持兼容', () => {
  const adaptation = {
    phases: [{ id: 'sweep', role: 'sweep', startMs: 100, endMs: 400, intensity: 1 }],
    warpWindows: [{
      id: 'sweep-warp', phaseId: 'sweep', target: 'stage-forward', translation: true, rotation: false,
      maxDistance: .4, maxTurnRadians: 0,
    }],
    constraints: [],
    effectCues: [],
  }
  const create = (definition?: unknown, loopMode: 'once' | 'loop' | 'ping-pong' = 'loop') => createStudioMotionAsset({
    id: 'motion-adaptation-clip',
    nameZh: '动作适配编译',
    nameEn: 'Adaptation compilation',
    durationMs: 1000,
    loopMode,
    extensions: definition === undefined ? {} : { [BIPED_PET_MOTION_ADAPTATION_NAMESPACE]: definition },
    createdAt: 1,
    updatedAt: 1,
  })
  const clean = compileBipedPetMotion(create())
  const clip = compileBipedPetMotion(create(adaptation))
  const changed = compileBipedPetMotion(create({
    ...adaptation,
    phases: [{ ...adaptation.phases[0]!, id: 'sweep-changed' }],
    warpWindows: [],
  }))

  assert.deepEqual(clean.adaptationDefinition, { phases: [], warpWindows: [], constraints: [], effectCues: [] })
  assert.deepEqual(clip.adaptationDefinition.phases.map(item => item.id), ['sweep'])
  assert.ok(Object.isFrozen(clip.adaptationDefinition.phases[0]))
  assert.notEqual(clip.hash, clean.hash)
  assert.notEqual(clip.hash, changed.hash)
  assert.equal(sampleBipedPetMotion(clip, 1200).adaptation, undefined)

  const adaptationPlan = compileBipedPetMotionAdaptationPlan({
    definition: clip.adaptationDefinition,
    clipHash: clip.hash,
    profileId: clip.profileId,
    characterHash: 'fixture-character',
    characterHeight: 4,
    armReach: { left: 1, right: 1 },
    propRigs: {},
  })
  const loop = sampleBipedPetMotion(clip, 1200, { adaptationPlan })
  assert.equal(loop.resolvedTimeMs, 200)
  assert.deepEqual(loop.adaptation, {
    requestedTimeMs: 1200,
    resolvedTimeMs: 200,
    activePhaseIds: ['sweep'],
    constraintWeights: {},
    activeEffectCueIds: [],
  })

  const pingPongClip = compileBipedPetMotion(create(adaptation, 'ping-pong'))
  const pingPongPlan = compileBipedPetMotionAdaptationPlan({
    definition: pingPongClip.adaptationDefinition,
    clipHash: pingPongClip.hash,
    profileId: pingPongClip.profileId,
    characterHash: 'fixture-character',
    characterHeight: 4,
    armReach: { left: 1, right: 1 },
    propRigs: {},
  })
  const pingPong = sampleBipedPetMotion(pingPongClip, 1800, { adaptationPlan: pingPongPlan })
  assert.equal(pingPong.resolvedTimeMs, 200)
  assert.equal(pingPong.direction, -1)
  assert.deepEqual(pingPong.adaptation?.activePhaseIds, ['sweep'])
})

test('损坏动作适配命名空间只增加 warning 并保留可采样基础动作', () => {
  const damagedAdaptation = new Proxy({}, {
    get() {
      throw new Error('blocked adaptation getter')
    },
  })
  const clip = compileBipedPetMotion(createStudioMotionAsset({
    id: 'motion-damaged-adaptation',
    nameZh: '损坏动作适配',
    nameEn: 'Damaged adaptation',
    durationMs: 1000,
    extensions: { [BIPED_PET_MOTION_ADAPTATION_NAMESPACE]: damagedAdaptation },
    createdAt: 1,
    updatedAt: 1,
  }))

  assert.equal(clip.status, 'ready')
  assert.deepEqual(clip.adaptationDefinition, { phases: [], warpWindows: [], constraints: [], effectCues: [] })
  assert.ok(clip.diagnostics.some(item => item.id.includes('motion-adaptation')))
  assert.doesNotThrow(() => sampleBipedPetMotion(clip, 300))
})

test('Clip 采样使用动作循环时间、Quaternion 最短路径和根位移线性插值', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-loop',
    nameZh: '循环测试',
    nameEn: 'Loop fixture',
    durationMs: 1000,
    loopMode: 'loop',
    tracks: [
      track('head.rotation.z', [[0, 0], [1000, Math.PI / 2]]),
      track('root.position.y', [[0, 0], [1000, 1]]),
    ],
    createdAt: 1,
    updatedAt: 1,
  })
  const clip = compileBipedPetMotion(asset)
  const sample = sampleBipedPetMotion(clip, 1500)

  assert.equal(sample.resolvedTimeMs, 500)
  assert.ok(sample.bones.every(item => Math.abs(Math.hypot(...item.rotation) - 1) < 1e-8))
  assert.ok(Math.abs(sample.rootPosition[1] - .12) < 1e-8)
})

test('损坏 Profile 会阻塞 Clip 且采样安全回退为空姿态', () => {
  const asset = createStudioMotionAsset({ id: 'fixture', nameZh: '测试', nameEn: 'Fixture', durationMs: 1000 })
  const clip = compileBipedPetMotion(asset, { profile: { ...BIPED_PET_RIG_PROFILE, bones: [] } })
  const sample = sampleBipedPetMotion(clip, 100)

  assert.equal(clip.status, 'blocked')
  assert.ok(clip.diagnostics.some(item => item.severity === 'error'))
  assert.deepEqual(sample.bones, [])
  assert.deepEqual(sample.rootPosition, [0, 0, 0])
  assert.equal(sample.sourceMotionId, 'fixture')
  assert.equal(sample.clipHash, clip.hash)
  assert.equal(sample.durationMs, 1000)
  assert.equal(sample.loopMode, 'once')
  assert.deepEqual(sample.contactStates, [])
})

test('接触采样以 80ms 淡入淡出输出确定阶段、权重和置信度', () => {
  const asset = createStudioMotionAsset({
    id: 'motion-contact-loop',
    nameZh: '接触循环测试',
    nameEn: 'Contact loop fixture',
    durationMs: 1200,
    loopMode: 'loop',
    extensions: {
      'yk-pets/biped-motion/v1': {
        contacts: [
          { contactId: 'foot.left', startMs: 0, endMs: 576, confidence: .9 },
          { contactId: 'foot.right', startMs: 600, endMs: 1176, confidence: .8 },
        ],
      },
    },
    createdAt: 1,
    updatedAt: 1,
  })
  const clip = compileBipedPetMotion(asset)

  assert.deepEqual(sampleBipedPetMotion(clip, 40).contactStates, [{ contactId: 'foot.left', phase: 'acquiring', weight: .5, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 200).contactStates, [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 540).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: .45, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 1240).contactStates, sampleBipedPetMotion(clip, 40).contactStates)
  assert.deepEqual(sampleBipedPetMotion(clip, 0).contactStates, [{ contactId: 'foot.left', phase: 'acquiring', weight: 0, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 576).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: 0, confidence: .9 }])
  assert.deepEqual(sampleBipedPetMotion(clip, 0).activeContacts, [])
  assert.deepEqual(sampleBipedPetMotion(clip, 576).activeContacts, [])
})

test('接触采样裁剪极短区间淡变并对 once 与 ping-pong 使用解析后的时间', () => {
  const makeClip = (loopMode: 'once' | 'ping-pong') => compileBipedPetMotion(createStudioMotionAsset({
    id: `motion-contact-${loopMode}`,
    nameZh: '短接触测试',
    nameEn: 'Short contact fixture',
    durationMs: 100,
    loopMode,
    extensions: {
      'yk-pets/biped-motion/v1': {
        contacts: [
          { contactId: 'foot.left', startMs: 20, endMs: 40, confidence: .7 },
          { contactId: 'foot.left', startMs: 20, endMs: 40, confidence: .5 },
          { contactId: 'foot.right', startMs: 60, endMs: 60, confidence: .6 },
        ],
      },
    },
    createdAt: 1,
    updatedAt: 1,
  }))

  const once = makeClip('once')
  assert.deepEqual(sampleBipedPetMotion(once, 30).contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: 1, confidence: .7 }])
  assert.deepEqual(sampleBipedPetMotion(once, 30).activeContacts, ['foot.left'])
  assert.deepEqual(sampleBipedPetMotion(once, 200).contactStates, [])
  assert.deepEqual(sampleBipedPetMotion(once, 60).contactStates, [])
  const pingPong = makeClip('ping-pong')
  assert.deepEqual(sampleBipedPetMotion(pingPong, 170).contactStates, sampleBipedPetMotion(pingPong, 30).contactStates)
})

test('重叠与相邻接触在编译期合并且只在并集外边界淡变', () => {
  const compile = (contacts: readonly Record<string, unknown>[]) => compileBipedPetMotion(createStudioMotionAsset({
    id: 'motion-contact-union', nameZh: '接触并集', nameEn: 'Contact union', durationMs: 200, loopMode: 'once',
    extensions: { 'yk-pets/biped-motion/v1': { contacts } }, createdAt: 1, updatedAt: 1,
  }))
  const overlapping = compile([
    { contactId: 'foot.left', startMs: 0, endMs: 100, confidence: .5 },
    { contactId: 'foot.left', startMs: 50, endMs: 150, confidence: .9 },
  ])

  assert.deepEqual(overlapping.contacts.map(item => ({ contactId: item.contactId, startMs: item.startMs, endMs: item.endMs, confidence: item.confidence })), [
    { contactId: 'foot.left', startMs: 0, endMs: 150, confidence: .9 },
  ])
  for (const timeMs of [49, 50, 74, 75, 76, 100, 149]) {
    const state = sampleBipedPetMotion(overlapping, timeMs).contactStates[0]
    assert.ok(state && state.weight > 0, `${timeMs}ms 的合并接触不能出现 V 形归零`)
    assert.equal(state.confidence, .9)
  }
  assert.equal(sampleBipedPetMotion(overlapping, 75).contactStates[0]?.weight, 1)

  const adjacent = compile([
    { contactId: 'foot.right', startMs: 0, endMs: 100, confidence: .7 },
    { contactId: 'foot.right', startMs: 100, endMs: 200, confidence: .8 },
  ])
  assert.equal(adjacent.contacts.length, 1)
  assert.deepEqual(sampleBipedPetMotion(adjacent, 100).contactStates, [{ contactId: 'foot.right', phase: 'locked', weight: 1, confidence: .8 }])
})

test('循环接触把首尾组件视为环形并集并在精确接缝保持锁定', () => {
  const clip = compileBipedPetMotion(createStudioMotionAsset({
    id: 'motion-contact-seam', nameZh: '循环接缝', nameEn: 'Loop seam', durationMs: 1200, loopMode: 'loop',
    extensions: { 'yk-pets/biped-motion/v1': { contacts: [
      { contactId: 'foot.left', startMs: 0, endMs: 120, confidence: .7 },
      { contactId: 'foot.left', startMs: 1080, endMs: 1200, confidence: .9 },
      { contactId: 'foot.right', startMs: 0, endMs: 1200, confidence: .8 },
    ] } }, createdAt: 1, updatedAt: 1,
  }))

  for (const timeMs of [-1, 0, 1, 1199, 1200, 1201]) {
    assert.deepEqual(sampleBipedPetMotion(clip, timeMs).contactStates, [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: .9 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: .8 },
    ])
    assert.deepEqual(sampleBipedPetMotion(clip, timeMs).activeContacts, ['foot.left', 'foot.right'])
  }
})

test('零长度与反向接触不会进入编译结果或改变哈希', () => {
  const create = (contacts: readonly Record<string, unknown>[]) => createStudioMotionAsset({
    id: 'motion-invalid-contact', nameZh: '无效接触', nameEn: 'Invalid contacts', durationMs: 1000,
    extensions: { 'yk-pets/biped-motion/v1': { contacts } }, createdAt: 1, updatedAt: 1,
  })
  const clean = compileBipedPetMotion(create([]))
  const invalid = compileBipedPetMotion(create([
    { contactId: 'foot.left', startMs: 100, endMs: 100, confidence: .7 },
    { contactId: 'foot.right', startMs: 500, endMs: 200, confidence: .8 },
  ]))

  assert.deepEqual(invalid.contacts, [])
  assert.equal(invalid.hash, clean.hash)
})

test('ping-pong 转折点遵循线性边界且完整覆盖接触始终锁定', () => {
  const compile = (startMs: number) => compileBipedPetMotion(createStudioMotionAsset({
    id: `motion-contact-turn-${startMs}`, nameZh: '往返转折', nameEn: 'Ping pong turn', durationMs: 100, loopMode: 'ping-pong',
    extensions: { 'yk-pets/biped-motion/v1': { contacts: [{ contactId: 'foot.left', startMs, endMs: 100, confidence: .9 }] } },
    createdAt: 1, updatedAt: 1,
  }))
  const ending = compile(20)
  assert.deepEqual(sampleBipedPetMotion(ending, 99).contactStates, sampleBipedPetMotion(ending, 101).contactStates)
  assert.deepEqual(sampleBipedPetMotion(ending, 100).activeContacts, [])
  const full = compile(0)
  for (const timeMs of [99, 100, 101]) {
    assert.deepEqual(sampleBipedPetMotion(full, timeMs).contactStates, [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: .9 }])
  }
})

test('历史 V1 Clip 缺少淡变标志时继续使用 80ms 旧语义并保持身份', () => {
  const compiled = compileBipedPetMotion(createStudioMotionAsset({
    id: 'motion-contact-v1', nameZh: '历史接触', nameEn: 'Legacy contact', durationMs: 200, loopMode: 'once', createdAt: 1, updatedAt: 1,
  }))
  const legacyClip = {
    ...compiled,
    contacts: [{ contactId: 'foot.left', startMs: 20, endMs: 180, confidence: .9 }],
  }

  const acquiring = sampleBipedPetMotion(legacyClip, 21)
  const releasing = sampleBipedPetMotion(legacyClip, 179)
  assert.deepEqual(acquiring.contactStates, [{ contactId: 'foot.left', phase: 'acquiring', weight: .0125, confidence: .9 }])
  assert.deepEqual(releasing.contactStates, [{ contactId: 'foot.left', phase: 'releasing', weight: .0125, confidence: .9 }])
  assert.equal(acquiring.sourceMotionId, compiled.sourceMotionId)
  assert.equal(acquiring.clipHash, compiled.hash)
  assert.equal(acquiring.durationMs, compiled.durationMs)
  assert.equal(acquiring.loopMode, compiled.loopMode)
})

test('接触编译与采样统一使用不依赖 locale 的 code-point 顺序', () => {
  const contactTemplate = BIPED_PET_RIG_PROFILE.contacts[0]!
  const profile = {
    ...BIPED_PET_RIG_PROFILE,
    contacts: [
      ...BIPED_PET_RIG_PROFILE.contacts,
      { ...contactTemplate, id: 'z' },
      { ...contactTemplate, id: 'ä' },
    ],
  }
  const clip = compileBipedPetMotion(createStudioMotionAsset({
    id: 'motion-contact-order', nameZh: '接触排序', nameEn: 'Contact ordering', durationMs: 400, loopMode: 'once',
    extensions: { 'yk-pets/biped-motion/v1': { contacts: [
      { contactId: 'ä', startMs: 0, endMs: 300, confidence: .8 },
      { contactId: 'z', startMs: 0, endMs: 300, confidence: .9 },
    ] } }, createdAt: 1, updatedAt: 1,
  }), { profile })

  assert.deepEqual(clip.contacts.map(item => item.contactId), ['z', 'ä'])
  assert.deepEqual(sampleBipedPetMotion(clip, 100).contactStates.map(item => item.contactId), ['z', 'ä'])
  assert.deepEqual(sampleBipedPetMotion(clip, 100).activeContacts, ['z', 'ä'])
})
