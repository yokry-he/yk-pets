/**
 * 文件职责 / File responsibility
 * 定义网页记忆徽章与 Side Panel 之间的一次性当前页面筛选请求。
 * Defines the one-shot current-page filter request shared by the in-page memory badge and Side Panel.
 */
import { normalizeMemoryPageUrl } from './pet-memory'

export const PET_MEMORY_CURRENT_PAGE_REQUEST_KEY = 'yk-pets:pending-current-page-filter:v1'
export const PET_MEMORY_CURRENT_PAGE_REQUEST_TTL_MS = 30_000

export interface PetMemoryCurrentPageRequest {
  pageUrl: string
  pageTitle: string
  createdAt: number
}

export function normalizePetMemoryCurrentPageRequest(value: unknown): PetMemoryCurrentPageRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const pageUrl = normalizeMemoryPageUrl(typeof record.pageUrl === 'string' ? record.pageUrl : undefined)
  const pageTitle = typeof record.pageTitle === 'string' ? record.pageTitle.trim().slice(0, 300) : ''
  const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Number.NaN
  if (!pageUrl || !Number.isFinite(createdAt)) return null
  if (Date.now() - createdAt > PET_MEMORY_CURRENT_PAGE_REQUEST_TTL_MS) return null
  return {
    pageUrl,
    pageTitle: pageTitle || '当前页面',
    createdAt,
  }
}
