/**
 * 文件职责 / File responsibility
 * 提供无贴图依赖的 Canvas 2D 云狐渲染器和可选 Web Component。
 * Provides a texture-free Canvas 2D cloud-fox renderer and an optional Web Component.
 */

export interface CanvasPetPointer { x: number; y: number }
export interface CanvasPetState {
  behavior: string
  emotion?: string
  speaking?: boolean
  score?: number
  pointer?: CanvasPetPointer
  secretMode?: boolean
  reducedMotion?: boolean
  [key: string]: unknown
}

export interface CanvasRendererSnapshot {
  state?: CanvasPetState
  payload?: { elapsed: number }
}

export interface Canvas2DContextLike {
  save(): void
  restore(): void
  clearRect(x: number, y: number, width: number, height: number): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  scale(x: number, y: number): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number): void
  fill(): void
  stroke(): void
  fillText(text: string, x: number, y: number): void
  globalAlpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  shadowBlur: number
  shadowColor: string
  font: string
  textAlign: CanvasTextAlign
}

export interface CanvasLike {
  width: number
  height: number
  style?: Partial<CSSStyleDeclaration>
  getContext(type: '2d'): CanvasRenderingContext2D | null
  remove?(): void
}

export interface Canvas2DRendererOptions {
  width?: number
  height?: number
  devicePixelRatio?: number
  transparent?: boolean
  autoStart?: boolean
  canvasFactory?: () => HTMLCanvasElement
}

const DEFAULT_STATE: CanvasPetState = { behavior: 'idle', emotion: 'neutral', score: 80 }

export class CloudFox2DScene {
  state: CanvasPetState = { ...DEFAULT_STATE }
  elapsed = 0

  update(deltaSeconds: number, state = this.state): void {
    this.elapsed += Math.max(0, Math.min(0.1, deltaSeconds))
    this.state = { ...state, pointer: state.pointer ? { ...state.pointer } : undefined }
  }

  render(context: Canvas2DContextLike, width: number, height: number, devicePixelRatio = 1): void {
    const scale = Math.min(width / 240, height / 260) * devicePixelRatio
    const behavior = this.state.behavior
    const reduced = Boolean(this.state.reducedMotion)
    const t = reduced ? 0 : this.elapsed
    const breathing = Math.sin(t * 2.1) * 0.018
    const jump = behavior === 'jumping' ? Math.max(0, Math.sin((t % 1.1) / 1.1 * Math.PI)) * 22 : 0
    const spin = behavior === 'spinning' ? (t * 5.4) % (Math.PI * 2) : 0
    const sleeping = behavior === 'resting' || behavior === 'cloud-nap'
    const thinking = behavior === 'thinking' || behavior === 'curious-scan'
    const waving = behavior === 'greeting' || behavior === 'waving'
    const excited = ['playing', 'fireworks-show', 'energy-burst', 'star-juggle'].includes(behavior)
    const baseX = width / 2
    const baseY = height * 0.72 - jump * scale

    context.clearRect(0, 0, width * devicePixelRatio, height * devicePixelRatio)
    context.save()
    context.translate(baseX * devicePixelRatio, baseY * devicePixelRatio)
    context.scale(scale, scale)
    context.rotate(spin)
    if (sleeping) context.rotate(-0.42)

    this.#drawCloud(context, t, sleeping)
    this.#drawTail(context, t, excited, sleeping)
    this.#drawBody(context, breathing, sleeping)
    this.#drawHead(context, t, thinking, sleeping)
    this.#drawPaws(context, t, waving, sleeping)
    this.#drawEnergy(context, t, thinking || excited)
    context.restore()
  }

