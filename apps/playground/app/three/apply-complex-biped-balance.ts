/**
 * 文件职责 / File responsibility
 * 在 Root Motion 后叠加有界重心补偿；只拥有 pelvis X/Z 与 chest Quaternion。
 */

import { Euler, Quaternion } from 'three'
import type { CompiledCharacterModel, SampledBipedPetMotion, SampledBipedPetRootMotion } from '@yk-pets/pet-core'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

export interface ComplexBipedBalanceController {
  apply(
    sample: SampledBipedPetMotion,
    weight: number,
    rootMotion: Pick<SampledBipedPetRootMotion, 'deltaLocal' | 'phase' | 'motionIntensity'>,
  ): void
  reset(): void
  dispose(): void
}

const MAX_CHEST_TILT_RADIANS = .12
const MAX_PELVIS_OFFSET_HEIGHT_RATIO = .025
const clamp01 = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

export function createComplexBipedBalanceController(
  runtime: ComplexBipedPetObject,
  _compilation: CompiledCharacterModel,
  characterHeight: number,
): ComplexBipedBalanceController {
  const pelvis = runtime.bonesById.get('pelvis')
  const chest = runtime.bonesById.get('chest')
  const pelvisBindPosition = pelvis?.position.clone()
  const chestBindQuaternion = chest?.quaternion.clone()
  const tilt = new Quaternion()
  const inversePreviousTilt = new Quaternion()
  const previousTilt = new Quaternion()
  const lastWrittenChest = new Quaternion()
  let ownsPreviousTilt = false
  const maxOffset = Number.isFinite(characterHeight) && characterHeight > 0
    ? characterHeight * MAX_PELVIS_OFFSET_HEIGHT_RATIO
    : 0
  let disposed = false

  const assertUsable = () => {
    if (disposed || runtime.isDisposed()) throw new Error('复杂双足萌宠重心控制器已释放，不能继续写入骨骼。')
  }
  const restoreOwnedBind = () => {
    if (pelvis && pelvisBindPosition) {
      pelvis.position.x = pelvisBindPosition.x
      pelvis.position.z = pelvisBindPosition.z
    }
    if (chest && chestBindQuaternion) chest.quaternion.copy(chestBindQuaternion)
  }

  return {
    apply(sample, weightInput, rootMotion) {
      assertUsable()
      if (pelvis && pelvisBindPosition) {
        pelvis.position.x = pelvisBindPosition.x
        pelvis.position.z = pelvisBindPosition.z
      }
      // standalone 连续调用时移除自己的上一帧 tilt；若外层 FK 已写入新姿态，则直接把当前值视为本帧 FK。 / Remove our previous tilt for standalone continuity; an externally replaced value is the current FK.
      if (chest && ownsPreviousTilt && chest.quaternion.angleTo(lastWrittenChest) <= 1e-9) {
        inversePreviousTilt.copy(previousTilt).invert()
        chest.quaternion.multiply(inversePreviousTilt).normalize()
      }
      ownsPreviousTilt = false
      const fkChest = chest?.quaternion.clone()
      const weight = clamp01(weightInput)
      const supports = sample.contactStates.filter(state => state.weight > 0 && state.confidence > 0)
      if (!pelvis || !pelvisBindPosition || !chest || !fkChest || weight <= 0
        || rootMotion.phase === 'takeoff' || rootMotion.phase === 'airborne' || supports.length === 0) {
        return
      }

      let side = 0
      let influence = 0
      for (const state of supports) {
        const contactSide = state.contactId.includes('left') ? -1 : state.contactId.includes('right') ? 1 : 0
        const stateInfluence = clamp01(state.weight) * clamp01(state.confidence)
        side += contactSide * stateInfluence
        influence += stateInfluence
      }
      const supportBias = influence > 0 ? side / influence : 0
      const rawLateralOffset = Math.max(-maxOffset, Math.min(
        maxOffset,
        supportBias * maxOffset * rootMotion.motionIntensity * weight,
      ))
      const rawForwardOffset = Math.max(-maxOffset, Math.min(maxOffset, -rootMotion.motionIntensity * maxOffset * 1.4 * weight))
      const offsetLength = Math.hypot(rawLateralOffset, rawForwardOffset)
      const offsetScale = offsetLength > maxOffset && offsetLength > 0 ? maxOffset / offsetLength : 1
      const lateralOffset = rawLateralOffset * offsetScale
      const forwardOffset = rawForwardOffset * offsetScale
      pelvis.position.x = pelvisBindPosition.x + lateralOffset
      pelvis.position.z = pelvisBindPosition.z + forwardOffset

      const deltaX = Number.isFinite(rootMotion.deltaLocal[0]) ? rootMotion.deltaLocal[0] : 0
      const deltaZ = Number.isFinite(rootMotion.deltaLocal[2]) ? rootMotion.deltaLocal[2] : 0
      const directionLength = Math.hypot(deltaX, deltaZ)
      const tiltScale = Math.min(MAX_CHEST_TILT_RADIANS, rootMotion.motionIntensity * MAX_CHEST_TILT_RADIANS * weight)
      const tiltX = directionLength > 1e-12 ? -deltaZ / directionLength * tiltScale : 0
      const tiltZ = directionLength > 1e-12 ? deltaX / directionLength * tiltScale : supportBias * tiltScale * .35
      tilt.setFromEuler(new Euler(tiltX, 0, tiltZ, 'XYZ'))
      chest.quaternion.copy(fkChest).multiply(tilt).normalize()
      previousTilt.copy(tilt)
      lastWrittenChest.copy(chest.quaternion)
      ownsPreviousTilt = true
    },
    reset() {
      if (disposed) return
      ownsPreviousTilt = false
      restoreOwnedBind()
    },
    dispose() {
      if (disposed) return
      if (!runtime.isDisposed()) restoreOwnedBind()
      ownsPreviousTilt = false
      disposed = true
    },
  }
}
