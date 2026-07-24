/**
 * 文件职责 / File responsibility
 * 校验 v0.6.1 高空烟花、生活状态、随机彩蛋、触角发光与网络请求详情改造。
 * Validates v0.6.1 fireworks, lifestyle states, easter eggs, antenna glow, and request-detail improvements.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const messages = read('packages/shared/src/messages.ts')
const networkTypes = read('packages/shared/src/network.ts')
const motions = read('apps/extension/components/avatar/pet-motions.ts')
const fox = read('apps/extension/components/avatar/CloudFox.vue')
const avatar = read('apps/extension/components/avatar/ProductionAvatarCanvas.vue')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const lab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const labStore = read('apps/extension/features/network-lab/presentation/composables/useNetworkLab.ts')
const networkMain = read('apps/extension/entrypoints/network-main.content.ts')

const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['共享协议包含五个新行为', ['shy-peek','star-juggle','cloud-nap','sparkle-sneeze','fireworks-show'].every(item => messages.includes(`'${item}'`))],
  ['动作注册表包含五个新动作', ['害羞偷看','星星杂耍','云朵午睡','星光喷嚏','高空烟花秀'].every(item => motions.includes(item))],
  ['独立 easter 调度层', motions.includes("'easter'") && overlay.includes('scheduleEasterIdleCarousel') && overlay.includes('easterIdlePresets')],
  ['烟花包含四种精选花型逻辑', fox.includes('FIREWORK_PALETTES') && fox.includes('Math.pow(Math.sin(angle), 3)') && fox.includes('particleIndex % 2 === 0')],
  ['烟花连续三段发射', fox.includes('fireworksProgress * 3') && fox.includes('configureFireworkBurst')],
  ['烟花场景扩展相机', avatar.includes("props.behavior === 'fireworks-show'") && avatar.includes('wideScene ? 38')],
  ['尾尖增强发光', fox.includes('AdditiveBlending') && fox.includes('tailTipBase') && fox.includes('glowBoost') && fox.includes(':tone-mapped="false"')],
  ['双触角与聚能逻辑', fox.includes('leftAntennaTip') && fox.includes('rightAntennaTip') && fox.includes('antennaCharge')],
  ['生活状态道具', fox.includes('cloudNapGroup') && fox.includes('starJuggleGroup') && fox.includes('sneezeSparkGroup')],
  ['请求逐条展开详情', lab.includes('expandedEntryIds') && lab.includes('展开详情') && lab.includes('request-inline-detail')],
  ['请求详情包含 Query/Headers/Payload', lab.includes('Query 参数') && lab.includes('请求头') && lab.includes('响应头') && lab.includes('请求体') && lab.includes('响应预览')],
  ['请求模型包含头和请求体', networkTypes.includes('requestHeaders?') && networkTypes.includes('responseHeaders?') && networkTypes.includes('requestBodyPreview?')],
  ['Fetch/XHR 采集详细字段', networkMain.includes('extractRequestHeaders') && networkMain.includes('parseXhrResponseHeaders') && networkMain.includes('serializeRequestBody')],
  ['规则保存后同步页面快照', labStore.includes("const response = await sendToPage({ type: 'NOVA_NETWORK_SYNC_RULES'") && labStore.includes('if (response?.snapshot) snapshot.value = response.snapshot')],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`)
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} 项检查失败。`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} 项 v0.6.1 宠物生命力与网络详情检查通过。`)
