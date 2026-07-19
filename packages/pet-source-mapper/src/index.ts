/**
 * DOM and Vue source ownership mapping for YK Pets.
 *
 * The mapper works with caller-supplied DOM metadata, Vue runtime hints, stack
 * frames, and Source Map v3 payloads. It performs no network requests and does
 * not evaluate page JavaScript.
 */

export interface DomNodeLike {
  tagName?: string
  nodeName?: string
  id?: string
  className?: string | { baseVal?: string }
  textContent?: string | null
  parentElement?: DomNodeLike | null
  previousElementSibling?: DomNodeLike | null
  children?: ArrayLike<DomNodeLike>
  attributes?: ArrayLike<{ name: string; value: string }> | Record<string, string>
  getAttribute?(name: string): string | null
}

export interface DomElementDescriptor {
  selector: string
  tagName: string
  id?: string
  classes: string[]
  attributes: Record<string, string>
  text?: string
  nodeId?: number
  backendNodeId?: number
  frameId?: string
}

export interface VueOwnershipSnapshot {
  version: 2 | 3 | 'inspector' | 'unknown'
  componentName?: string
  file?: string
  line?: number
  column?: number
  uid?: string | number
  parentChain: string[]
  evidence: string[]
}

export interface GeneratedStackFrame {
  url: string
  lineNumber: number
  columnNumber: number
  functionName?: string
}

export interface SourceMapV3 {
  version: 3
  file?: string
  sourceRoot?: string
  sources: string[]
  sourcesContent?: Array<string | null>
  names?: string[]
  mappings: string
}

export interface IndexedSourceMapV3 {
  version: 3
  file?: string
  sections: Array<{
    offset: { line: number; column: number }
    map: SourceMapV3 | IndexedSourceMapV3
  }>
}

export type AnySourceMapV3 = SourceMapV3 | IndexedSourceMapV3

export interface DecodedMapping {
  generatedLine: number
  generatedColumn: number
  sourceIndex?: number
  originalLine?: number
  originalColumn?: number
  nameIndex?: number
}

export interface ResolvedSourcePosition {
  generatedUrl: string
  generatedLine: number
  generatedColumn: number
  source: string
  line: number
  column: number
  name?: string
  sourceContent?: string | null
}

export type SourceEvidenceKind = 'inspector' | 'vue-runtime' | 'source-map' | 'component-registry' | 'stack-frame'

export interface SourceCandidate {
  source: string
  line?: number
  column?: number
  componentName?: string
  confidence: number
  evidenceKinds: SourceEvidenceKind[]
  reasons: string[]
}

export interface SourceLocatorInput {
  element?: DomNodeLike
  descriptor?: DomElementDescriptor
  vue?: VueOwnershipSnapshot | null
  frames?: GeneratedStackFrame[]
}

export interface SourceMappingResult {
  descriptor: DomElementDescriptor | null
  vue: VueOwnershipSnapshot | null
  primary: SourceCandidate | null
  candidates: SourceCandidate[]
}

export interface SourceLocatorOptions {
  sourceMaps?: SourceMapRegistry
  componentSources?: Record<string, { source: string; line?: number; column?: number }>
  minimumConfidence?: number
}

export class SourceMapRegistry {
  #maps = new Map<string, { map: AnySourceMapV3; mappings: DecodedMapping[] }>()

  register(generatedUrl: string, map: AnySourceMapV3): void {
    const key = normalizeGeneratedUrl(generatedUrl)
    validateSourceMap(map)
    this.#maps.set(key, { map: structuredClone(map), mappings: flattenSourceMapMappings(map) })
  }

  unregister(generatedUrl: string): boolean {
    return this.#maps.delete(normalizeGeneratedUrl(generatedUrl))
  }

  has(generatedUrl: string): boolean {
    return this.#maps.has(normalizeGeneratedUrl(generatedUrl))
  }

  clear(): void {
    this.#maps.clear()
  }

