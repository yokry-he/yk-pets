/**
 * 文件职责 / File responsibility
 * 定义不写入用户存储的只读 Studio 内置道具，供资产库复制和动作模板直接引用。
 * Defines read-only built-in Studio props that stay out of user storage and can be copied or referenced by motion templates.
 */
import {
  createDefaultPropAnchors,
  createDefaultPropComponent,
  createStudioPropAsset,
  STUDIO_PROP_RIG_NAMESPACE,
  type StudioPropAssetV2,
  type StudioPropComponent,
  type StudioPropPrimitive,
  type StudioPropRigDefinition,
} from '@yk-pets/pet-core'

type ComponentPatch = Partial<Omit<StudioPropComponent, 'transform' | 'material' | 'geometry'>> & {
  transform?: Partial<StudioPropComponent['transform']>
  material?: Partial<StudioPropComponent['material']>
  geometry?: Partial<StudioPropComponent['geometry']>
}

function component(id: string, primitive: StudioPropPrimitive, patch: ComponentPatch = {}): StudioPropComponent {
  const base = createDefaultPropComponent(id, primitive, patch.name)
  return {
    ...base,
    ...patch,
    transform: { ...base.transform, ...patch.transform },
    material: { ...base.material, ...patch.material },
    geometry: { ...base.geometry, ...patch.geometry },
  }
}

function prop(input: Pick<StudioPropAssetV2, 'id' | 'nameZh' | 'nameEn' | 'kind' | 'defaultAnchor'> & {
  components: StudioPropComponent[]
  extensions?: Record<string, unknown>
}) {
  return createStudioPropAsset({ ...input, anchors: createDefaultPropAnchors(), createdAt: 1, updatedAt: 1 })
}

const nebulaStaffRig: StudioPropRigDefinition = {
  primaryGrip: { position: [.32, 0, 0], rotation: [0, 0, 0, 1] },
  secondaryGrip: { position: [-.58, 0, 0], rotation: [0, 0, 0, 1] },
  trailStart: { position: [-1.65, 0, 0], rotation: [0, 0, 0, 1] },
  trailEnd: { position: [1.65, 0, 0], rotation: [0, 0, 0, 1] },
  impactPoint: { position: [1.65, 0, 0], rotation: [0, 0, 0, 1] },
}

const nebulaStaff = prop({
  id: 'builtin-nebula-staff', nameZh: '星云长棍', nameEn: 'Nebula Staff', kind: 'composite', defaultAnchor: 'right-front-paw',
  extensions: { [STUDIO_PROP_RIG_NAMESPACE]: nebulaStaffRig },
  components: [
    component('staff-shaft', 'cylinder', { name: '棍身', transform: { rotation: [0, 0, Math.PI / 2], scale: [.12, 2.2, .12] }, material: { color: '#533c86', glowColor: '#9b7cff', glow: .35 }, geometry: { radius: .12, height: 1.2 } }),
    component('staff-left', 'crystal', { name: '左星晶', transform: { position: [-1.35, 0, 0], rotation: [0, 0, Math.PI / 2], scale: [.42, .7, .42] }, material: { color: '#74f4ff', glowColor: '#74f4ff', glow: 1.5 } }),
    component('staff-right', 'crystal', { name: '右星晶', transform: { position: [1.35, 0, 0], rotation: [0, 0, -Math.PI / 2], scale: [.42, .7, .42] }, material: { color: '#ff7fd4', glowColor: '#ff7fd4', glow: 1.5 } }),
  ],
})

const energySword = prop({
  id: 'builtin-energy-sword', nameZh: '能量剑', nameEn: 'Energy Sword', kind: 'composite', defaultAnchor: 'right-front-paw',
  components: [
    component('sword-grip', 'cylinder', { name: '剑柄', transform: { rotation: [0, 0, Math.PI / 2], scale: [.16, .52, .16] }, material: { color: '#23263b', metalness: .75 } }),
    component('sword-guard', 'box', { name: '护手', transform: { position: [.48, 0, 0], scale: [.12, .65, .12] }, material: { color: '#d9e4ff', metalness: .65 } }),
    component('sword-blade', 'crystal', { name: '能量刃', transform: { position: [1.45, 0, 0], rotation: [0, 0, -Math.PI / 2], scale: [.38, 1.7, .18] }, material: { color: '#7fffee', glowColor: '#57f6e2', glow: 2.2 } }),
  ],
})

