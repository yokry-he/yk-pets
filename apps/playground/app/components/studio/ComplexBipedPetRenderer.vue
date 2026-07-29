<!--
  文件职责 / File responsibility
  将复杂双足萌宠的站内配方、动作与运动特效适配为既有 Tres 场景中的同级 Three primitive。
  不创建 Canvas、不加载 GLB，也不承担工坊表单或 Store 写回职责。
-->
<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { Matrix4, Vector3, type Group } from 'three'
import {
  compileBipedPetMotionAdaptationPlan,
  compileBipedPetMotion,
  compileBipedPetCharacter,
  deriveStudioPropRig,
  normalizeBipedPetModelRecipe,
  sampleBipedPetMotion,
  sampleBipedPetWeaponVfxSignals,
  type BipedPetWeaponVfxFrame,
  type CharacterCompilationDiagnostic,
  type CharacterModelRecipeV1,
  type CompiledBipedPetMotionAdaptationPlan,
  type CompiledBipedPetMotionEffectCue,
  type CompiledCharacterModel,
  type EvaluatedMotionPropInstance,
  type StudioPropAssetV2,
  type StudioPropRigDefinition,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'
import {
  createComplexBipedPetObject,
  type ComplexBipedPetObject,
} from '~/three/create-complex-biped-pet-object'
import {
  createComplexBipedMotionController,
  type ComplexBipedMotionBeforeLegIkContext,
  type ComplexBipedMotionController,
} from '~/three/apply-complex-biped-motion'
import { createComplexBipedWeaponConstraintController, type ComplexBipedWeaponConstraintController } from '~/three/apply-complex-biped-weapon-constraint'
import { createComplexBipedMotionVfxController, type ComplexBipedMotionVfxController, type ComplexBipedMotionVfxFrame } from '~/three/complex-biped-motion-vfx'
import { createComplexBipedWeaponVfxController, type ComplexBipedWeaponVfxController, type ComplexBipedWeaponVfxFrame } from '~/three/complex-biped-weapon-vfx'
import {
  isComplexBipedPropRuntimeHandleAttached,
  registerComplexBipedPropRuntimeHandle,
  releaseComplexBipedPropRuntimeHandle,
  type ComplexBipedPropRuntimeHandle,
} from '~/three/complex-biped-prop-mounts'
import ComplexBipedPropInstances from './ComplexBipedPropInstances.vue'

const props = defineProps<{
  recipe: CharacterModelRecipeV1
  propInstances?: readonly EvaluatedMotionPropInstance[]
  propAssets?: readonly StudioPropAssetV2[]
  preservePropMaterials?: boolean
  motionAsset?: StudioMotionAssetV2 | null
  motionTimeMs?: number
  motionWeight?: number
}>()
const emit = defineEmits<{
  compilation: [payload: Pick<CompiledCharacterModel, 'hash' | 'status' | 'diagnostics'>]
}>()

// Three 实例包含循环引用和原生资源，必须保留为浅引用，不能交给 Vue 深代理。 / Three instances stay shallow to avoid proxying circular native resources.
const runtime = shallowRef<ComplexBipedPetObject>()
const lastEmitted = shallowRef<{ hash: string, status: CompiledCharacterModel['status'], diagnosticsKey: string }>()
const lastRuntimeKey = shallowRef<string>()
const motionController = shallowRef<ComplexBipedMotionController>()
const motionVfxController = shallowRef<ComplexBipedMotionVfxController>()
const motionVfxObject = shallowRef<ComplexBipedMotionVfxController['object']>()
const weaponConstraintController = shallowRef<ComplexBipedWeaponConstraintController>()
const weaponVfxController = shallowRef<ComplexBipedWeaponVfxController>()
const weaponVfxObject = shallowRef<ComplexBipedWeaponVfxController['object']>()
const motionClip = shallowRef<ReturnType<typeof compileBipedPetMotion>>()
const motionAdaptationPlan = shallowRef<CompiledBipedPetMotionAdaptationPlan>()
const activeCompilation = shallowRef<CompiledCharacterModel>()
const propHandles = new Map<string, ComplexBipedPropRuntimeHandle>()
const propRigsByInstanceId = new Map<string, StudioPropRigDefinition>()
const vfxForward = new Vector3(0, 0, 1)
const vfxPosition: [number, number, number] = [0, 0, 0]
const motionVfxFrame: ComplexBipedMotionVfxFrame = { requestedTimeMs: 0, position: vfxPosition, facingRadians: 0 }
const weaponVfxFrame = { requestedTimeMs: 0, characterHeight: 1 } satisfies ComplexBipedWeaponVfxFrame
const weaponPointWorld = new Vector3()
const weaponParentInverse = new Matrix4()
const activeWeaponCues: CompiledBipedPetMotionEffectCue[] = []
const weaponFrameBuffers = [createWeaponFrameBuffer(), createWeaponFrameBuffer()]
let currentWeaponFrameBufferIndex = 0
let previousWeaponFrame: BipedPetWeaponVfxFrame | undefined
let runtimeCharacterHeight = 1
let runtimeArmReach: Readonly<{ left: number; right: number }> = Object.freeze({ left: 1, right: 1 })
let weaponGroundY = 0
let propHandlesDirty = false
let disposingRuntime = false
let lastAppliedMotionTimeMs: number | undefined
let synchronizingPreview = false
let previewFailureDomain: 'compile' | 'frame' | undefined
let previewFailureMotionId: string | undefined
let previewFailureUpdatedAt: number | undefined

function createWeaponFrameBuffer() {
  return {
    frame: {
      clipHash: '',
      requestedTimeMs: 0,
      status: 'ready' as const,
      groundY: 0,
      pointsByCueId: Object.create(null) as Record<string, readonly (readonly [number, number, number])[]>,
    },
    pointBuffers: new Map<string, [number, number, number][]>(),
    activeCueIds: [] as string[],
  }
}

function diagnosticsKey(diagnostics: readonly CharacterCompilationDiagnostic[]) {
  return diagnostics.map(item => [item.id, item.severity, item.message, item.affectedSemantic ?? ''].join('\u0000')).join('\u0001')
}

function compilationKey(compilation: CompiledCharacterModel) {
  return [compilation.hash, compilation.status, diagnosticsKey(compilation.diagnostics)].join('\u0002')
}

function diagnosticErrorMessage(error: unknown) {
  try {
    const message = String(error instanceof Error ? error.message : error).replace(/\s+/g, ' ').trim().slice(0, 180)
    return message || '未知错误'
  }
  catch { return '未知错误' }
}

function emitCompilationIfChanged(compilation: CompiledCharacterModel) {
  const next = {
    hash: compilation.hash,
    status: compilation.status,
    diagnosticsKey: diagnosticsKey(compilation.diagnostics),
  }
  const previous = lastEmitted.value
  if (previous && previous.hash === next.hash && previous.status === next.status && previous.diagnosticsKey === next.diagnosticsKey) return
  lastEmitted.value = next
  emit('compilation', {
    hash: compilation.hash,
    status: compilation.status,
    diagnostics: compilation.diagnostics.map(diagnostic => ({ ...diagnostic })),
  })
}

function resetWeaponFrameHistory(clearBuffers = false) {
  previousWeaponFrame = undefined
  currentWeaponFrameBufferIndex = 0
  activeWeaponCues.length = 0
  for (const buffer of weaponFrameBuffers) {
    for (const cueId of buffer.activeCueIds) delete buffer.frame.pointsByCueId[cueId]
    buffer.activeCueIds.length = 0
    if (clearBuffers) buffer.pointBuffers.clear()
  }
}

function objectBelongsToRuntime(currentRuntime: ComplexBipedPetObject, object: ComplexBipedPropRuntimeHandle['mount']['object']) {
  let current: typeof object | null = object
  while (current) {
    if (current === currentRuntime.object) return true
    current = current.parent
  }
  return false
}

function validPropHandle(instanceId: string): ComplexBipedPropRuntimeHandle | undefined {
  const handle = propHandles.get(instanceId)
  const currentRuntime = runtime.value
  if (!handle || !currentRuntime) return undefined
  if (isComplexBipedPropRuntimeHandleAttached(handle) && objectBelongsToRuntime(currentRuntime, handle.mount.object)) return handle
  propHandles.delete(instanceId)
  propRigsByInstanceId.delete(instanceId)
  propHandlesDirty = true
  return undefined
}

function readRuntimeMetrics(currentRuntime: ComplexBipedPetObject, compilation: CompiledCharacterModel) {
  const box = currentRuntime.object.geometry.boundingBox
  runtimeCharacterHeight = box && Number.isFinite(box.max.y - box.min.y) && box.max.y > box.min.y
    ? box.max.y - box.min.y
    : 1
  weaponGroundY = currentRuntime.object.position.y + (box && Number.isFinite(box.min.y) ? box.min.y : 0)
  const compiledBoneById = new Map(compilation.bones.map(bone => [bone.id, bone]))
  const reach = (side: 'left' | 'right') => {
    const boneIds = [`upper-arm.${side}`, `elbow.${side}`, `forearm.${side}`, `wrist.${side}`, `hand.${side}`]
    let total = 0
    for (let index = 1; index < boneIds.length; index += 1) {
      const bone = compiledBoneById.get(boneIds[index]!)
      if (!bone) continue
      total += Math.hypot(...bone.position)
    }
    return total > 0 && Number.isFinite(total) ? total : runtimeCharacterHeight * .3
  }
  runtimeArmReach = Object.freeze({ left: reach('left'), right: reach('right') })
  weaponVfxFrame.characterHeight = runtimeCharacterHeight
}

function rebuildPropRigs() {
  propRigsByInstanceId.clear()
  for (const [instanceId] of propHandles) {
    const handle = validPropHandle(instanceId)
    if (handle) propRigsByInstanceId.set(instanceId, deriveStudioPropRig(handle.asset).value)
  }
  propHandlesDirty = false
}

function compileAdaptationPlan(clip: ReturnType<typeof compileBipedPetMotion>) {
  const compilation = activeCompilation.value
  if (!compilation) return undefined
  rebuildPropRigs()
  return compileBipedPetMotionAdaptationPlan({
    definition: clip.adaptationDefinition,
    clipHash: clip.hash,
    profileId: compilation.profileId,
    characterHash: compilation.hash,
    characterHeight: runtimeCharacterHeight,
    armReach: runtimeArmReach,
    propRigs: Object.fromEntries(propRigsByInstanceId),
  })
}

function onPropReady(handle: ComplexBipedPropRuntimeHandle) {
  const currentRuntime = runtime.value
  if (!currentRuntime || disposingRuntime || !objectBelongsToRuntime(currentRuntime, handle.mount.object)) return
  if (!registerComplexBipedPropRuntimeHandle(propHandles, handle)) return
  propRigsByInstanceId.set(handle.instanceId, deriveStudioPropRig(handle.asset).value)
  if (motionClip.value) synchronizePreview('compile', '道具动作适配', compileMotion, true)
}

function onPropReleased(instanceId: string, object: Group) {
  if (!releaseComplexBipedPropRuntimeHandle(propHandles, instanceId, object)) return
  propRigsByInstanceId.delete(instanceId)
  if (!disposingRuntime && runtime.value && motionClip.value) synchronizePreview('compile', '道具动作适配', compileMotion, true)
}

function disposeResources(
  weaponVfxController?: ComplexBipedWeaponVfxController,
  vfxController?: ComplexBipedMotionVfxController,
  weaponConstraintController?: ComplexBipedWeaponConstraintController,
  controller?: ComplexBipedMotionController,
  currentRuntime?: ComplexBipedPetObject,
) {
  const failures: string[] = []
  try { weaponVfxController?.dispose() }
  catch (error) { failures.push(`持械特效释放失败：${diagnosticErrorMessage(error)}`) }
  try { vfxController?.dispose() }
  catch (error) { failures.push(`运动特效释放失败：${diagnosticErrorMessage(error)}`) }
  try { weaponConstraintController?.dispose() }
  catch (error) { failures.push(`持械约束释放失败：${diagnosticErrorMessage(error)}`) }
  try { controller?.dispose() }
  catch (error) { failures.push(`动作控制器释放失败：${diagnosticErrorMessage(error)}`) }
  try { currentRuntime?.dispose() }
  catch (error) { failures.push(`Three 运行时释放失败：${diagnosticErrorMessage(error)}`) }
  return failures
}

function disposeRuntime() {
  const previousWeaponVfxController = weaponVfxController.value
  const previousVfxController = motionVfxController.value
  const previousWeaponConstraintController = weaponConstraintController.value
  const previousController = motionController.value
  const previousRuntime = runtime.value
  disposingRuntime = true
  weaponVfxController.value = undefined
  weaponVfxObject.value = undefined
  motionVfxController.value = undefined
  motionVfxObject.value = undefined
  weaponConstraintController.value = undefined
  motionController.value = undefined
  motionClip.value = undefined
  motionAdaptationPlan.value = undefined
  runtime.value = undefined
  lastAppliedMotionTimeMs = undefined
  propHandles.clear()
  propRigsByInstanceId.clear()
  propHandlesDirty = false
  resetWeaponFrameHistory(true)
  let failures: string[]
  try {
    failures = disposeResources(
      previousWeaponVfxController,
      previousVfxController,
      previousWeaponConstraintController,
      previousController,
      previousRuntime,
    )
  }
  finally { disposingRuntime = false }
  if (failures.length > 0) throw new Error(`复杂双足萌宠预览释放失败：${failures.join('；')}`)
}

function resetMotionPreview() {
  const failures: string[] = []
  lastAppliedMotionTimeMs = undefined
  resetWeaponFrameHistory()
  try { weaponVfxController.value?.reset() }
  catch (error) { failures.push(`持械特效重置失败：${diagnosticErrorMessage(error)}`) }
  try { motionVfxController.value?.reset() }
  catch (error) { failures.push(`运动特效重置失败：${diagnosticErrorMessage(error)}`) }
  try { weaponConstraintController.value?.reset() }
  catch (error) { failures.push(`持械约束重置失败：${diagnosticErrorMessage(error)}`) }
  try { motionController.value?.reset() }
  catch (error) { failures.push(`动作控制器重置失败：${diagnosticErrorMessage(error)}`) }
  if (failures.length > 0) throw new Error(`复杂双足萌宠预览重置失败：${failures.join('；')}`)
}

function synchronizePreview(domain: 'compile' | 'frame', label: string, operation: () => boolean, clearClipBeforeSync = false): boolean {
  if (synchronizingPreview) return false
  synchronizingPreview = true
  if (clearClipBeforeSync) motionClip.value = undefined
  try {
    const synchronized = operation()
    const failedAssetStillActive = previewFailureMotionId === props.motionAsset?.id
      && previewFailureUpdatedAt === props.motionAsset?.updatedAt
    const recoversFailure = synchronized && (domain === 'compile' || (previewFailureDomain === domain && failedAssetStillActive))
    if (recoversFailure && activeCompilation.value) emitCompilationIfChanged(activeCompilation.value)
    if (recoversFailure) {
      previewFailureDomain = undefined
      previewFailureMotionId = undefined
      previewFailureUpdatedAt = undefined
    }
    return synchronized
  }
  catch (error) {
    const cleanupFailures: string[] = []
    try { resetMotionPreview() }
    catch (resetError) { cleanupFailures.push(`重置上下文：${diagnosticErrorMessage(resetError)}`) }
    if (cleanupFailures.length > 0) {
      // reset 已失败，旧 runtime 不再可信；清 key 后允许相同配方在下一次同步重建。 / A reset failure invalidates the runtime; clear its key so the same recipe can rebuild on the next synchronization.
      lastRuntimeKey.value = undefined
      try { disposeRuntime() }
      catch (disposeError) { cleanupFailures.push(`释放上下文：${diagnosticErrorMessage(disposeError)}`) }
    }
    const compilation = activeCompilation.value
    if (compilation) {
      const cleanupContext = cleanupFailures.length > 0 ? `；${cleanupFailures.join('；')}` : ''
      emitCompilationIfChanged({
        ...compilation,
        status: 'blocked',
        diagnostics: [...compilation.diagnostics, {
          id: 'three-preview-sync-failure',
          severity: 'error',
          message: `复杂双足萌宠${label}失败：${diagnosticErrorMessage(error)}${cleanupContext}。已安全停止预览。`,
        }],
      })
    }
    previewFailureDomain = domain
    previewFailureMotionId = props.motionAsset?.id
    previewFailureUpdatedAt = props.motionAsset?.updatedAt
    return false
  }
  finally { synchronizingPreview = false }
}

function applyWeaponConstraint(
  context: ComplexBipedMotionBeforeLegIkContext,
  controller: ComplexBipedWeaponConstraintController,
) {
  const plan = motionAdaptationPlan.value
  const adaptation = context.sample.adaptation
  if (!plan || !adaptation) return
  let selectedConstraint: CompiledBipedPetMotionAdaptationPlan['constraints'][number] | undefined
  let selectedWeight = 0
  for (const constraint of plan.constraints) {
    const weight = adaptation.constraintWeights[constraint.id] ?? 0
    if (weight > selectedWeight) {
      selectedConstraint = constraint
      selectedWeight = weight
    }
  }
  if (!selectedConstraint || selectedWeight <= 0) return
  const handle = validPropHandle(selectedConstraint.propInstanceId)
  const rig = propRigsByInstanceId.get(selectedConstraint.propInstanceId)
  if (!handle || !rig) return
  controller.apply({
    requestedTimeMs: context.sample.requestedTimeMs,
    weight: context.weight,
    adaptation,
    propHandle: {
      instanceId: handle.instanceId,
      object: handle.object,
      primaryGrip: rig.primaryGrip,
      constraint: selectedConstraint,
    },
  })
}

function prepareWeaponFrameBuffer() {
  const buffer = weaponFrameBuffers[currentWeaponFrameBufferIndex]!
  for (const cueId of buffer.activeCueIds) delete buffer.frame.pointsByCueId[cueId]
  buffer.activeCueIds.length = 0
  activeWeaponCues.length = 0
  return buffer
}

function cuePointBuffer(
  buffer: ReturnType<typeof createWeaponFrameBuffer>,
  cue: CompiledBipedPetMotionEffectCue,
) {
  const existing = buffer.pointBuffers.get(cue.id)
  if (existing?.length === cue.points.length) return existing
  const created = cue.points.map(() => [0, 0, 0] as [number, number, number])
  buffer.pointBuffers.set(cue.id, created)
  return created
}

function applyWeaponVfx(
  sample: ReturnType<typeof sampleBipedPetMotion>,
  currentRuntime: ComplexBipedPetObject,
  controller: ComplexBipedWeaponVfxController,
) {
  const buffer = prepareWeaponFrameBuffer()
  const frame = buffer.frame
  frame.clipHash = sample.clipHash
  frame.requestedTimeMs = sample.requestedTimeMs
  frame.groundY = weaponGroundY
  currentRuntime.object.updateMatrixWorld(true)
  const parent = currentRuntime.object.parent
  if (parent) {
    parent.updateWorldMatrix(true, false)
    weaponParentInverse.copy(parent.matrixWorld).invert()
  }
  else weaponParentInverse.identity()

  const plan = motionAdaptationPlan.value
  const activeCueIds = sample.adaptation?.activeEffectCueIds
  if (plan && activeCueIds) for (const cue of plan.effectCues) {
    if (!activeCueIds.includes(cue.id)) continue
    const handle = validPropHandle(cue.propInstanceId)
    if (!handle) continue
    handle.object.updateWorldMatrix(true, false)
    const points = cuePointBuffer(buffer, cue)
    for (const [index, point] of cue.points.entries()) {
      weaponPointWorld.set(...point.position).applyMatrix4(handle.object.matrixWorld).applyMatrix4(weaponParentInverse)
      points[index]![0] = weaponPointWorld.x
      points[index]![1] = weaponPointWorld.y
      points[index]![2] = weaponPointWorld.z
    }
    frame.pointsByCueId[cue.id] = points
    buffer.activeCueIds.push(cue.id)
    activeWeaponCues.push(cue)
  }

  const signals = sampleBipedPetWeaponVfxSignals(previousWeaponFrame, frame, activeWeaponCues)
  weaponVfxFrame.requestedTimeMs = sample.requestedTimeMs
  controller.apply(signals, weaponVfxFrame)
  previousWeaponFrame = frame
  currentWeaponFrameBufferIndex = currentWeaponFrameBufferIndex === 0 ? 1 : 0
}

function applyMotion(): boolean {
  const controller = motionController.value
  const vfxController = motionVfxController.value
  const currentWeaponVfxController = weaponVfxController.value
  const currentRuntime = runtime.value
  const clip = motionClip.value
  const adaptationPlan = motionAdaptationPlan.value
  if (!controller || !vfxController || !currentWeaponVfxController || !currentRuntime) return false
  if (!clip || clip.status !== 'ready') {
    resetMotionPreview()
    return false
  }
  const motionWeight = typeof props.motionWeight === 'number' && Number.isFinite(props.motionWeight) ? props.motionWeight : 1
  if (motionWeight <= 0) {
    resetMotionPreview()
    return false
  }
  const requestedTimeMs = props.motionTimeMs ?? 0
  if (lastAppliedMotionTimeMs !== undefined && requestedTimeMs < lastAppliedMotionTimeMs) resetMotionPreview()
  const sample = sampleBipedPetMotion(clip, requestedTimeMs, { adaptationPlan })
  const frame = controller.apply(sample, motionWeight)
  if (frame.rootMotion.status === 'blocked') {
    resetMotionPreview()
    return false
  }
  vfxPosition[0] = currentRuntime.object.position.x
  vfxPosition[1] = currentRuntime.object.position.y
  vfxPosition[2] = currentRuntime.object.position.z
  vfxForward.set(0, 0, 1).applyQuaternion(currentRuntime.object.quaternion)
  motionVfxFrame.requestedTimeMs = frame.rootMotion.requestedTimeMs
  motionVfxFrame.facingRadians = Math.atan2(vfxForward.x, vfxForward.z)
  vfxController.apply(frame.vfxSignals, motionVfxFrame)
  applyWeaponVfx(sample, currentRuntime, currentWeaponVfxController)
  if (propHandlesDirty) {
    motionAdaptationPlan.value = compileAdaptationPlan(clip)
    currentWeaponVfxController.reset()
    resetWeaponFrameHistory()
  }
  lastAppliedMotionTimeMs = frame.rootMotion.requestedTimeMs
  return true
}

function compileMotion(): boolean {
  // 先解除旧 clip；即使后续 reset/compile 抛错，watcher 也不能继续播放旧动作。 / Detach the old clip first so a later reset/compile failure cannot keep playing stale motion.
  motionClip.value = undefined
  // 新动作可能使用相同的播放时间或重叠接触区间；替换前必须主动清除上一动作的足底锚点。 / Clear previous foot anchors before replacing a clip, even when playback times or contact ranges overlap.
  resetMotionPreview()
  const currentRuntime = runtime.value
  const controller = motionController.value
  const vfxController = motionVfxController.value
  const currentWeaponConstraintController = weaponConstraintController.value
  const currentWeaponVfxController = weaponVfxController.value
  if (!currentRuntime || !controller || !vfxController || !currentWeaponConstraintController || !currentWeaponVfxController) {
    return false
  }
  if (!props.motionAsset) {
    motionAdaptationPlan.value = undefined
    return true
  }

  const compiledClip = compileBipedPetMotion(props.motionAsset, { boneIds: [...currentRuntime.bonesById.keys()] })
  if (compiledClip.status !== 'ready') {
    motionAdaptationPlan.value = undefined
    resetMotionPreview()
    return false
  }
  motionAdaptationPlan.value = compileAdaptationPlan(compiledClip)
  resetWeaponFrameHistory(true)
  motionClip.value = compiledClip
  return applyMotion()
}

function syncMotionAsset() {
  if (!runtime.value && lastRuntimeKey.value === undefined) createRuntime(props.recipe)
  synchronizePreview('compile', '动作编译', compileMotion, true)
}

function syncMotionFrame() {
  if (!runtime.value && lastRuntimeKey.value === undefined) createRuntime(props.recipe)
  synchronizePreview('frame', '动作采样', applyMotion)
}

function createRuntime(recipe: CharacterModelRecipeV1) {
  // 编译与材质都必须消费同一归一化配方，防止原始非法材质绕过稳定哈希。 / Compile and material creation share the normalized recipe so invalid input cannot diverge from the hash.
  const normalizedRecipe = normalizeBipedPetModelRecipe(recipe)
  const compilation = compileBipedPetCharacter(normalizedRecipe)
  activeCompilation.value = compilation
  const runtimeKey = compilationKey(compilation)
  if (lastRuntimeKey.value === runtimeKey) return
  // 在释放旧对象前固定处理键：父层回写同一摘要时不会触发重复创建或无限重试。 / Store the key before disposal so parent feedback cannot recreate the same runtime in a loop.
  lastRuntimeKey.value = runtimeKey
  try {
    disposeRuntime()
  } catch {
    emitCompilationIfChanged({
      ...compilation,
      status: 'blocked',
      diagnostics: [...compilation.diagnostics, {
        id: 'three-runtime-dispose-failure',
        severity: 'error',
        message: '复杂双足萌宠旧 Three 运行时释放失败，已安全停止预览。',
      }],
    })
    return
  }
  if (compilation.status !== 'ready') {
    emitCompilationIfChanged(compilation)
    return
  }

  let newRuntime: ComplexBipedPetObject | undefined
  let newController: ComplexBipedMotionController | undefined
  let newWeaponConstraintController: ComplexBipedWeaponConstraintController | undefined
  let newVfxController: ComplexBipedMotionVfxController | undefined
  let newWeaponVfxController: ComplexBipedWeaponVfxController | undefined
  try {
    newRuntime = createComplexBipedPetObject(compilation, normalizedRecipe.material)
    readRuntimeMetrics(newRuntime, compilation)
    newController = createComplexBipedMotionController(newRuntime, compilation, {
      beforeLegIk(context) {
        if (newWeaponConstraintController) applyWeaponConstraint(context, newWeaponConstraintController)
      },
    })
    newWeaponConstraintController = createComplexBipedWeaponConstraintController(newRuntime, compilation)
    newVfxController = createComplexBipedMotionVfxController()
    newWeaponVfxController = createComplexBipedWeaponVfxController()
    runtime.value = newRuntime
    motionController.value = newController
    weaponConstraintController.value = newWeaponConstraintController
    motionVfxController.value = newVfxController
    motionVfxObject.value = newVfxController.object
    weaponVfxController.value = newWeaponVfxController
    weaponVfxObject.value = newWeaponVfxController.object
  } catch (creationError) {
    // 创建中途失败时先解除响应式引用，再按创建逆序释放；不得让 primitive 继续持有半成品对象。 / On partial creation failure, detach reactive references and release in reverse order so primitive never retains a partial object.
    if (weaponVfxController.value === newWeaponVfxController) weaponVfxController.value = undefined
    if (weaponVfxObject.value === newWeaponVfxController?.object) weaponVfxObject.value = undefined
    if (motionVfxController.value === newVfxController) motionVfxController.value = undefined
    if (motionVfxObject.value === newVfxController?.object) motionVfxObject.value = undefined
    if (weaponConstraintController.value === newWeaponConstraintController) weaponConstraintController.value = undefined
    if (motionController.value === newController) motionController.value = undefined
    if (runtime.value === newRuntime) runtime.value = undefined
    motionClip.value = undefined
    motionAdaptationPlan.value = undefined
    const cleanupFailures = disposeResources(
      newWeaponVfxController,
      newVfxController,
      newWeaponConstraintController,
      newController,
      newRuntime,
    )
    const cleanupContext = cleanupFailures.length > 0 ? `；清理上下文：${cleanupFailures.join('；')}` : ''
    // 运行时异常必须转为可恢复诊断，不能让场景组件在更新配方时崩溃。 / Runtime failures become recoverable diagnostics instead of crashing the scene.
    emitCompilationIfChanged({
      ...compilation,
      status: 'blocked',
      diagnostics: [...compilation.diagnostics, {
        id: 'three-runtime-create-failure',
        severity: 'error',
        message: `复杂双足萌宠 Three 运行时创建失败：${diagnosticErrorMessage(creationError)}${cleanupContext}。已安全停止预览。`,
      }],
    })
    return
  }
  if (synchronizePreview('compile', '动作编译', compileMotion, true)) emitCompilationIfChanged(compilation)
}

watch(() => props.recipe, createRuntime, { deep: true, immediate: true })
watch(() => props.motionAsset, syncMotionAsset, { deep: true })
watch(() => [props.motionTimeMs, props.motionWeight] as const, syncMotionFrame)
onBeforeUnmount(() => {
  try { disposeRuntime() }
  catch { /* 卸载期间资源已尽力释放，避免把释放异常抛回 Vue 生命周期。 / Resource disposal was attempted during unmount; do not throw into Vue lifecycle. */ }
})
</script>

<template>
  <primitive v-if="runtime" :key="runtime.object.uuid" :object="runtime.object" :dispose="false" />
  <primitive v-if="motionVfxObject" :key="motionVfxObject.uuid" :object="motionVfxObject" :dispose="false" />
  <primitive v-if="weaponVfxObject" :key="weaponVfxObject.uuid" :object="weaponVfxObject" :dispose="false" />
  <!-- primitive 不渲染 Vue 默认插槽；道具组件必须作为同级节点实例化，再由自定义 attach 直挂 runtime Socket。 -->
  <ComplexBipedPropInstances
    v-if="runtime"
    :runtime="runtime"
    :instances="propInstances"
    :prop-assets="propAssets"
    :preserve-prop-materials="preservePropMaterials"
    @ready="onPropReady"
    @released="onPropReleased"
  />
</template>
