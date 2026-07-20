/**
 * 文件职责 / File responsibility
 * Playground 宠物身份、状态和命令 Store。
 * Playground pet identity, state, and command store.
 */
import { defineStore } from 'pinia'
import { ZEPH_CLOUD_FOX_IDENTITY } from '@nova/shared/brand'
import type { PetEmotion, PetTheme } from '~/types/pet'

interface PersistedPetState {
  petId: string
  theme: PetTheme
  affection: number
  interactions: number
  secretUnlocked: boolean
  lastVisit: string
}

const STORAGE_KEY = 'yk-pets:playground:pet-state:v2'
const LEGACY_STORAGE_KEY = 'nuxt-ai-pet-state-v1'

export const usePetStore = defineStore('pet', {
  state: () => ({
    petId: ZEPH_CLOUD_FOX_IDENTITY.id,
    speciesId: ZEPH_CLOUD_FOX_IDENTITY.speciesId,
    name: ZEPH_CLOUD_FOX_IDENTITY.name['zh-CN'],
    nameEn: ZEPH_CLOUD_FOX_IDENTITY.name.en,
    species: ZEPH_CLOUD_FOX_IDENTITY.species['zh-CN'],
    speciesEn: ZEPH_CLOUD_FOX_IDENTITY.species.en,
    theme: 'dark' as PetTheme,
    emotion: 'neutral' as PetEmotion,
    affection: 18,
    interactions: 0,
    secretUnlocked: false,
    lastVisit: '',
    hydrated: false,
  }),

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return

      const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<PersistedPetState>
          if (saved.petId === ZEPH_CLOUD_FOX_IDENTITY.id) this.petId = saved.petId
          if (saved.theme === 'dark' || saved.theme === 'light') this.theme = saved.theme
          if (typeof saved.affection === 'number') this.affection = Math.min(100, Math.max(0, saved.affection))
          if (typeof saved.interactions === 'number') this.interactions = Math.max(0, saved.interactions)
          if (typeof saved.secretUnlocked === 'boolean') this.secretUnlocked = saved.secretUnlocked
          if (typeof saved.lastVisit === 'string') this.lastVisit = saved.lastVisit
        }
        catch {
          window.localStorage.removeItem(STORAGE_KEY)
          window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      }

      this.lastVisit = new Date().toISOString()
      this.hydrated = true
      this.persist()
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    },

    persist() {
      if (!import.meta.client) return
      const payload: PersistedPetState = {
        petId: this.petId,
        theme: this.theme,
        affection: this.affection,
        interactions: this.interactions,
        secretUnlocked: this.secretUnlocked,
        lastVisit: this.lastVisit,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    },

    interact(amount = 2) {
      this.interactions += 1
      this.affection = Math.min(100, this.affection + amount)
      this.persist()
    },

    setEmotion(emotion: PetEmotion) {
      this.emotion = emotion
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      this.persist()
    },

    unlockSecret() {
      this.secretUnlocked = true
      this.affection = Math.min(100, this.affection + 8)
      this.persist()
    },
  },
})
