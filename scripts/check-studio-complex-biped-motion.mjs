/**
 * 文件职责 / File responsibility
 * 约束复杂双足动作只能经既有 Studio Canvas、领域编译器和唯一 Three 控制器进入运行时。
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const requireFromPlayground = createRequire(new URL('../apps/playground/package.json', import.meta.url))
const ts = requireFromPlayground('typescript')
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

function scriptSetupContent(source) {
  return /<script\b(?=[^>]*\bsetup\b)[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1] ?? ''
}

function createRuntimeBody(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === 'createRuntime') return statement.body
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'createRuntime') continue
      if (declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) && ts.isBlock(declaration.initializer.body)) return declaration.initializer.body
    }
  }
}

function isDirectOptionalDispose(statement, variableName) {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression) || statement.expression.arguments.length !== 0) return false
  const access = statement.expression.expression
  return ts.isPropertyAccessExpression(access)
    && ts.isIdentifier(access.expression)
    && access.expression.text === variableName
    && access.name.text === 'dispose'
    && access.questionDotToken !== undefined
}

function containsAbruptCompletionInCurrentScope(node) {
  let found = false
  const visit = (child) => {
    if (ts.isThrowStatement(child) || ts.isReturnStatement(child) || ts.isBreakStatement(child) || ts.isContinueStatement(child)) { found = true; return }
    if (child !== node && (ts.isFunctionLike(child) || ts.isClassLike(child))) return
    if (!found) ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function isDirectRuntimeCreation(statement) {
  if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression) || statement.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false
  const assignment = statement.expression
  return ts.isIdentifier(assignment.left)
    && assignment.left.text === 'newRuntime'
    && ts.isCallExpression(assignment.right)
    && ts.isIdentifier(assignment.right.expression)
    && assignment.right.expression.text === 'createComplexBipedPetObject'
}

function isCleanupTry(statement, variableName) {
  return ts.isTryStatement(statement)
    && statement.catchClause !== undefined
    && statement.tryBlock.statements.length === 1
    && isDirectOptionalDispose(statement.tryBlock.statements[0], variableName)
    && !containsAbruptCompletionInCurrentScope(statement.catchClause.block)
}

function isCreateFailureBlockedEmit(statement) {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false
  const call = statement.expression
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'emitCompilationIfChanged' || call.arguments.length !== 1 || !ts.isObjectLiteralExpression(call.arguments[0])) return false
  const status = call.arguments[0].properties.find(property => ts.isPropertyAssignment(property) && property.name.getText() === 'status')
  const diagnostics = call.arguments[0].properties.find(property => ts.isPropertyAssignment(property) && property.name.getText() === 'diagnostics')
  return status !== undefined
    && ts.isPropertyAssignment(status)
    && ts.isStringLiteral(status.initializer)
    && status.initializer.text === 'blocked'
    && diagnostics !== undefined
    && diagnostics.getText().includes('three-runtime-create-failure')
}

function hasAstCreationFailureLifecycle(source) {
  const script = scriptSetupContent(source)
  if (!script) return false
  const sourceFile = ts.createSourceFile('ComplexBipedPetRenderer.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if (sourceFile.parseDiagnostics.length > 0) return false
  const body = createRuntimeBody(sourceFile)
  if (!body) return false
  const creationTry = body.statements.find(statement => ts.isTryStatement(statement)
    && statement.catchClause
    && statement.tryBlock.statements.some(isDirectRuntimeCreation))
  if (!creationTry?.catchClause) return false
  const statements = creationTry.catchClause.block.statements
  const controllerIndex = statements.findIndex(statement => isCleanupTry(statement, 'newController'))
  const runtimeIndex = statements.findIndex(statement => isCleanupTry(statement, 'newRuntime'))
  const blockedEmitIndex = statements.findIndex(isCreateFailureBlockedEmit)
  return controllerIndex >= 0
    && runtimeIndex >= 0
    && blockedEmitIndex >= 0
    && controllerIndex < runtimeIndex
    && runtimeIndex < blockedEmitIndex
    && statements[controllerIndex].getStart(sourceFile) < statements[runtimeIndex].getStart(sourceFile)
    && statements[runtimeIndex].getStart(sourceFile) < statements[blockedEmitIndex].getStart(sourceFile)
}

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

  if (!/createComplexBipedMotionController\s*\(\s*runtime\.value\s*,\s*compilation\s*\)/.test(createBody)) issues.push('控制器必须消费创建当前 runtime 的同一局部 compilation')
  if (!/controller\.reset\(\)\s*try\s*\{\s*const compiledClip\s*=\s*compileBipedPetMotion/.test(compileBody)) issues.push('动作编译替换 clip 前必须先 reset')
  if (!/if\s*\(\s*!props\.motionAsset\s*\)[\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('无动作分支必须清 clip 并恢复绑定姿态')
  if (!/compiledClip\.status\s*!==\s*['"]ready['"][\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('阻塞动作分支必须清 clip 并恢复绑定姿态')
  if (!/catch[\s\S]*?motionClip\.value\s*=\s*undefined[\s\S]*?controller\.reset\(\)/.test(compileBody)) issues.push('动作编译异常必须清 clip 并恢复绑定姿态')
  if (!hasAstCreationFailureLifecycle(source)) issues.push('运行时创建失败必须按 controller、runtime 逆序释放局部资源并发出阻塞诊断')
  if (!/disposeRuntime\(\)[\s\S]*?createComplexBipedPetObject/.test(createBody)) issues.push('重建模型前必须释放旧 controller 与 runtime')
  if (/createComplexBipedPetObject|createComplexBipedMotionController/.test(applyBody)) issues.push('时间采样路径禁止重建 runtime 或 controller')
  if (!/onBeforeUnmount\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?disposeRuntime\(\)/.test(code)) issues.push('卸载时必须释放复杂运行时')
  return issues
}

function hasExclusiveRendererBranches(source) {
  const opening = /<template\b[^>]*>/.exec(source)
  const closingIndex = source.lastIndexOf('</template>')
  if (!opening || closingIndex < opening.index + opening[0].length) return false
  // 只处理 Vue template 内的 HTML 注释，避免改写 script 中的字符串、模板字符串或 JS/TS 注释。
  const template = source.slice(opening.index + opening[0].length, closingIndex).replace(/<!--[\s\S]*?-->/g, '')
  const complexCount = [...template.matchAll(/<ComplexBipedPetRenderer\b/g)].length
  const proceduralCount = [...template.matchAll(/<ProceduralPet\b/g)].length
  const complexBranchCount = [...template.matchAll(/<TresGroup\b[^>]*\bv-if="showComplexRenderer"[^>]*>/g)].length
  if (complexCount !== 1 || proceduralCount !== 1 || complexBranchCount !== 1) return false
  return /<TresGroup\b[^>]*\bv-if="showComplexRenderer"[^>]*>[\s\S]*?<ComplexBipedPetRenderer\b[\s\S]*?<\/TresGroup>\s*<ProceduralPet\b[^>]*\bv-else\b/.test(template)
}

// 负例确保门禁检查真实调用和生命周期顺序，不能靠注释中的正确片段蒙混通过。
const lifecycleFixture = renderer.replace(/createComplexBipedMotionController\s*\(\s*runtime\.value\s*\)/, 'createComplexBipedMotionController(runtime.value, compilation)')
expect(rendererLifecycleFailures(`/* createComplexBipedMotionController(runtime.value, compilation) */\n${lifecycleFixture.replace('createComplexBipedMotionController(runtime.value, compilation)', 'createComplexBipedMotionController(runtime.value)')}`).includes('控制器必须消费创建当前 runtime 的同一局部 compilation'), '门禁自身必须拒绝仅靠注释伪造 compilation 接线')
expect(rendererLifecycleFailures(lifecycleFixture.replace(/controller\.reset\(\)\s*try\s*\{\s*const compiledClip/, 'try { const compiledClip')).includes('动作编译替换 clip 前必须先 reset'), '门禁自身必须拒绝替换 clip 后才 reset')
const cleanupFailure = '运行时创建失败必须按 controller、runtime 逆序释放局部资源并发出阻塞诊断'
const replaceDirectCleanup = replacement => renderer
  .replace('newController?.dispose()', replacement)
  .replace('newRuntime?.dispose()', '')
const cleanupStringFixture = replaceDirectCleanup("const proof = 'escaped \\' text newController?.dispose() newRuntime?.dispose()'")
expect(rendererLifecycleFailures(cleanupStringFixture).includes(cleanupFailure), '门禁自身必须拒绝用字符串伪造 controller/runtime 释放调用')
const cleanupDoubleStringFixture = replaceDirectCleanup(String.raw`const proof = "escaped \" text newController?.dispose() newRuntime?.dispose()"`)
expect(rendererLifecycleFailures(cleanupDoubleStringFixture).includes(cleanupFailure), '门禁自身必须拒绝用含转义的双引号字符串伪造释放调用')
const cleanupTemplateFixture = replaceDirectCleanup('const proof = `escaped \\` text newController?.dispose() newRuntime?.dispose()`')
expect(rendererLifecycleFailures(cleanupTemplateFixture).includes(cleanupFailure), '门禁自身必须拒绝用含转义的模板字符串伪造释放调用')
const cleanupRegexFixture = replaceDirectCleanup('const proof = /newController?.dispose() newRuntime?.dispose()/')
expect(rendererLifecycleFailures(cleanupRegexFixture).includes(cleanupFailure), '门禁自身必须拒绝用正则字面量伪造释放调用')
const cleanupEscapedRegexFixture = replaceDirectCleanup(String.raw`const proof = /newController?.dispose()[\/]newRuntime?.dispose()\/end/gi`)
expect(rendererLifecycleFailures(cleanupEscapedRegexFixture).includes(cleanupFailure), '门禁自身必须拒绝用含转义斜杠、字符类和 flags 的正则伪造释放调用')
const cleanupConditionalRegexFixture = replaceDirectCleanup("if (true) /newController?.dispose() newRuntime?.dispose()/.test('')")
expect(rendererLifecycleFailures(cleanupConditionalRegexFixture).includes(cleanupFailure), '门禁自身必须拒绝条件语句中的正则字面量伪造释放调用')
const cleanupCommentFixture = replaceDirectCleanup('/* newController?.dispose() */')
expect(rendererLifecycleFailures(cleanupCommentFixture).includes(cleanupFailure), '门禁自身必须拒绝用注释伪造 controller/runtime 释放调用')
const cleanupNestedFixture = replaceDirectCleanup('if (false) { newController?.dispose(); newRuntime?.dispose() }')
expect(rendererLifecycleFailures(cleanupNestedFixture).includes(cleanupFailure), '门禁自身必须拒绝嵌套分支中的释放调用伪装顶层清理')
const cleanupReversedFixture = renderer
  .replace('newController?.dispose()', '__controller_dispose__')
  .replace('newRuntime?.dispose()', 'newController?.dispose()')
  .replace('__controller_dispose__', 'newRuntime?.dispose()')
