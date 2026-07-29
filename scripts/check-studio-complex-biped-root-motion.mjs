#!/usr/bin/env node
/**
 * 文件职责 / File responsibility
 * 静态校验复杂双足 Root Motion/VFX 的唯一渲染生命周期、简单模式互斥和新手设置接线。
 * Statically validates the single complex-biped Root Motion/VFX lifecycle, simple-mode exclusion, and beginner settings wiring.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parse as parseSfc } from '../apps/playground/node_modules/vue/compiler-sfc/index.mjs'
import * as ts from '../apps/playground/node_modules/typescript/lib/typescript.js'

const root = process.cwd()
const failures = []
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) {
    failures.push(`缺少文件 / Missing file: ${relativePath}`)
    return ''
  }
  return readFileSync(absolutePath, 'utf8')
}
const expect = (condition, message) => { if (!condition) failures.push(message) }
const collectTsNodes = (rootNode, predicate) => {
  const matches = []
  const visit = (node) => {
    if (predicate(node)) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(rootNode)
  return matches
}
const collectTemplateElements = (rootNode) => {
  const elements = []
  const visit = (node, parent) => {
    if (!node || typeof node !== 'object') return
    const nextParent = node.type === 1 ? node : parent
    if (node.type === 1) elements.push({ node, parent })
    if (Array.isArray(node.children)) for (const child of node.children) visit(child, nextParent)
    if (Array.isArray(node.branches)) for (const branch of node.branches) visit(branch, parent)
  }
  visit(rootNode, undefined)
  return elements
}
const sfcParts = (source, filename) => {
  const parsed = parseSfc(source, { filename })
  if (parsed.errors.length > 0) failures.push(`SFC 解析失败 / SFC parse failed: ${filename}`)
  const scriptSource = [parsed.descriptor.script?.content, parsed.descriptor.scriptSetup?.content].filter(Boolean).join('\n')
  const scriptAst = ts.createSourceFile(filename, scriptSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const script = ts.createPrinter({ removeComments: true }).printFile(scriptAst)
  const template = (parsed.descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/gu, '')
  const styles = parsed.descriptor.styles.map(style => style.content).join('\n').replace(/\/\*[\s\S]*?\*\//gu, '')
  const calls = collectTsNodes(scriptAst, ts.isCallExpression)
  const propertyAccesses = collectTsNodes(scriptAst, ts.isPropertyAccessExpression)
  const identifiers = collectTsNodes(scriptAst, ts.isIdentifier)
  const templateElements = collectTemplateElements(parsed.descriptor.template?.ast)
  return { script, scriptAst, calls, propertyAccesses, identifiers, styles, template, templateElements, combined: `${script}\n${template}` }
}
const maxWidthMediaRules = (styles) => {
  const rules = []
  const headerPattern = /@media\s*\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)\s*\{/gu
  let match
  while ((match = headerPattern.exec(styles)) !== null) {
    let depth = 1
    let cursor = headerPattern.lastIndex
    while (cursor < styles.length && depth > 0) {
      if (styles[cursor] === '{') depth += 1
      else if (styles[cursor] === '}') depth -= 1
      cursor += 1
    }
    rules.push({ maxWidth: Number(match[1]), body: styles.slice(headerPattern.lastIndex, cursor - 1) })
  }
  return rules
}
const hasSingleColumnRootMotionGrids = styles => /\.root-motion-mode-group\s*,\s*\.root-motion-summary\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0\s*,\s*1fr\)/u.test(styles)
const callText = (parts, call) => call.expression.getText(parts.scriptAst)
const callsNamed = (parts, name) => parts.calls.filter(call => callText(parts, call) === name)
const hasCall = (parts, name, predicate = () => true) => callsNamed(parts, name).some(predicate)
const elementsNamed = (parts, tag) => parts.templateElements.filter(item => item.node.tag === tag)
const directive = (element, name, argument, expression) => element.node.props.some((prop) => {
  if (prop.type !== 7 || prop.name !== name) return false
  if (argument !== undefined && prop.arg?.content !== argument) return false
  if (expression !== undefined && prop.exp?.content !== expression) return false
  return true
})
const attribute = (element, name, value) => element.node.props.some(prop => prop.type === 6 && prop.name === name && (value === undefined || prop.value?.content === value))
const isDescendantOf = (element, ancestorNode) => {
  let parent = element.parent
  while (parent) {
    if (parent === ancestorNode) return true
    parent = partsParentLookup.get(parent)
  }
  return false
}
const partsParentLookup = new Map()

const rendererSource = read('apps/playground/app/components/studio/ComplexBipedPetRenderer.vue')
const motionControllerSource = read('apps/playground/app/three/apply-complex-biped-motion.ts')
const weaponConstraintSource = read('apps/playground/app/three/apply-complex-biped-weapon-constraint.ts')
const settings = read('apps/playground/app/components/studio/StudioRootMotionSettings.vue')
const motionPageSource = read('apps/playground/app/pages/studio/motion.vue')
const canvasSource = read('apps/playground/app/components/studio/CloudFoxStudioCanvas.vue')
const proceduralSource = read('apps/playground/app/components/studio/ProceduralPet.vue')
const store = read('apps/playground/app/stores/studio-motion-editor.ts')
const assetStore = read('apps/playground/app/stores/studio-assets.ts')
const packageJson = JSON.parse(read('package.json') || '{}')
const rendererParts = sfcParts(rendererSource, 'ComplexBipedPetRenderer.vue')
const settingsParts = sfcParts(settings, 'StudioRootMotionSettings.vue')
const motionPageParts = sfcParts(motionPageSource, 'motion.vue')
const canvasParts = sfcParts(canvasSource, 'CloudFoxStudioCanvas.vue')
const proceduralParts = sfcParts(proceduralSource, 'ProceduralPet.vue')
const commentOnlyProbe = sfcParts(`<script setup lang="ts">/* vfxController.apply(frame.vfxSignals, motionVfxFrame) */</script><template><!-- <primitive v-if="motionVfxObject" :object="motionVfxObject" :dispose="false" /> --></template>`, 'CommentOnlyProbe.vue')
const stringOnlyProbe = sfcParts(`<script setup lang="ts">void 'vfxController.apply(frame.vfxSignals, motionVfxFrame)'</script><template>{{ '<primitive v-if="motionVfxObject" :object="motionVfxObject" :dispose="false" />' }}</template>`, 'StringOnlyProbe.vue')
const renderer = rendererParts.combined
const motionPage = motionPageParts.combined
for (const parts of [rendererParts, settingsParts, motionPageParts, canvasParts, proceduralParts]) {
  for (const element of parts.templateElements) if (element.parent) partsParentLookup.set(element.node, element.parent)
}
expect(callsNamed(commentOnlyProbe, 'vfxController.apply').length === 0 && elementsNamed(commentOnlyProbe, 'primitive').length === 0, 'SFC 门禁必须忽略 JS 与 HTML 注释中的伪实现 / SFC gate must ignore fake implementations inside JS and HTML comments')
expect(callsNamed(stringOnlyProbe, 'vfxController.apply').length === 0 && elementsNamed(stringOnlyProbe, 'primitive').length === 0, 'SFC 门禁必须忽略字符串字面量中的伪实现 / SFC gate must ignore fake implementations inside string literals')

expect(callsNamed(rendererParts, 'createComplexBipedMotionController').length === 1, '复杂 renderer 必须只创建一个动作控制器 / Complex renderer must create exactly one motion controller')
expect(callsNamed(rendererParts, 'createComplexBipedMotionVfxController').length === 1, '复杂 renderer 必须只创建一个 VFX 控制器 / Complex renderer must create exactly one VFX controller')
const vfxPrimitive = elementsNamed(rendererParts, 'primitive').find(element => directive(element, 'if', undefined, 'motionVfxObject') && directive(element, 'bind', 'object', 'motionVfxObject') && directive(element, 'bind', 'dispose', 'false'))
expect(Boolean(vfxPrimitive), 'VFX Group 必须作为角色同级 primitive / VFX Group must be a sibling primitive')
expect(hasCall(rendererParts, 'controller.apply') && hasCall(rendererParts, 'vfxController.apply', call => call.arguments[0]?.getText(rendererParts.scriptAst) === 'frame.vfxSignals' && call.arguments[1]?.getText(rendererParts.scriptAst) === 'motionVfxFrame'), '动作帧信号必须立即交给 VFX 控制器 / Motion-frame signals must be forwarded immediately to VFX')
expect(rendererParts.propertyAccesses.some(node => node.getText(rendererParts.scriptAst) === 'currentRuntime.object.position') && !rendererParts.calls.some(call => /(?:^|\.)getWorldPosition$/u.test(callText(rendererParts, call))), 'VFX 必须读取角色容器的同父级局部 position / VFX must use the character container parent-local position')
expect(hasCall(rendererParts, 'vfxForward.set(0, 0, 1).applyQuaternion', call => call.arguments[0]?.getText(rendererParts.scriptAst) === 'currentRuntime.object.quaternion') && hasCall(rendererParts, 'Math.atan2', call => call.arguments[0]?.getText(rendererParts.scriptAst) === 'vfxForward.x' && call.arguments[1]?.getText(rendererParts.scriptAst) === 'vfxForward.z'), 'VFX 朝向必须由角色最终 Quaternion 的局部 +Z 派生 / VFX facing must derive from final local +Z through the character quaternion')
expect(/motionWeight[^\n]+<=\s*0[\s\S]{0,260}resetMotionPreview/.test(renderer), '停止权重必须显式 reset 动作与 VFX / Stopped weight must explicitly reset motion and VFX')
expect(/clip\.status\s*!==\s*'ready'[\s\S]{0,260}resetMotionPreview/.test(renderer), 'blocked 或无动作必须显式 reset 动作与 VFX / Blocked or absent motion must explicitly reset motion and VFX')
expect(/lastAppliedMotionTimeMs[^\n]+!==\s*undefined[\s\S]{0,180}requestedTimeMs\s*<\s*lastAppliedMotionTimeMs[\s\S]{0,180}resetMotionPreview/.test(renderer), '时间轴回退必须在采样前显式 reset 动作与 VFX / Timeline rewind must explicitly reset motion and VFX before sampling')
expect(/function\s+synchronizePreview[\s\S]{0,2600}try\s*\{[\s\S]{0,1200}catch\s*\(error\)[\s\S]{0,500}resetMotionPreview/.test(renderer), 'watcher 同步必须经过统一异常边界并尽力 reset / Watcher synchronization must use one exception boundary with best-effort reset')
expect(/synchronizingPreview/.test(renderer) && /three-preview-sync-failure/.test(renderer) && /previewFailureDomain/.test(renderer) && /failedAssetStillActive/.test(renderer), '同步边界必须防重入、按失败域/资产恢复并输出 blocked 诊断 / Sync boundary must prevent re-entry, recover by failure domain and asset, and emit blocked diagnostics')
expect(/function\s+applyMotion\(\):\s*boolean[\s\S]{0,500}!clip[\s\S]{0,180}return\s+false/.test(renderer) && /lastRuntimeKey\.value\s*=\s*undefined[\s\S]{0,180}disposeRuntime/.test(renderer), '无 clip/runtime 不得误报同步成功，灾难清理后必须允许同配方重建 / Missing clip/runtime must not report success and catastrophic cleanup must allow same-recipe rebuild')
expect(/watch\(\(\)\s*=>\s*props\.motionAsset,\s*syncMotionAsset/.test(renderer) && /watch\(\(\)\s*=>\s*\[props\.motionTimeMs,\s*props\.motionWeight\][\s\S]{0,100}syncMotionFrame/.test(renderer), 'Vue watcher 不得直接调用可能抛错的 compile/apply / Vue watchers must not directly invoke throwing compile/apply paths')
expect(/function\s+compileMotion\([\s\S]{0,180}motionClip\.value\s*=\s*undefined[\s\S]{0,520}resetMotionPreview/.test(renderer), 'Clip 切换必须先清旧 clip 再执行可能失败的 reset / Clip switching must clear the old clip before a fallible reset')
expect(/motionVfxController\.value\s*=\s*undefined[\s\S]{0,320}motionController\.value\s*=\s*undefined[\s\S]{0,320}runtime\.value\s*=\s*undefined/.test(renderer), '释放前必须先按 VFX、动作、runtime 清空浅引用 / Shallow refs must detach in VFX, motion, runtime order before cleanup')
expect(/vfxController\?\.dispose\(\)[\s\S]{0,260}controller\?\.dispose\(\)[\s\S]{0,260}currentRuntime\?\.dispose\(\)/.test(renderer), '资源必须按 VFX、动作、runtime 逆序尽力释放 / Resources must be best-effort disposed in VFX, motion, runtime reverse order')
expect(/String\(error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*error\)/.test(renderer) && /catch\s*\{\s*return\s+'未知错误'/.test(renderer), '释放诊断必须安全字符串化任意抛出值 / Cleanup diagnostics must safely stringify arbitrary thrown values')
expect(/watch\(\(\)\s*=>\s*\[props\.motionTimeMs,\s*props\.motionWeight\][\s\S]{0,100}syncMotionFrame/.test(renderer) && /function\s+syncMotionFrame\([\s\S]{0,180}applyMotion/.test(renderer), '时间变化只能经安全边界采样动作，不得重建控制器 / Time changes must only sample motion through the safe boundary without rebuilding controllers')
expect(elementsNamed(rendererParts, 'TresCanvas').length === 0 && callsNamed(rendererParts, 'requestAnimationFrame').length === 0 && !rendererParts.identifiers.some(identifier => identifier.text === 'Skeleton'), '复杂 renderer 不得创建 Canvas、RAF 或 Skeleton / Complex renderer must not create Canvas, RAF, or Skeleton')

const balanceIndex = motionControllerSource.indexOf('balanceController?.apply')
const firstMatrixIndex = motionControllerSource.indexOf('runtime.object.updateMatrixWorld(true)', balanceIndex)
const weaponHookIndex = motionControllerSource.indexOf('options.beforeLegIk?.', firstMatrixIndex)
const legIkIndex = motionControllerSource.indexOf('ikController?.apply', weaponHookIndex)
expect(balanceIndex >= 0 && firstMatrixIndex > balanceIndex && weaponHookIndex > firstMatrixIndex && legIkIndex > weaponHookIndex, '持械 hook 必须固定在 Balance 与首次世界矩阵更新后、腿 IK 前 / Weapon hook must run after Balance and the first world-matrix update but before leg IK')
expect(/freezesDisplayPose[\s\S]{0,700}return Object\.freeze/.test(motionControllerSource) && motionControllerSource.indexOf('freezesDisplayPose') < motionControllerSource.indexOf('options.beforeLegIk?.'), '重复暂停帧必须在持械 hook 前冻结 / Duplicate paused frames must freeze before the weapon hook')
expect(/ownerByRuntime\s*=\s*new WeakMap/.test(weaponConstraintSource) && /同一运行时只能创建一个持械约束控制器/.test(weaponConstraintSource), '副手持械控制器必须拥有 runtime 单写入令牌 / Secondary-grip controller must own a single-writer runtime token')
expect(weaponConstraintSource.includes('solveAnalyticTwoBoneIk') && weaponConstraintSource.includes('solveConstrainedFabrik') && weaponConstraintSource.includes('clampTargetAlongWeaponAxis'), '持械控制器必须提供解析式主路径、FABRIK 降级与武器轴钳制 / Weapon controller must provide analytic solving, FABRIK fallback, and weapon-axis clamping')
expect(!/handle\.object\.(?:position|quaternion|rotation|scale|matrix)\s*(?:=|\.|\[)/u.test(weaponConstraintSource), '持械控制器不得写主手拥有的道具变换 / Weapon controller must not write the primary-owned prop transform')
expect(!/\.position\.(?:set|copy|add|sub|multiply)/u.test(weaponConstraintSource.replace(/handle\.object[\s\S]*?applyMatrix4\(object\.matrixWorld\)/u, '')), '持械控制器不得改写手臂骨骼局部 position / Weapon controller must not mutate arm-bone local positions')

expect(elementsNamed(canvasParts, 'TresCanvas').length === 1, 'Studio 画布必须只保留一个 TresCanvas / Studio preview must retain exactly one TresCanvas')
expect(callsNamed(proceduralParts, 'createComplexBipedMotionController').length === 0 && callsNamed(proceduralParts, 'createComplexBipedMotionVfxController').length === 0, 'ProceduralPet 不得创建复杂控制器 / ProceduralPet must not create complex controllers')
const complexGroup = elementsNamed(canvasParts, 'TresGroup').find(element => directive(element, 'if', undefined, 'showComplexRenderer'))
const complexRendererElement = elementsNamed(canvasParts, 'ComplexBipedPetRenderer').find(element => complexGroup && isDescendantOf(element, complexGroup.node))
expect(Boolean(complexGroup && complexRendererElement), '复杂 renderer 必须仅存在于复杂分支 / Complex renderer must exist only in the complex branch')
expect(elementsNamed(canvasParts, 'ProceduralPet').some(element => directive(element, 'else')), '简单 ProceduralPet 必须与复杂分支严格互斥 / Simple ProceduralPet must be mutually exclusive with the complex branch')
expect(/playbackRequestedTimeMs:\s*number/.test(store) && /this\.playbackRequestedTimeMs\s*=\s*requested/.test(store), 'Store 必须分离单调运行时请求时间与显示 playhead / Store must separate monotonic runtime requested time from the display playhead')
expect(elementsNamed(motionPageParts, 'CloudFoxStudioCanvas').some(element => directive(element, 'bind', 'motion-time-ms', 'editor.playbackRequestedTimeMs')), '复杂动作 renderer 必须消费单调运行时请求时间 / Complex motion renderer must consume monotonic runtime requested time')
expect(elementsNamed(motionPageParts, 'StudioPreviewToolbar').some(element => directive(element, 'bind', 'time-ms', 'editor.playheadTimeMs')) && elementsNamed(motionPageParts, 'StudioMotionTimeline').some(element => directive(element, 'bind', 'playhead-time-ms', 'editor.playheadTimeMs')), '控制栏与时间轴必须继续显示解析后的 playhead / Toolbar and timeline must retain the resolved display playhead')

expect(/updateRootMotionSettings\s*\(patch:/.test(store), 'Store 必须提供 updateRootMotionSettings / Store must expose updateRootMotionSettings')
expect(/restoreRootMotionRecommendations\s*\(/.test(store), 'Store 必须提供恢复动作推荐值 API / Store must expose recommendation restoration')
expect(/baselineAsset\s*&&\s*hasAuthoredRootMotion\(baselineAsset\)[\s\S]{0,180}scaleRootMotionRecommendation\(normalizedRootMotion\(baselineAsset\),\s*baselineAsset\.durationMs,\s*asset\.durationMs\)/.test(store), '已有 baseline Root Motion 必须优先并按当前时长缩放 / Existing baseline Root Motion must take precedence and scale to the current duration')
expect(!/canonicalCopyName|builtInAuthoringFingerprint/.test(store), '恢复推荐不得通过名称或弱特征猜测内置来源 / Recommendation restoration must not infer built-in provenance from names or weak fingerprints')
expect(/sourceMotionId:\s*source\.id/.test(assetStore), '复制内置动作时必须写入可靠 sourceMotionId / Built-in motion copies must record a reliable sourceMotionId')
expect(elementsNamed(motionPageParts, 'StudioRootMotionSettings').length === 1 && /propertyTab\s*===\s*'basic'/.test(motionPage), '根运动设置必须接入基础属性页 / Root-motion settings must be wired into the basic property tab')
for (const label of ['原地播放', '实际移动', '自动特效', '预计移动距离', '预计转向', '预计跳跃高度', '恢复动作推荐值']) {
  expect(settingsParts.template.includes(label), `新手设置缺少文案 / Beginner settings missing copy: ${label}`)
}
expect(elementsNamed(settingsParts, 'button').some(element => attribute(element, 'role', 'switch') && directive(element, 'bind', 'aria-checked')), '自动特效必须提供 switch 语义 / Automatic VFX must expose switch semantics')
expect(elementsNamed(settingsParts, 'button').filter(element => directive(element, 'bind', 'aria-pressed')).length >= 2, '移动方式按钮必须公开 aria-pressed / Movement-mode buttons must expose aria-pressed')
const settingsTemplate = settingsParts.template
expect(!/(骨骼|窗口数组|速度阈值|粒子数量)/.test(settingsTemplate), '新手界面不得暴露底层骨骼、窗口或粒子参数 / Beginner UI must not expose low-level rig, window, or particle parameters')
expect(/container-type:inline-size/.test(settingsParts.styles) && /@container\s+root-motion-panel\s*\(max-width:[^)]+\)[\s\S]*grid-template-columns:\s*minmax\(0,1fr\)/.test(settingsParts.styles), '根运动设置必须按真实容器宽度切为单列 / Root-motion settings must become one column from its actual container width')
const narrowViewportRule = maxWidthMediaRules(settingsParts.styles).find(rule => rule.maxWidth >= 760 && rule.maxWidth <= 780 && hasSingleColumnRootMotionGrids(rule.body))
expect(Boolean(narrowViewportRule), '760px 窄视口下移动方式与预计结果必须切为单列 / Movement modes and summaries must become one column at the 760px narrow viewport')
expect(/root-motion-mode-button\{[^}]*font-size:12px/.test(settings) && /root-motion-settings-guidance\{[^}]*font-size:11px/.test(settings) && /root-motion-summary-label\{[^}]*font-size:10px/.test(settings), '正文与控制字号必须保持可读的 10–12px 下限 / Body and control copy must preserve a readable 10–12px floor')

expect(packageJson.scripts?.['check:studio-complex-biped-root-motion'] === 'node scripts/check-studio-complex-biped-root-motion.mjs', 'package.json 必须注册 Root Motion Studio 门禁 / package.json must register the Root Motion Studio gate')
expect(String(packageJson.scripts?.typecheck || '').includes('check:studio-complex-biped-root-motion'), '总 typecheck 必须串入 Root Motion Studio 门禁 / Aggregate typecheck must include the Root Motion Studio gate')

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
else console.log('复杂双足 Root Motion/VFX 与新手设置门禁通过。 / Complex-biped Root Motion/VFX and beginner-settings gate passed.')
