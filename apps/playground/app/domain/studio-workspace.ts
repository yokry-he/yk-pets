/*
 * 文件职责 / File responsibility
 * 定义统一 Studio 壳的工作区、共享会话上下文、版本化动作资产和道具元数据契约。
 * Defines workspace navigation, shared session context, versioned motion assets, and prop metadata contracts for the unified Studio shell.
 */
import type { StudioMotionAssetV2 } from '@yk-pets/pet-core'
export type { StudioMotionLoopMode } from '@yk-pets/pet-core'

export type StudioWorkspaceId = 'appearance' | 'motion' | 'props' | 'library'
export type StudioPropKind = 'composite' | 'effect'

export interface StudioWorkspaceDefinition {
  id: StudioWorkspaceId
  label: string
  labelEn: string
  description: string
  path: string
}

export type StudioMotionAssetMetadata = StudioMotionAssetV2

export interface StudioPropAssetMetadata {
  id: string
  nameZh: string
  nameEn: string
  kind: StudioPropKind
  defaultAnchor: string
  anchorIds: string[]
  createdAt: number
  updatedAt: number
}

export const STUDIO_WORKSPACES: readonly StudioWorkspaceDefinition[] = Object.freeze([
  { id: 'appearance', label: '外观工坊', labelEn: 'Appearance', description: '基础外观、静态结构与默认姿态', path: '/studio/appearance' },
  { id: 'motion', label: '动作工坊', labelEn: 'Motion', description: '时间轴、关键帧、表情与道具事件', path: '/studio/motion' },
  { id: 'props', label: '道具工坊', labelEn: 'Props', description: '道具结构、材质、抓握点与发射点', path: '/studio/props' },
  { id: 'library', label: '资产库', labelEn: 'Library', description: '外观、动作、道具与依赖关系', path: '/studio/library' },
])

export const STUDIO_SESSION_STORAGE_KEY = 'yk-pets:studio:session:v1'
export const STUDIO_ASSET_STORAGE_KEY = 'yk-pets:studio:assets:v2'
export const STUDIO_ASSET_LEGACY_STORAGE_KEY = 'yk-pets:studio:assets:v1'

export function createStudioAssetId(prefix: 'motion' | 'prop') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function resolveStudioWorkspace(path: string): StudioWorkspaceId {
  if (path.startsWith('/studio/motion')) return 'motion'
  if (path.startsWith('/studio/props')) return 'props'
  if (path.startsWith('/studio/library')) return 'library'
  return 'appearance'
}
