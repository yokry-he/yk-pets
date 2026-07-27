/**
 * 文件职责 / File responsibility
 * 验证双足萌宠 Rig Profile 的稳定语义骨骼、可选附属链和足底接触点契约。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { BIPED_PET_RIG_PROFILE, validateRigProfile } from '../src/index.ts'

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
