/**
 * 文件职责 / File responsibility
 * 在主手已经拥有道具挂载变换后，仅旋转副手手臂链以追随道具副握点；不写道具、主手或骨骼局部位置。
 */

import {
  solveAnalyticTwoBoneIk,
  solveConstrainedFabrik,
  type CompiledBipedPetMotionConstraint,
  type CompiledCharacterModel,
  type SampledBipedPetMotionAdaptation,
  type StudioPropRigPoint,
} from '@yk-pets/pet-core'
import { Quaternion, Vector3, type Bone, type Object3D } from 'three'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

const LEFT_ARM_CHAIN = ['upper-arm.left', 'elbow.left', 'forearm.left', 'wrist.left', 'hand.left'] as const
const MAX_ARM_CORRECTION_RADIANS = 2.05
const POSITION_CORRECTION_PASSES = 5
const ownerByRuntime = new WeakMap<ComplexBipedPetObject, symbol>()

export interface ComplexBipedWeaponPropHandle {
  readonly instanceId: string
  /** 已由主手 Socket 挂载的道具根对象；控制器只读取其世界矩阵。 */
  readonly object: Object3D
  readonly primaryGrip: StudioPropRigPoint
  readonly constraint: CompiledBipedPetMotionConstraint
}

export interface ComplexBipedWeaponConstraintFrame {
  readonly requestedTimeMs: number
  readonly weight: number
  readonly adaptation?: SampledBipedPetMotionAdaptation
  readonly propHandle?: ComplexBipedWeaponPropHandle
}

export interface ComplexBipedWeaponConstraintReport {
  readonly status: 'inactive' | 'solved' | 'degraded' | 'blocked'
  readonly constraintId?: string
  readonly requestedWeight: number
  readonly appliedWeight: number
  readonly residualWorld: number
  readonly targetAdjusted: boolean
  readonly solver: 'analytic-two-bone' | 'fabrik' | 'none'
}

export interface ComplexBipedWeaponConstraintController {
  apply(frame: ComplexBipedWeaponConstraintFrame): ComplexBipedWeaponConstraintReport
  reset(): void
  dispose(): void
}

const clamp01 = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(1, value))
  : 0

const thrownDetail = (error: unknown) => {
  try { return String(error instanceof Error ? error.message : error) }
  catch { return '未知错误' }
}

function frozenReport(
  status: ComplexBipedWeaponConstraintReport['status'],
  patch: Partial<Omit<ComplexBipedWeaponConstraintReport, 'status'>> = {},
): ComplexBipedWeaponConstraintReport {
  return Object.freeze({
    status,
    requestedWeight: 0,
    appliedWeight: 0,
    residualWorld: 0,
    targetAdjusted: false,
    solver: 'none',
    ...patch,
  })
}

function continuousChain(bones: readonly Bone[]): boolean {
  return bones.length === LEFT_ARM_CHAIN.length
    && bones.every((bone, index) => index === 0 || bone.parent === bones[index - 1])
}

/** 在 primary→secondary 线段上选取最接近副握点且位于臂展球内的目标。 */
function clampTargetAlongWeaponAxis(
  root: Vector3,
  primary: Vector3,
  secondary: Vector3,
  maximumReach: number,
  output: Vector3,
): boolean {
  output.copy(secondary)
  if (root.distanceTo(secondary) <= maximumReach) return false
  const axis = secondary.clone().sub(primary)
  const axisLengthSquared = axis.lengthSq()
  if (!(axisLengthSquared > 1e-12)) {
    const radial = secondary.clone().sub(root)
    if (radial.lengthSq() > 1e-12) output.copy(root).add(radial.setLength(maximumReach))
    return true
  }
  const offset = primary.clone().sub(root)
  const a = axisLengthSquared
  const b = 2 * offset.dot(axis)
  const c = offset.lengthSq() - maximumReach * maximumReach
  const discriminant = b * b - 4 * a * c
  if (Number.isFinite(discriminant) && discriminant >= 0) {
    const squareRoot = Math.sqrt(discriminant)
    const candidates = [(-b - squareRoot) / (2 * a), (-b + squareRoot) / (2 * a)]
      .filter(value => Number.isFinite(value) && value >= 0 && value <= 1)
      .sort((left, right) => right - left)
    if (candidates.length) {
      output.copy(primary).addScaledVector(axis, candidates[0]!)
      return true
    }
  }
  // 整条握持线段都不进入可达球时仍保持轴向语义，选择线上离肩根最近的点交给求解器报告真实残差。 / If the whole grip segment misses the reach sphere, preserve the weapon axis and solve from its closest point to the shoulder.
  const closest = Math.max(0, Math.min(1, -offset.dot(axis) / axisLengthSquared))
  output.copy(primary).addScaledVector(axis, closest)
  return true
}

