<!--
  文件职责 / File responsibility
  在本地解析通过安全校验的 GLB 数据 URL，并把场景对象挂载到现有 Tres 场景，不执行网络加载。
  Parses a safety-validated local GLB data URL and mounts its scene object into the existing Tres scene without network loading.
-->
<script setup lang="ts">
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Group, Object3D } from 'three'

const props = defineProps<{ dataUrl: string }>()
const host = shallowRef<Group>()
let loaded: Object3D | null = null
function clear() { if (loaded && host.value) host.value.remove(loaded); loaded = null }
async function load() {
  clear()
  const comma = props.dataUrl.indexOf(',')
  if (comma < 0 || !host.value) return
  const binary = atob(props.dataUrl.slice(comma + 1))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const loader = new GLTFLoader()
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  loader.parse(buffer, '', gltf => { loaded = gltf.scene; host.value?.add(gltf.scene) }, () => {})
}
watch(() => props.dataUrl, load)
onMounted(load)
onBeforeUnmount(clear)
</script>

<template><TresGroup ref="host" /></template>
