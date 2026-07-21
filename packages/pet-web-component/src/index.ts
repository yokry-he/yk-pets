/**
 * 文件职责 / File responsibility
 * 实现只负责生命周期和适配器选择的 <yk-pet> 自定义元素，不绑定任何 UI 框架或具体物种。
 * Implements the <yk-pet> custom element for lifecycle and adapter selection without binding a UI framework or species.
 */
import {
  createPetRecipeEnvelope,
  normalizePetRecipeEnvelope,
  petRendererRegistry,
  type PetRecipeEnvelope,
  type PetRecord,
  type PetRendererInstance,
} from '@yk-pets/pet-core'

export const YK_PET_ELEMENT_NAME = 'yk-pet'

export interface YkPetElementState {
  recipe?: PetRecipeEnvelope | null
  behavior?: string
  renderProps?: PetRecord
  rendererId?: string
  speciesId?: string
}

export class YkPetElement extends HTMLElement {
  static get observedAttributes() {
    return ['behavior', 'renderer', 'species', 'recipe']
  }

  private readonly mountPoint: HTMLDivElement
  private rendererInstance: PetRendererInstance | null = null
  private mountedRendererId = ''
  private state: Required<Omit<YkPetElementState, 'recipe'>> & { recipe: PetRecipeEnvelope } = {
    recipe: createPetRecipeEnvelope({ speciesId: 'cloud-fox', rendererId: 'extension-cloud-fox', source: 'default', appearance: {} }),
    behavior: 'idle',
    renderProps: {},
    rendererId: 'extension-cloud-fox',
    speciesId: 'cloud-fox',
  }

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = ':host{display:block;width:100%;height:100%;contain:layout style paint}.mount{width:100%;height:100%}.error{display:grid;place-items:center;width:100%;height:100%;font:600 12px/1.4 system-ui;color:#dbe5ff;background:rgba(12,15,30,.5);border-radius:inherit}'
    this.mountPoint = document.createElement('div')
    this.mountPoint.className = 'mount'
    shadow.append(style, this.mountPoint)
  }

  connectedCallback() {
    this.refreshRenderer()
  }

  disconnectedCallback() {
    this.destroyRenderer()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'behavior') this.state.behavior = newValue || 'idle'
    if (name === 'renderer') this.state.rendererId = newValue || 'extension-cloud-fox'
    if (name === 'species') this.state.speciesId = newValue || 'cloud-fox'
    if (name === 'recipe' && newValue) {
      try {
        const recipe = normalizePetRecipeEnvelope(JSON.parse(newValue))
        if (recipe) this.state.recipe = recipe
      }
      catch {
        this.emitError('recipe 属性不是有效 JSON。')
      }
    }
    this.refreshRenderer()
  }

  get recipe() {
    return this.state.recipe
  }

  set recipe(value: PetRecipeEnvelope | null) {
    if (value) {
      this.state.recipe = value
      this.state.speciesId = value.speciesId
      this.state.rendererId = value.rendererId
    }
    this.refreshRenderer()
  }

  get behavior() {
    return this.state.behavior
  }

  set behavior(value: string) {
    this.state.behavior = value || 'idle'
    this.refreshRenderer()
  }

  get renderProps() {
    return this.state.renderProps
  }

  set renderProps(value: PetRecord) {
    this.state.renderProps = value || {}
    this.refreshRenderer()
  }

  get rendererId() {
    return this.state.rendererId
  }

  set rendererId(value: string) {
    this.state.rendererId = value || 'extension-cloud-fox'
    this.refreshRenderer()
  }

  get speciesId() {
    return this.state.speciesId
  }

  set speciesId(value: string) {
    this.state.speciesId = value || 'cloud-fox'
    this.refreshRenderer()
  }

  setState(next: YkPetElementState) {
    if (next.recipe) this.state.recipe = next.recipe
    if (next.behavior !== undefined) this.state.behavior = next.behavior || 'idle'
    if (next.renderProps !== undefined) this.state.renderProps = next.renderProps || {}
    if (next.rendererId !== undefined) this.state.rendererId = next.rendererId || this.state.recipe.rendererId
    if (next.speciesId !== undefined) this.state.speciesId = next.speciesId || this.state.recipe.speciesId
    if (next.recipe) {
      this.state.rendererId = next.rendererId || next.recipe.rendererId
      this.state.speciesId = next.speciesId || next.recipe.speciesId
    }
    this.refreshRenderer()
  }

  private renderState() {
    return {
      recipe: this.state.recipe,
      behavior: this.state.behavior,
      renderProps: this.state.renderProps,
    }
  }

  private refreshRenderer() {
    if (!this.isConnected) return
    const adapter = petRendererRegistry.resolve(this.state.rendererId, this.state.speciesId)
    if (!adapter) {
      this.destroyRenderer()
      this.mountPoint.innerHTML = '<div class="error">没有可用的宠物渲染器 / No pet renderer available</div>'
      this.emitError(`No renderer for ${this.state.speciesId}:${this.state.rendererId}`)
      return
    }

    if (!this.rendererInstance || this.mountedRendererId !== adapter.id) {
      this.destroyRenderer()
      this.mountPoint.replaceChildren()
      try {
        this.rendererInstance = adapter.mount(this.mountPoint, this.renderState())
        this.mountedRendererId = adapter.id
        this.dispatchEvent(new CustomEvent('yk-pet-ready', { detail: { rendererId: adapter.id }, bubbles: true, composed: true }))
      }
      catch (error) {
        this.emitError(error instanceof Error ? error.message : String(error))
      }
      return
    }

    this.rendererInstance.update(this.renderState())
  }

  private destroyRenderer() {
    this.rendererInstance?.destroy()
    this.rendererInstance = null
    this.mountedRendererId = ''
  }

  private emitError(message: string) {
    this.dispatchEvent(new CustomEvent('yk-pet-error', { detail: { message }, bubbles: true, composed: true }))
  }
}

export function defineYkPetElement(registry: CustomElementRegistry | undefined = globalThis.customElements) {
  if (!registry || registry.get(YK_PET_ELEMENT_NAME)) return
  registry.define(YK_PET_ELEMENT_NAME, YkPetElement)
}
