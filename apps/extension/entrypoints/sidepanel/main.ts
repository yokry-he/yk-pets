/**
 * 文件职责 / File responsibility
 * 创建并挂载 Side Panel Vue 应用，同时安装 YK-PETS 品牌兼容层。
 * Creates and mounts the Side Panel Vue application and installs the YK-PETS branding bridge.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { installYkPetsCompatibility } from '../../brand'
import './style.css'

createApp(App).mount('#app')
installYkPetsCompatibility(document)
