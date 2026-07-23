/**
 * 文件职责 / File responsibility
 * 创建并挂载 Side Panel Vue 应用，同时安装 YK-PETS 品牌、宠物工坊和宠物记忆导入兼容层。
 * Creates and mounts the Side Panel Vue application and installs YK-PETS branding, Pet Studio, and Pet Memory import bridges.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { installYkPetsCompatibility } from '../../brand'
import { installPetMemoryImportTools } from './pet-memory-import-tools'
import { installPetStudioTools } from './pet-studio-tools'
import './style.css'

createApp(App).mount('#app')
installYkPetsCompatibility(document)
installPetStudioTools(document).catch(error => console.warn('[YK-PETS pet studio tools]', error))
installPetMemoryImportTools(document)
