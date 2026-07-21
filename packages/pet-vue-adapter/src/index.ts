/**
 * 文件职责 / File responsibility
 * 将 Vue 组件适配为 pet-core 渲染器接口，使 <yk-pet> 无需了解 Vue。
 * Adapts Vue components to the pet-core renderer contract so <yk-pet> remains unaware of Vue.
 */
import { createApp, defineComponent, h, shallowReactive, type Component } from 'vue'
import type {
  PetRecord,
  PetRenderState,
  PetRendererAdapter,
} from '@yk-pets/pet-core'

export interface VuePetRendererAdapterOptions {
  id: string
  component: Component
  supports(speciesId: string): boolean
  mapProps?(state: PetRenderState): PetRecord
}

export function createVuePetRendererAdapter(options: VuePetRendererAdapterOptions): PetRendererAdapter {
  return {
    id: options.id,
    supports: options.supports,
    mount(host, initialState) {
      const bridge = shallowReactive<{ state: PetRenderState }>({ state: initialState })
      const Root = defineComponent({
        name: 'YkPetVueRendererBridge',
        setup() {
          return () => h(options.component, options.mapProps ? options.mapProps(bridge.state) : {
            recipe: bridge.state.recipe,
            behavior: bridge.state.behavior,
            ...bridge.state.renderProps,
          })
        },
      })
      const app = createApp(Root)
      app.mount(host)
      return {
        update(nextState) {
          bridge.state = nextState
        },
        destroy() {
          app.unmount()
        },
      }
    },
  }
}