  resolve(frame: GeneratedStackFrame): ResolvedSourcePosition | null {
    const generatedUrl = normalizeGeneratedUrl(frame.url)
    const record = this.#maps.get(generatedUrl) ?? findByPath(this.#maps, generatedUrl)
    if (!record) return null
    const mapping = findOriginalMapping(record.mappings, frame.lineNumber, frame.columnNumber)
    if (!mapping || mapping.sourceIndex === undefined || mapping.originalLine === undefined || mapping.originalColumn === undefined) return null
    const leaf = sourceMapLeafForPosition(record.map, frame.lineNumber, frame.columnNumber)
    if (!leaf) return null
    const source = leaf.map.sources[mapping.sourceIndex]
    if (source === undefined) return null
    return {
      generatedUrl,
      generatedLine: frame.lineNumber,
      generatedColumn: frame.columnNumber,
      source: resolveSourcePath(source, leaf.map.sourceRoot, generatedUrl),
      line: mapping.originalLine,
      column: mapping.originalColumn,
      name: mapping.nameIndex === undefined ? undefined : leaf.map.names?.[mapping.nameIndex],
      sourceContent: leaf.map.sourcesContent?.[mapping.sourceIndex],
    }
  }
}

export class SourceLocator {
  readonly sourceMaps: SourceMapRegistry
  readonly componentSources: Readonly<Record<string, { source: string; line?: number; column?: number }>>
  readonly minimumConfidence: number

  constructor(options: SourceLocatorOptions = {}) {
    this.sourceMaps = options.sourceMaps ?? new SourceMapRegistry()
    this.componentSources = Object.freeze({ ...(options.componentSources ?? {}) })
    this.minimumConfidence = clamp(options.minimumConfidence ?? 0.45, 0, 1)
  }

  locate(input: SourceLocatorInput): SourceMappingResult {
    const descriptor = input.descriptor ?? (input.element ? createDomDescriptor(input.element) : null)
    const vue = input.vue === undefined ? (input.element ? inspectVueOwnership(input.element) : null) : input.vue
    const candidates: SourceCandidate[] = []

    const inspector = descriptor ? findInspectorLocation(descriptor.attributes) : null
    if (inspector) {
      candidates.push({
        source: normalizeSourcePath(inspector.file),
        line: inspector.line,
        column: inspector.column,
        componentName: vue?.componentName,
        confidence: 0.99,
        evidenceKinds: ['inspector'],
        reasons: ['Element includes explicit source inspector metadata.'],
      })
    }

    if (vue?.file) {
      candidates.push({
        source: normalizeSourcePath(vue.file),
        line: vue.line,
        column: vue.column,
        componentName: vue.componentName,
        confidence: vue.line !== undefined ? 0.94 : 0.88,
        evidenceKinds: ['vue-runtime'],
        reasons: [`Vue ${vue.version} runtime reports component ownership${vue.componentName ? ` (${vue.componentName})` : ''}.`],
      })
    }

    if (vue?.componentName) {
      const registered = this.componentSources[vue.componentName]
      if (registered) {
        candidates.push({
          source: normalizeSourcePath(registered.source),
          line: registered.line,
          column: registered.column,
          componentName: vue.componentName,
          confidence: 0.78,
          evidenceKinds: ['component-registry'],
          reasons: ['Component name matched the host-provided component source registry.'],
        })
      }
    }

    for (const frame of input.frames ?? []) {
      const mapped = this.sourceMaps.resolve(frame)
      if (mapped) {
        const vueSource = /\.vue(?:\?|$)/i.test(mapped.source)
        candidates.push({
          source: normalizeSourcePath(mapped.source),
          line: mapped.line + 1,
          column: mapped.column + 1,
          componentName: vue?.componentName,
          confidence: vueSource ? 0.86 : 0.8,
          evidenceKinds: ['source-map'],
          reasons: [`Generated frame ${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1} resolved through Source Map v3.`],
        })
      }
      else if (/\.(?:vue|tsx?|jsx?)(?:\?|$)/i.test(frame.url)) {
        candidates.push({
          source: normalizeSourcePath(frame.url),
          line: frame.lineNumber + 1,
          column: frame.columnNumber + 1,
          componentName: vue?.componentName,
          confidence: 0.58,
          evidenceKinds: ['stack-frame'],
          reasons: ['Stack frame already references a source-like file but no registered source map was available.'],
        })
      }
    }

    const merged = mergeCandidates(candidates)
      .filter(candidate => candidate.confidence >= this.minimumConfidence)
      .sort(compareCandidates)
    return { descriptor, vue, primary: merged[0] ?? null, candidates: merged }
  }
}

