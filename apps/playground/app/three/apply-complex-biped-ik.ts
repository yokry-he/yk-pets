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
} from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

export interface ComplexBipedIkController {
  apply(sample: SampledBipedPetMotion, weight: number): void
  reset(): void
  diagnostics(): readonly string[]
  dispose(): void
}

interface LimbRuntime {
  definition: CompiledCharacterLimbIk
  bones: Bone[]
  contact: CompiledCharacterContact
  contactBone: Bone
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
}

type MutableRigVector = [number, number, number]
const clamp01 = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

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
): ComplexBipedIkController {
  const messages: string[] = []
  const messageIds = new Set<string>()
  const report = (id: string, message: string) => {
    if (messageIds.has(id)) return
    messageIds.add(id)
    messages.push(message)
  }

  const pelvis = runtime.bonesById.get('pelvis')
  const pelvisBindPosition = pelvis?.position.clone()
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
    report(`solver:${definition.id}`, `${definition.id} 使用${solver === 'fabrik' ? '受约束 FABRIK' : '解析式 Two Bone IK'}。`)
    limbs.push({
      definition,
      bones: bones as Bone[],
      contact,
      contactBone,
      fallbackRotations: (bones as Bone[]).map(bone => bone.quaternion.clone()),
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
  const currentContact = new Vector3()
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
    if (pelvis && pelvisBindPosition) pelvis.position.copy(pelvisBindPosition)
  }

  const hasDiscontinuity = (sample: SampledBipedPetMotion) => {
    if (lastClipHash !== undefined && sample.clipHash !== lastClipHash) return true
    if (lastResolvedTimeMs === undefined) return false
    if (sample.resolvedTimeMs < lastResolvedTimeMs - 1e-6) return true
    const reasonableJump = Math.max(250, sample.durationMs * .5)
    return sample.resolvedTimeMs - lastResolvedTimeMs > reasonableJump
  }

  const applyWorldDirectionCorrection = (
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
    const correctionMix = clamp01(mix) * (angle > maxCorrectionRadians ? maxCorrectionRadians / angle : 1)
    limitedWorldDelta.copy(identity).slerp(deltaWorld, correctionMix).normalize()

    if (bone.parent) bone.parent.getWorldQuaternion(parentWorld)
    else parentWorld.identity()
    parentWorldInverse.copy(parentWorld).invert()
    localDelta.copy(parentWorldInverse).multiply(limitedWorldDelta).multiply(parentWorld).normalize()
    bone.quaternion.premultiply(localDelta).normalize()
    runtime.object.updateMatrixWorld(true)
    return bone.quaternion.toArray().every(Number.isFinite)
  }

  const solveLimb = (limb: LimbRuntime, state: SampledBipedPetContactState, actionWeight: number, clipHash: string) => {
    if (!limb.anchored) return
    const mix = clamp01(limb.definition.weight) * actionWeight * clamp01(state.weight) * clamp01(state.confidence)
    if (mix <= 0) return

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
        `clamped:${limb.definition.id}:${clipHash}:analytic-two-bone`,
        `${limb.definition.id} 的解析式 IK 结果为 clamped，已应用有限可达解并保留物理残差。`,
      )
      limb.bones[1]!.getWorldPosition(childWorldPosition)
      applyWorldDirectionCorrection(limb.bones[0]!, childWorldPosition, result.positions[0]!, result.positions[1]!, mix, limb.definition.maxCorrectionRadians)
      limb.bones.at(-1)!.getWorldPosition(childWorldPosition)
      applyWorldDirectionCorrection(limb.bones[1]!, childWorldPosition, result.positions[1]!, result.positions[2]!, mix, limb.definition.maxCorrectionRadians)
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
        `clamped:${limb.definition.id}:${clipHash}:fabrik`,
        `${limb.definition.id} 的 FABRIK 结果为 clamped，已应用有限可达解并保留物理残差。`,
      )
      for (let index = 0; index < limb.bones.length - 1; index += 1) {
        limb.bones[index + 1]!.getWorldPosition(childWorldPosition)
        applyWorldDirectionCorrection(
          limb.bones[index]!,
          childWorldPosition,
          result.positions[index]!,
          result.positions[index + 1]!,
          mix,
          limb.definition.maxCorrectionRadians,
        )
      }
    }

    // 末端只能通过 tip/ankle Quaternion 对齐 contact 方向，禁止改动任何腿或脚骨骼局部 position。
    const tipBone = limb.bones.at(-1)!
    tipBone.getWorldPosition(worldPosition)
    readContactWorld(limb, currentContact)
    limb.terminalStart[0] = worldPosition.x
    limb.terminalStart[1] = worldPosition.y
    limb.terminalStart[2] = worldPosition.z
    limb.terminalEnd[0] = limb.anchor.x
    limb.terminalEnd[1] = limb.anchor.y
    limb.terminalEnd[2] = limb.anchor.z
    applyWorldDirectionCorrection(
      tipBone,
      currentContact,
      limb.terminalStart,
      limb.terminalEnd,
      mix,
      limb.definition.maxCorrectionRadians,
    )
  }

  return {
    apply(sample, weightInput) {
      if (disposed) {
        report('disposed-apply', '混合 IK 控制器已释放，后续 apply 已忽略。')
        return
      }
      if (runtime.isDisposed()) {
        report('runtime-disposed', 'Three 运行时已释放，混合 IK 写入已忽略。')
        return
      }
      const actionWeight = clamp01(weightInput)
      restorePelvisTranslation()
      runtime.object.updateMatrixWorld(true)
      if (actionWeight <= 0 || compilation.status !== 'ready') {
        clearTemporalState()
        return
      }
      if (hasDiscontinuity(sample)) for (const limb of limbs) limb.anchored = false
      lastClipHash = sample.clipHash
      lastResolvedTimeMs = sample.resolvedTimeMs

      const findState = (contactId: string) => sample.contactStates.find(state => state.contactId === contactId)
      for (const limb of limbs) {
        limb.capturedThisFrame = false
        const state = findState(limb.definition.contactId)
        if (!state || state.weight <= 0) limb.anchored = false
        else if (!limb.anchored) {
          readContactWorld(limb, limb.anchor)
          limb.bones.at(-1)!.getWorldPosition(worldPosition)
          limb.anchorOffset.subVectors(limb.anchor, worldPosition)
          limb.anchored = true
          limb.capturedThisFrame = true
        }
      }

      let supportingCount = 0
      let correction = 0
      let influence = 0
      for (const limb of limbs) {
        const state = findState(limb.definition.contactId)
        if (!limb.anchored || !state || state.weight <= 0) continue
        supportingCount += 1
        const contactWorld = readContactWorld(limb, currentContact)
        const limbInfluence = clamp01(state.weight) * clamp01(state.confidence)
        correction += (limb.anchor.y - contactWorld.y) * limbInfluence
        influence += limbInfluence
      }
      if (pelvis && pelvisBindPosition && supportingCount >= 2) {
        const blended = influence > 0 ? correction / influence * actionWeight : 0
        pelvis.position.y = pelvisBindPosition.y + Math.max(-.08, Math.min(.08, blended))
        runtime.object.updateMatrixWorld(true)
      }

      for (const limb of limbs) {
        const state = findState(limb.definition.contactId)
        if (!state || state.weight <= 0 || limb.capturedThisFrame) continue
        for (const [index, bone] of limb.bones.entries()) limb.fallbackRotations[index]!.copy(bone.quaternion)
        try { solveLimb(limb, state, actionWeight, sample.clipHash) }
        catch {
          for (const [index, bone] of limb.bones.entries()) bone.quaternion.copy(limb.fallbackRotations[index]!)
          runtime.object.updateMatrixWorld(true)
          report(`runtime:${limb.definition.id}`, `${limb.definition.id} 的运行时 IK 异常，本帧已独立回退为 FK。`)
        }
      }
      runtime.object.updateMatrixWorld(true)
    },
    reset() {
      if (disposed) return
      clearTemporalState()
      if (!runtime.isDisposed()) {
        restorePelvisTranslation()
        runtime.object.updateMatrixWorld(true)
      }
    },
    diagnostics: () => [...messages],
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
