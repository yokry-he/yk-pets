/**
 * 文件职责 / File responsibility
 * 验证复杂双足萌宠动作控制器相对绑定姿态写入、权重混合、恢复与释放边界。
 */

import assert from 'node:assert/strict'
import {
  compileBipedPetCharacter,
  compileBipedPetMotion,
  createBipedPetModelRecipe,
  sampleBipedPetMotion,
  type CompiledCharacterModel,
  type SampledBipedPetMotion,
} from '../packages/pet-core/src/index.ts'
import { BASIC_BIPED_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-basic-biped-motions.ts'
import { createComplexBipedPetObject } from '../apps/playground/app/three/create-complex-biped-pet-object.ts'
import { createComplexBipedMotionController } from '../apps/playground/app/three/apply-complex-biped-motion.ts'
import { createComplexBipedIkController } from '../apps/playground/app/three/apply-complex-biped-ik.ts'

function createRuntime() {
  const recipe = createBipedPetModelRecipe(1)
  const compilation = compileBipedPetCharacter(recipe)
  assert.equal(compilation.status, 'ready')
  return {
    compilation,
    runtime: createComplexBipedPetObject(compilation, recipe.material),
  }
}

const wave = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-wave')
const walk = BASIC_BIPED_STUDIO_MOTIONS.find(item => item.id === 'builtin-biped-walk')
assert.ok(wave)
assert.ok(walk)

const finiteUnitQuaternion = (quaternion: { toArray(): number[], length(): number }) => quaternion.toArray().every(Number.isFinite)
  && Math.abs(quaternion.length() - 1) < 1e-6

function readContactWorld(runtime: ReturnType<typeof createRuntime>['runtime'], compilation: CompiledCharacterModel, contactId: string) {
  const contact = compilation.contacts.find(item => item.id === contactId)
  assert.ok(contact)
  const bone = runtime.bonesById.get(contact.boneId)
  assert.ok(bone)
  runtime.object.updateMatrixWorld(true)
  return bone.position.clone().set(...contact.localPosition).applyMatrix4(bone.matrixWorld)
}

function readContactWorldRotation(runtime: ReturnType<typeof createRuntime>['runtime'], compilation: CompiledCharacterModel, contactId: string) {
  const contact = compilation.contacts.find(item => item.id === contactId)!
  const bone = runtime.bonesById.get(contact.boneId)!
  const result = bone.quaternion.clone()
  bone.getWorldQuaternion(result)
  return result.multiply(bone.quaternion.clone().set(...contact.localRotation)).normalize()
}

function cloneCompilation(compilation: CompiledCharacterModel): CompiledCharacterModel {
  return structuredClone(compilation)
}

function sampleWith(
  sample: SampledBipedPetMotion,
  patch: Partial<SampledBipedPetMotion>,
): SampledBipedPetMotion {
  return { ...sample, ...patch }
}

function snapshotBones(runtime: ReturnType<typeof createRuntime>['runtime']) {
  return Object.fromEntries([...runtime.bonesById].map(([id, bone]) => [id, {
    position: bone.position.toArray(),
    quaternion: bone.quaternion.toArray(),
  }]))
}

function assertBoneSnapshotsNear(
  actual: ReturnType<typeof snapshotBones>,
  expected: ReturnType<typeof snapshotBones>,
  tolerance = 1e-9,
) {
  assert.deepEqual(Object.keys(actual), Object.keys(expected))
  for (const boneId of Object.keys(actual)) {
    for (const field of ['position', 'quaternion'] as const) for (const [index, value] of actual[boneId]![field].entries()) {
      assert.ok(Math.abs(value - expected[boneId]![field][index]!) <= tolerance, `${boneId}.${field}[${index}] 不一致`)
    }
  }
}

function readChainLengths(runtime: ReturnType<typeof createRuntime>['runtime'], boneIds: readonly string[]) {
  runtime.object.updateMatrixWorld(true)
  return boneIds.slice(1).map((boneId, index) => {
    const previous = runtime.bonesById.get(boneIds[index]!)!
    const current = runtime.bonesById.get(boneId)!
    return previous.getWorldPosition(previous.position.clone()).distanceTo(current.getWorldPosition(current.position.clone()))
  })
}

// IK 不拥有 foot 的局部位移：外部写入在 apply/reset/dispose 全生命周期都必须保留。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedIkController(runtime, compilation)
  const foot = runtime.bonesById.get('foot.left')!
  foot.position.x = .025
  const externalPosition = foot.position.toArray()
  controller.apply(sampleBipedPetMotion(clip, 100), 0)
  assert.deepEqual(foot.position.toArray(), externalPosition)
  controller.reset()
  assert.deepEqual(foot.position.toArray(), externalPosition)
  const active = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  controller.apply(active(120), 1)
  controller.apply(active(140), 1)
  assert.deepEqual(foot.position.toArray(), externalPosition)
  controller.dispose()
  assert.deepEqual(foot.position.toArray(), externalPosition)
  runtime.dispose()
}

