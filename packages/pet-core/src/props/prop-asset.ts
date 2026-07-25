/**
 * 文件职责 / File responsibility
 * 定义版本化参数化道具实体、组件树、材质和内部锚点，并提供迁移、规范化与编辑命令。
 * Defines versioned parametric prop entities, component trees, materials, and internal anchors with migration, normalization, and editing commands.
 */
import type { MotionPropMountId, MotionVector3 } from '../motion/prop-events'

export const STUDIO_PROP_ASSET_SCHEMA_VERSION = 2 as const
export const STUDIO_PROP_COMPONENT_LIMIT = 48
export const STUDIO_PROP_PARTICLE_LIMIT = 240
export const STUDIO_PROP_TEXT_LIMIT = 48

export type StudioPropKind = 'composite' | 'effect'
export type StudioPropPrimitive = 'sphere' | 'box' | 'cylinder' | 'cone' | 'torus' | 'capsule' | 'crystal' | 'text' | 'particles'
export type StudioPropAnchorId = 'origin' | 'grip' | 'display' | 'emitter'

export interface StudioPropTransform {
  position: MotionVector3
  rotation: MotionVector3
  scale: MotionVector3
}

export interface StudioPropMaterial {
  color: string
  opacity: number
  metalness: number
  roughness: number
  glowColor: string
  glow: number
}

export interface StudioPropGeometry {
  width: number
  height: number
  depth: number
  radius: number
  tube: number
  segments: number
  text: string
  particleCount: number
}

export interface StudioPropComponent {
  id: string
  parentId?: string
  name: string
  primitive: StudioPropPrimitive
  visible: boolean
  transform: StudioPropTransform
  material: StudioPropMaterial
  geometry: StudioPropGeometry
}

export interface StudioPropAnchor {
  id: StudioPropAnchorId
  transform: StudioPropTransform
}

export interface StudioPropAssetV2 {
  schemaVersion: typeof STUDIO_PROP_ASSET_SCHEMA_VERSION
  id: string
  nameZh: string
  nameEn: string
  kind: StudioPropKind
  defaultAnchor: MotionPropMountId
  components: StudioPropComponent[]
  anchors: StudioPropAnchor[]
  createdAt: number
  updatedAt: number
  extensions?: Record<string, unknown>
}

export type PropNormalizationDiagnosticCode =
  | 'legacy-prop-migrated'
  | 'component-limit-truncated'
  | 'duplicate-component-id-replaced'
  | 'invalid-parent-cleared'
  | 'component-cycle-cleared'
  | 'geometry-clamped'
  | 'material-clamped'
  | 'missing-anchor-created'
  | 'duplicate-anchor-replaced'

export interface PropNormalizationDiagnostic {
  code: PropNormalizationDiagnosticCode
  path: string
  detail?: string
}

export interface NormalizePropAssetResult {
  asset: StudioPropAssetV2
  diagnostics: PropNormalizationDiagnostic[]
}

const PRIMITIVES = new Set<StudioPropPrimitive>(['sphere', 'box', 'cylinder', 'cone', 'torus', 'capsule', 'crystal', 'text', 'particles'])
const MOUNTS = new Set<MotionPropMountId>(['world', 'pet-root', 'head-top', 'muzzle', 'left-front-paw', 'right-front-paw', 'left-hind-paw', 'right-hind-paw', 'tail-tip'])
const ANCHORS: readonly StudioPropAnchorId[] = ['origin', 'grip', 'display', 'emitter']
const ZERO: MotionVector3 = [0, 0, 0]
const ONE: MotionVector3 = [1, 1, 1]
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
const vector = (value: unknown, fallback: MotionVector3, minimum = -20, maximum = 20): MotionVector3 => Array.isArray(value)
  ? [clamp(finite(value[0], fallback[0]), minimum, maximum), clamp(finite(value[1], fallback[1]), minimum, maximum), clamp(finite(value[2], fallback[2]), minimum, maximum)]
  : [...fallback]
const transform = (value: unknown): StudioPropTransform => {
  const source = isRecord(value) ? value : {}
  return {
    position: vector(source.position, ZERO),
    rotation: vector(source.rotation, ZERO, -Math.PI * 4, Math.PI * 4),
    scale: vector(source.scale, ONE, .01, 20),
  }
}

