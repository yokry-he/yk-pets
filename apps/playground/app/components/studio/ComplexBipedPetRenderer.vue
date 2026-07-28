<!--
  文件职责 / File responsibility
  将复杂双足萌宠的站内配方适配为既有 Tres 场景中的一个 Three primitive。
  不创建 Canvas、不加载 GLB，也不承担动作、工坊表单或 Store 写回职责。
-->
<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import {
  compileBipedPetMotion,
  compileBipedPetCharacter,
  normalizeBipedPetModelRecipe,
  sampleBipedPetMotion,
  type CharacterCompilationDiagnostic,
  type CharacterModelRecipeV1,
  type CompiledCharacterModel,
  type EvaluatedMotionPropInstance,
  type StudioPropAssetV2,
  type StudioMotionAssetV2,
} from '@yk-pets/pet-core'
import {
  createComplexBipedPetObject,
  type ComplexBipedPetObject,
} from '~/three/create-complex-biped-pet-object'
import { createComplexBipedMotionController, type ComplexBipedMotionController } from '~/three/apply-complex-biped-motion'
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
const motionClip = shallowRef<ReturnType<typeof compileBipedPetMotion>>()

function diagnosticsKey(diagnostics: readonly CharacterCompilationDiagnostic[]) {
  return diagnostics.map(item => [item.id, item.severity, item.message, item.affectedSemantic ?? ''].join('\u0000')).join('\u0001')
}

function compilationKey(compilation: CompiledCharacterModel) {
  return [compilation.hash, compilation.status, diagnosticsKey(compilation.diagnostics)].join('\u0002')
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

function disposeRuntime() {
  motionController.value?.dispose()
  motionController.value = undefined
  motionClip.value = undefined
  const previous = runtime.value
  runtime.value = undefined
  previous?.dispose()
}

function applyMotion() {
  const controller = motionController.value
  const clip = motionClip.value
  if (!controller) return
  if (!clip || clip.status !== 'ready') {
    controller.reset()
    return
  }
  controller.apply(sampleBipedPetMotion(clip, props.motionTimeMs ?? 0), props.motionWeight ?? 1)
}

function compileMotion() {
  const currentRuntime = runtime.value
  const controller = motionController.value
  if (!currentRuntime || !controller) return
  if (!props.motionAsset) {
    motionClip.value = undefined
    controller.reset()
    return
  }
  motionClip.value = compileBipedPetMotion(props.motionAsset, { boneIds: [...currentRuntime.bonesById.keys()] })
  applyMotion()
}

function createRuntime(recipe: CharacterModelRecipeV1) {
  // 编译与材质都必须消费同一归一化配方，防止原始非法材质绕过稳定哈希。 / Compile and material creation share the normalized recipe so invalid input cannot diverge from the hash.
  const normalizedRecipe = normalizeBipedPetModelRecipe(recipe)
  const compilation = compileBipedPetCharacter(normalizedRecipe)
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

  try {
    runtime.value = createComplexBipedPetObject(compilation, normalizedRecipe.material)
    motionController.value = createComplexBipedMotionController(runtime.value)
    compileMotion()
    emitCompilationIfChanged(compilation)
  } catch {
    // 运行时异常必须转为可恢复诊断，不能让场景组件在更新配方时崩溃。 / Runtime failures become recoverable diagnostics instead of crashing the scene.
    emitCompilationIfChanged({
      ...compilation,
      status: 'blocked',
      diagnostics: [...compilation.diagnostics, {
        id: 'three-runtime-create-failure',
        severity: 'error',
        message: '复杂双足萌宠 Three 运行时创建失败，已安全停止预览。',
      }],
    })
  }
}

watch(() => props.recipe, createRuntime, { deep: true, immediate: true })
watch(() => props.motionAsset, compileMotion, { deep: true })
watch(() => [props.motionTimeMs, props.motionWeight] as const, applyMotion)
onBeforeUnmount(() => {
  try { disposeRuntime() }
  catch { /* 卸载期间资源已尽力释放，避免把释放异常抛回 Vue 生命周期。 / Resource disposal was attempted during unmount; do not throw into Vue lifecycle. */ }
})
</script>

<template>
  <primitive v-if="runtime" :key="runtime.object.uuid" :object="runtime.object" :dispose="false" />
  <!-- primitive 不渲染 Vue 默认插槽；道具组件必须作为同级节点实例化，再由自定义 attach 直挂 runtime Socket。 -->
  <ComplexBipedPropInstances v-if="runtime" :runtime="runtime" :instances="propInstances" :prop-assets="propAssets" :preserve-prop-materials="preservePropMaterials" />
</template>