expect(rendererLifecycleFailures(cleanupReversedFixture).includes(cleanupFailure), '门禁自身必须拒绝 controller/runtime 释放顺序反转')
const cleanupRethrowFixture = renderer.replace(/catch \(controllerDisposeError\) \{ cleanupFailures\.push\([^\n]+\) \}/, 'catch (controllerDisposeError) { throw controllerDisposeError }')
expect(rendererLifecycleFailures(cleanupRethrowFixture).includes(cleanupFailure), '门禁自身必须拒绝 controller 清理异常从 catch 重新抛出')
const fakeNestedCreationFixture = renderer
  .replace(/    try \{ newController\?\.dispose\(\) \}\n    catch \(controllerDisposeError\) \{[^\n]+\}\n/, '')
  .replace(/    try \{ newRuntime\?\.dispose\(\) \}\n    catch \(runtimeDisposeError\) \{[^\n]+\}\n/, '')
  .replace('  try {\n    newRuntime = createComplexBipedPetObject', `  try {
    const fake = () => createComplexBipedPetObject(compilation, normalizedRecipe.material)
  } catch {
    try { newController?.dispose() } catch {}
    try { newRuntime?.dispose() } catch {}
    emitCompilationIfChanged({ status: 'blocked', diagnostics: [{ id: 'three-runtime-create-failure' }] })
  }
  try {
    newRuntime = createComplexBipedPetObject`)
