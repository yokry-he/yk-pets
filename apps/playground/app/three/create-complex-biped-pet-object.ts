/**
 * 文件职责 / File responsibility
 * 将框架无关的双足萌宠编译结果转换为可挂入既有 Tres 场景的 Three.js 蒙皮对象。
 * 此模块不创建 Canvas、不加载网络资源，也不负责动作求解。
 */
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  Vector3,
  type ColorRepresentation,
} from 'three'
import type { CompiledCharacterModel } from '@yk-pets/pet-core'

export interface ComplexBipedPetColors {
  baseColor: ColorRepresentation
  secondaryColor?: ColorRepresentation
  roughness?: number
  metalness?: number
}

export interface ComplexBipedPetSocket {
  id: string
  boneId: string
  bone: Bone
  localPosition: Vector3
  localRotation: Quaternion
  /** 跟随真实骨骼的声明式道具挂载节点，不包含任何 GPU 资源。 */
  mount: Group
}

export interface ComplexBipedPetObject {
  object: SkinnedMesh
  bonesById: ReadonlyMap<string, Bone>
  sockets: Readonly<Record<string, ComplexBipedPetSocket>>
  isDisposed(): boolean
  dispose(): void
}

function assertReadyCompilation(compiled: CompiledCharacterModel) {
  if (compiled.status !== 'ready') throw new Error('复杂双足萌宠编译结果已阻塞，不能创建 Three 运行时对象。')

  const { bones, mesh, sockets } = compiled
  if (bones.length === 0) throw new Error('复杂双足萌宠运行时缺少骨骼，无法创建蒙皮对象。')
  if (mesh.vertexCount <= 0 || mesh.positions.length !== mesh.vertexCount * 3) throw new Error('复杂双足萌宠运行时的顶点数据无效。')
  if (mesh.skinIndices.length !== mesh.vertexCount * 4 || mesh.skinWeights.length !== mesh.vertexCount * 4) throw new Error('复杂双足萌宠运行时的四槽蒙皮数据无效。')
  if (mesh.indices.length === 0 || mesh.indices.length % 3 !== 0 || mesh.indices.some(index => !Number.isInteger(index) || index < 0 || index >= mesh.vertexCount)) throw new Error('复杂双足萌宠运行时的三角形索引数据无效。')
  if (!mesh.positions.every(Number.isFinite)) throw new Error('复杂双足萌宠运行时包含非有限顶点数据。')
  for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
    const offset = vertex * 4
    const skinIndex = mesh.skinIndices.slice(offset, offset + 4)
    const skinWeight = mesh.skinWeights.slice(offset, offset + 4)
    if (skinIndex.some(index => !Number.isInteger(index) || index < 0 || index >= bones.length || index > 0xffff)) throw new Error('复杂双足萌宠运行时的骨骼索引越界。')
    if (skinWeight.some(weight => !Number.isFinite(weight) || weight < 0)) throw new Error('复杂双足萌宠运行时包含非有限蒙皮数据。')
    const weightTotal = skinWeight.reduce((total, weight) => total + weight, 0)
    if (Math.abs(weightTotal - 1) > 1e-6) throw new Error('复杂双足萌宠运行时每个顶点的四槽权重之和必须为 1。')
  }

  const ids = new Set<string>()
  let rootCount = 0
  for (const [index, bone] of bones.entries()) {
    if (!bone.id || ids.has(bone.id)) throw new Error('复杂双足萌宠运行时包含重复或空骨骼标识。')
    ids.add(bone.id)
    if (!bone.position.every(Number.isFinite)) throw new Error(`复杂双足萌宠骨骼 ${bone.id} 的局部位置无效。`)
    if (!Number.isInteger(bone.parentIndex) || bone.parentIndex < -1 || bone.parentIndex >= index) throw new Error(`复杂双足萌宠骨骼 ${bone.id} 的父级索引越界。`)
    if (bone.parentIndex === -1) rootCount++
  }
  if (rootCount !== 1) throw new Error('复杂双足萌宠运行时要求骨架恰好包含一个根骨骼。')

  const socketIds = new Set<string>()
  for (const socket of sockets) {
    if (!socket.id || socketIds.has(socket.id) || !ids.has(socket.boneId)) throw new Error('复杂双足萌宠运行时包含无效 Socket 引用。')
    const quaternionLength = Math.hypot(...socket.localRotation)
    if (!socket.localPosition.every(Number.isFinite) || !socket.localRotation.every(Number.isFinite) || quaternionLength <= 1e-8 || Math.abs(quaternionLength - 1) > 1e-4) throw new Error(`复杂双足萌宠 Socket ${socket.id} 的局部四元数无效。`)
    socketIds.add(socket.id)
  }
  for (const requiredSocketId of ['hand.left', 'hand.right', 'foot.left', 'foot.right', 'head', 'tail.base']) {
    if (!socketIds.has(requiredSocketId)) throw new Error(`复杂双足萌宠运行时缺少必需 Socket：${requiredSocketId}。`)
  }
}

