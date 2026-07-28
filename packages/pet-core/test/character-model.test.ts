/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Rig Profile 的稳定语义骨骼、可选附属链和足底接触点契约。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBipedPetBodyStyle,
  BIPED_PET_RIG_PROFILE,
  compileBipedPetCharacter,
  createBipedPetModelRecipe,
  normalizeBipedPetModelRecipe,
  validateRigProfile,
} from '../src/index.ts'

test('双足萌宠模型配方提供固定的领域身份默认值', () => {
  const recipe = createBipedPetModelRecipe(200)

  assert.equal(recipe.schemaVersion, 1)
  assert.equal(recipe.rigProfileId, 'biped-pet/v1')
  assert.equal(recipe.generatorVersion, 'biped-pet-generator/v1')
  assert.equal(recipe.updatedAt, 200)
})

test('双足萌宠模型配方会确定性地修复损坏输入', () => {
  const input = {
    bodyStyle: 'unknown',
    proportions: { height: 99, headRatio: Number.NaN, armLength: -4 },
    appendages: { tail: { enabled: true, segments: 999, length: 0 } },
    updatedAt: -1,
  }

  const normalized = normalizeBipedPetModelRecipe(input, 200)

  assert.equal(normalized.bodyStyle, 'soft')
  assert.equal(normalized.proportions.height, 1.35)
  assert.equal(normalized.proportions.headRatio, 0.34)
  assert.equal(normalized.proportions.armLength, 0.82)
  assert.equal(normalized.appendages.tail.segments, 8)
  assert.equal(normalized.updatedAt, 200)
  assert.deepEqual(normalized.proportions, {
    height: 1.35,
    headRatio: 0.34,
    shoulderWidth: 0.78,
    hipWidth: 0.66,
    torsoLength: 0.72,
    armLength: 0.82,
    legLength: 0.94,
    handSize: 0.22,
    footSize: 0.28,
  })
  assert.ok(Object.values(normalized.proportions).every(Number.isFinite))
})

test('体型预设只调整比例并保留其余配方信息', () => {
  const recipe = normalizeBipedPetModelRecipe({
    appendages: { tail: { enabled: false, segments: 7, length: 0.9 } },
    material: { baseColor: '#112233', secondaryColor: '#445566', roughness: 0.2, metalness: 0.6 },
    updatedAt: 123,
  }, 200)
  const styled = applyBipedPetBodyStyle(recipe, 'athletic')

  assert.notDeepEqual(styled.proportions, recipe.proportions)
  assert.deepEqual(styled.appendages, recipe.appendages)
  assert.deepEqual(styled.material, recipe.material)
  assert.equal(styled.schemaVersion, recipe.schemaVersion)
  assert.equal(styled.generatorVersion, recipe.generatorVersion)
  assert.equal(styled.rigProfileId, recipe.rigProfileId)
  assert.equal(styled.updatedAt, recipe.updatedAt)
  assert.notEqual(styled.proportions, recipe.proportions)
  assert.notEqual(styled.appendages, recipe.appendages)
  assert.notEqual(styled.appendages.tail, recipe.appendages.tail)
  assert.notEqual(styled.material, recipe.material)
  styled.appendages.tail.length = 0.12
  styled.material.baseColor = '#FFFFFF'
  assert.equal(recipe.appendages.tail.length, 0.9)
  assert.equal(recipe.material.baseColor, '#112233'.toUpperCase())
})

