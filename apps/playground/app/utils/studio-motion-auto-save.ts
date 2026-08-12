/**
 * 文件职责 / File responsibility
 * 协调动作草稿的延迟持久化与活动编辑手势边界。
 * Coordinates delayed motion-draft persistence with active editing gesture boundaries.
 */
export type StudioMotionAutoSaveState = 'saving' | 'saved' | 'failed'
export type StudioMotionGestureOutcome = 'committed' | 'cancelled'

export interface StudioMotionAutoSaveClock<TTimer> {
  setTimeout(callback: () => void, delayMs: number): TTimer
  clearTimeout(id: TTimer): void
}

export interface StudioMotionAutoSaveOptions<TTimer> {
  delayMs: number
  clock: StudioMotionAutoSaveClock<TTimer>
  isDirty(): boolean
  isGestureActive(): boolean
  persist(): boolean
  setState(state: StudioMotionAutoSaveState): void
}

export function createStudioMotionAutoSaveController<TTimer>(options: StudioMotionAutoSaveOptions<TTimer>) {
  let timer: TTimer | undefined
  let saveRequested = false

  function clearPending() {
    if (timer === undefined) return
    options.clock.clearTimeout(timer)
    timer = undefined
  }

  function persistNow() {
    if (options.isGestureActive() || !options.isDirty()) return true
    try {
      const saved = options.persist()
      if (saved) saveRequested = false
      options.setState(saved ? 'saved' : 'failed')
      return saved
    }
    catch {
      options.setState('failed')
      return false
    }
  }

  function schedule() {
    clearPending()
    if (!options.isDirty()) return
    saveRequested = true
    if (options.isGestureActive()) return
    options.setState('saving')
    timer = options.clock.setTimeout(() => {
      timer = undefined
      persistNow()
    }, options.delayMs)
  }

  return {
    schedule,
    flush() {
      clearPending()
      return persistNow()
    },
    settleGesture(outcome: StudioMotionGestureOutcome) {
      clearPending()
      if ((outcome === 'committed' || saveRequested) && options.isDirty()) schedule()
      else if (!options.isDirty()) saveRequested = false
    },
    dispose: clearPending,
  }
}
