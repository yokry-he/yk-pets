/*
 * 文件职责 / File responsibility
 * 持久化统一 Studio 壳共享的当前外观、动作、道具、预览视角与背景，不混入各编辑器自己的撤销状态。
 * Persists the shared Studio-shell context for appearance, motion, prop, preview view, and background without mixing editor-specific undo state.
 */
import { defineStore } from 'pinia'
import { normalizeStudioModelMode, type StudioModelMode } from '~/domain/studio-model-variants'
import { STUDIO_SESSION_STORAGE_KEY, type StudioWorkspaceId } from '~/domain/studio-workspace'
import type { CloudFoxStudioBackground, CloudFoxStudioView } from '~/domain/pet-studio-phase3'

interface StudioSessionState {
  hydrated: boolean
  selectedAppearanceId: string
  selectedMotionId: string
  selectedPropId: string
  previewView: CloudFoxStudioView
  previewBackground: CloudFoxStudioBackground
  modelMode: StudioModelMode
  lastWorkspace: StudioWorkspaceId
}

const DEFAULT_STATE: Omit<StudioSessionState, 'hydrated'> = {
  selectedAppearanceId: 'active-appearance',
  selectedMotionId: '',
  selectedPropId: '',
  previewView: 'front',
  previewBackground: 'dark',
  modelMode: 'simple',
  lastWorkspace: 'appearance',
}

export const useStudioSessionStore = defineStore('studio-session', {
  state: (): StudioSessionState => ({ hydrated: false, ...DEFAULT_STATE }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      try {
        const stored = JSON.parse(localStorage.getItem(STUDIO_SESSION_STORAGE_KEY) || '{}') as Partial<StudioSessionState>
        Object.assign(this, DEFAULT_STATE, stored, { hydrated: true })
        this.modelMode = normalizeStudioModelMode(stored.modelMode)
      }
      catch {
        Object.assign(this, DEFAULT_STATE, { hydrated: true })
      }
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STUDIO_SESSION_STORAGE_KEY, JSON.stringify({
        selectedAppearanceId: this.selectedAppearanceId,
        selectedMotionId: this.selectedMotionId,
        selectedPropId: this.selectedPropId,
        previewView: this.previewView,
        previewBackground: this.previewBackground,
        modelMode: this.modelMode,
        lastWorkspace: this.lastWorkspace,
      }))
    },
    setWorkspace(workspace: StudioWorkspaceId) {
      this.lastWorkspace = workspace
      this.persist()
    },
    selectAppearance(id: string) {
      this.selectedAppearanceId = id
      this.persist()
    },
    selectMotion(id: string) {
      this.selectedMotionId = id
      this.persist()
    },
    selectProp(id: string) {
      this.selectedPropId = id
      this.persist()
    },
    setPreview(view: CloudFoxStudioView, background: CloudFoxStudioBackground) {
      this.previewView = view
      this.previewBackground = background
      this.persist()
    },
    setModelMode(mode: StudioModelMode) {
      this.modelMode = normalizeStudioModelMode(mode)
      this.persist()
    },
  },
})
