/**
 * 文件职责 / File responsibility
 * 将框架无关的复杂双足动作采样相对绑定姿态写入现有 Three Bone，并提供确定性恢复与释放。
 */

import { Quaternion, Vector3 } from 'three'
import type { CompiledCharacterModel, SampledBipedPetMotion, SampledBipedPetRootMotion } from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'
import {
  createComplexBipedIkController,
  type ComplexBipedIkFrameContext,
  type ComplexBipedIkFrameReport,
} from './apply-complex-biped-ik'
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
const ZERO_FOOT_RESIDUAL = Object.freeze([0, 0, 0]) as readonly [number, number, number]
const emptyIkReport = (): ComplexBipedIkFrameReport => Object.freeze({
  supportingContacts: 0,
  residualByLimb: Object.freeze({}),
  clampedLimbs: Object.freeze([]),
})
const IK_CONTEXT_BY_ROOT_MOTION_PHASE = Object.freeze({
  grounded: Object.freeze({ rootMotionPhase: 'grounded' }),
  takeoff: Object.freeze({ rootMotionPhase: 'takeoff' }),
  airborne: Object.freeze({ rootMotionPhase: 'airborne' }),
  landing: Object.freeze({ rootMotionPhase: 'landing' }),
}) satisfies Readonly<Record<SampledBipedPetRootMotion['phase'], ComplexBipedIkFrameContext>>

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
  const boundingBox = runtime.object.geometry.boundingBox
  const characterHeight = boundingBox && Number.isFinite(boundingBox.max.y - boundingBox.min.y)
    ? boundingBox.max.y - boundingBox.min.y
    : 0
  const rootMotionController = createComplexBipedRootMotionController(runtime)
  let balanceController: ReturnType<typeof createComplexBipedBalanceController> | undefined
  let ikController: ReturnType<typeof createComplexBipedIkController> | undefined
  try {
    balanceController = compilation
      ? createComplexBipedBalanceController(runtime, compilation, characterHeight)
      : undefined
    ikController = compilation ? createComplexBipedIkController(runtime, compilation, {
      integratedSingleSupportPelvisY: true,
      characterHeight,
    }) : undefined
  }
  catch (error) {
    ikController?.dispose()
    balanceController?.dispose()
    rootMotionController.dispose()
    throw error
  }
  let previousFootResidual: readonly [number, number, number] = ZERO_FOOT_RESIDUAL
  let lastAppliedClipHash: string | undefined
  let lastAppliedRequestedTimeMs: number | undefined
  let lastAppliedWeight: number | undefined
  let lastIkReport = emptyIkReport()

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
      const weight = clampWeight(weightInput)
      const freezesDisplayPose = sample.clipHash === lastAppliedClipHash
        && sample.requestedTimeMs === lastAppliedRequestedTimeMs
        && weight === lastAppliedWeight
      if (freezesDisplayPose) {
        // 重复帧是完整显示姿态暂停：只让 Root 层维持时间令牌/落地授权/VFX 去重，不能重跑 FK、Balance、IK 或推进残差反馈。
        const rootMotionFrame = rootMotionController.apply(sample, weight, previousFootResidual)
        return Object.freeze({
          ...rootMotionFrame,
          ikReport: lastIkReport,
          consumedFootResidual: ZERO_FOOT_RESIDUAL,
          nextFootResidual: previousFootResidual,
        })
      }
      restoreBindPose()
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
      const ikReport = ikController?.apply(
        sample,
        weight,
        IK_CONTEXT_BY_ROOT_MOTION_PHASE[rootMotionFrame.rootMotion.phase],
      ) ?? emptyIkReport()
      previousFootResidual = nextFootResidual(rootMotionFrame, ikReport, characterHeight, sample)
      lastAppliedClipHash = sample.clipHash
      lastAppliedRequestedTimeMs = sample.requestedTimeMs
      lastAppliedWeight = weight
      lastIkReport = ikReport
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
      previousFootResidual = ZERO_FOOT_RESIDUAL
      lastAppliedClipHash = undefined
      lastAppliedRequestedTimeMs = undefined
      lastAppliedWeight = undefined
      lastIkReport = emptyIkReport()
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
      lastAppliedClipHash = undefined
      lastAppliedRequestedTimeMs = undefined
      lastAppliedWeight = undefined
      lastIkReport = emptyIkReport()
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
    || frame.rootMotion.phase === 'takeoff' || frame.rootMotion.phase === 'airborne' || frame.rootMotion.phase === 'landing'
    || sample.rootMotion.mode !== 'travel'
    || !sample.rootMotion.windows.some(window => (window.kind === 'travel' || window.kind === 'warp')
      && sample.resolvedTimeMs >= window.startMs && sample.resolvedTimeMs <= window.endMs)) return Object.freeze([0, 0, 0])
  const maximumHorizontalResidual = Math.max(0, ...Object.values(report.residualByLimb).filter(Number.isFinite))
  const deltaX = frame.rootMotion.deltaLocal[0]
  const deltaZ = frame.rootMotion.deltaLocal[2]
  const length = Math.hypot(deltaX, deltaZ)
  if (!(maximumHorizontalResidual > 0) || !(length > 1e-12) || !(characterHeight > 0)) return Object.freeze([0, 0, 0])
  // 只把上一帧真实水平残差幅值提升到求解器自带的速度预算，再由领域层统一钳制；Y 不得进入这个反馈链。 / Raise only the true horizontal residual magnitude toward the solver-owned speed budget; Y must never enter this feedback path.
  const bounded = Math.min(maximumHorizontalResidual * 8, characterHeight * .025)
  return Object.freeze([-deltaX / length * bounded, 0, -deltaZ / length * bounded])
}
