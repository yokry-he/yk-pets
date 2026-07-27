/**
 * 文件职责 / File responsibility
 * 验证语义 Rig、毫秒时间、旧动作迁移、关键帧规范化和无 UI 求值的确定性。
 * Verifies deterministic semantic Rig, millisecond timing, legacy migration, keyframe normalization, and UI-free evaluation.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLOUD_FOX_RIG_CHANNELS,
  CLOUD_FOX_SEMANTIC_RIG_ID,
  createNeutralCloudFoxPoseValues,
  createStudioMotionAsset,
  evaluateNormalizedMotionAsset,
  frameToMilliseconds,
  insertMotionKeyframe,
  millisecondsToFrame,
  normalizeMotionAsset,
  resolveMotionTime,
  snapMillisecondsToFrame,
} from '../src/index.ts'

test('semantic Rig channels are stable, unique, and renderer independent', () => {
  const ids = CLOUD_FOX_RIG_CHANNELS.map(channel => channel.id)
  assert.equal(ids.length, new Set(ids).size)
  assert.equal(ids[0], 'root.position.x')
  assert.equal(ids.at(-1), 'antenna.glow')
  assert.ok(ids.includes('mouth.open'))
  assert.ok(ids.includes('tail.tip.rotation.z'))
  assert.ok(CLOUD_FOX_RIG_CHANNELS.every(channel => !/mesh|three|color|shape/i.test(channel.id)))
  assert.deepEqual(createNeutralCloudFoxPoseValues(), createNeutralCloudFoxPoseValues())
})

test('动作安全形变通道保持中性并钳制越界关键帧', () => {
  const ids = [
    'head.scale', 'eye.scale', 'eye.spacing', 'eye.pupilScale', 'eye.expressionTilt',
    'nose.scale.x', 'nose.scale.y', 'nose.scale.z', 'nose.offset.y', 'nose.sniff',
    'nose.glow', 'mouth.curve', 'tail.length', 'tail.fluff', 'antenna.glow',
  ] as const
  const neutral = createNeutralCloudFoxPoseValues()
  for (const id of ids) assert.equal(neutral[id], 0)

  const result = normalizeMotionAsset({
    id: 'safe-deformation', nameZh: '安全形变', nameEn: 'Safe deformation', durationMs: 1000,
    tracks: [{ id: 'nose-scale', channelId: 'nose.scale.x', keyframes: [{ id: 'high', timeMs: 0, value: 99, interpolation: 'linear' }] }],
  })
  assert.equal(result.asset.tracks[0]?.keyframes[0]?.value, 1)
})

test('FPS is a display grid and does not replace millisecond storage', () => {
  assert.equal(frameToMilliseconds(30, 30), 1000)
  assert.equal(frameToMilliseconds(24, 24), 1000)
  assert.equal(millisecondsToFrame(1000, 60), 60)
  assert.equal(snapMillisecondsToFrame(1017, 30), 1033)
  assert.equal(snapMillisecondsToFrame(1017, 60), 1017)
})

test('once, loop, and ping-pong time resolution is deterministic', () => {
  assert.deepEqual(resolveMotionTime(-20, 1000, 'once'), {
    requestedTimeMs: -20,
    resolvedTimeMs: 0,
    direction: 1,
    iteration: 0,
  })
  assert.deepEqual(resolveMotionTime(1250, 1000, 'loop'), {
    requestedTimeMs: 1250,
    resolvedTimeMs: 250,
    direction: 1,
    iteration: 1,
  })
  assert.deepEqual(resolveMotionTime(-1, 1000, 'loop'), {
    requestedTimeMs: -1,
    resolvedTimeMs: 999,
    direction: 1,
    iteration: -1,
  })
  assert.deepEqual(resolveMotionTime(1000, 1000, 'ping-pong'), {
    requestedTimeMs: 1000,
    resolvedTimeMs: 1000,
    direction: -1,
    iteration: 1,
  })
  assert.deepEqual(resolveMotionTime(1250, 1000, 'ping-pong'), {
    requestedTimeMs: 1250,
    resolvedTimeMs: 750,
    direction: -1,
    iteration: 1,
  })
  assert.deepEqual(resolveMotionTime(-1, 1000, 'ping-pong'), {
    requestedTimeMs: -1,
    resolvedTimeMs: 1,
    direction: -1,
    iteration: -1,
  })
})

test('legacy motion metadata migrates without becoming appearance-bound', () => {
  const result = normalizeMotionAsset({
    id: 'motion-legacy',
    nameZh: '旧动作',
    nameEn: 'Legacy Motion',
    durationMs: 90000,
    loopMode: 'loop',
    appearanceId: 'appearance-old',
    propIds: ['prop-a', 'prop-a', '', 'prop-b'],
    createdAt: 10,
    updatedAt: 20,
    customFlag: 'preserved',
    tracks: [],
  }, { now: 30 })

  assert.equal(result.asset.schemaVersion, 2)
  assert.equal(result.asset.rigId, CLOUD_FOX_SEMANTIC_RIG_ID)
  assert.equal(result.asset.durationMs, 60000)
  assert.equal(result.asset.displayFps, 30)
  assert.equal(result.asset.authoringAppearanceId, 'appearance-old')
  assert.deepEqual(result.asset.propIds, ['prop-a', 'prop-b'])
  assert.equal(result.asset.extensions?.customFlag, 'preserved')
  assert.ok(result.diagnostics.some(item => item.code === 'legacy-schema-migrated'))
  assert.ok(result.diagnostics.some(item => item.code === 'duration-clamped'))
})

test('normalization sorts tracks and replaces duplicate times with the last value', () => {
  const result = normalizeMotionAsset({
    schemaVersion: 2,
    id: 'motion-normalize',
    nameZh: '规范化',
    nameEn: 'Normalize',
    durationMs: 1000,
    displayFps: 30,
    loopMode: 'once',
    createdAt: 1,
    updatedAt: 1,
    tracks: [
      {
        id: 'head-second',
        channelId: 'head.rotation.x',
        keyframes: [
          { id: 'h-late', timeMs: 800, value: 1, interpolation: 'linear' },
          { id: 'h-start', timeMs: -100, value: -10, interpolation: 'step' },
        ],
      },
      {
        id: 'root-track',
        channelId: 'root.position.y',
        keyframes: [
          { id: 'root-500-a', timeMs: 500, value: 1, interpolation: 'linear' },
          { id: 'root-500-b', timeMs: 500, value: 2, interpolation: 'step' },
          { id: 'root-end', timeMs: 1200, value: 8, interpolation: 'linear' },
        ],
      },
      {
        id: 'head-duplicate',
        channelId: 'head.rotation.x',
        muted: true,
        keyframes: [
          { id: 'h-replace', timeMs: 800, value: .25, interpolation: 'linear' },
        ],
      },
      {
        id: 'unknown',
        channelId: 'mesh.body.rotation.x',
        keyframes: [{ id: 'unknown-key', timeMs: 0, value: 1 }],
      },
    ],
  })

  assert.deepEqual(result.asset.tracks.map(track => track.channelId), ['root.position.y', 'head.rotation.x'])
  const root = result.asset.tracks[0]
  const head = result.asset.tracks[1]
  assert.deepEqual(root?.keyframes.map(keyframe => [keyframe.timeMs, keyframe.value, keyframe.interpolation]), [
    [500, 2, 'step'],
    [1000, 4, 'linear'],
  ])
  assert.equal(head?.muted, true)
  assert.deepEqual(head?.keyframes.map(keyframe => [keyframe.timeMs, keyframe.value]), [
    [0, -Math.PI],
    [800, .25],
  ])
  assert.ok(result.diagnostics.some(item => item.code === 'duplicate-channel-track-merged'))
  assert.ok(result.diagnostics.some(item => item.code === 'duplicate-keyframe-time-replaced'))
  assert.ok(result.diagnostics.some(item => item.code === 'unknown-channel-dropped'))
})

test('step and linear interpolation evaluate complete poses without UI state', () => {
  const asset = normalizeMotionAsset({
    schemaVersion: 2,
    id: 'motion-evaluate',
    nameZh: '求值',
    nameEn: 'Evaluate',
    durationMs: 1000,
    displayFps: 30,
    loopMode: 'once',
    createdAt: 1,
    updatedAt: 1,
    tracks: [
      {
        id: 'linear-root',
        channelId: 'root.position.y',
        keyframes: [
          { id: 'root-0', timeMs: 0, value: 0, interpolation: 'linear' },
          { id: 'root-1000', timeMs: 1000, value: 2, interpolation: 'linear' },
        ],
      },
      {
        id: 'step-mouth',
        channelId: 'mouth.open',
        keyframes: [
          { id: 'mouth-0', timeMs: 0, value: 0, interpolation: 'step' },
          { id: 'mouth-500', timeMs: 500, value: 1, interpolation: 'linear' },
        ],
      },
    ],
  }).asset

  const middle = evaluateNormalizedMotionAsset(asset, 500)
  assert.equal(middle.values['root.position.y'], 1)
  assert.equal(middle.values['mouth.open'], 1)
  assert.deepEqual(middle.authoredChannels, ['root.position.y', 'mouth.open'])
  assert.equal(middle.values['tail.root.rotation.x'], 0)

  const beforeStep = evaluateNormalizedMotionAsset(asset, 499)
  assert.equal(beforeStep.values['mouth.open'], 0)
})

test('keyframe insertion and JSON round-trip remain deterministic', () => {
  const asset = createStudioMotionAsset({
    schemaVersion: 2,
    id: 'motion-insert',
    nameZh: '插入',
    nameEn: 'Insert',
    rigId: CLOUD_FOX_SEMANTIC_RIG_ID,
    durationMs: 1000,
    displayFps: 24,
    loopMode: 'loop',
    propIds: [],
    tracks: [],
    createdAt: 1,
    updatedAt: 1,
  })
  const first = insertMotionKeyframe(asset, {
    channelId: 'head.rotation.z',
    timeMs: 1000,
    value: .5,
    keyframeId: 'head-end',
  }).asset
  const second = insertMotionKeyframe(first, {
    channelId: 'head.rotation.z',
    timeMs: 0,
    value: -.5,
    interpolation: 'linear',
    keyframeId: 'head-start',
  }).asset
  const restored = normalizeMotionAsset(JSON.parse(JSON.stringify(second))).asset

  assert.deepEqual(restored.tracks[0]?.keyframes.map(keyframe => keyframe.id), ['head-start', 'head-end'])
  assert.deepEqual(evaluateNormalizedMotionAsset(restored, 500), evaluateNormalizedMotionAsset(restored, 500))
  assert.equal(evaluateNormalizedMotionAsset(restored, 500).values['head.rotation.z'], 0)
})
