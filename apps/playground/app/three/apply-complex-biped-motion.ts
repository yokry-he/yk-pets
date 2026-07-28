/**
 * 文件职责 / File responsibility
 * 将框架无关的复杂双足动作采样相对绑定姿态写入现有 Three Bone，并提供确定性恢复与释放。
 */

import { Quaternion, Vector3 } from 'three'
import type { CompiledCharacterModel, SampledBipedPetMotion } from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'
import { createComplexBipedIkController, type ComplexBipedIkFrameReport } from './apply-complex-biped-ik'
import { createComplexBipedRootMotionController, type ComplexBipedRootMotionFrame } from './apply-complex-biped-root-motion'
import { createComplexBipedBalanceController } from './apply-complex-biped-balance'

export interface ComplexBipedMotionFrame extends ComplexBipedRootMotionFrame {
  ikReport: ComplexBipedIkFrameReport
  consumedFootResidual: readonly [number, number, number]
  nextFootResidual: readonly [number, number, number]
}

export interface ComplexBipedMotionController {
  apply(sample: SampledBipedPetMotion, weight?: number): ComplexBipedMotionFrame
  reset(): void
  dispose(): void
}

const clampWeight = (value: number | undefined) => Math.max(0, Math.min(1, typeof value === 'number' && Number.isFinite(value) ? value : 1))
const emptyIkReport = (): ComplexBipedIkFrameReport => Object.freeze({
  supportingContacts: 0,
  residualByLimb: Object.freeze({}),
  clampedLimbs: Object.freeze([]),
})

export function createComplexBipedMotionController(runtime: ComplexBipedPetObject, compilation?: CompiledCharacterModel): ComplexBipedMotionController {
  const bindRotations = new Map([...runtime.bonesById].map(([boneId, bone]) => [boneId, bone.quaternion.clone()]))
  const root = runtime.bonesById.get('root')
  if (!root) throw new Error('复杂双足萌宠动作控制器缺少 root 骨骼。')
  const bindRootPosition = root.position.clone()
  const identity = new Quaternion()
  const offset = new Quaternion()
  const blendedOffset = new Quaternion()
  const weightedRootOffset = new Vector3()
  let disposed = false
  const rootMotionController = createComplexBipedRootMotionController(runtime)
  const boundingBox = runtime.object.geometry.boundingBox
  const characterHeight = boundingBox && Number.isFinite(boundingBox.max.y - boundingBox.min.y)
    ? boundingBox.max.y - boundingBox.min.y
    : 0
  const balanceController = compilation
    ? createComplexBipedBalanceController(runtime, compilation, characterHeight)
    : undefined
  const ikController = compilation ? createComplexBipedIkController(runtime, compilation, {
    integratedSingleSupportPelvisY: true,
    characterHeight,
  }) : undefined
  let previousFootResidual: readonly [number, number, number] = Object.freeze([0, 0, 0])

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
      const consumedFootResidual = previousFootResidual
      const rootMotionFrame = rootMotionController.apply(sample, weight, consumedFootResidual)
      balanceController?.apply(sample, weight, rootMotionFrame.rootMotion)
      runtime.object.updateMatrixWorld(true)
      const ikReport = ikController?.apply(sample, weight) ?? emptyIkReport()
      previousFootResidual = nextFootResidual(rootMotionFrame, ikReport, characterHeight, sample)
      return Object.freeze({
        ...rootMotionFrame,
        ikReport,
        consumedFootResidual,
        nextFootResidual: previousFootResidual,
      })
    },
    reset() {
      assertUsable()
      restoreBindPose()
      previousFootResidual = Object.freeze([0, 0, 0])
      rootMotionController.reset()
      balanceController?.reset()
      ikController?.reset()
      runtime.object.updateMatrixWorld(true)
    },
    dispose() {
      if (disposed) return
      ikController?.dispose()
      balanceController?.dispose()
      rootMotionController.dispose()
      if (!runtime.isDisposed()) {
        restoreBindPose()
        runtime.object.updateMatrixWorld(true)
      }
      bindRotations.clear()
      disposed = true
    },
  }
}

function nextFootResidual(
  frame: ComplexBipedRootMotionFrame,
  report: ComplexBipedIkFrameReport | undefined,
  characterHeight: number,
  sample: SampledBipedPetMotion,
): readonly [number, number, number] {
  if (!report || report.supportingContacts <= 0
    || (frame.rootMotion.status !== 'solved' && frame.rootMotion.status !== 'clamped')
    || frame.rootMotion.phase === 'takeoff' || frame.rootMotion.phase === 'airborne'
    || sample.rootMotion.mode !== 'travel'
    || !sample.rootMotion.windows.some(window => (window.kind === 'travel' || window.kind === 'warp')
      && sample.resolvedTimeMs >= window.startMs && sample.resolvedTimeMs <= window.endMs)) return Object.freeze([0, 0, 0])
  const maximumResidual = Math.max(0, ...Object.values(report.residualByLimb).filter(Number.isFinite))
  const deltaX = frame.rootMotion.deltaLocal[0]
  const deltaZ = frame.rootMotion.deltaLocal[2]
  const length = Math.hypot(deltaX, deltaZ)
  if (!(maximumResidual > 0) || !(length > 1e-12) || !(characterHeight > 0)) return Object.freeze([0, 0, 0])
  // 把上一帧有限物理残差提升到求解器自带的速度预算，再由领域层统一钳制；避免把残差增益散落到 Three 位移写入。 / Raise the finite previous-frame residual toward the solver-owned speed budget, then let the domain clamp it centrally.
  const bounded = Math.min(maximumResidual * 8, characterHeight * .025)
  return Object.freeze([-deltaX / length * bounded, 0, -deltaZ / length * bounded])
}
