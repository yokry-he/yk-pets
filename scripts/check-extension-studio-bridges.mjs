#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定 Extension 复用 Playground Studio 云狐源码时所需的薄桥接，避免 WXT 解析 Nuxt `~` 导入失败或复制领域实现。
 * Locks the thin Extension bridges needed by shared Playground Studio Cloud Fox sources without duplicating domain implementations.
 */
import { existsSync, readFileSync } from 'node:fs'

const read = path => existsSync(new URL(`../${path}`, import.meta.url))
  ? readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  : ''

const nodeBridge = read('apps/extension/composables/useStudioMotionPartNodes.ts')
const limbBridge = read('apps/extension/domain/cloud-fox-limb-assembly.ts')
const rootPackage = read('package.json')

const checks = [
  ['Extension composable bridge re-exports the sole Playground motion-part-node module', nodeBridge.includes("export * from '../../playground/app/composables/useStudioMotionPartNodes'")],
  ['Extension limb assembly bridge re-exports the sole Playground implementation', limbBridge.includes("export * from '../../playground/app/domain/cloud-fox-limb-assembly'")],
  ['root typecheck includes the bridge contract before extension compilation', rootPackage.includes('node scripts/check-extension-studio-bridges.mjs')],
  ['bridges contain no copied implementation bodies', !nodeBridge.includes('new Map') && !nodeBridge.includes('provide(') && !limbBridge.includes('function createFrontPawConnectionAssembly')],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Extension Studio bridge check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Extension Studio bridge check passed: ${checks.length} checks.`)
