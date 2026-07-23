/**
 * 文件职责 / File responsibility
 * 创建并挂载 Side Panel Vue 应用，同时安装 YK-PETS 品牌、宠物工坊、记忆导入和当前页面筛选兼容层。
 * Creates and mounts the Side Panel Vue application and installs YK-PETS branding, Pet Studio, memory import, and Current Page filter bridges.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { installYkPetsCompatibility } from '../../brand'
import { installPetMemoryCurrentPageTools } from './pet-memory-current-page-tools'
import { installPetMemoryImportTools } from './pet-memory-import-tools'
import { installPetStudioTools } from './pet-studio-tools'
import './style.css'

createApp(App).mount('#app')
installYkPetsCompatibility(document)
installPetStudioTools(document).catch(error => console.warn('[YK-PETS pet studio tools]', error))
installPetMemoryImportTools(document)
installPetMemoryCurrentPageTools(document)
