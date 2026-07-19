/**
 * 文件职责 / File responsibility
 * 提供无贴图依赖的 Canvas 2D 云狐渲染器和可选 Web Component。
 * Provides a texture-free Canvas 2D cloud-fox renderer and an optional Web Component.
 */
export interface CanvasPetPointer {
    x: number;
    y: number;
}
export interface CanvasPetState {
    behavior: string;
    emotion?: string;
    speaking?: boolean;
    score?: number;
    pointer?: CanvasPetPointer;
    secretMode?: boolean;
    reducedMotion?: boolean;
    [key: string]: unknown;
}
export interface CanvasRendererSnapshot {
    state?: CanvasPetState;
    payload?: {
        elapsed: number;
    };
}
export interface Canvas2DContextLike {
    save(): void;
    restore(): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    translate(x: number, y: number): void;
    rotate(angle: number): void;
    scale(x: number, y: number): void;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number): void;
    fill(): void;
    stroke(): void;
    fillText(text: string, x: number, y: number): void;
    globalAlpha: number;
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    lineCap: CanvasLineCap;
    lineJoin: CanvasLineJoin;
    shadowBlur: number;
    shadowColor: string;
    font: string;
    textAlign: CanvasTextAlign;
}
export interface CanvasLike {
    width: number;
    height: number;
    style?: Partial<CSSStyleDeclaration>;
    getContext(type: '2d'): CanvasRenderingContext2D | null;
    remove?(): void;
}
export interface Canvas2DRendererOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    transparent?: boolean;
    autoStart?: boolean;
    canvasFactory?: () => HTMLCanvasElement;
}
export declare class CloudFox2DScene {
    #private;
    state: CanvasPetState;
    elapsed: number;
    update(deltaSeconds: number, state?: CanvasPetState): void;
    render(context: Canvas2DContextLike, width: number, height: number, devicePixelRatio?: number): void;
}
export declare class Canvas2DPetRenderer {
    #private;
    readonly kind: "2d";
    readonly options: Required<Omit<Canvas2DRendererOptions, 'canvasFactory'>> & Pick<Canvas2DRendererOptions, 'canvasFactory'>;
    readonly scene: CloudFox2DScene;
    canvas: HTMLCanvasElement | null;
    constructor(options?: Canvas2DRendererOptions);
    mount(target: Element | ShadowRoot): void;
    attachCanvas(canvas: HTMLCanvasElement): void;
    start(): void;
    stop(): void;
    setVisible(visible: boolean): void;
    drawFrame(deltaSeconds: number): void;
    update(state: CanvasPetState): void;
    resize(width: number, height: number, devicePixelRatio?: number): void;
    snapshot(): CanvasRendererSnapshot;
    restore(snapshot: CanvasRendererSnapshot): void;
    dispose(): void;
}
export declare function createCanvas2DRendererFactory(options?: Canvas2DRendererOptions): {
    kind: "2d";
    create: () => Canvas2DPetRenderer;
};
export interface YkPets2DElement extends HTMLElement {
    state: CanvasPetState;
    renderer: Canvas2DPetRenderer;
}
export declare function defineYkPets2DElement(tagName?: string): CustomElementConstructor | null;
//# sourceMappingURL=index.d.ts.map