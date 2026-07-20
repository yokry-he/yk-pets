import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const pkg = JSON.parse(read('package.json'))
const extensionPkg = JSON.parse(read('apps/extension/package.json'))
const wxt = read('apps/extension/wxt.config.ts')
const shared = read('packages/shared/src/network.ts')
const factory = read('apps/extension/features/network-lab/domain/network-rule-factory.ts')
const editorPage = read('apps/extension/features/network-lab/presentation/pages/NetworkRuleEditorPage.vue')
const editorState = read('apps/extension/features/network-lab/presentation/composables/useNetworkRuleEditor.ts')
const repository = read('apps/extension/features/network-lab/infrastructure/chrome-network-repository.ts')
const mainWorld = read('apps/extension/entrypoints/network-main.content.ts')
const runtimeTest = read('scripts/test-network-rule-create-v064.ts')

const checks = [
  ['版本统一为 0.6.10', pkg.version === '0.6.10' && extensionPkg.version === '0.6.10' && wxt.includes("version: '0.6.10'")],
  ['请求模型保留完整真实 JSON', shared.includes('responseBody?: unknown') && mainWorld.includes('responseBody = await readJsonResponseBody(response)')],
  ['规则模型保存整份替换 JSON', shared.includes('replacementBody?: unknown') && repository.includes('hasReplacementBody')],
  ['请求生成优先使用完整响应正文', factory.includes('entry.responseBody ?? entry.responsePreview')],
  ['修改响应界面直接编辑完整 JSON', editorPage.includes('真实响应 JSON') && editorPage.includes('完整 JSON 替换') && editorPage.includes('editor.mockBodyText.value')],
  ['字段路径编辑界面已移除', !editorPage.includes('设置字段') && !editorPage.includes('JSON 路径') && !editorPage.includes('字段值（JSON）')],
  ['保存时解析并写入整份 JSON', editorState.includes("result.action.replacementBody = JSON.parse(mockBodyText.value || 'null')")],
  ['新规则不再生成字段级变换', !editorState.includes('ensureTransform') && editorState.includes('result.action.transforms = undefined')],
  ['Fetch 与 XHR 都应用整份替换正文', count(mainWorld, 'resolveResponseBody(') >= 2 && read('apps/extension/features/network-lab/domain/network-rule-matcher.ts').includes('action.replacementBody !== undefined')],
  ['旧字段规则仍保持运行时兼容', read('apps/extension/features/network-lab/domain/network-rule-matcher.ts').includes('applyJsonTransforms(input, action.transforms)')],
  ['完整 JSON 编辑具备运行时回归', runtimeTest.includes('modifiedResponseRule.action.replacementBody') && runtimeTest.includes('Edited NOVA')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`\n${checks.length}/${checks.length} 项 v0.6.10 完整 JSON 响应修改检查通过。`)

function count(value, needle) {
  return value.split(needle).length - 1
}
