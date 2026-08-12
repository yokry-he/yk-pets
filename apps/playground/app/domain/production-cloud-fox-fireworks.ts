/**
 * 文件职责 / File responsibility
 * 提供 Chrome 扩展正式高空烟花秀的唯一花型、配色、发射原点与粒子方向算法，供 Studio 和扩展共同消费。
 * Provides the sole production Chrome fireworks shapes, palettes, launch origins, and particle-direction algorithms shared by Studio and the extension.
 */
import type { Vector3 } from 'three'

export const PRODUCTION_FIREWORK_BURST_COUNT = 3 as const
export const PRODUCTION_FIREWORK_PARTICLE_COUNT = 48 as const
export const PRODUCTION_FIREWORK_PALETTES = [
  ['#f7fbff', '#72f2ff', '#7a6fff', '#d788ff'],
  ['#fff7cf', '#ffd36a', '#ff8aae', '#ffffff'],
  ['#dffff4', '#52e0d0', '#7bd8ff', '#9a8cff'],
  ['#ffe9fb', '#ff91dc', '#a788ff', '#ffffff'],
] as const

export interface ProductionFireworkBurstPlan {
  index: number
  style: number
  originX: number
  originY: number
  palette: readonly string[]
}

export function createProductionFireworkBurstPlan(seed: number, index: number): ProductionFireworkBurstPlan {
  const safeIndex = Math.max(0, Math.min(PRODUCTION_FIREWORK_BURST_COUNT - 1, Math.trunc(index)))
  return {
    index: safeIndex,
    style: (seed + safeIndex) % 4,
    originX: [-.72, .68, 0][(seed + safeIndex) % 3] || 0,
    originY: 2.55 + ((seed + safeIndex) % 3) * .22,
    palette: PRODUCTION_FIREWORK_PALETTES[(seed + safeIndex * 2) % PRODUCTION_FIREWORK_PALETTES.length]!,
  }
}

export function writeProductionFireworkDirection(target: Vector3, style: number, particleIndex: number) {
  const angle = particleIndex / PRODUCTION_FIREWORK_PARTICLE_COUNT * Math.PI * 2
  if (style === 0) {
    const y = 1 - ((particleIndex + .5) / PRODUCTION_FIREWORK_PARTICLE_COUNT) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = particleIndex * 2.3999632297
    return target.set(Math.cos(theta) * radius, y * .92, Math.sin(theta) * radius * .48)
  }
  if (style === 1) return target.set(Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * .16).normalize()
  if (style === 2) {
    const x = Math.sin(angle) ** 3
    const y = (13 * Math.cos(angle) - 5 * Math.cos(angle * 2) - 2 * Math.cos(angle * 3) - Math.cos(angle * 4)) / 16
    return target.set(x, y, Math.sin(angle * 2) * .1).normalize()
  }
  const ray = particleIndex % 2 === 0 ? 1 : .44
  return target.set(Math.cos(angle) * ray, Math.sin(angle) * ray, Math.sin(particleIndex * 1.71) * .14).normalize()
}
