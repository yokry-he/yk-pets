/**
 * 文件职责 / File responsibility
 * 验证复杂双足 Three Root Motion、重心、FK 与 IK 的所有权、顺序及生命周期边界。
 */

import assert from 'node:assert/strict'
import {
  compileBipedPetCharacter,
  compileBipedPetMotion,
  createBipedPetModelRecipe,
  normalizeBipedPetRootMotion,
  sampleBipedPetMotion,
  type BipedPetRootMotionDefinition,
  type CompiledCharacterModel,
  type SampledBipedPetMotion,
} from '../packages/pet-core/src/index.ts'
import { BASIC_BIPED_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-basic-biped-motions.ts'
import { createComplexBipedPetObject } from '../apps/playground/app/three/create-complex-biped-pet-object.ts'
import { createComplexBipedRootMotionController } from '../apps/playground/app/three/apply-complex-biped-root-motion.ts'
import { createComplexBipedBalanceController } from '../apps/playground/app/three/apply-complex-biped-balance.ts'
import { createComplexBipedIkController } from '../apps/playground/app/three/apply-complex-biped-ik.ts'
import { createComplexBipedMotionController } from '../apps/playground/app/three/apply-complex-biped-motion.ts'

const walkAsset = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-walk')
const jumpAsset = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-jump')
const waveAsset = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-wave')
assert.ok(walkAsset)
assert.ok(jumpAsset)
assert.ok(waveAsset)

function createRuntime(scale = 1) {
  const recipe = createBipedPetModelRecipe(scale)
  const compilation = compileBipedPetCharacter(recipe)
  assert.equal(compilation.status, 'ready')
  const runtime = createComplexBipedPetObject(compilation, recipe.material)
  return { compilation, runtime }
}

function compile(asset: typeof walkAsset, compilation: CompiledCharacterModel) {
  return compileBipedPetMotion(asset, { boneIds: compilation.bones.map(item => item.id) })
}

function patchSample(sample: SampledBipedPetMotion, patch: Partial<SampledBipedPetMotion>): SampledBipedPetMotion {
  return { ...sample, ...patch }
}

function near(actual: number, expected: number, tolerance = 1e-9, message = `${actual} != ${expected}`) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message)
}

function vectorNear(actual: readonly number[], expected: readonly number[], tolerance = 1e-9) {
  assert.equal(actual.length, expected.length)
  actual.forEach((value, index) => near(value, expected[index]!, tolerance, `向量第 ${index} 项不一致：${value} != ${expected[index]}`))
}

function readCharacterHeight(runtime: ReturnType<typeof createRuntime>['runtime']) {
  const box = runtime.object.geometry.boundingBox
  assert.ok(box)
  return box.max.y - box.min.y
}

function snapshotDisplayPose(runtime: ReturnType<typeof createRuntime>['runtime']) {
  return {
    objectPosition: runtime.object.position.toArray(),
    objectQuaternion: runtime.object.quaternion.toArray(),
    bones: Object.fromEntries([...runtime.bonesById].map(([id, bone]) => [id, {
      position: bone.position.toArray(),
      quaternion: bone.quaternion.toArray(),
    }])),
  }
}

function readContactWorld(
  runtime: ReturnType<typeof createRuntime>['runtime'],
  compilation: CompiledCharacterModel,
  contactId: string,
) {
  const contact = compilation.contacts.find(item => item.id === contactId)
  assert.ok(contact)
  const bone = runtime.bonesById.get(contact.boneId)
  assert.ok(bone)
  runtime.object.updateMatrixWorld(true)
  return bone.position.clone().set(...contact.localPosition).applyMatrix4(bone.matrixWorld)
}

function lockedLeft(sample: SampledBipedPetMotion): SampledBipedPetMotion {
  return patchSample(sample, {
    activeContacts: ['foot.left'],
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
  })
}

function rootMotionDefinition(
  patch: Partial<BipedPetRootMotionDefinition>,
  durationMs = 1200,
): BipedPetRootMotionDefinition {
  return normalizeBipedPetRootMotion({
    mode: 'travel',
    distance: 0,
    turnRadians: 0,
    verticalMode: 'grounded',
    jumpHeight: 0,
    windows: [],
    vfxTags: [],
    ...patch,
  }, durationMs).value
}

function applyTimes(
  times: readonly number[],
  scale = 1,
  sampleFactory?: (sample: SampledBipedPetMotion) => SampledBipedPetMotion,
) {
  const { compilation, runtime } = createRuntime(scale)
  if (scale !== 1 && runtime.object.geometry.boundingBox) {
    runtime.object.geometry.boundingBox.min.multiplyScalar(scale)
    runtime.object.geometry.boundingBox.max.multiplyScalar(scale)
  }
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedRootMotionController(runtime)
  let frame: ReturnType<typeof controller.apply> | undefined
  for (const timeMs of times) {
    const sampled = sampleBipedPetMotion(clip, timeMs)
    frame = controller.apply(sampleFactory ? sampleFactory(sampled) : sampled, 1)
  }
  assert.ok(frame)
  const position = runtime.object.position.toArray()
  const quaternion = runtime.object.quaternion.toArray()
  controller.dispose()
  runtime.dispose()
  return { frame, position, quaternion }
}

