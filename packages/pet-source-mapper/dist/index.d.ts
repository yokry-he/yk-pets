/**
 * DOM and Vue source ownership mapping for YK Pets.
 *
 * The mapper works with caller-supplied DOM metadata, Vue runtime hints, stack
 * frames, and Source Map v3 payloads. It performs no network requests and does
 * not evaluate page JavaScript.
 */
export interface DomNodeLike {
    tagName?: string;
    nodeName?: string;
    id?: string;
    className?: string | {
        baseVal?: string;
    };
    textContent?: string | null;
    parentElement?: DomNodeLike | null;
    previousElementSibling?: DomNodeLike | null;
    children?: ArrayLike<DomNodeLike>;
    attributes?: ArrayLike<{
        name: string;
        value: string;
    }> | Record<string, string>;
    getAttribute?(name: string): string | null;
}
export interface DomElementDescriptor {
    selector: string;
    tagName: string;
    id?: string;
    classes: string[];
    attributes: Record<string, string>;
    text?: string;
    nodeId?: number;
    backendNodeId?: number;
    frameId?: string;
}
export interface VueOwnershipSnapshot {
    version: 2 | 3 | 'inspector' | 'unknown';
    componentName?: string;
    file?: string;
    line?: number;
    column?: number;
    uid?: string | number;
    parentChain: string[];
    evidence: string[];
}
export interface GeneratedStackFrame {
    url: string;
    lineNumber: number;
    columnNumber: number;
    functionName?: string;
}
export interface SourceMapV3 {
    version: 3;
    file?: string;
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: Array<string | null>;
    names?: string[];
    mappings: string;
}
export interface IndexedSourceMapV3 {
    version: 3;
    file?: string;
    sections: Array<{
        offset: {
            line: number;
            column: number;
        };
        map: SourceMapV3 | IndexedSourceMapV3;
    }>;
}
export type AnySourceMapV3 = SourceMapV3 | IndexedSourceMapV3;
export interface DecodedMapping {
    generatedLine: number;
    generatedColumn: number;
    sourceIndex?: number;
    originalLine?: number;
    originalColumn?: number;
    nameIndex?: number;
}
export interface ResolvedSourcePosition {
    generatedUrl: string;
    generatedLine: number;
    generatedColumn: number;
    source: string;
    line: number;
    column: number;
    name?: string;
    sourceContent?: string | null;
}
export type SourceEvidenceKind = 'inspector' | 'vue-runtime' | 'source-map' | 'component-registry' | 'stack-frame';
export interface SourceCandidate {
    source: string;
    line?: number;
    column?: number;
    componentName?: string;
    confidence: number;
    evidenceKinds: SourceEvidenceKind[];
    reasons: string[];
}
export interface SourceLocatorInput {
    element?: DomNodeLike;
    descriptor?: DomElementDescriptor;
    vue?: VueOwnershipSnapshot | null;
    frames?: GeneratedStackFrame[];
}
export interface SourceMappingResult {
    descriptor: DomElementDescriptor | null;
    vue: VueOwnershipSnapshot | null;
    primary: SourceCandidate | null;
    candidates: SourceCandidate[];
}
export interface SourceLocatorOptions {
    sourceMaps?: SourceMapRegistry;
    componentSources?: Record<string, {
        source: string;
        line?: number;
        column?: number;
    }>;
    minimumConfidence?: number;
}
export declare class SourceMapRegistry {
    #private;
    register(generatedUrl: string, map: AnySourceMapV3): void;
    unregister(generatedUrl: string): boolean;
    has(generatedUrl: string): boolean;
    clear(): void;
    resolve(frame: GeneratedStackFrame): ResolvedSourcePosition | null;
}
export declare class SourceLocator {
    readonly sourceMaps: SourceMapRegistry;
    readonly componentSources: Readonly<Record<string, {
        source: string;
        line?: number;
        column?: number;
    }>>;
    readonly minimumConfidence: number;
    constructor(options?: SourceLocatorOptions);
    locate(input: SourceLocatorInput): SourceMappingResult;
}
export declare function createStableSelector(node: DomNodeLike, maxDepth?: number): string;
export declare function createDomDescriptor(node: DomNodeLike, options?: {
    maxTextLength?: number;
    maxAttributes?: number;
}): DomElementDescriptor;
export declare function inspectVueOwnership(element: unknown): VueOwnershipSnapshot | null;
export declare function parseVueInspectorMetadata(value: string): {
    file: string;
    line: number;
    column: number;
    componentName?: string;
} | null;
export declare function decodeSourceMapMappings(map: SourceMapV3): DecodedMapping[];
export declare function flattenSourceMapMappings(map: AnySourceMapV3): DecodedMapping[];
export declare function findOriginalMapping(mappings: readonly DecodedMapping[], generatedLine: number, generatedColumn: number): DecodedMapping | null;
export declare function normalizeSourcePath(value: string): string;
//# sourceMappingURL=index.d.ts.map