test('模型配方颜色、边界和归一化均稳定且不突变输入', () => {
  const input = {
    proportions: {
      height: Infinity,
      headRatio: -Infinity,
      shoulderWidth: Infinity,
      hipWidth: -Infinity,
      torsoLength: Infinity,
      armLength: -Infinity,
      legLength: Infinity,
      handSize: -Infinity,
      footSize: Infinity,
    },
    appendages: {
      ears: { enabled: 'yes', segments: Infinity, length: -1 },
      tail: { enabled: false, segments: -2.5, length: Infinity },
      antennae: { enabled: true, segments: Number.NaN, length: Infinity },
    },
    material: { baseColor: '#12345', secondaryColor: 'red', roughness: -2, metalness: 3 },
  }
  const snapshot = structuredClone(input)
  const first = normalizeBipedPetModelRecipe(input, 200)
  const second = normalizeBipedPetModelRecipe(input, 200)

  assert.deepEqual(input, snapshot)
  assert.deepEqual(first, second)
  assert.equal(first.material.baseColor, '#F3F7FF')
  assert.equal(first.material.secondaryColor, '#7AE7DF')
  assert.deepEqual(first.proportions, {
    height: 1.35,
    headRatio: 0.34,
    shoulderWidth: 0.78,
    hipWidth: 0.66,
    torsoLength: 0.72,
    armLength: 0.82,
    legLength: 0.94,
    handSize: 0.22,
    footSize: 0.28,
  })
  assert.equal(first.appendages.ears.segments, 2)
  assert.equal(first.appendages.tail.segments, 1)
  assert.equal(first.appendages.ears.length, 0.08)
  assert.equal(first.appendages.tail.length, 0.62)
  assert.equal(first.appendages.antennae.segments, 2)
  assert.equal(first.appendages.antennae.length, 0.22)
  assert.equal(first.material.roughness, 0)
  assert.equal(first.material.metalness, 1)
  assert.ok([
    ...Object.values(first.proportions),
    first.appendages.ears.segments,
    first.appendages.ears.length,
    first.appendages.tail.segments,
    first.appendages.tail.length,
    first.appendages.antennae.segments,
    first.appendages.antennae.length,
    first.material.roughness,
    first.material.metalness,
  ].every(Number.isFinite))
})

const createValidProfile = () => ({
  id: 'biped-pet/v1',
  bones: [
    { id: 'root', semantic: 'root', side: 'center', restPosition: [0, 0, 0], restRotation: [0, 0, 0, 1] },
    { id: 'child', parentId: 'root', semantic: 'child', side: 'center', restPosition: [0, 1, 0], restRotation: [0, 0, 0, 1] },
  ],
  semanticBones: { root: 'root' },
  optionalChains: [],
  jointLimits: [],
  contacts: [],
  sockets: [],
})

test('biped-pet/v1 提供完整双足核心和可选附属链', () => {
  const profile = BIPED_PET_RIG_PROFILE

  assert.equal(profile.id, 'biped-pet/v1')
  assert.deepEqual(validateRigProfile(profile), [])
  for (const semantic of ['root', 'pelvis', 'chest', 'head', 'hand.left', 'hand.right', 'foot.left', 'foot.right']) {
    assert.ok(profile.semanticBones[semantic])
  }
  assert.deepEqual(profile.optionalChains.map(item => item.id), ['ears', 'tail', 'antennae'])
  assert.equal(profile.contacts.filter(item => item.kind === 'foot').length, 2)
})

test('biped-pet/v1 为左右腿声明可验证的自动混合 IK', () => {
  const limbs = BIPED_PET_RIG_PROFILE.limbIk ?? []
  assert.deepEqual(limbs.map(item => item.id), ['leg.left', 'leg.right'])
  assert.ok(limbs.every(item => item.solver === 'auto'))
  assert.ok(limbs.every(item => item.boneIds.length >= 3))
  assert.deepEqual(validateRigProfile(BIPED_PET_RIG_PROFILE), [])
})

const createValidLimbIk = () => structuredClone(BIPED_PET_RIG_PROFILE.limbIk![0]!)
const createProfileWithLimbIk = (limbIk: unknown) => ({ ...structuredClone(BIPED_PET_RIG_PROFILE), limbIk })

test('Rig Profile 会按稳定顺序诊断断裂链、未知接触点和非法 IK 限制', () => {
  const profile = createProfileWithLimbIk([{
    id: 'broken', solver: 'auto' as const, boneIds: ['thigh.left', 'ankle.right'],
    contactId: 'missing', poleAxis: [0, 0, 0] as const, maxStretchRatio: 2,
    maxCorrectionRadians: Number.NaN, weight: -1,
  }])

  assert.deepEqual(validateRigProfile(profile), [
    'limbIk[0].boneIds: expected at least 3 bones',
    'limbIk[0].boneIds: broken parent path between "thigh.left" and "ankle.right"',
    'limbIk[0].contactId: unknown contact "missing"',
    'limbIk[0].poleAxis: expected non-zero finite Vector3',
    'limbIk[0].maxStretchRatio: expected finite number in [0.8, 1]',
    'limbIk[0].maxCorrectionRadians: expected finite number in (0, Math.PI]',
    'limbIk[0].weight: expected finite number in [0, 1]',
  ])
})

