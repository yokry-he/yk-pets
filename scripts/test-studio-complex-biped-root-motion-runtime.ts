/**
 * 文件职责 / File responsibility
 * 验证复杂双足 Three Root Motion、重心、FK 与 IK 的所有权、顺序及生命周期边界。
 */

import assert from 'node:assert/strict'
import {
  applyBipedPetBodyStyle,
  compileBipedPetCharacter,
  compileBipedPetMotion,
  compileBipedPetMotionAdaptationPlan,
  createBipedPetModelRecipe,
  deriveStudioPropRig,
  normalizeBipedPetRootMotion,
  sampleBipedPetMotion,
  type BipedPetRootMotionDefinition,
  type BipedPetBodyStyle,
  type CompiledCharacterModel,
  type SampledBipedPetMotion,
} from '../packages/pet-core/src/index.ts'
import { BASIC_BIPED_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-basic-biped-motions.ts'
import { BUILT_IN_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-built-in-motions.ts'
import { BUILT_IN_STUDIO_PROPS } from '../apps/playground/app/domain/studio-built-in-props.ts'
import { createComplexBipedPetObject } from '../apps/playground/app/three/create-complex-biped-pet-object.ts'
import { createComplexBipedRootMotionController } from '../apps/playground/app/three/apply-complex-biped-root-motion.ts'
import { createComplexBipedBalanceController } from '../apps/playground/app/three/apply-complex-biped-balance.ts'
import { createComplexBipedIkController } from '../apps/playground/app/three/apply-complex-biped-ik.ts'
import { createComplexBipedMotionController } from '../apps/playground/app/three/apply-complex-biped-motion.ts'
import { createComplexBipedWeaponConstraintController } from '../apps/playground/app/three/apply-complex-biped-weapon-constraint.ts'
import { createComplexBipedMotionVfxController } from '../apps/playground/app/three/complex-biped-motion-vfx.ts'
import { createComplexBipedWeaponVfxController } from '../apps/playground/app/three/complex-biped-weapon-vfx.ts'
import {
  isComplexBipedPropRuntimeHandleAttached,
  registerComplexBipedPropRuntimeHandle,
  releaseComplexBipedPropRuntimeHandle,
  resolveComplexBipedPropMount,
  type ComplexBipedPropRuntimeHandle,
} from '../apps/playground/app/three/complex-biped-prop-mounts.ts'

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

function createStyledRuntime(bodyStyle: BipedPetBodyStyle) {
  const recipe = applyBipedPetBodyStyle(createBipedPetModelRecipe(1), bodyStyle)
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

const LEFT_ARM_CHAIN = ['upper-arm.left', 'elbow.left', 'forearm.left', 'wrist.left', 'hand.left'] as const

function readArmSegmentLengths(runtime: ReturnType<typeof createRuntime>['runtime']) {
  runtime.object.updateMatrixWorld(true)
  const scratch = runtime.object.position.clone()
  const next = runtime.object.position.clone()
  return LEFT_ARM_CHAIN.slice(1).map((boneId, index) => runtime.bonesById.get(LEFT_ARM_CHAIN[index]!)!
    .getWorldPosition(scratch)
    .distanceTo(runtime.bonesById.get(boneId)!.getWorldPosition(next)))
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

// 零反馈预采样已经真实 grounded 时，residual 二采样不得因共享 XYZ 预算把 touchdown 延迟成 landing。 / A residual resample cannot delay a zero-preview touchdown into landing through the shared XYZ budget.
{
  const baseline = createRuntime()
  const withFeedback = createRuntime()
  const onceWalk = { ...walkAsset, loopMode: 'once' as const }
  const clip = compile(onceWalk, baseline.compilation)
  const definition = rootMotionDefinition({
    distance: .42,
    verticalMode: 'ballistic',
    jumpHeight: 1.0894,
    windows: [
      { id: 'touchdown-travel', kind: 'travel', startMs: 0, endMs: 1000, weight: 1 },
      { id: 'touchdown-ballistic', kind: 'ballistic', startMs: 0, endMs: 1000, weight: 1 },
    ],
    vfxTags: ['landing-ring'],
  })
  const sampleAt = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), {
    clipHash: `${clip.hash}:touchdown-residual-phase`,
    rootMotion: definition,
  })
  const baselineController = createComplexBipedRootMotionController(baseline.runtime)
  const feedbackController = createComplexBipedRootMotionController(withFeedback.runtime)
  baselineController.apply(sampleAt(850), 1)
  feedbackController.apply(sampleAt(850), 1)
  const grounded = baselineController.apply(sampleAt(1000), 1)
  const residual = feedbackController.apply(sampleAt(1000), 1, [.1, 0, 0])
  assert.equal(grounded.rootMotion.status, 'solved')
  assert.equal(grounded.rootMotion.phase, 'grounded')
  near(grounded.rootMotion.appliedWorld[1], 0)
  near(grounded.rootMotion.landingImpulse, 1)
  assert.deepEqual(grounded.vfxSignals.map(signal => signal.kind), ['landing-ring'])
  assert.equal(residual.rootMotion.phase, 'grounded')
  vectorNear(residual.rootMotion.appliedWorld, grounded.rootMotion.appliedWorld, 1e-12)
  near(residual.rootMotion.landingImpulse, grounded.rootMotion.landingImpulse, 1e-12)
  assert.deepEqual(residual.vfxSignals, grounded.vfxSignals)
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

// 无支撑早退必须复用同一个冻结零 residual，避免静止热路径逐帧分配。 / Unsupported early returns must reuse one frozen zero residual instead of allocating per idle frame.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation)
  const unsupported = (timeMs: number) => patchSample(sampleBipedPetMotion(clip, timeMs), {
    activeContacts: [],
    contactStates: [],
  })
  const first = controller.apply(unsupported(100), 1)
  const second = controller.apply(unsupported(120), 1)
  assert.strictEqual(first.nextFootResidual, second.nextFootResidual)
  assert.ok(Object.isFrozen(first.nextFootResidual))
  assert.deepEqual(first.nextFootResidual, [0, 0, 0])
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

// 持械 hook 在 Balance 与第一次世界矩阵更新后、腿 IK 前执行；副手收敛不能改写主手道具或拉伸手臂。 / The weapon hook runs after Balance and the first world-matrix update but before leg IK; the secondary hand cannot rewrite the primary-owned prop or stretch the arm.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const sample = sampleBipedPetMotion(clip, 320)
  const propObject = runtime.sockets['hand.right']!.mount.clone(false)
  propObject.name = '测试星云长棍'
  runtime.sockets['hand.right']!.mount.add(propObject)
  const bindLengths = readArmSegmentLengths(runtime)
  const weapon = createComplexBipedWeaponConstraintController(runtime, compilation)
  let hookCalls = 0
  let report: ReturnType<typeof weapon.apply> | undefined
  let targetLocal: readonly [number, number, number] | undefined
  const controller = createComplexBipedMotionController(runtime, compilation, {
    beforeLegIk(context) {
      hookCalls += 1
      runtime.object.updateMatrixWorld(true)
      const upperArmWorld = runtime.bonesById.get('upper-arm.left')!.getWorldPosition(runtime.object.position.clone())
      const leftHandWorld = runtime.bonesById.get('hand.left')!.getWorldPosition(runtime.object.position.clone())
      const targetWorld = upperArmWorld.clone().lerp(leftHandWorld, .72)
      targetWorld.z += readCharacterHeight(runtime) * .025
      targetLocal ??= propObject.worldToLocal(targetWorld.clone()).toArray() as [number, number, number]
      const point = (position: readonly [number, number, number]) => ({ position, rotation: [0, 0, 0, 1] as [number, number, number, number] })
      const primaryMatrix = [...propObject.matrixWorld.elements]
      report = weapon.apply({
        requestedTimeMs: context.sample.requestedTimeMs,
        weight: context.weight,
        adaptation: {
          requestedTimeMs: context.sample.requestedTimeMs,
          resolvedTimeMs: context.sample.resolvedTimeMs,
          activePhaseIds: ['sweep'],
          constraintWeights: { 'left-grip': 1 },
          activeEffectCueIds: [],
        },
        propHandle: {
          instanceId: 'nebula-staff-main',
          object: propObject,
          primaryGrip: point([0, 0, 0]),
          constraint: {
            id: 'left-grip', kind: 'secondary-grip', phaseId: 'sweep', limbId: 'arm.left',
            propInstanceId: 'nebula-staff-main', pointId: 'secondaryGrip', weight: 1,
            armReachWorld: bindLengths.reduce((sum, value) => sum + value, 0),
            targetPoint: point(targetLocal),
          },
        },
      })
      runtime.object.updateMatrixWorld(true)
      assert.deepEqual(propObject.matrixWorld.elements, primaryMatrix)
    },
  })

  controller.apply(sample, 1)
  assert.ok(report)
  assert.equal(report.status, 'solved', JSON.stringify(report))
  runtime.object.updateMatrixWorld(true)
  const targetWorld = runtime.object.position.clone().set(...targetLocal!).applyMatrix4(propObject.matrixWorld)
  const leftHandWorld = runtime.sockets['hand.left']!.mount.getWorldPosition(runtime.object.position.clone())
  assert.ok(leftHandWorld.distanceTo(targetWorld) <= readCharacterHeight(runtime) * .02)
  vectorNear(readArmSegmentLengths(runtime), bindLengths, 1e-8)
  controller.apply(sample, 1)
  assert.equal(hookCalls, 1, '重复暂停帧不得重跑持械 hook')
  controller.reset()
  weapon.reset()
  controller.dispose()
  weapon.dispose()
  propObject.removeFromParent()
  runtime.dispose()
}

// 星云棍术必须使用真实内置 Rig 与挂载偏移让副手在换手、横扫和下劈阶段贴住副握点，不能只在人工可达目标上通过。
const staffMotion = BUILT_IN_STUDIO_MOTIONS.find(item => item.id === 'builtin-nebula-staff-spin')!
const staffAsset = BUILT_IN_STUDIO_PROPS.find(item => item.id === 'builtin-nebula-staff')!
const staffRig = deriveStudioPropRig(staffAsset).value
for (const [timeMs, constraintId] of [[3800, 'staff-handoff-grip'], [6100, 'staff-sweep-grip'], [9700, 'staff-impact-grip']] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(staffMotion, { boneIds: compilation.bones.map(item => item.id) })
  const staffObject = runtime.sockets['hand.right']!.mount.clone(false)
  staffObject.position.set(-.32, 0, 0)
  runtime.sockets['hand.right']!.mount.add(staffObject)
  runtime.object.updateMatrixWorld(true)
  const armReach = readArmSegmentLengths(runtime).reduce((sum, value) => sum + value, 0)
  const adaptationPlan = compileBipedPetMotionAdaptationPlan({
    definition: clip.adaptationDefinition,
    clipHash: clip.hash,
    profileId: compilation.profileId,
    characterHash: compilation.hash,
    characterHeight: readCharacterHeight(runtime),
    armReach: { left: armReach, right: armReach },
    propRigs: { 'nebula-staff-main': staffRig },
  })
  const sample = sampleBipedPetMotion(clip, timeMs, { adaptationPlan })
  const constraint = adaptationPlan.constraints.find(item => item.id === constraintId)!
  const weapon = createComplexBipedWeaponConstraintController(runtime, compilation)
  let report: ReturnType<typeof weapon.apply> | undefined
  let debugPositions: Record<string, number[]> = {}
  const controller = createComplexBipedMotionController(runtime, compilation, {
    beforeLegIk(context) {
      runtime.object.updateMatrixWorld(true)
      debugPositions = {
        shoulder: runtime.bonesById.get('upper-arm.left')!.getWorldPosition(runtime.object.position.clone()).toArray(),
        primary: runtime.object.position.clone().set(...staffRig.primaryGrip.position).applyMatrix4(staffObject.matrixWorld).toArray(),
        secondary: runtime.object.position.clone().set(...staffRig.secondaryGrip!.position).applyMatrix4(staffObject.matrixWorld).toArray(),
      }
      report = weapon.apply({
        requestedTimeMs: context.sample.requestedTimeMs,
        weight: context.weight,
        adaptation: context.sample.adaptation,
        propHandle: {
          instanceId: 'nebula-staff-main',
          object: staffObject,
          primaryGrip: staffRig.primaryGrip,
          constraint,
        },
      })
    },
  })
  controller.apply(sample, 1)
  runtime.object.updateMatrixWorld(true)
  const targetWorld = runtime.object.position.clone().set(...staffRig.secondaryGrip!.position).applyMatrix4(staffObject.matrixWorld)
  const leftHandWorld = runtime.bonesById.get('hand.left')!.getWorldPosition(runtime.object.position.clone())
  const residual = leftHandWorld.distanceTo(targetWorld)
  assert.ok(report && report.appliedWeight >= .8, `${timeMs}ms 副手约束权重不足：${JSON.stringify({ report, debugPositions, armReach })}`)
  assert.ok(residual <= readCharacterHeight(runtime) * .04, `${timeMs}ms 副手没有贴住副握点：residual=${residual}, report=${JSON.stringify(report)}`)
  controller.dispose()
  weapon.dispose()
  staffObject.removeFromParent()
  runtime.dispose()
}

// 四种内置双足体型都使用各自真实臂长求解，不共享某个体型的副手目标或伸展结果。 / Every built-in biped body style solves from its own real arm length rather than reusing another style's target or reach.
for (const bodyStyle of ['soft', 'athletic', 'round', 'slender'] as const) {
  const { compilation, runtime } = createStyledRuntime(bodyStyle)
  const weapon = createComplexBipedWeaponConstraintController(runtime, compilation)
  const propObject = runtime.sockets['hand.right']!.mount.clone(false)
  runtime.sockets['hand.right']!.mount.add(propObject)
  runtime.object.updateMatrixWorld(true)
  const upperArmWorld = runtime.bonesById.get('upper-arm.left')!.getWorldPosition(runtime.object.position.clone())
  const handWorld = runtime.bonesById.get('hand.left')!.getWorldPosition(runtime.object.position.clone())
  const targetWorld = upperArmWorld.clone().lerp(handWorld, .7)
  targetWorld.z += readCharacterHeight(runtime) * .02
  const targetLocal = propObject.worldToLocal(targetWorld.clone()).toArray() as [number, number, number]
  const point = (position: readonly [number, number, number]) => ({ position, rotation: [0, 0, 0, 1] as [number, number, number, number] })
  const bindLengths = readArmSegmentLengths(runtime)
  const propMatrix = [...propObject.matrixWorld.elements]
  const report = weapon.apply({
    requestedTimeMs: 5200,
    weight: 1,
    adaptation: {
      requestedTimeMs: 5200,
      resolvedTimeMs: 5200,
      activePhaseIds: ['sweep'],
      constraintWeights: { 'left-grip': 1 },
      activeEffectCueIds: [],
    },
    propHandle: {
      instanceId: `nebula-staff-${bodyStyle}`,
      object: propObject,
      primaryGrip: point([0, 0, 0]),
      constraint: {
        id: 'left-grip', kind: 'secondary-grip', phaseId: 'sweep', limbId: 'arm.left',
        propInstanceId: `nebula-staff-${bodyStyle}`, pointId: 'secondaryGrip', weight: 1,
        armReachWorld: bindLengths.reduce((sum, value) => sum + value, 0),
        targetPoint: point(targetLocal),
      },
    },
  })
  runtime.object.updateMatrixWorld(true)
  const solvedHandWorld = runtime.bonesById.get('hand.left')!.getWorldPosition(runtime.object.position.clone())
  assert.equal(report.status, 'solved', `${bodyStyle}: ${JSON.stringify(report)}`)
  assert.ok(solvedHandWorld.distanceTo(targetWorld) <= readCharacterHeight(runtime) * .02, `${bodyStyle} 副手残差超限`)
  vectorNear(readArmSegmentLengths(runtime), bindLengths, 1e-8)
  assert.deepEqual(propObject.matrixWorld.elements, propMatrix)
  weapon.dispose()
  propObject.removeFromParent()
  runtime.dispose()
}

// 道具 runtime 句柄必须验证真实父级并按 instanceId/object 身份单写入；旧对象不能误删新句柄。 / Prop-runtime handles validate their real parent and enforce single ownership by instanceId/object, so a stale object cannot release a newer handle.
{
  const { runtime } = createRuntime()
  const asset = BUILT_IN_STUDIO_PROPS[0]!
  const mount = resolveComplexBipedPropMount(runtime, { space: 'local', mountId: 'right-front-paw' })
  const object = runtime.object.clone(false)
  mount.object.add(object)
  const handles = new Map<string, ComplexBipedPropRuntimeHandle>()
  const handle = { instanceId: 'staff-main', asset, object, mount }
  assert.equal(registerComplexBipedPropRuntimeHandle(handles, handle), true)
  assert.strictEqual(handles.get('staff-main'), handle)
  assert.equal(isComplexBipedPropRuntimeHandleAttached(handle), true)
  assert.equal(registerComplexBipedPropRuntimeHandle(handles, handle), true)

  const duplicateObject = runtime.object.clone(false)
  mount.object.add(duplicateObject)
  assert.equal(registerComplexBipedPropRuntimeHandle(handles, { ...handle, object: duplicateObject }), false)
  assert.strictEqual(handles.get('staff-main')?.object, object)
  const detachedObject = runtime.object.clone(false)
  assert.equal(registerComplexBipedPropRuntimeHandle(handles, { ...handle, instanceId: 'detached', object: detachedObject }), false)
  assert.equal(releaseComplexBipedPropRuntimeHandle(handles, 'staff-main', duplicateObject), false)
  assert.equal(handles.size, 1)
  object.removeFromParent()
  assert.equal(isComplexBipedPropRuntimeHandleAttached(handle), false)
  mount.object.add(object)
  assert.equal(releaseComplexBipedPropRuntimeHandle(handles, 'staff-main', object), true)
  assert.equal(handles.size, 0)
  duplicateObject.removeFromParent()
  object.removeFromParent()
  runtime.dispose()
}

// 不可达副握点沿武器轴钳制并降低实际权重；同一 runtime 仍只能有一个副手约束写入者。 / An unreachable secondary grip is clamped along the weapon axis with reduced influence, while each runtime retains one secondary-grip writer.
{
  const { compilation, runtime } = createRuntime()
  const weapon = createComplexBipedWeaponConstraintController(runtime, compilation)
  assert.throws(() => createComplexBipedWeaponConstraintController(runtime, compilation), /同一运行时.*持械约束.*控制器/)
  const propObject = runtime.sockets['hand.right']!.mount.clone(false)
  runtime.sockets['hand.right']!.mount.add(propObject)
  runtime.object.updateMatrixWorld(true)
  const point = (position: readonly [number, number, number]) => ({ position, rotation: [0, 0, 0, 1] as [number, number, number, number] })
  const primaryMatrix = [...propObject.matrixWorld.elements]
  const report = weapon.apply({
    requestedTimeMs: 5200,
    weight: 1,
    adaptation: {
      requestedTimeMs: 5200,
      resolvedTimeMs: 5200,
      activePhaseIds: ['sweep'],
      constraintWeights: { 'left-grip': 1 },
      activeEffectCueIds: [],
    },
    propHandle: {
      instanceId: 'nebula-staff-main',
      object: propObject,
      primaryGrip: point([0, 0, 0]),
      constraint: {
        id: 'left-grip', kind: 'secondary-grip', phaseId: 'sweep', limbId: 'arm.left',
        propInstanceId: 'nebula-staff-main', pointId: 'secondaryGrip', weight: 1,
        armReachWorld: .7,
        targetPoint: point([-20, 0, 0]),
      },
    },
  })
  runtime.object.updateMatrixWorld(true)
  assert.equal(report.status, 'degraded')
  assert.ok(report.appliedWeight < report.requestedWeight)
  assert.ok(Number.isFinite(report.residualWorld) && report.residualWorld > 0)
  assert.deepEqual(propObject.matrixWorld.elements, primaryMatrix)
  assert.ok(LEFT_ARM_CHAIN.every(id => runtime.bonesById.get(id)!.quaternion.toArray().every(Number.isFinite)))
  weapon.dispose()
  const replacement = createComplexBipedWeaponConstraintController(runtime, compilation)
  replacement.dispose()
  propObject.removeFromParent()
  runtime.dispose()
}

// 持械控制器释放即使矩阵更新抛错或直接 throw undefined，也必须封存旧实例并释放单写入令牌。 / Weapon-controller disposal seals the old instance and releases ownership even when matrix updates throw an Error or undefined.
for (const thrownValue of [new Error('测试注入：持械矩阵释放失败'), undefined] as const) {
  const { compilation, runtime } = createRuntime()
  const weapon = createComplexBipedWeaponConstraintController(runtime, compilation)
  const updateMatrixWorld = runtime.object.updateMatrixWorld
  runtime.object.updateMatrixWorld = () => { throw thrownValue }
  assert.throws(
    () => weapon.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足持械约束控制器释放失败')
      && error.message.includes(thrownValue instanceof Error ? '持械矩阵释放失败' : 'undefined'),
  )
  runtime.object.updateMatrixWorld = updateMatrixWorld
  weapon.dispose()
  assert.throws(() => weapon.apply({ requestedTimeMs: 0, weight: 0 }), /已释放/)
  const replacement = createComplexBipedWeaponConstraintController(runtime, compilation)
  replacement.dispose()
  runtime.dispose()
}

// hook 错误保留原始抛出值并交给 renderer 同步边界；动作控制器不能吞掉或在暂停帧重放。 / Hook failures preserve their original thrown value for the renderer boundary and are never swallowed or replayed on paused frames.
{
  const { compilation, runtime } = createRuntime()
  const clip = compile(walkAsset, compilation)
  const controller = createComplexBipedMotionController(runtime, compilation, {
    beforeLegIk() { throw undefined },
  })
  let didThrow = false
  try { controller.apply(sampleBipedPetMotion(clip, 320), 1) }
  catch (error) {
    didThrow = true
    assert.equal(error, undefined)
  }
  assert.equal(didThrow, true)
  controller.dispose()
  runtime.dispose()
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

// 构造错误与 Balance 清理错误同时发生时仍必须继续释放 Root token，并保留两段错误上下文。 / A Balance-cleanup failure must not hide the construction error or prevent Root-token release.
{
  const { compilation, runtime } = createRuntime()
  const bone = runtime.bonesById.get('thigh.left')!
  const chest = runtime.bonesById.get('chest')!
  const getWorldPosition = bone.getWorldPosition
  const copy = chest.quaternion.copy
  bone.getWorldPosition = () => { throw new Error('测试注入：IK 构造失败') }
  chest.quaternion.copy = () => { throw new Error('测试注入：Balance 清理失败') }
  assert.throws(
    () => createComplexBipedMotionController(runtime, compilation),
    error => error instanceof Error
      && error.message.includes('复杂双足萌宠动作控制器构造失败')
      && error.message.includes('IK 构造失败')
      && error.message.includes('Balance 清理失败'),
  )
  bone.getWorldPosition = getWorldPosition
  chest.quaternion.copy = copy
  const replacement = createComplexBipedRootMotionController(runtime)
  replacement.dispose()
  runtime.dispose()
}

// 畸形 Error.message 不能让诊断格式化反过来中断构造回滚；Symbol 与抛错 getter 都必须继续释放 Root token。 / Malformed Error.message values must not let diagnostic formatting interrupt rollback or leak the Root token.
for (const malformedMessage of ['symbol', 'throwing-getter'] as const) {
  const { compilation, runtime } = createRuntime()
  const bone = runtime.bonesById.get('thigh.left')!
  const chest = runtime.bonesById.get('chest')!
  const getWorldPosition = bone.getWorldPosition
  const copy = chest.quaternion.copy
  const cleanupError = new Error('占位清理错误')
  if (malformedMessage === 'symbol') cleanupError.message = Symbol('Balance 清理失败') as unknown as string
  else Object.defineProperty(cleanupError, 'message', { get: () => { throw new Error('message getter 失败') } })
  bone.getWorldPosition = () => { throw new Error('测试注入：IK 构造失败') }
  chest.quaternion.copy = () => { throw cleanupError }
  assert.throws(
    () => createComplexBipedMotionController(runtime, compilation),
    error => error instanceof Error
      && error.message.includes('复杂双足萌宠动作控制器构造失败')
      && error.message.includes('IK 构造失败')
      && error.message.includes(malformedMessage === 'symbol' ? 'Symbol(Balance 清理失败)' : '未知错误'),
  )
  bone.getWorldPosition = getWorldPosition
  chest.quaternion.copy = copy
  const replacement = createComplexBipedRootMotionController(runtime)
  replacement.dispose()
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

// Root dispose 恢复绑定失败时仍必须封存控制器并释放 WeakMap token，且错误不能被吞掉。 / Root disposal must seal itself and release the WeakMap token even when bind restoration throws.
{
  const { runtime } = createRuntime()
  const controller = createComplexBipedRootMotionController(runtime)
  const copy = runtime.object.position.copy
  runtime.object.position.copy = () => { throw new Error('测试注入：Root position.copy 失败') }
  assert.throws(() => controller.dispose(), /Root position\.copy 失败/)
  runtime.object.position.copy = copy
  const replacement = createComplexBipedRootMotionController(runtime)
  controller.dispose()
  replacement.dispose()
  runtime.dispose()
}

// JavaScript 允许 throw undefined；Root dispose 不能把 undefined 同“没有错误”混为一谈。 / JavaScript permits throw undefined; Root disposal must not confuse it with the no-error sentinel.
{
  const { runtime } = createRuntime()
  const controller = createComplexBipedRootMotionController(runtime)
  const copy = runtime.object.position.copy
  runtime.object.position.copy = () => { throw undefined }
  let didThrow = false
  try { controller.dispose() }
  catch (error) {
    didThrow = true
    assert.equal(error, undefined)
  }
  assert.equal(didThrow, true)
  runtime.object.position.copy = copy
  const replacement = createComplexBipedRootMotionController(runtime)
  replacement.dispose()
  runtime.dispose()
}

// 外层 dispose 必须在子步骤失败时继续释放 Root token、清空状态并最终抛出中文聚合错误。 / Outer disposal must continue through every cleanup step, clear state, and throw one Chinese aggregate after child failures.
{
  const { compilation, runtime } = createRuntime()
  const controller = createComplexBipedMotionController(runtime, compilation)
  const updateMatrixWorld = runtime.object.updateMatrixWorld
  runtime.object.updateMatrixWorld = () => { throw new Error('测试注入：updateMatrixWorld 失败') }
  assert.throws(
    () => controller.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足萌宠动作控制器释放失败')
      && error.message.includes('updateMatrixWorld 失败'),
  )
  runtime.object.updateMatrixWorld = updateMatrixWorld
  controller.dispose()
  const replacement = createComplexBipedRootMotionController(runtime)
  replacement.dispose()
  runtime.dispose()
}

// runtime 状态检查异常也必须进入中文聚合，并继续尝试绑定恢复和世界矩阵更新。 / A runtime-state-check failure must be aggregated while bind restoration and matrix update are still attempted.
{
  const { compilation, runtime } = createRuntime()
  const controller = createComplexBipedMotionController(runtime, compilation)
  const isDisposed = runtime.isDisposed
  const updateMatrixWorld = runtime.object.updateMatrixWorld
  let matrixCalls = 0
  runtime.isDisposed = () => { throw new Error('测试注入：状态检查失败') }
  runtime.object.updateMatrixWorld = force => {
    matrixCalls += 1
    return updateMatrixWorld.call(runtime.object, force)
  }
  assert.throws(
    () => controller.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足萌宠动作控制器释放失败')
      && error.message.includes('状态检查失败'),
  )
  assert.equal(matrixCalls, 1)
  runtime.isDisposed = isDisposed
  runtime.object.updateMatrixWorld = updateMatrixWorld
  controller.dispose()
  const replacement = createComplexBipedRootMotionController(runtime)
  replacement.dispose()
  runtime.dispose()
}

// 自然 walk 与 ping-pong 长序列不得因标量 strain feedback 产生振荡、过冲或伪造侧向向量。 / Long natural walk and ping-pong sequences must not oscillate, overshoot, or invent lateral vectors from scalar strain feedback.
for (const loopMode of ['loop', 'ping-pong'] as const) {
  const { compilation, runtime } = createRuntime()
  const asset = loopMode === 'loop' ? walkAsset : { ...walkAsset, loopMode: 'ping-pong' as const }
  const clip = compile(asset, compilation)
  assert.equal(clip.loopMode, loopMode)
  const controller = createComplexBipedMotionController(runtime, compilation)
  let previousApplied = 0
  let previousTarget = 0
  for (let timeMs = 0; timeMs <= 3600; timeMs += 20) {
    const sample = sampleBipedPetMotion(clip, timeMs)
    const iteration = Math.floor(timeMs / clip.durationMs)
    const segmentTimeMs = timeMs % clip.durationMs
    const resolvedTimeMs = loopMode === 'loop' || iteration % 2 === 0
      ? segmentTimeMs
      : clip.durationMs - segmentTimeMs
    assert.equal(sample.loopMode, loopMode)
    assert.equal(sample.iteration, iteration)
    assert.equal(sample.resolvedTimeMs, resolvedTimeMs)
    assert.ok(sample.bones.length > 0)
    assert.ok(sample.contactStates.length > 0)
    assert.deepEqual(sample.activeContacts, sample.contactStates
      .filter(contact => contact.weight > 0)
      .map(contact => contact.contactId))
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

// VFX 运行时必须使用普通 Group、真实 Three 资源和固定对象池；重复 burst ID 不得重复分配。 / VFX uses a plain Group with real pooled Three resources, and duplicate burst IDs never allocate twice.
{
  const vfx = createComplexBipedMotionVfxController()
  const frame = { requestedTimeMs: 1800, position: [0, 0, 0] as const, facingRadians: 0 }
  assert.equal(vfx.object.type, 'Group')
  assert.equal(vfx.object.getObjectByName('复杂双足运动特效-落地尘点')?.type, 'Mesh')
  assert.equal(vfx.object.getObjectByName('复杂双足运动特效-落地尘点')?.isInstancedMesh, true)
  assert.equal(vfx.object.getObjectByName('复杂双足运动特效-急停火花')?.isInstancedMesh, true)
  vfx.apply([{ id: 'a', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 1800, lifetimeMs: 480 }], frame)
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  vfx.apply([{ id: 'a', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 1800, lifetimeMs: 480 }], frame)
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  vfx.apply([{ id: 'dust-single', kind: 'landing-dust', mode: 'burst', strength: 1, timeMs: 1801, lifetimeMs: 480 }], {
    ...frame,
    requestedTimeMs: 1801,
  })
  assert.ok(vfx.snapshot().activeByKind['landing-dust'] <= 16, '单个 burst 最多创建 16 个实例')
  for (let index = 0; index < 200; index++) {
    vfx.apply([{
      id: `dust-${index}`,
      kind: 'landing-dust',
      mode: 'burst',
      strength: .8,
      timeMs: 1800 + index,
      lifetimeMs: 480,
    }], { ...frame, requestedTimeMs: 1800 + index })
  }
  const snapshot = vfx.snapshot()
  assert.ok(snapshot.activeTotal <= 64)
  assert.ok(snapshot.activeByKind['landing-dust'] <= 24)
  assert.equal(snapshot.poolCapacityTotal, 64)
  vfx.dispose()
  vfx.dispose()
  assert.equal(vfx.snapshot().disposed, true)
}

// sustain 复用 ID 并跟随最新父级位置，burst 则捕获触发位置；动作时间负责过期和回拖清理。 / Sustain updates in place while bursts capture their parent-space origin; action time owns expiry and rewind cleanup.
{
  const vfx = createComplexBipedMotionVfxController()
  const trail = { id: 'trail-active', kind: 'speed-trail', mode: 'sustain', strength: .9, timeMs: 100, lifetimeMs: 160 } as const
  vfx.apply([trail], { requestedTimeMs: 100, position: [1, 2, 3], facingRadians: .25 })
  assert.equal(vfx.snapshot().activeByKind['speed-trail'], 1)
  const trailObject = vfx.object.getObjectByName('复杂双足运动特效-速度拖尾-0')!
  const firstTrailPosition = trailObject.position.toArray()
  vfx.apply([{ ...trail, timeMs: 140 }], { requestedTimeMs: 140, position: [4, 5, 6], facingRadians: .5 })
  assert.equal(vfx.snapshot().activeByKind['speed-trail'], 1)
  assert.notDeepEqual(trailObject.position.toArray(), firstTrailPosition)
  vfx.apply(Array.from({ length: 20 }, (_, index) => ({
    ...trail,
    id: `trail-${index}`,
    timeMs: 140,
  })), { requestedTimeMs: 140, position: [4, 5, 6], facingRadians: .5 })
  assert.equal(vfx.snapshot().activeByKind['speed-trail'], 8, '速度拖尾活动实例不得超过固定池 8')

  const ring = { id: 'ring-capture', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 140, lifetimeMs: 480 } as const
  vfx.apply([ring], { requestedTimeMs: 140, position: [2, 0, 3], facingRadians: 0 })
  const ringObject = vfx.object.getObjectByName('复杂双足运动特效-落地环-0')!
  const capturedRingPosition = ringObject.position.toArray()
  vfx.apply([], { requestedTimeMs: 200, position: [20, 10, 30], facingRadians: 1 })
  assert.deepEqual(ringObject.position.toArray(), capturedRingPosition)
  vfx.apply([], { requestedTimeMs: 700, position: [20, 10, 30], facingRadians: 1 })
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 0)
  assert.equal(vfx.snapshot().activeByKind['speed-trail'], 0)

  vfx.apply([{ ...ring, timeMs: 800 }], { requestedTimeMs: 800, position: [2, 0, 3], facingRadians: 0 })
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 0, '已经见过的 burst ID 即使过期也不能重放')
  vfx.apply([{ ...ring, id: 'ring-new', timeMs: 800 }], { requestedTimeMs: 800, position: [2, 0, 3], facingRadians: 0 })
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  vfx.apply([], { requestedTimeMs: 120, position: [0, 0, 0], facingRadians: 0 })
  assert.equal(vfx.snapshot().activeTotal, 0, '动作时间回拖必须清理活动实例')
  vfx.dispose()
}

// 近期账本容量不能淘汰仍在池内的 burst ID；其他类别施压后重复活动环仍只能保留一个。 / Recent-ledger pressure must never evict an ID whose burst is still active.
{
  const vfx = createComplexBipedMotionVfxController()
  vfx.apply([{ id: 'active-ring', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 1200 }], {
    requestedTimeMs: 0,
    position: [0, 0, 0],
    facingRadians: 0,
  })
  for (let batch = 0; batch < 2; batch++) {
    const requestedTimeMs = batch + 1
    vfx.apply(Array.from({ length: 128 }, (_, index) => ({
      id: `ledger-pressure-${batch}-${index}`,
      kind: 'landing-dust' as const,
      mode: 'burst' as const,
      strength: .8,
      timeMs: requestedTimeMs,
      lifetimeMs: 1200,
    })), { requestedTimeMs, position: [0, 0, 0], facingRadians: 0 })
  }
  vfx.apply([{ id: 'active-ring', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 3, lifetimeMs: 1200 }], {
    requestedTimeMs: 3,
    position: [0, 0, 0],
    facingRadians: 0,
  })
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  vfx.dispose()
}

// 帧位置必须在校验时一次性复制，不能让 Proxy 在二次读取时把已通过校验的值换成 NaN。 / Frame position must be copied once so a Proxy cannot swap validated coordinates for NaN on a second read.
{
  const vfx = createComplexBipedMotionVfxController()
  const reads = [0, 0, 0]
  const source = [1, 2, 3]
  const position = new Proxy(source, {
    get(target, property, receiver) {
      const index = typeof property === 'string' && /^[0-2]$/.test(property) ? Number(property) : -1
      if (index < 0) return Reflect.get(target, property, receiver)
      const read = reads[index]!
      reads[index] = read + 1
      return read === 0 ? target[index] : Number.NaN
    },
  }) as [number, number, number]
  vfx.apply([{ id: 'proxy-ring', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 }], {
    requestedTimeMs: 0,
    position,
    facingRadians: 0,
  })
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  const ring = vfx.object.getObjectByName('复杂双足运动特效-落地环-0')!
  assert.ok(ring.position.toArray().every(Number.isFinite))
  vectorNear(ring.position.toArray(), [1, 2.018, 3])
  vfx.dispose()
}

// VFX 朝向沿 Root Motion 的局部 +Z：yaw=0 指向世界 +Z，yaw=π/2 指向世界 +X。 / VFX facing follows Root Motion local +Z: yaw 0 is world +Z and yaw π/2 is world +X.
for (const [facingRadians, expectedBackwardAxis] of [[0, 'z'], [Math.PI / 2, 'x']] as const) {
  const vfx = createComplexBipedMotionVfxController()
  vfx.apply([{ id: `trail-facing-${facingRadians}`, kind: 'speed-trail', mode: 'sustain', strength: .9, timeMs: 0, lifetimeMs: 160 }], {
    requestedTimeMs: 0,
    position: [0, 0, 0],
    facingRadians,
  })
  const trail = vfx.object.getObjectByName('复杂双足运动特效-速度拖尾-0')!
  trail.updateMatrix()
  if (expectedBackwardAxis === 'z') {
    near(trail.position.x, 0)
    assert.ok(trail.position.z < 0)
    near(trail.matrix.elements[4], 0)
    assert.ok(Math.abs(trail.matrix.elements[6]) > .1)
  }
  else {
    assert.ok(trail.position.x < 0)
    near(trail.position.z, 0)
    assert.ok(Math.abs(trail.matrix.elements[4]) > .1)
    near(trail.matrix.elements[6], 0)
  }

  vfx.apply([{ id: `sparks-facing-${facingRadians}`, kind: 'brake-sparks', mode: 'burst', strength: 1, timeMs: 0, lifetimeMs: 320 }], {
    requestedTimeMs: 0,
    position: [0, 0, 0],
    facingRadians,
  })
  vfx.apply([], { requestedTimeMs: 160, position: [99, 99, 99], facingRadians: 0 })
  const sparks = vfx.object.getObjectByName('复杂双足运动特效-急停火花') as { instanceMatrix: { array: ArrayLike<number> } }
  let averageX = 0
  let averageZ = 0
  for (let index = 0; index < 16; index++) {
    averageX += sparks.instanceMatrix.array[index * 16 + 12]!
    averageZ += sparks.instanceMatrix.array[index * 16 + 14]!
  }
  averageX /= 16
  averageZ /= 16
  if (expectedBackwardAxis === 'z') assert.ok(averageZ < -.1 && Math.abs(averageX) < .1)
  else assert.ok(averageX < -.1 && Math.abs(averageZ) < .1)
  vfx.dispose()
}

// 同到期时间的满池必须按激活先后公平轮转，不能让新 burst/拖尾反复覆盖同一个 slot 0。 / Equal-expiry full pools must evict by activation order instead of repeatedly overwriting slot zero.
{
  const vfx = createComplexBipedMotionVfxController()
  vfx.apply([
    { id: 'dust-fill-a', kind: 'landing-dust', mode: 'burst', strength: 1, timeMs: 0, lifetimeMs: 1200 },
    { id: 'dust-fill-b', kind: 'landing-dust', mode: 'burst', strength: 1, timeMs: 0, lifetimeMs: 1200 },
  ], { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 })
  vfx.apply([{ id: 'dust-newest', kind: 'landing-dust', mode: 'burst', strength: 1, timeMs: 0, lifetimeMs: 1200 }], {
    requestedTimeMs: 0,
    position: [100, 0, 0],
    facingRadians: 0,
  })
  const dust = vfx.object.getObjectByName('复杂双足运动特效-落地尘点') as { instanceMatrix: { array: ArrayLike<number> } }
  let newestDustSlots = 0
  for (let index = 0; index < 24; index++) if (dust.instanceMatrix.array[index * 16 + 12]! > 50) newestDustSlots += 1
  assert.equal(newestDustSlots, 16)

  vfx.apply(Array.from({ length: 8 }, (_, index) => ({
    id: `trail-fill-${index}`,
    kind: 'speed-trail' as const,
    mode: 'sustain' as const,
    strength: .9,
    timeMs: 0,
    lifetimeMs: 1200,
  })), { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 })
  vfx.apply(Array.from({ length: 4 }, (_, index) => ({
    id: `trail-newest-${index}`,
    kind: 'speed-trail' as const,
    mode: 'sustain' as const,
    strength: .9,
    timeMs: 0,
    lifetimeMs: 1200,
  })), { requestedTimeMs: 0, position: [100, 0, 0], facingRadians: 0 })
  const newestTrailSlots = vfx.object.children.filter(child => child.name.startsWith('复杂双足运动特效-速度拖尾-')
    && child.visible && child.position.x > 50).length
  assert.equal(newestTrailSlots, 4)
  vfx.dispose()
}

// 四类资源的创建彼此隔离；一个效果类失败不能阻塞其余真实效果。 / Effect-class creation is isolated so one failed class cannot block the remaining real effects.
{
  const vfx = createComplexBipedMotionVfxController({
    createGeometry(kind, createDefault) {
      if (kind === 'landing-dust') throw new Error('测试注入：尘点 Geometry 创建失败')
      return createDefault()
    },
  })
  assert.deepEqual(vfx.snapshot().unavailableKinds, ['landing-dust'])
  assert.equal(vfx.snapshot().poolCapacityTotal, 40)
  assert.equal(vfx.snapshot().poolCapacityByKind['landing-dust'], 0)
  vfx.apply([
    { id: 'unavailable-dust', kind: 'landing-dust', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 },
    { id: 'available-ring', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 },
    { id: 'available-sparks', kind: 'brake-sparks', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 320 },
  ], { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 })
  assert.equal(vfx.snapshot().activeByKind['landing-dust'], 0)
  assert.equal(vfx.snapshot().activeByKind['landing-ring'], 1)
  assert.ok(vfx.snapshot().activeByKind['brake-sparks'] > 0)
  vfx.dispose()
}

// Mesh 池在加入部分子节点后初始化失败时，必须移除该类全部残留节点并释放部分资源。 / A partially attached Mesh-pool failure must remove all class children and release partial resources.
{
  let ringChildren = 0
  let ringGeometryDisposals = 0
  let ringMaterialDisposals = 0
  const vfx = createComplexBipedMotionVfxController({
    createGeometry(kind, createDefault) {
      const geometry = createDefault()
      if (kind === 'landing-ring') {
        const dispose = geometry.dispose.bind(geometry)
        geometry.dispose = () => { ringGeometryDisposals += 1; dispose() }
      }
      return geometry
    },
    createMaterial(kind, createDefault) {
      const material = createDefault()
      if (kind === 'landing-ring') {
        const dispose = material.dispose.bind(material)
        material.dispose = () => { ringMaterialDisposals += 1; dispose() }
      }
      return material
    },
    attachObject(kind, group, child) {
      group.add(child)
      if (kind === 'landing-ring' && ++ringChildren === 2) throw new Error('测试注入：落地环第二个子节点加入后失败')
    },
  })
  assert.ok(vfx.snapshot().unavailableKinds.includes('landing-ring'))
  assert.equal(vfx.object.children.some(child => child.name.startsWith('复杂双足运动特效-落地环-')), false)
  assert.equal(ringGeometryDisposals, 1)
  assert.equal(ringMaterialDisposals, 1)
  assert.ok(vfx.object.getObjectByName('复杂双足运动特效-落地尘点'))
  vfx.dispose()
  assert.equal(ringGeometryDisposals, 1)
  assert.equal(ringMaterialDisposals, 1)
}

// default 工厂回调必须惰性缓存；调用多次后抛错只产生并回收一个 provisional 资源。 / Default factory callbacks are lazy-cached so repeated calls followed by a throw create and release one provisional resource.
{
  let firstDefault: unknown
  let secondDefault: unknown
  let provisionalDisposals = 0
  const vfx = createComplexBipedMotionVfxController({
    createGeometry(kind, createDefault) {
      if (kind !== 'landing-ring') return createDefault()
      firstDefault = createDefault()
      secondDefault = createDefault()
      const geometry = firstDefault as { dispose(): void }
      const dispose = geometry.dispose.bind(geometry)
      geometry.dispose = () => { provisionalDisposals += 1; dispose() }
      throw new Error('测试注入：default 创建后失败')
    },
  })
  assert.equal(firstDefault, secondDefault)
  assert.equal(provisionalDisposals, 1)
  assert.ok(vfx.snapshot().unavailableKinds.includes('landing-ring'))
  vfx.dispose()
  assert.equal(provisionalDisposals, 1)
}

// 后续 kind 初始化失败时，共享的已提交资源仍属于前一可用池，不能被 catch 提前释放。 / A later class failure must not dispose shared resources already owned by an earlier usable pool.
{
  let sharedGeometry: { dispose(): void } | undefined
  let sharedMaterial: { dispose(): void } | undefined
  let geometryDisposals = 0
  let materialDisposals = 0
  const vfx = createComplexBipedMotionVfxController({
    createGeometry(_kind, createDefault) {
      if (!sharedGeometry) {
        sharedGeometry = createDefault()
        const dispose = sharedGeometry.dispose.bind(sharedGeometry)
        sharedGeometry.dispose = () => { geometryDisposals += 1; dispose() }
      }
      return sharedGeometry as ReturnType<typeof createDefault>
    },
    createMaterial(_kind, createDefault) {
      if (!sharedMaterial) {
        sharedMaterial = createDefault()
        const dispose = sharedMaterial.dispose.bind(sharedMaterial)
        sharedMaterial.dispose = () => { materialDisposals += 1; dispose() }
      }
      return sharedMaterial as ReturnType<typeof createDefault>
    },
    attachObject(kind, group, child) {
      group.add(child)
      if (kind === 'landing-dust') throw new Error('测试注入：共享尘点挂载失败')
    },
  })
  assert.ok(vfx.snapshot().unavailableKinds.includes('landing-dust'))
  assert.equal(geometryDisposals, 0)
  assert.equal(materialDisposals, 0)
  assert.ok(vfx.object.getObjectByName('复杂双足运动特效-落地环-0'))
  vfx.dispose()
  assert.equal(geometryDisposals, 1)
  assert.equal(materialDisposals, 1)
}

// 非有限输入、错误模式和超长寿命必须安全处理；apply 绝不能读取墙钟或注册额外 RAF。 / Invalid inputs are safely ignored or bounded, and apply never reads wall time or schedules an RAF.
{
  const vfx = createComplexBipedMotionVfxController()
  const originalNow = Date.now
  const originalRaf = Reflect.get(globalThis, 'requestAnimationFrame')
  Date.now = () => { throw new Error('VFX 禁止读取 Date.now') }
  Reflect.set(globalThis, 'requestAnimationFrame', () => { throw new Error('VFX 禁止注册 RAF') })
  try {
    vfx.apply([
      { id: 'nan-strength', kind: 'landing-ring', mode: 'burst', strength: Number.NaN, timeMs: 0, lifetimeMs: 480 },
      { id: 'infinite-strength', kind: 'landing-dust', mode: 'burst', strength: Number.POSITIVE_INFINITY, timeMs: 0, lifetimeMs: 480 },
      { id: 'wrong-mode', kind: 'speed-trail', mode: 'burst', strength: .9, timeMs: 0, lifetimeMs: 160 },
      { id: 'long-life', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 99_000 },
    ], { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 })
    assert.equal(vfx.snapshot().activeTotal, 1)
    vfx.apply([], { requestedTimeMs: 1199, position: [0, 0, 0], facingRadians: 0 })
    assert.equal(vfx.snapshot().activeTotal, 1)
    vfx.apply([], { requestedTimeMs: 1200, position: [0, 0, 0], facingRadians: 0 })
    assert.equal(vfx.snapshot().activeTotal, 0)
    vfx.apply([{ id: 'invalid-frame', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 1300, lifetimeMs: 480 }], {
      requestedTimeMs: Number.NaN,
      position: [0, 0, 0],
      facingRadians: 0,
    })
    assert.equal(vfx.snapshot().activeTotal, 0)
    vfx.apply([{ id: 'unrepresentable-deadline', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: Number.MAX_VALUE, lifetimeMs: 1200 }], {
      requestedTimeMs: Number.MAX_VALUE,
      position: [0, 0, 0],
      facingRadians: 0,
    })
    assert.equal(vfx.snapshot().activeTotal, 0)
  }
  finally {
    Date.now = originalNow
    if (originalRaf === undefined) Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    else Reflect.set(globalThis, 'requestAnimationFrame', originalRaf)
  }
  vfx.dispose()
}

// reset 只清活动实例并保留池；dispose 即使单个 GPU 资源抛错也尝试其余资源、移出父级，并保证每个资源只调用一次。 / Reset retains pools; dispose is best-effort, removes the Group, and attempts every GPU resource exactly once.
{
  const vfx = createComplexBipedMotionVfxController()
  const parent = vfx.object.clone(false)
  parent.add(vfx.object)
  vfx.apply([
    { id: 'ring', kind: 'landing-ring', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 },
    { id: 'trail', kind: 'speed-trail', mode: 'sustain', strength: .8, timeMs: 0, lifetimeMs: 160 },
    { id: 'dust', kind: 'landing-dust', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 },
    { id: 'sparks', kind: 'brake-sparks', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 320 },
  ], { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 })
  const capacity = vfx.snapshot().poolCapacityTotal
  vfx.reset()
  assert.equal(vfx.snapshot().activeTotal, 0)
  assert.equal(vfx.snapshot().poolCapacityTotal, capacity)
  const resources = new Set<{ dispose(): void }>()
  vfx.object.traverse(child => {
    if (!('geometry' in child) || !('material' in child)) return
    const mesh = child as { geometry?: { dispose(): void }, material?: { dispose(): void } | { dispose(): void }[] }
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) if (material) resources.add(material)
  })
  assert.equal(resources.size, 8, '四类效果必须各自固定复用一份 Geometry 和 Material')
  const disposeCalls = new Map([...resources].map(resource => [resource, 0]))
  const firstResource = [...resources][0]!
  for (const resource of resources) {
    const originalDispose = resource.dispose.bind(resource)
    resource.dispose = () => {
      disposeCalls.set(resource, disposeCalls.get(resource)! + 1)
      originalDispose()
      if (resource === firstResource) throw new Error('测试注入：单资源释放失败')
    }
  }
  assert.throws(
    () => vfx.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足运动特效资源释放失败')
      && error.message.includes('单资源释放失败'),
  )
  assert.equal(vfx.object.parent, null)
  assert.equal(vfx.snapshot().disposed, true)
  for (const calls of disposeCalls.values()) assert.equal(calls, 1)
  vfx.dispose()
  for (const calls of disposeCalls.values()) assert.equal(calls, 1)
}

// 工厂允许跨效果复用资源；控制器必须按对象身份只释放一次，并移除被挂到外部父级的全部自有子节点。 / Shared factory resources are disposed once by identity, and every owned child is detached even when a hook mounts it elsewhere.
{
  let sharedGeometry: { dispose(): void } | undefined
  let sharedMaterial: { dispose(): void } | undefined
  let geometryDisposals = 0
  let materialDisposals = 0
  const externalOwner = createComplexBipedMotionVfxController()
  const externalParent = externalOwner.object
  externalParent.clear()
  const vfx = createComplexBipedMotionVfxController({
    createGeometry(_kind, createDefault) {
      if (!sharedGeometry) {
        const geometry = createDefault()
        const dispose = geometry.dispose.bind(geometry)
        geometry.dispose = () => { geometryDisposals += 1; dispose() }
        sharedGeometry = geometry
      }
      return sharedGeometry as ReturnType<typeof createDefault>
    },
    createMaterial(_kind, createDefault) {
      if (!sharedMaterial) {
        const material = createDefault()
        const dispose = material.dispose.bind(material)
        material.dispose = () => { materialDisposals += 1; dispose() }
        sharedMaterial = material
      }
      return sharedMaterial as ReturnType<typeof createDefault>
    },
    attachObject(_kind, _group, child) {
      externalParent.add(child)
    },
  })
  assert.equal(externalParent.children.length, 18)
  vfx.dispose()
  assert.equal(geometryDisposals, 1)
  assert.equal(materialDisposals, 1)
  assert.equal(externalParent.children.length, 0)
  externalOwner.dispose()
}

// 活动槽清理自身失败也必须进入聚合，不能跳过八个 GPU 资源和父级解绑。 / Active-slot cleanup failure must aggregate without skipping all eight GPU resources or parent detachment.
{
  const vfx = createComplexBipedMotionVfxController()
  const parent = vfx.object.clone(false)
  parent.add(vfx.object)
  vfx.apply([{ id: 'dust', kind: 'landing-dust', mode: 'burst', strength: .8, timeMs: 0, lifetimeMs: 480 }], {
    requestedTimeMs: 0,
    position: [0, 0, 0],
    facingRadians: 0,
  })
  const resources = new Set<{ dispose(): void }>()
  vfx.object.traverse(child => {
    if (!('geometry' in child) || !('material' in child)) return
    const mesh = child as { geometry?: { dispose(): void }, material?: { dispose(): void } | { dispose(): void }[] }
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) if (material) resources.add(material)
  })
  const disposeCalls = new Map([...resources].map(resource => [resource, 0]))
  for (const resource of resources) {
    const dispose = resource.dispose.bind(resource)
    resource.dispose = () => { disposeCalls.set(resource, disposeCalls.get(resource)! + 1); dispose() }
  }
  const dust = vfx.object.getObjectByName('复杂双足运动特效-落地尘点') as { setMatrixAt(index: number, matrix: unknown): void }
  const setMatrixAt = dust.setMatrixAt.bind(dust)
  dust.setMatrixAt = () => { throw new Error('测试注入：活动槽隐藏失败') }
  assert.throws(
    () => vfx.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足运动特效资源释放失败')
      && error.message.includes('活动实例清理')
      && error.message.includes('活动槽隐藏失败'),
  )
  dust.setMatrixAt = setMatrixAt
  assert.equal(vfx.object.parent, null)
  assert.equal(vfx.snapshot().disposed, true)
  for (const calls of disposeCalls.values()) assert.equal(calls, 1)
  vfx.dispose()
  for (const calls of disposeCalls.values()) assert.equal(calls, 1)
}

// Three 资源的 dispose 事件会同步派发；即使监听器重入控制器释放，也只能释放每个资源一次。 / Three dispatches dispose events synchronously; listener re-entry must still release every resource exactly once.
{
  const vfx = createComplexBipedMotionVfxController()
  const parent = vfx.object.clone(false)
  parent.add(vfx.object)
  const resources = new Set<{
    dispose(): void
    addEventListener(type: 'dispose', listener: () => void): void
    removeEventListener(type: 'dispose', listener: () => void): void
  }>()
  vfx.object.traverse(child => {
    if (!('geometry' in child) || !('material' in child)) return
    const mesh = child as {
      geometry?: typeof resources extends Set<infer Resource> ? Resource : never
      material?: (typeof resources extends Set<infer Resource> ? Resource : never)
        | (typeof resources extends Set<infer Resource> ? Resource : never)[]
    }
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) if (material) resources.add(material)
  })
  assert.equal(resources.size, 8)
  const calls = new Map([...resources].map(resource => [resource, 0]))
  for (const resource of resources) {
    const dispose = resource.dispose.bind(resource)
    resource.dispose = () => { calls.set(resource, calls.get(resource)! + 1); dispose() }
  }
  const reentrantResource = [...resources][0]!
  const reenter = () => {
    reentrantResource.removeEventListener('dispose', reenter)
    assert.throws(
      () => vfx.apply([], { requestedTimeMs: 0, position: [0, 0, 0], facingRadians: 0 }),
      /复杂双足运动特效控制器已释放/,
    )
    assert.throws(() => vfx.reset(), /复杂双足运动特效控制器已释放/)
    vfx.dispose()
  }
  reentrantResource.addEventListener('dispose', reenter)

  vfx.dispose()

  for (const count of calls.values()) assert.equal(count, 1)
  assert.equal(vfx.object.parent, null)
  assert.equal(parent.children.length, 0)
  assert.equal(vfx.snapshot().disposed, true)
  vfx.dispose()
  for (const count of calls.values()) assert.equal(count, 1)
}

// 任意 JavaScript 抛出值都必须安全进入中文聚合，不能阻止其余 GPU 资源和父级释放。 / Arbitrary thrown values must be safely aggregated without blocking later GPU resources or parent detachment.
for (const malformed of ['direct-symbol', 'symbol-message', 'throwing-message-getter', 'undefined'] as const) {
  const vfx = createComplexBipedMotionVfxController()
  const parent = vfx.object.clone(false)
  parent.add(vfx.object)
  const resources = new Set<{ dispose(): void }>()
  vfx.object.traverse(child => {
    if (!('geometry' in child) || !('material' in child)) return
    const mesh = child as { geometry?: { dispose(): void }, material?: { dispose(): void } | { dispose(): void }[] }
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) if (material) resources.add(material)
  })
  const calls = new Map([...resources].map(resource => [resource, 0]))
  const failing = [...resources][0]!
  for (const resource of resources) {
    const dispose = resource.dispose.bind(resource)
    resource.dispose = () => {
      calls.set(resource, calls.get(resource)! + 1)
      dispose()
      if (resource !== failing) return
      if (malformed === 'undefined') throw undefined
      if (malformed === 'direct-symbol') throw Symbol('GPU 直接抛出')
      const error = new Error('占位错误')
      if (malformed === 'symbol-message') error.message = Symbol('GPU 释放失败') as unknown as string
      else Object.defineProperty(error, 'message', { get: () => { throw new Error('message getter 失败') } })
      throw error
    }
  }
  assert.throws(
    () => vfx.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足运动特效资源释放失败')
      && error.message.includes(malformed === 'direct-symbol' ? 'Symbol(GPU 直接抛出)' : malformed === 'symbol-message'
        ? 'Symbol(GPU 释放失败)'
        : malformed === 'throwing-message-getter' ? '未知错误' : 'undefined'),
  )
  assert.equal(vfx.object.parent, null)
  for (const count of calls.values()) assert.equal(count, 1)
  vfx.dispose()
}

