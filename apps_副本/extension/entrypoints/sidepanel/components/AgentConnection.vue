<!--
  文件职责 / File responsibility
  Local Agent 连接表单与连接状态展示。
  Local Agent connection form and connection-status presentation.
-->
<script setup lang="ts">
import type { ProjectInfo } from '@nova/shared/protocol'

const props = defineProps<{
  url: string
  token: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error: string
  project: ProjectInfo | null
}>()

const emit = defineEmits<{
  'update:url': [value: string]
  'update:token': [value: string]
  connect: []
  disconnect: []
}>()
</script>

<template>
  <section class="agent-connection">
    <div class="section-title">
      <div>
        <span>LOCAL AGENT</span>
        <h2>连接本地项目</h2>
      </div>
      <i :class="status" />
    </div>

    <div v-if="project" class="project-card">
      <strong>{{ project.name }}</strong>
      <span>{{ project.framework }} · {{ project.packageManager }}</span>
      <code>{{ project.root }}</code>
    </div>

    <label>
      <span>WebSocket 地址</span>
      <input :value="url" placeholder="ws://127.0.0.1:4736" @input="emit('update:url', ($event.target as HTMLInputElement).value)">
    </label>
    <label>
      <span>连接口令</span>
      <input :value="token" type="password" placeholder="CLI 终端中显示的口令" @input="emit('update:token', ($event.target as HTMLInputElement).value)">
    </label>

    <p v-if="error" class="connection-error">{{ error }}</p>

    <button v-if="status !== 'connected'" class="connect-button" type="button" :disabled="status === 'connecting' || !token" @click="emit('connect')">
      {{ status === 'connecting' ? '连接中…' : '连接 Agent' }}
    </button>
    <button v-else class="disconnect-button" type="button" @click="emit('disconnect')">断开连接</button>
  </section>
</template>
