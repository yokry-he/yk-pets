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
const simpleRenderer = read('apps/playground/app/components/studio/ProceduralPet.vue')
const motionPage = read('apps/playground/app/pages/studio/motion.vue')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

function withoutComments(source) {
  let result = ''
  let mode = 'code'
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]
    if (mode === 'line-comment') {
      if (current === '\n') { mode = 'code'; result += current }
      else result += ' '
      continue
    }
    if (mode === 'block-comment') {
      if (current === '*' && next === '/') { result += '  '; index += 1; mode = 'code' }
      else result += current === '\n' ? '\n' : ' '
      continue
    }
    if (mode === 'string') {
      result += current
      if (current === '\\') { result += next ?? ''; index += 1 }
      else if (current === stringQuote) mode = 'code'
      continue
    }
    if (current === '/' && next === '/') { result += '  '; index += 1; mode = 'line-comment'; continue }
    if (current === '/' && next === '*') { result += '  '; index += 1; mode = 'block-comment'; continue }
    if (current === '"' || current === "'" || current === '`') { mode = 'string'; stringQuote = current }
    result += current
  }
  return result
}

let stringQuote = ''

function functionBody(source, name) {
  const code = withoutComments(source)
  const match = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(code)
  if (!match) return ''
  const openingBrace = match.index + match[0].lastIndexOf('{')
  let depth = 0
  for (let index = openingBrace; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1
    if (code[index] === '}') depth -= 1
    if (depth === 0) return code.slice(openingBrace + 1, index)
  }
  return ''
}

const compact = source => withoutComments(source).replace(/\s+/g, ' ')

function rendererLifecycleFailures(source) {
  const issues = []
  const code = compact(source)
  const compileBody = compact(functionBody(source, 'compileMotion'))
  const createBody = compact(functionBody(source, 'createRuntime'))
  const applyBody = compact(functionBody(source, 'applyMotion'))
  const catchPosition = createBody.indexOf('catch')
  const controllerCleanupPosition = createBody.indexOf('newController?.dispose()', catchPosition)
  const runtimeCleanupPosition = createBody.indexOf('newRuntime?.dispose()', catchPosition)

  if (!/createComplexBipedMotionController\s*\(\s*runtime\.value\s*,\s*compilation\s*\)/.test(createBody)) issues.push('控制器必须消费创建当前 runtime 的同一局部 compilation')
  if (!/controller\.reset\(\)\s*try\s*\{\s*const compiledClip\s*=\s*compileBipedPetMotion/.test(compileBody)) issues.push('动作编译替换 clip 前必须先 reset')
  if (!/if\s*\(\s*!props\.motionAsset\s*\)[\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('无动作分支必须清 clip 并恢复绑定姿态')
  if (!/compiledClip\.status\s*!==\s*['"]ready['"][\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('阻塞动作分支必须清 clip 并恢复绑定姿态')
  if (!/catch[\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('动作编译异常必须清 clip 并恢复绑定姿态')
  if (controllerCleanupPosition < 0 || runtimeCleanupPosition < 0 || controllerCleanupPosition > runtimeCleanupPosition) issues.push('运行时创建失败必须按 controller、runtime 逆序释放局部资源')
  if (!/disposeRuntime\(\)[\s\S]*?createComplexBipedPetObject/.test(createBody)) issues.push('重建模型前必须释放旧 controller 与 runtime')
  if (/createComplexBipedPetObject|createComplexBipedMotionController/.test(applyBody)) issues.push('时间采样路径禁止重建 runtime 或 controller')
  if (!/onBeforeUnmount\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?disposeRuntime\(\)/.test(code)) issues.push('卸载时必须释放复杂运行时')
  return issues
}

// 负例确保门禁检查真实调用和生命周期顺序，不能靠注释中的正确片段蒙混通过。
const lifecycleFixture = renderer.replace(/createComplexBipedMotionController\s*\(\s*runtime\.value\s*\)/, 'createComplexBipedMotionController(runtime.value, compilation)')
expect(rendererLifecycleFailures(`/* createComplexBipedMotionController(runtime.value, compilation) */\n${lifecycleFixture.replace('createComplexBipedMotionController(runtime.value, compilation)', 'createComplexBipedMotionController(runtime.value)')}`).includes('控制器必须消费创建当前 runtime 的同一局部 compilation'), '门禁自身必须拒绝仅靠注释伪造 compilation 接线')
expect(rendererLifecycleFailures(lifecycleFixture.replace(/controller\.reset\(\)\s*try\s*\{\s*const compiledClip/, 'try { const compiledClip')).includes('动作编译替换 clip 前必须先 reset'), '门禁自身必须拒绝替换 clip 后才 reset')

expect(canvas.includes('motionAsset?: StudioMotionAssetV2 | null'), 'Canvas 必须声明复杂动作资产输入')
expect(canvas.includes('motionTimeMs?: number'), 'Canvas 必须声明复杂动作时间输入')
expect(canvas.includes(':motion-asset="motionAsset"'), 'Canvas 必须向复杂 renderer 传递动作资产')
expect(canvas.includes(':motion-time-ms="motionTimeMs"'), 'Canvas 必须向复杂 renderer 传递动作时间')
expect(renderer.includes('compileBipedPetMotion'), '复杂 renderer 必须使用领域动作编译器')
expect(renderer.includes('sampleBipedPetMotion'), '复杂 renderer 必须使用领域动作采样器')
expect(renderer.includes('createComplexBipedMotionController'), '复杂 renderer 必须使用唯一 Three 动作控制器')
for (const failure of rendererLifecycleFailures(renderer)) expect(false, failure)
expect(!renderer.includes('<TresCanvas') && !renderer.includes('new WebGLRenderer'), '复杂 renderer 禁止创建第二个 WebGL 场景')
expect(/<TresGroup\b[^>]*\bv-if="showComplexRenderer"[^>]*>[\s\S]*?<ComplexBipedPetRenderer[\s\S]*?<\/TresGroup>\s*<ProceduralPet\b[^>]*\bv-else/.test(canvas), '简单与复杂 renderer 必须保持互斥')
expect(!/createComplexBiped(?:Motion|Ik)Controller/.test(withoutComments(simpleRenderer)), '简单 renderer 禁止创建复杂 IK 或动作控制器')
expect(motionPage.includes(':motion-asset="draft"'), '动作工坊必须向唯一 Canvas 传递当前草稿')
expect(motionPage.includes(':motion-time-ms="editor.playheadTimeMs"'), '动作工坊必须向唯一 Canvas 传递播放指针')

if (failures.length) {
  console.error('复杂双足萌宠动作接线检查失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('复杂双足萌宠动作接线检查通过。')