expect(rendererLifecycleFailures(fakeNestedCreationFixture).includes(cleanupFailure), '门禁自身禁止把嵌套函数中的伪创建 try 误认成真实 runtime 创建路径')
expect(!rendererLifecycleFailures(renderer).includes(cleanupFailure), '门禁自身必须接受创建异常 catch 中按序且独立吞并异常的清理 try')
const commentedExclusiveFixture = `<template>
  <ComplexBipedPetRenderer />
  <ProceduralPet />
  <!--
    <TresGroup v-if="showComplexRenderer"><ComplexBipedPetRenderer /></TresGroup>
    <ProceduralPet v-else />
  -->
</template>`
expect(!hasExclusiveRendererBranches(commentedExclusiveFixture), '门禁自身必须拒绝用 Vue HTML 注释伪造简单/复杂 renderer 互斥结构')
expect(!hasExclusiveRendererBranches(canvas.replace('</template>', '<ComplexBipedPetRenderer />\n</template>')), '门禁自身必须拒绝互斥分支外额外渲染 Complex renderer')
expect(!hasExclusiveRendererBranches(canvas.replace('</template>', '<ProceduralPet />\n</template>')), '门禁自身必须拒绝互斥分支外额外渲染 Procedural renderer')
expect(hasExclusiveRendererBranches(canvas.replace('</template>', '<!-- <ComplexBipedPetRenderer /><ProceduralPet /> -->\n</template>')), 'Vue HTML 注释内的额外 renderer 不应计入真实模板结构')

