#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定语义 Rig、毫秒关键帧领域、旧资产迁移和框架无关求值器，并允许上层通过单一正式渲染器消费姿态。
 * Locks the semantic Rig, millisecond keyframe domain, legacy migration, and framework-neutral evaluator while allowing upper layers to consume poses through the sole production renderer.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rig = read('packages/pet-core/src/motion/cloud-fox-rig.ts')
const time = read('packages/pet-core/src/motion/motion-time.ts')
const asset = read('packages/pet-core/src/motion/motion-asset.ts')
const authoring = read('packages/pet-core/src/motion/motion-authoring.ts')
const evaluator = read('packages/pet-core/src/motion/motion-evaluator.ts')
const tests = read('packages/pet-core/test/motion-domain.test.ts')
const authoringTests = read('packages/pet-core/test/motion-authoring.test.ts')
const index = read('packages/pet-core/src/index.ts')
const workspace = read('apps/playground/app/domain/studio-workspace.ts')
const store = read('apps/playground/app/stores/studio-assets.ts')
const manifest = read('apps/extension/wxt.config.ts')

const frameworkFree = [rig, time, asset, authoring, evaluator].every(source => !source.includes("from 'vue'") && !source.includes('@tresjs') && !source.includes("from 'three'"))
const checks = [
  ['semantic Rig uses a stable version and no mesh paths', rig.includes("CLOUD_FOX_SEMANTIC_RIG_ID = 'cloud-fox-semantic-rig/v1'") && rig.includes("'root.position.x'") && rig.includes("'tail.tip.rotation.z'") && !rig.includes('Mesh.') && !rig.includes('meshPath')],
  ['millisecond timing keeps FPS as display metadata', time.includes('frameToMilliseconds') && time.includes('millisecondsToFrame') && time.includes('resolveMotionTime') && asset.includes('displayFps') && asset.includes('timeMs')],
  ['versioned assets normalize duplicate tracks and times', asset.includes('STUDIO_MOTION_ASSET_SCHEMA_VERSION = 2') && asset.includes('duplicate-channel-track-merged') && asset.includes('duplicate-keyframe-time-replaced') && asset.includes('authoringAppearanceId')],
  ['authoring commands remain framework independent', ['writeMotionChannelValue', 'copyMotionKeyframes', 'pasteMotionKeyframes', 'moveMotionKeyframes', 'removeMotionKeyframes'].every(token => authoring.includes(token)) && frameworkFree],
  ['step and linear evaluation remain UI free', evaluator.includes("current.interpolation === 'step'") && evaluator.includes('evaluateNormalizedMotionAsset') && frameworkFree],
  ['pet-core exports the complete motion domain', ['cloud-fox-rig', 'motion-time', 'motion-asset', 'motion-authoring', 'motion-evaluator'].every(file => index.includes(file))],
  ['Studio migrates v1 storage into v2 without appearance binding', workspace.includes("STUDIO_ASSET_STORAGE_KEY = 'yk-pets:studio:assets:v2'") && workspace.includes("STUDIO_ASSET_LEGACY_STORAGE_KEY = 'yk-pets:studio:assets:v1'") && store.includes('normalizeMotionAssetCollection') && store.includes('authoringAppearanceId') && !store.includes('appearanceId: input.appearanceId')],
  ['deterministic tests cover migration duplicates loops interpolation and authoring', ['legacy motion metadata migrates', 'duplicate times', 'ping-pong', 'step and linear interpolation', 'JSON round-trip'].every(token => tests.includes(token)) && ['copy, paste, move', 'snaps to the FPS grid'].every(token => authoringTests.includes(token))],
  ['no Chrome permission upload polling or websocket was added', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && [rig, time, asset, authoring, evaluator, store].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval('))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Motion semantic Rig check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Motion semantic Rig passed: ${checks.length} checks.`)