const starlightFan = prop({
  id: 'builtin-starlight-fan', nameZh: '星光折扇', nameEn: 'Starlight Fan', kind: 'composite', defaultAnchor: 'right-front-paw',
  components: [
    component('fan-core', 'cylinder', { name: '扇轴', transform: { scale: [.18, .26, .18] }, material: { color: '#ffe1f4', glowColor: '#ff8fd8', glow: .5 } }),
    ...Array.from({ length: 7 }, (_, index) => component(`fan-rib-${index}`, 'box', { name: `扇骨 ${index + 1}`, transform: { position: [0, .48, 0], rotation: [0, 0, -.75 + index * .25], scale: [.055, .78, .025] }, material: { color: index % 2 ? '#69e8ff' : '#ff86d1', glowColor: '#a986ff', glow: .55 } })),
  ],
})

const glowSticks = prop({
  id: 'builtin-glow-sticks', nameZh: '双荧光棒', nameEn: 'Twin Glow Sticks', kind: 'composite', defaultAnchor: 'right-front-paw',
  components: [
    component('glow-left', 'capsule', { name: '青色荧光棒', transform: { position: [-.15, 0, 0], rotation: [0, 0, -.18], scale: [.18, .85, .18] }, material: { color: '#61f7e3', glowColor: '#61f7e3', glow: 2 } }),
    component('glow-right', 'capsule', { name: '粉色荧光棒', transform: { position: [.15, 0, 0], rotation: [0, 0, .18], scale: [.18, .85, .18] }, material: { color: '#ff77c8', glowColor: '#ff77c8', glow: 2 } }),
  ],
})

const ribbon = prop({
  id: 'builtin-ribbon', nameZh: '星云飘带', nameEn: 'Nebula Ribbon', kind: 'composite', defaultAnchor: 'left-front-paw',
  components: Array.from({ length: 8 }, (_, index) => component(`ribbon-${index}`, 'capsule', { name: `飘带段 ${index + 1}`, transform: { position: [index * .28, Math.sin(index * .7) * .18, 0], rotation: [0, 0, Math.cos(index * .6) * .28 + Math.PI / 2], scale: [.08, .42, .035] }, material: { color: index % 2 ? '#8b7cff' : '#54e8dc', glowColor: '#9f86ff', glow: .8, opacity: .88 } })),
})

const energyOrb = prop({
  id: 'builtin-energy-orb', nameZh: '能量球', nameEn: 'Energy Orb', kind: 'effect', defaultAnchor: 'right-front-paw',
  components: [
    component('orb-core', 'sphere', { name: '能量核心', transform: { scale: [.55, .55, .55] }, material: { color: '#f5fbff', glowColor: '#5cebdd', glow: 2.6 } }),
    component('orb-ring', 'torus', { name: '环流', transform: { rotation: [Math.PI / 2, 0, 0], scale: [.8, .8, .8] }, material: { color: '#8e78ff', glowColor: '#8e78ff', glow: 1.7 } }),
    component('orb-particles', 'particles', { name: '星屑', material: { color: '#ff7dcc', glowColor: '#ff7dcc', glow: 1.4 }, geometry: { particleCount: 36 } }),
  ],
})

export const BUILT_IN_STUDIO_PROPS: readonly StudioPropAssetV2[] = Object.freeze([
  nebulaStaff, energySword, starlightFan, glowSticks, ribbon, energyOrb,
])

export function getBuiltInStudioProp(id: string) {
  return BUILT_IN_STUDIO_PROPS.find(item => item.id === id)
}
