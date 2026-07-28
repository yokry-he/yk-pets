/**
 * 文件职责 / File responsibility
 * 消费框架无关 Root Motion 采样，只把安全 applied 绝对状态写入现有 Three 角色容器。
 */

import { Quaternion, Vector3 } from 'three'
import {
  deriveBipedPetMotionVfxSignals,
  sampleBipedPetRootMotion,
  type BipedPetLandingAuthorization,
  type BipedPetMotionVfxSignal,
  type SampledBipedPetMotion,
  type SampledBipedPetRootMotion,
} from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

export interface ComplexBipedRootMotionFrame {
  rootMotion: SampledBipedPetRootMotion
  vfxSignals: readonly BipedPetMotionVfxSignal[]
}

export interface ComplexBipedRootMotionController {
  apply(sample: SampledBipedPetMotion, weight: number, footResidual?: readonly [number, number, number]): ComplexBipedRootMotionFrame
  reset(): void
  diagnostics(): readonly string[]
  dispose(): void
}

type RootVector = readonly [number, number, number]
const MAX_DIAGNOSTICS = 64
const ZERO_RESIDUAL = Object.freeze([0, 0, 0]) as RootVector
const WORLD_Y_AXIS = new Vector3(0, 1, 0)
const clamp01 = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

function characterHeight(runtime: ComplexBipedPetObject): number | undefined {
  const box = runtime.object.geometry.boundingBox
  if (!box) return undefined
  const values = [...box.min.toArray(), ...box.max.toArray()]
  const height = box.max.y - box.min.y
  return values.every(Number.isFinite) && Number.isFinite(height) && height > 0 ? height : undefined
}

function horizontalResidual(input: readonly [number, number, number] | undefined): RootVector {
  if (!input || !Number.isFinite(input[0]) || !Number.isFinite(input[2])) return ZERO_RESIDUAL
  return Object.freeze([input[0], 0, input[2]])
}

function blockedRootMotion(sample: SampledBipedPetMotion): SampledBipedPetRootMotion {
  const zero = Object.freeze([0, 0, 0]) as RootVector
  return Object.freeze({
    status: 'blocked',
    requestedTimeMs: sample.requestedTimeMs,
    resolvedTimeMs: sample.resolvedTimeMs,
    iteration: sample.iteration,
    cumulativeLocal: zero,
    cumulativeWorld: zero,
    appliedLocal: zero,
    appliedWorld: zero,
    deltaLocal: zero,
    deltaWorld: zero,
    cumulativeTurnRadians: 0,
    appliedTurnRadians: 0,
    deltaTurnRadians: 0,
    linearVelocity: zero,
    angularVelocity: 0,
    phase: 'grounded',
    motionIntensity: 0,
    landingImpulse: 0,
    brakeIntensity: 0,
  })
}