// walk 单支撑超域仍应用有限 clamped 解：有改善但不得伪装成完整锁定。
{
  const withIk = createRuntime()
  const baseline = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: withIk.compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(withIk.runtime)
  const baselineController = createComplexBipedMotionController(baseline.runtime)
  const ikController = createComplexBipedIkController(withIk.runtime, withIk.compilation)
  const locked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fkDriver.apply(locked(100), 1)
  baselineController.apply(locked(100), 1)
  ikController.apply(locked(100), 1)
  const anchor = readContactWorld(withIk.runtime, withIk.compilation, 'foot.left')
  const baselineAnchor = readContactWorld(baseline.runtime, baseline.compilation, 'foot.left')
  const positionsBefore = Object.fromEntries([...withIk.runtime.bonesById].map(([id, bone]) => [id, bone.position.toArray()]))
  fkDriver.apply(locked(320), 1)
  baselineController.apply(locked(320), 1)
  ikController.apply(locked(320), 1)
  const error = readContactWorld(withIk.runtime, withIk.compilation, 'foot.left').distanceTo(anchor)
  const baselineError = readContactWorld(baseline.runtime, baseline.compilation, 'foot.left').distanceTo(baselineAnchor)
  assert.ok(error > 1e-3 && error < baselineError, `clamped 应有限改善且不硬锁：ik=${error}, fk=${baselineError}`)
  assert.ok(ikController.diagnostics().some(item => item.includes('leg.left') && item.includes('clamped')))
  const diagnosticCount = ikController.diagnostics().length
  fkDriver.apply(locked(320), 1)
  ikController.apply(locked(320), 1)
  assert.equal(ikController.diagnostics().length, diagnosticCount)
  for (const [boneId, bone] of withIk.runtime.bonesById) if (boneId !== 'pelvis' && boneId !== 'root') {
    assert.deepEqual(bone.position.toArray(), positionsBefore[boneId])
  }
  ikController.dispose()
  fkDriver.dispose()
  baselineController.dispose()
  withIk.runtime.dispose()
  baseline.runtime.dispose()
}

{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const sample = sampleBipedPetMotion(clip, 1400)
  const chest = runtime.bonesById.get('chest')!
  const root = runtime.bonesById.get('root')!
  const bindChest = chest.quaternion.clone()
  const bindRootPosition = root.position.clone()
  const controller = createComplexBipedMotionController(runtime)

  controller.apply(sample)
  assert.notDeepEqual(chest.quaternion.toArray(), bindChest.toArray())
  assert.notDeepEqual(root.position.toArray(), bindRootPosition.toArray())
  const fullAngle = chest.quaternion.angleTo(bindChest)

  controller.reset()
  assert.deepEqual(chest.quaternion.toArray(), bindChest.toArray())
  assert.deepEqual(root.position.toArray(), bindRootPosition.toArray())

  controller.apply(sample, .5)
  const halfAngle = chest.quaternion.angleTo(bindChest)
  assert.ok(halfAngle > 0)
  assert.ok(halfAngle < fullAngle)

  controller.dispose()
  controller.dispose()
  assert.throws(() => controller.apply(sample), /已释放/)
  runtime.dispose()
}

