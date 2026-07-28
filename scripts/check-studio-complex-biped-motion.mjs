/**
 * 文件职责 / File responsibility
 * 约束复杂双足动作只能经既有 Studio Canvas、领域编译器和唯一 Three 控制器进入运行时。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = relativePath => readFileSync(`${root}/${relativePath}`, 'utf8')
const canvas = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const renderer = read('apps/playground/app/components/studio/ComplexBipedPetRenderer.vue')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

expect(canvas.includes('motionAsset?: StudioMotionAssetV2 | null'), 'Canvas 必须声明复杂动作资产输入')
expect(canvas.includes('motionTimeMs?: number'), 'Canvas 必须声明复杂动作时间输入')
expect(canvas.includes(':motion-asset="motionAsset"'), 'Canvas 必须向复杂 renderer 传递动作资产')
expect(canvas.includes(':motion-time-ms="motionTimeMs"'), 'Canvas 必须向复杂 renderer 传递动作时间')
expect(renderer.includes('compileBipedPetMotion'), '复杂 renderer 必须使用领域动作编译器')
expect(renderer.includes('sampleBipedPetMotion'), '复杂 renderer 必须使用领域动作采样器')
expect(renderer.includes('createComplexBipedMotionController'), '复杂 renderer 必须使用唯一 Three 动作控制器')
expect(!renderer.includes('<TresCanvas') && !renderer.includes('new WebGLRenderer'), '复杂 renderer 禁止创建第二个 WebGL 场景')
expect(motionPage.includes(':motion-asset="draft"'), '动作工坊必须向唯一 Canvas 传递当前草稿')
expect(motionPage.includes(':motion-time-ms="editor.playheadTimeMs"'), '动作工坊必须向唯一 Canvas 传递播放指针')

if (failures.length) {
  console.error('复杂双足萌宠动作接线检查失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('复杂双足萌宠动作接线检查通过。')