test('Rig Profile 会完整且确定地诊断畸形 IK 结构', () => {
  const valid = createValidLimbIk()
  const cases: readonly { name: string; profile: unknown; diagnostics: readonly string[] }[] = [
    { name: 'limbIk 不是数组', profile: createProfileWithLimbIk(null), diagnostics: ['limbIk: expected array'] },
    { name: '肢体不是对象', profile: createProfileWithLimbIk([null]), diagnostics: ['limbIk[0]: expected object'] },
    {
      name: '肢体 ID 重复',
      profile: createProfileWithLimbIk([valid, { ...valid }]),
      diagnostics: ['limbIk[1].id: duplicate limb IK id "leg.left"'],
    },
    {
      name: '求解器非法',
      profile: createProfileWithLimbIk([{ ...valid, solver: 'ccd' }]),
      diagnostics: ['limbIk[0].solver: expected analytic-two-bone, fabrik, or auto'],
    },
    {
      name: '骨骼链过短',
      profile: createProfileWithLimbIk([{ ...valid, boneIds: ['thigh.left', 'knee.left'] }]),
      diagnostics: ['limbIk[0].boneIds: expected at least 3 bones'],
    },
    {
      name: '骨骼链包含未知骨骼',
      profile: createProfileWithLimbIk([{ ...valid, boneIds: ['thigh.left', 'knee.left', 'missing'] }]),
      diagnostics: [
        'limbIk[0].boneIds[2]: unknown bone "missing"',
        'limbIk[0].boneIds: broken parent path between "knee.left" and "missing"',
      ],
    },
    {
      name: 'boneIds 不是数组',
      profile: createProfileWithLimbIk([{ ...valid, boneIds: null }]),
      diagnostics: ['limbIk[0].boneIds: expected array'],
    },
    {
      name: 'boneIds 包含错误元素',
      profile: createProfileWithLimbIk([{ ...valid, boneIds: ['thigh.left', 42, 'calf.left'] }]),
      diagnostics: ['limbIk[0].boneIds[1]: expected non-empty string'],
    },
    {
      name: '极向量分量有限但模长溢出',
      profile: createProfileWithLimbIk([{ ...valid, poleAxis: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE] }]),
      diagnostics: ['limbIk[0].poleAxis: expected non-zero finite Vector3'],
    },
  ]

  for (const item of cases) {
    assert.doesNotThrow(() => validateRigProfile(item.profile), item.name)
    assert.deepEqual(validateRigProfile(item.profile), item.diagnostics, item.name)
  }
})

test('Rig Profile 严格遵守 IK 数值边界并拒绝相邻非法值', () => {
  const valid = createValidLimbIk()
  const validBoundaries = [
    { ...valid, maxStretchRatio: .8, maxCorrectionRadians: Number.MIN_VALUE, weight: 0 },
    { ...valid, id: 'leg.upper-boundary', maxStretchRatio: 1, maxCorrectionRadians: Math.PI, weight: 1 },
  ]
  assert.deepEqual(validateRigProfile(createProfileWithLimbIk(validBoundaries)), [])

  const cases = [
    ['maxStretchRatio', .8 - Number.EPSILON, 'limbIk[0].maxStretchRatio: expected finite number in [0.8, 1]'],
    ['maxStretchRatio', 1 + Number.EPSILON, 'limbIk[0].maxStretchRatio: expected finite number in [0.8, 1]'],
    ['maxCorrectionRadians', 0, 'limbIk[0].maxCorrectionRadians: expected finite number in (0, Math.PI]'],
    ['maxCorrectionRadians', Number.NaN, 'limbIk[0].maxCorrectionRadians: expected finite number in (0, Math.PI]'],
    ['maxCorrectionRadians', Math.PI + Number.EPSILON * 4, 'limbIk[0].maxCorrectionRadians: expected finite number in (0, Math.PI]'],
    ['weight', -Number.EPSILON, 'limbIk[0].weight: expected finite number in [0, 1]'],
    ['weight', 1 + Number.EPSILON, 'limbIk[0].weight: expected finite number in [0, 1]'],
  ] as const

  for (const [field, value, diagnostic] of cases) {
    const profile = createProfileWithLimbIk([{ ...valid, [field]: value }])
    assert.doesNotThrow(() => validateRigProfile(profile), `${field}=${String(value)}`)
    assert.deepEqual(validateRigProfile(profile), [diagnostic], `${field}=${String(value)}`)
  }
})