// Root Motion 只绝对写 applied 状态；腿/脚局部 position 保持绑定值，reset 完整恢复容器。 / Root Motion writes only absolute applied state; reset restores the container without translating leg bones.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const worldYAxis = runtime.object.position.clone().set(0, 1, 0)
  const xAxis = runtime.object.position.clone().set(1, 0, 0)
  runtime.object.position.set(.3, -.2, .4)
  runtime.object.quaternion
    .setFromAxisAngle(worldYAxis, .37)
    .multiply(runtime.object.quaternion.clone().setFromAxisAngle(xAxis, -.21))
    .normalize()
  const controller = createComplexBipedRootMotionController(runtime)
  const bindPosition = runtime.object.position.clone()
  const bindQuaternion = runtime.object.quaternion.clone()
  runtime.object.up.set(1, 0, 0)
  const localPositions = Object.fromEntries([...runtime.bonesById].map(([id, bone]) => [id, bone.position.toArray()]))
  const first = controller.apply(sampleBipedPetMotion(clip, 100), 1)
  const firstPosition = runtime.object.position.clone()
  const second = controller.apply(sampleBipedPetMotion(clip, 320), 1)
  assert.ok(runtime.object.position.x > firstPosition.x)
  vectorNear(runtime.object.position.toArray(), bindPosition.clone().add(runtime.object.position.clone().set(...second.rootMotion.appliedWorld)).toArray())
  const expectedWorldTurn = runtime.object.quaternion.clone().identity()
    .setFromAxisAngle(worldYAxis, second.rootMotion.appliedTurnRadians)
    .multiply(bindQuaternion)
    .normalize()
  near(runtime.object.quaternion.angleTo(expectedWorldTurn), 0)
  assert.equal(first.rootMotion.status, 'reset')
  for (const [id, bone] of runtime.bonesById) assert.deepEqual(bone.position.toArray(), localPositions[id])
  controller.reset()
  assert.deepEqual(runtime.object.position.toArray(), bindPosition.toArray())
  assert.deepEqual(runtime.object.quaternion.toArray(), bindQuaternion.toArray())
  controller.dispose()
  runtime.dispose()
}

// 正常连续采样在不同帧率到达同一目标时间时，容器 applied 结果一致。 / Normal continuous sequences converge to the same applied transform across frame rates.
{
  const at20 = applyTimes(Array.from({ length: 31 }, (_, index) => index * 20))
  const at40 = applyTimes(Array.from({ length: 16 }, (_, index) => index * 40))
  vectorNear(at20.position, at40.position, 1e-9)
  vectorNear(at20.quaternion, at40.quaternion, 1e-9)
  vectorNear(at20.frame.rootMotion.appliedWorld, at40.frame.rootMotion.appliedWorld, 1e-9)
}

// 巨大 target 跳变受单帧 0.25×身高预算保护，并由后续连续帧追赶欠量。 / A huge target jump is frame-budgeted and its debt is chased by later continuous frames.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const definition = rootMotionDefinition({
    distance: 4,
    windows: [{ id: 'large-travel', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 }],
  })
  const controller = createComplexBipedRootMotionController(runtime)
  const sampleAt = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), { rootMotion: definition })
  controller.apply(sampleAt(0), 1)
  const before = runtime.object.position.clone()
  const clamped = controller.apply(sampleAt(600), 1)
  const budget = readCharacterHeight(runtime) * .25
  assert.equal(clamped.rootMotion.status, 'clamped')
  assert.ok(runtime.object.position.distanceTo(before) <= budget + 1e-9)
  let chased = clamped
  for (let timeMs = 601; timeMs <= 608; timeMs++) chased = controller.apply(sampleAt(timeMs), 1)
  assert.ok(runtime.object.position.x > clamped.rootMotion.appliedWorld[0])
  assert.ok(runtime.object.position.x <= chased.rootMotion.cumulativeWorld[0] + 1e-9)
  controller.dispose()
  runtime.dispose()
}

// 暂停不移动、不发信号并保留待消费落地授权；同一采样不得重建控制器状态。 / Pause preserves pending landing authorization without movement, signals, or controller rebuilds.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(jumpAsset, compilation)
  const definition = rootMotionDefinition({
    verticalMode: 'ballistic',
    jumpHeight: 1.5,
    windows: [{ id: 'short-jump', kind: 'ballistic', startMs: 240, endMs: 480, weight: 1 }],
    vfxTags: ['landing-ring'],
  }, clip.durationMs)
  const controller = createComplexBipedRootMotionController(runtime)
  const sampleAt = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), { rootMotion: definition })
  controller.apply(sampleAt(200), 1)
  controller.apply(sampleAt(360), 1)
  controller.apply(sampleAt(400), 1)
  const beforePause = controller.apply(sampleAt(480), 1)
  assert.ok(beforePause.rootMotion.landingAuthorization)
  const position = runtime.object.position.clone()
  const paused = controller.apply(sampleAt(480), 1)
  assert.deepEqual(paused.rootMotion.landingAuthorization, beforePause.rootMotion.landingAuthorization)
  assert.equal(paused.rootMotion.landingImpulse, 0)
  assert.deepEqual(paused.vfxSignals, [])
  assert.deepEqual(runtime.object.position.toArray(), position.toArray())
  controller.dispose()
  runtime.dispose()
}

// 同一 canonical touchdown 在粗跨界帧与边界细分帧中各消费一次，冲量不依赖帧细分。 / The same canonical touchdown is consumed once with identical impulse under coarse and split boundary frames.
{
  const runLanding = (tail: readonly number[]) => {
    const { compilation, runtime } = createRuntime()
    const clip = compile(jumpAsset, compilation)
    const controller = createComplexBipedRootMotionController(runtime)
    const frames = []
    for (const timeMs of [...Array.from({ length: 46 }, (_, index) => index * 40), ...tail]) {
      frames.push(controller.apply(sampleBipedPetMotion(clip, timeMs), 1))
    }
    const impulses = frames.filter(frame => frame.rootMotion.landingImpulse > 0)
    const landingSignals = frames.flatMap(frame => frame.vfxSignals.filter(signal => signal.kind.startsWith('landing-')))
    controller.dispose()
    runtime.dispose()
    return { impulses, landingSignals }
  }
  const coarse = runLanding([1840])
  const split = runLanding([1824, 1840])
  assert.equal(coarse.impulses.length, 1)
  assert.equal(split.impulses.length, 1)
  near(coarse.impulses[0]!.rootMotion.landingImpulse, split.impulses[0]!.rootMotion.landingImpulse, 1e-12)
  assert.deepEqual(coarse.landingSignals.map(signal => signal.kind).sort(), ['landing-dust', 'landing-ring'])
  assert.deepEqual(split.landingSignals.map(signal => signal.kind).sort(), ['landing-dust', 'landing-ring'])
  assert.equal(new Set(coarse.landingSignals.map(signal => signal.id)).size, coarse.landingSignals.length)
  assert.equal(new Set(split.landingSignals.map(signal => signal.id)).size, split.landingSignals.length)
}

