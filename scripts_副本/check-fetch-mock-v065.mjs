import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const sidePanel = read('apps/extension/entrypoints/sidepanel/App.vue')
const matcher = read('apps/extension/features/network-lab/domain/network-rule-matcher.ts')
const mainWorld = read('apps/extension/entrypoints/network-main.content.ts')
const bridge = read('apps/extension/entrypoints/network-bridge.content.ts')
const channel = read('apps/extension/features/network-lab/infrastructure/network-page-channel.ts')
const networkLab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const domainTest = read('scripts/test-network-domain-v050.ts')

const mockBranch = mainWorld.indexOf("rule?.action.type === 'mock'")
const realFetch = mainWorld.indexOf('await originalFetch(input, init)')
const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['Side Panel 显示当前真实版本', sidePanel.includes("const NOVA_VERSION = '0.6.10'")],
  ['相对 Fetch URL 以当前页面地址解析', mainWorld.includes('resolveNetworkUrl(request?.url || String(input), location.href)')],
  ['Fetch 与 XHR 都携带页面来源参与匹配', count(mainWorld, 'pageOrigin: location.origin') >= 2],
  ['站点范围按当前页面而非接口服务器判断', matcher.includes('const activePageOrigin = pageOrigin || parsed.origin') && matcher.includes('activePageOrigin !== rule.scopeOrigin')],
  ['完整 Mock 在真实 Fetch 前短路返回', mockBranch >= 0 && realFetch > mockBranch && mainWorld.includes('return response')],
  ['主世界回执已应用配置', channel.includes("type: 'CONFIGURED'") && mainWorld.includes('emitConfigured(state)')],
  ['桥接快照暴露拦截器同步状态', bridge.includes('NetworkInterceptorStatus') && bridge.includes("event.data.type === 'CONFIGURED'")],
  ['Network Lab 展示拦截器诊断状态', networkLab.includes('interceptorLabel') && networkLab.includes('拦截器已同步')],
  ['回归覆盖 localhost:5188 相对接口和跨域目标', domainTest.includes("'/api/auth/profile'") && domainTest.includes("url: 'http://localhost:3000/api/auth/profile'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.5 Fetch Mock 拦截检查通过。`)

function count(value, needle) {
  return value.split(needle).length - 1
}