test('Rig Profile 校验对畸形输入不抛异常且返回稳定诊断', () => {
  const cases: readonly { name: string; profile: unknown; diagnostics: readonly string[] }[] = [
    {
      name: '重复骨骼 ID',
      profile: { ...createValidProfile(), bones: [
        createValidProfile().bones[0],
        { ...createValidProfile().bones[1], id: 'root' },
      ] },
      diagnostics: ['bones[1].id: duplicate bone id "root"'],
    },
    {
      name: '多个 Root',
      profile: { ...createValidProfile(), bones: [
        createValidProfile().bones[0],
        { ...createValidProfile().bones[1], parentId: undefined },
      ] },
      diagnostics: ['bones: expected exactly one root, received 2'],
    },
    {
      name: '没有 Root',
      profile: { ...createValidProfile(), bones: [
        { ...createValidProfile().bones[0], parentId: 'child' },
        createValidProfile().bones[1],
      ] },
      diagnostics: ['bones: expected exactly one root, received 0', 'bones: cycle detected at "root"'],
    },
    {
      name: '父骨骼不存在',
      profile: { ...createValidProfile(), bones: [
        createValidProfile().bones[0],
        { ...createValidProfile().bones[1], parentId: 'missing' },
      ] },
      diagnostics: ['bones[1].parentId: unknown bone "missing"'],
    },
    {
      name: '循环仅报告一次',
      profile: { ...createValidProfile(), bones: [
        createValidProfile().bones[0],
        { ...createValidProfile().bones[1], id: 'left', parentId: 'right' },
        { ...createValidProfile().bones[1], id: 'right', parentId: 'left' },
      ] },
      diagnostics: ['bones: cycle detected at "left"'],
    },
    {
      name: '语义、约束、接触点与 Socket 引用不存在',
      profile: {
        ...createValidProfile(),
        semanticBones: { missing: 'missing' },
        jointLimits: [{ boneId: 'missing', minimum: [0, 0, 0], maximum: [0, 0, 0] }],
        contacts: [{ id: 'missing', boneId: 'missing', kind: 'foot', localPosition: [0, 0, 0], localRotation: [0, 0, 0, 1] }],
        sockets: [{ id: 'missing', boneId: 'missing', localPosition: [0, 0, 0], localRotation: [0, 0, 0, 1] }],
      },
      diagnostics: [
        'semanticBones.missing: unknown bone "missing"',
        'jointLimits[0].boneId: unknown bone "missing"',
        'contacts[0].boneId: unknown bone "missing"',
        'sockets[0].boneId: unknown bone "missing"',
      ],
    },
    {
      name: 'NaN 与 Infinity 向量',
      profile: {
        ...createValidProfile(),
        bones: [{ ...createValidProfile().bones[0], restPosition: [NaN, 0, 0], restRotation: [0, Infinity, 0, 1] }, createValidProfile().bones[1]],
        jointLimits: [{ boneId: 'root', minimum: [NaN, 0, 0], maximum: [0, Infinity, 0], bendAxis: [0, 0, NaN] }],
        contacts: [{ id: 'root', boneId: 'root', kind: 'foot', localPosition: [Infinity, 0, 0], localRotation: [0, 0, NaN, 1] }],
        sockets: [{ id: 'root', boneId: 'root', localPosition: [0, Infinity, 0], localRotation: [0, 0, 0, NaN] }],
      },
      diagnostics: [
        'bones[0].restPosition: expected finite Vector3',
        'bones[0].restRotation: expected finite Quaternion',
        'jointLimits[0].minimum: expected finite Vector3',
        'jointLimits[0].maximum: expected finite Vector3',
        'jointLimits[0].bendAxis: expected finite Vector3',
        'contacts[0].localPosition: expected finite Vector3',
        'contacts[0].localRotation: expected finite Quaternion',
        'sockets[0].localPosition: expected finite Vector3',
        'sockets[0].localRotation: expected finite Quaternion',
      ],
    },
    { name: '顶层畸形', profile: undefined, diagnostics: ['profile: expected object'] },
    { name: '字段畸形', profile: { ...createValidProfile(), bones: [{ ...createValidProfile().bones[0], restPosition: null }, null], contacts: null }, diagnostics: [
      'contacts: expected array',
      'bones[0].restPosition: expected finite Vector3',
      'bones[1]: expected object',
    ] },
  ]

  for (const item of cases) {
    assert.doesNotThrow(() => validateRigProfile(item.profile), item.name)
    assert.deepEqual(validateRigProfile(item.profile), item.diagnostics, item.name)
  }
})

