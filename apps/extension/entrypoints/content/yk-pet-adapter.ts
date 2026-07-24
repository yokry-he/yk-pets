/**
 * 文件职责 / File responsibility
 * 为 <yk-pet> 注册扩展正式 Cloud Fox 的 Vue 渲染适配器。
 * Registers the extension production Cloud Fox Vue renderer adapter for <yk-pet>.
 */
import { petRendererRegistry, type PetRecord } from '@yk-pets/pet-core'
import { createVuePetRendererAdapter } from '@yk-pets/pet-vue-adapter'
import { defineYkPetElement } from '@yk-pets/pet-web-component'
import ProductionAvatarCanvas from '../../components/avatar/ProductionAvatarCanvas.vue'

let registered = false

export function registerExtensionCloudFoxPetElement() {
  if (registered) return
  petRendererRegistry.register(createVuePetRendererAdapter({
    id: 'extension-cloud-fox',
    component: ProductionAvatarCanvas,
    supports: speciesId => speciesId === 'cloud-fox',
    mapProps(state): PetRecord {
      return {
        ...state.renderProps,
        behavior: state.behavior,
        recipe: state.recipe,
      }
    },
  }))
  defineYkPetElement()
  registered = true
}
