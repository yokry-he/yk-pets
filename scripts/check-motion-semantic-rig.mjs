#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定语义 Rig、毫秒关键帧领域、旧资产迁移和无 UI 求值器，并防止本阶段提前接入正式渲染器或道具事件。
 * Locks the semantic Rig, millisecond keyframe domain, legacy migration, and UI-free evaluator while preventing premature renderer or prop-event integration.
 */
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rig = read('packages/pet-core/src/motion/cloud-fox-rig.ts')
const time = read('packages/pet-core/src/motion/motion-time.ts')
const asset = read('packages/pet-core/src/motion/motion-asset.ts')
const evaluator = read('packages/pet-core/src/motion/motion-evaluator.ts')
const tests = read('packages/pet-core/test/motion-domain.test.ts')
const index = read('packages/pet-core/src/index.ts')
const workspace = read('apps/playground/app/domain/studio-workspace.ts')
const store = read('apps/playground/app/stores/studio-assets.ts')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const renderer = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const manifest = read('apps/extension/wxt.config.ts')

const frameworkFree = [rig, time, asset, evaluator].every(source => !source.includes("from 'vue'") && !source.includes('@tresjs') && !source.includes("from 'three'"))
const checks = [
  ['semantic Rig uses a stable version and no mesh paths', rig.includes("CLOUD_FOX_SEMANTIC_RIG_ID = 'cloud-fox-semantic-rig/v1'") && rig.includes("'root.position.x'") && rig.includes("'tail.tip.rotation.z'") && !rig.includes('Mesh.') && !rig.includes('meshPath')],
  ['millisecond timing keeps FPS as display metadata', time.includes('frameToMilliseconds') && time.includes('millisecondsToFrame') && time.includes('resolveMotionTime') && asset.includes('displayFps') && asset.includes('timeMs')],
  ['versioned assets normalize duplicate tracks and times', asset.includes('STUDIO_MOTION_ASSET_SCHEMA_VERSION = 2') && asset.includes('duplicate-channel-track-merged') && asset.includes('duplicate-keyframe-time-replaced') && asset.includes('authoringAppearanceId')],
  ['step and linear evaluation remain UI free', evaluator.includes("current.interpolation === 'step'") && evaluator.includes('evaluateNormalizedMotionAsset') && frameworkFree],
  ['pet-core exports the complete motion domain', ['cloud-fox-rig', 'motion-time', 'motion-asset', 'motion-evaluator'].every(file => index.includes(file))],
  ['Studio migrates v1 storage into v2 without appearance binding', workspace.includes("STUDIO_ASSET_STORAGE_KEY = 'yk-pets:studio:assets:v2'") && workspace.includes("STUDIO_ASSET_LEGACY_STORAGE_KEY = 'yk-pets:studio:assets:v1'") && store.includes('normalizeMotionAssetCollection') && store.includes('authoringAppearanceId') && !store.includes('appearanceId: input.appearanceId')],
  ['Motion Studio exposes read-only Rig metadata without keyframe writing', motionPage.includes('CLOUD_FOX_RIG_TRACK_GROUPS') && motionPage.includes('关键帧写入与正式播放仍未开放') && motionPage.includes('显示网格（FPS）') && !motionPage.includes('insertMotionKeyframe')],
  ['deterministic tests cover migration duplicates loops and interpolation', ['legacy motion metadata migrates', 'duplicate times', 'ping-pong', 'step and linear interpolation', 'JSON round-trip'].every(token => tests.includes(token))],
  ['canonical renderer is not wired in this domain-only batch', !renderer.includes('evaluateNormalizedMotionAsset') && !renderer.includes('StudioMotionAssetV2')],
  ['no Chrome permission upload polling or websocket was added', manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']") && [rig, time, asset, evaluator, store, motionPage].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval('))],
]

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) {
  console.error('Motion semantic Rig check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Motion semantic Rig passed: ${checks.length} checks.`)
