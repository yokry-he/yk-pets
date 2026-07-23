/**
 * 文件职责 / File responsibility
 * 封装 Side Panel 中宠物记忆卡的后台消息、乐观状态和跨上下文刷新。
 * Encapsulates pet-memory background messaging, optimistic state, and cross-context refresh for the Side Panel.
 */
import { onBeforeUnmount, ref } from 'vue'
import type {
  PetMemoryCard,
  PetMemoryCreateInput,
  PetMemoryUpdatePatch,
} from '@nova/shared/pet-memory'
import type { NovaRuntimeMessage } from '@nova/shared/messages'

export function usePetMemory() {
  const cards = ref<PetMemoryCard[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      const response = await chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_LIST' } satisfies NovaRuntimeMessage) as {
        ok?: boolean
        cards?: PetMemoryCard[]
        error?: string
      } | undefined
      if (!response?.ok || !response.cards) throw new Error(response?.error || '无法读取宠物记忆。')
      cards.value = response.cards
      return cards.value
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return []
    }
    finally {
      loading.value = false
    }
  }

  async function create(input: PetMemoryCreateInput) {
    saving.value = true
    error.value = ''
    try {
      const response = await chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_CREATE', input } satisfies NovaRuntimeMessage) as {
        ok?: boolean
        card?: PetMemoryCard
        error?: string
      } | undefined
      if (!response?.ok || !response.card) throw new Error(response?.error || '无法保存宠物记忆。')
      cards.value = [response.card, ...cards.value.filter(card => card.id !== response.card?.id)]
      return response.card
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  async function update(cardId: string, patch: PetMemoryUpdatePatch) {
    saving.value = true
    error.value = ''
    try {
      const response = await chrome.runtime.sendMessage({ type: 'YK_PET_MEMORY_UPDATE', cardId, patch } satisfies NovaRuntimeMessage) as {
        ok?: boolean
        card?: PetMemoryCard
        error?: string
      } | undefined
      if (!response?.ok || !response.card) throw new Error(response?.error || '无法更新宠物记忆。')
      cards.value = cards.value
        .map(card => card.id === response.card?.id ? response.card : card)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      return response.card
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  async function archive(cardId: string) {
    return await update(cardId, { status: 'archived' })
  }

  function onRuntimeMessage(message: NovaRuntimeMessage) {
    if (message.type !== 'YK_PET_MEMORY_UPDATED') return
    refresh().catch(() => undefined)
  }

  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  onBeforeUnmount(() => chrome.runtime.onMessage.removeListener(onRuntimeMessage))

  return {
    cards,
    loading,
    saving,
    error,
    refresh,
    create,
    update,
    archive,
  }
}
