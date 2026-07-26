/**
 * 文件职责 / File responsibility
 * 统一 Studio 预览的自由旋转手势、角度归一化和固定视角重置语义，避免各工作区重复并叠加过期偏移。
 * Unifies Studio preview free-rotation gestures, degree normalization, and canonical-view reset semantics so workspaces do not duplicate or retain stale offsets.
 */
import { computed, reactive, ref } from 'vue'
import type { CloudFoxStudioView } from '~/domain/pet-studio-phase4'

type PreviewRotationAxis = 'x' | 'y' | 'z'
type PreviewViewApplier = (view: CloudFoxStudioView) => void

interface StudioPreviewOrientationOptions {
  degreesPerPixel?: number
  excludedSelector?: string
}

export function wrapStudioPreviewDegrees(value: number) {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180
  return Number(wrapped.toFixed(1))
}

export function useStudioPreviewOrientation(options: StudioPreviewOrientationOptions = {}) {
  const degreesPerPixel = options.degreesPerPixel ?? .42
  const excludedSelector = options.excludedSelector || ''
  const previewRotation = reactive({ x: 0, y: 0, z: 0 })
  const previewRotationRadians = computed<readonly [number, number, number]>(() => [
    previewRotation.x * Math.PI / 180,
    previewRotation.y * Math.PI / 180,
    previewRotation.z * Math.PI / 180,
  ])
  const previewRotateSurface = ref<HTMLElement>()
  const previewDrag = reactive({ active: false, pointerId: 0, startX: 0, startY: 0, rotationX: 0, rotationY: 0 })

  function updatePreviewRotation(axis: PreviewRotationAxis, value: number) {
    previewRotation[axis] = wrapStudioPreviewDegrees(Number.isFinite(value) ? value : 0)
  }

  function resetPreviewRotation() {
    previewRotation.x = 0
    previewRotation.y = 0
    previewRotation.z = 0
  }

  function selectPreviewView(view: CloudFoxStudioView, applyView: PreviewViewApplier) {
    // 固定视角是绝对姿态；先清除自由旋转偏移，避免在当前角度上继续叠加。 / Canonical views are absolute poses; clear free-rotation offsets before applying one so the old angle is never accumulated.
    resetPreviewRotation()
    applyView(view)
  }

  function beginPreviewRotate(event: PointerEvent) {
    if (event.button !== 0) return
    const target = event.target
    if (excludedSelector && target instanceof Element && target.closest(excludedSelector)) return
    previewDrag.active = true
    previewDrag.pointerId = event.pointerId
    previewDrag.startX = event.clientX
    previewDrag.startY = event.clientY
    previewDrag.rotationX = previewRotation.x
    previewDrag.rotationY = previewRotation.y
    previewRotateSurface.value?.setPointerCapture(event.pointerId)
  }

  function movePreviewRotate(event: PointerEvent) {
    if (!previewDrag.active || event.pointerId !== previewDrag.pointerId) return
    updatePreviewRotation('y', previewDrag.rotationY + (event.clientX - previewDrag.startX) * degreesPerPixel)
    updatePreviewRotation('x', previewDrag.rotationX + (event.clientY - previewDrag.startY) * degreesPerPixel)
  }

  function endPreviewRotate(event: PointerEvent) {
    if (!previewDrag.active || event.pointerId !== previewDrag.pointerId) return
    previewDrag.active = false
    const surface = previewRotateSurface.value
    if (surface?.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId)
  }

  function cancelPreviewRotate() {
    previewDrag.active = false
  }

  return {
    previewRotation,
    previewRotationRadians,
    previewRotateSurface,
    previewDrag,
    updatePreviewRotation,
    resetPreviewRotation,
    selectPreviewView,
    beginPreviewRotate,
    movePreviewRotate,
    endPreviewRotate,
    cancelPreviewRotate,
  }
}
