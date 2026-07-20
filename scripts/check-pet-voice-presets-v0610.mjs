import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const messages = read('packages/shared/src/messages.ts')
const background = read('apps/extension/entrypoints/background.ts')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const sidePanel = read('apps/extension/entrypoints/sidepanel/App.vue')
const sidePanelCss = read('apps/extension/entrypoints/sidepanel/style.css')

const presets = ['alien', 'cute-girl', 'cute-animal', 'mute']
const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'") && sidePanel.includes("NOVA_VERSION = '0.6.10'")],
  ['Manifest 使用最小 TTS 权限', wxt.includes("'sidePanel', 'tts'")],
  ['共享协议定义四种音色', presets.every(preset => messages.includes(`'${preset}'`)) && messages.includes('NOVA_TTS_SPEAK') && messages.includes('NOVA_TTS_STOP')],
  ['外星人继续使用内置 MP3', overlay.includes("petVoicePreset.value === 'mute'") && overlay.includes('loadMotionVoiceBuffer')],
  ['萌系音色使用对应动作文案', overlay.includes('motionSpeechText') && overlay.includes("preset: petVoicePreset.value") && overlay.includes("type: 'NOVA_TTS_SPEAK'")],
  ['系统语音支持打断与错误诊断', overlay.includes("type: 'NOVA_TTS_STOP'") && background.includes("console.warn('[NOVA system voice]'")],
  ['后台优先选择中文自然声线', background.includes('chooseChineseVoice') && background.includes('scoreChineseVoice') && background.includes("lang: 'zh-CN'")],
  ['萌系少女与萌宠参数不同', background.includes("preset === 'cute-animal' ? 1.7 : 1.28") && background.includes("preset === 'cute-animal' ? 1.12 : 0.94")],
  ['Side Panel 支持切换与试听', sidePanel.includes('petVoiceOptions') && sidePanel.includes('previewPetVoice') && sidePanel.includes('selectPetVoice') && sidePanelCss.includes('.pet-voice-options')],
  ['音色选择持久化并同步页面', sidePanel.includes('PET_VOICE_STORAGE_KEY') && overlay.includes('onPetVoiceStorageChanged') && overlay.includes('restorePetVoicePreset')],
]

let failed = false
for (const [name, passed] of checks) {
  console.log(`${passed ? '✓' : '✗'} ${name}`)
  if (!passed) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.10 宠物音色检查通过。`)
