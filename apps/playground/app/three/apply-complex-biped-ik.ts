/**
 * 文件职责 / File responsibility
 * 在既有 FK 姿态之后执行复杂双足萌宠的足底锁定与混合 IK；不创建渲染循环、Canvas 或 Skeleton。
 */

import { Quaternion, Vector3, type Bone } from 'three'
import {
  solveAnalyticTwoBoneIk,
  solveConstrainedFabrik,
  type CompiledCharacterContact,
  type CompiledCharacterLimbIk,
  type CompiledCharacterModel,
  type SampledBipedPetContactState,
  type SampledBipedPetMotion,
  type SampledBipedPetRootMotion,
} from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

export interface ComplexBipedIkController {
  apply(sample: SampledBipedPetMotion, weight: number, context?: ComplexBipedIkFrameContext): ComplexBipedIkFrameReport
  reset(): void
  diagnostics(): readonly string[]
  dispose(): void
}

export interface ComplexBipedIkFrameContext {
  /** 完整动作链本帧实际 applied Root Motion 相位；standalone 未传入时继续只按接触权重求解。 */
  readonly rootMotionPhase: SampledBipedPetRootMotion['phase']
}

export interface ComplexBipedIkControllerOptions {
  /** 仅由完整 Root Motion 动作链开启；直接 IK 调用保持历史单支撑不平移骨盆 Y 的契约。 */
  integratedSingleSupportPelvisY?: boolean
  characterHeight?: number
}

export interface ComplexBipedIkFrameReport {
  supportingContacts: number
  /** 每肢锚点到当前接触点在世界 X/Z 水平面的真实残差幅值；不含 Y，也不编码方向。 */
  residualByLimb: Readonly<Record<string, number>>
  clampedLimbs: readonly string[]
}

interface LimbRuntime {
  definition: CompiledCharacterLimbIk
  bones: Bone[]
  contact: CompiledCharacterContact
  contactBone: Bone
  fallbackBones: Bone[]
  fallbackRotations: Quaternion[]
  solver: 'analytic-two-bone' | 'fabrik'
  anchor: Vector3
  anchorOffset: Vector3
  anchored: boolean
  capturedThisFrame: boolean
  positions: MutableRigVector[]
  targetInput: MutableRigVector
  poleInput: MutableRigVector
  terminalStart: MutableRigVector
  terminalEnd: MutableRigVector
  contactLocalRotation: Quaternion
  contactLocalRotationInverse: Quaternion
  anchorContactWorldRotation: Quaternion
  targetContactBoneWorldRotation: Quaternion
  remainingCorrections: Map<Bone, number>
}

type MutableRigVector = [number, number, number]
const STANDALONE_IK_CORRECTION_PASS_COUNT = 3
const INTEGRATED_IK_CORRECTION_PASS_COUNT = 5
const clamp01 = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const isEffectiveSupport = (
  state: SampledBipedPetContactState | undefined,
): state is SampledBipedPetContactState => Boolean(
  state
  && Number.isFinite(state.weight) && state.weight > 0
  && Number.isFinite(state.confidence) && state.confidence > 0,
)
const emptyFrameReport = (): ComplexBipedIkFrameReport => Object.freeze({
  supportingContacts: 0,
  residualByLimb: Object.freeze({}),
  clampedLimbs: Object.freeze([]),
})

/**
 * 标准双足链允许把首段与其余后代聚合为两段解析链；更长的非标准链自动转入 FABRIK。
 * 当前 Profile 的 thigh→knee→calf→ankle 因此稳定命中解析路径。
 */
const isDescendantOf = (bone: Bone, ancestor: Bone) => {
  let current: Bone | null = bone
  while (current) {
    if (current === ancestor) return true
    current = current.parent?.type === 'Bone' ? current.parent as Bone : null
  }
  return false
}