test('Rig Profile 校验 Profile、骨骼和附属集合的运行时枚举与唯一性契约', () => {
  const cases: readonly { name: string; profile: unknown; diagnostics: readonly string[] }[] = [
    { name: '不支持的 Profile ID', profile: { ...createValidProfile(), id: 'unknown/v1' }, diagnostics: ['id: unsupported rig profile id "unknown/v1"'] },
    { name: '骨骼语义和侧别畸形', profile: { ...createValidProfile(), bones: [{ ...createValidProfile().bones[0], semantic: '', side: 'diagonal' }, createValidProfile().bones[1]] }, diagnostics: [
      'bones[0].semantic: expected non-empty string',
      'bones[0].side: expected center, left, or right',
    ] },
    { name: '可选链枚举、分段和唯一性畸形', profile: { ...createValidProfile(), optionalChains: [
      { id: 'horn', rootBoneId: 'root', defaultSegments: 0 },
      { id: 'horn', rootBoneId: 'root', defaultSegments: Infinity },
    ] }, diagnostics: [
      'optionalChains[0].id: expected ears, tail, antennae, or wings',
      'optionalChains[0].defaultSegments: expected positive finite integer',
      'optionalChains[1].id: expected ears, tail, antennae, or wings',
      'optionalChains[1].id: duplicate optional chain id "horn"',
      'optionalChains[1].defaultSegments: expected positive finite integer',
    ] },
    { name: 'Contact 与 Socket 的 ID、类型和唯一性畸形', profile: { ...createValidProfile(),
      contacts: [{ id: '', boneId: 'root', kind: 'wing', localPosition: [0, 0, 0], localRotation: [0, 0, 0, 1] }],
      sockets: [
        { id: 'mount', boneId: 'root', localPosition: [0, 0, 0], localRotation: [0, 0, 0, 1] },
        { id: 'mount', boneId: 'root', localPosition: [0, 0, 0], localRotation: [0, 0, 0, 1] },
      ],
    }, diagnostics: [
      'contacts[0].id: expected non-empty string',
      'contacts[0].kind: expected foot, hand, or body',
      'sockets[1].id: duplicate socket id "mount"',
    ] },
  ]

  for (const item of cases) assert.deepEqual(validateRigProfile(item.profile), item.diagnostics, item.name)
})

test('双足萌宠编译器生成确定性、可蒙皮且可直接渲染的模型数据', () => {
  const recipe = createBipedPetModelRecipe(200)
  const first = compileBipedPetCharacter(recipe)
  const second = compileBipedPetCharacter(recipe)

  assert.equal(first.status, 'ready')
  assert.equal(first.hash, second.hash)
  assert.deepEqual(first.mesh, second.mesh)
  assert.equal(first.profileId, 'biped-pet/v1')
  assert.equal(first.generatorVersion, 'biped-pet-generator/v1')
  assert.ok(first.mesh.positions.length > 300)
  assert.equal(first.mesh.positions.length % 3, 0)
  assert.equal(first.mesh.vertexCount, first.mesh.positions.length / 3)
  assert.equal(first.mesh.skinIndices.length, first.mesh.vertexCount * 4)
  assert.equal(first.mesh.skinWeights.length, first.mesh.vertexCount * 4)
  assert.equal(first.diagnostics.some(item => item.severity === 'error'), false)

  for (let vertex = 0; vertex < first.mesh.vertexCount; vertex++) {
    const offset = vertex * 4
    const weights = first.mesh.skinWeights.slice(offset, offset + 4)
    assert.ok(weights.every(weight => Number.isFinite(weight) && weight >= 0))
    assert.ok(Math.abs(weights.reduce((total, weight) => total + weight, 0) - 1) < 1e-6)
  }
})

test('双足萌宠编译器输出引用均安全且骨骼按父子顺序排列', () => {
  const compiled = compileBipedPetCharacter(createBipedPetModelRecipe(200))
  assert.equal(compiled.status, 'ready')
  assert.ok([...compiled.mesh.positions, ...compiled.mesh.indices, ...compiled.mesh.skinIndices, ...compiled.mesh.skinWeights].every(Number.isFinite))
  assert.ok(compiled.mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < compiled.mesh.vertexCount))
  assert.ok(compiled.mesh.skinIndices.every(index => Number.isInteger(index) && index >= 0 && index < compiled.bones.length))
  assert.ok(compiled.bones.every((bone, index) => bone.parentIndex === -1 || bone.parentIndex < index))
  assert.ok(compiled.contacts.filter(contact => contact.kind === 'foot').length >= 2)
  const boneIds = new Set(compiled.bones.map(bone => bone.id))
  assert.ok(compiled.jointLimits.every(limit => boneIds.has(limit.boneId)))
  assert.ok(compiled.contacts.every(contact => boneIds.has(contact.boneId)))
  assert.ok(compiled.sockets.every(socket => boneIds.has(socket.boneId)))
})

