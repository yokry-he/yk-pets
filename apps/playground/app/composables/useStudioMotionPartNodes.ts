/**
 * 文件职责 / File responsibility
 * 在唯一 Tres 渲染树内部登记动作语义部位的真实 Object3D；DOM 层只能接收投影后的纯数值锚点。
 * Registers real semantic-part Object3D nodes inside the sole Tres render tree; the DOM layer only receives numeric projections.
 */
import { inject, provide, type InjectionKey } from 'vue'
import type { MotionBodyPartId } from '@yk-pets/pet-core'
import type { Object3D } from 'three'

export type StudioMotionPartNodeMap = Map<MotionBodyPartId, Object3D>

const STUDIO_MOTION_PART_NODES_KEY: InjectionKey<StudioMotionPartNodeMap> = Symbol('studio-motion-part-nodes')

export function provideStudioMotionPartNodes(): StudioMotionPartNodeMap {
  const nodes: StudioMotionPartNodeMap = new Map<MotionBodyPartId, Object3D>()
  provide(STUDIO_MOTION_PART_NODES_KEY, nodes)
  return nodes
}

export function useStudioMotionPartNodes(): StudioMotionPartNodeMap | undefined {
  return inject(STUDIO_MOTION_PART_NODES_KEY, undefined)
}

export function useStudioMotionPartNodeRegistration() {
  const nodes = useStudioMotionPartNodes()
  return (partId: MotionBodyPartId, node: unknown) => {
    if (!nodes) return
    if (node && typeof node === 'object' && 'matrixWorld' in node) nodes.set(partId, node as Object3D)
    else nodes.delete(partId)
  }
}