// 同 Clip 的 travel+ballistic 首个 takeoff 必须先由零反馈确定相位；上一帧 residual 不得污染离地帧。 / A same-Clip travel+ballistic takeoff must be phase-classified with zero feedback before any previous residual can be consumed.
{
  const baseline = createRuntime()
  const withFeedback = createRuntime()
  const clip = compile(walkAsset, baseline.compilation)
  const definition = rootMotionDefinition({
    distance: .42,
    verticalMode: 'ballistic',
    jumpHeight: .28,
    windows: [
      { id: 'joint-travel', kind: 'travel', startMs: 0, endMs: 1200, weight: 1 },
      { id: 'joint-ballistic', kind: 'ballistic', startMs: 300, endMs: 900, weight: 1 },
    ],
  })
  const sampleAt = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), {
    clipHash: `${clip.hash}:joint-travel-ballistic`,
    rootMotion: definition,
  })
  const baselineController = createComplexBipedRootMotionController(baseline.runtime)
  const feedbackController = createComplexBipedRootMotionController(withFeedback.runtime)
  for (const timeMs of [0, 280]) {
    baselineController.apply(sampleAt(timeMs), 1)
    feedbackController.apply(sampleAt(timeMs), 1)
  }
  const withoutResidual = baselineController.apply(sampleAt(320), 1)
  const withResidual = feedbackController.apply(sampleAt(320), 1, [-.02, 0, 0])
  assert.equal(withoutResidual.rootMotion.phase, 'takeoff')
  assert.equal(withResidual.rootMotion.phase, 'takeoff')
  vectorNear(withResidual.rootMotion.appliedWorld, withoutResidual.rootMotion.appliedWorld, 1e-12)
  vectorNear(withResidual.rootMotion.deltaWorld, withoutResidual.rootMotion.deltaWorld, 1e-12)
  baselineController.dispose()
  feedbackController.dispose()
  baseline.runtime.dispose()
  withFeedback.runtime.dispose()
}

// 停止、回拖与 Clip 切换都清除旧 applied/授权/欠量，并在当前目标无速度 reset。 / Stop, rewind, and Clip switch clear applied state, authorization, and debt with a stationary reset.
for (const transition of ['stop', 'rewind', 'clip-switch'] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedRootMotionController(runtime)
  controller.apply(sampleBipedPetMotion(clip, 100), 1)
  controller.apply(sampleBipedPetMotion(clip, 320), 1)
  const next = transition === 'stop'
    ? controller.apply(sampleBipedPetMotion(clip, 340), 0)
    : transition === 'rewind'
      ? controller.apply(sampleBipedPetMotion(clip, 80), 1)
      : controller.apply(patchSample(sampleBipedPetMotion(clip, 340), { clipHash: `${clip.hash}:next` }), 1)
  assert.equal(next.rootMotion.status, 'reset', `${transition} 必须 reset`)
  assert.deepEqual(next.rootMotion.deltaWorld, [0, 0, 0])
  assert.equal(next.rootMotion.landingAuthorization, undefined)
  assert.deepEqual(next.vfxSignals, [])
  if (transition === 'stop') assert.deepEqual(runtime.object.position.toArray(), [0, 0, 0])
  controller.dispose()
  runtime.dispose()
}

// 角色高度由 geometry.boundingBox 决定；同一归一化步幅按模型尺寸线性缩放。 / Character height comes from geometry.boundingBox and scales normalized stride linearly.
{
  const small = applyTimes([0, 600], 1)
  const large = applyTimes([0, 600], 2)
  near(large.position[0]!, small.position[0]! * 2, 1e-8)
}

// 无有效包围盒只阻塞 Root Motion；外层动作控制器仍写入 FK。 / An invalid bounding box blocks Root Motion only while the outer controller still applies FK.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(waveAsset, compilation)
  runtime.object.geometry.boundingBox = null
  const controller = createComplexBipedMotionController(runtime, compilation)
  const chest = runtime.bonesById.get('chest')!
  const bindChest = chest.quaternion.clone()
  const frame = controller.apply(sampleBipedPetMotion(clip, 1400), 1)
  assert.equal(frame.rootMotion.status, 'blocked')
  assert.ok(chest.quaternion.angleTo(bindChest) > 1e-3)
  controller.dispose()
  runtime.dispose()
}

