<!--
  文件职责 / File responsibility
  将复杂双足萌宠的站内配方适配为既有 Tres 场景中的一个 Three primitive。
  不创建 Canvas、不加载 GLB，也不承担动作、工坊表单或 Store 写回职责。
-->
<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import {
  compileBipedPetCharacter,
  normalizeBipedPetModelRecipe,
  type CharacterCompilationDiagnostic,
  type CharacterModelRecipeV1,
  type CompiledCharacterModel,
} from '@yk-pets/pet-core'
import {
  createComplexBipedPetObject,
  type ComplexBipedPetObject,
} from '~/three/create-complex-biped-pet-object'

const props = defineProps<{ recipe: CharacterModelRecipeV1 }>()
const emit = defineEmits<{
  compilation: [payload: Pick<CompiledCharacterModel, 'hash' | 'status' | 'diagnostics'>]
}>()

// Three 实例包含循环引用和原生资源，必须保留为浅引用，不能交给 Vue 深代理。 / Three instances stay shallow to avoid proxying circular native resources.
const runtime = shallowRef<ComplexBipedPetObject>()
const lastEmitted = shallowRef<{ hash: string, status: CompiledCharacterModel['status'], diagnosticsKey: string }>()
const lastRuntimeKey = shallowRef<string>()

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
  const previous = runtime.value
  runtime.value = undefined
  previous?.dispose()
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
onBeforeUnmount(() => {
  try { disposeRuntime() }
  catch { /* 卸载期间资源已尽力释放，避免把释放异常抛回 Vue 生命周期。 / Resource disposal was attempted during unmount; do not throw into Vue lifecycle. */ }
})
</script>

<template>
  <primitive v-if="runtime" :object="runtime.object" :dispose="false" />
</template>