export function createComplexBipedWeaponConstraintController(
  runtime: ComplexBipedPetObject,
  compilation: CompiledCharacterModel,
): ComplexBipedWeaponConstraintController {
  if (runtime.isDisposed()) throw new Error('复杂双足萌宠运行时已释放，不能创建持械约束控制器。')
  if (ownerByRuntime.has(runtime)) throw new Error('同一运行时只能创建一个持械约束控制器。')
  const owner = Symbol('complex-biped-weapon-constraint-owner')
  ownerByRuntime.set(runtime, owner)

  let bones: Bone[] = []
  let bindRotations: Quaternion[] = []
  try {
    bones = LEFT_ARM_CHAIN.flatMap((boneId) => {
      const bone = runtime.bonesById.get(boneId)
      return bone ? [bone] : []
    })
    bindRotations = bones.map(bone => bone.quaternion.clone())
  }
  catch (error) {
    if (ownerByRuntime.get(runtime) === owner) ownerByRuntime.delete(runtime)
    throw error
  }

  const analytic = compilation.status === 'ready' && continuousChain(bones)
  const solver = analytic
    ? 'analytic-two-bone' as const
    : compilation.status === 'ready' && bones.length >= 3
      ? 'fabrik' as const
      : 'none' as const
  const characterBox = runtime.object.geometry.boundingBox
  const characterHeight = characterBox && Number.isFinite(characterBox.max.y - characterBox.min.y)
    ? Math.max(Number.MIN_VALUE, characterBox.max.y - characterBox.min.y)
    : 1
  const rootWorld = new Vector3()
  const midWorld = new Vector3()
  const tipWorld = new Vector3()
  const childWorld = new Vector3()
  const primaryWorld = new Vector3()
  const secondaryWorld = new Vector3()
  const solvedTarget = new Vector3()
  const currentDirection = new Vector3()
  const desiredDirection = new Vector3()
  const propWorldRotation = new Quaternion()
  const targetWorldRotation = new Quaternion()
  const pointRotation = new Quaternion()
  const currentWorldRotation = new Quaternion()
  const currentWorldRotationInverse = new Quaternion()
  const deltaWorld = new Quaternion()
  const limitedWorldDelta = new Quaternion()
  const parentWorld = new Quaternion()
  const parentWorldInverse = new Quaternion()
  const localDelta = new Quaternion()
  const identity = new Quaternion()
  const fallbackRotations = bones.map(bone => bone.quaternion.clone())
  const remainingCorrection = new Map<Bone, number>()
  const fabrikPositions = bones.map(() => [0, 0, 0] as [number, number, number])
  const targetTuple: [number, number, number] = [0, 0, 0]
  const poleTuple: [number, number, number] = [0, 0, 1]
  let disposed = false

  const assertUsable = () => {
    if (disposed || ownerByRuntime.get(runtime) !== owner || runtime.isDisposed()) {
      throw new Error('复杂双足持械约束控制器已释放，不能继续写入。')
    }
  }
  const restoreCapturedPose = () => {
    for (const [index, bone] of bones.entries()) bone.quaternion.copy(bindRotations[index]!)
  }
  const readPointWorld = (object: Object3D, point: StudioPropRigPoint, output: Vector3) => output
    .set(...point.position)
    .applyMatrix4(object.matrixWorld)

  const applyWorldDirectionCorrection = (
    bone: Bone,
    currentEndWorld: Vector3,
    solvedStart: readonly number[],
    solvedEnd: readonly number[],
    mix: number,
  ) => {
    bone.getWorldPosition(rootWorld)
    currentDirection.subVectors(currentEndWorld, rootWorld)
    desiredDirection.set(
      solvedEnd[0]! - solvedStart[0]!,
      solvedEnd[1]! - solvedStart[1]!,
      solvedEnd[2]! - solvedStart[2]!,
    )
    if (currentDirection.lengthSq() <= 1e-12 || desiredDirection.lengthSq() <= 1e-12) return
    deltaWorld.setFromUnitVectors(currentDirection.normalize(), desiredDirection.normalize()).normalize()
    const angle = deltaWorld.angleTo(identity)
    const remaining = remainingCorrection.get(bone) ?? 0
    const appliedAngle = Math.min(angle * clamp01(mix), remaining)
    limitedWorldDelta.copy(identity).slerp(deltaWorld, angle > 1e-12 ? appliedAngle / angle : 0).normalize()
    bone.parent?.getWorldQuaternion(parentWorld) ?? parentWorld.identity()
    parentWorldInverse.copy(parentWorld).invert()
    localDelta.copy(parentWorldInverse).multiply(limitedWorldDelta).multiply(parentWorld).normalize()
    bone.quaternion.premultiply(localDelta).normalize()
    remainingCorrection.set(bone, Math.max(0, remaining - appliedAngle))
    runtime.object.updateMatrixWorld(true)
  }

  const applyWorldOrientationCorrection = (bone: Bone, target: Quaternion, mix: number) => {
    bone.getWorldQuaternion(currentWorldRotation)
    currentWorldRotationInverse.copy(currentWorldRotation).invert()
    deltaWorld.copy(target).multiply(currentWorldRotationInverse).normalize()
    const angle = deltaWorld.angleTo(identity)
    const remaining = remainingCorrection.get(bone) ?? 0
    const appliedAngle = Math.min(angle * clamp01(mix), remaining)
    limitedWorldDelta.copy(identity).slerp(deltaWorld, angle > 1e-12 ? appliedAngle / angle : 0).normalize()
    bone.parent?.getWorldQuaternion(parentWorld) ?? parentWorld.identity()
    parentWorldInverse.copy(parentWorld).invert()
    localDelta.copy(parentWorldInverse).multiply(limitedWorldDelta).multiply(parentWorld).normalize()
    bone.quaternion.premultiply(localDelta).normalize()
    remainingCorrection.set(bone, Math.max(0, remaining - appliedAngle))
    runtime.object.updateMatrixWorld(true)
  }

  const solveAnalytic = (target: Vector3, mix: number) => {
    const rootBone = bones[0]!
    const midBone = bones[1]!
    const tipBone = bones.at(-1)!
    rootBone.getWorldPosition(rootWorld)
    midBone.getWorldPosition(midWorld)
    tipBone.getWorldPosition(tipWorld)
    const result = solveAnalyticTwoBoneIk({
      root: rootWorld.toArray(),
      mid: midWorld.toArray(),
      tip: tipWorld.toArray(),
      target: target.toArray(),
      pole: poleTuple,
      maxStretchRatio: 1,
    })
    if (result.status === 'blocked') return result.status
    midBone.getWorldPosition(childWorld)
    applyWorldDirectionCorrection(rootBone, childWorld, result.positions[0]!, result.positions[1]!, mix)
    tipBone.getWorldPosition(childWorld)
    applyWorldDirectionCorrection(midBone, childWorld, result.positions[1]!, result.positions[2]!, mix)
    return result.status
  }

  const solveFabrik = (target: Vector3, mix: number) => {
    for (const [index, bone] of bones.entries()) {
      bone.getWorldPosition(rootWorld)
      fabrikPositions[index]![0] = rootWorld.x
      fabrikPositions[index]![1] = rootWorld.y
      fabrikPositions[index]![2] = rootWorld.z
    }
    target.toArray(targetTuple)
    const result = solveConstrainedFabrik({
      positions: fabrikPositions,
      target: targetTuple,
      pole: poleTuple,
      maxIterations: 8,
      tolerance: 1e-4,
      maxStretchRatio: 1,
    })
    if (result.status === 'blocked') return result.status
    for (let index = 0; index < bones.length - 1; index += 1) {
      bones[index + 1]!.getWorldPosition(childWorld)
      applyWorldDirectionCorrection(bones[index]!, childWorld, result.positions[index]!, result.positions[index + 1]!, mix)
    }
    return result.status
  }

  return {
    apply(frame) {
      assertUsable()
      const handle = frame.propHandle
      if (!handle || !frame.adaptation) return frozenReport('inactive')
      const constraint = handle.constraint
      const sampledWeight = frame.adaptation.constraintWeights[constraint.id]
      const requestedWeight = clamp01(frame.weight) * clamp01(sampledWeight)
      if (requestedWeight <= 0) return frozenReport('inactive', { constraintId: constraint.id })
      if (constraint.kind !== 'secondary-grip' || constraint.limbId !== 'arm.left'
        || constraint.propInstanceId !== handle.instanceId || solver === 'none') {
        return frozenReport('blocked', {
          constraintId: constraint.id,
          requestedWeight,
          residualWorld: Number.MAX_VALUE,
        })
      }

      for (const [index, bone] of bones.entries()) fallbackRotations[index]!.copy(bone.quaternion)
      try {
        handle.object.updateWorldMatrix(true, false)
        readPointWorld(handle.object, handle.primaryGrip, primaryWorld)
        readPointWorld(handle.object, constraint.targetPoint, secondaryWorld)
        bones[0]!.getWorldPosition(rootWorld)
        bones[1]!.getWorldPosition(midWorld)
        bones.at(-1)!.getWorldPosition(tipWorld)
        const physicalReach = rootWorld.distanceTo(midWorld) + midWorld.distanceTo(tipWorld)
        const declaredReach = Number.isFinite(constraint.armReachWorld) && constraint.armReachWorld > 0
          ? constraint.armReachWorld
          : physicalReach
        const maximumReach = Math.max(Number.MIN_VALUE, Math.min(physicalReach, declaredReach) * .999)
        const targetAdjusted = clampTargetAlongWeaponAxis(rootWorld, primaryWorld, secondaryWorld, maximumReach, solvedTarget)
        const actualDistance = rootWorld.distanceTo(secondaryWorld)
        const reachWeight = targetAdjusted && actualDistance > maximumReach
          ? Math.max(.1, Math.min(1, maximumReach / actualDistance))
          : 1
        const appliedWeight = requestedWeight * reachWeight
        for (const bone of bones) remainingCorrection.set(bone, MAX_ARM_CORRECTION_RADIANS * appliedWeight)

        let solveStatus: 'solved' | 'clamped' | 'blocked' = 'solved'
        for (let pass = 0; pass < POSITION_CORRECTION_PASSES; pass += 1) {
          const status = analytic ? solveAnalytic(solvedTarget, appliedWeight) : solveFabrik(solvedTarget, appliedWeight)
          if (status === 'blocked') {
            solveStatus = 'blocked'
            break
          }
          if (status === 'clamped') solveStatus = 'clamped'
        }
        if (solveStatus === 'blocked') {
          for (const [index, bone] of bones.entries()) bone.quaternion.copy(fallbackRotations[index]!)
          runtime.object.updateMatrixWorld(true)
          return frozenReport('blocked', {
            constraintId: constraint.id,
            requestedWeight,
            residualWorld: tipWorld.distanceTo(secondaryWorld),
            targetAdjusted,
            solver,
          })
        }

        handle.object.getWorldQuaternion(propWorldRotation)
        pointRotation.set(...constraint.targetPoint.rotation).normalize()
        targetWorldRotation.copy(propWorldRotation).multiply(pointRotation).normalize()
        // 腕部只承担少量预对齐，手掌承担剩余握持朝向；两者共享与位置求解相同的累计角预算。 / The wrist performs a small pre-alignment and the hand takes the remaining grip orientation within the shared angular budget.
        applyWorldOrientationCorrection(bones.at(-2)!, targetWorldRotation, appliedWeight * .08)
        applyWorldOrientationCorrection(bones.at(-1)!, targetWorldRotation, appliedWeight * .92)
        // 腕部朝向会轻微移动手掌原点，最后再用剩余预算收敛位置。 / Wrist orientation slightly moves the hand origin, so spend the remaining budget on one final position solve.
        if (analytic) solveAnalytic(solvedTarget, appliedWeight)
        else solveFabrik(solvedTarget, appliedWeight)
        runtime.object.updateMatrixWorld(true)
        bones.at(-1)!.getWorldPosition(tipWorld)
        const residualWorld = tipWorld.distanceTo(secondaryWorld)
        const degraded = targetAdjusted || solveStatus === 'clamped' || residualWorld > characterHeight * .02
        return frozenReport(degraded ? 'degraded' : 'solved', {
          constraintId: constraint.id,
          requestedWeight,
          appliedWeight,
          residualWorld,
          targetAdjusted,
          solver,
        })
      }
      catch (error) {
        const cleanupFailures: string[] = []
        try { for (const [index, bone] of bones.entries()) bone.quaternion.copy(fallbackRotations[index]!) }
        catch (cleanupError) { cleanupFailures.push(`姿态回滚：${thrownDetail(cleanupError)}`) }
        try { runtime.object.updateMatrixWorld(true) }
        catch (cleanupError) { cleanupFailures.push(`矩阵回滚：${thrownDetail(cleanupError)}`) }
        if (cleanupFailures.length) {
          throw new Error(`复杂双足持械约束执行失败：${thrownDetail(error)}；${cleanupFailures.join('；')}`)
        }
        throw error
      }
    },
    reset() {
      assertUsable()
      restoreCapturedPose()
      runtime.object.updateMatrixWorld(true)
    },
    dispose() {
      if (disposed) return
      const failures: string[] = []
      try {
        let runtimeDisposed = true
        try { runtimeDisposed = runtime.isDisposed() }
        catch (error) { failures.push(`运行时状态检查：${thrownDetail(error)}`) }
        if (!runtimeDisposed) {
          try { restoreCapturedPose() }
          catch (error) { failures.push(`副手姿态恢复：${thrownDetail(error)}`) }
          try { runtime.object.updateMatrixWorld(true) }
          catch (error) { failures.push(`世界矩阵更新：${thrownDetail(error)}`) }
        }
      }
      finally {
        if (ownerByRuntime.get(runtime) === owner) ownerByRuntime.delete(runtime)
        remainingCorrection.clear()
        bindRotations = []
        bones = []
        disposed = true
      }
      if (failures.length) throw new Error(`复杂双足持械约束控制器释放失败：${failures.join('；')}`)
    },
  }
}