  #drawCloud(ctx: Canvas2DContextLike, t: number, sleeping: boolean): void {
    ctx.save()
    ctx.translate(0, sleeping ? 38 : 54)
    ctx.globalAlpha = 0.72
    ctx.shadowBlur = 16
    ctx.shadowColor = '#8d86ff'
    ctx.fillStyle = '#dfe4ff'
    for (const [x, y, r] of [[-44, 3, 25], [-18, -5, 30], [15, -7, 33], [46, 4, 25]] as const) {
      ctx.beginPath(); ctx.arc(x, y + Math.sin(t * 1.4 + x) * 1.5, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  #drawTail(ctx: Canvas2DContextLike, t: number, excited: boolean, sleeping: boolean): void {
    ctx.save()
    ctx.translate(34, sleeping ? 7 : 18)
    const wag = sleeping ? 0.06 : excited ? 0.34 : 0.16
    ctx.rotate(-0.55 + Math.sin(t * (excited ? 7 : 2.8)) * wag)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#8d86ff'
    ctx.lineWidth = 24
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(38, 4, 54, -32, 72, -55); ctx.stroke()
    ctx.strokeStyle = '#eef1ff'
    ctx.lineWidth = 12
    ctx.beginPath(); ctx.moveTo(56, -36); ctx.quadraticCurveTo(66, -46, 72, -55); ctx.stroke()
    ctx.shadowBlur = excited ? 18 : 8
    ctx.shadowColor = '#b4a8ff'
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(73, -56, excited ? 7 : 5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  #drawBody(ctx: Canvas2DContextLike, breathing: number, sleeping: boolean): void {
    ctx.save()
    ctx.translate(0, sleeping ? 12 : 0)
    ctx.scale(sleeping ? 1.18 : 1 + breathing, sleeping ? 0.72 : 1 - breathing)
    ctx.shadowBlur = 12
    ctx.shadowColor = '#7066ff'
    ctx.fillStyle = '#8993d8'
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 54, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dfe4ff'
    ctx.beginPath(); ctx.ellipse(0, 10, 30, 38, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  #drawHead(ctx: Canvas2DContextLike, t: number, thinking: boolean, sleeping: boolean): void {
    ctx.save()
    const pointer = this.state.pointer ?? { x: 0, y: 0 }
    ctx.translate(pointer.x * 4, -62 + pointer.y * 3 + (sleeping ? 18 : 0))
    ctx.rotate(thinking ? Math.sin(t * 2.4) * 0.12 : sleeping ? 0.18 : 0)

    ctx.fillStyle = '#7066ff'
    ctx.beginPath(); ctx.moveTo(-35, -20); ctx.lineTo(-21, -58); ctx.lineTo(-5, -25); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(35, -20); ctx.lineTo(21, -58); ctx.lineTo(5, -25); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#cdd3ff'
    ctx.beginPath(); ctx.moveTo(-27, -25); ctx.lineTo(-21, -45); ctx.lineTo(-12, -27); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(27, -25); ctx.lineTo(21, -45); ctx.lineTo(12, -27); ctx.closePath(); ctx.fill()

    ctx.fillStyle = '#aab3ef'
    ctx.beginPath(); ctx.ellipse(0, 0, 45, 38, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#edf0ff'
    ctx.beginPath(); ctx.ellipse(0, 8, 28, 22, 0, 0, Math.PI * 2); ctx.fill()

    ctx.strokeStyle = '#252b55'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (sleeping) {
      ctx.beginPath(); ctx.moveTo(-23, 0); ctx.quadraticCurveTo(-15, 7, -7, 0); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(15, 7, 23, 0); ctx.stroke()
    }
    else {
      ctx.fillStyle = '#252b55'
      ctx.beginPath(); ctx.ellipse(-15, 1, 5, thinking ? 8 : 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(15, 1, 5, thinking ? 8 : 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(-13.5, -1, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(16.5, -1, 1.8, 0, Math.PI * 2); ctx.fill()
    }

    ctx.fillStyle = '#5b5f95'
    ctx.beginPath(); ctx.arc(0, 11, 3.5, 0, Math.PI * 2); ctx.fill()
    if (this.state.speaking) {
      ctx.strokeStyle = '#5b5f95'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(0, 18, 5, 0, Math.PI); ctx.stroke()
    }

    ctx.restore()
  }

  #drawPaws(ctx: Canvas2DContextLike, t: number, waving: boolean, sleeping: boolean): void {
    const wave = waving ? Math.sin(t * 10) * 0.32 : 0
    for (const side of [-1, 1] as const) {
      ctx.save()
      ctx.translate(side * 30, sleeping ? 25 : 24)
      if (waving && side === 1) ctx.rotate(-1.2 + wave)
      else ctx.rotate(side * 0.18)
      ctx.fillStyle = '#949ee0'
      ctx.beginPath(); ctx.ellipse(0, 14, 12, sleeping ? 17 : 25, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#edf0ff'
      ctx.beginPath(); ctx.ellipse(0, sleeping ? 23 : 34, 10, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
  }

  #drawEnergy(ctx: Canvas2DContextLike, t: number, active: boolean): void {
    ctx.save()
    const pulse = active ? 1 + Math.sin(t * 6) * 0.22 : 0.8 + Math.sin(t * 2) * 0.08
    ctx.globalAlpha = active ? 0.95 : 0.58
    ctx.shadowBlur = active ? 18 : 8
    ctx.shadowColor = '#a99cff'
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(0, -10, 5 * pulse, 0, Math.PI * 2); ctx.fill()
    if (active) {
      ctx.strokeStyle = '#b7adff'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(0, -10, 12 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }
}

export class Canvas2DPetRenderer {
  readonly kind = '2d' as const
  readonly options: Required<Omit<Canvas2DRendererOptions, 'canvasFactory'>> & Pick<Canvas2DRendererOptions, 'canvasFactory'>
  readonly scene = new CloudFox2DScene()
  canvas: HTMLCanvasElement | null = null
  #context: CanvasRenderingContext2D | null = null
  #frame = 0
  #lastTime = 0
  #state: CanvasPetState = { ...DEFAULT_STATE }
  #width: number
  #height: number
  #dpr: number

  constructor(options: Canvas2DRendererOptions = {}) {
    this.options = {
      width: options.width ?? 240,
      height: options.height ?? 260,
      devicePixelRatio: options.devicePixelRatio ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
      transparent: options.transparent ?? true,
      autoStart: options.autoStart ?? true,
      canvasFactory: options.canvasFactory,
    }
    this.#width = this.options.width
    this.#height = this.options.height
    this.#dpr = this.options.devicePixelRatio
  }

  mount(target: Element | ShadowRoot): void {
    if (typeof document === 'undefined' && !this.options.canvasFactory) throw new Error('Canvas2DPetRenderer requires a DOM canvas factory')
    const canvas = this.options.canvasFactory?.() ?? document.createElement('canvas')
    canvas.setAttribute('aria-label', 'YK Pets 2D cloud fox')
    canvas.setAttribute('role', 'img')
    canvas.style.width = `${this.#width}px`
    canvas.style.height = `${this.#height}px`
    canvas.style.display = 'block'
    canvas.style.background = this.options.transparent ? 'transparent' : '#080a12'
    target.append(canvas)
    this.attachCanvas(canvas)
    if (this.options.autoStart) this.start()
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.#context = canvas.getContext('2d')
    if (!this.#context) throw new Error('Canvas 2D context unavailable')
    this.resize(this.#width, this.#height, this.#dpr)
    this.drawFrame(0)
  }

  start(): void {
    if (this.#frame || typeof requestAnimationFrame !== 'function') return
    const tick = (time: number) => {
      const delta = this.#lastTime ? (time - this.#lastTime) / 1_000 : 0
      this.#lastTime = time
      this.drawFrame(delta)
      this.#frame = requestAnimationFrame(tick)
    }
    this.#frame = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.#frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#frame)
    this.#frame = 0
    this.#lastTime = 0
  }

  setVisible(visible: boolean): void {
    if (this.canvas) {
      this.canvas.hidden = !visible
      this.canvas.style.visibility = visible ? 'visible' : 'hidden'
    }
    if (visible && this.options.autoStart) this.start()
    else if (!visible) this.stop()
  }

  drawFrame(deltaSeconds: number): void {
    if (!this.#context) return
    this.scene.update(deltaSeconds, this.#state)
    this.scene.render(this.#context, this.#width, this.#height, this.#dpr)
  }

  update(state: CanvasPetState): void {
    this.#state = { ...state, pointer: state.pointer ? { ...state.pointer } : undefined }
    if (!this.#frame) this.drawFrame(0)
  }

  resize(width: number, height: number, devicePixelRatio = this.#dpr): void {
    this.#width = Math.max(1, width)
    this.#height = Math.max(1, height)
    this.#dpr = Math.max(0.5, Math.min(3, devicePixelRatio))
    if (this.canvas) {
      this.canvas.width = Math.round(this.#width * this.#dpr)
      this.canvas.height = Math.round(this.#height * this.#dpr)
      this.canvas.style.width = `${this.#width}px`
      this.canvas.style.height = `${this.#height}px`
    }
    if (!this.#frame) this.drawFrame(0)
  }

  snapshot(): CanvasRendererSnapshot {
    return { state: { ...this.#state }, payload: { elapsed: this.scene.elapsed } }
  }

  restore(snapshot: CanvasRendererSnapshot): void {
    if (snapshot.state) this.#state = { ...snapshot.state }
    if (typeof snapshot.payload?.elapsed === 'number') this.scene.elapsed = snapshot.payload.elapsed
    this.drawFrame(0)
  }

  dispose(): void {
    this.stop()
    this.canvas?.remove()
    this.canvas = null
    this.#context = null
  }
}

export function createCanvas2DRendererFactory(options: Canvas2DRendererOptions = {}) {
  return {
    kind: '2d' as const,
    create: () => new Canvas2DPetRenderer(options),
  }
}

export interface YkPets2DElement extends HTMLElement {
  state: CanvasPetState
  renderer: Canvas2DPetRenderer
}

export function defineYkPets2DElement(tagName = 'yk-pets-2d'): CustomElementConstructor | null {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return null
  const existing = customElements.get(tagName)
  if (existing) return existing

  class YkPets2DElementImpl extends HTMLElement implements YkPets2DElement {
    renderer = new Canvas2DPetRenderer({ width: 240, height: 260 })
    #state: CanvasPetState = { ...DEFAULT_STATE }

    get state(): CanvasPetState { return this.#state }
    set state(value: CanvasPetState) {
      this.#state = { ...value }
      this.renderer.update(this.#state)
    }

    connectedCallback(): void {
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
      if (!this.renderer.canvas) this.renderer.mount(root)
    }

    disconnectedCallback(): void { this.renderer.dispose() }
  }

  customElements.define(tagName, YkPets2DElementImpl)
  return YkPets2DElementImpl
}
