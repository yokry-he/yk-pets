/**
 * 文件职责 / File responsibility
 * 创建并挂载 Side Panel Vue 应用，同时安装 YK-PETS 品牌、运行偏好、宠物工坊、记忆导入、审计补丁和当前页面筛选兼容层。
 * Creates and mounts the Side Panel Vue application and installs YK-PETS branding, runtime preferences, Pet Studio, memory import, audit-patch, and Current Page filter bridges.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { installYkPetsCompatibility } from '../../brand'
import { installPetMemoryAuditPatchTools } from './pet-memory-audit-patch-tools'
import { installPetMemoryCurrentPageTools } from './pet-memory-current-page-tools'
import { installPetMemoryImportTools } from './pet-memory-import-tools'
import { installPetRuntimeSettingsTools } from './pet-runtime-settings-tools'
import { installPetStudioTools } from './pet-studio-tools'
import './style.css'

createApp(App).mount('#app')
installYkPetsCompatibility(document)
installPetRuntimeSettingsTools(document).catch(error => console.warn('[YK-PETS runtime settings]', error))
installPetStudioTools(document).catch(error => console.warn('[YK-PETS pet studio tools]', error))
installPetMemoryImportTools(document)
installPetMemoryAuditPatchTools(document)
installPetMemoryCurrentPageTools(document)