/** 解析式聚合只接受确定的三点链或当前 Profile 的四骨两段映射，不能只凭数组长度猜测。 */
const canUseAnalyticMapping = (bones: readonly Bone[], contactBone: Bone) => {
  if (bones.length !== 3 && bones.length !== 4) return false
  if (!bones.every((bone, index) => index === 0 || bone.parent === bones[index - 1])) return false
  if (!isDescendantOf(contactBone, bones.at(-1)!)) return false
  const start = new Vector3()
  const end = new Vector3()
  const segmentPairs = bones.length === 3
    ? [[0, 1], [1, 2]] as const
    : [[0, 1], [1, 3]] as const
  return segmentPairs.every(([from, to]) => {
    bones[from]!.getWorldPosition(start)
    bones[to]!.getWorldPosition(end)
    return start.toArray().every(Number.isFinite) && end.toArray().every(Number.isFinite) && start.distanceToSquared(end) > 1e-12
  })
}

export function createComplexBipedIkController(
  runtime: ComplexBipedPetObject,
  compilation: CompiledCharacterModel,
  options: ComplexBipedIkControllerOptions = {},
): ComplexBipedIkController {
  const MAX_DIAGNOSTICS = 64
  const messages: string[] = []
  const messageIds = new Set<string>()
  const messageIdQueue: string[] = []
  const report = (id: string, message: string) => {
    if (messageIds.has(id)) return
    if (messageIdQueue.length >= MAX_DIAGNOSTICS) {
      const oldestId = messageIdQueue.shift()!
      messageIds.delete(oldestId)
      messages.shift()
    }
    messageIds.add(id)
    messageIdQueue.push(id)
    messages.push(message)
  }

  const pelvis = runtime.bonesById.get('pelvis')
  const pelvisBindPosition = pelvis?.position.clone()
  const geometryBox = runtime.object.geometry.boundingBox
  const geometryHeight = geometryBox ? geometryBox.max.y - geometryBox.min.y : Number.NaN
  const configuredHeight = typeof options.characterHeight === 'number' && Number.isFinite(options.characterHeight)
    ? options.characterHeight
    : geometryHeight
  const singleSupportPelvisYBudget = Number.isFinite(configuredHeight) && configuredHeight > 0
    ? Math.min(.08, configuredHeight * .025)
    : 0
  const integratedSingleSupportPelvisY = options.integratedSingleSupportPelvisY === true
  // 只给完整 Root Motion 链增加交替收敛轮数；每根骨骼的累计角预算仍由 remainingCorrections 单独封顶。
  const correctionPassCount = integratedSingleSupportPelvisY
    ? INTEGRATED_IK_CORRECTION_PASS_COUNT
    : STANDALONE_IK_CORRECTION_PASS_COUNT
  const limbs: LimbRuntime[] = []
  const contactById = new Map(compilation.contacts.map(contact => [contact.id, contact]))

  if (compilation.status !== 'ready') report('blocked-compilation', '角色编译结果已阻塞，运行时 IK 已回退为 FK。')
  else for (const definition of compilation.limbIk) {
    const bones = definition.boneIds.map(id => runtime.bonesById.get(id))
    const contact = contactById.get(definition.contactId)
    const contactBone = contact && runtime.bonesById.get(contact.boneId)
    const continuous = bones.every(Boolean) && bones.every((bone, index) => index === 0 || bone!.parent === bones[index - 1])
    const contactFollowsTip = Boolean(contactBone && bones.at(-1) && isDescendantOf(contactBone, bones.at(-1)!))
    if (!contact || !contactBone || bones.length < 3 || !continuous || !contactFollowsTip) {
      report(`invalid-limb:${definition.id}`, `${definition.id} 的骨骼链或接触点无效，该肢体已回退为 FK。`)
      continue
    }
    const analyticMapping = canUseAnalyticMapping(bones as Bone[], contactBone)
    if (definition.solver === 'analytic-two-bone' && !analyticMapping) {
      report(`invalid-analytic:${definition.id}`, `${definition.id} 不满足解析式两段链映射，该肢体已回退为 FK。`)
      continue
    }
    const solver = definition.solver === 'fabrik' || (definition.solver === 'auto' && !analyticMapping)
      ? 'fabrik'
      : 'analytic-two-bone'
    const fallbackBones = [...new Set([...(bones as Bone[]), contactBone])]
    report(`solver:${definition.id}`, `${definition.id} 使用${solver === 'fabrik' ? '受约束 FABRIK' : '解析式 Two Bone IK'}。`)
    limbs.push({
      definition,
      bones: bones as Bone[],
      contact,
      contactBone,
      fallbackBones,
      fallbackRotations: fallbackBones.map(bone => bone.quaternion.clone()),
      solver,
      anchor: new Vector3(),
      anchorOffset: new Vector3(),
      anchored: false,
      capturedThisFrame: false,
      positions: (bones as Bone[]).map(() => [0, 0, 0]),
      targetInput: [0, 0, 0],
      poleInput: [0, 0, 0],
      terminalStart: [0, 0, 0],
      terminalEnd: [0, 0, 0],
      contactLocalRotation: new Quaternion(...contact.localRotation).normalize(),
      contactLocalRotationInverse: new Quaternion(...contact.localRotation).normalize().invert(),
      anchorContactWorldRotation: new Quaternion(),
      targetContactBoneWorldRotation: new Quaternion(),
      remainingCorrections: new Map(fallbackBones.map(bone => [bone, definition.maxCorrectionRadians])),
    })
  }

  const worldPosition = new Vector3()
  const childWorldPosition = new Vector3()
  const desiredDirection = new Vector3()
  const currentDirection = new Vector3()
  const target = new Vector3()
  const deltaWorld = new Quaternion()
  const limitedWorldDelta = new Quaternion()
  const parentWorld = new Quaternion()
  const parentWorldInverse = new Quaternion()
  const localDelta = new Quaternion()
  const identity = new Quaternion()
  const currentBoneWorldRotation = new Quaternion()
  const currentBoneWorldRotationInverse = new Quaternion()
  const currentContact = new Vector3()
  const frameClampedLimbs = new Set<string>()
  let lastClipHash: string | undefined
  let lastResolvedTimeMs: number | undefined
  let disposed = false

  const readContactWorld = (limb: LimbRuntime, output: Vector3) => output
    .set(...limb.contact.localPosition)
    .applyMatrix4(limb.contactBone.matrixWorld)

  const clearTemporalState = () => {
    for (const limb of limbs) limb.anchored = false
    lastClipHash = undefined
    lastResolvedTimeMs = undefined
  }

  const restorePelvisTranslation = () => {
    // IK 只拥有骨盆 Y；Root Motion 后的重心控制器独占 X/Z，不能在这里覆盖。 / IK owns pelvis Y only; the post-root balance controller exclusively owns X/Z.
    if (pelvis && pelvisBindPosition) pelvis.position.y = pelvisBindPosition.y
  }

  const classifyTemporalTransition = (sample: SampledBipedPetMotion): 'continuous' | 'loop-seam' | 'reset' => {
    if (lastClipHash !== undefined && sample.clipHash !== lastClipHash) return 'reset'
    if (lastResolvedTimeMs === undefined) return 'continuous'
    if (sample.resolvedTimeMs < lastResolvedTimeMs - 1e-6) {
      const seamWindow = Math.min(250, sample.durationMs * .25)
      return sample.loopMode === 'loop'
        && lastResolvedTimeMs >= sample.durationMs - seamWindow
        && sample.resolvedTimeMs <= seamWindow
        ? 'loop-seam'
        : 'reset'
    }
    const reasonableJump = Math.max(250, sample.durationMs * .5)
    return sample.resolvedTimeMs - lastResolvedTimeMs > reasonableJump ? 'reset' : 'continuous'
  }

  const applyWorldDirectionCorrection = (
    limb: LimbRuntime,
    bone: Bone,
    currentEndWorld: Vector3,
    solvedStart: readonly number[],
    solvedEnd: readonly number[],
    mix: number,
    maxCorrectionRadians: number,
  ) => {
    bone.getWorldPosition(worldPosition)
    currentDirection.subVectors(currentEndWorld, worldPosition)
    desiredDirection.set(
      solvedEnd[0]! - solvedStart[0]!,
      solvedEnd[1]! - solvedStart[1]!,
      solvedEnd[2]! - solvedStart[2]!,
    )
    if (currentDirection.lengthSq() <= 1e-12 || desiredDirection.lengthSq() <= 1e-12) return false
    currentDirection.normalize()
    desiredDirection.normalize()
    deltaWorld.setFromUnitVectors(currentDirection, desiredDirection).normalize()
    const angle = deltaWorld.angleTo(identity)
    const remaining = Math.max(0, Math.min(maxCorrectionRadians, limb.remainingCorrections.get(bone) ?? maxCorrectionRadians))
    const appliedAngle = Math.min(angle * clamp01(mix), remaining)
    const correctionMix = angle > 1e-12 ? appliedAngle / angle : 0
    limitedWorldDelta.copy(identity).slerp(deltaWorld, correctionMix).normalize()

    if (bone.parent) bone.parent.getWorldQuaternion(parentWorld)
    else parentWorld.identity()
    parentWorldInverse.copy(parentWorld).invert()
    localDelta.copy(parentWorldInverse).multiply(limitedWorldDelta).multiply(parentWorld).normalize()
    bone.quaternion.premultiply(localDelta).normalize()
    limb.remainingCorrections.set(bone, Math.max(0, remaining - appliedAngle))
    runtime.object.updateMatrixWorld(true)
    return bone.quaternion.toArray().every(Number.isFinite)
  }

  const applyWorldOrientationCorrection = (
    limb: LimbRuntime,
    bone: Bone,
    targetWorldRotation: Quaternion,
    mix: number,
    maxCorrectionRadians: number,
  ) => {
    bone.getWorldQuaternion(currentBoneWorldRotation)
    currentBoneWorldRotationInverse.copy(currentBoneWorldRotation).invert()
    deltaWorld.copy(targetWorldRotation).multiply(currentBoneWorldRotationInverse).normalize()
    const angle = deltaWorld.angleTo(identity)
    const remaining = Math.max(0, Math.min(maxCorrectionRadians, limb.remainingCorrections.get(bone) ?? maxCorrectionRadians))
    const appliedAngle = Math.min(angle * clamp01(mix), remaining)
    const correctionMix = angle > 1e-12 ? appliedAngle / angle : 0
    limitedWorldDelta.copy(identity).slerp(deltaWorld, correctionMix).normalize()
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorld)
    else parentWorld.identity()
    parentWorldInverse.copy(parentWorld).invert()
    localDelta.copy(parentWorldInverse).multiply(limitedWorldDelta).multiply(parentWorld).normalize()
    bone.quaternion.premultiply(localDelta).normalize()
    limb.remainingCorrections.set(bone, Math.max(0, remaining - appliedAngle))
    runtime.object.updateMatrixWorld(true)
  }

  const solveLimb = (limb: LimbRuntime, state: SampledBipedPetContactState, actionWeight: number) => {
    if (!limb.anchored) return
    const mix = clamp01(limb.definition.weight) * actionWeight * clamp01(state.weight) * clamp01(state.confidence)
    if (mix <= 0) return
    for (const bone of limb.remainingCorrections.keys()) limb.remainingCorrections.set(bone, limb.definition.maxCorrectionRadians * mix)
    const passMix = 1 - (1 - mix) ** (1 / correctionPassCount)

    target.copy(limb.anchor).sub(limb.anchorOffset)
    for (const [index, bone] of limb.bones.entries()) {
      bone.getWorldPosition(worldPosition)
      const position = limb.positions[index]!
      position[0] = worldPosition.x
      position[1] = worldPosition.y
      position[2] = worldPosition.z
    }
    limb.targetInput[0] = target.x
    limb.targetInput[1] = target.y
    limb.targetInput[2] = target.z
    limb.poleInput[0] = limb.definition.poleAxis[0]
    limb.poleInput[1] = limb.definition.poleAxis[1]
    limb.poleInput[2] = limb.definition.poleAxis[2]

    if (limb.solver === 'analytic-two-bone') {
      const result = solveAnalyticTwoBoneIk({
        root: limb.positions[0]!,
        mid: limb.positions[1]!,
        tip: limb.positions.at(-1)!,
        target: limb.targetInput,
        pole: limb.poleInput,
        maxStretchRatio: limb.definition.maxStretchRatio,
      })
      if (result.status === 'blocked') {
        report(`solve:${limb.definition.id}`, `${limb.definition.id} 的解析式 IK 无法求解，本帧保留 FK。`)
        return
      }
      if (result.status === 'clamped') report(
        `clamped:${limb.definition.id}:analytic-two-bone`,
        `${limb.definition.id} 的解析式 IK 结果为 clamped，已应用有限可达解并保留物理残差。`,
      )
      if (result.status === 'clamped') frameClampedLimbs.add(limb.definition.id)
      limb.bones[1]!.getWorldPosition(childWorldPosition)
      applyWorldDirectionCorrection(limb, limb.bones[0]!, childWorldPosition, result.positions[0]!, result.positions[1]!, mix, limb.definition.maxCorrectionRadians)
      limb.bones.at(-1)!.getWorldPosition(childWorldPosition)
      applyWorldDirectionCorrection(limb, limb.bones[1]!, childWorldPosition, result.positions[1]!, result.positions[2]!, mix, limb.definition.maxCorrectionRadians)
    }
    else {
      const result = solveConstrainedFabrik({
        positions: limb.positions,
        target: limb.targetInput,
        pole: limb.poleInput,
        maxIterations: 8,
        tolerance: 1e-4,
        maxStretchRatio: limb.definition.maxStretchRatio,
      })
      if (result.status === 'blocked') {
        report(`solve:${limb.definition.id}`, `${limb.definition.id} 的 FABRIK 无法求解，本帧保留 FK。`)
        return
      }
      if (result.status === 'clamped') report(
        `clamped:${limb.definition.id}:fabrik`,
        `${limb.definition.id} 的 FABRIK 结果为 clamped，已应用有限可达解并保留物理残差。`,
      )
      if (result.status === 'clamped') frameClampedLimbs.add(limb.definition.id)
      for (let index = 0; index < limb.bones.length - 1; index += 1) {
        limb.bones[index + 1]!.getWorldPosition(childWorldPosition)
        applyWorldDirectionCorrection(
          limb,
          limb.bones[index]!,
          childWorldPosition,
          result.positions[index]!,
          result.positions[index + 1]!,
          mix,
          limb.definition.maxCorrectionRadians,
        )
      }
    }

    // 在同一累计角预算内交替收敛位置与接触朝向；禁止改动任何腿或脚骨骼局部 position。
    const tipBone = limb.bones.at(-1)!
    limb.targetContactBoneWorldRotation.copy(limb.anchorContactWorldRotation).multiply(limb.contactLocalRotationInverse).normalize()
    for (let iteration = 0; iteration < correctionPassCount; iteration += 1) {
      tipBone.getWorldPosition(worldPosition)
      readContactWorld(limb, currentContact)
      limb.terminalStart[0] = worldPosition.x
      limb.terminalStart[1] = worldPosition.y
      limb.terminalStart[2] = worldPosition.z
      limb.terminalEnd[0] = limb.anchor.x
      limb.terminalEnd[1] = limb.anchor.y
      limb.terminalEnd[2] = limb.anchor.z
      applyWorldDirectionCorrection(
        limb,
        tipBone,
        currentContact,
        limb.terminalStart,
        limb.terminalEnd,
        passMix,
        limb.definition.maxCorrectionRadians,
      )
      applyWorldOrientationCorrection(
        limb,
        limb.contactBone,
        limb.targetContactBoneWorldRotation,
        passMix,
        limb.definition.maxCorrectionRadians,
      )
    }
  }

  return {
    apply(sample, weightInput, context) {
      frameClampedLimbs.clear()
      if (disposed) {
        report('disposed-apply', '混合 IK 控制器已释放，后续 apply 已忽略。')
        return emptyFrameReport()
      }
      if (runtime.isDisposed()) {
        report('runtime-disposed', 'Three 运行时已释放，混合 IK 写入已忽略。')
        return emptyFrameReport()
      }
      const actionWeight = clamp01(weightInput)
      restorePelvisTranslation()
      runtime.object.updateMatrixWorld(true)
      if (context?.rootMotionPhase === 'takeoff'
        || context?.rootMotionPhase === 'airborne'
        || context?.rootMotionPhase === 'landing') {
        // Root Motion 的实际非支撑相位高于动作资产里可能滞后的 contact weight，避免离地或落地授权期间仍锁脚、下压骨盆。
        clearTemporalState()
        return emptyFrameReport()
      }
      if (actionWeight <= 0 || compilation.status !== 'ready') {
        clearTemporalState()
        return emptyFrameReport()
      }
      const temporalTransition = classifyTemporalTransition(sample)
      if (temporalTransition === 'reset') for (const limb of limbs) limb.anchored = false
      lastClipHash = sample.clipHash
      lastResolvedTimeMs = sample.resolvedTimeMs

      const findState = (contactId: string) => sample.contactStates.find(state => state.contactId === contactId)
      for (const limb of limbs) {
        limb.capturedThisFrame = false
        const state = findState(limb.definition.contactId)
        if (!isEffectiveSupport(state)) limb.anchored = false
        else if (!limb.anchored) {
          readContactWorld(limb, limb.anchor)
          limb.bones.at(-1)!.getWorldPosition(worldPosition)
          limb.anchorOffset.subVectors(limb.anchor, worldPosition)
          limb.contactBone.getWorldQuaternion(limb.anchorContactWorldRotation)
          limb.anchorContactWorldRotation.multiply(limb.contactLocalRotation).normalize()
          limb.anchored = true
          limb.capturedThisFrame = true
        }
      }

      let supportingCount = 0
      let correction = 0
      let influence = 0
      for (const limb of limbs) {
        const state = findState(limb.definition.contactId)
        if (!limb.anchored || !isEffectiveSupport(state)) continue
        supportingCount += 1
        const contactWorld = readContactWorld(limb, currentContact)
        const limbInfluence = clamp01(state.weight) * clamp01(state.confidence)
        correction += (limb.anchor.y - contactWorld.y) * limbInfluence
        influence += limbInfluence
      }
      const permitsPelvisY = supportingCount >= 2 || (integratedSingleSupportPelvisY && supportingCount === 1)
      if (pelvis && pelvisBindPosition && permitsPelvisY) {
        const blended = influence > 0 ? correction / influence * actionWeight : 0
        const pelvisYBudget = supportingCount >= 2 ? .08 : singleSupportPelvisYBudget
        const appliedPelvisY = Math.max(-pelvisYBudget, Math.min(pelvisYBudget, blended))
        pelvis.position.y = pelvisBindPosition.y + appliedPelvisY
        if (supportingCount === 1 && appliedPelvisY !== blended) {
          const supportingLimb = limbs.find(limb => limb.anchored && isEffectiveSupport(findState(limb.definition.contactId)))
          if (supportingLimb) frameClampedLimbs.add(supportingLimb.definition.id)
          report(
            'integrated-single-support-pelvis-y-clamped',
            'Root Motion 集成链的单支撑骨盆 Y 可达补偿已达到尺寸化 clamped 预算，保留真实足底残差。',
          )
        }
        runtime.object.updateMatrixWorld(true)
      }

      for (const limb of limbs) {
        const state = findState(limb.definition.contactId)
        if (!isEffectiveSupport(state) || limb.capturedThisFrame) continue
        for (const [index, bone] of limb.fallbackBones.entries()) limb.fallbackRotations[index]!.copy(bone.quaternion)
        try { solveLimb(limb, state, actionWeight) }
        catch {
          for (const [index, bone] of limb.fallbackBones.entries()) bone.quaternion.copy(limb.fallbackRotations[index]!)
          runtime.object.updateMatrixWorld(true)
          report(`runtime:${limb.definition.id}`, `${limb.definition.id} 的运行时 IK 异常，本帧已独立回退为 FK。`)
        }
      }
      runtime.object.updateMatrixWorld(true)
      const residualByLimb: Record<string, number> = {}
      let finalSupportingContacts = 0
      for (const limb of limbs) {
        const state = findState(limb.definition.contactId)
        if (!limb.anchored || !isEffectiveSupport(state)) continue
        finalSupportingContacts += 1
        readContactWorld(limb, currentContact)
        residualByLimb[limb.definition.id] = Math.hypot(
          limb.anchor.x - currentContact.x,
          limb.anchor.z - currentContact.z,
        )
      }
      return Object.freeze({
        supportingContacts: finalSupportingContacts,
        residualByLimb: Object.freeze(residualByLimb),
        clampedLimbs: Object.freeze([...frameClampedLimbs].sort()),
      })
    },
    reset() {
      if (disposed) return
      clearTemporalState()
      if (!runtime.isDisposed()) {
        restorePelvisTranslation()
        runtime.object.updateMatrixWorld(true)
      }
    },
    diagnostics: () => Object.freeze([...messages]),
    dispose() {
      if (disposed) return
      if (!runtime.isDisposed()) {
        restorePelvisTranslation()
        runtime.object.updateMatrixWorld(true)
      }
      clearTemporalState()
      limbs.length = 0
      disposed = true
    },
  }
}
