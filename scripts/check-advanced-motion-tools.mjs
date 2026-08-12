#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 锁定高级插值、曲线编辑、辅助可视化、动作层、中断、IK、音效和安全本地 GLB 导入。
 * Locks advanced interpolation, curve editing, visual guides, motion layers, interruption, IK, audio, and safe local GLB import.
 */
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const asset = read('packages/pet-core/src/motion/motion-asset.ts')
const evaluator = read('packages/pet-core/src/motion/motion-evaluator.ts')
const advanced = read('packages/pet-core/src/motion/motion-advanced.ts')
const tests = read('packages/pet-core/test/motion-advanced.test.ts')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')
const page = read('apps/playground/app/pages/studio/motion.vue')
const tools = read('apps/playground/app/components/studio/StudioMotionAdvancedTools.vue')
const curve = read('apps/playground/app/components/studio/StudioMotionCurveEditor.vue')
const guides = read('apps/playground/app/components/studio/ExtensionCloudFoxMotionGuides.vue')
const glb = read('apps/playground/app/components/studio/StudioPropLocalGlb.vue')
const propPage = read('apps/playground/app/pages/studio/props.vue')
const propModel = read('apps/playground/app/components/studio/StudioPropModel.vue')
const checks = [
  ['motion schema supports smooth bezier tangents layers interruption and audio', asset.includes("'smooth' | 'bezier'") && asset.includes('inTangent') && asset.includes('layers: MotionLayer[]') && asset.includes('interruptionPolicy') && asset.includes('audioCues')],
  ['evaluator implements smooth bezier and weighted layer composition', evaluator.includes("current.interpolation === 'smooth'") && evaluator.includes("current.interpolation === 'bezier'") && evaluator.includes("layer?.mode === 'additive'")],
  ['advanced domain includes mirror presets layers IK path audio and GLB validation', ['mirrorMotionAsset','applyMotionPosePreset','addMotionLayer','solveTwoBoneIk2D','sampleMotionChannelPath','normalizeMotionAudioCues','validateLocalGlb'].every(token => advanced.includes(token))],
  ['Motion Studio exposes curve onion path mirror preset layer interruption IK and audio tools', page.includes('StudioMotionAdvancedTools') && tools.includes('曲线编辑器') === false && tools.includes('洋葱皮') && tools.includes('运动轨迹') && tools.includes('左右镜像') && tools.includes('动作层') && tools.includes('中断策略') && tools.includes('IK') && tools.includes('本地音效轨道') && curve.includes('曲线编辑器')],
  ['visual helpers remain lightweight and inside the sole renderer', page.includes(':onion-poses="onionPoses"') && page.includes(':motion-path-points="motionPathPoints"') && guides.includes('TresSphereGeometry') && !guides.includes('ExtensionAlignedCloudFox') && !guides.includes('<TresCanvas')],
  ['editor store exposes advanced transactional commands', ['setSelectedTangents','mirrorDraft','applyPreset','addLayer','assignSelectedChannelToLayer','updateInterruptionPolicy','requestPlaybackInterruption','playbackWeight','applyFrontPawIk','addAudioCue'].every(token => store.includes(token))],
  ['local GLB requires size header version length JSON and no external URI', ['file-too-large','invalid-glb-header','unsupported-glb-version','glb-length-mismatch','external-uri-forbidden'].every(token => advanced.includes(token)) && propPage.includes('validateLocalGlb') && propPage.includes('≤2 MB') && propModel.includes('v-if="asset.localModel"') && propModel.includes('<template v-else>') && glb.includes('GLTFLoader') && glb.includes('.parse(') && !glb.includes('.load(')],
  ['advanced tests cover interpolation layers mirror IK audio and GLB', ['smooth and bezier','override and additive layers','mirroring, presets, and IK','audio cues normalize and local GLB'].every(token => tests.includes(token))],
  ['no upload polling websocket or second canvas', [advanced, store, tools, curve, guides, glb].every(source => !source.includes('fetch(') && !source.includes('WebSocket') && !source.includes('setInterval(') && !source.includes('<TresCanvas'))],
]
const failures=checks.filter(([,passed])=>!passed).map(([name])=>name)
if(failures.length){console.error('Advanced motion tools check failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1)}
console.log(`Advanced motion tools passed: ${checks.length} checks.`)