// 持械特效使用 24/32/8 固定池，重复信号不重分配且池满只能公平复用已有槽位。 / Weapon VFX uses fixed 24/32/8 pools; duplicate signals do not reallocate and saturation fairly reuses existing slots.
{
  const vfx = createComplexBipedWeaponVfxController()
  const snapshot = vfx.snapshot()
  assert.deepEqual(snapshot.poolCapacityByKind, { 'weapon-trail': 24, 'impact-sparks': 32, 'impact-ring': 8 })
  assert.equal(snapshot.poolCapacityTotal, 64)
  assert.equal(vfx.object.type, 'Group')
  assert.equal(vfx.object.getObjectByName('复杂双足持械特效-命中火花')?.isInstancedMesh, true)
  const signals = [
    { id: 'trail-40', cueId: 'trail', kind: 'weapon-trail' as const, requestedTimeMs: 40, strength: .8, lifetimeMs: 240, points: [[0, 1, 0], [1, 1, 0]] as const },
    { id: 'sparks-40', cueId: 'sparks', kind: 'impact-sparks' as const, requestedTimeMs: 40, strength: .8, lifetimeMs: 360, points: [[1, 0, 0]] as const },
    { id: 'ring-40', cueId: 'ring', kind: 'impact-ring' as const, requestedTimeMs: 40, strength: .8, lifetimeMs: 480, points: [[1, 0, 0]] as const },
  ]
  vfx.apply(signals, { requestedTimeMs: 40, characterHeight: 4 })
  const first = vfx.snapshot()
  assert.equal(first.activeByKind['weapon-trail'], 1)
  assert.ok(first.activeByKind['impact-sparks'] >= 1 && first.activeByKind['impact-sparks'] <= 16)
  assert.equal(first.activeByKind['impact-ring'], 1)
  vfx.apply(signals, { requestedTimeMs: 40, characterHeight: 4 })
  assert.deepEqual(vfx.snapshot().activeByKind, first.activeByKind)

  const saturated = Array.from({ length: 96 }, (_, index) => ({
    id: `trail-${80 + index * 40}`,
    cueId: 'trail',
    kind: 'weapon-trail' as const,
    requestedTimeMs: 80 + index * 40,
    strength: 1,
    lifetimeMs: 2000,
    points: [[index / 10, 1, 0], [index / 10 + 1, 1, 0]] as const,
  }))
  for (const signal of saturated) vfx.apply([signal], { requestedTimeMs: signal.requestedTimeMs, characterHeight: 4 })
  assert.equal(vfx.snapshot().activeByKind['weapon-trail'], 24)
  assert.ok(vfx.snapshot().activeTotal <= 64)
  vfx.dispose()
}