export function createStableSelector(node: DomNodeLike, maxDepth = 6): string {
  const segments: string[] = []
  let current: DomNodeLike | null | undefined = node
  for (let depth = 0; current && depth < maxDepth; depth += 1) {
    const tag = getTagName(current)
    if (!tag) break
    const testAttribute = ['data-testid', 'data-test', 'data-qa', 'data-cy']
      .map(name => [name, getAttribute(current!, name)] as const)
      .find(([, value]) => value && isStableToken(value))
    if (testAttribute) {
      segments.unshift(`${tag}[${testAttribute[0]}="${escapeCssString(testAttribute[1]!)}"]`)
      break
    }
    const id = current.id ?? getAttribute(current, 'id') ?? undefined
    if (id && isStableToken(id)) {
      segments.unshift(`#${escapeCssIdentifier(id)}`)
      break
    }
    const classes = getClasses(current).filter(isStableClass).slice(0, 2)
    let segment = tag + classes.map(name => `.${escapeCssIdentifier(name)}`).join('')
    const nth = nthOfType(current)
    if (nth.count > 1) segment += `:nth-of-type(${nth.index})`
    segments.unshift(segment)
    current = current.parentElement
  }
  return segments.join(' > ') || '*'
}

export function createDomDescriptor(node: DomNodeLike, options: { maxTextLength?: number; maxAttributes?: number } = {}): DomElementDescriptor {
  const tagName = getTagName(node) || 'unknown'
  const attributes = readAttributes(node, options.maxAttributes ?? 50)
  const id = node.id || attributes.id || undefined
  const classes = getClasses(node)
  const maxTextLength = Math.max(0, Math.min(options.maxTextLength ?? 160, 2_000))
  const text = normalizeText(node.textContent ?? '').slice(0, maxTextLength) || undefined
  return {
    selector: createStableSelector(node),
    tagName,
    ...(id ? { id } : {}),
    classes,
    attributes,
    ...(text ? { text } : {}),
  }
}

export function inspectVueOwnership(element: unknown): VueOwnershipSnapshot | null {
  if (!element || typeof element !== 'object') return null
  const record = element as Record<string, unknown>
  const attributes = readUnknownAttributes(record)
  const inspector = findInspectorLocation(attributes)
  if (inspector) {
    return {
      version: 'inspector',
      componentName: inspector.componentName,
      file: normalizeSourcePath(inspector.file),
      line: inspector.line,
      column: inspector.column,
      parentChain: [],
      evidence: [`${inspector.attribute}=${attributes[inspector.attribute]}`],
    }
  }

  const vue3 = record.__vueParentComponent
  if (vue3 && typeof vue3 === 'object') return inspectVue3(vue3 as Record<string, unknown>)
  const vue2 = record.__vue__
  if (vue2 && typeof vue2 === 'object') return inspectVue2(vue2 as Record<string, unknown>)
  return null
}

export function parseVueInspectorMetadata(value: string): { file: string; line: number; column: number; componentName?: string } | null {
  const trimmed = value.trim()
  const match = /^(.*):(\d+):(\d+)(?::([^:]+))?$/.exec(trimmed)
  if (!match || !match[1]) return null
  const line = Number(match[2])
  const column = Number(match[3])
  if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) return null
  return { file: match[1], line, column, componentName: match[4] || undefined }
}

export function decodeSourceMapMappings(map: SourceMapV3): DecodedMapping[] {
  validateRegularSourceMap(map)
  const output: DecodedMapping[] = []
  let previousSource = 0
  let previousOriginalLine = 0
  let previousOriginalColumn = 0
  let previousName = 0
  const lines = map.mappings.split(';')
  for (let generatedLine = 0; generatedLine < lines.length; generatedLine += 1) {
    let previousGeneratedColumn = 0
    const segments = lines[generatedLine]!.split(',').filter(Boolean)
    for (const encoded of segments) {
      const values = decodeVlqSegment(encoded)
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`Invalid Source Map segment: ${encoded}`)
      previousGeneratedColumn += values[0]!
      if (previousGeneratedColumn < 0) throw new Error('Generated source map column became negative')
      const mapping: DecodedMapping = { generatedLine, generatedColumn: previousGeneratedColumn }
      if (values.length >= 4) {
        previousSource += values[1]!
        previousOriginalLine += values[2]!
        previousOriginalColumn += values[3]!
        if (previousSource < 0 || previousOriginalLine < 0 || previousOriginalColumn < 0) throw new Error('Source Map original position became negative')
        mapping.sourceIndex = previousSource
        mapping.originalLine = previousOriginalLine
        mapping.originalColumn = previousOriginalColumn
        if (values.length === 5) {
          previousName += values[4]!
          if (previousName < 0) throw new Error('Source Map name index became negative')
          mapping.nameIndex = previousName
        }
      }
      output.push(mapping)
    }
  }
  return output
}