// 真实 Bone 回归：连续接触期间脚底必须锁在首次捕获的世界锚点。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  const bindPositions = Object.fromEntries([...runtime.bonesById].map(([id, bone]) => [id, bone.position.toArray()]))
  const leftChainIds = compilation.limbIk.find(item => item.id === 'leg.left')!.boneIds
  const bindChainLengths = readChainLengths(runtime, leftChainIds)
  const lockedLeft = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 },
    ],
    activeContacts: ['foot.left', 'foot.right'],
  })
  controller.apply(lockedLeft(100))
  const leftAnchor = readContactWorld(runtime, compilation, 'foot.left')
  controller.apply(lockedLeft(320))
  const leftLocked = readContactWorld(runtime, compilation, 'foot.left')
  assert.ok(leftLocked.distanceTo(leftAnchor) < 1e-3, `左脚锁定误差过大：${leftLocked.distanceTo(leftAnchor)}`)
  for (const [boneId, bone] of runtime.bonesById) if (boneId !== 'root' && boneId !== 'pelvis') {
    assert.deepEqual(bone.position.toArray(), bindPositions[boneId], `${boneId} 的局部 position 不得被 IK 修改`)
  }
  for (const [index, length] of readChainLengths(runtime, leftChainIds).entries()) assert.ok(Math.abs(length - bindChainLengths[index]!) < 1e-9)
  assert.ok([...runtime.bonesById.values()].every(bone => finiteUnitQuaternion(bone.quaternion)))

  controller.reset()
  controller.apply(sampleBipedPetMotion(clip, 0), 0)
  assert.deepEqual(runtime.bonesById.get('thigh.left')!.quaternion.toArray(), [0, 0, 0, 1])
  controller.dispose()
  runtime.dispose()
}


// 极低动作权重只能产生极低 Quaternion 修正，不能通过末端平移实现完整锁定。
{
  const full = createRuntime()
  const fullFk = createRuntime()
  const low = createRuntime()
  const lowFk = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: full.compilation.bones.map(item => item.id) })
  const fullController = createComplexBipedMotionController(full.runtime, full.compilation)
  const fullFkController = createComplexBipedMotionController(fullFk.runtime)
  const lowController = createComplexBipedMotionController(low.runtime, low.compilation)
  const lowFkController = createComplexBipedMotionController(lowFk.runtime)
  const locked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fullController.apply(locked(100), 1)
  fullFkController.apply(locked(100), 1)
  lowController.apply(locked(100), .01)
  lowFkController.apply(locked(100), .01)
  const fullAnchor = readContactWorld(full.runtime, full.compilation, 'foot.left')
  const fullFkAnchor = readContactWorld(fullFk.runtime, fullFk.compilation, 'foot.left')
  const lowAnchor = readContactWorld(low.runtime, low.compilation, 'foot.left')
  const lowFkAnchor = readContactWorld(lowFk.runtime, lowFk.compilation, 'foot.left')
  fullController.apply(locked(320), 1)
  fullFkController.apply(locked(320), 1)
  lowController.apply(locked(320), .01)
  lowFkController.apply(locked(320), .01)
  const fullError = readContactWorld(full.runtime, full.compilation, 'foot.left').distanceTo(fullAnchor)
  const fullFkError = readContactWorld(fullFk.runtime, fullFk.compilation, 'foot.left').distanceTo(fullFkAnchor)
  const lowError = readContactWorld(low.runtime, low.compilation, 'foot.left').distanceTo(lowAnchor)
  const lowFkError = readContactWorld(lowFk.runtime, lowFk.compilation, 'foot.left').distanceTo(lowFkAnchor)
  const fullImprovement = fullFkError - fullError
  const lowImprovement = lowFkError - lowError
  assert.ok(fullImprovement > 0)
  assert.ok(lowImprovement >= 0 && lowImprovement <= fullImprovement * .1, `低权重改善必须近似受权重缩小：full=${fullImprovement}, low=${lowImprovement}`)
  assert.ok(lowError > 1e-8, `低权重不得被强制完整锁定：${lowError}`)
  assert.deepEqual(low.runtime.bonesById.get('foot.left')!.position.toArray(), full.runtime.bonesById.get('foot.left')!.position.toArray())
  fullController.dispose()
  fullFkController.dispose()
  lowController.dispose()
  lowFkController.dispose()
  full.runtime.dispose()
  fullFk.runtime.dispose()
  low.runtime.dispose()
  lowFk.runtime.dispose()
}

