<!--
  文件职责 / File responsibility
  Playground 3D 宠物画布与灯光装配。
  Playground 3D pet canvas and lighting assembly.
-->
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import CloudFox from './CloudFox.vue'
import { Euler, Vector3 } from 'three'
import type { PetEmotion } from '~/types/pet'

function vec3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

function euler(x: number, y: number, z: number) {
  return new Euler(x, y, z)
}

const props = defineProps<{
  behavior: string
  emotion: PetEmotion
  speaking: boolean
  pointer: { x: number; y: number }
  secretMode: boolean
  theme: 'dark' | 'light'
}>()

const emit = defineEmits<{
  pet: []
}>()

const backgroundColor = computed(() => props.theme === 'dark' ? '#080a12' : '#eef1ff')
</script>

<template>
  <div
    class="pet-canvas"
    role="button"
    tabindex="0"
    aria-label="触摸 NOVA"
    @click="emit('pet')"
    @keydown.enter="emit('pet')"
    @keydown.space.prevent="emit('pet')"
  >
    <TresCanvas
      :clear-color="backgroundColor"
      :dpr="[1, 1.7]"
      shadows
      alpha
      antialias
    >
      <TresPerspectiveCamera :position="vec3(0, 1.35, 6.15)" :fov="38" />

      <TresAmbientLight :intensity="theme === 'dark' ? 1.05 : 1.55" />
      <TresDirectionalLight
        :position="vec3(4, 6, 4)"
        :intensity="theme === 'dark' ? 3.8 : 2.7"
        cast-shadow
      />
      <TresPointLight
        :position="vec3(-4, 1, 2)"
        :intensity="secretMode ? 8 : 4"
        color="#7667ff"
      />
      <TresPointLight
        :position="vec3(3, -1, 2)"
        :intensity="secretMode ? 7 : 3"
        color="#50e3d1"
      />

      <CloudFox
        :behavior="behavior"
        :emotion="emotion"
        :speaking="speaking"
        :pointer="pointer"
        :secret-mode="secretMode"
        :theme="theme"
      />
    </TresCanvas>

    <div class="canvas-vignette" />
    <div class="touch-hint">点击或按空格和它互动</div>
  </div>
</template>