export function flattenSourceMapMappings(map: AnySourceMapV3): DecodedMapping[] {
  validateSourceMap(map)
  if (!('sections' in map)) return decodeSourceMapMappings(map)
  const output: DecodedMapping[] = []
  for (const section of map.sections) {
    const sectionMappings = flattenSourceMapMappings(section.map)
    for (const mapping of sectionMappings) {
      output.push({
        ...mapping,
        generatedLine: mapping.generatedLine + section.offset.line,
        generatedColumn: mapping.generatedLine === 0 ? mapping.generatedColumn + section.offset.column : mapping.generatedColumn,
      })
    }
  }
  return output.sort((a, b) => a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn)
}

export function findOriginalMapping(mappings: readonly DecodedMapping[], generatedLine: number, generatedColumn: number): DecodedMapping | null {
  if (!Number.isSafeInteger(generatedLine) || generatedLine < 0 || !Number.isSafeInteger(generatedColumn) || generatedColumn < 0) return null
  let candidate: DecodedMapping | null = null
  for (const mapping of mappings) {
    if (mapping.generatedLine > generatedLine) break
    if (mapping.generatedLine !== generatedLine || mapping.generatedColumn > generatedColumn) continue
    candidate = mapping
  }
  return candidate
}

export function normalizeSourcePath(value: string): string {
  let output = value.trim().replace(/\\/g, '/')
  output = output.replace(/^(?:webpack|vite|rollup):\/\/+/, '')
  output = output.replace(/^file:\/\//, '')
  output = output.replace(/[?#].*$/, '')
  const protocol = /^([a-z][a-z0-9+.-]*:)\/\//i.exec(output)
  if (protocol) {
    const prefix = protocol[0]
    output = `${prefix}${output.slice(prefix.length).replace(/\/{2,}/g, '/')}`
  }
  else output = output.replace(/\/{2,}/g, '/')
  const drive = /^\/?([A-Za-z]):\//.exec(output)
  if (drive) output = `${drive[1]!.toUpperCase()}:/${output.slice(drive[0].length)}`
  return output
}

function inspectVue3(instance: Record<string, unknown>): VueOwnershipSnapshot {
  const type = objectRecord(instance.type)
  const componentName = stringValue(type?.name) ?? stringValue(type?.__name) ?? stringValue(instance.name)
  const file = stringValue(type?.__file)
  return {
    version: 3,
    componentName,
    file: file ? normalizeSourcePath(file) : undefined,
    uid: typeof instance.uid === 'string' || typeof instance.uid === 'number' ? instance.uid : undefined,
    parentChain: collectVue3Parents(instance.parent),
    evidence: ['element.__vueParentComponent'],
  }
}

function inspectVue2(instance: Record<string, unknown>): VueOwnershipSnapshot {
  const options = objectRecord(instance.$options)
  const componentName = stringValue(options?.name) ?? stringValue(options?._componentTag)
  const file = stringValue(options?.__file)
  return {
    version: 2,
    componentName,
    file: file ? normalizeSourcePath(file) : undefined,
    uid: typeof instance._uid === 'string' || typeof instance._uid === 'number' ? instance._uid : undefined,
    parentChain: collectVue2Parents(instance.$parent),
    evidence: ['element.__vue__'],
  }
}

function collectVue3Parents(value: unknown): string[] {
  const output: string[] = []
  let current = objectRecord(value)
  const seen = new Set<object>()
  while (current && output.length < 12 && !seen.has(current)) {
    seen.add(current)
    const type = objectRecord(current.type)
    const name = stringValue(type?.name) ?? stringValue(type?.__name)
    if (name) output.push(name)
    current = objectRecord(current.parent)
  }
  return output
}

function collectVue2Parents(value: unknown): string[] {
  const output: string[] = []
  let current = objectRecord(value)
  const seen = new Set<object>()
  while (current && output.length < 12 && !seen.has(current)) {
    seen.add(current)
    const options = objectRecord(current.$options)
    const name = stringValue(options?.name) ?? stringValue(options?._componentTag)
    if (name) output.push(name)
    current = objectRecord(current.$parent)
  }
  return output
}

function findInspectorLocation(attributes: Record<string, string>): ({ attribute: string; file: string; line: number; column: number; componentName?: string }) | null {
  for (const attribute of ['data-v-inspector', 'data-vue-source', 'data-source-location']) {
    const value = attributes[attribute]
    if (!value) continue
    const parsed = parseVueInspectorMetadata(value)
    if (parsed) return { attribute, ...parsed }
  }
  return null
}

function readUnknownAttributes(record: Record<string, unknown>): Record<string, string> {
  if (typeof record.getAttribute === 'function') {
    const attributes: Record<string, string> = {}
    for (const name of ['data-v-inspector', 'data-vue-source', 'data-source-location']) {
      const value = (record.getAttribute as (name: string) => unknown)(name)
      if (typeof value === 'string') attributes[name] = value
    }
    return attributes
  }
  return readAttributes(record as DomNodeLike, 50)
}

function readAttributes(node: DomNodeLike, max: number): Record<string, string> {
  const output: Record<string, string> = {}
  const source = node.attributes
  if (source && !Array.isArray(source) && typeof source === 'object' && !('length' in source)) {
    for (const [name, value] of Object.entries(source).slice(0, max)) if (typeof value === 'string') output[name] = sanitizeAttribute(value)
    return output
  }
  if (source && typeof source === 'object' && 'length' in source && typeof source.length === 'number') {
    const list = source as ArrayLike<{ name: string; value: string }>
    for (let index = 0; index < Math.min(list.length, max); index += 1) {
      const item = list[index]
      if (item && typeof item.name === 'string' && typeof item.value === 'string') output[item.name] = sanitizeAttribute(item.value)
    }
  }
  return output
}

function sanitizeAttribute(value: string): string {
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 2_000)
  return /^(?:Bearer|Basic)\s+/i.test(trimmed) ? '[REDACTED]' : trimmed
}

function getAttribute(node: DomNodeLike, name: string): string | null {
  if (node.getAttribute) return node.getAttribute(name)
  const attributes = readAttributes(node, 100)
  return attributes[name] ?? null
}

function getTagName(node: DomNodeLike): string {
  const value = node.tagName ?? node.nodeName ?? ''
  return String(value).toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function getClasses(node: DomNodeLike): string[] {
  const value = typeof node.className === 'string' ? node.className : node.className?.baseVal ?? getAttribute(node, 'class') ?? ''
  return [...new Set(value.split(/\s+/).map(item => item.trim()).filter(Boolean))].slice(0, 20)
}

function isStableClass(value: string): boolean {
  return isStableToken(value) && !/(?:^|[-_])[a-f0-9]{6,}(?:$|[-_])/i.test(value) && !/^css-[a-z0-9]{5,}$/i.test(value)
}

function isStableToken(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(value)
}

function nthOfType(node: DomNodeLike): { index: number; count: number } {
  const parent = node.parentElement
  const tag = getTagName(node)
  if (!parent || !tag) return { index: 1, count: 1 }
  if (parent.children) {
    const same: DomNodeLike[] = []
    for (let index = 0; index < parent.children.length; index += 1) {
      const child = parent.children[index]
      if (child && getTagName(child) === tag) same.push(child)
    }
    const position = same.indexOf(node)
    return { index: position >= 0 ? position + 1 : 1, count: same.length || 1 }
  }
  let index = 1
  let previous = node.previousElementSibling
  while (previous) {
    if (getTagName(previous) === tag) index += 1
    previous = previous.previousElementSibling
  }
  return { index, count: index }
}

function escapeCssIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, character => `\\${character.codePointAt(0)!.toString(16)} `)
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function validateSourceMap(map: AnySourceMapV3): void {
  if (!map || typeof map !== 'object' || map.version !== 3) throw new Error('Only Source Map v3 is supported')
  if ('sections' in map) {
    if (!Array.isArray(map.sections)) throw new Error('Indexed source map sections are required')
    let previousLine = -1
    let previousColumn = -1
    for (const section of map.sections) {
      if (!Number.isSafeInteger(section.offset.line) || section.offset.line < 0 || !Number.isSafeInteger(section.offset.column) || section.offset.column < 0) {
        throw new Error('Invalid indexed source map section offset')
      }
      if (section.offset.line < previousLine || (section.offset.line === previousLine && section.offset.column <= previousColumn)) {
        throw new Error('Indexed source map sections must be ordered')
      }
      previousLine = section.offset.line
      previousColumn = section.offset.column
      validateSourceMap(section.map)
    }
  }
  else validateRegularSourceMap(map)
}

function validateRegularSourceMap(map: SourceMapV3): void {
  if (map.version !== 3 || !Array.isArray(map.sources) || typeof map.mappings !== 'string') throw new Error('Invalid Source Map v3 payload')
  if (map.names !== undefined && !Array.isArray(map.names)) throw new Error('Invalid Source Map names')
  if (map.sourcesContent !== undefined && (!Array.isArray(map.sourcesContent) || map.sourcesContent.length !== map.sources.length)) {
    throw new Error('Source Map sourcesContent must align with sources')
  }
}

function decodeVlqSegment(segment: string): number[] {
  const output: number[] = []
  let value = 0
  let shift = 0
  for (const character of segment) {
    const digit = BASE64_VALUES.get(character)
    if (digit === undefined) throw new Error(`Invalid Source Map base64 character: ${character}`)
    const continuation = (digit & 32) !== 0
    value += (digit & 31) << shift
    if (continuation) shift += 5
    else {
      const negative = (value & 1) === 1
      const decoded = value >> 1
      output.push(negative ? -decoded : decoded)
      value = 0
      shift = 0
    }
  }
  if (shift !== 0) throw new Error(`Incomplete Source Map VLQ segment: ${segment}`)
  return output
}

const BASE64_VALUES = new Map('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').map((character, index) => [character, index]))

function sourceMapLeafForPosition(map: AnySourceMapV3, line: number, column: number): { map: SourceMapV3; line: number; column: number } | null {
  if (!('sections' in map)) return { map, line, column }
  let selected: IndexedSourceMapV3['sections'][number] | null = null
  for (const section of map.sections) {
    if (section.offset.line > line || (section.offset.line === line && section.offset.column > column)) break
    selected = section
  }
  if (!selected) return null
  const localLine = line - selected.offset.line
  const localColumn = localLine === 0 ? column - selected.offset.column : column
  return sourceMapLeafForPosition(selected.map, localLine, localColumn)
}

function resolveSourcePath(source: string, sourceRoot: string | undefined, generatedUrl: string): string {
  const root = sourceRoot ?? ''
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return normalizeSourcePath(source)
    if (/^[a-z][a-z0-9+.-]*:/i.test(root)) return normalizeSourcePath(new URL(source, root.endsWith('/') ? root : `${root}/`).toString())
    if (/^https?:/i.test(generatedUrl)) {
      const base = new URL(generatedUrl)
      const path = root ? `${root.replace(/\/$/, '')}/${source}` : source
      return normalizeSourcePath(new URL(path, base).toString())
    }
  }
  catch {
    // Fall back to deterministic path joining below.
  }
  return normalizeSourcePath(root ? `${root.replace(/\/$/, '')}/${source}` : source)
}

function normalizeGeneratedUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString()
  }
  catch {
    return value.replace(/#.*$/, '')
  }
}

function findByPath<T>(maps: Map<string, T>, generatedUrl: string): T | undefined {
  const targetPath = pathOnly(generatedUrl)
  const matches = [...maps.entries()].filter(([url]) => pathOnly(url) === targetPath)
  return matches.length === 1 ? matches[0]![1] : undefined
}

function pathOnly(value: string): string {
  try { return new URL(value).pathname }
  catch { return value.replace(/[?#].*$/, '') }
}

function mergeCandidates(candidates: SourceCandidate[]): SourceCandidate[] {
  const output = new Map<string, SourceCandidate>()
  for (const candidate of candidates) {
    const key = `${normalizeSourcePath(candidate.source)}:${candidate.line ?? ''}:${candidate.column ?? ''}:${candidate.componentName ?? ''}`
    const existing = output.get(key)
    if (!existing) {
      output.set(key, {
        ...candidate,
        source: normalizeSourcePath(candidate.source),
        evidenceKinds: [...candidate.evidenceKinds],
        reasons: [...candidate.reasons],
      })
      continue
    }
    existing.confidence = Math.max(existing.confidence, candidate.confidence)
    existing.evidenceKinds = [...new Set([...existing.evidenceKinds, ...candidate.evidenceKinds])]
    existing.reasons = [...new Set([...existing.reasons, ...candidate.reasons])]
  }
  return [...output.values()]
}

function compareCandidates(a: SourceCandidate, b: SourceCandidate): number {
  return b.confidence - a.confidence || a.source.localeCompare(b.source) || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0)
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
