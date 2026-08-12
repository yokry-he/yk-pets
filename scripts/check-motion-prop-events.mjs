#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定道具事件轨道、确定性实例求值、时间轴编排和同一正式 TresCanvas 中的实例渲染链路。
 * Locks prop-event tracks, deterministic instance evaluation, timeline authoring, and instance rendering inside the same production TresCanvas.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = read('packages/pet-core/src/motion/prop-events.ts')
const asset = read('packages/pet-core/src/motion/motion-asset.ts')
const tests = read('packages/pet-core/test/prop-events.test.ts')
const editor = read('apps/playground/app/stores/studio-motion-editor.ts')
const ui = read('apps/playground/app/components/studio/StudioMotionPropEvents.vue')
const page = read('apps/playground/app/pages/studio/motion.vue')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const procedural = read('apps/playground/app/components/studio/ProceduralPet.vue')
const renderer = read('apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue')
const instances = read('apps/playground/app/components/studio/ExtensionCloudFoxPropInstances.vue')
const manifest = read('apps/extension/wxt.config.ts')
const checks = [
  ['domain supports complete event lifecycle', ['create', 'show', 'attach', 'detach', 'move', 'hide', 'style', 'destroy'].every(token => domain.includes(`'${token}'`))],
  ['motion schema persists normalized prop event tracks', asset.includes('propEventTracks: MotionPropEventTrack[]') && asset.includes('normalizePropEventTracks(source.propEventTracks')],
  ['evaluation resolves stable instances and missing dependencies', domain.includes('evaluateMotionPropEvents') && domain.includes('missing-prop-dependency') && domain.includes('resolveMotionTime')],
  ['authoring store inserts and deletes event records transactionally', editor.includes('addPropEvent') && editor.includes('deletePropEvents') && editor.includes('insertMotionPropEvent') && editor.includes('snapshot()')],
  ['Motion Studio exposes event kind mount transform and style controls', ui.includes('道具事件轨道') && ui.includes('instanceId') && ui.includes('mountOptions') && ui.includes('particleRate') && page.includes('StudioMotionPropEvents')],
  ['one event evaluation feeds the sole preview chain', page.includes('evaluateMotionPropEvents') && page.includes(':prop-instances="evaluatedProps.instances"') && canvas.includes('propInstances') && procedural.includes('propInstances') && renderer.includes('propInstances')],
  ['instances render in the existing scene without another canvas', renderer.includes('ExtensionCloudFoxPropInstances') && instances.includes('EvaluatedMotionPropInstance') && !instances.includes('<TresCanvas') && !ui.includes('<TresCanvas')],
  ['tests cover hold throw catch destroy duplicates and missing dependencies', ['hold throw catch and destroy', 'duplicate kind/time', 'missing dependencies'].every(token => tests.includes(token))],
  ['no network polling websocket or permission expansion', [domain, editor, ui, instances].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(')) && manifest.includes("permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'sidePanel', 'tts']")],
]
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name)
if (failures.length) { console.error('Motion prop event check failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1) }
console.log(`Motion prop event passed: ${checks.length} checks.`)
