/**
 * 文件职责 / File responsibility
 * WXT 构建配置与 Chrome Manifest V3 权限、Side Panel、快捷键、压缩包名称和 CSP 声明。
 * WXT build configuration and Chrome Manifest V3 permissions, Side Panel, shortcuts, ZIP naming, and CSP declarations.
 */
import { defineConfig } from 'wxt'

/**
 * 所有 Chrome 权限集中声明于此；新增权限必须同步更新中英文发布与隐私文档。
 * All Chrome permissions are declared here; new permissions require bilingual release and privacy documentation.
 */
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  zip: {
    artifactTemplate: 'yk-pets-{{version}}-{{browser}}.zip',
  },
  manifest: {
    name: 'YK-PETS Browser Agent',
    description: '由云狐云灵（Zeph）陪伴的 3D AI 前端工程助手：宠物记忆、页面审计、网络分析、Mock、响应修改、站点控制、动作系统与本地项目 Agent。',
    version: '0.6.10',
    permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts'],
    host_permissions: ['http://*/*', 'https://*/*'],
    commands: {
      'quick-pet-memory': {
        suggested_key: {
          default: 'Ctrl+Shift+Period',
          mac: 'Command+Shift+Period',
        },
        description: '快速记录当前网页到宠物记忆',
      },
    },
    action: {
      default_title: '打开 YK-PETS Browser Agent',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [{
      resources: ['audio/motions/zh-CN/*.mp3'],
      matches: ['http://*/*', 'https://*/*'],
    }],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
    },
  },
})