// active IK 后直接写 weight 0，完整骨骼姿态必须与纯 FK 基线一致，无需先 reset。
{
  const withIk = createRuntime()
  const fkOnly = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: withIk.compilation.bones.map(item => item.id) })
  const ikController = createComplexBipedMotionController(withIk.runtime, withIk.compilation)
  const fkController = createComplexBipedMotionController(fkOnly.runtime)
  ikController.apply(sampleBipedPetMotion(clip, 100), 1)
  ikController.apply(sampleBipedPetMotion(clip, 320), 1)
  const zeroSample = sampleBipedPetMotion(clip, 420)
  ikController.apply(zeroSample, 0)
  fkController.apply(zeroSample, 0)
  assertBoneSnapshotsNear(snapshotBones(withIk.runtime), snapshotBones(fkOnly.runtime))
  ikController.dispose()
  fkController.dispose()
  withIk.runtime.dispose()
  fkOnly.runtime.dispose()
}

// 左右脚分别捕获锚点，释放一侧不能覆盖或清除另一侧。 / Each foot captures its own anchor; releasing one side must not overwrite or clear the other.
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  const bothLocked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 },
    ],
    activeContacts: ['foot.left', 'foot.right'],
  })
  controller.apply(bothLocked(100))
  const leftAnchor = readContactWorld(runtime, compilation, 'foot.left')
  const rightAnchor = readContactWorld(runtime, compilation, 'foot.right')
  controller.apply(bothLocked(320))
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(leftAnchor) < 1e-3)
  assert.ok(readContactWorld(runtime, compilation, 'foot.right').distanceTo(rightAnchor) < 1e-3)
  controller.apply(sampleWith(sampleBipedPetMotion(clip, 321), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  }))
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(leftAnchor) < 1e-2)
  controller.dispose()
  runtime.dispose()
}


// auto 的五骨连续链必须走完整 FABRIK；显式 analytic 对非法聚合链必须诊断并回退 FK。
{
  const auto = createRuntime()
  const autoFk = createRuntime()
  const autoCompilation = cloneCompilation(auto.compilation)
  autoCompilation.limbIk[0]!.boneIds = ['thigh.left', 'knee.left', 'calf.left', 'ankle.left', 'foot.left']
  const autoDiagnostics = createComplexBipedIkController(auto.runtime, autoCompilation)
  assert.ok(autoDiagnostics.diagnostics().some(item => item.includes('leg.left') && item.includes('FABRIK')))
  autoDiagnostics.dispose()
  const autoController = createComplexBipedMotionController(auto.runtime, autoCompilation)
  const autoFkController = createComplexBipedMotionController(autoFk.runtime)
  const clip = compileBipedPetMotion(wave, { boneIds: autoCompilation.bones.map(item => item.id) })
  const locked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 },
    ],
    activeContacts: ['foot.left', 'foot.right'],
  })
  autoController.apply(locked(100), 1)
  autoFkController.apply(locked(100), 1)
  const autoAnchor = readContactWorld(auto.runtime, autoCompilation, 'foot.left')
  const autoFkAnchor = readContactWorld(autoFk.runtime, autoFk.compilation, 'foot.left')
  const bindPositions = Object.fromEntries([...auto.runtime.bonesById].map(([id, bone]) => [id, bone.position.toArray()]))
  const shifted = sampleWith(locked(100), { rootPosition: [.05, 0, 0] })
  autoController.apply(shifted, 1)
  autoFkController.apply(shifted, 1)
  const autoError = readContactWorld(auto.runtime, autoCompilation, 'foot.left').distanceTo(autoAnchor)
  const autoFkError = readContactWorld(autoFk.runtime, autoFk.compilation, 'foot.left').distanceTo(autoFkAnchor)
  assert.ok(autoError < autoFkError, `FABRIK 应改善真实末端误差：ik=${autoError}, fk=${autoFkError}`)
  for (const boneId of autoCompilation.limbIk[0]!.boneIds) assert.deepEqual(auto.runtime.bonesById.get(boneId)!.position.toArray(), bindPositions[boneId])
  autoController.dispose()
  autoFkController.dispose()
  auto.runtime.dispose()
  autoFk.runtime.dispose()

  const explicit = createRuntime()
  const explicitFk = createRuntime()
  const explicitCompilation = cloneCompilation(explicit.compilation)
  explicitCompilation.limbIk[0]!.solver = 'analytic-two-bone'
  explicitCompilation.limbIk[0]!.boneIds = ['thigh.left', 'knee.left', 'calf.left', 'ankle.left', 'foot.left']
  const explicitDiagnostics = createComplexBipedIkController(explicit.runtime, explicitCompilation)
  assert.ok(explicitDiagnostics.diagnostics().some(item => item.includes('leg.left') && item.includes('回退')))
  assert.ok(!explicitDiagnostics.diagnostics().some(item => item.includes('leg.left') && item.includes('使用解析式')))
  explicitDiagnostics.dispose()
  const explicitController = createComplexBipedMotionController(explicit.runtime, explicitCompilation)
  const explicitFkController = createComplexBipedMotionController(explicitFk.runtime)
  explicitController.apply(locked(100), 1)
  explicitFkController.apply(locked(100), 1)
  explicitController.apply(shifted, 1)
  explicitFkController.apply(shifted, 1)
  for (const boneId of explicitCompilation.limbIk[0]!.boneIds) {
    assert.ok(explicit.runtime.bonesById.get(boneId)!.quaternion.angleTo(explicitFk.runtime.bonesById.get(boneId)!.quaternion) < 1e-9)
  }
  explicitController.dispose()
  explicitFkController.dispose()
  explicit.runtime.dispose()
  explicitFk.runtime.dispose()
}