export function createComplexBipedRootMotionController(runtime: ComplexBipedPetObject): ComplexBipedRootMotionController {
  const bindPosition = runtime.object.position.clone()
  const bindQuaternion = runtime.object.quaternion.clone()
  const yawOffset = new Quaternion()
  const nextPosition = new Vector3()
  const appliedOffset = new Vector3()
  const forward = new Vector3(0, 0, 1).applyQuaternion(bindQuaternion)
  const facingRadians = Math.atan2(forward.x, forward.z)
  const messages: string[] = []
  const messageIds = new Set<string>()
  let clipHash: string | undefined
  let previousRequestedTimeMs: number | undefined
  let previousAppliedWorld: RootVector | undefined
  let previousAppliedTurnRadians: number | undefined
  let previousLandingAuthorization: BipedPetLandingAuthorization | undefined
  let disposed = false

  const report = (id: string, message: string) => {
    if (messageIds.has(id)) return
    if (messages.length >= MAX_DIAGNOSTICS) return
    messageIds.add(id)
    messages.push(message)
  }
  const assertUsable = () => {
    if (disposed || runtime.isDisposed()) throw new Error('复杂双足萌宠 Root Motion 控制器已释放，不能继续写入角色容器。')
  }
  const clearOwnership = () => {
    clipHash = undefined
    previousRequestedTimeMs = undefined
    previousAppliedWorld = undefined
    previousAppliedTurnRadians = undefined
    previousLandingAuthorization = undefined
  }
  const restoreBindTransform = () => {
    runtime.object.position.copy(bindPosition)
    runtime.object.quaternion.copy(bindQuaternion)
  }
  const writeAppliedTransform = (rootMotion: SampledBipedPetRootMotion) => {
    appliedOffset.set(...rootMotion.appliedWorld)
    nextPosition.copy(bindPosition).add(appliedOffset)
    runtime.object.position.copy(nextPosition)
    yawOffset.setFromAxisAngle(WORLD_Y_AXIS, rootMotion.appliedTurnRadians)
    // appliedTurn 是固定世界 Y 轴增量；含 pitch/roll 的绑定姿态不能把它误解为对象局部轴。 / Applied turn is a fixed world-Y delta, not the local axis of a pitched or rolled bind pose.
    runtime.object.quaternion.copy(yawOffset).multiply(bindQuaternion).normalize()
  }

  return {
    apply(sample, weightInput, footResidualInput = ZERO_RESIDUAL) {
      assertUsable()
      const weight = clamp01(weightInput)
      const stopping = weight <= 0
      const discontinuous = clipHash !== undefined
        && (sample.clipHash !== clipHash || (previousRequestedTimeMs !== undefined && sample.requestedTimeMs < previousRequestedTimeMs))
      if (stopping || discontinuous) clearOwnership()

      const height = characterHeight(runtime)
      if (height === undefined) {
        report('invalid-character-height', '复杂双足萌宠几何包围盒无效，Root Motion 已阻塞但 FK/IK 可继续执行。')
        clearOwnership()
        if (stopping) restoreBindTransform()
        return Object.freeze({ rootMotion: blockedRootMotion(sample), vfxSignals: Object.freeze([]) })
      }

      const inputPreviousRequestedTimeMs = previousRequestedTimeMs
      const rootMotion = sampleBipedPetRootMotion({
        definition: sample.rootMotion,
        requestedTimeMs: sample.requestedTimeMs,
        ...(inputPreviousRequestedTimeMs === undefined ? {} : { previousRequestedTimeMs: inputPreviousRequestedTimeMs }),
        durationMs: sample.durationMs,
        loopMode: sample.loopMode,
        characterHeight: height,
        facingRadians,
        actionWeight: weight,
        ...(previousAppliedWorld === undefined ? {} : {
          previousAppliedWorld,
          previousAppliedTurnRadians: previousAppliedTurnRadians!,
        }),
        ...(previousLandingAuthorization === undefined ? {} : { previousLandingAuthorization }),
        footResidual: horizontalResidual(footResidualInput),
      })

      const vfxSignals = inputPreviousRequestedTimeMs === undefined
        ? Object.freeze([]) as readonly BipedPetMotionVfxSignal[]
        : deriveBipedPetMotionVfxSignals({
            clipHash: sample.clipHash,
            previousRequestedTimeMs: inputPreviousRequestedTimeMs,
            requestedTimeMs: sample.requestedTimeMs,
            tags: sample.rootMotion.vfxTags,
            rootMotion,
          })

      if (rootMotion.status === 'blocked') {
        report(`blocked:${sample.clipHash}`, '本帧 Root Motion 输入无效，已保留角色容器并继续 FK/IK。')
        clearOwnership()
        return Object.freeze({ rootMotion, vfxSignals: Object.freeze([]) })
      }

      writeAppliedTransform(rootMotion)
      if (stopping) {
        restoreBindTransform()
        clearOwnership()
      }
      else {
        clipHash = sample.clipHash
        previousRequestedTimeMs = sample.requestedTimeMs
        previousAppliedWorld = rootMotion.appliedWorld
        previousAppliedTurnRadians = rootMotion.appliedTurnRadians
        // 授权只保存采样器返回的冻结值；Three 层不补签、不吸附时间，也不改写强度。 / Store only the sampler-issued frozen authorization; Three never reissues, snaps, or rewrites it.
        previousLandingAuthorization = rootMotion.landingAuthorization
      }
      return Object.freeze({ rootMotion, vfxSignals: stopping ? Object.freeze([]) : vfxSignals })
    },
    reset() {
      assertUsable()
      clearOwnership()
      restoreBindTransform()
    },
    diagnostics: () => Object.freeze([...messages]),
    dispose() {
      if (disposed) return
      clearOwnership()
      if (!runtime.isDisposed()) restoreBindTransform()
      disposed = true
    },
  }
}
