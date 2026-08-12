/**
 * 文件职责 / File responsibility
 * 创建 Side Panel Vue 应用，并按顺序安装品牌、宠物设置、任务首页、工坊、记忆和审计兼容层。
 * Creates the Side Panel Vue app and installs branding, pet settings, task-first home, Studio, memory, and audit bridges in order.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { installYkPetsCompatibility } from '../../brand'
import { installPetMemoryAuditPatchTools } from './pet-memory-audit-patch-tools'
import { installPetMemoryCurrentPageTools } from './pet-memory-current-page-tools'
import { installPetMemoryImportTools } from './pet-memory-import-tools'
import { installPetRuntimeSettingsTools } from './pet-runtime-settings-tools'
import { installPetStudioTools } from './pet-studio-tools'
import { installSidePanelExperienceTools } from './sidepanel-experience-tools'
import './style.css'

createApp(App).mount('#app')
installYkPetsCompatibility(document)
installPetMemoryImportTools(document)
installPetMemoryAuditPatchTools(document)
installPetMemoryCurrentPageTools(document)

Promise.allSettled([
  installPetRuntimeSettingsTools(document),
  installPetStudioTools(document),
]).then((results) => {
  for (const result of results) {
    if (result.status === 'rejected') console.warn('[YK-PETS Side Panel tools]', result.reason)
  }
  return installSidePanelExperienceTools(document)
}).catch(error => console.warn('[YK-PETS Side Panel experience]', error))