// 重心控制器只拥有 pelvis X/Z 与 chest Quaternion，且偏移/倾角受尺寸预算限制。 / Balance owns only pelvis X/Z and chest Quaternion under scale-aware bounds.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(waveAsset, compilation)
  const height = readCharacterHeight(runtime)
  const pelvis = runtime.bonesById.get('pelvis')!
  const chest = runtime.bonesById.get('chest')!
  const bindPelvis = pelvis.position.clone()
  const bindChest = chest.quaternion.clone()
  const controller = createComplexBipedBalanceController(runtime, compilation, height)
  const single = lockedLeft(sampleBipedPetMotion(clip, 500))
  const double = patchSample(single, {
    activeContacts: ['foot.left', 'foot.right'],
    contactStates: [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 },
    ],
  })
  controller.apply(double, 1, {
    deltaLocal: [height * .1, 0, 0], phase: 'grounded', motionIntensity: 1,
  })
  near(pelvis.position.x, bindPelvis.x)
  assert.ok(Math.abs(pelvis.position.z - bindPelvis.z) <= height * .025 + 1e-9)
  assert.ok(chest.quaternion.angleTo(bindChest) <= .12 + 1e-9)
  controller.reset()
  controller.apply(single, 1, {
    deltaLocal: [height * .1, 0, 0], phase: 'grounded', motionIntensity: 1,
  })
  assert.ok(Math.hypot(pelvis.position.x - bindPelvis.x, pelvis.position.z - bindPelvis.z) > 0)
  assert.ok(Math.hypot(pelvis.position.x - bindPelvis.x, pelvis.position.z - bindPelvis.z) <= height * .025 + 1e-9)
  assert.ok(chest.quaternion.angleTo(bindChest) <= .12 + 1e-9)
  const y = pelvis.position.y
  controller.apply(patchSample(single, { contactStates: [], activeContacts: [] }), 1, {
    deltaLocal: [height, height, height], phase: 'airborne', motionIntensity: 1,
  })
  near(pelvis.position.x, bindPelvis.x)
  near(pelvis.position.z, bindPelvis.z)
  near(pelvis.position.y, y)
  near(chest.quaternion.angleTo(bindChest), 0)

  // 若外层 FK 已写入新姿态，控制器不得把它误认成自己上一帧的 tilt 后再反向修改。 / A fresh external FK pose must not be mistaken for, and inverse-modified as, the prior owned tilt.
  const nextFk = bindChest.clone().multiply(chest.quaternion.clone().identity().setFromAxisAngle(runtime.object.up, .08)).normalize()
  chest.quaternion.copy(nextFk)
  controller.apply(patchSample(single, { contactStates: [], activeContacts: [] }), 1, {
    deltaLocal: [0, 0, 0], phase: 'airborne', motionIntensity: 0,
  })
  near(chest.quaternion.angleTo(nextFk), 0)

  controller.reset()
  controller.apply(single, 1, {
    deltaLocal: [height * .1, 0, 0], phase: 'grounded', motionIntensity: 1,
  })
  assert.ok(Math.hypot(pelvis.position.x - bindPelvis.x, pelvis.position.z - bindPelvis.z) > 0)
  controller.apply(single, 1, {
    deltaLocal: [height * .1, -height * .1, 0], phase: 'landing', motionIntensity: 1,
  })
  near(pelvis.position.x, bindPelvis.x)
  near(pelvis.position.z, bindPelvis.z)
  near(chest.quaternion.angleTo(bindChest), 0)
  controller.reset()
  assert.deepEqual(pelvis.position.toArray(), bindPelvis.toArray())
  assert.deepEqual(chest.quaternion.toArray(), bindChest.toArray())
  controller.dispose()
  controller.dispose()
  runtime.dispose()
}

// IK 数值报告产生的有限局部水平残差在下一帧被 Root Motion 消费；Y 永远为零。 / The next Root Motion frame consumes a finite local horizontal IK residual with Y forced to zero.
// 同一旧残差进入原地、travel 空隙或腾空段时，容器均不得额外漂移。 / A stale residual cannot drift the container in-place, across a travel gap, or while airborne.
{
  {
    const { compilation, runtime } = createRuntime()
    const walkClip = compile(walkAsset, compilation)
    const waveClip = compile(waveAsset, compilation)
    const controller = createComplexBipedMotionController(runtime, compilation)
    controller.apply(lockedLeft(sampleBipedPetMotion(walkClip, 100)), 1)
    const residualFrame = controller.apply(lockedLeft(sampleBipedPetMotion(walkClip, 320)), 1)
    assert.ok(residualFrame.nextFootResidual.every(Number.isFinite))
    assert.equal(residualFrame.nextFootResidual[1], 0)
    assert.ok(Math.hypot(residualFrame.nextFootResidual[0], residualFrame.nextFootResidual[2]) > 0)
    const consumedFrame = controller.apply(lockedLeft(sampleBipedPetMotion(walkClip, 340)), 1)
    assert.deepEqual(consumedFrame.consumedFootResidual, residualFrame.nextFootResidual)
    assert.equal(consumedFrame.consumedFootResidual[1], 0)
    const inPlace = controller.apply(lockedLeft(sampleBipedPetMotion(waveClip, 400)), 1)
    assert.equal(inPlace.rootMotion.status, 'reset')
    assert.deepEqual(runtime.object.position.toArray(), [0, 0, 0])
    controller.dispose()
    runtime.dispose()
  }

  {
    const { compilation, runtime } = createRuntime()
    const walkClip = compile(walkAsset, compilation)
    const gappedDefinition = rootMotionDefinition({
      distance: .42,
      windows: [{ id: 'travel-before-gap', kind: 'travel', startMs: 0, endMs: 300, weight: 1 }],
    })
    const controller = createComplexBipedMotionController(runtime, compilation)
    const gapAt = (timeMs: number) => lockedLeft(patchSample(sampleBipedPetMotion(walkClip, timeMs), { rootMotion: gappedDefinition }))
    controller.apply(gapAt(100), 1)
    const beforeGap = controller.apply(gapAt(280), 1)
    assert.ok(Math.hypot(beforeGap.nextFootResidual[0], beforeGap.nextFootResidual[2]) > 0)
    const gapStart = controller.apply(gapAt(320), 1)
    assert.deepEqual(gapStart.nextFootResidual, [0, 0, 0])
    const gapEnd = controller.apply(gapAt(360), 1)
    assert.deepEqual(gapEnd.consumedFootResidual, [0, 0, 0])
    vectorNear(gapEnd.rootMotion.appliedWorld, gapStart.rootMotion.appliedWorld, 1e-12)
    controller.dispose()
    runtime.dispose()
  }

  {
    const { compilation, runtime } = createRuntime()
    const walkClip = compile(walkAsset, compilation)
    const jumpClip = compile(jumpAsset, compilation)
    const controller = createComplexBipedMotionController(runtime, compilation)
    controller.apply(lockedLeft(sampleBipedPetMotion(walkClip, 100)), 1)
    const previous = controller.apply(lockedLeft(sampleBipedPetMotion(walkClip, 320)), 1)
    assert.ok(Math.hypot(previous.nextFootResidual[0], previous.nextFootResidual[2]) > 0)
    const airborneSample = patchSample(sampleBipedPetMotion(jumpClip, 1200), { contactStates: [], activeContacts: [] })
    const airborne = controller.apply(airborneSample, 1)
    assert.equal(airborne.rootMotion.status, 'reset')
    assert.equal(airborne.rootMotion.appliedWorld[0], 0)
    assert.deepEqual(airborne.nextFootResidual, [0, 0, 0])
    controller.dispose()
    runtime.dispose()
  }
}