export function createDefaultPropMaterial(color = '#66e8ff'): StudioPropMaterial {
  return { color, opacity: 1, metalness: .2, roughness: .32, glowColor: color, glow: .18 }
}

export function createDefaultPropGeometry(primitive: StudioPropPrimitive): StudioPropGeometry {
  return {
    width: primitive === 'box' || primitive === 'text' ? .5 : .32,
    height: primitive === 'cylinder' || primitive === 'cone' || primitive === 'capsule' || primitive === 'crystal' ? .6 : .32,
    depth: primitive === 'box' || primitive === 'text' ? .2 : .32,
    radius: .22,
    tube: .055,
    segments: 24,
    text: primitive === 'text' ? 'YK' : '',
    particleCount: primitive === 'particles' ? 24 : 0,
  }
}

export function createDefaultPropComponent(id: string, primitive: StudioPropPrimitive = 'box', name?: string): StudioPropComponent {
  return {
    id,
    name: name || primitive,
    primitive,
    visible: true,
    transform: { position: [...ZERO], rotation: [...ZERO], scale: [...ONE] },
    material: createDefaultPropMaterial(primitive === 'particles' || primitive === 'crystal' ? '#ff72b5' : '#66e8ff'),
    geometry: createDefaultPropGeometry(primitive),
  }
}

export function createDefaultPropAnchors(): StudioPropAnchor[] {
  return ANCHORS.map(id => ({ id, transform: { position: [...ZERO], rotation: [...ZERO], scale: [...ONE] } }))
}

export function createStudioPropAsset(input: Partial<StudioPropAssetV2> & Pick<StudioPropAssetV2, 'id' | 'nameZh' | 'nameEn'>): StudioPropAssetV2 {
  return normalizePropAsset(input, { fallbackId: input.id, now: input.createdAt }).asset
}

export function normalizePropAsset(input: unknown, options: { fallbackId?: string; now?: number } = {}): NormalizePropAssetResult {
  const source = isRecord(input) ? input : {}
  const diagnostics: PropNormalizationDiagnostic[] = []
  const now = Math.round(finite(options.now, Date.now()))
  if (source.schemaVersion !== STUDIO_PROP_ASSET_SCHEMA_VERSION) diagnostics.push({ code: 'legacy-prop-migrated', path: 'schemaVersion' })
  const kind: StudioPropKind = source.kind === 'effect' ? 'effect' : 'composite'
  const legacyAnchorIds = Array.isArray(source.anchorIds) ? source.anchorIds : []
  const componentsInput = Array.isArray(source.components) ? source.components : []
  const fallbackComponents = componentsInput.length ? componentsInput : [
    kind === 'effect'
      ? { id: 'component-effect', name: 'Effect Core', primitive: 'crystal' }
      : { id: 'component-body', name: 'Body', primitive: 'box' },
  ]
  if (fallbackComponents.length > STUDIO_PROP_COMPONENT_LIMIT) diagnostics.push({ code: 'component-limit-truncated', path: 'components', detail: String(fallbackComponents.length) })
  const components = normalizeComponents(fallbackComponents.slice(0, STUDIO_PROP_COMPONENT_LIMIT), diagnostics)
  const anchors = normalizeAnchors(source.anchors, legacyAnchorIds, diagnostics)
  const defaultAnchor = MOUNTS.has(source.defaultAnchor as MotionPropMountId) ? source.defaultAnchor as MotionPropMountId : 'right-front-paw'
  const extensions = collectExtensions(source)
  return {
    asset: {
      schemaVersion: STUDIO_PROP_ASSET_SCHEMA_VERSION,
      id: text(source.id, options.fallbackId || `prop-${now.toString(36)}`),
      nameZh: text(source.nameZh, '新道具'),
      nameEn: text(source.nameEn, 'Prop'),
      kind,
      defaultAnchor,
      components,
      anchors,
      createdAt: Math.round(finite(source.createdAt, now)),
      updatedAt: Math.round(finite(source.updatedAt, now)),
      ...(Object.keys(extensions).length ? { extensions } : {}),
    },
    diagnostics,
  }
}

export function normalizePropAssetCollection(input: unknown): StudioPropAssetV2[] {
  if (!Array.isArray(input)) return []
  return input.map((item, index) => normalizePropAsset(item, { fallbackId: `prop-legacy-${index + 1}` }).asset)
}