// clip 切换、时间倒退与跨循环大跳必须清锁，并在当前帧重新捕获而不是拉回旧锚。
for (const kind of ['time-rewind', 'clip-switch', 'large-jump'] as const) {
  const withIk = createRuntime()
  const baseline = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: withIk.compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(withIk.runtime, withIk.compilation)
  const baselineController = createComplexBipedMotionController(baseline.runtime)
  const locked = (sample: SampledBipedPetMotion) => sampleWith(sample, {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  const start = locked(sampleBipedPetMotion(clip, 100))
  const continuous = locked(sampleBipedPetMotion(clip, 200))
  const discontinuity = kind === 'time-rewind'
    ? locked(sampleBipedPetMotion(clip, 80))
    : kind === 'clip-switch'
      ? sampleWith(locked(sampleBipedPetMotion(clip, 220)), { clipHash: `${clip.hash}-next` })
      : locked(sampleBipedPetMotion(clip, 900))
  controller.apply(start, 1)
  controller.apply(continuous, 1)
  controller.apply(discontinuity, 1)
  baselineController.apply(discontinuity, 1)
  assert.ok(readContactWorld(withIk.runtime, withIk.compilation, 'foot.left')
    .distanceTo(readContactWorld(baseline.runtime, baseline.compilation, 'foot.left')) < 1e-9, `${kind} 后必须在当前 FK 帧重新捕获`)
  controller.dispose()
  baselineController.dispose()
  withIk.runtime.dispose()
  baseline.runtime.dispose()
}

// loop 接缝两侧同一接触仍 active 时必须保留旧锚；不连续接触则释放并在下次重新捕获。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const lockedLeft = (sample: SampledBipedPetMotion) => sampleWith(sample, {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  const before = lockedLeft(sampleBipedPetMotion(clip, 1190))
  fkDriver.apply(before, 1)
  ikController.apply(before, 1)
  const anchor = readContactWorld(runtime, compilation, 'foot.left')
  const wrapped = sampleWith(lockedLeft(sampleBipedPetMotion(clip, 1210)), { rootPosition: [.03, 0, 0] })
  fkDriver.apply(wrapped, 1)
  ikController.apply(wrapped, 1)
  const seamError = readContactWorld(runtime, compilation, 'foot.left').distanceTo(anchor)
  assert.ok(seamError < .02, `loop seam 锚点误差不得突增：${seamError}`)

  const released = sampleWith(sampleBipedPetMotion(clip, 1220), { contactStates: [], activeContacts: [] })
  fkDriver.apply(released, 1)
  ikController.apply(released, 1)
  const recapture = lockedLeft(sampleBipedPetMotion(clip, 1230))
  fkDriver.apply(recapture, 1)
  const fkContact = readContactWorld(runtime, compilation, 'foot.left')
  ikController.apply(recapture, 1)
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(fkContact) < 1e-9)
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// 锁定后脚部扭转必须通过纯 Quaternion 朝向补偿收敛，并保持接触位置受控。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const locked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fkDriver.apply(locked(100), 1)
  const targetRotation = readContactWorldRotation(runtime, compilation, 'foot.left')
  ikController.apply(locked(100), 1)
  fkDriver.apply(locked(120), 1)
  ikController.apply(locked(120), 1)
  const anchor = readContactWorld(runtime, compilation, 'foot.left')
  const foot = runtime.bonesById.get('foot.left')!
  foot.rotateY(.6)
  runtime.object.updateMatrixWorld(true)
  const beforeError = readContactWorldRotation(runtime, compilation, 'foot.left').angleTo(targetRotation)
  ikController.apply(locked(120), .01)
  const lowWeightError = readContactWorldRotation(runtime, compilation, 'foot.left').angleTo(targetRotation)
  assert.ok(lowWeightError < beforeError && lowWeightError > beforeError * .8, `低权重朝向修正必须按比例受限：${lowWeightError}`)
  ikController.apply(locked(120), 1)
  const afterError = readContactWorldRotation(runtime, compilation, 'foot.left').angleTo(targetRotation)
  assert.ok(afterError < beforeError * .5 && afterError < .2, `朝向误差应明显下降：before=${beforeError}, after=${afterError}`)
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(anchor) < 1e-2)
  const beforeWeightZero = foot.quaternion.clone()
  ikController.apply(locked(120), 0)
  assert.deepEqual(foot.quaternion.toArray(), beforeWeightZero.toArray())
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// 任意 Clip 身份 churn 不得让诊断集合无界增长。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  for (let index = 0; index < 40; index++) {
    const withIdentity = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
      clipHash: `${clip.hash}-${index}`,
      contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
      activeContacts: ['foot.left'],
    })
    for (const sample of [withIdentity(100), withIdentity(320)]) {
      fkDriver.apply(sample, 1)
      ikController.apply(sample, 1)
    }
  }
  assert.ok(ikController.diagnostics().length <= 64)
  assert.equal(ikController.diagnostics().filter(item => item.includes('leg.left') && item.includes('clamped')).length, 1)
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// 三轮交替不得重复吃完整 mix；单帧累计 Quaternion 修正受 maxCorrection×weight 硬预算。
for (const [weight, maximum] of [[.01, .0085], [.2, .17]] as const) {
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const locked = sampleWith(sampleBipedPetMotion(clip, 100), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fkDriver.apply(locked, 1)
  ikController.apply(locked, 1)
  const foot = runtime.bonesById.get('foot.left')!
  foot.rotateY(2.8)
  const before = foot.quaternion.clone()
  ikController.apply(locked, weight)
  const applied = foot.quaternion.angleTo(before)
  assert.ok(applied <= maximum + 1e-6, `weight=${weight} 的累计修正越界：${applied}`)
  if (weight === .01) assert.ok(applied < .02)
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// weight 1 可跨帧在每帧预算内收敛大扭转。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const locked = sampleWith(sampleBipedPetMotion(clip, 100), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fkDriver.apply(locked, 1)
  const target = readContactWorldRotation(runtime, compilation, 'foot.left')
  ikController.apply(locked, 1)
  runtime.bonesById.get('foot.left')!.rotateY(2.8)
  for (let frame = 0; frame < 4; frame++) ikController.apply(locked, 1)
  assert.ok(readContactWorldRotation(runtime, compilation, 'foot.left').angleTo(target) < .1)
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// contactBone 朝向写入后的异常必须恢复链骨与链外 foot Quaternion 到该帧纯 FK。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const fkDriver = createComplexBipedMotionController(runtime)
  const ikController = createComplexBipedIkController(runtime, compilation)
  const locked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  fkDriver.apply(locked(100), 1)
  ikController.apply(locked(100), 1)
  fkDriver.apply(locked(320), 1)
  const expected = snapshotBones(runtime)
  const foot = runtime.bonesById.get('foot.left')!
  const expectedFoot = foot.quaternion.clone()
  const updateMatrixWorld = runtime.object.updateMatrixWorld.bind(runtime.object)
  let injected = true
  runtime.object.updateMatrixWorld = (force?: boolean) => {
    if (injected && foot.quaternion.angleTo(expectedFoot) > 1e-5) {
      injected = false
      throw new Error('测试注入：脚部朝向写入后矩阵更新失败')
    }
    updateMatrixWorld(force)
  }
  ikController.apply(locked(320), 1)
  assert.equal(injected, false)
  for (const boneId of ['thigh.left', 'knee.left', 'calf.left', 'ankle.left', 'foot.left']) {
    assert.ok(runtime.bonesById.get(boneId)!.quaternion.angleTo(runtime.bonesById.get(boneId)!.quaternion.clone().set(...expected[boneId]!.quaternion)) < 1e-9)
  }
  assert.ok(ikController.diagnostics().some(item => item.includes('leg.left') && item.includes('异常') && item.includes('FK')))
  runtime.object.updateMatrixWorld = updateMatrixWorld
  ikController.dispose()
  fkDriver.dispose()
  runtime.dispose()
}

// 显式 FABRIK、auto 标准链和 auto 非标准链路径均可诊断；损坏单肢不得阻断另一肢。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const mixed = cloneCompilation(compilation)
  mixed.limbIk[0]!.solver = 'fabrik'
  mixed.limbIk[1]!.solver = 'auto'
  mixed.limbIk[1]!.boneIds = ['thigh.right', 'knee.right', 'calf.right', 'ankle.right', 'foot.right']
  const diagnostics = createComplexBipedIkController(runtime, mixed)
  assert.ok(diagnostics.diagnostics().some(item => item.includes('FABRIK')))
  diagnostics.dispose()
  const controller = createComplexBipedMotionController(runtime, mixed)
  const sample = sampleBipedPetMotion(clip, 20)
  const frozenSample = structuredClone(sample)
  const frozenCompilation = structuredClone(mixed)
  controller.apply(sample, 1)
  assert.deepEqual(sample, frozenSample)
  assert.deepEqual(mixed, frozenCompilation)
  controller.dispose()
  runtime.dispose()
}