test('所有体型预设和配方边界都能稳定编译', () => {
  const defaults = createBipedPetModelRecipe(200)
  const bounds = {
    height: [0.9, 1.8], headRatio: [0.2, 0.5], shoulderWidth: [0.42, 1.2], hipWidth: [0.38, 1.2],
    torsoLength: [0.38, 1.2], armLength: [0.42, 1.2], legLength: [0.5, 1.4], handSize: [0.1, 0.42], footSize: [0.14, 0.5],
  } as const
  for (const bodyStyle of ['soft', 'athletic', 'round', 'slender'] as const) {
    const styled = applyBipedPetBodyStyle(defaults, bodyStyle)
    const compiled = compileBipedPetCharacter(styled)
    assert.equal(compiled.status, 'ready', bodyStyle)
    assert.equal(compiled.diagnostics.some(item => item.severity === 'error'), false, bodyStyle)
    assert.equal(compiled.hash, compileBipedPetCharacter(styled).hash, bodyStyle)
  }
  for (const edge of [0, 1] as const) {
    const proportions = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, value[edge]]))
    const compiled = compileBipedPetCharacter({ ...defaults, proportions })
    assert.equal(compiled.status, 'ready', `边界 ${edge}`)
    assert.equal(compiled.diagnostics.some(item => item.severity === 'error'), false, `边界 ${edge}`)
  }
})

test('可选附属链遵循启用状态与分段数，并维持稳定的骨骼 ID', () => {
  const defaults = createBipedPetModelRecipe(200)
  const base = compileBipedPetCharacter({
    ...defaults,
    appendages: {
      ears: { ...defaults.appendages.ears, enabled: false },
      tail: { ...defaults.appendages.tail, enabled: false },
      antennae: { ...defaults.appendages.antennae, enabled: false },
    },
  })
  const optional = compileBipedPetCharacter({
    ...defaults,
    appendages: {
      ears: { enabled: true, segments: 3, length: .3 },
      tail: { enabled: true, segments: 5, length: .8 },
      antennae: { enabled: true, segments: 4, length: .28 },
    },
  })
  const ids = optional.bones.map(bone => bone.id)
  assert.equal(ids.some(id => id.startsWith('ear.left.')), true)
  assert.equal(ids.some(id => id.startsWith('ear.right.')), true)
  assert.equal(ids.filter(id => id.startsWith('tail.')).length, 5)
  assert.equal(ids.filter(id => id.startsWith('antenna.left.')).length, 4)
  assert.equal(ids.filter(id => id.startsWith('antenna.right.')).length, 4)
  assert.equal(base.bones.some(bone => /^(ear|tail|antenna)\./.test(bone.id)), false)
  assert.ok(optional.bones.length > base.bones.length)
  const shortTail = compileBipedPetCharacter({
    ...defaults,
    appendages: {
      ears: { ...defaults.appendages.ears, enabled: false },
      tail: { enabled: true, segments: 2, length: .8 },
      antennae: { ...defaults.appendages.antennae, enabled: false },
    },
  })
  assert.equal(shortTail.bones.filter(bone => bone.id.startsWith('tail.')).length, 2)
  assert.equal(ids.filter(id => id.startsWith('tail.')).length, 5)
})

test('角色哈希忽略更新时间、识别几何变化且编译不会突变输入', () => {
  const recipe = createBipedPetModelRecipe(200)
  const snapshot = structuredClone(recipe)
  const updated = { ...recipe, updatedAt: 999 }
  const changed = { ...recipe, proportions: { ...recipe.proportions, legLength: recipe.proportions.legLength + .1 } }
  const first = compileBipedPetCharacter(recipe)

  assert.deepEqual(recipe, snapshot)
  assert.equal(first.hash, compileBipedPetCharacter(updated).hash)
  assert.notEqual(first.hash, compileBipedPetCharacter(changed).hash)
})

