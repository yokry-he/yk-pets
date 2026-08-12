/**
 * 文件职责 / File responsibility
 * 将既有动作道具挂点语义映射到复杂双足萌宠 runtime 的真实 Socket 或骨骼。
 * 不使用简单模型的体型几何估算；缺少一一对应语义时采用显式、保守且可测试的映射。
 */
import type { EvaluatedMotionPropInstance, MotionPropMountId, StudioPropAssetV2 } from '@yk-pets/pet-core'
import type { Group, Object3D } from 'three'
import type { ComplexBipedPetObject } from './create-complex-biped-pet-object'

type ComplexBipedMountDefinition =
  | { kind: 'bone', id: 'root' | 'head', conservative: boolean }
  | { kind: 'tail-end', id: 'tail', conservative: true }
  | { kind: 'socket', id: 'hand.left' | 'hand.right' | 'foot.left' | 'foot.right' | 'head' | 'tail.base', conservative: boolean }
  | { kind: 'character-root', id: 'character-root', conservative: false }

/**
 * `muzzle` 与 `tail-tip` 在第一阶段 Profile 中尚无独立 Socket，因此分别保守跟随头骨与实际末节尾骨。
 * 四个爪部挂点必须严格落到对应 hand/foot Socket，不能退回几何估算。
 */
export const COMPLEX_BIPED_PROP_MOUNT_MAP: Readonly<Record<MotionPropMountId, ComplexBipedMountDefinition>> = Object.freeze({
  world: { kind: 'character-root', id: 'character-root', conservative: false },
  'pet-root': { kind: 'bone', id: 'root', conservative: false },
  'head-top': { kind: 'socket', id: 'head', conservative: false },
  muzzle: { kind: 'bone', id: 'head', conservative: true },
  'left-front-paw': { kind: 'socket', id: 'hand.left', conservative: false },
  'right-front-paw': { kind: 'socket', id: 'hand.right', conservative: false },
  'left-hind-paw': { kind: 'socket', id: 'foot.left', conservative: false },
  'right-hind-paw': { kind: 'socket', id: 'foot.right', conservative: false },
  'tail-tip': { kind: 'tail-end', id: 'tail', conservative: true },
})

export interface ResolvedComplexBipedPropMount {
  object: Object3D
  kind: ComplexBipedMountDefinition['kind']
  semanticId: string
  conservative: boolean
}

export interface ComplexBipedPropRuntimeHandle {
  readonly instanceId: string
  readonly asset: StudioPropAssetV2
  readonly object: Group
  readonly mount: ResolvedComplexBipedPropMount
}

/** 句柄只在 Group 仍直属预期挂点时有效，外部 reparent 或移除会立即令其失效。 */
export function isComplexBipedPropRuntimeHandleAttached(handle: ComplexBipedPropRuntimeHandle): boolean {
  return handle.object.parent === handle.mount.object
}

/** 只有真实挂在解析目标下的 Group 才能发布；同一 instanceId 的其他 Group 会被拒绝。 */
export function registerComplexBipedPropRuntimeHandle(
  handles: Map<string, ComplexBipedPropRuntimeHandle>,
  handle: ComplexBipedPropRuntimeHandle,
): boolean {
  if (!handle.instanceId || !isComplexBipedPropRuntimeHandleAttached(handle)) return false
  const current = handles.get(handle.instanceId)
  if (current && current.object !== handle.object) return false
  handles.set(handle.instanceId, handle)
  return true
}

/** 释放事件同时匹配 instanceId 与 Group 身份，防止旧组件误删已替换的新句柄。 */
export function releaseComplexBipedPropRuntimeHandle(
  handles: Map<string, ComplexBipedPropRuntimeHandle>,
  instanceId: string,
  object: Group,
): boolean {
  const current = handles.get(instanceId)
  if (!current || current.object !== object) return false
  handles.delete(instanceId)
  return true
}

export function resolveComplexBipedPropMount(
  runtime: ComplexBipedPetObject,
  instance: Pick<EvaluatedMotionPropInstance, 'mountId' | 'space'>,
): ResolvedComplexBipedPropMount {
  // 旧事件中的 world 表示角色预览根空间，而非 Tres 全局场景；这样模型整体预览变换仍统一生效。 / Legacy world events target the character preview root rather than the global Tres scene.
  const definition = instance.space === 'world'
    ? COMPLEX_BIPED_PROP_MOUNT_MAP.world
    : COMPLEX_BIPED_PROP_MOUNT_MAP[instance.mountId]

  if (definition.kind === 'character-root') {
    return { object: runtime.object, kind: definition.kind, semanticId: definition.id, conservative: false }
  }
  if (definition.kind === 'bone') {
    const bone = runtime.bonesById.get(definition.id)
    if (!bone) throw new Error(`复杂双足萌宠缺少道具挂点骨骼：${definition.id}。`)
    return { object: bone, kind: definition.kind, semanticId: definition.id, conservative: definition.conservative }
  }
  if (definition.kind === 'tail-end') {
    const tailBone = [...runtime.bonesById.entries()]
      .filter(([id]) => /^tail\.\d+$/.test(id))
      .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
      .at(-1)?.[1]
    const object = tailBone || runtime.sockets['tail.base']?.mount
    if (!object) throw new Error('复杂双足萌宠缺少尾部道具挂点。')
    return { object, kind: definition.kind, semanticId: tailBone?.name || 'tail.base', conservative: true }
  }
  const socket = runtime.sockets[definition.id]
  if (!socket) throw new Error(`复杂双足萌宠缺少道具 Socket：${definition.id}。`)
  return { object: socket.mount, kind: definition.kind, semanticId: definition.id, conservative: definition.conservative }
}
