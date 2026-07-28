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
} from '../packages/pet-core/src/index.ts'
import { BASIC_BIPED_STUDIO_MOTIONS } from '../apps/playground/app/domain/studio-basic-biped-motions.ts'
import { createComplexBipedPetObject } from '../apps/playground/app/three/create-complex-biped-pet-object.ts'
import { createComplexBipedMotionController } from '../apps/playground/app/three/apply-complex-biped-motion.ts'

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
assert.ok(wave)

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