test('编译器会阻止并诊断损坏的 Profile 接触点与关节限制，同时保留可检查输出', () => {
  const profile = BIPED_PET_RIG_PROFILE as unknown as {
    contacts: Array<{ boneId: string }>
    jointLimits: Array<{ minimum: [number, number, number] }>
  }
  const originalContactBoneId = profile.contacts[0]!.boneId
  const originalMinimum = profile.jointLimits[0]!.minimum
  try {
    profile.contacts[0]!.boneId = 'missing-contact-bone'
    profile.jointLimits[0]!.minimum = [Number.NaN, 0, 0]
    const compiled = compileBipedPetCharacter(createBipedPetModelRecipe(200))

    assert.equal(compiled.status, 'blocked')
    assert.ok(compiled.diagnostics.some(item => item.id.startsWith('profile-validation-') && item.severity === 'error'))
    assert.equal(compiled.bones.length, 0)
    assert.equal(compiled.mesh.vertexCount, 0)
  } finally {
    profile.contacts[0]!.boneId = originalContactBoneId
    profile.jointLimits[0]!.minimum = originalMinimum
  }
})

test('尾巴首节保留配方分段长度，单节尾巴的长度变化会改变末端与网格哈希', () => {
  const defaults = createBipedPetModelRecipe(200)
  const compileTail = (length: number) => compileBipedPetCharacter({
    ...defaults,
    appendages: {
      ears: { ...defaults.appendages.ears, enabled: false },
      tail: { enabled: true, segments: 1, length },
      antennae: { ...defaults.appendages.antennae, enabled: false },
    },
  })
  const short = compileTail(.2)
  const long = compileTail(1.2)
  const shortTail = short.bones.find(bone => bone.id === 'tail.1')!
  const longTail = long.bones.find(bone => bone.id === 'tail.1')!

  assert.equal(shortTail.position[2], -.2)
  assert.equal(longTail.position[2], -1.2)
  assert.notEqual(short.hash, long.hash)
  assert.notDeepEqual(short.mesh.positions, long.mesh.positions)
})

test('编译器在 Profile 父级或 Socket 变换损坏时会在克隆前阻止输出', () => {
  const profile = BIPED_PET_RIG_PROFILE as unknown as {
    bones: Array<{ parentId?: string }>
    sockets: Array<{ localRotation: number[] }>
  }
  const originalParentId = profile.bones[1]!.parentId
  const originalSocketRotation = profile.sockets[0]!.localRotation
  try {
    profile.bones[1]!.parentId = 'missing-parent'
    profile.sockets[0]!.localRotation = []
    const first = compileBipedPetCharacter(createBipedPetModelRecipe(200))
    const second = compileBipedPetCharacter(createBipedPetModelRecipe(999))

    assert.equal(first.status, 'blocked')
    assert.equal(first.hash, second.hash)
    assert.ok(first.diagnostics.some(item => item.id.startsWith('profile-validation-') && item.severity === 'error'))
    assert.equal(first.bones.length, 0)
  } finally {
    profile.bones[1]!.parentId = originalParentId
    profile.sockets[0]!.localRotation = originalSocketRotation
  }
})

test('接触点与 Socket 会随足、头、躯干比例缩放且不共享 Profile 引用', () => {
  const defaults = createBipedPetModelRecipe(200)
  const small = compileBipedPetCharacter({
    ...defaults,
    proportions: { ...defaults.proportions, footSize: .14, headRatio: .2, shoulderWidth: .42, torsoLength: .38, hipWidth: .38 },
  })
  const large = compileBipedPetCharacter({
    ...defaults,
    proportions: { ...defaults.proportions, footSize: .5, headRatio: .5, shoulderWidth: 1.2, torsoLength: 1.2, hipWidth: 1.2 },
  })
  const find = <T extends { id: string }>(items: readonly T[], id: string) => items.find(item => item.id === id)!

  assert.equal(find(small.contacts, 'foot.left').localPosition[1], -.14 * .65)
  assert.equal(find(large.contacts, 'foot.left').localPosition[1], -.5 * .65)
  assert.notDeepEqual(find(small.sockets, 'foot.left').localPosition, find(large.sockets, 'foot.left').localPosition)
  assert.notDeepEqual(find(small.sockets, 'head').localPosition, find(large.sockets, 'head').localPosition)
  assert.notDeepEqual(find(small.sockets, 'back').localPosition, find(large.sockets, 'back').localPosition)
  assert.notDeepEqual(find(small.sockets, 'tail.base').localPosition, find(large.sockets, 'tail.base').localPosition)
  find(small.sockets, 'head').localPosition[1] = 99
  assert.notEqual(BIPED_PET_RIG_PROFILE.sockets.find(socket => socket.id === 'head')!.localPosition[1], 99)
})