// Root Motion 的 takeoff/airborne/landing 相位优先于动作资产里滞后的接触权重；真实 grounded touchdown 才能重新捕获。 / Root Motion takeoff/airborne/landing phases override stale authored contact weights; only a real grounded touchdown may recapture.
for (const expectedPhase of ['takeoff', 'airborne'] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compile(jumpAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const pelvis = runtime.bonesById.get('pelvis')!
  const bindY = pelvis.position.y
  const withStaleContact = (timeMs: number) => lockedLeft(sampleBipedPetMotion(clip, timeMs))
  controller.apply(withStaleContact(400), 1)
  let frame = controller.apply(withStaleContact(880), 1)
  if (expectedPhase === 'airborne') frame = controller.apply(withStaleContact(880), 1)
  assert.equal(frame.rootMotion.phase, expectedPhase)
  assert.equal(frame.ikReport.supportingContacts, 0, `${expectedPhase} 不得继续消费滞后接触权重`)
  assert.deepEqual(frame.ikReport.residualByLimb, {})
  assert.deepEqual(frame.nextFootResidual, [0, 0, 0])
  near(pelvis.position.y, bindY, 1e-12, `${expectedPhase} 必须恢复 pelvis 绑定 Y`)
  controller.dispose()
  runtime.dispose()
}

{
  const { compilation, runtime } = createRuntime()
  const fkOnly = createRuntime()
  const clip = compile(jumpAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const fkController = createComplexBipedMotionController(fkOnly.runtime)
  const pelvis = runtime.bonesById.get('pelvis')!
  const chest = runtime.bonesById.get('chest')!
  const fkChest = fkOnly.runtime.bonesById.get('chest')!
  const bindPelvis = pelvis.position.clone()
  const withStaleContact = (timeMs: number) => lockedLeft(sampleBipedPetMotion(clip, timeMs))
  for (const timeMs of [400, 800, 1200, 1280]) {
    const sample = withStaleContact(timeMs)
    controller.apply(sample, 1)
    fkController.apply(sample, 1)
  }
  for (let timeMs = 1300; timeMs <= 1680; timeMs += 20) {
    const sample = withStaleContact(timeMs)
    const frame = controller.apply(sample, 1)
    fkController.apply(sample, 1)
    assert.equal(frame.rootMotion.phase, 'landing')
    assert.equal(frame.ikReport.supportingContacts, 0, `${timeMs}ms 下降段不得消费滞后接触权重`)
    assert.deepEqual(frame.nextFootResidual, [0, 0, 0])
    near(pelvis.position.x, bindPelvis.x)
    near(pelvis.position.y, bindPelvis.y)
    near(pelvis.position.z, bindPelvis.z)
    near(chest.quaternion.angleTo(fkChest.quaternion), 0)
  }
  const touchdownSample = withStaleContact(1840)
  const touchdown = controller.apply(touchdownSample, 1)
  fkController.apply(touchdownSample, 1)
  assert.equal(touchdown.rootMotion.phase, 'grounded')
  assert.equal(touchdown.ikReport.supportingContacts, 1)
  controller.dispose()
  fkController.dispose()
  runtime.dispose()
  fkOnly.runtime.dispose()
}

// 同时间同权重重复 apply 是完整显示姿态暂停：Root 仍处理 token，但 FK/Balance/IK 与 residual 状态均冻结。 / A duplicate same-time/same-weight apply freezes the full display pose while Root still maintains token semantics.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  controller.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
  const sample = lockedLeft(sampleBipedPetMotion(clip, 320))
  const first = controller.apply(sample, 2)
  const pose = snapshotDisplayPose(runtime)
  // 2 与 1 都归一化为 1，应识别为同一暂停权重。 / Both 2 and 1 normalize to 1 and must be treated as the same paused weight.
  const paused = controller.apply(sample, 1)
  assert.deepEqual(snapshotDisplayPose(runtime), pose)
  assert.deepEqual(paused.vfxSignals, [])
  assert.deepEqual(paused.consumedFootResidual, [0, 0, 0])
  assert.deepEqual(paused.nextFootResidual, first.nextFootResidual)
  assert.ok(Object.isFrozen(paused))
  const resumed = controller.apply(lockedLeft(sampleBipedPetMotion(clip, 340)), 1)
  assert.deepEqual(resumed.consumedFootResidual, first.nextFootResidual)
  controller.dispose()
  runtime.dispose()
}

// 权重或 Clip 身份变化即使 requestedTime 相同也必须重新求姿态，不能误判为暂停。 / Weight or Clip identity changes at the same requested time must recompute the pose rather than being mistaken for pause.
{
  const { compilation, runtime } = createRuntime()
  const walkClip = compile(walkAsset, compilation)
  const waveClip = compile(waveAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const walk = lockedLeft(sampleBipedPetMotion(walkClip, 320))
  controller.apply(walk, 1)
  const fullWeight = snapshotDisplayPose(runtime)
  controller.apply(walk, .5)
  assert.notDeepEqual(snapshotDisplayPose(runtime), fullWeight)
  const halfWeight = snapshotDisplayPose(runtime)
  controller.apply(lockedLeft(sampleBipedPetMotion(waveClip, 320)), .5)
  assert.notDeepEqual(snapshotDisplayPose(runtime), halfWeight)
  controller.dispose()
  runtime.dispose()
}

// 带待消费 landing authorization 的重复帧同样冻结完整姿态，且不重复生成 VFX。 / A duplicate frame with pending landing authorization also freezes the full pose without duplicating VFX.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(jumpAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const definition = rootMotionDefinition({
    verticalMode: 'ballistic',
    jumpHeight: 1.5,
    windows: [{ id: 'pause-jump', kind: 'ballistic', startMs: 240, endMs: 480, weight: 1 }],
    vfxTags: ['landing-ring'],
  }, clip.durationMs)
  const sampleAt = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), { rootMotion: definition })
  for (const timeMs of [200, 360, 400]) controller.apply(sampleAt(timeMs), 1)
  const sample = sampleAt(480)
  const beforePause = controller.apply(sample, 1)
  assert.ok(beforePause.rootMotion.landingAuthorization)
  const pose = snapshotDisplayPose(runtime)
  const paused = controller.apply(sample, 1)
  assert.deepEqual(snapshotDisplayPose(runtime), pose)
  assert.deepEqual(paused.rootMotion.landingAuthorization, beforePause.rootMotion.landingAuthorization)
  assert.deepEqual(paused.vfxSignals, [])
  assert.deepEqual(paused.consumedFootResidual, [0, 0, 0])
  controller.dispose()
  runtime.dispose()
}

