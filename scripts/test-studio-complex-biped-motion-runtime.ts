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

function cloneCompilation(compilation: CompiledCharacterModel): CompiledCharacterModel {
  return structuredClone(compilation)
}

function sampleWith(
  sample: SampledBipedPetMotion,
  patch: Partial<SampledBipedPetMotion>,
): SampledBipedPetMotion {
  return { ...sample, ...patch }
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
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  controller.apply(sampleBipedPetMotion(clip, 100))
  const leftAnchor = readContactWorld(runtime, compilation, 'foot.left')
  controller.apply(sampleBipedPetMotion(clip, 320))
  const leftLocked = readContactWorld(runtime, compilation, 'foot.left')
  assert.ok(leftLocked.distanceTo(leftAnchor) < 1e-3, `左脚锁定误差过大：${leftLocked.distanceTo(leftAnchor)}`)
  assert.ok([...runtime.bonesById.values()].every(bone => finiteUnitQuaternion(bone.quaternion)))

  controller.reset()
  controller.apply(sampleBipedPetMotion(clip, 0), 0)
  assert.deepEqual(runtime.bonesById.get('thigh.left')!.quaternion.toArray(), [0, 0, 0, 1])
  controller.dispose()
  runtime.dispose()
}

// 左右脚分别捕获锚点，释放一侧不能覆盖或清除另一侧。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  const bothLocked = (timeMs: number) => sampleWith(sampleBipedPetMotion(clip, timeMs), {
    contactStates: [
      { contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 },
      { contactId: 'foot.right', phase: 'locked', weight: 1, confidence: 1 },
    ],
    activeContacts: ['foot.left', 'foot.right'],
  })
  controller.apply(bothLocked(20))
  const leftAnchor = readContactWorld(runtime, compilation, 'foot.left')
  const rightAnchor = readContactWorld(runtime, compilation, 'foot.right')
  controller.apply(bothLocked(40))
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(leftAnchor) < 1e-3)
  assert.ok(readContactWorld(runtime, compilation, 'foot.right').distanceTo(rightAnchor) < 1e-3)
  controller.apply(sampleBipedPetMotion(clip, 200))
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(leftAnchor) < 1e-3)
  controller.dispose()
  runtime.dispose()
}

// clip 切换、时间倒退与跨循环大跳必须清锁，并在当前帧重新捕获而不是拉回旧锚。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedMotionController(runtime, compilation)
  const first = sampleBipedPetMotion(clip, 100)
  controller.apply(first)
  const oldAnchor = readContactWorld(runtime, compilation, 'foot.left')
  controller.apply(sampleBipedPetMotion(clip, 320))
  controller.apply(sampleBipedPetMotion(clip, 80))
  const rewindAnchor = readContactWorld(runtime, compilation, 'foot.left')
  assert.ok(rewindAnchor.distanceTo(oldAnchor) > 1e-4)
  controller.apply(sampleWith(sampleBipedPetMotion(clip, 200), { clipHash: `${clip.hash}-next` }))
  const switchedAnchor = readContactWorld(runtime, compilation, 'foot.left')
  assert.ok(switchedAnchor.distanceTo(oldAnchor) > 1e-4)
  controller.apply(sampleBipedPetMotion(clip, clip.durationMs * 4 + 250))
  assert.ok(readContactWorld(runtime, compilation, 'foot.left').distanceTo(oldAnchor) > 1e-4)
  controller.dispose()
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
  const controller = createComplexBipedIkController(runtime, mixed)
  const sample = sampleBipedPetMotion(clip, 20)
  const frozenSample = structuredClone(sample)
  const frozenCompilation = structuredClone(mixed)
  controller.apply(sample, 1)
  assert.ok(controller.diagnostics().some(item => item.includes('FABRIK')))
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
  const clip = compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) })
  const broken = cloneCompilation(compilation)
  broken.limbIk[0]!.boneIds = ['missing.left', 'knee.left', 'calf.left']
  const controller = createComplexBipedIkController(runtime, broken)
  controller.apply(sampleBipedPetMotion(clip, 20), 1)
  controller.apply(sampleBipedPetMotion(clip, 40), 1)
  const missingDiagnostics = controller.diagnostics().filter(item => item.includes('leg.left'))
  assert.equal(missingDiagnostics.length, 1)
  assert.ok(controller.diagnostics().some(item => item.includes('leg.right') && item.includes('解析式')))
  assert.ok(finiteUnitQuaternion(runtime.bonesById.get('thigh.right')!.quaternion))
  controller.dispose()
  runtime.dispose()
}


// blocked 编译结果和缺失 contact 都只诊断一次并保持 FK 安全。
{
  const { compilation, runtime } = createRuntime()
  const blocked = cloneCompilation(compilation)
  blocked.status = 'blocked'
  const blockedController = createComplexBipedIkController(runtime, blocked)
  assert.equal(blockedController.diagnostics().filter(item => item.includes('阻塞')).length, 1)
  blockedController.apply(sampleBipedPetMotion(compileBipedPetMotion(walk, { boneIds: compilation.bones.map(item => item.id) }), 20), 1)
  blockedController.dispose()

  const missingContact = cloneCompilation(compilation)
  missingContact.contacts = missingContact.contacts.filter(item => item.id !== 'foot.left')
  const missingController = createComplexBipedIkController(runtime, missingContact)
  assert.equal(missingController.diagnostics().filter(item => item.includes('leg.left')).length, 1)
  missingController.dispose()
  runtime.dispose()
}

// 双支撑骨盆修正有界；单支撑和零权重不能写入骨盆 IK。
{
  const { compilation, runtime } = createRuntime()
  const clip = compileBipedPetMotion(wave, { boneIds: compilation.bones.map(item => item.id) })
  const controller = createComplexBipedIkController(runtime, compilation)
  const pelvis = runtime.bonesById.get('pelvis')!
  const bindY = pelvis.position.y
  controller.apply(sampleBipedPetMotion(clip, 10), 1)
  controller.apply(sampleBipedPetMotion(clip, 1600), 1)
  assert.ok(pelvis.position.y - bindY >= -.08 && pelvis.position.y - bindY <= .08)
  const beforeWeightZero = pelvis.position.clone()
  controller.apply(sampleBipedPetMotion(clip, 1800), 0)
  assert.deepEqual(pelvis.position.toArray(), beforeWeightZero.toArray())
  controller.reset()
  assert.equal(pelvis.position.y, bindY)
  const singleSupport = sampleWith(sampleBipedPetMotion(clip, 1800), {
    contactStates: [{ contactId: 'foot.left', phase: 'locked', weight: 1, confidence: 1 }],
    activeContacts: ['foot.left'],
  })
  controller.apply(singleSupport, 1)
  assert.equal(pelvis.position.y, bindY)
  controller.dispose()
  controller.dispose()
  assert.doesNotThrow(() => controller.apply(sampleBipedPetMotion(clip, 2000), 1))
  assert.doesNotThrow(() => controller.reset())
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
