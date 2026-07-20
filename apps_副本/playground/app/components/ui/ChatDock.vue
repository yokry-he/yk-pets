<!--
  文件职责 / File responsibility
  演示页聊天输入和宠物命令面板。
  Demo chat input and pet-command panel.
-->
<script setup lang="ts">
import type { ChatMessage } from '~/types/pet'

const props = defineProps<{
  messages: ChatMessage[]
  thinking: boolean
}>()

const emit = defineEmits<{
  submit: [message: string]
}>()

const input = ref('')
const scrollArea = ref<HTMLElement>()

const suggestions = [
  '你会什么？',
  '给我打个招呼',
  '跳一下',
  '扑腾一下前爪',
  '趴下休息',
  '展示你的真正能力',
]

function send(message = input.value) {
  const value = message.trim()
  if (!value || props.thinking) return
  emit('submit', value)
  input.value = ''
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight, behavior: 'smooth' })
  },
)
</script>

<template>
  <aside class="chat-dock" aria-label="与 NOVA 对话">
    <div class="chat-heading">
      <div>
        <span class="chat-label">AGENT CHANNEL</span>
        <h2>和 NOVA 聊聊</h2>
      </div>
      <span class="online-indicator"><i /> ONLINE</span>
    </div>

    <div ref="scrollArea" class="chat-messages" aria-live="polite">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="`message--${message.role}`"
      >
        <span class="message-author">{{ message.role === 'pet' ? 'NOVA' : 'YOU' }}</span>
        <p>{{ message.content }}</p>
      </div>

      <div v-if="thinking" class="message message--pet message--thinking">
        <span class="message-author">NOVA</span>
        <div class="thinking-dots"><i /><i /><i /></div>
      </div>
    </div>

    <div class="suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        :disabled="thinking"
        @click="send(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <form class="chat-form" @submit.prevent="send()">
      <label class="sr-only" for="pet-message">输入给 NOVA 的消息</label>
      <input
        id="pet-message"
        v-model="input"
        maxlength="180"
        autocomplete="off"
        placeholder="输入一句话，比如：跳一下"
        :disabled="thinking"
      >
      <button type="submit" :disabled="thinking || !input.trim()" aria-label="发送">
        <span>发送</span>
        <b>↗</b>
      </button>
    </form>
  </aside>
</template>