// IK 帧报告深冻结、不暴露 Bone；腾空不锁脚，有限诊断和原有局部 position 所有权保持。 / IK reports are deeply frozen and Bone-free; airborne frames release feet without taking local-position ownership.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedIkController(runtime, compilation)
  const foot = runtime.bonesById.get('foot.left')!
  const footPosition = foot.position.toArray()
  const first = controller.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
  const anchor = readContactWorld(runtime, compilation, 'foot.left')
  const report = controller.apply(lockedLeft(sampleBipedPetMotion(clip, 320)), 1)
  assert.ok(Object.isFrozen(report))
  assert.ok(Object.isFrozen(report.residualByLimb))
  assert.ok(Object.isFrozen(report.clampedLimbs))
  assert.equal(report.supportingContacts, 1)
  assert.equal(typeof report.residualByLimb['leg.left'], 'number')
  assert.ok(!Object.values(report.residualByLimb).some(value => typeof value === 'object'))
  assert.deepEqual(foot.position.toArray(), footPosition)
  const airborne = patchSample(sampleBipedPetMotion(clip, 340), { contactStates: [], activeContacts: [] })
  controller.apply(airborne, 1)
  foot.position.x += .01
  runtime.object.updateMatrixWorld(true)
  controller.apply(airborne, 1)
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(anchor) > 1e-3)
  controller.dispose()
  controller.dispose()
  const released = controller.apply(airborne, 1)
  assert.equal(released.supportingContacts, 0)
  assert.ok(controller.diagnostics().some(item => item.includes('已释放')))
  runtime.dispose()
}

// 报告只包含真实水平面残差：纯 Y 接触误差不得泄漏成下一帧 Root Motion 的水平 feedback。 / Reports contain true horizontal-plane residuals only: a pure-Y contact error must not leak into next-frame horizontal Root Motion feedback.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(waveAsset, compilation)
  const controller = createComplexBipedIkController(runtime, compilation)
  const sample = lockedLeft(sampleBipedPetMotion(clip, 100))
  controller.apply(sample, 1)
  runtime.object.position.y += .02
  runtime.object.updateMatrixWorld(true)
  const report = controller.apply(sample, Number.MIN_VALUE)
  assert.equal(report.supportingContacts, 1)
  const horizontalResidual = report.residualByLimb['leg.left']!
  near(horizontalResidual, 0, 1e-12, `纯 Y 误差的水平残差幅值必须为零，实际 ${horizontalResidual}`)
  controller.dispose()
  runtime.dispose()
}

// weight/confidence 必须同时为正有限数才是有效支撑；无效状态不得捕获锚、写 pelvis Y 或生成 feedback。 / Weight and confidence must both be finite and positive; invalid states cannot capture anchors, write pelvis Y, or generate feedback.
for (const invalidState of [
  { weight: 1, confidence: 0 },
  { weight: 1, confidence: Number.NaN },
  { weight: Number.NaN, confidence: 1 },
] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const pelvis = runtime.bonesById.get('pelvis')!
  const bindY = pelvis.position.y
  const invalid = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), {
    activeContacts: ['foot.left'],
    contactStates: [{ contactId: 'foot.left', phase: 'locked', ...invalidState }],
  })
  for (const timeMs of [100, 320]) {
    const frame = controller.apply(invalid(timeMs), 1)
    assert.equal(frame.ikReport.supportingContacts, 0)
    assert.deepEqual(frame.ikReport.residualByLimb, {})
    assert.deepEqual(frame.nextFootResidual, [0, 0, 0])
    near(pelvis.position.y, bindY)
  }
  const valid = controller.apply(lockedLeft(sampleBipedPetMotion(clip, 340)), 1)
  assert.equal(valid.ikReport.supportingContacts, 1)
  near(valid.ikReport.residualByLimb['leg.left']!, 0, 1e-12)
  controller.dispose()
  runtime.dispose()
}