{
  const { compilation, runtime } = createRuntime()
  const explicitAnalytic = cloneCompilation(compilation)
  explicitAnalytic.limbIk[0]!.solver = 'analytic-two-bone'
  const controller = createComplexBipedIkController(runtime, explicitAnalytic)
  assert.ok(controller.diagnostics().some(item => item.includes('leg.left') && item.includes('解析式')))
  assert.ok(controller.diagnostics().some(item => item.includes('leg.right') && item.includes('解析式')))
  controller.dispose()
  runtime.dispose()
}

{
  const { compilation, runtime } = createRuntime()
  const baseline = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const broken = cloneCompilation(compilation)
  broken.limbIk[0]!.boneIds = ['missing.left', 'knee.left', 'calf.left']
  const diagnosticController = createComplexBipedIkController(runtime, broken)
  const missingDiagnostics = diagnosticController.diagnostics().filter(item => item.includes('leg.left'))
  assert.equal(missingDiagnostics.length, 1)
  assert.ok(diagnosticController.diagnostics().some(item => item.includes('leg.right') && item.includes('解析式')))
  diagnosticController.dispose()
  const controller = createComplexBipedMotionController(runtime, broken)
  const baselineController = createComplexBipedMotionController(baseline.runtime)
  const rightLocked = (rootX: number) => sampleWith(sampleBipedPetMotion(clip, 100), {
    rootPosition: [rootX, 0, 0],
    contactStates: [{ contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.right'],
  })
  controller.apply(rightLocked(0), 1)
  baselineController.apply(rightLocked(0), 1)
  const rightAnchor = readContactWorld(runtime, compilation, 'foot.right')
  const baselineAnchor = readContactWorld(baseline.runtime, baseline.compilation, 'foot.right')
  controller.apply(rightLocked(.05), 1)
  baselineController.apply(rightLocked(.05), 1)
  for (const boneId of ['thigh.left', 'knee.left', 'calf.left', 'ankle.left']) {
    assert.ok(runtime.bonesById.get(boneId)!.quaternion.angleTo(baseline.runtime.bonesById.get(boneId)!.quaternion) < 1e-9)
  }
  assert.ok(readContactWorld(runtime, compilation, 'foot.right').distanceTo(rightAnchor)
    < readContactWorld(baseline.runtime, baseline.compilation, 'foot.right').distanceTo(baselineAnchor))
  assert.ok(finiteUnitQuaternion(runtime.bonesById.get('thigh.right')!.quaternion))
  controller.dispose()
  baselineController.dispose()
  runtime.dispose()
  baseline.runtime.dispose()
}


// blocked 编译结果和缺失 contact 都只诊断一次并保持 FK 安全。
{
  const { compilation, runtime } = createRuntime()
  const baseline = createRuntime()
  const blocked = cloneCompilation(compilation)
  blocked.status = 'blocked'
  const blockedDiagnostics = createComplexBipedIkController(runtime, blocked)
  assert.equal(blockedDiagnostics.diagnostics().filter(item => item.includes('阻塞')).length, 1)
  blockedDiagnostics.dispose()
  const blockedController = createComplexBipedMotionController(runtime, blocked)
  const baselineController = createComplexBipedMotionController(baseline.runtime)
  const sample = sampleBipedPetMotion(compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) }), 320)
  blockedController.apply(sample, 1)
  baselineController.apply(sample, 1)
  assertBoneSnapshotsNear(snapshotBones(runtime), snapshotBones(baseline.runtime))
  blockedController.dispose()
  baselineController.dispose()

  const missingContact = cloneCompilation(compilation)
  missingContact.contacts = missingContact.contacts.filter(item => item.id !== 'foot.left')
  const missingController = createComplexBipedIkController(runtime, missingContact)
  assert.equal(missingController.diagnostics().filter(item => item.includes('leg.left')).length, 1)
  missingController.dispose()
  runtime.dispose()
  baseline.runtime.dispose()
}