// 回拖与 reset 清活动态但保留固定 Three 池；单类初始化失败不能阻断其余效果。 / Rewind and reset clear activity while retaining pools, and one class failing to initialize cannot block the others.
{
  const vfx = createComplexBipedWeaponVfxController({
    createGeometry(kind, createDefault) {
      if (kind === 'impact-sparks') throw new Error('测试注入：火花几何失败')
      return createDefault()
    },
  })
  assert.deepEqual(vfx.snapshot().unavailableKinds, ['impact-sparks'])
  assert.doesNotThrow(() => vfx.apply(new Proxy([], { get() { throw new Error('测试注入：信号数组失败') } }) as never, {
    requestedTimeMs: 0,
    characterHeight: 4,
  }))
  assert.doesNotThrow(() => vfx.apply([], new Proxy({} as never, { get() { throw new Error('测试注入：帧访问失败') } })))
  const childCount = vfx.object.children.length
  const ring = { id: 'ring-400', cueId: 'ring', kind: 'impact-ring' as const, requestedTimeMs: 400, strength: 1, lifetimeMs: 480, points: [[0, 0, 0]] as const }
  vfx.apply([ring], { requestedTimeMs: 400, characterHeight: 4 })
  assert.equal(vfx.snapshot().activeByKind['impact-ring'], 1)
  vfx.apply([], { requestedTimeMs: 200, characterHeight: 4 })
  assert.equal(vfx.snapshot().activeTotal, 0)
  vfx.apply([ring], { requestedTimeMs: 400, characterHeight: 4 })
  assert.equal(vfx.snapshot().activeByKind['impact-ring'], 1)
  vfx.reset()
  assert.equal(vfx.snapshot().activeTotal, 0)
  assert.equal(vfx.object.children.length, childCount)
  vfx.dispose()
}