// 单支撑 pelvis Y 可达补偿默认关闭；只在完整 Root Motion 集成策略中开启并按身高钳制。 / Single-support pelvis-Y reach compensation is opt-in for the integrated Root Motion chain and height-bounded.
{
  const run = (integrated: boolean, heightScale = 1) => {
    const { compilation, runtime } = createRuntime()
    const clip = compile(walkAsset, compilation)
    const height = readCharacterHeight(runtime) * heightScale
    const fk = createComplexBipedMotionController(runtime)
    const ik = createComplexBipedIkController(runtime, compilation, {
      integratedSingleSupportPelvisY: integrated,
      characterHeight: height,
    })
    const pelvis = runtime.bonesById.get('pelvis')!
    const bindY = pelvis.position.y
    fk.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
    ik.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
    fk.apply(lockedLeft(sampleBipedPetMotion(clip, 320)), 1)
    const report = ik.apply(lockedLeft(sampleBipedPetMotion(clip, 320)), 1)
    const offset = pelvis.position.y - bindY
    const airborne = patchSample(sampleBipedPetMotion(clip, 340), { contactStates: [], activeContacts: [] })
    fk.apply(airborne, 1)
    ik.apply(airborne, 1)
    near(pelvis.position.y, bindY)
    ik.apply(lockedLeft(sampleBipedPetMotion(clip, 360)), 0)
    near(pelvis.position.y, bindY)
    ik.reset()
    near(pelvis.position.y, bindY)
    const diagnostics = ik.diagnostics()
    ik.dispose()
    fk.dispose()
    runtime.dispose()
    return { offset, report, diagnostics, height }
  }
  const defaultPolicy = run(false)
  near(defaultPolicy.offset, 0)
  const integrated = run(true)
  assert.ok(Math.abs(integrated.offset) > 0)
  assert.ok(Math.abs(integrated.offset) <= Math.min(.08, integrated.height * .025) + 1e-9)
  const small = run(true, .05)
  assert.ok(Math.abs(small.offset) <= small.height * .025 + 1e-9)
  assert.ok(Math.abs(small.offset) < Math.abs(integrated.offset))
  assert.ok(small.report.clampedLimbs.includes('leg.left'))
  assert.ok(small.diagnostics.some(item => item.includes('骨盆 Y') && item.includes('clamped')))
}

// 固定顺序 FK→Root Motion→Balance→IK：支撑残差小于纯 FK，对局部位移和段长零侵入。 / The fixed FK→Root Motion→Balance→IK order beats FK residual without changing local positions or segment lengths.
{
  const withIk = createRuntime()
  const fkOnly = createRuntime()
  const clip = compile(walkAsset, withIk.compilation)
  const controller = createComplexBipedMotionController(withIk.runtime, withIk.compilation)
  const fkController = createComplexBipedMotionController(fkOnly.runtime)
  const footPositions = Object.fromEntries([...withIk.runtime.bonesById].map(([id, bone]) => [id, bone.position.toArray()]))
  const chainIds = withIk.compilation.limbIk.find(item => item.id === 'leg.left')!.boneIds
  const segmentLengths = (runtime: typeof withIk.runtime) => {
    runtime.object.updateMatrixWorld(true)
    return chainIds.slice(1).map((id, index) => runtime.bonesById.get(chainIds[index]!)!.getWorldPosition(runtime.object.position.clone())
      .distanceTo(runtime.bonesById.get(id)!.getWorldPosition(runtime.object.position.clone())))
  }
  const bindLengths = segmentLengths(withIk.runtime)
  const leftLimb = withIk.compilation.limbIk.find(item => item.id === 'leg.left')!
  const leftContactBoneId = withIk.compilation.contacts.find(item => item.id === leftLimb.contactId)!.boneId
  const correctionBoneIds = new Set([...leftLimb.boneIds, leftContactBoneId])
  controller.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
  fkController.apply(lockedLeft(sampleBipedPetMotion(clip, 100)), 1)
  const anchor = readContactWorld(withIk.runtime, withIk.compilation, 'foot.left')
  const fkAnchor = readContactWorld(fkOnly.runtime, fkOnly.compilation, 'foot.left')
  controller.apply(lockedLeft(sampleBipedPetMotion(clip, 320)), 1)
  fkController.apply(lockedLeft(sampleBipedPetMotion(clip, 320)), 1)
  const residual = readContactWorld(withIk.runtime, withIk.compilation, 'foot.left').distanceTo(anchor)
  const fkResidual = readContactWorld(fkOnly.runtime, fkOnly.compilation, 'foot.left').distanceTo(fkAnchor)
  assert.ok(residual <= 7.5e-4, `协同后支撑残差应保留稳定裕量并不高于 7.5e-4，实际 ${residual}`)
  assert.ok(fkResidual > residual, `纯 FK 残差应更大：fk=${fkResidual}, ik=${residual}`)
  const pelvis = withIk.runtime.bonesById.get('pelvis')!
  const pelvisBindY = withIk.compilation.bones.find(item => item.id === 'pelvis')!.position[1]
  assert.ok(Math.abs(pelvis.position.y - pelvisBindY) <= Math.min(.08, readCharacterHeight(withIk.runtime) * .025) + 1e-9)
  for (const boneId of correctionBoneIds) {
    const correction = withIk.runtime.bonesById.get(boneId)!.quaternion.angleTo(fkOnly.runtime.bonesById.get(boneId)!.quaternion)
    assert.ok(correction <= leftLimb.maxCorrectionRadians + 1e-6, `${boneId} 的累计 IK 角修正越界：${correction}`)
  }
  for (const [id, bone] of withIk.runtime.bonesById) if (id !== 'pelvis' && id !== 'root') {
    assert.deepEqual(bone.position.toArray(), footPositions[id])
  }
  vectorNear(segmentLengths(withIk.runtime), bindLengths, 1e-8)
  controller.dispose()
  fkController.dispose()
  withIk.runtime.dispose()
  fkOnly.runtime.dispose()
}

// blocked Root Motion 不能阻塞 FK/IK；外层控制器释放幂等且释放后拒绝 apply。 / Blocked Root Motion cannot block FK/IK; outer disposal is idempotent and rejects later apply.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const chest = runtime.bonesById.get('chest')!
  const bindChest = chest.quaternion.clone()
  const invalid = patchSample(sampleBipedPetMotion(clip, 320), {
    rootMotion: { ...sampleBipedPetMotion(clip, 320).rootMotion, distance: Number.NaN },
  })
  const frame = controller.apply(invalid, 1)
  assert.equal(frame.rootMotion.status, 'blocked')
  assert.ok(chest.quaternion.angleTo(bindChest) > 1e-4)
  assert.equal(frame.ikReport.supportingContacts, 1)
  assert.equal(typeof frame.ikReport.residualByLimb['leg.left'], 'number')
  controller.dispose()
  controller.dispose()
  assert.throws(() => controller.apply(invalid, 1), /已释放/)
  runtime.dispose()
}