// 双支撑骨盆修正有界；单支撑和零权重不能写入骨盆 IK。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  const pelvis = runtime.bonesById.get('pelvis')!
  const bindY = pelvis.position.y
  controller.apply(sampleBipedPetMotion(clip, 10), 1)
  controller.apply(sampleBipedPetMotion(clip, 1600), 1)
  assert.ok(pelvis.position.y - bindY >= -.08 && pelvis.position.y - bindY <= .08)
  controller.apply(sampleBipedPetMotion(clip, 1800), 0)
  assert.equal(pelvis.position.y, bindY)
  controller.reset()
  assert.equal(pelvis.position.y, bindY)
  const singleSupport = sampleWith(sampleBipedPetMotion(clip, 1800), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  controller.apply(singleSupport, 1)
  assert.equal(pelvis.position.y, bindY)
  controller.dispose()
  const disposedPose = snapshotBones(runtime)
  controller.dispose()
  assert.throws(() => controller.apply(sampleBipedPetMotion(clip, 2000), 1), /已释放/)
  assert.throws(() => controller.reset(), /已释放/)
  assertBoneSnapshotsNear(snapshotBones(runtime), disposedPose)
  runtime.dispose()
}

// 没有 compilation 时必须维持旧 FK 签名和结果。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const sample = sampleBipedPetMotion(clip, 1400)
  const controller = createComplexBipedMotionController(runtime)
  controller.apply(sample)
  const expected = runtime.bonesById.get('chest')!.quaternion.clone().set(...sample.bones.find(item => item.boneId === 'chest')!.rotation)
  assert.ok(runtime.bonesById.get('chest')!.quaternion.angleTo(expected) < 1e-8)
  controller.dispose()
  runtime.dispose()
}

{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const sample = sampleBipedPetMotion(clip, 1400)
  const controller = createComplexBipedMotionController(runtime)

  runtime.dispose()
  assert.equal(runtime.isDisposed(), true)
  assert.throws(() => controller.apply(sample), /已释放/)
  controller.dispose()
}

console.log('复杂双足萌宠动作控制器测试通过。')