/**
 * 从确定性编译结果创建运行时对象。次级颜色仅作为极弱自发光，保留材质层级，且不伪造顶点色数据。
 */
export function createComplexBipedPetObject(compiled: CompiledCharacterModel, colors: ComplexBipedPetColors): ComplexBipedPetObject {
  assertReadyCompilation(compiled)

  let geometry: BufferGeometry | undefined
  let material: MeshStandardMaterial | undefined
  let skeleton: Skeleton | undefined
  let socketMounts: Group[] = []
  let disposed = false

  const disposeResources = () => {
    if (disposed) return
    const failedResources: string[] = []
    const release = (name: string, disposer: () => void) => {
      try { disposer() }
      catch { failedResources.push(name) }
    }
    release('geometry', () => geometry?.dispose())
    release('material', () => material?.dispose())
    release('skeleton', () => skeleton?.dispose())
    release('socket-mounts', () => {
      for (const mount of socketMounts) mount.removeFromParent()
      socketMounts = []
    })
    // 所有资源均已尝试释放后才封存状态，失败也不能让下一次调用重复释放。 / Mark disposed only after every resource is attempted, even when one release fails.
    disposed = true
    if (failedResources.length) throw new Error(`复杂双足萌宠运行时资源释放失败：${failedResources.join('、')}。`)
  }

  try {
    const bones = compiled.bones.map(definition => {
      const bone = new Bone()
      bone.name = definition.id
      bone.position.set(...definition.position)
      return bone
    })
    const bonesById = new Map(compiled.bones.map((definition, index) => [definition.id, bones[index]!]))
    let root: Bone | undefined
    for (const [index, definition] of compiled.bones.entries()) {
      const bone = bones[index]!
      if (definition.parentIndex === -1) root = bone
      else bones[definition.parentIndex]!.add(bone)
    }
    if (!root) throw new Error('复杂双足萌宠运行时未找到根骨骼。')

    geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(compiled.mesh.positions, 3))
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(compiled.mesh.skinIndices, 4))
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(compiled.mesh.skinWeights, 4))
    const needsUint32Index = compiled.mesh.vertexCount > 0xffff || compiled.mesh.indices.some(index => index > 0xffff)
    geometry.setIndex(needsUint32Index
      ? new Uint32BufferAttribute(compiled.mesh.indices, 1)
      : new Uint16BufferAttribute(compiled.mesh.indices, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    skeleton = new Skeleton(bones)
    material = new MeshStandardMaterial({
      color: colors.baseColor,
      emissive: colors.secondaryColor ?? colors.baseColor,
      emissiveIntensity: .035,
      roughness: colors.roughness ?? .48,
      metalness: colors.metalness ?? 0,
    })
    const object = new SkinnedMesh(geometry, material)
    object.name = 'complex-biped-pet'
    object.add(root)
    object.updateMatrixWorld(true)
    object.bind(skeleton)

    const sockets = Object.fromEntries(compiled.sockets.map(socket => {
      const bone = bonesById.get(socket.boneId)!
      const localPosition = new Vector3(...socket.localPosition)
      const localRotation = new Quaternion(...socket.localRotation)
      const mount = new Group()
      mount.name = `socket:${socket.id}`
      mount.position.copy(localPosition)
      mount.quaternion.copy(localRotation)
      bone.add(mount)
      socketMounts.push(mount)
      return [socket.id, {
        id: socket.id,
        boneId: socket.boneId,
        bone,
        localPosition,
        localRotation,
        mount,
      }]
    }))
    object.updateMatrixWorld(true)

    return {
      object,
      bonesById,
      sockets,
      isDisposed: () => disposed,
      dispose: disposeResources,
    }
  } catch (error) {
    disposeResources()
    throw error
  }
}
