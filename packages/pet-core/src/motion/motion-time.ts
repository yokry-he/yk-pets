/**
 * 文件职责 / File responsibility
 * 提供以毫秒为唯一存储单位的动作时间解析、循环映射与 FPS 显示网格换算。
 * Provides millisecond-native motion timing, loop resolution, and FPS display-grid conversion.
 */

export type StudioMotionLoopMode = 'once' | 'loop' | 'ping-pong'

export interface ResolvedMotionTime {
  requestedTimeMs: number
  resolvedTimeMs: number
  direction: 1 | -1
  iteration: number
}

const finiteNumber = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positiveModulo = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus

export function normalizeMotionDurationMs(value: unknown): number {
  return Math.max(100, Math.min(60000, Math.round(finiteNumber(value, 1200))))
}

export function normalizeDisplayFps(value: unknown): number {
  return Math.max(1, Math.min(240, Math.round(finiteNumber(value, 30))))
}

export function normalizeMotionLoopMode(value: unknown): StudioMotionLoopMode {
  return value === 'loop' || value === 'ping-pong' ? value : 'once'
}

export function frameToMilliseconds(frame: number, fps: number): number {
  return finiteNumber(frame) * 1000 / normalizeDisplayFps(fps)
}

export function millisecondsToFrame(timeMs: number, fps: number): number {
  return finiteNumber(timeMs) * normalizeDisplayFps(fps) / 1000
}

export function snapMillisecondsToFrame(timeMs: number, fps: number): number {
  return Math.round(frameToMilliseconds(Math.round(millisecondsToFrame(timeMs, fps)), fps))
}

export function resolveMotionTime(timeMs: number, durationMs: number, loopMode: StudioMotionLoopMode): ResolvedMotionTime {
  const requestedTimeMs = finiteNumber(timeMs)
  const duration = normalizeMotionDurationMs(durationMs)
  const mode = normalizeMotionLoopMode(loopMode)

  if (mode === 'once') {
    return {
      requestedTimeMs,
      resolvedTimeMs: Math.max(0, Math.min(duration, requestedTimeMs)),
      direction: 1,
      iteration: 0,
    }
  }

  if (mode === 'loop') {
    return {
      requestedTimeMs,
      resolvedTimeMs: positiveModulo(requestedTimeMs, duration),
      direction: 1,
      iteration: Math.floor(requestedTimeMs / duration),
    }
  }

  const iteration = Math.floor(requestedTimeMs / duration)
  const segmentTime = positiveModulo(requestedTimeMs, duration)
  const forward = positiveModulo(iteration, 2) === 0
  return {
    requestedTimeMs,
    resolvedTimeMs: forward ? segmentTime : duration - segmentTime,
    direction: forward ? 1 : -1,
    iteration,
  }
}
