/*
 * 文件职责 / File responsibility
 * 管理共享 Studio 资产库中的版本化动作与道具元数据，并迁移旧本地动作后持久化到 v2 存储。
 * Manages versioned motion and prop metadata in the shared Studio asset library, migrating legacy local motions into v2 storage.
 */
import {
  addPropComponent,
  createStudioMotionAsset,
  createStudioPropAsset,
  duplicatePropComponent,
  normalizeDisplayFps,
  normalizeMotionAsset,
  normalizeMotionAssetCollection,
  normalizePropAsset,
  normalizePropAssetCollection,
  removePropComponent,
  setPropLocalModel,
  updatePropAnchor,
  updatePropComponent,
} from '@yk-pets/pet-core'
import { defineStore } from 'pinia'
import {
  STUDIO_ASSET_LEGACY_STORAGE_KEY,
  STUDIO_ASSET_STORAGE_KEY,
  createStudioAssetId,
  type StudioMotionAssetMetadata,
  type StudioMotionLoopMode,
  type StudioPropAssetMetadata,
  type StudioPropAnchorId,
  type StudioPropKind,
  type StudioPropPrimitive,
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
        const current = localStorage.getItem(STUDIO_ASSET_STORAGE_KEY)
        const legacy = current ? null : localStorage.getItem(STUDIO_ASSET_LEGACY_STORAGE_KEY)
        const stored = JSON.parse(current || legacy || '{}') as Partial<StudioAssetState>
        this.motions = normalizeMotionAssetCollection(stored.motions)
        this.props = normalizePropAssetCollection(stored.props)
        this.hydrated = true
        if (!current && legacy) this.persist()
      }
      catch {
        this.motions = []
        this.props = []
        this.hydrated = true
      }
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STUDIO_ASSET_STORAGE_KEY, JSON.stringify({ motions: this.motions, props: this.props }))
    },
    createMotion(input: Partial<Pick<StudioMotionAssetMetadata, 'nameZh' | 'nameEn' | 'durationMs' | 'displayFps' | 'loopMode' | 'authoringAppearanceId'>> = {}) {
      const now = Date.now()
      const motion = createStudioMotionAsset({
        id: createStudioAssetId('motion'),
        nameZh: input.nameZh || `新动作 ${this.motions.length + 1}`,
        nameEn: input.nameEn || `Motion ${this.motions.length + 1}`,
        durationMs: input.durationMs ?? 1200,
        displayFps: input.displayFps ?? 30,
        loopMode: input.loopMode || 'once',
        authoringAppearanceId: input.authoringAppearanceId || 'active-appearance',
        propIds: [],
        tracks: [],
        createdAt: now,
        updatedAt: now,
      })
      this.motions.unshift(motion)
      this.persist()
      return motion
    },
    updateMotion(id: string, patch: Partial<Pick<StudioMotionAssetMetadata, 'nameZh' | 'nameEn' | 'durationMs' | 'displayFps' | 'loopMode' | 'propIds'>>) {
      const motion = this.motions.find(item => item.id === id)
      if (!motion) return
      Object.assign(motion, patch, { updatedAt: Date.now() })
      motion.durationMs = Math.max(100, Math.min(60000, motion.durationMs))
      motion.displayFps = normalizeDisplayFps(motion.displayFps)
      motion.loopMode = (['once', 'loop', 'ping-pong'] as StudioMotionLoopMode[]).includes(motion.loopMode) ? motion.loopMode : 'once'
      Object.assign(motion, normalizeMotionAsset(motion).asset)
      this.persist()
    },
    replaceMotion(asset: StudioMotionAssetMetadata) {
      const index = this.motions.findIndex(item => item.id === asset.id)
      if (index < 0) this.motions.unshift(normalizeMotionAsset(asset).asset)
      else this.motions[index] = normalizeMotionAsset(asset).asset
      this.persist()
      return this.motions.find(item => item.id === asset.id)
    },
    deleteMotion(id: string) {
      this.motions = this.motions.filter(item => item.id !== id)
      this.persist()
    },
    createProp(input: Partial<Pick<StudioPropAssetMetadata, 'nameZh' | 'nameEn' | 'kind' | 'defaultAnchor'>> = {}) {
      const now = Date.now()
      const prop = createStudioPropAsset({
        id: createStudioAssetId('prop'),
        nameZh: input.nameZh || `新道具 ${this.props.length + 1}`,
        nameEn: input.nameEn || `Prop ${this.props.length + 1}`,
        kind: input.kind || 'composite',
        defaultAnchor: input.defaultAnchor || 'right-front-paw',
        createdAt: now,
        updatedAt: now,
      })
      this.props.unshift(prop)
      this.persist()
      return prop
    },
    updateProp(id: string, patch: Partial<Pick<StudioPropAssetMetadata, 'nameZh' | 'nameEn' | 'kind' | 'defaultAnchor'>>) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      const normalized = normalizePropAsset({ ...prop, ...patch, updatedAt: Date.now() }).asset
      Object.assign(prop, normalized)
      this.persist()
    },
    replaceProp(asset: StudioPropAssetMetadata) {
      const normalized = normalizePropAsset(asset).asset
      const index = this.props.findIndex(item => item.id === normalized.id)
      if (index < 0) this.props.unshift(normalized)
      else this.props[index] = normalized
      this.persist()
      return normalized
    },
    duplicateProp(id: string) {
      const source = this.props.find(item => item.id === id)
      if (!source) return
      const now = Date.now()
      const copy = normalizePropAsset({ ...structuredClone(source), id: createStudioAssetId('prop'), nameZh: `${source.nameZh} 副本`, nameEn: `${source.nameEn} Copy`, createdAt: now, updatedAt: now }).asset
      this.props.unshift(copy)
      this.persist()
      return copy
    },
    addPropComponent(id: string, primitive: StudioPropPrimitive, parentId?: string) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      const componentId = `component-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      return this.replaceProp(addPropComponent(prop, primitive, componentId, parentId))
    },
    duplicatePropComponent(id: string, componentId: string) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      const newId = `component-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      return this.replaceProp(duplicatePropComponent(prop, componentId, newId))
    },
    updatePropComponent(id: string, componentId: string, patch: Parameters<typeof updatePropComponent>[2]) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      return this.replaceProp(updatePropComponent(prop, componentId, patch))
    },
    removePropComponent(id: string, componentId: string) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      return this.replaceProp(removePropComponent(prop, componentId))
    },
    setPropLocalModel(id: string, localModel?: Parameters<typeof setPropLocalModel>[1]) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      return this.replaceProp(setPropLocalModel(prop, localModel))
    },
    updatePropAnchor(id: string, anchorId: StudioPropAnchorId, patch: Parameters<typeof updatePropAnchor>[2]) {
      const prop = this.props.find(item => item.id === id)
      if (!prop) return
      return this.replaceProp(updatePropAnchor(prop, anchorId, patch))
    },
    importProp(input: unknown) {
      const now = Date.now()
      const prop = normalizePropAsset(input, { fallbackId: createStudioAssetId('prop'), now }).asset
      if (this.props.some(item => item.id === prop.id)) prop.id = createStudioAssetId('prop')
      prop.updatedAt = now
      this.props.unshift(prop)
      this.persist()
      return prop
    },
    deleteProp(id: string) {
      this.props = this.props.filter(item => item.id !== id)
      for (const motion of this.motions) motion.propIds = motion.propIds.filter(propId => propId !== id)
      this.persist()
    },
  },
})
