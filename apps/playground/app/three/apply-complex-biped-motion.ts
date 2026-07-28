/**
 * 文件职责 / File responsibility
 * 将框架无关的复杂双足动作采样相对绑定姿态写入现有 Three Bone，并提供确定性恢复与释放。
 */

import { Quaternion, Vector3 } from 'three'
import type { SampledBipedPetMotion } from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

export interface ComplexBipedMotionController {
  apply(sample: SampledBipedPetMotion, weight?: number): void
  reset(): void
  dispose(): void
}

const clampWeight = (value: number | undefined) => Math.max(0, Math.min(1, typeof value === 'number' && Number.isFinite(value) ? value : 1))

export function createComplexBipedMotionController(runtime: ComplexBipedPetObject): ComplexBipedMotionController {
  const bindRotations = new Map([...runtime.bonesById].map(([boneId, bone]) => [boneId, bone.quaternion.clone()]))
  const root = runtime.bonesById.get('root')
  if (!root) throw new Error('复杂双足萌宠动作控制器缺少 root 骨骼。')
  const bindRootPosition = root.position.clone()
  const identity = new Quaternion()
  const offset = new Quaternion()
  const blendedOffset = new Quaternion()
  const weightedRootOffset = new Vector3()
  let disposed = false

  const assertUsable = () => {
    if (disposed || runtime.isDisposed()) throw new Error('复杂双足萌宠动作控制器已释放，不能继续写入骨骼。')
  }
  const restoreBindPose = () => {
    for (const [boneId, bindRotation] of bindRotations) runtime.bonesById.get(boneId)?.quaternion.copy(bindRotation)
    root.position.copy(bindRootPosition)
  }

  return {
    apply(sample, weightInput = 1) {
      assertUsable()
      restoreBindPose()
      const weight = clampWeight(weightInput)
      for (const pose of sample.bones) {
        const bone = runtime.bonesById.get(pose.boneId)
        const bindRotation = bindRotations.get(pose.boneId)
        if (!bone || !bindRotation) continue
        offset.set(...pose.rotation).normalize()
        blendedOffset.copy(identity).slerp(offset, weight)
        bone.quaternion.copy(bindRotation).multiply(blendedOffset).normalize()
      }
      weightedRootOffset.set(...sample.rootPosition).multiplyScalar(weight)
      root.position.copy(bindRootPosition).add(weightedRootOffset)
      runtime.object.updateMatrixWorld(true)
    },
    reset() {
      assertUsable()
      restoreBindPose()
      runtime.object.updateMatrixWorld(true)
    },
    dispose() {
      if (disposed) return
      if (!runtime.isDisposed()) {
        restoreBindPose()
        runtime.object.updateMatrixWorld(true)
      }
      bindRotations.clear()
      disposed = true
    },
  }
}