test('刚性椭球极点不生成零面积三角形', () => {
  const mesh = compileBipedPetCharacter(createBipedPetModelRecipe(200)).mesh
  const point = (index: number) => mesh.positions.slice(index * 3, index * 3 + 3)
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const [a, b, c] = [point(mesh.indices[offset]!), point(mesh.indices[offset + 1]!), point(mesh.indices[offset + 2]!)]
    const cross = [
      (b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!),
      (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!),
      (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!),
    ]
    assert.ok(Math.hypot(...cross) > 1e-8, `三角形 ${offset / 3} 面积为零`)
  }
})

test('管段与刚性椭球的三角形绕序均朝向外侧', () => {
  const compiled = compileBipedPetCharacter(createBipedPetModelRecipe(200))
  const { bones, mesh } = compiled
  const worlds: [number, number, number][] = []
  for (const bone of bones) worlds.push(bone.parentIndex === -1
    ? [...bone.position]
    : [
      worlds[bone.parentIndex]![0] + bone.position[0],
      worlds[bone.parentIndex]![1] + bone.position[1],
      worlds[bone.parentIndex]![2] + bone.position[2],
    ])
  const point = (index: number) => mesh.positions.slice(index * 3, index * 3 + 3)
  const normal = (a: number[], b: number[], c: number[]) => [
    (b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!),
    (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!),
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!),
  ]
  const dot = (left: number[], right: number[]) => left[0]! * right[0]! + left[1]! * right[1]! + left[2]! * right[2]!
  const centroid = (a: number[], b: number[], c: number[]) => [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3]
  const ellipsoidVertexCount = 42
  const ellipsoidTriangleCount = 80
  const ellipsoidCount = 5
  const pipeVertexCount = 40
  const pipeTriangleCount = 64
  const firstEllipsoidVertex = mesh.vertexCount - ellipsoidCount * ellipsoidVertexCount
  const pipeCount = firstEllipsoidVertex / pipeVertexCount
  assert.ok(Number.isInteger(pipeCount))

  for (let pipe = 0; pipe < pipeCount; pipe++) {
    const vertex = pipe * pipeVertexCount
    const start = worlds[mesh.skinIndices[vertex * 4]!]!
    const end = worlds[mesh.skinIndices[vertex * 4 + 1]!]!
    const axis = [end[0] - start[0], end[1] - start[1], end[2] - start[2]]
    const axisSquared = dot(axis, axis)
    for (let triangle = 0; triangle < pipeTriangleCount; triangle++) {
      const offset = (pipe * pipeTriangleCount + triangle) * 3
      const [a, b, c] = [point(mesh.indices[offset]!), point(mesh.indices[offset + 1]!), point(mesh.indices[offset + 2]!)]
      const center = centroid(a, b, c)
      const projection = dot([center[0]! - start[0], center[1]! - start[1], center[2]! - start[2]], axis) / axisSquared
      const closest = [start[0] + axis[0]! * projection, start[1] + axis[1]! * projection, start[2] + axis[2]! * projection]
      assert.ok(dot(normal(a, b, c), [center[0]! - closest[0]!, center[1]! - closest[1]!, center[2]! - closest[2]!]) > 1e-8, `管段 ${pipe} 三角形 ${triangle} 朝内`)
    }
  }
  const firstEllipsoidTriangle = pipeCount * pipeTriangleCount
  for (let ellipsoid = 0; ellipsoid < ellipsoidCount; ellipsoid++) {
    const vertex = firstEllipsoidVertex + ellipsoid * ellipsoidVertexCount
    const center = worlds[mesh.skinIndices[vertex * 4]!]!
    for (let triangle = 0; triangle < ellipsoidTriangleCount; triangle++) {
      const offset = (firstEllipsoidTriangle + ellipsoid * ellipsoidTriangleCount + triangle) * 3
      const [a, b, c] = [point(mesh.indices[offset]!), point(mesh.indices[offset + 1]!), point(mesh.indices[offset + 2]!)]
      const surface = centroid(a, b, c)
      assert.ok(dot(normal(a, b, c), [surface[0]! - center[0], surface[1]! - center[1], surface[2]! - center[2]]) > 1e-8, `椭球 ${ellipsoid} 三角形 ${triangle} 朝内`)
    }
  }
})