export function duplicatePropComponent(assetInput: StudioPropAssetV2, componentId: string, newId: string): StudioPropAssetV2 {
  const asset = normalizePropAsset(assetInput).asset
  const source = asset.components.find(component => component.id === componentId)
  if (!source || asset.components.length >= STUDIO_PROP_COMPONENT_LIMIT) return asset
  const copy: StudioPropComponent = structuredClone(source)
  copy.id = newId
  copy.name = `${source.name} Copy`
  copy.transform.position = [source.transform.position[0] + .12, source.transform.position[1], source.transform.position[2]]
  return normalizePropAsset({ ...asset, components: [...asset.components, copy], updatedAt: Date.now() }).asset
}

export function addPropComponent(assetInput: StudioPropAssetV2, primitive: StudioPropPrimitive, id: string, parentId?: string): StudioPropAssetV2 {
  const asset = normalizePropAsset(assetInput).asset
  if (asset.components.length >= STUDIO_PROP_COMPONENT_LIMIT) return asset
  const component = createDefaultPropComponent(id, primitive)
  if (parentId && asset.components.some(item => item.id === parentId)) component.parentId = parentId
  return normalizePropAsset({ ...asset, components: [...asset.components, component], updatedAt: Date.now() }).asset
}

export function updatePropComponent(assetInput: StudioPropAssetV2, componentId: string, patch: Partial<StudioPropComponent>): StudioPropAssetV2 {
  const asset = normalizePropAsset(assetInput).asset
  const components = asset.components.map(component => component.id === componentId ? { ...component, ...structuredClone(patch), id: component.id } : component)
  return normalizePropAsset({ ...asset, components, updatedAt: Date.now() }).asset
}

export function removePropComponent(assetInput: StudioPropAssetV2, componentId: string): StudioPropAssetV2 {
  const asset = normalizePropAsset(assetInput).asset
  const descendants = new Set([componentId])
  let changed = true
  while (changed) {
    changed = false
    for (const component of asset.components) {
      if (component.parentId && descendants.has(component.parentId) && !descendants.has(component.id)) {
        descendants.add(component.id)
        changed = true
      }
    }
  }
  const components = asset.components.filter(component => !descendants.has(component.id))
  return normalizePropAsset({ ...asset, components: components.length ? components : [createDefaultPropComponent('component-body')], updatedAt: Date.now() }).asset
}

export function updatePropAnchor(assetInput: StudioPropAssetV2, anchorId: StudioPropAnchorId, transformValue: Partial<StudioPropTransform>): StudioPropAssetV2 {
  const asset = normalizePropAsset(assetInput).asset
  const anchors = asset.anchors.map(anchor => anchor.id === anchorId ? { ...anchor, transform: { ...anchor.transform, ...structuredClone(transformValue) } } : anchor)
  return normalizePropAsset({ ...asset, anchors, updatedAt: Date.now() }).asset
}

