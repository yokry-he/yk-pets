import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const networkRoot = path.join(root, 'apps/extension/features/network-lab')
const cloneUtility = read('apps/extension/features/network-lab/domain/network-value-clone.ts')
const editor = read('apps/extension/features/network-lab/presentation/composables/useNetworkRuleEditor.ts')
const sidePanel = read('apps/extension/entrypoints/sidepanel/App.vue')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')

const networkSources = collect(networkRoot)
const directStructuredClone = networkSources.filter(file => fs.readFileSync(file, 'utf8').includes('structuredClone('))
const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['网络实验室不再直接调用 structuredClone', directStructuredClone.length === 0],
  ['JSON 克隆可递归解除多层 Proxy', cloneUtility.includes('JSON.parse(JSON.stringify(value))')],
  ['规则编辑器统一使用安全克隆', editor.includes("import { cloneNetworkValue }") && editor.includes('return cloneNetworkValue(value)')],
  ['Side Panel 显示当前真实版本', sidePanel.includes("const NOVA_VERSION = '0.6.10'") && sidePanel.includes('NOVA {{ NOVA_VERSION }}')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.4 规则 Proxy 修复检查通过。`)

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return collect(absolute)
    return /\.(ts|vue)$/.test(entry.name) ? [absolute] : []
  })
}