// Root Motion 与 IK 诊断每次返回独立冻结快照，外部不能污染内部集合。 / Root Motion and IK diagnostics return independent frozen snapshots immune to caller mutation.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  runtime.object.geometry.boundingBox = null
  const rootController = createComplexBipedRootMotionController(runtime)
  rootController.apply(sampleBipedPetMotion(clip, 100), 1)
  const rootFirst = rootController.diagnostics()
  const rootSecond = rootController.diagnostics()
  assert.ok(Object.isFrozen(rootFirst))
  assert.ok(Object.isFrozen(rootSecond))
  assert.notEqual(rootFirst, rootSecond)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const ikFirst = ikController.diagnostics()
  const ikSecond = ikController.diagnostics()
  assert.ok(Object.isFrozen(ikFirst))
  assert.ok(Object.isFrozen(ikSecond))
  assert.notEqual(ikFirst, ikSecond)
  rootController.dispose()
  rootController.dispose()
  assert.throws(() => rootController.apply(sampleBipedPetMotion(clip, 120), 1), /已释放/)
  ikController.dispose()
  runtime.dispose()
}

// runtime 重建天然拥有独立绑定状态；旧控制器释放后不能写入新对象。 / Rebuilt runtimes own independent bind state and disposed controllers cannot write the new object.
{
  const first = createRuntime()
  const firstClip = compile(walkAsset, first.compilation)
  const firstController = createComplexBipedRootMotionController(first.runtime)
  firstController.apply(sampleBipedPetMotion(firstClip, 0), 1)
  firstController.apply(sampleBipedPetMotion(firstClip, 320), 1)
  firstController.dispose()
  first.runtime.dispose()
  const second = createRuntime()
  assert.deepEqual(second.runtime.object.position.toArray(), [0, 0, 0])
  assert.throws(() => firstController.apply(sampleBipedPetMotion(firstClip, 340), 1), /已释放/)
  second.runtime.dispose()
}

// 同一 runtime 只能有一个 Root Motion 写入者；释放后可重建，已释放 runtime 拒绝创建。 / A runtime has exactly one Root Motion writer; disposal releases ownership, while a disposed runtime rejects creation.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const first = createComplexBipedRootMotionController(runtime)
  first.apply(sampleBipedPetMotion(clip, 100), 1)
  const position = runtime.object.position.toArray()
  assert.throws(() => createComplexBipedRootMotionController(runtime), /同一运行时.*Root Motion.*控制器/)
  assert.deepEqual(runtime.object.position.toArray(), position)
  first.dispose()
  const second = createComplexBipedRootMotionController(runtime)
  second.dispose()
  runtime.dispose()
  assert.throws(() => createComplexBipedRootMotionController(runtime), /运行时已释放/)
}

// 外层构造在 IK 初始化中途失败时必须释放已经取得的 Root Motion 令牌。 / An outer-construction failure during IK initialization must release the acquired Root Motion token.
{
  const { compilation, runtime } = createRuntime()
  const bone = runtime.bonesById.get('thigh.left')!
  const getWorldPosition = bone.getWorldPosition
  bone.getWorldPosition = () => { throw new Error('测试注入：IK 构造失败') }
  assert.throws(() => createComplexBipedMotionController(runtime, compilation), /IK 构造失败/)
  bone.getWorldPosition = getWorldPosition
  const controller = createComplexBipedRootMotionController(runtime)
  controller.dispose()
  runtime.dispose()
}

// Root 控制器自身初始化失败也必须释放刚登记的运行时所有权。 / Root-controller initialization failure must also release its newly registered runtime ownership.
{
  const { runtime } = createRuntime()
  const clone = runtime.object.position.clone
  runtime.object.position.clone = () => { throw new Error('测试注入：Root 初始化失败') }
  assert.throws(() => createComplexBipedRootMotionController(runtime), /Root 初始化失败/)
  runtime.object.position.clone = clone
  const controller = createComplexBipedRootMotionController(runtime)
  controller.dispose()
  runtime.dispose()
}

// 自然 walk 与 ping-pong 长序列不得因标量 strain feedback 产生振荡、过冲或伪造侧向向量。 / Long natural walk and ping-pong sequences must not oscillate, overshoot, or invent lateral vectors from scalar strain feedback.
for (const loopMode of ['loop', 'ping-pong'] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  let previousApplied = 0
  let previousTarget = 0
  for (let timeMs = 0; timeMs <= 3600; timeMs += 20) {
    const sample = patchSample(sampleBipedPetMotion(clip, timeMs), { loopMode })
    const frame = controller.apply(sample, 1)
    const applied = frame.rootMotion.appliedLocal[0]
    const target = frame.rootMotion.cumulativeLocal[0]
    assert.ok(Number.isFinite(applied) && Number.isFinite(target))
    const targetDirection = Math.sign(target - previousTarget)
    if (targetDirection !== 0) assert.ok((applied - previousApplied) * targetDirection >= -1e-9, `${loopMode}@${timeMs}ms 出现反向振荡`)
    if (loopMode === 'loop') assert.ok(applied <= target + 1e-9, `${loopMode}@${timeMs}ms 超过绝对目标`)
    else assert.ok(applied >= -1e-9 && applied <= .42 * readCharacterHeight(runtime) + 1e-9, `${loopMode}@${timeMs}ms 越过往返范围`)
    assert.ok(Math.abs(frame.nextFootResidual[2]) <= 1e-12, `${loopMode}@${timeMs}ms 标量 strain 不得伪称侧向误差向量`)
    previousApplied = applied
    previousTarget = target
  }
  controller.dispose()
  runtime.dispose()
}

console.log('studio complex biped Root Motion runtime tests passed')
