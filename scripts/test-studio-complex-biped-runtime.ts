/** 验证 Three 运行时直接消费编译结果，不依赖浏览器、网络或 GLB。 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Bone, SkinnedMesh } from '../apps/playground/node_modules/three/build/three.module.js'
import { compileBipedPetCharacter, createBipedPetModelRecipe } from '../packages/pet-core/src/index.ts'

const runtimePath = resolve(import.meta.dirname, '../apps/playground/app/three/create-complex-biped-pet-object.ts')
assert.ok(existsSync(runtimePath), '复杂双足萌宠 Three 运行时模块必须存在。')

const { createComplexBipedPetObject } = await import('../apps/playground/app/three/create-complex-biped-pet-object.ts')
const compiled = compileBipedPetCharacter(createBipedPetModelRecipe(1_000))
assert.equal(compiled.status, 'ready')

const runtime = createComplexBipedPetObject(compiled, {
  baseColor: '#112233',
  secondaryColor: '#445566',
})

assert.ok(runtime.object instanceof SkinnedMesh)
assert.equal(runtime.object.geometry.getAttribute('position').itemSize, 3)
assert.ok(runtime.object.geometry.getAttribute('position').array instanceof Float32Array)
assert.ok(runtime.object.geometry.getAttribute('skinIndex').array instanceof Uint16Array)
assert.ok(runtime.object.geometry.getAttribute('skinWeight').array instanceof Float32Array)
assert.equal(runtime.object.geometry.getIndex()?.count, compiled.mesh.indices.length)
assert.equal(runtime.object.skeleton.bones.length, compiled.bones.length)
assert.ok(runtime.bonesById.get('root') instanceof Bone)
assert.equal(runtime.bonesById.get('pelvis')?.parent, runtime.bonesById.get('root'))
assert.deepEqual(runtime.object.material.color.getHexString(), '112233')
assert.ok(runtime.object.geometry.boundingBox)
assert.ok(runtime.object.geometry.boundingSphere)
for (const socket of Object.values(runtime.sockets)) assert.equal(socket.bone, runtime.bonesById.get(socket.boneId))

let geometryDisposals = 0
let materialDisposals = 0
let skeletonDisposals = 0
const geometryDispose = runtime.object.geometry.dispose.bind(runtime.object.geometry)
const materialDispose = runtime.object.material.dispose.bind(runtime.object.material)
const skeletonDispose = runtime.object.skeleton.dispose.bind(runtime.object.skeleton)
runtime.object.geometry.dispose = () => { geometryDisposals++; geometryDispose() }
runtime.object.material.dispose = () => { materialDisposals++; materialDispose() }
runtime.object.skeleton.dispose = () => { skeletonDisposals++; skeletonDispose() }
runtime.dispose()
runtime.dispose()
assert.equal(geometryDisposals, 1)
assert.equal(materialDisposals, 1)
assert.equal(skeletonDisposals, 1)

assert.throws(
  () => createComplexBipedPetObject({ ...compiled, status: 'blocked' }, { baseColor: '#000000' }),
  /已阻塞|blocked/,
)
assert.throws(
  () => createComplexBipedPetObject({ ...compiled, bones: [] }, { baseColor: '#000000' }),
  /缺少骨骼/,
)
assert.throws(
  () => createComplexBipedPetObject({
    ...compiled,
    bones: compiled.bones.map((bone, index) => index === 1 ? { ...bone, parentIndex: -1 } : bone),
  }, { baseColor: '#000000' }),
  /恰好包含一个根骨骼/,
)
assert.throws(
  () => createComplexBipedPetObject({
    ...compiled,
    bones: compiled.bones.map((bone, index) => index === 1 ? { ...bone, parentIndex: compiled.bones.length } : bone),
  }, { baseColor: '#000000' }),
  /父级索引越界/,
)
assert.throws(
  () => createComplexBipedPetObject({
    ...compiled,
    mesh: { ...compiled.mesh, skinWeights: compiled.mesh.skinWeights.map((weight, index) => index === 0 ? 2 : weight) },
  }, { baseColor: '#000000' }),
  /权重之和/,
)
assert.throws(
  () => createComplexBipedPetObject({
    ...compiled,
    mesh: { ...compiled.mesh, indices: compiled.mesh.indices.slice(0, -1) },
  }, { baseColor: '#000000' }),
  /三角形/,
)
assert.throws(
  () => createComplexBipedPetObject({
    ...compiled,
    sockets: compiled.sockets.map((socket, index) => index === 0 ? { ...socket, localRotation: [0, 0, 0, 0] } : socket),
  }, { baseColor: '#000000' }),
  /四元数/,
)

const failureRuntime = createComplexBipedPetObject(compiled, { baseColor: '#000000' })
let failedGeometryDisposals = 0
let failedMaterialDisposals = 0
let failedSkeletonDisposals = 0
failureRuntime.object.geometry.dispose = () => { failedGeometryDisposals++; throw new Error('模拟 geometry dispose 失败') }
failureRuntime.object.material.dispose = () => { failedMaterialDisposals++ }
failureRuntime.object.skeleton.dispose = () => { failedSkeletonDisposals++ }
assert.throws(() => failureRuntime.dispose(), /资源释放/)
assert.equal(failedGeometryDisposals, 1)
assert.equal(failedMaterialDisposals, 1)
assert.equal(failedSkeletonDisposals, 1)
assert.doesNotThrow(() => failureRuntime.dispose())
assert.equal(failedGeometryDisposals, 1)
assert.equal(failedMaterialDisposals, 1)
assert.equal(failedSkeletonDisposals, 1)

console.log('复杂双足萌宠 Three 运行时测试通过。')