function normalizeComponents(input: unknown[], diagnostics: PropNormalizationDiagnostic[]): StudioPropComponent[] {
  const byId = new Map<string, StudioPropComponent>()
  for (let index = 0; index < input.length; index += 1) {
    const source = isRecord(input[index]) ? input[index] as Record<string, unknown> : {}
    const id = text(source.id, `component-${index + 1}`)
    if (byId.has(id)) diagnostics.push({ code: 'duplicate-component-id-replaced', path: `components.${index}.id`, detail: id })
    const primitive = PRIMITIVES.has(source.primitive as StudioPropPrimitive) ? source.primitive as StudioPropPrimitive : 'box'
    const geometrySource = isRecord(source.geometry) ? source.geometry : {}
    const materialSource = isRecord(source.material) ? source.material : {}
    const defaults = createDefaultPropGeometry(primitive)
    const geometry: StudioPropGeometry = {
      width: clamp(finite(geometrySource.width, defaults.width), .01, 10),
      height: clamp(finite(geometrySource.height, defaults.height), .01, 10),
      depth: clamp(finite(geometrySource.depth, defaults.depth), .01, 10),
      radius: clamp(finite(geometrySource.radius, defaults.radius), .01, 5),
      tube: clamp(finite(geometrySource.tube, defaults.tube), .005, 2),
      segments: Math.round(clamp(finite(geometrySource.segments, defaults.segments), 3, 64)),
      text: text(geometrySource.text, defaults.text).slice(0, STUDIO_PROP_TEXT_LIMIT),
      particleCount: Math.round(clamp(finite(geometrySource.particleCount, defaults.particleCount), 0, STUDIO_PROP_PARTICLE_LIMIT)),
    }
    if (Object.entries(geometry).some(([key, value]) => key !== 'text' && value !== geometrySource[key] && geometrySource[key] !== undefined)) diagnostics.push({ code: 'geometry-clamped', path: `components.${index}.geometry` })
    const defaultMaterial = createDefaultPropMaterial()
    const material: StudioPropMaterial = {
      color: text(materialSource.color, defaultMaterial.color),
      opacity: clamp(finite(materialSource.opacity, defaultMaterial.opacity), 0, 1),
      metalness: clamp(finite(materialSource.metalness, defaultMaterial.metalness), 0, 1),
      roughness: clamp(finite(materialSource.roughness, defaultMaterial.roughness), 0, 1),
      glowColor: text(materialSource.glowColor, text(materialSource.color, defaultMaterial.glowColor)),
      glow: clamp(finite(materialSource.glow, defaultMaterial.glow), 0, 8),
    }
    const parentId = optionalText(source.parentId)
    byId.set(id, {
      id,
      ...(parentId ? { parentId } : {}),
      name: text(source.name, primitive),
      primitive,
      visible: source.visible !== false,
      transform: transform(source.transform),
      material,
      geometry,
    })
  }
  const result = [...byId.values()]
  const ids = new Set(result.map(component => component.id))
  for (const component of result) {
    if (component.parentId && !ids.has(component.parentId)) {
      diagnostics.push({ code: 'invalid-parent-cleared', path: `components.${component.id}.parentId`, detail: component.parentId })
      delete component.parentId
    }
  }
  for (const component of result) {
    const seen = new Set([component.id])
    let parentId = component.parentId
    while (parentId) {
      if (seen.has(parentId)) {
        diagnostics.push({ code: 'component-cycle-cleared', path: `components.${component.id}.parentId`, detail: parentId })
        delete component.parentId
        break
      }
      seen.add(parentId)
      parentId = result.find(item => item.id === parentId)?.parentId
    }
  }
  return result
}

function normalizeAnchors(input: unknown, legacyIds: unknown[], diagnostics: PropNormalizationDiagnostic[]): StudioPropAnchor[] {
  const byId = new Map<StudioPropAnchorId, StudioPropAnchor>()
  const source = Array.isArray(input) ? input : []
  for (let index = 0; index < source.length; index += 1) {
    const item = isRecord(source[index]) ? source[index] as Record<string, unknown> : {}
    if (!ANCHORS.includes(item.id as StudioPropAnchorId)) continue
    const id = item.id as StudioPropAnchorId
    if (byId.has(id)) diagnostics.push({ code: 'duplicate-anchor-replaced', path: `anchors.${index}`, detail: id })
    byId.set(id, { id, transform: transform(item.transform) })
  }
  for (const legacy of legacyIds) {
    if (ANCHORS.includes(legacy as StudioPropAnchorId) && !byId.has(legacy as StudioPropAnchorId)) byId.set(legacy as StudioPropAnchorId, { id: legacy as StudioPropAnchorId, transform: transform(undefined) })
  }
  for (const id of ANCHORS) {
    if (!byId.has(id)) {
      diagnostics.push({ code: 'missing-anchor-created', path: `anchors.${id}` })
      byId.set(id, { id, transform: transform(undefined) })
    }
  }
  return ANCHORS.map(id => byId.get(id) as StudioPropAnchor)
}

function collectExtensions(source: Record<string, unknown>): Record<string, unknown> {
  const known = new Set(['schemaVersion', 'id', 'nameZh', 'nameEn', 'kind', 'defaultAnchor', 'anchorIds', 'components', 'anchors', 'createdAt', 'updatedAt', 'extensions'])
  const extensions = isRecord(source.extensions) ? { ...source.extensions } : {}
  for (const [key, value] of Object.entries(source)) if (!known.has(key)) extensions[key] = value
  return extensions
}
