/*
 * 文件职责 / File responsibility
 * 管理共享 Studio 资产库中的自定义动作与道具元数据，并提供本地创建、更新、删除和持久化能力。
 * Manages custom motion and prop metadata in the shared Studio asset library with local create, update, delete, and persistence operations.
 */
import { defineStore } from 'pinia'
import {
  STUDIO_ASSET_STORAGE_KEY,
  createStudioAssetId,
  type StudioMotionAssetMetadata,
  type StudioMotionLoopMode,
  type StudioPropAssetMetadata,
  type StudioPropKind,
} from '~/domain/studio-workspace'

interface StudioAssetState {
  hydrated: boolean
  motions: StudioMotionAssetMetadata[]
  props: StudioPropAssetMetadata[]
}

export const useStudioAssetStore = defineStore('studio-assets', {
  state: (): StudioAssetState => ({ hydrated: false, motions: [], props: [] }),
  getters: {
    motionCount: state => state.motions.length,
    propCount: state => state.props.length,
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      try {
        const stored = JSON.parse(localStorage.getItem(STUDIO_ASSET_STORAGE_KEY) || '{}') as Partial<StudioAssetState>
        this.motions = Array.isArray(stored.motions) ? stored.motions : []
        this.props = Array.isArray(stored.props) ? stored.props : []
      }
      catch {
        this.motions = []
        this.props = []
      }
      this.hydrated = true
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STUDIO_ASSET_STORAGE_KEY, JSON.stringify({ motions: this.motions, props: this.props }))
    },
    createMotion(input: Partial<Pick<StudioMotionAssetMetadata, 'nameZh' | 'nameEn' | 'durationMs' | 'loopMode' | 'appearanceId'>> = {}) {
      const now = Date.now()
      const motion: StudioMotionAssetMetadata = {
        id: createStudioAssetId('motion'),
        nameZh: input.nameZh || `新动作 ${this.motions.length + 1}`,
        nameEn: input.nameEn || `Motion ${this.motions.length + 1}`,
        durationMs: input.durationMs ?? 1200,
        loopMode: input.loopMode || 'once',
        appearanceId: input.appearanceId || 'active-appearance',
        propIds: [],
        createdAt: now,
        updatedAt: now,
      }
      this.motions.unshift(motion)
      this.persist()
      return motion
    },
    updateMotion(id: string, patch: Partial<Pick<StudioMotionAssetMetadata, 'nameZh' | 'nameEn' | 'durationMs' | 'loopMode' | 'propIds'>>) {
      const motion = this.motions.find(item => item.id === id)
      if (!motion) return
      Object.assign(motion, patch, { updatedAt: Date.now() })
      motion.durationMs = Math.max(100, Math.min(60000, motion.durationMs))
      motion.loopMode = (['once', 'loop', 'ping-pong'] as StudioMotionLoopMode[]).includes(motion.loopMode) ? motion.loopMode : 'once'
      this.persist()
    },
    deleteMotion(id: string) {
      this.motions = this.motions.filter(item => item.id !== id)
      this.persist()
    },
    createProp(input: Partial<Pick<StudioPropAssetMetadata, 'nameZh' | 'nameEn' | 'kind' | 'defaultAnchor'>> = {}) {
      const now = Date.now()
      const prop: StudioPropAssetMetadata = {
        id: createStudioAssetId('prop'),
        nameZh: input.nameZh || `新道具 ${this.props.length + 1}`,
        nameEn: input.nameEn || `Prop ${this.props.length + 1}`,
        kind: input.kind || 'composite',
        defaultAnchor: input.defaultAnchor || 'right-front-paw',
        anchorIds: ['origin', 'grip', 'display', 'emitter'],
        createdAt: now,
        updatedAt: now,
      }
      this.props.unshift(prop)
      this.persist()
      return prop
    },
    updateProp(id: string, patch: Partial<Pick<StudioPropAssetMetadata, 'nameZh' | 'nameEn' | 'kind' | 'defaultAnchor' | 'anchorIds'>>) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      Object.assign(prop, patch, { updatedAt: Date.now() })
      prop.kind = (['composite', 'effect'] as StudioPropKind[]).includes(prop.kind) ? prop.kind : 'composite'
      this.persist()
    },
    deleteProp(id: string) {
      this.props = this.props.filter(item => item.id !== id)
      for (const motion of this.motions) motion.propIds = motion.propIds.filter(propId => propId !== id)
      this.persist()
    },
  },
})