// dispose 必须先封存，再在任意 GPU 资源抛错时继续释放其余资源并解绑父级。 / Dispose seals first, then continues releasing remaining GPU resources and detaches the group after an arbitrary resource failure.
{
  const vfx = createComplexBipedWeaponVfxController()
  const parent = vfx.object.clone(false)
  parent.add(vfx.object)
  const resources = new Set<{ dispose(): void }>()
  vfx.object.traverse((child) => {
    if (!('geometry' in child) || !('material' in child)) return
    const mesh = child as { geometry?: { dispose(): void }, material?: { dispose(): void } | { dispose(): void }[] }
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) if (material) resources.add(material)
  })
  assert.equal(resources.size, 6)
  const calls = new Map([...resources].map(resource => [resource, 0]))
  const failing = [...resources][0]!
  for (const resource of resources) {
    const dispose = resource.dispose.bind(resource)
    resource.dispose = () => {
      calls.set(resource, calls.get(resource)! + 1)
      dispose()
      if (resource === failing) throw undefined
    }
  }
  assert.throws(
    () => vfx.dispose(),
    error => error instanceof Error
      && error.message.includes('复杂双足持械特效资源释放失败')
      && error.message.includes('undefined'),
  )
  assert.equal(parent.children.length, 0)
  assert.equal(vfx.snapshot().disposed, true)
  for (const count of calls.values()) assert.equal(count, 1)
  vfx.dispose()
  for (const count of calls.values()) assert.equal(count, 1)
}

console.log('studio complex biped Root Motion runtime tests passed')
