import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const main = read('apps/extension/entrypoints/network-main.content.ts')
const bridge = read('apps/extension/entrypoints/network-bridge.content.ts')
const lab = read('apps/extension/features/network-lab/presentation/components/NetworkLab.vue')
const editor = read('apps/extension/features/network-lab/presentation/pages/NetworkRuleEditorPage.vue')
const listPage = read('apps/extension/features/network-lab/presentation/pages/NetworkRuleListPage.vue')
const charts = read('apps/extension/features/network-lab/presentation/components/NetworkPerformanceCharts.vue')
const matcher = read('apps/extension/features/network-lab/domain/network-rule-matcher.ts')
const repository = read('apps/extension/features/network-lab/infrastructure/chrome-network-repository.ts')
const analyzer = read('apps/extension/features/network-lab/application/network-analysis-service.ts')
const messages = read('packages/shared/src/messages.ts')
const networkTypes = read('packages/shared/src/network.ts')
const overlay = read('apps/extension/entrypoints/content/NovaPetOverlay.vue')
const overlayCss = read('apps/extension/entrypoints/content/nova-pet-overlay.css')

const checks = [
  ['主世界 Fetch 拦截', main.includes('window.fetch = async function novaFetch') && main.includes("world: 'MAIN'")],
  ['XHR 监控与 Mock', main.includes('installXhrInterceptor') && main.includes('installMockXhr')],
  ['固定 JSON Mock', main.includes('createMockResponse') && editor.includes('Mock JSON')],
  ['真实响应字段修改', main.includes('createModifiedResponse') && matcher.includes('applyJsonTransforms')],
  ['延迟模拟', main.includes('getRuleDelay') && editor.includes('模拟延迟')],
  ['一键站点开关', lab.includes('network-master-toggle') && lab.includes('toggleNetwork') && repository.includes('getSiteSettings')],
  ['规则仓储模式', repository.includes('export interface NetworkRuleRepository') && repository.includes('class ChromeNetworkRepository')],
  ['规则匹配策略', matcher.includes('rankMatchingRules') && matcher.includes('globToRegExp')],
  ['隔离桥接与资源采集', bridge.includes('PerformanceObserver') && bridge.includes('postNetworkConfiguration')],
  ['主世界就绪握手', main.includes('emitReady()') && bridge.includes("event.data.type === 'READY'")],
  ['统一网络数据模型', networkTypes.includes('interface NetworkEntry') && networkTypes.includes('interface NetworkRule')],
  ['慢请求自动诊断', analyzer.includes('class NetworkAnalysisService') && analyzer.includes('diagnose(')],
  ['性能图表', charts.includes('最慢请求排行') && charts.includes('资源体积分布') && charts.includes('最近请求瀑布')],
  ['全页规则编辑器', editor.includes('rule-editor-page') && editor.includes('请求将直接返回 Mock')],
  ['手动新增不存在接口', listPage.includes('尚不存在的接口') && editor.includes('服务端尚不存在')],
  ['请求生成 Mock', lab.includes('createRuleFromEntry') && editor.includes('从请求生成 Mock')],
  ['请求详情与复制操作', lab.includes('request-inline-detail') && lab.includes('展开详情') && lab.includes('复制 URL') && lab.includes('复制响应')],
  ['工程菜单入口', overlay.includes("action: 'network-lab'") && messages.includes("| 'network-lab'")],
  ['分页指示点下移放大', overlayCss.includes('bottom: -10px;') && overlayCss.includes('width: 11px;')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项网络实验室回归检查通过。`)