expect(canvas.includes('motionAsset?: StudioMotionAssetV2 | null'), 'Canvas 必须声明复杂动作资产输入')
expect(canvas.includes('motionTimeMs?: number'), 'Canvas 必须声明复杂动作时间输入')
expect(canvas.includes(':motion-asset="motionAsset"'), 'Canvas 必须向复杂 renderer 传递动作资产')
expect(canvas.includes(':motion-time-ms="motionTimeMs"'), 'Canvas 必须向复杂 renderer 传递动作时间')
expect(renderer.includes('compileBipedPetMotion'), '复杂 renderer 必须使用领域动作编译器')
expect(renderer.includes('sampleBipedPetMotion'), '复杂 renderer 必须使用领域动作采样器')
expect(renderer.includes('createComplexBipedMotionController'), '复杂 renderer 必须使用唯一 Three 动作控制器')
for (const failure of rendererLifecycleFailures(renderer)) expect(false, failure)
expect(!renderer.includes('<TresCanvas') && !renderer.includes('new WebGLRenderer'), '复杂 renderer 禁止创建第二个 WebGL 场景')
expect(hasExclusiveRendererBranches(canvas), '简单与复杂 renderer 必须保持互斥')
expect(!/createComplexBiped(?:Motion|Ik)Controller/.test(withoutComments(simpleRenderer)), '简单 renderer 禁止创建复杂 IK 或动作控制器')
expect(motionPage.includes(':motion-asset="draft"'), '动作工坊必须向唯一 Canvas 传递当前草稿')
expect(motionPage.includes(':motion-time-ms="editor.playheadTimeMs"'), '动作工坊必须向唯一 Canvas 传递播放指针')

if (failures.length) {
  console.error('复杂双足萌宠动作接线检查失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('复杂双足萌宠动作接线检查通过。')
